export const formatPrice = (price) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);

export const formatDate = (d) =>
  d ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)) : '—';

export const formatDateTime = (d) =>
  d ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d)) : '—';

export const getErrorMsg = (err) =>
  err?.response?.data?.message || err?.message || 'Something went wrong';

export const STRONG_PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
export const PASSWORD_RULE_MESSAGE = 'Password must be at least 8 characters and include at least 1 uppercase letter, 1 number, and 1 special character';
export const isStrongPassword = (password = '') => STRONG_PASSWORD_REGEX.test(password);

export const statusBadgeClass = (status) => {
  const map = {
    received: 'badge-info', tailoring: 'badge-warning', processing: 'badge-warning',
    ready: 'badge-success', delivered: 'badge-success', cancelled: 'badge-error',
    pending: 'badge-grey', requested: 'badge-warning', approved: 'badge-success', rejected: 'badge-error', refunded: 'badge-info',
    paid: 'badge-success', done: 'badge-success', active: 'badge-success', inactive: 'badge-error',
  };
  return map[status?.toLowerCase()] || 'badge-grey';
};

export const truncate = (str, n = 80) => str?.length > n ? str.slice(0, n) + '…' : str;

export const getImageUrl = (path) => {
  if (!path) return 'https://placehold.co/400x500/FFF2E1/A79277?text=Wellfit';
  const source = String(path).trim();
  if (!source) return 'https://placehold.co/400x500/FFF2E1/A79277?text=Wellfit';
  if (source.startsWith('http://') || source.startsWith('https://')) return source;

  const baseUrl = (import.meta.env.VITE_API_URL?.replace('/api', '') || '').replace(/\/$/, '');
  const normalizedPath = source.startsWith('/') ? source : `/${source}`;
  return `${baseUrl}${normalizedPath}`;
};

export const getInStockVariants = (product) => {
  if (!Array.isArray(product?.variants)) return [];
  return product.variants.filter((variant) => Number(variant?.stock || 0) > 0);
};

export const hasPurchasableStock = (product) => {
  const inStockVariants = getInStockVariants(product);
  if (Array.isArray(product?.variants) && product.variants.length > 0) {
    return inStockVariants.length > 0;
  }
  return Number(product?.totalStock ?? product?.stock ?? 0) > 0;
};
