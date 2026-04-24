const QRCode = require('qrcode');

const generateOrderQR = async (orderNumber) => {
  const data = JSON.stringify({ orderNumber, type: 'wellfit_order', ts: Date.now() });
  const qrDataURL = await QRCode.toDataURL(data, {
    errorCorrectionLevel: 'M',
    width: 250,
    color: { dark: '#A79277', light: '#FFF2E1' },
  });
  return qrDataURL;
};

module.exports = { generateOrderQR };
