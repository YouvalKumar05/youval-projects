import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Download, Search, Filter, BarChart2, CheckCircle, XCircle,
  AlertCircle, Clock, Eye, TrendingUp, TrendingDown,
  RefreshCw, FileText, Loader2, Bug, Trash2, ChevronDown, ChevronRight, FolderOpen, Zap
} from 'lucide-react';
import { api } from '../services/api';

// ─── Pure-SVG charts (zero dependency) ──────────────────────────────────────

const EmptyChart = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100, color: '#97A0AF', fontSize: 13 }}>
    No data yet
  </div>
);

const LineChart = ({ data = [] }) => {
  if (!data.length) return <EmptyChart />;
  const max = Math.max(...data.map(d => d.total), 1);
  const W = 500, H = 110;
  const pts = data.map((d, i) => `${(i / Math.max(data.length - 1, 1)) * W},${H - (d.total / max) * H}`);
  const failPts = data.map((d, i) => `${(i / Math.max(data.length - 1, 1)) * W},${H - ((d.failed || 0) / max) * H}`);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 110 }}>
      <polyline points={pts.join(' ')} fill="none" stroke="#0052CC" strokeWidth="2.5" strokeLinejoin="round" />
      <polyline points={failPts.join(' ')} fill="none" stroke="#FF5630" strokeWidth="2" strokeLinejoin="round" strokeDasharray="5 3" />
      {data.map((d, i) => (
        <circle key={i} cx={(i / Math.max(data.length - 1, 1)) * W} cy={H - (d.total / max) * H} r={3.5} fill="#0052CC" />
      ))}
    </svg>
  );
};

const PieChart = ({ pass = 0, fail = 0 }) => {
  const total = (pass || 0) + (fail || 0);
  if (!total) return <EmptyChart />;
  const pct = Math.round((pass / total) * 100);
  const r = 40, cx = 60, cy = 60, circ = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 120 120" style={{ width: 120, height: 120 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#EBECF0" strokeWidth="18" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#36B37E" strokeWidth="18"
        strokeDasharray={`${(pass / total) * circ} ${(fail / total) * circ}`}
        strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="14" fontWeight="800" fill="#091E42">{pct}%</text>
      <text x={cx} y={cy + 13} textAnchor="middle" fontSize="9" fill="#97A0AF" fontWeight="700">PASS RATE</text>
    </svg>
  );
};

const BarChart = ({ data = [] }) => {
  if (!data.length) return <EmptyChart />;
  const max = Math.max(...data.map(d => d.count), 1);
  const COLORS = { High: '#FF5630', Medium: '#FFAB00', Low: '#36B37E', Unknown: '#97A0AF' };
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 90 }}>
      {data.map(d => (
        <div key={d.severity} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: COLORS[d.severity] || '#97A0AF' }}>{d.count}</span>
          <div style={{ width: '100%', background: COLORS[d.severity] || '#97A0AF', borderRadius: '4px 4px 0 0', height: `${(d.count / max) * 70}px`, minHeight: 4 }} />
          <span style={{ fontSize: 10, color: '#6B778C', fontWeight: 600 }}>{d.severity}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Small helpers ───────────────────────────────────────────────────────────

const STATUS_CFG = {
  PASS:    { label: 'Passed', color: '#36B37E', bg: '#E3FCEF', Icon: CheckCircle },
  FAIL:    { label: 'Failed', color: '#FF5630', bg: '#FFEBE6', Icon: XCircle },
  Running: { label: 'Running', color: '#2684FF', bg: '#DEEBFF', Icon: Clock },
};

const Badge = ({ status }) => {
  const c = STATUS_CFG[status] || { label: status, color: '#6B778C', bg: '#F4F5F7', Icon: AlertCircle };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: c.bg, color: c.color, fontWeight: 700, fontSize: 11, padding: '3px 10px', borderRadius: 99 }}>
      <c.Icon size={11} /> {c.label}
    </span>
  );
};

const KpiCard = ({ Icon, label, value, trend, color = '#0052CC' }) => (
  <div className="card" style={{ padding: '18px 20px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ background: `${color}18`, borderRadius: 10, padding: 10 }}>
        <Icon size={20} color={color} />
      </div>
      {trend && (
        <span style={{ fontSize: 11, fontWeight: 700, color: trend === 'up' ? '#36B37E' : '#FF5630', display: 'flex', alignItems: 'center', gap: 2 }}>
          {trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        </span>
      )}
    </div>
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#091E42', lineHeight: 1 }}>{value ?? '—'}</div>
      <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4, fontWeight: 500 }}>{label}</div>
    </div>
  </div>
);

// ─── Main ────────────────────────────────────────────────────────────────────

const Reports = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [bugs, setBugs] = useState([]);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [activeTab, setActiveTab] = useState('executions');
  const [exporting, setExporting] = useState(false);

  // Projects & Scenarios
  const [projects, setProjects] = useState([]);
  const [testCases, setTestCases] = useState([]);
  const [deletingProject, setDeletingProject] = useState(null);
  const [expandedTC, setExpandedTC] = useState(null);
  const [expandedExec, setExpandedExec] = useState(null);

  useEffect(() => { loadAll(); loadProjects(); loadTestCases(); }, [statusFilter, severityFilter]);

  const loadProjects = async () => {
    try {
      const res = await api.get('/api/projects');
      if (res.status === 'success') setProjects(res.data);
    } catch (e) { console.error(e); }
  };

  const loadTestCases = async () => {
    try {
      const res = await api.get('/api/testcases');
      if (res.status === 'success') setTestCases(res.data);
    } catch (e) { console.error(e); }
  };

  const handleDeleteProject = async (pid, pname) => {
    if (!window.confirm(`Delete project "${pname}"? This cannot be undone.`)) return;
    setDeletingProject(pid);
    try {
      const res = await api.delete(`/api/projects/${pid}`);
      if (res.status === 'success') {
        setProjects(prev => prev.filter(p => p.id !== pid));
      } else {
        alert(res.message || 'Delete failed');
      }
    } catch (e) { alert('Delete error: ' + e.message); }
    finally { setDeletingProject(null); }
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [sumRes, execRes, bugRes, trendRes] = await Promise.all([
        api.get('/api/reports/summary'),
        api.get(`/api/reports/executions?status=${statusFilter === 'All' ? '' : statusFilter}&days=30`),
        api.get(`/api/reports/bugs?severity=${severityFilter === 'All' ? '' : severityFilter}`),
        api.get('/api/reports/trends?days=14'),
      ]);
      if (sumRes.status === 'success') setSummary(sumRes.data);
      if (execRes.status === 'success') setExecutions(execRes.data);
      if (bugRes.status === 'success') setBugs(bugRes.data);
      if (trendRes.status === 'success') setTrends(trendRes.data);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const base = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';
      const token = localStorage.getItem('token');
      const res = await fetch(`${base}/api/reports/export?format=${format}&days=30`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      Object.assign(document.createElement('a'), { href: url, download: `autoqa_report.${format}` }).click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const filteredExecs = executions.filter(e => !search || e.test_case_title?.toLowerCase().includes(search.toLowerCase()));
  const filteredBugs  = bugs.filter(b => !search || b.title?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page-container animate-fade-in-up">

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Real-time STLC metrics sourced directly from your PostgreSQL database</p>
        </div>
        <div className="page-actions">
          <button className="btn btn--secondary" onClick={loadAll}><RefreshCw size={14} /> Refresh</button>
          <button className="btn btn--secondary" onClick={() => handleExport('csv')} disabled={exporting}>
            <Download size={14} /> {exporting ? 'Exporting…' : 'CSV'}
          </button>
          <button className="btn btn--primary" onClick={() => handleExport('json')} disabled={exporting}>
            <FileText size={14} /> JSON
          </button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center', background: '#fff', border: '1px solid #DFE1E6', borderRadius: 10, padding: '12px 16px' }}>
        <Filter size={14} color="#6B778C" />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#6B778C' }}>STATUS:</span>
        {['All', 'PASS', 'FAIL', 'Running'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            style={{ padding: '4px 14px', borderRadius: 99, border: '1px solid #DFE1E6', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .15s', background: statusFilter === s ? '#0052CC' : '#fff', color: statusFilter === s ? '#fff' : '#344563' }}>
            {s}
          </button>
        ))}
        <div style={{ width: 1, height: 20, background: '#DFE1E6', margin: '0 4px' }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#6B778C' }}>SEVERITY:</span>
        {['All', 'High', 'Medium', 'Low'].map(s => (
          <button key={s} onClick={() => setSeverityFilter(s)}
            style={{ padding: '4px 14px', borderRadius: 99, border: '1px solid #DFE1E6', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .15s', background: severityFilter === s ? '#6554C0' : '#fff', color: severityFilter === s ? '#fff' : '#344563' }}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Loader2 size={44} className="animate-spin" color="#0052CC" />
        </div>
      ) : (
        <>
          {/* ── KPI Cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 26 }}>
            <KpiCard Icon={FileText}    label="Total Test Cases"   value={summary?.total_test_cases}  color="#0052CC" />
            <KpiCard Icon={BarChart2}   label="Total Executions"   value={summary?.total_executions}  color="#6554C0" trend={summary?.execution_trend} />
            <KpiCard Icon={CheckCircle} label="Pass Rate"          value={`${summary?.pass_rate ?? 0}%`} color="#36B37E" />
            <KpiCard Icon={XCircle}    label="Failed Tests"       value={summary?.fail_count}        color="#FF5630" />
            <KpiCard Icon={Bug}         label="Active Bugs"        value={summary?.active_bugs}       color="#F87171" />
            <KpiCard Icon={Clock}       label="Avg Exec Time"      value={summary?.avg_execution_time} color="#FFAB00" />
          </div>

          {/* ── Charts ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 18, marginBottom: 26 }}>
            <div className="card">
              <div className="card-header"><span className="card-header-title">Execution Trend (14 days)</span></div>
              <div className="card-body">
                <LineChart data={trends?.execution_trend || []} />
                <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6B778C' }}><div style={{ width: 14, height: 2.5, background: '#0052CC', borderRadius: 2 }} /> Total</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6B778C' }}><div style={{ width: 14, height: 2, background: '#FF5630', borderRadius: 2 }} /> Failed</div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><span className="card-header-title">Pass vs Fail</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <PieChart pass={trends?.pass_fail_totals?.pass || 0} fail={trends?.pass_fail_totals?.fail || 0} />
                <div style={{ display: 'flex', gap: 14 }}>
                  <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#36B37E', display: 'inline-block' }} /> Pass ({trends?.pass_fail_totals?.pass || 0})</span>
                  <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5630', display: 'inline-block' }} /> Fail ({trends?.pass_fail_totals?.fail || 0})</span>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><span className="card-header-title">Bug Severity</span></div>
              <div className="card-body">
                <BarChart data={trends?.severity_distribution || []} />
              </div>
            </div>
          </div>

          {/* ── Data Tables ── */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="card-header" style={{ flexDirection: 'column', gap: 12, alignItems: 'stretch' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #DFE1E6' }}>
                  {[['executions', `Executions (${executions.length})`], ['bugs', `Bugs (${bugs.length})`], ['scenarios', `Test Scenarios (${testCases.length})`], ['projects', `Projects (${projects.length})`]].map(([tab, label]) => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      style={{ padding: '8px 20px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, background: activeTab === tab ? '#0052CC' : 'transparent', color: activeTab === tab ? '#fff' : '#6B778C', transition: 'all .15s' }}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="search-wrapper" style={{ width: 280 }}>
                  <Search size={13} className="search-icon" />
                  <input className="search-input" placeholder={`Search ${activeTab}…`} value={search} onChange={e => setSearch(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Executions Table */}
            {activeTab === 'executions' && (
              <table className="data-table">
                <thead><tr>
                  <th>Test Case</th><th>Project</th><th>Status</th><th>Duration</th><th>Steps</th><th>Started</th><th>Actions</th>
                </tr></thead>
                <tbody>
                  {filteredExecs.length === 0
                    ? <tr><td colSpan={7} style={{ textAlign: 'center', color: '#97A0AF', padding: 36 }}>No execution records. Run your first test from the Data Center.</td></tr>
                    : filteredExecs.map(ex => {
                        const isExp = expandedExec === ex.id;
                        return (
                          <React.Fragment key={ex.id}>
                            <tr style={{ cursor: 'pointer', background: isExp ? '#FAFBFC' : 'transparent' }} onClick={() => setExpandedExec(isExp ? null : ex.id)}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13, color: '#091E42', marginBottom: 2 }}>
                                  {isExp ? <ChevronDown size={13} color="#97A0AF" /> : <ChevronRight size={13} color="#97A0AF" />}
                                  {ex.test_case_title}
                                </div>
                                <div style={{ fontSize: 11, color: '#97A0AF', fontFamily: 'monospace', marginLeft: 21 }}>RUN-{ex.id}</div>
                              </td>
                              <td><span className="badge badge--gray">{ex.project_id || '—'}</span></td>
                              <td><Badge status={ex.status} /></td>
                              <td style={{ fontSize: 12, color: '#344563' }}>{ex.duration || '—'}</td>
                              <td>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#091E42' }}>{ex.pass_steps}</span>
                                <span style={{ fontSize: 12, color: '#97A0AF' }}>/{ex.step_count}</span>
                              </td>
                              <td style={{ fontSize: 12, color: '#6B778C' }}>{ex.started_at ? new Date(ex.started_at).toLocaleString() : '—'}</td>
                              <td>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button className="icon-btn" title={isExp ? "Collapse Report" : "Expand Report"} onClick={(e) => { e.stopPropagation(); setExpandedExec(isExp ? null : ex.id); }}>
                                    <Eye size={14} color={isExp ? '#0052CC' : '#6B778C'} />
                                  </button>
                                  <button className="icon-btn" title="Download Screenshot" onClick={(e) => { e.stopPropagation(); (ex.logs_path || ex.screenshot_path) && window.open(`${import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'}/${ex.logs_path || ex.screenshot_path}`, '_blank'); }}>
                                    <Download size={14} />
                                  </button>
                                  <button className="icon-btn" title="View Full Console" onClick={(e) => { e.stopPropagation(); navigate(`/execution-console/${ex.id}`); }}>
                                    <FileText size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {isExp && (
                              <tr key={`${ex.id}-exp`} style={{ background: '#F4F5F7' }}>
                                <td colSpan={7} style={{ padding: '24px 32px 32px 40px', borderBottom: '2px solid #DFE1E6' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
                                    
                                    {/* Left Column: TEST EXECUTION STEPS */}
                                    <div>
                                      <div style={{ fontSize: 11, fontWeight: 800, color: '#5E6C84', textTransform: 'uppercase', marginBottom: 16, letterSpacing: '0.5px' }}>TEST STEPS</div>
                                      <div style={{ display: 'grid', gap: 16 }}>
                                        {(ex.step_results || []).length === 0 ? (
                                          <div style={{ color: '#97A0AF', fontSize: 13, fontStyle: 'italic' }}>No step details available.</div>
                                        ) : (
                                          (ex.step_results || []).map((s, si) => (
                                            <div key={si} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                                              <div style={{ minWidth: 20, height: 20, borderRadius: '50%', background: s.status?.toUpperCase() === 'FAIL' ? '#FFEBE6' : '#DEEBFF', color: s.status?.toUpperCase() === 'FAIL' ? '#DE350B' : '#0052CC', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                                                {s.step || si + 1}
                                              </div>
                                              <div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: '#091E42' }}>
                                                  {s.action || 'Execute Action'}
                                                </div>
                                                <div style={{ fontSize: 12, color: s.status?.toUpperCase() === 'FAIL' ? '#DE350B' : '#6B778C', marginTop: 4, lineHeight: 1.4, fontFamily: s.status?.toUpperCase() === 'FAIL' ? 'monospace' : 'inherit' }}>
                                                  {s.message || '—'}
                                                </div>
                                              </div>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    </div>

                                    {/* Right Column: EXECUTION ARTIFACTS / LOGS */}
                                    <div>
                                      <div style={{ fontSize: 11, fontWeight: 800, color: '#5E6C84', textTransform: 'uppercase', marginBottom: 16, letterSpacing: '0.5px' }}>INPUT DATA & ARTIFACTS</div>
                                      
                                      <div style={{ fontSize: 13, color: '#6B778C', fontStyle: 'italic', marginBottom: 24 }}>
                                        No specific input data required.
                                      </div>

                                      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #DFE1E6', padding: 16, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: '#091E42', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={14} color="#6554C0" /> Final Screenshot</div>
                                        {ex.logs_path || ex.screenshot_path ? (
                                          <div>
                                            <div style={{ border: '1px solid #DFE1E6', borderRadius: 4, overflow: 'hidden', cursor: 'pointer', background: '#F4F5F7' }} onClick={() => window.open(`${import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'}/${ex.logs_path || ex.screenshot_path}`, '_blank')}>
                                              <img src={`${import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'}/${ex.logs_path || ex.screenshot_path}`} alt="Execution Frame" style={{ width: '100%', display: 'block', objectFit: 'cover', maxHeight: 180 }} />
                                            </div>
                                            <button className="btn btn--subtle" style={{ width: '100%', marginTop: 8, fontSize: 11, justifyContent: 'center' }} onClick={() => window.open(`${import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'}/${ex.logs_path || ex.screenshot_path}`, '_blank')}>View Original Screenshot</button>
                                          </div>
                                        ) : (
                                          <div style={{ color: '#97A0AF', fontSize: 12, fontStyle: 'italic', padding: '20px 0', textAlign: 'center' }}>Screenshot unavailable.</div>
                                        )}
                                      </div>
                                      
                                      <div>
                                        <div style={{ fontSize: 11, fontWeight: 800, color: '#FFAB00', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                          <Zap size={14} /> AI QA SUGGESTION
                                        </div>
                                        <div style={{ fontSize: 12, color: '#42526E', lineHeight: 1.5, background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #DFE1E6' }}>
                                          {ex.status === 'FAIL' 
                                            ? "The test failed during execution. Review the failed step log and screenshot above. Consider increasing wait times or using a more resilient locator selector."
                                            : "Verify the website's loading speed and check for any broken links to expand test coverage."}
                                        </div>
                                      </div>

                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                  }
                </tbody>
              </table>
            )}

            {/* Bugs Table */}
            {activeTab === 'bugs' && (
              <table className="data-table">
                <thead><tr>
                  <th>Bug</th><th>Severity</th><th>Status</th><th>Execution</th><th>Assigned To</th><th>Created</th><th>Actions</th>
                </tr></thead>
                <tbody>
                  {filteredBugs.length === 0
                    ? <tr><td colSpan={7} style={{ textAlign: 'center', color: '#97A0AF', padding: 36 }}>No bugs found. Pass all your tests!</td></tr>
                    : filteredBugs.map(bug => {
                        const SEV_C = { High: '#FF5630', Medium: '#FFAB00', Low: '#36B37E' };
                        const SEV_B = { High: '#FFEBE6', Medium: '#FFFAE6', Low: '#E3FCEF' };
                        return (
                          <tr key={bug.id}>
                            <td>
                              <div style={{ fontWeight: 600, fontSize: 13, color: '#091E42', marginBottom: 2 }}>{bug.title}</div>
                              <div style={{ fontSize: 11, color: '#97A0AF', fontFamily: 'monospace' }}>BUG-{bug.id}</div>
                            </td>
                            <td>
                              <span style={{ background: SEV_B[bug.severity] || '#F4F5F7', color: SEV_C[bug.severity] || '#97A0AF', fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99 }}>
                                {bug.severity || 'Unknown'}
                              </span>
                            </td>
                            <td>
                              <span style={{ background: bug.status === 'Open' ? '#FFEBE6' : '#E3FCEF', color: bug.status === 'Open' ? '#FF5630' : '#36B37E', fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99 }}>
                                {bug.status}
                              </span>
                            </td>
                            <td style={{ fontSize: 12, color: '#6B778C' }}>
                              {bug.execution_id
                                ? <button className="icon-btn" style={{ gap: 4 }} onClick={() => navigate(`/execution-console/${bug.execution_id}`)}>RUN-{bug.execution_id} <Eye size={11} /></button>
                                : '—'
                              }
                            </td>
                            <td style={{ fontSize: 12, color: '#344563' }}>{bug.assigned_to || 'Unassigned'}</td>
                            <td style={{ fontSize: 12, color: '#6B778C' }}>{bug.created_at ? new Date(bug.created_at).toLocaleString() : '—'}</td>
                            <td>
                              <button className="icon-btn" title="View in Tasks" onClick={() => navigate('/tasks')}><Eye size={14} /></button>
                            </td>
                          </tr>
                        );
                      })
                  }
                </tbody>
              </table>
            )}

            {/* ── Test Scenarios Spreadsheet Table ── */}
            {activeTab === 'scenarios' && (
              <table className="data-table">
                <thead><tr>
                  <th style={{width:40}}>#</th>
                  <th>Scenario Title</th>
                  <th>Project</th>
                  <th>Steps</th>
                  <th>Expected Outcome</th>
                  <th>Priority</th>
                  <th>Actions</th>
                </tr></thead>
                <tbody>
                  {testCases.filter(tc => !search || tc.title?.toLowerCase().includes(search.toLowerCase())).length === 0
                    ? <tr><td colSpan={7} style={{ textAlign: 'center', color: '#97A0AF', padding: 36 }}>No test scenarios found. Generate test cases from Analysis Review.</td></tr>
                    : testCases.filter(tc => !search || tc.title?.toLowerCase().includes(search.toLowerCase())).map((tc, idx) => {
                        const steps = tc.steps_json?.actions || tc.steps_json?.steps || [];
                        const isExp = expandedTC === tc.id;
                        return (
                          <>
                            <tr key={tc.id} style={{ cursor: 'pointer' }} onClick={() => setExpandedTC(isExp ? null : tc.id)}>
                              <td style={{ color: '#97A0AF', fontFamily: 'monospace', fontSize: 11 }}>{idx + 1}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13, color: '#091E42' }}>
                                  {isExp ? <ChevronDown size={13} color="#97A0AF" /> : <ChevronRight size={13} color="#97A0AF" />}
                                  {tc.title}
                                </div>
                                <div style={{ fontSize: 11, color: '#97A0AF', fontFamily: 'monospace', marginTop: 2 }}>TC-{tc.id}</div>
                              </td>
                              <td><span className="badge badge--gray">{tc.project_id || '—'}</span></td>
                              <td><span className="badge badge--gray">{steps.length} steps</span></td>
                              <td style={{ fontSize: 12, color: '#344563', maxWidth: 220 }}>{tc.steps_json?.expected_outcome || '—'}</td>
                              <td>
                                <span style={{ background: '#DEEBFF', color: '#0052CC', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>
                                  {tc.steps_json?.priority || 'Medium'}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button className="icon-btn" title="Run in Execution Console" onClick={e => { e.stopPropagation(); navigate(`/execution-dashboard`); }}>
                                    <Eye size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {isExp && (
                              <tr key={`${tc.id}-exp`}>
                                <td colSpan={7} style={{ background: '#F4F5F7', padding: '16px 24px' }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: '#42526E', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Step Details</div>
                                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                      <tr style={{ background: '#E4E7EB' }}>
                                        <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B778C' }}>Step</th>
                                        <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B778C' }}>Action</th>
                                        <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B778C' }}>Target</th>
                                        <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B778C' }}>Value</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {steps.map((s, si) => (
                                        <tr key={si} style={{ borderBottom: '1px solid #DFE1E6', background: si % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                                          <td style={{ padding: '6px 12px', fontSize: 12, color: '#97A0AF', fontFamily: 'monospace' }}>{si + 1}</td>
                                          <td style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#344563' }}>{s.action || s.type || s}</td>
                                          <td style={{ padding: '6px 12px', fontSize: 12, color: '#6B778C', fontFamily: 'monospace' }}>{s.selector || s.target || '—'}</td>
                                          <td style={{ padding: '6px 12px', fontSize: 12, color: '#091E42' }}>{s.value || s.text || '—'}</td>
                                        </tr>
                                      ))}
                                      {steps.length === 0 && <tr><td colSpan={4} style={{ padding: 12, color: '#97A0AF', fontSize: 12 }}>No step data available.</td></tr>}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })
                  }
                </tbody>
              </table>
            )}

            {/* ── Projects Management Table ── */}
            {activeTab === 'projects' && (
              <table className="data-table">
                <thead><tr>
                  <th>#</th><th>Project Name</th><th>Description</th><th>Test Cases</th><th style={{ textAlign: 'right' }}>Actions</th>
                </tr></thead>
                <tbody>
                  {projects.filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase())).length === 0
                    ? <tr><td colSpan={5} style={{ textAlign: 'center', color: '#97A0AF', padding: 36 }}>No projects found.</td></tr>
                    : projects.filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase())).map((p, idx) => (
                      <tr key={p.id}>
                        <td style={{ color: '#97A0AF', fontFamily: 'monospace', fontSize: 11 }}>{idx + 1}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FolderOpen size={14} color="#0052CC" />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13, color: '#091E42' }}>{p.name}</div>
                              <div style={{ fontSize: 11, color: '#97A0AF', fontFamily: 'monospace' }}>PRJ-{p.id}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: 12, color: '#6B778C' }}>{p.description || '—'}</td>
                        <td>
                          <span className="badge badge--gray">
                            {testCases.filter(tc => tc.project_id === p.id || tc.project_id === p.name).length} cases
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => handleDeleteProject(p.id, p.name)}
                            disabled={deletingProject === p.id}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#FFF5F5', border: '1px solid #FC8181', color: '#C53030', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: deletingProject === p.id ? 0.5 : 1 }}
                          >
                            {deletingProject === p.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            Delete Project
                          </button>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Reports;
