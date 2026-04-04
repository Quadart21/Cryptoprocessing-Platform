# CryptoProcessing Platform

Monorepo для multi-tenant SaaS платформы криптопроцессинга с клиентским кабинетом и superadmin-панелью.

## Структура

- `backend` - FastAPI backend
- `frontend` - React/Vite frontend
- `docker-compose.yml` - локальная инфраструктура
- `TZ_SaaS_CryptoProcessing_Platform.md` - master ТЗ

## Быстрый старт

### Backend

1. Перейти в `backend`
2. Создать виртуальное окружение
3. Установить зависимости из `requirements.txt`
4. Скопировать `.env.example` в `.env`
5. Инициализировать таблицы:

```bash
python -m app.scripts.init_db
```

6. При необходимости создать супер-админа:

```bash
python -m app.scripts.seed_superadmin
```

7. Запустить:

```bash
uvicorn app.main:app --reload
```

### Frontend

1. Перейти в `frontend`
2. Установить зависимости
3. Запустить dev server:

```bash
npm install
npm run dev
```

## Текущий этап

Сейчас реализован foundation-слой:
- каркас backend;
- каркас frontend;
- базовая конфигурация;
- маршрутизация;
- healthcheck;
- базовые domain-сущности для auth, tenants и invite flow;
- seed superadmin;
- JWT login и защищенные admin/client endpoints.

## Базовый auth flow

1. Супер-админ создается из `.env`
2. Супер-админ логинится через `POST /api/v1/client/auth/login`
3. Супер-админ вызывает `POST /api/v1/admin/tenants`
4. В ответе супер-админ получает `invite_token`, `project_id`, `api_public_key`, `api_secret_key`
5. Для владельца tenant создается стартовый проект и API-ключ
6. Владелец tenant устанавливает пароль через `POST /api/v1/client/auth/set-password`

## Что уже есть в API

- `GET /api/v1/admin/me`
- `GET /api/v1/admin/tenants`
- `POST /api/v1/admin/tenants`
- `GET /api/v1/admin/tenants/{tenant_id}/projects`
- `GET /api/v1/admin/tenants/{tenant_id}/api-keys`
- `POST /api/v1/client/auth/login`
- `POST /api/v1/client/auth/set-password`
- `GET /api/v1/client/me`
- `GET /api/v1/client/cabinet`
- `GET /api/v1/client/projects`
- `GET /api/v1/client/api-keys`
