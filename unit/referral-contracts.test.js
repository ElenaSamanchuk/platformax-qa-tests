const { test } = require('node:test');
const assert = require('node:assert/strict');
const { discount, displayedDiscount, validBonuses } = require('../lib/referral-contracts');
test('discount configuration cannot silently default to zero or account cashback', () => {
  for (const x of [undefined, '', ' ', 'abc', -1, 101]) assert.throws(()=>discount(x));
  assert.equal(discount('12.5'),12.5); assert.equal(discount('0'),0);
});
test('friend discount reads the friend sentence, not other percentages', () => {
  assert.equal(displayedDiscount('Кэшбэк 20%; +30% за друга; Друг вводит промокод при оплате и получает скидку 12,5 %.'),12.5);
  assert.equal(displayedDiscount('Кэшбэк 20%; +30% за друга'),null);
});
test('missing/disabled referral or empty promo cannot pass the prerequisite', () => {
  const good={enabled:true,referral:{code:'DEMO',friendDiscountPercent:12.5}};
  assert.equal(validBonuses(good),true);
  for (const x of [null,{}, {...good,enabled:false},{...good,referral:{...good.referral,code:''}}, {...good,referral:{...good.referral,friendDiscountPercent:'12.5'}}]) assert.equal(validBonuses(x),false);
});
