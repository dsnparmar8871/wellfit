import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../../api/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { getErrorMsg, isStrongPassword, PASSWORD_RULE_MESSAGE } from '../../utils/helpers.js';

export default function ForgotPassword() {
  const toast = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const requestCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.forgotPassword({ email });
      toast.success('Verification code sent to your email if the account exists.');
      setStep(2);
      setResendCooldown(30);
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      await authAPI.forgotPassword({ email });
      toast.success('A new verification code has been sent if the account exists.');
      setResendCooldown(30);
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return toast.error('Passwords do not match');
    if (!isStrongPassword(newPassword)) return toast.error(PASSWORD_RULE_MESSAGE);
    setLoading(true);
    try {
      await authAPI.resetPassword({ email, code, newPassword });
      toast.success('Password reset successful. Please login.');
      navigate('/login');
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
          <h2 style={{ marginBottom: 6 }}>Forgot Password</h2>
          <p style={{ color: 'var(--text-light)', fontSize: 14 }}>
            {step === 1 ? 'Enter your email to receive a verification code' : 'Enter verification code and set new password'}
          </p>
        </div>

        <div className="card">
          {step === 1 ? (
            <form onSubmit={requestCode}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  className="form-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  required
                />
              </div>
              <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading}>
                {loading ? 'Sending…' : 'Send Verification Code'}
              </button>
            </form>
          ) : (
            <form onSubmit={resetPassword}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Verification Code</label>
                <input
                  className="form-input"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit code"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input className="form-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} pattern="(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}" title={PASSWORD_RULE_MESSAGE} required />
              </div>
              <div className="form-group">
                <label className="form-label">Repeat Password</label>
                <input className="form-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required />
              </div>
              <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading}>
                {loading ? 'Updating…' : 'Reset Password'}
              </button>
              <button
                className="btn btn-outline btn-full"
                type="button"
                onClick={resendCode}
                disabled={loading || resendCooldown > 0}
                style={{ marginTop: 12 }}
              >
                {resendCooldown > 0 ? `Resend Code in ${resendCooldown}s` : 'Resend Verification Code'}
              </button>
            </form>
          )}

          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 14, color: 'var(--text-light)' }}>
            <Link to="/login" style={{ fontWeight: 600 }}>Back to Login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
