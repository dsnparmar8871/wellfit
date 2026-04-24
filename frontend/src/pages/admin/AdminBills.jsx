import { useState, useEffect, useRef } from 'react';
import { adminAPI } from '../../api/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatPrice, formatDate, getErrorMsg } from '../../utils/helpers.js';
import PageSkeleton from '../../components/ui/PageSkeleton.jsx';
import Modal from '../../components/ui/Modal.jsx';
import AppIcon from '../../components/ui/AppIcon.jsx';

export default function AdminBills() {
  const toast = useToast();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [selectedBill, setSelectedBill] = useState(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [collectionDate, setCollectionDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const searchInputRef = useRef(null);
  const keepSearchFocusRef = useRef(false);

  const limit = 10;

  const normalizePaymentStatus = (status) => String(status || '').trim().toLowerCase();
  const isPaymentDone = (bill) => normalizePaymentStatus(bill?.paymentStatus) === 'done';
  const isPaymentPending = (bill) => normalizePaymentStatus(bill?.paymentStatus) === 'pending';

  const load = async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (paymentStatusFilter) params.paymentStatus = paymentStatusFilter;
      const res = await adminAPI.getBills(params);
      setBills(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      toast.error('Failed to load bills');
    }
    setLoading(false);
    if (keepSearchFocusRef.current && searchInputRef.current) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
        const valueLength = searchInputRef.current?.value?.length || 0;
        searchInputRef.current?.setSelectionRange(valueLength, valueLength);
      });
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { load(); }, [page, debouncedSearch, statusFilter, paymentStatusFilter]);

  const handleAcceptBill = async () => {
    if (!collectionDate) return toast.error('Please select a collection date');
    setSubmitting(true);
    try {
      await adminAPI.acceptBill(selectedBill._id, { collectionDate });
      toast.success('Bill accepted!');
      setShowAcceptModal(false);
      setCollectionDate('');
      setSelectedBill(null);
      load();
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePaymentStatus = async (status) => {
    if (isPaymentDone(selectedBill)) {
      toast.error('This bill\'s payment status is already finalized and cannot be changed');
      setShowPaymentModal(false);
      setSelectedBill(null);
      return;
    }

    setSubmitting(true);
    try {
      await adminAPI.updatePaymentStatus(selectedBill._id, { paymentStatus: status });
      toast.success(`Payment marked as ${status}`);
      setShowPaymentModal(false);
      setSelectedBill(null);
      load();
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await adminAPI.exportBillsCSV();
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tailor_bills_registry_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('CSV exported successfully!');
    } catch (err) {
      toast.error(getErrorMsg(err));
    }
  };

  const handleDownloadBillPDF = async (bill) => {
    if (bill.status === 'pending') {
      toast.error('PDF is available after bill is accepted');
      return;
    }
    try {
      const response = await adminAPI.downloadBillPDF(bill._id);
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 2000);
      toast.success('Opening PDF in new tab...');
    } catch (err) {
      toast.error(getErrorMsg(err));
    }
  };

  const getStatusBadgeStyle = (status) => {
    const styles = {
      pending: { bg: '#FEF3C7', color: '#92400E' },
      accepted: { bg: '#DBEAFE', color: '#1E40AF' },
      paid: { bg: '#DCFCE7', color: '#166534' },
    };
    return styles[status] || styles.pending;
  };

  const getPaymentStatusColor = (status) => {
    return normalizePaymentStatus(status) === 'done' ? '#10B981' : '#EF4444';
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ marginBottom: 0 }}>Tailor Bill Requests</h2>
        <button className="btn btn-primary btn-sm" onClick={handleExportCSV}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AppIcon name="chart" size={14} /> Export CSV</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
        <input
          ref={searchInputRef}
          className="form-input"
          placeholder="Search by bill #, tailor, email, phone, order #"
          value={search}
          onFocus={() => { keepSearchFocusRef.current = true; }}
          onBlur={() => { keepSearchFocusRef.current = false; }}
          onChange={(e) => {
            keepSearchFocusRef.current = true;
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={{
            padding: '8px 12px',
            border: '1.5px solid var(--border)',
            borderRadius: 6,
            background: 'white',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="paid">Paid</option>
        </select>
        <select
          value={paymentStatusFilter}
          onChange={(e) => { setPaymentStatusFilter(e.target.value); setPage(1); }}
          style={{
            padding: '8px 12px',
            border: '1.5px solid var(--border)',
            borderRadius: 6,
            background: 'white',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <option value="">All Payments</option>
          <option value="Pending">Pending</option>
          <option value="Done">Done</option>
        </select>
      </div>

      {loading ? (
        <PageSkeleton variant="table" />
      ) : bills.length === 0 ? (
        <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: 40 }}>
          No bill requests found.
        </p>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bill #</th>
                  <th>Tailor</th>
                  <th>Request Date</th>
                  <th>Orders</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Collection Date</th>
                  <th>Payment Status</th>
                  <th>Payment Completed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => {
                  const statusStyle = getStatusBadgeStyle(bill.status);
                  const paymentColor = getPaymentStatusColor(bill.paymentStatus);
                  return (
                    <tr key={bill._id}>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>{bill.billNumber}</td>
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{bill.tailor?.name || 'N/A'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{bill.tailor?.email}</div>
                      </td>
                      <td>{formatDate(bill.requestDate)}</td>
                      <td>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                          {bill.orders?.length || 0} orders
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-light)', maxWidth: 180 }}>
                          {(bill.orders || [])
                            .map((o) => o?.orderNumber || o?._id)
                            .filter(Boolean)
                            .join(', ') || 'N/A'}
                        </div>
                      </td>
                      <td style={{ fontWeight: 700 }}>{formatPrice(bill.totalAmount)}</td>
                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            background: statusStyle.bg,
                            color: statusStyle.color,
                            textTransform: 'capitalize',
                          }}
                        >
                          {bill.status}
                        </span>
                      </td>
                      <td>{bill.collectionDate ? formatDate(bill.collectionDate) : '—'}</td>
                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            background: paymentColor + '20',
                            color: paymentColor,
                          }}
                        >
                          {bill.paymentStatus}
                        </span>
                      </td>
                      <td>
                        {bill.paymentCompletedAt ? (
                          <div style={{ fontSize: 12 }}>{formatDate(bill.paymentCompletedAt)}</div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => handleDownloadBillPDF(bill)}
                            disabled={bill.status === 'pending'}
                            title={bill.status === 'pending' ? 'PDF available after bill is accepted' : 'View PDF in new tab'}
                          >
                            📄 View
                          </button>
                          {bill.status === 'pending' && (
                            <button
                              className="btn btn-primary btn-xs"
                              onClick={() => {
                                setSelectedBill(bill);
                                setShowAcceptModal(true);
                              }}
                            >
                              Accept
                            </button>
                          )}
                          {bill.status !== 'pending' && !isPaymentDone(bill) && (
                            <button
                              className="btn btn-outline btn-xs"
                              onClick={() => {
                                setSelectedBill(bill);
                                setShowPaymentModal(true);
                              }}
                            >
                              Payment
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Prev
              </button>
              <span style={{ padding: '8px 12px', fontSize: 13 }}>
                Page {page} of {totalPages}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      <Modal
        open={showAcceptModal}
        onClose={() => {
          setShowAcceptModal(false);
          setSelectedBill(null);
          setCollectionDate('');
        }}
        title="Accept Bill Request"
      >
        {selectedBill && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 8 }}>
                <strong>Tailor:</strong> {selectedBill.tailor?.name}
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 8 }}>
                <strong>Total Amount:</strong> {formatPrice(selectedBill.totalAmount)}
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-light)' }}>
                <strong>Orders:</strong> {selectedBill.orders?.length}
              </p>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Collection Date
              </label>
              <input
                type="date"
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1.5px solid var(--border)',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowAcceptModal(false);
                  setSelectedBill(null);
                  setCollectionDate('');
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAcceptBill}
                disabled={submitting || !collectionDate}
              >
                {submitting ? 'Accepting…' : 'Accept Bill'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={showPaymentModal && selectedBill && !isPaymentDone(selectedBill)}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedBill(null);
        }}
        title="Update Payment Status"
      >
        {selectedBill && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 8 }}>
                <strong>Bill:</strong> {selectedBill.billNumber}
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 8 }}>
                <strong>Tailor:</strong> {selectedBill.tailor?.name}
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 8 }}>
                <strong>Amount:</strong> {formatPrice(selectedBill.totalAmount)}
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-light)' }}>
                <strong>Current Status:</strong> {selectedBill.paymentStatus}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedBill(null);
                }}
              >
                Cancel
              </button>
              {isPaymentPending(selectedBill) && (
                <button
                  className="btn btn-success"
                  onClick={() => handleUpdatePaymentStatus('Done')}
                  disabled={submitting}
                >
                  {submitting ? 'Updating…' : 'Mark as Done'}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
