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
};
const database = client.db("CoinTaskerDB");
const usersCollection = database.collection(collections.USERS);
const tasksCollection = database.collection(collections.TASKS);
const submissionsCollection = database.collection(collections.SUBMISSIONS);
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    app.get("/", (req, res) => {
      res.send("Server is up and running");
    });

    //users api

    //get user role
    app.get("/users/:email/role", verifyFirebaseToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      res.send(user);
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

    //tasks related apis
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
      const filter = { _id: new ObjectId(id) };
      const result = await tasksCollection.deleteOne(filter);
      res.send(result);
    });

    //submissions related apis
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

      const result = await submissionsCollection.insertOne(submission);
      res.send(result);
    });

    //get my submissions
    app.get("/submissions/my", verifyFirebaseToken, async (req, res) => {
      const workerEmail = req.query.worker_email;
      const query = { worker_email: workerEmail };
      const cursor = submissionsCollection.find(query);
      const submissions = await cursor.toArray();
      res.send(submissions);
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
