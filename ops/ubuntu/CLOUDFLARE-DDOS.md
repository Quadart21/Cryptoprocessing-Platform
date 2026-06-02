# Cloudflare: DDoS и rate limit для noren.digital

Предполагается: DNS **proxied** (оранжевое облако), SSL mode **Full (strict)**, origin cert на сервере.

## 1. Security → Settings

| Параметр | Рекомендация |
|----------|----------------|
| **Security Level** | Medium (при атаке — **I'm Under Attack**) |
| **Bot Fight Mode** | On |
| **Browser Integrity Check** | On |

## 2. Security → WAF → Custom rules

Создай правила **сверху вниз** (порядок важен).

### Rule A — блок явного мусора

- **Name:** Block empty UA on API  
- **Expression:** `(http.request.uri.path contains "/api/" and http.user_agent eq "")`  
- **Action:** Block  

### Rule B — rate limit API (на edge, до origin)

- **Name:** Rate limit API per IP  
- **Expression:** `(http.request.uri.path contains "/api/")`  
- **Action:** Rate limit  
- **Requests:** 1200 per 1 minute  
- **Characteristics:** IP  
- **Then:** Block for 60 seconds  

### Rule C — rate limit checkout

- **Name:** Rate limit pay page  
- **Expression:** `(http.request.uri.path contains "/pay/")`  
- **Action:** Rate limit  
- **Requests:** 300 per 1 minute  
- **Characteristics:** IP  
- **Then:** Block for 60 seconds  

### Rule D — rate limit login

- **Name:** Rate limit auth  
- **Expression:** `(http.request.uri.path contains "/api/v1/client/auth/login")`  
- **Action:** Rate limit  
- **Requests:** 30 per 1 minute  
- **Characteristics:** IP  
- **Then:** Block for 300 seconds  

> На Free plan custom WAF rules могут быть ограничены — используй **Security → WAF → Rate limiting rules** (отдельный раздел) с теми же expression.

## 3. Security → DDoS

- **HTTP DDoS attack protection:** enabled (default)  
- **Sensitivity:** High (при реальной атаке)

## 4. Speed → Optimization

- **Auto Minify:** JS, CSS (optional)  
- **Brotli:** On  

## 5. Caching (снижает нагрузку на origin)

**Cache Rule:**

- **URL:** `noren.digital/assets/*`  
- **Cache eligibility:** Eligible for cache  
- **Edge TTL:** 1 month  

Не кешировать: `/api/*`, `/pay/*`, `/internal/*`.

## 6. При активной атаке

1. Dashboard → **I'm Under Attack Mode** (на 15–30 мин)  
2. Или **Security Level → Under Attack**  
3. На сервере можно временно ужесточить nginx в  
   `/etc/nginx/conf.d/cryptoprocessing-limits.conf` (снизить `rate=`) и `sudo nginx -t && sudo systemctl reload nginx`

## 7. Проверка real IP

После `apply-ddos-protection.sh` nginx использует `CF-Connecting-IP`.  
В логах приложения и rate limit должен быть **IP клиента**, не Cloudflare.

```bash
curl -sI https://noren.digital/api/v1/health
# При флуде с одного IP: 429 от nginx или Cloudflare
```

## 8. Связка с приложением

| Слой | Что режет |
|------|-----------|
| **Cloudflare** | volumetric, botnet, edge rate limit |
| **Nginx** | req/s, conn/IP до Python |
| **FastAPI** | burst, API key account, business limits |

Все три слоя дополняют друг друга — не заменяют.
