const { HttpError } = require("../utils/httpError");

function notFound(req, res) {
  res.status(404).send({ message: "Route not found" });
}

/**
 * Central error handler. Express 5 forwards rejected async handlers here,
 * so route code can simply throw. Internal details are logged, never sent.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).send({ message: err.message });
  }
  console.error(`${req.method} ${req.originalUrl} failed:`, err);
  res.status(500).send({ message: "Internal server error" });
}

module.exports = { notFound, errorHandler };
