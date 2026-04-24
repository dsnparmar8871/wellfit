import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { getErrorMsg, isStrongPassword, PASSWORD_RULE_MESSAGE } from '../../utils/helpers.js';

export default function AdminRegister() {
  const { registerAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
    adminSecret: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return toast.error('Passwords do not match');
    if (!isStrongPassword(form.password)) return toast.error(PASSWORD_RULE_MESSAGE);
    if (!form.adminSecret.trim()) return toast.error('Admin registration code is required');

    setLoading(true);
    try {
      const user = await registerAdmin({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        adminSecret: form.adminSecret,
      });
      toast.success(`Welcome, ${user.name.split(' ')[0]}!`);
      navigate('/admin');
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 64px)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/wellfit-logo.png" alt="Wellfit" style={{ height: 74, width: 'auto', margin: '0 auto 8px', display: 'block' }} />
          <h2 style={{ marginBottom: 6 }}>Admin Registration</h2>
          <p style={{ color: 'var(--text-light)', fontSize: 14 }}>Create a secure admin account</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Admin name" required />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="admin@email.com" required />
              </div>
              <div className="form-group">
                <label className="form-label">Phone (optional)</label>
                <input className="form-input" type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+91 XXXXX XXXXX" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  className="form-input"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Min 8 chars, 1 uppercase, 1 number, 1 special"
                  minLength={8}
                  pattern="(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}"
                  title={PASSWORD_RULE_MESSAGE}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input className="form-input" type="password" value={form.confirm} onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} minLength={8} required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Admin Registration Code</label>
              <input
                className="form-input"
                type="password"
                value={form.adminSecret}
                onChange={(e) => setForm((f) => ({ ...f, adminSecret: e.target.value }))}
                placeholder="Enter admin secret code"
                required
              />
            </div>

            <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? 'Creating Admin…' : 'Create Admin Account'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-light)' }}>
            Already have an admin account? <Link to="/login" style={{ fontWeight: 600 }}>Login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
