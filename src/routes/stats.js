const { Router } = require("express");
const { getCollections } = require("../config/db");
const { verifyFirebaseToken } = require("../middleware/auth");
const { verifyAdmin, verifyBuyer, verifyWorker } = require("../middleware/roles");

const router = Router();

const sumOf = (field) => ({ $group: { _id: null, total: { $sum: field } } });

router.get("/worker/stats", verifyFirebaseToken, verifyWorker, async (req, res) => {
  const { submissions } = getCollections();
  const email = req.decoded_email;
  const worker = req.user;

  const [totalSubmissions, pendingSubmissions, earnings] = await Promise.all([
    submissions.countDocuments({ worker_email: email }),
    submissions.countDocuments({ worker_email: email, status: "pending" }),
    submissions
      .aggregate([
        { $match: { worker_email: email, status: "approved" } },
        sumOf("$payable_amount"),
      ])
      .toArray(),
  ]);

  res.send({
    task_completed: worker.task_completed,
    totalSubmissions,
    pendingSubmissions,
    totalEarnings: earnings[0]?.total || 0,
  });
});

router.get("/admin-stats", verifyFirebaseToken, verifyAdmin, async (req, res) => {
  const { users, withdrawals } = getCollections();
  const [totalWorkers, totalBuyers, coins, payments] = await Promise.all([
    users.countDocuments({ role: "worker" }),
    users.countDocuments({ role: "buyer" }),
    users.aggregate([sumOf("$coin")]).toArray(),
    withdrawals
      .aggregate([{ $match: { status: "approved" } }, sumOf("$withdrawal_amount")])
      .toArray(),
  ]);

  res.send({
    totalWorkers,
    totalBuyers,
    totalAvailableCoins: coins[0]?.total || 0,
    totalPayments: payments[0]?.total || 0,
  });
});

router.get("/buyer/stats", verifyFirebaseToken, verifyBuyer, async (req, res) => {
  const { tasks, submissions } = getCollections();
  const email = req.decoded_email;

  const [totalTasks, pendingTasks, payments] = await Promise.all([
    tasks.countDocuments({ buyer_email: email }),
    submissions.countDocuments({ buyer_email: email, status: "pending" }),
    submissions
      .aggregate([
        { $match: { buyer_email: email, status: "approved" } },
        sumOf("$payable_amount"),
      ])
      .toArray(),
  ]);

  res.send({
    totalTasks,
    pendingTasks,
    totalPaymentPaid: payments[0]?.total || 0,
  });
});

module.exports = router;
