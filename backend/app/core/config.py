"""app.core.config — environment + path constants.

Sprint 21 C1: вынос env/констант из server.py. Никакого изменения значений.
Модули читают эти константы вместо прямых os.environ.get вызовов.

load_dotenv() вызывается здесь, чтобы config можно было импортировать из любого
места без зависимости от порядка импорта в server.py.
"""
from __future__ import annotations
import os
from pathlib import Path
from dotenv import load_dotenv

# /app/backend/app/core/config.py -> parents[2] = /app/backend
BACKEND_ROOT: Path = Path(__file__).resolve().parents[2]
REPO_ROOT: Path = BACKEND_ROOT.parent  # /app

load_dotenv(BACKEND_ROOT / '.env')

# ── MongoDB
MONGO_URL: str = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME: str = os.environ.get('DB_NAME', 'test_database')

# ── NestJS subprocess (server.py spawn'ит его из startup_event)
NESTJS_URL: str = os.environ.get('NESTJS_URL', 'http://localhost:3001')

# ── Static dist-директории (сервируются через FastAPI под /api/admin-panel/ и /api/web-app/)
ADMIN_BUILD_DIR: Path = Path(os.environ.get('ADMIN_BUILD_DIR', str(REPO_ROOT / 'admin' / 'dist')))
WEBAPP_BUILD_DIR: Path = Path(os.environ.get('WEBAPP_BUILD_DIR', str(REPO_ROOT / 'web-app' / 'dist')))

# ── Auth
JWT_SECRET: str = os.environ.get('JWT_SECRET', 'auto_service_jwt_secret_key_2025_very_secure')
JWT_ALGO: str = 'HS256'

# ── Admin seed (используется в seed_data)
ADMIN_EMAIL: str = os.environ.get('ADMIN_EMAIL', 'admin@autoservice.com')
ADMIN_PASSWORD: str = os.environ.get('ADMIN_PASSWORD', 'Admin123!')
