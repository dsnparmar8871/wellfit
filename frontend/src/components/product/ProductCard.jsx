import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useFavorites } from '../../context/FavoritesContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { formatPrice, getImageUrl } from '../../utils/helpers.js';
import AppIcon from '../ui/AppIcon.jsx';

export default function ProductCard({ product }) {
  const { items, addItem, updateQty } = useCart();
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const toast = useToast();
  const navigate = useNavigate();

  const variants = Array.isArray(product.variants) ? product.variants : [];
  const firstInStockVariant = variants.find((v) => Number(v?.stock || 0) > 0);
  const outOfStockVariantImageSet = new Set(
    variants
      .filter((v) => Number(v?.stock || 0) <= 0)
      .map((v) => v?.image)
      .filter(Boolean)
  );
  const safeProductImages = (Array.isArray(product.images) ? product.images : []).filter(
    (img) => Boolean(img) && !outOfStockVariantImageSet.has(img)
  );
  const defaultVariant = firstInStockVariant || variants[0];
  const hasVariantStock = variants.some((v) => Number(v?.stock || 0) > 0);
  const inStock = variants.length > 0 ? hasVariantStock : Number(product.totalStock || 0) > 0;
  const primaryImage = firstInStockVariant?.image || safeProductImages[0] || product.images?.[0];
  const categoryLabel = [product.mainCategory, product.subCategory, product.itemCategory].filter(Boolean).join(' / ');
  const cardPrice = Number(defaultVariant?.price ?? product.price ?? 0);
  const cardMrp = Number(defaultVariant?.mrp ?? product.mrp ?? cardPrice);
  const inCartQty = items.find(
    (item) => item.productId === product._id && item.variantId === defaultVariant?._id
  )?.qty || 0;
  const favorite = isFavorite(product._id);

  const handleAddToCart = (e) => {
    e.preventDefault();
    if (!inStock || !defaultVariant?._id) return;
    const result = addItem({
      productId: product._id,
      variantId: defaultVariant?._id,
      name: product.productName || product.name,
      price: cardPrice,
      mrp: Math.max(cardMrp, cardPrice),
      image: primaryImage,
      size: defaultVariant?.size,
      color: defaultVariant?.color,
      maxStock: Number(defaultVariant?.stock ?? product.totalStock ?? 0),
      isStitching: product.isStitchingAvailable || false,
      qty: 1,
    });
    if (result?.limited) {
      toast.error('Out of stock');
      return;
    }
    toast.success('Added to cart!');
  };

  const handleIncreaseQty = (e) => {
    e.preventDefault();
    if (!defaultVariant?._id) return;
    const result = updateQty(product._id, defaultVariant._id, inCartQty + 1);
    if (result?.limited) toast.error('Out of stock');
  };

  const handleDecreaseQty = (e) => {
    e.preventDefault();
    if (!defaultVariant?._id) return;
    updateQty(product._id, defaultVariant._id, Math.max(0, inCartQty - 1));
  };

  const handleToggleFavorite = (e) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please login to use favorites');
      navigate('/login');
      return;
    }
    const result = toggleFavorite(product);
    if (result?.changed) {
      toast.info(result.isFavorite ? 'Added to favorites' : 'Removed from favorites');
    }
  };

  return (
    <Link to={`/products/${product._id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        transition: 'box-shadow 0.2s, transform 0.2s',
        cursor: 'pointer',
      }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = ''; }}
      >
        {/* Image */}
        <div style={{ position: 'relative', aspectRatio: '1/1', overflow: 'hidden', background: '#F5EDE2' }}>
          <img
            src={getImageUrl(primaryImage)}
            alt={product.productName || product.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { e.target.src = 'https://placehold.co/300x400/FFF2E1/A79277?text=Wellfit'; }}
          />
          {!inStock && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(255,242,225,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="badge badge-grey" style={{ fontSize: 12 }}>Out of Stock</span>
            </div>
          )}
          {cardMrp > cardPrice && (
            <div style={{ position: 'absolute', top: 6, left: 6 }}>
              <span className="badge badge-brown" style={{ fontSize: 8, padding: '2px 6px' }}>
                {Math.round(((cardMrp - cardPrice) / cardMrp) * 100)}% OFF
              </span>
            </div>
          )}
          <button
            type="button"
            title={favorite ? 'Remove favorite' : 'Add favorite'}
            onClick={handleToggleFavorite}
            style={{
              position: 'absolute', top: 6, right: 6,
              width: 26, height: 26, borderRadius: '50%', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.92)', color: favorite ? '#C0392B' : 'var(--text)',
              cursor: 'pointer',
            }}
          >
            <AppIcon name="heart" size={13} stroke={favorite ? '#C0392B' : 'currentColor'} />
          </button>
        </div>

        {/* Info */}
        <div style={{ padding: '8px 9px 10px' }}>
          <div style={{ fontSize: 9, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
            {product.itemCategory || categoryLabel}
          </div>
          <h4
            style={{
              fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, marginBottom: 5,
              lineHeight: 1.25, color: 'var(--text)', display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: '2.5em',
            }}
          >
            {product.productName || product.name}
          </h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>
              {formatPrice(cardPrice)}
            </span>
            {cardMrp > cardPrice && (
              <span style={{ fontSize: 10, color: 'var(--text-light)', textDecoration: 'line-through' }}>
                {formatPrice(cardMrp)}
              </span>
            )}
          </div>
          {inCartQty > 0 && inStock ? (
            <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={handleDecreaseQty}
                style={{ width: 30, height: 30, border: 'none', background: 'none', cursor: 'pointer', fontSize: 15 }}
              >
                -
              </button>
              <span style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 600 }}>{inCartQty}</span>
              <button
                type="button"
                onClick={handleIncreaseQty}
                style={{ width: 30, height: 30, border: 'none', background: 'none', cursor: 'pointer', fontSize: 15 }}
              >
                +
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!inStock}
              className="btn btn-primary btn-sm btn-full"
            >
              {inStock ? '+ Add to Cart' : 'Out of Stock'}
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
