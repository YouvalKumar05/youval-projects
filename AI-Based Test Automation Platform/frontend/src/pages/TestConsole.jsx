import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Play, Plus, Upload, MoreHorizontal, Filter, AlertCircle, X,
  FileText, Activity, Clock, CheckCircle, XCircle, ChevronRight, Loader2, GitMerge
} from 'lucide-react';
import { api } from '../services/api';

const STATUS_COLORS = {
  PASS: '#36B37E',
  FAIL: '#FF5630',
  Running: '#2684FF',
  Pending: '#FFAB00',
  null: '#97A0AF',
  undefined: '#97A0AF'
};

const TestConsole = () => {
  const navigate = useNavigate();
  const [testCases, setTestCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Side Panel State
  const [selectedTestCase, setSelectedTestCase] = useState(null);
  const [panelTab, setPanelTab] = useState('details'); // details | history
  const [executions, setExecutions] = useState([]);
  const [execLoading, setExecLoading] = useState(false);
  const [executing, setExecuting] = useState(false);

  const [projects, setProjects] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [selectedProject, setSelectedProject] = useState('All');
  const [selectedSprint, setSelectedSprint] = useState('All');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await api.get('/api/projects');
      if (res.status === 'success') setProjects(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchSprints = async (projectId) => {
    try {
      const res = await api.get(`/api/sprints/${projectId}`);
      if (res.status === 'success') setSprints(res.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (selectedProject !== 'All') {
      fetchSprints(selectedProject);
    } else {
      setSprints([]);
      setSelectedSprint('All');
    }
  }, [selectedProject]);

  const loadTestCases = async () => {
    setLoading(true);
    try {
      let url = `/api/testcases?search=${search}`;
      if (selectedProject !== 'All') url += `&project_id=${selectedProject}`;
      // Backend testcases API currently only supports project_id filter in this version
      const res = await api.get(url);
      if (res.status === 'success') {
        setTestCases(res.data);
      }
    } catch (err) {
      console.error('Failed to load test cases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTestCases();
  }, [search, selectedProject, selectedSprint]);

  const handleRowClick = async (tc) => {
    setSelectedTestCase(tc);
    setPanelTab('details');
    loadExecutions(tc.id);
  };

  const loadExecutions = async (tcId) => {
    setExecLoading(true);
    try {
      const res = await api.get(`/api/executions/testcase/${tcId}`);
      if (res.status === 'success') {
        setExecutions(res.data);
      }
    } catch (err) {
      console.error('Failed to load executions:', err);
    } finally {
      setExecLoading(false);
    }
  };

  const closePanel = () => {
    setSelectedTestCase(null);
  };

  const [runConfig, setRunConfig] = useState({
    headless: true,
    browser_type: 'chromium',
    delay: 1.0
  });

  const handleExecute = async (tcId) => {
    setExecuting(true);
    try {
      const res = await api.post(`/api/executions/run/${tcId}`, runConfig);
      if (res.status === 'success') {
        navigate(`/execution-console/${res.data.execution_id}`);
      }
    } catch (err) {
      alert('Execution failed to start: ' + err.message);
    } finally {
      setExecuting(false);
    }
  };

  const handleDeleteTestCase = async (e, testCaseId) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this test case? This will permanently remove all associated execution history.')) return;
    try {
      const res = await api.delete(`/api/testcases/${testCaseId}`);
      if (res.status === 'success') {
        setTestCases(prev => prev.filter(tc => tc.id !== testCaseId));
        if (selectedTestCase?.id === testCaseId) setSelectedTestCase(null);
      } else {
        alert(res.message || 'Failed to delete test case');
      }
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  return (
    <div className="page-container animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-title">Test Console</h1>
          <p className="page-subtitle">Manage, execute, and track all test scenarios in one place.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn--secondary"><Upload size={14} /> Import</button>
          <button className="btn btn--primary" onClick={() => navigate('/data-input')}><Plus size={14} /> Create Test Case</button>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <div className="search-wrapper" style={{ width: 300 }}>
          <Search size={14} className="search-icon" />
          <input 
            className="search-input" 
            placeholder="Search test cases by title or ID..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
        
        <select 
          className="form-input" 
          style={{ width: 180, height: 38 }}
          value={selectedProject}
          onChange={e => setSelectedProject(e.target.value)}
        >
          <option value="All">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <select 
          className="form-input" 
          style={{ width: 180, height: 38 }}
          value={selectedSprint}
          onChange={e => setSelectedSprint(e.target.value)}
          disabled={selectedProject === 'All'}
        >
          <option value="All">All Sprints</option>
          {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <button className="btn btn--secondary"><Filter size={14}/> More Filters</button>
      </div>

      {/* Layout Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedTestCase ? '1fr 400px' : '1fr', gap: 20, transition: 'all 0.3s ease', alignItems: 'start' }}>
        
        {/* Main Table Area */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {loading ? (
             <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
               <Loader2 size={36} className="animate-spin" color="#0052CC" />
             </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Test ID</th>
                  <th>Title</th>
                  <th>Project</th>
                  <th>Steps</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {testCases.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: '#97A0AF', padding: 40 }}>
                      No test cases found.
                    </td>
                  </tr>
                ) : testCases.map(tc => (
                  <tr 
                    key={tc.id} 
                    onClick={() => handleRowClick(tc)}
                    style={{ 
                      cursor: 'pointer', 
                      background: selectedTestCase?.id === tc.id ? '#F0F4FF' : undefined,
                      borderLeft: selectedTestCase?.id === tc.id ? '3px solid #0052CC' : '3px solid transparent'
                    }}
                  >
                    <td>
                      <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#0052CC', background: '#DEEBFF', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                        TC-{String(tc.id).padStart(3, '0')}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#091E42' }}>{tc.title}</div>
                    </td>
                    <td><span className="badge badge--gray">{tc.project_id || 'Global'}</span></td>
                    <td>
                       <span style={{ fontSize: 12, color: '#6B778C' }}>
                         {tc.steps_json?.actions?.length || 0} steps
                       </span>
                    </td>
                    <td style={{ fontSize: 12, color: '#6B778C' }}>
                      {new Date(tc.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                        <button className="icon-btn" onClick={(e) => { e.stopPropagation(); handleExecute(tc.id); }} title="Execute Test">
                          {executing && selectedTestCase?.id === tc.id ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} color="#36B37E" />}
                        </button>
                        <button className="icon-btn" onClick={(e) => handleDeleteTestCase(e, tc.id)} title="Delete Test Case" style={{ color: '#FF5630' }}>
                          <XCircle size={16} />
                        </button>
                     </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Right Side Panel */}
        {selectedTestCase && (
          <div className="card animate-fade-in-right" style={{ position: 'sticky', top: 20 }}>
            {/* Panel Header */}
            <div style={{ padding: '20px', borderBottom: '1px solid #DFE1E6', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
               <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#0052CC', background: '#DEEBFF', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                      TC-{String(selectedTestCase.id).padStart(3, '0')}
                    </span>
                    <span className="badge badge--gray">{selectedTestCase.project_id || 'Global'}</span>
                  </div>
                  <h2 style={{ margin: 0, fontSize: 16, color: '#091E42', lineHeight: 1.4 }}>{selectedTestCase.title}</h2>
               </div>
                <div style={{ display: 'flex', gap: 4 }}>
                   <button className="icon-btn" onClick={(e) => handleDeleteTestCase(e, selectedTestCase.id)} style={{ color: '#FF5630' }} title="Delete"><XCircle size={18} /></button>
                   <button className="icon-btn" onClick={closePanel}><X size={20} /></button>
                </div>
            </div>

            {/* Panel Actions */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #DFE1E6', background: '#FAFBFC', display: 'flex', gap: 12 }}>
               <button 
                  className="btn btn--primary" 
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => handleExecute(selectedTestCase.id)}
                  disabled={executing}
               >
                 {executing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} 
                 {executing ? 'Starting...' : 'Execute Now'}
               </button>
               <button className="btn btn--secondary" style={{ padding: '0 12px' }}><MoreHorizontal size={16} /></button>
            </div>

            {/* Execution Config */}
            <div style={{ padding: '15px 20px', borderBottom: '1px solid #DFE1E6', background: '#fff' }}>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: '#6B778C', textTransform: 'uppercase', marginBottom: 12 }}>Execution Settings</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#091E42', display: 'block', marginBottom: 4 }}>Browser</label>
                    <select className="form-input" style={{ width: '100%', height: 32, fontSize: 12 }} value={runConfig.browser_type} onChange={e => setRunConfig({...runConfig, browser_type: e.target.value})}>
                      <option value="chromium">Chromium</option>
                      <option value="firefox">Firefox</option>
                      <option value="webkit">Webkit</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#091E42', display: 'block', marginBottom: 4 }}>Mode</label>
                    <select className="form-input" style={{ width: '100%', height: 32, fontSize: 12 }} value={runConfig.headless ? 'headless' : 'visible'} onChange={e => setRunConfig({...runConfig, headless: e.target.value === 'headless'})}>
                      <option value="headless">Headless</option>
                      <option value="visible">Visible</option>
                    </select>
                  </div>
                </div>
            </div>

            {/* Panel Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #DFE1E6' }}>
               {[
                 { id: 'details', label: 'Details', icon: FileText },
                 { id: 'history', label: 'History', icon: Activity }
               ].map(tab => (
                 <button 
                   key={tab.id}
                   onClick={() => setPanelTab(tab.id)}
                   style={{
                     flex: 1, padding: '12px', border: 'none', background: 'transparent', cursor: 'pointer',
                     fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                     color: panelTab === tab.id ? '#0052CC' : '#6B778C',
                     borderBottom: panelTab === tab.id ? '2px solid #0052CC' : '2px solid transparent'
                   }}
                 >
                   <tab.icon size={14} /> {tab.label}
                 </button>
               ))}
            </div>

            {/* Panel Content */}
            <div style={{ padding: 20, maxHeight: 'calc(100vh - 350px)', overflowY: 'auto' }}>
              {panelTab === 'details' && (
                <div>
                   <h4 style={{ fontSize: 12, fontWeight: 700, color: '#6B778C', textTransform: 'uppercase', marginBottom: 12 }}>Test Steps</h4>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                     {(selectedTestCase.steps_json?.actions || []).length === 0 ? (
                       <p style={{ fontSize: 13, color: '#97A0AF' }}>No steps defined.</p>
                     ) : (
                       selectedTestCase.steps_json.actions.map((action, i) => (
                         <div key={i} style={{ padding: '12px', background: '#F4F5F7', borderRadius: 6, fontSize: 13 }}>
                           <div style={{ fontWeight: 600, color: '#091E42', marginBottom: 4 }}>Step {i + 1}: {action.type}</div>
                           {action.selector && <div style={{ color: '#0052CC', fontFamily: 'monospace', fontSize: 11 }}>{JSON.stringify(action.selector)}</div>}
                           {action.url && <div style={{ color: '#0052CC', fontFamily: 'monospace', fontSize: 11 }}>{action.url}</div>}
                           {action.value && <div style={{ color: '#6B778C', marginTop: 4 }}>Value: "{action.value}"</div>}
                         </div>
                       ))
                     )}
                   </div>
                </div>
              )}

              {panelTab === 'history' && (
                <div>
                   <h4 style={{ fontSize: 12, fontWeight: 700, color: '#6B778C', textTransform: 'uppercase', marginBottom: 12 }}>Recent Executions</h4>
                   {execLoading ? (
                     <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                       <Loader2 size={24} className="animate-spin" color="#0052CC" />
                     </div>
                   ) : executions.length === 0 ? (
                     <p style={{ fontSize: 13, color: '#97A0AF' }}>No executions found.</p>
                   ) : (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                       {executions.map(ex => (
                         <div key={ex.id} className="card" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => navigate(`/execution-console/${ex.id}`)}>
                           <div>
                             <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                               <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[ex.status] || '#97A0AF' }} />
                               <span style={{ fontSize: 13, fontWeight: 600, color: '#091E42' }}>RUN-{ex.id}</span>
                             </div>
                             <div style={{ fontSize: 11, color: '#6B778C', display: 'flex', alignItems: 'center', gap: 4 }}>
                               <Clock size={10} /> {new Date(ex.started_at).toLocaleString()}
                             </div>
                           </div>
                           <ChevronRight size={16} color="#97A0AF" />
                         </div>
                       ))}
                     </div>
                   )}
                </div>
              )}
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
};

export default TestConsole;
