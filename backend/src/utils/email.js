const nodemailer = require('nodemailer');
const logger = require('./logger');

let transporter = null;

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const normalizeSmtpPassword = (host, rawPassword) => {
  const password = String(rawPassword || '');
  const isGmail = /gmail\./i.test(String(host || ''));

  // Gmail app passwords are commonly copied with spaces in 4-char chunks.
  if (isGmail) return password.replace(/\s+/g, '');
  return password;
};

const getTransporter = () => {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const secure = process.env.SMTP_SECURE !== undefined
    ? toBool(process.env.SMTP_SECURE)
    : port === 465;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: toBool(process.env.SMTP_REQUIRE_TLS, false),
    auth: {
      user: process.env.SMTP_USER,
      pass: normalizeSmtpPassword(host, process.env.SMTP_PASS),
    },
  });

  return transporter;
};

const sendEmail = async ({ to, subject, html, text }) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    logger.info(`[EMAIL SIMULATED] To: ${to} | Subject: ${subject}`);
    return { simulated: true };
  }

  try {
    const info = await getTransporter().sendMail({
      from: `"${process.env.FROM_NAME || 'Wellfit Menswear'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      text,
    });
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (err) {
    logger.error(`Email failed to ${to}: ${err.message}`);
    throw err;
  }
};

const getBrandLogoUrl = () => {
  if (process.env.BRAND_LOGO_URL) return process.env.BRAND_LOGO_URL;
  if (process.env.FRONTEND_URL) return `${process.env.FRONTEND_URL.replace(/\/$/, '')}/wellfit-logo.png`;
  return '';
};

const renderEmailLayout = (innerHtml) => {
  const logoUrl = getBrandLogoUrl();
  const logoCell = logoUrl
    ? `<td style="vertical-align:middle;padding-right:12px;"><img src="${logoUrl}" alt="Wellfit" style="height:56px;width:auto;display:block;" /></td>`
    : '';

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#FFF2E1;padding:20px;border-radius:8px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:14px;">
        <tr>
          ${logoCell}
          <td style="vertical-align:middle;">
            <div style="font-size:36px;line-height:1;color:#5B2F2A;font-weight:700;">Wellfit</div>
            <div style="font-size:11px;color:#7A6A5D;letter-spacing:1.5px;text-transform:uppercase;margin-top:2px;">Menswear &amp; Selection</div>
          </td>
        </tr>
      </table>
      ${innerHtml}
    </div>
  `;
};

// Email Templates
const templates = {
  orderConfirmation: (order, user) => ({
    subject: `Order Confirmed - ${order.orderNumber} | Wellfit Menswear`,
    html: renderEmailLayout(`
        <h2 style="color:#A79277;">Thank you for your order, ${user.name}!</h2>
        <p>Your order <strong>${order.orderNumber}</strong> has been confirmed.</p>
        <div style="background:#fff;padding:15px;border-radius:6px;margin:15px 0;">
          <h3 style="color:#A79277;">Order Summary</h3>
          ${order.items.map(i => `<p>${i.qty}x ${i.product?.name || 'Product'} — ₹${i.price}</p>`).join('')}
          <hr/>
          <p><strong>Total: ₹${order.totalAmount}</strong></p>
          <p>Payment Method: ${order.paymentMethod}</p>
        </div>
        <p>We'll notify you when your order status changes.</p>
        <p style="color:#A79277;font-size:12px;">Wellfit Menswear &amp; Selection</p>
    `),
  }),

  orderStatusUpdate: (order, user) => ({
    subject: `Order ${order.orderNumber} — Status Updated | Wellfit Menswear`,
    html: renderEmailLayout(`
        <h2 style="color:#A79277;">Order Status Update</h2>
        <p>Hi ${user.name}, your order <strong>${order.orderNumber}</strong> status has been updated.</p>
        <div style="background:#fff;padding:15px;border-radius:6px;">
          <p><strong>Current Status:</strong> <span style="color:#A79277;text-transform:uppercase;">${order.status}</span></p>
          ${order.deliveryDate ? `<p><strong>Estimated Delivery:</strong> ${new Date(order.deliveryDate).toLocaleDateString('en-IN')}</p>` : ''}
          ${order.pickupDate ? `<p><strong>Pickup Date:</strong> ${new Date(order.pickupDate).toLocaleDateString('en-IN')}</p>` : ''}
        </div>
        <p style="color:#A79277;font-size:12px;">Wellfit Menswear &amp; Selection</p>
    `),
  }),

  slotApproved: (slot, user) => ({
    subject: `Measurement Slot Approved | Wellfit Menswear`,
    html: renderEmailLayout(`
        <h2 style="color:#A79277;">Slot Confirmed!</h2>
        <p>Hi ${user.name}, your measurement slot has been <strong>approved</strong>.</p>
        <div style="background:#fff;padding:15px;border-radius:6px;">
          <p><strong>Date & Time:</strong> ${new Date(slot.dateTime).toLocaleString('en-IN')}</p>
          ${slot.notes ? `<p><strong>Notes:</strong> ${slot.notes}</p>` : ''}
        </div>
        <p>Please visit our store at the scheduled time.</p>
        <p style="color:#A79277;font-size:12px;">Wellfit Menswear &amp; Selection</p>
    `),
  }),

  slotRejected: (slot, user) => ({
    subject: `Measurement Slot Update | Wellfit Menswear`,
    html: renderEmailLayout(`
        <h2 style="color:#A79277;">Slot Update</h2>
        <p>Hi ${user.name}, unfortunately your measurement slot on ${new Date(slot.dateTime).toLocaleString('en-IN')} could not be confirmed.</p>
        ${slot.adminNotes ? `<p><strong>Reason:</strong> ${slot.adminNotes}</p>` : ''}
        <p>Please book another slot at your convenience.</p>
        <p style="color:#A79277;font-size:12px;">Wellfit Menswear &amp; Selection</p>
    `),
  }),

  returnStatusUpdate: ({ order, user, itemName, returnRequest }) => ({
    subject: `Return Update - ${order.orderNumber} | Wellfit Menswear`,
    html: renderEmailLayout(`
        <h2 style="color:#A79277;">Return Status Update</h2>
        <p>Hi ${user.name}, your return request has been updated.</p>
        <div style="background:#fff;padding:15px;border-radius:6px;margin:15px 0;">
          <p><strong>Order:</strong> ${order.orderNumber}</p>
          <p><strong>Item:</strong> ${itemName}</p>
          <p><strong>Return Status:</strong> <span style="color:#A79277;text-transform:uppercase;">${returnRequest.status}</span></p>
          ${returnRequest.reason ? `<p><strong>Reason:</strong> ${returnRequest.reason}</p>` : ''}
          ${returnRequest.pickupDate ? `<p><strong>Pickup Date:</strong> ${new Date(returnRequest.pickupDate).toLocaleDateString('en-IN')}</p>` : ''}
          ${returnRequest.refundAmount ? `<p><strong>Refund Amount:</strong> ₹${returnRequest.refundAmount}</p>` : ''}
          ${returnRequest.adminNote ? `<p><strong>Admin Note:</strong> ${returnRequest.adminNote}</p>` : ''}
        </div>
        <p style="color:#A79277;font-size:12px;">Wellfit Menswear &amp; Selection</p>
    `),
  }),
};

module.exports = { sendEmail, templates };
