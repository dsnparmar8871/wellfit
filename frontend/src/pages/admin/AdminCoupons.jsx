import { useState, useEffect, useRef } from 'react';
import { couponAPI } from '../../api/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatDate, getErrorMsg } from '../../utils/helpers.js';
import Modal from '../../components/ui/Modal.jsx';
import PageSkeleton from '../../components/ui/PageSkeleton.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';

const EMPTY = { code: '', discountType: 'percentage', discountValue: '', minOrder: '', usageLimit: '', expiry: '', isActive: true };

export default function AdminCoupons() {
  const toast = useToast();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const searchInputRef = useRef(null);
  const keepSearchFocusRef = useRef(false);

  const load = () => {
    const params = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (activeFilter !== '') params.active = activeFilter;
    if (typeFilter) params.discountType = typeFilter;
    return couponAPI.getAll(params)
      .then(({ data }) => setCoupons(data.data || []))
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        if (keepSearchFocusRef.current && searchInputRef.current) {
          requestAnimationFrame(() => {
            searchInputRef.current?.focus();
            const valueLength = searchInputRef.current?.value?.length || 0;
            searchInputRef.current?.setSelectionRange(valueLength, valueLength);
          });
        }
      });
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { load(); }, [debouncedSearch, activeFilter, typeFilter]);

  const openForm = (c = null) => {
    if (c) {
      setEditId(c._id);
      setForm({ code: c.code, discountType: c.discountType, discountValue: c.discountValue, minOrder: c.minOrder || '', usageLimit: c.usageLimit || '', expiry: c.expiry ? c.expiry.split('T')[0] : '', isActive: c.isActive });
    } else { setEditId(null); setForm(EMPTY); }
    setShowModal(true);
  };

  const save = async () => {
    if (!form.code || !form.discountValue) return toast.error('Code and discount value are required');
    setSaving(true);
    try {
      if (editId) await couponAPI.update(editId, form);
      else await couponAPI.create(form);
      toast.success(editId ? 'Coupon updated!' : 'Coupon created!');
      setShowModal(false); load();
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!confirm('Delete this coupon?')) return;
    try { await couponAPI.delete(id); toast.success('Deleted'); load(); }
    catch (err) { toast.error(getErrorMsg(err)); }
  };

  if (loading) return <PageSkeleton variant="table" />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: 0 }}>Coupons</h1>
        <button className="btn btn-primary btn-sm" onClick={() => openForm()}>+ New Coupon</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
        <input
          ref={searchInputRef}
          className="form-input"
          placeholder="Search coupon code..."
          value={search}
          onFocus={() => { keepSearchFocusRef.current = true; }}
          onBlur={() => { keepSearchFocusRef.current = false; }}
          onChange={(e) => {
            keepSearchFocusRef.current = true;
            setSearch(e.target.value);
          }}
        />
        <select className="form-select" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <select className="form-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          <option value="percentage">Percentage</option>
          <option value="flat">Flat</option>
          <option value="fixed">Fixed</option>
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Code</th><th>Discount</th><th>Min Order</th><th>Usage</th><th>Expiry</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c._id}>
                <td><code style={{ background: 'var(--cream)', padding: '3px 8px', borderRadius: 4, fontWeight: 700, fontSize: 13 }}>{c.code}</code></td>
                <td>{c.discountValue}{c.discountType === 'percentage' ? '%' : ' ₹'} off</td>
                <td>{c.minOrder ? `₹${c.minOrder}` : '—'}</td>
                <td style={{ fontSize: 13 }}>{c.usedCount || 0} / {c.usageLimit || '∞'}</td>
                <td style={{ fontSize: 13 }}>{c.expiry ? formatDate(c.expiry) : '—'}</td>
                <td><StatusBadge status={c.isActive ? 'active' : 'inactive'} /></td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => openForm(c)}>Edit</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }} onClick={() => del(c._id)}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {coupons.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-light)' }}>No coupons yet.</div>}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Coupon' : 'New Coupon'}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Coupon Code *</label>
            <input className="form-input" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="SAVE20" />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-select" value={form.discountType} onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value }))}>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed Amount (₹)</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Discount Value *</label>
            <input className="form-input" type="number" value={form.discountValue} onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Min Order (₹)</label>
            <input className="form-input" type="number" value={form.minOrder} onChange={(e) => setForm((f) => ({ ...f, minOrder: e.target.value }))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Usage Limit</label>
            <input className="form-input" type="number" value={form.usageLimit} onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))} placeholder="Unlimited" />
          </div>
          <div className="form-group">
            <label className="form-label">Expiry Date</label>
            <input className="form-input" type="date" value={form.expiry} onChange={(e) => setForm((f) => ({ ...f, expiry: e.target.value }))} />
          </div>
        </div>
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
            Active
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Coupon'}</button>
        </div>
      </Modal>
    </div>
  );
}
