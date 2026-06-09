import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, GitMerge, MessageSquare,
  ShieldCheck, Server, Settings
} from 'lucide-react';

const SecondaryNav = () => {
  const isAdmin = localStorage.getItem('user_role')?.toLowerCase() === 'admin';

  const links = [
    { to: '/tasks',          label: 'Tasks',          icon: LayoutDashboard },
    { to: '/workflows',      label: 'Workflow',        icon: GitMerge },
    { to: '/communications', label: 'Communications',  icon: MessageSquare },
    ...(isAdmin ? [
      { to: '/rbac',  label: 'RBAC',         icon: ShieldCheck, admin: true },
      { to: '/admin', label: 'System Admin',  icon: Server,      admin: true },
    ] : []),
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="secondary-nav">
      {links.map(l => (
        <NavLink
          key={l.to}
          to={l.to}
          className={({ isActive }) => `secondary-nav-link${isActive ? ' active' : ''}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <l.icon size={16} strokeWidth={2.5} />
            <span style={{ paddingTop: 1 }}>{l.label}</span>
          </div>
          {l.admin && <span className="admin-badge" style={{ marginLeft: 6 }}>Admin</span>}
        </NavLink>
      ))}
    </nav>
  );
};

export default SecondaryNav;
