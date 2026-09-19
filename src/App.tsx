import { Navigate, Route, Routes } from 'react-router-dom';
import { AdventureLogPage } from './pages/AdventureLogPage';
import { DiscoveryPage } from './pages/DiscoveryPage';
import { HomePage } from './pages/HomePage';
import { WorldPage } from './pages/WorldPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/demo" element={<HomePage demo />} />
      <Route path="/world" element={<WorldPage />} />
      <Route path="/discovery/:topicId" element={<DiscoveryPage />} />
      <Route path="/log" element={<AdventureLogPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
