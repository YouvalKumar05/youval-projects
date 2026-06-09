import React, { useState, useEffect } from 'react';
import { 
  Server, Users, Activity, Shield, Cpu, Clock, Search, 
  Terminal, Database, Play, AlertTriangle, Zap, CheckCircle, XCircle 
} from 'lucide-react';
import { api } from "../../services/api";

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState({
    overview: null,
    users: [],
    health: null,
    workflows: [],
    logs: [],
    insights: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData(activeTab);
    
    // Setup WebSocket for Real-Time Monitoring
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_BACKEND_URL?.replace('http://', '').replace('https://', '') || '127.0.0.1:8000';
    const socket = new WebSocket(`${protocol}//${host}/ws/dashboard`);
    
    socket.onmessage = (event) => {
      // Whenever a system mutation happens, we refresh current tab data
      fetchData(activeTab);
    };

    return () => socket.close();
  }, [activeTab]);

  const fetchData = async (tab) => {
    setLoading(true);
    try {
      if (tab === 'overview') {
        const res = await api.get('/api/admin/overview');
        setData(prev => ({ ...prev, overview: res.data }));
      } else if (tab === 'users') {
        const res = await api.get('/api/admin/users');
        setData(prev => ({ ...prev, users: res.data }));
      } else if (tab === 'system') {
        const res = await api.get('/api/admin/system-health');
        setData(prev => ({ ...prev, health: res.data }));
      } else if (tab === 'workflows') {
        const res = await api.get('/api/admin/workflows');
        setData(prev => ({ ...prev, workflows: res.data }));
      } else if (tab === 'logs') {
        const res = await api.get('/api/admin/logs');
        setData(prev => ({ ...prev, logs: res.data }));
      } else if (tab === 'insights') {
        const res = await api.get('/api/admin/ai-insights');
        setData(prev => ({ ...prev, insights: res.data }));
      }
    } catch (err) {
      console.error(`Failed to fetch ${tab} data:`, err);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'users', label: 'Users & Roles', icon: Users },
    { id: 'system', label: 'System Health', icon: Server },
    { id: 'insights', label: 'AI Insights', icon: Zap },
  ];

  return (
    <div className="page-container animate-fade-in-up" style={{ padding: '32px' }}>
      {/* ── HEADER ── */}
      <div className="page-header" style={{ marginBottom: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Shield size={20} color="#0052CC" fill="#0052CC" />
            <span style={{ fontSize: 13, fontWeight: 800, color: '#0052CC', textTransform: 'uppercase', letterSpacing: '1px' }}>Global Settings</span>
          </div>
          <h1 className="page-title" style={{ fontSize: 28, fontWeight: 900 }}>System Admin Panel</h1>
          <p className="page-subtitle" style={{ fontSize: 15, color: '#6B778C' }}>Monitor infrastructure, manage access, and audit platform activity.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn--secondary" onClick={() => fetchData(activeTab)}>
            <Clock size={14} /> Refresh Data
          </button>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '2px solid #DFE1E6', marginBottom: 24, overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700,
              background: 'none', border: 'none', cursor: 'pointer', transition: '0.2s',
              color: activeTab === tab.id ? '#0052CC' : '#6B778C',
              borderBottom: `3px solid ${activeTab === tab.id ? '#0052CC' : 'transparent'}`,
              marginBottom: -2
            }}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── CONTENT AREA ── */}
      <div style={{ minHeight: 400 }}>
        {loading && !data[activeTab] ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#0052CC' }}>Scanning system...</div>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && data.overview && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                  <MetricCard title="Total Users" value={data.overview.total_users} icon={Users} color="#0052CC" />
                  <MetricCard title="Executions Today" value={data.overview.executions_today} icon={Play} color="#36B37E" />
                  <MetricCard title="Failed Tests" value={data.overview.failed_tests} icon={XCircle} color="#FF5630" />
                  <MetricCard title="Open Bugs" value={data.overview.open_bugs} icon={AlertTriangle} color="#FFAB00" />
                </div>
                <div className="card">
                  <div className="card-header"><span className="card-header-title">Recent System Activity</span></div>
                  <table className="data-table">
                    <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Resource</th></tr></thead>
                    <tbody>
                      {data.overview.recent_activity.map(act => (
                        <tr key={act.id}>
                          <td style={{ color: '#6B778C', fontSize: 12 }}>{new Date(act.timestamp).toLocaleString()}</td>
                          <td style={{ fontWeight: 600 }}>{act.user}</td>
                          <td><span className="badge badge--info">{act.action}</span></td>
                          <td style={{ fontFamily: 'monospace', color: '#42526E' }}>{act.resource}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* USERS TAB */}
            {activeTab === 'users' && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div className="search-wrapper" style={{ margin: 0, width: 300 }}><Search size={14} /><input className="search-input" placeholder="Search users..."/></div>
                  <button className="btn btn--primary">Invite User</button>
                </div>
                <table className="data-table">
                  <thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Last Active</th><th>Actions</th></tr></thead>
                  <tbody>
                    {data.users.map(u => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 700 }}>{u.email}</td>
                        <td><span className="badge badge--gray">{u.role}</span></td>
                        <td><span className={`badge badge--${u.status === 'Active' ? 'success' : 'danger'}`}>{u.status}</span></td>
                        <td style={{ color: '#6B778C', fontSize: 12 }}>{u.last_active ? new Date(u.last_active).toLocaleDateString() : 'Never'}</td>
                        <td><button className="btn btn--subtle" style={{ height: 28, fontSize: 11 }}>Manage</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* SYSTEM HEALTH TAB */}
            {activeTab === 'system' && data.health && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div className="card" style={{ padding: 24, background: data.health.db_connection === 'Healthy' ? '#E3FCEF' : '#FFEBE6' }}>
                  <Database size={32} color={data.health.db_connection === 'Healthy' ? '#006644' : '#BF2600'} style={{ marginBottom: 16 }} />
                  <h3 style={{ margin: '0 0 8px' }}>Database Connection</h3>
                  <div style={{ fontSize: 24, fontWeight: 900, color: data.health.db_connection === 'Healthy' ? '#006644' : '#BF2600' }}>{data.health.db_connection}</div>
                  <p style={{ margin: '8px 0 0', fontSize: 13 }}>PostgreSQL Cluster Status</p>
                </div>
                <div className="card" style={{ padding: 24, background: data.health.execution_engine === 'Healthy' ? '#E3FCEF' : '#FFFAE6' }}>
                  <Cpu size={32} color={data.health.execution_engine === 'Healthy' ? '#006644' : '#974F0C'} style={{ marginBottom: 16 }} />
                  <h3 style={{ margin: '0 0 8px' }}>Execution Engine</h3>
                  <div style={{ fontSize: 24, fontWeight: 900, color: data.health.execution_engine === 'Healthy' ? '#006644' : '#974F0C' }}>{data.health.execution_engine}</div>
                  <p style={{ margin: '8px 0 0', fontSize: 13 }}>{data.health.pending_executions} runs currently queued</p>
                </div>
                <div className="card" style={{ padding: 24 }}>
                   <div style={{ fontSize: 12, fontWeight: 700, color: '#6B778C', textTransform: 'uppercase' }}>API Latency</div>
                   <div style={{ fontSize: 32, fontWeight: 900, color: '#091E42', marginTop: 8 }}>{data.health.api_response_time}</div>
                </div>
                <div className="card" style={{ padding: 24 }}>
                   <div style={{ fontSize: 12, fontWeight: 700, color: '#6B778C', textTransform: 'uppercase' }}>Active Automation Flows</div>
                   <div style={{ fontSize: 32, fontWeight: 900, color: '#0052CC', marginTop: 8 }}>{data.health.active_workflows}</div>
                </div>
              </div>
            )}

            
            {/* AI INSIGHTS TAB */}
            {activeTab === 'insights' && (
              <div style={{ display: 'grid', gap: 16 }}>
                {data.insights.map(ins => (
                  <div key={ins.id} className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: `4px solid ${ins.type === 'warning' ? '#FF5630' : ins.type === 'info' ? '#0052CC' : '#36B37E'}` }}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                       {ins.type === 'warning' ? <AlertTriangle color="#FF5630"/> : <Zap color="#0052CC"/> }
                       <div style={{ fontSize: 15, fontWeight: 600, color: '#091E42' }}>{ins.message}</div>
                    </div>
                    <button className="btn btn--secondary">{ins.action}</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const MetricCard = ({ title, value, icon: Icon, color }) => (
  <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
    <div style={{ background: `${color}15`, padding: 12, borderRadius: 12 }}><Icon size={24} color={color} /></div>
    <div>
      <div style={{ fontSize: 24, fontWeight: 900, color: '#091E42' }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#6B778C' }}>{title}</div>
    </div>
  </div>
);

export default AdminPanel;
