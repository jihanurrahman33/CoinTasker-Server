#!/usr/bin/env node
/**
 * Prints a Firebase service-account JSON file as Base64, ready to paste into
 * the FB_SERVICE_KEY environment variable.
 *
 * Usage: node scripts/encode-firebase-key.js <path-to-service-account.json>
 */
const fs = require("fs");

const keyPath = process.argv[2];
if (!keyPath) {
  console.error(
    "Usage: node scripts/encode-firebase-key.js <service-account.json>"
  );
  process.exit(1);
}

console.log(Buffer.from(fs.readFileSync(keyPath, "utf8")).toString("base64"));
