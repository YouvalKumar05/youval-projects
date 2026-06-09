import React, { useState, useEffect } from 'react';
import {
  Users, Shield, Plus, Edit2, Trash2, ChevronRight, ChevronDown,
  Lock, Save, Loader2, AlertCircle, Check, X, UserCheck, GitMerge, Copy
} from 'lucide-react';
import { api } from '../../services/api';

// ─── Resource / Action Matrix Config ──────────────────────────────────────
const RESOURCES = [
  { key: 'testcases',  label: 'Test Cases'  },
  { key: 'executions', label: 'Executions'  },
  { key: 'tasks',      label: 'Tasks'       },
  { key: 'workflows',  label: 'Workflows'   },
  { key: 'bugs',       label: 'Bugs'        },
  { key: 'reports',    label: 'Reports'     },
  { key: 'roles',      label: 'Roles'       },
  { key: 'rbac',       label: 'RBAC'        },
  { key: 'admin',      label: 'Admin'       },
  { key: 'ai',         label: 'AI Engine'   },
];
const ACTIONS = ['read', 'write', 'create', 'execute', 'all'];

const ROLE_COLORS = ['#0052CC', '#6554C0', '#36B37E', '#FF5630', '#FFAB00', '#00B8D9'];

// ─── Initial Matrix: all false ─────────────────────────────────────────────
const emptyMatrix = () => {
  const m = {};
  RESOURCES.forEach(r => {
    m[r.key] = {};
    ACTIONS.forEach(a => { m[r.key][a] = false; });
  });
  return m;
};

const permStringToMatrix = (permStrings = []) => {
  const m = emptyMatrix();
  permStrings.forEach(p => {
    const [res, act] = p.split(':');
    if (m[res] && act) m[res][act] = true;
  });
  return m;
};

// ─── Small Components ──────────────────────────────────────────────────────
const PermCheckbox = ({ checked, onChange }) => (
  <div
    onClick={onChange}
    style={{
      margin: '0 auto', width: 22, height: 22,
      border: `2px solid ${checked ? '#0052CC' : '#DFE1E6'}`,
      borderRadius: 6, display: 'flex', alignItems: 'center',
      justifyContent: 'center', cursor: 'pointer',
      background: checked ? '#0052CC' : 'white',
      transition: 'all 0.15s'
    }}
  >
    {checked && <Check size={13} color="white" strokeWidth={3} />}
  </div>
);

// ─── Create / Edit Role Modal ──────────────────────────────────────────────
const RoleModal = ({ roles, onClose, onSaved, editing }) => {
  const [name, setName] = useState(editing?.name || '');
  const [desc, setDesc] = useState(editing?.description || '');
  const [parentId, setParentId] = useState(editing?.parent_role_id || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = { name, description: desc, parent_role_id: parentId || null };
      if (editing) {
        await api.put(`/api/rbac/roles/${editing.id}`, payload);
      } else {
        await api.post('/api/rbac/roles', payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      alert('Failed to save role: ' + (e.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(9,30,66,0.5)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="card animate-fade-in-up" onClick={e => e.stopPropagation()} style={{ width: 480 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #DFE1E6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#091E42' }}>
            {editing ? 'Edit Role' : 'Create New Role'}
          </h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Role Name *</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. QA Engineer" />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-input" rows={3} value={desc} onChange={e => setDesc(e.target.value)} placeholder="What does this role do?" style={{ resize: 'none' }} />
          </div>
          <div className="form-group">
            <label className="form-label">Parent Role (Hierarchy)</label>
            <select className="form-select" value={parentId} onChange={e => setParentId(e.target.value ? parseInt(e.target.value) : '')}>
              <option value="">— No Parent (Top-level) —</option>
              {roles.filter(r => r.id !== editing?.id).map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #DFE1E6', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSubmit} disabled={saving || !name.trim()}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving...' : editing ? 'Update Role' : 'Create Role'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────
const RoleHierarchyTree = () => {
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [expanded, setExpanded] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [matrix, setMatrix] = useState(emptyMatrix());
  const [assignedUsers, setAssignedUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('permissions'); // permissions | users
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);

  // ── Load Roles ──
  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/rbac/roles');
      if (res.status === 'success') {
        setRoles(res.data);
        // Auto-select first role
        if (res.data.length > 0 && !selectedRole) {
          selectRole(res.data[0], res.data);
        }
      }
    } catch (e) {
      console.error('Failed to load roles', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRoles(); }, []);

  const selectRole = async (role, allRoles = roles) => {
    setSelectedRole(role);
    // Build matrix from role.permissions (list of "res:act" strings)
    setMatrix(permStringToMatrix(role.permissions || []));

    // Load assigned users
    try {
      const res = await api.get(`/api/rbac/users/${role.id}`);
      if (res.status === 'success') setAssignedUsers(res.data);
    } catch { setAssignedUsers([]); }
  };

  // ── Permission Matrix Toggle ──
  const togglePerm = (res, act) => {
    setMatrix(prev => ({ ...prev, [res]: { ...prev[res], [act]: !prev[res][act] } }));
  };

  // ── Save Permissions ──
  const savePermissions = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      // Convert matrix to perms array for unified saving
      const permsArray = [];
      Object.entries(matrix).forEach(([res, actions]) => {
          Object.entries(actions).forEach(([action, isSet]) => {
              if (isSet) permsArray.push({ resource_name: res, action: action });
          });
      });

      await api.post(`/api/rbac/assign-permissions`, {
          role_id: parseInt(selectedRole.id),
          permissions: permsArray
      });
      alert('Permissions successfully synchronized with backend.');
      await fetchRoles();
      // Re-select same role to refresh
      const updated = roles.find(r => r.id === selectedRole.id);
      if (updated) selectRole(updated);
    } catch (e) {
      alert('Failed to save: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete Role ──
  const deleteRole = async (role) => {
    if (!window.confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/rbac/roles/${role.id}`);
      setSelectedRole(null);
      fetchRoles();
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  };

  // ── Tree helpers ──
  const toggleExpand = (id) =>
    setExpanded(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);

  const renderTree = (parentId = null, depth = 0) => {
    const children = roles.filter(r => (r.parent_role_id ?? null) === parentId);
    if (!children.length) return null;

    return children.map((role, idx) => {
      const isOpen     = expanded.includes(role.id);
      const isSelected = selectedRole?.id === role.id;
      const hasKids    = roles.some(r => r.parent_role_id === role.id);
      const color      = ROLE_COLORS[idx % ROLE_COLORS.length];

      return (
        <div key={role.id}>
          <div
            onClick={() => selectRole(role)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 14px', paddingLeft: 14 + depth * 20,
              cursor: 'pointer',
              background: isSelected ? '#DEEBFF' : 'transparent',
              borderLeft: isSelected ? '3px solid #0052CC' : '3px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            {/* expand/collapse */}
            <span
              onClick={e => { e.stopPropagation(); toggleExpand(role.id); }}
              style={{ width: 16, display: 'flex', alignItems: 'center', flexShrink: 0 }}
            >
              {hasKids
                ? isOpen
                  ? <ChevronDown size={13} color="#97A0AF" />
                  : <ChevronRight size={13} color="#97A0AF" />
                : null}
            </span>

            {/* role icon */}
            <div style={{
              width: 28, height: 28, borderRadius: 7, flexShrink: 0,
              background: isSelected ? '#0052CC' : color + '22',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Shield size={13} color={isSelected ? 'white' : color} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500, color: isSelected ? '#0052CC' : '#091E42', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {role.name}
              </div>
              {role.description && !depth && (
                <div style={{ fontSize: 10, color: '#97A0AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {role.description}
                </div>
              )}
            </div>
          </div>
          {isOpen && renderTree(role.id, depth + 1)}
        </div>
      );
    });
  };

  if (loading && !roles.length) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <Loader2 size={40} className="animate-spin" color="#0052CC" />
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in-up">
      {/* ── Header ── */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Roles & Permissions</h1>
          <p className="page-subtitle">Manage access control, role hierarchy, and permission matrices</p>
        </div>
        <div className="page-actions">
          <button className="btn btn--secondary">Export</button>
          <button className="btn btn--primary" onClick={() => { setEditingRole(null); setShowModal(true); }}>
            <Plus size={14} /> Create Role
          </button>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, alignItems: 'start' }}>

        {/* LEFT: Role Hierarchy Tree */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', background: '#FAFBFC', borderBottom: '1px solid #DFE1E6', display: 'flex', alignItems: 'center', gap: 8 }}>
            <GitMerge size={14} color="#0052CC" />
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#6B778C', letterSpacing: '0.06em' }}>
              Role Hierarchy
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11, background: '#DFE1E6', borderRadius: 99, padding: '2px 8px', fontWeight: 700, color: '#42526E' }}>
              {roles.length}
            </span>
          </div>
          <div style={{ padding: '8px 0' }}>
            {roles.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#97A0AF', fontSize: 13 }}>
                No roles configured yet.
              </div>
            ) : renderTree(null)}
          </div>
        </div>

        {/* RIGHT: Role Detail Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {selectedRole ? (
            <>
              {/* Role Header */}
              <div className="card">
                <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 12, background: '#DEEBFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Shield size={24} color="#0052CC" />
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#091E42' }}>{selectedRole.name}</h2>
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B778C' }}>
                        {selectedRole.description || 'No description provided.'}
                        {selectedRole.parent_role_id && (
                          <span style={{ marginLeft: 8, background: '#EAE6FF', color: '#6554C0', padding: '1px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                            Inherits from parent
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn--secondary" onClick={() => { setEditingRole(selectedRole); setShowModal(true); }}>
                      <Edit2 size={13} /> Edit
                    </button>
                    <button className="icon-btn" style={{ color: '#FF5630' }} onClick={() => deleteRole(selectedRole)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Tab bar */}
                <div style={{ display: 'flex', borderBottom: '1px solid #DFE1E6', background: '#FAFBFC' }}>
                  {[
                    { id: 'permissions', label: 'Permission Matrix', icon: Lock },
                    { id: 'users',       label: 'Assigned Users',   icon: Users },
                  ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                      padding: '13px 20px', border: 'none', background: 'transparent', cursor: 'pointer',
                      fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7,
                      color: activeTab === tab.id ? '#0052CC' : '#6B778C',
                      borderBottom: activeTab === tab.id ? '2px solid #0052CC' : '2px solid transparent',
                      transition: 'all 0.15s'
                    }}>
                      <tab.icon size={14} /> {tab.label}
                    </button>
                  ))}
                </div>

                {/* ── Permission Matrix Tab ── */}
                {activeTab === 'permissions' && (
                  <>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#F4F5F7' }}>
                            <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6B778C', letterSpacing: '0.06em' }}>
                              Resource
                            </th>
                            {ACTIONS.map(act => (
                              <th key={act} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6B778C', letterSpacing: '0.06em', textAlign: 'center' }}>
                                {act}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {RESOURCES.map((res, i) => (
                            <tr key={res.key} style={{ borderBottom: '1px solid #F4F5F7', background: i % 2 === 0 ? 'white' : '#FAFBFC' }}>
                              <td style={{ padding: '13px 20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <Lock size={13} color="#97A0AF" />
                                  <span style={{ fontWeight: 600, fontSize: 13, color: '#344563' }}>{res.label}</span>
                                </div>
                              </td>
                              {ACTIONS.map(act => (
                                <td key={act} style={{ textAlign: 'center', padding: '10px 16px' }}>
                                  <PermCheckbox
                                    checked={!!matrix[res.key]?.[act]}
                                    onChange={() => togglePerm(res.key, act)}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Save bar */}
                    <div style={{ padding: '14px 20px', background: '#F4F5F7', borderTop: '1px solid #DFE1E6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#6B778C' }}>
                        <AlertCircle size={14} color="#FFAB00" />
                        Parent role permissions are inherited automatically in the backend.
                      </div>
                      <button className="btn btn--primary" onClick={savePermissions} disabled={saving} style={{ minWidth: 160, justifyContent: 'center' }}>
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {saving ? 'Saving...' : 'Update Permissions'}
                      </button>
                    </div>
                  </>
                )}

                {/* ── Users Tab ── */}
                {activeTab === 'users' && (
                  <div style={{ padding: 20 }}>
                    {assignedUsers.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#97A0AF' }}>
                        <UserCheck size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                        <p style={{ fontSize: 14 }}>No users assigned to this role.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {assignedUsers.map(user => (
                          <div key={user.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#F8F9FB', borderRadius: 8, border: '1px solid #DFE1E6' }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#0052CC', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                              {user.email.substring(0, 2).toUpperCase()}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#091E42' }}>{user.email}</div>
                              <div style={{ fontSize: 11, color: user.is_active ? '#36B37E' : '#FF5630' }}>
                                {user.is_active ? '● Active' : '○ Inactive'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="card" style={{ padding: '80px 40px', textAlign: 'center' }}>
              <Shield size={56} color="#DFE1E6" style={{ margin: '0 auto 20px' }} />
              <h3 style={{ color: '#6B778C', margin: '0 0 8px' }}>Select a role to manage</h3>
              <p style={{ color: '#97A0AF', fontSize: 14 }}>
                Click any role in the hierarchy tree to view and edit its permissions.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Role Create/Edit Modal */}
      {showModal && (
        <RoleModal
          roles={roles}
          editing={editingRole}
          onClose={() => { setShowModal(false); setEditingRole(null); }}
          onSaved={fetchRoles}
        />
      )}
    </div>
  );
};

export default RoleHierarchyTree;
