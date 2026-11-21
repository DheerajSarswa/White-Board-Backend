const mongoose = require("mongoose");
const { AppError } = require("../utils/errors");
const { validateId, validateName, validateEmail, validateElements, validateCanvasEdit, requireValid } = require("../utils/validation");
const { normalizeElementIds } = require("../utils/canvasElements");
const canvasSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, default: "Untitled Canvas", maxLength: 200 },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
  elements: { type: [mongoose.Schema.Types.Mixed], default: [] },
  revision: { type: Number, default: 0 },
  recentEdits: { type: [String], select: false },
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
    { $set: { elements: validElements, lastViewedAt: new Date() }, $inc: { revision: 1 } },
    { returnDocument: "before", runValidators: true }));
  previous.$locals.contentChanged = JSON.stringify(previous.elements) !== JSON.stringify(validElements);
  previous.elements = validElements;
  previous.revision += 1;
  return previous;
};
canvasSchema.statics.editCanvas = async function (id, email, edit) {
  validateId(id);
  const { editId, add, remove } = validateCanvasEdit(edit);
  const user = await getUser(email);
  const filter = accessFilter(id, user._id);
  const removed = new Set(remove);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const canvas = requireCanvas(await this.findOne(filter).select("elements revision +recentEdits"));
    if (canvas.recentEdits?.includes(editId)) return canvas;
    const elements = normalizeElementIds(canvas.elements).filter(({ id }) => !removed.has(id));
    const existing = new Set(elements.map(({ id }) => id));
    for (const { element, index } of add) {
      if (existing.has(element.id)) continue;
      elements.splice(index ?? elements.length, 0, element);
      existing.add(element.id);
    }
    requireValid(elements.length <= 10000, "A canvas can contain at most 10000 items");

    // Retry against the newest board if another editor saved during this read.
    const revisionFilter = canvas.revision === 0
      ? { $or: [{ revision: 0 }, { revision: { $exists: false } }] }
      : { revision: canvas.revision };
    const updated = await this.findOneAndUpdate(
      { $and: [filter, revisionFilter] },
      {
        $set: { elements, lastViewedAt: new Date() },
        $inc: { revision: 1 },
        $push: { recentEdits: { $each: [editId], $slice: -128 } },
      },
      { returnDocument: "after" },
    );
    if (updated) {
      updated.$locals.contentChanged = true;
      return updated;
    }
  }
  throw new AppError(409, "The canvas is busy. Please retry the edit.");
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
