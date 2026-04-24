import { useEffect, useMemo, useState } from 'react';
import { measurementAPI } from '../../api/index.js';

const SLOT_START_MINUTES = 9 * 60;
const SLOT_END_MINUTES = 22 * 60;
const SLOT_STEP_MINUTES = 10;
const CONFLICT_WINDOW_MS = 10 * 60 * 1000;

const formatTime = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const parseTimeToMinutes = (time) => {
  const [hours, minutes] = String(time || '00:00').split(':').map(Number);
  return (Number(hours) || 0) * 60 + (Number(minutes) || 0);
};

const toDateTime = (date, time) => new Date(`${date}T${time}`);

export default function MeasurementTimePicker({ date, value, onChange, open = true, allowBookedSelection = false }) {
  const [bookedSlots, setBookedSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeSectionKey, setActiveSectionKey] = useState('morning');

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let minutes = SLOT_START_MINUTES; minutes <= SLOT_END_MINUTES; minutes += SLOT_STEP_MINUTES) {
      slots.push(formatTime(minutes));
    }
    return slots;
  }, []);

  useEffect(() => {
    if (!open || !date) {
      setBookedSlots([]);
      return;
    }

    let active = true;

    const loadAvailability = async () => {
      setLoading(true);
      try {
        const { data } = await measurementAPI.getSlotAvailability(date);
        if (!active) return;
        setBookedSlots(data.data?.bookedSlots || []);
      } catch {
        if (active) setBookedSlots([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadAvailability();

    return () => {
      active = false;
    };
  }, [date, open]);

  const isTimeBooked = (time) => {
    if (!date) return false;
    const selectedTime = toDateTime(date, time).getTime();
    return bookedSlots.some((slot) => {
      const slotTime = new Date(slot.dateTime).getTime();
      return Math.abs(slotTime - selectedTime) < CONFLICT_WINDOW_MS;
    });
  };

  const slotSections = useMemo(() => {
    const sectionConfig = [
      { key: 'morning', title: '09:00 - 13:00', start: 9 * 60, endExclusive: 13 * 60 },
      { key: 'afternoon', title: '13:00 - 17:00', start: 13 * 60, endExclusive: 17 * 60 },
      { key: 'evening', title: '17:00 - 22:00', start: 17 * 60, endExclusive: Infinity },
    ];

    return sectionConfig
      .map((section) => ({
        ...section,
        slots: timeSlots.filter((time) => {
          const mins = parseTimeToMinutes(time);
          return mins >= section.start && mins < section.endExclusive;
        }),
      }))
      .filter((section) => section.slots.length > 0);
  }, [timeSlots]);

  useEffect(() => {
    if (slotSections.length === 0) return;
    const hasActive = slotSections.some((section) => section.key === activeSectionKey);
    if (!hasActive) setActiveSectionKey(slotSections[0].key);
  }, [slotSections, activeSectionKey]);

  const activeSection = useMemo(
    () => slotSections.find((section) => section.key === activeSectionKey) || slotSections[0],
    [slotSections, activeSectionKey]
  );

  return (
    <div className="form-group">
      <label className="form-label">Time *</label>
      <div style={{ marginBottom: 10 }}>
        <label className="form-label" style={{ marginBottom: 6 }}>Time Range</label>
        <select
          className="form-select"
          value={activeSectionKey}
          onChange={(e) => setActiveSectionKey(e.target.value)}
          disabled={!date || slotSections.length === 0}
        >
          {slotSections.map((section) => (
            <option key={section.key} value={section.key}>{section.title}</option>
          ))}
        </select>
      </div>
      {activeSection && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 10, background: 'var(--white)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-light)', marginBottom: 8, letterSpacing: '0.02em' }}>
            {activeSection.title}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8 }}>
            {activeSection.slots.map((time) => {
              const booked = isTimeBooked(time);
              const selected = value === time;
              const canSelect = !booked || allowBookedSelection;
              return (
                <button
                  key={time}
                  type="button"
                  onClick={() => canSelect && onChange(time)}
                  disabled={!date || !canSelect}
                  style={{
                    padding: '10px 8px',
                    borderRadius: 10,
                    border: booked
                      ? (selected ? '2px solid #B71C1C' : '1px solid #D32F2F')
                      : (selected ? '2px solid #2E7D32' : '1px solid #66BB6A'),
                    background: booked
                      ? (selected ? '#D32F2F' : '#FFEBEE')
                      : (selected ? '#2E7D32' : '#E8F5E9'),
                    color: booked
                      ? (selected ? '#FFFFFF' : '#B71C1C')
                      : (selected ? '#FFFFFF' : '#1B5E20'),
                    fontWeight: 600,
                    cursor: !date || !canSelect ? 'not-allowed' : 'pointer',
                    boxShadow: selected
                      ? (booked ? '0 6px 16px rgba(211, 47, 47, 0.25)' : '0 6px 16px rgba(46, 125, 50, 0.2)')
                      : 'none',
                    opacity: !date || !canSelect ? 0.7 : 1,
                  }}
                >
                  {time}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8, fontSize: 12, color: 'var(--text-light)' }}>
        <span>
          {loading
            ? 'Checking availability...'
            : allowBookedSelection
              ? 'Available times are green. Booked times are red and can still be selected by admin.'
              : 'Available times are shown in green. Booked times are shown in red.'}
        </span>
        <span>Booking window: 10 minutes per slot.</span>
      </div>
    </div>
  );
}