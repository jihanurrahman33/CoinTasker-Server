require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

var admin = require("firebase-admin");

//var serviceAccount = require("./cointasker-ed5ad-firebase-adminsdk.json");
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf8"
);
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

//middlewares
app.use(express.json());
app.use(cors());

const verifyFirebaseToken = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  //verify firebase token here
  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.decoded_email = decoded.email;
    next();
  } catch (error) {
    res.status(401).send({ message: "unauthorized access" });
  }
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { getAuth } = require("firebase-admin/auth");
const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
//collections names
const collections = {
  USERS: "users",
  TASKS: "tasks",
  SUBMISSIONS: "submissions",
  PAYMENTS: "payments",
  WITHDRAWALS: "withdrawals",
};
const database = client.db("CoinTaskerDB");
const usersCollection = database.collection(collections.USERS);
const tasksCollection = database.collection(collections.TASKS);
const submissionsCollection = database.collection(collections.SUBMISSIONS);
const paymentsCollection = database.collection(collections.PAYMENTS);
const withdrawalsCollection = database.collection(collections.WITHDRAWALS);
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );

    app.get("/", (req, res) => {
      res.send("Server is up and running");
    });

    //USERS RELATED APIS
    //get users
    app.get("/users", verifyFirebaseToken, async (req, res) => {
      const cursor = usersCollection.find();
      const users = await cursor.toArray();
      res.send(users);
    });
    //get single user
    app.get("/users/:email", verifyFirebaseToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      res.send(user);
    });

    //get user role
    app.get("/users/:email/role", verifyFirebaseToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      res.send(user);
    });
    //update user role by admin
    app.patch("/users/role/:id", verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { role: role },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.get("/users/:email/coin", verifyFirebaseToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      res.send(user);
    });

    //get top 6 workers based on coins
    app.get("/workers/top", async (req, res) => {
      const query = { role: "worker" };
      const options = {
        sort: { coin: -1 },
        limit: 6,
      };
      const cursor = usersCollection.find(query, options);
      const workers = await cursor.toArray();
      res.send(workers);
    });

    //create user
    app.post("/users", async (req, res) => {
      const user = req.body;
      const existingUser = await usersCollection.findOne({ email: user.email });
      if (existingUser) {
        return res.send({ message: "User already exists" });
      }

      if (user.role === "buyer") {
        //do something
        user.coin = 50;
      } else if (user.role === "worker") {
        user.task_completed = 0;
        user.coin = 10;
      }

      user.createdAt = new Date();

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    //delete user
    app.delete("/users/:id", verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      try {
        // 1️Get user from MongoDB
        const dbUser = await usersCollection.findOne(filter);

        if (dbUser?.email) {
          // 2 Get Firebase user using email
          const firebaseUser = await admin.auth().getUserByEmail(dbUser.email);

          // 3️Delete from Firebase Auth
          await admin.auth().deleteUser(firebaseUser.uid);
        }

        // 4️ Delete from MongoDB
        const result = await usersCollection.deleteOne(filter);

        res.send(result);
      } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    //TASKS RELATED APIs
    app.post("/tasks", verifyFirebaseToken, async (req, res) => {
      const task = req.body;
      task.createdAt = new Date();
      //deduct coins from user
      const buyerEmail = task.buyer_email;
      const buyer = await usersCollection.findOne({ email: buyerEmail });
      if (!buyer) {
        return res.status(404).send({ message: "Buyer not found" });
      }
      if (buyer.coin < task.total_payable_amount) {
        return res
          .status(400)
          .send({ message: "Insufficient coins to create task" });
      }
      const updatedCoin = buyer.coin - task.total_payable_amount;
      await usersCollection.updateOne(
        { email: buyerEmail },
        { $set: { coin: updatedCoin } }
      );
      const result = await tasksCollection.insertOne(task);
      res.send(result);
    });
    //get tasks
    app.get("/tasks", verifyFirebaseToken, async (req, res) => {
      const email = req.query.email;
      let query = {};
      if (email) {
        query = { buyer_email: email };
      }
      const cursor = tasksCollection.find(query);
      const tasks = await cursor.toArray();
      res.send(tasks);
    });

    //get task based on required workers greater than 0
    app.get("/tasks/available", verifyFirebaseToken, async (req, res) => {
      const query = { required_workers: { $gt: 0 } };
      const cursor = tasksCollection.find(query);
      const tasks = await cursor.toArray();
      res.send(tasks);
    });

    //get single task by id
    app.get("/tasks/:id", verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const task = await tasksCollection.findOne(query);
      res.send(task);
    });

    //update a task
    app.patch("/tasks/:id", verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;
      const updates = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: updates,
      };
      const result = await tasksCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //delete a task
    app.delete("/tasks/:id", verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;

      //get the task to refund coins to buyer
      const task = await tasksCollection.findOne({ _id: new ObjectId(id) });
      if (task) {
        const buyerEmail = task.buyer_email;
        const buyer = await usersCollection.findOne({ email: buyerEmail });
        if (buyer) {
          const updatedCoin = buyer.coin + task.total_payable_amount;
          await usersCollection.updateOne(
            { email: buyerEmail },
            { $set: { coin: updatedCoin } }
          );
        }
      }
      const filter = { _id: new ObjectId(id) };
      const result = await tasksCollection.deleteOne(filter);
      res.send(result);
    });

    //SUBMISSIONS RELATED APIS
    //create a submission
    app.post("/submissions", verifyFirebaseToken, async (req, res) => {
      const submission = req.body;
      submission.createdAt = new Date();
      const workerEmail = submission.worker_email;
      const worker = await usersCollection.findOne({ email: workerEmail });
      if (!worker) {
        return res.status(404).send({ message: "Worker not found" });
      }

      //check duplicate submission for the same task by the same worker
      const existingSubmission = await submissionsCollection.findOne({
        task_id: submission.task_id,
        worker_email: workerEmail,
      });
      if (existingSubmission) {
        return res
          .status(400)
          .send({ message: "You have already submitted for this task" });
      }
      //decresese required_workers in task
      const taskId = submission.task_id;
      const task = await tasksCollection.findOne({ _id: new ObjectId(taskId) });
      if (!task) {
        return res.status(404).send({ message: "Task not found" });
      }
      if (task.required_workers <= 0) {
        return res
          .status(400)
          .send({ message: "No more workers required for this task" });
      }
      const updatedRequiredWorkers = task.required_workers - 1;
      await tasksCollection.updateOne(
        { _id: new ObjectId(taskId) },
        { $set: { required_workers: updatedRequiredWorkers } }
      );

      const result = await submissionsCollection.insertOne(submission);
      res.send(result);
    });

    //get my submissions
    app.get("/submissions/my", verifyFirebaseToken, async (req, res) => {
      const workerEmail = req.query.worker_email;
      const status = req.query.status;
      let query = { worker_email: workerEmail };
      if (status) {
        query.status = status;
      }
      const cursor = submissionsCollection.find(query);
      const submissions = await cursor.toArray();
      res.send(submissions);
    });

    // Fetch Pending Submissions
    app.get(
      "/submissions/buyer-pending",
      verifyFirebaseToken,
      async (req, res) => {
        const email = req.query.email;
        const query = { buyer_email: email, status: "pending" };
        const cursor = submissionsCollection.find(query);
        const submissions = await cursor.toArray();
        res.send(submissions);
      }
    );

    ///submissions/approve/:id
    app.patch(
      "/submissions/approve/:id",
      verifyFirebaseToken,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const submission = await submissionsCollection.findOne(filter);
        if (!submission) {
          return res.status(404).send({ message: "Submission not found" });
        }

        //update submission status to approved
        const updateDoc = {
          $set: { status: "approved" },
        };
        const result = await submissionsCollection.updateOne(filter, updateDoc);

        //update worker's coin and task_completed
        const workerEmail = submission.worker_email;
        const worker = await usersCollection.findOne({ email: workerEmail });
        if (worker) {
          const updatedCoin = worker.coin + submission.payable_amount;
          const updatedTasksCompleted = worker.task_completed + 1;
          await usersCollection.updateOne(
            { email: workerEmail },
            {
              $set: {
                coin: updatedCoin,
                task_completed: updatedTasksCompleted,
              },
            }
          );
        }

        res.send(result);
      }
    );

    //reject a submission
    app.patch(
      "/submissions/reject/:id",
      verifyFirebaseToken,
      async (req, res) => {
        const id = req.params.id;
        const { taskId } = req.body;
        const filter = { _id: new ObjectId(id) };
        const submission = await submissionsCollection.findOne(filter);
        if (!submission) {
          return res.status(404).send({ message: "Submission not found" });
        }

        //update submission status to rejected
        const updateDoc = {
          $set: { status: "rejected" },
        };
        const result = await submissionsCollection.updateOne(filter, updateDoc);

        //increment required_workers in task
        const task = await tasksCollection.findOne({
          _id: new ObjectId(taskId),
        });
        if (task) {
          const updatedRequiredWorkers = task.required_workers + 1;
          await tasksCollection.updateOne(
            { _id: new ObjectId(taskId) },
            { $set: { required_workers: updatedRequiredWorkers } }
          );
        }

        res.send(result);
      }
    );

    //WITHDRAWALS APIs
    //create a withdrawal request
    app.post("/withdrawals", verifyFirebaseToken, async (req, res) => {
      const withdrawal = req.body;

      withdrawal.createdAt = new Date();
      withdrawal.status = "pending";
      const workerEmail = withdrawal.worker_email;
      const worker = await usersCollection.findOne({ email: workerEmail });
      console.log("Withdrawal request received:", withdrawal);
      if (!worker) {
        return res.status(404).send({ message: "Worker not found" });
      }
      if (worker.coin < withdrawal.withdrawal_coin) {
        return res
          .status(400)
          .send({ message: "Insufficient coins for withdrawal" });
      }

      const updatedCoin = worker.coin - withdrawal.withdrawal_coin;

      await usersCollection.updateOne(
        { email: workerEmail },
        { $set: { coin: updatedCoin } }
      );
      const result = await withdrawalsCollection.insertOne(withdrawal);
      res.send(result);
    });
    //get withdrawals
    app.get("/withdrawals", verifyFirebaseToken, async (req, res) => {
      const email = req.query.email;
      const status = req.query.status;

      let query = {};
      if (email) {
        query = { worker_email: email };
      }
      if (status) {
        query.status = status;
      }
      const cursor = withdrawalsCollection.find(query);
      const withdrawals = await cursor.toArray();
      res.send(withdrawals);
    });
    //update withdrawal status by admin
    app.patch("/withdrawals/:id", verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { status: status },
      };
      const result = await withdrawalsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //PAYMENTS RELATED APIS
    //get payment history for a buyer
    app.get("/payments", verifyFirebaseToken, async (req, res) => {
      const email = req.query.email;
      const query = { buyer_email: email };
      const cursor = paymentsCollection.find(query);
      const payments = await cursor.toArray();
      res.send(payments);
    });

    //STATS RELATED APIS
    //get workeer stats
    app.get("/worker/stats", verifyFirebaseToken, async (req, res) => {
      const email = req.query.email;
      const worker = await usersCollection.findOne({ email: email });
      if (!worker) {
        return res.status(404).send({ message: "Worker not found" });
      }

      const totalSubmissions = await submissionsCollection.countDocuments({
        worker_email: email,
      });

      const pendingSubmissions = await submissionsCollection.countDocuments({
        worker_email: email,
        status: "pending",
      });

      const earnings = await submissionsCollection
        .aggregate([
          { $match: { worker_email: email, status: "approved" } },
          { $group: { _id: null, total: { $sum: "$payable_amount" } } },
        ])
        .toArray();

      res.send({
        task_completed: worker.task_completed,
        totalSubmissions,
        pendingSubmissions,
        totalEarnings: earnings[0]?.total || 0,
      });
    });
    //get admin stats
    app.get("/admin-stats", verifyFirebaseToken, async (req, res) => {
      try {
        const [totalWorkers, totalBuyers] = await Promise.all([
          usersCollection.countDocuments({ role: "worker" }),
          usersCollection.countDocuments({ role: "buyer" }),
        ]);

        const coinsAggregation = await usersCollection
          .aggregate([{ $group: { _id: null, totalCoins: { $sum: "$coin" } } }])
          .toArray();

        const paymentsAggregation = await withdrawalsCollection
          .aggregate([
            { $match: { status: "approved" } },
            {
              $group: {
                _id: null,
                totalPayments: { $sum: "$withdrawal_amount" },
              },
            },
          ])
          .toArray();

        res.send({
          totalWorkers,
          totalBuyers,
          totalAvailableCoins: coinsAggregation[0]?.totalCoins || 0,
          totalPayments: paymentsAggregation[0]?.totalPayments || 0,
        });
      } catch (error) {
        console.error("Admin stats error:", error);
        res.status(500).send({ message: "Failed to load admin stats" });
      }
    });
    //get buyer stats
    app.get("/buyer/stats", verifyFirebaseToken, async (req, res) => {
      const email = req.query.email;
      const totalTasks = await tasksCollection.countDocuments({
        buyer_email: email,
      });

      const pendingTasks = await submissionsCollection.countDocuments({
        buyer_email: email,
        status: "pending",
      });

      const payments = await submissionsCollection
        .aggregate([
          { $match: { buyer_email: email, status: "approved" } },
          { $group: { _id: null, total: { $sum: "$payable_amount" } } },
        ])
        .toArray();

      res.send({
        totalTasks,
        pendingTasks,
        totalPaymentPaid: payments[0]?.total || 0,
      });
    });

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);
