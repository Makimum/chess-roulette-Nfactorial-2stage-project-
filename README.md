[README (1).md](https://github.com/user-attachments/files/27177752/README.1.md)
<div align="center">

# [**♞ Chess Roulette API**](https://chess-roulette.lovable.app)

### Backend для шахматной платформы Chess Roulette

FastAPI backend для регистрации, live-игр, WebSocket-синхронизации, анализа партий, профилей игроков, лидерборда, Agora video/audio chat, Resend email-кодов и Telegram proxy-хранилища аватарок.

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.1.0-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-asyncpg-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.x-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white)](https://www.sqlalchemy.org/)
[![WebSocket](https://img.shields.io/badge/WebSocket-Live_Game-111827?style=for-the-badge)](#-websocket-live-game)
[![Stockfish](https://img.shields.io/badge/Stockfish-Analysis-22C55E?style=for-the-badge)](https://stockfishchess.org/)

[**Frontend Demo**](https://chess-roulette.lovable.app) · [**Swagger UI**](http://127.0.0.1:8000/docs) · [**OpenAPI JSON**](http://127.0.0.1:8000/openapi.json)

</div>

---

## Оглавление

- [О проекте](#-о-проекте)
- [Возможности](#-возможности)
- [Технологический стек](#-технологический-стек)
- [Быстрый старт](#-быстрый-старт)
- [Переменные окружения](#-переменные-окружения)
- [API Обзор](#-api-обзор)
- [WebSocket Live Game](#-websocket-live-game)
- [База данных и миграции](#-база-данных-и-миграции)
- [Структура проекта](#-структура-проекта)
- [Документация для фронтенда](#-документация-для-фронтенда)
- [Деплой](#-деплой)
- [Дорожная карта](#-дорожная-карта)
- [Лицензия](#-лицензия)

---

## О проекте

**Chess Roulette API** — backend для шахматного приложения Chess Roulette. Он отвечает за серверную часть продукта:

- обязательную регистрацию через email-код;
- хранение пользователей, рейтинга, странового снапшота и профилей;
- live-партии против AI, локально и с другом;
- WebSocket-синхронизацию ходов, часов, draw/undo/rematch/resign событий;
- правило одного активного live-матча против человека;
- разбор партии через Stockfish;
- Agora RTC токены для voice/video chat;
- загрузку аватарок в Telegram-группу и безопасную выдачу через backend proxy;
- публичные профили игроков и поиск по username.

Backend построен так, чтобы frontend не доверял локальному состоянию в критичных местах: легальность ходов, очередь хода, часы, timeout, результат партии и рейтинг считаются на сервере.

---

## Возможности

|  | Фича | Описание |
|:-:|:--|:--|
| 🔐 | **Auth** | Signup/login через email + password, JWT access/refresh sessions |
| ✉️ | **Email-коды** | Регистрация, смена email, восстановление пароля через Resend |
| 🌍 | **Страна при регистрации** | `country_code` фиксируется по edge-заголовкам IP и не приходит с frontend |
| ♟️ | **Игры** | AI, friend-room, local режимы |
| ⚡ | **WebSocket live** | Ходы, AI move, resign, draw/undo/rematch, sync, game over |
| ⏱️ | **Часы** | Серверные time controls: initial + increment, timeout на backend |
| 🧠 | **Game review** | Анализ партии Stockfish: eval, best move, centipawn loss, classification |
| 🏆 | **Leaderboard** | Рейтинг пользователей с фильтром по стране |
| 👤 | **Публичные профили** | Профиль игрока, статистика, recent games, поиск по username |
| 📹 | **Agora RTC** | Серверная выдача токенов для voice/video |
| 🖼️ | **Profile photos** | Upload в Telegram, хранение `file_id`, proxy stream через backend |

---

## Технологический стек

| Слой | Технология |
|:--|:--|
| **API framework** | [FastAPI](https://fastapi.tiangolo.com/) |
| **ASGI server** | [Uvicorn](https://www.uvicorn.org/) |
| **Database** | [PostgreSQL](https://www.postgresql.org/) + `asyncpg` |
| **ORM** | [SQLAlchemy 2.x Async ORM](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html) |
| **Validation** | [Pydantic](https://docs.pydantic.dev/) |
| **Chess logic** | [python-chess](https://python-chess.readthedocs.io/) |
| **Engine** | [Stockfish](https://stockfishchess.org/) через UCI |
| **Email** | [Resend](https://resend.com/) |
| **Voice/video** | [Agora RTC](https://www.agora.io/) + `agora-token-builder` |
| **Profile photo storage** | Telegram Bot API |
| **Config** | `.env` + `python-dotenv` |

---

## Быстрый старт

### Требования

- Python **3.11+**
- PostgreSQL
- Stockfish binary, если нужен game review и AI move через engine
- Git

### Установка

```powershell
# 1. Клонировать репозиторий
git clone https://github.com/your-username/chess-mentor-arena.git
cd chess-mentor-arena

# 2. Создать виртуальное окружение
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# 3. Установить зависимости
pip install fastapi "uvicorn[standard]" sqlalchemy asyncpg python-dotenv pydantic python-multipart python-chess agora-token-builder

# 4. Создать .env и заполнить переменные
New-Item .env -ItemType File

# 5. Запустить backend
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Используйте шаблон из раздела ниже и подставьте свои значения.

После запуска:

- Health check: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)
- Swagger UI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- OpenAPI JSON: [http://127.0.0.1:8000/openapi.json](http://127.0.0.1:8000/openapi.json)

---

## Переменные окружения

Создайте `.env` в корне проекта. Никогда не коммитьте реальные ключи.

```env
# --- DATABASE ---
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/chess_db
STOCKFISH_PATH=./engines/stockfish.exe

# --- CORS ---
DEFAULT_CORS_ORIGINS=http://localhost:5173
BACKEND_CORS_ORIGINS=https://chess-roulette.lovable.app
DEFAULT_CORS_ORIGIN_REGEX=https://.*\.(lovable\.app|lovableproject\.com)$
BACKEND_CORS_ORIGIN_REGEX=

# --- CLOUDFLARE OPTIONAL ---
CF_TOKEN=

# --- AUTH ---
JWT_SECRET=replace-with-long-random-secret
JWT_ALGORITHM=HS256
DEFAULT_DEV_JWT_SECRET=dev-only-change-me-chess-mentor-arena

# --- TOKENS ---
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30
AUTH_SESSION_INACTIVITY_DAYS=14
ROOM_INVITE_TTL_HOURS=24
GAME_OFFER_EXPIRE_MINUTES=10

# --- AGORA ---
AGORA_APP_ID=
AGORA_APP_CERTIFICATE=
AGORA_RTC_TOKEN_EXPIRE_SECONDS=3600

# --- EMAIL / RESEND ---
RESEND_API_KEY=
RESEND_FROM_EMAIL=Chess Roulette <code@example.com>
RESEND_REPLY_TO=
EMAIL_CODE_LENGTH=6
EMAIL_CODE_EXPIRE_MINUTES=10
EMAIL_CODE_RESEND_COOLDOWN_SECONDS=60
EMAIL_CODE_MAX_ATTEMPTS=5

# --- TELEGRAM PROFILE PHOTO STORAGE ---
BOT_TOKEN=
TELEGRAM_PROFILE_PHOTO_CHAT_ID=
PROFILE_PHOTO_MAX_BYTES=5242880

# --- GAME REVIEW ---
GAME_REVIEW_ANALYSIS_TIME_SECONDS=0.08
GAME_REVIEW_ANALYSIS_DEPTH=10
```

### Важные замечания

- `DATABASE_URL` обязателен: без него приложение не стартует.
- `JWT_SECRET` должен быть длинным случайным секретом в production.
- `RESEND_API_KEY` и `RESEND_FROM_EMAIL` нужны для отправки кодов.
- `BOT_TOKEN` и `TELEGRAM_PROFILE_PHOTO_CHAT_ID` нужны для profile photo upload/proxy.
- `AGORA_APP_ID` и `AGORA_APP_CERTIFICATE` нужны для voice/video tokens.
- `STOCKFISH_PATH` нужен для AI move и полноценного game review.

---

## API Обзор

Полный актуальный OpenAPI-контракт доступен после запуска backend:

- Swagger UI: `http://127.0.0.1:8000/docs`
- OpenAPI JSON: `http://127.0.0.1:8000/openapi.json`

Основные группы:

| Группа | Endpoint examples |
|:--|:--|
| **Health** | `GET /health` |
| **Auth** | `POST /api/auth/signup/send-code`, `POST /api/auth/signup/confirm`, `POST /api/auth/login`, `GET /api/auth/me` |
| **Password/email** | `POST /api/auth/password-reset/send-code`, `POST /api/auth/email-change/confirm`, `POST /api/auth/password/change` |
| **Games** | `POST /api/games`, `GET /api/games/active`, `GET /api/games/{gameId}` |
| **Live fallback/debug** | `POST /api/games/{gameId}/move`, `POST /api/games/{gameId}/ai-move`, `POST /api/games/{gameId}/resign` |
| **Review** | `GET/POST /api/games/{gameId}/review` |
| **Rooms** | `POST /api/rooms`, `GET /api/rooms/{roomCode}`, `POST /api/rooms/{roomCode}/join` |
| **Offers** | `POST /api/games/{gameId}/offers`, `POST /api/games/{gameId}/offers/{offerId}/respond` |
| **Profiles** | `GET /api/users/{userId}/profile`, `GET /api/users/by-username/{username}/profile` |
| **Photos** | `POST /api/users/me/photo`, `DELETE /api/users/me/photo`, `GET /api/users/{userId}/photo` |
| **Leaderboard** | `GET /api/leaderboard`, `GET /api/leaderboard?countryCode=US` |
| **Agora** | `GET /api/agora/config`, `POST /api/agora/rtc-token` |

---

## WebSocket Live Game

Live-партия работает через WebSocket:

```text
ws://<API_HOST>/ws/games/{gameId}?token=<accessToken>
```

Alias:

```text
ws://<API_HOST>/api/ws/games/{gameId}?token=<accessToken>
```

Основные сообщения frontend -> backend:

```json
{ "type": "sync" }
```

```json
{ "type": "move", "payload": { "from": "e2", "to": "e4", "promotion": null } }
```

```json
{ "type": "aiMove" }
```

```json
{ "type": "resign" }
```

```json
{ "type": "createOffer", "payload": { "offerType": "draw" } }
```

```json
{ "type": "respondOffer", "payload": { "offerId": 1, "action": "accept" } }
```

Backend отправляет snapshots и события:

- `game_state`
- `move_made`
- `game_over`
- `offer_created`
- `offer_responded`
- `error`

Этот раздел описывает базовый live protocol. Если frontend-команде нужен более подробный prompt, его стоит вынести в отдельный `FRONTEND_LIVE_GAME_WEBSOCKET.md`.

---

## База данных и миграции

При старте приложения вызывается:

```python
await init_db()
```

Что происходит:

1. SQLAlchemy создает отсутствующие таблицы через `Base.metadata.create_all`.
2. `app/db/migrations.py` выполняет idempotent schema maintenance.
3. Таблица `schema_migrations` не используется и намеренно удаляется.
4. Legacy guest/UUID gameplay schema может быть сброшена, если обнаружены старые таблицы или старые user-поля.

Текущая модель ID:

- `user_profiles.id` — UUID string;
- игровые сущности (`games`, `moves`, `rooms`, `offers`, `events`, `sessions`) — numeric autoincrement ID.

Текущая auth-модель:

- гостевой вход удален;
- регистрация обязательна;
- `email` и `username` уникальны;
- `username` max 16 символов;
- городов нет;
- `country_code` фиксируется на регистрации через trusted edge headers, а не вводится пользователем.

---

## Структура проекта

```text
chess-mentor-arena/
├── main.py                         # FastAPI app, CORS, routers, lifespan init_db
├── app/
│   ├── core/
│   │   ├── config.py               # Typed settings from app.data.config
│   │   ├── security.py             # JWT, password hashing, refresh token helpers
│   │   └── validation.py           # Shared length limits
│   ├── data/
│   │   └── config.py               # .env loading and raw env parsing
│   ├── db/
│   │   ├── database.py             # Async SQLAlchemy engine/session/init_db
│   │   ├── migrations.py           # Idempotent schema maintenance
│   │   └── models.py               # ORM models
│   ├── routers/
│   │   ├── auth.py                 # Auth/email/password endpoints
│   │   ├── games.py                # Game REST endpoints
│   │   ├── live.py                 # WebSocket live game
│   │   ├── rooms.py                # Friend rooms
│   │   ├── users.py                # Public profiles and profile photos
│   │   ├── leaderboard.py          # Leaderboard
│   │   ├── agora.py                # Agora config/token
│   │   └── health.py               # Health check
│   ├── schemas/                    # Pydantic request/response contracts
│   ├── services/
│   │   ├── auth_service.py
│   │   ├── chess_service.py
│   │   ├── game_review_service.py
│   │   ├── stockfish_service.py
│   │   ├── email_code_service.py
│   │   ├── profile_photo_service.py
│   │   ├── user_profile_service.py
│   │   ├── room_service.py
│   │   ├── leaderboard_service.py
│   │   ├── agora_service.py
│   │   └── location_service.py
│   └── templates/
│       ├── signup_verification.htm
│       ├── password_reset.htm
│       └── email_change.htm
├── engines/
│   └── stockfish.exe               # Local Stockfish binary, optional path target
├── document.md                     # README frontend-приложения от Lovable
└── README.md
```

---

## Документация для фронтенда

Backend сам публикует машинно-читаемую документацию через OpenAPI. Для frontend-разработки используйте:

| Источник | Назначение |
|:--|:--|
| `GET /openapi.json` | Полный schema contract для генерации типов |
| `/docs` | Swagger UI для ручной проверки endpoints |
| Раздел [API Обзор](#-api-обзор) | Быстрая навигация по backend-группам |
| Раздел [WebSocket Live Game](#-websocket-live-game) | Краткий live-game protocol |

Если нужны отдельные frontend prompts, их можно хранить рядом с README как `FRONTEND_*.md`.

---

## Деплой

### Production checklist

- [ ] Настроить PostgreSQL и `DATABASE_URL`.
- [ ] Задать сильный `JWT_SECRET`.
- [ ] Настроить CORS origins/regex под frontend домены.
- [ ] Подключить Resend для email-кодов.
- [ ] Подключить Agora App ID + Certificate.
- [ ] Создать Telegram bot + private group для profile photos.
- [ ] Указать `STOCKFISH_PATH` или положить Stockfish в ожидаемое место.
- [ ] Проверить `/health`.
- [ ] Проверить `/docs`.
- [ ] Проверить WebSocket upgrade через production proxy.

### Локальный запуск через Uvicorn

```powershell
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

### Cloudflare Tunnel

В `main.py` есть optional запуск `cloudflared tunnel run --token <CF_TOKEN>`, если приложение стартуется напрямую:

```powershell
python main.py
```

Для production-процесса чаще удобнее управлять tunnel отдельно от backend-процесса.

---

## Дорожная карта

- [x] Обязательная регистрация без guest flow
- [x] Email verification через Resend
- [x] JWT access/refresh sessions
- [x] Friend rooms
- [x] WebSocket live game
- [x] Серверные часы и timeout
- [x] Agora RTC tokens
- [x] Telegram profile photo proxy
- [x] Public player profiles + username search
- [x] Stockfish game review
- [ ] Persisted game review cache
- [ ] Турниры
- [ ] Matchmaking queue
- [ ] Clubs/schools
- [ ] Admin moderation tools

---

## Лицензия

Лицензия в репозитории пока не задана. Если проект планируется публиковать, добавьте `LICENSE` и укажите выбранную лицензию в этом разделе.

---

<div align="center">

Сделано для **Chess Roulette**.

Backend должен оставаться единственным источником правды для партий, рейтинга и игровых результатов.

</div>
