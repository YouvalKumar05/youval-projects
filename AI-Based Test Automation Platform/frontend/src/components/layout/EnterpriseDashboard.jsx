import React, { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  TestTube2, 
  Workflow, 
  KanbanSquare, 
  UsersRound, 
  Bell, 
  Settings,
  LogOut,
  Sparkles,
  MessageSquare,
  ShieldAlert
} from "lucide-react";
import AIInsightsDrawer from "../ai/AIInsightsDrawer";
import "../../styles/EnterpriseDashboard.css"; 

export const EnterpriseDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);
    const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem("token");
        navigate("/login");
    };

    const routes = [
        { path: "/", label: "Overview Dashboard", icon: LayoutDashboard },
        { path: "/testing", label: "STLC Console", icon: TestTube2 },
        { path: "/tasks", label: "Task Boards", icon: KanbanSquare },
        { path: "/workflows", label: "Auto Workflows", icon: Workflow },
        { path: "/communications", label: "Communications", icon: MessageSquare },
        { path: "/rbac", label: "Role Management", icon: UsersRound },
        { path: "/admin", label: "System Admin", icon: ShieldAlert },
    ];

    return (
        <div className="ent-dashboard-layout">
            <aside className={`ent-sidebar ${collapsed ? "collapsed" : ""}`}>
                <div className="ent-sidebar-header">
                    <div className="logo-container">
                        <Sparkles size={24} className="brand-icon" />
                        {!collapsed && <h2>AutoQA App</h2>}
                    </div>
                </div>

                <nav className="ent-nav">
                    {routes.map(r => {
                        const Icon = r.icon;
                        const active = location.pathname === r.path;
                        return (
                            <button 
                                key={r.path}
                                className={`ent-nav-item ${active ? "active" : ""}`}
                                onClick={() => navigate(r.path)}
                            >
                                <Icon size={20} />
                                {!collapsed && <span>{r.label}</span>}
                            </button>
                        );
                    })}
                </nav>

                <div className="ent-sidebar-footer">
                    <button className="ent-nav-item" onClick={handleLogout}>
                        <LogOut size={20} />
                        {!collapsed && <span>Sign Out</span>}
                    </button>
                </div>
            </aside>

            <main className="ent-main-content">
                <header className="ent-topbar">
                    <div className="topbar-search">
                        <input type="text" placeholder="Search tasks, tests, bugs... (Press '/')" />
                    </div>
                    <div className="topbar-actions">
                        <button 
                            className={`icon-btn ${isAiDrawerOpen ? "active" : ""}`} 
                            onClick={() => setIsAiDrawerOpen(true)}
                            title="AI Insights"
                        >
                            <Sparkles size={20} color={isAiDrawerOpen ? "#6366f1" : "#64748b"} />
                        </button>
                        <button className="icon-btn"><Bell size={20}/></button>
                        <button className="icon-btn"><Settings size={20}/></button>
                        <div className="user-avatar">AD</div>
                    </div>
                </header>
                <div className="ent-page-container">
                    <Outlet />
                </div>
            </main>

            <AIInsightsDrawer isOpen={isAiDrawerOpen} onClose={() => setIsAiDrawerOpen(false)} />
        </div>
    );
};
