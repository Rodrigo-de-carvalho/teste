import os
import pymysql
import pymysql.cursors
from contextlib import contextmanager
from dotenv import load_dotenv

load_dotenv()


def _get_config():
    return {
        "host": os.environ.get("MYSQL_HOST", "localhost"),
        "port": int(os.environ.get("MYSQL_PORT", 3306)),
        "user": os.environ.get("MYSQL_USER", "root"),
        "password": os.environ.get("MYSQL_PASSWORD", ""),
        "database": os.environ.get("MYSQL_DATABASE", "tasks_db"),
        "cursorclass": pymysql.cursors.DictCursor,
        "autocommit": False,
    }


@contextmanager
def get_connection():
    conn = pymysql.connect(**_get_config())
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS tasks (
                    id          INT AUTO_INCREMENT PRIMARY KEY,
                    title       VARCHAR(255) NOT NULL,
                    description TEXT         DEFAULT '',
                    status      VARCHAR(50)  NOT NULL DEFAULT 'pending',
                    created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP
                )
            """)
