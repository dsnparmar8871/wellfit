# Wellfit — Bespoke Menswear & Tailoring E-Commerce System

Wellfit is a premium, full-stack e-commerce solution tailored for menswear, specializing in both ready-made garments and bespoke stitching services. This platform bridges the gap between traditional tailoring craftsmanship and modern digital commerce, providing a seamless experience for customers, tailors, and administrators.

---

## 🌟 Key Features

### 🛒 Storefront (Customer Experience)
- **Bespoke Tailoring**: Integrated system for custom stitching requests with garment-specific measurements.
- **Measurement Management**: Save and reuse measurement templates for future orders.
- **Appointment Booking**: Schedule measurement slots with physical tailors.
- **Responsive Design**: Premium, mobile-first UI optimized for all devices.
- **Loyalty Program**: Earn and redeem points on every purchase.
- **Coupons & Discounts**: Advanced coupon system with percentage and flat discounts.
- **Customer Reviews**: Dynamic review system with rating and media support.

### 🛡️ Admin Dashboard (Management)
- **Advanced Analytics**: Real-time revenue tracking using precise financial formulas: `Revenue = Total - Stitching Cost + Cancellation Charge`.
- **Offline Order Entry**: Integrated POS system for in-store sales with automatic customer and product association.
- **Return Management**: Controlled workflow for return requests with terminal state locking (refunded/rejected).
- **Product Management**: Multi-variant support (size/color/fabric) with extra image galleries.
- **Role-Based Access**: Granular permissions for Admin, Tailors, and Customers.

### 🪡 Tailor Interface
- **Order Tracking**: Specialized view for assigned stitching tasks.
- **Billing System**: Generate and track labor bills for completed stitching work.
- **Status Management**: Real-time updates on the tailoring progress (received → tailoring → ready).

---

## 🛠️ Tech Stack

**Frontend:**
- React 18+ (Vite)
- React Router 6 (Navigation)
- Recharts (Data Visualization)
- Axios (API Communication)
- Vanilla CSS (Premium Custom Design System)

**Backend:**
- Node.js & Express
- MongoDB & Mongoose (ODM)
- JWT (Secure Authentication)
- PDFKit (Invoice Generation)
- Multer & AWS S3 (Media Storage)
- Stripe API (Payment Processing)

---

## 📁 Project Structure

```bash
wellfit-v3/
├── backend/                # Node.js Express API
│   ├── src/
│   │   ├── models/         # Mongoose Schemas
│   │   ├── controllers/    # Business Logic
│   │   ├── routes/         # API Endpoints
│   │   └── utils/          # Helpers (PDF, QR, Email)
│   └── uploads/            # Local storage fallback
└── frontend/               # React Vite Application
    ├── src/
    │   ├── components/     # Reusable UI Components
    │   ├── pages/          # Admin & Storefront Views
    │   ├── api/            # Axios Service Layer
    │   └── context/        # State Management (Toast, Auth)
    └── public/             # Static Assets
```

---

## 💻 System Requirements

Before you begin, ensure your development environment meets the following minimum requirements:

- **Runtime**: Node.js v18.x or v20.x (LTS recommended)
- **Package Manager**: npm v9.x+ or yarn v1.22+
- **Database**: MongoDB v6.0+ (Community Edition or MongoDB Atlas)
- **Hardware**: 
  - Minimum 4GB RAM (8GB recommended for concurrent dev servers)
  - 500MB+ free disk space
- **Browser**: Modern web browser with JavaScript enabled (Chrome, Firefox, Safari, or Edge)
- **Optional**: AWS Account (for S3 storage) and Stripe Account (for real payments)

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18 or higher)
- MongoDB (Local or Atlas)
- npm or yarn

### 2. Installation
Clone the repository and install dependencies for both layers:

```bash
# Clone the repo
git clone https://github.com/yourusername/wellfit.git
cd wellfit

# Install Backend dependencies
cd backend
npm install

# Install Frontend dependencies
cd ../frontend
npm install
```

### 3. Configuration
Create a `.env` file in the **backend** directory based on `.env.example`:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
STRIPE_SECRET_KEY=your_stripe_key
AWS_S3_BUCKET=your_bucket_name
```

### 4. Running the Application
Open two terminals:

**Terminal 1 (Backend):**
```bash
cd backend
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

The app will be available at `http://localhost:5173` and the API at `http://localhost:5000`.

---

## 🔒 Security
- **JWT Authentication**: Short-lived access tokens with rotating refresh tokens.
- **Rate Limiting**: Protection against brute-force attacks on auth endpoints.
- **Input Validation**: Strict schema validation using express-validator.
- **Data Integrity**: MongoDB transactions for atomic stock and payment updates.

---

## 📄 License
This project is licensed under the MIT License.

---

*Developed with ❤️ for Wellfit Menswear.*
