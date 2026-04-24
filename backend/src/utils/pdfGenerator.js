const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const BRAND_COLOR = '#5B2F2A';
const LOGO_PATH = path.resolve(__dirname, '../../../frontend/public/wellfit-logo.png');

const generateInvoicePDF = (order, user) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // ---- Header ----
      const headerTop = doc.y;
      const logoExists = fs.existsSync(LOGO_PATH);
      let brandTextX = 50;

      if (logoExists) {
        doc.image(LOGO_PATH, 50, headerTop - 11, { fit: [64, 64], align: 'left', valign: 'center' });
        brandTextX = 124;
      }

      doc
        .fillColor(BRAND_COLOR)
        .fontSize(30)
        .text('Wellfit', brandTextX, headerTop + 2, { lineBreak: false })
        .fillColor('#6F6054')
        .fontSize(11)
        .text('Menswear & Selection', brandTextX, headerTop + 38);

      const invoiceMetaTop = headerTop + 2;
      doc
        .fillColor('#333')
        .fontSize(12)
        .text('INVOICE', 380, invoiceMetaTop, { width: 170, align: 'right' })
        .fontSize(10)
        .text(`Order No: ${order.orderNumber}`, 380, invoiceMetaTop + 18, { width: 170, align: 'right' })
        .text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`, 380, invoiceMetaTop + 32, { width: 170, align: 'right' })
        .text(`Status: ${order.status.toUpperCase()}`, 380, invoiceMetaTop + 46, { width: 170, align: 'right' });

      const dividerY = headerTop + 74;
      doc
        .moveTo(50, dividerY)
        .lineTo(550, dividerY)
        .strokeColor(BRAND_COLOR)
        .stroke();

      doc.x = 50;
      doc.y = dividerY + 12;

      // ---- Bill To ----
      doc
        .fontSize(11)
        .fillColor('#A79277')
        .text('BILL TO')
        .fillColor('#333')
        .fontSize(10)
        .text(user.name)
        .text(user.email)
        .text(user.phone || '')
        .moveDown(0.5);

      if (order.shippingAddress) {
        const addr = order.shippingAddress;
        doc.text(`${addr.line1}${addr.line2 ? ', ' + addr.line2 : ''}`)
          .text(`${addr.city}, ${addr.state} - ${addr.pincode}`)
          .text(addr.country);
      }
      doc.moveDown();

      // ---- Table Header ----
      doc
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .stroke()
        .moveDown(0.3);

      const tableTop = doc.y;
      doc
        .fontSize(10)
        .fillColor('#A79277')
        .text('#', 50, tableTop)
        .text('Item', 70, tableTop)
        .text('Variant', 270, tableTop)
        .text('Qty', 390, tableTop)
        .text('Price', 430, tableTop)
        .text('Total', 490, tableTop);

      doc
        .fillColor('#333')
        .moveDown(0.3)
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .stroke()
        .moveDown(0.3);

      // ---- Table Rows ----
      order.items.forEach((item, idx) => {
        const y = doc.y;
        const variant = item.variantDetails
          ? `${item.variantDetails.size || ''} ${item.variantDetails.color || ''} ${item.variantDetails.fabric || ''}`.trim()
          : '';
        doc
          .fontSize(9)
          .text(String(idx + 1), 50, y)
          .text(item.product?.productName || item.product?.itemCategory || 'Product', 70, y, { width: 190 })
          .text(variant || '-', 270, y, { width: 110 })
          .text(String(item.qty), 390, y)
          .text(`Rs.${item.price}`, 430, y)
          .text(`Rs.${item.qty * item.price}`, 490, y);
        doc.moveDown(0.8);
      });

      doc
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .stroke()
        .moveDown(0.5);

      // ---- Totals ----
      const totalsX = 390;
      doc.fontSize(10);
      doc.text('Subtotal:', totalsX).moveUp().text(`Rs.${order.subtotal}`, 490);
      if (order.discountAmount > 0) {
        doc.moveDown(0.3).text('Discount:', totalsX).moveUp().text(`-Rs.${order.discountAmount}`, 490);
      }
      doc
        .moveDown(0.3)
        .fontSize(12)
        .fillColor('#A79277')
        .text('TOTAL:', totalsX)
        .moveUp()
        .text(`Rs.${order.totalAmount}`, 490);

      doc.moveDown().fillColor('#333').fontSize(10);
      doc.text(`Payment Method: ${order.paymentMethod}`, 50);
      doc.text(`Payment Status: ${order.paymentStatus.toUpperCase()}`, 50);

      // ---- Footer ----
      doc
        .moveDown(2)
        .fontSize(9)
        .fillColor('#888')
        .text('Thank you for shopping with Wellfit Menswear!', { align: 'center' })
        .text('For queries contact us at support@wellfit.com', { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

const generateTailorBillPDF = (bill) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Add watermark logo (semi-transparent, rotated)
      const logoExists = fs.existsSync(LOGO_PATH);
      if (logoExists) {
        const watermarkOpacity = 0.08;
        doc.opacity(watermarkOpacity);
        doc.image(LOGO_PATH, 150, 300, { fit: [300, 300], align: 'center', valign: 'center' });
        doc.opacity(1);
      }

      const headerTop = doc.y;
      let brandTextX = 50;

      if (logoExists) {
        doc.image(LOGO_PATH, 50, headerTop - 11, { fit: [64, 64], align: 'left', valign: 'center' });
        brandTextX = 124;
      }

      doc
        .fillColor(BRAND_COLOR)
        .fontSize(30)
        .text('Wellfit', brandTextX, headerTop + 2, { lineBreak: false })
        .fillColor('#6F6054')
        .fontSize(11)
        .text('Menswear & Selection', brandTextX, headerTop + 38)
        .fillColor('#333')
        .fontSize(12)
        .text('TAILOR BILL', 380, headerTop + 8, { width: 170, align: 'right' });

      const dividerY = headerTop + 74;
      doc
        .moveTo(50, dividerY)
        .lineTo(550, dividerY)
        .strokeColor(BRAND_COLOR)
        .stroke();

      doc.x = 50;
      doc.y = dividerY + 12;

      doc.moveDown(0.8);
      doc
        .fillColor('#333')
        .fontSize(11)
        .text(`Bill Number: ${bill.billNumber || '-'}`)
        .text(`Tailor: ${bill?.tailor?.name || '-'}`)
        .text(`Email: ${bill?.tailor?.email || '-'}`)
        .text(`Request Date: ${bill?.requestDate ? new Date(bill.requestDate).toLocaleDateString('en-IN') : '-'}`)
        .text(`Collection Date: ${bill?.collectionDate ? new Date(bill.collectionDate).toLocaleDateString('en-IN') : '-'}`)
        .text(`Status: ${bill?.status || '-'}`)
        .text(`Payment Status: ${bill?.paymentStatus || '-'}`);

      doc.moveDown(0.8);
      doc
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .strokeColor(BRAND_COLOR)
        .stroke();

      doc.moveDown(0.6);
      doc.fillColor('#A79277').fontSize(11).text('Included Orders');
      doc.moveDown(0.3);

      (bill.orders || []).forEach((order, idx) => {
        const orderNumber = order?.orderNumber || String(order?._id || '').slice(-8).toUpperCase();
        const amount = Number(order?.stitchingCost || 0);
        const status = order?.status || '-';
        const createdAt = order?.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : '-';

        doc
          .fillColor('#333')
          .fontSize(10)
          .text(`${idx + 1}. ${orderNumber}`, 55)
          .text(`Date: ${createdAt}   Status: ${status}   Stitching: Rs.${amount}`, 70);
        doc.moveDown(0.4);
      });

      const total = Number(bill?.totalAmount || 0);
      doc
        .moveDown(0.7)
        .fillColor(BRAND_COLOR)
        .fontSize(12)
        .text(`Total Amount: Rs.${total.toFixed(2)}`, { align: 'right' });

      doc
        .moveDown(1.5)
        .fillColor('#888')
        .fontSize(9)
        .text('Generated by Wellfit Tailor Billing System', { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { generateInvoicePDF, generateTailorBillPDF };
