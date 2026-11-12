const { Router } = require("express");
const { getCollections } = require("../config/db");
const { verifyFirebaseToken } = require("../middleware/auth");
const { verifyAdmin, verifyWorker } = require("../middleware/roles");
const { parseObjectId } = require("../utils/objectId");

const router = Router();

router.post("/withdrawals", verifyFirebaseToken, verifyWorker, async (req, res) => {
  const { users, withdrawals } = getCollections();
  const withdrawal = req.body;
  withdrawal.createdAt = new Date();
  withdrawal.status = "pending";

  const workerEmail = withdrawal.worker_email;
  const worker = await users.findOne({ email: workerEmail });
  if (!worker) {
    return res.status(404).send({ message: "Worker not found" });
  }
  if (worker.coin < withdrawal.withdrawal_coin) {
    return res.status(400).send({ message: "Insufficient coins for withdrawal" });
  }

  await users.updateOne(
    { email: workerEmail },
    { $set: { coin: worker.coin - withdrawal.withdrawal_coin } }
  );
  res.send(await withdrawals.insertOne(withdrawal));
});

router.get("/withdrawals", verifyFirebaseToken, async (req, res) => {
  const { email, status } = req.query;
  const query = email ? { worker_email: email } : {};
  if (status) query.status = status;
  res.send(await getCollections().withdrawals.find(query).toArray());
});

router.patch("/withdrawals/:id", verifyFirebaseToken, verifyAdmin, async (req, res) => {
  const result = await getCollections().withdrawals.updateOne(
    { _id: parseObjectId(req.params.id) },
    { $set: { status: req.body.status } }
  );
  res.send(result);
});

module.exports = router;
