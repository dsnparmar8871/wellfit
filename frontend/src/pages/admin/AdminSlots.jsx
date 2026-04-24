import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../../api/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatDateTime, getErrorMsg, isValidMeasurementTime } from '../../utils/helpers.js';
import PageSkeleton from '../../components/ui/PageSkeleton.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import Modal from '../../components/ui/Modal.jsx';
import MeasurementTimePicker from '../../components/measurement/MeasurementTimePicker.jsx';

export default function AdminSlots() {
  const toast = useToast();
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [fromDate, setFromDate] = useState('');
  const [rescheduleSlot, setRescheduleSlot] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [saving, setSaving] = useState(false);
  const searchInputRef = useRef(null);
  const keepSearchFocusRef = useRef(false);

  const load = () => {
    setLoading(true);
    adminAPI.getSlots({
      status: statusFilter || undefined,
      search: debouncedSearch || undefined,
      from: fromDate || undefined,
    })
      .then(({ data }) => {
        const list = Array.isArray(data.data) ? data.data : (data.data?.slots || []);
        setSlots(list);
      })
      .catch(() => { })
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

  useEffect(() => { load(); }, [statusFilter, debouncedSearch, fromDate]);

  const updateStatus = async (id, status, dateTime) => {
    try {
      await adminAPI.updateSlot(id, { status, ...(dateTime && { dateTime }) });
      toast.success(`Slot ${status}`);
      load();
    } catch (err) { toast.error(getErrorMsg(err)); }
  };

  const handleReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) return toast.error('Please select date and time slot');
    if (!isValidMeasurementTime(rescheduleTime)) {
      return toast.error('Booking is allowed only between 09:00 AM and 10:00 PM');
    }
    setSaving(true);
    try {
      const selectedDateTime = `${rescheduleDate}T${rescheduleTime}`;
      await adminAPI.updateSlot(rescheduleSlot._id, { status: 'approved', rescheduledTo: selectedDateTime });
      toast.success('Slot rescheduled');
      setRescheduleSlot(null);
      load();
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  };

  const getOrderIdText = (slot) => {
    const orderRef = slot?.orderRef;
    if (!orderRef) return '—';
    if (typeof orderRef === 'string') return orderRef;
    return orderRef._id || '—';
  };

  const getDisplayOrderId = (slot) => {
    const rawId = getOrderIdText(slot);
    if (!rawId || rawId === '—') return '—';
    return `#${String(rawId).slice(-8).toUpperCase()}`;
  };

  const getOrderLabel = (slot) => {
    if (!slot?.orderRef || typeof slot.orderRef === 'string') return null;
    return slot.orderRef.orderNumber || null;
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: 24 }}>Measurement Slots</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 12 }}>
        <input
          ref={searchInputRef}
          className="form-input"
          placeholder="Search by customer name, email or mobile"
          value={search}
          onFocus={() => { keepSearchFocusRef.current = true; }}
          onBlur={() => { keepSearchFocusRef.current = false; }}
          onChange={(e) => {
            keepSearchFocusRef.current = true;
            setSearch(e.target.value);
          }}
        />
        <input className="form-input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['', 'All']].map(([v, l]) => (
          <button key={v} className={`btn btn-sm ${statusFilter === v ? 'btn-primary' : 'btn-outline'}`} onClick={() => setStatusFilter(v)}>{l}</button>
        ))}
        {(search || fromDate) && (
          <button className="btn btn-sm btn-ghost" onClick={() => { setSearch(''); setFromDate(''); }}>Clear</button>
        )}
      </div>
      {loading ? <PageSkeleton variant="table" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Customer</th><th>Date & Time</th><th>Order ID</th><th>Notes</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {slots.map((s) => (
                <tr key={s._id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.customer?.name || '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{s.customer?.email}</div>
                  </td>
                  <td style={{ fontWeight: 500 }}>{formatDateTime(s.dateTime)}</td>
                  <td style={{ fontSize: 13 }}>
                    {s.orderRef ? (
                      <Link to={`/admin/orders/${getOrderIdText(s)}`} style={{ color: 'var(--brown)', textDecoration: 'underline', fontWeight: 500 }}>
                        {getDisplayOrderId(s)}
                      </Link>
                    ) : (
                      <div>—</div>
                    )}
                    {getOrderLabel(s) && <div style={{ fontSize: 12, color: 'var(--text-light)' }}>#{getOrderLabel(s)}</div>}
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-light)' }}>{s.notes || '—'}</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {s.status === 'pending' && (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={() => updateStatus(s._id, 'approved')}>Approve</button>
                          {!s.orderRef && (
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }} onClick={() => updateStatus(s._id, 'rejected')}>Reject</button>
                          )}
                        </>
                      )}
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => {
                          const baseDateTime = new Date(s.rescheduledTo || s.dateTime);
                          const hasValidDate = !Number.isNaN(baseDateTime.getTime());
                          const defaultDate = hasValidDate
                            ? `${baseDateTime.getFullYear()}-${String(baseDateTime.getMonth() + 1).padStart(2, '0')}-${String(baseDateTime.getDate()).padStart(2, '0')}`
                            : '';
                          setRescheduleSlot(s);
                          setRescheduleDate(defaultDate);
                          setRescheduleTime('');
                        }}
                      >
                        Reschedule
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {slots.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-light)' }}>No slots found.</div>}
        </div>
      )}
      <Modal open={!!rescheduleSlot} onClose={() => setRescheduleSlot(null)} title="Reschedule Slot">
        <p style={{ color: 'var(--text-light)', marginBottom: 16, fontSize: 14 }}>Current: {rescheduleSlot && formatDateTime(rescheduleSlot.dateTime)}</p>
        <div className="form-group">
          <label className="form-label">New Date *</label>
          <input
            className="form-input"
            type="date"
            value={rescheduleDate}
            min={new Date().toISOString().split('T')[0]}
            onChange={(e) => {
              setRescheduleDate(e.target.value);
              setRescheduleTime('');
            }}
          />
        </div>
        <MeasurementTimePicker
          date={rescheduleDate}
          value={rescheduleTime}
          onChange={(time) => setRescheduleTime(time)}
          open={!!rescheduleSlot}
          allowBookedSelection
        />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={() => setRescheduleSlot(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleReschedule} disabled={saving}>{saving ? 'Saving…' : 'Reschedule'}</button>
        </div>
      </Modal>
    </div>
  );
}
