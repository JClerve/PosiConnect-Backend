const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const sendEmail = require("../utils/email");

// Generate JWT token
const signToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

// Forgot password: send reset token
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "No user with that email" });
    }

    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // Frontend URL for resetting password
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const resetURL = `${clientUrl}/reset-password/${resetToken}`;
    const message = `You requested a password reset. Click the link to set a new password: ${resetURL}`;

    await sendEmail({
      email: user.email,
      subject: "Password Reset",
      message,
    });

    res.status(200).json({ message: "Token sent to email" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error sending email" });
  }
};

// Reset password: update password
exports.resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    if (!password || !confirmPassword) {
      return res.status(400).json({ message: "Please provide both passwords" });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });
    if (!user) {
      return res.status(400).json({ message: "Token is invalid or expired" });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    const token = signToken(user._id, user.role);
    res.status(200).json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error resetting password" });
  }
};

// @desc    Register new user
// @route   POST /api/auth/signup
// @access  Public
exports.signup = async (req, res) => {
  try {
    // Extract signup fields, including expert-specific data
    const { firstName, lastName, email, password, role = "member", hourlyRate, expertise } = req.body;
    
    // Build user payload with basic required fields
    const newUserData = { 
      firstName, 
      lastName, 
      email, 
      password, 
      role 
    };
    
    // Add expert-specific fields only if role is expert
    if (role === "expert") {
      // Validate expert-specific data before adding to payload
      if (hourlyRate === undefined || hourlyRate === null || hourlyRate === '') {
        return res.status(400).json({ 
          message: 'Hourly rate is required for experts' 
        });
      }
      
      if (!expertise || !Array.isArray(expertise) || expertise.length === 0) {
        return res.status(400).json({ 
          message: 'At least one area of expertise is required for experts' 
        });
      }
      
      const numericRate = Number(hourlyRate);
      if (isNaN(numericRate) || numericRate <= 0) {
        return res.status(400).json({ 
          message: 'Hourly rate must be a valid number greater than 0' 
        });
      }
      
      // Add expert fields to user data
      newUserData.hourlyRate = numericRate;
      newUserData.expertise = expertise;
    }
    
    console.log('Creating new user with data:', newUserData);
    
    // Create user
    const user = await User.create(newUserData);
    
    // Generate token
    const token = signToken(user._id, user.role);
    
    res.status(201).json({ 
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      }
    });
    
  } catch (err) {
    console.error('Signup error:', err);
    
    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({ 
        message: messages.join('. '),
        errors: err.errors
      });
    }
    
    // Handle duplicate email error
    if (err.code === 11000) {
      return res.status(400).json({ 
        message: 'Email already exists' 
      });
    }
    
    // Generic error response
    res.status(500).json({ 
      message: err.message || 'Error creating account' 
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        message: "Please provide email and password" 
      });
    }
    
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ 
        message: "Incorrect email or password" 
      });
    }
    
    const token = signToken(user._id, user.role);
    
    res.status(200).json({ 
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      }
    });
    
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ 
      message: "Error logging in" 
    });
  }
};