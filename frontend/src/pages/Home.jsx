import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { productAPI } from '../api/index.js';
import ProductCard from '../components/product/ProductCard.jsx';
import PageSkeleton from '../components/ui/PageSkeleton.jsx';
import AppIcon from '../components/ui/AppIcon.jsx';
import { hasPurchasableStock } from '../utils/helpers.js';

const CATEGORIES = [
  { name: 'Shirt', icon: 'shirt', q: 'Shirt' },
  { name: 'Blazer', icon: 'hat', q: 'Blazer' },
  { name: 'Trouser', icon: 'trouser', q: 'Trouser' },
  { name: 'Indo-Western', icon: 'sparkle', q: 'Indo-Western' },
  { name: 'Jodhpuri', icon: 'needle', q: 'Jodhpuri' },
  { name: 'Accessories', icon: 'bag', q: 'Accessories' },
];

const STYLE_POINTS = [
  {
    icon: 'shirt',
    title: 'Ready Collection',
    desc: 'Modern silhouettes and classic staples for every occasion.',
  },
  {
    icon: 'needle',
    title: 'Bespoke Tailoring',
    desc: 'Custom measurement support for precise fit and comfort.',
  },
  {
    icon: 'sparkle',
    title: 'Premium Finish',
    desc: 'Attention to detail from fabric selection to final stitching.',
  },
];

const REVIEWS = [
  {
    name: 'Rajesh Kumar',
    profession: 'Business Executive',
    image: 'https://i.pravatar.cc/150?u=ramesh',
    stars: 5,
    text: 'The bespoke tailoring service is exceptional. The fit is perfect, and the fabric quality is top-notch. Highly recommended for executive wear.',
  },
  {
    name: 'Amit Sharma',
    profession: 'Advocate',
    image: 'https://i.pravatar.cc/150?u=amit',
    stars: 5,
    text: 'Found the perfect blazer for my court sessions. The stitching is precise, and the service was very professional. Best in the city!',
  },
  {
    name: 'Vikram Singh',
    profession: 'Creative Architect',
    image: 'https://i.pravatar.cc/150?u=men',
    stars: 5,
    text: 'Unique collection of accessories and perfectly tailored shirts. I love how they balance classic styles with modern comfort.',
  },
];

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    productAPI.getAll({ limit: 8, sort: '-createdAt', featured: 'true' })
      .then(({ data }) => {
        const list = Array.isArray(data.data) ? data.data : (data.data?.products || []);
        setFeatured(list.filter(hasPurchasableStock));
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="home-page-shell">
      <section className="home-hero">
        <div className="home-hero-noise" />
        <div className="container home-hero-grid" style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 44, alignItems: 'center', position: 'relative', zIndex: 2 }}>
          <div>
            <div className="home-kicker">Premium Menswear</div>
            <h1 className="home-title">
              Dressed to Fit.<br />
              <span>Tailored to Last.</span>
            </h1>
            <p className="home-subtitle">
              Explore premium fabrics, ready-made collections, and bespoke stitching. Every piece crafted to make you look your best.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
              <Link to="/products" className="btn btn-primary btn-lg">Shop Now</Link>
              <Link to="/products?mainCategory=Clothes&subCategory=Custom%20Tailored" className="btn btn-outline btn-lg">Custom Stitching</Link>
            </div>

            <div className="home-hero-tags">
              <span>Premium Fabrics</span>
              <span>Tailor Ready</span>
              <span>Modern Fits</span>
            </div>
          </div>

          <div className="home-hero-visual">
            <div className="home-hero-image-wrap">
              <img
                src="/hero-tailor.jpg"
                alt="Tailored black suit on mannequin"
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
              <div className="home-floating-card home-floating-left">
                <AppIcon name="needle" size={18} />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>Bespoke Finish</div>
                  <div style={{ fontSize: 12, color: 'var(--text-light)' }}>Detailed craftsmanship</div>
                </div>
              </div>
              <div className="home-floating-card home-floating-right">
                <AppIcon name="bag" size={18} />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>Curated Selection</div>
                  <div style={{ fontSize: 12, color: 'var(--text-light)' }}>From daily to occasion wear</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-style-points-section" style={{ padding: '56px 0 24px' }}>
        <div className="container">
          <div className="home-style-points">
            {STYLE_POINTS.map((point) => (
              <div key={point.title} className="home-style-card">
                <div style={{ display: 'inline-flex', marginBottom: 12 }}>
                  <AppIcon name={point.icon} size={24} />
                </div>
                <h3 style={{ marginBottom: 8 }}>{point.title}</h3>
                <p style={{ color: 'var(--text-light)', fontSize: 14 }}>{point.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '28px 0 64px' }}>
        <div className="container">
          <div className="home-section-head">
            <div>
              <div className="home-mini-kicker">Collections</div>
              <h2 className="section-title" style={{ marginBottom: 0 }}>Shop by Category</h2>
            </div>
          </div>

          <div className="home-category-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14 }}>
            {CATEGORIES.map((c) => (
              <Link
                key={c.name}
                to={c.q === 'Accessories' ? '/products?mainCategory=Accessories' : `/products?itemCategory=${encodeURIComponent(c.q)}`}
                style={{ textDecoration: 'none' }}
              >
                <div className="home-category-tile">
                  <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
                    <AppIcon name={c.icon} size={28} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '0 0 72px' }}>
        <div className="container home-featured-shell">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div className="home-mini-kicker">Latest Edit</div>
              <h2 className="section-title" style={{ marginBottom: 0 }}>New Arrivals</h2>
            </div>
            <Link to="/products" style={{ fontSize: 14, fontWeight: 500, color: 'var(--brown)' }}>View All →</Link>
          </div>

          {loading ? (
            <PageSkeleton variant="grid" />
          ) : (
            <div className="grid-4">
              {featured.slice(0, 8).map((p) => <ProductCard key={p._id} product={p} showRating={false} />)}
            </div>
          )}
        </div>
      </section>

      <section className="home-testimonials">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ color: '#fff', marginBottom: -15 }}>What Our Customers Say!</h2>
          </div>

          <div className="home-reviews-horizontal">
            {REVIEWS.map((r, i) => (
              <div key={i} className="home-review-card">
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                  <img src={r.image} alt={r.name} style={{ width: 44, height: 44, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.2)' }} />
                  <div>
                    <div style={{ color: '#F4EAE0', fontWeight: 600, fontSize: 14 }}>{r.name}</div>
                    <div style={{ color: '#D2C3B9', fontSize: 11 }}>{r.profession}</div>
                  </div>
                </div>
                <div style={{ color: '#D4AF37', fontSize: 12, marginBottom: 10 }}>
                  {'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}
                </div>
                <p style={{ color: '#D2C3B9', fontSize: 14, lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>
                  &ldquo;{r.text}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <style>{`
        .home-page-shell {
          background:
            radial-gradient(circle at 85% 10%, rgba(167,146,119,0.12), transparent 34%),
            linear-gradient(180deg, #FFF6EB 0%, #FFF2E1 34%, #FFF8EF 62%, #FFF3E3 100%);
        }

        .home-hero {
          position: relative;
          padding: 84px 0 56px;
          overflow: hidden;
          background:
            radial-gradient(circle at 8% 14%, rgba(196,174,150,0.45), transparent 30%),
            radial-gradient(circle at 90% 85%, rgba(167,146,119,0.20), transparent 36%),
            linear-gradient(138deg, #FFF4E6 0%, #F7E6CD 54%, #F0DBC0 100%);
        }

        .home-hero-noise {
          position: absolute;
          inset: 0;
          background-image: linear-gradient(120deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.02) 100%);
          pointer-events: none;
        }

        .home-kicker,
        .home-mini-kicker {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--brown);
        }

        .home-kicker { margin-bottom: 14px; }
        .home-mini-kicker { margin-bottom: 8px; }

        .home-title {
          margin-bottom: 18px;
          line-height: 1.05;
          font-size: clamp(2.1rem, 5vw, 3.55rem);
        }

        .home-title span { color: #8E7056; }

        .home-subtitle {
          font-size: 16px;
          color: var(--text-light);
          margin-bottom: 0;
          line-height: 1.75;
          max-width: 500px;
        }

        .home-hero-tags {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .home-hero-tags span {
          font-size: 12px;
          padding: 7px 11px;
          border-radius: 999px;
          background: rgba(255,255,255,0.62);
          border: 1px solid rgba(167,146,119,0.45);
          color: #6D5440;
          backdrop-filter: blur(3px);
        }

        .home-hero-image-wrap {
          position: relative;
          width: min(480px, 100%);
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 16px 36px rgba(65,45,31,0.20);
          border: 1px solid rgba(167,146,119,0.42);
          background: #f7f3ee;
        }

        .home-floating-card {
          position: absolute;
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(255,255,255,0.9);
          border: 1px solid #E8D8C6;
          border-radius: 12px;
          padding: 10px 12px;
          box-shadow: 0 6px 16px rgba(44,36,32,0.12);
        }

        .home-floating-left { left: 12px; bottom: 12px; }
        .home-floating-right { right: 12px; top: 12px; }

        .home-style-points {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .home-style-card {
          background: rgba(255,255,255,0.85);
          border: 1px solid #E8D8C6;
          border-radius: 14px;
          padding: 18px;
          box-shadow: 0 8px 18px rgba(58,43,33,0.06);
        }

        .home-section-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 22px;
          gap: 14px;
        }

        .home-category-tile {
          background: linear-gradient(180deg, #FFFCF7 0%, #FDF1E4 100%);
          border: 1px solid #E3D1BF;
          border-radius: var(--radius-lg);
          padding: 20px 12px;
          text-align: center;
          transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
          cursor: pointer;
          box-shadow: 0 5px 14px rgba(44,36,32,0.06);
        }

        .home-category-tile:hover {
          transform: translateY(-3px);
          border-color: #B89C7D;
          box-shadow: 0 10px 18px rgba(44,36,32,0.10);
        }

        .home-featured-shell {
          background: rgba(255,255,255,0.64);
          border: 1px solid #E8D7C3;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 10px 24px rgba(58,43,33,0.08);
        }

        .home-testimonials {
          background:
            radial-gradient(circle at 88% 12%, rgba(255,255,255,0.10), transparent 35%),
            linear-gradient(125deg, #2C2420 0%, #3E3028 52%, #4A372E 100%);
          padding: 25px 0;
          margin-bottom: 0;
        }

        .home-reviews-horizontal {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        
        .home-review-card {
          color: #D2C3B9;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          border-radius: 16px;
          padding: 24px;
          backdrop-filter: blur(4px);
          transition: all 0.3s ease;
        }
        
        .home-review-card:hover {
          transform: translateY(-8px);
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.2);
          box-shadow: 0 12px 24px rgba(0,0,0,0.2);
        }

        @media (max-width: 1024px) {
          .home-hero-grid { grid-template-columns: 1fr 1fr !important; gap: 28px !important; }
          .home-category-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          .home-style-points { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .home-reviews-horizontal { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 700px) {
          .home-hero { padding: 48px 0 32px; }
          .home-hero-grid { grid-template-columns: 1fr !important; gap: 24px !important; text-align: center; }
          .home-hero-visual { display: none !important; }
          .home-subtitle { margin: 0 auto 20px auto; }
          .home-hero-tags { justify-content: center; }
          .home-hero-grid > div:first-child { display: flex; flex-direction: column; align-items: center; }
          .home-hero-grid > div:first-child > div:nth-child(4) { justify-content: center; }
          
          .home-kicker { font-size: 11px; margin-bottom: 10px; }
          .home-title { font-size: 2.2rem !important; margin-bottom: 16px; }
          .home-subtitle { font-size: 14px; line-height: 1.6; }
          .home-category-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 10px !important; }
          .home-style-points { grid-template-columns: 1fr; }
          .home-featured-shell { padding: 12px; }
          .home-style-points-section { display: none !important; }
          .home-testimonials { padding: 20px 0; }
          .home-reviews-horizontal { 
            display: flex;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            gap: 16px;
            padding: 0 4px 16px 4px;
            margin: 0 -4px;
            -webkit-overflow-scrolling: touch;
          }
          .home-reviews-horizontal::-webkit-scrollbar { display: none; }
          .home-review-card { 
            flex: 0 0 85%;
            scroll-snap-align: center;
            padding: 24px;
          }
          .home-review-card:hover { transform: none; }
        }
      `}</style>
    </div>
  );
}
