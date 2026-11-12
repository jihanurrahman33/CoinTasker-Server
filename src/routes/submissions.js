const { Router } = require("express");
const { getCollections } = require("../config/db");
const { verifyFirebaseToken } = require("../middleware/auth");
const { verifyBuyer, verifyWorker } = require("../middleware/roles");
const { parseObjectId } = require("../utils/objectId");

const router = Router();

router.post("/submissions", verifyFirebaseToken, verifyWorker, async (req, res) => {
  const { users, tasks, submissions } = getCollections();
  const submission = req.body;
  submission.createdAt = new Date();

  const workerEmail = submission.worker_email;
  const worker = await users.findOne({ email: workerEmail });
  if (!worker) {
    return res.status(404).send({ message: "Worker not found" });
  }

  const existing = await submissions.findOne({
    task_id: submission.task_id,
    worker_email: workerEmail,
  });
  if (existing) {
    return res
      .status(400)
      .send({ message: "You have already submitted for this task" });
  }

  const taskFilter = { _id: parseObjectId(submission.task_id) };
  const task = await tasks.findOne(taskFilter);
  if (!task) {
    return res.status(404).send({ message: "Task not found" });
  }
  if (task.required_workers <= 0) {
    return res
      .status(400)
      .send({ message: "No more workers required for this task" });
  }
  await tasks.updateOne(taskFilter, {
    $set: { required_workers: task.required_workers - 1 },
  });

  res.send(await submissions.insertOne(submission));
});

router.get("/submissions/my", verifyFirebaseToken, async (req, res) => {
  const query = { worker_email: req.query.worker_email };
  if (req.query.status) query.status = req.query.status;
  res.send(await getCollections().submissions.find(query).toArray());
});

router.get("/submissions/buyer-pending", verifyFirebaseToken, async (req, res) => {
  const query = { buyer_email: req.query.email, status: "pending" };
  res.send(await getCollections().submissions.find(query).toArray());
});

router.patch(
  "/submissions/approve/:id",
  verifyFirebaseToken,
  verifyBuyer,
  async (req, res) => {
    const { users, submissions } = getCollections();
    const filter = { _id: parseObjectId(req.params.id) };
    const submission = await submissions.findOne(filter);
    if (!submission) {
      return res.status(404).send({ message: "Submission not found" });
    }

    const result = await submissions.updateOne(filter, {
      $set: { status: "approved" },
    });

    const worker = await users.findOne({ email: submission.worker_email });
    if (worker) {
      await users.updateOne(
        { email: submission.worker_email },
        {
          $set: {
            coin: worker.coin + submission.payable_amount,
            task_completed: worker.task_completed + 1,
          },
        }
      );
    }
    res.send(result);
  }
);

router.patch(
  "/submissions/reject/:id",
  verifyFirebaseToken,
  verifyBuyer,
  async (req, res) => {
    const { tasks, submissions } = getCollections();
    const filter = { _id: parseObjectId(req.params.id) };
    const submission = await submissions.findOne(filter);
    if (!submission) {
      return res.status(404).send({ message: "Submission not found" });
    }

    const result = await submissions.updateOne(filter, {
      $set: { status: "rejected" },
    });

    // Re-open the slot on the task
    const taskFilter = { _id: parseObjectId(req.body.taskId) };
    const task = await tasks.findOne(taskFilter);
    if (task) {
      await tasks.updateOne(taskFilter, {
        $set: { required_workers: task.required_workers + 1 },
      });
    }
    res.send(result);
  }
);

module.exports = router;
