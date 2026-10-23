const { validateBase } = require('./contracts');
function configuration(env = process.env) {
  return {
    baseURL: validateBase(env.BASE_URL),
    scope: require('../qa-scope.json'),
    roles: {
      owner: { email: env.OWNER_EMAIL, password: env.OWNER_PASSWORD },
      studentA: { email: env.STUDENT_A_EMAIL, password: env.STUDENT_A_PASSWORD },
      studentB: { email: env.STUDENT_B_EMAIL, password: env.STUDENT_B_PASSWORD },
      staffView: { email: env.STAFF_VIEW_EMAIL, password: env.STAFF_VIEW_PASSWORD },
    },
    sessions: {
      owner: env.OWNER_STORAGE_STATE,
      referral: { state: env.REFERRAL_STORAGE_STATE, expectedId: env.REFERRAL_EXPECTED_USER_ID },
      referralAdmin: { state: env.REFERRAL_ADMIN_STORAGE_STATE, expectedId: env.REFERRAL_EXPECTED_ADMIN_ID },
    },
  };
}
module.exports = { configuration };
