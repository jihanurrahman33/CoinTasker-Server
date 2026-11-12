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
  return collections;
}

function getCollections() {
  if (!collections) throw new Error("Database not connected. Call connectDb() first.");
  return collections;
}

module.exports = { connectDb, getCollections, COLLECTION_NAMES };
