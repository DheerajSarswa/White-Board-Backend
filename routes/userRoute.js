const express = require("express");
const validateUserCredential = require("../middlewares/validateUserCredential");
const protect = require("../middlewares/validateUserToken");
const {
  registerUser,
  loginUser,
  getUserProfile,
} = require("../controllers/userController");

const router = express.Router();

router.post("/register", validateUserCredential, registerUser);

router.post("/login", validateUserCredential, loginUser);

router.get("/profile", protect, getUserProfile);

module.exports = router;
