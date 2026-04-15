import { useNodes, useEdges, useLiveMessages } from '../../state/hooks';
import { ViewPlaceholder } from '../../components/ui/ViewPlaceholder';

export default function NetworkView() {
  const nodes = useNodes();
  const edges = useEdges();
  const liveMessages = useLiveMessages();

  return (
    <ViewPlaceholder
      title="Network Topology"
      subtitle="Force-directed mesh graph arriving in Phase 4"
      tagline="The default view — where the network breathes."
      stats={[
        { label: 'Nodes', value: nodes.loading ? '—' : String(nodes.data.length) },
        { label: 'Edges', value: edges.loading ? '—' : String(edges.data.length) },
        { label: 'Live pkts', value: String(liveMessages.length) },
      ]}
      bulletedFeatures={[
        'Abstract topology, not a real map',
        'Role = color, SNR = glow intensity, throughput = size',
        'Event-driven pulses and signal-line animations',
        'Zoom, pan, drag, click-to-inspect',
      ]}
    />
  );
}
