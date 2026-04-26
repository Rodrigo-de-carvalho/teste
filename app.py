import os
import functools
from datetime import date, timedelta
from flask import Flask, render_template, request, redirect, url_for, session
from database import init_db, get_or_create_secret_key
from auth import create_user, authenticate, get_user
from tasks import (
    create_task, get_task, list_tasks, update_task, delete_task,
    get_stats, create_category, list_categories, delete_category,
)

app = Flask(__name__)
init_db()
app.secret_key = os.environ.get("SECRET_KEY") or get_or_create_secret_key()
app.permanent_session_lifetime = timedelta(days=30)


def format_time(minutes):
    if not minutes:
        return ""
    minutes = int(minutes)
    if minutes < 60:
        return f"{minutes}min"
    h, m = divmod(minutes, 60)
    if m == 0:
        return f"{h}h"
    return f"{h}h {m}min"


app.jinja_env.filters["format_time"] = format_time


def login_required(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated


def _process_task(task, today):
    # Deadline badge
    dl = task.get("deadline")
    if dl:
        if isinstance(dl, str):
            from datetime import datetime
            dl = datetime.strptime(dl, "%Y-%m-%d").date()
        delta = (dl - today).days
        if task.get("status") == "done":
            task["dl_class"] = "ok"
            task["dl_label"] = dl.strftime("%d/%m/%Y")
        elif delta < 0:
            task["dl_class"] = "overdue"
            task["dl_label"] = f"Atrasado {abs(delta)}d"
        elif delta == 0:
            task["dl_class"] = "today"
            task["dl_label"] = "Hoje!"
        elif delta <= 3:
            task["dl_class"] = "soon"
            task["dl_label"] = f"{delta}d"
        else:
            task["dl_class"] = "ok"
            task["dl_label"] = f"{delta}d"

    # start_time: PyMySQL retorna TIME como timedelta, converte para "HH:MM"
    st = task.get("start_time")
    if st is not None:
        import datetime as dt
        if isinstance(st, dt.timedelta):
            total = int(st.total_seconds())
            task["start_time_str"] = f"{total // 3600:02d}:{(total % 3600) // 60:02d}"
        else:
            task["start_time_str"] = st.strftime("%H:%M")
    else:
        task["start_time_str"] = None

    return task


@app.route("/login", methods=["GET", "POST"])
def login():
    if "user_id" in session:
        return redirect(url_for("index"))
    error = None
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        user = authenticate(username, password)
        if user:
            session.permanent = True
            session["user_id"] = user["id"]
            session["username"] = user["username"]
            return redirect(url_for("index"))
        error = "Usuário ou senha inválidos."
    return render_template("login.html", error=error)


@app.route("/register", methods=["GET", "POST"])
def register():
    if "user_id" in session:
        return redirect(url_for("index"))
    error = None
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        confirm = request.form.get("confirm", "")
        if not username or not password:
            error = "Preencha todos os campos."
        elif password != confirm:
            error = "As senhas não coincidem."
        elif len(password) < 6:
            error = "A senha deve ter pelo menos 6 caracteres."
        else:
            user = create_user(username, password)
            if user:
                session.permanent = True
                session["user_id"] = user["id"]
                session["username"] = user["username"]
                return redirect(url_for("index"))
            error = "Esse nome de usuário já está em uso."
    return render_template("register.html", error=error)


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/")
@login_required
def index():
    user_id = session["user_id"]
    status_filter = request.args.get("status") or None
    priority_filter = request.args.get("priority") or None
    category_filter = request.args.get("category_id")
    category_filter_int = int(category_filter) if category_filter else None

    today = date.today()
    tasks = list_tasks(user_id, status=status_filter, priority=priority_filter, category_id=category_filter_int)
    tasks = [_process_task(t, today) for t in tasks]

    categories = list_categories(user_id)
    stats = get_stats(user_id)

    return render_template(
        "index.html",
        tasks=tasks,
        categories=categories,
        stats=stats,
        status_filter=status_filter,
        priority_filter=priority_filter,
        category_filter=category_filter_int,
        username=session["username"],
        today=today,
    )


@app.route("/create", methods=["POST"])
@login_required
def create():
    user_id = session["user_id"]
    title = request.form.get("title", "").strip()
    description = request.form.get("description", "").strip() or None
    priority = request.form.get("priority", "medium")
    deadline = request.form.get("deadline") or None
    start_time = request.form.get("start_time") or None
    estimated_time = request.form.get("estimated_time") or None
    if estimated_time is not None:
        try:
            estimated_time = int(estimated_time)
        except ValueError:
            estimated_time = None
    category_id = request.form.get("category_id") or None
    if category_id is not None:
        try:
            category_id = int(category_id)
        except ValueError:
            category_id = None
    if title:
        create_task(user_id, title, description=description, priority=priority,
                    deadline=deadline, start_time=start_time,
                    estimated_time=estimated_time, category_id=category_id)
    return redirect(url_for("index"))


@app.route("/update/<int:task_id>", methods=["POST"])
@login_required
def update(task_id):
    user_id = session["user_id"]
    fields = {}
    for key in ("title", "description", "status", "priority", "deadline", "start_time"):
        val = request.form.get(key)
        if val is not None:
            fields[key] = val if val != "" else None
    raw_et = request.form.get("estimated_time")
    if raw_et is not None:
        try:
            fields["estimated_time"] = int(raw_et) if raw_et else None
        except ValueError:
            fields["estimated_time"] = None
    raw_cat = request.form.get("category_id")
    if raw_cat is not None:
        try:
            fields["category_id"] = int(raw_cat) if raw_cat else None
        except ValueError:
            fields["category_id"] = None
    if fields:
        update_task(task_id, user_id, **fields)
    return redirect(url_for("index"))


@app.route("/delete/<int:task_id>", methods=["POST"])
@login_required
def delete(task_id):
    delete_task(task_id, session["user_id"])
    return redirect(url_for("index"))


@app.route("/categories/create", methods=["POST"])
@login_required
def category_create():
    user_id = session["user_id"]
    name = request.form.get("name", "").strip()
    color = request.form.get("color", "#6366f1")
    if name:
        create_category(user_id, name, color)
    return redirect(url_for("index") + "#categories")


@app.route("/categories/delete/<int:cat_id>", methods=["POST"])
@login_required
def category_delete(cat_id):
    delete_category(cat_id, session["user_id"])
    return redirect(url_for("index") + "#categories")


if __name__ == "__main__":
    app.run(debug=True)
