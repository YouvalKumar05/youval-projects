import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle, XCircle, RefreshCw, Eye, Play,
  Zap, Bug, Filter, ChevronDown, ChevronRight, ArrowRight,
  Clock, TrendingDown, Activity, Loader2, GitCompare, BarChart2
} from 'lucide-react';
import { api } from '../services/api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEV_COL  = { High: '#FF5630', Medium: '#FFAB00', Low: '#36B37E' };
const SEV_BG   = { High: '#FFEBE6', Medium: '#FFFAE6', Low: '#E3FCEF' };
const STAT_COL = { PASS: '#36B37E', FAIL: '#FF5630', Running: '#2684FF' };
const STAT_BG  = { PASS: '#E3FCEF', FAIL: '#FFEBE6', Running: '#DEEBFF' };

const Chip = ({ label, color, bg }) => (
  <span style={{ background: bg, color, fontWeight: 700, fontSize: 11, padding: '2px 9px', borderRadius: 99 }}>{label}</span>
);

const KpiCard = ({ Icon, label, value, color = '#0052CC', sub }) => (
  <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 18 }}>
    <div style={{ background: `${color}18`, borderRadius: 12, padding: 12, flexShrink: 0 }}>
      <Icon size={22} color={color} />
    </div>
    <div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#091E42', lineHeight: 1 }}>{value ?? '—'}</div>
      <div style={{ fontSize: 12, color: '#6B778C', fontWeight: 600, marginTop: 3 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#97A0AF', marginTop: 2 }}>{sub}</div>}
    </div>
  </div>
);

// Step comparison row
const StepRow = ({ step, highlight }) => {
  const col = { PASS: '#36B37E', FAIL: '#FF5630', Running: '#FFAB00' }[step?.status] || '#97A0AF';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid #F4F5F7' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, marginTop: 5, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#091E42', lineHeight: 1.3 }}>{step?.name || 'Unnamed Step'}</div>
        {step?.error && (
          <div style={{ fontSize: 11, color: '#FF5630', fontFamily: 'monospace', marginTop: 3, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {step.error}
          </div>
        )}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: col, flexShrink: 0 }}>{step?.status}</div>
      {step?.duration && <div style={{ fontSize: 10, color: '#97A0AF', flexShrink: 0 }}>{step.duration}ms</div>}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const RegressionCenter = () => {
  const navigate = useNavigate();
  const [stats, setStats]           = useState(null);
  const [failedTests, setFailedTests] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeRow, setActiveRow]   = useState(null);   // expanded failed test
  const [comparison, setComparison] = useState(null);   // before/after data
  const [cmpLoading, setCmpLoading] = useState(false);
  const [rerunning, setRerunning]   = useState({});     // { [testCaseId]: true }
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch]         = useState('');
  const [activeView, setActiveView] = useState('failed'); // failed | compare

  useEffect(() => { loadData(); }, [statusFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, failRes] = await Promise.all([
        api.get('/api/regression/stats'),
        api.get('/api/regression/failed-tests?days=30'),
      ]);
      if (statsRes.status === 'success') setStats(statsRes.data);
      if (failRes.status === 'success')  setFailedTests(failRes.data);
    } catch (e) {
      console.error('Regression load failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRow = async (test) => {
    if (activeRow?.test_case_id === test.test_case_id) {
      setActiveRow(null);
      setComparison(null);
      return;
    }
    setActiveRow(test);
    setActiveView('compare');
    setCmpLoading(true);
    try {
      const res = await api.get(`/api/regression/compare/${test.test_case_id}`);
      if (res.status === 'success') setComparison(res.data);
    } catch (e) {
      console.error('Compare load failed:', e);
    } finally {
      setCmpLoading(false);
    }
  };

  const handleRerun = async (test) => {
    setRerunning(r => ({ ...r, [test.test_case_id]: true }));
    try {
      const res = await api.post(`/api/regression/rerun/${test.test_case_id}`, {});
      if (res.status === 'success') {
        navigate(`/execution-console/${res.data.execution_id}`);
      }
    } catch (e) {
      alert('Re-run failed: ' + (e.message || 'Unknown error'));
    } finally {
      setRerunning(r => ({ ...r, [test.test_case_id]: false }));
    }
  };

  const handleDeleteTestCase = async (e, testCaseId) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this test case and all its execution history?')) return;
    try {
      const res = await api.delete(`/api/testcases/${testCaseId}`);
      if (res.status === 'success') {
        setFailedTests(prev => prev.filter(t => t.test_case_id !== testCaseId));
        if (activeRow?.test_case_id === testCaseId) setActiveRow(null);
      } else {
        alert(res.message || 'Failed to delete test case');
      }
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const displayed = failedTests.filter(t => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All'
      || (statusFilter === 'Flaky' && t.is_flaky)
      || (statusFilter === 'Critical' && t.bugs.some(b => b.severity === 'High'));
    return matchSearch && matchStatus;
  });

  return (
    <div className="page-container animate-fade-in-up">

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Regression Center</h1>
          <p className="page-subtitle">
            Track failed tests, manage re-runs, and compare before ↔ after each fix
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn--secondary" onClick={loadData}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn--primary" onClick={() => navigate('/execution-dashboard')}>
            <Play size={14} /> Run Dashboard
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Loader2 size={44} className="animate-spin" color="#0052CC" />
        </div>
      ) : (
        <>
          {/* ── KPI Row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 26 }}>
            <KpiCard Icon={XCircle}       label="Total Failures"     value={stats?.total_failures}   color="#FF5630" />
            <KpiCard Icon={Bug}           label="Open Bugs"          value={stats?.open_bugs}        color="#F87171" sub="Linked to failed runs" />
            <KpiCard Icon={Activity}      label="Failing Test Cases" value={failedTests.length}      color="#6554C0" />
            <KpiCard Icon={Zap}           label="Flaky Tests"        value={stats?.flaky_tests}      color="#FFAB00" sub="Pass → Fail patterns" />
          </div>

          {/* ── View Toggle ── */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 22 }}>
            {[
              ['failed', 'Failed Test Cases', XCircle],
              ['compare', 'Before vs After', GitCompare],
            ].map(([id, label, Icon]) => (
              <button key={id} onClick={() => setActiveView(id)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 8, border: '1px solid', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all .15s',
                  background: activeView === id ? '#0052CC' : '#fff',
                  color:      activeView === id ? '#fff'    : '#344563',
                  borderColor: activeView === id ? '#0052CC' : '#DFE1E6',
                }}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>

          {/* ── Failed Tests View ── */}
          {(activeView === 'failed' || activeView === 'compare') && (
            <div style={{ display: 'grid', gridTemplateColumns: activeView === 'compare' && comparison ? '1fr 1fr' : '1fr', gap: 20 }}>

              {/* Left: failed tests table */}
              <div>
                {/* Filter bar */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div className="search-wrapper" style={{ flex: 1, minWidth: 200 }}>
                    <span className="search-icon" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>🔍</span>
                    <input className="search-input" placeholder="Search test cases…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36, width: '100%' }} />
                  </div>
                  {['All', 'Flaky', 'Critical'].map(s => (
                    <button key={s} onClick={() => setStatusFilter(s)}
                      style={{ padding: '6px 14px', borderRadius: 99, border: '1px solid #DFE1E6', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        background: statusFilter === s ? '#0052CC' : '#fff',
                        color:      statusFilter === s ? '#fff'    : '#344563',
                      }}>
                      {s}
                    </button>
                  ))}
                </div>

                <div className="card" style={{ overflow: 'hidden' }}>
                  <div className="card-header">
                    <span className="card-header-title">Failed Executions ({displayed.length})</span>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>Test Case</th>
                        <th>Project</th>
                        <th>Failures</th>
                        <th>Last Failed</th>
                        <th>Latest</th>
                        <th>Bugs</th>
                        <th>Flags</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayed.length === 0 ? (
                        <tr>
                          <td colSpan={9} style={{ textAlign: 'center', color: '#97A0AF', padding: 36 }}>
                            🎉 No failed tests found. All your tests are passing!
                          </td>
                        </tr>
                      ) : displayed.map(test => (
                        <tr key={test.test_case_id}
                          style={{ background: activeRow?.test_case_id === test.test_case_id ? '#F0F4FF' : undefined, cursor: 'pointer' }}
                          onClick={() => handleSelectRow(test)}>

                          <td style={{ width: 28 }}>
                            {activeRow?.test_case_id === test.test_case_id
                              ? <ChevronDown size={14} color="#0052CC" />
                              : <ChevronRight size={14} color="#97A0AF" />}
                          </td>

                          <td>
                            <div style={{ fontWeight: 600, fontSize: 13, color: '#091E42', marginBottom: 2 }}>{test.title}</div>
                            <div style={{ fontSize: 11, color: '#97A0AF', fontFamily: 'monospace' }}>TC-{test.test_case_id}</div>
                          </td>

                          <td>
                            <span className="badge badge--gray">{test.project_id || '—'}</span>
                          </td>

                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#FFEBE6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: '#FF5630' }}>
                                {test.fail_count}
                              </div>
                            </div>
                          </td>

                          <td style={{ fontSize: 12, color: '#6B778C' }}>
                            {test.last_failed ? new Date(test.last_failed).toLocaleDateString() : '—'}
                          </td>

                          <td>
                            {test.latest_status && (
                              <Chip
                                label={test.latest_status}
                                color={STAT_COL[test.latest_status] || '#6B778C'}
                                bg={STAT_BG[test.latest_status] || '#F4F5F7'}
                              />
                            )}
                          </td>

                          <td>
                            {test.bugs.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {test.bugs.slice(0, 2).map(bug => (
                                  <Chip
                                    key={bug.id}
                                    label={`BUG-${bug.id}`}
                                    color={SEV_COL[bug.severity] || '#6B778C'}
                                    bg={SEV_BG[bug.severity] || '#F4F5F7'}
                                  />
                                ))}
                                {test.bugs.length > 2 && (
                                  <Chip label={`+${test.bugs.length - 2}`} color="#6554C0" bg="#EAE6FF" />
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: 12, color: '#97A0AF' }}>—</span>
                            )}
                          </td>

                          <td>
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                              {test.is_flaky && (
                                <Chip label="⚡ Flaky" color="#FFAB00" bg="#FFFAE6" />
                              )}
                              {test.bugs.some(b => b.severity === 'High') && (
                                <Chip label="🔴 Critical" color="#FF5630" bg="#FFEBE6" />
                              )}
                            </div>
                          </td>

                          <td onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {test.latest_exec_id && (
                                <button className="icon-btn" title="View last execution"
                                  onClick={() => navigate(`/execution-console/${test.latest_exec_id}`)}>
                                  <Eye size={14} />
                                </button>
                              )}
                                <button className="icon-btn" title="Re-run test"
                                  style={{ color: '#36B37E' }}
                                  disabled={rerunning[test.test_case_id]}
                                  onClick={() => handleRerun(test)}>
                                  {rerunning[test.test_case_id]
                                    ? <Loader2 size={14} className="animate-spin" />
                                    : <Play size={14} />}
                                </button>
                                <button className="icon-btn" title="Delete test case"
                                  style={{ color: '#FF5630' }}
                                  onClick={(e) => handleDeleteTestCase(e, test.test_case_id)}>
                                  <XCircle size={14} />
                                </button>
                              </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right: Before vs After Comparison Panel */}
              {activeView === 'compare' && (
                <div>
                  {!activeRow ? (
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center', color: '#97A0AF' }}>
                      <GitCompare size={48} style={{ marginBottom: 16, opacity: 0.4 }} />
                      <h3 style={{ margin: '0 0 8px', color: '#344563' }}>Select a test case</h3>
                      <p style={{ fontSize: 13, margin: 0 }}>Click any row on the left to compare its last two executions side by side.</p>
                    </div>
                  ) : cmpLoading ? (
                    <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
                      <Loader2 size={36} className="animate-spin" color="#0052CC" />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                      {/* Title banner */}
                      <div className="card" style={{ padding: '14px 20px', background: '#F0F4FF', borderLeft: '4px solid #0052CC' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0052CC', marginBottom: 4 }}>
                          Comparing: {activeRow.title}
                        </div>
                        <div style={{ fontSize: 12, color: '#344563' }}>
                          Showing last 2 executions · Click "Re-run" to generate a new comparison
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        {/* BEFORE */}
                        <CompareColumn
                          title="Before (Older)"
                          exec={comparison?.before}
                          accentColor="#FF5630"
                          accentBg="#FFEBE6"
                          navigate={navigate}
                        />
                        {/* AFTER */}
                        <CompareColumn
                          title="After (Latest)"
                          exec={comparison?.after}
                          accentColor="#36B37E"
                          accentBg="#E3FCEF"
                          navigate={navigate}
                        />
                      </div>

                      {/* Diff Summary */}
                      {comparison?.before && comparison?.after && (
                        <DiffSummary before={comparison.before} after={comparison.after} />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Compare Column ───────────────────────────────────────────────────────────

const CompareColumn = ({ title, exec, accentColor, accentBg, navigate }) => {
  const [showLogs, setShowLogs] = useState(false);

  if (!exec) {
    return (
      <div className="card" style={{ padding: 20, textAlign: 'center', color: '#97A0AF' }}>
        <p style={{ margin: 0, fontSize: 13 }}>No execution data</p>
      </div>
    );
  }

  const passSteps = (exec.step_results || []).filter(s => s.status === 'PASS').length;
  const failSteps = (exec.step_results || []).filter(s => s.status === 'FAIL').length;

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Column header */}
      <div style={{ background: accentBg, borderBottom: `2px solid ${accentColor}`, padding: '12px 16px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <Chip
            label={exec.status}
            color={STAT_COL[exec.status] || '#6B778C'}
            bg={exec.status === 'PASS' ? '#E3FCEF' : '#FFEBE6'}
          />
          {exec.duration && (
            <span style={{ fontSize: 11, color: '#6B778C', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={11} /> {exec.duration}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#6B778C', marginTop: 4 }}>
          RUN-{exec.id} · {exec.started_at ? new Date(exec.started_at).toLocaleString() : '—'}
        </div>
      </div>

      {/* Step summary bar */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #F4F5F7', display: 'flex', gap: 16 }}>
        <span style={{ fontSize: 12, color: '#36B37E', fontWeight: 700 }}>✓ {passSteps} passed</span>
        <span style={{ fontSize: 12, color: '#FF5630', fontWeight: 700 }}>✗ {failSteps} failed</span>
        <span style={{ fontSize: 12, color: '#97A0AF' }}>of {exec.step_results?.length || 0} steps</span>
      </div>

      {/* Steps list */}
      <div style={{ padding: '8px 16px', maxHeight: 260, overflowY: 'auto' }}>
        {(exec.step_results || []).length === 0
          ? <p style={{ fontSize: 12, color: '#97A0AF', margin: '8px 0' }}>No step data recorded.</p>
          : (exec.step_results || []).map((step, i) => <StepRow key={i} step={step} />)
        }
      </div>

      {/* Log toggle */}
      {exec.logs?.length > 0 && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid #F4F5F7' }}>
          <button style={{ fontSize: 12, fontWeight: 600, color: '#0052CC', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => setShowLogs(s => !s)}>
            {showLogs ? '▲ Hide Logs' : '▼ Show Logs'}
          </button>
          {showLogs && (
            <div style={{ marginTop: 8, background: '#0f172a', borderRadius: 6, padding: '10px 12px', maxHeight: 150, overflowY: 'auto', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.6 }}>
              {exec.logs.map((log, i) => (
                <div key={i} style={{ color: log.ok ? '#94a3b8' : '#f87171' }}>
                  [{log.t}] {log.msg}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Navigate to console */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid #F4F5F7' }}>
        <button className="btn btn--secondary"
          style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
          onClick={() => navigate(`/execution-console/${exec.id}`)}>
          <Eye size={13} /> View Full Console
        </button>
      </div>
    </div>
  );
};

// ─── Diff Summary ─────────────────────────────────────────────────────────────

const DiffSummary = ({ before, after }) => {
  const beforePass = (before.step_results || []).filter(s => s.status === 'PASS').length;
  const afterPass  = (after.step_results  || []).filter(s => s.status === 'PASS').length;
  const beforeFail = (before.step_results || []).filter(s => s.status === 'FAIL').length;
  const afterFail  = (after.step_results  || []).filter(s => s.status === 'FAIL').length;

  const improved = afterPass > beforePass || (after.status === 'PASS' && before.status === 'FAIL');
  const fixed    = before.status === 'FAIL' && after.status === 'PASS';
  const regressed = before.status === 'PASS' && after.status === 'FAIL';

  return (
    <div className="card" style={{ padding: '16px 20px', borderLeft: `4px solid ${improved ? '#36B37E' : '#FFAB00'}` }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#091E42', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <BarChart2 size={16} color={improved ? '#36B37E' : '#FFAB00'} />
        Regression Diff Summary
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {[
          { label: 'Steps Passing',     before: beforePass, after: afterPass,  betterHigh: true },
          { label: 'Steps Failing',     before: beforeFail, after: afterFail,  betterHigh: false },
          { label: 'Overall Outcome',   before: before.status, after: after.status, isStatus: true },
        ].map(({ label, before: bv, after: av, betterHigh, isStatus }) => {
          const changed = bv !== av;
          const better  = betterHigh ? (av > bv) : (av < bv);
          return (
            <div key={label} style={{ background: '#F4F5F7', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#97A0AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isStatus ? (
                  <>
                    <Chip label={bv || '—'} color={STAT_COL[bv] || '#6B778C'} bg={STAT_BG[bv] || '#F4F5F7'} />
                    <ArrowRight size={12} color="#97A0AF" />
                    <Chip label={av || '—'} color={STAT_COL[av] || '#6B778C'} bg={STAT_BG[av] || '#F4F5F7'} />
                  </>
                ) : (
                  <>
                    <span style={{ fontWeight: 800, fontSize: 18, color: '#344563' }}>{bv}</span>
                    <ArrowRight size={12} color="#97A0AF" />
                    <span style={{ fontWeight: 800, fontSize: 18, color: changed ? (better ? '#36B37E' : '#FF5630') : '#344563' }}>
                      {av}
                    </span>
                    {changed && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: better ? '#36B37E' : '#FF5630' }}>
                        {better ? '✓ Better' : '✗ Worse'}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 8, background: fixed ? '#E3FCEF' : regressed ? '#FFEBE6' : '#FFFAE6', fontSize: 13, fontWeight: 600, color: fixed ? '#006644' : regressed ? '#BF2600' : '#974F0C' }}>
        {fixed     ? '✅ Bug appears to be FIXED. Confirm with stakeholders before closing.' :
         regressed ? '⚠️ This test REGRESSED. The fix may have introduced a new issue.' :
                     '⚡ Results are mixed. Review individual step failures for details.'}
      </div>
    </div>
  );
};

export default RegressionCenter;
