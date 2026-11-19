const userModel = require("../models/userModel");
const { issueToken } = require("../utils/tokens");
const { sendError } = require("../utils/errors");

const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const newUser = await userModel.register(name, email, password);

    const token = issueToken(newUser);

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
    sendError(res, error);
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const newUser = await userModel.login(email, password);

    const token = issueToken(newUser);

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
    sendError(res, error);
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
    sendError(res, error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
};
