# Personal Meetings: наличие поставки ядра PlatformaX

Источник: задача Medvediva и ответ Ксении от 22.10.2026: настоящий цикл покупки, записи, занятия и списания должен входить в поставку. Маршруты и Inertia-компоненты подтверждены сборкой admin-sHUL8IDw от 22.10 и текущей core-сборкой admin-DmFm-Lbr от 23.10. Ожидания менять только после подтверждённого переноса команды.

## Что проверяется

В tests/personal-meetings.spec.js три независимых сценария:

1. ADMIN: GET /admin/service-sessions должен вернуть HTTP 200, тот же origin и URL, компонент Admin/ServiceSessions/ServiceSessionsView, подтверждённого пользователя и isProduction=false.
2. STUDENT: те же проверки для /service-sessions и компонента ServiceSessions/StudentSessionsPage.
3. Публичная поставка: manifest обязан содержать оба компонента и Admin/Services/ServiceEditPage; каждый соответствующий JavaScript должен возвращаться напрямую с HTTP 200 и типом JavaScript.

HTTP 200 страницы входа или ошибки не считается PASS. Нет файла сессии, подтверждённого ID или действующего входа — явный BLOCKED с ненулевым exit code. Пропуск не подменяет результат. Подтверждённый на core контракт: initial HTML иногда содержит auth.user=null; дополнительный GET с X-Inertia:true и актуальным X-Inertia-Version возвращает JSON shared props с настоящей identity. Это строгое дополнительное чтение, проверка пользователя не ослаблена.

## Безопасный запуск

Используются общие configuration/validateBase, coordination lock и readOnlyContext. Вход, выдача прав, impersonation и серверные изменения не выполняются. Видео, trace и screenshots выключены, сырые props и cookies не записываются. Lock снимается в finally. Перед integration нужен согласованный слот.

Переменные:

- BASE_URL: подтверждённый core origin, например https://school.test.nn99.ru
- PM_ADMIN_STORAGE_STATE и PM_ADMIN_EXPECTED_USER_ID
- PM_STUDENT_STORAGE_STATE и PM_STUDENT_EXPECTED_USER_ID
- QA_RUN_APPROVED=1 и QA_DATA_LOCK_DIR: новый абсолютный путь lock

Пути к приватным states задаются локально. Их содержимое в репозиторий не включается. Публичный case не требует state.

Локальная проверка: node --check tests/personal-meetings.spec.js; BASE_URL=https://placeholder.test.nn99.ru npx playwright test tests/personal-meetings.spec.js --list.

Integration: npx playwright test tests/personal-meetings.spec.js -g 'PM deployment ADMIN' либо -g 'PM frontend deployment' с переменными выше. STUDENT запускать отдельно, когда подтверждены его state и ID. Placeholder используется только для discovery, не для integration.

## Фактическая валидация 23.10.2026

- Syntax: PASS
- Discovery: три сценария
- Негативный запуск двух authenticated cases с пустыми PM states: два BLOCKED/FAIL, exit 1, без запросов на стенд. Это проверка предохранителя теста, не продуктовый FAIL
- Публичные core assets: PASS, 2.8 секунды
- ADMIN core: PASS, 6.2 секунды, owner 31, is_admin=true, isProduction=false, HTTP 200 и точный компонент
- STUDENT authenticated: NOT RUN, приватная сессия не предоставлена

Использована существующая приватная сессия проекта Live без копирования cookies. Общие helpers и origin guard не изменены, чужие modified/untracked сохранены. Baseline репозитория 7be6eba; root review завершён. Повторный совместный запуск двух выбранных сценариев дал 2 PASS за 7,4 секунды. Функциональный проход тренировки проверен отдельно вручную и не приписывается этому suite.

## Два отдельных контура

Suite направлен на ПЛАТФОРМУ. Medvediva проверяется отдельно. В текущем shared guard medvediva.nn99.ru отсутствует в allowlist; guard не менялся. На этом бренде сборка admin-DFKXI0-Z не содержит компонентов персональных встреч, а core admin-DmFm-Lbr их содержит. Недоступность бренда не означает отказ ядра, успех ядра не принимает брендовый ЛК и правила потоков.

Это проверка наличия поставки. Покупка, настоящее видео, списание, роли ограниченного тренера, мобильный веб и приложения требуют отдельного функционального QA. Отчёты PlatformaX и Medvediva ведутся отдельно, как 21.10.
