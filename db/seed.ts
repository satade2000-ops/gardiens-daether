import { getDb } from "../api/queries/connection";

async function seed() {
  // The game creates player profiles on demand; no initial content is required.
  getDb();
  console.log("Database ready.");
  process.exit(0); // close MySQL connection pool
}

seed();
