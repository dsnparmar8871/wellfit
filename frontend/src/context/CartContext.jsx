import { createContext, useContext, useReducer, useEffect } from 'react';
import { useAuth } from './AuthContext.jsx';

const CartContext = createContext(null);

const toSafeMaxStock = (value) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return parsed;
};

const clampQtyToStock = (qty, maxStock) => {
  const safeQty = Number(qty) || 0;
  if (maxStock == null) return safeQty;
  return Math.min(safeQty, maxStock);
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_CART': return action.payload;
    case 'ADD_ITEM': {
      const incomingMaxStock = toSafeMaxStock(action.item.maxStock);
      const requestedQty = action.item.qty || 1;
      const nextQty = clampQtyToStock(requestedQty, incomingMaxStock);
      if (nextQty <= 0) return state;

      const existing = state.find(
        (i) => i.productId === action.item.productId && i.variantId === action.item.variantId
      );
      if (existing) {
        const effectiveMaxStock = toSafeMaxStock(existing.maxStock ?? incomingMaxStock);
        const mergedQty = clampQtyToStock(existing.qty + nextQty, effectiveMaxStock);
        if (mergedQty <= 0) {
          return state.filter(
            (i) => !(i.productId === action.item.productId && i.variantId === action.item.variantId)
          );
        }

        return state.map((i) =>
          i.productId === action.item.productId && i.variantId === action.item.variantId
            ? { ...i, ...action.item, maxStock: effectiveMaxStock, qty: mergedQty }
            : i
        );
      }
      return [...state, { ...action.item, maxStock: incomingMaxStock, qty: nextQty }];
    }
    case 'UPDATE_QTY':
      return state.map((i) =>
        i.productId === action.productId && i.variantId === action.variantId
          ? { ...i, qty: clampQtyToStock(action.qty, toSafeMaxStock(i.maxStock)) }
          : i
      ).filter((i) => i.qty > 0);
    case 'UPDATE_MEASUREMENT':
      return state.map((i) =>
        i.productId === action.productId && i.variantId === action.variantId
          ? { 
              ...i, 
              measurementPreference: action.preference, 
              measurementSlotId: action.slotId || null, 
              measurementTemplateId: action.templateId || null,
              ownMeasurements: action.measurements || null  // Store own measurements data
            }
          : i
      );
    case 'UPDATE_ITEM_NOTE':
      return state.map((i) =>
        i.productId === action.productId && i.variantId === action.variantId
          ? {
              ...i,
              note: action.note,
            }
          : i
      );
    case 'REMOVE': return state.filter(
      (i) => !(i.productId === action.productId && i.variantId === action.variantId)
    );
    case 'CLEAR': return [];
    default: return state;
  }
}

const baseKey = 'wf_cart';

const getStorageKey = (userId) => `${baseKey}_${userId || 'guest'}`;

export function CartProvider({ children }) {
  const { user } = useAuth();
  const storageKey = getStorageKey(user?._id);
  const [items, dispatch] = useReducer(reducer, []);

  // Load cart from localStorage when storageKey changes (user login/logout)
  useEffect(() => {
    const savedCart = localStorage.getItem(storageKey);
    dispatch({ type: 'SET_CART', payload: JSON.parse(savedCart || '[]') });
  }, [storageKey]);

  // Persist cart to localStorage whenever items change
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items, storageKey]);

  const addItem = (item) => {
    const existing = items.find((i) => i.productId === item.productId && i.variantId === item.variantId);
    const currentQty = existing?.qty || 0;
    const requestedQty = Number(item.qty || 1);
    const maxStock = toSafeMaxStock(existing?.maxStock ?? item.maxStock);

    if (maxStock != null && currentQty + requestedQty > maxStock) {
      const addableQty = Math.max(0, maxStock - currentQty);
      if (addableQty > 0) {
        dispatch({ type: 'ADD_ITEM', item: { ...item, qty: addableQty } });
      }
      return {
        limited: true,
        maxStock,
        addableQty,
      };
    }

    dispatch({ type: 'ADD_ITEM', item });
    return {
      limited: false,
      maxStock,
      addableQty: requestedQty,
    };
  };

  const updateQty = (productId, variantId, qty) => {
    const existing = items.find((i) => i.productId === productId && i.variantId === variantId);
    if (!existing) {
      dispatch({ type: 'UPDATE_QTY', productId, variantId, qty });
      return { limited: false, maxStock: null };
    }

    const maxStock = toSafeMaxStock(existing.maxStock);
    const requestedQty = Number(qty) || 0;
    if (maxStock != null && requestedQty > maxStock) {
      dispatch({ type: 'UPDATE_QTY', productId, variantId, qty: maxStock });
      return { limited: true, maxStock };
    }

    dispatch({ type: 'UPDATE_QTY', productId, variantId, qty: requestedQty });
    return { limited: false, maxStock };
  };
  const updateMeasurement = (productId, variantId, preference, slotId, templateIdOrMeasurements) => 
    dispatch({ type: 'UPDATE_MEASUREMENT', productId, variantId, preference, slotId, templateId: typeof templateIdOrMeasurements === 'string' ? templateIdOrMeasurements : null, measurements: typeof templateIdOrMeasurements === 'object' ? templateIdOrMeasurements : null });
  const updateItemNote = (productId, variantId, note) => dispatch({ type: 'UPDATE_ITEM_NOTE', productId, variantId, note });
  const removeItem = (productId, variantId) => dispatch({ type: 'REMOVE', productId, variantId });
  const clearCart = () => dispatch({ type: 'CLEAR' });

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);

  return (
    <CartContext.Provider value={{ items, total, count, addItem, updateQty, updateMeasurement, updateItemNote, removeItem, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be within CartProvider');
  return ctx;
};
