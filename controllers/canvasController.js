const Canvas = require("../models/canvasModel");

const getAllCanvases = async (req, res) => {
  try {
    const email = req.email;
    const canvases = await Canvas.getAllCanvases(email);

    res.status(200).json({
      success: true,
      count: canvases.length,
      canvases: canvases,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server Error: Unable to fetch canvases.",
    });
  }
};

const createCanvas = async (req, res) => {
  try {
    const email = req.email;

    const {
      name = "Untitled Canvas",
      elements = [],
      thumbnail = "",
      shared_with = [],
    } = req.body;

    const newCanvas = await Canvas.createCanvas({
      name,
      email,
      elements,
      thumbnail,
      shared_with,
    });

    res.status(201).json({
      success: true,
      message: "Canvas created successfully",
      canvas: newCanvas,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const loadCanvas = async (req, res) => {
  try {
    const { id } = req.params;
    const email = req.email;

    const canvas = await Canvas.loadCanvas(id, email);

    res.status(200).json({
      success: true,
      canvas: canvas,
    });
  } catch (error) {
    res.status(403).json({
      success: false,
      message: error.message,
    });
  }
};

const updateCanvas = async (req, res) => {
  try {
    const { id } = req.params;
    const email = req.email;
    const { elements, thumbnail } = req.body;

    const updatedCanvas = await Canvas.updateCanvas(id, email, {
      elements,
      thumbnail,
    });

    res.status(200).json({
      success: true,
      message: "Canvas updated successfully",
      canvasId: updatedCanvas._id,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteCanvas = async (req, res) => {
  try {
    const { id } = req.params;
    const email = req.email;

    await Canvas.deleteCanvas(id, email);

    res.status(200).json({
      success: true,
      message: "Canvas deleted successfully",
    });
  } catch (error) {
    res.status(403).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getAllCanvases,
  createCanvas,
  loadCanvas,
  updateCanvas,
  deleteCanvas,
};
