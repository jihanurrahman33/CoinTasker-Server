const { admin } = require("../config/firebase");

/** Verifies the Firebase ID token in `Authorization: Bearer <token>`. */
async function verifyFirebaseToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  try {
    const idToken = header.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.decoded_email = decoded.email;
    next();
  } catch (error) {
    res.status(401).send({ message: "Unauthorized access" });
  }
}

module.exports = { verifyFirebaseToken };
