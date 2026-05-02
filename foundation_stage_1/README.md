# Foundation Stage 1 — Core System

Базовое ядро платформы для взаимодействия клиентов и автосервисов (СТО).
Это этап 1 — закрытая фундаментальная часть системы, на которой дальше разворачивается продукт.

## 📖 Документация

- **README.md** — этот файл: обзор + как запустить
- [FOUNDATION_REPORT.md](./FOUNDATION_REPORT.md) — отчёт по этапу (по пунктам ТЗ)
- [ARCHITECTURE.md](./ARCHITECTURE.md) — как система устроена
- [API.md](./API.md) — справочник API

---

## 1. Что реализовано на этапе 1

- Модульная архитектура backend (core / models / schemas / routes / services / middleware)
- Авторизация через **JWT** + хеширование паролей **bcrypt**
- Роли **user / provider / admin** (RBAC)
- Базовый API: регистрация, логин, профиль, админ-список пользователей
- Frontend-auth flow: login / register / dashboard + `ProtectedRoute`
- Связка frontend ↔ backend (token store, `AuthContext`, API-клиент)

---

## 2. Как запустить

Требования: **Python 3.11+**, **Node.js 18+**, **MongoDB 6+** (локально или Atlas).

### 2.1. Backend

```bash
cd backend
cp .env.example .env                # измени JWT_SECRET на свой
pip install -r requirements.txt
uvicorn app.main:app --reload
```

→ `http://localhost:8000`
→ Swagger UI: `http://localhost:8000/docs`
→ Health: `http://localhost:8000/api/health`

### 2.2. Frontend

```bash
cd frontend/web-app
cp .env.example .env                # по умолчанию указывает на http://localhost:8000
npm install
npm run dev
```

→ `http://localhost:5173`

### 2.3. Первый админ (опционально)

Самостоятельно зарегистрироваться с ролью `admin` через API **нельзя** — выдаётся `400`.
Это сделано специально, чтобы в публичный эндпоинт нельзя было поднять админ-роль.
Первого админа создаёт локальный скрипт:

```bash
cd backend
python -m scripts.seed_admin
# → email: admin@example.com
# → password: Admin!2345
```

Пароль по умолчанию **сменить сразу после первого входа**.
Переопределить: `ADMIN_EMAIL=... ADMIN_PASSWORD=... python -m scripts.seed_admin`.

---

## 3. Тестовые сценарии

### Сценарий A — клиент (`user`)

1. Открыть `http://localhost:5173/register`
2. Зарегистрироваться (email + пароль, роль `user`)
3. Автоматически редирект на `/dashboard`
4. Увидеть профиль, роль = `user`
5. Нажать *Sign out* → выкидывает на `/login`

### Сценарий B — исполнитель (`provider`)

То же, но при регистрации выбрать `provider` в выпадающем списке.

### Сценарий C — админ (`admin`)

1. Засидить: `python -m scripts.seed_admin`
2. Логин на `/login` как `admin@example.com / Admin!2345`
3. Получить список всех пользователей:
   ```bash
   curl -H "Authorization: Bearer <admin-token>" http://localhost:8000/api/users
   ```

### Сценарий D — проверка RBAC

1. Залогиниться как `user`
2. Вызвать admin-only эндпоинт:
   ```bash
   curl -H "Authorization: Bearer <user-token>" http://localhost:8000/api/users
   # → 403 "Forbidden — requires role: admin"
   ```

---

## 4. Ограничения этапа

На данном этапе **НЕ входят**:

- Поиск исполнителей / marketplace логика
- Геолокация / карта
- Bidding / auto-money
- Мобильное приложение
- Админ-панель (UI)

Эти функции запланированы на следующие этапы.

---

## 5. Стек технологий

| Слой    | Технологии                                         |
|---------|---------------------------------------------------|
| Backend | FastAPI, Motor (async MongoDB), PyJWT, bcrypt     |
| Frontend| React 18, Vite, TypeScript, React Router          |
| Auth    | JWT (HS256, TTL 7 дней) в Bearer-заголовке      |
| DB      | MongoDB                                           |

Подробнее — в [ARCHITECTURE.md](./ARCHITECTURE.md).
