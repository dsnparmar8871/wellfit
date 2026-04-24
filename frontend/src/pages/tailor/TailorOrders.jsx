import { useState, useEffect, useRef } from 'react';
import { orderAPI } from '../../api/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatPrice, formatDate, getImageUrl, getErrorMsg } from '../../utils/helpers.js';
import PageSkeleton from '../../components/ui/PageSkeleton.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';

const TAILOR_STATUSES = ['tailoring', 'processing', 'ready'];

const formatMeasurementPairs = (measurements = {}) => Object.entries(measurements)
  .filter(([key, value]) => {
    if (!key || key.startsWith('_') || key === '__v') return false;
    if (value === null || value === undefined || value === '') return false;
    if (typeof value === 'object') return false;
    return true;
  })
  .map(([key, value]) => `${key}: ${value}`);

export default function TailorOrders() {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const searchInputRef = useRef(null);
  const keepSearchFocusRef = useRef(false);

  const load = () => {
    setLoading(true);
    const params = {};
    if (statusFilter) params.status = statusFilter;
    if (debouncedSearch) params.search = debouncedSearch;
    return orderAPI.getTailorOrders(params)
      .then(({ data }) => setOrders(data.data?.orders || []))
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        if (keepSearchFocusRef.current && searchInputRef.current) {
          requestAnimationFrame(() => {
            searchInputRef.current?.focus();
            const valueLength = searchInputRef.current?.value?.length || 0;
            searchInputRef.current?.setSelectionRange(valueLength, valueLength);
          });
        }
      });
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { load(); }, [statusFilter, debouncedSearch]);

  const updateStatus = async (id, status) => {
    setUpdating(id);
    try {
      await orderAPI.updateTailorStatus(id, { status });
      toast.success('Status updated!');
      load();
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setUpdating(null); }
  };

  return (
    <div className="tailor-orders-page">
      <h2 className="tailor-orders-title" style={{ marginBottom: 24 }}>My Assigned Orders</h2>
      <div className="tailor-orders-filters" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 16 }}>
        <input
          ref={searchInputRef}
          className="form-input"
          placeholder="Search by order id, item name, stitching cost"
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
          <option value="received">Received</option>
          <option value="tailoring">Tailoring</option>
          <option value="processing">Processing</option>
          <option value="ready">Ready</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <PageSkeleton variant="table" />
      ) : orders.length === 0 ? (
        <EmptyState icon="needle" title="No orders assigned" description="Orders assigned to you will appear here." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {orders.map((o) => (
            <div key={o._id} className="card">
              <div className="tailor-order-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 14 }}>#{o._id?.slice(-8).toUpperCase()}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>{formatDate(o.createdAt)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>
                    Stitching cost (owner set): <span style={{ fontWeight: 700, color: 'var(--text)' }}>{formatPrice(o.stitchingCost || 0)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <StatusBadge status={o.status} />
                </div>
              </div>
              {/* Items */}
              <div className="tailor-order-items" style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                {o.items?.filter((item) => item.isStitching).map((item, i) => (
                  (() => {
                    const isOwnMeasurement = item.measurementPreference === 'own_measurement' || !!item.ownMeasurements;
                    const measurementData = isOwnMeasurement
                      ? item.ownMeasurements
                      : item.measurementTemplateId?.measurements;
                    return (
                  <div key={i} className="tailor-order-item-chip" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--cream)', borderRadius: 6, padding: '6px 10px' }}>
                    <img src={getImageUrl(item.product?.images?.[0])} alt="" style={{ width: 30, height: 36, objectFit: 'cover', borderRadius: 4 }}
                      onError={(e) => { e.target.src = 'https://placehold.co/30x36/FFF2E1/A79277?text=W'; }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{item.product?.productName || item.product?.name || 'Item'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-light)' }}>× {item.qty}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>
                        <div>
                          Measurement type: {isOwnMeasurement ? 'Self measurements' : (item.measurementPreference || 'Not set')}
                        </div>
                        {!isOwnMeasurement && (
                        <div>
                          Assigned measurement: {item.measurementTemplateId?.name || 'Not assigned'}
                          {item.measurementTemplateId?.garmentType ? ` (${item.measurementTemplateId.garmentType})` : ''}
                        </div>
                        )}
                        {measurementData && (
                          <div>
                            {isOwnMeasurement ? 'Self measurements: ' : 'Measurements: '}
                            {formatMeasurementPairs(measurementData).join(', ')}
                          </div>
                        )}
                        {!!item.note?.trim() && (
                          <div>
                            Item note: {item.note}
                          </div>
                        )}
                        {!!item.measurementTemplateId?.notes?.trim() && (
                          <div>
                            Notes: {item.measurementTemplateId.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                    );
                  })()
                ))}
                {(!o.items || o.items.filter((item) => item.isStitching).length === 0) && (
                  <div style={{ fontSize: 12, color: 'var(--text-light)' }}>No custom stitching items in this order.</div>
                )}
              </div>
              {/* Update status */}
              <div className="tailor-order-update" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="tailor-order-update-label" style={{ fontSize: 13, color: 'var(--text-light)' }}>Update:</span>
                {TAILOR_STATUSES.map((s) => (
                  <button key={s} disabled={o.status === s || updating === o._id}
                    onClick={() => updateStatus(o._id, s)}
                    className={`btn btn-sm ${o.status === s ? 'btn-primary' : 'btn-outline'}`}
                    style={{ textTransform: 'capitalize' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <style>{`
        @media (max-width: 768px) {
          .tailor-orders-title {
            margin-bottom: 16px !important;
          }
          .tailor-orders-filters {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }
          .tailor-order-header {
            flex-direction: column;
            gap: 8px;
          }
          .tailor-order-items {
            flex-direction: column;
            gap: 8px !important;
          }
          .tailor-order-item-chip {
            width: 100%;
            align-items: flex-start !important;
          }
          .tailor-order-update {
            flex-wrap: wrap;
            align-items: stretch !important;
            gap: 6px !important;
          }
          .tailor-order-update-label {
            width: 100%;
            margin-bottom: 2px;
          }
          .tailor-order-update .btn {
            flex: 1 1 calc(50% - 6px);
            min-width: 110px;
          }
        }
      `}</style>
    </div>
  );
}
