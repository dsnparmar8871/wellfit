# Wellfit Menswear — Backend API

Complete Node.js/Express/MongoDB REST API for Wellfit Menswear & Selection.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express 4 |
| Database | MongoDB 6 via Mongoose |
| Auth | JWT (access + refresh tokens) |
| Payments | Stripe / Simulated |
| Storage | AWS S3 / Local fallback |
| Email | Nodemailer SMTP / Simulated |
| PDF | PDFKit |
| QR Code | qrcode |
| Logging | Winston |
| Security | Helmet, CORS, Rate Limiting, bcryptjs |

---

## Project Structure

```
wellfit-backend/
├── src/
│   ├── app.js                  # Main Express app
│   ├── config/
│   │   ├── db.js               # MongoDB connection
│   │   ├── s3.js               # AWS S3 + Multer config
│   │   └── stripe.js          # Stripe instance
│   ├── models/
│   │   ├── User.js
│   │   ├── Category.js
│   │   ├── Product.js
│   │   ├── Order.js
│   │   ├── MeasurementTemplate.js
│   │   ├── MeasurementSlot.js
│   │   ├── Coupon.js
│   │   ├── Review.js
│   │   ├── LoyaltyTransaction.js
│   │   ├── TailorBill.js
│   │   └── Notification.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── categoryController.js
│   │   ├── productController.js
│   │   ├── orderController.js
│   │   ├── paymentController.js
│   │   ├── measurementController.js
│   │   ├── couponController.js
│   │   ├── reviewController.js
│   │   ├── tailorController.js
│   │   └── analyticsController.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── products.js
│   │   ├── categories.js
│   │   ├── orders.js
│   │   ├── payments.js
│   │   ├── measurements.js
│   │   ├── coupons.js
│   │   ├── reviews.js
│   │   ├── tailor.js
│   │   ├── analytics.js
│   │   └── admin.js
│   ├── middleware/
│   │   ├── auth.js             # JWT authenticate + authorize
│   │   ├── errorHandler.js
│   │   └── validate.js
│   └── utils/
│       ├── logger.js           # Winston logger
│       ├── email.js            # Nodemailer + templates
│       ├── jwt.js              # Token helpers
│       ├── pdfGenerator.js     # Invoice PDF
│       ├── qrCode.js           # QR code generator
│       └── apiResponse.js      # Consistent response helpers
└── seeds/
    └── seed.js                 # Database seeder
```

---

## Quick Start

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd wellfit-backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your values. **Minimum required:**

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/wellfit
JWT_SECRET=your_32_plus_char_secret_here
JWT_REFRESH_SECRET=another_32_plus_char_secret
JWT_EXPIRES_IN=15m
CLIENT_URL=http://localhost:3000
```

> All other variables (AWS S3, Stripe, SMTP) are optional for local dev.  
> The app runs in **simulated mode** if credentials are not provided.

### 3. Seed the Database

```bash
npm run seed
```

This creates:
- Admin, Tailor, Customer demo users
- All product categories (Cloths + Accessories)
- 12 sample products across all categories
- 4 coupon codes
- Sample measurement templates
- A sample order

### 4. Start the Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server starts on `http://localhost:5000`

---

## Demo Credentials (after seeding)

| Role | Email | Password |
|---|---|---|
| Admin | admin@wellfit.com | admin123 |
| Tailor | tailor1@wellfit.com | password123 |
| Customer | customer@wellfit.com | password123 |

---

## API Reference

### Base URL
```
http://localhost:5000/api
```

### Authentication
All protected routes require:
```
Authorization: Bearer <accessToken>
```

---

### Auth Routes `/api/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/register` | No | Register new customer |
| POST | `/login` | No | Login, get tokens |
| POST | `/refresh` | No | Refresh access token |
| POST | `/logout` | Yes | Invalidate refresh token |
| GET | `/me` | Yes | Get current user |
| PUT | `/change-password` | Yes | Change password |

**Register body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "password": "secret123"
}
```

**Login response:**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "eyJ...",
    "refreshToken": "abc123..."
  }
}
```

---

### Product Routes `/api/products`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | No | List products (with filters) |
| GET | `/:id` | No | Get product by ID |
| GET | `/slug/:slug` | No | Get product by slug |
| GET | `/:id/reviews` | No | Get approved reviews |
| POST | `/:id/reviews` | Customer | Submit review |
| POST | `/` | Admin | Create product |
| PUT | `/:id` | Admin | Update product |
| DELETE | `/:id` | Admin | Deactivate product |
| PATCH | `/:id/variant/:variantId/stock` | Admin | Update variant stock |

**Product list query params:**
```
?category=<id>&subcategory=Formal&search=shirt
&minPrice=500&maxPrice=5000&size=M&color=White&fabric=Cotton
&sort=-createdAt&page=1&limit=12&inStock=true&featured=true
```

---

### Category Routes `/api/categories`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | No | List all categories |
| GET | `/:id` | No | Category + subcategories |
| POST | `/` | Admin | Create category |
| PUT | `/:id` | Admin | Update category |
| DELETE | `/:id` | Admin | Deactivate category |

---

### Order Routes `/api/orders`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/` | Customer | Place order |
| GET | `/my` | Customer | My orders |
| GET | `/:id` | Customer/Admin | Order detail |
| GET | `/:id/invoice` | Customer/Admin | Download invoice PDF |
| GET | `/` | Admin | All orders |
| GET | `/export/csv` | Admin | Export orders CSV |
| PATCH | `/:id/status` | Admin | Update order status |
| PATCH | `/:id/assign-tailor` | Admin | Assign tailor |
| GET | `/tailor/assigned` | Tailor | My assigned orders |
| PATCH | `/tailor/:id/status` | Tailor | Update stitching status |

**Place order body:**
```json
{
  "items": [
    { "product": "<id>", "variantId": "<variantId>", "qty": 2 }
  ],
  "shippingAddress": {
    "name": "John Doe", "phone": "9876543210",
    "line1": "12 Main St", "city": "Surat",
    "state": "Gujarat", "pincode": "395001"
  },
  "paymentMethod": "COD",
  "couponCode": "WELCOME10",
  "loyaltyPointsToUse": 50
}
```

**Order status flow:**
```
received → tailoring → processing → ready → delivered
                                        ↘ cancelled
```

---

### Payment Routes `/api/payments`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/create-intent` | Customer | Create Stripe payment intent |
| POST | `/verify` | Customer | Verify payment |
| POST | `/webhook` | No | Stripe webhook |

> Works in **simulated mode** if Stripe keys are not set.

---

### Measurement Routes `/api/measurements`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/templates` | Customer | My measurement templates |
| POST | `/templates` | Customer | Create template |
| PUT | `/templates/:id` | Customer | Update template |
| DELETE | `/templates/:id` | Customer | Delete template |
| GET | `/slots/availability` | No | Check slot availability |
| GET | `/slots/my` | Customer | My booked slots |
| POST | `/slots` | Customer | Book measurement slot |
| DELETE | `/slots/:id` | Customer | Cancel slot |
| GET | `/admin/slots` | Admin | All slots |
| PATCH | `/admin/slots/:id` | Admin | Approve/reject slot |

---

### Coupon Routes `/api/coupons`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/validate` | Customer | Validate a coupon |
| GET | `/` | Admin | List all coupons |
| POST | `/` | Admin | Create coupon |
| PUT | `/:id` | Admin | Update coupon |
| DELETE | `/:id` | Admin | Deactivate coupon |

---

### Tailor Routes `/api/tailor`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/stats` | Tailor | My work statistics |
| POST | `/bills` | Tailor | Generate payment bill |
| GET | `/bills` | Tailor | My bills |
| GET | `/admin/tailors` | Admin | All tailors |
| GET | `/admin/bills` | Admin | All tailor bills |
| PATCH | `/admin/bills/:id/pay` | Admin | Mark bill paid |

---

### Analytics Routes `/api/analytics`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/dashboard` | Admin | Dashboard KPIs |
| GET | `/sales` | Admin | Sales report (daily/weekly/monthly) |
| GET | `/top-products` | Admin | Top selling products |
| GET | `/orders-over-time` | Admin | Order trend chart data |

---

### Admin Consolidated Routes `/api/admin`

All admin routes are also available at `/api/admin/*` for convenience.

---

## Coupon Test Codes

| Code | Type | Value | Min Order |
|---|---|---|---|
| `WELCOME10` | Percentage | 10% (max ₹500) | ₹500 |
| `FLAT200` | Flat | ₹200 off | ₹2000 |
| `WEDDING20` | Percentage | 20% (max ₹2000) | ₹3000 |
| `TAILOR15` | Percentage | 15% (max ₹1000) | ₹1000 |

---

## Deployment

### Render / DigitalOcean (Backend)

1. Set environment variables in the platform dashboard
2. Build command: `npm install`
3. Start command: `npm start`
4. Node version: 18+

### MongoDB Atlas

1. Create a free cluster at [mongodb.com/atlas](https://mongodb.com/atlas)
2. Whitelist your server IP
3. Get connection string and set `MONGODB_URI`

### AWS S3 (Image Storage)

1. Create an S3 bucket
2. Enable public read ACL or use signed URLs
3. Set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_REGION`

> If S3 is not configured, images are stored locally in `/uploads/`

---

## Security Features

- **Helmet** – HTTP security headers
- **CORS** – Origin whitelisting in production
- **Rate Limiting** – 300 req/15min global; 20 req/15min for auth routes
- **bcrypt** – Password hashing with 12 salt rounds
- **JWT** – Short-lived (15m) access tokens + rotating refresh tokens
- **Input Validation** – express-validator on all routes
- **File Upload** – MIME type check + 5MB size limit
- **Role-Based Access** – customer / admin / tailor middleware
- **MongoDB transactions** – Atomic stock deduction on order creation

---

## Environment Variables Reference

See `.env.example` for all required variables.
