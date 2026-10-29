# ПоповичФит: пригодность веб-фикстуры для ретеста приложения

Источник: описание сборки 3.0.0 (16) от 28.10.2026 и фактические Inertia-контракты
тестового веба от 29.10.2026. Набор проверяет серверные предусловия и веб-эталон,
а не нативное приложение, воспроизведение, порог 90%, кольца или доставку сообщений.

Три независимых GET-only кейса:

- PF-FIX1: прямой вход подтверждённого аккаунта, тестовая среда, активный premium
  продукт, ссылка на чат куратора, включённый порог 90%, наличие раздела зарядок
- PF-FIX2 desktop: реферальный экран с персональным промокодом и без переполнения
- PF-FIX2 mobile: тот же экран 390×844, touch/DPR3, без переполнения

Используются общие `readOnlyContext`, `coordination` и `buildEvidence`. Non-GET
браузерные запросы блокируются. `page.request` используется только для свежего
same-origin Inertia GET, потому что auth.user в первом HTML может быть deferred.
Логин, impersonate, загрузка/просмотр медиа, отметки и платежи не выполняются.
Видео/trace отключены; локальные failurePNG могут содержать тестовые данные и
не предназначены для публикации. Свой context и lock закрываются в finally.

Собственный origin guard строже общего: принимает только точный подтверждённый
`https://popovichfit.nn99.ru`, без credentials/порта/пути/query/hash. Общие guards
и allowlist не меняются. Pure unit включает 10 положительных/отрицательных проверок.

## Запуск

Человек предоставляет существующий локальный storageState прямого аккаунта,
его подтверждённый id и premium продукт. Значения секретов в репозиторий не писать.
Согласованный слот требуется до установки QA_RUN_APPROVED; путь lock должен быть
новым абсолютным путём. Не запускать одновременно с изменением той же сессии через
Войти как или с изменением доступов/профиля этой учётки.

```bash
node --check tests/popovichfit-fixture.spec.js
node --test unit/popovichfit-fixture-contracts.test.js
BASE_URL=https://popovichfit.nn99.ru npx playwright test tests/popovichfit-fixture.spec.js --list
BASE_URL=https://popovichfit.nn99.ru \
PF_STORAGE_STATE=/absolute/private/storage-state.json \
PF_EXPECTED_USER_ID=CONFIRMED_ID PF_PRODUCT_ID=CONFIRMED_PREMIUM_PRODUCT_ID \
QA_RUN_APPROVED=1 QA_DATA_LOCK_DIR=/absolute/private/new-lock \
npx playwright test tests/popovichfit-fixture.spec.js --reporter=list --output=/absolute/private/results
```

Неполная конфигурация, другая среда, истёкшая сессия или редирект не становятся PASS.
Exit ненулевой при assertion/окружении. Первый красный надо расследовать по
RULES.md; не ослаблять ожидания для другой учётки или непремиум-продукта.

## Фактическая проверка 29.10.2026

Chromium, прямой аккаунт, isProduction=false, impersonation=null. Первый запуск
3 PASS за 25,0 с; повтор 3 PASS за 20,7 с. После выделения строгого suite-specific guard:
10/10 unit PASS и финальный integration 3 PASS за 24,7 с. Общие dirty исходники других
задач не менялись. Локальные артефакты хранятся вне репозитория в проекте QA.
Это подтверждение веб-фикстуры на app-BooGLhz8.js, не PASS функций приложения 16.

## Офлайн-проверка ответа трекинга

`scripts/check-watch-progress-contract.py` перенесён из текущего ретеста приложения.
Он читает только переданный локальный sanitized log и не обращается к приложению
или серверу. Проверяет стабильную длительность, монотонное покрытие, границы и
соответствие автоматической отметки порогу 90%. `--require-crossing` требует реальное
пересечение порога; незавершённый trace заканчивается exit 1. Это проверка сохранённых
ответов, а не автономный нативный прогон и не доказательство обновления колец.

Обязательное предусловие: исходно непросмотренное видео, без ручного переключения
отметки на всём протяжении trace. Ручная ✓ по актуальному требованию может иметь
`is_watched=true`, `qualified=false` при покрытии ниже 90%; такой trace этим оракулом
проверять нельзя. Не подавлять красный результат для неизвестного исходного состояния.
Логи, ids и ответы сервера остаются приватными; в Git входят только код и синтетические
unit-данные. 8 unit проверяют также регрессию парсера, когда постороннее is_watched
после завершённого response ошибочно перезаписывало прочитанное значение.

```bash
python3 scripts/test-watch-progress-contract.py
python3 scripts/check-watch-progress-contract.py /absolute/private/sanitized.log \
  --workout CONFIRMED_ID --require-crossing --output /absolute/private/result.json
```

29.10: 8/8 unit PASS; replay реального trace из 41 ответа PASS, исходный false и
положительное пересечение порога подтверждены. Преждевременный true, поздний false,
регресс покрытия и незавершённый trace отклоняются синтетическими тестами.
