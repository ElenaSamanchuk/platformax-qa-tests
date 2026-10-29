// Referral display contracts; independent of account cashback/bonus rates.
function discount(value) {
  if (value == null || String(value).trim() === '') throw new Error('Set REFERRAL_EXPECTED_DISCOUNT from an approved requirement');
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error('Discount must be 0..100');
  return n;
}
function displayedDiscount(text) {
  const match = text.match(/Друг вводит промокод при оплате и получает скидку\s+(\d+(?:[.,]\d+)?)\s*%/u);
  return match ? Number(match[1].replace(',', '.')) : null;
}
function validBonuses(value) {
  return value != null && value.enabled === true && value.referral != null &&
    typeof value.referral.code === 'string' && value.referral.code.trim().length > 0 &&
    Number.isFinite(value.referral.friendDiscountPercent);
}
module.exports = { discount, displayedDiscount, validBonuses };
