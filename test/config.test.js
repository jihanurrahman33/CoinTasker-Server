const test = require("node:test");
const assert = require("node:assert/strict");
const { loadConfig } = require("../src/config/env");

const validEnv = {
  MONGODB_URI: "mongodb://localhost/test",
  STRIPE_SECRET_KEY: "sk_test_x",
  FB_SERVICE_KEY: "abc",
};

test("loadConfig maps env vars and applies defaults", () => {
  const config = loadConfig(validEnv);
  assert.equal(config.port, 3000);
  assert.equal(config.mongodbUri, validEnv.MONGODB_URI);
  assert.equal(config.siteDomain, "");
});

test("loadConfig honours PORT and SITE_DOMAIN", () => {
  const config = loadConfig({ ...validEnv, PORT: "5000", SITE_DOMAIN: "http://x.test" });
  assert.equal(config.port, 5000);
  assert.equal(config.siteDomain, "http://x.test");
});

test("loadConfig defaults and overrides the coin rate cap", () => {
  assert.equal(loadConfig(validEnv).maxCoinsPerUsd, 30);
  assert.equal(loadConfig({ ...validEnv, MAX_COINS_PER_USD: "12" }).maxCoinsPerUsd, 12);
});

test("loadConfig names every missing required variable", () => {
  assert.throws(
    () => loadConfig({ MONGODB_URI: "x" }),
    /STRIPE_SECRET_KEY, FB_SERVICE_KEY/
  );
});

test("loadConfig result is frozen", () => {
  assert.throws(() => {
    "use strict";
    loadConfig(validEnv).port = 1;
  }, TypeError);
});
