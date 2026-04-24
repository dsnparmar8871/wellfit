// Fallback hardcoded structure (for backward compatibility)
const DEFAULT_CATEGORY_STRUCTURE = Object.freeze({
  Clothes: Object.freeze({
    'Ready-to-Wear': Object.freeze(['Shirt', 'Trouser', 'Jeans', 'Hoody', 'T-Shirt', 'Jacket']),
    'Custom Tailored': Object.freeze(['Shirt', 'Pant', 'Kurta-Koti', 'Blazer', 'Jodhpuri', 'Indo-Western', 'Sherwani']),
  }),
  Accessories: Object.freeze(['Socks', 'Hanky', 'Vest', 'Trunk', 'Wallet', 'Belt', 'Perfume', 'Febric']),
});

let CATEGORY_STRUCTURE = { ...DEFAULT_CATEGORY_STRUCTURE };
let MAIN_CATEGORIES = ['Clothes', 'Accessories'];
let SUB_CATEGORIES = ['Ready-to-Wear', 'Custom Tailored', ''];
let ITEM_CATEGORIES = [
  ...DEFAULT_CATEGORY_STRUCTURE.Clothes['Ready-to-Wear'],
  ...DEFAULT_CATEGORY_STRUCTURE.Clothes['Custom Tailored'],
  ...DEFAULT_CATEGORY_STRUCTURE.Accessories,
].filter((value, index, list) => list.indexOf(value) === index);

// Function to build category structure from API data
const buildCategoryStructure = (categories = []) => {
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

  // Helper to find category by ID
  const findCategoryById = (id) => {
    if (!id) return null;
    const idStr = normalizeId(id);
    return categories.find((cat) => normalizeId(cat._id) === idStr);
  };

  // Pass 1: Create main categories (no parent)
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
    const structure = CATEGORY_STRUCTURE[mainCategory];
    // If it's an array (flat category like Accessories), there are no subcategories
    if (Array.isArray(structure)) {
      return [];
    }
    // If it's an object, check if all values are empty arrays (direct items, not real subcategories)
    const keys = Object.keys(structure);
    const allEmptyArrays = keys.every(key => Array.isArray(structure[key]) && structure[key].length === 0);
    if (allEmptyArrays && keys.length > 0) {
      // All are direct items under main category, not subcategories
      return [];
    }
    // Otherwise, return the subcategory names
    return keys.filter(sub => sub);
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
  const availableItems = getItemCategories(mainCategory, subCategory);
  if (!availableItems.length) return false;
  return availableItems.includes(itemCategory);
};

const getCategoryStructure = () => CATEGORY_STRUCTURE;
const getMainCategories = () => MAIN_CATEGORIES;
const getSubCategoriesList = () => SUB_CATEGORIES;
const getItemCategoriesList = () => ITEM_CATEGORIES;

// Also export the raw values for backward compatibility
export {
  CATEGORY_STRUCTURE,
  MAIN_CATEGORIES,
  SUB_CATEGORIES,
  ITEM_CATEGORIES,
  getSubCategories,
  getItemCategories,
  isValidCategoryPath,
  buildCategoryStructure,
  getCategoryStructure,
  getMainCategories,
  getSubCategoriesList,
  getItemCategoriesList,
};
