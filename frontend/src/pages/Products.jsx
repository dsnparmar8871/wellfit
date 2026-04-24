import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { productAPI, categoryAPI } from '../api/index.js';
import { buildCategoryStructure } from '../utils/categories.js';
import ProductCard from '../components/product/ProductCard.jsx';
import ProductFilters from '../components/product/ProductFilters.jsx';
import PageSkeleton from '../components/ui/PageSkeleton.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { hasPurchasableStock } from '../utils/helpers.js';

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const isFromURL = useRef(false);
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') || '');

  const [filters, setFilters] = useState({
    mainCategory: searchParams.get('mainCategory') || '',
    subCategory: searchParams.get('subCategory') || '',
    itemCategory: searchParams.get('itemCategory') || '',
    search: searchParams.get('search') || '',
    priceRange: '',
    size: '',
    page: 1,
  });

  // Fetch categories from backend on component mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data } = await categoryAPI.getAll();
        const categories = data?.data?.categories || data?.categories || [];
        if (Array.isArray(categories) && categories.length > 0) {
          buildCategoryStructure(categories);
        }
      } catch (err) {
        console.warn('Failed to load categories from backend, using defaults', err);
      } finally {
        setCategoriesLoaded(true);
      }
    };
    fetchCategories();
  }, []);

  // Sync filters when URL changes (from navbar navigation)
  useEffect(() => {
    const mainCat = searchParams.get('mainCategory') || '';
    const subCat = searchParams.get('subCategory') || '';
    const itemCat = searchParams.get('itemCategory') || '';
    const search = searchParams.get('search') || '';
    
    isFromURL.current = true;
    setFilters((prev) => ({
      ...prev,
      mainCategory: mainCat,
      subCategory: subCat,
      itemCategory: itemCat,
      search: search,
      page: 1,
    }));
    setDebouncedSearch(search);
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 350);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const params = { page: filters.page, limit: 12 };
    if (filters.mainCategory) params.mainCategory = filters.mainCategory;
    if (filters.subCategory) params.subCategory = filters.subCategory;
    if (filters.itemCategory) params.itemCategory = filters.itemCategory;
    if (debouncedSearch) params.search = debouncedSearch;
    if (filters.size) params.size = filters.size;
    if (filters.priceRange) {
      const [min, max] = filters.priceRange.split('-');
      if (min) params.minPrice = min;
      if (max) params.maxPrice = max;
    }
    try {
      const { data } = await productAPI.getAll(params);
      const list = Array.isArray(data.data) ? data.data : (data.data?.products || []);
      const filteredList = list.filter(hasPurchasableStock);
      setProducts(filteredList);
      setTotal(data.pagination?.total || data.data?.total || filteredList.length || 0);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.mainCategory, filters.subCategory, filters.itemCategory, filters.size, filters.priceRange, debouncedSearch]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Only sync filters TO URL when they change from user interaction, not from URL navigation
  useEffect(() => {
    if (isFromURL.current) {
      isFromURL.current = false;
      return;
    }
    
    const params = {};
    if (filters.mainCategory) params.mainCategory = filters.mainCategory;
    if (filters.subCategory) params.subCategory = filters.subCategory;
    if (filters.itemCategory) params.itemCategory = filters.itemCategory;
    if (debouncedSearch) params.search = debouncedSearch;
    setSearchParams(params);
  }, [filters.mainCategory, filters.subCategory, filters.itemCategory, debouncedSearch, setSearchParams]);

  const handleFilterChange = (newFilters) => {
    isFromURL.current = false;
    setFilters(newFilters);
  };

  return (
    <div className="page">
      <div className="container">
        {/* Search bar */}
        <div style={{ marginBottom: 24 }}>
          <div className="search-bar" style={{ maxWidth: 480 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
              placeholder="Search products…"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'start' }}>
          <ProductFilters filters={filters} onChange={handleFilterChange} />

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 className="section-title" style={{ marginBottom: 0, fontSize: '1.2rem' }}>
                {filters.mainCategory || filters.search ? filters.search || filters.mainCategory : 'All Products'}
              </h2>
              {!loading && <span style={{ fontSize: 13, color: 'var(--text-light)' }}>{total} items</span>}
            </div>

            {loading ? (
              <PageSkeleton variant="grid" />
            ) : products.length === 0 ? (
              <EmptyState 
                icon="search" 
                title={filters.search ? "Product not available" : "No products found"} 
                description="Try adjusting your filters or search term." 
              />
            ) : (
              <>
                <div className="grid-3 product-grid-compact">
                  {products.map((p) => <ProductCard key={p._id} product={p} />)}
                </div>
                <Pagination page={filters.page} total={total} limit={12} onChange={(p) => setFilters((f) => ({ ...f, page: p }))} />
              </>
            )}
          </div>
        </div>
      </div>
      <style>{`
        .product-grid-compact {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }
        @media (max-width: 1200px) {
          .product-grid-compact {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 900px) {
          .container > div:last-child { grid-template-columns: 1fr !important; }
          .product-grid-compact {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
          }
        }
        @media (max-width: 640px) {
          .product-grid-compact {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 9px;
          }
        }
      `}</style>
    </div>
  );
}
