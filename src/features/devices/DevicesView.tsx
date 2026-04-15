import { useDevices } from '../../state/hooks';
import { ViewPlaceholder } from '../../components/ui/ViewPlaceholder';

export default function DevicesView() {
  const devices = useDevices();
  const online = devices.data.filter((d) => d.status === 'online').length;
  const stale = devices.data.filter((d) => d.status === 'stale').length;
  const offline = devices.data.filter((d) => d.status === 'offline').length;
  return (
    <ViewPlaceholder
      title="Devices"
      subtitle="Inventory with sort/filter/inspect — Phase 5"
      tagline="Every node, every firmware, every battery."
      stats={[
        { label: 'Total', value: devices.loading ? '—' : String(devices.data.length) },
        { label: 'Online', value: String(online) },
        { label: 'Stale', value: String(stale) },
        { label: 'Offline', value: String(offline) },
      ]}
      bulletedFeatures={[
        'Sortable columns, toggleable density',
        'Free-text filter + status chips',
        'Full-JSON inspector on row click',
        'CSV/JSON export and "locate on graph" action',
      ]}
    />
  );
}
