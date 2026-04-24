import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { orderAPI } from '../../api/index.js';
import { formatPrice, formatDate, formatDateTime, getImageUrl, getErrorMsg } from '../../utils/helpers.js';
import PageSkeleton from '../../components/ui/PageSkeleton.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const RETURN_REASON_OPTIONS = [
  { value: 'size_issue', label: 'Size or fit issue' },
  { value: 'wrong_item', label: 'Wrong item delivered' },
  { value: 'defective', label: 'Damaged or defective item' },
  { value: 'not_as_described', label: 'Different from description' },
  { value: 'changed_mind', label: 'Changed my mind' },
  { value: 'other', label: 'Other' },
];

const RETURN_REASON_LABEL = RETURN_REASON_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const REFUND_RECEIVE_METHOD_OPTIONS = [
  { value: 'upi_id', label: 'UPI ID' },
  { value: 'bank_account', label: 'Account number and IFSC code' },
  { value: 'collect_from_shop', label: 'Collect from shop' },
];

const REFUND_RECEIVE_METHOD_LABEL = REFUND_RECEIVE_METHOD_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const hasRealReturnRequest = (item = {}) => {
  const request = item?.returnRequest;
  if (!request?.status) return false;

  return Boolean(
    request.reason ||
    request.requestedAt ||
    request.reviewedAt ||
    request.adminNote ||
    request.pickupDate ||
    Number(request.refundAmount || 0) > 0
  );
};

export default function OrderDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeReturnItemId, setActiveReturnItemId] = useState('');
  const [returnReason, setReturnReason] = useState('size_issue');
  const [refundReceiveMethod, setRefundReceiveMethod] = useState('upi_id');
  const [upiId, setUpiId] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfscCode, setBankIfscCode] = useState('');
  const [submittingReturnForItem, setSubmittingReturnForItem] = useState('');
  const [cancellingReturnForItem, setCancellingReturnForItem] = useState('');

  useEffect(() => {
    orderAPI
      .getById(id)
      .then(({ data }) => {
        const payload = data?.data;
        const resolvedOrder = payload?.order || payload || null;
        setOrder(resolvedOrder);
      })
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [id]);

  const downloadInvoice = async () => {
    const { data } = await orderAPI.downloadInvoice(id);
    const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoice-${id}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const submitReturnRequest = async (itemId) => {
    if (!returnReason) {
      toast.error('Please select a return reason');
      return;
    }

    if (!refundReceiveMethod) {
      toast.error('Please select how you want to receive returned item cost');
      return;
    }

    if (refundReceiveMethod === 'upi_id' && !upiId.trim()) {
      toast.error('Please enter your UPI ID');
      return;
    }

    if (refundReceiveMethod === 'bank_account' && (!bankAccountNumber.trim() || !bankIfscCode.trim())) {
      toast.error('Please enter account number and IFSC code');
      return;
    }

    setSubmittingReturnForItem(itemId);
    try {
      const { data } = await orderAPI.requestItemReturn(id, itemId, {
        reason: returnReason,
        refundReceiveMethod,
        upiId: refundReceiveMethod === 'upi_id' ? upiId.trim() : '',
        bankAccountNumber: refundReceiveMethod === 'bank_account' ? bankAccountNumber.trim() : '',
        bankIfscCode: refundReceiveMethod === 'bank_account' ? bankIfscCode.trim().toUpperCase() : '',
      });
      const payload = data?.data;
      const updatedOrder = payload?.order || null;
      if (updatedOrder) {
        setOrder(updatedOrder);
      }
      setActiveReturnItemId('');
      setReturnReason('size_issue');
      setRefundReceiveMethod('upi_id');
      setUpiId('');
      setBankAccountNumber('');
      setBankIfscCode('');
      toast.success('Return request submitted successfully');
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setSubmittingReturnForItem('');
    }
  };

  const cancelReturn = async (itemId) => {
    setCancellingReturnForItem(itemId);
    try {
      const { data } = await orderAPI.cancelReturnRequest(id, itemId);
      const payload = data?.data;
      const updatedOrder = payload?.order || null;
      if (updatedOrder) {
        setOrder(updatedOrder);
      }
      toast.success('Return request cancelled successfully');
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setCancellingReturnForItem('');
    }
  };

  if (loading) return <PageSkeleton variant="detail" />;
  if (!order) return <div className="alert alert-error">Order not found.</div>;

  return (
    <div>
      {/* Header Section */}
      <div className="order-header" style={{ marginBottom: 20 }}>
        <Link to="/profile/orders" style={{ fontSize: 13, color: 'var(--text-light)', display: 'block', marginBottom: 8 }}>
          ← Back to Orders
        </Link>
        <div className="order-header-main" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          <h2 style={{ marginBottom: 0, fontSize: 'clamp(1.3rem, 2.5vw, 1.8rem)' }}>Order #{order._id?.slice(-8).toUpperCase()}</h2>
          <StatusBadge status={order.status} />
        </div>
        <button className="btn btn-outline btn-sm" onClick={downloadInvoice} style={{ width: '100%' }}>
          Download Invoice
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 16 }}>Items</h3>
        {order.items?.map((item, idx) => {
          const hasReturnRequest = hasRealReturnRequest(item);

          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: 14,
                paddingBottom: 14,
                marginBottom: 14,
                borderBottom: idx < order.items.length - 1 ? '1px solid var(--border)' : 'none',
                alignItems: 'center',
              }}
            >
              <img
                src={getImageUrl(item.product?.images?.[0])}
                alt={item.product?.productName || item.product?.name}
                style={{ width: 60, height: 72, objectFit: 'cover', borderRadius: 6, background: '#F5EDE2' }}
                onError={(e) => {
                  e.target.src = 'https://placehold.co/60x72/FFF2E1/A79277?text=W';
                }}
              />

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{item.product?.productName || item.product?.name || 'Product'}</div>
                <div style={{ fontSize: 13, color: 'var(--text-light)' }}>Qty: {item.qty} · {formatPrice(item.price)} each</div>

                {hasReturnRequest ? (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>Return status</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <StatusBadge status={item.returnRequest.status} />
                    </div>

                    {item.returnRequest.status === 'processing' && (
                      <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 4 }}>
                        Refund payment is currently processing.
                      </div>
                    )}

                    <div
                      style={{
                        marginTop: 6,
                        padding: '6px 8px',
                        borderRadius: 6,
                        background: '#FFF8F0',
                        border: '1px solid var(--border)',
                        fontSize: 12,
                        color: 'var(--text)',
                        fontWeight: 600,
                      }}
                    >
                      Reason: {RETURN_REASON_LABEL[item.returnRequest.reason] || item.returnRequest.reason || '-'}
                    </div>

                    {!!item.returnRequest.refundReceiveMethod && (
                      <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>
                        Receive returned item cost by:{' '}
                        <strong style={{ color: 'var(--text)' }}>
                          {REFUND_RECEIVE_METHOD_LABEL[item.returnRequest.refundReceiveMethod] || item.returnRequest.refundReceiveMethod}
                        </strong>
                      </div>
                    )}

                    {item.returnRequest.refundReceiveMethod === 'upi_id' && item.returnRequest.upiId && (
                      <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>
                        UPI ID: <strong style={{ color: 'var(--text)' }}>{item.returnRequest.upiId}</strong>
                      </div>
                    )}

                    {item.returnRequest.refundReceiveMethod === 'bank_account' && (
                      <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>
                        Account: <strong style={{ color: 'var(--text)' }}>{item.returnRequest.bankAccountNumber || '-'}</strong>{' '}
                        | IFSC: <strong style={{ color: 'var(--text)' }}>{item.returnRequest.bankIfscCode || '-'}</strong>
                      </div>
                    )}

                    {item.returnRequest.adminNote && (
                      <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>
                        Admin note: {item.returnRequest.adminNote}
                      </div>
                    )}

                    {item.returnRequest.pickupDate && (
                      <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 4 }}>
                        Pickup scheduled: {formatDate(item.returnRequest.pickupDate)}
                      </div>
                    )}

                    {Number(item.returnRequest.refundAmount || 0) > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 4 }}>
                        Refund: {formatPrice(item.returnRequest.refundAmount)}
                      </div>
                    )}

                    {item.returnRequest.status === 'requested' && (
                      <div style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{
                            padding: '6px 12px',
                            fontSize: 12,
                            backgroundColor: 'var(--error)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                          }}
                          onClick={() => cancelReturn(item._id)}
                          disabled={cancellingReturnForItem === item._id}
                        >
                          {cancellingReturnForItem === item._id ? 'Cancelling...' : 'Cancel Return'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : item.returnMeta?.canRequest ? (
                  <div style={{ marginTop: 8 }}>
                    {activeReturnItemId === item._id ? (
                      <div style={{ background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                        <div className="form-group" style={{ marginBottom: 8 }}>
                          <label className="form-label" style={{ fontSize: 12 }}>Reason for return</label>
                          <select
                            className="form-select"
                            value={returnReason}
                            onChange={(e) => setReturnReason(e.target.value)}
                            style={{ height: 34, fontSize: 12 }}
                          >
                            {RETURN_REASON_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: 8 }}>
                          <label className="form-label" style={{ fontSize: 12 }}>Receive returned item cost via *</label>
                          <select
                            className="form-select"
                            value={refundReceiveMethod}
                            onChange={(e) => setRefundReceiveMethod(e.target.value)}
                            style={{ height: 34, fontSize: 12 }}
                          >
                            {REFUND_RECEIVE_METHOD_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {refundReceiveMethod === 'upi_id' && (
                          <div className="form-group" style={{ marginBottom: 8 }}>
                            <label className="form-label" style={{ fontSize: 12 }}>UPI ID *</label>
                            <input
                              className="form-input"
                              value={upiId}
                              onChange={(e) => setUpiId(e.target.value)}
                              placeholder="example@upi"
                            />
                          </div>
                        )}

                        {refundReceiveMethod === 'bank_account' && (
                          <>
                            <div className="form-group" style={{ marginBottom: 8 }}>
                              <label className="form-label" style={{ fontSize: 12 }}>Account number *</label>
                              <input
                                className="form-input"
                                value={bankAccountNumber}
                                onChange={(e) => setBankAccountNumber(e.target.value.replace(/\D/g, ''))}
                                placeholder="Enter account number"
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 8 }}>
                              <label className="form-label" style={{ fontSize: 12 }}>IFSC code *</label>
                              <input
                                className="form-input"
                                value={bankIfscCode}
                                onChange={(e) => setBankIfscCode(e.target.value.toUpperCase())}
                                placeholder="SBIN0001234"
                              />
                            </div>
                          </>
                        )}

                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => submitReturnRequest(item._id)}
                            disabled={submittingReturnForItem === item._id}
                          >
                            {submittingReturnForItem === item._id ? 'Submitting...' : 'Submit Return'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => {
                              setActiveReturnItemId('');
                              setRefundReceiveMethod('upi_id');
                              setUpiId('');
                              setBankAccountNumber('');
                              setBankIfscCode('');
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setActiveReturnItemId(item._id)}>
                        Request Return
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-light)' }}>
                    Return unavailable: {item.returnMeta?.reason || 'Not eligible for return'}
                  </div>
                )}
              </div>

              <div style={{ fontWeight: 700 }}>{formatPrice(item.price * item.qty)}</div>
            </div>
          );
        })}

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Total: {formatPrice(order.totalAmount)}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="order-details-grid">
        <div className="card order-payment-card" style={{ order: 1 }}>
          <h4 style={{ marginBottom: 12 }}>Payment</h4>
          <div style={{ fontSize: 14 }}>
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: 'var(--text-light)' }}>Method:</span> {order.paymentMethod}
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: 'var(--text-light)' }}>Status:</span> <StatusBadge status={order.paymentStatus || 'pending'} />
            </div>
            {order.deliveryDate && (
              <div>
                <span style={{ color: 'var(--text-light)' }}>Est. Delivery:</span> {formatDate(order.deliveryDate)}
              </div>
            )}
            {order.pickupDate && (
              <div style={{ marginTop: 6 }}>
                <span style={{ color: 'var(--text-light)' }}>Pickup Date:</span> {formatDate(order.pickupDate)}
              </div>
            )}
          </div>
        </div>

        <div className="card order-info-card" style={{ order: 2 }}>
          <h4 style={{ marginBottom: 12 }}>Delivery Address</h4>
          {order.shippingAddress ? (
            <div style={{ fontSize: 14, color: 'var(--text-light)', lineHeight: 1.7 }}>
              <div>{order.shippingAddress.line1}</div>
              {order.shippingAddress.line2 && <div>{order.shippingAddress.line2}</div>}
              <div>
                {order.shippingAddress.city}, {order.shippingAddress.state}
              </div>
              <div>{order.shippingAddress.pincode}</div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-light)', fontSize: 14 }}>No address</p>
          )}
        </div>
      </div>

      {/* Order Timeline */}
      {order.statusHistory?.length > 0 && (
        <div className="card" style={{ marginTop: 16, order: 3 }}>
          <h4 style={{ marginBottom: 16 }}>Order Timeline</h4>
          <div style={{ position: 'relative', paddingLeft: 20 }}>
            <div style={{ position: 'absolute', left: 7, top: 6, bottom: 6, width: 2, background: 'var(--border)' }} />
            {order.statusHistory.map((statusEntry, idx) => (
              <div key={idx} style={{ position: 'relative', marginBottom: 16, paddingLeft: 18 }}>
                <div
                  style={{
                    position: 'absolute',
                    left: -6,
                    top: 4,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: 'var(--brown)',
                    border: '2px solid var(--cream)',
                  }}
                />
                <div style={{ fontWeight: 600, fontSize: 13, textTransform: 'capitalize' }}>{statusEntry.status}</div>
                <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{formatDateTime(statusEntry.updatedAt)}</div>
                {statusEntry.note && <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>{statusEntry.note}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customer Info */}
      {order.customer && (
        <div className="card" style={{ marginTop: 16, order: 4 }}>
          <h4 style={{ marginBottom: 12 }}>Customer Information</h4>
          <div style={{ fontSize: 14 }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: 'var(--text-light)' }}>Name:</span> <strong>{order.customer.name || order.customer.firstName + ' ' + (order.customer.lastName || '')}</strong>
            </div>
            {order.customer.email && (
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: 'var(--text-light)' }}>Email:</span> <strong>{order.customer.email}</strong>
              </div>
            )}
            {order.customer.mobileNumber && (
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: 'var(--text-light)' }}>Phone:</span> <strong>{order.customer.mobileNumber}</strong>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .order-header {
          background: var(--cream);
          padding: 16px;
          border-radius: 8px;
        }

        .order-details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        @media (max-width: 768px) {
          .order-header {
            padding: 12px;
          }

          .order-header-main {
            flex-direction: column;
          }

          .order-details-grid {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .order-payment-card {
            order: 1 !important;
          }

          .order-info-card {
            order: 2 !important;
          }

          .card[style*="order: 3"] {
            order: 3 !important;
          }

          .card[style*="order: 4"] {
            order: 4 !important;
          }
        }

        .order-info-card.card,
        .order-payment-card.card {
          margin-bottom: 16px;
        }
      `}</style>
    </div>
  );
}
