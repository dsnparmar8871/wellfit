import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { orderAPI } from '../../api/index.js';
import { formatDateTime, formatPrice, getErrorMsg } from '../../utils/helpers.js';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import PageSkeleton from '../../components/ui/PageSkeleton.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const RETURN_STATUSES = ['', 'requested', 'approved', 'processing', 'rejected', 'refunded'];

const RETURN_REASON_LABELS = {
  size_issue: 'Size or fit issue',
  wrong_item: 'Wrong item delivered',
  defective: 'Damaged or defective item',
  not_as_described: 'Different from description',
  changed_mind: 'Changed mind',
  other: 'Other',
};

const REFUND_RECEIVE_METHOD_LABELS = {
  upi_id: 'UPI ID',
  bank_account: 'Account number and IFSC code',
  collect_from_shop: 'Collect from shop',
};

export default function AdminReturns() {
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [reviewDrafts, setReviewDrafts] = useState({});

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const loadReturns = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (statusFilter) params.status = statusFilter;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const { data } = await orderAPI.getReturnRequests(params);
      const list = Array.isArray(data?.data) ? data.data : [];
      setRequests(list);
      setTotal(data?.pagination?.total || list.length || 0);

      setReviewDrafts((prev) => {
        const next = { ...prev };
        list.forEach((entry) => {
          const key = `${entry.orderId}-${entry.item?._id}`;
          if (!next[key]) {
            next[key] = {
              status: entry.item?.returnRequest?.status || 'requested',
              adminNote: entry.item?.returnRequest?.adminNote || '',
              refundAmount: entry.item?.returnRequest?.refundAmount || Number(entry.item?.price || 0) * Number(entry.item?.qty || 0),
              pickupDate: entry.item?.returnRequest?.pickupDate || '',
            };
          }
        });
        return next;
      });
    } catch (err) {
      toast.error(getErrorMsg(err));
      setRequests([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReturns();
  }, [page, statusFilter, debouncedSearch]);

  const updateDraft = (entry, patch) => {
    const key = `${entry.orderId}-${entry.item?._id}`;
    setReviewDrafts((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        ...patch,
      },
    }));
  };

  const getTodayDateInputValue = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const submitReview = async (entry) => {
    const key = `${entry.orderId}-${entry.item?._id}`;
    const draft = reviewDrafts[key];
    if (!draft?.status || !['approved', 'processing', 'rejected', 'refunded'].includes(draft.status)) {
      toast.error('Choose a valid review status (approved, processing, rejected, or refunded)');
      return;
    }

    // Pickup date required when approving
    if (draft.status === 'approved' && !draft.pickupDate) {
      toast.error('Pickup date is required when approving a return');
      return;
    }

    setUpdatingId(key);
    try {
      const payload = {
        status: draft.status,
        adminNote: draft.adminNote,
      };
      if (draft.status === 'refunded') {
        payload.refundAmount = Number(draft.refundAmount || 0);
      }
      if (draft.status === 'approved' && draft.pickupDate) {
        payload.pickupDate = draft.pickupDate;
      }
      await orderAPI.reviewReturnRequest(entry.orderId, entry.item?._id, payload);
      toast.success('Return request updated');
      await loadReturns();
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setUpdatingId('');
    }
  };

  const statusSummary = useMemo(() => {
    return requests.reduce((acc, entry) => {
      const status = entry.item?.returnRequest?.status || 'requested';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
  }, [requests]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <h1 style={{ marginBottom: 0, fontSize: '1.5rem' }}>Return Requests</h1>
        <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
          {Object.entries(statusSummary).map(([status, count]) => `${status}: ${count}`).join(' • ') || 'No requests'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <input
          className="form-input"
          style={{ maxWidth: 320 }}
          placeholder="Search by order number or customer"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {RETURN_STATUSES.map((status) => (
            <button
              key={status || 'all'}
              type="button"
              className={`btn btn-sm ${statusFilter === status ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => {
                setStatusFilter(status);
                setPage(1);
              }}
            >
              {status || 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <PageSkeleton variant="table" />
      ) : requests.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 28, color: 'var(--text-light)' }}>
          No return requests found.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {requests.map((entry) => {
              const key = `${entry.orderId}-${entry.item?._id}`;
              const draft = reviewDrafts[key] || {};
              const isBusy = updatingId === key;
              const maxRefund = Number(entry.item?.price || 0) * Number(entry.item?.qty || 0);

              return (
                <div className="card" key={key} style={{ borderLeft: '4px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>
                        {entry.item?.product?.productName || entry.item?.product?.name || 'Product'}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-light)' }}>
                        Order <Link to={`/admin/orders/${entry.orderId}`}>#{entry.orderNumber || String(entry.orderId).slice(-8).toUpperCase()}</Link> • {entry.customer?.name || 'Customer'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>
                        Qty {entry.item?.qty} • Unit {formatPrice(entry.item?.price || 0)} • Requested {formatDateTime(entry.item?.returnRequest?.requestedAt)}
                      </div>
                    </div>
                    <StatusBadge status={entry.item?.returnRequest?.status || 'requested'} />
                  </div>

                  <div style={{ marginTop: 10, fontSize: 13 }}>
                    <div
                      style={{
                        padding: '6px 8px',
                        borderRadius: 6,
                        background: '#FFF8F0',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        fontWeight: 600,
                      }}
                    >
                      Reason: {RETURN_REASON_LABELS[entry.item?.returnRequest?.reason] || entry.item?.returnRequest?.reason || 'N/A'}
                    </div>
                    {!!entry.item?.returnRequest?.refundReceiveMethod && (
                      <div style={{ marginTop: 4 }}>
                        <strong>Receive returned item cost by:</strong>{' '}
                        {REFUND_RECEIVE_METHOD_LABELS[entry.item.returnRequest.refundReceiveMethod] || entry.item.returnRequest.refundReceiveMethod}
                      </div>
                    )}
                    {entry.item?.returnRequest?.refundReceiveMethod === 'upi_id' && entry.item?.returnRequest?.upiId && (
                      <div style={{ marginTop: 4 }}><strong>UPI ID:</strong> {entry.item.returnRequest.upiId}</div>
                    )}
                    {entry.item?.returnRequest?.refundReceiveMethod === 'bank_account' && (
                      <div style={{ marginTop: 4 }}>
                        <strong>Bank:</strong> {entry.item?.returnRequest?.bankAccountNumber || '-'} | IFSC: {entry.item?.returnRequest?.bankIfscCode || '-'}
                      </div>
                    )}
                    {entry.item?.returnRequest?.adminNote && (
                      <div style={{ marginTop: 4 }}><strong>Admin note:</strong> {entry.item.returnRequest.adminNote}</div>
                    )}
                  </div>

                  <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>Status*</label>
                      <select
                        className="form-select"
                        value={draft.status || 'requested'}
                        onChange={(e) => updateDraft(entry, { status: e.target.value })}
                        disabled={isBusy || ['rejected', 'refunded'].includes(entry.item?.returnRequest?.status)}
                      >
                        <option value="requested" disabled>requested</option>
                        <option value="approved">approved</option>
                        <option value="processing">processing</option>
                        <option value="rejected">rejected</option>
                        <option value="refunded">refunded</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>Admin note</label>
                      <input
                        className="form-input"
                        placeholder="Optional note"
                        value={draft.adminNote || ''}
                        onChange={(e) => updateDraft(entry, { adminNote: e.target.value })}
                        disabled={isBusy || ['rejected', 'refunded'].includes(entry.item?.returnRequest?.status)}
                      />
                    </div>
                  </div>

                  {draft.status === 'approved' && (
                    <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>Pickup Date*</label>
                        <input
                          className="form-input"
                          type="date"
                          min={getTodayDateInputValue()}
                          value={draft.pickupDate || ''}
                          onChange={(e) => updateDraft(entry, { pickupDate: e.target.value })}
                          disabled={isBusy || ['rejected', 'refunded'].includes(entry.item?.returnRequest?.status)}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <small style={{ color: 'var(--text-light)' }}>Customer will ship on this date</small>
                      </div>
                    </div>
                  )}

                  {draft.status === 'refunded' && (
                    <div style={{ marginTop: 10 }}>
                      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>Refund Amount (INR)</label>
                      <input
                        className="form-input"
                        type="number"
                        min="0"
                        max={maxRefund}
                        step="1"
                        value={draft.refundAmount ?? maxRefund}
                        onChange={(e) => updateDraft(entry, { refundAmount: e.target.value })}
                        disabled={isBusy || ['rejected', 'refunded'].includes(entry.item?.returnRequest?.status)}
                      />
                      <small style={{ color: 'var(--text-light)', marginTop: 4, display: 'block' }}>Max refundable: {formatPrice(maxRefund)}</small>
                    </div>
                  )}

                  <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => submitReview(entry)}
                      disabled={isBusy || ['rejected', 'refunded'].includes(entry.item?.returnRequest?.status)}
                    >
                      {isBusy ? 'Updating...' : 'Update Request'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination page={page} total={total} limit={15} onChange={setPage} />
        </>
      )}
    </div>
  );
}
