import { Link } from 'react-router-dom';
import { MAIN_CATEGORIES } from '../../config/categories.js';

export default function Footer() {
  return (
    <footer className="wf-footer" style={{ background: 'var(--text)', color: '#C9B8AC', padding: '40px 0 20px', marginTop: 60 }}>
      <div className="container">
        <div className="grid-3 wf-footer-main" style={{ marginBottom: 32 }}>
          <div className="wf-footer-brand">
            <img src="/wellfit-logo.png" alt="Wellfit" className="wf-footer-logo" style={{ height: 52, width: 'auto', marginBottom: 12, display: 'block' }} />
            <p className="wf-footer-text" style={{ fontSize: 13, lineHeight: 1.7, color: '#A09090' }}>
              Premium menswear and custom tailoring. Crafted to perfection, fitted to you.
            </p>
          </div>
          <div className="wf-footer-shop">
            <div style={{ fontWeight: 600, color: '#fff', marginBottom: 12, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shop</div>
            {[['Products', '/products'], ...MAIN_CATEGORIES.map((category) => [category, `/products?mainCategory=${encodeURIComponent(category)}`])].map(([l, to]) => (
              <Link key={to} to={to} className="wf-footer-link" style={{ display: 'block', fontSize: 13, color: '#A09090', marginBottom: 6 }}>{l}</Link>
            ))}
          </div>
          <div className="wf-footer-about" style={{ justifySelf: 'end', textAlign: 'left' }}>
            <div style={{ fontWeight: 600, color: '#fff', marginBottom: 12, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>About Us</div>
            <p className="wf-footer-text" style={{ fontSize: 13, lineHeight: 1.7, color: '#A09090', marginBottom: 6 }}>
              Address: 6, Lohiya Sadan, Soni Ni Chali Cross Road, Ahmedabad, Gujarat – 382415, India
            </p>
            <a
              href="https://maps.app.goo.gl/Wiu38obUjp5xsf62A"
              target="_blank"
              rel="noreferrer"
              className="wf-footer-link"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#A09090', marginBottom: 8 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Google Map
            </a>
            <p className="wf-footer-text" style={{ fontSize: 13, color: '#A09090', marginBottom: 6 }}>Mobile No.: 1234567890</p>
            <p className="wf-footer-text" style={{ fontSize: 13, color: '#A09090' }}>Email: contact@wellfitms.com</p>
            <a href="/legacy.html" className="wf-footer-legacy-mobile" style={{
              marginTop: 10,
              display: 'none',
              width: 'fit-content',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #5A4B43',
              color: '#D9CFC8',
              fontSize: 12,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              background: 'rgba(255,255,255,0.02)',
            }}>
              Our Legacy
            </a>
          </div>
        </div>
        <div className="wf-footer-bottom" style={{ borderTop: '1px solid #3A3030', paddingTop: 20, fontSize: 12, color: '#706060', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span>© {new Date().getFullYear()} Wellfit Menswear & Selection. All rights reserved.</span>
          <span>Made by Darshan, Harsh & Kartik.</span>
        </div>
      </div>
      <style>{`
        .wf-footer-link {
          transition: color 0.18s ease;
        }
        .wf-footer-link:hover {
          color: #E2D4CB !important;
        }

        @media (max-width: 768px) {
          .wf-footer {
            margin-top: 40px !important;
            padding: 30px 0 16px !important;
          }
          .wf-footer-main {
            grid-template-columns: 1fr 1fr !important;
            gap: 20px !important;
            margin-bottom: 22px !important;
          }
          .wf-footer-brand {
            grid-column: 1 / -1;
          }
          .wf-footer-shop,
          .wf-footer-about {
            justify-self: stretch !important;
          }
          .wf-footer-logo {
            height: 44px !important;
            margin-bottom: 10px !important;
          }
          .wf-footer-text,
          .wf-footer-link {
            font-size: 12px !important;
            line-height: 1.6;
          }
          .wf-footer-bottom {
            flex-direction: column;
            align-items: flex-start;
            gap: 6px !important;
            font-size: 11px !important;
            padding-top: 14px !important;
          }
          .wf-footer-legacy-mobile {
            display: inline-flex !important;
            align-items: center;
            justify-content: center;
          }
        }

        @media (max-width: 420px) {
          .wf-footer {
            padding: 26px 0 14px !important;
          }
          .wf-footer-main {
            grid-template-columns: 1fr 1fr !important;
            gap: 14px !important;
          }
        }
      `}</style>
    </footer>
  );
}
