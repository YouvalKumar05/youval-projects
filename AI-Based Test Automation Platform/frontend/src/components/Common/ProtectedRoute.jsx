import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from '../../services/api';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({ children, allowedPermissions = [] }) => {
  const token = localStorage.getItem('token');
  const roleId = localStorage.getItem('role_id');
  const userRole = localStorage.getItem('user_role');
  const location = useLocation();
  const [isAuthorized, setIsAuthorized] = useState(null);

  useEffect(() => {
    if (!token) {
      setIsAuthorized(false);
      return;
    }

    if (allowedPermissions.length === 0) {
      setIsAuthorized(true);
      return;
    }

    const checkPermissions = async () => {
      try {
        // Here we could fetch the user's permissions, or check context. 
        // For efficiency, we assume the backend validates the action on load, 
        // but for frontend routing, we fetch current role permissions.
        const res = await api.get(`/api/rbac/roles/${roleId || '0'}/permissions`);
        if (res.status === 'success') {
          const userPerms = res.data.map(p => `${p.resource_name}:${p.action}`);
          // Has all required permissions? Or at least one? Let's say at least one
          const hasAccess = allowedPermissions.some(perm => userPerms.includes(perm));
          
          // Temporary bypass for super admin or if the system is bootstrap phase
          if (roleId === '1' || userRole === 'Admin' || hasAccess) {
             setIsAuthorized(true);
          } else {
             setIsAuthorized(false);
          }
        } else {
          setIsAuthorized(false);
        }
      } catch (err) {
        console.error("Auth check failed", err);
        // Fallback for development if failing
        setIsAuthorized(userRole === 'Admin'); 
      }
    };

    checkPermissions();
  }, [token, allowedPermissions, roleId]);

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isAuthorized === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#F4F5F7' }}>
        <Loader2 className="animate-spin" size={48} color="#0052CC" />
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <h2>Forbidden</h2>
        <p>You do not have permission to access this page.</p>
        <button className="btn btn--primary" onClick={() => window.location.href = '/'}>Go Home</button>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
