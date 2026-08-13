import os
from datetime import datetime, timedelta

import pytest

import database
from database import init_db
from tasks import (count_by_status, create_task, delete_task, get_reminders,
                   get_task, list_tasks, toggle_task, update_task)


@pytest.fixture(autouse=True)
def fresh_db(tmp_path, monkeypatch):
    test_db = str(tmp_path / "test.db")
    monkeypatch.setattr(database, "DB_PATH", test_db)
    init_db()
    yield
    if os.path.exists(test_db):
        os.remove(test_db)


# ---------- CRUD básico ----------

def test_create_and_get():
    task = create_task("Minha tarefa", "Descrição aqui")
    assert task["title"] == "Minha tarefa"
    assert task["status"] == "pending"
    assert task["priority"] == "medium"
    assert get_task(task["id"])["description"] == "Descrição aqui"


def test_create_strips_whitespace():
    task = create_task("  Tarefa  ", "  desc  ")
    assert task["title"] == "Tarefa"
    assert task["description"] == "desc"


def test_create_empty_title_rejected():
    with pytest.raises(ValueError):
        create_task("   ")


def test_create_title_too_long_rejected():
    with pytest.raises(ValueError):
        create_task("x" * 201)


def test_create_invalid_priority_rejected():
    with pytest.raises(ValueError):
        create_task("Tarefa", priority="urgente")


def test_create_invalid_due_date_rejected():
    with pytest.raises(ValueError):
        create_task("Tarefa", due_date="amanhã")


def test_create_with_due_date_and_priority():
    task = create_task("Com prazo", priority="high", due_date="2030-01-15T10:30")
    assert task["priority"] == "high"
    assert task["due_date"] == "2030-01-15T10:30"
    assert task["due_display"] == "15/01/2030 10:30"


def test_list_tasks():
    create_task("A")
    create_task("B")
    assert len(list_tasks()) == 2


def test_list_tasks_by_status():
    t = create_task("Fazer algo")
    update_task(t["id"], status="done")
    create_task("Outro")
    assert len(list_tasks(status="done")) == 1
    assert len(list_tasks(status="pending")) == 1


def test_list_tasks_search():
    create_task("Comprar leite", "no mercado")
    create_task("Estudar Python")
    assert len(list_tasks(search="leite")) == 1
    assert len(list_tasks(search="mercado")) == 1
    assert len(list_tasks(search="xyz")) == 0


def test_list_orders_done_last():
    a = create_task("Aberta")
    b = create_task("Feita")
    update_task(b["id"], status="done")
    tasks = list_tasks()
    assert tasks[0]["id"] == a["id"]
    assert tasks[-1]["id"] == b["id"]


def test_update_task():
    t = create_task("Original")
    updated = update_task(t["id"], title="Alterado", status="in_progress")
    assert updated["title"] == "Alterado"
    assert updated["status"] == "in_progress"
    assert updated["updated_at"] is not None


def test_update_invalid_status():
    t = create_task("X")
    with pytest.raises(ValueError):
        update_task(t["id"], status="invalido")


def test_update_missing_task_returns_none():
    assert update_task(9999, title="Nada") is None


def test_update_can_clear_due_date():
    t = create_task("Com prazo", due_date="2030-01-01")
    updated = update_task(t["id"], due_date=None)
    assert updated["due_date"] is None


def test_update_keeps_due_date_when_not_passed():
    t = create_task("Com prazo", due_date="2030-01-01")
    updated = update_task(t["id"], title="Novo título")
    assert updated["due_date"] == "2030-01-01"


def test_toggle_task():
    t = create_task("Alternar")
    assert toggle_task(t["id"])["status"] == "done"
    assert toggle_task(t["id"])["status"] == "pending"
    assert toggle_task(9999) is None


def test_delete_task():
    t = create_task("Deletar")
    assert delete_task(t["id"]) is True
    assert get_task(t["id"]) is None
    assert delete_task(t["id"]) is False


# ---------- Contagens e lembretes ----------

def test_count_by_status():
    create_task("A")
    b = create_task("B")
    update_task(b["id"], status="done")
    counts = count_by_status()
    assert counts == {"pending": 1, "in_progress": 0, "done": 1, "all": 2}


def test_overdue_flag():
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M")
    t = create_task("Atrasada", due_date=yesterday)
    assert get_task(t["id"])["is_overdue"] is True


def test_done_task_never_overdue():
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M")
    t = create_task("Atrasada mas feita", due_date=yesterday)
    update_task(t["id"], status="done")
    assert get_task(t["id"])["is_overdue"] is False


def test_due_today_flag():
    end_of_day = datetime.now().strftime("%Y-%m-%d")
    t = create_task("Vence hoje", due_date=end_of_day)
    task = get_task(t["id"])
    assert task["is_due_today"] is True
    assert task["is_overdue"] is False


def test_get_reminders():
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M")
    create_task("Atrasada", due_date=yesterday)
    create_task("Vence hoje", due_date=datetime.now().strftime("%Y-%m-%d"))
    create_task("Sem prazo")
    reminders = get_reminders()
    assert len(reminders["overdue"]) == 1
    assert len(reminders["due_today"]) == 1


# ---------- Migração de banco antigo ----------

def test_init_db_migrates_old_schema(tmp_path, monkeypatch):
    old_db = str(tmp_path / "old.db")
    monkeypatch.setattr(database, "DB_PATH", old_db)
    import sqlite3
    conn = sqlite3.connect(old_db)
    conn.execute("""
        CREATE TABLE tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            status TEXT NOT NULL DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("INSERT INTO tasks (title) VALUES ('Antiga')")
    conn.commit()
    conn.close()

    init_db()  # deve adicionar as colunas novas sem perder dados
    task = list_tasks()[0]
    assert task["title"] == "Antiga"
    assert task["priority"] == "medium"
    assert task["due_date"] is None


# ---------- Rotas Flask ----------

@pytest.fixture()
def client():
    from app import app
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_index_route(client):
    create_task("Visível na página")
    resp = client.get("/")
    assert resp.status_code == 200
    assert "Visível na página".encode() in resp.data


def test_create_route(client):
    resp = client.post("/create", data={
        "title": "Via formulário",
        "description": "",
        "priority": "high",
        "due_date": "2030-05-01T09:00",
    }, follow_redirects=True)
    assert resp.status_code == 200
    tasks = list_tasks()
    assert tasks[0]["title"] == "Via formulário"
    assert tasks[0]["priority"] == "high"


def test_create_route_empty_title_shows_error(client):
    resp = client.post("/create", data={"title": "  "}, follow_redirects=True)
    assert resp.status_code == 200
    assert len(list_tasks()) == 0


def test_update_route_invalid_status_does_not_crash(client):
    t = create_task("X")
    resp = client.post(f"/update/{t['id']}", data={"status": "hackeado"},
                       follow_redirects=True)
    assert resp.status_code == 200  # antes retornava 500
    assert get_task(t["id"])["status"] == "pending"


def test_toggle_route(client):
    t = create_task("Alternar")
    client.post(f"/toggle/{t['id']}", follow_redirects=True)
    assert get_task(t["id"])["status"] == "done"


def test_edit_route(client):
    t = create_task("Antes")
    client.post(f"/edit/{t['id']}", data={
        "title": "Depois",
        "description": "editada",
        "priority": "low",
        "due_date": "",
    }, follow_redirects=True)
    task = get_task(t["id"])
    assert task["title"] == "Depois"
    assert task["priority"] == "low"


def test_delete_route(client):
    t = create_task("Remover")
    client.post(f"/delete/{t['id']}", follow_redirects=True)
    assert get_task(t["id"]) is None


def test_api_reminders(client):
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M")
    create_task("Atrasada", due_date=yesterday)
    resp = client.get("/api/reminders")
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data["overdue"]) == 1
    assert data["overdue"][0]["title"] == "Atrasada"
