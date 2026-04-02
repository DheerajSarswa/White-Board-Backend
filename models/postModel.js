const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxLength: 200,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    numberOfLikes: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: "posts",
  },
);

postSchema.statics.createPost = async function (title, content) {
  try {
    const post = new this({
      title,
      content,
    });
    const newPost = await post.save();
    return newPost;
  } catch (err) {
    throw new Error("Error creating post: ", err.message);
  }
};

postSchema.statics.getPosts = async function () {
  try {
    const posts = await this.find();
    return posts;
  } catch (err) {
    throw new Error("Error getting posts: ", err.message);
  }
};

const postModel = mongoose.model("Post", postSchema);

module.exports = postModel;
