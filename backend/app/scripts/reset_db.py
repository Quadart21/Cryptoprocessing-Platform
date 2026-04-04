from app.db.session import engine
from app.models import Base


def main() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("db-reset-complete")


if __name__ == "__main__":
    main()
