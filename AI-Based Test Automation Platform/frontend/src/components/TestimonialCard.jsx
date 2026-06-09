/* Enhanced Navbar Component - Professional Enterprise Grade */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './Navbar.css';

const Navbar = ({ sidebarOpen, setSidebarOpen, theme, setTheme }) => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <nav className="navbar" aria-label="Main navigation">
      {/* Left Section - Logo & Toggle */}
      <div className="navbar__left">
        <button
          className="navbar__toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle sidebar"
          title={sidebarOpen ? "Collapse" : "Expand"}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <Link to="/" className="navbar__logo">
          <span className="navbar__logo-icon">🤖</span>
          <span className="navbar__logo-text">ITAP</span>
          <span className="navbar__logo-subtitle">AI Tester</span>
        </Link>
      </div>

      {/* Center Section - Search */}
      <div className="navbar__center">
        <form className="navbar__search" onSubmit={(e) => e.preventDefault()}>
          <svg className="navbar__search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input
            type="text"
            placeholder="Search tests, dashboards..."
            className="navbar__search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>
      </div>

      {/* Right Section - Theme Toggle & User */}
      <div className="navbar__right">
        <button
          className="navbar__theme-toggle"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          title={`Dark Mode`}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>

        <button className="navbar__notification" aria-label="Notifications" title="Notifications">
          🔔
          <span className="navbar__notification-badge">3</span>
        </button>

        <button className="navbar__profile" aria-label="User profile" title="Profile">
          👤
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
