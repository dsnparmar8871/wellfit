import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { CardElement, Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { orderAPI, couponAPI, paymentAPI, userAPI } from '../api/index.js';
import { formatPrice, getErrorMsg } from '../utils/helpers.js';
import AppIcon from '../components/ui/AppIcon.jsx';
import Modal from '../components/ui/Modal.jsx';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '');

const PAYMENT_METHODS = [
  { id: 'COD', label: 'Cash on Delivery', icon: 'money' },
  { id: 'UPI', label: 'UPI', icon: 'phone' },
  { id: 'credit_card', label: 'Credit Card', icon: 'card' },
  { id: 'debit_card', label: 'Debit Card', icon: 'card' },
];

function PaymentModalContent({ session, onComplete, onClose }) {
  const stripe = useStripe();
  const elements = useElements();
  const toast = useToast();
  const [processing, setProcessing] = useState(false);
  const [upiQrUrl, setUpiQrUrl] = useState('');
  const [upiPaymentIntentId, setUpiPaymentIntentId] = useState('');
  const [upiStatusMessage, setUpiStatusMessage] = useState('');
  const isUpiMode = session.paymentMethod === 'UPI';
  const isCardMode = session.paymentMethod === 'credit_card' || session.paymentMethod === 'debit_card';

  const payNow = async () => {
    if (processing) return;

    if (session.simulated) {
      try {
        setProcessing(true);
        const paymentIntentId = session.clientSecret?.split('_secret_')?.[0] || `pi_sim_${Date.now()}`;
        await onComplete(paymentIntentId);
      } catch (err) {
        toast.error(getErrorMsg(err));
      } finally {
        setProcessing(false);
      }
      return;
    }

    if (!stripe || !elements) {
      toast.error('Payment form is still loading, please wait...');
      return;
    }

    try {
      setProcessing(true);
      let result;

      if (isCardMode) {
        const cardElement = elements.getElement(CardElement);
        if (!cardElement) {
          toast.error('Card form is not ready yet. Please wait a moment.');
          return;
        }

        result = await stripe.confirmCardPayment(session.clientSecret, {
          payment_method: {
            card: cardElement,
          },
        });
      } else {
        const returnUrl = `${window.location.origin}/checkout`;
        result = await stripe.confirmPayment({
          elements,
          confirmParams: { return_url: returnUrl },
          redirect: 'if_required',
        });
      }

      if (result.error) {
        toast.error(result.error.message || 'Payment failed');
        return;
      }

      const paymentIntentId = result.paymentIntent?.id;
      if (!paymentIntentId) {
        toast.error('Payment completed but payment ID was not found');
        return;
      }

      const upiQr = !isCardMode
        ? (result.paymentIntent?.next_action?.upi_display_qr_code?.image_url_png
          || result.paymentIntent?.next_action?.upi_display_qr_code?.image_url_svg
          || '')
        : '';

      if (upiQr && result.paymentIntent?.status !== 'succeeded') {
        setUpiQrUrl(upiQr);
        setUpiPaymentIntentId(paymentIntentId);
        setUpiStatusMessage('Scan the QR code in your UPI app to complete the payment.');
        toast.info('Scan the QR code to complete payment.');
        return;
      }

      if (result.paymentIntent?.status && result.paymentIntent.status !== 'succeeded') {
        if (isCardMode) {
          toast.info(`Payment status: ${result.paymentIntent.status}. Complete the card verification and try again.`);
          return;
        }
        setUpiStatusMessage(`Payment status: ${result.paymentIntent.status}. Complete payment and verify again.`);
        toast.info('Payment is not yet completed.');
        return;
      }

      await onComplete(paymentIntentId);
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 6 }}>Amount: {formatPrice(session.amount || 0)}</div>
        <div style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 6 }}>Items: {session.itemCount || 0}</div>
        <div style={{ fontSize: 14, color: 'var(--text-light)' }}>Reference: Pending payment success</div>
      </div>

      {isUpiMode && (
        <div style={{ marginBottom: 18, padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: '#FFFDF9' }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.08, color: 'var(--text-light)', marginBottom: 8 }}>UPI</div>
          <div style={{ marginBottom: 12 }}>
            <PaymentElement options={{ layout: 'tabs' }} />
          </div>
          {upiStatusMessage && <div className="alert alert-info" style={{ marginTop: 12 }}>{upiStatusMessage}</div>}
          {upiQrUrl ? (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
              <img src={upiQrUrl} alt="UPI QR code" style={{ width: 240, maxWidth: '100%', borderRadius: 12, background: '#fff' }} />
            </div>
          ) : (
            <div style={{ marginTop: 12, color: 'var(--text-light)', fontSize: 13 }}>
              Press Pay Now to generate the UPI QR code.
            </div>
          )}
          {upiQrUrl && upiPaymentIntentId && (
            <button
              type="button"
              className="btn btn-outline btn-full"
              style={{ marginTop: 14 }}
              onClick={async () => {
                try {
                  setProcessing(true);
                  await onComplete(upiPaymentIntentId);
                } catch (err) {
                  toast.error(getErrorMsg(err));
                } finally {
                  setProcessing(false);
                }
              }}
              disabled={processing}
            >
              {processing ? 'Verifying...' : 'I have paid, verify payment'}
            </button>
          )}
        </div>
      )}

      {isCardMode && (
        <div style={{ marginBottom: 18, padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: '#FFFDF9' }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.08, color: 'var(--text-light)', marginBottom: 8 }}>Card Payment</div>
          <div style={{ fontSize: 14, marginBottom: 12 }}>Enter your card details to complete the payment.</div>
          <div style={{ padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: '#fff' }}>
            <CardElement options={{ hidePostalCode: true }} />
          </div>
        </div>
      )}

      <button className="btn btn-primary btn-full btn-lg" onClick={payNow} disabled={processing || (!session.simulated && (!stripe || !elements))}>
        {processing ? 'Processing Payment...' : 'Pay Now'}
      </button>

      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={processing}>
          Cancel payment
        </button>
      </div>
    </div>
  );
}

function PaymentModal({ session, onComplete, onClose }) {
  if (!session) return null;

  return (
    <Modal open={Boolean(session)} onClose={onClose} title="Secure Payment" maxWidth={620} closeOnOverlayClick={false}>
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret: session.clientSecret,
          appearance: { theme: 'flat' },
        }}
      >
        <PaymentModalContent session={session} onComplete={onComplete} onClose={onClose} />
      </Elements>
    </Modal>
  );
}

export default function Checkout() {
  const { items, total, clearCart } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [addresses, setAddresses] = useState([]);
  const [selectedAddr, setSelectedAddr] = useState(null);
  const [newAddr, setNewAddr] = useState({ label: 'Home', line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' });
  const [useNew, setUseNew] = useState(false);
  const [payment, setPayment] = useState(items.some(i => i.isStitching) ? 'UPI' : 'COD');
  const [coupon, setCoupon] = useState('');
  const [couponData, setCouponData] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [showCouponsDropdown, setShowCouponsDropdown] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [paymentSession, setPaymentSession] = useState(null);

  const getCheckoutPaymentState = () => {
    try {
      return JSON.parse(localStorage.getItem('checkoutPaymentState') || 'null');
    } catch {
      return null;
    }
  };

  const setCheckoutPaymentState = (state) => {
    localStorage.setItem('checkoutPaymentState', JSON.stringify(state));
  };

  const clearCheckoutPaymentState = () => {
    localStorage.removeItem('checkoutPaymentState');
  };

  useEffect(() => {
    userAPI.getProfile().then(({ data }) => {
      const user = data.data?.user || data.data;
      const addrs = user?.addresses || [];
      setAddresses(addrs);
      if (addrs.length > 0) setSelectedAddr(addrs[0]);
      else setUseNew(true);
    }).catch(() => setUseNew(true));
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadCoupons = async () => {
      setCouponsLoading(true);
      try {
        const { data } = await couponAPI.getAvailable(total);
        const list = Array.isArray(data?.data?.coupons) ? data.data.coupons : [];
        if (isMounted) setAvailableCoupons(list);
      } catch {
        if (isMounted) setAvailableCoupons([]);
      } finally {
        if (isMounted) setCouponsLoading(false);
      }
    };

    loadCoupons();
    return () => {
      isMounted = false;
    };
  }, [total]);

  useEffect(() => {
    const redirectStatus = searchParams.get('redirect_status');
    const paymentIntentId = searchParams.get('payment_intent');

    if (!redirectStatus) return;

    const finalizeRedirectedPayment = async () => {
      try {
        if (redirectStatus !== 'succeeded' || !paymentIntentId) {
          throw new Error('Payment was not completed. Please try again.');
        }

        await finalizeOrderFromPaymentIntent(paymentIntentId);
      } catch (err) {
        setPaymentSession(null);
        toast.error(getErrorMsg(err));
        navigate('/checkout', { replace: true });
      }
    };

    finalizeRedirectedPayment();
  }, [searchParams, navigate, toast, clearCart]);

  const finalizeOrderFromPaymentIntent = async (paymentIntentId) => {
    if (!paymentIntentId) {
      throw new Error('Payment intent is missing.');
    }

    const currentState = getCheckoutPaymentState();
    if (currentState?.paymentIntentId === paymentIntentId) {
      if (currentState.status === 'processing') return currentState;
      if (currentState.status === 'completed') return currentState;
    }

    setCheckoutPaymentState({
      paymentIntentId,
      status: 'processing',
      paymentMethod: paymentSession?.paymentMethod || null,
    });

    try {
      const payload = JSON.parse(localStorage.getItem('pendingCheckoutPayload') || 'null');
      if (!payload) {
        throw new Error('Checkout session expired. Please start again.');
      }

      const paymentMethod = payload.paymentMethod || paymentSession?.paymentMethod || null;
      const { data } = await orderAPI.create({
        ...payload,
        stripePaymentIntentId: paymentIntentId,
      });

      const createdOrder = data?.data?.order;
      const createdOrderId = createdOrder?._id;
      if (!createdOrderId) {
        throw new Error('Order created but order ID was not returned');
      }

      clearCart();
      setPaymentSession(null);
      localStorage.removeItem('pendingCheckoutPayload');
      const resolvedPaymentMethod = paymentMethod || createdOrder?.paymentMethod || null;
      setCheckoutPaymentState({
        paymentIntentId,
        status: 'completed',
        orderId: createdOrderId,
        paymentMethod: resolvedPaymentMethod,
      });
      toast.success('Order successfully placed');
      navigate(`/payment-success?orderId=${createdOrderId}`, { replace: true });
      return { orderId: createdOrderId, paymentMethod: resolvedPaymentMethod };
    } catch (err) {
      clearCheckoutPaymentState();
      throw err;
    }
  };

  const discount = couponData ? (couponData.discountType === 'percentage' ? total * couponData.discountValue / 100 : couponData.discountValue) : 0;
  const hasStitchingItems = items.some((i) => i.isStitching);
  const shippingCharge = ((total - discount) > 1999 || hasStitchingItems) ? 0 : 100;
  const finalTotal = Math.max(0, total - discount + shippingCharge);
  const hasBookSlotItems = items.some((item) => item.isStitching && item.measurementPreference === 'book_slot');
  const availablePaymentMethods = hasStitchingItems ? PAYMENT_METHODS.filter(m => m.id !== 'COD') : PAYMENT_METHODS;

  const applyCoupon = async () => {
    if (!coupon.trim()) return;
    setCouponLoading(true);
    try {
      const { data } = await couponAPI.validate({ code: coupon.trim(), orderAmount: total });
      setCouponData(data.data);
      toast.success('Coupon applied!');
    } catch (err) {
      toast.error(getErrorMsg(err));
      setCouponData(null);
    } finally {
      setCouponLoading(false);
    }
  };

  const createPaymentSession = async (paymentMethod) => {
    const addr = useNew ? newAddr : selectedAddr;
    if (!addr?.line1 || !addr?.city || !addr?.state || !addr?.pincode) return toast.error('Please fill in delivery address');

    setPlacing(true);
    try {
      const orderData = {
        items: items.map((i) => ({
          product: i.productId,
          variantId: i.variantId,
          qty: i.qty,
          price: i.price,
          isStitching: i.isStitching,
          note: i.note?.trim() ? i.note.trim() : undefined,
          ...(i.isStitching && i.measurementPreference && {
            measurementPreference: i.measurementPreference,
            measurementTemplateId: i.measurementTemplateId || undefined,
            ownMeasurements: i.ownMeasurements || undefined,
            garmentType: i.garmentType || undefined,
          }),
        })),
        shippingAddress: {
          label: addr.label?.trim() || 'Home',
          line1: addr.line1,
          line2: addr.line2 || '',
          city: addr.city,
          state: addr.state,
          pincode: addr.pincode,
          country: addr.country || 'India',
        },
        paymentMethod,
        totalAmount: finalTotal,
        ...(couponData && { couponCode: coupon }),
      };

      if (paymentMethod === 'COD') {
        const { data } = await orderAPI.create(orderData);
        const createdOrder = data?.data?.order;
        if (!createdOrder?._id) {
          throw new Error('Order created but order ID was not returned');
        }
        clearCart();
        toast.success('Order placed successfully!');
        if (hasBookSlotItems) {
          navigate(`/payment-success?orderId=${createdOrder._id}`);
        } else {
          navigate(`/profile/orders/${createdOrder._id}`);
        }
        return;
      }

      localStorage.setItem('pendingCheckoutPayload', JSON.stringify(orderData));
      const { data } = await paymentAPI.createIntent({
        amount: finalTotal,
        paymentMethod,
      });
      const payload = data?.data || {};

      if (!payload.clientSecret) {
        throw new Error('clientSecret not returned from payment intent API');
      }

      setPaymentSession({
        clientSecret: payload.clientSecret,
        simulated: Boolean(payload.simulated),
        paymentMethod,
        amount: finalTotal,
        itemCount: items.length,
      });
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setPlacing(false);
    }
  };

  if (items.length === 0) return (
    <div className="page"><div className="container">
      <div className="alert alert-info">Cart is empty. <Link to="/products">Shop now</Link></div>
    </div></div>
  );

  return (
    <div className="page">
      <div className="container">
        <h1 style={{ marginBottom: 28 }}>Checkout</h1>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' }}>
          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 style={{ marginBottom: 16 }}>Delivery Address</h3>

              {addresses.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
                  <button
                    type="button"
                    onClick={() => setUseNew(false)}
                    className={`btn btn-sm ${!useNew ? 'btn-primary' : 'btn-outline'}`}>
                    Saved Addresses
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseNew(true)}
                    className={`btn btn-sm ${useNew ? 'btn-primary' : 'btn-outline'}`}>
                    Add New Address
                  </button>
                </div>
              )}

              {!useNew && addresses.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  {addresses.map((a) => (
                    <label key={a._id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12, cursor: 'pointer', padding: 12, border: `1.5px solid ${selectedAddr?._id === a._id ? 'var(--brown)' : 'var(--border)'}`, borderRadius: 8, background: selectedAddr?._id === a._id ? '#FFF8F0' : 'transparent' }}>
                      <input type="radio" name="addr" checked={selectedAddr?._id === a._id} onChange={() => setSelectedAddr(a)} style={{ marginTop: 2 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{a.label || 'Home'}</div>
                        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{a.line1}</div>
                        {a.line2 && <div style={{ fontSize: 13, color: 'var(--text-light)' }}>{a.line2}</div>}
                        <div style={{ fontSize: 13, color: 'var(--text-light)' }}>{a.city}, {a.state} – {a.pincode}</div>
                      </div>
                      {a.isDefault && <span className="badge badge-brown" style={{ fontSize: 11 }}>Default</span>}
                    </label>
                  ))}
                </div>
              )}
              {(useNew || addresses.length === 0) && (
                <div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Label</label>
                      <input className="form-input" value={newAddr.label} onChange={(e) => setNewAddr((a) => ({ ...a, label: e.target.value }))} placeholder="Home, Work, Office" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Address Line 1 *</label>
                      <input className="form-input" value={newAddr.line1} onChange={(e) => setNewAddr((a) => ({ ...a, line1: e.target.value }))} placeholder="Street, area" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Address Line 2</label>
                      <input className="form-input" value={newAddr.line2} onChange={(e) => setNewAddr((a) => ({ ...a, line2: e.target.value }))} placeholder="Landmark (optional)" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">City *</label>
                      <input className="form-input" value={newAddr.city} onChange={(e) => setNewAddr((a) => ({ ...a, city: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">State *</label>
                      <input className="form-input" value={newAddr.state} onChange={(e) => setNewAddr((a) => ({ ...a, state: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Pincode *</label>
                      <input className="form-input" value={newAddr.pincode} onChange={(e) => setNewAddr((a) => ({ ...a, pincode: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Country</label>
                      <input className="form-input" value={newAddr.country} onChange={(e) => setNewAddr((a) => ({ ...a, country: e.target.value }))} />
                    </div>
                  </div>
                  {addresses.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setUseNew(false)}>Use saved address</button>}
                </div>
              )}
            </div>

            <div className="card">
              <h3 style={{ marginBottom: 16 }}>Payment Method</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {availablePaymentMethods.map((m) => (
                  <label key={m.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: 14, borderRadius: 8, cursor: 'pointer',
                    border: `1.5px solid ${payment === m.id ? 'var(--brown)' : 'var(--border)'}`,
                    background: payment === m.id ? '#FFF8F0' : 'var(--white)',
                  }}>
                    <input
                      type="radio"
                      name="payment"
                      checked={payment === m.id}
                      onChange={() => {
                        setPayment(m.id);
                        if (m.id === 'COD') {
                          setPaymentSession(null);
                          return;
                        }
                        void createPaymentSession(m.id);
                      }}
                    />
                    <span style={{ display: 'inline-flex' }}><AppIcon name={m.icon} size={18} /></span>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{m.label}</span>
                  </label>
                ))}
              </div>

              <button className="btn btn-primary btn-full btn-lg" onClick={() => createPaymentSession(payment)} disabled={placing || Boolean(paymentSession)} style={{ marginTop: 18 }}>
                {placing ? 'Preparing…' : payment === 'COD' ? `Place Order · ${formatPrice(finalTotal)}` : `Open Secure Payment · ${formatPrice(finalTotal)}`}
              </button>
            </div>
          </div>

          <div className="card" style={{ position: 'sticky', top: 80 }}>
            <h3 style={{ marginBottom: 16 }}>Order Summary</h3>
            {items.map((item) => (
              <div key={`${item.productId}-${item.variantId}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                <span style={{ color: 'var(--text-light)' }}>{item.name} × {item.qty}</span>
                <span>{formatPrice(item.price * item.qty)}</span>
              </div>
            ))}
            <hr className="divider" />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
              <span>Subtotal</span><span>{formatPrice(total)}</span>
            </div>
            {couponData && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--success)', marginBottom: 8 }}>
                <span>Discount ({coupon})</span><span>−{formatPrice(discount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 16 }}>
              <span>Delivery</span><span style={{ color: shippingCharge > 0 ? 'var(--text)' : 'var(--success)' }}>{shippingCharge > 0 ? formatPrice(shippingCharge) : 'Free'}</span>
            </div>
            <hr className="divider" />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 18, marginBottom: 20, color: 'var(--text)' }}>
              <span>Total</span><span style={{ color: 'var(--brown)' }}>{formatPrice(finalTotal)}</span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input className="form-input" value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Coupon code" style={{ flex: 1 }} />
              <button className="btn btn-outline btn-sm" onClick={applyCoupon} disabled={couponLoading}>
                {couponLoading ? '…' : 'Apply'}
              </button>
            </div>

            <div style={{ marginTop: -8, marginBottom: 16 }}>
              {couponsLoading ? (
                <div style={{ fontSize: 12, color: 'var(--text-light)' }}>Loading coupons...</div>
              ) : availableCoupons.filter(c => c.isApplicable).length === 0 ? null : (
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setShowCouponsDropdown(!showCouponsDropdown)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: 13,
                      fontWeight: 500,
                      border: `1px solid var(--border)`,
                      borderRadius: 6,
                      background: 'var(--white)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      color: 'var(--text)',
                    }}
                  >
                    <span>Available Coupons: {availableCoupons.filter(c => c.isApplicable).length}</span>
                    <span style={{ fontSize: 10, transition: 'transform 0.2s' }}>
                      {showCouponsDropdown ? '▲' : '▼'}
                    </span>
                  </button>

                  {showCouponsDropdown && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: 4,
                        background: 'var(--white)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        zIndex: 10,
                        maxHeight: 300,
                        overflowY: 'auto',
                      }}
                    >
                      {availableCoupons.filter(c => c.isApplicable).map((c) => {
                        const isSelected = coupon.trim().toUpperCase() === String(c.code).toUpperCase();
                        return (
                          <div
                            key={c.code}
                            style={{
                              padding: 12,
                              borderBottom: '1px solid var(--border)',
                              background: isSelected ? '#FFF8F0' : 'var(--white)',
                              ':hover': { background: '#FFF8F0' },
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{c.code}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>
                                  {c.discountType === 'percentage'
                                    ? `${c.discountValue}% OFF`
                                    : `${formatPrice(c.discountValue)} OFF`}
                                  {c.minOrder > 0 ? ` · Min ${formatPrice(c.minOrder)}` : ''}
                                </div>
                                {!!c.description && <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 3 }}>{c.description}</div>}
                              </div>
                              <button
                                className="btn btn-sm btn-outline"
                                disabled={couponLoading}
                                onClick={async () => {
                                  setCoupon(c.code);
                                  setCouponLoading(true);
                                  try {
                                    const { data } = await couponAPI.validate({ code: c.code, orderAmount: total });
                                    setCouponData(data.data);
                                    toast.success('Coupon applied!');
                                    setShowCouponsDropdown(false);
                                  } catch (err) {
                                    toast.error(getErrorMsg(err));
                                    setCouponData(null);
                                  } finally {
                                    setCouponLoading(false);
                                  }
                                }}
                              >
                                {couponLoading ? '…' : 'Apply'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <PaymentModal
        session={paymentSession}
        onComplete={finalizeOrderFromPaymentIntent}
        onClose={() => setPaymentSession(null)}
      />
    </div>
  );
}
