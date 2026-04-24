import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatPrice, getImageUrl, getErrorMsg } from '../utils/helpers.js';
import { measurementAPI } from '../api/index.js';
import EmptyState from '../components/ui/EmptyState.jsx';
import MeasurementForm from '../components/MeasurementForm.jsx';
import AppIcon from '../components/ui/AppIcon.jsx';
import { useState, useEffect } from 'react';

const GARMENT_TYPES = ['Shirt', 'Pants', 'Blazer', 'Jodhpuri', 'Indo-Western', 'Sherwani', 'Kurta', 'Other'];

export default function Cart() {
  const { items, total, updateQty, updateMeasurement, updateItemNote, removeItem } = useCart();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [expandedMeasurement, setExpandedMeasurement] = useState(null);
  const [ownMeasurements, setOwnMeasurements] = useState({});  // Track own measurements per item

  const incrementItemQty = (item) => {
    const result = updateQty(item.productId, item.variantId, item.qty + 1);
    if (result?.limited) {
      toast.error('Out of stock');
    }
  };

  // Load existing measurement templates for user
  useEffect(() => {
    if (user) {
      measurementAPI.getTemplates()
        .then(({ data }) => {
          setTemplates(Array.isArray(data.data?.templates) ? data.data.templates : []);
        })
        .catch(() => setTemplates([]));
    }
  }, [user]);

  const stitchingItems = items.filter((item) => item.isStitching);
  const regularItems = items.filter((item) => !item.isStitching);

  const inferGarmentType = (item) => {
    const text = `${item?.garmentType || ''} ${item?.name || ''}`.toLowerCase();
    if (text.includes('pant') || text.includes('trouser') || text.includes('jeans')) return 'Pants';
    if (text.includes('blazer') || text.includes('coat')) return 'Blazer';
    if (text.includes('jodhpuri')) return 'Jodhpuri';
    if (text.includes('indo') || text.includes('western')) return 'Indo-Western';
    if (text.includes('sherwani')) return 'Sherwani';
    if (text.includes('kurta')) return 'Kurta';
    if (text.includes('shirt')) return 'Shirt';
    return 'Other';
  };

  if (items.length === 0) return (
    <div className="page">
      <div className="container">
        <EmptyState icon="cart" title="Your cart is empty" description="Browse our collection and add some items."
          action={<Link to="/products" className="btn btn-primary">Shop Now</Link>} />
      </div>
    </div>
  );

  return (
    <div className="page">
      <div className="container">
        <h1 style={{ marginBottom: 28 }}>Shopping Cart</h1>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
          {/* Items */}
          <div>
            {/* Regular Items */}
            {regularItems.length > 0 && (
              <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
                <div style={{ padding: 16, background: '#F5EDE2', fontWeight: 600, fontSize: 14 }}>Ready-Made Clothes</div>
                {regularItems.map((item, idx) => (
                  <div key={`${item.productId}-${item.variantId}`} style={{
                    display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: 16, padding: 20,
                    borderBottom: idx < regularItems.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center',
                  }}>
                    <Link to={`/products/${item.productId}`}>
                      <img src={getImageUrl(item.image)} alt={item.name} style={{ width: 80, height: 96, objectFit: 'cover', borderRadius: 8, background: '#F5EDE2' }}
                        onError={(e) => { e.target.src = 'https://placehold.co/80x96/FFF2E1/A79277?text=W'; }} />
                    </Link>
                    <div>
                      <Link to={`/products/${item.productId}`} style={{ fontWeight: 600, marginBottom: 4, display: 'block', color: 'inherit', textDecoration: 'none' }}>
                        {item.name}
                      </Link>
                      <div style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 8 }}>
                        {[item.size, item.color].filter(Boolean).join(' / ')}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden', width: 'fit-content' }}>
                        <button onClick={() => updateQty(item.productId, item.variantId, item.qty - 1)}
                          style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}>−</button>
                        <span style={{ width: 32, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>{item.qty}</span>
                        <button onClick={() => incrementItemQty(item)}
                          style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}>+</button>
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>
                          Item Note (Optional)
                        </label>
                        <textarea
                          rows={2}
                          className="form-input"
                          placeholder="Any custom note for this item"
                          value={item.note || ''}
                          maxLength={500}
                          onChange={(e) => updateItemNote(item.productId, item.variantId, e.target.value)}
                        />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{formatPrice(item.price * item.qty)}</div>
                      <button onClick={() => removeItem(item.productId, item.variantId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', fontSize: 13 }}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Stitching Items */}
            {stitchingItems.length > 0 && (
              <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
                <div style={{ padding: 16, background: '#FFF2E1', fontWeight: 600, fontSize: 14 }}>Custom Stitching</div>
                {stitchingItems.map((item, idx) => (
                  <div key={`${item.productId}-${item.variantId}`}>
                    <div style={{
                      display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: 16, padding: 20,
                      borderBottom: '1px solid var(--border)', alignItems: 'center',
                    }}>
                      <Link to={`/products/${item.productId}`}>
                        <img src={getImageUrl(item.image)} alt={item.name} style={{ width: 80, height: 96, objectFit: 'cover', borderRadius: 8, background: '#F5EDE2' }}
                          onError={(e) => { e.target.src = 'https://placehold.co/80x96/FFF2E1/A79277?text=W'; }} />
                      </Link>
                      <div>
                          <Link to={`/products/${item.productId}`} style={{ fontWeight: 600, marginBottom: 4, display: 'block', color: 'inherit', textDecoration: 'none' }}>
                            {item.name}
                          </Link>
                        <div style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 8 }}>
                          {item.measurementPreference ? (
                            <span style={{ color: 'var(--success)', fontWeight: 500 }}>
                              ✓ {item.measurementPreference === 'existing' 
                                ? 'Using Existing Measurement' 
                                : item.measurementPreference === 'book_slot' 
                                ? 'Measurement Slot Will Be Booked After Payment'
                                : 'Own Measurement Provided'}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--error)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <AppIcon name="warning" size={13} /> Measurement required
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden', width: 'fit-content' }}>
                          <button onClick={() => updateQty(item.productId, item.variantId, item.qty - 1)}
                            style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}>−</button>
                          <span style={{ width: 32, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>{item.qty}</span>
                          <button onClick={() => incrementItemQty(item)}
                            style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}>+</button>
                        </div>
                        <div style={{ marginTop: 10 }}>
                          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>
                            Tailor Note (Optional)
                          </label>
                          <textarea
                            rows={2}
                            className="form-input"
                            placeholder="Special stitching instructions for tailor"
                            value={item.note || ''}
                            maxLength={500}
                            onChange={(e) => updateItemNote(item.productId, item.variantId, e.target.value)}
                          />
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{formatPrice(item.price * item.qty)}</div>
                        <button onClick={() => removeItem(item.productId, item.variantId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', fontSize: 13 }}>
                          Remove
                        </button>
                      </div>
                    </div>

                    {/* Measurement Options */}
                    <div style={{ padding: 16, background: '#FAFAFA', borderTop: '1px solid var(--border)' }}>
                      <button
                        type="button"
                        onClick={() => setExpandedMeasurement(expandedMeasurement === `${item.productId}-${item.variantId}` ? null : `${item.productId}-${item.variantId}`)}
                        style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: 'var(--brown)' }}>
                        {expandedMeasurement === `${item.productId}-${item.variantId}` ? '▼' : '▶'} Select Measurement Option
                      </button>

                      {expandedMeasurement === `${item.productId}-${item.variantId}` && (
                        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {/* Option 1: Use Existing Measurement (Login Required) */}
                          {user && templates.length > 0 && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: `1.5px solid ${item.measurementPreference === 'existing' ? 'var(--brown)' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', opacity: user ? 1 : 0.6 }}>
                              <input type="radio" name={`measure-${item.productId}-${item.variantId}`} checked={item.measurementPreference === 'existing'} onChange={() => {
                                updateMeasurement(item.productId, item.variantId, 'existing');
                                toast.info('You can select specific template during checkout');
                              }} />
                              <div>
                                <span style={{ fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}><AppIcon name="note" size={14} /> Use Existing Measurement</span>
                                <p style={{ fontSize: 12, color: 'var(--text-light)', margin: '2px 0 0 0' }}>{templates.length} saved template(s)</p>
                              </div>
                            </label>
                          )}

                          {!user && templates.length === 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: '1.5px solid var(--border)', borderRadius: 8, background: '#F9F9F9', opacity: 0.6 }}>
                              <input type="radio" disabled />
                              <div>
                                <span style={{ fontWeight: 500, color: 'var(--text-light)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><AppIcon name="note" size={14} /> Use Existing Measurement</span>
                                <p style={{ fontSize: 12, color: 'var(--text-light)', margin: '2px 0 0 0', display: 'inline-flex', alignItems: 'center', gap: 6 }}><AppIcon name="lock" size={12} /> Requires login</p>
                              </div>
                            </div>
                          )}

                          {/* Option 2: Book New Measurement Slot */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: `1.5px solid ${item.measurementPreference === 'book_slot' ? 'var(--brown)' : 'var(--border)'}`, borderRadius: 8, background: item.measurementPreference === 'book_slot' ? '#FFF8F0' : 'transparent' }}>
                            <input type="radio" name={`measure-${item.productId}-${item.variantId}`} checked={item.measurementPreference === 'book_slot'} onChange={() => updateMeasurement(item.productId, item.variantId, 'book_slot')} style={{ cursor: 'pointer' }} />
                            <span style={{ flex: 1 }}>
                              <span style={{ fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}><AppIcon name="calendar" size={14} /> Book Measurement Slot</span>
                              <p style={{ fontSize: 12, color: 'var(--text-light)', margin: '2px 0 0 0' }}>You can book your slot right after successful online payment.</p>
                            </span>
                          </div>

                          {/* Option 3: Own Measurement */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, border: `1.5px solid ${item.measurementPreference === 'own_measurement' ? 'var(--brown)' : 'var(--border)'}`, borderRadius: 8, background: item.measurementPreference === 'own_measurement' ? '#FFF8F0' : 'transparent' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                              <input type="radio" name={`measure-${item.productId}-${item.variantId}`} checked={item.measurementPreference === 'own_measurement'} onChange={() => {
                                updateMeasurement(item.productId, item.variantId, 'own_measurement', null, ownMeasurements[`${item.productId}-${item.variantId}`] || {});
                              }} />
                              <span style={{ fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}><AppIcon name="pencil" size={14} /> Provide Your Own Measurements</span>
                            </label>
                            
                            {item.measurementPreference === 'own_measurement' && (
                              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                                <MeasurementForm
                                  garmentType={inferGarmentType(item)}
                                  measurements={ownMeasurements[`${item.productId}-${item.variantId}`] || {}}
                                  onChange={(measurements) => {
                                    setOwnMeasurements(prev => ({
                                      ...prev,
                                      [`${item.productId}-${item.variantId}`]: measurements
                                    }));
                                    updateMeasurement(item.productId, item.variantId, 'own_measurement', null, measurements);
                                  }}
                                  compact={true}
                                />
                              </div>
                            )}
                          </div>

                          <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <AppIcon name="bulb" size={13} /> Taking proper measurements ensures the best fit. All measurements are in inches.
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

              </div>
            )}
          </div>

          {/* Summary */}
          <div className="card" style={{ position: 'sticky', top: 80 }}>
            {stitchingItems.filter(i => !i.measurementPreference).length > 0 && (
              <div style={{
                padding: 12,
                marginBottom: 16,
                background: '#FFF2E1',
                border: '1px solid #FFD9A8',
                borderRadius: 6,
                fontSize: 13,
                color: '#8B6F47',
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start'
              }}>
                <span style={{ flexShrink: 0, marginTop: 2 }}>⚠️</span>
                <div>
                  <strong>Measurement Required</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: 12 }}>
                    {stitchingItems.filter(i => !i.measurementPreference).length} stitching item(s) need measurement details before checkout.
                  </p>
                </div>
              </div>
            )}
            <h3 style={{ marginBottom: 20 }}>Order Summary</h3>
            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 16 }}>
              {items.map((item) => (
                <div key={`${item.productId}-${item.variantId}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
                  <span style={{ color: 'var(--text-light)' }}>{item.name} × {item.qty}</span>
                  <span>{formatPrice(item.price * item.qty)}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16, marginBottom: 24 }}>
              <span>Total</span>
              <span style={{ color: 'var(--brown)' }}>{formatPrice(total)}</span>
            </div>
            {user ? (
              <button 
                className="btn btn-primary btn-full btn-lg" 
                onClick={() => navigate('/checkout')}
                disabled={stitchingItems.filter(i => !i.measurementPreference).length > 0}
                title={stitchingItems.filter(i => !i.measurementPreference).length > 0 ? 'Please provide measurements for stitching items' : ''}
              >
                Proceed to Checkout
              </button>
            ) : (
              <div>
                <Link to="/login" className="btn btn-primary btn-full btn-lg" style={{ display: 'flex', marginBottom: 10 }}>
                  Login to Checkout
                </Link>
                <p style={{ fontSize: 12, color: 'var(--text-light)', textAlign: 'center' }}>or continue as guest</p>
              </div>
            )}
            <Link to="/products" style={{ display: 'block', textAlign: 'center', fontSize: 13, marginTop: 14, color: 'var(--text-light)' }}>
              ← Continue Shopping
            </Link>
          </div>
        </div>
      </div>
      <style>{`@media(max-width:700px){.container>div:last-child{grid-template-columns:1fr!important}}`}</style>
    </div>
  );
}
