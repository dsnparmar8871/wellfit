import { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import { userAPI } from '../../api/index.js';
import { getErrorMsg } from '../../utils/helpers.js';
import PageSkeleton from '../../components/ui/PageSkeleton.jsx';
import Modal from '../../components/ui/Modal.jsx';

const EMPTY = { label: 'Home', line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' };

export default function Addresses() {
  const toast = useToast();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = () => userAPI.getProfile().then(({ data }) => { const user = data.data?.user || data.data; setAddresses(user?.addresses || []); setLoading(false); }).catch(() => { setLoading(false); });
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditId(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (a) => { setEditId(a._id); setForm({ label: a.label || 'Home', line1: a.line1, line2: a.line2 || '', city: a.city, state: a.state, pincode: a.pincode, country: a.country || 'India' }); setShowModal(true); };

  const save = async () => {
    if (!form.line1 || !form.city || !form.state || !form.pincode) return toast.error('Please fill required fields');
    setSaving(true);
    try {
      if (editId) await userAPI.updateAddress(editId, form);
      else await userAPI.addAddress(form);
      toast.success(editId ? 'Address updated!' : 'Address added!');
      setShowModal(false);
      setLoading(true);
      await load();
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!confirm('Delete this address?')) return;
    try {
      await userAPI.deleteAddress(id);
      toast.success('Address deleted');
      setLoading(true);
      await load();
    } catch (err) { toast.error(getErrorMsg(err)); }
  };

  if (loading) return <PageSkeleton variant="list" />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ marginBottom: 0 }}>Addresses</h2>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Address</button>
      </div>
      {addresses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-light)' }}>No saved addresses.</div>
      ) : (
        <div className="grid-2">
          {addresses.map((a) => (
            <div key={a._id} className="card">
              <div style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 14, color: 'var(--text-light)' }}>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{a.label || 'Home'}</div>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{a.line1}</div>
                {a.line2 && <div>{a.line2}</div>}
                <div>{a.city}, {a.state} – {a.pincode}</div>
                <div>{a.country}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline btn-sm" onClick={() => openEdit(a)}>Edit</button>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }} onClick={() => del(a._id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Address' : 'Add Address'}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Label</label>
            <input className="form-input" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Home, Work, Office" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Line 1 *</label>
            <input className="form-input" value={form.line1} onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))} placeholder="Street, area" />
          </div>
          <div className="form-group">
            <label className="form-label">Line 2</label>
            <input className="form-input" value={form.line2} onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))} placeholder="Landmark" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">City *</label>
            <input className="form-input" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">State *</label>
            <input className="form-input" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Pincode *</label>
            <input className="form-input" value={form.pincode} onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Country</label>
            <input className="form-input" value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </Modal>
    </div>
  );
}
