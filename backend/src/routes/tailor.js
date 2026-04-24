const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getTailorStats, generateBill, getMyBills,
  downloadTailorBillPDF, getAllBills, acceptBill, updatePaymentStatus, exportBillsCSV, getAllTailors, downloadAdminBillPDF,
} = require('../controllers/tailorController');

// Tailor routes
router.get('/stats', authenticate, authorize('tailor'), getTailorStats);
router.post('/bills', authenticate, authorize('tailor'), generateBill);
router.get('/bills', authenticate, authorize('tailor'), getMyBills);
router.get('/bills/:id/pdf', authenticate, authorize('tailor'), downloadTailorBillPDF);

// Admin routes - CSV export BEFORE :id routes to prevent conflict
router.get('/admin/bills/export/csv', authenticate, authorize('admin'), exportBillsCSV);
router.get('/admin/bills/:id/pdf', authenticate, authorize('admin'), downloadAdminBillPDF);
router.get('/admin/tailors', authenticate, authorize('admin'), getAllTailors);
router.get('/admin/bills', authenticate, authorize('admin'), getAllBills);
router.patch('/admin/bills/:id/accept', authenticate, authorize('admin'), acceptBill);
router.patch('/admin/bills/:id/payment-status', authenticate, authorize('admin'), updatePaymentStatus);

module.exports = router;
