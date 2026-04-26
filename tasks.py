from database import get_connection

_ALLOWED_TASK_KEYS = {"title", "description", "status", "priority", "deadline", "start_time", "estimated_time", "category_id"}


def create_task(user_id: int, title: str, description=None, priority: str = "medium",
                deadline=None, start_time=None, estimated_time=None, category_id=None) -> dict:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO tasks
                   (user_id, title, description, priority, deadline, start_time, estimated_time, category_id)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                (user_id, title, description, priority, deadline, start_time, estimated_time, category_id),
            )
            task_id = cur.lastrowid
    return get_task(task_id, user_id)


def get_task(task_id: int, user_id: int) -> dict | None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT t.*, c.name AS category_name, c.color AS category_color
                   FROM tasks t
                   LEFT JOIN categories c ON c.id = t.category_id
                   WHERE t.id = %s AND t.user_id = %s""",
                (task_id, user_id),
            )
            return cur.fetchone()


def list_tasks(user_id: int, status=None, priority=None, category_id=None) -> list[dict]:
    conditions = ["t.user_id = %s"]
    params = [user_id]

    if status:
        conditions.append("t.status = %s")
        params.append(status)
    if priority:
        conditions.append("t.priority = %s")
        params.append(priority)
    if category_id:
        conditions.append("t.category_id = %s")
        params.append(category_id)

    where = " AND ".join(conditions)

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""SELECT t.*, c.name AS category_name, c.color AS category_color
                    FROM tasks t
                    LEFT JOIN categories c ON c.id = t.category_id
                    WHERE {where}
                    ORDER BY
                        FIELD(t.priority, 'high', 'medium', 'low'),
                        (t.deadline IS NULL) ASC,
                        t.deadline ASC,
                        t.created_at DESC""",
                params,
            )
            return cur.fetchall()


def update_task(task_id: int, user_id: int, **kwargs) -> dict | None:
    updates = {k: v for k, v in kwargs.items() if k in _ALLOWED_TASK_KEYS}
    if not updates:
        return get_task(task_id, user_id)

    set_clause = ", ".join(f"{k} = %s" for k in updates)
    values = list(updates.values()) + [task_id, user_id]

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE tasks SET {set_clause} WHERE id = %s AND user_id = %s",
                values,
            )
    return get_task(task_id, user_id)


def delete_task(task_id: int, user_id: int) -> bool:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM tasks WHERE id = %s AND user_id = %s",
                (task_id, user_id),
            )
            return cur.rowcount > 0


def get_stats(user_id: int) -> dict:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT
                       COUNT(*) AS total,
                       SUM(status = 'pending') AS pending,
                       SUM(status = 'in_progress') AS in_progress,
                       SUM(status = 'done') AS done,
                       SUM(deadline < CURDATE() AND status != 'done') AS overdue
                   FROM tasks
                   WHERE user_id = %s""",
                (user_id,),
            )
            row = cur.fetchone()
    return {
        "total": int(row["total"] or 0),
        "pending": int(row["pending"] or 0),
        "in_progress": int(row["in_progress"] or 0),
        "done": int(row["done"] or 0),
        "overdue": int(row["overdue"] or 0),
    }


def create_category(user_id: int, name: str, color: str = "#6366f1") -> dict:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO categories (user_id, name, color) VALUES (%s, %s, %s)",
                (user_id, name, color),
            )
            cat_id = cur.lastrowid
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM categories WHERE id = %s", (cat_id,))
            return cur.fetchone()


def list_categories(user_id: int) -> list[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM categories WHERE user_id = %s ORDER BY name ASC",
                (user_id,),
            )
            return cur.fetchall()


def delete_category(cat_id: int, user_id: int) -> bool:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM categories WHERE id = %s AND user_id = %s",
                (cat_id, user_id),
            )
            return cur.rowcount > 0
