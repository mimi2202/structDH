// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { LoadingProvider } from './contexts/LoadingContext';
import { AuthProvider } from './contexts/AuthContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { DesignMetaProvider } from './contexts/DesignMetaContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import WorkspaceDashboard from './pages/WorkspaceDashboard';
// Old organisation pages (CreateWorkspace, OrganizationOverview, TeamMembers,
// OrganisationTeam, WorkspaceSettings) are kept on disk but replaced by pages/org/.
import OrgHome from './pages/org/OrgHome';
import OrgCreate from './pages/org/OrgCreate';
import OrgConsole from './pages/org/OrgConsole';
import StructuralInput from './pages/StructuralInput';
import StructuralResults from './pages/StructuralResults';
import ProjectSetup from './pages/ProjectSetup';
// pages/QuickDesign.jsx and NewDesign.jsx (old, mock calculations) are kept on disk, unrouted.
import QuickDesignHome from './pages/quick/QuickDesignHome';
import ProjectDesignHub from './pages/project/ProjectDesignHub';
import ProjectPage from './pages/project/ProjectPage';
import ReportsPage from './pages/reports/ReportsPage';
import ShortcutLayer from './components/ShortcutLayer';
// pages/Projects.jsx (old card grid) kept on disk, unrouted.
import ProjectsPage from './pages/project/ProjectsPage';
// pages/SavedDesigns.jsx and pages/ExternalDesign.jsx (old) kept on disk, unrouted.
import SavedDesignsPage from './pages/saved/SavedDesignsPage';
import ExternalDesignPage from './pages/external/ExternalDesignPage';
import SDHAgentDownload from './pages/SDHAgentDownload';
import MainLayout from './components/layout/MainLayout';
import ResultsDashboard from './pages/ResultsDashboard';
import BeamInput from './pages/BeamInput';
import BeamResults from './pages/BeamResults';
import ContinuousBeamResults from './pages/ContinuousBeamResults';
import ContinuousSlabInput from './pages/ContinuousSlabInput';
import ContinuousSlabResults from './pages/ContinuousSlabResults';
import ColumnInput from './pages/ColumnInput';
import ColumnResults from './pages/ColumnResults';
import FoundationInput from './pages/FoundationInput';
import FoundationResults from './pages/FoundationResults';
import StaircaseInput from './pages/StaircaseInput';
import StaircaseResults from './pages/StaircaseResults';
import Profile from './pages/Profile';
import AccountLayout from './components/layout/AccountLayout';
import Settings from './pages/Settings';
import Help from './pages/Help';
import LoadCases from './pages/LoadCases';
import Materials from './pages/Materials';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LoadingProvider>
          <WorkspaceProvider>
            <NotificationProvider>
              <DesignMetaProvider>
              <BrowserRouter>
                <ShortcutLayer />
                <div className="min-h-screen w-full bg-white dark:bg-[#111827] transition-colors duration-300">
                  <Routes>
                    {/* Public routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<SignUp />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password/:token" element={<ResetPassword />} />

                    {/* Dashboard - NO MainLayout */}
                    <Route path="/dashboard" element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    } />

                    {/* Workspace Routes - NO MainLayout */}
                    <Route path="/reports" element={
                      <ProtectedRoute>
                        <ReportsPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/organisations" element={
                      <ProtectedRoute>
                        <OrgHome />
                      </ProtectedRoute>
                    } />

                    <Route path="/workspace/create" element={
                      <ProtectedRoute>
                        <OrgCreate />
                      </ProtectedRoute>
                    } />

                    <Route path="/workspace/:workspaceId" element={
                      <ProtectedRoute>
                        <OrgConsole />
                      </ProtectedRoute>
                    } />

                    <Route path="/workspace/:workspaceId/projects" element={
                      <ProtectedRoute>
                        <ProjectsPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/workspace/:workspaceId/projects/:projectId" element={
                      <ProtectedRoute>
                        <ProjectPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/workspace/:workspaceId/members" element={
                      <ProtectedRoute>
                        <OrgConsole initialTab="members" />
                      </ProtectedRoute>
                    } />

                    <Route path="/workspace/:workspaceId/team" element={
                      <ProtectedRoute>
                        <OrgConsole initialTab="members" />
                      </ProtectedRoute>
                    } />

                    <Route path="/workspace/:workspaceId/settings" element={
                      <ProtectedRoute>
                        <OrgConsole initialTab="settings" />
                      </ProtectedRoute>
                    } />

                    {/* STRUCTURAL INPUT - WITH MainLayout */}
                    <Route path="/workspace/:workspaceId/projects/:projectId/slab" element={
                      <ProtectedRoute>
                        <MainLayout currentModule="slab" breadcrumb="Slab Design > Two-Way Slab > Input Geometry">
                          <StructuralInput />
                        </MainLayout>
                      </ProtectedRoute>
                    } />

                    <Route path="/workspace/:workspaceId/projects/new/structural-input" element={
                      <ProtectedRoute>
                        <MainLayout currentModule="slab" breadcrumb="Slab Design > Input">
                          <StructuralInput />
                        </MainLayout>
                      </ProtectedRoute>
                    } />

                    <Route path="/workspace/:workspaceId/projects/:projectId/design" element={
                      <ProtectedRoute>
                        <MainLayout currentModule="project-hub" breadcrumb="Projects > Design Hub">
                          <ProjectDesignHub />
                        </MainLayout>
                      </ProtectedRoute>
                    } />

                    <Route path="/workspace/:workspaceId/projects/:projectId/slab-input" element={
                      <ProtectedRoute>
                        <MainLayout currentModule="slab" breadcrumb="Slab Design > Input">
                          <StructuralInput />
                        </MainLayout>
                      </ProtectedRoute>
                    } />

                    <Route path="/structural-input" element={
                      <ProtectedRoute>
                        <MainLayout currentModule="slab" breadcrumb="Slab Design > Input">
                          <StructuralInput />
                        </MainLayout>
                      </ProtectedRoute>
                    } />

                    {/* STRUCTURAL RESULTS - Direct access */}
                    <Route path="/slab-results" element={
                      <ProtectedRoute>
                        <MainLayout currentModule="slab" breadcrumb="Slab Design > Results">
                          <StructuralResults />
                        </MainLayout>
                      </ProtectedRoute>
                    } />

                    {/* STRUCTURAL RESULTS - With workspace/project context */}
                    <Route path="/workspace/:workspaceId/projects/:projectId/slab-results" element={
                      <ProtectedRoute>
                        <MainLayout currentModule="slab" breadcrumb="Slab Design > Results">
                          <StructuralResults />
                        </MainLayout>
                      </ProtectedRoute>
                    } />

                    {/* CONTINUOUS SLAB - WITH MainLayout */}
                    <Route path="/continuous-slab" element={
                      <ProtectedRoute>
                        <MainLayout currentModule="slab" breadcrumb="Slab Design > Continuous Slab > Input">
                          <ContinuousSlabInput />
                        </MainLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/continuous-slab-results" element={
                      <ProtectedRoute>
                        <MainLayout currentModule="slab" breadcrumb="Slab Design > Continuous Slab > Results">
                          <ContinuousSlabResults />
                        </MainLayout>
                      </ProtectedRoute>
                    } />

                    {/* BEAM - WITH MainLayout */}
                    <Route path="/beam" element={
                      <ProtectedRoute>
                        <MainLayout currentModule="beam" breadcrumb="Beam Design > Simply Supported Beam > Input">
                          <BeamInput />
                        </MainLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/continuous-beam" element={
                      <ProtectedRoute>
                        <MainLayout currentModule="beam" breadcrumb="Beam Design > Continuous Beam > Input">
                          <BeamInput />
                        </MainLayout>
                      </ProtectedRoute>
                    } />

                    <Route path="/beam-results" element={
                      <ProtectedRoute>
                        <MainLayout currentModule="beam" breadcrumb="Beam Design > Results">
                          <BeamResults />
                        </MainLayout>
                      </ProtectedRoute>
                    } />

                    <Route path="/continuous-beam-results" element={
                      <ProtectedRoute>
                        <MainLayout currentModule="beam" breadcrumb="Beam Design > Continuous Beam > Results">
                          <ContinuousBeamResults />
                        </MainLayout>
                      </ProtectedRoute>
                    } />
                                      <Route path="/column-input" element={
                    <ProtectedRoute>
                      <MainLayout currentModule="column" breadcrumb="Column Design > Input">
                        <ColumnInput />
                      </MainLayout>
                    </ProtectedRoute>
                  } />
                  <Route path="/column-results" element={
                    <ProtectedRoute>
                      <MainLayout currentModule="column" breadcrumb="Column Design > Results">
                        <ColumnResults />
                      </MainLayout>
                    </ProtectedRoute>
                  } />
                  <Route path="/foundation-input" element={
                    <ProtectedRoute>
                      <MainLayout currentModule="foundation" breadcrumb="Foundation Design > Input">
                        <FoundationInput />
                      </MainLayout>
                    </ProtectedRoute>
                  } />
                  <Route path="/foundation-results" element={
                    <ProtectedRoute>
                      <MainLayout currentModule="foundation" breadcrumb="Foundation Design > Results">
                        <FoundationResults />
                      </MainLayout>
                    </ProtectedRoute>
                  } />
                  <Route path="/foundation-input" element={
                    <ProtectedRoute>
                      <MainLayout currentModule="foundation" breadcrumb="Foundation Design > Input">
                        <FoundationInput />
                      </MainLayout>
                    </ProtectedRoute>
                  } />
                  <Route path="/foundation-results" element={
                    <ProtectedRoute>
                      <MainLayout currentModule="foundation" breadcrumb="Foundation Design > Results">
                        <FoundationResults />
                      </MainLayout>
                    </ProtectedRoute>
                  } />
                  {/* The combined footing lives in /foundation-input. CombinedFootingInput/Results
                      (kept, unused) were written against an older 3-column API and always got a 422. */}
                  <Route path="/combined-input" element={<Navigate to="/foundation-input?type=combined" replace />} />
                  <Route path="/combined-results" element={<Navigate to="/foundation-input?type=combined" replace />} />
                  <Route path="/staircase-design" element={
                    <ProtectedRoute>
                      <MainLayout currentModule="staircase" breadcrumb="Staircase Design > Input">
                        <StaircaseInput />
                      </MainLayout>
                    </ProtectedRoute>
                  } />
                  <Route path="/staircase-results" element={
                    <ProtectedRoute>
                      <MainLayout currentModule="staircase" breadcrumb="Staircase Design > Results">
                        <StaircaseResults />
                      </MainLayout>
                    </ProtectedRoute>
                  } />

                  <Route path="/settings" element={
                    <ProtectedRoute>
                      <AccountLayout title="Settings" subtitle="Report identity, design defaults and backups">
                        <div className="p-4 sm:p-8"><Settings /></div>
                      </AccountLayout>
                    </ProtectedRoute>
                  } />
                  <Route path="/profile" element={
                    <ProtectedRoute>
                      <AccountLayout title="Profile" subtitle="Your details are kept with your account in this browser">
                        <div className="p-4 sm:p-8"><Profile /></div>
                      </AccountLayout>
                    </ProtectedRoute>
                  } />
                  <Route path="/load-cases" element={
                    <ProtectedRoute>
                      <MainLayout currentModule="loads" breadcrumb="Load Cases">
                        <LoadCases />
                      </MainLayout>
                    </ProtectedRoute>
                  } />
                  <Route path="/materials" element={
                    <ProtectedRoute>
                      <MainLayout currentModule="materials" breadcrumb="Materials">
                        <Materials />
                      </MainLayout>
                    </ProtectedRoute>
                  } />
                  <Route path="/help" element={
                    <ProtectedRoute>
                      <AccountLayout title="Help" subtitle="How to use Sphere Design Hub">
                        <div className="p-4 sm:p-8"><Help /></div>
                      </AccountLayout>
                    </ProtectedRoute>
                  } />

                    <Route path="/workspace/:workspaceId/projects/:projectId/results" element={<ResultsDashboard />} />

                    {/* External Design Routes */}
                    <Route path="/workspace/:workspaceId/projects/:projectId/external-design" element={
                      <ProtectedRoute>
                        <ExternalDesignPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/workspace/:workspaceId/projects/:projectId/external-design/:workId" element={
                      <ProtectedRoute>
                        <ExternalDesignPage />
                      </ProtectedRoute>
                    } />

                    {/* Project Setup */}
                    <Route path="/workspace/:workspaceId/projects/new" element={
                      <ProtectedRoute>
                        <ProjectSetup />
                      </ProtectedRoute>
                    } />

                    {/* Quick Design Routes */}
                    <Route path="/new-design" element={<Navigate to="/quick-design" replace />} />

                    {/* QUICK DESIGN SLAB - WITH MainLayout */}
                    <Route path="/quick-design" element={
                      <ProtectedRoute>
                        <QuickDesignHome />
                      </ProtectedRoute>
                    } />

                    <Route path="/saved-designs" element={
                      <ProtectedRoute>
                        <SavedDesignsPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/new-design/slab" element={
                      <ProtectedRoute>
                        <MainLayout currentModule="slab" breadcrumb="Quick Design > Slab">
                          <StructuralInput />
                        </MainLayout>
                      </ProtectedRoute>
                    } />

                    {/* External Tools */}
                    <Route path="/external-design" element={
                      <ProtectedRoute>
                        <ExternalDesignPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/sdh-agent" element={
                      <ProtectedRoute>
                        <SDHAgentDownload />
                      </ProtectedRoute>
                    } />

                    {/* Legacy */}
                    <Route path="/workspace/:workspaceId/old" element={
                      <ProtectedRoute>
                        <WorkspaceDashboard />
                      </ProtectedRoute>
                    } />

                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </div>
              </BrowserRouter>
              </DesignMetaProvider>
            </NotificationProvider>
          </WorkspaceProvider>
        </LoadingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;