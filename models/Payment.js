const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    session: { type: String, required: false },
    amount: { type: Number, required: true }, // cents
    currency: { type: String, default: "usd" },
    stripePaymentIntentId: { type: String, required: true },
    status: { type: String },
    raw: { type: Object },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", PaymentSchema);
