import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { userAPI, authAPI } from '../../api/index.js';
import { getErrorMsg, isStrongPassword, PASSWORD_RULE_MESSAGE } from '../../utils/helpers.js';

export default function ProfileInfo() {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', phone: '' });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (user) setForm({ name: user.name || '', phone: user.phone || '' });
  }, [user]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await userAPI.updateProfile(form);
      toast.success('Profile updated!');
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirm) return toast.error('Passwords do not match');
    if (pwForm.currentPassword === pwForm.newPassword) return toast.error('New password must be different from old password');
    if (!isStrongPassword(pwForm.newPassword)) return toast.error(PASSWORD_RULE_MESSAGE);
    setPwSaving(true);
    try {
      await authAPI.changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast.success('Password changed!');
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setPwSaving(false); }
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>My Profile</h2>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 18 }}>Personal Information</h3>
        <form onSubmit={saveProfile}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" value={user?.email || ''} disabled style={{ opacity: 0.6 }} />
          </div>
          <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 18 }}>Change Password</h3>
        <form onSubmit={changePassword}>
          <div className="form-group">
            <label className="form-label">Current Password</label>
            <input className="form-input" type="password" value={pwForm.currentPassword} onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input className="form-input" type="password" value={pwForm.newPassword} onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))} minLength={8} pattern="(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}" title={PASSWORD_RULE_MESSAGE} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input className="form-input" type="password" value={pwForm.confirm} onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))} minLength={8} />
            </div>
          </div>
          <button className="btn btn-primary btn-sm" type="submit" disabled={pwSaving}>{pwSaving ? 'Saving…' : 'Change Password'}</button>
        </form>
      </div>
    </div>
  );
}
