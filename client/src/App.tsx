import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import DashboardPage from "./pages/Dashboard/DashboardPage";
import InventoryPage from "./pages/Inventory/InventoryPage";
import LicensesPage from "./pages/Licenses/LicensesPage";
import NetworkPage from "./pages/Network/NetworkPage";
import SwitchesPage from "./pages/Switches/SwitchesPage";
import TodoPage from "./pages/Todo/TodoPage";
import NotesPage from "./pages/Notes/NotesPage";
import ChangelogPage from "./pages/Changelog/ChangelogPage";
import SettingsPage from "./pages/Settings/SettingsPage";
import HelpPage from "./pages/Help/HelpPage";
import UsersPage from "./pages/Users/UsersPage";
import VaultPage from "./pages/Vault/VaultPage";
import Login from "./pages/Login";
import FirstAdminSetup from "./pages/FirstAdminSetup";
import { useAuth } from "./auth/AuthProvider";

export default function App() {
  const { user, loading, needsSetup } = useAuth();

  if (loading) {
    return <div className="min-h-dvh bg-app" />;
  }

  if (!user) {
    return needsSetup ? <FirstAdminSetup /> : <Login />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/switches" element={<SwitchesPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/licenses" element={<LicensesPage />} />
        <Route path="/network" element={<NetworkPage />} />
        <Route path="/todo" element={<TodoPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/changelog" element={<ChangelogPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/vault" element={<VaultPage />} />
        <Route path="/help" element={<HelpPage />} />
      </Route>
    </Routes>
  );
}
