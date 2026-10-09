# Feature index и базовый регресс

Общий слой: playwright.config.js, env placeholders, lib/configuration.js (origin/roles/private sessions), lib/qa-data.js (QA titles), tests/fixtures/api.js (same-origin XSRF transport), lib/contracts.js (test origin/recordings/restore), lib/coordination.js (один кооперативный lock), tests/fixtures/read-only.js (блокирование mutations и originalPNG), lib/referral-contracts.js. Feature-specific live role/API helpers остаются в tests/helpers.js; они не являются универсальными клиентами всех API.

| Область | Реализовано | Что ещё нужно |
|---|---|---|
| Live | 14 тестов, см. features/live-rooms.md | Live integration/playback/cleanup этой ревизии |
| Referral core | 24 теста, см. features/referral.md | Live integration, бренды, realdevices, checkout/payout/clipboard |
| Homework core | 12 сценариев (3 read-only + lifecycle runner × 3 профиля), см. [homework](features/homework.md) | Live fixtures/verified provisioning adapter, integration, native, admin, rework/attachments/deadlines |
| Базовый auth | Только setup live roles, проверка идентичности referral | Отдельный approved-contract positive/negative auth с безопасной fixture; актуальность старого login wait/OTP расследуется |
| Registration | Нет, только план | Подтверждённый тестовый mail/OTP и безопасные новые данные, источник требований |
| Product/course | Нет, только план | Роли/тип продукта/свой QA объект/создание и серверная очистка |
| Tariff/purchase | Нет, только план | Конфигурация доступов, approved test payment, no paid action без согласования |

Порядок миграции старых тестов: источник контракта/актуальная версия → локаторы/роль/данные/сеть → первый сбой классифицировать → сохранить бизнес-смысл → изолировать независимые fixtures → убрать подавление exit code → dedicated slot → человеческий отчёт. Serial оставить только для реальной зависимой цепочки. Нельзя переносить 3pass/2fail/16skip исторического CI как покрытие текущего общего набора.

Smoke — ограниченная подборка уже реализованного; это не обещание полного auth/registration/product/course/tariff regression. Неполная конфигурация H-1/adminRF4/eligibleRF5 означает SKIPPED/BLOCKED coverage; release decision требует явного остаточного риска.

## Текущий охват09.10.2026

Главный продукт — Platformax по семи платформенным строкам [PLATFORM-COVERAGE](PLATFORM-COVERAGE.md). Машиночитаемый профиль — qa-scope.json. Автоматические suites реализованы для web core; native automation отсутствует. Бренды — дополнительные и неблокирующие, отдельные admin logins не требуются. Полученные ранее брендовые результаты имеют отдельные границы покрытия и не заменяют проверку ядра.
