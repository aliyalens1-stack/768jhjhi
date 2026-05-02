# Этап 1 — Foundation / Ядро системы

## Общая цель этапа

Реализовать базовую архитектуру системы, включая backend, frontend,
авторизацию, роли и первичное взаимодействие клиента с системой.

---

# 4.1. Этап 1 – Foundation / ядро системы

---

## 4.1.1. Базовая архитектура проекта

Реализована модульная архитектура backend-приложения:

- разделение на слои: core / models / schemas / routes / services / middleware
- централизованная точка входа (`main.py`)
- подключение базы данных

📁 Реализация:

- `backend/app/main.py`
- `backend/app/core/config.py`
- `backend/app/core/database.py`

---

## 4.1.2. Настройка backend-структуры

Создана структура backend с разделением ответственности:

- core — конфигурация, безопасность
- models — модели данных
- schemas — DTO / валидация
- routes — API endpoints
- services — бизнес-логика
- middleware — проверка доступа

📁 Реализация:

- `backend/app/core/`
- `backend/app/models/`
- `backend/app/schemas/`
- `backend/app/routes/`
- `backend/app/services/`
- `backend/app/middleware/`

---

## 4.1.3. Базовая API-структура

Реализованы основные API endpoints:

- регистрация пользователя
- авторизация
- получение текущего пользователя

📁 Реализация:

- `backend/app/routes/auth.py`
- `backend/app/routes/users.py`

---

## 4.1.4. Регистрация, login, token/session logic

Реализована система авторизации на основе JWT:

- регистрация пользователя (email + password)
- логин
- генерация access token
- проверка токена

📁 Реализация:

- `backend/app/routes/auth.py`
- `backend/app/services/auth_service.py`
- `backend/app/core/security.py`

---

## 4.1.5. Роли user / provider / admin

Реализована ролевая модель:

- user — клиент
- provider — исполнитель (СТО)
- admin — администратор

Роль сохраняется в модели пользователя и используется в access control.
Самостоятельно через `/api/auth/register` можно зарегистрироваться только
как `user` или `provider`; роль `admin` создаётся только серверным путём
(seed-скрипт).

📁 Реализация:

- `backend/app/models/user.py`
- `backend/app/models/role.py`
- `backend/app/services/auth_service.py` (фильтр self-service ролей)
- `backend/scripts/seed_admin.py` (создание первого админа)

---

## 4.1.6. Базовые middleware

Реализованы middleware:

- проверка авторизации (JWT)
- проверка ролей (access control)

📁 Реализация:

- `backend/app/middleware/auth.py`
- `backend/app/middleware/role_check.py`

---

## 4.1.7. Стартовая структура web-проекта

Создан frontend проект:

- структура страниц
- подключение к backend API
- базовая маршрутизация

📁 Реализация:

- `frontend/web-app/src/`
- `frontend/web-app/src/pages/`
- `frontend/web-app/src/App.tsx` (маршруты)
- `frontend/web-app/src/main.tsx` (точка входа)

---

## 4.1.8. Базовые страницы

Реализованы основные страницы:

- Login
- Register
- Dashboard (после авторизации)

📁 Реализация:

- `frontend/web-app/src/pages/login.tsx`
- `frontend/web-app/src/pages/register.tsx`
- `frontend/web-app/src/pages/dashboard.tsx`

---

## 4.1.9. Формы авторизации

Реализованы формы:

- ввод email и password
- отправка данных на backend
- обработка ошибок
- валидация (минимальная длина пароля, обязательные поля)

📁 Реализация:

- `frontend/web-app/src/pages/login.tsx`
- `frontend/web-app/src/pages/register.tsx`

---

## 4.1.10. Первичное подключение frontend к backend

Frontend интегрирован с backend:

- отправка API-запросов
- получение JWT
- сохранение токена (localStorage)
- использование токена в защищённых запросах
- защита приватных маршрутов (`ProtectedRoute`)

📁 Реализация:

- `frontend/web-app/src/services/api.ts`
- `frontend/web-app/src/context/AuthContext.tsx`
- `frontend/web-app/src/components/ProtectedRoute.tsx`

---

# Итог этапа

На данном этапе реализована базовая система, позволяющая:

✔ зарегистрировать пользователя  
✔ авторизоваться  
✔ получить токен доступа  
✔ определить роль пользователя  
✔ работать с защищёнными API  

---

# Ограничения этапа

На данном этапе НЕ реализованы:

- marketplace логика
- поиск исполнителей
- bidding / auto-money
- геолокация
- мобильное приложение
- админ-панель

Эти функции входят в следующие этапы разработки.

---

# Заключение

Этап Foundation завершён.
Система готова к расширению функционала (гео, marketplace, booking, matching).
