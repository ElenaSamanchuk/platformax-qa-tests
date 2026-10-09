# Валидация · 09.10.2026

- Node v26.0.0, npm 11.12.1. Pure unit: 5/5 PASS, без браузера/сети.
- node --check: helpers, spec, config — PASS.
- Discovery: 11 tests, выполнено существующим локальным @playwright/test 1.63.0 с placeholder origin; браузер/стенд не запускались. Исходный manifest 1.48.2 расходился с установленной 1.63.0. В этой ревизии закреплена проверенная discovery версия 1.63.0: npm audit для старой 1.48.2 показал GHSA-7mvr-c777-76hp (high, browser download TLS). Live совместимость 1.63.0 НЕ проверена.
- dependency-reviewer/package-risk недоступен: нет Endor CLI и callable MCP. Новые runtime зависимости не устанавливались. Lockfile получен отдельно без lifecycle scripts; это не security approval.
- Integration: NOT RUN. Параллельные QA используют общие учётки/данные; согласованный слот отсутствует. Предыдущий sandbox MachPort отказ не обходили.
- M-5 ready/playable, unpublish/finished и response paths подтверждены по сохранённому коду, но новая реализация очистки и запись не испытаны на стенде. Actual playback НЕ автоматизирован.
- Полный QA приложения, real devices, mobile HTML render: НЕ выполнены этим набором.
- Обновления не внесены в исходный live/autotest и приватный репозиторий. Публикуется отдельная ревизия тестов, не PASS продукта.

Проверить на компьютере коллеги: npm ci, unit, list на pinned версии; затем dedicated test slot + preflight роли/сборка/стоимость, smoke, regression, cleanup и human report. Trace/video могут содержать персональные данные, публично не публиковать автоматически.

Финальный manifest/lock: Playwright 1.63.0; npm audit metadata 0 vulnerabilities (не гарантия отсутствия рисков). Новые npm runtime пакеты и браузеры не устанавливались. Advisory: https://github.com/advisories/GHSA-7mvr-c777-76hp.
