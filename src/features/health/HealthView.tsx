import { useEffect, useState } from 'react';
import type { HealthSample } from '../../types';
import { useFetchHealthSeries, useTimeRange } from '../../state/hooks';
import { ViewPlaceholder } from '../../components/ui/ViewPlaceholder';

export default function HealthView() {
  const range = useTimeRange();
  const fetch = useFetchHealthSeries();
  const [samples, setSamples] = useState<HealthSample[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    fetch(range)
      .then((s) => {
        if (alive) setSamples(s);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : 'fetch failed');
      });
    return () => {
      alive = false;
    };
  }, [range, fetch]);

  const last = samples[samples.length - 1];
  return (
    <ViewPlaceholder
      title="Mesh Health"
      subtitle="Metric cards and time-series arriving in Phase 5"
      tagline="One dataset. Many angles."
      stats={[
        { label: 'Samples', value: String(samples.length) },
        { label: 'Range', value: range.label },
        { label: 'Online', value: last ? String(last.nodesOnline) : '—' },
        { label: 'Msg/hr', value: last ? String(last.messagesPerHour) : '—' },
      ]}
      bulletedFeatures={[
        '6–8 metric cards with deltas + sparklines',
        'Time-series charts (messages/hour, packet loss, nodes online)',
        'One global time range — no per-card ranges',
        error ? `⚠ ${error}` : 'Sharing the same mock scenario as the Network view',
      ]}
    />
  );
}
