console.log("DEBUG: Your URI is:", process.env.MONGODB_URI);
const mongoose = require("mongoose");

const connectionString = process.env.MONGODB_URI;

const connectToDatabase = async () => {
  try {
    await mongoose.connect(connectionString);
    console.log("Connected to the database");
  } catch (err) {
    console.error(`Error connecting to the database: ${err}`);
  }
};

module.exports = connectToDatabase;
