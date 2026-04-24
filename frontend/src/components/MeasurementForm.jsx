import { useState } from 'react';
import AppIcon from './ui/AppIcon.jsx';

const MEASUREMENT_FIELDS_BY_TYPE = {
  'Shirt': ['chest', 'waist', 'shoulder', 'sleeve', 'neck', 'length'],
  'Pants': ['waist', 'inseam', 'thigh', 'crotch', 'hip'],
  'Blazer': ['chest', 'sleeve', 'shoulder', 'length', 'waist'],
  'Jodhpuri': ['chest', 'waist', 'hip', 'sleeve', 'shoulder', 'length', 'inseam'],
  'Indo-Western': ['chest', 'waist', 'sleeve', 'shoulder', 'length', 'neck'],
  'Sherwani': ['chest', 'waist', 'shoulder', 'sleeve', 'length'],
  'Kurta': ['chest', 'waist', 'hip', 'sleeve', 'shoulder', 'length'],
  'Other': ['chest', 'waist', 'hip', 'sleeve', 'length', 'shoulder', 'neck'],
};

const FIELD_LABELS = {
  chest: 'Chest',
  waist: 'Waist',
  hip: 'Hip',
  sleeve: 'Sleeve',
  length: 'Length',
  shoulder: 'Shoulder',
  neck: 'Neck',
  crotch: 'Crotch',
  thigh: 'Thigh',
  inseam: 'Inseam',
  bicep: 'Bicep',
  wrist: 'Wrist',
  frontLength: 'Front Length',
  backLength: 'Back Length',
  kurtiLength: 'Kurti Length',
};

export default function MeasurementForm({ garmentType = 'Shirt', measurements = {}, onChange, compact = false }) {
  const fields = MEASUREMENT_FIELDS_BY_TYPE[garmentType] || MEASUREMENT_FIELDS_BY_TYPE['Other'];

  const handleMeasurementChange = (field, value) => {
    onChange({
      ...measurements,
      [field]: value ? parseFloat(value) : null,
    });
  };

  return (
    <div style={{ width: '100%' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: compact ? '1fr 1fr' : 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: compact ? 12 : 16,
      }}>
        {fields.map((field) => (
          <div key={field} className="form-group">
            <label className="form-label" style={{ fontSize: compact ? 12 : 13 }}>
              {FIELD_LABELS[field] || field} (in)
            </label>
            <input
              type="number"
              className="form-input"
              step="0.1"
              min="0"
              max="60"
              value={measurements[field] || ''}
              onChange={(e) => handleMeasurementChange(field, e.target.value)}
              placeholder="0"
              style={{ fontSize: compact ? 13 : 14 }}
            />
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 12 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <AppIcon name="bulb" size={12} />
          All measurements in inches. You can update these anytime in your profile.
        </span>
      </p>
    </div>
  );
}
