import asyncio

from app.db.bootstrap import ensure_database_ready
from app.db.session import AsyncSessionLocal
from app.services.user_service import UserService


def main() -> None:
    ensure_database_ready()
    asyncio.run(_main())


async def _main() -> None:
    async with AsyncSessionLocal() as db:
        user = await UserService(db).ensure_superadmin()
        print(f"superadmin-ready:{user.email}:{user.role}")


if __name__ == "__main__":
    main()
