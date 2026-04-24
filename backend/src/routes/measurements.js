const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');
const {
  getTemplates, getTemplateById, createTemplate, updateTemplate, deleteTemplate,
  getSlotAvailability, bookSlot, getMySlots, cancelSlot,
  getAllSlots, updateSlotStatus, getCustomerMeasurements,
} = require('../controllers/measurementController');

// Templates (customer)
router.get('/templates', authenticate, getTemplates);
router.get('/templates/:id', authenticate, getTemplateById);
router.post('/templates', authenticate, upload.array('referencePhotos', 3), createTemplate);
router.put('/templates/:id', authenticate, upload.array('referencePhotos', 3), updateTemplate);
router.delete('/templates/:id', authenticate, deleteTemplate);

// Slots (customer)
router.get('/slots/availability', getSlotAvailability);
router.get('/slots/my', authenticate, getMySlots);
router.post('/slots', authenticate, bookSlot);
router.delete('/slots/:id', authenticate, cancelSlot);

// Admin slot management
router.get('/admin/slots', authenticate, authorize('admin'), getAllSlots);
router.patch('/admin/slots/:id', authenticate, authorize('admin'), updateSlotStatus);
router.get('/admin/customers/:id/measurements', authenticate, authorize('admin'), getCustomerMeasurements);

module.exports = router;
