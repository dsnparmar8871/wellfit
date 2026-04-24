import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext.jsx';

const FavoritesContext = createContext(null);

const baseKey = 'wf_favorites';

const getStorageKey = (userId) => `${baseKey}_${userId || 'guest'}`;

const safeParse = (value) => {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export function FavoritesProvider({ children }) {
  const { user } = useAuth();
  const storageKey = useMemo(() => getStorageKey(user?._id), [user?._id]);
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    setFavorites(safeParse(localStorage.getItem(storageKey)));
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(favorites));
  }, [favorites, storageKey]);

  const isFavorite = (productId) => favorites.some((item) => item.productId === productId);

  const toggleFavorite = (product) => {
    if (!product?._id) return { changed: false, isFavorite: false };

    const productId = product._id;
    const exists = favorites.some((item) => item.productId === productId);

    if (exists) {
      setFavorites((prev) => prev.filter((item) => item.productId !== productId));
      return { changed: true, isFavorite: false };
    }

    const snapshot = {
      productId,
      productName: product.productName || product.name || 'Product',
      price: product.price ?? 0,
      mrp: product.mrp ?? product.price ?? 0,
      images: Array.isArray(product.images) ? product.images : [],
      mainCategory: product.mainCategory || '',
      subCategory: product.subCategory || '',
      itemCategory: product.itemCategory || '',
      variants: Array.isArray(product.variants) ? product.variants : [],
      totalStock: product.totalStock ?? 0,
      avgRating: product.avgRating ?? 0,
      ratings: Array.isArray(product.ratings) ? product.ratings : [],
      isStitchingAvailable: !!product.isStitchingAvailable,
      updatedAt: new Date().toISOString(),
    };

    setFavorites((prev) => [...prev, snapshot]);
    return { changed: true, isFavorite: true };
  };

  return (
    <FavoritesContext.Provider value={{ favorites, favoriteCount: favorites.length, isFavorite, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export const useFavorites = () => {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be within FavoritesProvider');
  return ctx;
};
