# API Reference — Foundation Stage 1

Базовый URL в dev: `http://localhost:8000`.
Все эндпоинты префиксованы `/api/`.
Формат обмена: `application/json`.
Swagger UI (интерактивно): `http://localhost:8000/docs`.

---

## Авторизация

Приватные эндпоинты требуют заголовок:

```http
Authorization: Bearer <accessToken>
```

Токен выдаётся `POST /api/auth/login` и `POST /api/auth/register`.
TTL по умолчанию — **7 дней** (`JWT_TTL_DAYS` в `.env`). Алгоритм — **HS256**.

---

## Список эндпоинтов

| Метод | Путь                  | Доступ    | Описание                               |
|-------|-----------------------|-----------|----------------------------------------|
| GET   | `/api/health`         | public    | Liveness probe                         |
| POST  | `/api/auth/register`  | public    | Регистрация (`user` или `provider`)     |
| POST  | `/api/auth/login`     | public    | Логин, выдаёт JWT                      |
| GET   | `/api/users/me`       | auth      | Текущий профиль                        |
| GET   | `/api/users`          | admin     | Список всех пользователей               |

---

## 1. `GET /api/health`

**Доступ**: публичный.
**Ответ** 200:

```json
{ "status": "ok" }
```

---

## 2. `POST /api/auth/register`

**Доступ**: публичный.
**Тело**:

```json
{
  "email": "client@example.com",
  "password": "secret123",
  "firstName": "Alice",
  "lastName": "Doe",
  "role": "user"
}
```

**Поля**:

| Поле       | Тип     | Обязательно | Правило                                 |
|------------|---------|--------------|----------------------------------------|
| email      | string  | ✔            | валидный email, уникальный в базе    |
| password   | string  | ✔            | 6–128 символов                          |
| firstName  | string  |              | по умолчанию `""`                      |
| lastName   | string  |              | по умолчанию `""`                      |
| role       | enum    |              | `user` или `provider` (admin запрещён) |

**Ответ** 201:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "65f...",
    "email": "client@example.com",
    "firstName": "Alice",
    "lastName": "Doe",
    "role": "user",
    "isActive": true
  }
}
```

**Ошибки**:

| Код | Когда                                                |
|-----|----------------------------------------------------|
| 400 | `role == "admin"` в саморегистрации              |
| 409 | email уже существует                               |
| 422 | валидация Pydantic (неверный email, короткий пароль) |

**Пример**:

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"secret123","role":"user"}'
```

---

## 3. `POST /api/auth/login`

**Доступ**: публичный.
**Тело**:

```json
{
  "email": "client@example.com",
  "password": "secret123"
}
```

**Ответ** 200 — такой же, как `register` (`{ accessToken, user }`).

**Ошибки**:

| Код | Когда                                                      |
|-----|----------------------------------------------------------|
| 401 | Неверный email или пароль (одинаковый ответ — anti-enumeration) |
| 403 | Аккаунт отключён (`isActive=false`)                          |

**Пример**:

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"secret123"}'
```

---

## 4. `GET /api/users/me`

**Доступ**: любой авторизованный пользователь.
**Заголовки**: `Authorization: Bearer <token>`.
**Ответ** 200:

```json
{
  "id": "65f...",
  "email": "client@example.com",
  "firstName": "Alice",
  "lastName": "Doe",
  "role": "user",
  "isActive": true
}
```

**Ошибки**:

| Код | Когда                                     |
|-----|-----------------------------------------|
| 401 | Нет токена / истёк / неверен          |
| 403 | Аккаунт отключён                       |

**Пример**:

```bash
curl http://localhost:8000/api/users/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## 5. `GET /api/users`

**Доступ**: только `admin`.
**Заголовки**: `Authorization: Bearer <admin-token>`.
**Query**:

| Параметр | Тип     | По умолчанию | Максимум |
|----------|---------|--------------|---------|
| limit    | int     | 50           | 200     |

**Ответ** 200:

```json
[
  { "id": "...", "email": "admin@example.com", "role": "admin", "isActive": true, "firstName": "", "lastName": "" },
  { "id": "...", "email": "alice@example.com", "role": "user",  "isActive": true, "firstName": "Alice", "lastName": "Doe" }
]
```

**Ошибки**:

| Код | Когда                                           |
|-----|-----------------------------------------------|
| 401 | Нет / неверный / истёкший токен              |
| 403 | Роль текущего пользователя не `admin`           |

**Пример**:

```bash
curl "http://localhost:8000/api/users?limit=100" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Схемы (Pydantic)

### `User`

| Поле       | Тип                                     |
|------------|----------------------------------------|
| id         | string (Mongo ObjectId → hex)          |
| email      | string (email)                         |
| firstName  | string                                 |
| lastName   | string                                 |
| role       | `"user" \| "provider" \| "admin"`      |
| isActive   | boolean                                |

### `TokenResponse`

```json
{
  "accessToken": "<jwt>",
  "user": { ...User }
}
```

### `Error` (FastAPI стандарт)

```json
{ "detail": "human-readable message" }
```

Для 422 (validation):

```json
{ "detail": [ { "type": "...", "loc": [...], "msg": "...", "input": ... } ] }
```

---

## Типичный сценарий клиента

```bash
# 1. Создать аккаунт
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"secret123","role":"user"}' \
  | jq -r '.accessToken')

# 2. Запросить свой профиль
curl http://localhost:8000/api/users/me -H "Authorization: Bearer $TOKEN"

# 3. Позднее логин теми же кредами
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"secret123"}' \
  | jq -r '.accessToken')
```

---

## Коды ошибок — сводная таблица

| Код | Значение                                                  |
|-----|-------------------------------------------------------------|
| 200 | OK                                                          |
| 201 | Created (только `POST /auth/register`)                       |
| 400 | Bad request (напр. `role=admin` в саморегистрации)         |
| 401 | Не авторизован / неверные креды / истёкший токен       |
| 403 | Запрещено (недостаточная роль или отключённый аккаунт) |
| 409 | Конфликт (email уже занят)                                  |
| 422 | Не прошла валидация входных данных                      |
| 500 | Внутренняя ошибка                                          |
