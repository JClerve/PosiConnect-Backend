const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema(
  {
    expert: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    community: { type: mongoose.Schema.Types.ObjectId, ref: "Community" },
    date: { type: String, required: true }, // YYYY-MM-DD
    startTime: { type: String, required: true }, // HH:MM
    endTime: { type: String, required: true },
    heading: { type: String, required: true },
    description: { type: String },
    specialNote: { type: String },
    price: { type: Number, default: 0 },
    status: { type: String, default: "scheduled" },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Add participants so members can join sessions
  },
  { timestamps: true }
);

module.exports = mongoose.model("Session", SessionSchema);
