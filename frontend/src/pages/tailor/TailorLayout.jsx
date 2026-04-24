import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import PageSkeleton from '../../components/ui/PageSkeleton.jsx';
import AppIcon from '../../components/ui/AppIcon.jsx';

const links = [
  { to: '/tailor', label: 'My Orders', icon: 'box', end: true },
  { to: '/tailor/bills', label: 'My Bills', icon: 'note' },
];

export default function TailorLayout() {
  const { user, loading } = useAuth();
  if (loading) return <PageSkeleton variant="list" />;
  if (!user || user.role !== 'tailor') return <Navigate to="/" />;

  return (
    <div className="page">
      <div className="container">
        <div className="sidebar-layout">
          <aside>
            <div className="sidebar">
              <div style={{ marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--brown)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                  {user.name?.[0]?.toUpperCase()}
                </div>
                <div style={{ fontWeight: 600 }}>{user.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-light)' }}>Tailor</div>
              </div>
              <ul className="sidebar-nav">
                {links.map((l) => (
                  <li key={l.to}>
                    <NavLink to={l.to} end={l.end} className={({ isActive }) => isActive ? 'active' : ''}>
                      <span style={{ display: 'inline-flex', marginRight: 8 }}><AppIcon name={l.icon} size={14} /></span>{l.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
          <div><Outlet /></div>
        </div>
      </div>
    </div>
  );
}
