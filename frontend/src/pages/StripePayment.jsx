import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { orderAPI, paymentAPI } from '../api/index.js';
import { useToast } from '../context/ToastContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { formatPrice, getErrorMsg } from '../utils/helpers.js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '');

function StripePaymentForm({ orderId, clientSecret, simulated, onPaymentSuccess, paymentMethod, amount, itemCount }) {
  const stripe = useStripe();
  const elements = useElements();
  const toast = useToast();
  const { clearCart } = useCart();
  const [processing, setProcessing] = useState(false);
  const [upiQrUrl, setUpiQrUrl] = useState('');
  const [upiPaymentIntentId, setUpiPaymentIntentId] = useState('');
  const [upiStatusMessage, setUpiStatusMessage] = useState('');
  const isUpiMode = paymentMethod === 'UPI';

  const payNow = async () => {
    if (processing) return;

    if (simulated) {
      try {
        setProcessing(true);
        const paymentIntentId = clientSecret?.split('_secret_')?.[0] || `pi_sim_${Date.now()}`;
        await onPaymentSuccess(paymentIntentId);
        clearCart();
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
      const returnParams = new URLSearchParams();
      if (orderId) returnParams.set('orderId', orderId);
      else returnParams.set('mode', 'checkout');
      const returnUrl = `${window.location.origin}/checkout/payment?${returnParams.toString()}`;
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: returnUrl },
        redirect: 'if_required',
      });

      if (result.error) {
        toast.error(result.error.message || 'Payment failed');
        return;
      }

      const paymentIntentId = result.paymentIntent?.id;
      if (!paymentIntentId) {
        toast.error('Payment completed but payment ID was not found');
        return;
      }

      const upiQr = result.paymentIntent?.next_action?.upi_display_qr_code?.image_url_png
        || result.paymentIntent?.next_action?.upi_display_qr_code?.image_url_svg
        || '';

      if (upiQr && result.paymentIntent?.status !== 'succeeded') {
        setUpiQrUrl(upiQr);
        setUpiPaymentIntentId(paymentIntentId);
        setUpiStatusMessage('Scan the QR code in your UPI app to complete the payment.');
        toast.info('Scan the QR code to complete payment.');
        return;
      }

      if (result.paymentIntent?.status && result.paymentIntent.status !== 'succeeded') {
        setUpiStatusMessage(`Payment status: ${result.paymentIntent.status}. Complete payment and verify again.`);
        toast.info('Payment is not yet completed.');
        return;
      }

      await onPaymentSuccess(paymentIntentId);
      clearCart();
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 620, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 12 }}>Secure Payment</h2>
      <p style={{ color: 'var(--text-light)', marginBottom: 18 }}>
        Order ID: {orderId || 'Pending until payment success'}
      </p>

      {isUpiMode && (
        <div style={{ marginBottom: 18, padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: '#FFFDF9' }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.08, color: 'var(--text-light)', marginBottom: 8 }}>UPI</div>
          <div style={{ fontSize: 14, marginBottom: 6 }}><strong>Amount:</strong> {formatPrice(amount || 0)}</div>
          <div style={{ fontSize: 14, marginBottom: 6 }}><strong>Items:</strong> {itemCount || 0}</div>
          <div style={{ fontSize: 14, marginBottom: 6 }}><strong>Reference:</strong> Pending payment success</div>
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
                  await onPaymentSuccess(upiPaymentIntentId);
                  clearCart();
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

      {!simulated && !(isUpiMode && upiQrUrl) && (
        <div style={{ marginBottom: 18 }}>
          <PaymentElement options={{ layout: 'tabs' }} />
        </div>
      )}

      {simulated && (
        <div className="alert alert-info" style={{ marginBottom: 18 }}>
          Simulated mode is active. Click the button below to confirm payment.
        </div>
      )}

      <button className="btn btn-primary btn-full btn-lg" onClick={payNow} disabled={processing || (!simulated && (!stripe || !elements))}>
        {processing ? 'Processing Payment...' : 'Pay Now'}
      </button>
    </div>
  );
}

export default function StripePayment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { clearCart } = useCart();

  const rawOrderId = searchParams.get('orderId');
  const orderId = rawOrderId && rawOrderId !== 'null' && rawOrderId !== 'undefined' ? rawOrderId : null;
  const mode = searchParams.get('mode');
  const isCheckoutMode = mode === 'checkout';
  const [clientSecret, setClientSecret] = useState('');
  const [simulated, setSimulated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkoutPayload, setCheckoutPayload] = useState(null);
  const initializedRef = useRef(false);

  const finalizeSuccessfulPayment = async (paymentIntentId) => {
    if (orderId) {
      await paymentAPI.verify({ orderId, stripePaymentIntentId: paymentIntentId });
      return { orderId };
    }

    const payload = checkoutPayload || JSON.parse(sessionStorage.getItem('pendingCheckoutPayload') || 'null');
    if (!payload) {
      throw new Error('Checkout session expired. Please try checkout again.');
    }

    const { data } = await orderAPI.create({
      ...payload,
      stripePaymentIntentId: paymentIntentId,
    });

    const createdOrderId = data?.data?.order?._id;
    sessionStorage.removeItem('pendingCheckoutPayload');
    if (createdOrderId) {
      navigate(`/payment-success?orderId=${createdOrderId}`);
    }
    return { orderId: createdOrderId };
  };

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (!orderId && !isCheckoutMode) {
      toast.error('Missing payment context');
      navigate('/checkout');
      return;
    }

    const redirectStatus = searchParams.get('redirect_status');
    const paymentIntentId = searchParams.get('payment_intent');

    if (redirectStatus === 'succeeded' && paymentIntentId) {
      const finalizeRedirectPayment = async () => {
        try {
          setLoading(true);
          const result = await finalizeSuccessfulPayment(paymentIntentId);
          clearCart();
          if (result?.orderId && !orderId) {
            navigate(`/payment-success?orderId=${result.orderId}`);
          }
        } catch (err) {
          toast.error(getErrorMsg(err));
          if (orderId) navigate(`/profile/orders/${orderId}`);
          else navigate('/checkout');
        } finally {
          setLoading(false);
        }
      };

      finalizeRedirectPayment();
      return;
    }

    if (redirectStatus && redirectStatus !== 'succeeded') {
      toast.error('Payment was not completed. Please try again.');
      if (orderId) navigate(`/profile/orders/${orderId}`);
      else navigate('/checkout');
      return;
    }

    const init = async () => {
      try {
        setLoading(true);
        if (isCheckoutMode) {
          const pending = JSON.parse(sessionStorage.getItem('pendingCheckoutPayload') || 'null');
          if (!pending) throw new Error('Checkout session expired. Please start again.');
          setCheckoutPayload(pending);

          const { data } = await paymentAPI.createIntent({
            amount: pending.totalAmount,
            paymentMethod: pending.paymentMethod,
          });
          const payload = data?.data || {};

          if (!payload.clientSecret) {
            throw new Error('clientSecret not returned from payment intent API');
          }

          setClientSecret(payload.clientSecret);
          setSimulated(Boolean(payload.simulated));
          return;
        }

        const { data } = await paymentAPI.createIntent({ orderId });
        const payload = data?.data || {};

        if (!payload.clientSecret) {
          throw new Error('clientSecret not returned from payment intent API');
        }

        setClientSecret(payload.clientSecret);
        setSimulated(Boolean(payload.simulated));
      } catch (err) {
        toast.error(getErrorMsg(err));
        if (orderId) navigate(`/profile/orders/${orderId}`);
        else navigate('/checkout');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [orderId, isCheckoutMode, navigate, toast, clearCart]);

  const options = useMemo(() => ({
    clientSecret,
    appearance: {
      theme: 'flat',
    },
  }), [clientSecret]);

  return (
    <div className="page">
      <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
        {loading && <div className="card" style={{ textAlign: 'center' }}>Preparing secure payment...</div>}

        {!loading && !clientSecret && (
          <div className="alert alert-error">Could not initialize payment. Please try again.</div>
        )}

        {!loading && clientSecret && simulated && (
          <StripePaymentForm
            orderId={orderId}
            clientSecret={clientSecret}
            simulated
            onPaymentSuccess={finalizeSuccessfulPayment}
            paymentMethod={checkoutPayload?.paymentMethod}
            amount={checkoutPayload?.totalAmount}
            itemCount={checkoutPayload?.items?.length}
          />
        )}

        {!loading && clientSecret && !simulated && (
          <Elements stripe={stripePromise} options={options}>
            <StripePaymentForm
              orderId={orderId}
              clientSecret={clientSecret}
              simulated={false}
              onPaymentSuccess={finalizeSuccessfulPayment}
              paymentMethod={checkoutPayload?.paymentMethod}
              amount={checkoutPayload?.totalAmount}
              itemCount={checkoutPayload?.items?.length}
            />
          </Elements>
        )}
      </div>
    </div>
  );
}
