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


def _col_exists(cur, table, column):
    cur.execute("SHOW COLUMNS FROM `%s` LIKE %%s" % table, (column,))
    return cur.fetchone() is not None


def _table_exists(cur, table):
    cur.execute("SHOW TABLES LIKE %s", (table,))
    return cur.fetchone() is not None


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
                CREATE TABLE IF NOT EXISTS app_config (
                    key_name VARCHAR(80)  PRIMARY KEY,
                    value    VARCHAR(255) NOT NULL
                )
            """)

            # Se tasks existe sem user_id (schema antigo), dropa e recria.
            if _table_exists(cur, "tasks") and not _col_exists(cur, "tasks", "user_id"):
                cur.execute("SET FOREIGN_KEY_CHECKS = 0")
                cur.execute("DROP TABLE tasks")
                cur.execute("SET FOREIGN_KEY_CHECKS = 1")

            cur.execute("""
                CREATE TABLE IF NOT EXISTS tasks (
                    id             INT AUTO_INCREMENT PRIMARY KEY,
                    title          VARCHAR(255) NOT NULL,
                    description    TEXT,
                    status         VARCHAR(50)  NOT NULL DEFAULT 'pending',
                    priority       VARCHAR(20)  NOT NULL DEFAULT 'medium',
                    deadline       DATE,
                    start_time     TIME,
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

            # Adiciona start_time se a coluna não existir ainda.
            if not _col_exists(cur, "tasks", "start_time"):
                cur.execute(
                    "ALTER TABLE tasks ADD COLUMN start_time TIME AFTER deadline"
                )


def get_or_create_secret_key() -> str:
    import secrets
    key = None
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT value FROM app_config WHERE key_name = 'secret_key'"
            )
            row = cur.fetchone()
            if row:
                key = row["value"]
            else:
                key = secrets.token_hex(32)
                cur.execute(
                    "INSERT INTO app_config (key_name, value) VALUES ('secret_key', %s)",
                    (key,),
                )
    return key
