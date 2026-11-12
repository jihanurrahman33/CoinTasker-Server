const { Router } = require("express");
const { getCollections } = require("../config/db");
const { verifyFirebaseToken } = require("../middleware/auth");
const { verifyBuyer } = require("../middleware/roles");
const { ROLES } = require("../constants");
const { HttpError } = require("../utils/httpError");
const { parseObjectId } = require("../utils/objectId");
const { isPositiveInteger, isPositiveNumber, omit } = require("../utils/validate");

const router = Router();

/** Fields a client may never set directly; they drive money or ownership. */
const PROTECTED_TASK_FIELDS = [
  "_id",
  "buyer_email",
  "total_payable_amount",
  "required_workers",
  "payable_amount",
  "createdAt",
];

router.post("/tasks", verifyFirebaseToken, verifyBuyer, async (req, res) => {
  const { users, tasks } = getCollections();
  const { required_workers, payable_amount } = req.body;

  if (!isPositiveInteger(required_workers) || !isPositiveNumber(payable_amount)) {
    throw new HttpError(400, "required_workers and payable_amount must be positive numbers");
  }

  const buyerEmail = req.decoded_email;
  const total = required_workers * payable_amount;

  // Atomic check-and-deduct so concurrent requests cannot overspend.
  const deducted = await users.updateOne(
    { email: buyerEmail, coin: { $gte: total } },
    { $inc: { coin: -total } }
  );
  if (deducted.modifiedCount !== 1) {
    throw new HttpError(400, "Insufficient coins to create task");
  }

  const task = {
    ...omit(req.body, PROTECTED_TASK_FIELDS),
    buyer_email: buyerEmail,
    required_workers,
    payable_amount,
    total_payable_amount: total,
    createdAt: new Date(),
  };

  try {
    res.send(await tasks.insertOne(task));
  } catch (error) {
    await users.updateOne({ email: buyerEmail }, { $inc: { coin: total } });
    throw error;
  }
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
  const { tasks } = getCollections();
  const filter = {
    _id: parseObjectId(req.params.id),
    buyer_email: req.decoded_email,
  };

  const updates = omit(req.body, PROTECTED_TASK_FIELDS);
  if (Object.keys(updates).length === 0) {
    throw new HttpError(400, "No updatable fields provided");
  }

  const result = await tasks.updateOne(filter, { $set: updates });
  if (result.matchedCount === 0) {
    throw new HttpError(404, "Task not found");
  }
  res.send(result);
});

// Owner or admin may delete. Only the unfilled slots are refunded, so a
// buyer cannot reclaim coins already earned by workers.
router.delete("/tasks/:id", verifyFirebaseToken, async (req, res) => {
  const { users, tasks } = getCollections();
  const filter = { _id: parseObjectId(req.params.id) };

  const task = await tasks.findOne(filter);
  if (!task) throw new HttpError(404, "Task not found");

  if (task.buyer_email !== req.decoded_email) {
    const requester = await users.findOne({ email: req.decoded_email });
    if (requester?.role !== ROLES.ADMIN) {
      throw new HttpError(403, "forbidden access");
    }
  }

  // Delete first; only the request that actually removed it issues a refund.
  const result = await tasks.deleteOne(filter);
  if (result.deletedCount === 1) {
    const refund = Math.max(0, task.required_workers) * task.payable_amount;
    if (Number.isFinite(refund) && refund > 0) {
      await users.updateOne(
        { email: task.buyer_email },
        { $inc: { coin: refund } }
      );
    }
  }
  res.send(result);
});

module.exports = router;
