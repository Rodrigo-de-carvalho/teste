from datetime import datetime, date

from database import get_connection

VALID_STATUSES = {"pending", "in_progress", "done"}
VALID_PRIORITIES = {"low", "medium", "high"}
MAX_TITLE_LEN = 200
MAX_DESC_LEN = 2000

# Sentinela para diferenciar "não passei o campo" de "quero limpar o campo".
_UNSET = object()

_PRIORITY_ORDER = "CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END"


def _validate_title(title: str) -> str:
    title = (title or "").strip()
    if not title:
        raise ValueError("O título da tarefa não pode ficar vazio.")
    if len(title) > MAX_TITLE_LEN:
        raise ValueError(f"O título deve ter no máximo {MAX_TITLE_LEN} caracteres.")
    return title


def _validate_description(description: str) -> str:
    description = (description or "").strip()
    if len(description) > MAX_DESC_LEN:
        raise ValueError(f"A descrição deve ter no máximo {MAX_DESC_LEN} caracteres.")
    return description


def _validate_priority(priority: str) -> str:
    if priority not in VALID_PRIORITIES:
        raise ValueError("Prioridade deve ser: low, medium ou high.")
    return priority


def _validate_status(status: str) -> str:
    if status not in VALID_STATUSES:
        raise ValueError("Status deve ser: pending, in_progress ou done.")
    return status


def _validate_due_date(due_date: str | None) -> str | None:
    """Aceita '' / None (sem prazo), 'YYYY-MM-DD' ou 'YYYY-MM-DDTHH:MM'."""
    if not due_date:
        return None
    due_date = due_date.strip()
    for fmt in ("%Y-%m-%dT%H:%M", "%Y-%m-%d"):
        try:
            datetime.strptime(due_date, fmt)
            return due_date
        except ValueError:
            continue
    raise ValueError("Data de vencimento inválida.")


def parse_due_date(value: str | None) -> datetime | None:
    if not value:
        return None
    for fmt in ("%Y-%m-%dT%H:%M", "%Y-%m-%d"):
        try:
            parsed = datetime.strptime(value, fmt)
            if fmt == "%Y-%m-%d":
                # Sem hora definida, o prazo vale até o fim do dia.
                parsed = parsed.replace(hour=23, minute=59)
            return parsed
        except ValueError:
            continue
    return None


def _enrich(task: dict) -> dict:
    """Adiciona campos derivados usados pela interface e pelos lembretes."""
    due = parse_due_date(task.get("due_date"))
    now = datetime.now()
    is_open = task["status"] != "done"
    task["is_overdue"] = bool(due and is_open and due < now)
    task["is_due_today"] = bool(
        due and is_open and not task["is_overdue"] and due.date() == date.today()
    )
    task["due_display"] = due.strftime("%d/%m/%Y %H:%M") if due else None
    return task


def create_task(title: str, description: str = "", priority: str = "medium",
                due_date: str | None = None) -> dict:
    title = _validate_title(title)
    description = _validate_description(description)
    priority = _validate_priority(priority)
    due_date = _validate_due_date(due_date)

    with get_connection() as conn:
        cur = conn.execute(
            "INSERT INTO tasks (title, description, priority, due_date) "
            "VALUES (?, ?, ?, ?)",
            (title, description, priority, due_date),
        )
        task_id = cur.lastrowid
    return get_task(task_id)


def get_task(task_id: int) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()
        return _enrich(dict(row)) if row else None


def list_tasks(status: str | None = None, search: str | None = None) -> list[dict]:
    """Lista tarefas em ordem útil: abertas primeiro, depois por prazo e prioridade."""
    query = "SELECT * FROM tasks"
    conditions, params = [], []

    if status:
        conditions.append("status = ?")
        params.append(status)
    if search:
        conditions.append("(title LIKE ? OR description LIKE ?)")
        like = f"%{search}%"
        params.extend([like, like])
    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += f"""
        ORDER BY (status = 'done') ASC,
                 (due_date IS NULL) ASC,
                 due_date ASC,
                 {_PRIORITY_ORDER},
                 created_at DESC
    """
    with get_connection() as conn:
        rows = conn.execute(query, params).fetchall()
        return [_enrich(dict(r)) for r in rows]


def count_by_status() -> dict:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT status, COUNT(*) AS n FROM tasks GROUP BY status"
        ).fetchall()
    counts = {"pending": 0, "in_progress": 0, "done": 0}
    for row in rows:
        if row["status"] in counts:
            counts[row["status"]] = row["n"]
    counts["all"] = sum(counts.values())
    return counts


def update_task(task_id: int, title: str | None = None,
                description: str | None = None, status: str | None = None,
                priority: str | None = None, due_date=_UNSET) -> dict | None:
    task = get_task(task_id)
    if task is None:
        return None

    new_title = _validate_title(title) if title is not None else task["title"]
    new_desc = (_validate_description(description)
                if description is not None else task["description"])
    new_status = _validate_status(status) if status is not None else task["status"]
    new_priority = (_validate_priority(priority)
                    if priority is not None else task["priority"])
    new_due = (_validate_due_date(due_date)
               if due_date is not _UNSET else task["due_date"])

    with get_connection() as conn:
        conn.execute(
            "UPDATE tasks SET title=?, description=?, status=?, priority=?, "
            "due_date=?, updated_at=datetime('now', 'localtime') WHERE id=?",
            (new_title, new_desc, new_status, new_priority, new_due, task_id),
        )
    return get_task(task_id)


def toggle_task(task_id: int) -> dict | None:
    """Alterna entre concluída e pendente — atalho do checkbox da interface."""
    task = get_task(task_id)
    if task is None:
        return None
    new_status = "pending" if task["status"] == "done" else "done"
    return update_task(task_id, status=new_status)


def get_reminders() -> dict:
    """Tarefas vencidas e que vencem hoje, para as notificações do navegador."""
    overdue, due_today = [], []
    for task in list_tasks():
        if task["is_overdue"]:
            overdue.append(task)
        elif task["is_due_today"]:
            due_today.append(task)
    return {"overdue": overdue, "due_today": due_today}


def delete_task(task_id: int) -> bool:
    with get_connection() as conn:
        cur = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        return cur.rowcount > 0
