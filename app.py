from flask import Flask, render_template, request, redirect, url_for
from database import init_db
from tasks import create_task, list_tasks, update_task, delete_task

app = Flask(__name__)

init_db()


@app.route("/")
def index():
    status_filter = request.args.get("status")
    tasks = list_tasks(status=status_filter)
    return render_template("index.html", tasks=tasks, status_filter=status_filter)


@app.route("/create", methods=["POST"])
def create():
    title = request.form.get("title", "").strip()
    description = request.form.get("description", "").strip()
    if title:
        create_task(title, description)
    return redirect(url_for("index"))


@app.route("/update/<int:task_id>", methods=["POST"])
def update(task_id):
    new_status = request.form.get("status")
    if new_status:
        update_task(task_id, status=new_status)
    return redirect(url_for("index"))


@app.route("/delete/<int:task_id>", methods=["POST"])
def delete(task_id):
    delete_task(task_id)
    return redirect(url_for("index"))


if __name__ == "__main__":
    app.run(debug=True)
