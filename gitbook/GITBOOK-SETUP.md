---
hidden: true
---

# Подключение GitBook (только мерчанты)

Инструкция для команды: опубликовать **merchant-документацию** на [GitBook](https://www.gitbook.com).

{% hint style="info" %}
В этот space попадает **только** документация для мерчантов (Merchant API). Документация платформы, админки и внутренних процессов сюда **не добавляется**.
{% endhint %}

## 1. Создать space

1. Войдите на [gitbook.com](https://www.gitbook.com).
2. **Create** → **Documentation** → space **«NorenDigital · Merchant API»** (аудитория — мерчанты).

## 2. Включить Git Sync

1. В space: **Settings** → **Integrations** → **Git Sync**.
2. Подключите репозиторий `Quadart21/Cryptoprocessing-Platform`.
3. **Project directory:** `gitbook` (подпапка с `.gitbook.yaml`).
4. Ветка: `main`.
5. Направление sync: **Bidirectional** или **Git → GitBook** (если правите только в репозитории).

## 3. Структура в репозитории

```
gitbook/
  .gitbook.yaml      ← конфиг GitBook
  README.md          ← главная страница
  SUMMARY.md         ← оглавление (сайдбар)
  quickstart.md
  checkout.md
  webhooks.md
  commissions.md
  faq.md
  api-reference/
    summary.md
    endpoints.md
    cabinet.md
```

После push в `main` GitBook подтянет изменения автоматически (1–3 минуты).

## 4. Кастомный домен (опционально)

1. **Settings** → **Domain**.
2. Можно привязать `docs.noren.digital` — публичная дока **для мерчантов**.
3. Админка (`admin.noren.digital`) и внутренние материалы на GitBook **не выкладываются**.

## 5. Редактирование

| Способ | Когда использовать |
| --- | --- |
| Правки в `gitbook/*.md` в репозитории | Основной workflow, версионирование |
| Редактор GitBook в браузере | Быстрые правки; изменения уйдут в git при export |

{% hint style="warning" %}
Не добавляйте один и тот же `.md` файл дважды в `SUMMARY.md` — у каждой страницы один URL.
{% endhint %}

## 6. Что не класть в этот space

| Не для GitBook `gitbook/` | Где держать |
| --- | --- |
| Админка платформы, RBAC, billing ops | Внутренняя дока / не публикуется |
| Sandbox для команды | `sandbox/` в репозитории |
| CHANGELOG, деплой, ops | `CHANGELOG.md`, `ops/` |

Источник правды merchant-доки — только папка `gitbook/` в репозитории.
