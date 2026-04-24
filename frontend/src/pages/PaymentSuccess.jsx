import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { orderAPI, measurementAPI } from '../api/index.js';
import { formatPrice, getErrorMsg, formatDateTime, isValidMeasurementTime } from '../utils/helpers.js';
import EmptyState from '../components/ui/EmptyState.jsx';
import PageSkeleton from '../components/ui/PageSkeleton.jsx';
import Modal from '../components/ui/Modal.jsx';
import AppIcon from '../components/ui/AppIcon.jsx';
import MeasurementTimePicker from '../components/measurement/MeasurementTimePicker.jsx';

const GARMENT_TYPES = ['Shirt', 'Pants', 'Blazer', 'Jodhpuri', 'Indo-Western', 'Sherwani', 'Kurta', 'Other'];

const getItemDisplayName = (item = {}) => (
  item.productName
  || item.name
  || item.product?.productName
  || item.product?.name
  || 'Product'
);

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const orderId = searchParams.get('orderId');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookingSlots, setBookingSlots] = useState({});
  const [orderBookedSlotId, setOrderBookedSlotId] = useState(null);
  const [processingSlot, setProcessingSlot] = useState(null);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [currentSlotItem, setCurrentSlotItem] = useState(null);
  const [slotForm, setSlotForm] = useState({ date: '', time: '', notes: '' });

  useEffect(() => {
    if (!orderId) {
      navigate('/');
      return;
    }

    const loadOrder = async () => {
      try {
        setLoading(true);
        const { data } = await orderAPI.getById(orderId);
        setOrder(data.data?.order || data.data);
      } catch (err) {
        toast.error(getErrorMsg(err));
        setTimeout(() => navigate(`/profile/orders/${orderId}`), 2000);
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [orderId, navigate, toast]);

  // Find items that need book_slot measurement
  const slotBookingItems = order?.items?.filter(item => item.isStitching && item.measurementPreference === 'book_slot') || [];

  const getItemKey = (item) => `${item.product?.id || item.product?._id}-${item._id}`;

  useEffect(() => {
    if (!orderId || !user) return;

    const loadOrderSlots = async () => {
      try {
        const { data } = await measurementAPI.getSlots();
        const slots = Array.isArray(data?.data?.slots) ? data.data.slots : [];
        const existingOrderSlot = slots.find((slot) => (
          String(slot?.orderRef || '') === String(orderId)
          && ['pending', 'approved', 'completed'].includes(String(slot?.status || ''))
        ));

        if (existingOrderSlot?._id) {
          setOrderBookedSlotId(existingOrderSlot._id);
        }
      } catch {
        // Non-blocking: UI can still attempt booking and backend will enforce uniqueness.
      }
    };

    loadOrderSlots();
  }, [orderId, user]);

  useEffect(() => {
    if (!orderBookedSlotId || slotBookingItems.length === 0) return;

    const bookedMap = slotBookingItems.reduce((acc, item) => {
      acc[getItemKey(item)] = orderBookedSlotId;
      return acc;
    }, {});

    setBookingSlots((prev) => ({ ...bookedMap, ...prev }));
  }, [orderBookedSlotId, slotBookingItems]);

  const openSlotModal = (item) => {
    if (!user) {
      toast.error('Please login to book measurement slot');
      navigate('/login');
      return;
    }

    if (orderBookedSlotId) {
      toast.info('Measurement slot is already booked for this order');
      return;
    }

    setCurrentSlotItem(item);
    setSlotForm({ date: '', time: '', notes: '' });
    setShowSlotModal(true);
  };

  const confirmMeasurementSlot = async () => {
    if (!slotForm.date || !slotForm.time) {
      toast.error('Please select date and time');
      return;
    }
    if (!isValidMeasurementTime(slotForm.time)) {
      toast.error('Booking is allowed only between 09:00 AM and 10:00 PM');
      return;
    }

    const itemKey = `${currentSlotItem.product?.id || currentSlotItem.product?._id}-${currentSlotItem._id}`;
    setProcessingSlot(itemKey);

    try {
      const dateTime = new Date(`${slotForm.date}T${slotForm.time}`);
      const { data } = await measurementAPI.bookSlot({
        dateTime: dateTime.toISOString(),
        garmentType: currentSlotItem.garmentType || GARMENT_TYPES[0],
        notes: slotForm.notes,
        orderRef: orderId,
      });

      const slotId = data.data?.slot?._id || data.data?._id;
      setOrderBookedSlotId(slotId);
      setBookingSlots(() => (
        slotBookingItems.reduce((acc, item) => {
          acc[getItemKey(item)] = slotId;
          return acc;
        }, {})
      ));

      toast.success('Measurement slot confirmed! Check your email for details.');
      setShowSlotModal(false);
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setProcessingSlot(null);
    }
  };

  if (loading) return <PageSkeleton variant="detail" />;

  if (!order) return (
    <div className="page">
      <div className="container">
        <EmptyState icon="error" title="Order not found" />
      </div>
    </div>
  );

  const hasBookingItems = slotBookingItems.length > 0;
  const isCodOrder = String(order?.paymentMethod || '').toUpperCase() === 'COD';
  const successTitle = isCodOrder ? 'Order Placed!' : 'Payment Successful!';

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 700, marginTop: 20, marginBottom: 40 }}>
        {/* Success Message */}
        <div className="card" style={{ textAlign: 'center', borderLeft: '4px solid var(--success)', marginBottom: 24 }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><AppIcon name="success" size={40} stroke="var(--success)" /></div>
          <h2 style={{ marginBottom: 8 }}>{successTitle}</h2>
          <p style={{ color: 'var(--text-light)', marginBottom: 4 }}>Order #{order.orderNumber}</p>
          <p style={{ fontSize: 14, color: 'var(--text-light)' }}>Total: {formatPrice(order.totalAmount)}</p>
        </div>

        {/* Order Items */}
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>Order Items</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {order.items?.map((item, idx) => (
              <div key={idx} style={{
                display: 'flex',
                gap: 12,
                paddingBottom: 12,
                borderBottom: idx < order.items.length - 1 ? '1px solid var(--border)' : 'none'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    {getItemDisplayName(item)}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-light)' }}>
                    Qty: {item.qty} × {formatPrice(item.price)}
                  </div>
                  {item.isStitching && (
                    <div style={{ fontSize: 12, marginTop: 4, color: 'var(--brown)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <AppIcon name="location" size={12} /> Custom Stitching
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', fontWeight: 600 }}>
                  {formatPrice(item.price * item.qty)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Measurement Slot Booking */}
        {hasBookingItems && (
          <div className="card" style={{ background: '#FFF8F0', borderLeft: '4px solid var(--brown)', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ display: 'inline-flex' }}><AppIcon name="calendar" size={24} /></span>
              <div>
                <h3 style={{ marginBottom: 0 }}>Complete Your Measurement Booking</h3>
                <p style={{ fontSize: 12, color: 'var(--text-light)', margin: 0 }}>
                  {slotBookingItems.length} item(s) require measurement appointment
                </p>
              </div>
            </div>

            {!user && (
              <div className="alert alert-info" style={{ marginBottom: 16 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AppIcon name="lock" size={14} /> You must be logged in to complete the measurement booking.</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {slotBookingItems.map((item, idx) => {
                const itemKey = getItemKey(item);
                const isBooked = !!orderBookedSlotId || !!bookingSlots[itemKey] || !!item.measurementSlotId;

                return (
                  <div key={idx} style={{
                    padding: 12,
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: isBooked ? '#E8F5E9' : 'white',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>
                        {getItemDisplayName(item)}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
                        {item.garmentType || 'Custom Stitching'}
                      </div>
                    </div>
                    {isBooked ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: 13 }}>✓ Booked</span>
                      </div>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => openSlotModal(item)}
                        disabled={!user || processingSlot === itemKey}
                      >
                        {processingSlot === itemKey ? 'Booking...' : 'Book Slot'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AppIcon name="mail" size={13} /> A confirmation email will be sent with your measurement appointment details. Our tailor will contact you to finalize the booking.</span>
            </p>
          </div>
        )}

        {/* Shipping Address */}
        {order.shippingAddress && (
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 12 }}>Shipping Address</h3>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-light)' }}>
              <div>{order.shippingAddress.line1}</div>
              {order.shippingAddress.line2 && <div>{order.shippingAddress.line2}</div>}
              <div>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}</div>
              <div>{order.shippingAddress.country}</div>
            </div>
          </div>
        )}

        {/* Next Steps */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
          <Link to={`/profile/orders/${orderId}`} className="btn btn-primary">
            View Order Details
          </Link>
          {!hasBookingItems || !!orderBookedSlotId || slotBookingItems.every(item => bookingSlots[getItemKey(item)] || item.measurementSlotId) && (
            <Link to="/products" className="btn btn-outline">
              Continue Shopping
            </Link>
          )}
        </div>

        {/* Help Text */}
        <div className="card" style={{ background: '#F9F9F9' }}>
          <div style={{ fontSize: 13, color: 'var(--text-light)', lineHeight: 1.6 }}>
            <p style={{ marginBottom: 8 }}>
              <strong><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AppIcon name="help" size={13} /> Need Help?</span></strong><br />
              Contact our customer support team if you have any questions about your order or measurement booking.
            </p>
            <p style={{ marginBottom: 0 }}>
              <strong><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AppIcon name="mail" size={13} /> Email:</span></strong> support@wellfit.com<br />
              <strong><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AppIcon name="phone" size={13} /> Phone:</span></strong> +91-XXXX-XXXX-XX
            </p>
          </div>
        </div>
      </div>

      {/* Slot Booking Modal */}
      <Modal open={showSlotModal} onClose={() => setShowSlotModal(false)} title="Book Measurement Slot" maxWidth={500}>
        {currentSlotItem && (
          <div>
            <p style={{ fontSize: 14, marginBottom: 16, color: 'var(--text-light)' }}>
              Schedule a measurement appointment for <strong>{getItemDisplayName(currentSlotItem)}</strong>
            </p>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={slotForm.date}
                  onChange={(e) => setSlotForm(prev => ({ ...prev, date: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
            <MeasurementTimePicker
              date={slotForm.date}
              value={slotForm.time}
              onChange={(time) => setSlotForm(prev => ({ ...prev, time }))}
              open={showSlotModal}
            />

            <div className="form-group">
              <label className="form-label">Additional Notes (Optional)</label>
              <textarea
                className="form-input"
                rows="3"
                value={slotForm.notes}
                onChange={(e) => setSlotForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any special requirements or preferences..."
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setShowSlotModal(false)} disabled={processingSlot}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmMeasurementSlot} disabled={processingSlot || !user}>
                {processingSlot ? 'Confirming...' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
