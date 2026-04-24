const MeasurementTemplate = require('../models/MeasurementTemplate');
const MeasurementSlot = require('../models/MeasurementSlot');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { successResponse, errorResponse, paginatedResponse, handleError } = require('../utils/apiResponse');
const { sendEmail, templates } = require('../utils/email');
const { escapeRegex, buildPhoneSearchPattern } = require('../utils/common');
const logger = require('../utils/logger');


const SHOP_OPEN_HOUR = 9;
const SHOP_CLOSE_HOUR = 22;
const SLOT_INTERVAL_MINUTES = 10;

const isDuplicateKeyError = (err) => err && err.code === 11000;

const isWithinShopHours = (date) => {
  const h = date.getHours();
  const m = date.getMinutes();
  if (h < SHOP_OPEN_HOUR) return false;
  if (h > SHOP_CLOSE_HOUR) return false;
  if (h === SHOP_CLOSE_HOUR && m > 0) return false;
  return true;
};

const isOnSlotBoundary = (date) => date.getMinutes() % SLOT_INTERVAL_MINUTES === 0 && date.getSeconds() === 0 && date.getMilliseconds() === 0;

// ---- MEASUREMENT TEMPLATES ----

// GET /api/measurements/templates
const getTemplates = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const customerId = isAdmin && req.query.customer ? req.query.customer : req.user._id;
    const filter = { customer: customerId };
    if (req.query.garmentType) filter.garmentType = req.query.garmentType;
    const templates = await MeasurementTemplate.find(filter).sort({ createdAt: -1 });

    // Prevent any accidental cross-user cache reuse for authenticated template data.
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    // Defense-in-depth: even if query logic changes, non-admins only get their own templates.
    const safeTemplates = isAdmin
      ? templates
      : templates.filter((template) => String(template.customer) === String(req.user._id));
    return successResponse(res, 200, 'Measurement templates', { templates: safeTemplates });
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/measurements/templates/:id
const getTemplateById = async (req, res) => {
  try {
    const query = { _id: req.params.id };
    if (req.user.role !== 'admin') query.customer = req.user._id;
    const template = await MeasurementTemplate.findOne(query);
    if (!template) return errorResponse(res, 404, 'Template not found');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    return successResponse(res, 200, 'Template fetched', { template });
  } catch (err) {
    return handleError(res, err);
  }
};

// POST /api/measurements/templates
const createTemplate = async (req, res) => {
  try {
    const { garmentType, name, measurements, notes } = req.body;
    const isAdmin = req.user.role === 'admin';
    const customerId = isAdmin && req.body.customer ? req.body.customer : req.user._id;
    const referencePhotos = req.files
      ? req.files.map((f) => f.location || `/uploads/${f.filename}`)
      : req.body.referencePhotos || [];

    if (req.body.isDefault) {
      await MeasurementTemplate.updateMany({ customer: customerId, garmentType }, { isDefault: false });
    }

    const template = new MeasurementTemplate({
      customer: customerId,
      garmentType,
      name,
      measurements: typeof measurements === 'string' ? JSON.parse(measurements) : measurements,
      notes,
      referencePhotos,
      isDefault: req.body.isDefault || false,
    });
    await template.save();
    return successResponse(res, 201, 'Template created', { template });
  } catch (err) {
    return handleError(res, err);
  }
};

// PUT /api/measurements/templates/:id
const updateTemplate = async (req, res) => {
  try {
    const { name, measurements, notes, isDefault, garmentType } = req.body;
    const query = { _id: req.params.id };
    if (req.user.role !== 'admin') query.customer = req.user._id;
    const template = await MeasurementTemplate.findOne(query);
    if (!template) return errorResponse(res, 404, 'Template not found');

    if (isDefault) {
      await MeasurementTemplate.updateMany({ customer: template.customer, garmentType: template.garmentType }, { isDefault: false });
    }
    if (name) template.name = name;
    if (garmentType) template.garmentType = garmentType;
    if (measurements) template.measurements = typeof measurements === 'string' ? JSON.parse(measurements) : measurements;
    if (notes !== undefined) template.notes = notes;
    if (isDefault !== undefined) template.isDefault = isDefault;
    if (req.files && req.files.length > 0) {
      template.referencePhotos = req.files.map((f) => f.location || `/uploads/${f.filename}`);
    }
    await template.save();
    return successResponse(res, 200, 'Template updated', { template });
  } catch (err) {
    return handleError(res, err);
  }
};

// DELETE /api/measurements/templates/:id
const deleteTemplate = async (req, res) => {
  try {
    const query = { _id: req.params.id };
    if (req.user.role !== 'admin') query.customer = req.user._id;
    const result = await MeasurementTemplate.findOneAndDelete(query);
    if (!result) return errorResponse(res, 404, 'Template not found');
    return successResponse(res, 200, 'Template deleted');
  } catch (err) {
    return handleError(res, err);
  }
};

// ---- MEASUREMENT SLOTS ----

// GET /api/measurements/slots/availability
const getSlotAvailability = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return errorResponse(res, 400, 'Date query param required');

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const bookedSlots = await MeasurementSlot.find({
      dateTime: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['pending', 'approved'] },
    }).select('dateTime status');

    return successResponse(res, 200, 'Slot availability', { date, bookedSlots });
  } catch (err) {
    return handleError(res, err);
  }
};

// POST /api/measurements/slots
const bookSlot = async (req, res) => {
  try {
    const { dateTime, garmentType, notes, orderRef } = req.body;
    const slotDate = new Date(dateTime);

    if (orderRef) {
      const existingOrderSlot = await MeasurementSlot.findOne({
        customer: req.user._id,
        orderRef,
      }).select('_id status');

      if (existingOrderSlot) {
        return errorResponse(res, 409, 'Measurement slot already exists for this order');
      }
    }

    if (Number.isNaN(slotDate.getTime())) {
      return errorResponse(res, 400, 'Invalid slot date/time');
    }

    if (!isOnSlotBoundary(slotDate)) {
      return errorResponse(res, 400, 'Measurement time must be in 10-minute intervals');
    }

    if (!isWithinShopHours(slotDate)) {
      return errorResponse(res, 400, 'Booking allowed only between 09:00 AM and 10:00 PM');
    }

    if (slotDate < new Date()) {
      return errorResponse(res, 400, 'Booking date and time must be in the future');
    }

    // Check for conflicts (within 10 minutes)
    const conflictWindow = 10 * 60 * 1000;
    const existing = await MeasurementSlot.findOne({
      dateTime: { $gt: new Date(slotDate - conflictWindow), $lt: new Date(slotDate.getTime() + conflictWindow) },
      status: { $in: ['pending', 'approved'] },
    });
    if (existing) return errorResponse(res, 409, 'This time slot is already booked. Please choose another time.');

    const slot = new MeasurementSlot({
      customer: req.user._id,
      dateTime: slotDate,
      garmentType,
      notes,
      orderRef,
    });
    await slot.save();
    return successResponse(res, 201, 'Slot booked. Awaiting confirmation.', { slot });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return errorResponse(res, 409, 'This time slot was just booked by another user. Please choose another time.');
    }
    return handleError(res, err);
  }
};

// GET /api/measurements/slots/my
const getMySlots = async (req, res) => {
  try {
    const slots = await MeasurementSlot.find({ customer: req.user._id }).sort({ dateTime: -1 });
    return successResponse(res, 200, 'Your measurement slots', { slots });
  } catch (err) {
    return handleError(res, err);
  }
};

// DELETE /api/measurements/slots/:id (customer cancel)
const cancelSlot = async (req, res) => {
  try {
    const slot = await MeasurementSlot.findOne({ _id: req.params.id, customer: req.user._id });
    if (!slot) return errorResponse(res, 404, 'Slot not found');
    if (!['pending', 'approved'].includes(slot.status)) {
      return errorResponse(res, 400, 'Cannot cancel this slot');
    }
    slot.status = 'cancelled';
    slot.cancelReason = req.body.reason;
    await slot.save();
    return successResponse(res, 200, 'Slot cancelled', { slot });
  } catch (err) {
    return handleError(res, err);
  }
};

// ---- ADMIN SLOT MANAGEMENT ----

// GET /api/admin/measurements/slots
const getAllSlots = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.from || req.query.to) {
      filter.dateTime = {};
      if (req.query.from) filter.dateTime.$gte = new Date(req.query.from);
      if (req.query.to) filter.dateTime.$lte = new Date(req.query.to);
    }
    if (req.query.search) {
      const rawSearch = String(req.query.search).trim();
      if (rawSearch) {
        const searchRegex = new RegExp(escapeRegex(rawSearch), 'i');
        const phonePattern = buildPhoneSearchPattern(rawSearch);
        const customerOr = [
          { name: { $regex: searchRegex } },
          { email: { $regex: searchRegex } },
          { phone: { $regex: searchRegex } },
        ];
        if (phonePattern) customerOr.push({ phone: { $regex: phonePattern, $options: 'i' } });
        const customers = await User.find({ $or: customerOr }).select('_id').lean();
        filter.customer = { $in: customers.map((c) => c._id) };
      }
    }
    const [slots, total] = await Promise.all([
      MeasurementSlot.find(filter)
        .populate('customer', 'name email phone')
        .populate('orderRef', 'orderNumber')
        .sort({ dateTime: 1 })
        .skip(skip)
        .limit(limit),
      MeasurementSlot.countDocuments(filter),
    ]);
    return paginatedResponse(res, slots, page, limit, total);
  } catch (err) {
    return handleError(res, err);
  }
};

// PATCH /api/admin/measurements/slots/:id
const updateSlotStatus = async (req, res) => {
  try {
    const { status, adminNotes, rescheduledTo } = req.body;
    const validStatuses = ['approved', 'rejected', 'completed'];
    if (!validStatuses.includes(status)) return errorResponse(res, 400, 'Invalid status');

    const slot = await MeasurementSlot.findById(req.params.id).populate('customer', 'name email');
    if (!slot) return errorResponse(res, 404, 'Slot not found');

    // If slot was booked against an order, it cannot be rejected.
    if (slot.orderRef && status === 'rejected') {
      return errorResponse(res, 400, 'Order-linked slot requests cannot be rejected. Use approve or reschedule.');
    }

    slot.status = status;
    if (adminNotes) slot.adminNotes = adminNotes;
    if (rescheduledTo) {
      const rescheduledDate = new Date(rescheduledTo);
      if (Number.isNaN(rescheduledDate.getTime())) return errorResponse(res, 400, 'Invalid rescheduled date/time');
      if (!isOnSlotBoundary(rescheduledDate)) return errorResponse(res, 400, 'Measurement time must be in 10-minute intervals');
      if (!isWithinShopHours(rescheduledDate)) return errorResponse(res, 400, 'Booking allowed only between 09:00 AM and 10:00 PM');
      slot.rescheduledTo = rescheduledDate;
      slot.status = 'approved';
    }
    await slot.save();

    // Send notification
    try {
      let tpl;
      if (status === 'approved' || rescheduledTo) {
        tpl = templates.slotApproved(slot, slot.customer);
      } else if (status === 'rejected') {
        tpl = templates.slotRejected(slot, slot.customer);
      }
      if (tpl) {
        await sendEmail({ to: slot.customer.email, ...tpl });
        await new Notification({
          recipient: slot.customer._id,
          type: status === 'approved' ? 'slot_approved' : 'slot_rejected',
          subject: tpl.subject,
          body: `Measurement slot ${status}`,
          status: 'sent',
          sentAt: new Date(),
        }).save();
      }
    } catch (e) {
      logger.warn('Slot status email failed:', e.message);
    }

    return successResponse(res, 200, `Slot ${status}`, { slot });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return errorResponse(res, 409, 'This time slot is already booked. Please choose another time.');
    }
    return handleError(res, err);
  }
};

// GET /api/admin/customers/:id/measurements
const getCustomerMeasurements = async (req, res) => {
  try {
    const templates = await MeasurementTemplate.find({ customer: req.params.id }).sort({ createdAt: -1 });
    const slots = await MeasurementSlot.find({ customer: req.params.id }).sort({ dateTime: -1 }).limit(10);
    return successResponse(res, 200, 'Customer measurements', { templates, slots });
  } catch (err) {
    return handleError(res, err);
  }
};

module.exports = {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getSlotAvailability,
  bookSlot,
  getMySlots,
  cancelSlot,
  getAllSlots,
  updateSlotStatus,
  getCustomerMeasurements,
};
