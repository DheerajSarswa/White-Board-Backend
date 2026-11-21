const express = require("express");
const protect = require("../middlewares/validateUserToken");
const {
  getAllCanvases,
  createCanvas,
  loadCanvas,
  updateCanvas,
  editCanvas,
  shareCanvas,
  deleteCanvas,
} = require("../controllers/canvasController");

const router = express.Router();
const validate = require("../middlewares/validateCanvasRequest");

router.get("/", protect, getAllCanvases);

router.post("/", protect, validate("create"), createCanvas);

router.get("/load/:id", protect, validate("load"), loadCanvas);

router.put("/:id", protect, validate("update"), updateCanvas);

router.patch("/:id", protect, validate("load"), editCanvas);

router.put("/share/:id", protect, validate("share"), shareCanvas);

router.delete("/:id", protect, validate("delete"), deleteCanvas);

module.exports = router;
