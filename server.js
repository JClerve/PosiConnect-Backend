require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const cors = require("cors");

// Connect to DB
connectDB();

const app = express();

// Enable CORS (allow PUT and OPTIONS for preflight)
const corsOptions = {
  origin: "http://localhost:3000", // adjust for production
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
  ],
  credentials: true,
};
app.use(cors(corsOptions));
// ensure preflight requests are handled
app.options("*", cors(corsOptions));

app.use(express.json());

// Redirect backend GET reset-password route to frontend
app.get("/api/auth/reset-password/:token", (req, res) => {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
  const { token } = req.params;
  return res.redirect(`${clientUrl}/reset-password/${token}`);
});

// Routes
const authRoutes = require("./routes/authRoutes");
const communityRoutes = require("./routes/communityRoutes");
const postsRoutes = require("./routes/postsRoutes");
const expertRoutes = require("./routes/expertRoutes");
const sessionsRouter = require("./routes/sessions");
const memberSessionsRoutes = require("./routes/memberSessions"); // <-- new
const paymentRoutes = require("./routes/paymentRoutes"); // <-- added

app.use("/api/auth", authRoutes);
// Post routes nested under community ID (must come before communityRoutes to avoid 404)
app.use("/api/communities/:id/posts", postsRoutes);
// Community routes
app.use("/api/communities", communityRoutes);
app.use("/api/experts", expertRoutes);

app.use("/api/sessions", sessionsRouter);
// Member-specific session routes
app.use("/api/sessions/member", memberSessionsRoutes);

// Payment routes
app.use("/api/payments", paymentRoutes);

// User route for profile
const { protect } = require("./middleware/auth");
app.get("/api/user/me", protect, (req, res) => {
  console.log("Sending user profile, role:", req.user.role);
  res.status(200).json(req.user);
});

// Add a route for debugging
app.get("/api/test", (req, res) => {
  res.status(200).json({ message: "API connection successful" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
