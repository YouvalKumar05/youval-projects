import React, { useState, useEffect } from 'react';
import { 
  User, Shield, Bell, Moon, Link2, Key, Monitor, 
  Check, Save, Loader2, ChevronRight, X, Trash2, 
  MapPin, Smartphone, Globe, AlertCircle, Plus 
} from 'lucide-react';
import { api } from '../services/api';

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'ui', label: 'UI Preferences', icon: Moon },
  { id: 'api', label: 'API Tokens', icon: Key },
];

const Settings = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showToken, setShowToken] = useState(null); // Real-time token display after creation

  // State for different sections
  const [profile, setProfile] = useState({ name: '', email: '', role: '', profile_image_url: '', theme: 'light', timezone: 'UTC' });
  const [notifs, setNotifs] = useState({ email_enabled: true, inapp_enabled: true, execution_alerts: true, bug_alerts: true, workflow_alerts: true });
  const [sessions, setSessions] = useState([]);
  const [tokens, setTokens] = useState([]);
  
  // Form states
  const [pwdForm, setPwdForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [tokenName, setTokenName] = useState('');

  useEffect(() => {
    fetchSettings();
  }, [activeTab]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      if (activeTab === 'profile' || activeTab === 'ui') {
        const res = await api.get('/api/settings/profile');
        setProfile(res.data);
      } else if (activeTab === 'notifications') {
        const res = await api.get('/api/settings/notifications');
        setNotifs(res.data);
      } else if (activeTab === 'security') {
        const res = await api.get('/api/settings/sessions');
        setSessions(res.data);
      } else if (activeTab === 'api') {
        const res = await api.get('/api/settings/api-tokens');
        setTokens(res.data);
      }
    } catch (err) {
      setError("Failed to load settings. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/api/settings/profile', profile);
      // Update local storage if name/theme changed
      localStorage.setItem('user_name', profile.name);
      localStorage.setItem('theme', profile.theme);
      alert("Profile updated successfully!");
    } catch (err) {
      alert("Update failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pwdForm.new_password !== pwdForm.confirm_password) return alert("Passwords do not match");
    setSaving(true);
    try {
      await api.post('/api/settings/change-password', pwdForm);
      setPwdForm({ current_password: '', new_password: '', confirm_password: '' });
      alert("Password updated successfully!");
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleNotifToggle = async (key, val) => {
    const updated = { ...notifs, [key]: val };
    setNotifs(updated);
    try {
      await api.put('/api/settings/notifications', updated);
    } catch (err) {
      console.error("Notif update failed", err);
    }
  };

  const generateToken = async () => {
    if (!tokenName) return alert("Please name your token");
    try {
      const res = await api.post('/api/settings/api-token', { name: tokenName });
      setShowToken(res.data.token);
      setTokenName('');
      fetchSettings();
    } catch (err) {
      alert("Token generation failed");
    }
  };

  const revokeToken = async (id) => {
    if (!window.confirm("Revoke this token? Applications using it will break.")) return;
    try {
      await api.delete(`/api/settings/api-token/${id}`);
      fetchSettings();
    } catch (err) {
      alert("Revoke failed");
    }
  };

  const revokeSessions = async () => {
    if (!window.confirm("Logout from all other devices?")) return;
    try {
      await api.delete('/api/settings/sessions');
      fetchSettings();
    } catch (err) {
      alert("Failed to revoke sessions");
    }
  };

  return (
    <div className="page-container animate-fade-in" style={{ padding: '40px' }}>
      <div className="page-header" style={{ marginBottom: 40 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em', color: '#091E42' }}>User Settings</h1>
          <p className="page-subtitle" style={{ fontSize: 16, color: '#6B778C' }}>Manage your profile, security, and platform preferences.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 48, alignItems: 'start' }}>
        {/* NAV SIDEBAR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {TABS.map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderRadius: 12,
                border: 'none', background: activeTab === tab.id ? '#0052CC' : 'transparent',
                color: activeTab === tab.id ? 'white' : '#42526E',
                cursor: 'pointer', transition: '0.2s', fontWeight: 700, fontSize: 15,
                textAlign: 'left'
              }}
            >
              <tab.icon size={20} />
              {tab.label}
              {activeTab === tab.id && <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.6 }} />}
            </button>
          ))}
        </div>

        {/* CONTENT AREA */}
        <div className="card" style={{ padding: 40, minHeight: 600, border: '1px solid #DFE1E6', boxShadow: '0 4px 20px rgba(9,30,66,0.08)' }}>
          {loading && !profile.email ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#0052CC', fontWeight: 600 }}>
              <Loader2 className="animate-spin" /> Loading your preferences...
            </div>
          ) : (
            <>
              {/* PROFILE TAB */}
              {activeTab === 'profile' && (
                <form onSubmit={handleProfileSave}>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: '#091E42', marginBottom: 32 }}>Profile Details</h2>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 40, padding: 32, background: '#F4F5F7', borderRadius: 16 }}>
                    <div style={{ 
                      width: 80, height: 80, borderRadius: 40, background: '#0052CC', color: 'white', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900 
                    }}>
                      {profile.name ? profile.name[0].toUpperCase() : profile.email[0].toUpperCase()}
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 4px', fontSize: 18, color: '#091E42' }}>{profile.name || 'Set your name'}</h4>
                      <p style={{ margin: 0, fontSize: 13, color: '#6B778C' }}>{profile.role} &bull; {profile.email}</p>
                      <button type="button" className="btn btn--subtle" style={{ marginTop: 12, fontSize: 12 }}>Change Photo</button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    <div className="form-group">
                      <label className="form-label">Display Name</label>
                      <input className="form-input" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} placeholder="Full Name" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email (Read-only)</label>
                      <input className="form-input" value={profile.email} disabled style={{ background: '#F4F5F7' }} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Role</label>
                      <input className="form-input" value={profile.role} disabled style={{ background: '#F4F5F7' }} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Timezone</label>
                      <select className="form-select" value={profile.timezone} onChange={e => setProfile({...profile, timezone: e.target.value})}>
                        <option value="UTC">UTC (Universal)</option>
                        <option value="EST">EST (New York)</option>
                        <option value="GMT">GMT (London)</option>
                        <option value="IST">IST (India)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginTop: 40, borderTop: '1px solid #DFE1E6', paddingTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn btn--primary" style={{ padding: '12px 32px' }} disabled={saving}>
                      {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              )}

              {/* SECURITY TAB */}
              {activeTab === 'security' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
                  <form onSubmit={handlePasswordChange}>
                    <h2 style={{ fontSize: 20, fontWeight: 800, color: '#091E42', marginBottom: 24 }}>Password & Security</h2>
                    <div style={{ display: 'grid', gap: 16, maxWidth: 400 }}>
                      <div className="form-group">
                        <label className="form-label">Current Password</label>
                        <input type="password" className="form-input" value={pwdForm.current_password} onChange={e => setPwdForm({...pwdForm, current_password: e.target.value})} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">New Password</label>
                        <input type="password" className="form-input" value={pwdForm.new_password} onChange={e => setPwdForm({...pwdForm, new_password: e.target.value})} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Confirm New Password</label>
                        <input type="password" className="form-input" value={pwdForm.confirm_password} onChange={e => setPwdForm({...pwdForm, confirm_password: e.target.value})} required />
                      </div>
                      <button type="submit" className="btn btn--primary" style={{ marginTop: 8 }} disabled={saving}>Change Password</button>
                    </div>
                  </form>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                      <h2 style={{ fontSize: 20, fontWeight: 800, color: '#091E42', margin: 0 }}>Login Activity</h2>
                      <button className="btn btn--danger btn--sm" onClick={revokeSessions}>Log out from all devices</button>
                    </div>
                    <div style={{ border: '1px solid #DFE1E6', borderRadius: 12, overflow: 'hidden' }}>
                      {sessions.map((s, i) => (
                        <div key={s.id} style={{ 
                          display: 'flex', alignItems: 'center', gap: 20, padding: '16px 24px', 
                          borderBottom: i < sessions.length - 1 ? '1px solid #DFE1E6' : 'none',
                          background: i === 0 ? '#F0F4FF' : 'white'
                        }}>
                          <div style={{ width: 44, height: 44, borderRadius: 22, background: '#E3FCEF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {s.device === 'Web Browser' ? <Globe size={20} color="#36B37E" /> : <Smartphone size={20} color="#36B37E" />}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#091E42' }}>{s.device} &bull; {s.ip_address} {i === 0 && <span className="badge badge--success" style={{ marginLeft: 8 }}>Current Session</span>}</div>
                            <div style={{ fontSize: 12, color: '#6B778C' }}>{s.location} &bull; {new Date(s.created_at).toLocaleString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* NOTIFICATIONS TAB */}
              {activeTab === 'notifications' && (
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: '#091E42', marginBottom: 32 }}>Notification Settings</h2>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <NotifRow 
                      title="Email Notifications" 
                      desc="Receive monthly reports and critical alerts via email" 
                      val={notifs.email_enabled} 
                      onToggle={(v) => handleNotifToggle('email_enabled', v)} 
                    />
                    <NotifRow 
                      title="In-App Alerts" 
                      desc="Show desktop notifications while using the platform" 
                      val={notifs.inapp_enabled} 
                      onToggle={(v) => handleNotifToggle('inapp_enabled', v)} 
                    />
                    <div style={{ height: 1, background: '#DFE1E6', margin: '24px 0' }} />
                    <NotifRow 
                      title="Test Execution Failure" 
                      desc="Notify me immediately when an automated test fails" 
                      val={notifs.execution_alerts} 
                      onToggle={(v) => handleNotifToggle('execution_alerts', v)} 
                    />
                    <NotifRow 
                      title="Bug Assignments" 
                      desc="Notify me when a new bug is assigned to me" 
                      val={notifs.bug_alerts} 
                      onToggle={(v) => handleNotifToggle('bug_alerts', v)} 
                    />
                    <NotifRow 
                      title="Workflow Triggers" 
                      desc="Alert me when an automation workflow begins" 
                      val={notifs.workflow_alerts} 
                      onToggle={(v) => handleNotifToggle('workflow_alerts', v)} 
                    />
                  </div>
                </div>
              )}

              {/* UI TAB */}
              {activeTab === 'ui' && (
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: '#091E42', marginBottom: 32 }}>Appearance</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    <button 
                      onClick={() => { setProfile({...profile, theme: 'light'}); api.put('/api/settings/profile', {...profile, theme: 'light'}); }}
                      style={{ 
                        padding: 32, borderRadius: 16, border: profile.theme === 'light' ? '3px solid #0052CC' : '1px solid #DFE1E6',
                        background: 'white', cursor: 'pointer', textAlign: 'center'
                      }}
                    >
                      <Globe size={48} color="#0052CC" style={{ marginBottom: 16 }} />
                      <div style={{ fontWeight: 800, color: '#091E42' }}>Light Mode</div>
                    </button>
                    <button 
                      onClick={() => { setProfile({...profile, theme: 'dark'}); api.put('/api/settings/profile', {...profile, theme: 'dark'}); }}
                      style={{ 
                        padding: 32, borderRadius: 16, border: profile.theme === 'dark' ? '3px solid #0052CC' : '1px solid #DFE1E6',
                        background: '#091E42', cursor: 'pointer', textAlign: 'center', color: 'white'
                      }}
                    >
                      <Moon size={48} color="white" style={{ marginBottom: 16 }} />
                      <div style={{ fontWeight: 800 }}>Dark Mode</div>
                    </button>
                  </div>
                </div>
              )}

              {/* API TOKENS TAB */}
              {activeTab === 'api' && (
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: '#091E42', marginBottom: 8 }}>Personal Access Tokens</h2>
                  <p style={{ color: '#6B778C', marginBottom: 32 }}>Create secure tokens for CLI and integrated automation hooks.</p>

                  <div style={{ display: 'flex', gap: 12, marginBottom: 40 }}>
                    <input className="form-input" style={{ maxWidth: 300 }} placeholder="Token Name (e.g. CI/CD Runner)" value={tokenName} onChange={e => setTokenName(e.target.value)} />
                    <button className="btn btn--primary" onClick={generateToken}><Plus size={18} /> Generate Token</button>
                  </div>

                  {showToken && (
                    <div style={{ marginBottom: 32, padding: 24, background: '#E3FCEF', border: '1px solid #36B37E', borderRadius: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                        <Check size={16} color="#006644" />
                        <span style={{ fontWeight: 800, color: '#006644' }}>Success! Copy your new token:</span>
                      </div>
                      <code style={{ fontSize: 18, fontWeight: 900, background: 'rgba(255,255,255,0.5)', padding: '8px 16px', borderRadius: 6, display: 'block' }}>{showToken}</code>
                      <p style={{ fontSize: 12, color: '#6B778C', marginTop: 12 }}>Will not be displayed again. Keep it safe.</p>
                      <button className="btn btn--secondary btn--sm" style={{ marginTop: 8 }} onClick={() => setShowToken(null)}>I've copied it</button>
                    </div>
                  )}

                  <table className="data-table">
                    <thead><tr><th>Name</th><th>Created</th><th>Last Used</th><th>Actions</th></tr></thead>
                    <tbody>
                      {tokens.map(t => (
                        <tr key={t.id}>
                          <td style={{ fontWeight: 700 }}>{t.name}</td>
                          <td style={{ fontSize: 12 }}>{new Date(t.created_at).toLocaleDateString()}</td>
                          <td style={{ fontSize: 12 }}>{t.last_used ? new Date(t.last_used).toLocaleString() : 'Never'}</td>
                          <td><button className="icon-btn icon-btn--danger" onClick={() => revokeToken(t.id)}><Trash2 size={16} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const NotifRow = ({ title, desc, val, onToggle }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0' }}>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#091E42' }}>{title}</div>
      <div style={{ fontSize: 13, color: '#6B778C' }}>{desc}</div>
    </div>
    <button 
      onClick={() => onToggle(!val)}
      style={{ 
        width: 44, height: 24, borderRadius: 12, border: 'none', background: val ? '#0052CC' : '#DFE1E6',
        position: 'relative', cursor: 'pointer', transition: '0.2s'
      }}
    >
      <div style={{ 
        position: 'absolute', top: 3, left: val ? 23 : 3, width: 18, height: 18, borderRadius: 9, background: 'white',
        transition: '0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
      }} />
    </button>
  </div>
);

export default Settings;
