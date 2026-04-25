from database import get_connection


def create_task(title: str, description: str = "") -> dict:
    with get_connection() as conn:
        cur = conn.execute(
            "INSERT INTO tasks (title, description) VALUES (?, ?)",
            (title, description),
        )
        task_id = cur.lastrowid
    return get_task(task_id)


def get_task(task_id: int) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()
        return dict(row) if row else None


def list_tasks(status: str | None = None) -> list[dict]:
    with get_connection() as conn:
        if status:
            rows = conn.execute(
                "SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC",
                (status,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM tasks ORDER BY created_at DESC"
            ).fetchall()
        return [dict(r) for r in rows]


def update_task(task_id: int, title: str | None = None,
                description: str | None = None, status: str | None = None) -> dict | None:
    task = get_task(task_id)
    if task is None:
        return None

    new_title  = title       if title       is not None else task["title"]
    new_desc   = description if description is not None else task["description"]
    new_status = status      if status      is not None else task["status"]

    valid_statuses = {"pending", "in_progress", "done"}
    if new_status not in valid_statuses:
        raise ValueError(f"status deve ser um de {valid_statuses}")

    with get_connection() as conn:
        conn.execute(
            "UPDATE tasks SET title=?, description=?, status=? WHERE id=?",
            (new_title, new_desc, new_status, task_id),
        )
    return get_task(task_id)  # após commit


def delete_task(task_id: int) -> bool:
    with get_connection() as conn:
        cur = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        return cur.rowcount > 0
