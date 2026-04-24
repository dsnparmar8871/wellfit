import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { orderAPI, adminAPI, measurementAPI } from '../../api/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatPrice, formatDate, formatDateTime, getImageUrl, getErrorMsg } from '../../utils/helpers.js';
import PageSkeleton from '../../components/ui/PageSkeleton.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';

const STATUSES = ['received', 'tailoring', 'processing', 'ready', 'delivered', 'cancelled'];

const getTodayDateInputValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function AdminOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [order, setOrder] = useState(null);
  const [tailors, setTailors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [selectedTailor, setSelectedTailor] = useState('');
  const [stitchingCost, setStitchingCost] = useState('');
  const [cancellationCharge, setCancellationCharge] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [customerTemplates, setCustomerTemplates] = useState([]);
  const [assigningMeasurementItemId, setAssigningMeasurementItemId] = useState(null);
  const [updating, setUpdating] = useState(false);
  const isStatusLocked = ['delivered', 'cancelled'].includes(order?.status);
  const hasCustomItems = order?.items?.some((item) => item.isStitching);

  const load = () => {
    orderAPI.getById(id)
      .then(async ({ data }) => {
        const orderData = data.data?.order || data.data;
        setOrder(orderData || null);
        setNewStatus(orderData?.status || 'received');
        setStitchingCost(orderData?.stitchingCost != null ? String(orderData.stitchingCost) : '');
        setCancellationCharge(orderData?.cancellationCharge != null ? String(orderData.cancellationCharge) : '0');

        if (orderData?.customer?._id) {
          try {
            const { data: tplRes } = await measurementAPI.getTemplates({ customer: orderData.customer._id });
            setCustomerTemplates(tplRes.data?.templates || []);
          } catch {
            setCustomerTemplates([]);
          }
        } else {
          setCustomerTemplates([]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    adminAPI.getTailors()
      .then(({ data }) => setTailors(data.data?.tailors || []))
      .catch(() => {});
  }, [id]);

  const updateStatus = async () => {
    if (isStatusLocked) return toast.error(`Status cannot be changed after ${order.status}`);
    if (deliveryDate) {
      const selectedDate = new Date(`${deliveryDate}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        return toast.error('Delivery/Pickup date cannot be in the past');
      }
    }
    setUpdating(true);
    try {
      const payload = { status: newStatus, note: statusNote };
      if (deliveryDate) payload.deliveryDate = deliveryDate;
      if (newStatus === 'cancelled') payload.cancellationCharge = Number(cancellationCharge || 0);
      await orderAPI.updateStatus(id, payload);
      toast.success('Status updated!');
      load();
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setUpdating(false); }
  };

  const assignTailor = async () => {
    if (!selectedTailor) return toast.error('Select a tailor');
    if (stitchingCost === '' || Number(stitchingCost) < 0) return toast.error('Enter a valid stitching cost');
    setUpdating(true);
    try {
      await orderAPI.assignTailor(id, { tailorId: selectedTailor, stitchingCost: Number(stitchingCost) });
      toast.success('Tailor assigned!');
      load();
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setUpdating(false); }
  };

  const assignMeasurement = async (itemId, templateId) => {
    setAssigningMeasurementItemId(itemId);
    try {
      await orderAPI.assignItemMeasurement(id, itemId, { templateId: templateId || null });
      toast.success('Measurement assignment updated');
      load();
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setAssigningMeasurementItemId(null);
    }
  };

  const openInvoice = async () => {
    try {
      const { data } = await orderAPI.downloadInvoice(id);
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
      const pdfWindow = window.open(url, '_blank');
      if (!pdfWindow) {
        URL.revokeObjectURL(url);
        toast.error('Popup blocked. Please allow popups to view invoice PDF.');
        return;
      }

      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      toast.error(getErrorMsg(err));
    }
  };

  if (loading) return <PageSkeleton variant="detail" />;
  if (!order) return <div className="alert alert-error">Order not found.</div>;

  return (
    <div>
      {/* Header Section */}
      <div className="card" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate(-1)}>
          Go Back
        </button>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>Order ID</div>
          <div style={{ fontWeight: 700 }}>#{order._id?.slice(-8).toUpperCase()}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>Order Status</div>
          <StatusBadge status={order.status} />
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={openInvoice}>
          Invoice
        </button>
      </div>
      <div className="admin-order-grid">
        <div className="admin-order-main">
        <div className="card admin-order-items">
          <h3 style={{ marginBottom: 16 }}>Items</h3>
          {order.items?.map((item, i) => {
            const productLabel =
              item.product?.productName ||
              item.product?.name ||
              item.variantDetails?.garmentType ||
              item.variantDetails?.size ||
              (item.product?._id ? `Product #${String(item.product._id).slice(-6).toUpperCase()}` : 'Product');

            const variantParts = [item.variantDetails?.size, item.variantDetails?.color, item.variantDetails?.fabric]
              .filter(Boolean)
              .join(' / ');

            const isCustomStitching = Boolean(item.isStitching);
            const measurementPreferenceMap = {
              existing: 'Existing measurements',
              book_slot: 'Measurement slot booking',
              own_measurement: 'Self-provided measurements',
              fabric_only: 'Fabric only',
            };

            const template = item.measurementTemplateId || order.stitchingDetails?.measurementTemplate;
            const slot = item.measurementSlotId || order.stitchingDetails?.measurementSlot;
            const isOwnMeasurement = item.measurementPreference === 'own_measurement' || !!item.ownMeasurements;
            const ownMeasurements = isOwnMeasurement && item.ownMeasurements && typeof item.ownMeasurements === 'object'
              ? item.ownMeasurements
              : null;
            const measurements = ownMeasurements || template?.measurements || null;
            const measurementFields = measurements
              ? Object.entries(measurements)
                .filter(([k, v]) => !['_id', 'id', '__v', 'extra', 'createdAt', 'updatedAt'].includes(k) && v != null && v !== '')
                .map(([k, v]) => `${k}: ${v}`)
              : [];

            return (
              <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: 12, marginBottom: 12, borderBottom: i < order.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <img
                  src={getImageUrl(item.product?.images?.[0])}
                  alt=""
                  style={{ width: 52, height: 60, objectFit: 'cover', borderRadius: 6, background: '#F5EDE2' }}
                  onError={(e) => { e.target.src = 'https://placehold.co/52x60/FFF2E1/A79277?text=W'; }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{productLabel}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-light)' }}>Qty: {item.qty} · {formatPrice(item.price)} each</div>
                  {!isCustomStitching && variantParts && (
                    <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>
                      Ready-made: {variantParts}
                    </div>
                  )}
                  {isCustomStitching && (
                    <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-light)', lineHeight: 1.5 }}>
                      <div style={{ color: 'var(--text)' }}>
                        Custom stitching{item.measurementPreference ? ` • ${measurementPreferenceMap[item.measurementPreference] || item.measurementPreference}` : ''}
                      </div>
                      {template && (
                        <div>
                          Template: {template.name || 'Saved template'}{template.garmentType ? ` (${template.garmentType})` : ''}
                        </div>
                      )}
                      {slot?.dateTime && (
                        <div>
                          Slot: {formatDate(slot.dateTime)}{slot.status ? ` (${slot.status})` : ''}
                        </div>
                      )}
                      {measurementFields.length > 0 && (
                        <div>
                          {isOwnMeasurement ? 'Self measurements: ' : 'Measurements: '}{measurementFields.join(', ')}
                        </div>
                      )}
                      {!!item.note && <div>Item note: {item.note}</div>}
                      {isOwnMeasurement ? (
                        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--success)' }}>
                          Self measurements already assigned. Admin assignment not required.
                        </div>
                      ) : (
                        <div style={{ marginTop: 8 }}>
                          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-light)', marginBottom: 4 }}>
                            Assign customer measurement
                          </label>
                          <select
                            className="form-select"
                            style={{ maxWidth: 260, height: 34, fontSize: 12 }}
                            value={template?._id || ''}
                            onChange={(e) => assignMeasurement(item._id, e.target.value)}
                            disabled={assigningMeasurementItemId === item._id}
                          >
                            <option value="">No measurement assigned</option>
                            {customerTemplates
                              .filter((tpl) => !item.garmentType || !tpl.garmentType || tpl.garmentType === item.garmentType)
                              .map((tpl) => (
                                <option key={tpl._id} value={tpl._id}>
                                  {tpl.name}{tpl.garmentType ? ` (${tpl.garmentType})` : ''}
                                </option>
                              ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ fontWeight: 700 }}>{formatPrice(item.price * item.qty)}</div>
              </div>
            );
          })}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <strong>Total: {formatPrice(order.totalAmount)}</strong>
          </div>
        </div>

        {order.statusHistory?.length > 0 && (
          <div className="card admin-order-timeline">
            <h3 style={{ marginBottom: 16 }}>Order Timeline</h3>
            <div style={{ paddingLeft: 16 }}>
              {order.statusHistory.map((s, i) => (
                <div key={i} style={{ position: 'relative', marginBottom: 14, paddingLeft: 18, borderLeft: '2px solid var(--border)' }}>
                  <div style={{ position: 'absolute', left: -5, top: 4, width: 8, height: 8, borderRadius: '50%', background: 'var(--brown)' }} />
                  <div style={{ fontWeight: 600, fontSize: 13, textTransform: 'capitalize' }}>{s.status}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{formatDateTime(s.updatedAt)}</div>
                  {s.note && <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>{s.note}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
        </div>

        <div className="admin-order-side">
        <div className="card admin-order-status">
          <h4 style={{ marginBottom: 14 }}>Update Status</h4>
          {isStatusLocked && (
            <div className="alert alert-info" style={{ marginBottom: 10, fontSize: 13 }}>
              Status is locked because this order is {order.status}.
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={newStatus} onChange={(e) => setNewStatus(e.target.value)} disabled={isStatusLocked}>
              {STATUSES.map((s) => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Delivery/Pickup Date</label>
            <input
              className="form-input"
              type="date"
              min={getTodayDateInputValue()}
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              disabled={isStatusLocked}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Note (optional)</label>
            <input className="form-input" value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="Add a note..." disabled={isStatusLocked} />
          </div>
          {newStatus === 'cancelled' && (
            <div className="form-group">
              <label className="form-label">Cancellation Charge (INR)</label>
              <input
                className="form-input"
                type="number"
                min="0"
                step="1"
                value={cancellationCharge}
                onChange={(e) => setCancellationCharge(e.target.value)}
                disabled={isStatusLocked}
              />
            </div>
          )}
          <button className="btn btn-primary btn-sm btn-full" onClick={updateStatus} disabled={updating || isStatusLocked}>
            {updating ? 'Updating...' : 'Update Status'}
          </button>
        </div>

        <div className="card admin-order-tailor">
          <h4 style={{ marginBottom: 14 }}>Assign Tailor</h4>
          {!hasCustomItems && (
            <div className="alert alert-warning" style={{ marginBottom: 10, fontSize: 13 }}>
              Tailor assignment is disabled for ready-made or accessory only orders.
            </div>
          )}
          {order.assignedTailor && (
            <div className="alert alert-info" style={{ marginBottom: 10, fontSize: 13 }}>
              Currently: {order.assignedTailor?.name || 'Assigned'}
            </div>
          )}
          <div className="form-group">
            <select className="form-select" value={selectedTailor} onChange={(e) => setSelectedTailor(e.target.value)} disabled={!hasCustomItems}>
              <option value="">Select tailor...</option>
              {tailors.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Stitching Cost (INR)</label>
            <input
              className="form-input"
              type="number"
              min="0"
              step="1"
              value={stitchingCost}
              onChange={(e) => setStitchingCost(e.target.value)}
              placeholder="Enter tailor payout for this order"
            />
          </div>
          <button className="btn btn-outline btn-sm btn-full" onClick={assignTailor} disabled={updating || !selectedTailor || !hasCustomItems}>
            Assign
          </button>
          {order.stitchingCost > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-light)' }}>
              Current stitching cost: {formatPrice(order.stitchingCost)}
            </div>
          )}
        </div>

        <div className="card admin-order-customer">
          <h4 style={{ marginBottom: 12 }}>Customer</h4>
          <div style={{ fontSize: 14, color: 'var(--text-light)' }}>
            <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{order.customer?.name}</div>
            <div>{order.customer?.email}</div>
            <div>{order.customer?.phone}</div>
          </div>
        </div>

        <div className="card admin-order-shipping">
          <h4 style={{ marginBottom: 12 }}>Shipping Address</h4>
          {order.shippingAddress ? (
            <div style={{ fontSize: 13, color: 'var(--text-light)', lineHeight: 1.7 }}>
              <div>{order.shippingAddress.line1}</div>
              {order.shippingAddress.line2 && <div>{order.shippingAddress.line2}</div>}
              <div>{order.shippingAddress.city}, {order.shippingAddress.state}</div>
              <div>{order.shippingAddress.pincode}</div>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-light)' }}>No address</p>
          )}
        </div>
        </div>
      </div>

      <style>{`
        .admin-order-header {
          background: var(--cream);
          padding: 16px;
          border-radius: 8px;
        }

        .admin-order-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
          gap: 20px;
          align-items: start;
        }

        .admin-order-main,
        .admin-order-side {
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-width: 0;
        }

        @media (max-width: 1280px) {
          .admin-order-grid {
            grid-template-columns: minmax(0, 1fr) minmax(280px, 320px);
            gap: 16px;
          }
        }

        @media (max-width: 1024px) {
          .admin-order-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }

        @media (max-width: 768px) {
          .admin-order-header {
            padding: 12px;
          }

          .admin-order-header-main {
            flex-direction: column;
          }

          .card {
            order: auto;
          }

          .form-select,
          .form-input {
            width: 100%;
          }

          .btn-full {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
