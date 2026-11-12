const express = require("express");
const cors = require("cors");
const config = require("./config");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

function createApp() {
  const app = express();
  app.use(express.json());
  // Only the configured frontend may call the API from a browser; with no
  // SITE_DOMAIN set (local development) any origin is allowed.
  app.use(cors(config.siteDomain ? { origin: config.siteDomain } : undefined));
  app.use(routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
