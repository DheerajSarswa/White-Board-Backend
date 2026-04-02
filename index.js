require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectToDatabase = require("./db");
const userRoute = require("./routes/userRoute");

const app = express();
connectToDatabase();

app.use(cors());
app.use(express.json());

app.use("/users", userRoute);

app.listen(3030, () => {
  console.log("Serever is running on port-3030");
});
