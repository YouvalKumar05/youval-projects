import React from 'react';
import { LayoutDashboard, Users, Scan, BrainCircuit } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, backendStatus }) {
  const menuItems = [
    { id: 'overview', name: 'Dashboard Overview', icon: LayoutDashboard },
    { id: 'explorer', name: 'Patient Explorer', icon: Users },
    { id: 'analyzer', name: 'Interactive Analyzer', icon: Scan },
    { id: 'trainer', name: 'Model Calibration', icon: BrainCircuit },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <BrainCircuit size={28} className="logo-icon" />
        <span className="logo-text">NeuroMRI v10.0</span>
      </div>

      <ul className="sidebar-menu">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <li
              key={item.id}
              className={`menu-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <IconComponent size={20} />
              <span>{item.name}</span>
            </li>
          );
        })}
      </ul>

      <div className="sidebar-footer">
        <div className="status-badge">
          <span className={`status-dot ${backendStatus?.dataset_loaded ? 'online' : 'offline'}`}></span>
          <span>
            {backendStatus?.dataset_loaded
              ? `API Connected (v10)`
              : 'Connecting to API...'}
          </span>
        </div>
      </div>
    </div>
  );
}
