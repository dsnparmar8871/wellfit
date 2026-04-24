import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminAPI, analyticsAPI, orderAPI } from '../../api/index.js';
import { formatPrice, formatDate } from '../../utils/helpers.js';
import PageSkeleton from '../../components/ui/PageSkeleton.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import AppIcon from '../../components/ui/AppIcon.jsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Legend } from 'recharts';

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const toDateKey = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    const match = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const transformSalesDataForPeriod = (rawData, period) => {
  if (!Array.isArray(rawData) || rawData.length === 0) {
    if (period === 'weekly') {
      return WEEK_DAYS.map((label) => ({ label, revenue: 0, orders: 0 }));
    }
    return ['Week 1', 'Week 2', 'Week 3', 'Week 4'].map((label) => ({ label, revenue: 0, orders: 0 }));
  }

  if (period === 'weekly') {
    const buckets = WEEK_DAYS.map((label) => ({ label, revenue: 0, orders: 0 }));
    rawData.forEach((entry) => {
      const d = new Date(`${entry._id}T00:00:00`);
      const dayIdx = Number.isNaN(d.getTime()) ? -1 : d.getDay();
      if (dayIdx >= 0 && dayIdx <= 6) {
        buckets[dayIdx].revenue += entry.revenue || 0;
        buckets[dayIdx].orders += entry.orders || 0;
      }
    });
    return buckets;
  }

  const weekBuckets = ['Week 1', 'Week 2', 'Week 3', 'Week 4'].map((label) => ({ label, revenue: 0, orders: 0 }));
  rawData.forEach((entry) => {
    const d = new Date(`${entry._id}T00:00:00`);
    if (Number.isNaN(d.getTime())) return;
    const dayOfMonth = d.getDate();
    const weekIndex = Math.min(3, Math.floor((dayOfMonth - 1) / 7));
    weekBuckets[weekIndex].revenue += entry.revenue || 0;
    weekBuckets[weekIndex].orders += entry.orders || 0;
  });

  return weekBuckets;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [salesData, setSalesData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [todayApprovedSlots, setTodayApprovedSlots] = useState([]);
  const [activeSlotDetails, setActiveSlotDetails] = useState(null);
  const [quickActionCounts, setQuickActionCounts] = useState({
    pendingOrders: 0,
    lowStockProducts: 0,
    pendingReturns: 0,
    pendingSlots: 0,
    newCustomers: 0,
  });
  const [period, setPeriod] = useState('weekly');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    let from;
    let to;

    if (period === 'weekly') {
      from = new Date(now);
      from.setHours(0, 0, 0, 0);
      from.setDate(now.getDate() - now.getDay());

      to = new Date(from);
      to.setDate(from.getDate() + 6);
      to.setHours(23, 59, 59, 999);
    } else {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      from.setHours(0, 0, 0, 0);

      to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      to.setHours(23, 59, 59, 999);
    }

    Promise.all([
      analyticsAPI.getSummary(),
      analyticsAPI.getSales({ period: 'daily', from: from.toISOString(), to: to.toISOString() }),
      analyticsAPI.getTopProducts(),
      orderAPI.getAll({ limit: 40 }),
      orderAPI.getReturnRequests({ status: 'requested', page: 1, limit: 1 }),
      adminAPI.getSlots({ status: 'pending', page: 1, limit: 1 }),
      adminAPI.getSlots({ status: 'approved', page: 1, limit: 100 }),
    ]).then(([s, sales, top, orders, returnsRes, slotsRes, approvedSlotsRes]) => {
      const dashboardSummary = s.data.data || {};
      setSummary(dashboardSummary);
      setSalesData(transformSalesDataForPeriod(sales.data.data?.data || [], period));
      setTopProducts(top.data.data?.products || []);
      const recent = Array.isArray(orders.data.data) ? orders.data.data : (orders.data.data?.orders || []);
      const getScheduleDate = (order) => order?.deliveryDate || order?.pickupDate || null;

      const now = new Date();
      const todayKey = toDateKey(now);
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowKey = toDateKey(tomorrow);

      const approvedSlotsList = Array.isArray(approvedSlotsRes?.data?.data)
        ? approvedSlotsRes.data.data
        : (approvedSlotsRes?.data?.data?.slots || []);

      const effectiveSlotDate = (slot) => slot?.rescheduledTo || slot?.dateTime;
      const todayApproved = approvedSlotsList
        .filter((slot) => toDateKey(effectiveSlotDate(slot)) === todayKey)
        .sort((a, b) => new Date(effectiveSlotDate(a)).getTime() - new Date(effectiveSlotDate(b)).getTime())
        .slice(0, 8);

      setTodayApprovedSlots(todayApproved);

      const prioritized = [...recent].sort((a, b) => {
        const aScheduleKey = toDateKey(getScheduleDate(a));
        const bScheduleKey = toDateKey(getScheduleDate(b));

        const aPriority = aScheduleKey && aScheduleKey === tomorrowKey
          ? 0
          : aScheduleKey && aScheduleKey === todayKey
            ? 1
            : 2;
        const bPriority = bScheduleKey && bScheduleKey === tomorrowKey
          ? 0
          : bScheduleKey && bScheduleKey === todayKey
            ? 1
            : 2;

        if (aPriority !== bPriority) return aPriority - bPriority;

        if (aPriority < 2 && aScheduleKey && bScheduleKey && aScheduleKey !== bScheduleKey) {
          return aScheduleKey.localeCompare(bScheduleKey);
        }

        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setRecentOrders(prioritized.slice(0, 5));

      const pendingReturns = returnsRes?.data?.pagination?.total || 0;
      const pendingSlots = slotsRes?.data?.pagination?.total || 0;

      setQuickActionCounts({
        pendingOrders: dashboardSummary?.orders?.pending || 0,
        lowStockProducts: dashboardSummary?.products?.lowStock || 0,
        pendingReturns,
        pendingSlots,
        newCustomers: dashboardSummary?.customers?.newThisMonth || 0,
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, [period]);

  useEffect(() => {
    if (!activeSlotDetails) return undefined;

    const timer = setTimeout(() => {
      setActiveSlotDetails(null);
    }, 5000);

    return () => clearTimeout(timer);
  }, [activeSlotDetails]);

  if (loading) return <PageSkeleton variant="dashboard" />;

  const stats = [
    { label: 'Total Revenue', value: formatPrice(summary?.revenue?.total || 0), icon: 'money', color: '#27AE60' },
    { label: 'Total Orders', value: summary?.orders?.total || 0, icon: 'box', color: 'var(--brown)' },
    { label: 'Products', value: summary?.products?.total || 0, icon: 'cart', color: '#3498DB' },
    { label: 'Customers', value: summary?.customers?.total || 0, icon: 'users', color: '#9B59B6' },
  ];

  const compactCurrency = (v) => {
    if (!Number.isFinite(v)) return '';
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(0)}k`;
    return `₹${v}`;
  };

  const getOrderDayLabel = (order) => {
    const schedule = order?.deliveryDate || order?.pickupDate;
    const scheduleKey = toDateKey(schedule);
    const nowLocal = new Date();
    const todayLocalKey = toDateKey(nowLocal);
    const tomorrowLocal = new Date(nowLocal);
    tomorrowLocal.setDate(tomorrowLocal.getDate() + 1);
    const tomorrowLocalKey = toDateKey(tomorrowLocal);

    if (scheduleKey === tomorrowLocalKey) return 'Tomorrow';
    if (scheduleKey === todayLocalKey) return 'Today';
    return '';
  };

  const isTomorrowScheduledOrder = (order) => {
    const schedule = order?.deliveryDate || order?.pickupDate;
    const scheduleKey = toDateKey(schedule);
    if (!scheduleKey) return false;
    const tomorrowLocal = new Date();
    tomorrowLocal.setDate(tomorrowLocal.getDate() + 1);
    return scheduleKey === toDateKey(tomorrowLocal);
  };

  const quickQueueOrders = (recentOrders || []).filter(isTomorrowScheduledOrder).slice(0, 5);

  const formatSlotTime = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getSlotOrderSummary = (slot) => {
    const ref = slot?.orderRef;
    if (!ref) return '—';
    if (typeof ref === 'string') return `#${String(ref).slice(-8).toUpperCase()}`;
    if (ref.orderNumber) return `#${ref.orderNumber}`;
    if (ref._id) return `#${String(ref._id).slice(-8).toUpperCase()}`;
    return '—';
  };

  const getSlotOrderId = (slot) => {
    const ref = slot?.orderRef;
    if (!ref) return null;
    if (typeof ref === 'string') return ref;
    return ref._id || null;
  };

  return (
    <div>
      <h1 style={{ marginBottom: 24, fontSize: '1.5rem' }}>Dashboard</h1>

      {/* Priority Order Tags */}
      {quickQueueOrders.length > 0 && (
        <div className="card" style={{ marginBottom: 20, padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 10 }}>
            Quick Order Queue (Tomorrow)
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 4 }}>
            {quickQueueOrders.map((o) => {
              return (
                <button
                  key={`tag-${o._id}`}
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => navigate(`/admin/orders/${o._id}`)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  #{o._id?.slice(-8).toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {/* Today's Approved Measurement Slots */}
      {todayApprovedSlots.length > 0 && (
        <div className="card" style={{ marginBottom: 20, padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 10 }}>
            Today&apos;s Approved Measurement Slots
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 4 }}>
            {todayApprovedSlots.map((slot) => {
              const scheduledAt = slot?.rescheduledTo || slot?.dateTime;
              const timeLabel = new Date(scheduledAt).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              });
              const customerName = slot?.customer?.name || 'Customer';

              return (
                <button
                  key={`approved-slot-${slot._id}`}
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setActiveSlotDetails(slot)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <span>{customerName}</span>
                  <span className="badge badge-brown" style={{ fontSize: 10 }}>{timeLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 28 }}>
        {stats.map((s) => (
          <div key={s.label} className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>{s.value}</div>
              </div>
              <div style={{ display: 'inline-flex' }}><AppIcon name={s.icon} size={26} stroke={s.color} /></div>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-dashboard-panels" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 28 }}>
        {/* Revenue + Orders Charts */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ marginBottom: 0 }}>Order & Revenue Overview</h3>
            <div style={{ display: 'flex', gap: 6 }}>
              {['weekly', 'monthly'].map((p) => (
                <button key={p} className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-outline'}`} onClick={() => setPeriod(p)} style={{ textTransform: 'capitalize' }}>{p}</button>
              ))}
            </div>
          </div>
          {salesData.length > 0 ? (
            <div style={{ background: 'var(--cream)', borderRadius: 10, padding: 12 }}>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" fontSize={11} label={{ value: 'Period', position: 'insideBottom', offset: -4 }} />
                  <YAxis
                    yAxisId="left"
                    fontSize={11}
                    domain={period === 'weekly' ? [0, 28000] : [0, 200000]}
                    ticks={period === 'weekly' ? [0, 7000, 14000, 21000, 28000] : [0, 50000, 100000, 150000, 200000]}
                    tickFormatter={(v) => {
                      if (period === 'weekly') {
                        return v >= 28000 ? `₹>28k` : `₹${(v / 1000).toFixed(0)}k`;
                      }
                      return v >= 200000 ? `₹>200k` : `₹${(v / 1000).toFixed(0)}k`;
                    }}
                    label={{ value: 'Revenue (INR)', angle: -90, position: 'insideLeft' }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    fontSize={11}
                    domain={period === 'weekly' ? [0, 40] : [0, 200]}
                    ticks={period === 'weekly' ? [0, 10, 20, 30, 40] : [0, 50, 100, 150, 200]}
                    label={{ value: 'Orders', angle: 90, position: 'insideRight' }}
                  />
                  <Tooltip formatter={(v, name) => (name === 'Revenue' ? formatPrice(v) : v)} />
                  <Legend verticalAlign="top" height={26} />
                  <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="var(--brown)" strokeWidth={2.8} dot={{ r: 2 }} activeDot={{ r: 4 }} name="Revenue">
                    <LabelList dataKey="revenue" position="top" formatter={compactCurrency} style={{ fontSize: 10, fill: 'var(--text-light)' }} />
                  </Line>
                  <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#7F9CB5" strokeWidth={2.4} dot={{ r: 2 }} activeDot={{ r: 4 }} name="Orders">
                    <LabelList dataKey="orders" position="top" style={{ fontSize: 10, fill: '#6f8597' }} />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-light)' }}>No sales data yet</div>
          )}
        </div>

        {/* Quick links */}
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Quick Actions</h3>
          {[
            {
              icon: 'box',
              label: 'View All Orders',
              to: '/admin/orders',
              count: quickActionCounts.pendingOrders,
              countLabel: 'pending',
            },
            {
              icon: 'cart',
              label: 'Add Product',
              to: '/admin/products/new',
              count: quickActionCounts.lowStockProducts,
              countLabel: 'low stock',
            },
            {
              icon: 'users',
              label: 'Manage Users',
              to: '/admin/users',
              count: quickActionCounts.newCustomers,
              countLabel: 'new',
            },
            {
              icon: 'tag',
              label: 'Coupons',
              to: '/admin/coupons',
              count: 0,
              countLabel: '',
            },
            {
              icon: 'box',
              label: 'Return Requests',
              to: '/admin/returns',
              count: quickActionCounts.pendingReturns,
              countLabel: 'new',
            },
            {
              icon: 'calendar',
              label: 'Measurement Slots',
              to: '/admin/slots',
              count: quickActionCounts.pendingSlots,
              countLabel: 'pending',
            },
          ].map((action) => (
            <Link key={action.to} to={action.to} style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderRadius: 8, marginBottom: 4, fontSize: 14, color: 'var(--text)', background: 'var(--cream)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <AppIcon name={action.icon} size={14} />
                {action.label}
              </span>
              {action.count > 0 && (
                <span className="badge badge-brown" style={{ marginLeft: 'auto', fontSize: 11 }}>
                  {action.count} {action.countLabel}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>

      <div className="admin-dashboard-panels admin-dashboard-snapshot" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Top Products</h3>
          {topProducts.length > 0 ? (
            <div>
              {topProducts.slice(0, 5).map((p, i) => (
                <div key={p._id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--brown)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{p.product?.name || 'Product'}</span>
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-light)' }}>{p.totalSold || 0} sold</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--text-light)', fontSize: 14 }}>No sales data yet.</div>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Performance Snapshot</h3>
          <div className="admin-performance-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: 'var(--cream)', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 6 }}>Avg Order Value</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700 }}>
                {formatPrice((summary?.orders?.total || 0) ? ((summary?.revenue?.total || 0) / summary.orders.total) : 0)}
              </div>
            </div>
            <div style={{ background: 'var(--cream)', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 6 }}>Pending Orders</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700 }}>
                {summary?.orders?.pending || 0}
              </div>
            </div>
            <div style={{ background: 'var(--cream)', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 6 }}>Completed Orders</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700 }}>
                {summary?.orders?.completed || 0}
              </div>
            </div>
            <div style={{ background: 'var(--cream)', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 6 }}>Cancelled Orders</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700 }}>
                {summary?.orders?.cancelled || 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ marginBottom: 0 }}>Recent Orders</h3>
          <Link to="/admin/orders" style={{ fontSize: 13, color: 'var(--brown)' }}>View All →</Link>
        </div>
        {recentOrders.length === 0 ? (
          <p style={{ color: 'var(--text-light)', fontSize: 14 }}>No orders yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Order ID</th><th>Customer</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o._id} onClick={() => navigate(`/admin/orders/${o._id}`)} style={{ cursor: 'pointer' }}>
                    <td><Link to={`/admin/orders/${o._id}`} style={{ fontWeight: 600 }}>#{o._id?.slice(-8).toUpperCase()}</Link></td>
                    <td>{o.customer?.name || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{formatPrice(o.totalAmount)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td style={{ color: 'var(--text-light)' }}>
                      {(() => {
                        const schedule = o.deliveryDate || o.pickupDate;
                        const label = getOrderDayLabel(o);

                        return (
                          <>
                            {formatDate(schedule || o.createdAt)}
                            {label && (
                              <span className="badge badge-brown" style={{ marginLeft: 8, fontSize: 10 }}>{label}</span>
                            )}
                          </>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {activeSlotDetails && (
        <div
          style={{
            position: 'fixed',
            right: 20,
            bottom: 20,
            width: 'min(360px, calc(100vw - 32px))',
            background: 'var(--white)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: '0 12px 30px rgba(0,0,0,0.12)',
            zIndex: 1000,
            padding: 14,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Measurement Slot Details</div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setActiveSlotDetails(null)}
              style={{ padding: '2px 8px', lineHeight: 1.2 }}
            >
              ×
            </button>
          </div>
          <div style={{ display: 'grid', gap: 7, fontSize: 13 }}>
            <div><strong>Customer:</strong> {activeSlotDetails?.customer?.name || 'Customer'}</div>
            <div><strong>Time:</strong> {formatSlotTime(activeSlotDetails?.rescheduledTo || activeSlotDetails?.dateTime)}</div>
            <div>
              <strong>Order ID:</strong>{' '}
              {getSlotOrderId(activeSlotDetails) ? (
                <button
                  type="button"
                  onClick={() => navigate(`/admin/orders/${getSlotOrderId(activeSlotDetails)}`)}
                  style={{
                    border: 'none',
                    background: 'none',
                    padding: 0,
                    color: 'var(--brown)',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {getSlotOrderSummary(activeSlotDetails)}
                </button>
              ) : (
                getSlotOrderSummary(activeSlotDetails)
              )}
            </div>
            {activeSlotDetails?.notes ? (
              <div><strong>Note:</strong> {activeSlotDetails.notes}</div>
            ) : (
              <div><strong>Note:</strong> —</div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 1100px) {
          .admin-dashboard-panels,
          .admin-dashboard-snapshot {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 640px) {
          .admin-performance-grid {
            grid-template-columns: 1fr !important;
          }

          .admin-dashboard-panels .card,
          .admin-dashboard-snapshot .card,
          .admin-dashboard-panels > .card {
            padding: 18px !important;
          }
        }
      `}</style>
    </div>
  );
}
