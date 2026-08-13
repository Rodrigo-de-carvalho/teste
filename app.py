import os

from flask import (Flask, flash, jsonify, redirect, render_template, request,
                   url_for)

from database import init_db
from tasks import (VALID_PRIORITIES, VALID_STATUSES, count_by_status,
                   create_task, delete_task, get_reminders, list_tasks,
                   toggle_task, update_task)

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", os.urandom(24).hex())

# Antes o init_db() só rodava com "python app.py" — com "flask run" ou
# gunicorn o banco nunca era criado e o app quebrava na primeira consulta.
init_db()


@app.route("/")
def index():
    status_filter = request.args.get("status")
    if status_filter not in VALID_STATUSES:
        status_filter = None
    search = request.args.get("q", "").strip()

    tasks = list_tasks(status=status_filter, search=search or None)
    counts = count_by_status()
    return render_template(
        "index.html",
        tasks=tasks,
        status_filter=status_filter,
        search=search,
        counts=counts,
    )


@app.route("/create", methods=["POST"])
def create():
    try:
        create_task(
            title=request.form.get("title", ""),
            description=request.form.get("description", ""),
            priority=request.form.get("priority", "medium"),
            due_date=request.form.get("due_date") or None,
        )
        flash("Tarefa criada!", "success")
    except ValueError as exc:
        flash(str(exc), "error")
    return redirect(url_for("index"))


@app.route("/update/<int:task_id>", methods=["POST"])
def update(task_id):
    new_status = request.form.get("status")
    try:
        # Um status inválido derrubava a página com erro 500;
        # agora vira uma mensagem amigável.
        if new_status and update_task(task_id, status=new_status) is None:
            flash("Tarefa não encontrada.", "error")
    except ValueError as exc:
        flash(str(exc), "error")
    return redirect(url_for("index"))


@app.route("/edit/<int:task_id>", methods=["POST"])
def edit(task_id):
    priority = request.form.get("priority", "medium")
    if priority not in VALID_PRIORITIES:
        priority = "medium"
    try:
        updated = update_task(
            task_id,
            title=request.form.get("title", ""),
            description=request.form.get("description", ""),
            priority=priority,
            due_date=request.form.get("due_date") or None,
        )
        if updated is None:
            flash("Tarefa não encontrada.", "error")
        else:
            flash("Tarefa atualizada!", "success")
    except ValueError as exc:
        flash(str(exc), "error")
    return redirect(url_for("index"))


@app.route("/toggle/<int:task_id>", methods=["POST"])
def toggle(task_id):
    if toggle_task(task_id) is None:
        flash("Tarefa não encontrada.", "error")
    return redirect(url_for("index"))


@app.route("/delete/<int:task_id>", methods=["POST"])
def delete(task_id):
    if delete_task(task_id):
        flash("Tarefa removida.", "success")
    else:
        flash("Tarefa não encontrada.", "error")
    return redirect(url_for("index"))


@app.route("/api/reminders")
def api_reminders():
    """Alimenta as notificações do navegador (tarefas vencidas / vencendo hoje)."""
    reminders = get_reminders()
    serialize = lambda t: {
        "id": t["id"],
        "title": t["title"],
        "due_date": t["due_date"],
        "due_display": t["due_display"],
    }
    return jsonify({
        "overdue": [serialize(t) for t in reminders["overdue"]],
        "due_today": [serialize(t) for t in reminders["due_today"]],
    })


if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "").lower() in {"1", "true"}
    app.run(debug=debug)
