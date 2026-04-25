from database import init_db
from tasks import create_task, list_tasks, update_task, delete_task


def main():
    init_db()
    print("=== Gerenciador de Tarefas (SQLite) ===\n")

    t1 = create_task("Estudar Python", "Revisar conceitos de OOP")
    t2 = create_task("Criar API REST", "Usar FastAPI com MySQL")
    t3 = create_task("Escrever testes", "Cobertura mínima de 80%")
    print("Tarefas criadas:")
    for t in [t1, t2, t3]:
        print(f"  [{t['id']}] {t['title']} — {t['status']}")

    print("\nAtualizando tarefa 1 para 'in_progress'...")
    update_task(t1["id"], status="in_progress")

    print("Marcando tarefa 2 como 'done'...")
    update_task(t2["id"], status="done")

    print("\nListando todas as tarefas:")
    for t in list_tasks():
        print(f"  [{t['id']}] {t['title']:30s} status={t['status']}")

    print("\nListando apenas tarefas pendentes:")
    for t in list_tasks(status="pending"):
        print(f"  [{t['id']}] {t['title']}")

    print(f"\nRemovendo tarefa {t3['id']}...")
    delete_task(t3["id"])

    print("\nEstado final:")
    for t in list_tasks():
        print(f"  [{t['id']}] {t['title']:30s} status={t['status']}")


if __name__ == "__main__":
    main()
