import os
import sqlite3
from contextlib import contextmanager

# Caminho absoluto ao lado deste arquivo — antes o banco era criado no
# diretório de onde o app fosse executado, gerando "bancos fantasmas".
DB_PATH = os.environ.get(
    "TASKS_DB",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "tasks.db"),
)


@contextmanager
def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _existing_columns(conn) -> set[str]:
    rows = conn.execute("PRAGMA table_info(tasks)").fetchall()
    return {row["name"] for row in rows}


def init_db():
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                title       TEXT    NOT NULL,
                description TEXT    DEFAULT '',
                status      TEXT    NOT NULL DEFAULT 'pending',
                priority    TEXT    NOT NULL DEFAULT 'medium',
                due_date    TEXT,
                created_at  TEXT    DEFAULT (datetime('now', 'localtime')),
                updated_at  TEXT
            )
        """)

        # Migração para bancos criados na versão antiga (sem essas colunas).
        existing = _existing_columns(conn)
        migrations = {
            "priority": "ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium'",
            "due_date": "ALTER TABLE tasks ADD COLUMN due_date TEXT",
            "updated_at": "ALTER TABLE tasks ADD COLUMN updated_at TEXT",
        }
        for column, ddl in migrations.items():
            if column not in existing:
                conn.execute(ddl)

        conn.execute("CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date)")
