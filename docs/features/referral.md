# Рефералка: реализованный набор

Путь: tests/referral.spec.js; команда `npm run test:referral`. Общие origin/lock/read-only fixtures используются совместно с live-набором. Интеграционный прогон этой версии НЕ выполнен.

| ID | Assertion | Источник ожидания | Граница |
|---|---|---|---|
| RF-1 ×5 | Нет copy/share referral link controls в ядре | задача ретеста и независимый QA PROGRESS от09.10.2026; по коду link условен | Только core, не брендовые темы |
| RF-2 ×5 | Реальные переключения табов, selected state, видимый непустой серверный промокод | тот же QA PROGRESS + сохранённый UI contract tablist/tab | Clipboard не проверяется |
| RF-3 ×5 | Скидка другу в тексте = server friendDiscountPercent = согласованное значение | тот же QA PROGRESS, персональные cashback/referral ставки отдельны; источник значения задаёт человек | Не проверяет checkout/денежный эффект, нулевой процент требует решения |
| RF-4 ×5 | Нет referral_link field в core admin/settings | подтверждённый QA PROGRESS09.10.2026 | Требует отдельную админскую сессию; без неё skip, не PASS |
| RF-5 ×4 | Реальный center tap и пять hitpoints, открытие формы вывода | H-2 подтверждён текущим QA на устройствах и device mode | 320/360/375/390, touch/DPR3; нет submit |

REFERRAL_STORAGE_STATE, REFERRAL_EXPECTED_USER_ID — согласованная core сессия; REFERRAL_ADMIN_STORAGE_STATE/EXPECTED_ADMIN_ID — admin fixture. REFERRAL_EXPECTED_DISCOUNT и REFERRAL_DISCOUNT_SOURCE (решение/задача/дата) обязательны для RF-3; не подставлять cashback из аккаунта. Пароли/сессии не вводятся агентом и не публикуются.

RF-5 требует canWithdraw=true и hasPendingWithdrawals=false; иначе coverage BLOCKED/skip. Тест не создаёт данные для достижения eligibility. Read-only fixture блокирует не GET/HEAD/OPTIONS, включая случайный submit. Если легитимный read endpoint требует POST, это несовместимость fixture, исследовать отдельно, не отключать защиту без сверки контракта.

PNG оригинал на ошибке с device scale, JSON пяти hitpoints. Артефакты локальные, могут содержать персональные данные. Real Samsung/iPhone, альбомная, ширины412/768/1024, clipboard, начисления/выплата, бренды и нулевой discount пока не реализованы/не прогонялись этим набором. Отсутствие overflow не доказывает нажимаемость.

Последний статус этой ревизии09.10.2026: syntax/discoveryPASS (Playwright1.63.0); feature integrationNOT RUN. Build продукта для нового прогона не зафиксирован — его необходимо сверить при запуске. См. общий VALIDATION; ссылки отчёта должны указывать конкретный commit, а не подвижный main.

Текущая параметризация: RF-1/2/3 на desktop1440×900 и mobile320/360/375/390; RF-4 на тех же пяти профилях админки; RF-5 на четырёх мобильных профилях. Всего24. Для мобильных профилей isMobile/touch/DPR3. Веб-версия фиксируется в filtered build evidence: имена scripts/component/Inertia version/viewport, без полных props/PII.

## Финальная сверка перед первой сдачей09.10

В сохранённом UI подтверждена подпись «Баланс и история»: исправлен слишком узкий локатор «Баланс». Навигация RF1/RF3 допускает настоящий tab/button по имени; RF2 по-прежнему отдельно требует tab/tablist/aria-selected, ожидание доступности не ослаблено. RF5 использует соседнюю кнопку «Применить к покупке» как реальный контрольный tap с возвратом /bonuses, без заполнения checkout и submit; тест вывода больше не зависит от табовой ARIA.
Текущий независимый QA сообщает регресс табов/ARIA/пояснения скидки на новой сборке. Это продуктовые результаты другого QA-чата, не integrationFAIL public suite. M5 также не закрыт по его current recording/playback evidence. На основании этих регрессов assertions не переводятся в ожидаемый PASS. Собственный новый интеграционный запуск не выполнялся.
