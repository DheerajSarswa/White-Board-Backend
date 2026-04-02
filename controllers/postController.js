const Posts = require("../models/postModel");

const createPost = async (req, res) => {
  try {
    const { title, content } = req.body;
    const newPost = await Posts.createPost(title, content);
    res.status(201).json(newPost);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getPosts = async (req, res) => {
  try {
    const posts = await Posts.getPosts();
    res.status(200).json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createPost,
  getPosts,
};
