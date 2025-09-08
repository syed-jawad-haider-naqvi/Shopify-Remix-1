import { MongoClient } from "mongodb";

let mongoClient;
let db;

if (process.env.NODE_ENV === "production") {
  mongoClient = new MongoClient(process.env.DATABASE_URL);
  db = mongoClient.db("ShopifyScaffoldRemix1"); // Use the name of your database here
} else {
  if (!global.mongo) {
    global.mongo = {
      client: new MongoClient(process.env.DATABASE_URL),
      db: new MongoClient(process.env.DATABASE_URL).db("ShopifyScaffoldRemix1"),
    };
  }
  mongoClient = global.mongo.client;
  db = global.mongo.db;
}

export { mongoClient, db };