export default function Skeleton({ className = '', style }) {
  const cls = ['wf-skeleton', className].filter(Boolean).join(' ');
  return <div className={cls} style={style} aria-hidden="true" />;
}
