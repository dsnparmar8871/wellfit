import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { productAPI, reviewAPI } from '../api/index.js';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatPrice, getImageUrl, formatDate, getErrorMsg, getInStockVariants, hasPurchasableStock } from '../utils/helpers.js';
import StarRating from '../components/ui/StarRating.jsx';
import PageSkeleton from '../components/ui/PageSkeleton.jsx';
import AppIcon from '../components/ui/AppIcon.jsx';

export default function ProductDetail() {
  const { id } = useParams();
  const { items, addItem, updateQty } = useCart();
  const toast = useToast();
  const { user } = useAuth();

  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [imgIdx, setImgIdx] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [qty, setQty] = useState(1);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState('details');
  const [suggestions, setSuggestions] = useState({ relatedProducts: [], accessories: [], combos: [] });
  const [reviewFilter, setReviewFilter] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([productAPI.getById(id), productAPI.getReviews(id), productAPI.getSuggestions(id)])
      .then(([pd, rd, sd]) => {
        const productData = pd.data.data?.product || pd.data.data;
        setProduct(productData || null);
        const initialVariants = getInStockVariants(productData || {});
        setSelectedVariant(initialVariants[0] || productData?.variants?.[0] || null);
        const reviewList = Array.isArray(rd.data.data) ? rd.data.data : (rd.data.data?.reviews || []);
        setReviews(reviewList);
        const suggestionData = sd.data.data || {};
        const relatedProducts = (Array.isArray(suggestionData.relatedProducts) ? suggestionData.relatedProducts : []).filter(hasPurchasableStock);
        const accessories = (Array.isArray(suggestionData.accessories) ? suggestionData.accessories : []).filter(hasPurchasableStock);
        const combos = (Array.isArray(suggestionData.combos) ? suggestionData.combos : [])
          .map((combo) => ({ ...combo, products: (combo.products || []).filter(hasPurchasableStock) }))
          .filter((combo) => combo.products.length > 0);
        setSuggestions({
          relatedProducts,
          accessories,
          combos,
        });
      })
      .catch(() => {
        setSuggestions({ relatedProducts: [], accessories: [], combos: [] });
        toast.error('Failed to load product');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleAddToCart = () => {
    if (!selectedVariant) return toast.error('Please select a variant');
    if (selectedVariant.stock < qty) return toast.error('Not enough stock');
    const effectivePrice = Number(selectedVariant.price ?? product.price ?? 0);
    const effectiveMrp = Number(selectedVariant.mrp ?? product.mrp ?? effectivePrice);
    const result = addItem({
      productId: product._id,
      variantId: selectedVariant._id,
      name: product.productName || product.name,
      price: effectivePrice,
      mrp: Math.max(effectiveMrp, effectivePrice),
      image: selectedVariant.image || product.images?.[0],
      size: selectedVariant.size,
      color: selectedVariant.color,
      maxStock: Number(selectedVariant.stock || 0),
      isStitching: product.isStitchingAvailable || false,
      qty,
    });
    if (result?.limited) {
      toast.error('Out of stock');
      return;
    }
    toast.success('Added to cart!');
  };

  const handleReviewSubmit = async () => {
    if (!user) return toast.error('Login to submit a review');
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('rating', reviewForm.rating);
      fd.append('comment', reviewForm.comment);
      await productAPI.createReview(id, fd);
      toast.success('Review submitted!');
      const { data } = await productAPI.getReviews(id);
      setReviews(Array.isArray(data.data) ? data.data : (data.data?.reviews || []));
      setReviewForm({ rating: 5, comment: '' });
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Are you sure you want to remove your review?')) return;
    try {
      await reviewAPI.deleteOwnReview(reviewId);
      toast.success('Review removed');
      const { data } = await productAPI.getReviews(id);
      setReviews(Array.isArray(data.data) ? data.data : (data.data?.reviews || []));
    } catch (err) {
      toast.error(getErrorMsg(err));
    }
  };

  const getCartQty = (productId, variantId) => {
    const found = items.find((item) => item.productId === productId && item.variantId === variantId);
    return found?.qty || 0;
  };

  const getDefaultVariant = (item) => {
    if (!Array.isArray(item?.variants) || item.variants.length === 0) return null;
    return item.variants.find((v) => Number(v?.stock || 0) > 0) || item.variants[0];
  };

  const addSuggestedProductToCart = (item) => {
    if (!item?._id) return;
    const defaultVariant = getDefaultVariant(item);
    const stock = defaultVariant ? Number(defaultVariant.stock || 0) : Number(item.totalStock || 0);
    if (stock <= 0) {
      toast.error('This item is out of stock');
      return;
    }

    const price = Number(defaultVariant?.price ?? item.price ?? 0);
    const mrp = Number(defaultVariant?.mrp ?? item.mrp ?? price);

    const result = addItem({
      productId: item._id,
      variantId: defaultVariant?._id,
      name: item.productName || item.name,
      price,
      mrp: Math.max(mrp, price),
      image: defaultVariant?.image || item.images?.[0],
      size: defaultVariant?.size,
      color: defaultVariant?.color,
      maxStock: stock,
      isStitching: item.isStitchingAvailable || false,
      qty: 1,
    });
    if (result?.limited) {
      toast.error('Out of stock');
      return;
    }
  };

  const getSuggestionCartInfo = (item) => {
    const defaultVariant = getDefaultVariant(item);
    const variantId = defaultVariant?._id;
    const qtyInCart = getCartQty(item?._id, variantId);
    return { defaultVariant, variantId, qtyInCart };
  };

  const updateSuggestedItemQty = (item, nextQty) => {
    const { variantId } = getSuggestionCartInfo(item);
    if (!item?._id) return;
    updateQty(item._id, variantId, Math.max(0, nextQty));
  };

  const handleAddComboToCart = (combo) => {
    if (!Array.isArray(combo?.products) || combo.products.length === 0) {
      toast.error('Combo is unavailable');
      return;
    }

    let addedCount = 0;
    combo.products.forEach((item) => {
      const defaultVariant = getDefaultVariant(item);
      const stock = defaultVariant ? Number(defaultVariant.stock || 0) : Number(item.totalStock || 0);
      if (stock <= 0) return;

      const price = Number(defaultVariant?.price ?? item.price ?? 0);
      const mrp = Number(defaultVariant?.mrp ?? item.mrp ?? price);

      const result = addItem({
        productId: item._id,
        variantId: defaultVariant?._id,
        name: item.productName || item.name,
        price,
        mrp: Math.max(mrp, price),
        image: defaultVariant?.image || item.images?.[0],
        size: defaultVariant?.size,
        color: defaultVariant?.color,
        maxStock: stock,
        isStitching: item.isStitchingAvailable || false,
        qty: 1,
      });
      if (result?.limited) return;
      addedCount += 1;
    });

    if (addedCount === 0) {
      toast.error('Combo items are out of stock');
      return;
    }
    toast.success(`Added ${addedCount} combo item${addedCount > 1 ? 's' : ''} to cart`);
  };

  if (loading) return <PageSkeleton variant="detail" />;
  if (!product) return <div className="container page"><div className="alert alert-error">Product not found.</div></div>;

  const inStockVariants = getInStockVariants(product);
  const outOfStockVariantImageSet = new Set(
    (Array.isArray(product.variants) ? product.variants : [])
      .filter((variant) => Number(variant?.stock || 0) <= 0)
      .map((variant) => variant?.image)
      .filter(Boolean)
  );
  const productImages = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  const allVariantImages = (Array.isArray(product.variants) ? product.variants : [])
    .map((v) => v.image)
    .filter(Boolean);

  // Combine all images, keeping unique ones (Variants first, then Extra)
  const displayImages = [...new Set([...allVariantImages, ...productImages])];
  if (displayImages.length === 0) displayImages.push('');

  const safeImgIdx = Math.min(imgIdx, Math.max(displayImages.length - 1, 0));
  const stock = selectedVariant?.stock ?? 0;
  const activePrice = Number(selectedVariant?.price ?? product.price ?? 0);
  const activeMrp = Number(selectedVariant?.mrp ?? product.mrp ?? activePrice);
  const categoryLabel = [product.mainCategory, product.subCategory, product.itemCategory].filter(Boolean).join(' / ');
  const hasSuggestions = suggestions.relatedProducts.length > 0 || suggestions.accessories.length > 0 || suggestions.combos.length > 0;
  const accessorySuggestionHeading = product.mainCategory === 'Accessories' ? 'Matching Clothes' : 'Matching Accessories';
  const inCartQtyForSelectedVariant = getCartQty(product._id, selectedVariant?._id);
  const availableVariantPhotos = inStockVariants
    .filter((variant) => Boolean(variant?.image))
    .map((variant) => ({
      id: variant._id,
      image: variant.image,
      label: [variant.size, variant.color].filter(Boolean).join(' / ') || 'Variant',
    }));

  const showTrustTags = product.subCategory === 'Ready-to-Wear' || product.mainCategory === 'Accessories';
  const showStitchingTags = product.subCategory === 'Custom Tailored' || product.isStitchingAvailable;

  const hasReviewed = user && reviews.some(r => (r.customer?._id || r.customer) === user._id);

  const filteredReviews = [...reviews].filter(r => {
    // Hide own review from main list since it's in the sidebar
    const customerId = (r.customer?._id || r.customer)?.toString();
    const currentUserId = user?._id?.toString();
    if (currentUserId && customerId === currentUserId) return false;
    
    if (!reviewFilter) return true;
    if (reviewFilter === 'recent') return true;
    if (reviewFilter === '5') return r.rating === 5;
    if (reviewFilter === '4') return r.rating === 4;
    if (reviewFilter === '3') return r.rating === 3;
    if (reviewFilter === 'negative') return r.rating <= 2;
    return true;
  }).sort((a, b) => {
    if (reviewFilter === 'recent') return new Date(b.createdAt) - new Date(a.createdAt);
    return 0;
  });

  return (
    <div className="page">
      <div className="container">
        {/* Breadcrumb */}
        <div style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 24 }}>
          <Link to="/products">Products</Link> › {categoryLabel} › {product.productName || product.name}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginBottom: 40 }}>
          {/* Images */}
          <div>
            <div style={{ aspectRatio: '4/5', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: '#F5EDE2', marginBottom: 12 }}>
              <img src={getImageUrl(displayImages[safeImgIdx])} alt={product.productName || product.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.target.src = 'https://placehold.co/500x600/FFF2E1/A79277?text=Wellfit'; }} />
            </div>

          </div>

          {/* Info */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              {categoryLabel}
            </div>
            <h1 style={{ fontSize: '1.6rem', marginBottom: 12 }}>{product.productName || product.name}</h1>
            {product.avgRating > 0 && (
              <div style={{ marginBottom: 16 }}>
                <StarRating rating={product.avgRating} count={reviews.length} size={16} />
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 700, color: 'var(--text)' }}>
                {formatPrice(activePrice)}
              </span>
              {activeMrp > activePrice && (
                <>
                  <span style={{ fontSize: 16, color: 'var(--text-light)', textDecoration: 'line-through' }}>{formatPrice(activeMrp)}</span>
                  <span className="badge badge-brown">{Math.round(((activeMrp - activePrice) / activeMrp) * 100)}% OFF</span>
                </>
              )}
            </div>

            {/* Variants */}
            {inStockVariants.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Select Variant</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {inStockVariants.map((v) => (
                    <button key={v._id} onClick={() => {
                      setSelectedVariant(v);
                      setQty(1);
                      // Auto-switch to variant image if available
                      if (v.image) {
                        const variantImageIndex = displayImages.findIndex(img => img === v.image);
                        if (variantImageIndex !== -1) {
                          setImgIdx(variantImageIndex);
                        }
                      }
                    }}
                      style={{
                        padding: '6px 14px', borderRadius: 8, border: '1.5px solid',
                        borderColor: selectedVariant?._id === v._id ? 'var(--brown)' : 'var(--border)',
                        background: selectedVariant?._id === v._id ? '#FFF8F0' : 'var(--white)',
                        color: 'var(--text)',
                        fontSize: 13, cursor: 'pointer', opacity: 1,
                      }}>
                      {[v.size, v.color].filter(Boolean).join(' / ')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stock */}
            <div style={{ fontSize: 13, marginBottom: 16, color: stock > 0 ? 'var(--success)' : 'var(--error)', fontWeight: 500 }}>
              {stock > 0 ? `✓ In Stock (${stock} available)` : '✕ Out of Stock'}
            </div>

            {/* Qty (pre-add selection) */}
            {stock > 0 && inCartQtyForSelectedVariant === 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Qty:</span>
                <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={{ width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}>−</button>
                  <span style={{ width: 36, textAlign: 'center', fontSize: 14, fontWeight: 600 }}>{qty}</span>
                  <button onClick={() => setQty((q) => Math.min(stock, q + 1))} style={{ width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}>+</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
              {inCartQtyForSelectedVariant > 0 && stock > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden', flex: 1 }}>
                  <button
                    type="button"
                    onClick={() => updateQty(product._id, selectedVariant?._id, inCartQtyForSelectedVariant - 1)}
                    style={{ width: 40, height: 44, border: 'none', background: 'none', cursor: 'pointer', fontSize: 18 }}
                  >
                    -
                  </button>
                  <span style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600 }}>{inCartQtyForSelectedVariant}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const result = updateQty(product._id, selectedVariant?._id, inCartQtyForSelectedVariant + 1);
                      if (result?.limited) toast.error('Out of stock');
                    }}
                    style={{ width: 40, height: 44, border: 'none', background: 'none', cursor: 'pointer', fontSize: 18 }}
                  >
                    +
                  </button>
                </div>
              ) : (
                <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={handleAddToCart} disabled={stock === 0}>
                  {stock > 0 ? 'Add to Cart' : 'Out of Stock'}
                </button>
              )}
              <Link to="/cart" className="btn btn-outline btn-lg" style={{ flex: 1 }} onClick={handleAddToCart}>
                Buy Now
              </Link>
            </div>

            {/* Photo Gallery (Variants + Extra) */}
            {displayImages.length > 1 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Product Photos</div>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
                  {displayImages.map((img, idx) => {
                    const variant = inStockVariants.find((v) => v.image === img);
                    const isSelected = imgIdx === idx;

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setImgIdx(idx);
                          if (variant) {
                            setSelectedVariant(variant);
                            setQty(1);
                          }
                        }}
                        style={{
                          width: 64, height: 78, flexShrink: 0, borderRadius: 8, overflow: 'hidden',
                          border: '2.5px solid', borderColor: isSelected ? 'var(--brown)' : 'var(--border)',
                          padding: 0, background: '#F5EDE2', cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        title={variant ? `Variant: ${variant.size} ${variant.color}` : 'Product View'}
                      >
                        <img src={getImageUrl(img)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { e.target.src = 'https://placehold.co/64x78/FFF2E1/A79277?text=W'; }} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {showTrustTags && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 24px', marginBottom: 24, padding: '16px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                  <AppIcon name="tag" size={16} stroke="var(--brown)" />
                  <span>Lowest Price</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                  <AppIcon name="money" size={16} stroke="var(--brown)" />
                  <span>Cash on Delivery</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                  <AppIcon name="success" size={16} stroke="var(--brown)" />
                  <span>7-day Returns</span>
                </div>
              </div>
            )}

            {showStitchingTags && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 24px', marginBottom: 24, padding: '16px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                  <AppIcon name="box" size={16} stroke="var(--brown)" />
                  <span>Free Delivery</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                  <AppIcon name="error" size={16} stroke="var(--error)" />
                  <span>Not Returnable</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                  <AppIcon name="ruler" size={16} stroke="var(--brown)" />
                  <span>Best Fit</span>
                </div>
              </div>
            )}

            {/* Tags */}
            {product.tags?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {product.tags.map((t) => <span key={t} className="badge badge-cream">{t}</span>)}
              </div>
            )}
          </div>
        </div>

        {/* Product Description */}
        <div style={{ marginTop: 40, marginBottom: 40 }}>
          <h3 className="section-title" style={{ marginBottom: 14 }}>Product Details</h3>
          <div style={{ maxWidth: 700, color: 'var(--text-light)', lineHeight: 1.8 }}>
            {product.description || 'No description available.'}
          </div>
        </div>



        {hasSuggestions && (
          <div style={{ marginTop: 36 }}>
            <h3 className="section-title" style={{ marginBottom: 14 }}>Style with This Item</h3>

            {suggestions.combos.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Suggested Combos
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                  {suggestions.combos.map((combo, idx) => (
                    <div key={`${combo.label}-${idx}`} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: '#fffaf5' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{combo.label}</div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8, fontSize: 12 }}>
                        {combo.products?.map((p) => (
                          <Link key={p._id} to={`/products/${p._id}`} style={{ color: 'var(--brown)', textDecoration: 'none' }}>
                            {p.productName || p.name}
                          </Link>
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <strong style={{ fontSize: 15 }}>{formatPrice(combo.comboPrice || 0)}</strong>
                        {(combo.comboMrp || 0) > (combo.comboPrice || 0) && (
                          <span style={{ fontSize: 12, color: 'var(--text-light)', textDecoration: 'line-through' }}>
                            {formatPrice(combo.comboMrp || 0)}
                          </span>
                        )}
                        {(combo.savings || 0) > 0 && <span className="badge badge-brown">Save {formatPrice(combo.savings)}</span>}
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: 10 }}
                        onClick={() => handleAddComboToCart(combo)}
                      >
                        Add Combo to Cart
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {suggestions.relatedProducts.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Related Products
                </div>
                <div className="suggestion-grid suggestion-grid-related" style={{ display: 'grid', gap: 10 }}>
                  {suggestions.relatedProducts.map((item) => {
                    const { qtyInCart } = getSuggestionCartInfo(item);
                    return (
                      <Link key={item._id} to={`/products/${item._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div className="suggestion-card" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, background: 'var(--white)' }}>
                          <img
                            src={getImageUrl(item.images?.[0])}
                            alt={item.productName || item.name}
                            className="suggestion-image"
                            style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover', borderRadius: 8, marginBottom: 8 }}
                            onError={(e) => { e.target.src = 'https://placehold.co/240x300/FFF2E1/A79277?text=Wellfit'; }}
                          />
                          <div className="suggestion-title" style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{item.productName || item.name}</div>
                          <div className="suggestion-price" style={{ fontSize: 13 }}>{formatPrice(item.price || 0)}</div>
                          {qtyInCart > 0 ? (
                            <div style={{ marginTop: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    updateSuggestedItemQty(item, qtyInCart - 1);
                                  }}
                                  style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}
                                >
                                  -
                                </button>
                                <span style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>{qtyInCart}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    updateSuggestedItemQty(item, qtyInCart + 1);
                                  }}
                                  style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              style={{ marginTop: 8, width: '100%' }}
                              onClick={(e) => {
                                e.preventDefault();
                                addSuggestedProductToCart(item);
                                toast.success('Added to cart!');
                              }}
                            >
                              Add to Cart
                            </button>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {suggestions.accessories.length > 0 && (
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {accessorySuggestionHeading}
                </div>
                <div className="suggestion-grid suggestion-grid-accessories" style={{ display: 'grid', gap: 10 }}>
                  {suggestions.accessories.map((item) => {
                    const { qtyInCart } = getSuggestionCartInfo(item);
                    return (
                      <Link key={item._id} to={`/products/${item._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div className="suggestion-card" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, background: 'var(--white)' }}>
                          <img
                            src={getImageUrl(item.images?.[0])}
                            alt={item.productName || item.name}
                            className="suggestion-image"
                            style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 8, marginBottom: 8 }}
                            onError={(e) => { e.target.src = 'https://placehold.co/200x200/FFF2E1/A79277?text=Wellfit'; }}
                          />
                          <div className="suggestion-title" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{item.productName || item.name}</div>
                          <div className="suggestion-price" style={{ fontSize: 12 }}>{formatPrice(item.price || 0)}</div>
                          {qtyInCart > 0 ? (
                            <div style={{ marginTop: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    updateSuggestedItemQty(item, qtyInCart - 1);
                                  }}
                                  style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}
                                >
                                  -
                                </button>
                                <span style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>{qtyInCart}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    updateSuggestedItemQty(item, qtyInCart + 1);
                                  }}
                                  style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              style={{ marginTop: 8, width: '100%' }}
                              onClick={(e) => {
                                e.preventDefault();
                                addSuggestedProductToCart(item);
                                toast.success('Added to cart!');
                              }}
                            >
                              Add to Cart
                            </button>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reviews Section */}
        <div style={{ marginTop: 48, paddingTop: 48, borderTop: '1px solid var(--border)' }}>
          <h3 className="section-title" style={{ marginBottom: 24 }}>Customer Reviews ({reviews.length})</h3>

          <div style={{ display: 'grid', gridTemplateColumns: reviews.length > 0 ? '1fr 2fr' : '1fr', gap: 48 }}>
            {/* Left: Form */}
            <div>
              {user && !hasReviewed ? (
                <div className="card" style={{ position: 'sticky', top: 100 }}>
                  <h4 style={{ marginBottom: 14 }}>Write a Review</h4>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => setReviewForm((f) => ({ ...f, rating: n }))}
                        style={{ fontSize: 22, background: 'none', border: 'none', cursor: 'pointer', color: n <= reviewForm.rating ? '#D4AC0D' : '#ddd' }}>★</button>
                    ))}
                  </div>
                  <textarea className="form-textarea" value={reviewForm.comment} onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))} placeholder="Share your experience…" style={{ marginBottom: 12 }} />
                  <button className="btn btn-primary btn-sm" onClick={handleReviewSubmit} disabled={submitting}>
                    {submitting ? 'Submitting…' : 'Submit Review'}
                  </button>
                </div>
              ) : user && hasReviewed ? (
                <div className="alert alert-info">
                  <div style={{ marginBottom: 12 }}>You have already reviewed this product.</div>
                  {reviews.filter(r => {
                    const cid = (r.customer?._id || r.customer)?.toString();
                    const uid = user?._id?.toString();
                    return uid && cid === uid;
                  }).map(r => (
                    <div key={r._id} style={{ background: 'rgba(255,255,255,0.5)', padding: 12, borderRadius: 8, fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <StarRating rating={r.rating} size={12} />
                        <button 
                          onClick={() => handleDeleteReview(r._id)}
                          style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                        >
                          Remove
                        </button>
                      </div>
                      <p style={{ margin: 0, fontStyle: 'italic', color: 'var(--text)' }}>"{r.comment}"</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="alert alert-info">Login to write a review.</div>
              )}
            </div>

            {/* Right: List & Filters */}
            <div>
              {reviews.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                  {[
                    { id: null, label: 'All' },
                    { id: 'recent', label: 'Most Recent' },
                    { id: '5', label: '5 Star' },
                    { id: '4', label: '4 Star' },
                    { id: '3', label: '3 Star' },
                    { id: 'negative', label: 'Negative (1 & 2 Star)' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setReviewFilter(f.id)}
                      style={{
                        padding: '8px 16px',
                        fontSize: 13,
                        borderRadius: 24,
                        border: '1.5px solid',
                        borderColor: reviewFilter === f.id ? 'var(--brown)' : 'var(--border)',
                        background: reviewFilter === f.id ? 'var(--brown)' : 'transparent',
                        color: reviewFilter === f.id ? '#fff' : 'var(--text-light)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontWeight: 500
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}

              {filteredReviews.length === 0 ? (
                <p style={{ color: 'var(--text-light)', padding: '20px 0' }}>
                  {reviews.length === 0 ? 'No reviews yet. Be the first to share your experience!' : 'No reviews match this filter.'}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {filteredReviews.map((r) => (
                    <div key={r._id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 24 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <strong style={{ fontSize: 15, display: 'block', marginBottom: 2 }}>{r.customer?.name || 'Customer'}</strong>
                          <StarRating rating={r.rating} size={14} />
                        </div>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-light)' }}>{formatDate(r.createdAt)}</span>
                          {user && (r.customer?._id === user._id || r.customer === user._id) && (
                            <button
                              onClick={() => handleDeleteReview(r._id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--error)',
                                fontSize: 12,
                                cursor: 'pointer',
                                padding: 0,
                                fontWeight: 500
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                      <p style={{ fontSize: 14, color: 'var(--text-light)', lineHeight: 1.6 }}>{r.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .suggestion-grid-related {
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        }
        .suggestion-grid-accessories {
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        }
        @media(max-width:700px){
          .container>div:nth-child(2){grid-template-columns:1fr!important}
        }
        @media (max-width: 700px) {
          .suggestion-grid-related,
          .suggestion-grid-accessories {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 9px !important;
          }
          .suggestion-card {
            border-radius: var(--radius-lg) !important;
            padding: 8px 9px 10px !important;
          }
          .suggestion-image {
            aspect-ratio: 1 / 1 !important;
            border-radius: 8px !important;
            margin-bottom: 8px !important;
          }
          .suggestion-title {
            font-size: 12px !important;
            line-height: 1.25 !important;
            min-height: 2.5em;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .suggestion-price {
            font-family: var(--font-display);
            font-size: 13px !important;
            font-weight: 600;
          }
        }
      `}</style>
    </div>
  );
}
