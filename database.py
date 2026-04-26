import os
import urllib.parse
import pymysql
import pymysql.cursors
from contextlib import contextmanager
from dotenv import load_dotenv

load_dotenv()


def _get_config():
    url = os.environ.get("DATABASE_URL") or os.environ.get("MYSQL_URL")
    if url:
        # Railway provides mysql://user:pass@host:port/db
        parsed = urllib.parse.urlparse(url)
        return {
            "host": parsed.hostname,
            "port": parsed.port or 3306,
            "user": parsed.username,
            "password": parsed.password,
            "database": parsed.path.lstrip("/"),
            "cursorclass": pymysql.cursors.DictCursor,
            "autocommit": False,
        }

    # Fallback: variáveis individuais (Railway sem underscore ou local com underscore)
    return {
        "host": os.environ.get("MYSQLHOST") or os.environ.get("MYSQL_HOST", "localhost"),
        "port": int(os.environ.get("MYSQLPORT") or os.environ.get("MYSQL_PORT", 3306)),
        "user": os.environ.get("MYSQLUSER") or os.environ.get("MYSQL_USER", "root"),
        "password": os.environ.get("MYSQLPASSWORD") or os.environ.get("MYSQL_PASSWORD", ""),
        "database": os.environ.get("MYSQLDATABASE") or os.environ.get("MYSQL_DATABASE", "tasks_db"),
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
                CREATE TABLE IF NOT EXISTS users (
                    id         INT AUTO_INCREMENT PRIMARY KEY,
                    username   VARCHAR(80)  NOT NULL UNIQUE,
                    password   VARCHAR(255) NOT NULL,
                    created_at DATETIME     DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS categories (
                    id      INT AUTO_INCREMENT PRIMARY KEY,
                    name    VARCHAR(80) NOT NULL,
                    color   VARCHAR(7)  NOT NULL DEFAULT '#6366f1',
                    user_id INT         NOT NULL,
                    CONSTRAINT fk_cat_user FOREIGN KEY (user_id)
                        REFERENCES users(id) ON DELETE CASCADE
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS tasks (
                    id             INT AUTO_INCREMENT PRIMARY KEY,
                    title          VARCHAR(255) NOT NULL,
                    description    TEXT,
                    status         VARCHAR(50)  NOT NULL DEFAULT 'pending',
                    priority       VARCHAR(20)  NOT NULL DEFAULT 'medium',
                    deadline       DATE,
                    estimated_time INT,
                    category_id    INT,
                    user_id        INT          NOT NULL,
                    created_at     DATETIME     DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT fk_task_cat  FOREIGN KEY (category_id)
                        REFERENCES categories(id) ON DELETE SET NULL,
                    CONSTRAINT fk_task_user FOREIGN KEY (user_id)
                        REFERENCES users(id) ON DELETE CASCADE
                )
            """)
