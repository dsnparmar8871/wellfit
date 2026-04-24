import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { productAPI, reviewAPI } from '../../api/index.js';
import { formatDate, getErrorMsg, getImageUrl, getProductMainImage } from '../../utils/helpers.js';
import { useToast } from '../../context/ToastContext.jsx';
import PageSkeleton from '../../components/ui/PageSkeleton.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';

const REVIEW_LIMIT = 12;

export default function AdminProductDetail() {
  const { id } = useParams();
  const toast = useToast();

  const [product, setProduct] = useState(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);

  const [reviews, setReviews] = useState([]);
  const [totalReviews, setTotalReviews] = useState(0);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [rating, setRating] = useState('');
  const [pinned, setPinned] = useState('');
  const [sort, setSort] = useState('latest');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [addingReview, setAddingReview] = useState(false);
  const [busyReviewId, setBusyReviewId] = useState('');
  const [deleteId, setDeleteId] = useState('');

  const reviewParams = useMemo(() => {
    const params = { page, limit: REVIEW_LIMIT, sort };
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    if (rating) params.rating = rating;
    if (pinned) params.pinned = pinned;
    return params;
  }, [page, pinned, rating, debouncedSearch, sort]);

  const loadProduct = async () => {
    setLoadingProduct(true);
    try {
      const { data } = await productAPI.getById(id);
      const productData = data?.data?.product || data?.data;
      setProduct(productData || null);
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setLoadingProduct(false);
    }
  };

  const loadReviews = async () => {
    setLoadingReviews(true);
    try {
      const { data } = await reviewAPI.getProductReviewsForAdmin(id, reviewParams);
      const list = Array.isArray(data?.data) ? data.data : [];
      setReviews(list);
      setTotalReviews(data?.pagination?.total || list.length || 0);
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    loadProduct();
  }, [id]);

  useEffect(() => {
    loadReviews();
  }, [id, reviewParams]);

  const togglePin = async (review) => {
    setBusyReviewId(review._id);
    try {
      if (review.isPinned) {
        await reviewAPI.unpinReview(review._id);
        toast.success('Review unpinned');
      } else {
        await reviewAPI.pinReview(review._id);
        toast.success('Top review updated');
      }
      await loadReviews();
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setBusyReviewId('');
    }
  };

  const deleteReview = async () => {
    if (!deleteId) return;

    setBusyReviewId(deleteId);
    try {
      await reviewAPI.deleteReview(deleteId);
      toast.success('Review deleted');
      setDeleteId('');
      await Promise.all([loadReviews(), loadProduct()]);
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setBusyReviewId('');
    }
  };

  if (loadingProduct) return <PageSkeleton variant="detail" />;
  if (!product) return <div className="alert alert-error">Product not found.</div>;

  const displayImage = getProductMainImage(product);
  const placeholderText = encodeURIComponent((product.productName || product.name || 'Product').slice(0, 10));
  const placeholder = `https://placehold.co/400x500/FFF2E1/A79277?text=${placeholderText}`;

  return (
    <div>
      <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <Link to="/admin/products" className="btn btn-outline btn-sm">Back to Products</Link>
        <Link to={`/admin/products/edit/${id}`} className="btn btn-primary btn-sm">Edit Product</Link>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <img
            src={getImageUrl(displayImage)}
            alt={product.productName || product.name}
            style={{ width: 72, height: 88, borderRadius: 10, objectFit: 'cover', background: '#f7eee3' }}
            onError={(e) => { e.target.src = placeholder; }}
          />
          <div style={{ flex: 1, minWidth: 220 }}>
            <h2 style={{ marginBottom: 8 }}>{product.productName || product.name}</h2>
            <div style={{ fontSize: 13, color: 'var(--text-light)' }}>
              {[product.mainCategory, product.subCategory, product.itemCategory].filter(Boolean).join(' / ')}
            </div>
            <div style={{ marginTop: 8, fontSize: 13 }}>
              Rating: <strong>{Number(product.avgRating || 0).toFixed(1)}</strong> | Reviews: <strong>{product.totalReviews || 0}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 12 }}>Add Review</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: 10 }}>
          <select
            className="form-select"
            value={reviewForm.rating}
            onChange={(e) => setReviewForm((prev) => ({ ...prev, rating: Number(e.target.value) }))}
          >
            {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} Star</option>)}
          </select>
          <input
            className="form-input"
            value={reviewForm.comment}
            onChange={(e) => setReviewForm((prev) => ({ ...prev, comment: e.target.value }))}
            placeholder="Write a review comment"
          />
          <button className="btn btn-primary btn-sm" onClick={addReview} disabled={addingReview}>
            {addingReview ? 'Adding...' : 'Add Review'}
          </button>
        </div>
      </div> */}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
          <h3 style={{ marginBottom: 0 }}>Reviews ({totalReviews})</h3>
          <div style={{ fontSize: 12, color: 'var(--text-light)' }}>Pinned review appears first to customers</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
          <input
            className="form-input"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name or comment..."
          />

          <select className="form-select" value={rating} onChange={(e) => { setRating(e.target.value); setPage(1); }}>
            <option value="">All Ratings</option>
            {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} Star</option>)}
          </select>

          <select className="form-select" value={pinned} onChange={(e) => { setPinned(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="true">Pinned only</option>
            <option value="false">Not pinned</option>
          </select>

          <select className="form-select" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="latest">Latest</option>
            <option value="oldest">Oldest</option>
            <option value="highest-rating">Highest Rating</option>
            <option value="lowest-rating">Lowest Rating</option>
          </select>
        </div>

        {loadingReviews ? <PageSkeleton variant="table" /> : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Reviewer</th>
                    <th>Rating</th>
                    <th>Comment</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((review) => (
                    <tr key={review._id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{review.customer?.name || 'Customer'}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{review.customer?.email || ''}</div>
                      </td>
                      <td>{review.rating} / 5</td>
                      <td style={{ maxWidth: 420 }}>{review.comment || '-'}</td>
                      <td>
                        <div>{formatDate(review.createdAt)}</div>
                        {review.isPinned && <span className="badge badge-brown" style={{ marginTop: 6 }}>Pinned</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-outline btn-sm"
                            disabled={busyReviewId === review._id}
                            onClick={() => togglePin(review)}
                          >
                            {review.isPinned ? 'Unpin' : 'Pin Top'}
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--error)' }}
                            disabled={busyReviewId === review._id}
                            onClick={() => setDeleteId(review._id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {reviews.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-light)' }}>No reviews found for current filters.</div>
            )}

            <Pagination page={page} total={totalReviews} limit={REVIEW_LIMIT} onChange={setPage} />
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId('')}
        onConfirm={deleteReview}
        loading={busyReviewId === deleteId}
        title="Delete Review"
        message="Are you sure you want to delete this review?"
      />
    </div>
  );
}
