---
hidden: true
---

# Подключение GitBook

Инструкция для команды: как опубликовать эту документацию на [GitBook](https://www.gitbook.com).

## 1. Создать space

1. Войдите на [gitbook.com](https://www.gitbook.com).
2. **Create** → **Documentation** → новый space (например «NorenDigital Merchant API»).

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

## 4. Кастомный домен

1. **Settings** → **Domain**.
2. Добавьте `docs.noren.digital` (CNAME на GitBook).
3. В Cloudflare включите прокси или DNS-only — по инструкции GitBook.

## 5. Редактирование

| Способ | Когда использовать |
| --- | --- |
| Правки в `gitbook/*.md` в репозитории | Основной workflow, версионирование |
| Редактор GitBook в браузере | Быстрые правки; изменения уйдут в git при export |

{% hint style="warning" %}
Не добавляйте один и тот же `.md` файл дважды в `SUMMARY.md` — у каждой страницы один URL.
{% endhint %}

## 6. Связь с docs-сайтом платформы

На платформе документация также доступна на `docs.noren.digital` (React docs-site). GitBook можно использовать как:

* публичную внешнюю документацию для мерчантов;
* или замену self-hosted docs после настройки домена.

При расхождении источник правды для GitBook — папка `gitbook/` в этом репозитории.
