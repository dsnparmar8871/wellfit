const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');
const { errorResponse } = require('../utils/apiResponse');
const logger = require('../utils/logger');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 401, 'Access token missing or malformed');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    const user = await User.findById(decoded.userId).select('-passwordHash -refreshTokenHash');
    if (!user || !user.isActive) {
      return errorResponse(res, 401, 'User not found or account deactivated');
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return errorResponse(res, 401, 'Access token expired');
    }
    if (err.name === 'JsonWebTokenError') {
      return errorResponse(res, 401, 'Invalid access token');
    }
    logger.error('Auth middleware error:', err);
    return errorResponse(res, 500, 'Authentication error');
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return errorResponse(res, 401, 'Not authenticated');
    if (!roles.includes(req.user.role)) {
      return errorResponse(res, 403, `Access denied. Requires role: ${roles.join(' or ')}`);
    }
    next();
  };
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.userId).select('-passwordHash -refreshTokenHash');
    if (user && user.isActive) req.user = user;
  } catch (_) {
    // silently ignore
  }
  next();
};

module.exports = { authenticate, authorize, optionalAuth };
