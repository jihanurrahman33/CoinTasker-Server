const { Router } = require("express");
const { getCollections } = require("../config/db");
const { verifyFirebaseToken } = require("../middleware/auth");
const { verifyBuyer, verifyWorker } = require("../middleware/roles");
const { SUBMISSION_STATUS } = require("../constants");
const { HttpError } = require("../utils/httpError");
const { parseObjectId } = require("../utils/objectId");
const { omit } = require("../utils/validate");

const router = Router();

/** Fields decided by the server from the task and the token, never the body. */
const SERVER_OWNED_FIELDS = [
  "_id",
  "worker_email",
  "buyer_email",
  "payable_amount",
  "status",
  "createdAt",
];

router.post("/submissions", verifyFirebaseToken, verifyWorker, async (req, res) => {
  const { tasks, submissions } = getCollections();
  const workerEmail = req.decoded_email;
  const taskId = req.body.task_id;
  const taskFilter = { _id: parseObjectId(taskId) };

  const task = await tasks.findOne(taskFilter);
  if (!task) throw new HttpError(404, "Task not found");

  const existing = await submissions.findOne({
    task_id: taskId,
    worker_email: workerEmail,
  });
  if (existing) {
    throw new HttpError(400, "You have already submitted for this task");
  }

  // Atomically claim a slot so the task can never be over-subscribed.
  const claimed = await tasks.updateOne(
    { ...taskFilter, required_workers: { $gt: 0 } },
    { $inc: { required_workers: -1 } }
  );
  if (claimed.modifiedCount !== 1) {
    throw new HttpError(400, "No more workers required for this task");
  }

  const submission = {
    ...omit(req.body, SERVER_OWNED_FIELDS),
    worker_email: workerEmail,
    buyer_email: task.buyer_email,
    payable_amount: task.payable_amount,
    status: SUBMISSION_STATUS.PENDING,
    createdAt: new Date(),
  };

  try {
    res.send(await submissions.insertOne(submission));
  } catch (error) {
    await tasks.updateOne(taskFilter, { $inc: { required_workers: 1 } });
    throw error;
  }
});

router.get("/submissions/my", verifyFirebaseToken, async (req, res) => {
  const query = { worker_email: req.decoded_email };
  if (req.query.status) query.status = req.query.status;
  res.send(await getCollections().submissions.find(query).toArray());
});

router.get("/submissions/buyer-pending", verifyFirebaseToken, async (req, res) => {
  const query = {
    buyer_email: req.decoded_email,
    status: SUBMISSION_STATUS.PENDING,
  };
  res.send(await getCollections().submissions.find(query).toArray());
});

/**
 * Moves a pending submission owned by the calling buyer to `status`.
 * The status filter makes the transition happen at most once, so a
 * double click or replayed request cannot pay a worker twice.
 */
async function resolveSubmission(req, status) {
  const { submissions } = getCollections();
  const filter = { _id: parseObjectId(req.params.id) };

  const submission = await submissions.findOne(filter);
  if (!submission) throw new HttpError(404, "Submission not found");
  if (submission.buyer_email !== req.decoded_email) {
    throw new HttpError(403, "forbidden access");
  }

  const result = await submissions.updateOne(
    { ...filter, status: SUBMISSION_STATUS.PENDING },
    { $set: { status } }
  );
  if (result.modifiedCount !== 1) {
    throw new HttpError(409, "Submission has already been reviewed");
  }
  return { submission, result };
}

router.patch(
  "/submissions/approve/:id",
  verifyFirebaseToken,
  verifyBuyer,
  async (req, res) => {
    const { users } = getCollections();
    const { submission, result } = await resolveSubmission(
      req,
      SUBMISSION_STATUS.APPROVED
    );

    await users.updateOne(
      { email: submission.worker_email },
      { $inc: { coin: submission.payable_amount, task_completed: 1 } }
    );
    res.send(result);
  }
);

router.patch(
  "/submissions/reject/:id",
  verifyFirebaseToken,
  verifyBuyer,
  async (req, res) => {
    const { tasks } = getCollections();
    const { submission, result } = await resolveSubmission(
      req,
      SUBMISSION_STATUS.REJECTED
    );

    // Re-open the slot on the task
    await tasks.updateOne(
      { _id: parseObjectId(submission.task_id) },
      { $inc: { required_workers: 1 } }
    );
    res.send(result);
  }
);

module.exports = router;
