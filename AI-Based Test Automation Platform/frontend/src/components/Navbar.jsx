import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext.jsx';
import { 
  ChevronDown, 
  Search, 
  Settings as SettingsIcon, 
  LogOut, 
  LayoutDashboard, 
  TestTube2, 
  Users, 
  MessageSquare, 
  ShieldCheck, 
  Sparkles,
  PieChart,
  ClipboardList
} from 'lucide-react';

import LogoImg from '../assets/Logo.png';
import '../styles/Navbar.css';

const Navbar = () => {
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const token = localStorage.getItem("token");
    const [openMenu, setOpenMenu] = useState(null);

    const handleLogout = () => {
        localStorage.removeItem("token");
        navigate("/login");
    };

    const toggleMenu = (menu) => {
        setOpenMenu(openMenu === menu ? null : menu);
    };

    const navSection = (label, subItems, key) => (
        <div className="nav-dropdown-wrapper">
            <button 
                className={`nav-dropdown-trigger ${openMenu === key ? 'active' : ''}`}
                onClick={() => toggleMenu(key)}
            >
                {label} <ChevronDown size={14} className={openMenu === key ? 'rotated' : ''} />
            </button>
            {openMenu === key && (
                <div className="nav-dropdown-menu mega-menu">
                    <div className="mega-menu-content">
                        <div className="mega-menu-section">
                            <h4 className="mega-menu-title">{label}</h4>
                            <div className="mega-menu-grid">
                                {subItems.map(item => (
                                    <NavLink 
                                        key={item.path} 
                                        to={item.path} 
                                        onClick={() => setOpenMenu(null)}
                                        className={({ isActive }) => `mega-menu-item ${isActive ? 'active' : ''}`}
                                    >
                                        <div className="mega-menu-icon">
                                            {item.icon && <item.icon size={20} strokeWidth={1.5} />}
                                        </div>
                                        <div className="mega-menu-text">
                                            <span className="item-label">{item.label}</span>
                                            <span className="item-desc">{item.desc}</span>
                                        </div>
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <header className={`jira-navbar jira-navbar--${theme}`}>
            <div className="jira-navbar-container">
                {/* Logo Section */}
                <div className="navbar-brand">
                    <Link to="/" className="navbar-logo">
                        <img src={LogoImg} alt="AutoQA" />
                        <span className="logo-text">AutoQA <span>Platform</span></span>
                    </Link>
                </div>

                {/* Primary Nav */}
                <nav className="navbar-links">
                    <NavLink to="/" className="nav-link">Home</NavLink>
                    
                    {token && (
                        <>
                            {navSection("Workspaces", [
                                { path: "/overview", label: "General Overview", desc: "Global health and active runs", icon: PieChart },
                                { path: "/tasks", label: "Kanban Board", desc: "Manage QA tasks and tickets", icon: LayoutDashboard },
                                { path: "/workflows", label: "Workflow Builder", desc: "Visual automation architect", icon: ClipboardList },
                                { path: "/workflow-automation", label: "Workflow Automation", desc: "Salesforce-style pipeline engine", icon: Sparkles },
                            ], 'workspaces')}

                            {navSection("STLC Console", [
                                { path: "/data-input", label: "Data Center", desc: "Upload and extract requirements", icon: TestTube2 },
                                { path: "/analysis-review", label: "AI Analysis", desc: "Review gaps and risks in docs", icon: Sparkles },
                                { path: "/execution-dashboard", label: "Live Execution", desc: "Stream logs and results", icon: PieChart },
                                { path: "/regression-center", label: "Regression Suite", desc: "stability and health trends", icon: ClipboardList },
                                { path: "/test-console", label: "Admin Console", desc: "Test environment settings", icon: SettingsIcon },
                                { path: "/reports", label: "Quality Analytics", desc: "Deeper insights and PDF exports", icon: PieChart },
                            ], 'stlc')}

                            {navSection("Governance", [
                                { path: "/communications", label: "Inbox", desc: "Team alerts and collaboration", icon: MessageSquare },
                                { path: "/rbac", label: "RBAC Security", desc: "Role and permission matrix", icon: ShieldCheck },
                                { path: "/admin", label: "Systems", desc: "Global audit and configuration", icon: Users },
                            ], 'team')}
                        </>
                    )}

                    {navSection("Resources", [
                        { path: "/about", label: "About Platform", desc: "The methodology behind AutoQA", icon: ShieldCheck },
                        { path: "/how-it-works", label: "Getting Started", desc: "Tutorials and user guides", icon: Sparkles },
                        { path: "/capability", label: "Platform Specs", desc: "Technical capabilities list", icon: ClipboardList },
                        { path: "/contact", label: "Help Center", desc: "Connect with our support engineering", icon: MessageSquare },
                    ], 'explore')}
                </nav>

                {/* Right Actions */}
                <div className="navbar-actions">
                    <div className="navbar-search">
                        <Search size={16} />
                        <input type="text" placeholder="Search..." />
                    </div>

                    <button className="icon-btn" onClick={toggleTheme} title="Toggle Theme">
                        <Sparkles size={20} />
                    </button>

                    {token ? (
                        <div className="nav-user-profile">
                            <Link to="/settings" className="avatar-btn">AD</Link>
                            <button className="icon-btn logout-btn" onClick={handleLogout} title="Sign Out">
                                <LogOut size={20} />
                            </button>
                        </div>
                    ) : (
                        <Link to="/login" className="btn-login">Sign In</Link>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Navbar;
