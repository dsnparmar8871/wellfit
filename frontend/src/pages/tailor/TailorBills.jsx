import { useState, useEffect, useRef } from 'react';
import { tailorAPI, orderAPI } from '../../api/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatPrice, formatDate, getErrorMsg } from '../../utils/helpers.js';
import PageSkeleton from '../../components/ui/PageSkeleton.jsx';
import Modal from '../../components/ui/Modal.jsx';

export default function TailorBills() {
  const toast = useToast();
  const [bills, setBills] = useState([]);
  const [deliveredOrders, setDeliveredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const searchInputRef = useRef(null);
  const keepSearchFocusRef = useRef(false);

  // Get used order IDs from accepted/paid bills
  const getUsedOrderIds = (billList) => {
    return (billList || [])
      .filter(b => b.status !== 'pending')
      .flatMap(b => (b.orders || []).map(o => String(typeof o === 'string' ? o : o?._id)).filter(Boolean));
  };

  const load = async () => {
    setLoading(true);
    const billParams = {};
    if (debouncedSearch) billParams.search = debouncedSearch;
    if (statusFilter) billParams.status = statusFilter;
    if (paymentFilter) billParams.paymentStatus = paymentFilter;

    const [billsRes, ordersRes] = await Promise.allSettled([
      tailorAPI.getBills(billParams),
      orderAPI.getTailorOrders({ status: 'delivered' }),
    ]);

    const billsData = billsRes.status === 'fulfilled'
      ? (billsRes.value.data.data?.bills || [])
      : [];
    const ordersData = ordersRes.status === 'fulfilled'
      ? (ordersRes.value.data.data?.orders || [])
      : [];

    if (billsRes.status === 'rejected') {
      toast.error('Unable to load bill history right now. You can still request a new bill.');
    }
    if (ordersRes.status === 'rejected') {
      toast.error('Unable to load delivered orders. Please refresh and try again.');
    }

    setBills(billsData);

    // Only show DELIVERED orders that aren't already used in non-pending bills.
    const usedIds = getUsedOrderIds(billsData);
    const available = ordersData.filter((o) => o.status === 'delivered' && !usedIds.includes(String(o._id)));
    setDeliveredOrders(available);
    setLoading(false);
    if (keepSearchFocusRef.current && searchInputRef.current) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
        const valueLength = searchInputRef.current?.value?.length || 0;
        searchInputRef.current?.setSelectionRange(valueLength, valueLength);
      });
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { load(); }, [debouncedSearch, statusFilter, paymentFilter]);

  const generateBill = async () => {
    if (!selectedOrders.length) return toast.error('Select at least one order');
    setSaving(true);
    try {
      await tailorAPI.generateBill({ orderIds: selectedOrders });
      toast.success('Bill request generated!');
      setShowModal(false);
      setSelectedOrders([]);
      load();
    } catch (err) { 
      toast.error(getErrorMsg(err)); 
    }
    finally { setSaving(false); }
  };

  const toggleOrder = (id) => {
    setSelectedOrders((prev) => 
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const downloadBillPDF = async (bill) => {
    try {
      if (bill.status === 'pending') {
        toast.error('PDF is available after admin accepts your bill');
        return;
      }
      // Fetch PDF with authentication, then open in new tab
      const response = await tailorAPI.downloadBillPDF(bill._id);
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Revoke after short delay to ensure browser downloads it
      setTimeout(() => window.URL.revokeObjectURL(url), 2000);
      toast.success('Opening PDF in new tab...');
    } catch (err) {
      toast.error(getErrorMsg(err));
    }
  };

  function getPaymentStatusColor(status) {
    if (status === 'Done') return '#10B981';
    return '#EF4444';
  }

  function getPaymentStatusLabel(bill) {
    if (bill.paymentStatus) return bill.paymentStatus;
    if (bill.status === 'paid') return 'Done';
    return 'Pending';
  }

  return (
    <div className="tailor-bills-page">
      <div className="tailor-bills-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ marginBottom: 0 }}>My Bill Requests</h2>
        <button className="btn btn-primary btn-sm tailor-bills-header-btn" onClick={() => setShowModal(true)}>
          + Request Bill Payment
        </button>
      </div>

      <div className="tailor-bills-filters" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
        <input
          ref={searchInputRef}
          className="form-input"
          placeholder="Search by bill # or order #"
          value={search}
          onFocus={() => { keepSearchFocusRef.current = true; }}
          onBlur={() => { keepSearchFocusRef.current = false; }}
          onChange={(e) => {
            keepSearchFocusRef.current = true;
            setSearch(e.target.value);
          }}
        />
        <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="paid">Paid</option>
        </select>
        <select className="form-select" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
          <option value="">All Payment</option>
          <option value="Pending">Pending</option>
          <option value="Done">Done</option>
        </select>
      </div>

      {loading ? (
        <PageSkeleton variant="table" />
      ) : bills.length === 0 ? (
        <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: 40 }}>
          No bill requests yet.
        </p>
      ) : (
        <>
        <div className="table-wrap tailor-bills-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Request Date</th>
                <th>Orders Included</th>
                <th>Total Amount</th>
                <th>Payment Status</th>
                <th>Collection Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b._id}>
                  <td style={{ fontWeight: 600, fontSize: 13 }}>{b.billNumber}</td>
                  <td>{formatDate(b.requestDate)}</td>
                  <td>{b.orders?.length} order(s)</td>
                  <td style={{ fontWeight: 700 }}>{formatPrice(b.totalAmount)}</td>
                  <td>
                    {(() => {
                      const paymentLabel = getPaymentStatusLabel(b);
                      const color = getPaymentStatusColor(paymentLabel);
                      return (
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: 72,
                            padding: '5px 10px',
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 700,
                            lineHeight: 1,
                            background: `${color}20`,
                            color,
                          }}>
                            {paymentLabel}
                          </span>
                          {b.paymentCompletedAt && (
                            <span style={{ fontSize: 11, color: 'var(--text-light)' }}>
                              Completed: {formatDate(b.paymentCompletedAt)}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td>{b.collectionDate ? formatDate(b.collectionDate) : '—'}</td>
                  <td>
                    <button 
                      className="btn btn-ghost btn-xs"
                      onClick={() => downloadBillPDF(b)}
                      disabled={b.status === 'pending'}
                      title={b.status === 'pending' ? 'PDF available after admin accepts your bill' : 'View PDF in new tab'}
                    >
                      {b.status === 'pending' ? 'Not Ready' : '📄 View'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tailor-bills-mobile-list" style={{ display: 'none', flexDirection: 'column', gap: 10 }}>
          {bills.map((b) => {
            const paymentLabel = getPaymentStatusLabel(b);
            const color = getPaymentStatusColor(paymentLabel);
            return (
              <div key={b._id} className="card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{b.billNumber}</div>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 72,
                    padding: '5px 10px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    lineHeight: 1,
                    background: `${color}20`,
                    color,
                  }}>
                    {paymentLabel}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 6 }}>Requested: {formatDate(b.requestDate)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 6 }}>Orders: {b.orders?.length} order(s)</div>
                <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 6 }}>Collection: {b.collectionDate ? formatDate(b.collectionDate) : '—'}</div>
                {b.paymentCompletedAt && (
                  <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 8 }}>
                    Completed: {formatDate(b.paymentCompletedAt)}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontWeight: 700 }}>{formatPrice(b.totalAmount)}</div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => downloadBillPDF(b)}
                    disabled={b.status === 'pending'}
                    title={b.status === 'pending' ? 'PDF available after admin accepts your bill' : 'View PDF in new tab'}
                  >
                    {b.status === 'pending' ? 'Not Ready' : 'View PDF'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Request Bill Payment">
        <p style={{ color: 'var(--text-light)', fontSize: 14, marginBottom: 16 }}>
          Select delivered orders to include in this payment request:
        </p>
        {deliveredOrders.length === 0 ? (
          <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: 20 }}>
            No available delivered orders to bill
          </p>
        ) : (
          deliveredOrders.map((o) => (
            <label 
              key={o._id} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 10, 
                marginBottom: 10, 
                padding: 10, 
                border: `1.5px solid ${selectedOrders.includes(o._id) ? 'var(--brown)' : 'var(--border)'}`, 
                borderRadius: 8, 
                cursor: 'pointer',
                background: selectedOrders.includes(o._id) ? '#FFF8F0' : 'white',
              }}
            >
              <input 
                type="checkbox" 
                checked={selectedOrders.includes(o._id)} 
                onChange={() => toggleOrder(o._id)} 
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  Order #{o.orderNumber || o._id?.slice(-8).toUpperCase()}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
                  {formatDate(o.createdAt)} • Stitching: {formatPrice(o.stitchingCost || 0)}
                </div>
              </div>
              <span style={{ fontWeight: 600 }}>{formatPrice(o.stitchingCost || 0)}</span>
            </label>
          ))
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
          <button 
            className="btn btn-primary" 
            onClick={generateBill} 
            disabled={saving || selectedOrders.length === 0}
          >
            {saving ? 'Requesting…' : 'Request Payment'}
          </button>
        </div>
      </Modal>
      <style>{`
        @media (max-width: 768px) {
          .tailor-bills-header {
            flex-direction: column;
            align-items: stretch !important;
            gap: 10px;
            margin-bottom: 16px !important;
          }
          .tailor-bills-header-btn {
            width: 100%;
          }
          .tailor-bills-filters {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }
          .tailor-bills-table-wrap {
            display: none;
          }
          .tailor-bills-mobile-list {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
}
