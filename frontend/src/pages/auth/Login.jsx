import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { getErrorMsg } from '../../utils/helpers.js';

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const TEMP_LOGIN_USERS = {
    admin: { email: 'admin@wellfit.com', password: 'admin123', label: 'Admin' },
    customer: { email: 'zeelparmar7805@gmail.com', password: 'Dsnp@123', label: 'Customer' },
    tailor: { email: 'babulal@wellfit.com', password: 'Babulal@123', label: 'Tailor' },
  };

  const from = location.state?.from || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'tailor') navigate('/tailor');
      else navigate(from);
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const handleTempLogin = async (key) => {
    const selected = TEMP_LOGIN_USERS[key];
    if (!selected) return;

    setForm({ email: selected.email, password: selected.password });
    setLoading(true);
    try {
      const user = await login({ email: selected.email, password: selected.password });
      toast.success(`Logged in as ${selected.label}`);
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'tailor') navigate('/tailor');
      else navigate(from);
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 64px)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/wellfit-logo.png" alt="Wellfit" style={{ height: 74, width: 'auto', margin: '0 auto 8px', display: 'block' }} />
          <h2 style={{ marginBottom: 6 }}>Welcome Back</h2>
          <p style={{ color: 'var(--text-light)', fontSize: 14 }}>Login to your account</p>
        </div>
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="you@email.com" required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="••••••••" required />
            </div>
            <div style={{ textAlign: 'right', marginTop: -6, marginBottom: 12 }}>
              <Link to="/forgot-password" style={{ fontSize: 13, fontWeight: 600 }}>Forgot Password?</Link>
            </div>
            <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? 'Logging in…' : 'Login'}
            </button>

            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 8 }}>Temporary Quick Login</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => handleTempLogin('admin')} disabled={loading}>Admin</button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => handleTempLogin('customer')} disabled={loading}>Customer</button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => handleTempLogin('tailor')} disabled={loading}>Tailor</button>
              </div>
            </div>
          </form>
          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-light)' }}>
            Don't have an account? <Link to="/register" style={{ fontWeight: 600 }}>Sign Up</Link>
          </div>
        </div>
        {/* Demo credentials */}
        <div style={{ marginTop: 20, background: '#FFF8F0', border: '1px solid var(--border)', borderRadius: 8, padding: 14, fontSize: 12, color: 'var(--text-light)' }}>
          <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>Demo Credentials</div>
          <div>Admin: admin@wellfit.com / admin123</div>
          <div>Customer: zeelparmar7805@gmail.com / Dsnp@123</div>
          <div>Tailor: babulal@wellfit.com / Babulal@123</div>
        </div>
      </div>
    </div>
  );
}
