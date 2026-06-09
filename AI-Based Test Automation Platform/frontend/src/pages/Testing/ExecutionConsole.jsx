import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  Terminal, 
  Play, 
  Square, 
  ChevronLeft, 
  ExternalLink,
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  History,
  Zap,
  Code,
  List,
  AlertTriangle,
  Lightbulb,
  Search,
  CheckSquare,
  Square as SquareIcon,
  Filter,
  PlayCircle,
  ChevronRight
} from "lucide-react";
import { api } from "../../services/api";

const STATUS_ICONS = {
  "Pending": <Clock size={16} color="#94a3b8" />,
  "Running": <Loader2 size={16} className="animate-spin" color="#3b82f6" />,
  "PASS": <CheckCircle2 size={16} color="#10b981" />,
  "FAIL": <XCircle size={16} color="#ef4444" />,
};

const ExecutionConsole = () => {
    const { executionId: currentExecutionId } = useParams();
    const navigate = useNavigate();
    
    // Test Case Selection State
    const [testCases, setTestCases] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loadingTCs, setLoadingTCs] = useState(false);

    // Active Execution / Selection State
    const [activeTC, setActiveTC] = useState(null);
    const [activeExecution, setActiveExecution] = useState(null);
    const [steps, setSteps] = useState([]);
    const [logs, setLogs] = useState([]);
    const [script, setScript] = useState("");
    const [status, setStatus] = useState("Idle");
    const [aiSuggestion, setAiSuggestion] = useState("");
    
    const [isExecuting, setIsExecuting] = useState(false);
    const logEndRef = useRef(null);
    const socketRef = useRef(null);

    // Execution Configuration State
    const [config, setConfig] = useState({
        browser_type: 'chromium',
        headless: true,
        delay: 1.0,
        targetUrl: ''
    });
    
    const [selectedProject, setSelectedProject] = useState('');

    // Initial Load
    useEffect(() => {
        const init = async () => {
            setLoadingTCs(true);
            try {
                const res = await api.get('/api/testcases');
                if (res.status === 'success') {
                    setTestCases(res.data);
                }
            } catch (err) {
                console.error("Failed to load test cases:", err);
            } finally {
                setLoadingTCs(false);
            }
        };
        init();

        if (currentExecutionId) {
            loadExecutionData(currentExecutionId);
        }
    }, [currentExecutionId]);

    // Sprints and Versions logic removed to favor Data Center Project Identities

    // Sync steps when activeTC changes
    useEffect(() => {
        if (activeTC) {
            // Only fetch preview and set steps if we aren't viewing a specific historical execution
            if (!activeExecution) {
                setSteps(activeTC.steps_json?.actions || activeTC.steps_json?.steps?.map(s => ({ name: s })) || []);
                fetchScriptPreview(activeTC.id);
            }
        }
    }, [activeTC, activeExecution]);

    // Scroll to bottom of logs
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    const loadExecutionData = async (eid) => {
        try {
            const res = await api.get(`/api/executions/${eid}`);
            if (res.status === 'success') {
                const data = res.data;
                setActiveExecution(data);
                setSteps(data.step_results || []);
                setLogs(data.logs || []);
                setStatus(data.status);
                
                if (!data.script || data.script === "No script available.") {
                    setScript("// Generating script...");
                    fetchScriptPreview(data.test_case_id);
                } else {
                    setScript(data.script);
                }
                
                // Set active TC based on execution
                const tc = testCases.find(t => t.id === data.test_case_id);
                if (tc) setActiveTC(tc);
                
                if (data.status === 'Running') {
                    connectWS(eid);
                }
            }
        } catch (err) {
            console.error("Failed to load execution data:", err);
        }
    };

    const handleTCSelect = (tc) => {
        setActiveTC(tc);
        setActiveExecution(null);
        setStatus("Idle");
        setLogs([]);
    };

    const fetchScriptPreview = async (tcId, forceUrl = null) => {
        try {
            const query = forceUrl ? `?base_url=${encodeURIComponent(forceUrl)}` : '';
            const res = await api.get(`/api/executions/preview/${tcId}${query}`);
            if (res.status === 'success') {
                setScript(res.data.script);
            }
        } catch (err) {
            console.error("Failed to fetch script preview", err);
        }
    };

    const toggleSelection = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const selectAll = () => {
        if (selectedIds.length === filteredTCs.length) setSelectedIds([]);
        else setSelectedIds(filteredTCs.map(t => t.id));
    };

    const executeSelection = async () => {
        if (selectedIds.length === 0) return;
        setIsExecuting(true);
        setStatus("Starting...");
        setLogs([{ t: new Date().toLocaleTimeString(), msg: `Starting bulk execution for ${selectedIds.length} cases...`, ok: true }]);
        
        try {
            const res = await api.post('/api/executions/bulk-run', {
                test_case_ids: selectedIds,
                ...config
            });
            if (res.status === 'success') {
                const firstId = res.data.execution_ids[0];
                navigate(`/execution-dashboard/${firstId}`);
            }
        } catch (err) {
            setLogs(prev => [...prev, { t: new Date().toLocaleTimeString(), msg: `Execution failed: ${err.message}`, ok: false }]);
        } finally {
            setIsExecuting(false);
        }
    };

    const handleRerun = async (tcId) => {
        setIsExecuting(true);
        setStatus("Running");
        setLogs([{ t: new Date().toLocaleTimeString(), msg: `Starting execution for TC-${tcId}...`, ok: true }]);
        
        try {
            const res = await api.post(`/api/executions/run/${tcId}`, {
                ...config
            });
            if (res.status === 'success') {
                const eid = res.data.execution_id;
                navigate(`/execution-dashboard/${eid}`);
            }
        } catch (err) {
            setLogs(prev => [...prev, { t: new Date().toLocaleTimeString(), msg: `Execution failed: ${err.message}`, ok: false }]);
            setStatus("Failed");
        } finally {
            setIsExecuting(false);
        }
    };

    const handleStop = async (eid) => {
        if (!eid) return;
        try {
            const res = await api.post(`/api/executions/stop/${eid}`);
            if (res.status === 'success') {
                setLogs(prev => [...prev, { t: new Date().toLocaleTimeString(), msg: `Stop signal sent for Run #${eid}...`, ok: true }]);
                setStatus("Stopping");
            }
        } catch (err) {
            console.error("Failed to stop execution", err);
        }
    };

    const handleDeleteTestCase = async (e, testCaseId) => {
        if (e) e.stopPropagation();
        if (!window.confirm('Are you sure you want to delete this test scenario?')) return;
        try {
            const res = await api.delete(`/api/testcases/${testCaseId}`);
            if (res.status === 'success') {
                setTestCases(prev => prev.filter(tc => tc.id !== testCaseId));
                if (activeTC?.id === testCaseId) setActiveTC(null);
            } else {
                alert(res.message || 'Failed to delete test case');
            }
        } catch (err) {
            alert('Delete failed: ' + err.message);
        }
    };

    const connectWS = (eid) => {
        if (socketRef.current) socketRef.current.close();
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let host = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';
        host = host.replace(/^https?:\/\//, ''); // Strip protocol
        const wsUrl = `${protocol}//${host}/ws/executions/${eid}`;
        
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleIncomingEvent(data);
        };
        socket.onclose = () => {
            setStatus(prev => prev === 'Running' ? 'Completed' : prev);
            setIsExecuting(false);
            if (eid) {
                // Refresh test cases to get the latest status for the sidebar
                api.get('/api/testcases').then(res => {
                    if (res.status === 'success') setTestCases(res.data);
                });
                
                loadExecutionData(eid);
                setTimeout(() => {
                    navigate(`/execution-report/${eid}`);
                }, 2000); 
            }
        };
    };

    const handleIncomingEvent = (evt) => {
        if (evt.type === 'step_start') {
            setSteps(prev => {
                const next = [...prev];
                const idx = evt.index !== undefined ? evt.index : prev.findIndex(s => s.name === evt.name);
                if (idx !== -1) next[idx] = { ...next[idx], status: "Running" };
                return next;
            });
        } else if (evt.type === 'step_pass') {
            setSteps(prev => {
                const next = [...prev];
                const idx = evt.index !== undefined ? evt.index : prev.findIndex(s => s.name === evt.name);
                if (idx !== -1) next[idx] = { ...next[idx], status: "PASS", duration: evt.duration };
                return next;
            });
        } else if (evt.type === 'step_fail') {
            setSteps(prev => {
                const next = [...prev];
                const idx = evt.index !== undefined ? evt.index : prev.findIndex(s => s.name === evt.name);
                if (idx !== -1) next[idx] = { ...next[idx], status: "FAIL", duration: evt.duration, error: evt.error };
                return next;
            });
        }
        
        if (evt.type === 'execution_status') {
            setStatus(evt.status);
            if (evt.status !== 'Running') {
                setIsExecuting(false);
                if (socketRef.current) {
                    socketRef.current.close();
                }
                // Refresh list to update sidebar status icons
                api.get('/api/testcases').then(res => {
                    if (res.status === 'success') setTestCases(res.data);
                });
            }
        }
        
        const logMessage = evt.message || evt.log || evt.msg;
        if (logMessage) {
            const isOk = evt.status !== 'failed' && evt.ok !== false;
            setLogs(prev => [...prev, { 
                t: new Date().toLocaleTimeString(), 
                msg: logMessage, 
                ok: isOk,
                step: evt.step,
                action: evt.action
            }]);
        }
    };

    const filteredTCs = testCases.filter(t => {
        const matchesProject = !selectedProject || t.project_id === selectedProject;
        const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.id.toString().includes(searchQuery);
        return matchesProject && matchesSearch;
    });

    return (
        <div className="console-layout">
            {/* Sidebar for selection */}
            <aside className="console-sidebar">
                <div className="sidebar-header">
                    <div className="flex-between">
                        <h3>Test Scenarios</h3>
                        <span className="badge">{filteredTCs.length}</span>
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                        <select 
                            className="form-input" 
                            style={{ width: '100%', padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#f8fafc' }} 
                            value={selectedProject} 
                            onChange={(e) => setSelectedProject(e.target.value)}
                        >
                            <option value="">All Projects</option>
                            {[...new Set(testCases.map(tc => tc.project_id).filter(Boolean))].map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>
                    <div className="search-box">
                        <Search size={14} />
                        <input 
                            placeholder="Filter test cases..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="selection-tools">
                        <button className="text-btn" onClick={selectAll}>
                            {selectedIds.length === filteredTCs.length ? <CheckSquare size={14}/> : <SquareIcon size={14}/>}
                            {selectedIds.length === filteredTCs.length ? "Deselect All" : "Select All"}
                        </button>
                        <button className="text-btn" style={{ color: '#10b981' }} onClick={() => { selectAll(); executeSelection(); }}>
                            <Zap size={14}/> Run All Approved
                        </button>
                    </div>
                </div>
                <div className="tc-list">
                    {loadingTCs ? (
                        <div className="loader-box"><Loader2 className="animate-spin" size={20} /></div>
                    ) : filteredTCs.map(tc => (
                        <div 
                            key={tc.id} 
                            className={`tc-item ${activeTC?.id === tc.id ? 'active' : ''} ${selectedIds.includes(tc.id) ? 'selected' : ''}`}
                            onClick={() => handleTCSelect(tc)}
                        >
                            <div className="tc-checkbox" onClick={(e) => { e.stopPropagation(); toggleSelection(tc.id); }}>
                                {selectedIds.includes(tc.id) ? <CheckSquare size={16} color="#3b82f6"/> : <SquareIcon size={16} color="#475569"/>}
                            </div>
                            <div className="tc-info">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div className="tc-title">{tc.title}</div>
                                        {STATUS_ICONS[tc.latest_status] || <Clock size={12} color="#94a3b8" />}
                                    </div>
                                    <button 
                                        onClick={(e) => handleDeleteTestCase(e, tc.id)}
                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', opacity: 0.6 }}
                                        title="Delete Scenario"
                                    >
                                        <XCircle size={14} />
                                    </button>
                                </div>
                                <div className="tc-meta">TC-{tc.id} • {tc.project_id}</div>
                            </div>
                            <ChevronRight size={14} className="arrow" />
                        </div>
                    ))}
                </div>
                <div className="sidebar-footer">
                    <button 
                        className="btn-primary full-width" 
                        disabled={selectedIds.length === 0 || isExecuting}
                        onClick={executeSelection}
                    >
                        {isExecuting ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                        Run Selected Scenarios ({selectedIds.length})
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="console-content">
                {!activeTC ? (
                    <div className="empty-state">
                        <PlayCircle size={48} color="#1e293b" />
                        <h2>Execution Ready</h2>
                        <p>Select a test scenario from the sidebar to view details, script, and trigger execution.</p>
                    </div>
                ) : (
                    <>
                        <header className="content-header">
                            <div className="header-left">
                                <div className="title-row">
                                    <h1>{activeTC.title}</h1>
                                    <span className={`status-pill ${status.toLowerCase()}`}>{status}</span>
                                </div>
                                <div className="meta-row">
                                    <span>TC-{activeTC.id}</span>
                                    <span className="sep">•</span>
                                    <span>Project: {activeTC.project_id}</span>
                                    {activeExecution && (
                                        <>
                                            <span className="sep">•</span>
                                            <span className="exec-id">Run #{activeExecution.id}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="header-right">
                                {status === 'Running' && (
                                    <button className="btn-secondary" style={{ color: '#ef4444' }} onClick={() => handleStop(activeExecution?.id)}>
                                        <Square size={14}/> Stop
                                    </button>
                                )}
                                <button className="btn-secondary"><History size={14}/> History</button>
                                <button className="btn-primary" onClick={() => handleRerun(activeTC.id)} disabled={isExecuting || script === "// Generating script..."}>
                                    <Play size={14}/> Run Now
                                </button>
                            </div>
                        </header>

                        <div className="content-body">
                    {/* Execution Configuration Panel */}
                    <div className="config-panel" style={{ background: '#ffffff', padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '150px' }}>
                            <label style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Project Identity</label>
                            <select className="form-input" style={{ width: '100%', padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
                                <option value="">Select Project</option>
                                {[...new Set(testCases.map(tc => tc.project_id).filter(Boolean))].map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ width: '1px', height: '40px', background: '#e2e8f0', margin: '0 8px' }}></div>
                        <div style={{ flex: 1.5, minWidth: '200px' }}>
                            <label style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                Target Website
                                {activeTC && config.targetUrl && (
                                    <button onClick={() => { setScript("// Generating script with specific URL..."); fetchScriptPreview(activeTC.id, config.targetUrl); }} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '10px', fontWeight: 800, padding: 0 }}>
                                        Regenerate Script
                                    </button>
                                )}
                            </label>
                            <input type="text" placeholder="https://example.com" className="form-input" value={config.targetUrl} onChange={(e) => setConfig({...config, targetUrl: e.target.value})} style={{ width: '100%', padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: '120px' }}>
                            <label style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Browser</label>
                            <select className="form-input" value={config.browser_type} onChange={(e) => setConfig({...config, browser_type: e.target.value})} style={{ width: '100%', padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                                <option value="chromium">Chromium</option>
                                <option value="firefox">Firefox</option>
                                <option value="webkit">WebKit</option>
                            </select>
                        </div>
                        <div style={{ flex: 1, minWidth: '120px' }}>
                            <label style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Mode</label>
                            <select className="form-input" value={config.headless ? "true" : "false"} onChange={(e) => setConfig({...config, headless: e.target.value === "true"})} style={{ width: '100%', padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                                <option value="true">Headless (Fast)</option>
                                <option value="false">Headed (Visible)</option>
                            </select>
                        </div>
                        <div style={{ flex: 0.5, minWidth: '80px' }}>
                            <label style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Delay (s)</label>
                            <input type="number" step="0.5" min="0" value={config.delay} onChange={(e) => setConfig({...config, delay: parseFloat(e.target.value)})} style={{ width: '100%', padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                        </div>
                    </div>
                    
                    <div style={{ padding: '1.5rem', flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Top Split: Details | Script */}
                            <div className="top-split">
                                <section className="panel details-panel">
                                    <div className="panel-header"><Activity size={14}/> Scenario Details</div>
                                    <div className="panel-inner">
                                        <div className="detail-item">
                                            <label>Description</label>
                                            <p>{activeTC.description || "No description provided."}</p>
                                        </div>
                                        <div className="detail-grid">
                                            <div className="detail-item">
                                                <label>Expected Outcome</label>
                                                <p>{activeTC.steps_json?.expected_outcome || "Verify system state."}</p>
                                            </div>
                                            <div className="detail-item">
                                                <label>Input Data</label>
                                                <div className="data-tags">
                                                    {Object.entries(activeTC.steps_json?.input_data || {}).map(([k,v]) => (
                                                        <span key={k} className="tag">{k}: {String(v)}</span>
                                                    ))}
                                                    {Object.keys(activeTC.steps_json?.input_data || {}).length === 0 && <span>None</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="ai-insight">
                                            <Lightbulb size={14} color="#f59e0b"/>
                                            <span><strong>QA Insight:</strong> {activeTC.steps_json?.ai_suggestion || "Monitor network timing during this scenario."}</span>
                                        </div>
                                    </div>
                                </section>

                                <section className="panel script-panel">
                                    <div className="panel-header"><Code size={14}/> Playwright Python Script</div>
                                    <div className="panel-inner code-bg">
                                        <pre><code>{script}</code></pre>
                                    </div>
                                </section>
                            </div>

                                {/* Bottom Panel: Steps */}
                            <section className="panel steps-panel">
                                <div className="panel-header"><List size={14}/> Execution Steps & Flow</div>
                                <div className="panel-inner steps-grid">
                                    {steps.length > 0 ? steps.map((step, idx) => (
                                        <div key={idx} className={`step-card ${step.status?.toLowerCase() || 'pending'}`}>
                                            <div className="step-num">{idx + 1}</div>
                                            <div className="step-content">
                                                <div className="step-name">{step.description || step.name || `Step ${idx+1}`}</div>
                                                <div className="step-type">{step.type || "Action"}</div>
                                            </div>
                                            <div className="step-status">
                                                {STATUS_ICONS[step.status] || <Clock size={16} color="#475569" />}
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="empty-msg">No steps defined for this scenario.</div>
                                    )}
                                </div>
                            </section>

                            {/* Execution Artifacts Panel (Screenshot) */}
                            {activeExecution && activeExecution.status !== 'Running' && activeExecution.status !== 'Pending' && (
                                <section className="panel artifacts-panel" style={{ marginTop: '1.5rem' }}>
                                    <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <div><CheckCircle2 size={14}/> Final Output & Artifacts</div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => window.open('/reports', '_blank')}>View Analytics Report</button>
                                        </div>
                                    </div>
                                    <div className="panel-inner" style={{ display: 'flex', gap: '20px', padding: '20px', background: '#f8fafc' }}>
                                        {activeExecution.logs_path ? (
                                            <div style={{ flex: 1, background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '12px', textAlign: 'center' }}>
                                                <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#334155' }}>Final Screenshot</h4>
                                                <a href={`${import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'}/${activeExecution.logs_path}`} target="_blank" rel="noreferrer">
                                                    <img 
                                                        src={`${import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'}/${activeExecution.logs_path}`} 
                                                        alt="Execution Screenshot" 
                                                        style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '4px', border: '1px solid #cbd5e1', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                                                    />
                                                </a>
                                            </div>
                                        ) : (
                                            <div style={{ flex: 1, padding: '40px', textAlign: 'center', background: '#fff', borderRadius: '8px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '13px' }}>
                                                No screenshot captured for this execution.
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )}
                        </div>

                            {/* Overlay Terminal */}
                            <section className="terminal-dock">
                                <div className="dock-header">
                                    <div className="flex-gap">
                                        <Terminal size={14}/> <span>Execution Logs</span>
                                    </div>
                                    <div className="dock-actions">
                                        <button className="mini-btn">Clear</button>
                                        <button className="mini-btn">Expand</button>
                                    </div>
                                </div>
                                <div className="dock-body">
                                    {logs.map((log, i) => (
                                        <div key={i} className={`log-line ${log.ok ? '' : 'error'}`}>
                                            <span className="ts">[{log.t}]</span>
                                            <span className="msg">{log.msg}</span>
                                        </div>
                                    ))}
                                    <div ref={logEndRef} />
                                </div>
                            </section>
                        </div>
                    </>
                )}
            </main>

            <style>{`
                .console-layout {
                    display: flex;
                    height: calc(100vh - 105px);
                    background: #f8fafc;
                    color: #0f172a;
                    font-family: 'Inter', sans-serif;
                    overflow: hidden;
                }

                /* SIDEBAR */
                .console-sidebar {
                    width: 320px;
                    border-right: 1px solid #e2e8f0;
                    background: #ffffff;
                    display: flex;
                    flex-direction: column;
                    flex-shrink: 0;
                }
                .console-sidebar .sidebar-header { padding: 1.5rem; border-bottom: 1px solid #e2e8f0; }
                .console-sidebar .sidebar-header h3 { margin: 0; font-size: 1rem; font-weight: 700; color: #0f172a; }
                .console-sidebar .flex-between { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
                .console-sidebar .badge { background: #e0f2fe; color: #0284c7; padding: 2px 8px; borderRadius: 4px; font-size: 0.7rem; font-weight: 800; }
                
                .console-sidebar .search-box { background: #f1f5f9; border-radius: 6px; padding: 0.5rem; display: flex; align-items: center; gap: 0.5rem; border: 1px solid #e2e8f0; }
                .console-sidebar .search-box input { background: transparent; border: none; color: #0f172a; font-size: 0.8rem; outline: none; width: 100%; }
                .console-sidebar .search-box input::placeholder { color: #94a3b8; }
                .console-sidebar .selection-tools { margin-top: 1rem; display: flex; gap: 1rem; }
                .console-sidebar .text-btn { background: none; border: none; color: #94a3b8; font-size: 0.75rem; display: flex; align-items: center; gap: 0.4rem; cursor: pointer; padding: 0; }
                .console-sidebar .text-btn:hover { color: #3b82f6; }

                .console-sidebar .tc-list { flex-grow: 1; overflow-y: auto; padding: 0.5rem; }
                .console-sidebar .tc-item { 
                    padding: 0.75rem; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 0.75rem;
                    margin-bottom: 0.25rem; transition: all 0.2s; border: 1px solid transparent;
                }
                .console-sidebar .tc-item:hover { background: #f8fafc; }
                .console-sidebar .tc-item.active { background: #f1f5f9; border-color: #3b82f650; }
                .console-sidebar .tc-item.selected { background: #eff6ff; }
                .console-sidebar .tc-checkbox { flex-shrink: 0; display: flex; align-items: center; }
                .console-sidebar .tc-info { flex-grow: 1; overflow: hidden; }
                .console-sidebar .tc-title { font-size: 0.85rem; font-weight: 600; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .console-sidebar .tc-meta { font-size: 0.7rem; color: #64748b; margin-top: 2px; }
                .console-sidebar .tc-item .arrow { opacity: 0; transition: opacity 0.2s; color: #3b82f6; }
                .console-sidebar .tc-item:hover .arrow { opacity: 1; }

                .console-sidebar .sidebar-footer { padding: 1rem; border-top: 1px solid #e2e8f0; background: #ffffff; }
                
                /* MAIN CONTENT */
                .console-content { flex-grow: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; }
                .content-header { padding: 1.5rem 2rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #ffffff; }
                .header-left h1 { margin: 0; font-size: 1.25rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 0.75rem; }
                .status-pill { padding: 2px 10px; border-radius: 99px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
                .status-pill.running { background: #eff6ff; color: #2563eb; animation: pulse 2s infinite; }
                .status-pill.pass { background: #f0fdf4; color: #16a34a; }
                .status-pill.fail { background: #fef2f2; color: #dc2626; }
                .status-pill.idle { background: #f1f5f9; color: #64748b; }
                .meta-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; color: #64748b; margin-top: 0.5rem; }
                .sep { opacity: 0.3; }
                .exec-id { color: #3b82f6; font-weight: 600; }
                .header-right { display: flex; gap: 0.75rem; }

                .content-body { flex-grow: 1; overflow-y: auto; display: flex; flex-direction: column; padding-bottom: 250px; }
                
                .top-split { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
                .panel { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
                .panel-header { padding: 0.75rem 1rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 0.75rem; font-weight: 700; color: #475569; text-transform: uppercase; display: flex; align-items: center; gap: 0.5rem; }
                .panel-inner { padding: 1.25rem; flex-grow: 1; }
                
                .detail-item { margin-bottom: 1rem; }
                .detail-item label { display: block; font-size: 0.7rem; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 0.4rem; }
                .detail-item p { margin: 0; font-size: 0.9rem; line-height: 1.5; color: #334155; }
                .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
                .data-tags { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.25rem; }
                .tag { background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; color: #0f172a; border: 1px solid #e2e8f0; }
                
                .ai-insight { margin-top: 1rem; padding: 0.75rem; background: #fef3c7; border-left: 3px solid #f59e0b; border-radius: 0 8px 8px 0; display: flex; align-items: flex-start; gap: 0.75rem; font-size: 0.8rem; color: #92400e; }
                
                .code-bg { background: #f8fafc; padding: 0 !important; }
                .code-bg pre { margin: 0; padding: 1.25rem; overflow: auto; height: 100%; max-height: 300px; }
                .code-bg code { font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; color: #059669; line-height: 1.6; }

                /* STEPS PANEL */
                .steps-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
                .step-card { 
                    background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1rem; 
                    display: flex; align-items: center; gap: 1rem; transition: all 0.2s;
                }
                .step-card.pass { border-color: #86efac; background: #f0fdf4; }
                .step-card.fail { border-color: #fca5a5; background: #fef2f2; }
                .step-card.running { border-color: #93c5fd; background: #eff6ff; }
                
                .step-num { width: 28px; height: 28px; background: #f1f5f9; color: #64748b; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 800; flex-shrink: 0; }
                .step-content { flex-grow: 1; }
                .step-name { font-size: 0.85rem; font-weight: 600; color: #0f172a; margin-bottom: 2px; }
                .step-type { font-size: 0.7rem; color: #64748b; font-weight: 700; text-transform: uppercase; }
                
                /* TERMINAL DOCK */
                .terminal-dock { position: absolute; bottom: 0; left: 0; right: 0; height: 200px; background: #0f172a; border-top: 2px solid #e2e8f0; display: flex; flex-direction: column; z-index: 10; }
                .dock-header { padding: 0.5rem 1.5rem; background: #1e293b; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; }
                .flex-gap { display: flex; align-items: center; gap: 0.75rem; font-size: 0.75rem; font-weight: 700; color: #e2e8f0; text-transform: uppercase; }
                .dock-body { flex-grow: 1; overflow-y: auto; padding: 1rem; font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; line-height: 1.5; color: #e2e8f0; }
                .log-line { display: flex; gap: 1rem; margin-bottom: 0.25rem; }
                .log-line.error { color: #f87171; }
                .ts { color: #64748b; flex-shrink: 0; }

                /* UTILS */
                .btn-primary { background: #3b82f6; color: white; border: none; padding: 0.5rem 1.25rem; border-radius: 8px; font-weight: 700; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: background 0.2s; }
                .btn-primary:hover:not(:disabled) { background: #2563eb; }
                .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
                .btn-secondary { background: #ffffff; color: #0f172a; border: 1px solid #cbd5e1; padding: 0.5rem 1.25rem; border-radius: 8px; font-weight: 700; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; }
                .btn-secondary:hover { background: #f8fafc; }
                .full-width { width: 100%; justify-content: center; }
                .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #64748b; text-align: center; }
                .empty-state h2 { color: #0f172a; margin: 1rem 0 0.5rem; }
                
                @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
            `}</style>
            </div>
    );
};

export default ExecutionConsole;
