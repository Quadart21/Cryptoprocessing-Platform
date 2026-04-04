from app.db.bootstrap import ensure_database_ready
from app.db.session import SessionLocal
from app.services.user_service import UserService


def main() -> None:
    ensure_database_ready()
    db = SessionLocal()
    try:
        user = UserService(db).ensure_superadmin()
        print(f"superadmin-ready:{user.email}:{user.role}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
