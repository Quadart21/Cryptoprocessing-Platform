# SDK для мерчантов

Два клиента Merchant API Noren Digital. Оба без сторонних зависимостей: создание счёта, статус, синхронизация, приём недоплаты, курсы, баланс, транзакции и проверка `X-Merset-Signature`.

| Язык | Каталог | Имя пакета |
| --- | --- | --- |
| Python 3.9+ | [python/](python/) | `noren-merchant` |
| Node.js 18+ | [node/](node/) | `noren-merchant` |

На PyPI и npm пакеты пока не выложены. Ставятся из каталога:

```bash
pip install ./sdks/python
npm install ./sdks/node
```

Каждый каталог можно скопировать в отдельный репозиторий и опубликовать как есть. PHP-клиент для CMS по-прежнему в `integrations/shared/php/`.
