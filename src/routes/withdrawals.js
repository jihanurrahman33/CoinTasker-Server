const { Router } = require("express");
const { getCollections } = require("../config/db");
const { verifyFirebaseToken } = require("../middleware/auth");
const { verifyAdmin, verifyWorker } = require("../middleware/roles");
const { ROLES, WITHDRAWAL_STATUS } = require("../constants");
const { HttpError } = require("../utils/httpError");
const { parseObjectId } = require("../utils/objectId");
const { isPositiveNumber, omit } = require("../utils/validate");

const router = Router();

const SERVER_OWNED_FIELDS = ["_id", "worker_email", "status", "createdAt"];
const REVIEW_STATUSES = [WITHDRAWAL_STATUS.APPROVED, WITHDRAWAL_STATUS.REJECTED];

router.post("/withdrawals", verifyFirebaseToken, verifyWorker, async (req, res) => {
  const { users, withdrawals } = getCollections();
  const workerEmail = req.decoded_email;
  const { withdrawal_coin } = req.body;

  if (!isPositiveNumber(withdrawal_coin)) {
    throw new HttpError(400, "withdrawal_coin must be a positive number");
  }

  // Atomic check-and-deduct: coins are held until an admin reviews the request.
  const deducted = await users.updateOne(
    { email: workerEmail, coin: { $gte: withdrawal_coin } },
    { $inc: { coin: -withdrawal_coin } }
  );
  if (deducted.modifiedCount !== 1) {
    throw new HttpError(400, "Insufficient coins for withdrawal");
  }

  const withdrawal = {
    ...omit(req.body, SERVER_OWNED_FIELDS),
    worker_email: workerEmail,
    status: WITHDRAWAL_STATUS.PENDING,
    createdAt: new Date(),
  };

  try {
    res.send(await withdrawals.insertOne(withdrawal));
  } catch (error) {
    await users.updateOne({ email: workerEmail }, { $inc: { coin: withdrawal_coin } });
    throw error;
  }
});

// Admins may list everyone's requests; everyone else only sees their own.
router.get("/withdrawals", verifyFirebaseToken, async (req, res) => {
  const { users, withdrawals } = getCollections();
  const { email, status } = req.query;

  const requester = await users.findOne({ email: req.decoded_email });
  const query = {};
  if (requester?.role === ROLES.ADMIN) {
    if (email) query.worker_email = email;
  } else {
    query.worker_email = req.decoded_email;
  }
  if (status) query.status = status;

  res.send(await withdrawals.find(query).toArray());
});

router.patch("/withdrawals/:id", verifyFirebaseToken, verifyAdmin, async (req, res) => {
  const { users, withdrawals } = getCollections();
  const { status } = req.body;
  if (!REVIEW_STATUSES.includes(status)) {
    throw new HttpError(400, "Status must be approved or rejected");
  }

  const filter = { _id: parseObjectId(req.params.id) };
  const withdrawal = await withdrawals.findOne(filter);
  if (!withdrawal) throw new HttpError(404, "Withdrawal not found");

  // Only a pending request can be reviewed, and only once.
  const result = await withdrawals.updateOne(
    { ...filter, status: WITHDRAWAL_STATUS.PENDING },
    { $set: { status } }
  );
  if (result.modifiedCount !== 1) {
    throw new HttpError(409, "Withdrawal has already been reviewed");
  }

  // Coins were held at request time; hand them back when rejected.
  if (status === WITHDRAWAL_STATUS.REJECTED) {
    await users.updateOne(
      { email: withdrawal.worker_email },
      { $inc: { coin: withdrawal.withdrawal_coin } }
    );
  }
  res.send(result);
});

module.exports = router;
