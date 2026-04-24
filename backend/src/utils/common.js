// ── Shared Utility Functions ──────────────────────────────────────

// Escape special regex characters
const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Build phone search pattern for regex
const buildPhoneSearchPattern = (value = '') => {
  const digits = String(value).replace(/\D/g, '');
  if (digits.length < 3) return null;
  return digits.split('').map((digit) => `${digit}\\D*`).join('');
};

// Normalize category tokens for comparison
const normalizeCategoryToken = (value) => {
  let normalized = String(value || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Handle quoted values
  normalized = normalized.replace(/^(["'])\s*(.*\S)\s*\1$/, '$2');
  return normalized;
};

// Convert to comparable form
const toComparableCategoryToken = (value) => normalizeCategoryToken(value).toLowerCase();

// Convert to number with fallback
const asNumber = (value) => {
  if (value === undefined || value === null || value === '') return NaN;
  return Number(value);
};

// Check if a date is in the past
const isPastDate = (value) => {
  if (!value) return false;
  const selected = new Date(`${value}T00:00:00`);
  if (Number.isNaN(selected.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return selected < today;
};

module.exports = {
  escapeRegex,
  buildPhoneSearchPattern,
  normalizeCategoryToken,
  toComparableCategoryToken,
  asNumber,
  isPastDate,
};
