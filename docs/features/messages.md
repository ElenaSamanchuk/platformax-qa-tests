# Messages: мобильная геометрия закрытых диалогов

`tests/messages-geometry.spec.js`, `npm run test:messages`: два целевых Chromium
сценария M-1009-02 на 320×693 / 390×844 с настоящим touch и DPR3. Требование из
подтверждённого ретеста 09/12.10.2026: список закрытых диалогов с собственным длинным
превью помещается в viewport при закрытом меню. ScrollWidth без переполнения не
доказывает отсутствие clipping: проверяются реальные left/right ближайшего section.

## Фактический результат и границы

Исходный regression действительно выполнен 12.10.2026 на `admin-DLlbi8EX.js`:
**0 PASS / 2 FAIL / 0 SKIP**. Предусловия прошли; оба падения — M-1009-02:
right = 565.21875 при viewport 320/390, допустимо ≤321/391. Независимый ручной повтор
Chromium также подтвердил clipping. Это выявленный дефект продукта, не сломанный
тест и не ожидаемый PASS. Assertion не ослаблен, xfail/retries не добавлены.

Переносимая ревизия отдельно выполнена координатором 12.10.2026 в 23:02 Minsk:
**0 PASS / 2 FAIL / 0 SKIP**, оба падения только geometry. На 320px right = 571.859375
(допустимо ≤321), на 390px right = 572.546875 (допустимо ≤391), при
documentScrollWidth 320/390. Session, own fixture, закрытое меню, touch/DPR3 и остальные
предусловия прошли. Тест подтверждает текущий UI clipping; red не заменён xfail.
Локальные syntax/unit/discovery проверены отдельно. Результат относится к проверенной
выкладке, после новой сборки нужен целевой повтор. Локальные JSON/PNG исходного
прогона и private fixture/session в репозиторий не копируются.

Сценарий проверяет закрытый список и геометрию. Создание/отправка сообщений,
закрытие диалогов, realtime, delivery, roles/RBAC, AI, native и другие браузеры
не проверены этим набором. Read-only fixture блокирует non-GET: ошибка штатного
subscription-token POST может быть артефактом ограничения; console/realtime здесь
не оцениваются. Общие screenshots/build evidence остаются локально.

## Подготовка и точная команда

Владелец передаёт отдельную private session и подтверждает **свой существующий**
закрытый диалог с длинным превью (>100 символов видимой строки). Только согласованный
label из собственного QA fixture; чужие диалоги не выбирать. Тест требует ровно одну
совпавшую строку, verified test owner и действительно закрытое меню. Сам тест fixture
не создаёт. Подтверждение origin/session/ownership и согласованный слот обязательны,
даже при чтении. Неполные env/истёкшая сессия/неизвестный UI schema — BLOCKED
precondition, не доказательство исправления M-1009-02.

```sh
npm ci
npm run test:unit
BASE_URL=https://placeholder.test.nn99.ru npm run test:messages -- --list
# Только перед согласованным browser run:
npx playwright install chromium
BASE_URL="$APPROVED_TEST_ORIGIN" \
OWNER_STORAGE_STATE="$PRIVATE_OWNER_STATE" \
MESSAGES_EXPECTED_OWNER_ID="$APPROVED_OWNER_ID" \
MESSAGES_LONG_PREVIEW_NAME="$OWN_CLOSED_DIALOG_LABEL" \
QA_RUN_APPROVED=1 QA_DATA_LOCK_DIR="$NEW_ABSOLUTE_DATA_LOCK" \
npm run test:messages
```

Placeholder служит только discovery. Реальный BASE_URL — подтверждённый HTTPS
`*.test.nn99.ru` origin. OWNER_STORAGE_STATE, ID и label задаются локально; не
коммитить env/state/trace/screenshots. Video/trace выключены. Context закрывается
в finally, собственный кооперативный lock снимается после набора; ничего не
создаётся и не публикуется в диалогах. Чужой lock не удалять.

В отчёте: repo + точный commit + ссылка на эту инструкцию, source/build/date,
роль/profile, фактический PASS/FAIL/BLOCKED, geometry/original PNG и cleanup.
Известный красный остаётся красным до сегодняшнего подтверждённого исправления.

## H-1012-MEDIA / PDF-WEB-1012: полученный PDF

`tests/messages-media.spec.js`, `npm run test:messages:media`: отдельный student
Chromium desktop сценарий. Geometry spec не меняется. Источник — свежие собственные
native PDF и голосовое сообщение от 12.10: сервер сохранил оба вложения, student UI
после повторных чтений не показывал ссылку PDF/аудиоплеер. Реальный исходный PDF
regression **1 FAIL**, `fileLinks=0`; owner/student/dialog/message и server mediaUrl
предусловия прошли. Caption без ссылки не является доступным файлом.

Переносимая PDF ревизия: integration 12.10 — **1 FAIL**, `fileLinks=0`;
owner/student/dialog/message и mediaUrl предусловия прошли. Known defect не xfail. Voice наблюдение не
объявлено выполненным voice автотестом: отдельного voice case пока нет; микрофон,
генерация/скачивание/воспроизведение аудио этим spec не выполняются; browser media
requests дополнительно блокируются.

Нужны отдельные private значения: существующие approved student ID/точное имя,
student thread session ID, ID собственного PDF сообщения, QA marker его caption.
OWNER_STORAGE_STATE/MESSAGES_EXPECTED_OWNER_ID уже описаны выше. Источник caption
и IDs подтверждается владельцем на собственной fixture; чужие сообщения не брать.
Никакие реальные имена/IDs/URLs/session/screenshots в Git не переносятся.

```sh
BASE_URL=https://placeholder.test.nn99.ru npm run test:messages:media -- --list
# После agreed slot и отдельного подтверждения собственного student fixture:
BASE_URL="$APPROVED_TEST_ORIGIN" OWNER_STORAGE_STATE="$PRIVATE_OWNER_STATE" \
MESSAGES_EXPECTED_OWNER_ID="$APPROVED_OWNER_ID" \
MESSAGES_STUDENT_ID="$APPROVED_STUDENT_ID" MESSAGES_STUDENT_NAME="$PRIVATE_STUDENT_NAME" \
MESSAGES_STUDENT_SESSION_ID="$OWN_THREAD_SESSION_ID" \
MESSAGES_PDF_MESSAGE_ID="$OWN_PDF_MESSAGE_ID" MESSAGES_OWN_MARKER="$OWN_QA_CAPTION_MARKER" \
QA_RUN_APPROVED=1 QA_DATA_LOCK_DIR="$NEW_ABSOLUTE_DATA_LOCK" \
npm run test:messages:media
```

Только наблюдавшийся и разрешённый `POST /admin/users/{approvedId}/impersonate`
временно разрешается для переключения session через настоящий UI. Exact URL/method
allowlist снимается в finally сразу после перехода. Все остальные non-GET блокируются;
тест не отправляет/редактирует/удаляет сообщения или медиа. Сначала verified owner,
затем уникальная approved student row и подтверждённый фактический student principal;
другую личность нельзя принять за холодные props. После `/messages` сверяются свой
thread/message ID, caption marker, file type и наличие media URL. Assertions требуют
ссылку на тот же media pathname и её видимость; ссылка не нажимается. URL/caption не
пишутся в facts attachment, PNG остаётся private. Video/trace выключены, contexts и
свой lock закрываются после прогона; восстановление данных не требуется.
