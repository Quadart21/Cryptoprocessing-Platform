"""Ensure all SQLAlchemy ORM tables exist (creates only missing tables)."""

from app.db.bootstrap import sync_missing_tables


def main() -> None:
    created = sync_missing_tables()
    if created:
        print(f"Created tables: {', '.join(created)}")
    else:
        print("All ORM tables are present.")


if __name__ == "__main__":
    main()
