const { getCollections } = require("../config/db");

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

module.exports = {
  requireRole,
  verifyAdmin: requireRole("admin"),
  verifyBuyer: requireRole("buyer"),
  verifyWorker: requireRole("worker"),
};
