# Домашние задания: запуск для коллег

Модуль `tests/homework.spec.js`, команда `npm run test:homework`. Platforma core: ЛК desktop 1440×900 и mobile web 375×812/390×844, touch/isMobile/DPR3. 15 зарегистрированных сценариев (12 исходных + 3 opt-in HW-4 runner); **integration NOT RUN**, отсутствуют согласованные собственные fixtures и адаптер подготовки/очистки составного урока. Регистрация теста не означает работоспособность локаторов на текущей сборке или PASS продукта.

## Контракт и аудит переноса

Источники требований: задача владельца от сентября–октября 2026 и независимые отчёты ДЗ от 09.10.2026. Сами внутренние отчёты, аккаунты, URLs медиа и персональные данные в публичный репозиторий не включаются. Аудит существующего `kinezio-hw-qa` от 09.10: сохранён смысл чтения live Vue/Inertia props, явного start/submit и выбранного результата. CSS цветов бренда, default account/entity IDs, адрес без `.test`, force-click и публикация review для освобождения общей попытки не переносились. Старый набор остаётся отдельно; его результаты не являются результатами этого модуля.

| Сценарий | Ожидание | Ограничение |
|---|---|---|
| HW-1 составной урок | Настоящий embedded block отображается и открывает информацию именно своего ДЗ; серверные попытки не меняются | Связанное с главой ДЗ, verified selector конкретного блока, не карточка расписания |
| HW-2 информация | Чтение и reload не создают попытку, видна явная кнопка «Начать задание» | Своя свежая нетаймерная fixture без попыток |
| H17 | Через строку истории открывается более ранняя проверенная попытка, включая её ID на сервере и видимый результат, при новой попытке на проверке | Отдельная owned historical fixture |
| HW-3 цепочка | Явный старт → одна in_progress → выбор → подтверждение сдачи → reviewed/result той же попытки → возврат и обновлённый статус блока; новая попытка не возникает | Отдельная новая fixture на каждый профиль, 1 вопрос single-choice, after_submit, без ручной проверки/таймера |

**Не зафиксированы как требования:** доступность задания, прикреплённого только внутри урока без связи с главой; M18 счётчик доработок. Веб не считается эталоном номера попытки. M-CX01 Android «фон → 00:00 → редактируемая форма» требует отдельного native прогона с реальным background/resume и проверкой сервера. Этот web модуль его не закрывает. Для файлов/admin review/rework теперь есть opt-in HW-4 runner с отдельным adapter, описанный ниже; готового adapter и integration результата нет. Изображения, дедлайны и native приложения этим модулем не автоматизированы.

## Подготовка и команды

На точном commit репозитория выполнить `npm ci`, `npm run test:unit`, `npm run test:list`. Затем согласовать отдельный слот общей учётки и данных. `BASE_URL` — только HTTPS origin `*.test.nn99.ru`. Пароли/OTP вводит владелец, тесты используют локальный `HW_STORAGE_STATE`. Не публиковать session/env/manifests/trace/screens с персональными данными.

Переменные: `QA_RUN_APPROVED=1`, `QA_DATA_LOCK_DIR` — путь нового atomically-created lock; `HW_STORAGE_STATE`; `HW_FIXTURE_FILE` для HW-1/2; `HW_HISTORY_FIXTURE_FILE` для H17. Без prerequisites тесты SKIPPED/BLOCKED coverage. Lock требует согласования даже для чтения: GET может иметь серверные побочные эффекты. Для read-only запреты POST/PUT/PATCH/DELETE в браузере не доказывают отсутствие server mutations, поэтому сравниваются свежие серверные props. Таймерные fixtures запрещены: чтение может завершить истёкшую попытку.

Пример **синтетической схемы**, не реальные ID/селекторы и не готовая fixture:

```json
{
  "studentId": 1, "homeworkId": 2, "chapterHomeworkId": 3,
  "title": "QA-AT owned fixture", "source": "approved requirement/date",
  "exclusive": true, "chapterLinked": true,
  "lessonPath": "/lesson/4", "blockSelector": "[data-block-id='5']",
  "openLabel": "Открыть задание", "durationType": "estimated"
}
```

Все значения подтвердить на своём объекте/сборке. H17 дополнительно: `historyAttemptId`, `historyResultText`; выбранная попытка reviewed и не последняя, последняя on_review. Историческую fixture нельзя совмещать со свежей для HW-2.

```sh
npm run test:homework -- -g 'HW-1|HW-2'
npm run test:homework -- -g 'H17'
```

Для изменяющей данные HW-3 дополнительно `HW_LIFECYCLE_APPROVED=1` и `HW_ADAPTER_FILE` — абсолютный путь к **локальному проверенному** CommonJS адаптеру. В репозитории готового adapter для provisioning составного урока нет: текущие источники не подтверждают безопасный переносимый API его создания/удаления. Нельзя подставлять прежние QA других сессий или архивированные объекты.

Адаптер экспортирует async `provision`, `cleanup`, `verifyCleanup`; получает `{browser,baseURL,runId,testInfo}` и на cleanup также `{fixture}`. Он обязан записать локальный журнал IDs и baseline **до** первой mutation, владеть только новыми `QA-AT` объектами, очистить их при частичном provision без возвращённой fixture, восстановить исходную структуру урока/главы и подтвердить сервером отсутствие своей привязки и архивирование/удаление своего ДЗ. `verifyCleanup` возвращает строго `true` после этих сверок; успешный toast/HTTP не заменяет сверку. Возвращённая fixture имеет `title===runId`, обычные поля выше, а также `resultMode:'after_submit'`, `optionText`, `resultText`, `returnLabel`, `completedBlockText`. Это конфигурация собственной auto-graded fixture, не предположение о тексте любого ДЗ.

```sh
npm run test:homework -- -g 'HW-3'
```

Cleanup исполняется в finally, включая неудачный provision. При сбое lock сохраняется и остальные проверки блокируются; не удалять lock другого владельца. До первого live запуска проверить адаптер/журнал и восстановление на своей fixture отдельно. Прогон всех suites по умолчанию не нужен: выбирать область по риску/изменениям.

## Результат в отчёте

Указывать repo + точный commit + ссылку на этот файл, источник контракта, web assets/Inertia component/version, роль, профиль, PASS/FAIL/BLOCKED/SKIPPED, фактические PNG/серверную сверку и cleanup. Данные сборки фильтруются, полные props не сохраняются. Нативные проверки, новые admin iOS и supplemental темы/бренды имеют отдельный статус. Красный locator/schema/config не автоматически баг продукта; сначала классификация первого сбоя и независимый повтор.

## HW-4: opt-in manual PDF → доработка → публикация

`tests/homework-manual.spec.js`: три **web runner** сценария (desktop, 375/390
с touch/DPR3). Это assertions поверх проверенного локального адаптера. Готового
адаптера в репозитории нет, integration **NOT RUN**. Native наблюдения ручного
ответа/PDF и возврата на доработку от 12.10 определили границы сценария, но не
являются PASS этого runner. WDA/adb, таймеры и все виды ДЗ здесь не реализованы.

```sh
npm run test:unit
BASE_URL=https://placeholder.test.nn99.ru npm run test:homework -- --list -g 'HW-4'
# После отдельной проверки adapter и согласования слота:
HW_MANUAL_APPROVED=1 HW_MANUAL_ADAPTER_FILE=/absolute/private/manual-adapter.cjs \
  npm run test:homework -- -g 'HW-4 desktop'
```

Также нужны подтверждённый BASE_URL, QA_RUN_APPROVED=1 и новый абсолютный
QA_DATA_LOCK_DIR из RULES.md. Placeholder используется только для discovery.
Без manual approval/adapter — SKIPPED с причиной BLOCKED coverage, не PASS.
Невалидный configured adapter останавливает тест с BLOCKED.

Адаптер CommonJS экспортирует пять async операций:

| Операция | Ответственность |
|---|---|
| `provision(options)` | Новые QA-AT объекты и контексты ученика/проверяющего; журнал IDs и baseline **до** первой mutation; вернуть fixture |
| `act({...options,fixture,action,...input})` | Проверенные UI/API шаги: openCompound, start, attachSyntheticPDF, submit, teacherReturn, resubmit, teacherPublish |
| `snapshot({...options,fixture,stage,probeId})` | Независимый свежий серверный read, видимые факты web UI и новый оригинальный PNG текущего экрана |
| `cleanup({...options,fixture})` | Закрыть contexts; восстановить только собственные IDs/блок по baseline guard, даже при частичном provision без fixture; чужие изменения не затирать |
| `verifyCleanup({...options,fixture})` | Серверная сверка снятия своей привязки/архива ДЗ/исходного compound; строго true либо failure |

`options`: browser, baseURL, runId, testInfo, profile (width/height/isMobile/hasTouch/DPR),
video:'off'. Адаптер не записывает видео и не использует реальные камеры.
`adapter.validation`: `{approved:true,source:'ссылка/дата проверки адаптера',
capabilities:['manual-web']}` — запись ревью исполнителя, не автоматическое
доказательство безопасности. До provisioning адаптер проверяет origin/роль и
пишет журнал; не использует hardcoded учётки/IDs. Можно переиспользовать общие
configuration/coordination, homework info/state/openBlock и same-origin API fixture.

Fixture содержит обычные поля `fixture()` и дополнительно: runId, origin===baseURL,
title===runId, fresh:true, reviewerId, roleSource, questionType:'text', questionsCount:1,
fileRequired:true, resultMode:'after_review', resultText, journalPath, blockId,
initialBlockText, completedBlockText, blockSource (подтверждённые UI подписи/статусы). Журнал:
runId, origin, ownedIds (homeworkId/chapterHomeworkId), baseline восстановления.
`rework:{mode:'same-attempt'|'new-attempt',source:'подтверждённый контракт'}` задаёт
lifecycle. Номер не предполагается равным индексу и не увеличивается в assertions
по догадке. Нет источника бизнес-логики доработки — BLOCKED.

Нормализованный snapshot, только факты реальных reads:

```js
{
  probeId, capture: `/absolute/private/stage-${probeId}.png`,
  server: {
    origin, studentId, reviewerId, reviewerCanReview: true,
    homeworkId, chapterHomeworkId,
    currentAttemptId: null, // ID только активной in_progress
    attempts: [{id, number, status, feedback, attachments: [{id, mimeType, sha256}]}],
    history: [{id, number, status}] // фактическая история, ID/номер соответствуют attempts
  },
  ui: {
    origin, studentId, homeworkId, chapterHomeworkId, visible: true,
    attemptId, attemptNumber, status, history: [{id, number, status}],
    attachmentIds: [], feedback, resultText,
    compoundBlock: {homeworkId, sourceId: blockId, visible: true, status, text}
  }
}
```

`ui` извлекается из видимого экрана/истории, `server` — отдельным свежим запросом,
не из того же Vue объекта. SHA256 вычисляется по сохранённому собственному PDF
на сервере, а не подставляется из ожидаемого hash. Capture создаётся после запроса
probe; имя PNG содержит текущий уникальный probeId. Runner проверяет PNG header/размер
и mtime с допуском 2 секунды для гранулярности файловой системы, затем прикрепляет к testInfo. Это
проверка наличия доказательства, а не автоматическая визуальная оценка картинки.
Сырые props, sessions и артефакты остаются локальными. `attachSyntheticPDF` получает
также первоначальный синтетический текст; `resubmit` — уточнённый текст и PDF.
При новом attempt сервер вправе клонировать файл с новым media ID: между попытками
сравнивается SHA256, а UI/server IDs — только внутри одной попытки. Вложение старой
попытки проверяется отдельно, без требования одинаковых IDs у двух попыток.

Runner проверяет отсутствие implicit start при открытии compound; одну попытку
после явного start; доставку synthetic PDF с тем же hash; on_review после submit;
needs_info и точный QA комментарий после teacherReturn; resubmit по подтверждённому
same/new-attempt контракту; сохранение старых IDs/номеров/вложений; видимый resultText
проверенной попытки; возврат в compound без новой попытки. На первом открытии
проверяется видимый собственный блок (homeworkId/sourceId, assigned и initialBlockText),
на возврате — тот же блок со статусом reviewed и completedBlockText. История web сверяется
с фактическими server IDs. Native сравнение требует отдельного адаптера/прогона:
эти web assertions не являются готовой автоматизацией Android/iOS.

Красный сначала классифицировать и повторить независимо при возможности.
Cleanup failure сохраняет disk lock и IDs; не превращается в PASS или SKIP.

## HW-scope: общие попытки внутри курса · 28.10.2026

`tests/homework-attempt-scope.spec.js` добавляет два независимых **GET-only** кейса к
набору ДЗ. Источник: Валерия 28.10.2026 подтвердила общие попытки одного ДЗ во всём
курсе; Ксения 20.10.2026 определила независимый старт того же ДЗ в другом курсе.
Первый кейс сравнивает оставшиеся попытки и всю историю между двумя размещениями
одного ДЗ внутри курса. Для обоих размещений он проверяет отсутствие старта при
исчерпанном лимите, нажимает «Просмотреть результаты» и подтверждает общий ID
проверенной попытки свежим серверным ответом. Путь результата сохраняет собственное
размещение и контекст продукта/зачисления; порядок query-параметров несущественен.
Видимые заголовок результата и детализация вопросов подтверждают загрузку экрана.
Второй проверяет пустую историю и доступную попытку в другом
курсе. Оба повторно читают серверное состояние и проверяют, что просмотр не изменил
попытки. Тест ничего не создаёт, не начинает и не сдаёт; видео/trace отключены.

Приватная конфигурация: `HW_SCOPE_FIXTURE_FILE`, `HW_STORAGE_STATE`, подтверждённый
`BASE_URL`, `QA_RUN_APPROVED=1` и новый абсолютный `QA_DATA_LOCK_DIR`. Стенд Kinezio
точечно разрешён origin guard; production Kinezio и похожие домены отклоняются.
Требуются собственные QA-данные, эксклюзивный слот и нетаймерное ДЗ (`duration_type=none`).
Первое размещение должно иметь проверенную попытку и исчерпанный лимит. Не подставлять
данные коллег. В отсутствие конфигурации кейс завершается BLOCKED с ненулевым кодом.

Приватный JSON содержит `studentId`, `title` с префиксом `QA-`, `source`, `owned:true`,
`exclusive:true`, а также `first`, `sameCourse`, `otherCourse`. У каждого размещения
заданы `placementId`, `homeworkId`, `courseId`, `path` с подтверждёнными query-параметрами
продукта/зачисления. ID, пути своего стенда и session в Git не добавлять. При чтении
сервер сам подтверждает HW ID, placement ID, chapter.course_id, роль и тестовую среду.

```sh
node --check tests/homework-attempt-scope.spec.js
node --test unit/homework-attempt-scope.test.js
BASE_URL=https://placeholder.test.nn99.ru npx playwright test tests/homework-attempt-scope.spec.js --list
# После настройки приватной fixture и согласования слота:
npx playwright test tests/homework-attempt-scope.spec.js --output=work/hw-scope-results
```

Живой Chromium desktop прогон 28.10.2026 до исправления: 1 FAIL и 1 PASS за 49 секунд.
В одном курсе второе размещение по-прежнему имеет доступную попытку и пустую историю
при исчерпанном лимите первого (M-3). Другой курс начинает ДЗ независимо, как ожидается.
Повторные чтения подтверждают сохранение серверного состояния; role/environment/HW/course
предусловия пройдены. Точечный unit и discovery двух кейсов PASS.
Точный commit и приватные данные прогона сохраняются в PROGRESS. Эти кейсы не проверяют
переключение периода обучения, сохранение прогресса, новые попытки после исправления,
таймеры или реальные телефоны. Они не заменяют отдельный QA-ретест.

Повторный прогон 28.10.2026 после исправления: исходный набор **2 PASS за 53,5 с**.
Расширенная ревизия того же набора: **2 PASS за 1,5 мин**, exit 0. Кейс одного курса
дополнительно подтвердил отсутствие «Начать задание», реальные переходы к общему
проверенному результату из обоих размещений, его принадлежность студенту и сохранение
лимита/истории после переходов. Контроль другого курса сохранил отдельную доступную
попытку и пустую историю. Учётки, IDs, точные версии стенда и артефакты остаются в
приватном QA-протоколе, не в публичных инструкциях. Во время расширения устранён
дефект сравнения URL: порядок одинаковых query-параметров не меняет контекст.
Ожидания лимита, истории и общего результата сохранены. Никаких start/submit запросов.
