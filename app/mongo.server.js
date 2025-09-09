import { MongoClient } from "mongodb";

// Check if the database URL is set in environment variables
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined in the environment variables.");
}

const client = new MongoClient(process.env.DATABASE_URL);

let db;

// In development, store the promise on the global object to prevent multiple client connections
// with HMR.
if (process.env.NODE_ENV === "production") {
  db = client.db("ShopifyScaffoldRemix1");
  client.connect(); // Connect in production
} else {
  if (!global.mongo) {
    global.mongo = {
      client: client,
      db: client.db("ShopifyScaffoldRemix1"),
    };
    client.connect(); // Connect only once in development
  }
  db = global.mongo.db;
}

export default db;