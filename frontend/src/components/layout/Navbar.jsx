import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCart } from '../../context/CartContext.jsx';
import { useFavorites } from '../../context/FavoritesContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import AppIcon from '../ui/AppIcon.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const { favoriteCount } = useFavorites();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Brand Legacy', href: '/legacy.html' },
    { label: 'Products', to: '/products?mainCategory=Clothes' },
  ];

  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
    setUserMenuOpen(false);
    setMobileOpen(false);
  };

  const handleFavoritesClick = (e) => {
    if (user) return;
    e.preventDefault();
    toast.error('Please login to use favorites');
    navigate('/login');
  };

  return (
    <>
      <nav style={{
        background: scrolled ? 'rgba(255, 255, 255, 0.7)' : 'var(--white)',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
        border: '1px solid',
        borderColor: scrolled ? 'transparent' : 'var(--border)',
        borderRadius: scrolled ? '40px' : '0px',
        margin: '0 auto',
        marginTop: scrolled ? '8px' : '0px',
        width: scrolled ? '85%' : '100%',
        maxWidth: '1900px',
        position: 'sticky',
        top: scrolled ? 8 : 0,
        zIndex: 500,
        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: scrolled ? 'var(--shadow)' : 'none',
      }}>
        <div className="container wf-nav-shell" style={{ display: 'flex', alignItems: 'center', minHeight: 78, gap: 20, paddingTop: 6, paddingBottom: 6 }}>
          <Link to="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: 10, flexShrink: 0,
          }}>
            <img src="/wellfit-logo.png" alt="Wellfit" style={{
              height: 56, width: 'auto', display: 'block',
              filter: scrolled ? 'brightness(0.7) contrast(1.1)' : 'none',
              transition: 'filter 0.4s ease',
            }} />
            <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
              <span className="wf-brand-title" style={{
                fontFamily: 'var(--font-display)', fontSize: '1.9rem', fontWeight: 700,
                color: scrolled ? 'var(--text)' : 'var(--brown)', letterSpacing: '-0.02em',
                transition: 'color 0.4s ease',
              }}>
                Wellfit
              </span>
              <span className="wf-brand-subtitle" style={{
                fontSize: 11, fontWeight: 500,
                color: scrolled ? 'var(--text)' : 'var(--text-light)',
                letterSpacing: '0.07em', textTransform: 'uppercase',
                transition: 'color 0.4s ease',
              }}>
                Menswear & Selection
              </span>
            </span>
          </Link>

          <div style={{ display: 'flex', gap: 2, flex: 1 }} className="wf-desktop-nav">
            {navLinks.map((item) => {
              const isActive = item.to ? location.pathname === item.to : false;
              const commonStyle = {
                padding: '6px 12px', borderRadius: 6, fontSize: 14, fontWeight: 500,
                color: isActive ? 'var(--brown)' : (scrolled ? 'var(--text)' : 'var(--text-light)'),
                background: isActive ? '#F5EDE2' : 'transparent',
                transition: 'all 0.3s ease',
              };

              if (item.href) {
                return (
                  <a key={item.href} href={item.href} style={commonStyle}>
                    {item.label}
                  </a>
                );
              }

              return (
                <Link key={item.to} to={item.to} style={commonStyle}>
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="wf-shell-actions" style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            <Link to="/favorites" onClick={handleFavoritesClick} title="Favorites" style={{
              position: 'relative', display: 'inline-flex', alignItems: 'center',
              justifyContent: 'center', width: 38, height: 38, borderRadius: '50%',
              background: 'var(--cream)', color: 'var(--text)',
            }}>
              <AppIcon name="heart" size={18} />
              {favoriteCount > 0 && (
                <span style={{
                  position: 'absolute', top: 1, right: 1, background: 'var(--brown)',
                  color: '#fff', borderRadius: '50%', fontSize: 9, fontWeight: 700,
                  width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {favoriteCount > 9 ? '9+' : favoriteCount}
                </span>
              )}
            </Link>

            <Link to="/cart" title="Cart" style={{
              position: 'relative', display: 'inline-flex', alignItems: 'center',
              justifyContent: 'center', width: 38, height: 38, borderRadius: '50%',
              background: 'var(--cream)', color: 'var(--text)',
            }}>
              <AppIcon name="cart" size={18} />
              {count > 0 && (
                <span style={{
                  position: 'absolute', top: 1, right: 1, background: 'var(--brown)',
                  color: '#fff', borderRadius: '50%', fontSize: 9, fontWeight: 700,
                  width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </Link>

            {user ? (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="wf-desktop-user"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px 5px 6px',
                    border: '1.5px solid var(--border)', borderRadius: 20,
                    background: 'none', cursor: 'pointer',
                  }}
                >
                  <span style={{
                    width: 26, height: 26, borderRadius: '50%', background: 'var(--brown)',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, flexShrink: 0,
                  }}>{user.name?.[0]?.toUpperCase() || 'U'}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.name?.split(' ')[0]}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-light)' }}>▼</span>
                </button>

                {userMenuOpen && (
                  <>
                    <div onClick={() => setUserMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
                    <div style={{
                      position: 'absolute', right: 0, top: 46, zIndex: 99,
                      background: '#fff', border: '1px solid var(--border)', borderRadius: 10,
                      boxShadow: 'var(--shadow-lg)', minWidth: 190, overflow: 'hidden',
                    }}>
                      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-light)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>{user.name}</div>
                        <div>{user.role}</div>
                      </div>
                      {user.role === 'admin' && (
                        <Link to="/admin" onClick={() => setUserMenuOpen(false)} style={{ display: 'block', padding: '10px 16px', fontSize: 14, color: 'var(--text)' }}>
                          Admin Dashboard
                        </Link>
                      )}
                      {user.role === 'tailor' && (
                        <Link to="/tailor" onClick={() => setUserMenuOpen(false)} style={{ display: 'block', padding: '10px 16px', fontSize: 14, color: 'var(--text)' }}>
                          Tailor Dashboard
                        </Link>
                      )}
                      <Link to="/profile" onClick={() => setUserMenuOpen(false)} style={{ display: 'block', padding: '10px 16px', fontSize: 14, color: 'var(--text)' }}>My Profile</Link>
                      <Link to="/profile/orders" onClick={() => setUserMenuOpen(false)} style={{ display: 'block', padding: '10px 16px', fontSize: 14, color: 'var(--text)' }}>My Orders</Link>
                      <Link to="/profile/measurements" onClick={() => setUserMenuOpen(false)} style={{ display: 'block', padding: '10px 16px', fontSize: 14, color: 'var(--text)' }}>Measurements</Link>
                      <button
                        onClick={handleLogout}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px',
                          fontSize: 14, color: 'var(--error)', border: 'none', background: 'none',
                          cursor: 'pointer', borderTop: '1px solid var(--border)',
                        }}
                      >Logout</button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="wf-auth-buttons" style={{ display: 'flex', gap: 8 }}>
                <Link to="/login" className="btn btn-outline btn-sm">Login</Link>
                <Link to="/register" className="btn btn-primary btn-sm">Sign Up</Link>
              </div>
            )}

            <button onClick={() => setMobileOpen((v) => !v)} className="wf-mobile-toggle"
              style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--text)' }}>
              {mobileOpen ? '✕' : <AppIcon name="user" size={20} />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div style={{ borderTop: '1px solid var(--border)', background: '#fff' }} className="wf-mobile-nav">
            <div className="container" style={{ paddingTop: 12, paddingBottom: 16, display: 'grid', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: 10 }}>Account</div>
                {user ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ padding: '14px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--cream)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{user.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{user.role}</div>
                    </div>
                    {user.role === 'admin' && (
                      <Link to="/admin" onClick={() => setMobileOpen(false)} style={{ display: 'block', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-card)', color: 'var(--text)' }}>
                        Admin Dashboard
                      </Link>
                    )}
                    {user.role === 'tailor' && (
                      <Link to="/tailor" onClick={() => setMobileOpen(false)} style={{ display: 'block', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-card)', color: 'var(--text)' }}>
                        Tailor Dashboard
                      </Link>
                    )}
                    <Link to="/profile" onClick={() => setMobileOpen(false)} style={{ display: 'block', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-card)', color: 'var(--text)' }}>My Profile</Link>
                    <Link to="/profile/orders" onClick={() => setMobileOpen(false)} style={{ display: 'block', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-card)', color: 'var(--text)' }}>My Orders</Link>
                    <Link to="/profile/measurements" onClick={() => setMobileOpen(false)} style={{ display: 'block', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-card)', color: 'var(--text)' }}>Measurements</Link>
                    <button
                      onClick={handleLogout}
                      style={{
                        width: '100%', textAlign: 'left', padding: '12px 14px',
                        fontSize: 14, color: 'var(--error)', border: '1px solid #F1C5C0', background: '#FDEDEA',
                        cursor: 'pointer', borderRadius: 12,
                      }}
                    >Logout</button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <Link to="/login" onClick={() => setMobileOpen(false)} className="btn btn-outline btn-sm" style={{ justifyContent: 'center' }}>Login</Link>
                    <Link to="/register" onClick={() => setMobileOpen(false)} className="btn btn-primary btn-sm" style={{ justifyContent: 'center' }}>Sign Up</Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      <style>{`
        .wf-shell-actions { flex-wrap: wrap; }
        @media (max-width: 900px) {
          .wf-brand-subtitle { display: none; }
          .wf-brand-title { font-size: 1.6rem !important; }
          .wf-shell-actions { gap: 8px; }
        }
        @media (max-width: 768px) {
          .wf-desktop-nav { display: none !important; }
          .wf-desktop-user,
          .wf-auth-buttons { display: none !important; }
          .wf-mobile-toggle { display: inline-flex !important; align-items: center; justify-content: center; }
          .wf-brand-title { font-size: 1.35rem !important; }
          .wf-nav-shell { min-height: 68px !important; gap: 12px !important; }
          .wf-nav-shell > a { max-width: 56vw; }
          .wf-nav-shell img { height: 44px !important; }
          .wf-mobile-nav .btn { width: 100%; }
        }
      `}</style>
    </>
  );
}
