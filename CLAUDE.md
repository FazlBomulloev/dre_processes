# Инструкция для Claude Code

Проект: веб-платформа для двух источников данных Эволет — ВПЦ (предложения
заводов) и RGS (трекер регистрации препаратов). Делается по образцу
PharmDash и потом может войти в него.

## Шаг 0. Сначала изучи PharmDash

Перед любой работой склонируй и изучи https://github.com/FazlBomulloev/pharmadash.
Новый проект повторяет его стек, структуру и стиль кода, чтобы модули
потом можно было перенести в PharmDash без переписывания.

Что разобрать обязательно и кратко пересказать пользователю:

- `backend/services/auth.py`, `permissions.py`, `access.py`, `audit.py`,
  `routers/auth.py`, `routers/users.py`: вход по cookie-сессии, scrypt,
  роли, выдача рынков пользователям через `user_markets`, журнал действий.
- `backend/routers/markets.py`, `services/parsers/*`, `services/rls/*`:
  как загружается Excel, хранятся загрузки и маппинг колонок.
- `backend/database.py`, `models.py`, `config.py`, `main.py`: SQLAlchemy
  async + aiosqlite, миграции на старте, создание первого пользователя.
- `frontend/src/theme.css`, `lib/palette.ts`, `components/layout/*`,
  `components/ui/*`, `components/overview/*`, `components/dashboard/*`,
  `components/rls/*`: тема, шапка, карточки, таблицы, боковые панели,
  мастер загрузки.
- `docker-compose.yml`, `Caddyfile`, `DEPLOY.md`, `.github/workflows`,
  `scripts/deploy.sh`: деплой.

Не копируй вслепую: переиспользуй подходы и компоненты, а доменную
логику PharmDash (BDP, скоринг, аптеки) не тащи.

## Порядок работы

1. Прочитай `README.md`, `docs/PLAN.md`, `docs/DATA_VPC.md`,
   `docs/DATA_RGS.md`, `docs/DESIGN.md`, `docs/DECISIONS.md`.
2. Посмотри дизайн в `design/` (скриншоты в `design/screenshots/`,
   исходники `*.dc.html`, как открыть — в `docs/DESIGN.md`).
3. Перед каждым этапом из `docs/PLAN.md` коротко опиши, что будешь делать,
   и дождись подтверждения пользователя. Код пиши только после «делай».
4. Открытые вопросы из `docs/DECISIONS.md` не решай молча: спроси или
   сделай настройкой.

## Правила кода (от пользователя)

- Python 3.12, FastAPI, SQLAlchemy async; фронт React + TypeScript + Vite +
  Tailwind, как в PharmDash.
- Код чистый, минимум комментариев и докстрингов.
- Все импорты в начале файла.
- Обработка ошибок только конкретными `except`, без голого `except` и
  без `pass`.
- Длина строк Python не больше 79 символов.
- Все логи на русском языке.
- README и прочие .md не создавать без просьбы пользователя.
- Реальные выгрузки ВПЦ приватные: не коммитить их, не отправлять во
  внешние сервисы, в тестах использовать только `examples/`.
