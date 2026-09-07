import React, { createContext, useState, useContext, useEffect } from 'react';

// TEMPORARY MOCK DATA - REMOVE WHEN BACKEND IS READY
const MOCK_USER = {
  id: "mock-user-1",
  name: "John Engineer",
  email: "john@example.com",
  username: "johnengineer",
  profession: "structural_engineer",
  avatar: null
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
    const savedUser = localStorage.getItem('auth_user');
    const savedToken = localStorage.getItem('auth_token');
    const savedPersonalOrg = localStorage.getItem('personal_organization');
    
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
      setProfile(JSON.parse(savedUser));
      if (savedPersonalOrg) {
        setPersonalOrganization(JSON.parse(savedPersonalOrg));
      }
    }
    setLoading(false);
    console.log('Auth initialized');
  }, []);

  const fetchProfile = async () => {
    return user || MOCK_USER;
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
    
    // Create a user object from credentials
    const loggedInUser = {
      id: `user_${Date.now()}`,
      name: credentials.username || credentials.email?.split('@')[0] || 'User',
      email: credentials.email || 'user@example.com',
      username: credentials.username || credentials.email?.split('@')[0],
      profession: 'structural_engineer',
      avatar: null
    };
    
    setUser(loggedInUser);
    setProfile(loggedInUser);
    
    // Store in localStorage if rememberMe
    if (rememberMe) {
      localStorage.setItem('auth_user', JSON.stringify(loggedInUser));
      localStorage.setItem('auth_token', 'mock_token_' + Date.now());
    }
    
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
    
    // Create new user object
    const newUser = {
      id: `user_${Date.now()}`,
      name: userData.name,
      email: userData.email,
      username: userData.email?.split('@')[0] || userData.name?.toLowerCase().replace(/\s/g, ''),
      profession: userData.profession || 'structural_engineer',
      avatar: null,
      created_at: new Date().toISOString()
    };
    
    setUser(newUser);
    setProfile(newUser);
    
    // Store in localStorage
    localStorage.setItem('auth_user', JSON.stringify(newUser));
    localStorage.setItem('auth_token', 'mock_token_' + Date.now());
    
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
    console.log('Mock update profile:', profileData);
    setLoading(true);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const updatedProfile = { ...(user || MOCK_USER), ...profileData };
    setProfile(updatedProfile);
    setUser(updatedProfile);
    
    localStorage.setItem('auth_user', JSON.stringify(updatedProfile));
    
    setLoading(false);
    return { success: true };
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