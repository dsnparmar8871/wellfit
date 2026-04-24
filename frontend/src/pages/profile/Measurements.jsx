import { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import { measurementAPI } from '../../api/index.js';
import { formatDateTime, getErrorMsg } from '../../utils/helpers.js';
import PageSkeleton from '../../components/ui/PageSkeleton.jsx';
import Modal from '../../components/ui/Modal.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import AppIcon from '../../components/ui/AppIcon.jsx';
import MeasurementTimePicker from '../../components/measurement/MeasurementTimePicker.jsx';

export default function Measurements() {
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('templates');
  const [showForm, setShowForm] = useState(false);
  const [showSlot, setShowSlot] = useState(false);
  const [editTpl, setEditTpl] = useState(null);
  const [form, setForm] = useState({ name: '', garmentType: '', notes: '' });
  const [slotForm, setSlotForm] = useState({ date: '', time: '', garmentType: 'Shirt', notes: '' });
  const [saving, setSaving] = useState(false);

  const GARMENT_TYPES = ['Shirt', 'Pants', 'Blazer', 'Jodhpuri', 'Indo-Western', 'Sherwani', 'Kurta', 'Other'];

  const loadData = async () => {
    setLoading(true);
    try {
      const [td, sd] = await Promise.all([measurementAPI.getTemplates(), measurementAPI.getSlots()]);
      setTemplates(td.data.data?.templates || []);
      setSlots(sd.data.data?.slots || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const openForm = (tpl = null) => {
    if (!tpl) return;
    setEditTpl(tpl);
    setForm({ name: tpl.name, garmentType: tpl.garmentType, notes: tpl.notes || '' });
    setShowForm(true);
  };

  const saveTpl = async () => {
    if (!editTpl) return;
    setSaving(true);
    try {
      await measurementAPI.updateTemplate(editTpl._id, { notes: form.notes || '' });
      toast.success('Notes updated!');
      setShowForm(false);
      loadData();
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  };

  const bookSlot = async () => {
    if (!slotForm.date || !slotForm.time) return toast.error('Please select date and time');
    if (!slotForm.garmentType) return toast.error('Please select garment type');
    if (slotForm.time < '09:00' || slotForm.time > '22:00') {
      return toast.error('Booking is allowed only between 09:00 AM and 10:00 PM');
    }
    setSaving(true);
    try {
      await measurementAPI.bookSlot({ 
        dateTime: `${slotForm.date}T${slotForm.time}`, 
        garmentType: slotForm.garmentType,
        notes: slotForm.notes 
      });
      toast.success('Slot booked! Awaiting confirmation.');
      setShowSlot(false);
      loadData();
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  };

  if (loading) return <PageSkeleton variant="list" />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ marginBottom: 0 }}>Measurements</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={() => setShowSlot(true)}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AppIcon name="calendar" size={14} /> Book Slot</span></button>
        </div>
      </div>

      <div className="tabs">
        {[['templates', 'Measurement Templates'], ['slots', 'Booked Slots']].map(([k, l]) => (
          <button key={k} className={`tab-btn${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'templates' && (
        templates.length === 0 ? (
          <EmptyState icon="ruler" title="No templates" description="Save your measurements as templates for quick ordering." />
        ) : (
          <div className="grid-2">
            {templates.map((t) => (
              <div key={t._id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{t.name}</div>
                    <span className="badge badge-cream" style={{ marginTop: 4 }}>{t.garmentType}</span>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => openForm(t)}>Edit</button>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
                  Measurement figures are hidden. You can edit notes only.
                </div>
                {t.notes && <div style={{ marginTop: 10, fontSize: 13 }}><b>Notes:</b> {t.notes}</div>}
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'slots' && (
        slots.length === 0 ? (
          <EmptyState icon="calendar" title="No bookings" description="Book a measurement slot to visit our shop." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {slots.map((s) => (
              <div key={s._id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{formatDateTime(s.dateTime)}</div>
                  {s.notes && <div style={{ fontSize: 13, color: 'var(--text-light)' }}>{s.notes}</div>}
                </div>
                <StatusBadge status={s.status} />
              </div>
            ))}
          </div>
        )
      )}

      {/* Template Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Edit Measurement Notes" maxWidth={600}>
        <div className="form-row" style={{ marginBottom: 16 }}>
          <div className="form-group">
            <label className="form-label">Item Name</label>
            <input className="form-input" value={form.name} disabled />
          </div>
          <div className="form-group">
            <label className="form-label">Garment Type</label>
            <input className="form-input" value={form.garmentType} disabled />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Any special instructions…" style={{ minHeight: 70 }} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={saveTpl} disabled={saving}>{saving ? 'Saving…' : 'Save Template'}</button>
        </div>
      </Modal>

      {/* Slot Modal */}
      <Modal open={showSlot} onClose={() => setShowSlot(false)} title="Book Measurement Slot" maxWidth={500}>
        <div>
          <p style={{ fontSize: 14, marginBottom: 16, color: 'var(--text-light)' }}>
            Schedule an appointment for your measurement session at our shop.
          </p>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input className="form-input" type="date" value={slotForm.date} min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setSlotForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
          </div>

          <MeasurementTimePicker
            date={slotForm.date}
            value={slotForm.time}
            onChange={(time) => setSlotForm((f) => ({ ...f, time }))}
            open={showSlot}
          />

          <div className="form-group">
            <label className="form-label">Garment Type *</label>
            <select
              className="form-select"
              value={slotForm.garmentType}
              onChange={(e) => setSlotForm((f) => ({ ...f, garmentType: e.target.value }))}>
              {GARMENT_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Notes (Optional)</label>
            <textarea className="form-input" rows="3" value={slotForm.notes} onChange={(e) => setSlotForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Any special requirements or preferences..." />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button className="btn btn-ghost" onClick={() => setShowSlot(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={bookSlot} disabled={saving}>{saving ? 'Booking…' : 'Confirm Booking'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
