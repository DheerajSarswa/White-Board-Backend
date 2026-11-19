const mongoose = require("mongoose");

// Never buffer requests while the database is unavailable.
mongoose.set("bufferCommands", false);

const connectToDatabase = async (options = {}) => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    ...options,
  });
  console.log("Connected to the database");
};

module.exports = connectToDatabase;
