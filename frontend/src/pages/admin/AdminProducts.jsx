import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { categoryAPI, productAPI } from '../../api/index.js';
import { formatPrice, getImageUrl, getErrorMsg, truncate } from '../../utils/helpers.js';
import PageSkeleton from '../../components/ui/PageSkeleton.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import {
  MAIN_CATEGORIES,
  buildCategoryStructure,
  getMainCategories,
  getSubCategories,
  getItemCategories,
} from '../../config/categories.js';

const getVariantPriceSummary = (product) => {
  const variantPrices = (product.variants || [])
    .map((variant) => Number(variant?.price))
    .filter((price) => Number.isFinite(price) && price >= 0);

  if (!variantPrices.length) {
    const fallback = Number(product.price || 0);
    return {
      label: formatPrice(fallback),
      helper: '',
    };
  }

  const min = Math.min(...variantPrices);
  const max = Math.max(...variantPrices);

  if (min === max) {
    return {
      label: formatPrice(min),
      helper: `${variantPrices.length} variant${variantPrices.length > 1 ? 's' : ''}`,
    };
  }

  return {
    label: `${formatPrice(min)} - ${formatPrice(max)}`,
    helper: `${variantPrices.length} variant prices`,
  };
};

export default function AdminProducts() {
  const toast = useToast();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [mainCategory, setMainCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [mainCategoryOptions, setMainCategoryOptions] = useState(MAIN_CATEGORIES);
  const [delId, setDelId] = useState(null);
  const [delLoading, setDelLoading] = useState(false);

  const subCategoryOptions = getSubCategories(mainCategory);
  const itemCategoryOptions = getItemCategories(mainCategory, subCategory);

  const load = () => {
    setLoading(true);
    const params = { page, limit: 12 };
    if (debouncedSearch) params.search = debouncedSearch;
    if (mainCategory) params.mainCategory = mainCategory;
    if (subCategory) params.subCategory = subCategory;
    if (itemCategory) params.itemCategory = itemCategory;

    productAPI.getAll(params)
      .then(({ data }) => {
        const list = Array.isArray(data.data) ? data.data : (data.data?.products || []);
        setProducts(list);
        setTotal(data.pagination?.total || data.data?.total || list.length || 0);
      })
      .catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const { data } = await categoryAPI.getAll();
        const categories = data?.data?.categories || data?.categories || [];
        if (Array.isArray(categories) && categories.length > 0) {
          buildCategoryStructure(categories);
          const dynamicMainCategories = getMainCategories();
          setMainCategoryOptions(dynamicMainCategories.length ? dynamicMainCategories : MAIN_CATEGORIES);
          return;
        }
      } catch (_) {
        // Fall back to default static category options.
      }
      setMainCategoryOptions(MAIN_CATEGORIES);
    };

    loadCategories();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { load(); }, [page, debouncedSearch, mainCategory, subCategory, itemCategory]);

  const handleMainCategoryChange = (value) => {
    setMainCategory(value);
    setSubCategory('');
    setItemCategory('');
    setPage(1);
  };

  const handleSubCategoryChange = (value) => {
    setSubCategory(value);
    setItemCategory('');
    setPage(1);
  };

  const handleDelete = async () => {
    setDelLoading(true);
    try {
      await productAPI.delete(delId);
      toast.success('Product deleted');
      setDelId(null); load();
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setDelLoading(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: 0 }}>Products</h1>
        <Link to="/admin/products/new" className="btn btn-primary btn-sm">+ Add Product</Link>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 10 }}>
          <input
            className="form-input"
            placeholder="Search by product, description or item..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />

          <select className="form-select" value={mainCategory} onChange={(e) => handleMainCategoryChange(e.target.value)}>
            <option value="">All Main Categories</option>
            {mainCategoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>

          <select className="form-select" value={subCategory} onChange={(e) => handleSubCategoryChange(e.target.value)} disabled={mainCategory !== 'Clothes'}>
            <option value="">All Sub-Categories</option>
            {subCategoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>

          <select
            className="form-select"
            value={itemCategory}
            onChange={(e) => { setItemCategory(e.target.value); setPage(1); }}
            disabled={!mainCategory || (mainCategory === 'Clothes' && !subCategory)}
          >
            <option value="">All Item Categories</option>
            {itemCategoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
      </div>

      {loading ? <PageSkeleton variant="table" /> : (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Actions</th></tr></thead>
              <tbody>
                {products.map((p) => {
                  const priceSummary = getVariantPriceSummary(p);
                  const firstVariantImage = p.variants?.find((v) => v.image)?.image;
                  const firstExtraImage = p.images?.[0];
                  const displayImage = firstVariantImage || firstExtraImage;
                  const placeholderText = encodeURIComponent((p.productName || p.name || 'Product').slice(0, 10));
                  const placeholder = `https://placehold.co/400x500/FFF2E1/A79277?text=${placeholderText}`;

                  return (
                  <tr key={p._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <img 
                          src={getImageUrl(displayImage)} 
                          alt={p.name} 
                          style={{ width: 40, height: 48, objectFit: 'cover', borderRadius: 6, background: '#F5EDE2' }}
                          onError={(e) => { e.target.src = placeholder; }} 
                        />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{truncate(p.productName || p.name, 40)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{p.itemCategory || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td>{[p.mainCategory, p.subCategory].filter(Boolean).join(' / ') || p.mainCategory || '—'}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{priceSummary.label}</div>
                      {priceSummary.helper && (
                        <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{priceSummary.helper}</div>
                      )}
                    </td>
                    <td>
                      {p.variants?.reduce((s, v) => s + v.stock, 0) || 0}
                      {p.variants?.some((v) => v.stock <= 5) && <span className="badge badge-warning" style={{ marginLeft: 6, fontSize: 9 }}>Low</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/admin/products/${p._id}`)}>View</button>
                        <button className="btn btn-outline btn-sm" onClick={() => navigate(`/admin/products/edit/${p._id}`)}>Edit</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }} onClick={() => setDelId(p._id)}>Del</button>
                      </div>
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
          {products.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-light)' }}>
              {search ? "Product not available." : "No products found."}
            </div>
          )}
          <Pagination page={page} total={total} limit={12} onChange={setPage} />
        </>
      )}

      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={handleDelete} loading={delLoading}
        title="Delete Product" message="Are you sure you want to delete this product? This action cannot be undone." />
    </div>
  );
}
