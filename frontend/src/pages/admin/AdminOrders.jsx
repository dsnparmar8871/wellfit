import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { orderAPI, productAPI } from '../../api/index.js';
import { formatPrice, formatDate, getErrorMsg } from '../../utils/helpers.js';
import PageSkeleton from '../../components/ui/PageSkeleton.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const STATUSES = ['', 'received', 'tailoring', 'processing', 'ready', 'delivered', 'cancelled'];
const PAYMENT_METHODS = ['COD', 'UPI', 'credit_card', 'debit_card'];
const PAYMENT_STATUSES = ['paid', 'pending'];

const EMPTY_OFFLINE_FORM = {
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  line1: 'Offline Shop Counter',
  city: 'Ahmedabad',
  state: 'Gujarat',
  pincode: '382415',
  paymentMethod: 'COD',
  paymentStatus: 'paid',
  status: 'received',
  notes: '',
  items: [{ product: '', qty: 1, price: '' }],
};

export default function AdminOrders() {
  const toast = useToast();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [savingOffline, setSavingOffline] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [offlineForm, setOfflineForm] = useState(EMPTY_OFFLINE_FORM);
  const [productSearch, setProductSearch] = useState('');
  const [productMainFilter, setProductMainFilter] = useState('');
  const [productSubFilter, setProductSubFilter] = useState('');
  const [productItemFilter, setProductItemFilter] = useState('');
  const searchInputRef = useRef(null);
  const keepSearchFocusRef = useRef(false);

  const mainCategoryOptions = useMemo(() => {
    const unique = [...new Set(products.map((p) => p?.mainCategory).filter(Boolean))];
    return unique.sort((a, b) => a.localeCompare(b));
  }, [products]);

  const subCategoryOptions = useMemo(() => {
    const unique = [...new Set(
      products
        .filter((p) => !productMainFilter || p?.mainCategory === productMainFilter)
        .map((p) => p?.subCategory)
        .filter(Boolean)
    )];
    return unique.sort((a, b) => a.localeCompare(b));
  }, [products, productMainFilter]);

  const itemCategoryOptions = useMemo(() => {
    const unique = [...new Set(
      products
        .filter((p) => !productMainFilter || p?.mainCategory === productMainFilter)
        .filter((p) => !productSubFilter || p?.subCategory === productSubFilter)
        .map((p) => p?.itemCategory)
        .filter(Boolean)
    )];
    return unique.sort((a, b) => a.localeCompare(b));
  }, [products, productMainFilter, productSubFilter]);

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return products.filter((p) => {
      if (productMainFilter && p?.mainCategory !== productMainFilter) return false;
      if (productSubFilter && p?.subCategory !== productSubFilter) return false;
      if (productItemFilter && p?.itemCategory !== productItemFilter) return false;

      if (!query) return true;

      const name = String(p?.name || p?.productName || '').toLowerCase();
      const description = String(p?.description || '').toLowerCase();
      const itemCategory = String(p?.itemCategory || '').toLowerCase();

      return name.includes(query) || description.includes(query) || itemCategory.includes(query);
    });
  }, [products, productSearch, productMainFilter, productSubFilter, productItemFilter]);

  const productLabelMap = useMemo(() => {
    return products.reduce((acc, p) => {
      if (!p?._id) return acc;
      acc[p._id] = p?.name || p?.productName || 'Product';
      return acc;
    }, {});
  }, [products]);

  const load = () => {
    setLoading(true);
    const params = { page, limit: 15 };
    if (statusFilter) params.status = statusFilter;
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    orderAPI.getAll(params)
      .then(({ data }) => {
        const list = Array.isArray(data.data) ? data.data : (data.data?.orders || []);
        setOrders(list);
        setTotal(data.pagination?.total || data.data?.total || list.length || 0);
      })
      .catch(() => { })
      .finally(() => {
        setLoading(false);
        if (keepSearchFocusRef.current && searchInputRef.current) {
          requestAnimationFrame(() => {
            searchInputRef.current?.focus();
            const valueLength = searchInputRef.current?.value?.length || 0;
            searchInputRef.current?.setSelectionRange(valueLength, valueLength);
          });
        }
      });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { load(); }, [page, statusFilter, debouncedSearch]);

  const loadProducts = async () => {
    if (products.length > 0) return;
    setLoadingProducts(true);
    try {
      const { data } = await productAPI.getAll({ page: 1, limit: 200 });
      const list = Array.isArray(data.data) ? data.data : (data.data?.products || []);
      setProducts(list.filter((p) => p?._id));
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setLoadingProducts(false);
    }
  };

  const openOfflineOrderForm = async () => {
    await loadProducts();
    setProductSearch('');
    setProductMainFilter('');
    setProductSubFilter('');
    setProductItemFilter('');
    setShowOfflineModal(true);
  };

  const updateOfflineField = (field, value) => {
    setOfflineForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateItem = (index, key, value) => {
    setOfflineForm((prev) => {
      const items = [...prev.items];
      const current = { ...items[index], [key]: value };

      if (key === 'product') {
        const product = products.find((p) => p._id === value);
        if (product && !current.price) current.price = product.price;
      }

      items[index] = current;
      return { ...prev, items };
    });
  };

  const addProductToOfflineOrder = (product) => {
    if (!product?._id) return;
    const unitPrice = Number(product.price || 0);

    setOfflineForm((prev) => {
      const existingIndex = prev.items.findIndex((item) => item.product === product._id);
      if (existingIndex >= 0) {
        const nextItems = [...prev.items];
        const existingItem = nextItems[existingIndex];
        nextItems[existingIndex] = {
          ...existingItem,
          qty: Number(existingItem.qty || 0) + 1,
          price: existingItem.price === '' ? unitPrice : existingItem.price,
        };
        return { ...prev, items: nextItems };
      }

      const emptyIndex = prev.items.findIndex((item) => !item.product);
      if (emptyIndex >= 0) {
        const nextItems = [...prev.items];
        nextItems[emptyIndex] = {
          product: product._id,
          qty: 1,
          price: unitPrice,
        };
        return { ...prev, items: nextItems };
      }

      return {
        ...prev,
        items: [...prev.items, { product: product._id, qty: 1, price: unitPrice }],
      };
    });
  };

  const addItemRow = () => {
    setOfflineForm((prev) => ({ ...prev, items: [...prev.items, { product: '', qty: 1, price: '' }] }));
  };

  const removeItemRow = (index) => {
    setOfflineForm((prev) => {
      const items = prev.items.filter((_, i) => i !== index);
      return { ...prev, items: items.length > 0 ? items : [{ product: '', qty: 1, price: '' }] };
    });
  };

  const computedSubtotal = offlineForm.items.reduce((sum, item) => {
    const qty = Number(item.qty || 0);
    const price = Number(item.price || 0);
    if (Number.isNaN(qty) || Number.isNaN(price)) return sum;
    return sum + qty * price;
  }, 0);

  const saveOfflineOrder = async () => {
    if (!offlineForm.customerName.trim()) {
      toast.error('Customer name is required');
      return;
    }

    const normalizedItems = offlineForm.items
      .map((item) => ({
        product: item.product,
        qty: Number(item.qty),
        price: Number(item.price),
      }))
      .filter((item) => item.product && item.qty > 0 && item.price >= 0);

    if (normalizedItems.length === 0) {
      toast.error('Add at least one valid item');
      return;
    }

    setSavingOffline(true);
    try {
      await orderAPI.createOffline({
        customer: {
          name: offlineForm.customerName.trim(),
          email: offlineForm.customerEmail.trim(),
          phone: offlineForm.customerPhone.trim(),
        },
        items: normalizedItems,
        shippingAddress: {
          line1: offlineForm.line1.trim() || 'Offline Shop Counter',
          city: offlineForm.city.trim() || 'Ahmedabad',
          state: offlineForm.state.trim() || 'Gujarat',
          pincode: offlineForm.pincode.trim() || '382415',
        },
        paymentMethod: offlineForm.paymentMethod,
        paymentStatus: offlineForm.paymentStatus,
        status: offlineForm.status,
        notes: offlineForm.notes.trim(),
        isPickup: true,
      });

      toast.success('Offline order created');
      setShowOfflineModal(false);
      setOfflineForm(EMPTY_OFFLINE_FORM);
      setPage(1);
      load();
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setSavingOffline(false);
    }
  };

  const exportCSV = async () => {
    try {
      const { data } = await orderAPI.exportCSV();
      const url = URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a'); a.href = url; a.download = 'orders.csv'; a.click();
    } catch (err) { toast.error(getErrorMsg(err)); }
  };

  const printInvoice = async (orderId) => {
    try {
      const { data } = await orderAPI.downloadInvoice(orderId);
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
      const printWindow = window.open(url, '_blank');
      if (!printWindow) {
        URL.revokeObjectURL(url);
        toast.error('Popup blocked. Please allow popups to print invoice.');
        return;
      }

      printWindow.addEventListener('load', () => {
        printWindow.focus();
        printWindow.print();
      });

      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      toast.error(getErrorMsg(err));
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: 0 }}>Orders</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={openOfflineOrderForm}>+ Add Offline Order</button>
          <button className="btn btn-outline btn-sm" onClick={exportCSV}>📤 Export CSV</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 12 }}>
        <input
          ref={searchInputRef}
          className="form-input"
          style={{ maxWidth: 420 }}
          placeholder="Search by Order ID, Customer Name, or Email"
          value={search}
          onFocus={() => { keepSearchFocusRef.current = true; }}
          onBlur={() => { keepSearchFocusRef.current = false; }}
          onChange={(e) => {
            keepSearchFocusRef.current = true;
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-outline'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? <PageSkeleton variant="table" /> : (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Order ID</th><th>Customer</th><th>Items</th><th>Amount</th><th>Payment</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o._id}>
                    <td>
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/orders/${o._id}`)}
                        title="Open order details"
                        style={{
                          fontWeight: 600,
                          fontFamily: 'monospace',
                          fontSize: 13,
                          color: 'var(--brown)',
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          background: 'none',
                          border: 'none',
                          padding: 0,
                        }}
                      >
                        #{o._id?.slice(-8).toUpperCase()}
                      </button>
                    </td>
                    <td>{o.customer?.name || '—'}<div style={{ fontSize: 11, color: 'var(--text-light)' }}>{o.customer?.email}</div></td>
                    <td style={{ fontSize: 13 }}>{o.items?.length} item(s)</td>
                    <td style={{ fontWeight: 600 }}>{formatPrice(o.totalAmount)}</td>
                    <td><span className="badge badge-grey" style={{ fontSize: 11 }}>{o.paymentMethod}</span></td>
                    <td><StatusBadge status={o.status} /></td>
                    <td style={{ color: 'var(--text-light)', fontSize: 13 }}>{formatDate(o.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Link to={`/admin/orders/${o._id}`} className="btn btn-outline btn-sm">View</Link>
                        <button className="btn btn-outline btn-sm" type="button" onClick={() => printInvoice(o._id)}>Print</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {orders.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-light)' }}>No orders found.</div>}
          <Pagination page={page} total={total} limit={15} onChange={setPage} />
        </>
      )}

      <Modal open={showOfflineModal} onClose={() => !savingOffline && setShowOfflineModal(false)} title="Add Offline Order" maxWidth={760}>
        {loadingProducts ? (
          <div style={{ padding: 16 }}><PageSkeleton variant="modal" /></div>
        ) : (
          <>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Customer Name *</label>
                <input className="form-input" value={offlineForm.customerName} onChange={(e) => updateOfflineField('customerName', e.target.value)} placeholder="Customer full name" />
              </div>
              <div className="form-group">
                <label className="form-label">Mobile / Phone</label>
                <input className="form-input" value={offlineForm.customerPhone} onChange={(e) => updateOfflineField('customerPhone', e.target.value)} placeholder="98XXXXXXXX" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email (optional)</label>
              <input className="form-input" type="email" value={offlineForm.customerEmail} onChange={(e) => updateOfflineField('customerEmail', e.target.value)} placeholder="customer@example.com" />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Address</label>
                <input className="form-input" value={offlineForm.line1} onChange={(e) => updateOfflineField('line1', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">City</label>
                <input className="form-input" value={offlineForm.city} onChange={(e) => updateOfflineField('city', e.target.value)} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">State</label>
                <input className="form-input" value={offlineForm.state} onChange={(e) => updateOfflineField('state', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Pincode</label>
                <input className="form-input" value={offlineForm.pincode} onChange={(e) => updateOfflineField('pincode', e.target.value)} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select className="form-select" value={offlineForm.paymentMethod} onChange={(e) => updateOfflineField('paymentMethod', e.target.value)}>
                  {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Payment Status</label>
                <select className="form-select" value={offlineForm.paymentStatus} onChange={(e) => updateOfflineField('paymentStatus', e.target.value)}>
                  {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Order Status</label>
                <select className="form-select" value={offlineForm.status} onChange={(e) => updateOfflineField('status', e.target.value)}>
                  {STATUSES.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div style={{ margin: '8px 0 6px', fontWeight: 600, fontSize: 14 }}>Items</div>

            <div className="card" style={{ marginBottom: 12, padding: 12 }}>
              <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
                <input
                  className="form-input"
                  placeholder="Search product by name, description, item category"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
                <select
                  className="form-select"
                  value={productMainFilter}
                  onChange={(e) => {
                    setProductMainFilter(e.target.value);
                    setProductSubFilter('');
                    setProductItemFilter('');
                  }}
                >
                  <option value="">All Main</option>
                  {mainCategoryOptions.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <select
                  className="form-select"
                  value={productSubFilter}
                  onChange={(e) => {
                    setProductSubFilter(e.target.value);
                    setProductItemFilter('');
                  }}
                  disabled={!productMainFilter}
                >
                  <option value="">All Sub</option>
                  {subCategoryOptions.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <select
                  className="form-select"
                  value={productItemFilter}
                  onChange={(e) => setProductItemFilter(e.target.value)}
                  disabled={!productMainFilter && !productSubFilter}
                >
                  <option value="">All Item</option>
                  {itemCategoryOptions.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-light)' }}>
                Showing {filteredProducts.length} of {products.length} products
              </div>

              <div style={{ marginTop: 10, display: 'grid', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                {filteredProducts.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-light)' }}>No products match your search/filter.</div>
                )}
                {filteredProducts.map((p) => (
                  <button
                    key={p._id}
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ justifyContent: 'space-between', textAlign: 'left' }}
                    onClick={() => addProductToOfflineOrder(p)}
                  >
                    <span>{p.name || p.productName}</span>
                    <span>{formatPrice(Number(p.price || 0))}</span>
                  </button>
                ))}
              </div>
            </div>

            {offlineForm.items.map((item, idx) => (
              <div key={`offline-item-${idx}`} className="form-row" style={{ alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">Product *</label>
                  <input
                    className="form-input"
                    value={item.product ? (productLabelMap[item.product] || 'Selected product') : 'Click a product above to add'}
                    readOnly
                  />
                </div>
                <div className="form-group" style={{ maxWidth: 110 }}>
                  <label className="form-label">Qty</label>
                  <input className="form-input" type="number" min="1" value={item.qty} onChange={(e) => updateItem(idx, 'qty', e.target.value)} />
                </div>
                <div className="form-group" style={{ maxWidth: 140 }}>
                  <label className="form-label">Price</label>
                  <input className="form-input" type="number" min="0" value={item.price} onChange={(e) => updateItem(idx, 'price', e.target.value)} />
                </div>
                <button className="btn btn-ghost btn-sm" type="button" style={{ color: 'var(--error)' }} onClick={() => removeItemRow(idx)}>Remove</button>
              </div>
            ))}

            <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 8 }}>
              Use product search above and click an item to add it to order.
            </div>

            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="form-label">Order Notes</label>
              <textarea className="form-input" rows="2" value={offlineForm.notes} onChange={(e) => updateOfflineField('notes', e.target.value)} placeholder="Optional notes" />
            </div>

            <div style={{ marginTop: 10, marginBottom: 16, fontWeight: 700 }}>Subtotal: {formatPrice(computedSubtotal)}</div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-ghost" type="button" onClick={() => setShowOfflineModal(false)} disabled={savingOffline}>Cancel</button>
              <button className="btn btn-primary" type="button" onClick={saveOfflineOrder} disabled={savingOffline}>
                {savingOffline ? 'Saving...' : 'Save Offline Order'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
