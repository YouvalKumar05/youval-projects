import React, { useState, useEffect } from "react";
import { Shield, Lock, Unlock, Save, Check, X } from "lucide-react";
import { api } from "../../services/api";

const RESOURCES = ["testcases", "executions", "workflows", "tasks", "rbac", "admin"];
const ACTIONS = ["read", "write", "delete", "execute"];

const PermissionMatrix = ({ selectedRoleId, roleName }) => {
    const [permissions, setPermissions] = useState({});
    const [saving, setSaving] = useState(false);

    // Fetch real permission state for this role
    useEffect(() => {
        if (!selectedRoleId) return;
        
        const loadPermissions = async () => {
            try {
                const res = await api.get(`/api/rbac/roles/${selectedRoleId}/permissions`);
                if (res.status === "success") {
                    const currentPerms = {};
                    // Initialize empty matix
                    RESOURCES.forEach(res => {
                        currentPerms[res] = ACTIONS.reduce((acc, action) => {
                            acc[action] = false;
                            return acc;
                        }, {});
                    });
                    
                    // Fill from API
                    res.data.forEach(p => {
                        if (currentPerms[p.resource_name]) {
                            currentPerms[p.resource_name][p.action] = true;
                        }
                    });
                    setPermissions(currentPerms);
                }
            } catch (err) {
                console.error("Failed to load permissions:", err);
            }
        };
        
        loadPermissions();
    }, [selectedRoleId]);

    const togglePermission = (resource, action) => {
        setPermissions(prev => ({
            ...prev,
            [resource]: {
                ...prev[resource],
                [action]: !prev[resource][action]
            }
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Flatten matrix for API
            const permsArray = [];
            Object.entries(permissions).forEach(([res, actions]) => {
                Object.entries(actions).forEach(([action, isSet]) => {
                    if (isSet) permsArray.push({ resource_name: res, action: action });
                });
            });

            await api.post(`/api/rbac/assign-permissions`, {
                role_id: parseInt(selectedRoleId),
                permissions: permsArray
            });
            alert(`Permissions synchronized for ${roleName}`);
        } catch (err) {
            console.error(err);
            alert("Failed to update permissions");
        } finally {
            setSaving(false);
        }
    };

    if (!selectedRoleId) {
        return (
            <div className="matrix-placeholder">
                <Lock size={48} color="#cbd5e1" />
                <p>Select a role from the hierarchy to manage granular permissions</p>
            </div>
        );
    }

    return (
        <div className="permission-matrix card">
            <header className="matrix-header">
                <div>
                    <h3>Granular Permissions: <span style={{ color: '#6366f1' }}>{roleName}</span></h3>
                    <p>Manage specific resource actions for this tier</p>
                </div>
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : <><Save size={18} /> Save Matrix</>}
                </button>
            </header>

            <div className="matrix-table-wrapper">
                <table className="matrix-table">
                    <thead>
                        <tr>
                            <th>Resource</th>
                            {ACTIONS.map(action => <th key={action}>{action}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {RESOURCES.map(res => (
                            <tr key={res}>
                                <td className="res-name">
                                    <Shield size={14} style={{ marginRight: '8px' }} />
                                    {res}
                                </td>
                                {ACTIONS.map(action => (
                                    <td key={action} className="check-cell" onClick={() => togglePermission(res, action)}>
                                        <div className={`checkbox ${permissions[res]?.[action] ? 'active' : ''}`}>
                                            {permissions[res]?.[action] ? <Check size={14} /> : <X size={14} />}
                                        </div>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <style>{`
                .matrix-placeholder {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 4rem;
                    text-align: center;
                    color: #64748b;
                    background: #f8fafc;
                    border: 2px dashed #e2e8f0;
                    border-radius: 1rem;
                }
                .matrix-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                }
                .matrix-header h3 { margin: 0; font-size: 1.125rem; }
                .matrix-header p { margin: 0.25rem 0 0; font-size: 0.875rem; color: #64748b; }
                
                .matrix-table-wrapper {
                    border: 1px solid #e2e8f0;
                    border-radius: 0.75rem;
                    overflow: hidden;
                }
                .matrix-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .matrix-table th {
                    background: #f8fafc;
                    padding: 1rem;
                    text-align: center;
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    color: #64748b;
                    border-bottom: 1px solid #e2e8f0;
                }
                .matrix-table th:first-child { text-align: left; }
                .matrix-table td {
                    padding: 1rem;
                    border-bottom: 1px solid #f1f5f9;
                }
                .res-name {
                    font-weight: 600;
                    color: #1e293b;
                    text-transform: capitalize;
                    display: flex;
                    align-items: center;
                }
                .check-cell {
                    text-align: center;
                    cursor: pointer;
                }
                .checkbox {
                    width: 24px;
                    height: 24px;
                    border-radius: 6px;
                    border: 2px solid #e2e8f0;
                    margin: 0 auto;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: transparent;
                    transition: all 0.2s;
                }
                .checkbox.active {
                    background: #6366f1;
                    border-color: #6366f1;
                    color: white;
                }
            `}</style>
        </div>
    );
};

export default PermissionMatrix;
