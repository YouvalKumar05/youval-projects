import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { WorkflowProvider } from "./context/WorkflowContext";

// Layout
import MainLayout from "./components/MainLayout";
import Login from "./pages/Login";
import BackendStatus from "./components/common/BackendStatus";

// STLC & Testing
import DataInput from "./pages/DataInput";
import AnalysisReview from "./pages/AnalysisReview";
import ExecutionDashboard from "./pages/ExecutionDashboard";
import RegressionCenter from "./pages/RegressionCenter";
import TestConsolePage from "./pages/TestConsole";
import ExecutionConsole from "./pages/Testing/ExecutionConsole";
import ExecutionReport from "./pages/Testing/ExecutionReport";
import ReportsPage from "./pages/Reports";
import TestCaseTable from "./pages/TestCaseTable";

// Enterprise Features
import Overview from "./pages/Overview";
import KanbanBoard from "./pages/Board/KanbanBoard";
import RoleHierarchyTree from "./pages/RBAC/RoleHierarchyTree";
import AdminPanel from './pages/Admin/AdminPanel';
import ProtectedRoute from './components/common/ProtectedRoute';
import VisualBuilder from "./pages/Workflow/VisualBuilder";
import Inbox from "./pages/Communications/Inbox";
import WorkflowBuilder from "./pages/WorkflowBuilder";
import WorkflowStatus from "./pages/Workflow/WorkflowStatus";

// Information/Landing
import Home from "./pages/Home";
import About from "./pages/About";
import HowItWorks from "./pages/HowItWorks";
import CapabilityPages from "./pages/CapabilityPages";
import Contact from "./pages/Contact";
import SettingsPage from "./pages/Settings";

function App() {
  return (
    <Router>
      <BackendStatus />
      <WorkflowProvider>
        <ThemeProvider>
        <Routes>
          {/* Public Website Flow (Optional Auth depending on Preference) */}
          <Route path="/login" element={<Login />} />
          
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/capability" element={<CapabilityPages />} />
            <Route path="/contact" element={<Contact />} />
            
            {/* Functional App Routes (Protected) */}
            <Route path="/overview" element={<ProtectedRoute><Overview /></ProtectedRoute>} />
            <Route path="/data-input" element={<ProtectedRoute><DataInput /></ProtectedRoute>} />
            <Route path="/analysis-review" element={<ProtectedRoute><AnalysisReview /></ProtectedRoute>} />
            <Route path="/analysis-review/:id" element={<ProtectedRoute><AnalysisReview /></ProtectedRoute>} />
            <Route path="/execution-dashboard" element={<ProtectedRoute><ExecutionConsole /></ProtectedRoute>} />
            <Route path="/execution-dashboard/:executionId" element={<ProtectedRoute><ExecutionConsole /></ProtectedRoute>} />
            <Route path="/execution-report/:executionId" element={<ProtectedRoute><ExecutionReport /></ProtectedRoute>} />
            <Route path="/test-cases" element={<ProtectedRoute><TestCaseTable /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
            <Route path="/regression-center" element={<ProtectedRoute><RegressionCenter /></ProtectedRoute>} />
            <Route path="/test-console" element={<ProtectedRoute><TestConsolePage /></ProtectedRoute>} />
            
            <Route path="/tasks" element={<ProtectedRoute><KanbanBoard /></ProtectedRoute>} />
            <Route path="/workflows" element={<ProtectedRoute><VisualBuilder /></ProtectedRoute>} />
            <Route path="/workflow-automation" element={<ProtectedRoute><WorkflowBuilder /></ProtectedRoute>} />
            <Route path="/workflow-status" element={<ProtectedRoute><WorkflowStatus /></ProtectedRoute>} />
            <Route path="/communications" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
            <Route path="/rbac" element={
              <ProtectedRoute allowedPermissions={['rbac:read']}>
                <RoleHierarchyTree />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute allowedPermissions={['admin:read']}>
                <AdminPanel />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ThemeProvider>
    </WorkflowProvider>
  </Router>
  );
}

export default App;
