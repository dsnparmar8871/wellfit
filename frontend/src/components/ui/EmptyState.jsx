import AppIcon from './AppIcon.jsx';

export default function EmptyState({ icon = 'box', title, description, action }) {
  const resolvedIcon = typeof icon === 'string' ? <AppIcon name={icon} size={48} /> : icon;

  return (
    <div className="empty-state">
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>{resolvedIcon}</div>
      <h3>{title}</h3>
      {description && <p style={{ marginBottom: 20 }}>{description}</p>}
      {action}
    </div>
  );
}
