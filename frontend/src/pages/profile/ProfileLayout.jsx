import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import PageSkeleton from '../../components/ui/PageSkeleton.jsx';
import AppIcon from '../../components/ui/AppIcon.jsx';

const links = [
  { to: '/profile', label: 'My Profile', icon: 'user', end: true },
  { to: '/profile/orders', label: 'My Orders', icon: 'box' },
  { to: '/profile/measurements', label: 'Measurements', icon: 'ruler' },
  { to: '/profile/addresses', label: 'Addresses', icon: 'location' },
];

export default function ProfileLayout() {
  const { user, loading } = useAuth();
  if (loading) return <PageSkeleton variant="list" />;
  if (!user) return <Navigate to="/login" state={{ from: '/profile' }} />;

  return (
    <div className="page">
      <div className="container">
        <div className="sidebar-layout">
          <aside>
            <div className="sidebar">
              <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--brown)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
                  {user.name?.[0]?.toUpperCase()}
                </div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{user.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{user.email}</div>
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
          <div>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
