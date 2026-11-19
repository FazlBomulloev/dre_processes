# План проекта

## 1. Цель

Одно приложение для команды экспорта/BD Эволет:

- **ВПЦ · общий** — все предложения заводов по всем рынкам;
- **ВПЦ · рынок** — полный дашборд по одному рынку, для которого ищем
  (первым — Азербайджан, AZ; потом другие страны без доработки кода);
- **RGS** — ход регистрации препаратов по рынкам (первым — AZ; дальше
  любые рынки с тем же форматом трекера).

Данные приходят Excel-файлами, загружаются через интерфейс. Доступ —
по логину, с ролями и правами на модули и рынки.

## 2. Стек и структура (как в PharmDash)

| Слой | Выбор |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2 async, aiosqlite (SQLite WAL), openpyxl, pandas |
| Frontend | React 19, TypeScript, Vite, Tailwind 4, TanStack Table + Virtual, Recharts, lucide-react, react-router |
| Деплой | Docker compose: backend, web (nginx со статикой и прокси `/api`), caddy (HTTPS) |
| CI/CD | GitHub Actions: тесты backend, сборка frontend, деплой по SSH через `scripts/deploy.sh` с бэкапом базы |

Структура репозитория повторяет PharmDash:

```
backend/
  main.py config.py database.py models.py schemas.py
  routers/   auth users audit imports vpc vpc_market rgs exports
  services/  auth permissions access audit
             vpc/  reader.py normalize.py statuses.py prices.py analytics.py
             rgs/  reader.py normalize.py statuses.py analytics.py
  tests/
frontend/src/
  pages/ components/{layout,ui,vpc,market,rgs,admin,users} lib/ hooks/ api/
```

## 3. Вход и права доступа

Берём механику PharmDash без изменений: логин/пароль, scrypt, сессия в
httpOnly-cookie, хеш токена в таблице `user_sessions`, первый владелец
создаётся из `.env` (`ADMIN_USERNAME`, `ADMIN_PASSWORD`), после смены
прав или пароля все сессии пользователя сбрасываются.

### Роли

| Роль | Кто | Права по умолчанию |
|---|---|---|
| `owner` | владелец (Фазлиддин) | всё: пользователи, роли, журнал, удаление загрузок |
| `admin` | руководитель аналитики | пользователи (кроме owner), загрузки ВПЦ и RGS, все рынки |
| `manager` | руководство | только просмотр, все модули и рынки, экспорт Excel |
| `analyst` | аналитики и БДМ | просмотр назначенных модулей и рынков, экспорт, загрузка — если выдана |
| `viewer` | разовый доступ | просмотр назначенных рынков, без экспорта |

### Права (permission-строки, как `PERMISSIONS` в PharmDash)

```
module:vpc        видит ВПЦ · общий
module:vpc_market видит ВПЦ · рынок (рынки — по списку)
module:rgs        видит RGS (рынки — по списку)
upload:vpc        загружает выгрузку ВПЦ
upload:rgs        загружает трекер RGS
export:xlsx       скачивает Excel из таблиц
users:manage      управляет пользователями
audit:read        читает журнал
imports:delete    удаляет загрузки
```

### Доступ к рынкам

Таблица `user_markets(user_id, market_code)`, как в PharmDash. `owner`,
`admin`, `manager` видят все рынки. Остальным рынки выдаются поштучно.
Чужой рынок отвечает 404, как в PharmDash (`market_access`).

Важно для ВПЦ · общий: пользователь с ограниченным списком рынков видит в
общем ВПЦ только строки своих рынков («Страна поиска» ∈ его список).
Фильтр накладывается на сервере, а не на фронте.

Открытый вопрос (`docs/DECISIONS.md`): нужен ли режим «БДМ видит только
свои предложения» по связке пользователь ↔ имя БДМ в выгрузке.

### Журнал

Каждая загрузка, удаление загрузки, вход, смена прав и экспорт пишутся в
`audit_log` (как `services/audit.py` в PharmDash).

## 4. Загрузка данных

### Общая схема

1. Пользователь с правом `upload:*` открывает «Загрузки», выбирает тип
   (ВПЦ или RGS) и, для RGS, рынок.
2. Backend сохраняет файл в `data/uploads/<type>/<id>.xlsx`, читает его,
   нормализует, валидирует и пишет строки в таблицы снимка.
3. Ответ — отчёт: сколько строк, какие колонки не найдены, какие статусы
   не распознаны, сколько дублей. Ошибки — по-русски.
4. Снимок становится текущим только после успешного разбора (атомарно, в
   одной транзакции). Предыдущие снимки хранятся для динамики.

### Модель данных (минимум)

```
imports(id, kind[vpc|rgs], market_code NULL, file_name, rows, status,
        report_json, uploaded_by, uploaded_at, is_current)

vpc_offers(id, import_id, offer_no, generic, form, dose, pack_raw, pack_n,
           maker, maker_country, maker_category, target_country, zone,
           status_raw, stage, state, status_date, deadline, bdm, analyst,
           price_usd, price_agreed, price_our1, price_our2, price_final,
           price_src, currency, forecast_y1, forecast_y2, forecast_y3,
           created_at, updated_at, last_comment, last_comment_date,
           comments, stage_dates_json, extra_json)

rgs_items(id, import_id, market_code, tm, tm_ru, generic, form, dose,
          pack, category, owner, manufacturer, status_code, group_code,
          is_new, task_date, dossier_req, dossier_analysis, submitted,
          plan_submit, plan_ru, exp1_invoice, exp1_paid, exp2_invoice,
          exp2_paid, docs_mask, comment, extra_json)

markets(code, name_ru, enabled_vpc_market, enabled_rgs)
user_markets(user_id, market_code)
```

Все исходные колонки, которые не разобраны в поля, складываются в
`extra_json`, чтобы ничего не терять.

Подробности по колонкам и правилам — `docs/DATA_VPC.md` и
`docs/DATA_RGS.md`.

### Формат RGS ещё не финальный

Читатель RGS делается через маппинг «поле системы ← название колонки»
(как `FieldMapping` в PharmDash) и хранится в настройках рынка. Когда
пользователь пришлёт окончательный формат, меняется маппинг, а не код.

## 5. Экраны

### ВПЦ · общий (дизайн `design/vpc/`)

| Экран | Файл | Суть |
|---|---|---|
| Предложения | `Main.dc.html` | поиск МНН, фильтры, тёмный блок продукта (мин/сред/макс цена, ценовая лестница заводов, полоса состояний), таблица всех предложений |
| Заводы | `Factories.dc.html` | KPI, рейтинг заводов, цена по стране завода, мини-профиль |
| Страны | `Countries.dc.html` | плитки рынков, тепловая карта «страна × этап», откуда приходят предложения |
| Воронка и динамика | `Funnel.dc.html` | итоги периода, воронка с нормативами, причины остановок, помесячная динамика |
| Карточка предложения | `Offer.dc.html` | боковая панель: цена, место по цене, условия, комментарии, этапы с датами |
| Профиль завода | `FactoryProfile.dc.html` | продукты завода против рынка, этапы, лента событий |
| Страна | `Country.dc.html` | итоги страны, этапы, ведущие заводы, зависшие, кто ведёт |
| Список предложений | `Drill.dc.html` | то, что открывается по клику: путь, фильтры-чипы, таблица |

Все клики ведут вглубь: таблица → карточка → профиль завода, плитка
страны → страна → список и т. д. Путь (хлебные крошки) и «Назад»
обязательны. Состояние фильтров хранится в URL.

### ВПЦ · рынок (первым — AZ)

Отдельный раздел с выбором рынка. Это «Страна» из дизайна, развёрнутая до
полного дашборда; все данные — выгрузка ВПЦ с `target_country = AZ`.
Дизайна отдельного экрана нет: собирать из блоков `Country.dc.html`,
`Main.dc.html`, `Funnel.dc.html`. Состав:

1. Тёмный блок рынка: предложений, продуктов (МНН+форма+доза), заводов,
   контрактов, конверсия, зависло; полоса этапов (клик → список).
2. Портфель продуктов рынка: таблица МНН + форма + доза, число заводов,
   мин/сред/макс цена, лучший завод, текущий этап лучшего предложения.
   Клик → тёмный блок продукта с ценовой лестницей, как на «Предложениях».
3. Заводы для рынка: рейтинг, ценовой индекс, до контракта.
4. Воронка рынка с нормативами и «зависло».
5. Причины остановок по рынку.
6. Динамика по месяцам: новые, контракты, остановки.
7. Кто ведёт рынок: БДМ и аналитики, нагрузка и результат.
8. Таблица всех предложений рынка с выгрузкой в Excel.
9. Если для рынка загружен RGS — карточка-ссылка «Регистрация на рынке»
   с тремя цифрами из RGS (в работе, подано, РУ в этом году).

Перед кодом этого раздела Claude Code показывает пользователю макет
(можно HTML в стиле `design/`) и ждёт одобрения.

### RGS (дизайн `design/rgs/`)

| Экран | Файл | Суть |
|---|---|---|
| Обзор | `Main.dc.html` | где мы сейчас, на каком этапе, когда получим РУ (по месяцам, клик → панель), укладываемся ли в план, сроки этапов, что мешает, остановленные |
| Препараты | `Products.dc.html` | вкладки по этапам, поиск, таблица, карточка препарата с датами, документами, комментарием |

Сверху — выбор рынка (пока один AZ). Фильтр по категории (Лекарства,
БАДы, Медизделия) остаётся.

### Служебные экраны

- Вход (как в PharmDash).
- Загрузки: список снимков, кто и когда загрузил, отчёт разбора,
  «сделать текущим», удалить (по праву).
- Пользователи: роли, модули, рынки, сброс пароля.
- Журнал.

## 6. API (черновик)

```
POST /api/auth/login | POST /api/auth/logout | GET /api/auth/me
GET  /api/markets
POST /api/imports/vpc                  multipart xlsx
POST /api/imports/rgs?market=AZ        multipart xlsx
GET  /api/imports  | DELETE /api/imports/{id} | POST /api/imports/{id}/current

GET  /api/vpc/offers?mnn=&form=&dose=&status=&country=&maker=&q=&page=
GET  /api/vpc/product?mnn=&form=&dose=       блок продукта и лестница
GET  /api/vpc/factories | /api/vpc/factories/{maker}
GET  /api/vpc/countries | /api/vpc/countries/{code}
GET  /api/vpc/funnel?period=&country=
GET  /api/vpc/offers/{id}
GET  /api/vpc/market/{code}/overview         раздел «ВПЦ · рынок»

GET  /api/rgs/{market}/overview?cat=
GET  /api/rgs/{market}/months/{yyyy-mm}
GET  /api/rgs/{market}/stops
GET  /api/rgs/{market}/products?stage=&q=
GET  /api/rgs/{market}/products/{id}

GET  /api/export/{screen}.xlsx?...           те же фильтры
```

Расчёты (группы статусов, цены, воронка, медианы) — на сервере в
`services/*/analytics.py`, с юнит-тестами на `examples/`.

## 7. Этапы

| № | Этап | Готово, когда |
|---|---|---|
| 0 | Изучить PharmDash, пересказать, согласовать структуру | пользователь подтвердил |
| 1 | Каркас: backend + frontend + docker, вход, пользователи, роли, рынки, журнал | можно войти, создать пользователя, выдать рынок |
| 2 | Импорт ВПЦ: чтение, нормализация заголовков, статусы, цены, отчёт, снимки | `examples/vpc_export_example.xlsx` грузится без ошибок, тесты зелёные |
| 3 | ВПЦ · общий: «Предложения» + карточка предложения + экспорт | совпадает с дизайном, фильтры в URL |
| 4 | ВПЦ · общий: Заводы, Страны, Воронка, детализация | все клики из дизайна работают |
| 5 | Макет «ВПЦ · рынок» → согласование → реализация для AZ | AZ полностью, другой рынок открывается сменой кода |
| 6 | Импорт RGS через маппинг колонок + RGS Обзор и Препараты для AZ | цифры совпадают с дизайном на `examples/rgs_tracker_example.xlsx` |
| 7 | Права на уровне строк, экспорт, журнал, деплой, CI/CD | выкатка через Actions как в PharmDash |

На каждом этапе: короткий план → подтверждение → код → тесты → показ.
