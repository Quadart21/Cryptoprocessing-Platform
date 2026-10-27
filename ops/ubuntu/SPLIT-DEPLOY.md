# Split deploy: БД + API + сайт (3 сервера)

Разнесённая установка для production. Монолит по-прежнему: `setup-server.sh`.

## Серверы (noren.digital)

| Роль | IP | DNS |
|------|-----|-----|
| PostgreSQL | `191.217.255.149` | — (не в DNS) |
| API + Redis + Celery (WORKER) | `191.217.255.230` | `api.noren.digital` |
| Frontend + Nginx (WEB) | `191.217.255.57` | `noren.digital`, `www`, `admin`, `app`, `docs`, `pay` |

Все публичные записи — **Cloudflare proxied** (оранжевое облако), SSL **Full (strict)** после установки Origin Certificate.  
Антиддос: `CLOUDFLARE-DDOS.md` + nginx limits на API и сайте.

## Cloudflare DNS (что указать)

| Тип | Имя | IPv4 | Proxy |
|-----|-----|------|-------|
| A | `noren.digital` | `191.217.255.57` | Proxied (оранжевое облако) |
| A | `www` | `191.217.255.57` | Proxied |
| A | `admin` | `191.217.255.57` | Proxied |
| A | `app` | `191.217.255.57` | Proxied |
| A | `docs` | `191.217.255.57` | Proxied |
| A | `pay` | `191.217.255.57` | Proxied |
| A | `api` | `191.217.255.230` | Proxied |

БД (`191.217.255.149`) в DNS **не добавлять**.

**SSL/TLS → Overview:** `Full (strict)` — только после Origin Certificate на WEB и WORKER  
(`/etc/ssl/cloudflare/noren.digital.pem` + `.key`). Пока сертификатов нет — временно `Flexible` (хуже) или сначала положи Origin cert и пересобери nginx с `ENABLE_SSL=1`.

**Origin Certificate:** SSL/TLS → Origin Server → Create Certificate → hostnames: `noren.digital`, `*.noren.digital` → сохрани pem/key на оба сервера (WEB + WORKER).

## Порядок установки

### 1. БД (`191.217.255.149`)

> **UFW:** скрипт разрешает SSH (22) перед `ufw enable`. Без этого SSH обрывается.

```bash
sudo DB_LISTEN_IP=191.217.255.149 API_SERVER_IP=191.217.255.230 POSTGRES_PASSWORD='ВАШ_ПАРОЛЬ_БД' PG_VERSION=18 bash ops/ubuntu/setup-db.sh
```

### 2. API (`191.217.255.230`)

Сертификаты Cloudflare Origin в `/etc/ssl/cloudflare/noren.digital.pem` и `.key`.

```bash
sudo DOMAIN=noren.digital POSTGRES_HOST=191.217.255.149 POSTGRES_PASSWORD='ВАШ_ПАРОЛЬ_БД' SITE_SERVER_IP=191.217.255.57 SUPERADMIN_PASSWORD='ВАШ_ПАРОЛЬ_АДМИНА' bash ops/ubuntu/setup-api.sh
```

### 3. Сайт (`191.217.255.57`)

```bash
sudo DOMAIN=noren.digital API_UPSTREAM=191.217.255.230:8000 bash ops/ubuntu/setup-site.sh
```

### 4. DDoS nginx (после установки)

**API:**
```bash
sudo DOMAIN=noren.digital bash /opt/cryptoprocessing/ops/ubuntu/apply-ddos-protection.sh
```

**Сайт:**
```bash
sudo DOMAIN=noren.digital API_UPSTREAM=191.217.255.230:8000 bash /opt/cryptoprocessing/ops/ubuntu/apply-site-ddos-protection.sh
```

## Firewall

| Сервер | Правила |
|--------|---------|
| `191.217.255.149` | 5432 ← только `191.217.255.230` |
| `191.217.255.230` | 80, 443 — все; 8000 ← только `191.217.255.57` |
| `191.217.255.57` | 80, 443 — все |

## Обновление после релиза

**API:**
```bash
cd /opt/cryptoprocessing && git pull && sudo bash ops/ubuntu/update-server-api.sh
```

**Сайт:**
```bash
cd /opt/cryptoprocessing && git pull && sudo API_UPSTREAM=191.217.255.230:8000 bash ops/ubuntu/update-server-site.sh
```

**БД:** миграции запускаются с API (`alembic upgrade head` в `update-server-api.sh`).

**Бэкапы (FORCE RLS):** на сервере БД нужна роль `backup_dump` с `BYPASSRLS` (создаётся в `setup-db.sh`). В `.env` на API:

```env
BACKUP_PG_DUMP_USER=backup_dump
BACKUP_PG_DUMP_PASSWORD=...
```

Если БД уже развёрнута без этой роли — на `191.217.255.149`:

```bash
sudo -u postgres psql -d cryptoprocessing -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE backup_dump WITH LOGIN PASSWORD 'ВАШ_ПАРОЛЬ' BYPASSRLS;
GRANT CONNECT ON DATABASE cryptoprocessing TO backup_dump;
GRANT USAGE ON SCHEMA public TO backup_dump;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_dump;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO backup_dump;
SQL
```

Добавьте в `pg_hba.conf` строку для `backup_dump` с IP API (`191.217.255.230/32`), `systemctl reload postgresql`, затем переменные в `.env` API и `systemctl restart cryptoprocessing-celery-worker`.

## Переменные

| Скрипт | Ключевые переменные |
|--------|---------------------|
| `setup-db.sh` | `DB_LISTEN_IP`, `API_SERVER_IP`, `POSTGRES_PASSWORD` |
| `setup-api.sh` | `DOMAIN`, `POSTGRES_HOST`, `POSTGRES_PASSWORD`, `SITE_SERVER_IP` |
| `setup-site.sh` | `DOMAIN`, `API_UPSTREAM` |
| `apply-site-ddos-protection.sh` | `DOMAIN`, `API_UPSTREAM` |

Frontend при сборке: `frontend/.env.production` — шаблон `frontend/.env.production.example`.  
Скрипты `setup-api.sh` / `setup-site.sh` создают `.env.production` автоматически.

## Проверки

```bash
PGPASSWORD='...' psql -h 191.217.255.149 -U cryptoprocessing -d cryptoprocessing -c 'SELECT 1'
curl -fsS https://api.noren.digital/api/v1/health
curl -fsSI https://noren.digital/
curl -fsSI https://admin.noren.digital/
```

Webhook провайдера: `https://api.noren.digital/internal/webhook/crypto-cash`

## Масштабирование

- **+1 сайт** — клон `setup-site.sh`, тот же `API_UPSTREAM`, CF Load Balancing.
- **+1 API** — общий Redis, `API_UPSTREAM` на сайте → nginx upstream с несколькими backend.
- **БД** — при росте: PgBouncer, read replica.

См. также `CLOUDFLARE-DDOS.md` — три слоя: Cloudflare → nginx → FastAPI rate limit (Redis).
