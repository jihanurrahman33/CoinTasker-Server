require("dotenv").config();

const DEFAULT_MAX_COINS_PER_USD = 30;
const REQUIRED =["MONGODB_URI", "STRIPE_SECRET_KEY", "FB_SERVICE_KEY"];

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
    // Upper bound on coins sold per US dollar; stops a client from asking
    // for far more coins than it pays for.
    maxCoinsPerUsd: Number(env.MAX_COINS_PER_USD) || DEFAULT_MAX_COINS_PER_USD,
  });
}

module.exports = { loadConfig };
