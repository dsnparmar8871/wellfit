import axios from 'axios';

const API_URL_RAW = import.meta.env.VITE_API_URL || '/api';

const getSafeApiBaseUrl = (url) => {
  if (typeof url !== 'string') return '/api';
  const trimmed = url.trim();
  if (!trimmed) return '/api';

  if (trimmed.startsWith('/')) return trimmed;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString().replace(/\/$/, '');
    }
  } catch {
    // Fall through to the safe default.
  }

  return '/api';
};

const API_URL = getSafeApiBaseUrl(API_URL_RAW);

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  allowAbsoluteUrls: false,
});

// Attach access token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Refresh token on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (!original) return Promise.reject(err);
    if (original._skipAuthRefresh) return Promise.reject(err);

    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');
      const userId = localStorage.getItem('userId');
      if (refreshToken && userId) {
        try {
          const { data } = await api.post('/auth/refresh', { refreshToken, userId }, { _skipAuthRefresh: true });
          localStorage.setItem('accessToken', data.data.accessToken);
          original.headers.Authorization = `Bearer ${data.data.accessToken}`;
          return api(original);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────
export const authAPI = {
  register: (d) => api.post('/auth/register', d),
  registerAdmin: (d) => api.post('/auth/register-admin', d),
  login: (d) => api.post('/auth/login', d),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  changePassword: (d) => api.put('/auth/change-password', d),
  forgotPassword: (d) => api.post('/auth/forgot-password', d),
  resetPassword: (d) => api.post('/auth/reset-password', d),
};

// ── Products ───────────────────────────────────────────────────────
export const productAPI = {
  getAll: (p) => api.get('/products', { params: p }),
  getById: (id) => api.get(`/products/${id}`),
  getBySlug: (slug) => api.get(`/products/slug/${slug}`),
  create: (fd) => api.post('/products', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, fd) => api.put(`/products/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id) => api.delete(`/products/${id}`),
  getLowStock: () => api.get('/products/low-stock'),
  updateStock: (id, variantId, d) => api.patch(`/products/${id}/variant/${variantId}/stock`, d),
  getSuggestions: (id) => api.get(`/products/${id}/suggestions`),
  getReviews: (id) => api.get(`/products/${id}/reviews`),
  createReview: (id, fd) => api.post(`/products/${id}/reviews`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

// ── Categories ─────────────────────────────────────────────────────
export const categoryAPI = {
  getAll: () => api.get('/categories'),
  create: (fd) => api.post('/categories', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, fd) => api.put(`/categories/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id) => api.delete(`/categories/${id}`),
};

// ── Orders ─────────────────────────────────────────────────────────
export const orderAPI = {
  create: (d) => api.post('/orders', d),
  createOffline: (d) => api.post('/orders/offline', d),
  getAll: (p) => api.get('/orders', { params: p }),
  getMyOrders: () => api.get('/orders/my'),
  getById: (id) => api.get(`/orders/${id}`),
  updateStatus: (id, d) => api.patch(`/orders/${id}/status`, d),
  assignTailor: (id, d) => api.patch(`/orders/${id}/assign-tailor`, d),
  assignItemMeasurement: (orderId, itemId, d) => api.patch(`/orders/${orderId}/items/${itemId}/measurement`, d),
  exportCSV: () => api.get('/orders/export/csv', { responseType: 'blob' }),
  downloadInvoice: (id) => api.get(`/orders/${id}/invoice`, { responseType: 'blob' }),
  getTailorOrders: (p) => api.get('/orders/tailor/assigned', { params: p }),
  updateTailorStatus: (id, d) => api.patch(`/orders/tailor/${id}/status`, d),
  requestItemReturn: (orderId, itemId, d) => api.post(`/orders/${orderId}/items/${itemId}/return-request`, d),
  getReturnRequests: (p) => api.get('/orders/returns', { params: p }),
  reviewReturnRequest: (orderId, itemId, d) => api.patch(`/orders/${orderId}/items/${itemId}/return-request`, d),
  cancelReturnRequest: (orderId, itemId) => api.delete(`/orders/${orderId}/items/${itemId}/return-request`),
};

// ── Users ──────────────────────────────────────────────────────────
export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (d) => api.put('/users/profile', d),
  addAddress: (d) => api.post('/users/addresses', d),
  updateAddress: (id, d) => api.put(`/users/addresses/${id}`, d),
  deleteAddress: (id) => api.delete(`/users/addresses/${id}`),
  getMyOrders: () => api.get('/users/my-orders'),
  // Admin
  getAllUsers: (p) => api.get('/users/admin/users', { params: p }),
  getUserById: (id) => api.get(`/users/admin/users/${id}`),
   getCustomers: (p) => api.get('/users/admin/customers', { params: p }),
  toggleStatus: (id) => api.patch(`/users/admin/users/${id}/status`),
  deleteUser: (id) => api.delete(`/users/admin/users/${id}`),
  createTailor: (d) => api.post('/users/admin/users/create-tailor', d),
};

// ── Measurements ───────────────────────────────────────────────────
export const measurementAPI = {
  getTemplates: (p) => api.get('/measurements/templates', { params: p }),
  createTemplate: (d) => api.post('/measurements/templates', d),
  updateTemplate: (id, d) => api.put(`/measurements/templates/${id}`, d),
  deleteTemplate: (id) => api.delete(`/measurements/templates/${id}`),
  getSlotAvailability: (date) => api.get('/measurements/slots/availability', { params: { date } }),
  getSlots: (p) => api.get('/measurements/slots/my', { params: p }),
  bookSlot: (d) => api.post('/measurements/slots', d),
  getAdminSlots: (p) => api.get('/measurements/admin/slots', { params: p }),
  getCustomerMeasurements: (id) => api.get(`/measurements/admin/customers/${id}/measurements`),
};

// ── Coupons ────────────────────────────────────────────────────────
export const couponAPI = {
  validate: (d) => api.post('/coupons/validate', d),
  getAvailable: (orderAmount) => api.get('/coupons/available', { params: { orderAmount } }),
  getAll: (p) => api.get('/coupons', { params: p }),
  create: (d) => api.post('/coupons', d),
  update: (id, d) => api.put(`/coupons/${id}`, d),
  delete: (id) => api.delete(`/coupons/${id}`),
};

// ── Payments ───────────────────────────────────────────────────────
export const paymentAPI = {
  createIntent: (d) => api.post('/payments/create-intent', d),
  verify: (d) => api.post('/payments/verify', d),
};

// ── Analytics ──────────────────────────────────────────────────────
export const analyticsAPI = {
  getSummary: () => api.get('/analytics/dashboard'),
  getSales: (p) => api.get('/analytics/sales', { params: p }),
  getTopProducts: () => api.get('/analytics/top-products'),
  getOrdersOverTime: (p) => api.get('/analytics/orders-over-time', { params: p }),
};

// ── Tailor ─────────────────────────────────────────────────────────
export const tailorAPI = {
  getMyOrders: (p) => api.get('/tailor/orders', { params: p }),
  updateStatus: (id, d) => api.patch(`/tailor/orders/${id}/status`, d),
  getBills: (p) => api.get('/tailor/bills', { params: p }),
  generateBill: (d) => api.post('/tailor/bills', d),
  downloadBillPDF: (id) => api.get(`/tailor/bills/${id}/pdf`, { responseType: 'blob' }),
  getStats: () => api.get('/tailor/stats'),
};

// ── Admin ──────────────────────────────────────────────────────────
export const adminAPI = {
  getTailors: (p) => api.get('/tailor/admin/tailors', { params: p }),
  getSlots: (p) => api.get('/measurements/admin/slots', { params: p }),
  updateSlot: (id, d) => api.patch(`/measurements/admin/slots/${id}`, d),
  // Bill management
  getBills: (p) => api.get('/tailor/admin/bills', { params: p }),
  acceptBill: (id, d) => api.patch(`/tailor/admin/bills/${id}/accept`, d),
  updatePaymentStatus: (id, d) => api.patch(`/tailor/admin/bills/${id}/payment-status`, d),
  downloadBillPDF: (id) => api.get(`/tailor/admin/bills/${id}/pdf`, { responseType: 'blob' }),
  exportBillsCSV: () => api.get('/tailor/admin/bills/export/csv', { responseType: 'blob' }),
};

// ── Reviews (Admin) ───────────────────────────────────────────────
export const reviewAPI = {
  getProductReviewsForAdmin: (productId, params) => api.get(`/reviews/product/${productId}`, { params }),
  deleteReview: (reviewId) => api.delete(`/reviews/${reviewId}`),
  pinReview: (reviewId) => api.patch(`/reviews/${reviewId}/pin`, { isPinned: true }),
  unpinReview: (reviewId) => api.patch(`/reviews/${reviewId}/pin`, { isPinned: false }),
  deleteOwnReview: (id) => api.delete(`/reviews/customer/${id}`),
};

export default api;
