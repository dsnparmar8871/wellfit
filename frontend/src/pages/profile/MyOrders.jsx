import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { orderAPI } from '../../api/index.js';
import { formatPrice, formatDate } from '../../utils/helpers.js';
import PageSkeleton from '../../components/ui/PageSkeleton.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    orderAPI.getMyOrders()
      .then(({ data }) => {
        const payload = data?.data;
        const list = Array.isArray(payload) ? payload : (payload?.orders || []);
        setOrders(list);
      })
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton variant="table" />;

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>My Orders</h2>
      {orders.length === 0 ? (
        <EmptyState icon="box" title="No orders yet" description="Start shopping to see your orders here."
          action={<Link to="/products" className="btn btn-primary">Browse Products</Link>} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {orders.map((o) => (
            <Link key={o._id} to={`/profile/orders/${o._id}`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ padding: 16, transition: 'box-shadow 0.15s' }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--shadow)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = ''}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>Order #{o._id?.slice(-8).toUpperCase()}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{formatDate(o.createdAt)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <StatusBadge status={o.status} />
                    <div style={{ fontWeight: 700, marginTop: 4 }}>{formatPrice(o.totalAmount)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {o.items?.slice(0, 3).map((item, i) => (
                    <span key={i} style={{ fontSize: 12, color: 'var(--text-light)', background: 'var(--cream)', padding: '3px 8px', borderRadius: 4 }}>
                      {item.product?.productName || item.product?.name || 'Item'} × {item.qty}
                    </span>
                  ))}
                  {o.items?.length > 3 && <span style={{ fontSize: 12, color: 'var(--text-light)' }}>+{o.items.length - 3} more</span>}
                </div>
                {(o.deliveryDate || o.pickupDate) && (
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-light)' }}>
                    {o.deliveryDate && <div>Est. Delivery: {formatDate(o.deliveryDate)}</div>}
                    {o.pickupDate && <div>Pickup Date: {formatDate(o.pickupDate)}</div>}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
