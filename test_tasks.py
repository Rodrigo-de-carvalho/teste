from unittest.mock import MagicMock, patch, call
import pytest
from tasks import create_task, get_task, list_tasks, update_task, delete_task


def make_task(id=1, title="Tarefa", description="Desc", status="pending"):
    return {"id": id, "title": title, "description": description,
            "status": status, "created_at": "2026-01-01 00:00:00"}


@pytest.fixture()
def mock_conn(monkeypatch):
    """Substitui get_connection por um context manager com cursor mockado."""
    conn = MagicMock()
    cur = MagicMock()
    conn.cursor.return_value.__enter__ = MagicMock(return_value=cur)
    conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

    from contextlib import contextmanager

    @contextmanager
    def fake_conn():
        yield conn

    monkeypatch.setattr("tasks.get_connection", fake_conn)
    monkeypatch.setattr("database.get_connection", fake_conn)
    return conn, cur


# --- create_task ---

def test_create_task(mock_conn):
    conn, cur = mock_conn
    cur.lastrowid = 1
    task_row = make_task(id=1, title="Nova tarefa")
    cur.fetchone.return_value = task_row

    result = create_task("Nova tarefa", "Descrição")

    assert result["title"] == "Nova tarefa"
    assert result["status"] == "pending"
    insert_call = cur.execute.call_args_list[0]
    assert "INSERT INTO tasks" in insert_call.args[0]


# --- get_task ---

def test_get_task_found(mock_conn):
    conn, cur = mock_conn
    cur.fetchone.return_value = make_task(id=5, title="Existente")

    result = get_task(5)

    assert result["id"] == 5
    cur.execute.assert_called_once()


def test_get_task_not_found(mock_conn):
    conn, cur = mock_conn
    cur.fetchone.return_value = None

    assert get_task(999) is None


# --- list_tasks ---

def test_list_tasks_all(mock_conn):
    conn, cur = mock_conn
    cur.fetchall.return_value = [make_task(id=1), make_task(id=2)]

    result = list_tasks()

    assert len(result) == 2
    sql = cur.execute.call_args.args[0]
    assert "WHERE" not in sql


def test_list_tasks_filtered_by_status(mock_conn):
    conn, cur = mock_conn
    cur.fetchall.return_value = [make_task(status="done")]

    result = list_tasks(status="done")

    assert result[0]["status"] == "done"
    sql = cur.execute.call_args.args[0]
    assert "WHERE" in sql


# --- update_task ---

def test_update_task(mock_conn):
    conn, cur = mock_conn
    original = make_task(id=1, title="Antes", status="pending")
    updated = make_task(id=1, title="Depois", status="in_progress")
    cur.fetchone.side_effect = [original, updated]

    result = update_task(1, title="Depois", status="in_progress")

    assert result["title"] == "Depois"
    assert result["status"] == "in_progress"


def test_update_task_not_found(mock_conn):
    conn, cur = mock_conn
    cur.fetchone.return_value = None

    assert update_task(999, title="X") is None


def test_update_task_invalid_status(mock_conn):
    conn, cur = mock_conn
    cur.fetchone.return_value = make_task(id=1)

    with pytest.raises(ValueError, match="status deve ser um de"):
        update_task(1, status="invalido")


# --- delete_task ---

def test_delete_task_success(mock_conn):
    conn, cur = mock_conn
    cur.rowcount = 1

    assert delete_task(1) is True


def test_delete_task_not_found(mock_conn):
    conn, cur = mock_conn
    cur.rowcount = 0

    assert delete_task(999) is False
