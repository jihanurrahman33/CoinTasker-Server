const { Router } = require("express");
const { admin } = require("../config/firebase");
const { getCollections } = require("../config/db");
const { verifyFirebaseToken } = require("../middleware/auth");
const { verifyAdmin } = require("../middleware/roles");
const { parseObjectId } = require("../utils/objectId");

const router = Router();

router.get("/users", verifyFirebaseToken, async (req, res) => {
  res.send(await getCollections().users.find().toArray());
});

router.get("/users/:email", verifyFirebaseToken, async (req, res) => {
  res.send(await getCollections().users.findOne({ email: req.params.email }));
});

router.get("/users/:email/role", verifyFirebaseToken, async (req, res) => {
  res.send(await getCollections().users.findOne({ email: req.params.email }));
});

router.get("/users/:email/coin", verifyFirebaseToken, async (req, res) => {
  res.send(await getCollections().users.findOne({ email: req.params.email }));
});

router.patch(
  "/users/role/:id",
  verifyFirebaseToken,
  verifyAdmin,
  async (req, res) => {
    const result = await getCollections().users.updateOne(
      { _id: parseObjectId(req.params.id) },
      { $set: { role: req.body.role } }
    );
    res.send(result);
  }
);

// Top 6 workers by coins (public leaderboard)
router.get("/workers/top", async (req, res) => {
  const workers = await getCollections()
    .users.find({ role: "worker" }, { sort: { coin: -1 }, limit: 6 })
    .toArray();
  res.send(workers);
});

router.post("/users", async (req, res) => {
  const { users } = getCollections();
  const user = req.body;
  const existingUser = await users.findOne({ email: user.email });
  if (existingUser) {
    return res.send({ message: "User already exists" });
  }

  if (user.role === "buyer") {
    user.coin = 50;
  } else if (user.role === "worker") {
    user.task_completed = 0;
    user.coin = 10;
  }
  user.createdAt = new Date();

  res.send(await users.insertOne(user));
});

router.delete(
  "/users/:id",
  verifyFirebaseToken,
  verifyAdmin,
  async (req, res) => {
    const { users, tasks, submissions } = getCollections();
    const filter = { _id: parseObjectId(req.params.id) };

    try {
      const dbUser = await users.findOne(filter);

      if (dbUser?.email) {
        const firebaseUser = await admin.auth().getUserByEmail(dbUser.email);
        await admin.auth().deleteUser(firebaseUser.uid);
      }

      if (dbUser.role === "buyer") {
        await tasks.deleteMany({ buyer_email: dbUser.email });
        await submissions.deleteMany({ buyer_email: dbUser.email });
      } else if (dbUser.role === "worker") {
        await submissions.deleteMany({ worker_email: dbUser.email });
      }

      res.send(await users.deleteOne(filter));
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).send({ success: false, message: error.message });
    }
  }
);

module.exports = router;
