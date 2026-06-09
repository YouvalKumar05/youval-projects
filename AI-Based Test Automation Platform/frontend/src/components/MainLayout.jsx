import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import TopNav from './layout/TopNav';
import SecondaryNav from './layout/SecondaryNav';
import Sidebar from './layout/Sidebar';
import '../styles/index.css';
import '../styles/Layout.css';

// Routes that show the full app shell (sidebar + secondary nav)
const APP_ROUTES = [
  '/overview', '/data-input', '/analysis-review', '/execution-dashboard',
  '/reports', '/test-console', '/tasks', '/workflows', '/communications',
  '/rbac', '/admin', '/settings', '/regression-center', '/execution',
];

// Routes that are fully public (no sidebar, no secondary nav)
const PUBLIC_ROUTES = ['/', '/about', '/how-it-works', '/capability', '/contact'];

const MainLayout = () => {
  const location = useLocation();
  const token = localStorage.getItem('token');

  const isPublicRoute = PUBLIC_ROUTES.some(r => location.pathname === r || location.pathname === r + '/');
  const isAppRoute = APP_ROUTES.some(r => location.pathname.startsWith(r));

  // Show secondary nav and sidebar only when logged in and on an app route
  const showAppShell = token && isAppRoute;
  // Show secondary nav only on logged-in, non-public routes
  const showSecondaryNav = token && !isPublicRoute;

  // Logged-out public pages: only TopNav (56px)
  // Logged-in public pages: only TopNav (still no secondary nav)  
  // Logged-in app pages: TopNav + SecondaryNav + Sidebar

  return (
    <div className="app-shell">
      {/* Fixed nav stack */}
      <div className="nav-stack">
        <TopNav />
        {showSecondaryNav && <SecondaryNav />}
      </div>

      {/* Body offset = topnav + (subnav if shown) */}
      <div
        className={`app-body${!showSecondaryNav ? ' no-subnav' : ''}`}
        style={{ paddingTop: 0 }}
      >
        {showAppShell && <Sidebar />}

        <main className={`main-content${!showAppShell ? ' no-sidebar' : ''}`}>
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
