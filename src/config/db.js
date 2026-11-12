const { MongoClient, ServerApiVersion } = require("mongodb");

const DB_NAME = "CoinTaskerDB";

const COLLECTION_NAMES = Object.freeze({
  USERS: "users",
  TASKS: "tasks",
  SUBMISSIONS: "submissions",
  PAYMENTS: "payments",
  WITHDRAWALS: "withdrawals",
});

let client;
let collections;

/** Connects once and exposes the collection handles used by the routes. */
async function connectDb(uri) {
  if (collections) return collections;

  client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });
  await client.connect();

  const db = client.db(DB_NAME);
  collections = Object.freeze({
    users: db.collection(COLLECTION_NAMES.USERS),
    tasks: db.collection(COLLECTION_NAMES.TASKS),
    submissions: db.collection(COLLECTION_NAMES.SUBMISSIONS),
    payments: db.collection(COLLECTION_NAMES.PAYMENTS),
    withdrawals: db.collection(COLLECTION_NAMES.WITHDRAWALS),
  });
  await ensureIndexes(collections);
  return collections;
}

/**
 * Database-level guarantees behind the application checks. A failure (for
 * example pre-existing duplicate data) is logged but must not stop startup.
 */
async function ensureIndexes({ users, submissions, payments }) {
  try {
    await Promise.all([
      users.createIndex({ email: 1 }, { unique: true }),
      submissions.createIndex({ task_id: 1, worker_email: 1 }, { unique: true }),
      payments.createIndex({ transactionId: 1 }, { unique: true }),
    ]);
  } catch (error) {
    console.error("Could not create indexes:", error.message);
  }
}

function getCollections() {
  if (!collections) throw new Error("Database not connected. Call connectDb() first.");
  return collections;
}

module.exports = { connectDb, getCollections, COLLECTION_NAMES };
