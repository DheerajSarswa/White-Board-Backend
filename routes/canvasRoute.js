const express = require("express");
const protect = require("../middlewares/validateUserToken");
const {
  getAllCanvases,
  createCanvas,
  loadCanvas,
  updateCanvas,
  shareCanvas,
  deleteCanvas,
} = require("../controllers/canvasController");

const router = express.Router();

router.get("/", protect, getAllCanvases);

router.post("/", protect, createCanvas);

router.get("/load/:id", protect, loadCanvas);

router.put("/:id", protect, updateCanvas);

router.put("/share/:id", protect, shareCanvas);

router.delete("/:id", protect, deleteCanvas);

module.exports = router;
