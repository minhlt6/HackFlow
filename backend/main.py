from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from app.core.config import settings
from app.core.database import init_db, AsyncSessionLocal
from app.core.exceptions import (
    AppException,
    app_exception_handler,
    http_exception_handler,
    validation_exception_handler,
    generic_exception_handler,
)
from app.api.v1 import api_v1_router
from app.models.config import HackathonConfig
from sqlalchemy import select


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Khởi tạo CSDL nếu cần (dev / testing)
    await init_db()

    # SQLite column migration: thêm các column mới vào bảng đã tồn tại
    from app.core.database import engine
    import sqlalchemy as sa
    import uuid as _uuid

    async with engine.connect() as conn:
        # Kiểm tra và thêm invite_code vào teams nếu chưa có
        try:
            await conn.execute(sa.text("SELECT invite_code FROM teams LIMIT 1"))
        except Exception:
            await conn.execute(sa.text("ALTER TABLE teams ADD COLUMN invite_code VARCHAR(8)"))
            await conn.commit()
            # Generate codes cho existing teams
            teams = (await conn.execute(sa.text("SELECT id FROM teams WHERE invite_code IS NULL"))).fetchall()
            for (team_id,) in teams:
                code = _uuid.uuid4().hex[:8].upper()
                await conn.execute(
                    sa.text("UPDATE teams SET invite_code = :code WHERE id = :id"),
                    {"code": code, "id": team_id}
                )
            await conn.commit()

    # Đảm bảo record singleton HackathonConfig luôn tồn tại
    async with AsyncSessionLocal() as db:
        config = (await db.execute(select(HackathonConfig).where(HackathonConfig.id == 1))).scalar_one_or_none()
        if not config:
            db.add(HackathonConfig(id=1, name="HackFlow 2025"))
            await db.commit()

    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="Nền tảng quản lý Hackathon tập trung chuyên biệt cho môi trường học thuật",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception Handlers
app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# Include API v1 Router
app.include_router(api_v1_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "status": "online",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
