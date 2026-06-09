# Split deploy: БД + API + сайт (3 сервера)

Разнесённая установка для production. Монолит по-прежнему: `setup-server.sh`.

## Серверы (noren.digital)

| Роль | IP | DNS |
|------|-----|-----|
| PostgreSQL | `2.26.88.44` | — (не в DNS) |
| API + Redis + Celery | `2.26.90.43` | `api.noren.digital` |
| Frontend + Nginx | `2.26.9.49` | `noren.digital`, `www`, `admin`, `app`, `docs`, `pay` |

Все публичные записи — **Cloudflare proxied** (оранжевое облако), SSL **Full (strict)**.  
Антиддос: `CLOUDFLARE-DDOS.md` + nginx limits на API и сайте.

## Порядок установки

### 1. БД (`2.26.88.44`)

```bash
sudo DB_LISTEN_IP=2.26.88.44 API_SERVER_IP=2.26.90.43 POSTGRES_PASSWORD='ВАШ_ПАРОЛЬ_БД' bash ops/ubuntu/setup-db.sh
```

### 2. API (`2.26.90.43`)

Сертификаты Cloudflare Origin в `/etc/ssl/cloudflare/noren.digital.pem` и `.key`.

```bash
sudo DOMAIN=noren.digital POSTGRES_HOST=2.26.88.44 POSTGRES_PASSWORD='ВАШ_ПАРОЛЬ_БД' SITE_SERVER_IP=2.26.9.49 SUPERADMIN_PASSWORD='ВАШ_ПАРОЛЬ_АДМИНА' bash ops/ubuntu/setup-api.sh
```

### 3. Сайт (`2.26.9.49`)

```bash
sudo DOMAIN=noren.digital API_UPSTREAM=2.26.90.43:8000 bash ops/ubuntu/setup-site.sh
```

### 4. DDoS nginx (после установки)

**API:**
```bash
sudo DOMAIN=noren.digital bash /opt/cryptoprocessing/ops/ubuntu/apply-ddos-protection.sh
```

**Сайт:**
```bash
sudo DOMAIN=noren.digital API_UPSTREAM=2.26.90.43:8000 bash /opt/cryptoprocessing/ops/ubuntu/apply-site-ddos-protection.sh
```

## Firewall

| Сервер | Правила |
|--------|---------|
| `2.26.88.44` | 5432 ← только `2.26.90.43` |
| `2.26.90.43` | 80, 443 — все; 8000 ← только `2.26.9.49` |
| `2.26.9.49` | 80, 443 — все |

## Обновление после релиза

**API:**
```bash
cd /opt/cryptoprocessing && git pull && sudo bash ops/ubuntu/update-server-api.sh
```

**Сайт:**
```bash
cd /opt/cryptoprocessing && git pull && sudo API_UPSTREAM=2.26.90.43:8000 bash ops/ubuntu/update-server-site.sh
```

**БД:** миграции запускаются с API (`alembic upgrade head` в `update-server-api.sh`).

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
PGPASSWORD='...' psql -h 2.26.88.44 -U cryptoprocessing -d cryptoprocessing -c 'SELECT 1'
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
