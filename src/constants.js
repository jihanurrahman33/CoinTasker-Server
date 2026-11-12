const ROLES = Object.freeze({
  ADMIN: "admin",
  BUYER: "buyer",
  WORKER: "worker",
});

/** Roles a person may pick for themselves when registering. */
const SELF_ASSIGNABLE_ROLES = Object.freeze([ROLES.BUYER, ROLES.WORKER]);

const SUBMISSION_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
});

const WITHDRAWAL_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
});

const SIGNUP_BONUS_COINS = Object.freeze({
  [ROLES.BUYER]: 50,
  [ROLES.WORKER]: 10,
});

module.exports = {
  ROLES,
  SELF_ASSIGNABLE_ROLES,
  SUBMISSION_STATUS,
  WITHDRAWAL_STATUS,
  SIGNUP_BONUS_COINS,
};
