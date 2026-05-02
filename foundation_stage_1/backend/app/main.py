"""FastAPI entry point. Wires routers, CORS, and the DB lifecycle.

Run locally:
    uvicorn app.main:app --reload --port 8000
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core import database
from app.routes import auth as auth_routes
from app.routes import users as user_routes


@asynccontextmanager
async def lifespan(_app: FastAPI):
    database.connect()
    # Indexes: enforce unique e-mail at the DB level.
    db = database.get_db()
    await db.users.create_index("email", unique=True)
    yield
    await database.close()


app = FastAPI(
    title="Foundation Stage 1 API",
    version="1.0.0",
    description="Auth + roles + users — foundational platform layer.",
    lifespan=lifespan,
)

_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()] or ["*"]
_allow_credentials = "*" not in _origins  # browsers reject "*" + credentials

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(user_routes.router)


@app.get("/api/health")
async def health() -> dict:
    """Liveness probe."""
    return {"status": "ok"}
