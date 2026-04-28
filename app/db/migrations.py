from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable

from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncConnection

from app.core.validation import EMAIL_MAX_LENGTH, USERNAME_MAX_LENGTH


logger = logging.getLogger(__name__)
SchemaStep = Callable[[AsyncConnection, str], Awaitable[None]]


RESET_TABLES = (
    "game_events",
    "game_action_offers",
    "room_participants",
    "rooms",
    "moves",
    "game_analyses",
    "auth_sessions",
    "games",
)

LEGACY_USER_PROFILE_COLUMNS = (
    "numeric_id",
    "guest_id",
    "is_registered",
    "country",
    "registered_ip_address",
    "auth_provider",
)


def _timestamp_sql(_: str) -> str:
    return "TIMESTAMP"


def _user_profile_column_sql(dialect: str) -> dict[str, str]:
    timestamp = _timestamp_sql(dialect)
    return {
        "email": f"VARCHAR({EMAIL_MAX_LENGTH})",
        "password_hash": "VARCHAR",
        "username": f"VARCHAR({USERNAME_MAX_LENGTH})",
        "photo_file_id": "VARCHAR",
        "country_code": "VARCHAR(2)",
        "location_resolved_at": timestamp,
        "registered_at": timestamp,
        "last_login_at": timestamp,
    }


def _auth_session_column_sql(dialect: str) -> dict[str, str]:
    return {
        "last_used_at": _timestamp_sql(dialect),
    }


def _room_column_sql(dialect: str) -> dict[str, str]:
    return {
        "invite_expires_at": _timestamp_sql(dialect),
        "updated_at": _timestamp_sql(dialect),
    }


def _game_column_sql(dialect: str) -> dict[str, str]:
    return {
        "time_control_initial_seconds": "INTEGER",
        "time_increment_seconds": "INTEGER DEFAULT 0",
        "white_time_ms": "INTEGER",
        "black_time_ms": "INTEGER",
        "turn_started_at": _timestamp_sql(dialect),
    }


async def _table_names(conn: AsyncConnection) -> set[str]:
    return await conn.run_sync(lambda sync_conn: set(inspect(sync_conn).get_table_names()))


async def _columns(conn: AsyncConnection, table_name: str) -> dict[str, object]:
    def _run(sync_conn):
        inspector = inspect(sync_conn)
        if table_name not in inspector.get_table_names():
            return {}
        return {column["name"]: column["type"] for column in inspector.get_columns(table_name)}

    return await conn.run_sync(_run)


async def _has_column(conn: AsyncConnection, table_name: str, column_name: str) -> bool:
    return column_name in await _columns(conn, table_name)


async def _missing_columns(conn: AsyncConnection, table_name: str, definitions: dict[str, str]) -> list[tuple[str, str, str]]:
    existing_columns = set((await _columns(conn, table_name)).keys())
    if not existing_columns:
        return []
    return [
        (table_name, col_name, definition)
        for col_name, definition in definitions.items()
        if col_name not in existing_columns
    ]


async def _add_missing_columns(conn: AsyncConnection, missing: list[tuple[str, str, str]]) -> None:
    for table_name, column_name, definition in missing:
        logger.warning("Adding missing backend column %s.%s", table_name, column_name)
        await conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}"))


def _id_column_is_legacy_string(column_type: object | None) -> bool:
    if column_type is None:
        return False
    type_name = str(column_type).upper()
    return "CHAR" in type_name or "TEXT" in type_name or "VARCHAR" in type_name


async def reset_legacy_schema(conn: AsyncConnection) -> None:
    """Drop old UUID-key gameplay tables before SQLAlchemy recreates them.

    The current model keeps UUID only for user_profiles.id. Gameplay, rooms,
    sessions, offers, and events use numeric autoincrement primary keys, so old
    UUID-key tables cannot be altered safely in-place.
    """

    table_names = await _table_names(conn)
    user_columns = await _columns(conn, "user_profiles") if "user_profiles" in table_names else {}
    has_legacy_user_columns = any(column in user_columns for column in LEGACY_USER_PROFILE_COLUMNS)

    has_legacy_id_tables = False
    for table_name in RESET_TABLES:
        columns = await _columns(conn, table_name)
        if _id_column_is_legacy_string(columns.get("id")):
            has_legacy_id_tables = True
            break

    if not has_legacy_user_columns and not has_legacy_id_tables:
        return

    for table_name in RESET_TABLES:
        try:
            await conn.execute(text(f"DROP TABLE IF EXISTS {table_name} CASCADE"))
        except Exception as exc:  # pragma: no cover - operational warning
            logger.warning("Could not drop legacy table %s: %s", table_name, exc)

    if "user_profiles" in table_names:
        try:
            if "is_registered" in user_columns:
                await conn.execute(
                    text(
                        "DELETE FROM user_profiles "
                        "WHERE is_registered IS NOT TRUE OR email IS NULL OR password_hash IS NULL"
                    )
                )
            else:
                await conn.execute(text("DELETE FROM user_profiles WHERE email IS NULL OR password_hash IS NULL"))
        except Exception as exc:  # pragma: no cover - operational warning
            logger.warning("Could not remove legacy guest profiles: %s", exc)

        for column_name in LEGACY_USER_PROFILE_COLUMNS:
            try:
                await conn.execute(text(f"ALTER TABLE user_profiles DROP COLUMN IF EXISTS {column_name} CASCADE"))
            except Exception as exc:  # pragma: no cover - operational warning
                logger.warning("Could not drop legacy user_profiles.%s: %s", column_name, exc)


async def _migration_001_current_schema(conn: AsyncConnection, dialect: str) -> None:
    missing: list[tuple[str, str, str]] = []
    missing.extend(await _missing_columns(conn, "user_profiles", _user_profile_column_sql(dialect)))
    missing.extend(await _missing_columns(conn, "games", _game_column_sql(dialect)))
    missing.extend(await _missing_columns(conn, "auth_sessions", _auth_session_column_sql(dialect)))
    missing.extend(await _missing_columns(conn, "rooms", _room_column_sql(dialect)))
    await _add_missing_columns(conn, missing)

    for sql in (
        "UPDATE auth_sessions SET last_used_at = created_at WHERE last_used_at IS NULL",
        "UPDATE rooms SET updated_at = created_at WHERE updated_at IS NULL",
        "DROP TABLE IF EXISTS schema_migrations",
    ):
        try:
            await conn.execute(text(sql))
        except Exception as exc:  # pragma: no cover - operational warning
            logger.warning("Could not run schema SQL %s: %s", sql, exc)

    if dialect == "postgresql" and await _has_column(conn, "user_profiles", "username"):
        for sql in (
            "ALTER TABLE user_profiles DROP COLUMN IF EXISTS city CASCADE",
            f"UPDATE user_profiles SET username = LEFT(COALESCE(NULLIF(BTRIM(username), ''), 'Player'), {USERNAME_MAX_LENGTH})",
            f"ALTER TABLE user_profiles ALTER COLUMN email TYPE VARCHAR({EMAIL_MAX_LENGTH})",
            f"ALTER TABLE user_profiles ALTER COLUMN username TYPE VARCHAR({USERNAME_MAX_LENGTH})",
            f"ALTER TABLE user_profiles ALTER COLUMN username SET NOT NULL",
        ):
            try:
                await conn.execute(text(sql))
            except Exception as exc:  # pragma: no cover - operational warning
                logger.warning("Could not enforce user profile text constraints with SQL %s: %s", sql, exc)

    indexes = (
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_user_profiles_email_not_null "
        "ON user_profiles (email) WHERE email IS NOT NULL",
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_user_profiles_username_lower "
        "ON user_profiles (LOWER(username))",
        "CREATE INDEX IF NOT EXISTS ix_user_profiles_country_code ON user_profiles (country_code)",
        "CREATE INDEX IF NOT EXISTS ix_auth_sessions_last_used_at ON auth_sessions (last_used_at)",
        "CREATE INDEX IF NOT EXISTS ix_rooms_invite_expires_at ON rooms (invite_expires_at)",
    )
    for index_sql in indexes:
        try:
            await conn.execute(text(index_sql))
        except Exception as exc:  # pragma: no cover - operational warning
            logger.warning("Could not create schema index: %s", exc)


SCHEMA_STEPS: tuple[SchemaStep, ...] = (
    _migration_001_current_schema,
)


async def run_schema_migrations(conn: AsyncConnection) -> None:
    """Run idempotent schema maintenance without a DB metadata table."""

    dialect = await conn.run_sync(lambda sync_conn: sync_conn.dialect.name)
    for step in SCHEMA_STEPS:
        await step(conn, dialect)


async def ensure_auth_schema(conn: AsyncConnection) -> None:
    """Compatibility wrapper for older imports."""

    await run_schema_migrations(conn)
