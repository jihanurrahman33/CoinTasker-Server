const { getCollections } = require("../config/db");
const { ROLES } = require("../constants");

/** Builds a middleware that only lets users holding `role` through. */
function requireRole(role) {
  return async (req, res, next) => {
    const account = await getCollections().users.findOne({
      email: req.decoded_email,
    });
    if (account && account.role === role) {
      req.user = account;
      return next();
    }
    res.status(403).send({ message: "forbidden access" });
  };
}

/**
 * Allows the account owner or an admin. `getEmail(req)` returns the email
 * the request is asking about.
 */
function requireSelfOrAdmin(getEmail) {
  return async (req, res, next) => {
    if (getEmail(req) === req.decoded_email) return next();
    const account = await getCollections().users.findOne({
      email: req.decoded_email,
    });
    if (account && account.role === ROLES.ADMIN) return next();
    res.status(403).send({ message: "forbidden access" });
  };
}

module.exports = {
  requireRole,
  requireSelfOrAdmin,
  verifyAdmin: requireRole(ROLES.ADMIN),
  verifyBuyer: requireRole(ROLES.BUYER),
  verifyWorker: requireRole(ROLES.WORKER),
};
