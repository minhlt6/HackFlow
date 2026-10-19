import uvicorn
from app.core.config import settings
from app.main import app, create_app

__all__ = ["app", "create_app"]

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info" if not settings.DEBUG else "debug",
    )
