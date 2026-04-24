import Modal from './Modal.jsx';
export default function ConfirmDialog({ open, onClose, onConfirm, title = 'Confirm', message, loading }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p style={{ color: 'var(--text-light)', marginBottom: 24 }}>{message}</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>
          {loading ? 'Processing…' : 'Confirm'}
        </button>
      </div>
    </Modal>
  );
}
