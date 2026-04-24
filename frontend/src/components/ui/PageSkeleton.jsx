import Skeleton from './Skeleton.jsx';

function GridSkeleton({ cards = 8 }) {
  return (
    <div className="grid-4 wf-skeleton-grid">
      {Array.from({ length: cards }).map((_, idx) => (
        <div key={idx} className="wf-skeleton-card">
          <Skeleton className="wf-skeleton-media" />
          <div className="wf-skeleton-content">
            <Skeleton className="wf-skeleton-line wf-skeleton-line-sm" />
            <Skeleton className="wf-skeleton-line" />
            <Skeleton className="wf-skeleton-line wf-skeleton-line-xs" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 6 }) {
  return (
    <div className="wf-skeleton-table-wrap">
      <div className="wf-skeleton-table-head">
        <Skeleton className="wf-skeleton-line" />
      </div>
      <div className="wf-skeleton-table-body">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="wf-skeleton-table-row">
            <Skeleton className="wf-skeleton-line wf-skeleton-line-xs" />
            <Skeleton className="wf-skeleton-line wf-skeleton-line-sm" />
            <Skeleton className="wf-skeleton-line wf-skeleton-line-xs" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="wf-skeleton-detail">
      <Skeleton className="wf-skeleton-media-lg" />
      <div className="wf-skeleton-panel">
        <Skeleton className="wf-skeleton-line wf-skeleton-line-sm" />
        <Skeleton className="wf-skeleton-line wf-skeleton-line-lg" />
        <Skeleton className="wf-skeleton-line" />
        <Skeleton className="wf-skeleton-line wf-skeleton-line-xs" />
        <div className="wf-skeleton-actions">
          <Skeleton className="wf-skeleton-btn" />
          <Skeleton className="wf-skeleton-btn" />
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="grid-4 wf-skeleton-grid wf-skeleton-dashboard-cards">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="wf-skeleton-panel">
            <Skeleton className="wf-skeleton-line wf-skeleton-line-xs" />
            <Skeleton className="wf-skeleton-line wf-skeleton-line-sm" />
            <Skeleton className="wf-skeleton-line wf-skeleton-line-xs" />
          </div>
        ))}
      </div>
      <TableSkeleton rows={5} />
    </>
  );
}

function AnalyticsSkeleton() {
  return (
    <>
      <div className="grid-4 wf-skeleton-grid wf-skeleton-dashboard-cards">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="wf-skeleton-panel">
            <Skeleton className="wf-skeleton-line wf-skeleton-line-xs" />
            <Skeleton className="wf-skeleton-line wf-skeleton-line-sm" />
          </div>
        ))}
      </div>
      <div className="wf-skeleton-panel">
        <Skeleton className="wf-skeleton-line wf-skeleton-line-sm" />
        <Skeleton className="wf-skeleton-chart" />
      </div>
    </>
  );
}

function FormSkeleton() {
  return (
    <div className="wf-skeleton-form">
      {Array.from({ length: 8 }).map((_, idx) => (
        <div key={idx} className="wf-skeleton-form-field">
          <Skeleton className="wf-skeleton-line wf-skeleton-line-xs" />
          <Skeleton className="wf-skeleton-input" />
        </div>
      ))}
      <div className="wf-skeleton-actions">
        <Skeleton className="wf-skeleton-btn" />
        <Skeleton className="wf-skeleton-btn" />
      </div>
    </div>
  );
}

function ModalSkeleton() {
  return (
    <div className="wf-skeleton-modal">
      <Skeleton className="wf-skeleton-line wf-skeleton-line-sm" />
      <Skeleton className="wf-skeleton-line" />
      <Skeleton className="wf-skeleton-line wf-skeleton-line-lg" />
      <Skeleton className="wf-skeleton-line" />
    </div>
  );
}

export default function PageSkeleton({ variant = 'grid' }) {
  return (
    <div className="wf-skeleton-shell" role="status" aria-label="Loading content">
      <div className="wf-skeleton-header">
        <Skeleton className="wf-skeleton-line wf-skeleton-line-sm" />
        <Skeleton className="wf-skeleton-line wf-skeleton-line-xs" />
      </div>

      {variant === 'table' ? <TableSkeleton /> : null}
      {variant === 'detail' ? <DetailSkeleton /> : null}
      {variant === 'list' ? <TableSkeleton rows={4} /> : null}
      {variant === 'grid' ? <GridSkeleton /> : null}
      {variant === 'dashboard' ? <DashboardSkeleton /> : null}
      {variant === 'analytics' ? <AnalyticsSkeleton /> : null}
      {variant === 'form' ? <FormSkeleton /> : null}
      {variant === 'modal' ? <ModalSkeleton /> : null}
    </div>
  );
}
