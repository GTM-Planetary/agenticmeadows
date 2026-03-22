import { Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "./hooks/useAuth";
import Sidebar from "./components/layout/Sidebar";
import TopBar from "./components/layout/TopBar";
import AIChatPanel from "./components/layout/AIChatPanel";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Schedule from "./pages/Schedule";
import Quotes from "./pages/Quotes";
import Invoices from "./pages/Invoices";
import Jobs from "./pages/Jobs";
import JobDetail from "./pages/JobDetail";
import ServiceCatalog from "./pages/ServiceCatalog";
import Settings from "./pages/Settings";
import AIActivity from "./pages/AIActivity";
import Reports from "./pages/Reports";
import Maintenance from "./pages/Maintenance";

function ProtectedLayout() {
  const [chatOpen, setChatOpen] = useState(false);
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Left Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar
          user={user}
          onLogout={logout}
          onToggleChat={() => setChatOpen((v) => !v)}
          chatOpen={chatOpen}
        />
        <main className="flex-1 overflow-auto p-6">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/clients/:id" element={<ClientDetail />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/quotes" element={<Quotes />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/services" element={<ServiceCatalog />} />
            <Route path="/maintenance" element={<Maintenance />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/ai-activity" element={<AIActivity />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>

      {/* AI Chat Panel — persistent slide-out drawer */}
      <AIChatPanel isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route
        path="/*"
        element={isAuthenticated ? <ProtectedLayout /> : <Navigate to="/login" replace />}
      />
    </Routes>
  );
}
