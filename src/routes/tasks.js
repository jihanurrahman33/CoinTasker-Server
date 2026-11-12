const { Router } = require("express");
const { getCollections } = require("../config/db");
const { verifyFirebaseToken } = require("../middleware/auth");
const { verifyBuyer } = require("../middleware/roles");
const { parseObjectId } = require("../utils/objectId");

const router = Router();

router.post("/tasks", verifyFirebaseToken, verifyBuyer, async (req, res) => {
  const { users, tasks } = getCollections();
  const task = req.body;
  task.createdAt = new Date();

  const buyerEmail = task.buyer_email;
  const buyer = await users.findOne({ email: buyerEmail });
  if (!buyer) {
    return res.status(404).send({ message: "Buyer not found" });
  }
  if (buyer.coin < task.total_payable_amount) {
    return res.status(400).send({ message: "Insufficient coins to create task" });
  }

  await users.updateOne(
    { email: buyerEmail },
    { $set: { coin: buyer.coin - task.total_payable_amount } }
  );
  res.send(await tasks.insertOne(task));
});

router.get("/tasks", verifyFirebaseToken, async (req, res) => {
  const { email } = req.query;
  const query = email ? { buyer_email: email } : {};
  res.send(await getCollections().tasks.find(query).toArray());
});

router.get("/tasks/available", verifyFirebaseToken, async (req, res) => {
  const query = { required_workers: { $gt: 0 } };
  res.send(await getCollections().tasks.find(query).toArray());
});

router.get("/tasks/:id", verifyFirebaseToken, async (req, res) => {
  res.send(
    await getCollections().tasks.findOne({ _id: parseObjectId(req.params.id) })
  );
});

router.patch("/tasks/:id", verifyFirebaseToken, verifyBuyer, async (req, res) => {
  const result = await getCollections().tasks.updateOne(
    { _id: parseObjectId(req.params.id) },
    { $set: req.body }
  );
  res.send(result);
});

router.delete("/tasks/:id", verifyFirebaseToken, async (req, res) => {
  const { users, tasks } = getCollections();
  const filter = { _id: parseObjectId(req.params.id) };

  // Refund the buyer before removing the task
  const task = await tasks.findOne(filter);
  if (task) {
    const buyer = await users.findOne({ email: task.buyer_email });
    if (buyer) {
      await users.updateOne(
        { email: task.buyer_email },
        { $set: { coin: buyer.coin + task.total_payable_amount } }
      );
    }
  }
  res.send(await tasks.deleteOne(filter));
});

module.exports = router;
