import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

const NetworkView = lazy(() => import('../features/network/NetworkView'));
const MessagesView = lazy(() => import('../features/messages/MessagesView'));
const HealthView = lazy(() => import('../features/health/HealthView'));
const DevicesView = lazy(() => import('../features/devices/DevicesView'));

function ViewFallback() {
  return (
    <div
      style={{
        padding: '2rem',
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-tertiary)',
        fontSize: '0.8rem',
        letterSpacing: '0.08em',
      }}
    >
      Loading view…
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<ViewFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/network" replace />} />
        <Route path="/network" element={<NetworkView />} />
        <Route path="/messages" element={<MessagesView />} />
        <Route path="/health" element={<HealthView />} />
        <Route path="/devices" element={<DevicesView />} />
        <Route path="*" element={<Navigate to="/network" replace />} />
      </Routes>
    </Suspense>
  );
}
