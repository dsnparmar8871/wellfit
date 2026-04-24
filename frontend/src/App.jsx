import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { FavoritesProvider } from './context/FavoritesContext.jsx';

import Navbar from './components/layout/Navbar.jsx';
import Footer from './components/layout/Footer.jsx';

// Pages
import Home from './pages/Home.jsx';
import Products from './pages/Products.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import StripePayment from './pages/StripePayment.jsx';
import PaymentSuccess from './pages/PaymentSuccess.jsx';
import Favorites from './pages/Favorites.jsx';

// Auth
import Login from './pages/auth/Login.jsx';
import Register from './pages/auth/Register.jsx';
import ForgotPassword from './pages/auth/ForgotPassword.jsx';
import AdminRegister from './pages/auth/AdminRegister.jsx';

// Profile
import ProfileLayout from './pages/profile/ProfileLayout.jsx';
import ProfileInfo from './pages/profile/ProfileInfo.jsx';
import MyOrders from './pages/profile/MyOrders.jsx';
import OrderDetail from './pages/profile/OrderDetail.jsx';
import Measurements from './pages/profile/Measurements.jsx';
import Addresses from './pages/profile/Addresses.jsx';

// Admin
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import AdminOrders from './pages/admin/AdminOrders.jsx';
import AdminOrderDetail from './pages/admin/AdminOrderDetail.jsx';
import AdminProducts from './pages/admin/AdminProducts.jsx';
import AdminProductDetail from './pages/admin/AdminProductDetail.jsx';
import ProductForm from './pages/admin/ProductForm.jsx';
import AdminCategories from './pages/admin/AdminCategories.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';
import AdminTailors from './pages/admin/AdminTailors.jsx';
import AdminBills from './pages/admin/AdminBills.jsx';
import AdminSlots from './pages/admin/AdminSlots.jsx';
import AdminCoupons from './pages/admin/AdminCoupons.jsx';
import AdminReturns from './pages/admin/AdminReturns.jsx';

// Tailor
import TailorLayout from './pages/tailor/TailorLayout.jsx';
import TailorOrders from './pages/tailor/TailorOrders.jsx';
import TailorBills from './pages/tailor/TailorBills.jsx';

function NotFound() {
  return (
    <div className="page">
      <div className="container" style={{ textAlign: 'center', padding: '80px 20px' }}>
        <div style={{ fontSize: '6rem', fontFamily: 'var(--font-display)', color: 'var(--brown)', marginBottom: 16 }}>404</div>
        <h2 style={{ marginBottom: 12 }}>Page Not Found</h2>
        <p style={{ color: 'var(--text-light)', marginBottom: 28 }}>The page you're looking for doesn't exist.</p>
        <a href="/" className="btn btn-primary btn-lg">Go Home</a>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <FavoritesProvider>
            <CartProvider>
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                <Navbar />
                <div style={{ flex: 1 }}>
                  <Routes>
                  {/* Public */}
                  <Route path="/" element={<Home />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/products/:id" element={<ProductDetail />} />
                  <Route path="/favorites" element={<Favorites />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/checkout" element={<Checkout />} />
                  <Route path="/checkout/payment" element={<StripePayment />} />
                  <Route path="/payment-success" element={<PaymentSuccess />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/admin/register" element={<AdminRegister />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />

                  {/* Profile */}
                  <Route path="/profile" element={<ProfileLayout />}>
                    <Route index element={<ProfileInfo />} />
                    <Route path="orders" element={<MyOrders />} />
                    <Route path="orders/:id" element={<OrderDetail />} />
                    <Route path="measurements" element={<Measurements />} />
                    <Route path="addresses" element={<Addresses />} />
                  </Route>

                  {/* Admin */}
                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<AdminDashboard />} />
                    <Route path="orders" element={<AdminOrders />} />
                    <Route path="orders/:id" element={<AdminOrderDetail />} />
                    <Route path="returns" element={<AdminReturns />} />
                    <Route path="products" element={<AdminProducts />} />
                    <Route path="products/:id" element={<AdminProductDetail />} />
                    <Route path="products/new" element={<ProductForm />} />
                    <Route path="products/edit/:id" element={<ProductForm />} />
                    <Route path="categories" element={<AdminCategories />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="tailors" element={<AdminTailors />} />
                    <Route path="bills" element={<AdminBills />} />
                    <Route path="slots" element={<AdminSlots />} />
                    <Route path="coupons" element={<AdminCoupons />} />
                  </Route>

                  {/* Tailor */}
                  <Route path="/tailor" element={<TailorLayout />}>
                    <Route index element={<TailorOrders />} />
                    <Route path="bills" element={<TailorBills />} />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                  </Routes>
                </div>
                <Footer />
              </div>
            </CartProvider>
          </FavoritesProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
