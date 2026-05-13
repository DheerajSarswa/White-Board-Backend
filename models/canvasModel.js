const mongoose = require("mongoose");

const canvasSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      default: "Untitled Canvas",
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    elements: {
      type: [{ type: mongoose.Schema.Types.Mixed }],
    },
    shared_with: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
      },
    ],
    lastViewedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true, collection: "Canvas" },
);

canvasSchema.statics.getAllCanvases = async function (email) {
  try {
    const User = mongoose.model("Users");
    const user = await User.findOne({ email });

    if (!user) {
      throw new Error("User not found. Cannot fetch canvases.");
    }

    const canvases = await this.find({
      $or: [{ owner: user._id }, { shared_with: user._id }],
    }).sort({ lastViewedAt: -1 });

    return canvases;
  } catch (error) {
    console.error("Error in getAllCanvases :", error.message);
    throw new Error("An error occurred while retrieving canvases.");
  }
};

canvasSchema.statics.createCanvas = async function (data) {
  const { name, email, elements, shared_with } = data;

  try {
    const User = mongoose.model("Users");
    const user = await User.findOne({ email });

    if (!user) {
      throw new Error("User not found. A canvas must have a valid owner.");
    }

    const newCanvas = await this.create({
      name: name || "Untitled Canvas",
      owner: user._id,
      elements: elements || [],
      shared_with: shared_with || [],
      lastViewedAt: new Date(),
    });

    return newCanvas;
  } catch (error) {
    throw error;
  }
};

canvasSchema.statics.loadCanvas = async function (id, email) {
  try {
    const User = mongoose.model("Users");
    const user = await User.findOne({ email });

    if (!user) {
      throw new Error("User not found.");
    }

    const canvas = await this.findOne({
      _id: id,
      $or: [{ owner: user._id }, { shared_with: user._id }],
    });

    if (!canvas) {
      throw new Error(
        "Canvas not found or you do not have permission to view it.",
      );
    }

    canvas.lastViewedAt = Date.now();
    await canvas.save();

    return canvas;
  } catch (error) {
    throw error;
  }
};

canvasSchema.statics.updateCanvas = async function (id, email, data) {
  const { elements } = data;

  try {
    const User = mongoose.model("Users");
    const user = await User.findOne({ email });
    if (!user) throw new Error("User not found");

    const canvas = await this.findOne({
      _id: id,
      $or: [{ owner: user._id }, { shared_with: user._id }],
    });

    if (!canvas) {
      throw new Error(
        "Canvas not found or you do not have permission to edit.",
      );
    }

    canvas.elements = elements;
    canvas.markModified("elements");

    canvas.lastViewedAt = Date.now();

    await canvas.save();
    return canvas;
  } catch (error) {
    throw error;
  }
};

canvasSchema.statics.shareCanvas = async function (
  email,
  canvasId,
  sharedWithEmail,
) {
  try {
    const User = mongoose.model("Users");

    const ownerUser = await User.findOne({ email });
    if (!ownerUser) {
      throw new Error("Owner user not found.");
    }

    const sharedWithUser = await User.findOne({ email: sharedWithEmail });
    if (!sharedWithUser) {
      throw new Error("Shared-with user not found.");
    }

    const canvas = await this.findOne({
      _id: canvasId,
      owner: ownerUser._id,
    });

    if (!canvas) {
      throw new Error(
        "Canvas not found or you do not have permission to share this canvas.",
      );
    }

    if (canvas.owner.equals(sharedWithUser._id)) {
      throw new Error("Cannot share canvas with its owner.");
    }

    if (!canvas.shared_with.some((id) => id.equals(sharedWithUser._id))) {
      canvas.shared_with.push(sharedWithUser._id);
      await canvas.save();
    }

    return canvas;
  } catch (error) {
    throw error;
  }
};

canvasSchema.statics.deleteCanvas = async function (id, email) {
  try {
    const User = mongoose.model("Users");
    const user = await User.findOne({ email });
    if (!user) throw new Error("User not found");

    const deletedCanvas = await this.findOneAndDelete({
      _id: id,
      owner: user._id,
    });

    if (!deletedCanvas) {
      throw new Error(
        "Canvas not found or you do not have permission to delete it.",
      );
    }

    return deletedCanvas;
  } catch (error) {
    throw error;
  }
};

const Canvas = mongoose.model("Canvas", canvasSchema);
module.exports = Canvas;
