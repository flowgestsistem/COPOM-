export function MapPickBanner({
  title,
  subtitle,
  onCancel,
}: {
  title: string;
  subtitle?: string;
  onCancel: () => void;
}) {
  return (
    <div className="map-pick-banner" role="status">
      <div className="map-pick-banner__text">
        <strong>{title}</strong>
        {subtitle && <span>{subtitle}</span>}
      </div>
      <button type="button" className="map-pick-banner__cancel" onClick={onCancel}>
        Cancelar
      </button>
    </div>
  );
}
