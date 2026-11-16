import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { PERSONAL_WS, ALL_WS } from '../utils/projects';
import * as orgStore from '../utils/orgStore';

// Role constants
export const ROLES = {
  // Organization Roles
  ORG_OWNER: 'owner',
  ORG_ADMIN: 'admin',
  ORG_EDITOR: 'editor',
  ORG_MEMBER: 'member',
  
  // Project Roles
  PROJECT_OWNER: 'project_owner',
  PROJECT_ADMIN: 'project_admin',
  PROJECT_EDITOR: 'project_editor',
  PROJECT_VIEWER: 'project_viewer',
  
  // Guest Role
  GUEST: 'guest',
};

// Role hierarchy for permissions
export const ORG_ROLE_HIERARCHY = {
  [ROLES.ORG_OWNER]: 4,
  [ROLES.ORG_ADMIN]: 3,
  [ROLES.ORG_EDITOR]: 2,
  [ROLES.ORG_MEMBER]: 1,
};

export const PROJECT_ROLE_HIERARCHY = {
  [ROLES.PROJECT_OWNER]: 4,
  [ROLES.PROJECT_ADMIN]: 3,
  [ROLES.PROJECT_EDITOR]: 2,
  [ROLES.PROJECT_VIEWER]: 1,
};

// Helper functions for permissions
export const hasOrgRole = (userRole, requiredRole) => {
  const userLevel = ORG_ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ORG_ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
};

export const hasProjectRole = (userRole, requiredRole) => {
  const userLevel = PROJECT_ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = PROJECT_ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
};

export const canEditWork = (workOwnerId, currentUserId) => {
  return workOwnerId === currentUserId;
};

// Organisations, projects, members and invites live in localStorage (no
// backend yet). Nothing is seeded: a new user starts with no organisation and
// no project. The old sample data is removed once by orgStore.removeSampleData.
const readList = (key) => {
  try { const v = JSON.parse(localStorage.getItem(key)); return Array.isArray(v) ? v : []; }
  catch { return []; }
};
const initializeLocalStorage = () => {
  orgStore.removeSampleData();
  for (const key of ['mock_workspaces', 'mock_projects', 'mock_members', 'mock_pending_invites', 'mock_failed_invites']) {
    if (!localStorage.getItem(key)) localStorage.setItem(key, '[]');
  }
};


// Load mock data from localStorage
const loadMockDataFromLocalStorage = () => {
  initializeLocalStorage();
  return {
    workspaces: JSON.parse(localStorage.getItem('mock_workspaces')),
    projects: JSON.parse(localStorage.getItem('mock_projects')),
    members: JSON.parse(localStorage.getItem('mock_members')),
  };
};

const WorkspaceContext = createContext();

export const WorkspaceProvider = ({ children }) => {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [failedInvites, setFailedInvites] = useState([]);

  // Load mock data on mount
  useEffect(() => {
    if (user) {
      loadWorkspaces();
    }
  }, [user]);

  // Organisations the signed-in user is a member of (utils/orgStore.js), each
  // with the user's role there and live member / project counts.
  const loadWorkspaces = async () => {
    setError(null);
    const mine = orgStore.listOrgsForUser(user);
    setWorkspaces(mine);
    const keep = currentWorkspace && mine.find((w) => w.id === currentWorkspace.id);
    setCurrentWorkspace(keep || mine[0] || null);
    if (!keep && mine[0]) loadMembers(mine[0].id);
    return mine;
  };

  const loadProjects = async (workspaceId) => {
    setLoading(true);
    setTimeout(() => {
      setProjects(listUserProjects(workspaceId));
      setLoading(false);
    }, 300);
  };

  // Projects the signed-in user can see. scope: PERSONAL_WS (no
  // organisation), 'all' (personal + every organisation), or an organisation id.
  // A personal project is only listed for its owner (older ones have no owner).
  const listUserProjects = (scope = ALL_WS) => {
    const { projects: all } = loadMockDataFromLocalStorage();
    const orgs = orgStore.listOrgsForUser(user);
    const orgIds = new Set(orgs.map((w) => w.id));
    const mine = (p) => !p.owner_id || p.owner_id === user?.id;
    const visible = all.filter((p) =>
      p.workspace_id ? orgIds.has(p.workspace_id) : mine(p));
    const picked = scope === ALL_WS ? visible
      : scope === PERSONAL_WS ? visible.filter((p) => !p.workspace_id)
      : visible.filter((p) => p.workspace_id === scope);
    return picked.map((p) => ({ ...p, organisation_name: orgs.find((w) => w.id === p.workspace_id)?.name || null }));
  };

  // Move a project into an organisation, or back to personal (target null).
  const moveProject = async (projectId, targetWorkspaceId) => {
    const target = targetWorkspaceId && targetWorkspaceId !== PERSONAL_WS ? targetWorkspaceId : null;
    if (target && !['owner', 'admin', 'editor'].includes(orgStore.roleIn(target, user))) {
      return { success: false, error: 'Your role in that organisation cannot add projects.' };
    }
    const all = readList('mock_projects');
    if (!all.some((p) => p.id === projectId)) return { success: false, error: 'Project not found' };
    const updated = all.map((p) => (p.id === projectId
      ? { ...p, workspace_id: target, owner_id: p.owner_id || user?.id, updated_at: new Date().toISOString() }
      : p));
    localStorage.setItem('mock_projects', JSON.stringify(updated));
    setProjects(listUserProjects(ALL_WS));
    loadWorkspaces();
    return { success: true, workspaceId: target || PERSONAL_WS };
  };

  const loadMembers = async (workspaceId) => {
    const list = orgStore.getMembers(workspaceId);
    setMembers(list);
    return list;
  };

  const loadPendingInvites = async (workspaceId) => {
    const list = orgStore.getMembers(workspaceId).filter((m) => m.status === 'invited');
    setPendingInvites(list);
    return list;
  };

  const loadFailedInvites = async () => {
    setFailedInvites([]);
    return [];
  };

  // Every organisation change goes through utils/orgStore.js, which checks the
  // signed-in user's role (utils/orgRbac.js) and writes the audit log; the
  // lists are then re-read.
  const afterOrgChange = (workspaceId, result) => {
    loadWorkspaces();
    if (workspaceId) { loadMembers(workspaceId); loadPendingInvites(workspaceId); }
    return result;
  };

  const cancelPendingInvite = async (memberId, workspaceId = currentWorkspace?.id) =>
    afterOrgChange(workspaceId, orgStore.removeMember(user, workspaceId, memberId));

  const leaveWorkspace = async (workspaceId) =>
    afterOrgChange(null, orgStore.leaveOrg(user, workspaceId));

  // newOwner: the member row id
  const transferOwnership = async (workspaceId, memberId) =>
    afterOrgChange(workspaceId, orgStore.transferOwnership(user, workspaceId, memberId));

  const deleteOrganization = async (organizationId) =>
    afterOrgChange(null, orgStore.deleteOrg(user, organizationId));

  const createWorkspace = async (workspaceData) => {
    const res = orgStore.createOrg(user, workspaceData);
    if (!res.success) return res;
    await loadWorkspaces();
    setCurrentWorkspace({ ...res.org, userRole: 'owner' });
    return { success: true, workspace: res.org };
  };

  const switchWorkspace = async (workspace) => {
    setCurrentWorkspace(workspace);
    setCurrentProject(null);
    await loadProjects(workspace.id);
    await loadMembers(workspace.id);
  };

  const switchProject = async (project) => {
    setCurrentProject(project);
  };

  // SET CURRENT PROJECT BY PROJECT ID - ADD THIS FUNCTION
  const setCurrentProjectByProjectId = async (projectId) => {
    setLoading(true);
    try {
      const { projects: mockProjects } = loadMockDataFromLocalStorage();
      const foundProject = mockProjects.find(p => p.id === projectId);
      if (foundProject) {
        setCurrentProject(foundProject);
        setLoading(false);
        return { success: true, project: foundProject };
      } else {
        setLoading(false);
        return { success: false, error: 'Project not found' };
      }
    } catch (error) {
      setError(error.message);
      setLoading(false);
      return { success: false, error: error.message };
    }
  };

  const createProject = async (workspaceId, projectData) => {
    const orgId = workspaceId && workspaceId !== PERSONAL_WS && workspaceId !== ALL_WS ? workspaceId : null;
    if (orgId && !['owner', 'admin', 'editor'].includes(orgStore.roleIn(orgId, user))) {
      return { success: false, error: 'Your role in that organisation cannot create projects.' };
    }
    const newProject = {
      id: `proj-${Date.now()}`,
      ...projectData,
      workspace_id: orgId,
      owner_id: user?.id || null,
      owner_name: user?.name || null,
      status: 'active',
      userRole: ROLES.PROJECT_OWNER,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { projects: currentProjects, workspaces: currentWorkspaces } = loadMockDataFromLocalStorage();
    const updatedProjects = [...currentProjects, newProject];
    localStorage.setItem('mock_projects', JSON.stringify(updatedProjects));
    
    const updatedWorkspaces = currentWorkspaces.map(w => 
      w.id === orgId 
        ? { ...w, project_count: (w.project_count || 0) + 1 } 
        : w
    );
    localStorage.setItem('mock_workspaces', JSON.stringify(updatedWorkspaces));
    
    setProjects(updatedProjects);
    setWorkspaces(updatedWorkspaces);
    
    return { success: true, project: newProject };
  };

  const updateProject = async (projectId, projectData) => {
    setLoading(true);
    try {
      const { projects: currentProjects, workspaces: currentWorkspaces } = loadMockDataFromLocalStorage();
      
      const updatedProjects = currentProjects.map(p => 
        p.id === projectId 
          ? { ...p, ...projectData, updated_at: new Date().toISOString() }
          : p
      );
      localStorage.setItem('mock_projects', JSON.stringify(updatedProjects));
      
      setProjects(updatedProjects);
      
      if (currentProject?.id === projectId) {
        setCurrentProject({ ...currentProject, ...projectData, updated_at: new Date().toISOString() });
      }
      
      setLoading(false);
      return { success: true };
    } catch (error) {
      setError(error.message);
      setLoading(false);
      return { success: false, error: error.message };
    }
  };

  const deleteProject = async (projectId) => {
    setLoading(true);
    try {
      const { projects: currentProjects } = loadMockDataFromLocalStorage();
      
      const projectToDelete = currentProjects.find(p => p.id === projectId);
      // Personal project: only its owner. Organisation project: Owner or Admin there.
      const allowed = projectToDelete && (projectToDelete.workspace_id
        ? ['owner', 'admin'].includes(orgStore.roleIn(projectToDelete.workspace_id, user))
        : (!projectToDelete.owner_id || projectToDelete.owner_id === user?.id));
      if (!allowed) {
        setLoading(false);
        return { success: false, error: projectToDelete ? 'Your role does not allow deleting this project.' : 'Project not found.' };
      }
      const updatedProjects = currentProjects.filter(p => p.id !== projectId);
      localStorage.setItem('mock_projects', JSON.stringify(updatedProjects));
      
      // re-read organisations with the user's role (counts are computed there)
      loadWorkspaces();
      
      setProjects(updatedProjects);
      setLoading(false);
      return { success: true };
    } catch (error) {
      setError(error.message);
      setLoading(false);
      return { success: false, error: error.message };
    }
  };

  const inviteMember = async (workspaceId, email, role) =>
    afterOrgChange(workspaceId, orgStore.inviteMember(user, workspaceId, email, role));

  const updateWorkspace = async (workspaceId, data) => {
    const updates = data instanceof FormData ? Object.fromEntries(data.entries()) : data;
    return afterOrgChange(workspaceId, orgStore.updateOrg(user, workspaceId, updates));
  };

  const deleteWorkspace = async (workspaceId) => deleteOrganization(workspaceId);

  // memberId: the member row id
  const removeMember = async (workspaceId, memberId) =>
    afterOrgChange(workspaceId, orgStore.removeMember(user, workspaceId, memberId));

  const updateMemberRole = async (workspaceId, memberId, role) =>
    afterOrgChange(workspaceId, orgStore.changeRole(user, workspaceId, memberId, role));

  // Permission helper functions
  const getUserRoleInWorkspace = (workspace) => {
    return workspace?.userRole || ROLES.ORG_MEMBER;
  };

  const getUserRoleInProject = (project) => {
    return project?.userRole || ROLES.PROJECT_VIEWER;
  };

  const canInviteToWorkspace = () => {
    const role = getUserRoleInWorkspace(currentWorkspace);
    return role === ROLES.ORG_OWNER || role === ROLES.ORG_ADMIN;
  };

  const canInviteToProject = () => {
    const orgRole = getUserRoleInWorkspace(currentWorkspace);
    const projectRole = getUserRoleInProject(currentProject);
    return projectRole === ROLES.PROJECT_OWNER || 
           projectRole === ROLES.PROJECT_ADMIN || 
           orgRole === ROLES.ORG_OWNER || 
           orgRole === ROLES.ORG_ADMIN;
  };

  const canDeleteWorkspace = () => {
    return getUserRoleInWorkspace(currentWorkspace) === ROLES.ORG_OWNER;
  };

  const canDeleteProject = () => {
    return getUserRoleInProject(currentProject) === ROLES.PROJECT_OWNER;
  };

  const canRenameWorkspace = () => {
    return getUserRoleInWorkspace(currentWorkspace) === ROLES.ORG_OWNER;
  };

  const canTransferOwnership = () => {
    return getUserRoleInWorkspace(currentWorkspace) === ROLES.ORG_OWNER;
  };

  const canEditWork = (workOwnerId) => {
    return workOwnerId === user?.id;
  };

  const value = {
    workspaces,
    currentWorkspace,
    currentProject,
    projects,
    members,
    loading,
    error,
    pendingInvites,
    failedInvites,
    createWorkspace,
    switchWorkspace,
    switchProject,
    setCurrentProjectByProjectId,  // ADD THIS
    createProject,
    updateProject,
    moveProject,
    listUserProjects,
    deleteProject,
    inviteMember,
    updateWorkspace,
    deleteWorkspace,
    removeMember,
    updateMemberRole,
    leaveWorkspace,
    transferOwnership,
    deleteOrganization,
    loadWorkspaces,
    refreshWorkspaces: loadWorkspaces,
    loadProjects,
    loadMembers,
    loadPendingInvites,
    loadFailedInvites,
    cancelPendingInvite,
    // Permission helpers
    getUserRoleInWorkspace,
    getUserRoleInProject,
    canInviteToWorkspace,
    canInviteToProject,
    canDeleteWorkspace,
    canDeleteProject,
    canRenameWorkspace,
    canTransferOwnership,
    canEditWork,
    ROLES,
    ORG_ROLE_HIERARCHY,
    PROJECT_ROLE_HIERARCHY,
    hasOrgRole,
    hasProjectRole,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};