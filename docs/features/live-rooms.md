# Live-комнаты: реализованный набор

Путь: tests/live-rooms.spec.js; `npm run test:live`. 11 сценариев исходного целевого регресса: медиаконфигурация, старт, настройки, модератор, запись, вкладки/presence, постоянность, продуктовый доступ, staff403, вход/пароль, departure.

Общие origin validation, coordination lock и pure contracts. Mutating suite создаёт только собственные QA-AT комнаты; finish+unpublish+server verify обязателен. Зависимая role setup не является универсальным auth smoke. H-1 и staff могут skip при неполной конфигурации: не PASS доступа.

Границы: integration этой ревизии NOT RUN; actual audio/video playback и cleanup live не подтверждены. M-5 проверяет три server ready/playable и текущие start/stop responses, не звук/контент. Presence90с требует утверждённого SLA. [Requirements](../REQUIREMENTS.md), [validation](../VALIDATION.md).

Последний статус этой ревизии09.10.2026: syntax/discoveryPASS (Playwright1.63.0); feature integrationNOT RUN. Build продукта для нового прогона не зафиксирован — его необходимо сверить при запуске. См. общий VALIDATION; ссылки отчёта должны указывать конкретный commit, а не подвижный main.
