import { Navigate, Route, Routes } from 'react-router-dom';
import NetworkView from '../features/network/NetworkView';
import MessagesView from '../features/messages/MessagesView';
import HealthView from '../features/health/HealthView';
import DevicesView from '../features/devices/DevicesView';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/network" replace />} />
      <Route path="/network" element={<NetworkView />} />
      <Route path="/messages" element={<MessagesView />} />
      <Route path="/health" element={<HealthView />} />
      <Route path="/devices" element={<DevicesView />} />
      <Route path="*" element={<Navigate to="/network" replace />} />
    </Routes>
  );
}
