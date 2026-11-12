const { Router } = require("express");
const { admin } = require("../config/firebase");
const { getCollections } = require("../config/db");
const { verifyFirebaseToken } = require("../middleware/auth");
const { verifyAdmin, requireSelfOrAdmin } = require("../middleware/roles");
const { ROLES, SELF_ASSIGNABLE_ROLES, SIGNUP_BONUS_COINS } = require("../constants");
const { HttpError } = require("../utils/httpError");
const { parseObjectId } = require("../utils/objectId");

const router = Router();
const selfOrAdmin = requireSelfOrAdmin((req) => req.params.email);

const sendUserByEmail = async (req, res) => {
  res.send(await getCollections().users.findOne({ email: req.params.email }));
};

router.get("/users", verifyFirebaseToken, verifyAdmin, async (req, res) => {
  res.send(await getCollections().users.find().toArray());
});

router.get("/users/:email", verifyFirebaseToken, selfOrAdmin, sendUserByEmail);
router.get("/users/:email/role", verifyFirebaseToken, selfOrAdmin, sendUserByEmail);
router.get("/users/:email/coin", verifyFirebaseToken, selfOrAdmin, sendUserByEmail);

router.patch(
  "/users/role/:id",
  verifyFirebaseToken,
  verifyAdmin,
  async (req, res) => {
    const { role } = req.body;
    if (!Object.values(ROLES).includes(role)) {
      throw new HttpError(400, "Invalid role");
    }
    const result = await getCollections().users.updateOne(
      { _id: parseObjectId(req.params.id) },
      { $set: { role } }
    );
    res.send(result);
  }
);

// Top 6 workers by coins (public leaderboard)
router.get("/workers/top", async (req, res) => {
  const workers = await getCollections()
    .users.find({ role: ROLES.WORKER }, { sort: { coin: -1 }, limit: 6 })
    .toArray();
  res.send(workers);
});

// Registration is public, so privileged fields are never taken from the body.
router.post("/users", async (req, res) => {
  const { users } = getCollections();
  const { _id, coin, task_completed, ...profile } = req.body;

  if (typeof profile.email !== "string" || !profile.email) {
    throw new HttpError(400, "Email is required");
  }
  if (!SELF_ASSIGNABLE_ROLES.includes(profile.role)) {
    throw new HttpError(400, "Role must be buyer or worker");
  }

  const existingUser = await users.findOne({ email: profile.email });
  if (existingUser) {
    return res.send({ message: "User already exists" });
  }

  const user = {
    ...profile,
    coin: SIGNUP_BONUS_COINS[profile.role],
    createdAt: new Date(),
  };
  if (profile.role === ROLES.WORKER) user.task_completed = 0;

  res.send(await users.insertOne(user));
});

router.delete(
  "/users/:id",
  verifyFirebaseToken,
  verifyAdmin,
  async (req, res) => {
    const { users, tasks, submissions } = getCollections();
    const filter = { _id: parseObjectId(req.params.id) };

    const dbUser = await users.findOne(filter);
    if (!dbUser) throw new HttpError(404, "User not found");

    if (dbUser.email) {
      try {
        const firebaseUser = await admin.auth().getUserByEmail(dbUser.email);
        await admin.auth().deleteUser(firebaseUser.uid);
      } catch (error) {
        // An account already gone from Firebase must not block cleanup.
        if (error.code !== "auth/user-not-found") throw error;
      }
    }

    if (dbUser.role === ROLES.BUYER) {
      await tasks.deleteMany({ buyer_email: dbUser.email });
      await submissions.deleteMany({ buyer_email: dbUser.email });
    } else if (dbUser.role === ROLES.WORKER) {
      await submissions.deleteMany({ worker_email: dbUser.email });
    }

    res.send(await users.deleteOne(filter));
  }
);

module.exports = router;
