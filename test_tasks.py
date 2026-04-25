import os
import pytest
import database
from database import init_db
from tasks import create_task, get_task, list_tasks, update_task, delete_task


@pytest.fixture(autouse=True)
def fresh_db(tmp_path, monkeypatch):
    test_db = str(tmp_path / "test.db")
    monkeypatch.setattr(database, "DB_PATH", test_db)
    init_db()
    yield
    if os.path.exists(test_db):
        os.remove(test_db)


def test_create_and_get():
    task = create_task("Minha tarefa", "Descrição aqui")
    assert task["title"] == "Minha tarefa"
    assert task["status"] == "pending"
    assert get_task(task["id"])["description"] == "Descrição aqui"


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


def test_update_task():
    t = create_task("Original")
    updated = update_task(t["id"], title="Alterado", status="in_progress")
    assert updated["title"] == "Alterado"
    assert updated["status"] == "in_progress"


def test_update_invalid_status():
    t = create_task("X")
    with pytest.raises(ValueError):
        update_task(t["id"], status="invalido")


def test_delete_task():
    t = create_task("Deletar")
    assert delete_task(t["id"]) is True
    assert get_task(t["id"]) is None
    assert delete_task(t["id"]) is False
