from app.db.bootstrap import ensure_database_ready


def main() -> None:
    ensure_database_ready()
    print("db-ready")


if __name__ == "__main__":
    main()
