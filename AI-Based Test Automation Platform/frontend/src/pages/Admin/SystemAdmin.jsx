import React, { useState } from 'react';
import { Users, Plus, Search, Edit2, Trash2, Shield, MoreHorizontal, Download, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

const MOCK_USERS = [
  { id: 1, name: 'Youval Kumar', email: 'youval@autoqa.io', role: 'Administrator', status: 'Active', lastLogin: '2 min ago', initials: 'YK', joined: 'Jan 15, 2024' },
  { id: 2, name: 'Sarah Chen', email: 'sarah@autoqa.io', role: 'QA Lead', status: 'Active', lastLogin: '1h ago', initials: 'SC', joined: 'Feb 3, 2024' },
  { id: 3, name: 'Marcus Rivera', email: 'marcus@autoqa.io', role: 'QA Engineer', status: 'Active', lastLogin: '3h ago', initials: 'MR', joined: 'Mar 10, 2024' },
  { id: 4, name: 'Priya Mehta', email: 'priya@autoqa.io', role: 'Developer', status: 'Active', lastLogin: 'Yesterday', initials: 'PM', joined: 'Apr 1, 2024' },
  { id: 5, name: 'Tom Walsh', email: 'tom@autoqa.io', role: 'QA Engineer', status: 'Inactive', lastLogin: '14 days ago', initials: 'TW', joined: 'May 21, 2024' },
  { id: 6, name: 'Diana Kovacs', email: 'diana@autoqa.io', role: 'QA Lead', status: 'Active', lastLogin: '30m ago', initials: 'DK', joined: 'Jun 8, 2024' },
];

const ROLES = ['Administrator', 'QA Lead', 'QA Engineer', 'Developer'];
const ROLE_COLORS = { Administrator: '#FF5630', 'QA Lead': '#6554C0', 'QA Engineer': '#2684FF', Developer: '#36B37E' };

const SystemAdmin = () => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('QA Engineer');

  const stats = [
    { label: 'Total Users', value: MOCK_USERS.length, color: '#2684FF' },
    { label: 'Active', value: MOCK_USERS.filter(u => u.status === 'Active').length, color: '#36B37E' },
    { label: 'Inactive', value: MOCK_USERS.filter(u => u.status === 'Inactive').length, color: '#FF5630' },
    { label: 'Roles', value: ROLES.length, color: '#6554C0' },
  ];

  const filtered = MOCK_USERS.filter(u => {
    if (roleFilter !== 'All' && u.role !== roleFilter) return false;
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="page-container animate-fade-in-up">
      <div className="page-header">
        <div>
          <h1 className="page-title">System Administration</h1>
          <p className="page-subtitle">Manage platform users, roles, and system settings</p>
        </div>
        <div className="page-actions">
          <button className="btn btn--secondary"><Download size={14} /> Export</button>
          <button className="btn btn--primary" onClick={() => setShowInvite(true)}>
            <Plus size={15} /> Invite User
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20, marginBottom: 28 }}>
        {stats.map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#97A0AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <div className="search-wrapper">
          <Search size={14} className="search-icon" />
          <input className="search-input" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 280 }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['All', ...ROLES].map(r => (
            <button key={r}
              onClick={() => setRoleFilter(r)}
              style={{
                padding: '5px 14px', borderRadius: 99, border: '1px solid #DFE1E6',
                background: roleFilter === r ? '#091E42' : 'white',
                color: roleFilter === r ? 'white' : '#344563',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              }}
            >{r}</button>
          ))}
        </div>
      </div>

      {/* User Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(user => (
              <tr key={user.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: ROLE_COLORS[user.role] || '#2684FF',
                      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, flexShrink: 0,
                    }}>
                      {user.initials}
                    </div>
                    <span style={{ fontWeight: 600, color: '#091E42', fontSize: 14 }}>{user.name}</span>
                  </div>
                </td>
                <td style={{ color: '#6B778C', fontSize: 13 }}>{user.email}</td>
                <td>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: ROLE_COLORS[user.role] + '18',
                    color: ROLE_COLORS[user.role],
                    fontWeight: 700, fontSize: 12, padding: '3px 10px', borderRadius: 99,
                  }}>
                    <Shield size={11} /> {user.role}
                  </span>
                </td>
                <td>
                  {user.status === 'Active'
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#36B37E', fontSize: 13, fontWeight: 600 }}>
                        <CheckCircle size={13} /> Active
                      </span>
                    : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#FF5630', fontSize: 13, fontWeight: 600 }}>
                        <XCircle size={13} /> Inactive
                      </span>
                  }
                </td>
                <td style={{ color: '#6B778C', fontSize: 13 }}>{user.lastLogin}</td>
                <td style={{ color: '#6B778C', fontSize: 13 }}>{user.joined}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn--subtle btn--sm"><Edit2 size={13} /> Edit</button>
                    <button className="icon-btn"><MoreHorizontal size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(9,30,66,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400,
        }}
          onClick={e => { if (e.target === e.currentTarget) setShowInvite(false); }}
        >
          <div style={{ background: 'white', borderRadius: 16, padding: 32, width: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#091E42', marginBottom: 8 }}>Invite New User</h3>
            <p style={{ fontSize: 14, color: '#6B778C', marginBottom: 24 }}>Send a platform invite to a team member or stakeholder.</p>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Email Address</label>
              <input type="email" className="form-input" placeholder="user@company.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label className="form-label">Assign Role</label>
              <select className="form-select" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn--primary btn--lg" style={{ flex: 1 }}>Send Invite</button>
              <button className="btn btn--secondary" onClick={() => setShowInvite(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemAdmin;
