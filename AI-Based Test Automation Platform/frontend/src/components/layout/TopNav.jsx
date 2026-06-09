import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, Settings, User, HelpCircle, Inbox, Check } from 'lucide-react';
import { api } from '../../services/api';

const TopNav = () => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const menuRef = useRef(null);
  const notifRef = useRef(null);
  const navigate = useNavigate();
  
  const token = localStorage.getItem('token');
  const userName = localStorage.getItem('user_name') || 'Team Member';
  const userEmail = localStorage.getItem('user_email') || 'user@autoqa.io';
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);

  useEffect(() => {
    if (token) {
      fetchNotifications();
    }
  }, [token]);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/api/communications/notifications');
      if (res.status === 'success') {
        setNotifications(res.data);
      }
    } catch (err) {
      console.error("Notifications fetch failed:", err);
    }
  };

  const markAllRead = async () => {
    // Optimistic UI
    setNotifications(notifications.map(n => ({...n, is_read: true})));
    // Backend call could be bulk or iterative
    try {
      for (const n of notifications.filter(x => !x.is_read)) {
        await api.post(`/api/communications/notifications/${n.id}/read`);
      }
    } catch (e) {}
  };

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setUserMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <header className="top-nav">
      <Link to="/" className="top-nav-logo">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="6" fill="#2684FF"/>
          <path d="M7 14L14 7L21 14L14 21L7 14Z" fill="white" opacity="0.9"/>
          <path d="M11 14L14 11L17 14L14 17L11 14Z" fill="#0052CC"/>
        </svg>
        <span className="top-nav-logo-text">AutoQA <span>Platform</span></span>
      </Link>

      <nav className="top-nav-links">
        <NavLink to="/overview" className={({ isActive }) => `top-nav-link${isActive ? ' active' : ''}`}>Dashboard</NavLink>
        <NavLink to="/execution-dashboard" className={({ isActive }) => `top-nav-link${isActive ? ' active' : ''}`}>Executions</NavLink>
        <NavLink to="/tasks" className={({ isActive }) => `top-nav-link${isActive ? ' active' : ''}`}>Boards</NavLink>
        <NavLink to="/workflows" className={({ isActive }) => `top-nav-link${isActive ? ' active' : ''}`}>Automation</NavLink>
      </nav>

      <div className="top-nav-right">
        {token ? (
          <>
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button 
                className={`notif-btn ${unreadCount > 0 ? 'has-notifs' : ''}`} 
                onClick={() => setNotifOpen(!notifOpen)}
              >
                <Bell size={18} />
                {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
              </button>

              {notifOpen && (
                <div className="notif-dropdown">
                  <div className="notif-header">
                    <span>Notifications</span>
                    <button className="mark-read-btn" onClick={markAllRead}>Mark all as read</button>
                  </div>
                  <div className="notif-list">
                    {notifications.length === 0 ? (
                      <div className="notif-empty">No notifications yet</div>
                    ) : (
                      notifications.slice(0, 5).map(n => (
                        <div key={n.id} className={`notif-item ${n.is_read ? 'read' : 'unread'}`} onClick={() => n.link_url && navigate(n.link_url)}>
                          <div className="notif-icon-circle">
                            {n.title.includes('Bug') ? <AlertCircle size={14} color="#FF5630" /> : <Inbox size={14} color="#0052CC" />}
                          </div>
                          <div className="notif-content">
                            <div className="notif-title">{n.title}</div>
                            <div className="notif-msg">{n.message}</div>
                            <div className="notif-time">{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                          {!n.is_read && <div className="unread-dot" />}
                        </div>
                      ))
                    )}
                  </div>
                  <Link to="/communications" className="notif-footer" onClick={() => setNotifOpen(false)}>See all notifications</Link>
                </div>
              )}
            </div>

            <div ref={menuRef} style={{ position: 'relative' }}>
              <button className="user-avatar-btn" onClick={() => setUserMenuOpen(!userMenuOpen)}>
                <div className="avatar-circle">{initials}</div>
                <span className="avatar-name">{userName}</span>
                <ChevronDown size={14} style={{ opacity: 0.7 }} />
              </button>

              {userMenuOpen && (
                <div className="user-dropdown">
                  <div className="user-dropdown-header">
                    <div className="user-dropdown-name">{userName}</div>
                    <div className="user-dropdown-email">{userEmail}</div>
                  </div>
                  <Link to="/settings" className="dropdown-item" onClick={() => setUserMenuOpen(false)}><User size={15} /> Your Profile</Link>
                  <Link to="/settings" className="dropdown-item" onClick={() => setUserMenuOpen(false)}><Settings size={15} /> Settings</Link>
                  <div className="dropdown-separator" />
                  <div className="dropdown-item danger" onClick={handleLogout}><LogOut size={15} /> Sign Out</div>
                </div>
              )}
            </div>
          </>
        ) : (
          <Link to="/login" className="top-nav-sign-in">Sign In</Link>
        )}
      </div>
    </header>
  );
};

const AlertCircle = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

export default TopNav;
