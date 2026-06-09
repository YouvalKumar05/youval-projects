import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  BarChart2, Database, Search,
  PlayCircle, FileText, Monitor,
  LogOut, HelpCircle, ChevronLeft, ChevronRight,
  ShieldCheck, Settings, Server, Users,
  GitMerge, CheckSquare, MessageSquare, AlertTriangle, RefreshCcw
} from 'lucide-react';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const userName  = localStorage.getItem('user_name')  || 'Team Member';
  const userRole  = localStorage.getItem('user_role')  || '';
  const userEmail = localStorage.getItem('user_email') || '';
  const initials  = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const isAdmin   = userRole?.toLowerCase() === 'admin';

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true'; }
    catch { return false; }
  });

  const showSecondaryNav = !['/login', '/register', '/'].includes(location.pathname);

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', collapsed);
    document.documentElement.style.setProperty(
      '--sidebar-width',
      collapsed ? 'var(--sidebar-collapsed)' : '240px'
    );
    document.documentElement.style.setProperty(
      '--sidebar-top',
      showSecondaryNav 
        ? 'calc(var(--topnav-height) + var(--subnav-height))'
        : 'var(--topnav-height)'
    );
  }, [collapsed, showSecondaryNav]);

  const coreNavItems = [
    { path: '/overview',            label: 'Executive Dashboard', icon: BarChart2   },
    { path: '/data-input',          label: 'Data Center',         icon: Database    },
    { path: '/analysis-review',     label: 'Analysis Review',     icon: Search      },
    { path: '/execution-dashboard', label: 'Execution Dashboard', icon: PlayCircle  },
    { path: '/reports',             label: 'Report Analysis',     icon: FileText    },
    { path: '/regression-center',   label: 'Regression Center',   icon: RefreshCcw  },
    { path: '/test-console',        label: 'Test Console',        icon: Monitor     },
  ];

  const teamNavItems = [
    { path: '/tasks',           label: 'Task Board',          icon: CheckSquare    },
    { path: '/workflows',       label: 'Workflows',           icon: GitMerge       },
    { path: '/communications',  label: 'Communications',      icon: MessageSquare  },
  ];

  const adminNavItems = [
    { path: '/rbac',     label: 'Role Management', icon: ShieldCheck },
    { path: '/admin',    label: 'System Admin',    icon: Server      },
    { path: '/settings', label: 'Settings',        icon: Settings    },
  ];

  const handleLogout = () => {
    ['token', 'user_role', 'user_name', 'user_email'].forEach(k => localStorage.removeItem(k));
    navigate('/login');
  };

  const NavItem = ({ path, label, icon: Icon }) => (
    <NavLink
      to={path}
      className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
      title={collapsed ? label : undefined}
    >
      <Icon size={17} style={{ flexShrink: 0 }} />
      {!collapsed && <span className="sidebar-label">{label}</span>}
    </NavLink>
  );

  const SectionLabel = ({ text }) => (
    <div className="sidebar-section-label" style={{ marginTop: 24, marginBottom: 8 }}>
      {!collapsed ? text : ''}
    </div>
  );

  return (
    <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>

      {/* Profile strip */}
      {!collapsed && (
        <div className="sidebar-profile">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-profile-info">
            <div className="sidebar-profile-name">{userName}</div>
            <div className="sidebar-profile-role">
              {isAdmin ? 'Administrator' : userRole || 'Team Member'}
            </div>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        className="sidebar-collapse-btn"
        onClick={() => setCollapsed(v => !v)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Core Modules */}
      <SectionLabel text="Core Modules" />
      <nav>
        {coreNavItems.map(item => (
          <NavItem key={item.path} {...item} />
        ))}
      </nav>

      {/* Team Tools */}
      <SectionLabel text="Team Tools" />
      <nav>
        {teamNavItems.map(item => (
          <NavItem key={item.path} {...item} />
        ))}
      </nav>

      {/* Admin Section — visible only to Admin */}
      {isAdmin && (
        <>
          <SectionLabel text="Admin Tools" />
          <nav>
            {adminNavItems.map(item => (
              <NavItem key={item.path} {...item} />
            ))}
          </nav>
        </>
      )}

      {/* Footer */}
      <div className="sidebar-footer">
        <button
          className="sidebar-footer-btn"
          onClick={() => navigate('/contact')}
          title={collapsed ? 'Help & Support' : undefined}
        >
          <HelpCircle size={16} />
          {!collapsed && <span>Help &amp; Support</span>}
        </button>
        <button
          className="sidebar-footer-btn"
          onClick={handleLogout}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut size={16} />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
