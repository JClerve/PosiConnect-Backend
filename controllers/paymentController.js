// Load environment variables (idempotent if dotenv is already loaded elsewhere)
require("dotenv").config();

// Use environment variable instead of undefined global
const stripeSecret = process.env.STRIPE_SECRET_KEY;

if (!stripeSecret) {
  console.error(
    "Missing STRIPE_SECRET_KEY in environment. Set STRIPE_SECRET_KEY in backend .env"
  );
}
const stripe = stripeSecret ? require("stripe")(stripeSecret) : null;
const Payment = require("../models/Payment");

exports.createPaymentIntent = async (req, res) => {
  try {
    console.log("=== createPaymentIntent DEBUG ===");
    console.log("Request body:", req.body);
    console.log(
      "User:",
      req.user ? { id: req.user._id, email: req.user.email } : "No user"
    );

    if (!stripe) {
      console.error(
        "Stripe not initialized because STRIPE_SECRET_KEY is missing."
      );
      return res
        .status(500)
        .json({ error: "Payment subsystem not configured on server" });
    }

    const { amount, currency = "usd", sessionId } = req.body;

    // Validate required fields
    if (!amount && amount !== 0) {
      return res.status(400).json({ error: "Amount is required" });
    }

    if (!sessionId) {
      return res.status(400).json({ error: "SessionId is required" });
    }

    // Convert to cents
    const toCents = (a) => {
      if (a == null) return 0;
      const n = Number(a);
      if (Number.isNaN(n)) return 0;
      return Math.round(n >= 100 ? n : n * 100);
    };

    const amountCents = toCents(amount);
    if (amountCents <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const normalizedCurrency = currency.toLowerCase();

    // Create customer first (required for Indian regulations)
    let customerId = null;
    if (req.user) {
      try {
        const customerData = {
          email: req.user.email,
          name:
            `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() ||
            req.user.email,
          address: {
            line1: "123 Default Street", // You should get real address from user profile
            city: "Default City",
            state: "Default State",
            postal_code: "12345",
            country: "IN", // Set appropriate country code
          },
          metadata: {
            userId: String(req.user._id),
          },
        };

        const customer = await stripe.customers.create(customerData);
        customerId = customer.id;
        console.log("Created Stripe customer:", customerId);
      } catch (customerError) {
        console.error("Failed to create customer:", customerError);
        return res
          .status(500)
          .json({ error: "Failed to create customer for payment" });
      }
    }

    // Create PaymentIntent with customer and compliance info
    const paymentIntentData = {
      amount: amountCents,
      currency: normalizedCurrency,
      description: `Online session service payment - Session: ${sessionId}`,
      customer: customerId, // Required for Indian regulations
      metadata: {
        sessionId: sessionId || "",
        userId: req.user ? String(req.user._id) : "",
        service_type: "online_session",
        export_type: "service_export",
      },
    };

    console.log("Creating PaymentIntent with customer:", paymentIntentData);

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

    console.log("PaymentIntent created successfully:", {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      customer: paymentIntent.customer,
    });

    return res.json({
      clientSecret: paymentIntent.client_secret,
      publishableKey: process.env.STRIPE_PUBLIC_KEY || "",
    });
  } catch (err) {
    console.error("=== createPaymentIntent ERROR ===");
    console.error("Error message:", err.message);
    console.error("Full error:", err);

    return res.status(500).json({
      error: "Failed to create payment intent",
      details: process.env.NODE_ENV !== "production" ? err.message : undefined,
    });
  }
};

// record completed payment after client confirms (no webhook used)
exports.recordPayment = async (req, res) => {
  try {
    console.log("=== recordPayment DEBUG ===");
    console.log("Request body:", req.body);

    if (!stripe) {
      console.error(
        "Stripe not initialized because STRIPE_SECRET_KEY is missing."
      );
      return res
        .status(500)
        .json({ error: "Payment subsystem not configured on server" });
    }

    const { paymentIntentId, sessionId } = req.body;
    if (!paymentIntentId) {
      console.error("Missing paymentIntentId");
      return res.status(400).json({ error: "paymentIntentId required" });
    }

    console.log("Retrieving PaymentIntent:", paymentIntentId);
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    console.log("Retrieved PaymentIntent:", {
      id: intent.id,
      status: intent.status,
      amount: intent.amount,
    });

    const payment = new Payment({
      member: req.user ? req.user._id : undefined,
      session: sessionId || intent.metadata.sessionId || "",
      amount: intent.amount,
      currency: intent.currency,
      stripePaymentIntentId: intent.id,
      status: intent.status,
      raw: intent,
    });

    console.log("Saving payment to database:", {
      member: payment.member,
      session: payment.session,
      amount: payment.amount,
    });

    await payment.save();
    console.log("Payment saved successfully");

    return res.json({ success: true, payment });
  } catch (err) {
    console.error("=== recordPayment ERROR ===");
    console.error("Error message:", err.message);
    console.error("Full error:", err);
    return res.status(500).json({ error: "Failed to record payment" });
  }
};
