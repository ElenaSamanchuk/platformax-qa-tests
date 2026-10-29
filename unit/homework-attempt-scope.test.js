const test = require('node:test');
const assert = require('node:assert/strict');
const {validateBase} = require('../lib/contracts');

test('Kinezio test allowlist is exact and does not admit its production domain or lookalikes', () => {
  assert.equal(validateBase('https://kinezio.nn99.ru'), 'https://kinezio.nn99.ru');
  for (const origin of ['https://lk.kineziofitness.online', 'https://kinezio.nn99.ru.evil.example', 'https://evil.kinezio.nn99.ru', 'http://kinezio.nn99.ru', 'https://kinezio.nn99.ru/admin']) {
    assert.throws(() => validateBase(origin));
  }
});
