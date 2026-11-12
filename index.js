const config = require("./src/config");
const { initFirebase } = require("./src/config/firebase");
const { connectDb } = require("./src/config/db");
const { createApp } = require("./src/app");

async function main() {
  initFirebase(config.firebaseServiceKey);
  await connectDb(config.mongodbUri);

  createApp().listen(config.port, () => {
    console.log(`Server is running on port ${config.port}`);
  });
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
