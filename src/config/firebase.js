const admin = require("firebase-admin");

function initFirebase(base64ServiceKey) {
  if (admin.apps.length === 0) {
    const serviceAccount = JSON.parse(
      Buffer.from(base64ServiceKey, "base64").toString("utf8")
    );
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  return admin;
}

module.exports = { initFirebase, admin };
