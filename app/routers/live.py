from __future__ import annotations

import asyncio
import logging
from collections import defaultdict

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.encoders import jsonable_encoder
from pydantic import ValidationError

from app.db.database import AsyncSessionLocal
from app.schemas.game import RespondGameOfferRequest
from app.schemas.move import MoveRequest
from app.services import auth_service, chess_service


router = APIRouter(tags=["live"])
logger = logging.getLogger(__name__)


class GameConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, game_id: int, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections[game_id].add(websocket)

    async def disconnect(self, game_id: int, websocket: WebSocket) -> None:
        async with self._lock:
            sockets = self._connections.get(game_id)
            if not sockets:
                return
            sockets.discard(websocket)
            if not sockets:
                self._connections.pop(game_id, None)

    async def send(self, websocket: WebSocket, message: dict) -> None:
        await websocket.send_json(jsonable_encoder(message))

    async def broadcast(self, game_id: int, message: dict) -> None:
        async with self._lock:
            sockets = list(self._connections.get(game_id, set()))
        stale: list[WebSocket] = []
        for websocket in sockets:
            try:
                await self.send(websocket, message)
            except Exception:
                stale.append(websocket)
        for websocket in stale:
            await self.disconnect(game_id, websocket)


manager = GameConnectionManager()


def _token_from_websocket(websocket: WebSocket) -> str | None:
    token = (
        websocket.query_params.get("token")
        or websocket.query_params.get("access_token")
        or websocket.query_params.get("accessToken")
    )
    if token:
        return token
    authorization = websocket.headers.get("authorization")
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return None


async def _send_error(websocket: WebSocket, detail: str, status_code: int = 400) -> None:
    await manager.send(websocket, {"type": "error", "status": status_code, "detail": detail})


async def _game_state_message(db, game_id: int, event_type: str = "game_state") -> dict:
    game = await chess_service.get_game_or_404(db, game_id)
    return {"type": event_type, "game": chess_service.serialize_game(game)}


@router.websocket("/api/ws/games/{game_id}")
@router.websocket("/ws/games/{game_id}")
async def game_socket(websocket: WebSocket, game_id: int) -> None:
    client = f"{websocket.client.host}:{websocket.client.port}" if websocket.client else "unknown"
    logger.info("WebSocket handshake received: client=%s game_id=%s path=%s", client, game_id, websocket.url.path)
    token = _token_from_websocket(websocket)
    if not token:
        logger.warning("WebSocket rejected: missing token client=%s game_id=%s", client, game_id)
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    async with AsyncSessionLocal() as db:
        try:
            user = await auth_service.get_user_from_access_token(db, token)
            game = await chess_service.get_game_or_404(db, game_id)
            chess_service.assert_user_can_view_game(game, user)
        except HTTPException as exc:
            logger.warning(
                "WebSocket rejected: client=%s game_id=%s status=%s detail=%s",
                client,
                game_id,
                exc.status_code,
                exc.detail,
            )
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    await websocket.accept()
    await manager.connect(game_id, websocket)
    logger.info("WebSocket connected: client=%s game_id=%s user_id=%s", client, game_id, user.id)
    last_terminal_status: str | None = None

    try:
        async with AsyncSessionLocal() as db:
            await manager.send(websocket, await _game_state_message(db, game_id))

        while True:
            try:
                message = await asyncio.wait_for(websocket.receive_json(), timeout=1.0)
            except TimeoutError:
                async with AsyncSessionLocal() as db:
                    game = await chess_service.get_game_or_404(db, game_id)
                    if game.status in chess_service.TERMINAL_STATUSES and last_terminal_status != game.status:
                        last_terminal_status = game.status
                        await manager.broadcast(game_id, {"type": "game_over", "game": chess_service.serialize_game(game)})
                continue

            if not isinstance(message, dict):
                await _send_error(websocket, "Websocket message must be a JSON object")
                continue

            message_type = str(message.get("type", "")).strip()
            try:
                async with AsyncSessionLocal() as db:
                    user = await auth_service.get_user_from_access_token(db, token)
                    game = await chess_service.get_game_or_404(db, game_id)
                    chess_service.assert_user_can_view_game(game, user)

                    if message_type == "sync":
                        await manager.send(websocket, {"type": "game_state", "game": chess_service.serialize_game(game)})
                        continue

                    if message_type == "move":
                        payload = message.get("payload") if isinstance(message.get("payload"), dict) else message
                        move_request = MoveRequest.model_validate(payload)
                        updated_game, move = await chess_service.apply_move(db, game, move_request, user)
                        event_type = "game_over" if updated_game.status in chess_service.TERMINAL_STATUSES else "move_made"
                        await manager.broadcast(
                            game_id,
                            {
                                "type": event_type,
                                "game": chess_service.serialize_game(updated_game),
                                "move": chess_service.serialize_move(move),
                            },
                        )
                        continue

                    if message_type == "aiMove":
                        updated_game, move = await chess_service.ai_move(db, game, user)
                        event_type = "game_over" if updated_game.status in chess_service.TERMINAL_STATUSES else "move_made"
                        await manager.broadcast(
                            game_id,
                            {
                                "type": event_type,
                                "game": chess_service.serialize_game(updated_game),
                                "move": chess_service.serialize_move(move),
                            },
                        )
                        continue

                    if message_type == "resign":
                        updated_game = await chess_service.resign_game(db, game, user)
                        await manager.broadcast(game_id, {"type": "game_over", "game": chess_service.serialize_game(updated_game)})
                        continue

                    if message_type == "respondOffer":
                        offer_id = int(message.get("offerId"))
                        payload = message.get("payload") if isinstance(message.get("payload"), dict) else message
                        response = RespondGameOfferRequest.model_validate(payload)
                        offer = await chess_service.respond_to_game_offer(db, game, offer_id, response, user)
                        updated_game = await chess_service.get_game_or_404(db, game_id)
                        await manager.broadcast(
                            game_id,
                            {
                                "type": "offer_updated",
                                "offer": chess_service.serialize_game_offer(offer),
                                "game": chess_service.serialize_game(updated_game),
                            },
                        )
                        continue

                    await _send_error(websocket, "Unsupported websocket message type")
            except ValidationError as exc:
                await _send_error(websocket, str(exc), 422)
            except HTTPException as exc:
                await _send_error(websocket, str(exc.detail), exc.status_code)
            except Exception:
                await _send_error(websocket, "Unexpected websocket error", 500)
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected: client=%s game_id=%s", client, game_id)
    finally:
        await manager.disconnect(game_id, websocket)
