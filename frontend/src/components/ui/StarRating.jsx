export default function StarRating({ rating = 0, count, size = 14 }) {
  const stars = Array.from({ length: 5 }, (_, i) => i < Math.round(rating) ? '★' : '☆');
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ color: '#D4AC0D', fontSize: size, letterSpacing: 1 }}>{stars.join('')}</span>
      {count !== undefined && <span style={{ fontSize: size - 2, color: 'var(--text-light)' }}>({count})</span>}
    </span>
  );
}
