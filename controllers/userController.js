const userModel = require("../models/userModel");
const jwt = require("jsonwebtoken");

const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const newUser = await userModel.register(name, email, password);

    const token = jwt.sign({ email: newUser.email }, process.env.JWT_SECRET);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
      },
      token,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const newUser = await userModel.login(email, password);

    const token = jwt.sign({ email: newUser.email }, process.env.JWT_SECRET);

    res.status(201).json({
      success: true,
      message: "login successful",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
      },
      token,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const user = await userModel.getUser(req.email);
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
};
