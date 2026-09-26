from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.teams import router as teams_router
from app.api.v1.topics import router as topics_router
from app.api.v1.checkpoints import router as checkpoints_router
from app.api.v1.submissions import router as submissions_router
from app.api.v1.scoring import router as scoring_router
from app.api.v1.tickets import router as tickets_router
from app.api.v1.admin import router as admin_router
from app.api.v1.ws import router as ws_router
from app.api.v1.mentor import router as mentor_router

api_v1_router = APIRouter()

api_v1_router.include_router(auth_router)
api_v1_router.include_router(users_router)
api_v1_router.include_router(teams_router)
api_v1_router.include_router(topics_router)
api_v1_router.include_router(checkpoints_router)
api_v1_router.include_router(submissions_router)
api_v1_router.include_router(scoring_router)
api_v1_router.include_router(tickets_router)
api_v1_router.include_router(admin_router)
api_v1_router.include_router(ws_router)
api_v1_router.include_router(mentor_router)
