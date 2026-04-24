import { useEffect, useRef, useState } from 'react';
import {
  getMainCategories,
  getSubCategories,
  getItemCategories,
} from '../../utils/categories.js';
import AppIcon from '../ui/AppIcon.jsx';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const PRICE_RANGES = [['', 'Any Price'], ['0-500', 'Under ₹500'], ['500-2000', '₹500–₹2000'], ['2000-5000', '₹2000–₹5000'], ['5000-', 'Above ₹5000']];

export default function ProductFilters({ filters, onChange }) {
  const [open, setOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState('');
  const filterRef = useRef(null);
  const mainCategories = getMainCategories();
  const subCategoryOptions = getSubCategories(filters.mainCategory);
  const itemCategoryOptions = getItemCategories(filters.mainCategory, filters.subCategory);
  const hasSubCategories = subCategoryOptions.length > 0;
  const showSubCategoryFilter = Boolean(filters.mainCategory) && hasSubCategories;
  const showItemCategoryFilter = Boolean(filters.mainCategory) && ((hasSubCategories && Boolean(filters.subCategory)) || !hasSubCategories);
  const activeCount = [
    filters.mainCategory,
    filters.subCategory,
    filters.itemCategory,
    filters.priceRange,
    filters.size,
  ].filter(Boolean).length;

  const handleChange = (key, value) => onChange({ ...filters, [key]: value, page: 1 });
  const clearFilters = () => onChange({
    mainCategory: '',
    subCategory: '',
    itemCategory: '',
    priceRange: '',
    size: '',
    page: 1,
    search: filters.search,
  });

  useEffect(() => {
    const handleOutside = (event) => {
      if (!filterRef.current?.contains(event.target)) {
        setOpenDropdown('');
      }
    };

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const CustomSelect = ({ dropdownKey, value, onValueChange, options, placeholder }) => {
    const selectedLabel = options.find(([optionValue]) => optionValue === value)?.[1] || placeholder;
    const isOpen = openDropdown === dropdownKey;

    return (
      <div className="wf-custom-select">
        <button
          type="button"
          className={`wf-select-trigger${isOpen ? ' open' : ''}`}
          onClick={() => setOpenDropdown((prev) => prev === dropdownKey ? '' : dropdownKey)}
        >
          <span className={`wf-select-label${value ? ' selected' : ''}`}>{selectedLabel}</span>
          <span className="wf-select-caret">v</span>
        </button>

        {isOpen && (
          <div className="wf-select-menu" role="listbox">
            {options.map(([optionValue, optionLabel]) => (
              <button
                key={`${dropdownKey}-${optionValue || 'all'}`}
                type="button"
                className={`wf-select-option${value === optionValue ? ' active' : ''}`}
                onClick={() => {
                  onValueChange(optionValue);
                  setOpenDropdown('');
                }}
              >
                {optionLabel}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const FilterSection = ({ title, children, compact = false }) => (
    <div style={{ marginBottom: compact ? 14 : 18 }}>
      <div style={{ fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-light)', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );

  const FiltersContent = ({ compact = false }) => (
    <div className={compact ? 'wf-filter-content wf-filter-content-compact' : 'wf-filter-content'}>
      <FilterSection title="Category">
        <CustomSelect
          dropdownKey={`main-${compact ? 'mobile' : 'desktop'}`}
          value={filters.mainCategory}
          onValueChange={(value) => onChange({ ...filters, mainCategory: value, subCategory: '', itemCategory: '', page: 1 })}
          options={[['', 'All Categories'], ...mainCategories.map((category) => [category, category])]}
          placeholder="All Categories"
        />
      </FilterSection>

      {showSubCategoryFilter && (
        <FilterSection title="Clothing Type" compact={compact}>
          <CustomSelect
            dropdownKey={`sub-${compact ? 'mobile' : 'desktop'}`}
            value={filters.subCategory}
            onValueChange={(value) => onChange({ ...filters, subCategory: value, itemCategory: '', page: 1 })}
            options={[['', 'All Clothing Types'], ...subCategoryOptions.map((option) => [option, option])]}
            placeholder="All Clothing Types"
          />
        </FilterSection>
      )}

      {showItemCategoryFilter && (
        <FilterSection title="Item Category" compact={compact}>
          <CustomSelect
            dropdownKey={`item-${compact ? 'mobile' : 'desktop'}`}
            value={filters.itemCategory}
            onValueChange={(value) => handleChange('itemCategory', value)}
            options={[['', 'All Item Categories'], ...itemCategoryOptions.map((option) => [option, option])]}
            placeholder="All Item Categories"
          />
        </FilterSection>
      )}

      <FilterSection title="Price Range" compact={compact}>
        <CustomSelect
          dropdownKey={`price-${compact ? 'mobile' : 'desktop'}`}
          value={filters.priceRange}
          onValueChange={(value) => handleChange('priceRange', value)}
          options={PRICE_RANGES}
          placeholder="Any Price"
        />
      </FilterSection>

      <FilterSection title="Size" compact={compact}>
        <div className="wf-size-grid">
          {SIZES.map((s) => (
            <button
              key={s}
              className={`wf-size-chip${filters.size === s ? ' active' : ''}`}
              onClick={() => handleChange('size', filters.size === s ? '' : s)}
            >
              {s}
            </button>
          ))}
        </div>
      </FilterSection>

      <button className="btn btn-outline btn-sm btn-full" onClick={clearFilters}>
        Clear Filters
      </button>
    </div>
  );

  return (
    <div ref={filterRef}>
      {/* Desktop */}
      <div className="sidebar wf-desktop-filters wf-filter-panel">
        <div className="wf-filter-head">
          <div className="wf-filter-title">Filters</div>
          {activeCount > 0 && <div className="wf-filter-active-count">{activeCount} active</div>}
        </div>
        <FiltersContent />
      </div>

      {/* Mobile toggle */}
      <div className="wf-mobile-filters">
        <div className="wf-mobile-filter-bar">
          <button className="btn btn-outline btn-sm" onClick={() => setOpen((v) => !v)}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <AppIcon name="search" size={14} />
              Filters {activeCount > 0 ? `(${activeCount})` : ''}
            </span>
          </button>
          {activeCount > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
              Clear
            </button>
          )}
        </div>
        {open && (
          <div className="wf-mobile-filter-panel">
            <FiltersContent compact />
          </div>
        )}
      </div>

      <style>{`
        .wf-filter-panel {
          padding: 14px;
          box-shadow: var(--shadow-sm);
        }

        .wf-filter-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
          padding-bottom: 10px;
          border-bottom: 1px solid var(--border);
        }

        .wf-filter-title {
          font-family: var(--font-display);
          font-size: 1rem;
          font-weight: 700;
          color: var(--text);
        }

        .wf-filter-active-count {
          font-size: 11px;
          font-weight: 600;
          color: var(--brown);
          background: #F5EDE2;
          border: 1px solid #E4D4BF;
          border-radius: 999px;
          padding: 2px 8px;
        }

        .wf-custom-select {
          position: relative;
        }

        .wf-select-trigger {
          width: 100%;
          border: 1.5px solid var(--border);
          border-radius: 9px;
          background: #fff;
          color: var(--text);
          padding: 8px 11px;
          font-size: 13px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          cursor: pointer;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .wf-select-trigger.open {
          border-color: var(--brown);
          box-shadow: 0 0 0 3px rgba(167,146,119,0.16);
        }

        .wf-select-label {
          color: var(--text-light);
          text-align: left;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .wf-select-label.selected {
          color: var(--text);
          font-weight: 500;
        }

        .wf-select-caret {
          font-size: 12px;
          color: var(--text-light);
          flex-shrink: 0;
        }

        .wf-select-menu {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          z-index: 30;
          background: #fff;
          border: 1px solid var(--border);
          border-radius: 10px;
          box-shadow: 0 14px 26px rgba(44,36,32,0.14);
          padding: 6px;
          max-height: 240px;
          overflow: auto;
        }

        .wf-select-option {
          width: 100%;
          border: none;
          background: transparent;
          text-align: left;
          padding: 8px 9px;
          border-radius: 7px;
          color: var(--text);
          font-size: 13px;
          cursor: pointer;
          transition: background-color 0.12s ease, color 0.12s ease;
        }

        .wf-select-option:hover {
          background: #F7EEE3;
        }

        .wf-select-option.active {
          background: #F1E2D1;
          color: var(--brown-dark);
          font-weight: 600;
        }

        .wf-size-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px;
        }

        .wf-size-chip {
          padding: 5px 0;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--white);
          color: var(--text);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .wf-size-chip.active {
          border-color: var(--brown);
          background: var(--brown);
          color: #fff;
        }

        .wf-mobile-filter-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 10px;
        }

        .wf-mobile-filter-panel {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 12px;
          margin-bottom: 12px;
          max-height: 56vh;
          overflow: auto;
        }

        @media (max-width: 900px) {
          .wf-desktop-filters { display: none !important; }
          .wf-mobile-filters { display: block !important; }
        }
        .wf-mobile-filters { display: none; }

        @media (max-width: 640px) {
          .wf-mobile-filter-panel {
            padding: 10px;
            border-radius: 10px;
          }
          .wf-select-trigger {
            padding: 7px 10px;
            font-size: 12px;
          }
          .wf-select-option {
            padding: 7px 8px;
            font-size: 12px;
          }
          .wf-filter-content-compact .btn {
            padding-top: 6px;
            padding-bottom: 6px;
          }
          .wf-size-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  );
}
