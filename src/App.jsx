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
import CreateWorkspace from './pages/CreateWorkspace';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import TeamMembers from './pages/TeamMembers';
import WorkspaceSettings from './pages/WorkspaceSettings';
import StructuralInput from './pages/StructuralInput';
import StructuralResults from './pages/StructuralResults';
import ProjectSetup from './pages/ProjectSetup';
import NewDesign from './pages/NewDesign';
import OrganisationTeam from './pages/OrganisationTeam';
import OrganizationOverview from './pages/OrganizationOverview';
import QuickDesign from './pages/QuickDesign';
import SavedDesigns from './pages/SavedDesigns';
import ExternalDesign from './pages/ExternalDesign';
import SDHAgentDownload from './pages/SDHAgentDownload';
import MainLayout from './components/layout/MainLayout';
import ResultsDashboard from './pages/ResultsDashboard';
import BeamInput from './pages/BeamInput';
import BeamResults from './pages/BeamResults';
import ContinuousBeamInput from './pages/ContinuousBeamInput';
import ContinuousBeamResults from './pages/ContinuousBeamResults';
import ContinuousSlabInput from './pages/ContinuousSlabInput';
import ContinuousSlabResults from './pages/ContinuousSlabResults';
import ColumnInput from './pages/ColumnInput';
import ColumnResults from './pages/ColumnResults';
import FoundationInput from './pages/FoundationInput';
import FoundationResults from './pages/FoundationResults';
import CombinedFootingInput from './pages/CombinedFootingInput';
import CombinedFootingResults from './pages/CombinedFootingResults';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LoadingProvider>
          <WorkspaceProvider>
            <NotificationProvider>
              <DesignMetaProvider>
              <BrowserRouter>
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
                    <Route path="/workspace/create" element={
                      <ProtectedRoute>
                        <CreateWorkspace />
                      </ProtectedRoute>
                    } />

                    <Route path="/workspace/:workspaceId" element={
                      <ProtectedRoute>
                        <OrganizationOverview />
                      </ProtectedRoute>
                    } />

                    <Route path="/workspace/:workspaceId/projects" element={
                      <ProtectedRoute>
                        <Projects />
                      </ProtectedRoute>
                    } />

                    <Route path="/workspace/:workspaceId/projects/:projectId" element={
                      <ProtectedRoute>
                        <ProjectDetail />
                      </ProtectedRoute>
                    } />

                    <Route path="/workspace/:workspaceId/members" element={
                      <ProtectedRoute>
                        <TeamMembers />
                      </ProtectedRoute>
                    } />

                    <Route path="/workspace/:workspaceId/team" element={
                      <ProtectedRoute>
                        <OrganisationTeam />
                      </ProtectedRoute>
                    } />

                    <Route path="/workspace/:workspaceId/settings" element={
                      <ProtectedRoute>
                        <WorkspaceSettings />
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

                    <Route path="/beam-results" element={
                      <ProtectedRoute>
                        <MainLayout currentModule="beam" breadcrumb="Beam Design > Results">
                          <BeamResults />
                        </MainLayout>
                      </ProtectedRoute>
                    } />

                    <Route path="/continuous-beam" element={
                      <ProtectedRoute>
                        <MainLayout currentModule="beam" breadcrumb="Beam Design > Continuous Beam > Input">
                          <ContinuousBeamInput />
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
                  <Route path="/combined-input" element={
                    <ProtectedRoute>
                      <MainLayout currentModule="foundation" breadcrumb="Foundation Design > Input">
                       <CombinedFootingInput />
                      </MainLayout>
                    </ProtectedRoute>
                  } />
                  <Route path="/combined-results" element={
                    <ProtectedRoute>
                      <MainLayout currentModule="foundation" breadcrumb="Foundation Design > Results">
                        <CombinedFootingResults />
                      </MainLayout>
                    </ProtectedRoute>
                  } />

                    <Route path="/workspace/:workspaceId/projects/:projectId/results" element={<ResultsDashboard />} />

                    {/* External Design Routes */}
                    <Route path="/workspace/:workspaceId/projects/:projectId/external-design" element={
                      <ProtectedRoute>
                        <ExternalDesign />
                      </ProtectedRoute>
                    } />

                    <Route path="/workspace/:workspaceId/projects/:projectId/external-design/:workId" element={
                      <ProtectedRoute>
                        <ExternalDesign />
                      </ProtectedRoute>
                    } />

                    {/* Project Setup */}
                    <Route path="/workspace/:workspaceId/projects/new" element={
                      <ProtectedRoute>
                        <ProjectSetup />
                      </ProtectedRoute>
                    } />

                    {/* Quick Design Routes */}
                    <Route path="/new-design" element={
                      <ProtectedRoute>
                        <NewDesign />
                      </ProtectedRoute>
                    } />

                    {/* QUICK DESIGN SLAB - WITH MainLayout */}
                    <Route path="/quick-design" element={
                      <ProtectedRoute>
                        <MainLayout currentModule="slab" breadcrumb="Quick Design > Slab Input">
                          <QuickDesign />
                        </MainLayout>
                      </ProtectedRoute>
                    } />

                    <Route path="/saved-designs" element={
                      <ProtectedRoute>
                        <SavedDesigns />
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
                        <ExternalDesign />
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