"""Ensure ORM tables and lightweight DDL patches are applied before app restart."""

from app.db.bootstrap import ensure_database_ready, sync_missing_tables


def main() -> None:
    created = sync_missing_tables()
    if created:
        print(f"Created tables: {', '.join(created)}")
    else:
        print("All ORM tables are present.")

    ensure_database_ready()
    print("DDL patches and database readiness checks applied.")


if __name__ == "__main__":
    main()
