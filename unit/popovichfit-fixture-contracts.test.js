const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validatePopovichFitBase } = require('../lib/popovichfit-fixture-contracts');
test('PopovichFit exact test origin passes', () => {
  assert.equal(validatePopovichFitBase('https://popovichfit.nn99.ru'), 'https://popovichfit.nn99.ru');
});
for (const value of [
  'http://popovichfit.nn99.ru', 'https://user:password@popovichfit.nn99.ru',
  'https://popovichfit.nn99.ru:1234', 'https://popovichfit.nn99.ru/products/90',
  'https://popovichfit.nn99.ru?x=1', 'https://popovichfit.nn99.ru#fragment',
  'https://lk.popovichfit.ru', 'https://app.test.nn99.ru', 'https://popovichfit.nn99.ru.evil.example',
]) test('Reject unsupported origin: ' + value, () => assert.throws(() => validatePopovichFitBase(value), /BLOCKED/));
