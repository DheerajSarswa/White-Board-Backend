const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { AppError } = require("../utils/errors");
const { validateName } = require("../utils/validation");
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxLength: 50 },
  email: { type: String, required: true, trim: true, unique: true },
  password: { type: String, required: true, select: false },
}, { timestamps: true, collection: "Users" });
userSchema.statics.register = async function (name, email, password) {
  const validName = validateName(name, 50);
  const hashedPassword = await bcrypt.hash(password, 10);
  return this.create({ name: validName, email, password: hashedPassword });
};
userSchema.statics.getUser = async function (email) {
  const user = await this.findOne({ email });
  if (!user) throw new AppError(401, "Account not found. Please log in again.");
  return user;
};
userSchema.statics.login = async function (email, password) {
  const user = await this.findOne({ email }).select("+password");
  if (!user || !(await bcrypt.compare(password, user.password))) throw new AppError(401, "Invalid login credentials");
  return user;
};
module.exports = mongoose.model("Users", userSchema);
