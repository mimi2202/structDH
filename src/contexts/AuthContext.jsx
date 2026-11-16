import React, { createContext, useState, useContext, useEffect } from 'react';

// Accounts are kept in this browser (no auth backend yet): one record per
// email in `local_users`, so a profile (name, photo, ...) and the user id that
// projects and design activity hang off survive signing out and back in.
const USERS_KEY = 'local_users';
const readUsers = () => {
  try { const v = JSON.parse(localStorage.getItem(USERS_KEY)); return Array.isArray(v) ? v : []; }
  catch { return []; }
};
const writeUser = (u) => {
  const others = readUsers().filter((x) => x.id !== u.id);
  try { localStorage.setItem(USERS_KEY, JSON.stringify([...others, u])); }
  catch { throw new Error('Not enough browser storage to save the profile (try a smaller photo).'); }
};
const findUser = (key) => {
  const k = String(key || '').trim().toLowerCase();
  if (!k) return null;
  return readUsers().find((u) => u.email?.toLowerCase() === k || u.username?.toLowerCase() === k) || null;
};
// Session: localStorage when "remember me", else sessionStorage (closing the
// browser signs out). Activity logging reads it via utils/activity.js.
const saveSession = (u, remember) => {
  const store = remember ? localStorage : sessionStorage;
  store.setItem('auth_user', JSON.stringify(u));
  if (!store.getItem('auth_token')) store.setItem('auth_token', 'local_' + Date.now());
};
const refreshSession = (u) => {
  for (const store of [localStorage, sessionStorage]) {
    if (store.getItem('auth_user')) store.setItem('auth_user', JSON.stringify(u));
  }
};

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [personalOrganization, setPersonalOrganization] = useState(null);

  // Check if user is already logged in on mount
  useEffect(() => {
    // Check localStorage for existing session
    const savedUser = localStorage.getItem('auth_user') || sessionStorage.getItem('auth_user');
    const savedToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    const savedPersonalOrg = localStorage.getItem('personal_organization');
    
    if (savedUser && savedToken) {
      // Prefer the stored account (it carries later profile edits).
      const parsed = JSON.parse(savedUser);
      const account = readUsers().find((u) => u.id === parsed.id) || parsed;
      if (!readUsers().some((u) => u.id === account.id)) { try { writeUser(account); } catch { /* full */ } }
      setUser(account);
      setProfile(account);
      if (savedPersonalOrg) {
        setPersonalOrganization(JSON.parse(savedPersonalOrg));
      }
    }
    setLoading(false);
    console.log('Auth initialized');
  }, []);

  const fetchProfile = async () => {
    return user;
  };

  // Create personal organization for new user
  const createPersonalOrganization = async (userId, userName) => {
    console.log('Creating personal organization for user:', userId, userName);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Create personal organization object
    const personalOrg = {
      id: `org_personal_${userId}`,
      name: `${userName || 'Personal'}'s Organization`,
      type: 'personal',
      owner_id: userId,
      created_at: new Date().toISOString(),
      is_personal: true,
      can_delete: false,
      can_rename: false,
      description: 'Your personal workspace for individual projects'
    };
    
    // Store in localStorage
    const organizations = JSON.parse(localStorage.getItem('organizations') || '[]');
    // Check if personal org already exists for this user
    const existingOrg = organizations.find(org => org.id === personalOrg.id);
    if (!existingOrg) {
      organizations.push(personalOrg);
      localStorage.setItem('organizations', JSON.stringify(organizations));
    }
    
    // Store membership
    const memberships = JSON.parse(localStorage.getItem('organization_memberships') || '[]');
    const existingMembership = memberships.find(m => m.user_id === userId && m.organization_id === personalOrg.id);
    if (!existingMembership) {
      memberships.push({
        user_id: userId,
        organization_id: personalOrg.id,
        role: 'owner',
        joined_at: new Date().toISOString()
      });
      localStorage.setItem('organization_memberships', JSON.stringify(memberships));
    }
    
    // Store personal organization separately for easy access
    localStorage.setItem('personal_organization', JSON.stringify(personalOrg));
    setPersonalOrganization(personalOrg);
    
    return { success: true, organization: personalOrg };
  };

  const login = async (credentials, rememberMe) => {
    console.log('Mock login:', credentials);
    setLoading(true);
    setError(null);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Existing account for this email / username, else a new one.
    let loggedInUser = findUser(credentials.email || credentials.username);
    if (!loggedInUser) {
      loggedInUser = {
        id: `user_${Date.now()}`,
        name: credentials.username || credentials.email?.split('@')[0] || 'User',
        email: credentials.email || '',
        username: credentials.username || credentials.email?.split('@')[0],
        profession: 'structural_engineer',
        avatar: null,
        created_at: new Date().toISOString()
      };
      writeUser(loggedInUser);
    }
    
    setUser(loggedInUser);
    setProfile(loggedInUser);
    saveSession(loggedInUser, rememberMe);
    
    // Load user's personal organization
    const savedPersonalOrg = localStorage.getItem('personal_organization');
    if (savedPersonalOrg) {
      setPersonalOrganization(JSON.parse(savedPersonalOrg));
    }
    
    setLoading(false);
    return { success: true, user: loggedInUser };
  };

  const register = async (userData) => {
    console.log('Mock register:', userData);
    setLoading(true);
    setError(null);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Create new user object (an existing account with this email keeps its id)
    const existing = findUser(userData.email);
    const newUser = {
      ...(existing || {}),
      id: existing?.id || `user_${Date.now()}`,
      name: userData.name,
      email: userData.email,
      username: userData.email?.split('@')[0] || userData.name?.toLowerCase().replace(/\s/g, ''),
      profession: userData.profession || 'structural_engineer',
      avatar: null,
      created_at: existing?.created_at || new Date().toISOString()
    };
    
    setUser(newUser);
    setProfile(newUser);
    writeUser(newUser);
    saveSession(newUser, true);
    
    // Create personal organization for the new user
    const personalOrgResult = await createPersonalOrganization(newUser.id, newUser.name);
    
    setLoading(false);
    return { success: true, user: newUser, personalOrganization: personalOrgResult.organization };
  };

  const logout = async () => {
    console.log('Mock logout');
    setLoading(true);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Clear all auth data
    setUser(null);
    setProfile(null);
    setPersonalOrganization(null);
    
    // Clear localStorage
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_user');
    sessionStorage.removeItem('auth_token');
    // Don't remove organizations data as it might be needed for other users
    // But clear session-specific data
    
    setLoading(false);
  };

  const forgotPassword = async (email) => {
    console.log('Mock forgot password:', email);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { success: true };
  };

  const resetPassword = async (token, newPassword) => {
    console.log('Mock reset password');
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { success: true };
  };

  const updateProfile = async (profileData) => {
    if (!user) return { success: false, error: 'Not signed in' };
    const email = profileData.email?.trim();
    if (email && email.toLowerCase() !== (user.email || '').toLowerCase()) {
      const clash = findUser(email);
      if (clash && clash.id !== user.id) return { success: false, error: 'Another account in this browser already uses that email.' };
    }
    const updatedProfile = { ...user, ...profileData, updated_at: new Date().toISOString() };
    try {
      writeUser(updatedProfile);
      refreshSession(updatedProfile);
    } catch (e) {
      return { success: false, error: e.message };
    }
    setProfile(updatedProfile);
    setUser(updatedProfile);
    return { success: true, user: updatedProfile };
  };

  // Load user's organizations
  const loadUserOrganizations = async (userId) => {
    const organizations = JSON.parse(localStorage.getItem('organizations') || '[]');
    const memberships = JSON.parse(localStorage.getItem('organization_memberships') || '[]');
    const userMemberships = memberships.filter(m => m.user_id === userId);
    const userOrgs = organizations.filter(org => 
      userMemberships.some(m => m.organization_id === org.id)
    );
    
    // Find personal organization
    const personal = userOrgs.find(org => org.is_personal === true);
    if (personal) {
      setPersonalOrganization(personal);
    }
    
    return userOrgs;
  };

  const value = {
    user,
    profile,
    loading,
    error,
    personalOrganization,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    updateProfile,
    fetchProfile,
    createPersonalOrganization,
    loadUserOrganizations,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};