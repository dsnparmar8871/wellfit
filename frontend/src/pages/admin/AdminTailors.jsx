import { useMemo, useState, useEffect } from 'react';
import { adminAPI, orderAPI, userAPI } from '../../api/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatPrice, formatDate, getErrorMsg } from '../../utils/helpers.js';
import PageSkeleton from '../../components/ui/PageSkeleton.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import Modal from '../../components/ui/Modal.jsx';
import AppIcon from '../../components/ui/AppIcon.jsx';

export default function AdminTailors() {
  const toast = useToast();
  const [tailors, setTailors] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTailor, setSelectedTailor] = useState(null);
  const [showAddTailorModal, setShowAddTailorModal] = useState(false);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tailorForm, setTailorForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    repeatPassword: '',
  });

  const load = () => {
    setLoading(true);
    Promise.all([
      adminAPI.getTailors(),
      orderAPI.getAll({ limit: 50 }),
    ])
      .then(([td, od]) => {
        setTailors(td.data.data?.tailors || []);
        setOrders(Array.isArray(od.data.data) ? od.data.data : (od.data.data?.orders || []));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filteredTailors = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tailors;

    const queryDigits = query.replace(/\D/g, '');

    return tailors.filter((tailor) => {
      const name = String(tailor?.name || '').toLowerCase();
      const email = String(tailor?.email || '').toLowerCase();
      const phone = String(tailor?.phone || '').toLowerCase();
      const phoneDigits = phone.replace(/\D/g, '');

      const textMatch = name.includes(query) || email.includes(query) || phone.includes(query);
      const phoneMatch = queryDigits && phoneDigits.includes(queryDigits);

      return textMatch || Boolean(phoneMatch);
    });
  }, [tailors, search]);

  const removeTailor = async (id) => {
    if (!confirm('Delete this tailor account?')) return;
    try {
      await userAPI.deleteUser(id);
      toast.success('Tailor deleted');
      if (selectedTailor?._id === id) setSelectedTailor(null);
      load();
    } catch (err) { toast.error(getErrorMsg(err)); }
  };

  const toggleTailorStatus = async (id) => {
    try {
      await userAPI.toggleStatus(id);
      toast.success('Tailor status updated');
      if (selectedTailor?._id === id) setSelectedTailor(null);
      load();
    } catch (err) { toast.error(getErrorMsg(err)); }
  };

  const createTailor = async () => {
    const { name, email, phone, password, repeatPassword } = tailorForm;
    if (!name || !email || !phone || !password || !repeatPassword) return toast.error('All fields are required');
    if (password !== repeatPassword) return toast.error('Passwords do not match');
    setSaving(true);
    try {
      await userAPI.createTailor({ name, email, phone, password });
      toast.success('Tailor account created');
      setShowModal(false);
      setTailorForm({ name: '', email: '', phone: '', password: '', repeatPassword: '' });
      load();
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  };

  const tailorOrders = selectedTailor
    ? orders.filter((o) => o.assignedTailor?._id === selectedTailor._id || o.assignedTailor === selectedTailor._id)
    : [];

  const getOrderItemNames = (order) => {
    const names = (order.items || [])
      .filter((item) => item?.isStitching)
      .map((item) => item?.product?.productName || item?.product?.name)
      .filter(Boolean);
    if (!names.length) return 'No custom stitching items';
    return names.join(', ');
  };

  if (loading) return <PageSkeleton variant="table" />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: 0 }}>Tailors</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAddTailorModal(true)}>+ Add Tailor</button>
      </div>
      <input
        className="form-input"
        style={{ maxWidth: 360, marginBottom: 16 }}
        placeholder="Search by name, email or mobile number..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
        {filteredTailors.length === 0 ? (
          <p style={{ color: 'var(--text-light)', fontSize: 14, gridColumn: '1 / -1' }}>No tailors yet. Add a tailor to get started.</p>
        ) : (
          filteredTailors.map((t) => (
            <div key={t._id}
              className="card" style={{
                padding: 14,
                minWidth: 0,
                overflow: 'hidden',
                cursor: 'pointer',
              }}
              onClick={() => { setSelectedTailor(t); setShowOrdersModal(true); }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 2, wordBreak: 'break-word' }}>{t.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-light)', wordBreak: 'break-word', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.email}</div>
                <div style={{ fontSize: 12, color: 'var(--text-light)', wordBreak: 'break-word' }}>{t.phone || '—'}</div>
                <div style={{ marginTop: 6 }}>
                  <StatusBadge status={t.isActive ? 'active' : 'inactive'} />
                </div>
                <div style={{ fontSize: 12, marginTop: 6 }}>
                  Orders: {orders.filter((o) => o.assignedTailor?._id === t._id || o.assignedTailor === t._id).length}
                </div>
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  className={`btn btn-sm ${t.isActive ? 'btn-ghost' : 'btn-outline'}`}
                  style={t.isActive ? { color: 'var(--error)' } : {}}
                  onClick={(e) => { e.stopPropagation(); toggleTailorStatus(t._id); }}
                >
                  {t.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button className="btn btn-sm btn-ghost" style={{ color: 'var(--error)' }} onClick={(e) => { e.stopPropagation(); removeTailor(t._id); }}>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal open={showOrdersModal} onClose={() => setShowOrdersModal(false)} title={selectedTailor ? `Orders for ${selectedTailor.name}` : 'Orders'} maxWidth={900}>
        {selectedTailor && tailorOrders.length === 0 && (
          <p style={{ color: 'var(--text-light)' }}>No orders assigned to this tailor.</p>
        )}
        {selectedTailor && tailorOrders.length > 0 && (
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Order ID</th><th>Items</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {tailorOrders.map((o) => (
                  <tr key={o._id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>#{o._id?.slice(-8).toUpperCase()}</td>
                    <td style={{ wordBreak: 'break-word' }}>{getOrderItemNames(o)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatPrice(o.stitchingCost || 0)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td style={{ fontSize: 13, color: 'var(--text-light)', whiteSpace: 'nowrap' }}>{formatDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal open={showAddTailorModal} onClose={() => setShowAddTailorModal(false)} title="Add Tailor">
        <div className="form-group">
          <label className="form-label">Name</label>
          <input className="form-input" value={tailorForm.name} onChange={(e) => setTailorForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" type="email" value={tailorForm.email} onChange={(e) => setTailorForm((f) => ({ ...f, email: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Mobile No</label>
          <input className="form-input" value={tailorForm.phone} onChange={(e) => setTailorForm((f) => ({ ...f, phone: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Password</label>
          <input className="form-input" type="password" value={tailorForm.password} onChange={(e) => setTailorForm((f) => ({ ...f, password: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Repeat Password</label>
          <input className="form-input" type="password" value={tailorForm.repeatPassword} onChange={(e) => setTailorForm((f) => ({ ...f, repeatPassword: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={() => setShowAddTailorModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={createTailor} disabled={saving}>{saving ? 'Creating…' : 'Create Tailor'}</button>
        </div>
      </Modal>
    </div>
  );
}
