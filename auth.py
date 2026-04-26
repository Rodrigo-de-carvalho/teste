from werkzeug.security import generate_password_hash, check_password_hash
from database import get_connection


def create_user(username: str, password: str) -> dict | None:
    hashed = generate_password_hash(password)
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO users (username, password) VALUES (%s, %s)",
                    (username, hashed),
                )
                user_id = cur.lastrowid
        return get_user(user_id)
    except Exception:
        return None


def authenticate(username: str, password: str) -> dict | None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, username, password, created_at FROM users WHERE username = %s",
                (username,),
            )
            user = cur.fetchone()
    if user and check_password_hash(user["password"], password):
        return {"id": user["id"], "username": user["username"], "created_at": user["created_at"]}
    return None


def get_user(user_id: int) -> dict | None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, username, created_at FROM users WHERE id = %s",
                (user_id,),
            )
            return cur.fetchone()
