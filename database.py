import os
import pymysql
import pymysql.cursors
from contextlib import contextmanager


def _connect():
    return pymysql.connect(
        host=os.environ.get('MYSQLHOST', 'localhost'),
        port=int(os.environ.get('MYSQLPORT', 3306)),
        user=os.environ.get('MYSQLUSER', 'root'),
        password=os.environ.get('MYSQL_PASSWORD', ''),
        database=os.environ.get('MYSQL_DATABASE', 'tasks'),
        cursorclass=pymysql.cursors.DictCursor,
    )


@contextmanager
def get_connection():
    conn = _connect()
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
                    id          INT PRIMARY KEY AUTO_INCREMENT,
                    title       VARCHAR(255) NOT NULL,
                    description TEXT DEFAULT '',
                    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
                    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
