const mongoose = require("mongoose");
const { AppError } = require("../utils/errors");
const { validateId, validateName, validateEmail, validateElements } = require("../utils/validation");
const canvasSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, default: "Untitled Canvas", maxLength: 200 },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
  elements: { type: [mongoose.Schema.Types.Mixed], default: [] },
  shared_with: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
  lastViewedAt: { type: Date, default: Date.now },
}, { timestamps: true, collection: "Canvas" });
const getUser = (email) => mongoose.model("Users").getUser(email);
const accessFilter = (id, userId) => ({ _id: id, $or: [{ owner: userId }, { shared_with: userId }] });
const requireCanvas = (canvas) => {
  if (!canvas) throw new AppError(403, "Canvas not found or access denied");
  return canvas;
};
canvasSchema.statics.getAllCanvases = async function (email) {
  const user = await getUser(email);
  return this.find({ $or: [{ owner: user._id }, { shared_with: user._id }] }).sort({ lastViewedAt: -1 });
};
canvasSchema.statics.createCanvas = async function ({ name = "Untitled Canvas", email, elements = [] }) {
  const validName = validateName(name);
  const validElements = validateElements(elements);
  const user = await getUser(email);
  // Sharing always goes through the owner-checked share endpoint.
  return this.create({ name: validName, owner: user._id, elements: validElements, shared_with: [] });
};
canvasSchema.statics.authorizeCanvas = async function (id, email) {
  validateId(id);
  const user = await getUser(email);
  return requireCanvas(await this.findOne(accessFilter(id, user._id)).select("_id owner shared_with"));
};
canvasSchema.statics.loadCanvas = async function (id, email) {
  validateId(id);
  const user = await getUser(email);
  return requireCanvas(await this.findOneAndUpdate(accessFilter(id, user._id),
    { $set: { lastViewedAt: new Date() } }, { returnDocument: "after" }));
};
canvasSchema.statics.updateCanvas = async function (id, email, { elements }) {
  validateId(id);
  const validElements = validateElements(elements);
  const user = await getUser(email);
  const previous = requireCanvas(await this.findOneAndUpdate(accessFilter(id, user._id),
    { $set: { elements: validElements, lastViewedAt: new Date() } }, { returnDocument: "before", runValidators: true }));
  previous.$locals.contentChanged = JSON.stringify(previous.elements) !== JSON.stringify(validElements);
  previous.elements = validElements;
  return previous;
};
canvasSchema.statics.shareCanvas = async function (email, id, sharedWithEmail) {
  validateId(id);
  const recipientEmail = validateEmail(sharedWithEmail);
  const owner = await getUser(email);
  // Check ownership before looking up another account.
  requireCanvas(await this.findOne({ _id: id, owner: owner._id }).select("_id"));
  const recipient = await mongoose.model("Users").findOne({ email: recipientEmail });
  if (!recipient) throw new AppError(404, "Shared-with user not found");
  if (owner._id.equals(recipient._id)) throw new AppError(400, "Cannot share canvas with its owner");
  return requireCanvas(await this.findOneAndUpdate({ _id: id, owner: owner._id },
    { $addToSet: { shared_with: recipient._id } }, { returnDocument: "after", runValidators: true }));
};
canvasSchema.statics.deleteCanvas = async function (id, email) {
  validateId(id);
  const user = await getUser(email);
  return requireCanvas(await this.findOneAndDelete({ _id: id, owner: user._id }));
};
module.exports = mongoose.model("Canvas", canvasSchema);
