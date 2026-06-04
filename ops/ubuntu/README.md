# Deploy на Ubuntu (production)

Автоматическая установка: один скрипт ставит PostgreSQL, Redis, Nginx, systemd, backend, frontend, миграции и супер-админа.

## Быстрый старт (рекомендуется)

### 1. Подготовка сервера

- Ubuntu 22.04 или 24.04
- Открыты порты **80** и **443**
- DNS: `A`-запись домена → IP сервера
- Доступ по SSH с правами `sudo`

### 2. Клонировать репозиторий на сервер

```bash
sudo mkdir -p /opt/cryptoprocessing
sudo chown -R $USER:$USER /opt/cryptoprocessing
git clone https://github.com/Quadart21/Cryptoprocessing-Platform.git /opt/cryptoprocessing
cd /opt/cryptoprocessing
chmod +x ops/ubuntu/*.sh
```

### 3. Первый запуск

```bash
sudo DOMAIN=your-domain.com \
     SSL_MODE=none \
     bash ops/ubuntu/setup-server.sh
```

Пароли **PostgreSQL** и **админки** генерируются автоматически и выводятся в терминал в конце установки.  
Также сохраняются в `/root/cryptoprocessing-credentials.txt`.

Опционально можно задать email админа вручную:

```bash
sudo DOMAIN=your-domain.com SUPERADMIN_EMAIL=admin@your-domain.com bash ops/ubuntu/setup-server.sh
```

Скрипт сам:
- установит пакеты (Python, Node 22, PostgreSQL, Redis, Nginx)
- создаст пользователя `cryptoprocessing`
- сгенерирует секреты, пароль БД и пароль админки
- соберёт frontend
- применит Alembic-миграции
- создаст супер-админа
- поднимет systemd-сервисы: `cryptoprocessing`, celery worker, celery beat

После установки проверка:

```bash
curl -fsS http://127.0.0.1:8000/api/v1/health
systemctl status cryptoprocessing --no-pager
```

Сайт: `http://your-domain.com`

---

## Production с Cloudflare SSL

### 1. Cloudflare

1. Домен → **DNS** → `A` на IP сервера (можно с оранжевым облаком)
2. **SSL/TLS → Overview → Full (strict)**
3. **SSL/TLS → Origin Server → Create Certificate**
4. Сохранить на сервере:

```bash
sudo mkdir -p /etc/ssl/cloudflare
sudo nano /etc/ssl/cloudflare/your-domain.com.pem
sudo nano /etc/ssl/cloudflare/your-domain.com.key
sudo chmod 600 /etc/ssl/cloudflare/your-domain.com.key
```

### 2. Deploy с SSL

```bash
sudo DOMAIN=your-domain.com \
     DOMAIN_ALIASES=www.your-domain.com \
     SSL_MODE=cloudflare_origin \
     CLOUDFLARE_ORIGIN_CERT_PATH=/etc/ssl/cloudflare/your-domain.com.pem \
     CLOUDFLARE_ORIGIN_KEY_PATH=/etc/ssl/cloudflare/your-domain.com.key \
     bash ops/ubuntu/setup-server.sh
```

---

## Установка без ручного git clone

Скрипт сам клонирует репозиторий:

```bash
curl -fsSL https://raw.githubusercontent.com/Quadart21/Cryptoprocessing-Platform/main/ops/ubuntu/setup-server.sh -o /tmp/setup-server.sh
sudo GIT_REPO=https://github.com/Quadart21/Cryptoprocessing-Platform.git \
     DOMAIN=your-domain.com \
     SSL_MODE=none \
     bash /tmp/setup-server.sh
```

---

## Обновление после релиза

```bash
cd /opt/cryptoprocessing
git pull
sudo bash ops/ubuntu/update-server.sh
```

Или только пересборка без git pull (если файлы уже скопированы):

```bash
sudo SKIP_GIT_PULL=1 bash /opt/cryptoprocessing/ops/ubuntu/update-server.sh
```

Быстрый рестарт без обновления кода:

```bash
sudo bash /opt/cryptoprocessing/ops/ubuntu/restart_app.sh
```

### DDoS / rate limit (nginx + Cloudflare)

На сервере (nginx `limit_req`, real IP от Cloudflare, 2 uvicorn workers):

```bash
sudo bash /opt/cryptoprocessing/ops/ubuntu/apply-ddos-protection.sh
```

Правила в Cloudflare Dashboard — пошагово: `ops/ubuntu/CLOUDFLARE-DDOS.md`.

В `.env` опционально: `UVICORN_WORKERS=2` (по умолчанию 2 после обновления systemd unit).

---

## Что настраивать в `.env`

Файл: `/opt/cryptoprocessing/.env`

Обязательно для production:

| Переменная | Описание |
|---|---|
| `POSTGRES_PASSWORD` | Пароль PostgreSQL |
| `SUPERADMIN_EMAIL` | Email супер-админа |
| `SUPERADMIN_PASSWORD` | Пароль супер-админа |
| `BACKEND_CORS_ORIGINS` | `https://domain,https://app.domain,https://docs.domain,https://admin.domain,...` |
| `PUBLIC_API_BASE_URL` | `https://domain` или `https://api.domain` |
| `PUBLIC_PAY_BASE_URL` | `https://pay.domain` (ссылки `payment_page_url` → `https://pay.domain/{token}`) |

Поддомены (DNS + nginx `server_name`):

| Host | Назначение |
|------|------------|
| `domain` | Лендинг |
| `admin.domain` | Платформенная админка (отдельный вход) |
| `pay.domain` | Платёжная страница (`/{token}`) |
| `docs.domain` | Документация |
| `app.domain` | Кабинет мерчанта (опционально, `VITE_APP_SITE_URL`) |
| `api.domain` | API (опционально, `PUBLIC_API_BASE_URL` + `VITE_API_BASE_URL`) |

При сборке frontend: `frontend/.env.production` — см. `frontend/.env.production.example`.
Deploy: `ADMIN_DOMAIN=admin.your-domain.com` (по умолчанию `admin.$DOMAIN`).
| `CRYPTO_CASH_PUBLIC_KEY` | Ключ провайдера (если не mock) |
| `CRYPTO_CASH_SECRET_KEY` | Секрет провайдера |

Секреты (`SECRET_KEY`, `JWT_SECRET_KEY`, `FERNET_SECRET_KEY`, `WEBHOOK_SECRET_KEY`) генерируются автоматически при первом deploy.

Шаблон: `ops/ubuntu/.env.production.example`

---

## Systemd-сервисы

| Сервис | Назначение |
|---|---|
| `cryptoprocessing` | FastAPI (uvicorn, порт 8000) |
| `cryptoprocessing-celery-worker` | Фоновые задачи |
| `cryptoprocessing-celery-beat` | Планировщик задач |
| `nginx` | Reverse proxy + статика `/assets` |
| `postgresql` | База данных |
| `redis-server` | Кэш / очереди |

Логи:

```bash
journalctl -u cryptoprocessing -n 100 --no-pager
journalctl -u cryptoprocessing-celery-worker -n 50 --no-pager
```

---

## Переменные deploy-скриптов

| Переменная | По умолчанию | Описание |
|---|---|---|
| `DOMAIN` | — | Основной домен |
| `DOMAIN_ALIASES` | `www.$DOMAIN` | Алиасы через запятую |
| `APP_DIR` | `/opt/cryptoprocessing` | Каталог приложения |
| `SSL_MODE` | `cloudflare_origin` | `cloudflare_origin`, `letsencrypt`, `none` |
| `GIT_REPO` | — | URL для автоклонирования |
| `SUPERADMIN_EMAIL` | `admin@$DOMAIN` | Email админа (если не задан — генерируется) |
| `SUPERADMIN_PASSWORD` | auto | Пароль админа (генерируется, если не задан) |

---

## Let's Encrypt (без Cloudflare Origin)

Cloudflare proxy должен быть **DNS only** (серое облако) на время выпуска сертификата:

```bash
sudo DOMAIN=your-domain.com \
     APP_DIR=/opt/cryptoprocessing \
     SSL_MODE=letsencrypt \
     LETSENCRYPT_EMAIL=you@example.com \
     bash ops/ubuntu/deploy.sh
```

---

## Troubleshooting

**Deploy остановился на «Fill replace-with-*»**  
Отредактируй `/opt/cryptoprocessing/.env` и запусти setup/deploy снова.

**502 Bad Gateway**  
```bash
systemctl status cryptoprocessing
journalctl -u cryptoprocessing -n 80 --no-pager
```

**Ошибка миграций**  
```bash
sudo -u cryptoprocessing bash -lc 'cd /opt/cryptoprocessing/backend && ./.venv/bin/alembic upgrade head'
```

**Пропустить миграции при рестарте**  
```bash
sudo SKIP_MIGRATIONS=1 bash ops/ubuntu/restart_app.sh
```

---

## Файлы

| Скрипт | Назначение |
|---|---|
| `ops/ubuntu/setup-server.sh` | Полная первичная установка |
| `ops/ubuntu/deploy.sh` | Низкоуровневый deploy (вызывается из setup) |
| `ops/ubuntu/update-server.sh` | Обновление после `git pull` |
| `ops/ubuntu/restart_app.sh` | Пересборка frontend + миграции + рестарт |
