// Default fallback structure
const DEFAULT_CATEGORY_STRUCTURE = {
  Clothes: {
    'Ready-to-Wear': ['Shirt', 'Trouser', 'Jeans', 'Hoody', 'T-Shirt', 'Jacket'],
    'Custom Tailored': ['Shirt', 'Pant', 'Kurta-Koti', 'Blazer', 'Jodhpuri', 'Indo-Western', 'Sherwani'],
  },
  Accessories: ['Socks', 'Hanky', 'Vest', 'Trunk', 'Wallet', 'Belt', 'Perfume', 'Febric'],
};

let CATEGORY_STRUCTURE = JSON.parse(JSON.stringify(DEFAULT_CATEGORY_STRUCTURE));
let MAIN_CATEGORIES = ['Clothes', 'Accessories'];
let SUB_CATEGORIES = ['Ready-to-Wear', 'Custom Tailored', ''];
let ITEM_CATEGORIES = [
  ...DEFAULT_CATEGORY_STRUCTURE.Clothes['Ready-to-Wear'],
  ...DEFAULT_CATEGORY_STRUCTURE.Clothes['Custom Tailored'],
  ...DEFAULT_CATEGORY_STRUCTURE.Accessories,
].filter((value, index, list) => list.indexOf(value) === index);

const { normalizeCategoryToken, toComparableCategoryToken } = require('./common');

const findCanonicalOption = (options = [], value = '') => {
  const target = toComparableCategoryToken(value);
  if (!target) return '';
  const match = options.find((option) => toComparableCategoryToken(option) === target);
  return match || '';
};

// Build category structure from database records
const buildCategoryStructureFromDB = (categories = []) => {
  const structure = {};
  const mainCats = new Set();
  const subCats = new Set();
  const itemCats = new Set();

  const normalizeId = (value) => {
    if (!value) return '';
    if (typeof value === 'object') {
      if (value._id) return String(value._id);
      return String(value);
    }
    return String(value);
  };

  // Find category by ID or string reference
  const findCategoryById = (id) => {
    if (!id) return null;
    const idStr = normalizeId(id);
    return categories.find(cat => normalizeId(cat._id) === idStr);
  };

  // Pass 1: Identify and create main categories (no parent)
  categories.forEach(cat => {
    if (!cat.parentCategory) {
      mainCats.add(cat.name);
      structure[cat.name] = {};
    }
  });

  // Pass 2: Create subcategories (parent is main category)
  categories.forEach(cat => {
    if (cat.parentCategory) {
      const parent = findCategoryById(cat.parentCategory);
      if (parent && !parent.parentCategory) {
        // This is a subcategory (parent is main category)
        const mainCatName = parent.name;
        if (structure[mainCatName]) {
          structure[mainCatName][cat.name] = [];
          subCats.add(cat.name);
        }
      }
    }
  });

  // Pass 3: Add item categories (parent is subcategory)
  categories.forEach(cat => {
    if (cat.parentCategory) {
      const parent = findCategoryById(cat.parentCategory);
      if (parent && parent.parentCategory) {
        // This is an item category (parent is subcategory)
        const subCatParent = findCategoryById(parent.parentCategory);
        const mainCatName = subCatParent?.name;
        const subCatName = parent.name;
        
        // Ensure the path exists
        if (mainCatName && structure[mainCatName]) {
          if (!structure[mainCatName][subCatName]) {
            structure[mainCatName][subCatName] = [];
          }
          // Add item if not already there
          if (!structure[mainCatName][subCatName].includes(cat.name)) {
            structure[mainCatName][subCatName].push(cat.name);
          }
          itemCats.add(cat.name);
        }
      }
    }
  });

  // Update global structures
  CATEGORY_STRUCTURE = structure;
  MAIN_CATEGORIES = Array.from(mainCats);
  SUB_CATEGORIES = Array.from(subCats);
  ITEM_CATEGORIES = Array.from(itemCats);

  return structure;
};

const getSubCategories = (mainCategory) => {
  if (mainCategory && CATEGORY_STRUCTURE[mainCategory]) {
    return Object.keys(CATEGORY_STRUCTURE[mainCategory]).filter(sub => sub);
  }
  return [];
};

const getItemCategories = (mainCategory, subCategory = '') => {
  if (mainCategory && subCategory && CATEGORY_STRUCTURE[mainCategory] && CATEGORY_STRUCTURE[mainCategory][subCategory]) {
    const items = CATEGORY_STRUCTURE[mainCategory][subCategory];
    return Array.isArray(items) ? items : [];
  }
  
    // For Accessories or other direct items under main category (when no subCategory)
    if (mainCategory && !subCategory && CATEGORY_STRUCTURE[mainCategory]) {
      const structure = CATEGORY_STRUCTURE[mainCategory];
    
      // If it's an array, return it (direct items under main category)
      if (Array.isArray(structure)) {
        return structure;
      }
    
      // If it's an object, collect items from all subcategories
      if (typeof structure === 'object') {
        const allItems = [];
        Object.keys(structure).forEach((subCatKey) => {
          const subcatItems = structure[subCatKey];
          // Arrays with values are real nested item categories.
          if (Array.isArray(subcatItems) && subcatItems.length > 0) {
            allItems.push(...subcatItems);
          } else if (Array.isArray(subcatItems) && subcatItems.length === 0) {
            // Empty arrays represent direct items under a main category (e.g. Accessories -> Socks).
            allItems.push(subCatKey);
          } else if (!Array.isArray(subcatItems) && typeof subcatItems === 'object') {
            allItems.push(subCatKey);
          }
        });
        return allItems;
      }
    }
  
    return [];
};

const isValidCategoryPath = (mainCategory, subCategory, itemCategory) => {
  // Allow if any category structure is loaded from DB
  if (Object.keys(CATEGORY_STRUCTURE).length > 2) {
    const availableItems = getItemCategories(mainCategory, subCategory);
    if (!availableItems.length) return false;
    const targetItem = toComparableCategoryToken(itemCategory);
    return availableItems.some((candidate) => toComparableCategoryToken(candidate) === targetItem);
  }
  // Fallback: if item exists in any category list, allow it
  const targetItem = toComparableCategoryToken(itemCategory);
  return ITEM_CATEGORIES.some((candidate) => toComparableCategoryToken(candidate) === targetItem);
};

const categoriesConfig = {
  get CATEGORY_STRUCTURE() { return CATEGORY_STRUCTURE; },
  get MAIN_CATEGORIES() { return MAIN_CATEGORIES; },
  get SUB_CATEGORIES() { return SUB_CATEGORIES; },
  get ITEM_CATEGORIES() { return ITEM_CATEGORIES; },
  getSubCategories,
  getItemCategories,
  isValidCategoryPath,
  buildCategoryStructureFromDB,
  findCanonicalOption,
  normalizeCategoryToken,
  toComparableCategoryToken,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = categoriesConfig;
}
