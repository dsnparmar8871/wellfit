import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProductCard from '../components/product/ProductCard.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { useFavorites } from '../context/FavoritesContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Favorites() {
  const { user } = useAuth();
  const { favorites } = useFavorites();
  const navigate = useNavigate();

  const items = useMemo(() => {
    return favorites
      .filter((item) => !!item.productId)
      .map((item) => ({
        ...item,
        _id: item.productId,
        name: item.productName,
      }));
  }, [favorites]);

  if (!user) {
    return (
      <div className="page">
        <div className="container">
          <EmptyState
            icon="lock"
            title="Login Required"
            description="Please login to view your favorite items."
            action={<button className="btn btn-primary" onClick={() => navigate('/login')}>Go to Login</button>}
          />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="page">
        <div className="container">
          <EmptyState
            icon="heart"
            title="No favorites yet"
            description="Tap the heart icon on any product to save it here."
            action={<Link to="/products" className="btn btn-primary">Browse Products</Link>}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container">
        <h1 style={{ marginBottom: 20 }}>My Favorites</h1>
        <div className="grid-4">
          {items.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      </div>
    </div>
  );
}
