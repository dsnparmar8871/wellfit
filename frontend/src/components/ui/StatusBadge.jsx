import { statusBadgeClass } from '../../utils/helpers.js';
export default function StatusBadge({ status }) {
  return <span className={`badge ${statusBadgeClass(status)}`}>{status}</span>;
}
