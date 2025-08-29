const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
    },
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"],
    },
    role: { type: String, enum: ["member", "expert"], default: "member" },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    profilePicture: { type: String, default: "" },
    bio: {
      type: String,
      maxlength: [500, "Bio cannot exceed 500 characters"],
      default: "",
    },
    expertise: [
      {
        type: String,
        required: function () {
          return this.role === "expert";
        },
        validate: {
          validator: function(v) {
            // Only validate if role is expert
            if (this.role === "expert") {
              return Array.isArray(this.expertise) && this.expertise.length > 0;
            }
            return true;
          },
          message: "At least one area of expertise is required for experts"
        }
      },
    ],
    qualifications: [{ degree: String, institution: String, year: Number }],
    hourlyRate: {
      type: Number,
      required: [
        function () {
          return this.role === "expert";
        },
        "Hourly rate is required for experts"
      ],
      min: [1, "Hourly rate must be at least 1"],
      validate: {
        validator: function(v) {
          // Only validate if role is expert
          if (this.role === "expert") {
            return v != null && v > 0;
          }
          return true;
        },
        message: "Hourly rate must be greater than 0 for experts"
      }
    },
    availability: {
      type: Map,
      of: [{ startTime: String, endTime: String }],
      default: new Map(),
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 });
userSchema.index({ role: 1 });

// Pre-validate middleware to ensure expert-specific fields
userSchema.pre("validate", function(next) {
  if (this.role === "expert") {
    // Ensure hourlyRate is provided and valid
    if (!this.hourlyRate || this.hourlyRate <= 0) {
      const error = new Error("Hourly rate is required and must be greater than 0 for experts");
      error.name = "ValidationError";
      return next(error);
    }
    
    // Ensure expertise array is provided and not empty
    if (!this.expertise || !Array.isArray(this.expertise) || this.expertise.length === 0) {
      const error = new Error("At least one area of expertise is required for experts");
      error.name = "ValidationError";
      return next(error);
    }
  }
  next();
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.createEmailVerificationToken = function () {
  const crypto = require("crypto");
  const token = crypto.randomBytes(32).toString("hex");

  this.emailVerificationToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;

  return token;
};

userSchema.methods.createPasswordResetToken = function () {
  const crypto = require("crypto");
  const token = crypto.randomBytes(32).toString("hex");

  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return token;
};

userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.emailVerificationToken;
  delete userObject.emailVerificationExpires;
  delete userObject.passwordResetToken;
  delete userObject.passwordResetExpires;
  return userObject;
};

module.exports = mongoose.model("User", userSchema);