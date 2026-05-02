# Auto Search Platform — Bootstrap & Sprint 21 C7 Checkpoint

## Scope of this doc
Документирует только состояние репо после bootstrap'а текущего пода + финальный
саммари рефакторинга **Sprint 21 C7** (последний выполненный в репо шаг).

Ничего про технический анализ / трейдинг / TA-engines / market prediction в
проекте нет и не будет — это не наша область. Слова «prediction / ML» ниже
относятся ИСКЛЮЧИТЕЛЬНО к бизнес-DemandPredictor (прогноз спроса на автосервис
по зонам Киева, Sprint 19/20) — часть существующей кодовой базы.

## Repo
- Source: `aliyalens1-stack/67676uyuyu`
- Last commit on `main`: `231e6de Auto-generated changes`
- Последний **явный refactor-commit**: `e232276 refactor(system): split /api/health + /api/system/* into health.py & system.py (Sprint 21 C6)`
- **Sprint 21 C7** (SPA static split) уже в коде — виден по комментариям в `server.py` и по `app/static/router.py`, но отдельного commit-месседжа для него не было (попал в `231e6de Auto-generated changes`).

## What was changed during bootstrap (ровно 4 пункта, ничего лишнего)
1. `/app/plan.md` — этот файл (только документация).
2. `/app/backend/.env` — добавлено `DB_NAME=auto_platform`, `NESTJS_PORT=3001`, `NESTJS_URL=http://localhost:3001`. `MONGO_URL` / `CORS_ORIGINS` не трогал.
3. `/app/frontend/.env` — добавлено `EXPO_PUBLIC_BACKEND_URL` (равен `REACT_APP_BACKEND_URL`).
4. `/app/frontend/package.json` → `"start": "expo start --web --port 3000"` (было `expo start`) — чтобы supervisor-поднимал Expo web на нужном порту.

Никакой новый python/js-код не писал. Никаких TA/trading/ML/prediction-модулей
не создавал. Весь код в `/app` — это 1-в-1 содержимое склонированного репо.

## Services (live)
| Service  | Status   | Notes |
|----------|----------|-------|
| backend  | RUNNING  | uvicorn 8001 → спавнит NestJS 3001 subprocess'ом |
| frontend | RUNNING  | Expo web на 3000 |
| mongodb  | RUNNING  | БД `auto_platform` |

Verified endpoints (через preview URL):
- `/` (Expo) → 200
- `/api/admin-panel/` → 200
- `/api/web-app/` → 200
- `/api/health` → `{status:ok, db:connected, nestjs:healthy}`
- Login 200 для admin / customer / provider.

---

## Sprint 21 — Split `server.py` (monolith → modules)

**Идея**: `server.py` раздулся до ~8150 строк. Sprint 21 режет его на `app/`
пакет поэтапно (C0 → C7), сохраняя `server.py` как точку регистрации, пока не
переедет всё.

### Progress map

| Step | Что вынесено | Файлы | Статус |
|------|-------------|-------|--------|
| **PRE-COMMIT 0** | Shared `AppContext` (DI-контейнер для db / logger / emit / http_client) | `app/core/context.py` | ✅ |
| **C1** | env/path константы, JWT/bcrypt helpers, generic utils | `app/core/config.py`, `app/core/security.py`, `app/core/utils.py` | ✅ |
| **C2** | Lazy `get_db()` аксессор + миграция `/api/health` на него | `app/core/db.py` | ✅ |
| **C3** | Shell-функции realtime эмиттят через `ctx.emit.event` вместо глобальной функции | `server.py` (шаг подготовки) | ✅ |
| **C4** | `emit_realtime_event` вынесен из `server.py` в отдельный модуль | `app/core/realtime.py` | ✅ |
| **C5** | Первый настоящий разрез endpoints: `/api/auth/*` (login / register / me / forgot-password / reset-password) | `app/system/auth.py` | ✅ |
| **C6** | `/api/health` + `/api/system/*` (7 endpoints, все под admin-auth: errors, errors/stats, breaker, alert-dispatches, test-alert, logs, metrics); module-level counters → `app/core/metrics.py` singleton | `app/system/health.py`, `app/system/system.py`, `app/core/metrics.py` | ✅ |
| **C7** | SPA static hosting вынесен: 8 endpoints для `/api/admin-panel/*` и `/api/web-app/*` (redirect → index.html → /assets/* → catch-all SPA fallback) | `app/static/router.py` | ✅ |
| **C8** | Simple-proxy compat layer: 6 endpoints (`/api/disputes`, `/notifications/my`, `/favorites/my`, `/organizations/search` с q→search rewrite, `/garage/{id}`, `/payments/list`) + shared `proxy_to_nest` helper (используется и C8, и оставшимися admin-compat в server.py) | `app/system/compat.py`, `app/core/proxy.py` | ✅ |
| **C9** | Quick Request CORE (ядро продукта, Sprint 14.5–17): 8 endpoints (`/api/quick-request/resolve` / `{id}` / `{id}/accept` / `{id}/reject` / `inbox/{slug}` + `/api/admin/ranking/weights` GET all / GET by-zone / POST recalculate), auto-expire task, provider ranking optimizer loop (5min), problem taxonomy, surge formatter, ranking weights self-learning — всё 1-в-1 (~820 строк). Плюс вынос `haversine` и `resolve_zone` в `app/core/geo.py` как shared utils. | `app/marketplace/quick_request.py`, `app/core/geo.py`, `app/marketplace/__init__.py` | ✅ |
| **C10** ← last | Marketplace + Matching + Zones domain: **35 endpoints** разрезаны на 3 файла — `providers.py` (20: marketplace listing, bookings, provider inbox/current-job/stats, location simulation, legacy quick-request shim), `matching.py` (5: matching/advanced, nearby, zone-aware + distribution/zone-aware, distribution/history + `PROBLEM_SKILL_MAP`), `zones.py` (10: zones CRUD + analytics + recalculate + demand/event/events/heatmap). Агрегируются через `app/marketplace/router.py`. Плюс: shared `PRE_ENGAGEMENT_*` константы в `app/core/constants.py`, lazy-proxy `db` в `app/core/db.py` (class `_DBProxy` с forwarding `__getattr__` — работает изнутри модуля, в отличие от PEP 562 module-level `__getattr__`), shell-emitters (`emit_provider_new_request/location/booking_status`) мигрированы на `ctx.emit.*`. | `app/marketplace/{providers,matching,zones,router}.py`, `app/core/constants.py`, `app/core/db.py` (доп. `_DBProxy`) | ✅ |
| **C14** | **ML guard** в orchestrator (pre-production hardening, не рефактор): `is_valid_prediction(v)` helper в `app/ml/predictor.py` — валидация NaN/Inf/negative/>500. `predict_demand` → двухслойный fallback ML → EWMA → safe zero (никогда не None/NaN/raise). `predict_with_interval` — guard на yhat из model.predict. `trigger_pre_engagement` — entry-guard против pressure/predicted/supply=0 (тихий skip + warning). Обе версии orchestrator cycle — валидация predicted + supply>0 + `logger.warning` вместо `logger.error` в guard-путях. Inline-тест `tests/test_c14_ml_guard.py` (6/6 pass). Поведение happy-path не меняется. | `app/ml/predictor.py`, `app/orchestrator/pre_engagement.py`, `app/orchestrator/cycle.py`, `tests/test_c14_ml_guard.py` | ✅ |
| **C15** | **Lifespan (phase 1, ultra-safe)**. Новый `app/core/lifespan.py` с `@asynccontextmanager` подключён через `app.router.lifespan_context = _c15_lifespan`. В lifespan: `init_db()` (MongoDB ping) + `load_ml_models()` (DemandPredictor.load_persisted). Seed/indexes/NestJS subprocess/5 loops — ОСТАЮТСЯ в старом `startup_with_feedback` (ждут C15.1). FastAPI 0.93+ выполняет оба параллельно, операции idempotent (повторная hydration моделей безопасна). Логи на старте: `C15 lifespan: startup phase begin` → `MongoDB ping OK` → `DemandPredictor warm-hydrated N models` → `startup phase complete`. | `app/core/lifespan.py` (new), `server.py` (wiring) | ✅ |
| **C15.1** | **Loops → lifespan. `startup_event` удалён навсегда.** Новый `app/orchestrator/runner.py::start_all_loops()` — единая точка запуска всех 6 background loops (zone_state_engine + orchestrator_engine_loop_v2 + feedback_processor_loop + strategy_optimizer_loop + provider_ranking_optimizer_loop + _demand_prediction_loop). `lifespan.py`: полный cycle `init_db → load_ml_models → bootstrap_side_effects → start_all_loops → yield → shutdown_cleanup`. Из `server.py` УДАЛЕНЫ: `@app.on_event("startup")`, `@app.on_event("shutdown")`, `startup_with_feedback`, `original_startup`, `app.router.on_startup.clear`, warm-start дубль в `_demand_prediction_loop`. `startup` → `bootstrap_side_effects` (плоская функция). Логи: `C15.1 runner: 6 background loops launched`. | `app/orchestrator/runner.py` (new), `app/core/lifespan.py`, `server.py` | ✅ |
| **C16** | **Domain split: provider + customer + billing**. Автоматическая экстракция (скрипт `/tmp/c16_extract.py`) 40 endpoints из `server.py` в 3 новых router-модуля с 1-в-1 поведением:<br>• `app/provider/router.py` (23 endpoints, 873 lines): pressure-summary/earnings/pressure/tier/availability/skills/locations/pre-engagement/intelligence/behavior. Плюс `TIER_THRESHOLDS` константа.<br>• `app/customer/router.py` (10 endpoints, 565 lines): favorites/recommendations/intelligence.<br>• `app/billing/router.py` (7 endpoints, 180 lines): provider/billing/* + experiments/*. Плюс `BILLING_PRODUCTS` каталог.<br>Регистрируются через `include_router` ПЕРЕД NestJS catch-all. Все используют shared `_HttpClientProxy` shim (proxy к `ctx.http_client`). Результат: **`server.py` 3824 → 2422 строк** (-1402, -37%). | `app/provider/router.py`, `app/customer/router.py`, `app/billing/router.py`, `server.py` (wiring + extraction) | ✅ |

### Архитектурное свойство после C7

```
/app/backend/
  server.py                      # ~6265 строк — остаётся hub регистрации
  app/
    __init__.py
    core/
      __init__.py
      context.py                 # PRE-COMMIT 0: ctx (db/logger/http_client/emit)
      config.py                  # C1: MONGO_URL, DB_NAME, NESTJS_URL, JWT_*, paths
      security.py                # C1: bcrypt hash/verify, JWT sign/verify, admin-guard
      utils.py                   # C1: helpers (dates, sanitize, etc)
      db.py                      # C2: get_db() lazy accessor + C10: _DBProxy lazy `db`
      realtime.py                # C4: emit_realtime_event (uses ctx.http_client)
      metrics.py                 # C6: request/error counters singleton
      proxy.py                   # C8: proxy_to_nest shared helper (httpx → NestJS)
      geo.py                     # C9: haversine + resolve_zone (pure, no side-effects)
      constants.py               # C10: shared taxonomy/numeric (PRE_ENGAGEMENT_*)
    system/
      __init__.py
      auth.py                    # C5: /api/auth/* (5 endpoints)
      health.py                  # C6: /api/health
      system.py                  # C6: /api/system/* (7 admin endpoints)
      compat.py                  # C8: 6 simple-proxy compat endpoints
    static/
      __init__.py
      router.py                  # C7: /api/admin-panel/* + /api/web-app/* (8 endpoints)
    marketplace/
      __init__.py
      quick_request.py           # C9: QR CORE — 8 endpoints + optimizer loop + expire
      providers.py               # C10: 20 endpoints — listing/bookings/provider inbox/stats
      matching.py                # C10: 5 endpoints — matching/distribution + PROBLEM_SKILL_MAP
      zones.py                   # C10: 10 endpoints — zones CRUD + demand/heatmap
      router.py                  # C10: aggregate router (providers + matching + zones)
```

### Инварианты, которых держались все C-шаги

1. **Никаких изменений поведения** — всё вынесено 1-в-1. Любой фикс/улучшение
   — отдельный коммит, не смешивать с разрезанием.
2. **DI через `ctx`**, не через импорты — чтобы не было circular imports.
3. **Порядок регистрации routes в `server.py`**: specific → static → catch-all
   proxy к NestJS. `include_router(app.static.router)` стоит **до** global
   `proxy_to_nestjs("/api/{path:path}")`, иначе FastAPI first-match съест статику.
4. Counters / globals уезжают в singletons (`metrics`), чтобы модуль можно было
   импортнуть изолированно без side-effects.

---

## Что осталось в `server.py` (~8150 строк)

Крупные не-вынесенные блоки — кандидаты на следующие шаги Sprint 21 (C8+):

- Compat-endpoints и mapping к NestJS (`/api/notifications/my`, `/api/favorites/my`, `/api/garage/:id` и т.д.)
- Bookings / quotes / vehicles / disputes / reviews native endpoints
- Marketplace search, matching, zones, demand endpoints
- Quick-request flow (Sprint 15/16/17)
- Orchestrator / Feedback / Strategy Optimizer loops и их admin endpoints
- DemandPredictor loop + `/api/admin/forecast/*` (Sprint 19/20 — прогноз **спроса на автосервис**, не рыночный)
- Pre-engagement flow (Sprint 18)
- Seed-data + startup_event + NestJS subprocess spawn
- Global catch-all proxy к NestJS в самом конце файла

## Next (на обсуждение)

Продолжить Sprint 21 по той же схеме: один слой endpoints → отдельный модуль
под `app/<domain>/router.py`, без изменения поведения. Логичный следующий
разрез — либо `app/bookings/*`, либо `app/compat/*` (compat-layer к NestJS),
либо `app/admin/*` (admin-endpoints, их больше всех).

Ждём решение от тебя, какой домен режем на C8.
