const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxLength: 50,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "Users",
  },
);

userSchema.statics.register = async function (name, email, password) {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new this({
      name,
      email,
      password: hashedPassword,
    });

    const newUser = await user.save();
    return newUser;
  } catch (error) {
    throw new Error("Error registering user: " + error.message);
  }
};

userSchema.statics.getUser = async function (email) {
  try {
    const user = await this.findOne({ email });
    if (!user) {
      throw new Error("User not found: " + error.message);
    }
    return user;
  } catch (error) {
    throw new Error("Error getting user: " + error.message);
  }
};

userSchema.statics.login = async function (email, password) {
  try {
    const user = await this.findOne({ email });
    if (!user) {
      throw new Error("Invalid login credentials");
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error("Invalid login credentials");
    }
    return user;
  } catch (error) {
    throw new Error("Error logging in: " + error.message);
  }
};

const userModel = mongoose.model("Users", userSchema);

module.exports = userModel;
