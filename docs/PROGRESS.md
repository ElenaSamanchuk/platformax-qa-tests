# Технический статус · 09.10.2026

Ревизия тестов: усилены запись, очистка, test-origin guard, data coordination gate и error classification. Unit 5/5; syntax PASS; discovery 11 на закреплённом Playwright 1.63.0. npm audit metadata 0 известных уязвимостей. Runtime installation на чистом компьютере, integration, actual playback и server cleanup этой ревизии не проверены.

Следующий шаг: npm ci → unit/list → подтверждённая конфигурация ролей/сессии/сборки и слот данных → smoke/target regression → cleanup/server verification → человеческий QA-отчёт. Не запускать запись, пока не подтверждён включённый объём сервиса.

## Общий набор + referral09.10

Единый framework: общий origin/lock, read-only context/failurePNG, feature contracts. Добавлены RF-1..5:8 сценариев, отдельные команды live/referral и общий feature smoke. Unit9/9; discovery19; syntaxPASS. IntegrationNOT RUN. Следующий шаг: согласованный fixture slot +source discount → selective feature launch → actual proof → update human report; базовые auth/registration/product/course/tariff только план.

Текущий профиль уточнён09.10: ядро и четыре приоритетных бренда в qa-scope.json; автоматический brand traversal отсутствует. Продуктовые посещения этой ревизией не выполнялись.

## Platformax-first ·09.10.2026

Профиль актуализирован: основной Platformax admin/LKdesktop/mobile +studentAndroid/iOS +newAdminiOS. Бренды — supplemental/nonblocking. Автоматизация расширена:14live (11desktop +3hostmobile-lobby),24referral (15coretabs/promo/discount +5adminfield +4withdrawal touch). Новый общий слой filtered build evidence, без полных props/secrets. Discovery38, smoke6; unit9/9 и syntaxPASS. IntegrationNOT RUN: liveQA использует общую учётку/свою активную запись; не перехватывать. Native suites отсутствуют, N/A по одному экрану запрещён. Стоимость записи согласована в текущей задаче, прежний costblocker снят; HTMLblocker снят координатором, visual validation остаётся отдельным фактическим шагом.

Финальная сверка первой сдачи09.10: исправлен локатор Balance label и зависимость withdrawal control от tabARIA; требованияRF2/RF3 сохранены. Новый релизный регресс другого QA-чата отделён от собственной syntax/unit/discovery валидации. Scope index очищен от прежнего основного брендового акцента. IntegrationNOT RUN; first handoff не ждёт фиксов продукта.
