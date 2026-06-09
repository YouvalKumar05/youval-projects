import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Search, ChevronDown, ChevronRight, CheckCircle, XCircle,
  AlertCircle, Plus, Download, RefreshCw, Zap, Shield,
  BarChart, PieChart, Info, Loader2, ArrowRight, FileText,
  Filter, Calendar, Activity, TableProperties
} from 'lucide-react';
import { api } from '../services/api';
import { useWorkflow } from '../context/WorkflowContext';
import AccuracyDashboard from '../components/ai/AccuracyDashboard';

const STATUS_STYLE = {
  Pass: { bg: '#E3FCEF', color: '#1f6b45', icon: CheckCircle },
  Fail: { bg: '#FFEBE6', color: '#9e2a0e', icon: XCircle },
  Pending: { bg: '#DEEBFF', color: '#0052CC', icon: AlertCircle },
  Approved: { bg: '#E3FCEF', color: '#1f6b45', icon: CheckCircle },
};

const AnalysisReview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { updateWorkflow } = useWorkflow();
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [analysesList, setAnalysesList] = useState([]);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [approving, setApproving] = useState(false);
  const [deletingIdx, setDeletingIdx] = useState(null);
  const [accuracyData, setAccuracyData] = useState(null);
  const [accuracyLoading, setAccuracyLoading] = useState(false);
  const [enhancingIdx, setEnhancingIdx] = useState(null);
  const [saving, setSaving] = useState(false);
  const [userPrompts, setUserPrompts] = useState({}); // idx -> string

  useEffect(() => {
    if (id) {
      fetchAnalysis();
    } else {
      fetchAnalysesList();
    }
  }, [id]);

  const fetchAnalysis = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/requirements/analysis/${id}`);
      if (res.status === 'success') {
        setAnalysis(res.data);
        updateWorkflow({
          projectName: res.data.project_name,
          requirementText: res.data.requirement_text,
          analysisId: res.data.id,
          status: 'reviewing'
        });
        // Evaluate accuracy after analysis loads
        fetchAccuracy(res.data.requirement_text, res.data.scenarios);
      }
    } catch (err) {
      console.error("Failed to fetch analysis:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalysesList = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/requirements/analyses');
      if (res.status === 'success') {
        setAnalysesList(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch analyses list:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccuracy = async (requirement, scenarios) => {
    if (!requirement || !scenarios) return;
    setAccuracyLoading(true);
    try {
      const res = await api.post('/api/accuracy', {
        requirement: requirement,
        test_cases: scenarios
      });
      setAccuracyData(res);
    } catch (err) {
      console.error("Failed to fetch accuracy evaluation:", err);
    } finally {
      setAccuracyLoading(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      // 1. Save any manual edits to scripts/scenarios first
      await api.put(`/api/requirements/analysis/${id}/scenarios`, {
        scenarios: analysis.scenarios
      });

      // 2. Call approval
      const res = await api.post(`/api/requirements/analysis/${id}/approve`);
      if (res.status === 'success') {
        const tcId = res.data.test_case_ids?.[0];
        updateWorkflow({
          testCaseId: tcId,
          status: 'executing'
        });
        navigate(`/execution-dashboard?auto_run=${tcId}`);
      }
    } catch (err) {
      alert("Approval failed: " + err.message);
    } finally {
      setApproving(false);
    }
  };

  const handleDeleteScenario = async (idx) => {
    if (!window.confirm('Are you sure you want to delete this test scenario? This cannot be undone.')) return;
    setDeletingIdx(idx);
    try {
      const res = await api.delete(`/api/requirements/analysis/${id}/scenario/${idx}`);
      if (res.status === 'success') {
        setAnalysis(prev => ({ ...prev, scenarios: res.data.scenarios }));
        if (expanded === idx) setExpanded(null);
        else if (expanded > idx) setExpanded(expanded - 1);
      } else {
        alert(res.message || 'Failed to delete scenario');
      }
    } catch (err) {
      alert('Delete failed: ' + (err.message || 'Unknown error'));
    } finally {
      setDeletingIdx(null);
    }
  };

  const handleScriptChange = (idx, newScript) => {
    setAnalysis(prev => {
      const newScenarios = [...prev.scenarios];
      newScenarios[idx] = { ...newScenarios[idx], script: newScript };
      return { ...prev, scenarios: newScenarios };
    });
  };

  const handleSaveScenarios = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/api/requirements/analysis/${id}/scenarios`, {
        scenarios: analysis.scenarios
      });
      if (res.status === 'success') {
        alert('All scenario changes saved successfully!');
      }
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEnhanceScript = async (idx) => {
    console.log("Enhancing script for index:", idx);
    const scenario = analysis.scenarios[idx];
    if (!scenario) {
      console.error("Scenario not found at index", idx);
      return;
    }
    setEnhancingIdx(idx);
    try {
      const res = await api.post('/api/ai/enhance-script', {
        script: scenario.script || "",
        user_prompt: userPrompts[idx] || "",
        scenario: {
          title: scenario.title,
          steps: scenario.actions || []
        }
      });
      if (res.status === 'success') {
        handleScriptChange(idx, res.data.enhanced_script);
      } else {
        alert('AI Enhancement failed: ' + res.message);
      }
    } catch (err) {
      alert('Enhance failed: ' + err.message);
    } finally {
      setEnhancingIdx(null);
    }
  };

  const handleDeleteAnalysis = async (e, analysisId) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this analysis? This will remove it from the repository.')) return;
    try {
      const res = await api.delete(`/api/requirements/analysis/${analysisId}`);
      if (res.status === 'success') {
        if (id) {
          navigate('/analysis-review');
        } else {
          setAnalysesList(prev => prev.filter(a => a.id !== analysisId));
        }
      } else {
        alert(res.message || 'Failed to delete analysis');
      }
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Loader2 className="animate-spin" size={48} color="#0052CC" />
      </div>
    );
  }

  // --- LIST VIEW ---
  if (!id) {
    const filteredList = analysesList.filter(a =>
      a.project_name.toLowerCase().includes(search.toLowerCase()) ||
      a.requirement_text.toLowerCase().includes(search.toLowerCase())
    );

    return (
      <div className="page-container animate-fade-in-up" style={{ padding: '32px' }}>
        <div className="page-header" style={{ marginBottom: 32 }}>
          <div>
            <h1 className="page-title">Analysis Repository</h1>
            <p className="page-subtitle">Historical AI analysis results and pending reviews.</p>
          </div>
          <div className="page-actions">
            <button className="btn btn--primary" onClick={() => navigate('/data-input')}>
              <Plus size={16} /> New Analysis
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <div className="search-wrapper" style={{ width: 300, margin: 0 }}>
            <Search size={14} color="#6B778C" />
            <input
              className="search-input"
              placeholder="Search by project or text..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn--secondary"><Filter size={14} /> Filter</button>
        </div>

        <div className="card" style={{ border: '1px solid #DFE1E6', background: 'white', overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Requirement Snippet</th>
                <th>Risk Score</th>
                <th>Coverage</th>
                <th>Status</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: 40, color: '#97A0AF' }}>
                    No analysis results found.
                  </td>
                </tr>
              ) : filteredList.map(a => (
                <tr key={a.id} onClick={() => navigate(`/analysis-review/${a.id}`)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 700, color: '#091E42' }}>{a.project_name}</td>
                  <td style={{ color: '#6B778C', fontSize: 13, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.requirement_text}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 800, color: a.risk_score > 80 ? '#36B37E' : '#FFAB00' }}>{a.risk_score}</span>
                      <div style={{ width: 40, height: 4, background: '#F4F5F7', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${a.risk_score}%`, background: a.risk_score > 80 ? '#36B37E' : '#FFAB00' }}></div>
                      </div>
                    </div>
                  </td>
                  <td><span className="badge badge--info">{a.coverage_pct}%</span></td>
                  <td>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: a.status === 'Approved' ? '#36B37E' : '#FFAB00',
                      background: a.status === 'Approved' ? '#E3FCEF' : '#FFF4E5',
                      padding: '2px 8px', borderRadius: 12
                    }}>
                      {a.status}
                    </span>
                  </td>
                  <td><span style={{ fontSize: 12, color: '#97A0AF' }}>{new Date(a.created_at).toLocaleDateString()}</span></td>
                  <td style={{ textAlign: 'right', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="icon-btn" onClick={(e) => handleDeleteAnalysis(e, a.id)} style={{ color: '#FF5630' }}>
                      <XCircle size={16} />
                    </button>
                    <button className="icon-btn" onClick={() => navigate(`/analysis-review/${a.id}`)}>
                      <ArrowRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --- DETAIL VIEW ---
  if (!analysis) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: 80 }}>
        <AlertCircle size={48} color="#FF5630" style={{ margin: '0 auto 24px' }} />
        <h2 style={{ fontSize: 24, fontWeight: 800 }}>Analysis Not Found</h2>
        <p style={{ color: '#6B778C', marginBottom: 24 }}>The requested analysis session could not be retrieved.</p>
        <button className="btn btn--primary" onClick={() => navigate('/analysis-review')}>Back to Repository</button>
      </div>
    );
  }

  const filteredScenarios = (analysis.scenarios || []).filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container animate-fade-in-up" style={{ padding: '32px' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, cursor: 'pointer' }} onClick={() => navigate('/analysis-review')}>
            <ArrowRight size={16} style={{ transform: 'rotate(180deg)' }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: '#0052CC', textTransform: 'uppercase', letterSpacing: '1px' }}>Back to Repository</span>
          </div>
          <h1 className="page-title" style={{ fontSize: 28, fontWeight: 900 }}>{analysis.project_name}</h1>
          <p className="page-subtitle" style={{ fontSize: 15, color: '#6B778C' }}>Review generated scenarios and validate coverage before committing to the repository.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn--secondary" onClick={(e) => handleDeleteAnalysis(e, analysis.id)} style={{ color: '#FF5630', borderColor: '#FF5630' }}>
            <XCircle size={14} /> Delete
          </button>
          <button className="btn btn--secondary" disabled><Download size={14} /> Export</button>
          <button className="btn btn--secondary" onClick={() => navigate('/data-input')}><RefreshCw size={14} /> Re-analyze</button>
          <button
            className="btn btn--secondary"
            onClick={() => navigate(`/test-cases?req=${encodeURIComponent(analysis.requirement_text)}&project=${encodeURIComponent(analysis.project_name)}`)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <TableProperties size={14} /> Generate Test Cases
          </button>
          <button
            className="btn btn--primary"
            onClick={handleApprove}
            disabled={approving || analysis.status === 'Approved'}
            style={{ minWidth: 140, height: 40 }}
          >
            {approving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            {approving ? ' Finalizing...' : analysis.status === 'Approved' ? ' Approved' : ' Approve & Save'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 32, marginBottom: 32, alignItems: 'start' }}>
        {/* Requirement Summary Card */}
        <div className="card" style={{ height: '100%', border: '1px solid #DFE1E6', background: 'white' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F4F5F7', display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={16} color="#42526E" />
            <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#42526E', textTransform: 'uppercase' }}>Requirement Summary</h3>
          </div>
          <div style={{ padding: '24px' }}>
            <div style={{ background: '#F4F5F7', padding: '16px', borderRadius: 12, fontSize: 14, color: '#344563', lineHeight: 1.6, minHeight: 120 }}>
              {analysis.requirement_text}
            </div>
          </div>
        </div>

        {/* Risk & Coverage Panel */}
        <div style={{ display: 'grid', gap: 20 }}>
          <div className="card" style={{ border: '1px solid #DFE1E6', background: 'white', overflow: 'hidden' }}>
            <div style={{ padding: '24px', display: 'flex', gap: 24, alignItems: 'center' }}>
              <div style={{ position: 'relative', width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" stroke="#EBECF0" strokeWidth="6" fill="transparent" />
                  <circle cx="40" cy="40" r="34" stroke="#0052CC" strokeWidth="6" fill="transparent" strokeDasharray="213.6" strokeDashoffset={213.6 - (213.6 * analysis.coverage_pct / 100)} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
                </svg>
                <div style={{ position: 'absolute', fontSize: 18, fontWeight: 800, color: '#0052CC' }}>{analysis.coverage_pct}%</div>
              </div>
              <div>
                <h4 style={{ margin: 0, fontWeight: 800, color: '#091E42' }}>Requirement Coverage</h4>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B778C' }}>The AI has mapped {analysis.coverage_pct}% of specified criteria.</p>
              </div>
            </div>
          </div>

          <div className="card" style={{ border: '1px solid #DFE1E6', background: 'white' }}>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h4 style={{ margin: 0, fontWeight: 800, color: '#091E42' }}>Risk Scoring Audit</h4>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#36B37E', background: '#E3FCEF', padding: '2px 8px', borderRadius: 4 }}>READINESS SCALE</span>
              </div>
              <div style={{ fontSize: 48, fontWeight: 900, color: '#091E42', letterSpacing: '-2px', marginBottom: 8 }}>{analysis.risk_score}<span style={{ fontSize: 20, color: '#97A0AF', fontWeight: 500 }}>/100</span></div>
              <div style={{ height: 6, width: '100%', background: '#F4F5F7', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${analysis.risk_score}%`, background: analysis.risk_score > 80 ? '#36B37E' : '#FFAB00' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accuracy Dashboard Section */}
      <div style={{ marginBottom: 32 }}>
        <AccuracyDashboard data={accuracyData} loading={accuracyLoading} />
      </div>

      <div className="card" style={{ border: '1px solid #DFE1E6', background: 'white', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F4F5F7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#42526E', textTransform: 'uppercase' }}>Generated Test Scenarios ({filteredScenarios.length})</h3>
          <div className="search-wrapper" style={{ width: 240, margin: 0 }}>
            <Search size={14} color="#6B778C" />
            <input className="search-input" placeholder="Filter scenarios..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>#</th>
              <th>Scenario Title</th>
              <th>Estimated Steps</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredScenarios.map((s, idx) => {
              const isExp = expanded === idx;
              const realIdx = (analysis.scenarios || []).indexOf(s);
              return (
                <React.Fragment key={idx}>
                  <tr style={{ cursor: 'pointer' }}>
                    <td onClick={() => setExpanded(isExp ? null : idx)}>{idx + 1}</td>
                    <td onClick={() => setExpanded(isExp ? null : idx)} style={{ fontWeight: 600, color: '#091E42' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isExp ? <ChevronDown size={14} color="#97A0AF" /> : <ChevronRight size={14} color="#97A0AF" />}
                        {s.title}
                      </div>
                    </td>
                    <td onClick={() => setExpanded(isExp ? null : idx)}><span className="badge badge--gray">{s.actions?.length || 0} Steps</span></td>
                    <td onClick={() => setExpanded(isExp ? null : idx)}><span className="badge badge--info">Verified</span></td>
                    <td style={{ textAlign: 'right', display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                      <Info size={16} color="#97A0AF" onClick={() => setExpanded(isExp ? null : idx)} style={{ cursor: 'pointer' }}/>
                      {analysis.status !== 'Approved' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteScenario(realIdx); }}
                          disabled={deletingIdx === realIdx}
                          style={{ background: 'none', border: '1px solid #FF5630', color: '#FF5630', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, opacity: deletingIdx === realIdx ? 0.5 : 1 }}
                        >
                          {deletingIdx === realIdx ? <Loader2 size={10} className="animate-spin" /> : <XCircle size={10} />}
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                  {isExp && (
                    <tr style={{ background: '#F4F5F7' }}>
                      <td colSpan={5} style={{ padding: '24px 32px 32px 60px' }}>
                        <div style={{ display: 'grid', gap: 12 }}>
                          {s.actions?.map((action, aidx) => (
                            <div key={aidx} style={{ display: 'flex', gap: 16 }}>
                              <div style={{ minWidth: 20, height: 20, borderRadius: '50%', background: '#DEEBFF', color: '#0052CC', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{aidx + 1}</div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#091E42' }}>{action.description}</div>
                                <div style={{ fontSize: 11, color: '#6B778C', fontFamily: 'monospace' }}>Type: {action.type}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {s.script !== undefined && (
                          <div style={{ marginTop: 24, padding: 20, background: '#1E293B', borderRadius: 12, color: '#F8FAFC', border: '1px solid #334155', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ color: '#94A3B8', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 800 }}>Playwright Python Automation Script</div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button 
                                    className="btn btn--secondary" 
                                    onClick={handleSaveScenarios}
                                    disabled={saving}
                                    style={{ padding: '4px 12px', fontSize: 11, background: '#344563', border: '1px solid #475569', color: '#F8FAFC' }}
                                    title="Save all changes to this analysis"
                                  >
                                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Manual Update
                                  </button>
                                  <button 
                                    className="btn btn--secondary" 
                                    onClick={() => handleEnhanceScript(realIdx)}
                                    disabled={enhancingIdx === realIdx}
                                    style={{ padding: '4px 12px', fontSize: 11, background: '#0052CC', border: '1px solid #0047B3', color: '#F8FAFC' }}
                                  >
                                    {enhancingIdx === realIdx ? (
                                      <>
                                        <Loader2 size={12} className="animate-spin" /> Processing...
                                      </>
                                    ) : (
                                      <>
                                        <Zap size={12} color="#F59E0B" /> Enhance with AI
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0F172A', padding: '8px 12px', borderRadius: 8, border: '1px solid #334155' }}>
                                <AlertCircle size={14} color="#94A3B8" />
                                <input 
                                  placeholder="Additional instructions for AI (e.g. 'Add validation for login', 'Use different selector'...)"
                                  value={userPrompts[realIdx] || ''}
                                  onChange={(e) => setUserPrompts({...userPrompts, [realIdx]: e.target.value})}
                                  style={{ background: 'transparent', border: 'none', color: '#F8FAFC', fontSize: 12, width: '100%', outline: 'none' }}
                                />
                              </div>
                            </div>
                            <textarea
                              style={{
                                width: '100%',
                                minHeight: 200,
                                background: '#0F172A',
                                border: '1px solid #334155',
                                borderRadius: 8,
                                color: '#34D399',
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 13,
                                padding: 16,
                                lineHeight: 1.6,
                                resize: 'vertical',
                                outline: 'none'
                              }}
                              spellCheck="false"
                              value={s.script || ''}
                              onChange={(e) => handleScriptChange(realIdx, e.target.value)}
                            />
                            <div style={{ marginTop: 12, fontSize: 11, color: '#64748B', fontStyle: 'italic' }}>
                              * You can manually edit the script above. Changes are saved when you approve the analysis.
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AnalysisReview;
