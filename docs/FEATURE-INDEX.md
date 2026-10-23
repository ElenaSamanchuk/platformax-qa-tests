# Feature index и базовый регресс

Общий слой: playwright.config.js, env placeholders, lib/configuration.js (origin/roles/private sessions), lib/qa-data.js (QA titles), tests/fixtures/api.js (same-origin XSRF transport), lib/contracts.js (test origin/recordings/restore), lib/coordination.js (один кооперативный lock), tests/fixtures/read-only.js (блокирование mutations и originalPNG), lib/referral-contracts.js. Feature-specific live role/API helpers остаются в tests/helpers.js; они не являются универсальными клиентами всех API.

| Область | Реализовано | Что ещё нужно |
|---|---|---|
| Live | 14 тестов, см. features/live-rooms.md | Live integration/playback/cleanup этой ревизии |
| Referral core | 24 теста, см. features/referral.md | Live integration, бренды, realdevices, checkout/payout/clipboard |
| Homework core | 15 сценариев (12 прежних + 3 opt-in manual/rework runner), см. [homework](features/homework.md) | Live fixtures/verified provisioning adapter, integration, native, admin, rework/attachments/deadlines |
| Messages | 2 Chromium mobile geometry cases; [messages](features/messages.md) | Исходный и переносимый integration 12.10 (23:02 Minsk): geometry FAIL×2, предусловия PASS; lifecycle/realtime/native отдельно |
| Messages PDF student | 1 received-file-link case; [media](features/messages.md#h-1012-media--pdf-web-1012-полученный-pdf) | Исходный 1 FAIL (ссылка отсутствует), переносимый integration 12.10: 1 FAIL, fileLinks=0; voice automation отсутствует |
| Admin AI | [Контракт accuracy/latency/usage](features/admin-ai.md), suite не реализован | Verified provider/inputs/oracles/roles/usage schema + целевой integration |
| Базовый auth | Только setup live roles, проверка идентичности referral | Отдельный approved-contract positive/negative auth с безопасной fixture; актуальность старого login wait/OTP расследуется |
| Registration | Нет, только план | Подтверждённый тестовый mail/OTP и безопасные новые данные, источник требований |
| Product/course | Нет, только план | Роли/тип продукта/свой QA объект/создание и серверная очистка |
| Tariff/purchase | Нет, только план | Конфигурация доступов, approved test payment, no paid action без согласования |

Порядок миграции старых тестов: источник контракта/актуальная версия → локаторы/роль/данные/сеть → первый сбой классифицировать → сохранить бизнес-смысл → изолировать независимые fixtures → убрать подавление exit code → dedicated slot → человеческий отчёт. Serial оставить только для реальной зависимой цепочки. Нельзя переносить 3pass/2fail/16skip исторического CI как покрытие текущего общего набора.

Smoke — ограниченная подборка уже реализованного; это не обещание полного auth/registration/product/course/tariff regression. Неполная конфигурация H-1/adminRF4/eligibleRF5 означает SKIPPED/BLOCKED coverage; release decision требует явного остаточного риска.

## Текущий охват09.10.2026

Главный продукт — Platformax по семи платформенным строкам [PLATFORM-COVERAGE](PLATFORM-COVERAGE.md). Машиночитаемый профиль — qa-scope.json. Автоматические suites реализованы для web core; native automation отсутствует. Бренды — дополнительные и неблокирующие, отдельные admin logins не требуются. Полученные ранее брендовые результаты имеют отдельные границы покрытия и не заменяют проверку ядра.

## Personal Meetings: наличие поставки · 23.10.2026

В [tests/personal-meetings.spec.js](../tests/personal-meetings.spec.js) три независимые проверки: административный раздел, кабинет студента и опубликованные JavaScript-компоненты. [Инструкции и границы](features/personal-meetings.md). HTTP 404, страница входа и неверный компонент не считаются успешным результатом.

Ядро PlatformaX: два выбранных сценария (администратор и компоненты) пройдены вместе за 7,4 секунды. Владелец и тестовый режим подтверждены. Автоматическая проверка кабинета студента не запускалась без отдельной приватной сессии. Это проверка наличия поставки, а не полного цикла тренировок и не приёмка Medvediva.
