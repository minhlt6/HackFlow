import pytest
import pytest_asyncio
import asyncio
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.database import Base, get_db
from app.core.security import create_access_token, get_password_hash
from app.models.user import User
from app.models.config import HackathonConfig
from main import app

TEST_DATABASE_URL = "sqlite+aiosqlite:///file:memdb1?mode=memory&cache=shared&uri=true"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    future=True,
)

TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest_asyncio.fixture(scope="function")
async def test_db() -> AsyncGenerator[AsyncSession, None]:
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestingSessionLocal() as session:
        # Create singleton HackathonConfig
        from datetime import datetime, timezone, timedelta

        now = datetime.now(timezone.utc)
        config = HackathonConfig(
            id=1,
            name="HackFlow Test Contest",
            registration_start=now - timedelta(days=1),
            registration_end=now + timedelta(days=7),
            contest_start=now + timedelta(days=8),
            contest_end=now + timedelta(days=15),
        )
        session.add(config)
        await session.commit()
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def client(test_db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        async with TestingSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def admin_user(test_db: AsyncSession) -> User:
    user = User(
        email="admin@example.com",
        password_hash=get_password_hash("Admin@123"),
        full_name="Admin User",
        role="admin",
        profile_completed=True,
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user


@pytest_asyncio.fixture
def admin_token(admin_user: User) -> str:
    return create_access_token(
        {
            "sub": admin_user.id,
            "email": admin_user.email,
            "role": admin_user.role,
            "name": admin_user.full_name,
        }
    )


@pytest_asyncio.fixture
async def participant_user(test_db: AsyncSession) -> User:
    user = User(
        email="participant@example.com",
        password_hash=get_password_hash("User@123"),
        full_name="Test Participant",
        role="participant",
        profile_completed=True,
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user


@pytest_asyncio.fixture
def participant_token(participant_user: User) -> str:
    return create_access_token(
        {
            "sub": participant_user.id,
            "email": participant_user.email,
            "role": participant_user.role,
            "name": participant_user.full_name,
        }
    )
