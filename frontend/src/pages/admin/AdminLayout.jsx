import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import PageSkeleton from '../../components/ui/PageSkeleton.jsx';
import AppIcon from '../../components/ui/AppIcon.jsx';

const links = [
  { to: '/admin', label: 'Dashboard', icon: 'chart', end: true },
  { to: '/admin/orders', label: 'Orders', icon: 'box' },
  { to: '/admin/returns', label: 'Returns', icon: 'scissors' },
  { to: '/admin/products', label: 'Products', icon: 'cart' },
  { to: '/admin/categories', label: 'Categories', icon: 'category' },
  { to: '/admin/users', label: 'Customers', icon: 'users' },
  { to: '/admin/tailors', label: 'Tailors', icon: 'needle' },
  { to: '/admin/bills', label: 'Tailor Bills', icon: 'money' },
  { to: '/admin/slots', label: 'Measurement Slots', icon: 'calendar' },
  { to: '/admin/coupons', label: 'Coupons', icon: 'tag' },
];

export default function AdminLayout() {
  const { user, loading } = useAuth();
  if (loading) return <PageSkeleton variant="list" />;
  if (!user || user.role !== 'admin') return <Navigate to="/" />;

  return (
    <div className="admin-layout-shell">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-head">
          <div className="admin-sidebar-title">Admin Panel</div>
          <div className="admin-sidebar-subtitle">Welcome, {user.name}</div>
        </div>
        <nav className="admin-nav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => isActive ? 'admin-link active' : 'admin-link'}>
              <span className="admin-link-icon"><AppIcon name={l.icon} size={16} /></span>
              <span>{l.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <main className="admin-content">
        <Outlet />
      </main>

      <style>{`
        .admin-layout-shell {
          display: flex;
          min-height: calc(100vh - 64px);
          background:
            radial-gradient(circle at 8% 8%, rgba(167,146,119,0.10), transparent 26%),
            linear-gradient(180deg, #FFF7EC 0%, #FFF3E3 100%);
        }

        .admin-sidebar {
          width: 248px;
          flex-shrink: 0;
          color: #DCCFC4;
          background:
            linear-gradient(180deg, #2F2520 0%, #241C18 100%);
          border-right: 1px solid rgba(255,255,255,0.07);
          padding: 18px 0 14px;
          position: sticky;
          top: 64px;
          height: calc(100vh - 64px);
          overflow-y: auto;
          overflow-x: hidden;
        }

        .admin-sidebar-head {
          padding: 0 14px 14px;
          margin: 0 10px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.10);
        }

        .admin-sidebar-title {
          font-family: var(--font-display);
          color: #FFF4E8;
          font-size: 1.05rem;
          font-weight: 700;
          letter-spacing: 0.01em;
        }

        .admin-sidebar-subtitle {
          margin-top: 4px;
          font-size: 11px;
          color: #A88F7A;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .admin-nav {
          display: grid;
          gap: 3px;
          padding: 0 8px;
        }

        .admin-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          color: #C7B5A8;
          font-size: 13px;
          font-weight: 500;
          text-decoration: none;
          border-radius: 10px;
          transition: background-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
        }

        .admin-link-icon {
          display: inline-flex;
          width: 20px;
          justify-content: center;
          opacity: 0.9;
        }

        .admin-link:hover {
          color: #FFF8F1;
          background: rgba(255,255,255,0.08);
          transform: translateX(2px);
        }

        .admin-link.active {
          color: #FFF8F1;
          background: linear-gradient(90deg, rgba(167,146,119,0.35), rgba(167,146,119,0.14));
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);
        }

        .admin-content {
          flex: 1;
          min-width: 0;
          overflow-x: hidden;
          padding: 28px 30px;
        }

        @media (max-width: 900px) {
          .admin-layout-shell {
            flex-direction: column;
          }

          .admin-sidebar {
            width: 100%;
            position: static;
            top: auto;
            height: auto;
            max-height: none;
            overflow: visible;
            border-right: none;
            border-bottom: 1px solid rgba(255,255,255,0.12);
            padding: 12px 0 10px;
          }

          .admin-sidebar-head {
            margin: 0 12px 10px;
            padding: 0 0 10px;
          }

          .admin-nav {
            display: flex;
            gap: 8px;
            padding: 0 12px;
            overflow-x: auto;
            white-space: nowrap;
            scrollbar-width: thin;
          }

          .admin-link {
            flex: 0 0 auto;
            border: 1px solid rgba(255,255,255,0.10);
            background: rgba(255,255,255,0.04);
            border-radius: 999px;
            padding: 9px 12px;
            font-size: 12px;
            transform: none;
          }

          .admin-link:hover {
            transform: none;
          }

          .admin-link.active {
            background: rgba(167,146,119,0.34);
            border-color: rgba(255,255,255,0.24);
          }

          .admin-content {
            padding: 18px 14px;
          }
        }

        @media (max-width: 560px) {
          .admin-content {
            padding: 14px 10px;
          }
        }
      `}</style>
    </div>
  );
}
