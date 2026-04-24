const User = require('../models/User');
const crypto = require('crypto');
const {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  compareToken,
} = require('../utils/jwt');
const { successResponse, errorResponse, handleError } = require('../utils/apiResponse');
const logger = require('../utils/logger');
const { sendEmail } = require('../utils/email');

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return errorResponse(res, 409, 'Email already registered');

    const user = new User({ name, email, phone, passwordHash: password, role: 'customer' });
    await user.save();

    const accessToken = generateAccessToken({ userId: user._id, role: user.role });
    const refreshToken = generateRefreshToken();
    user.refreshTokenHash = await hashToken(refreshToken);
    user.lastLogin = new Date();
    await user.save();

    return successResponse(res, 201, 'Registration successful', {
      user,
      accessToken,
      refreshToken,
    });
  } catch (err) {
    logger.error('Register error:', err);
    return handleError(res, err);
  }
};

// POST /api/auth/register-admin
const registerAdmin = async (req, res) => {
  try {
    const { name, email, phone, password, adminSecret } = req.body;

    const configuredSecret = String(process.env.ADMIN_REGISTER_SECRET || '').trim();
    if (!configuredSecret) {
      return errorResponse(res, 500, 'Admin registration is not configure');
    }

    if (String(adminSecret || '').trim() !== configuredSecret) {
      return errorResponse(res, 403, 'Invalid admin registration code');
    }

    const existing = await User.findOne({ email });
    if (existing) return errorResponse(res, 409, 'Email already registered');

    const user = new User({ name, email, phone, passwordHash: password, role: 'admin' });
    await user.save();

    const accessToken = generateAccessToken({ userId: user._id, role: user.role });
    const refreshToken = generateRefreshToken();
    user.refreshTokenHash = await hashToken(refreshToken);
    user.lastLogin = new Date();
    await user.save();

    return successResponse(res, 201, 'Admin registration successful', {
      user,
      accessToken,
      refreshToken,
    });
  } catch (err) {
    logger.error('Admin register error:', err);
    return handleError(res, err);
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+passwordHash +refreshTokenHash');
    if (!user) return errorResponse(res, 401, 'Invalid credentials');
    if (!user.isActive) {
      return errorResponse(res, 403, 'Your account is deactivated. Contact admin.');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return errorResponse(res, 401, 'Invalid credentials');

    const accessToken = generateAccessToken({ userId: user._id, role: user.role });
    const refreshToken = generateRefreshToken();
    user.refreshTokenHash = await hashToken(refreshToken);
    user.lastLogin = new Date();
    await user.save();

    const userData = user.toJSON();

    return successResponse(res, 200, 'Login successful', {
      user: userData,
      accessToken,
      refreshToken,
    });
  } catch (err) {
    logger.error('Login error:', err);
    return handleError(res, err);
  }
};

// POST /api/auth/refresh
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token, userId } = req.body;
    if (!token || !userId) return errorResponse(res, 400, 'Refresh token and userId required');

    const user = await User.findById(userId).select('+refreshTokenHash');
    if (!user || !user.refreshTokenHash || !user.isActive) {
      return errorResponse(res, 401, 'Invalid refresh token');
    }

    const isValid = await compareToken(token, user.refreshTokenHash);
    if (!isValid) return errorResponse(res, 401, 'Invalid or expired refresh token');

    const newAccessToken = generateAccessToken({ userId: user._id, role: user.role });
    const newRefreshToken = generateRefreshToken();
    user.refreshTokenHash = await hashToken(newRefreshToken);
    await user.save();

    return successResponse(res, 200, 'Token refreshed', {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    logger.error('Refresh token error:', err);
    return handleError(res, err);
  }
};

// POST /api/auth/logout
const logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { refreshTokenHash: null });
    return successResponse(res, 200, 'Logged out successfully');
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  return successResponse(res, 200, 'User profile', { user: req.user });
};

// PUT /api/auth/change-password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+passwordHash');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return errorResponse(res, 400, 'Current password is incorrect');
    if (currentPassword === newPassword) {
      return errorResponse(res, 400, 'New password must be different from old password');
    }

    user.passwordHash = newPassword;
    await user.save();

    return successResponse(res, 200, 'Password changed successfully');
  } catch (err) {
    return handleError(res, err);
  }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) return errorResponse(res, 400, 'Email is required');

    const user = await User.findOne({ email: normalizedEmail, role: { $in: ['customer', 'tailor'] } });
    if (!user || !user.isActive) {
      return successResponse(res, 200, 'If this account exists, a reset code has been sent to your email.');
    }

    const resetCode = String(crypto.randomInt(100000, 999999));
    user.passwordResetCodeHash = await hashToken(resetCode);
    user.passwordResetExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    try {
      await sendEmail({
        to: user.email,
        subject: 'Wellfit Password Reset Code',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#FFF2E1;padding:20px;border-radius:8px;">
            <h2 style="color:#A79277;">Password Reset Request</h2>
            <p>Hello ${user.name},</p>
            <p>Use this verification code to reset your password:</p>
            <div style="font-size:30px;font-weight:700;letter-spacing:4px;color:#2F2621;margin:16px 0;">${resetCode}</div>
            <p>This code expires in 15 minutes.</p>
            <p style="font-size:12px;color:#7A6A5E;">If you did not request this, you can ignore this email.</p>
          </div>
        `,
        text: `Your Wellfit password reset code is ${resetCode}. It expires in 15 minutes.`,
      });
    } catch (emailErr) {
      logger.error('Forgot password email failed:', {
        message: emailErr.message,
        code: emailErr.code,
        responseCode: emailErr.responseCode,
        command: emailErr.command,
      });
    }

    return successResponse(res, 200, 'If this account exists, a reset code has been sent to your email.');
  } catch (err) {
    return handleError(res, err);
  }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail || !code || !newPassword) {
      return errorResponse(res, 400, 'Email, verification code and new password are required');
    }

    const user = await User.findOne({
      email: normalizedEmail,
      role: { $in: ['customer', 'tailor'] },
      isActive: true,
      passwordResetCodeHash: { $ne: null },
      passwordResetExpiresAt: { $gt: new Date() },
    }).select('+passwordHash');

    if (!user) return errorResponse(res, 400, 'Invalid or expired verification code');

    const isValidCode = await compareToken(String(code), user.passwordResetCodeHash);
    if (!isValidCode) return errorResponse(res, 400, 'Invalid or expired verification code');

    const isSameAsOldPassword = await user.comparePassword(newPassword);
    if (isSameAsOldPassword) {
      return errorResponse(res, 400, 'New password must be different from old password');
    }

    user.passwordHash = newPassword;
    user.refreshTokenHash = null;
    user.passwordResetCodeHash = null;
    user.passwordResetExpiresAt = null;
    await user.save();

    return successResponse(res, 200, 'Password reset successful. Please login with your new password.');
  } catch (err) {
    return handleError(res, err);
  }
};

module.exports = { register, registerAdmin, login, refreshToken, logout, getMe, changePassword, forgotPassword, resetPassword };
