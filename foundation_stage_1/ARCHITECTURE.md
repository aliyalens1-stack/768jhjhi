# Architecture — Foundation Stage 1

Документ описывает устройство системы, обмен данными между компонентами и принятые
архитектурные решения.

---

## 1. Общая схема

```
                  ┌───────────────────────┐
                  │   Web App (React)     │
                  │   Vite + TypeScript   │
                  └───────────┬──────────┘
                              │
                              │  HTTPS  +  Bearer JWT
                              ▼
                  ┌───────────────────────┐
                  │   API Layer           │
                  │   FastAPI (Python)    │
                  │   · routes           │
                  │   · services         │
                  │   · middleware       │
                  └───────────┬──────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │   MongoDB             │
                  │   collection: users   │
                  └───────────────────────┘
```

Три слоя, чёткие границы:

- **Клиент (Frontend)** — React, ничего не знает о базе, только ходит в API.
- **API (Backend)** — FastAPI, все бизнес-правила, единственный клиент для БД.
- **Хранилище (DB)** — MongoDB, пассивное.

---

## 2. Backend

### 2.1. Стек

- **FastAPI** — быстрый, типобезопасный, с авто-генерацией Swagger
- **Motor** — async Mongo-драйвер (совместим с asyncio FastAPI)
- **PyJWT** — стандартный RFC-совместимый генератор JWT
- **bcrypt** — индустриальный стандарт хеширования паролей (с авто-солью)
- **Pydantic v2** — валидация всего входящего/исходящего

### 2.2. Слои и ответственность

```
backend/app/
├── main.py          — точка входа: lifespan + CORS + роутеры
├── core/            — инфра: config, database, security (НЕ бизнес)
├── models/          — внутренние модели домена (Mongo-схемы)
├── schemas/         — публичные DTO (API-контракты)
├── routes/          — HTTP-эндпоинты (тонкие)
├── services/        — бизнес-логика (инварианты, правила)
└── middleware/      — авторизация (JWT) + RBAC
```

Почему так:

- **Routes тонкие**: только парсинг и вызов сервиса. Бизнес-инварианты (напр. запрет админ-саморегистрации) в одном месте — в `services/`.
- **Schemas ≠ Models**: `schemas/` — что видит клиент; `models/` — что лежит в БД. Разные сущности (напр. `passwordHash` — внутреннее, наружу не выходит).
- **Middleware — декларативный RBAC**: `require_role(Role.ADMIN)` вешается на роут; код эндпоинта без `if admin`.

### 2.3. Безопасность (core/security.py)

- **Пароли**: bcrypt с авто-солью. Храним только хеш, сравнение constant-time.
- **JWT**: HS256, payload `{sub, email, role, iat, exp}`. TTL секрет и сквозные параметры в `.env`.
- **Кодирование ошибок**: одинаковый ответ на "нет пользователя" и "неверный пароль" — защита от email-enumeration.

### 2.4. Почему JWT, а не сессии

- **Stateless**: API не хранит сессий, масштабируется горизонтально без sticky-балансировки.
- **Косвенно**: подходит для мобильного приложения (этап 2), которое будет хранить токен локально.

### 2.5. Почему саморегистрация админа запрещена

Публичный эндпоинт `/api/auth/register` принимает только `user` и `provider`.
Роль `admin` создаётся **только на сервере** (seed-скрипт `scripts/seed_admin.py`). Это:

- закрывает вектор privilege escalation через поддельный `{"role": "admin"}` в теле запроса;
- оставляет явный аудит-след — кто кому выдал админа.

---

## 3. Frontend

### 3.1. Стек

- **React 18** + **TypeScript** + **Vite** (быстрый dev-server, ESM)
- **React Router 6** (data-router, BrowserRouter)

### 3.2. Структура

```
frontend/web-app/src/
├── main.tsx               — bootstrap (BrowserRouter + AuthProvider)
├── App.tsx                — маршруты
├── pages/                 — login, register, dashboard
├── services/api.ts        — HTTP-клиент + tokenStore
├── context/AuthContext.tsx — глобальное состояние авторизации
└── components/ProtectedRoute.tsx — гейт для приватных экранов
```

### 3.3. Разделение

- **services/** — чистый HTTP, никакого UI.
- **context/** — единственный источник правды о текущем пользователе. При `mount` пытается восстановить сессию через `GET /users/me` если в `localStorage` есть токен.
- **pages/** — читают `useAuth()`, не знают о токенах.
- **ProtectedRoute** — чистый гейт с редиректом на `/login` и сохранением `from`-адреса.

### 3.4. Хранение токена

Сейчас — `localStorage` (стандарт для web-SPA).
Для production, когда появится refresh-token, рекомендуется перенести его в **httpOnly cookie** (защита от XSS), а access-token оставить в памяти.

---

## 4. Поток авторизации (секвенс)

```
Пользователь        Web App              API                 MongoDB
   │                │                   │                    │
   │ email+password  │                   │                    │
   ├────────────►│                   │                    │
   │                │ POST /auth/login  │                    │
   │                ├─────────────────►│                    │
   │                │                   │ find_one({email}) │
   │                │                   ├──────────────────►│
   │                │                   │ verify bcrypt      │
   │                │                   │ create JWT         │
   │                │ { accessToken,    │                    │
   │                │    user }         │                    │
   │                ◄─────────────────┤                    │
   │                │ localStorage.set  │                    │
   │                │                   │                    │
   │                │ GET /users/me     │                    │
   │                │ Authorization:    │                    │
   │                │   Bearer <jwt>    │                    │
   │                ├─────────────────►│                    │
   │                │                   │ decode JWT         │
   │                │                   │ find_one({_id})   │
   │                │                   ├──────────────────►│
   │                │ { user profile }  │                    │
   │                ◄─────────────────┤                    │
```

### Отказные сценарии

| Ситуация                  | Ответ API                           |
|----------------------------|--------------------------------------|
| Нет заголовка `Authorization` | 401 "Authorization required"         |
| Истёкший токен            | 401 "Token expired"                  |
| Испорченный токен          | 401 "Invalid token"                  |
| Пользователь удалён        | 401 "User not found"                 |
| Аккаунт отключён           | 403 "Account disabled"               |
| Недостаточная роль          | 403 "Forbidden — requires role: …"   |

---

## 5. RBAC — ролевая модель

| Роль     | Кто                            | Доступ                                         |
|----------|-------------------------------|------------------------------------------------|
| `user`   | Клиент (заказчик услуги)    | Свой профиль                                   |
| `provider`| Исполнитель (СТО)            | Свой профиль (в Stage 2: своя организация) |
| `admin`  | Администратор платформы      | Все пользователи, админ-эндпоинты       |

Практическая реализация — `app/middleware/role_check.py`:

```python
@router.get("/users", dependencies=[Depends(require_role(Role.ADMIN))])
async def list_users(...): ...
```

Добавление новой роли — одна строка в `app/models/role.py`.

---

## 6. Модель данных

### Коллекция `users`

```json
{
  "_id": "ObjectId",
  "email": "string (unique index)",
  "passwordHash": "bcrypt-hash",
  "firstName": "string",
  "lastName": "string",
  "role": "user | provider | admin",
  "isActive": true,
  "createdAt": "ISO-8601"
}
```

Индексы (создаются при старте FastAPI):

- `users.email` — unique

---

## 7. CORS, порты, конфиг

- Backend слушает `:8000`, frontend — `:5173`. Из коробки `.env.example` разрешает эти origin'ы.
- CORS настраивается переменной `CORS_ORIGINS` в backend/.env (перечень через запятую).
- Для dev можно поставить `CORS_ORIGINS=*`.
- Для production — ставьте явный origin frontend’а.

---

## 8. Расширение в Stage 2

Текущий фундамент напрямую принимает следующие модули:

- `routes/organizations.py` — `provider` создаёт свою организацию (модель уже есть).
- `routes/services.py` — каталог услуг.
- `routes/bookings.py` — связь user↔provider.
- `routes/geo.py` — геолокация / nearby.

Файлы `core/`, `middleware/`, `services/auth_service.py` меняться не должны — это и есть замороженный ядровой контракт.
