require("dotenv").config();

const REQUIRED = ["MONGODB_URI", "STRIPE_SECRET_KEY", "FB_SERVICE_KEY"];

/**
 * Fails fast at startup when a required secret is missing, instead of
 * crashing later with an obscure error on the first request.
 */
function loadConfig(env = process.env) {
  const missing = REQUIRED.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return Object.freeze({
    port: Number(env.PORT) || 3000,
    mongodbUri: env.MONGODB_URI,
    stripeSecretKey: env.STRIPE_SECRET_KEY,
    firebaseServiceKey: env.FB_SERVICE_KEY,
    siteDomain: env.SITE_DOMAIN || "",
  });
}

module.exports = { loadConfig };
