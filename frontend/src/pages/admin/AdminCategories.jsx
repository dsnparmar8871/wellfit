import { useState, useEffect } from 'react';
import { categoryAPI } from '../../api/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { getErrorMsg, getImageUrl } from '../../utils/helpers.js';
import { MAIN_CATEGORIES } from '../../config/categories.js';
import Modal from '../../components/ui/Modal.jsx';
import PageSkeleton from '../../components/ui/PageSkeleton.jsx';
import AppIcon from '../../components/ui/AppIcon.jsx';

const LEVELS = ['main', 'sub', 'item'];

const getParentId = (category) => {
  if (!category?.parentCategory) return '';
  return typeof category.parentCategory === 'object' ? category.parentCategory._id : category.parentCategory;
};

const normalizeCategoryName = (value = '') => {
  const normalized = String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized === 'accesories') return 'accessories';
  return normalized;
};

export default function AdminCategories() {
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [mainFilter, setMainFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    name: '',
    type: 'main',
    mainCategoryId: '',
    subCategoryId: '',
  });
  const [image, setImage] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => categoryAPI.getAll().then(({ data }) => setCategories(data.data?.categories || [])).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const topLevelCategories = categories.filter((category) => !getParentId(category));
  const mainCategoryOptions = (() => {
    const configuredMainCategories = MAIN_CATEGORIES
      .map((mainCategoryName) => categories.find((category) => normalizeCategoryName(category.name) === normalizeCategoryName(mainCategoryName)))
      .filter(Boolean);

    const configuredMainKeys = new Set(
      configuredMainCategories.map((category) => normalizeCategoryName(category.name))
    );

    const remainingTopLevel = topLevelCategories.filter(
      (category) => !configuredMainKeys.has(normalizeCategoryName(category.name))
    );

    return [...configuredMainCategories, ...remainingTopLevel];
  })();

  const getSubCategoriesForMain = (mainCategoryId) => {
    if (!mainCategoryId) return [];
    return categories.filter((category) => getParentId(category) === mainCategoryId);
  };

  const categoryById = new Map(categories.map((category) => [category._id, category]));

  const getCategoryLevel = (category) => {
    const parentId = getParentId(category);
    if (!parentId) return 'main';
    const parent = categoryById.get(parentId);
    if (!parent) return 'sub';
    return getParentId(parent) ? 'item' : 'sub';
  };

  const getMainCategoryIdForCategory = (category) => {
    const level = getCategoryLevel(category);
    if (level === 'main') return category._id;

    const parent = categoryById.get(getParentId(category));
    if (!parent) return '';
    if (level === 'sub') return parent._id;

    return getParentId(parent) || '';
  };

  const filteredCategories = categories.filter((category) => {
    const name = String(category?.name || '').toLowerCase();
    const parentName = String(category?.parentCategory?.name || '').toLowerCase();
    const searchValue = search.trim().toLowerCase();
    const matchesSearch = !searchValue || name.includes(searchValue) || parentName.includes(searchValue);

    const level = getCategoryLevel(category);
    const matchesLevel = levelFilter === 'all' || level === levelFilter;

    const mainCategoryId = getMainCategoryIdForCategory(category);
    const matchesMain = mainFilter === 'all' || mainCategoryId === mainFilter;

    return matchesSearch && matchesLevel && matchesMain;
  });

  const resolveParentCategoryId = (currentForm) => {
    if (currentForm.type === 'main') return '';

    if (!currentForm.mainCategoryId) return null;
    if (currentForm.type === 'sub') return currentForm.mainCategoryId;
    if (!currentForm.subCategoryId) return null;

    const subCategory = categories.find((category) => category._id === currentForm.subCategoryId);
    if (!subCategory) return null;
    if (getParentId(subCategory) !== currentForm.mainCategoryId) return null;
    return subCategory._id;
  };

  const openForm = (c = null) => {
    const defaultMainId = mainCategoryOptions[0]?._id || '';

    if (!c) {
      setEditId(null);
      setForm({
        name: '',
        type: 'main',
        mainCategoryId: defaultMainId,
        subCategoryId: '',
      });
      setImage(null);
      setShowModal(true);
      return;
    }

    setEditId(c?._id || null);

    const categoryMap = new Map(categories.map((category) => [category._id, category]));
    const parentId = getParentId(c);
    const parent = parentId ? categoryMap.get(parentId) : null;
    const grandParentId = parent ? getParentId(parent) : '';
    const grandParent = grandParentId ? categoryMap.get(grandParentId) : null;

    let type = 'main';
    let mainCategoryId = defaultMainId;
    let subCategoryId = '';

    if (!parent) {
      type = 'main';
    } else if (!grandParent) {
      type = 'sub';
      mainCategoryId = parent._id;
    } else {
      type = 'item';
      mainCategoryId = grandParent?._id || defaultMainId;
      subCategoryId = parent?._id || '';
    }

    setForm({
      name: c?.name || '',
      type,
      mainCategoryId,
      subCategoryId,
    });
    setImage(null);
    setShowModal(true);
  };

  const save = async () => {
    const name = form.name.trim();
    if (!name) return toast.error('Name is required');

    if (form.type !== 'main' && !form.mainCategoryId) {
      return toast.error('Select main category first.');
    }

    if (form.type === 'item' && !form.subCategoryId) {
      return toast.error('For item category, select sub category first.');
    }

    const parentCategoryId = resolveParentCategoryId(form);
    if (form.type !== 'main' && !parentCategoryId) {
      return toast.error('Select a valid parent category path first.');
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('parentCategory', parentCategoryId || '');
      if (image) fd.append('image', image);
      if (editId) await categoryAPI.update(editId, fd);
      else await categoryAPI.create(fd);
      toast.success(editId ? 'Updated!' : 'Created!');
      setShowModal(false); load();
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!confirm('Delete this category?')) return;
    try { await categoryAPI.delete(id); toast.success('Deleted'); load(); }
    catch (err) { toast.error(getErrorMsg(err)); }
  };

  const subCategoryOptions = getSubCategoriesForMain(form.mainCategoryId);
  const selectedMainCategory = mainCategoryOptions.find((category) => category._id === form.mainCategoryId);

  if (loading) return <PageSkeleton variant="table" />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: 0 }}>Categories</h1>
        <button className="btn btn-primary btn-sm" onClick={() => openForm()}>+ New Category</button>
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
          <input
            className="form-input"
            placeholder="Search by category or parent..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select className="form-select" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
            <option value="all">All Levels</option>
            <option value="main">Main</option>
            <option value="sub">Sub</option>
            <option value="item">Item</option>
          </select>

          <select className="form-select" value={mainFilter} onChange={(e) => setMainFilter(e.target.value)}>
            <option value="all">All Main Categories</option>
            {mainCategoryOptions.map((mainCategory) => (
              <option key={mainCategory._id} value={mainCategory._id}>{mainCategory.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid-3">
        {filteredCategories.map((c) => (
          <div key={c._id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 8, background: '#F5EDE2', overflow: 'hidden', flexShrink: 0 }}>
              {c.image ? <img src={getImageUrl(c.image)} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AppIcon name="category" size={20} /></div>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              {c.parentCategory && <div style={{ fontSize: 12, color: 'var(--text-light)' }}>under {c.parentCategory?.name || c.parentCategory}</div>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-outline btn-sm" onClick={() => openForm(c)}>Edit</button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }} onClick={() => del(c._id)}>Del</button>
            </div>
          </div>
        ))}
      </div>
      {categories.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-light)' }}>No categories yet.</div>}
      {categories.length > 0 && filteredCategories.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-light)' }}>No categories match your search/filter.</div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Category' : 'New Category'}>
        <div className="form-group">
          <label className="form-label">Category Name *</label>
          <input className="form-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Enter category name" />
        </div>
        <div className="form-group">
          <label className="form-label">Category Level</label>
          <select className="form-input" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value, subCategoryId: '' }))}>
            {LEVELS.map((level) => (
              <option key={level} value={level}>{level === 'main' ? 'Main Category' : level === 'sub' ? 'Sub Category' : 'Item Category'}</option>
            ))}
          </select>
        </div>

        {form.type !== 'main' && (
          <div className="form-group">
            <label className="form-label">Main Category</label>
            <select
              className="form-input"
              value={form.mainCategoryId}
              onChange={(e) => setForm((f) => ({ ...f, mainCategoryId: e.target.value, subCategoryId: '' }))}
            >
              <option value="">Select Main Category</option>
              {mainCategoryOptions.map((mainCategory) => (
                <option key={mainCategory._id} value={mainCategory._id}>{mainCategory.name}</option>
              ))}
            </select>
          </div>
        )}

        {form.type === 'item' && (
          <div className="form-group">
            <label className="form-label">Sub Category</label>
            <select
              className="form-input"
              value={form.subCategoryId}
              onChange={(e) => setForm((f) => ({ ...f, subCategoryId: e.target.value }))}
            >
              <option value="">Select Sub Category</option>
              {subCategoryOptions.map((subCategory) => (
                <option key={subCategory._id} value={subCategory._id}>{subCategory.name}</option>
              ))}
            </select>
          </div>
        )}

        {form.type === 'sub' && (
          <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 12 }}>
            Parent will be: {selectedMainCategory?.name || 'Select a main category'}
          </div>
        )}

        {form.type === 'item' && (
          <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 12 }}>
            Parent will be: {subCategoryOptions.find((subCategory) => subCategory._id === form.subCategoryId)?.name || 'Select a sub category'}
          </div>
        )}

        {form.type === 'main' && (
          <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 12 }}>
            This will be created as a top-level category.
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Image</label>
          <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files[0])} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </Modal>
    </div>
  );
}
