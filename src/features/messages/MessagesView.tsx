import { useAllMessages, useLiveMessages } from '../../state/hooks';
import { ViewPlaceholder } from '../../components/ui/ViewPlaceholder';

export default function MessagesView() {
  const messages = useAllMessages();
  const live = useLiveMessages();
  return (
    <ViewPlaceholder
      title="Messages"
      subtitle="Packet log with filters and hop-path highlight"
      tagline="Chronological stream of everything on the mesh."
      stats={[
        { label: 'Total', value: messages.loading ? '—' : String(messages.data.length) },
        { label: 'Live', value: String(live.length) },
      ]}
      bulletedFeatures={[
        'Virtualized newest-first log',
        'Filter by sender, destination, portnum, channel, time range',
        'Click a row → hop path highlights on the mini graph',
        'via_mqtt packets visually distinguished',
      ]}
    />
  );
}
