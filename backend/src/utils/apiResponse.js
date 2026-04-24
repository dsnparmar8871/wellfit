const successResponse = (res, statusCode = 200, message = 'Success', data = {}) => {
  return res.status(statusCode).json({ success: true, message, data });
};

const errorResponse = (res, statusCode = 500, message = 'Server Error', errors = null) => {
  const response = { success: false, message };
  if (errors) response.errors = errors;
  return res.status(statusCode).json(response);
};

const paginatedResponse = (res, data, page, limit, total) => {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  });
};

// Maps common Mongoose/system errors to proper HTTP status codes
// Use this in every controller catch block instead of always returning 500
const handleError = (res, err) => {
  if (err.name === 'CastError') {
    return errorResponse(res, 400, `Invalid ID format: ${err.value}`);
  }
  if (err.name === 'ValidationError') {
    const structuredErrors = Object.entries(err.errors || {}).map(([field, e]) => ({
      field,
      message: e.message,
    }));
    return errorResponse(res, 400, 'Validation failed', structuredErrors);
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return errorResponse(res, 409, `${field} already exists`);
  }
  return errorResponse(res, 500, err.message || 'Server Error');
};

module.exports = { successResponse, errorResponse, paginatedResponse, handleError };
