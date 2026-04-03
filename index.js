require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectToDatabase = require("./db");
const userRoute = require("./routes/userRoute");
const canvasRoute = require("./routes/canvasRoute");

const app = express();
connectToDatabase();

app.use(cors());
app.use(express.json());

app.use("/api/users", userRoute);

app.use("/api/canvases", canvasRoute);

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Serever is running on port-${PORT}`);
});
