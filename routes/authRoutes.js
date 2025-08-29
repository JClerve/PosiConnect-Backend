const express = require("express");
const {
  forgotPassword,
  resetPassword,
  signup,
  login,
} = require("../controllers/authController");

const router = express.Router();

// @route POST /api/auth/forgot-password
router.post("/forgot-password", forgotPassword);

// @route PATCH /api/auth/reset-password/:token
router.patch("/reset-password/:token", resetPassword);

// @route POST /api/auth/signup
router.post("/signup", signup);
// @route POST /api/auth/login
router.post("/login", login);

module.exports = router;
