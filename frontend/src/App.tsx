import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './stores/authStore'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ClientsPage from './pages/ClientsPage'
import ClientDetailPage from './pages/ClientDetailPage'
import DealsPage from './pages/DealsPage'
import DealDetailPage from './pages/DealDetailPage'
import TasksPage from './pages/TasksPage'
import KPIPage from './pages/KPIPage'
import ChatPage from './pages/ChatPage'
import BacklogPage from './pages/BacklogPage'
import ReportsPage from './pages/ReportsPage'
import CalendarPage from './pages/CalendarPage'
import GlobalSearchPage from './pages/GlobalSearchPage'
import BenchPage from './pages/BenchPage'
import LeadsPage from './pages/LeadsPage'
import LeadDetailPage from './pages/LeadDetailPage'
import PipelinesPage from './pages/settings/PipelinesPage'
import DictionariesPage from './pages/settings/DictionariesPage'
import CustomFieldsPage from './pages/settings/CustomFieldsPage'
import RolesPage from './pages/settings/RolesPage'
import EmployeesPage from './pages/settings/EmployeesPage'
import IntegrationsPage from './pages/settings/IntegrationsPage'
import OtherSettingsPage from './pages/settings/OtherSettingsPage'
import SettingsLayout from './components/settings/SettingsLayout'
import ErrorBoundary from './components/ErrorBoundary'

function AuthInit({ children }: { children: React.ReactNode }) {
  const fetchMe = useAuthStore((s) => s.fetchMe)
  useEffect(() => { fetchMe() }, [fetchMe])
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthInit>
        <ErrorBoundary>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/clients/:id" element={<ClientDetailPage />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/leads/:id" element={<LeadDetailPage />} />
            <Route path="/deals" element={<DealsPage />} />
            <Route path="/deals/:id" element={<DealDetailPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/kpi" element={<KPIPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/search" element={<GlobalSearchPage />} />
            <Route path="/bench" element={<BenchPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/backlog" element={<BacklogPage />} />

            {/* Settings — tab layout wraps 4 main tabs */}
            <Route path="/settings" element={<SettingsLayout />}>
              <Route index element={<Navigate to="/settings/roles" replace />} />
              <Route path="roles" element={<RolesPage />} />
              <Route path="employees" element={<EmployeesPage />} />
              <Route path="integrations" element={<IntegrationsPage />} />
              <Route path="other" element={<OtherSettingsPage />} />
            </Route>

            {/* These stay at their own URLs, linked from Other tab */}
            <Route path="/settings/pipelines" element={<PipelinesPage />} />
            <Route path="/settings/dictionaries" element={<DictionariesPage />} />
            <Route path="/settings/custom-fields" element={<CustomFieldsPage />} />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
        </ErrorBoundary>
      </AuthInit>
    </BrowserRouter>
  )
}
