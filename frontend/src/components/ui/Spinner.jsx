export default function Spinner({ size = 'sm', center = false }) {
  const el = <div className={`spinner${size === 'lg' ? ' spinner-lg' : ''}`} />;
  return center ? <div className="loading-center">{el}</div> : el;
}
