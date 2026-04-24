import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { productAPI } from '../../api/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { getErrorMsg, getImageUrl } from '../../utils/helpers.js';
import PageSkeleton from '../../components/ui/PageSkeleton.jsx';
import {
  MAIN_CATEGORIES,
  getSubCategories,
  getItemCategories,
} from '../../config/categories.js';

const EMPTY_VARIANT = { size: '', color: '', stock: 0, price: '', mrp: '', image: '', imageFile: null, imagePreview: '' };
const FIELD_ERROR_STYLE = { color: 'var(--error)', fontSize: 12, marginTop: 6 };

const toComparable = (value) => String(value || '').trim().toLowerCase();

const normalizeByOptions = (value, options = []) => {
  const target = toComparable(value);
  if (!target) return '';
  const matched = options.find((option) => toComparable(option) === target);
  return matched || String(value || '').trim();
};

const isVariantEmpty = (variant) => {
  const size = String(variant.size || '').trim();
  const color = String(variant.color || '').trim();
  const stockRaw = String(variant.stock ?? '').trim();
  const priceRaw = String(variant.price ?? '').trim();
  const mrpRaw = String(variant.mrp ?? '').trim();
  const image = String(variant.image || '').trim();
  const hasUpload = !!variant.imageFile;

  const stockIsDefault = stockRaw === '' || Number(stockRaw) === 0;
  const priceIsDefault = priceRaw === '';
  const mrpIsDefault = mrpRaw === '';
  return !size && !color && stockIsDefault && priceIsDefault && mrpIsDefault && !image && !hasUpload;
};

export default function ProductForm({ editProduct = null }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const activeId = editProduct?._id || id;
  const isEdit = !!activeId;

  const [form, setForm] = useState({
    productName: '',
    description: '',
    mainCategory: '',
    subCategory: '',
    itemCategory: '',
    price: '',
    mrp: '',
    isFeatured: false,
    images: [], // existing extra images
  });
  const [extraImageFiles, setExtraImageFiles] = useState([]); // new extra image files
  const [extraImagePreviews, setExtraImagePreviews] = useState([]); // new extra image previews
  const [variants, setVariants] = useState([{ ...EMPTY_VARIANT }]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState({ type: '', message: '' });

  const subCategoryOptions = getSubCategories(form.mainCategory);
  const itemCategoryOptions = getItemCategories(form.mainCategory, form.subCategory);

  const normalizeCategoryForm = (product) => {
    const normalizedMain = normalizeByOptions(product.mainCategory || '', MAIN_CATEGORIES);
    const normalizedSub = normalizedMain === 'Clothes'
      ? normalizeByOptions(product.subCategory || '', getSubCategories(normalizedMain))
      : '';
    const normalizedItem = normalizeByOptions(
      product.itemCategory || '',
      getItemCategories(normalizedMain, normalizedSub)
    );

    return {
      productName: product.productName || product.name || '',
      description: product.description || '',
      mainCategory: normalizedMain,
      subCategory: normalizedSub,
      itemCategory: normalizedItem,
      price: product.price ?? '',
      mrp: product.mrp ?? '',
      isFeatured: !!product.isFeatured,
      images: Array.isArray(product.images) ? product.images : [],
    };
  };

  useEffect(() => {
    if (editProduct) {
      const p = editProduct;
      setForm(normalizeCategoryForm({
        ...p,
        subCategory: p.subCategory || p.subcategory || '',
      }));
      setVariants(
        p.variants?.length
          ? p.variants.map((v) => ({
              size: v.size || '',
              color: v.color || '',
              stock: v.stock || 0,
              price: v.price ?? p.price ?? '',
              mrp: v.mrp ?? p.mrp ?? '',
              image: v.image || '',
              imageFile: null,
              imagePreview: '',
            }))
          : [{ ...EMPTY_VARIANT }]
      );
      setLoading(false);
      return;
    }

    if (isEdit) {
      productAPI.getById(activeId).then(({ data }) => {
        const p = data.data?.product || data.data;
        setForm(normalizeCategoryForm({
          ...p,
          subCategory: p.subCategory || p.subcategory || '',
        }));
        setVariants(
          p.variants?.length
            ? p.variants.map((v) => ({
                size: v.size || '',
                color: v.color || '',
                stock: v.stock || 0,
                price: v.price ?? p.price ?? '',
                mrp: v.mrp ?? p.mrp ?? '',
                image: v.image || '',
                imageFile: null,
                imagePreview: '',
              }))
            : [{ ...EMPTY_VARIANT }]
        );
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [activeId, editProduct, isEdit]);

  const addVariant = () => setVariants((v) => [...v, { ...EMPTY_VARIANT }]);
  const updateVariant = (i, field, val) => {
    setVariants((vs) => vs.map((v, idx) => idx === i ? { ...v, [field]: val } : v));
    setErrors((prev) => ({ ...prev, [`variant_${field}_${i}`]: '' }));
  };
  const removeVariant = (i) => setVariants((vs) => vs.filter((_, idx) => idx !== i));

  const updateVariantImage = (index, file) => {
    setVariants((prev) => prev.map((variant, i) => {
      if (i !== index) return variant;
      const preview = file ? URL.createObjectURL(file) : '';
      return {
        ...variant,
        imageFile: file || null,
        imagePreview: preview,
      };
    }));
  };

  const handleMainCategoryChange = (value) => {
    setForm((prev) => ({ ...prev, mainCategory: value, subCategory: '', itemCategory: '' }));
    setErrors((prev) => ({ ...prev, mainCategory: '', subCategory: '', itemCategory: '' }));
    setBanner({ type: '', message: '' });
  };

  const handleExtraImagesChange = (files) => {
    const newFiles = Array.from(files);
    setExtraImageFiles((prev) => [...prev, ...newFiles]);
    const newPreviews = newFiles.map((file) => URL.createObjectURL(file));
    setExtraImagePreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeExistingExtraImage = (index) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const removeNewExtraImage = (index) => {
    setExtraImageFiles((prev) => prev.filter((_, i) => i !== index));
    setExtraImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubCategoryChange = (value) => {
    setForm((prev) => ({ ...prev, subCategory: value, itemCategory: '' }));
    setErrors((prev) => ({ ...prev, subCategory: '', itemCategory: '' }));
    setBanner({ type: '', message: '' });
  };

  const sanitizeNonNegativeValue = (value) => {
    if (value === '') return '';
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return '';
    return parsed < 0 ? '0' : value;
  };

  const getMeaningfulVariants = () => variants.filter((variant) => !isVariantEmpty(variant));

  const validateForm = () => {
    const nextErrors = {};

    if (!form.productName.trim()) nextErrors.productName = 'Product name is required';
    if (!form.mainCategory) nextErrors.mainCategory = 'Main category is required';
    if (form.mainCategory === 'Clothes' && !form.subCategory) nextErrors.subCategory = 'Sub-category is required for Clothes';
    if (form.mainCategory === 'Clothes' && form.subCategory && !subCategoryOptions.includes(form.subCategory)) {
      nextErrors.subCategory = 'Please select a valid sub-category';
    }
    if (!form.itemCategory) nextErrors.itemCategory = 'Item category is required';
    if (
      form.itemCategory
      && itemCategoryOptions.length > 0
      && !itemCategoryOptions.some((option) => toComparable(option) === toComparable(form.itemCategory))
    ) {
      nextErrors.itemCategory = 'Please select a valid item category';
    }

    const price = Number(form.price);
    const mrp = Number(form.mrp);

    if (form.price === '' || Number.isNaN(price) || price < 0) nextErrors.price = 'Valid price is required';
    if (form.mrp === '' || Number.isNaN(mrp) || mrp < 0) nextErrors.mrp = 'Valid MRP is required';
    if (!nextErrors.price && !nextErrors.mrp && price > mrp) nextErrors.price = 'Price must be less than or equal to MRP';

    const meaningfulVariants = getMeaningfulVariants();

    if (!meaningfulVariants.length) {
      nextErrors.variants = 'At least one variant is required';
    } else {
      variants.forEach((variant, index) => {
        if (isVariantEmpty(variant)) return;
        const hasExistingImage = !!String(variant.image || '').trim();
        const variantPriceRaw = variant.price === '' ? form.price : variant.price;
        const variantMrpRaw = variant.mrp === '' ? form.mrp : variant.mrp;
        const variantPrice = Number(variantPriceRaw);
        const variantMrp = Number(variantMrpRaw);
        if (!variant.size.trim()) nextErrors[`variant_size_${index}`] = 'Size is required';
        if (!variant.color.trim() && !hasExistingImage) nextErrors[`variant_color_${index}`] = 'Color is required';
        if (variant.stock === '' || Number(variant.stock) < 0) nextErrors[`variant_stock_${index}`] = 'Stock must be 0 or more';
        if (variantPriceRaw === '' || Number.isNaN(variantPrice) || variantPrice < 0) {
          nextErrors[`variant_price_${index}`] = 'Variant price must be 0 or more';
        }
        if (variantMrpRaw === '' || Number.isNaN(variantMrp) || variantMrp < 0) {
          nextErrors[`variant_mrp_${index}`] = 'Variant MRP must be 0 or more';
        }
        if (!Number.isNaN(variantPrice) && !Number.isNaN(variantMrp) && variantPrice > variantMrp) {
          nextErrors[`variant_price_${index}`] = 'Variant price must be less than or equal to MRP';
        }
      });
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const mapServerValidationErrors = (serverErrors = []) => {
    const mappedErrors = {};

    serverErrors.forEach((errorObj) => {
      const field = errorObj?.field;
      const message = errorObj?.message;
      if (!field || !message) return;

      if (field.startsWith('variants[') || field.startsWith('variants.')) {
        const match = field.match(/variants(?:\[(\d+)\]|\.(\d+))\.(size|color|stock|price|mrp)/);
        if (match) {
          const [, bracketIndex, dotIndex, key] = match;
          const index = bracketIndex ?? dotIndex;
          mappedErrors[`variant_${key}_${index}`] = message;
          return;
        }
      }

      mappedErrors[field] = message;
    });

    return mappedErrors;
  };

  const handleSave = async () => {
    setBanner({ type: '', message: '' });
    setErrors({});
    if (!validateForm()) {
      setBanner({ type: 'error', message: 'Please fix validation errors before submitting.' });
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('productName', form.productName.trim());
      fd.append('description', form.description || '');
      fd.append('mainCategory', form.mainCategory);
      fd.append('subCategory', form.mainCategory === 'Clothes' ? form.subCategory : '');
      fd.append('itemCategory', form.itemCategory);
      fd.append('price', String(form.price));
      fd.append('mrp', String(form.mrp));
      fd.append('isFeatured', form.isFeatured ? 'true' : 'false');
      
      // Append existing images that were NOT deleted
      form.images.forEach((img) => fd.append('images', img));
      
      // Append new extra image files
      extraImageFiles.forEach((file) => fd.append('images', file));

      const payloadVariants = variants
        .map((variant, index) => ({ variant, index }))
        .filter(({ variant }) => !isVariantEmpty(variant))
        .map(({ variant }, payloadIndex) => {
          if (variant.imageFile) fd.append(`variantImage_${payloadIndex}`, variant.imageFile);
          return {
            size: variant.size.trim(),
            color: variant.color.trim(),
            stock: Number(variant.stock) || 0,
            price: variant.price === '' ? Number(form.price) : Number(variant.price),
            mrp: variant.mrp === '' ? Number(form.mrp) : Number(variant.mrp),
            image: variant.image || '',
          };
        });

      fd.append('variants', JSON.stringify(payloadVariants));

      if (isEdit) await productAPI.update(activeId, fd);
      else await productAPI.create(fd);

      const successMessage = isEdit ? 'Product updated successfully.' : 'Product created successfully.';
      setBanner({ type: 'success', message: successMessage });
      setErrors({});
      toast.success(isEdit ? 'Product updated!' : 'Product created!');
      setTimeout(() => navigate('/admin/products'), 700);
    } catch (err) {
      const serverErrors = err?.response?.data?.errors;
      if (Array.isArray(serverErrors) && serverErrors.length) {
        if (typeof serverErrors[0] === 'string') {
          const message = serverErrors[0];
          setBanner({ type: 'error', message });
          toast.error(message);
          return;
        }

        const mappedErrors = mapServerValidationErrors(serverErrors);
        if (Object.keys(mappedErrors).length) setErrors(mappedErrors);
        const message = serverErrors[0]?.message || err?.response?.data?.message || 'Validation failed';
        setBanner({ type: 'error', message });
        // Keep validation feedback inline + banner; avoid duplicate toast noise.
        if (!Object.keys(mappedErrors).length) {
          toast.error(message);
        }
      } else {
        const message = err?.response?.data?.message || getErrorMsg(err);
        setBanner({ type: 'error', message });
        toast.error(message);
      }
    }
    finally { setSaving(false); }
  };

  if (loading) return <PageSkeleton variant="form" />;

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/products')}>← Back</button>
        <h1 style={{ fontSize: '1.4rem', marginBottom: 0 }}>{isEdit ? 'Edit Product' : 'Add Product'}</h1>
      </div>

      {banner.message && (
        <div
          className="card"
          style={{
            marginBottom: 16,
            borderColor: banner.type === 'error' ? 'var(--error)' : 'var(--success)',
            color: banner.type === 'error' ? 'var(--error)' : 'var(--success)',
          }}
        >
          {banner.message}
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 18 }}>Basic Info</h3>
        <div className="form-group">
          <label className="form-label">Product Name *</label>
          <input className="form-input" value={form.productName} onChange={(e) => {
            const value = e.target.value;
            setForm((f) => ({ ...f, productName: value }));
            setErrors((prev) => ({ ...prev, productName: '' }));
          }} placeholder="e.g. Classic White Formal Shirt" />
          {errors.productName && <div style={FIELD_ERROR_STYLE}>{errors.productName}</div>}
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-textarea" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Detailed description…" />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Main Category *</label>
            <select className="form-select" value={form.mainCategory} onChange={(e) => handleMainCategoryChange(e.target.value)}>
              <option value="">Select Main Category</option>
              {MAIN_CATEGORIES.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            {errors.mainCategory && <div style={FIELD_ERROR_STYLE}>{errors.mainCategory}</div>}
          </div>
          {form.mainCategory === 'Clothes' && (
            <div className="form-group">
              <label className="form-label">Sub-Category *</label>
              <select className="form-select" value={form.subCategory} onChange={(e) => handleSubCategoryChange(e.target.value)}>
                <option value="">Select Sub-Category</option>
                {subCategoryOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              {errors.subCategory && <div style={FIELD_ERROR_STYLE}>{errors.subCategory}</div>}
            </div>
          )}
        </div>

        {(form.mainCategory === 'Accessories' || (form.mainCategory === 'Clothes' && form.subCategory)) && (
          <div className="form-group">
            <label className="form-label">Item Category *</label>
            <select className="form-select" value={form.itemCategory} onChange={(e) => {
              const value = e.target.value;
              setForm((f) => ({ ...f, itemCategory: value }));
              setErrors((prev) => ({ ...prev, itemCategory: '' }));
              setBanner({ type: '', message: '' });
            }}>
              <option value="">Select Item Category</option>
              {itemCategoryOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            {errors.itemCategory && <div style={FIELD_ERROR_STYLE}>{errors.itemCategory}</div>}
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Default Price (₹) *</label>
            <input
              className="form-input"
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => {
                setForm((f) => ({ ...f, price: sanitizeNonNegativeValue(e.target.value) }));
                setErrors((prev) => ({ ...prev, price: '' }));
              }}
              placeholder="999"
            />
            {errors.price && <div style={FIELD_ERROR_STYLE}>{errors.price}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Default MRP (₹) *</label>
            <input
              className="form-input"
              type="number"
              min="0"
              step="0.01"
              value={form.mrp}
              onChange={(e) => {
                setForm((f) => ({ ...f, mrp: sanitizeNonNegativeValue(e.target.value) }));
                setErrors((prev) => ({ ...prev, mrp: '' }));
              }}
              placeholder="1499"
            />
            {errors.mrp && <div style={FIELD_ERROR_STYLE}>{errors.mrp}</div>}
          </div>
        </div>
        {Number(form.price) > 0 && Number(form.mrp) > 0 && Number(form.price) < Number(form.mrp) && (
          <span className="badge badge-success">
            {Math.round(((Number(form.mrp) - Number(form.price)) / Number(form.mrp)) * 100)}% off
          </span>
        )}
        <div className="form-group" style={{ marginTop: 12, marginBottom: 0 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!form.isFeatured}
              onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))}
            />
            Show in New Arrivals (Home page)
          </label>
        </div>
      </div>

      {/* Extra Images */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 16 }}>Extra Images</h3>
        <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 16 }}>
          Add additional photos of the product. These will be shown alongside variant-specific photos.
        </p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12, marginBottom: 16 }}>
          {/* Existing Images */}
          {form.images.map((img, idx) => (
            <div key={`existing-${idx}`} style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <img src={getImageUrl(img)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                type="button"
                onClick={() => removeExistingExtraImage(idx)}
                style={{
                  position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12
                }}
              >✕</button>
            </div>
          ))}
          
          {/* New Image Previews */}
          {extraImagePreviews.map((prev, idx) => (
            <div key={`new-${idx}`} style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--brown)' }}>
              <img src={prev} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                type="button"
                onClick={() => removeNewExtraImage(idx)}
                style={{
                  position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12
                }}
              >✕</button>
            </div>
          ))}
          
          {/* Upload Placeholder */}
          <label style={{
            aspectRatio: '1/1', borderRadius: 8, border: '2px dashed var(--border)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-light)', fontSize: 12, textAlign: 'center', padding: 8
          }}>
            <input type="file" multiple accept="image/*" onChange={(e) => handleExtraImagesChange(e.target.files)} style={{ display: 'none' }} />
            <span style={{ fontSize: 24, marginBottom: 4 }}>+</span>
            Add Photo
          </label>
        </div>
      </div>

      {/* Variants */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ marginBottom: 0 }}>Variants</h3>
          <button type="button" className="btn btn-outline btn-sm" onClick={addVariant}>+ Add Variant</button>
        </div>
        {errors.variants && <div style={{ ...FIELD_ERROR_STYLE, marginBottom: 10 }}>{errors.variants}</div>}
        {variants.map((v, i) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--text-light)', fontWeight: 600 }}>Variant {i + 1}</div>
              <button type="button" onClick={() => removeVariant(i)} style={{ padding: '6px 8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, alignItems: 'end' }}>
              {[['size', 'Size (e.g. M, L, 38)'], ['color', 'Color']].map(([field, ph]) => (
                <div key={field} className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ textTransform: 'capitalize' }}>{field}</label>
                  <input className="form-input" value={v[field]} onChange={(e) => updateVariant(i, field, e.target.value)} placeholder={ph} />
                  {errors[`variant_${field}_${i}`] && <div style={FIELD_ERROR_STYLE}>{errors[`variant_${field}_${i}`]}</div>}
                </div>
              ))}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Stock</label>
                <input className="form-input" type="number" value={v.stock} onChange={(e) => updateVariant(i, 'stock', e.target.value)} min="0" />
                {errors[`variant_stock_${i}`] && <div style={FIELD_ERROR_STYLE}>{errors[`variant_stock_${i}`]}</div>}
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Price (₹)</label>
                <input className="form-input" type="number" min="0" step="0.01" value={v.price} onChange={(e) => updateVariant(i, 'price', sanitizeNonNegativeValue(e.target.value))} placeholder={String(form.price || 'Default')} />
                {errors[`variant_price_${i}`] && <div style={FIELD_ERROR_STYLE}>{errors[`variant_price_${i}`]}</div>}
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">MRP (₹)</label>
                <input className="form-input" type="number" min="0" step="0.01" value={v.mrp} onChange={(e) => updateVariant(i, 'mrp', sanitizeNonNegativeValue(e.target.value))} placeholder={String(form.mrp || 'Default')} />
                {errors[`variant_mrp_${i}`] && <div style={FIELD_ERROR_STYLE}>{errors[`variant_mrp_${i}`]}</div>}
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Image</label>
                <input type="file" accept="image/*" onChange={(e) => updateVariantImage(i, e.target.files?.[0] || null)} style={{ display: 'block', marginBottom: 6 }} />
                {(v.imagePreview || v.image) && (
                  <img src={v.imagePreview || getImageUrl(v.image)} alt="Variant preview" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6 }} />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-ghost" onClick={() => navigate('/admin/products')}>Cancel</button>
        <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Update Product' : 'Create Product'}
        </button>
      </div>
    </div>
  );
}
