import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { orderAPI, measurementAPI } from '../../api/index.js';
import { formatDateTime, formatPrice, getErrorMsg } from '../../utils/helpers.js';
import PageSkeleton from '../../components/ui/PageSkeleton.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import AppIcon from '../../components/ui/AppIcon.jsx';

const MEASUREMENT_FIELDS_DISPLAY = {
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
};

export default function CustomerProfile() {
  const { user } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [ordersRes, templatesRes, slotsRes] = await Promise.all([
          orderAPI.getMyOrders().catch(() => ({ data: { data: { orders: [] } } })),
          measurementAPI.getTemplates().catch(() => ({ data: { data: { templates: [] } } })),
          measurementAPI.getSlots().catch(() => ({ data: { data: { slots: [] } } })),
        ]);

        const ordersList = ordersRes.data?.data?.orders || [];
        const templatesList = templatesRes.data?.data?.templates || [];
        const slotsList = slotsRes.data?.data?.slots || [];

        setOrders(ordersList);
        setTemplates(templatesList);
        setSlots(slotsList);
      } catch (err) {
        toast.error(getErrorMsg(err));
      } finally {
        setLoading(false);
      }
    };

    if (user) loadData();
  }, [user, toast]);

  if (loading) return <PageSkeleton variant="list" />;
  if (!user) return <EmptyState icon="user" title="Not logged in" />;

  // Get custom stitching related measurements
  const customStitchingOrders = orders.filter(o => o.items?.some(i => i.isStitching));
  const measurementsByGarment = {};
  
  customStitchingOrders.forEach(order => {
    order.items?.forEach(item => {
      if (item.isStitching) {
        const garmentType = item.garmentType || 'Other';
        if (!measurementsByGarment[garmentType]) {
          measurementsByGarment[garmentType] = [];
        }
        
        if (item.measurementPreference === 'existing' && item.measurementTemplateId) {
          const template = templates.find(t => t._id === item.measurementTemplateId);
          if (template && !measurementsByGarment[garmentType].some(m => m._id === template._id)) {
            measurementsByGarment[garmentType].push(template);
          }
        } else if (item.measurementPreference === 'own_measurement' && item.ownMeasurements) {
          if (!measurementsByGarment[garmentType].some(m => m._id === `own-${item._id}`)) {
            measurementsByGarment[garmentType].push({
              _id: `own-${item._id}`,
              name: `${order.orderNumber} - Own Measurements`,
              garmentType,
              measurements: item.ownMeasurements,
              isOwnMeasurement: true,
              orderId: order._id,
            });
          }
        }
      }
    });
  });

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>My Profile</h2>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        {[
          ['details', 'Personal Details'],
          ['measurements', 'My Measurements'],
          ['orders', 'My Orders'],
        ].map(([tab, label]) => (
          <button
            key={tab}
            className={`tab-btn${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Personal Details Tab */}
      {activeTab === 'details' && (
        <div style={{ display: 'grid', gap: 24 }}>
          {/* Basic Info */}
          <div className="card">
            <h3 style={{ marginBottom: 20 }}>Personal Information</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>Full Name</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{user.firstName} {user.lastName}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>Email</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{user.email}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>Phone</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{user.phone || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>Member Since</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Order Statistics */}
          <div className="grid-2">
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--brown)', marginBottom: 8 }}>
                {orders.length}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-light)' }}>Total Orders</div>
            </div>

            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--brown)', marginBottom: 8 }}>
                {customStitchingOrders.length}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-light)' }}>Custom Stitching Orders</div>
            </div>

            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--brown)', marginBottom: 8 }}>
                {templates.length}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-light)' }}>Saved Measurements</div>
            </div>

            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--brown)', marginBottom: 8 }}>
                {formatPrice(orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0))}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-light)' }}>Total Spent</div>
            </div>
          </div>
        </div>
      )}

      {/* Measurements Tab */}
      {activeTab === 'measurements' && (
        <div>
          {templates.length === 0 && Object.keys(measurementsByGarment).length === 0 ? (
            <EmptyState icon="ruler" title="No measurements found" description="Save measurements from your custom stitching orders." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Grouped by Garment Type */}
              {Object.entries(measurementsByGarment).map(([garmentType, measurements]) => (
                <div key={garmentType} className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <span style={{ display: 'inline-flex' }}><AppIcon name="shirt" size={20} /></span>
                    <h3 style={{ marginBottom: 0 }}>{garmentType}</h3>
                    <span className="badge badge-cream">{measurements.length} measurement(s)</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {measurements.map((m) => (
                      <div key={m._id} style={{
                        padding: 12,
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        background: m.isOwnMeasurement ? '#FFF8F0' : 'white',
                      }}>
                        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
                          {m.name}
                        </div>

                        {m.isOwnMeasurement && (
                          <div style={{ fontSize: 11, color: 'var(--brown)', marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <AppIcon name="pencil" size={11} /> Self-provided measurement
                          </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          {Object.entries(m.measurements || {})
                            .filter(([key]) => MEASUREMENT_FIELDS_DISPLAY[key])
                            .slice(0, 6)
                            .map(([key, value]) => (
                              <div key={key} style={{ fontSize: 12 }}>
                                <span style={{ color: 'var(--text-light)' }}>
                                  {MEASUREMENT_FIELDS_DISPLAY[key]}:
                                </span>
                                <span style={{ fontWeight: 600, marginLeft: 4 }}>
                                  {value ? `${value}"` : '—'}
                                </span>
                              </div>
                            ))}
                        </div>

                        {m.notes && (
                          <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                            {m.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* All Saved Templates */}
              {templates.length > 0 && (
                <div className="card">
                  <h3 style={{ marginBottom: 16 }}>All Saved Templates</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {templates.map((t) => (
                      <div key={t._id} style={{
                        padding: 12,
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>{t.name}</div>
                          {t.isDefault && <span className="badge" style={{ background: 'var(--brown)', color: 'white' }}>Default</span>}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 8 }}>
                          {t.garmentType}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          {Object.entries(t.measurements || {})
                            .filter(([key]) => MEASUREMENT_FIELDS_DISPLAY[key])
                            .slice(0, 6)
                            .map(([key, value]) => (
                              <div key={key} style={{ fontSize: 11 }}>
                                <span style={{ color: 'var(--text-light)' }}>
                                  {MEASUREMENT_FIELDS_DISPLAY[key]}:
                                </span>
                                <span style={{ fontWeight: 600, marginLeft: 4 }}>
                                  {value ? `${value}"` : '—'}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div>
          {orders.length === 0 ? (
            <EmptyState icon="box" title="No orders yet" description="Start shopping to see your orders here." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {orders.map((order) => {
                const stitchingItems = order.items?.filter(i => i.isStitching) || [];
                const regularItems = order.items?.filter(i => !i.isStitching) || [];

                return (
                  <div key={order._id} className="card">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 16, alignItems: 'center', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>Order ID</div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{order.orderNumber}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>Date</div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          {formatDateTime(order.createdAt)?.split(' ')[0] || order.createdAt?.split('T')[0]}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>Total</div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--brown)' }}>{formatPrice(order.totalAmount)}</div>
                      </div>
                      <div>
                        <StatusBadge status={order.status} />
                      </div>
                    </div>

                    {/* Order Items */}
                    <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 13 }}>
                      {regularItems.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <span style={{ color: 'var(--text-light)' }}>Ready-Made:</span>
                          <span style={{ marginLeft: 8 }}>
                            {regularItems.map((item, idx) => (
                              <span key={idx}>
                                {item.productName || item.name} × {item.qty}{idx < regularItems.length - 1 ? ', ' : ''}
                              </span>
                            ))}
                          </span>
                        </div>
                      )}

                      {stitchingItems.length > 0 && (
                        <div>
                          <span style={{ color: 'var(--text-light)' }}>Custom Stitching:</span>
                          <div style={{ marginLeft: 8, marginTop: 4 }}>
                            {stitchingItems.map((item, idx) => (
                              <div key={idx} style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>
                                • {item.productName || item.name} × {item.qty}
                                <span style={{
                                  display: 'inline-block',
                                  marginLeft: 8,
                                  padding: '2px 8px',
                                  background: item.measurementPreference === 'book_slot' ? '#FFF8F0' : item.measurementPreference === 'existing' ? '#E8F5E9' : '#F5E5DC',
                                  borderRadius: 4,
                                  fontSize: 11
                                }}>
                                  {item.measurementPreference === 'book_slot' ? 'Slot Booked' : item.measurementPreference === 'existing' ? 'Template' : 'Own Measurement'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
