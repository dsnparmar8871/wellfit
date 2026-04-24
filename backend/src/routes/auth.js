const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const {
  register, registerAdmin, login, refreshToken, logout, getMe, changePassword, forgotPassword, resetPassword,
} = require('../controllers/authController');

const STRONG_PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_RULE_MESSAGE = 'Password must be at least 8 characters and include at least 1 uppercase letter, 1 number, and 1 special character';

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').matches(STRONG_PASSWORD_REGEX).withMessage(PASSWORD_RULE_MESSAGE),
  ],
  validate,
  register
);

router.post(
  '/register-admin',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').matches(STRONG_PASSWORD_REGEX).withMessage(PASSWORD_RULE_MESSAGE),
    body('adminSecret').trim().notEmpty().withMessage('Admin registration code is required'),
  ],
  validate,
  registerAdmin
);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  validate,
  login
);

router.post(
  '/refresh',
  [
    body('refreshToken').notEmpty().withMessage('Refresh token required'),
    body('userId').notEmpty().withMessage('User ID required'),
  ],
  validate,
  refreshToken
);

router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);

router.put(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword').matches(STRONG_PASSWORD_REGEX).withMessage(PASSWORD_RULE_MESSAGE),
  ],
  validate,
  changePassword
);

router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail().withMessage('Valid email required')],
  validate,
  forgotPassword
);

router.post(
  '/reset-password',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('code').isLength({ min: 6, max: 6 }).withMessage('6-digit verification code required'),
    body('newPassword').matches(STRONG_PASSWORD_REGEX).withMessage(PASSWORD_RULE_MESSAGE),
  ],
  validate,
  resetPassword
);

module.exports = router;
