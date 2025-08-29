require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");

// Connect to DB
connectDB();

const app = express();

// Enable CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:3000");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// Redirect backend GET reset-password route to frontend
app.get('/api/auth/reset-password/:token', (req, res) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const { token } = req.params;
  return res.redirect(`${clientUrl}/reset-password/${token}`);
});

// Routes
const authRoutes = require("./routes/authRoutes");
const communityRoutes = require("./routes/communityRoutes");
const postsRoutes = require("./routes/postsRoutes");
const expertRoutes = require('./routes/expertRoutes');

app.use("/api/auth", authRoutes);
// Post routes nested under community ID (must come before communityRoutes to avoid 404)
app.use("/api/communities/:id/posts", postsRoutes);
// Community routes
app.use("/api/communities", communityRoutes);
app.use('/api/experts', expertRoutes);

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
