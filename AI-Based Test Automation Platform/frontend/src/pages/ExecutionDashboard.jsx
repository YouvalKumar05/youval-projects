import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Square, Filter, Search, Download, Clock,
  CheckCircle, XCircle, AlertCircle, RefreshCw,
  MoreHorizontal, ChevronDown, Loader2, Activity, Settings as SettingsIcon
} from 'lucide-react';
import { api } from '../services/api';
import { useWorkflow } from '../context/WorkflowContext';

const STATUS_MAP = {
  'running': { color: '#2684FF', bg: '#DEEBFF', icon: Clock, label: 'Running' },
  'pass': { color: '#36B37E', bg: '#E3FCEF', icon: CheckCircle, label: 'Passed' },
  'fail': { color: '#FF5630', bg: '#FFEBE6', icon: XCircle, label: 'Failed' },
  'pending': { color: '#6B778C', bg: '#F4F5F7', icon: Clock, label: 'Pending' },
  'error': { color: '#FF5630', bg: '#FFEBE6', icon: AlertCircle, label: 'Error' },
};

const getStatus = (status) => {
  const s = (status || 'pending').toLowerCase();
  return STATUS_MAP[s] || STATUS_MAP['pending'];
};

const ExecutionDashboard = () => {
  const { activeWorkflow, updateWorkflow } = useWorkflow();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [logs, setLogs] = useState([]);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState({
    browser_type: 'chromium',
    headless: true,
    delay: 1.0,
    execution_type: 'all'
  });
  const wsRef = useRef(null);

  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  
  const [testCases, setTestCases] = useState([]);
  const [leftPanelTab, setLeftPanelTab] = useState('Executions'); // 'Executions' or 'Scenarios'

  useEffect(() => {
    fetchTestCases();
  }, []);

  const fetchTestCases = async () => {
    try {
      const res = await api.get('/api/testcases');
      if (res.status === 'success' || Array.isArray(res.data)) {
        setTestCases(res.data || res);
      }
    } catch (err) { console.error(err); }
  };

  const handleRunAll = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/testcases');
      if (res.status === 'success') {
        const approvedTCs = res.data.map(tc => tc.id);
        if (approvedTCs.length === 0) {
          alert('No test cases found to run.');
          return;
        }
        const runRes = await api.post('/api/executions/bulk-run', {
          test_case_ids: approvedTCs,
          ...config
        });
        if (runRes.status === 'success') {
          alert(`Successfully triggered ${runRes.data.execution_ids.length} executions.`);
          const newData = await fetchExecutions();
          if (newData && runRes.data.execution_ids.length > 0) {
              const newlyCreated = newData.find(r => r.id === runRes.data.execution_ids[0]);
              if (newlyCreated) setSelected(newlyCreated);
          }
        }
      }
    } catch (err) {
      alert('Failed to trigger bulk execution: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Removed unused API endpoints for projects/sprints/versions since they are superseded by dynamic Data Center identities

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const autoRunId = params.get('auto_run');

    fetchExecutions().then((data) => {
      if (autoRunId) {
        handleRerun(autoRunId);
        // Clear param without reload
        window.history.replaceState({}, '', '/execution-dashboard');
        updateWorkflow({ status: 'executing' });
      }
    });

    const interval = setInterval(fetchExecutions, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleDeleteExecution = async (e, executionId) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this execution history?')) return;
    try {
      const res = await api.delete(`/api/executions/${executionId}`);
      if (res.status === 'success') {
        setRuns(prev => prev.filter(r => r.id !== executionId));
        if (selected?.id === executionId) {
          setSelected(null);
          setLogs([]);
        }
      } else {
        alert(res.message || 'Failed to delete execution');
      }
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  useEffect(() => {
    if (!selected) return;

    if (selected.status === 'Running') {
      connectWebSocket(selected.id);
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [selected?.id, selected?.status]);

  const fetchExecutions = async () => {
    try {
      const res = await api.get(`/api/executions?t=${new Date().getTime()}`);
      if (res.status === 'success') {
        setRuns(res.data);
        setSelected(prev => {
          if (!prev && res.data.length > 0) return res.data[0];
          if (prev) {
            const updated = res.data.find(r => r.id === prev.id);
            if (updated && updated.status !== 'Running' && prev.status === 'Running') {
              setTimeout(() => {
                window.location.href = `/execution-report/${updated.id}`;
              }, 1500);
            }
            return updated || prev;
          }
          return prev;
        });
        return res.data;
      }
    } catch (err) {
      console.error("Failed to fetch executions:", err);
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = (executionId) => {
    if (wsRef.current) wsRef.current.close();
    setLogs([]);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_BACKEND_URL ? import.meta.env.VITE_BACKEND_URL.replace('http', '') : '//127.0.0.1:8000';
    const wsUrl = `${protocol}${host}/ws/executions/${executionId}`;

    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // Handle various log formats (new and legacy)
      const logMessage = data.message || data.log || data.msg;
      if (logMessage) {
        const isOk = data.status !== 'failed' && data.ok !== false;
        setLogs(prev => [...prev, { 
          t: new Date().toLocaleTimeString(), 
          msg: logMessage, 
          ok: isOk,
          step: data.step,
          action: data.action
        }]);
      }

      if (data.type === 'execution_status' || data.status === 'PASS' || data.status === 'FAIL') {
        fetchExecutions();
        if (data.status && data.status !== 'Running' && data.status !== 'Pending') {
          setTimeout(() => {
            window.location.href = `/execution-report/${executionId}`;
          }, 2000);
        }
      }
    };

    socket.onclose = () => {
      fetchExecutions();
    };
  };

  const handleRerun = async (testCaseId, customConfig = null) => {
    try {
      const runConfig = customConfig || config;
      const res = await api.post(`/api/executions/run/${testCaseId}`, runConfig);
      if (res.status === 'success') {
        const newData = await fetchExecutions();
        if (newData && res.data.execution_id) {
            const newlyCreated = newData.find(r => r.id === res.data.execution_id);
            if (newlyCreated) setSelected(newlyCreated);
        }
        setShowConfig(false);
      }
    } catch (err) {
      alert("Trigger failed: " + err.message);
    }
  };

  const filtered = runs.filter(r => {
    // Filter by Project
    if (selectedProject && r.project_id !== selectedProject) return false;
    
    // Filter by Status
    if (statusFilter === 'All') return true;
    if (statusFilter === 'Running' && r.status === 'Running') return true;
    if (statusFilter === 'Pass' && r.status === 'PASS') return true;
    if (statusFilter === 'Fail' && r.status === 'FAIL') return true;
    return false;
  });

  if (loading && runs.length === 0) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <Loader2 className="animate-spin" size={48} color="#0052CC" />
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in-up">
      {activeWorkflow.projectName && (
        <div style={{
          background: 'linear-gradient(90deg, #0747A6, #0052CC)',
          padding: '12px 24px', borderRadius: 8, marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 16, color: 'white',
          boxShadow: '0 4px 12px rgba(0,82,204,0.2)'
        }}>
          <Activity size={20} className="animate-pulse" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', opacity: 0.8 }}>Active Deployment Workflow</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{activeWorkflow.projectName}</div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: 20 }}>
            {activeWorkflow.status.toUpperCase()}
          </span>
          <button
            onClick={() => updateWorkflow({ projectName: '' })}
            style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.6 }}
          >
            Reset
          </button>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Execution Console</h1>
          <p className="page-subtitle">Monitor and manage active and historical test runs</p>
        </div>
        <div className="page-actions">
          <button className="btn btn--secondary" onClick={() => setShowConfig(!showConfig)}>
            <SettingsIcon size={14} /> Execution Config
          </button>
          <button className="btn btn--primary" onClick={handleRunAll} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Run All Approved
          </button>
          <button className="btn btn--secondary" onClick={fetchExecutions}><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      <div style={{
        background: 'white', border: '1px solid #DFE1E6', borderRadius: 12, padding: '16px 20px',
        marginBottom: 24, display: 'flex', gap: 24, alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
      }}>
        <div style={{ flex: 2 }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: '#6B778C', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Project Identity</label>
          <select className="form-input" style={{ width: '100%', height: 38 }} value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
            <option value="">All Projects</option>
            {[...new Set(testCases.map(tc => tc.project_id).filter(Boolean))].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div style={{ padding: '0 20px', borderLeft: '1px solid #DFE1E6', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0052CC' }}>{runs.length}</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6B778C', textTransform: 'uppercase' }}>Executions</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#36B37E' }}>
            {runs.length > 0 ? Math.round((runs.filter(r => r.status === 'PASS').length / runs.length) * 100) : 0}%
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6B778C', textTransform: 'uppercase' }}>Pass Rate</div>
        </div>
      </div>

      {showConfig && (
        <div className="card" style={{ marginBottom: 24, padding: 20, background: '#F8F9FA', border: '1px solid #D1D5DB' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: '#4B5563', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Browser Environment</label>
              <select
                className="form-input"
                value={config.browser_type}
                onChange={(e) => setConfig({ ...config, browser_type: e.target.value })}
                style={{ width: '100%', height: 36, padding: '0 8px' }}
              >
                <option value="chromium">Google Chromium</option>
                <option value="firefox">Mozilla Firefox</option>
                <option value="webkit">Apple Webkit (Safari)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: '#4B5563', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Execution Mode</label>
              <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="radio" checked={config.headless} onChange={() => setConfig({ ...config, headless: true })} /> Headless
                </label>
                <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="radio" checked={!config.headless} onChange={() => setConfig({ ...config, headless: false })} /> Headed (Visible)
                </label>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: '#4B5563', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Step Delay (Seconds)</label>
              <input
                type="number"
                className="form-input"
                value={config.delay}
                onChange={(e) => setConfig({ ...config, delay: parseFloat(e.target.value) })}
                min="0" step="0.5"
                style={{ width: '100%', height: 36, padding: '0 8px' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn btn--primary" style={{ width: '100%', height: 36 }} onClick={() => setShowConfig(false)}>Save Settings</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Left: run/scenario list */}
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '2px solid #DFE1E6', paddingBottom: 8 }}>
            <button
              onClick={() => setLeftPanelTab('Scenarios')}
              style={{
                background: 'none', border: 'none', padding: '6px 12px', cursor: 'pointer',
                fontWeight: 700, fontSize: 13,
                color: leftPanelTab === 'Scenarios' ? '#0052CC' : '#6B778C',
                borderBottom: leftPanelTab === 'Scenarios' ? '2px solid #0052CC' : 'none',
                marginBottom: -10
              }}
            >Test Scenarios</button>
            <button
              onClick={() => setLeftPanelTab('Executions')}
              style={{
                background: 'none', border: 'none', padding: '6px 12px', cursor: 'pointer',
                fontWeight: 700, fontSize: 13,
                color: leftPanelTab === 'Executions' ? '#0052CC' : '#6B778C',
                borderBottom: leftPanelTab === 'Executions' ? '2px solid #0052CC' : 'none',
                marginBottom: -10
              }}
            >Execution History</button>
          </div>

          {leftPanelTab === 'Executions' && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {['All', 'Running', 'Pass', 'Fail'].map(s => (
                <button key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    padding: '5px 14px', borderRadius: 99, border: '1px solid #DFE1E6',
                    background: statusFilter === s ? '#091E42' : 'white',
                    color: statusFilter === s ? 'white' : '#344563',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >{s}</button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 'calc(100vh - 250px)', overflowY: 'auto', paddingRight: 4 }}>
            {leftPanelTab === 'Scenarios' ? (
              testCases.filter(tc => !selectedProject || tc.project_id === selectedProject).map(tc => (
                <div key={tc.id} style={{ background: 'white', border: '1px solid #DFE1E6', borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#091E42', marginBottom: 4 }}>{tc.title}</div>
                    <div style={{ fontSize: 11, color: '#6B778C' }}>TC-{tc.id} • {tc.status}</div>
                  </div>
                  <button className="btn btn--primary btn--sm" onClick={() => handleRerun(tc.id)}>
                    <Play size={12} /> Run
                  </button>
                </div>
              ))
            ) : filtered.map(run => {
              const S = getStatus(run.status);
              const isSelected = selected?.id === run.id;
              return (
                <div key={run.id}
                  onClick={() => setSelected(run)}
                  style={{
                    background: 'white', border: `2px solid ${isSelected ? S.color : '#DFE1E6'}`,
                    borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                    transition: 'all 0.15s', boxShadow: isSelected ? '0 4px 12px rgba(9,30,66,0.12)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#091E42', marginBottom: 3 }}>{run.test_case_title}</div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#6B778C', background: '#F4F5F7', padding: '1px 6px', borderRadius: 3 }}>RUN-{run.id}</span>
                          <span className="badge badge--gray" style={{ fontSize: 10 }}>{run.project_id}</span>
                          <span style={{ fontSize: 11, color: '#97A0AF' }}>{new Date(run.started_at).toLocaleTimeString()}</span>
                          <button 
                            onClick={(e) => handleDeleteExecution(e, run.id)} 
                            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#FF5630', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', opacity: 0.6 }}
                            title="Delete Execution"
                          >
                            <XCircle size={14} />
                          </button>
                        </div>
                    </div>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: S.bg, color: S.color,
                      fontWeight: 700, fontSize: 11, padding: '3px 10px', borderRadius: 99,
                    }}>
                      <S.icon size={11} className={run.status?.toLowerCase() === 'running' ? 'animate-pulse' : ''} />
                      {S.label}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 11, color: '#97A0AF' }}>
                      {run.status?.toLowerCase() === 'running' ? 'Test currently executing...' : `Finished at ${run.completed_at ? new Date(run.completed_at).toLocaleTimeString() : 'N/A'}`}
                    </div>
                    <button
                      className="icon-btn"
                      onClick={(e) => { e.stopPropagation(); handleRerun(run.test_case_id); }}
                      title="Rerun Test"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: run detail + live log */}
        {selected ? (
          <div>
            <div className="card" style={{ overflow: 'hidden' }}>
              <div className="card-header">
                <div>
                  <span className="card-header-title">Execution Console — RUN-{selected.id}</span>
                  <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>{selected.test_case_title}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {selected.status === 'Running' && (
                    <button className="btn btn--danger btn--sm"><Square size={12} /> Stop</button>
                  )}
                  <button className="btn btn--secondary btn--sm" onClick={() => window.open(`${import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'}/${selected.logs_path}`, '_blank')}>
                    <Download size={13} /> Screenshot
                  </button>
                </div>
              </div>
              <div style={{
                background: '#0d1b2a', padding: '16px 20px',
                height: 500, overflowY: 'auto',
                fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.8,
                borderRadius: '0 0 8px 8px'
              }}>
                {logs.length > 0 ? logs.map((l, i) => (
                  <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 4, borderLeft: `2px solid ${l.ok ? (l.msg.includes('FAIL') ? '#F87171' : '#4ADE80') : '#F87171'}`, paddingLeft: 12 }}>
                    <span style={{ color: '#4B5563', flexShrink: 0, width: 70 }}>{l.t}</span>
                    <span style={{ color: l.ok ? (l.msg.includes('FAILED') || l.msg.includes('FAIL') ? '#F87171' : '#E5E7EB') : '#F87171' }}>
                      {l.msg}
                    </span>
                  </div>
                )) : (
                  <div style={{ color: '#4B5563', textAlign: 'center', marginTop: 40 }}>
                    No logs available for this execution yet.
                  </div>
                )}
                {selected.status === 'Running' && (
                  <div style={{ display: 'flex', gap: 16, borderLeft: '2px solid #60A5FA', paddingLeft: 12 }}>
                    <span style={{ color: '#4B5563', width: 70 }}>live</span>
                    <span style={{ color: '#60A5FA' }} className="animate-pulse">▋</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions / Results */}
            {selected.status !== 'Running' && (
              <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div className="card" style={{ padding: 20 }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 800, color: '#6B778C', textTransform: 'uppercase' }}>Artifacts</h4>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 60, height: 60, background: '#F4F5F7', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #DFE1E6' }}>
                      <Download size={20} color="#6B778C" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Full Screenshot</div>
                      <div style={{ fontSize: 12, color: '#97A0AF' }}>Captured at final step</div>
                    </div>
                  </div>
                </div>
                <div className="card" style={{ padding: 20 }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 800, color: '#6B778C', textTransform: 'uppercase' }}>Workflow Status</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {selected.status === 'FAIL' ? (
                      <>
                        <AlertCircle size={20} color="#FF5630" />
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#FF5630' }}>Defect created & assigned to Lead</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle size={20} color="#36B37E" />
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#36B37E' }}>Quality Gate Passed</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ padding: 60, textAlign: 'center', color: '#6B778C' }}>
            <Search size={48} style={{ margin: '0 auto 20px', opacity: 0.3 }} />
            <p>Select an execution from the list to view live logs and artifacts</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExecutionDashboard;
