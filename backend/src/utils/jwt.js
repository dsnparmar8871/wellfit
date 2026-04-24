const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const generateAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
};

const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

const hashToken = async (token) => {
  return bcrypt.hash(token, 10);
};

const compareToken = async (token, hash) => {
  return bcrypt.compare(token, hash);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  hashToken,
  compareToken,
};
