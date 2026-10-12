# Добавление автотестов по задаче

Этот старт подходит разработчику, Claude, Codex, Cursor и другой ИИ. Репозиторий
уже содержит Playwright, общие fixtures и конкретные feature suites. Шаблон ниже —
каркас одного web case; он не добавляет полный QA продукта, native или brand coverage.

## Порядок работы

1. Прочитай AGENTS.md/RULES.md, README.md, docs/WORKFLOW.md, docs/REQUIREMENTS.md,
   актуальный PROGRESS и feature instructions из docs/FEATURE-INDEX.md. Проверь
   `git status --short`: сохрани чужие изменения и исходные тесты.
2. По задаче и diff выдели затронутый пользовательский результат и риски. Запиши
   источник/дату требования, роль, данные и expected result в case. Код подтверждает
   реализацию, но сам по себе не утверждает бизнес-контракт. Неизвестное ожидание —
   BLOCKED, не догадка. Выбери применимые positive/negative, RBAC, mobile и регрессы;
   остальные пробелы перечисли отдельно.
3. Найди существующий case/fixture до создания нового. Общий слой:
   `lib/configuration.js` (origin/roles/sessions), `lib/coordination.js` (lock),
   `tests/fixtures/read-only.js` (GET/HEAD/OPTIONS + failure PNG),
   `tests/fixtures/build-evidence.js` (фильтр сборки), `tests/fixtures/api.js`
   (same-origin XSRF). Контракты лежат в `lib/*contracts.js`; `tests/helpers.js`
   относится к live и не является универсальным login/API adapter.
4. Добавь независимые assertions в подходящий suite. Локаторы/маршруты бери из
   проверенного UI/сети/кода с источником; указывай реальные роль и объект. Для
   чтения используй readOnlyContext; проверь, что приложение работает при запрете
   non-GET, и не обходи блокировку ради PASS. Mutations требуют своих QA данных,
   журнала IDs до изменения, проверенного provision/cleanup и серверной сверки.
   Закрывай context в finally; cleanup failure сохраняет lock и IDs. До первого
   browser request обязателен guard origin + acquire согласованного lock. Для новых
   suites отключи video (`test.use({ video: 'off' })`, в ручных context не задавай
   recordVideo); медиа проверяй синтетической камерой.
5. Выполни syntax, unit и discovery, затем только выбранные cases на разрешённом
   стенде/слоте. Каждый красный: первый сбой/trace → независимый повтор при
   возможности → роль/сессия/сборка/сеть/сервер → классификация (тест, данные,
   окружение, контракт, продукт). Не используй `|| true`, force click, sleep или
   повышение timeout для сокрытия сбоя. Изменение ожидания требует источника.
6. Проверь cleanup по серверу и сохрани фактический результат: repo/commit,
   case/source, build/role/profile, команда, PASS/FAIL/BLOCKED/SKIPPED,
   evidence, cleanup, остаточные риски. SKIPPED и незапущенный case — пробелы.
   Обнови feature index/инструкции при изменении покрытия; не переноси прошлый PASS.

## Инструменты и примеры для переиспользования

«Встроено» означает наличие исходника в этом репозитории, а не сегодняшний
integration PASS. «Локальная наработка» — инструмент уже существует вне общего
репозитория; ниже только план переноса, его нельзя запускать как готовую команду.

| Задача | Встроено / пример в общем репозитории | Локальная наработка и нужная адаптация |
|---|---|---|
| Auth / роли | `lib/configuration.js`, `tests/helpers.js` (live role setup); identity checks в referral/homework fixtures | Отдельный auth/registration suite пока planned migration; подтверждённые login/OTP контракты, независимые fixtures. Setup роли не означает покрытие auth |
| Данные / cleanup | `lib/qa-data.js`, `lib/coordination.js`, `lib/contracts.js` restoreRooms; lifecycle в `tests/homework.spec.js` | Homework provision/cleanup adapter отсутствует; локальные одноразовые create/cleanup scripts требуют параметризации, IDs journal и отдельной проверки восстановления |
| Адаптив / touch | `tests/referral.spec.js` RF-5: center tap + соседний control + 5 hit points, touch/DPR3; профили homework/live | `qa-kit/adaptive.mjs`, `cover2.mjs`: planned migration общего scanner. Убрать fixed host/session/import/IDs, заменить DPR2 на 3, подключить origin/lock и fixture роли; проверять portrait/landscape и overflow |
| Native Android/iOS | Native runner отсутствует; web device mode не заменяет native | `qa-kit/and.sh`, `qa-kit/ios.py`, проектные adb/WDA helpers: planned migration отдельного слоя. Параметризовать device/app, согласовать device lock, снимать оригиналы; background/resume/timer проверять на устройстве |
| Сборка / diff / красный | `tests/fixtures/build-evidence.js`, docs/WORKFLOW.md: first failure → повтор → сервер → классификация | `chunkdiff.sh`, `qa-kit/code_scan.mjs`, guarded read-only scan: planned migration. Сравнивать сохранённые чанки своей функции до/после; совпадение по коду не означает баг или исправление |
| DevTools / perf / security | Интегрированного общего runner нет | `qa-kit/devtools_audit.mjs`, `perf_probe.mjs`, `security_probe.mjs` и guarded/passive адаптации: planned migration. Проверить stop gates и вывод без секретов; стандартный security script содержит активные запросы и не подходит под разрешение «пассивно» |
| Отчёт | Playwright HTML через `npm run report`; факты case/source/build/evidence/cleanup из workflow | `qa-kit/qa_report.py`: planned migration human report. Передавать проверенные DATA + оригиналы; локальные улучшения lightbox/download переносить отдельно с визуальной приёмкой 320/390/1280, light/dark. Playwright report не заменяет человеческий вывод |

Для передачи другой ИИ достаточно репозитория и конкретной задачи: «Прочитай
AGENTS.md и docs/ADDING-TESTS.md; выбери suite по FEATURE-INDEX; дополни tests по
подтверждённому diff/контракту, сохрани исходники, выполни локальные проверки,
integration только при выполненных gates; сообщи результаты и пробелы».
При необходимости передавай выбранные проверенные исходники локального инструмента
отдельно после адаптации. История всех чатов, сырые отчёты и private sessions для
стартового пакета не нужны; доступ к локальным наработкам автоматически не переносится.

## Каркас и один пример

Перед созданием проверь, что нужного suite ещё нет. Команда без зависимостей
создаёт пару `tests/<feature>.spec.js` + `docs/features/<feature>.md`; принимает
только slug вида `course-access` и отказывается перезаписывать любой из файлов.

```bash
npm run new:feature -- course-access
```

Полученный spec не делает browser/network requests и падает с `BLOCKED`, пока
не реализован case. Заполни документ, затем **замени** blocking test полноценным
сценарием с assertions, guard/lock/fixtures/cleanup; удаление throw само по себе
не является реализацией. Исходные шаблоны в `templates/feature/` находятся вне
Playwright testDir и не попадают в discovery.

Пример записи задачи: «роль без доступа открывает собственный QA курс → доступ
отклонён согласно согласованному acceptance criterion». До реализации нужны
ссылка/дата этого критерия, актуальный маршрут и видимый результат отказа,
подтверждённая роль без доступа и источник её серверного состояния. Не копируй
маршруты или локаторы другой фичи. Для роли с доступом добавь отдельный positive
case, если он относится к diff; такой пример не заявляет auth/course coverage.

## Команды

```bash
npm ci
# Только перед разрешённым browser run:
npx playwright install chromium
# Заполняется локально человеком; не перезаписывать существующий .env:
# cp .env.example .env
npm run test:unit
BASE_URL=https://placeholder.test.nn99.ru npm run test:list
node --check tests/course-access.spec.js
BASE_URL=https://placeholder.test.nn99.ru npx playwright test tests/course-access.spec.js --list
# После настройки подтверждённых origin/roles/fixture и согласованного lock:
npx playwright test tests/course-access.spec.js -g 'CASE-1'
```

Placeholder origin служит только локальному discovery. Для integration `.env`
должен содержать подтверждённый test origin; QA_RUN_APPROVED и новый абсолютный
QA_DATA_LOCK_DIR задаются только после согласования слота. Не запускай `npm test`
для одной задачи без причины. Секреты, storageState и сырые trace остаются локально;
исходники публикуются только после отдельной проверки.
