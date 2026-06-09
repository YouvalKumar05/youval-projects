import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Wand2, Download, RefreshCw, ChevronDown, ChevronRight,
  CheckCircle, AlertCircle, Clock, Loader2, Copy, Filter,
  ArrowUpDown, Zap, Shield, Bug, TableProperties, PlayCircle,
  Globe, Settings2, Target, Layers, ToggleLeft
} from 'lucide-react';
import { api } from '../services/api';
import { useWorkflow } from '../context/WorkflowContext';

/* ─────────────── constants ─────────────── */
const STATUS_STYLE = {
  'To Be Tested': { bg: '#EAE6FF', color: '#403294', icon: Clock },
  'Pass': { bg: '#E3FCEF', color: '#006644', icon: CheckCircle },
  'Fail': { bg: '#FFEBE6', color: '#BF2600', icon: AlertCircle },
  'Blocked': { bg: '#FFF4E5', color: '#974F0C', icon: AlertCircle },
};
const SEV_STYLE = {
  'Critical': { bg: '#FF2D55', color: '#fff' },
  'High': { bg: '#FF5630', color: '#fff' },
  'Medium': { bg: '#FFAB00', color: '#172B4D' },
  'Low': { bg: '#36B37E', color: '#fff' },
  '': { bg: '#DFE1E6', color: '#42526E' },
};

const EDITABLE_FIELDS = ['actual_outcome', 'status', 'bug_identified', 'severity'];
const STATUS_OPTIONS = ['To Be Tested', 'Pass', 'Fail', 'Blocked'];
const SEVERITY_OPTIONS = ['', 'Critical', 'High', 'Medium', 'Low'];

/* ─────────────── helpers ─────────────── */
function toCSV(rows) {
  const cols = [
    'id', 'scenario', 'description', 'steps', 'input_data', 'expected_outcome',
    'actual_outcome', 'status', 'bug_identified', 'severity', 'ai_suggestion',
  ];
  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const header = cols.map((c) => escape(c.replace(/_/g, ' ').toUpperCase())).join(',');
  const body = rows.map((r) =>
    cols.map((c) => {
      const v = r[c];
      if (Array.isArray(v)) return escape(v.join(' | '));
      if (typeof v === 'object' && v !== null) return escape(JSON.stringify(v));
      return escape(v ?? '');
    }).join(',')
  );
  return [header, ...body].join('\n');
}

/* ─────────────── sub-components ─────────────── */

const Badge = ({ label, bg, color }) => (
  <span style={{
    display: 'inline-block', padding: '2px 10px', borderRadius: 99,
    fontSize: 11, fontWeight: 700, background: bg, color,
  }}>{label}</span>
);

const EditableCell = ({ value, field, onChange }) => {
  if (field === 'status') {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          border: 'none', background: 'transparent', fontSize: 12, fontWeight: 700,
          color: STATUS_STYLE[value]?.color || '#42526E', cursor: 'pointer',
          outline: 'none', width: '100%',
        }}
      >
        {STATUS_OPTIONS.map((o) => <option key={o}>{o}</option>)}
      </select>
    );
  }
  if (field === 'severity') {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          border: 'none', background: 'transparent', fontSize: 12, fontWeight: 700,
          color: SEV_STYLE[value]?.bg || '#42526E', cursor: 'pointer',
          outline: 'none', width: '100%',
        }}
      >
        {SEVERITY_OPTIONS.map((o) => <option key={o} value={o}>{o || '—'}</option>)}
      </select>
    );
  }
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="—"
      style={{
        border: 'none', background: 'transparent', fontSize: 12,
        color: '#091E42', outline: 'none', width: '100%', minWidth: 80,
      }}
    />
  );
};

/* ─────────────── MAIN COMPONENT ─────────────── */

const TestCaseTable = () => {
  const navigate = useNavigate();
  const { activeWorkflow } = useWorkflow();

  // Pre-populate from URL params (from AnalysisReview) or global workflow context
  const urlParams = new URLSearchParams(window.location.search);
  const urlReq = urlParams.get('req');
  const urlProject = urlParams.get('project');

  const [requirement, setRequirement] = useState(urlReq || activeWorkflow?.requirementText || '');
  const [projectName, setProjectName] = useState(urlProject || activeWorkflow?.projectName || '');
  const [testCases, setTestCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const tableRef = useRef(null);

  // ── Generation Config ──
  const [targetUrl, setTargetUrl] = useState('');
  const [numCases, setNumCases] = useState(10);
  const [testingTypes, setTestingTypes] = useState(['Functional Testing']);
  const [priority, setPriority] = useState('Medium');
  const [complexity, setComplexity] = useState('Intermediate');
  const [coverageLevel, setCoverageLevel] = useState('Standard');
  const [environment, setEnvironment] = useState('Production');
  const [configOpen, setConfigOpen] = useState(true);

  const TESTING_TYPE_OPTIONS = [
    'Functional Testing', 'UI Testing', 'Navigation Testing',
    'Smoke Testing', 'Regression Testing', 'Edge Case Testing', 'Negative Testing'
  ];

  const toggleTestingType = (type) => {
    setTestingTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  /* ── Generate ── */
  const generate = async () => {
    if (!requirement.trim()) return;
    setLoading(true);
    setError(null);
    setTestCases([]);
    try {
      const res = await api.post('/api/ai/generate-test-cases', {
        requirement,
        projectName,
        target_url: targetUrl,
        num_cases: numCases,
        testing_types: testingTypes,
        priority,
        complexity,
        coverage_level: coverageLevel,
        environment,
      });
      if (res.status === 'success') {
        setTestCases(res.data.test_cases);
      }
    } catch (err) {
      setError(err.message || 'Generation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Approve & Execute ── */
  const handleApproveAndExecute = async () => {
    if (testCases.length === 0) return;
    setApproving(true);
    try {
      const res = await api.post('/api/testcases/bulk-approve-and-execute', {
        project_id: projectName || 'default',
        title: projectName || 'Generated Suite',
        test_cases: testCases,
        version_id: 'v1.0.0'
      });
      if (res.status === 'success') {
        const firstId = res.data.test_case_ids[0];
        navigate(`/execution-dashboard?auto_run=${firstId}`);
      }
    } catch (err) {
      setError("Approval failed: " + err.message);
    } finally {
      setApproving(false);
    }
  };

  /* ── In-place cell edit ── */
  const handleCellEdit = (idx, field, value) => {
    setTestCases((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  /* ── Export CSV ── */
  const exportCSV = () => {
    const csv = toCSV(testCases);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-cases-${projectName || 'export'}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Copy JSON ── */
  const copyJSON = () => navigator.clipboard.writeText(JSON.stringify(testCases, null, 2));

  /* ── Filtered rows ── */
  const visible = testCases.filter((tc) => {
    const matchFilter = filter === 'All' || tc.status === filter;
    const matchSearch = !search ||
      tc.scenario.toLowerCase().includes(search.toLowerCase()) ||
      tc.id.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  /* ── Stats ── */
  const stats = {
    total: testCases.length,
    tested: testCases.filter((t) => t.status !== 'To Be Tested').length,
    passed: testCases.filter((t) => t.status === 'Pass').length,
    failed: testCases.filter((t) => t.status === 'Fail').length,
    blocked: testCases.filter((t) => t.status === 'Blocked').length,
  };

  /* ────────────────────────── RENDER ────────────────────────── */
  return (
    <div className="page-container animate-fade-in-up">

      {/* ── Page Header ── */}
      <div className="page-header" style={{ marginBottom: 28 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <TableProperties size={28} style={{ color: '#0052CC' }} />
            Test Case Generator
          </h1>
          <p className="page-subtitle">
            Convert any requirement into a full, editable QA test case table.
          </p>
        </div>
        {testCases.length > 0 && (
          <div className="page-actions">
            <button className="btn btn--secondary" onClick={copyJSON}><Copy size={14} /> Copy JSON</button>
            <button className="btn btn--secondary" onClick={exportCSV}><Download size={14} /> Export CSV</button>
            <button
              className="btn btn--primary"
              onClick={handleApproveAndExecute}
              disabled={approving}
              style={{ background: '#36B37E', borderColor: '#36B37E' }}
            >
              {approving ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
              Approve & Proceed to Execution
            </button>
          </div>
        )}
      </div>

      {/* ── Configuration Panel ── */}
      <div className="card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden', border: '1px solid #DFE1E6' }}>
        {/* Panel Header */}
        <div
          onClick={() => setConfigOpen(o => !o)}
          style={{ background: 'linear-gradient(135deg, #0747A6 0%, #0052CC 100%)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Settings2 size={16} color="white" />
            <span style={{ fontSize: 13, fontWeight: 800, color: 'white', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Test Generation Configuration</span>
          </div>
          {configOpen ? <ChevronDown size={16} color="white" /> : <ChevronRight size={16} color="white" />}
        </div>

        {configOpen && (
          <div style={{ padding: 24 }}>
            {/* Row 1: URL + Requirement */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Globe size={13} color="#0052CC" /> Target URL
                </label>
                <input
                  className="form-input"
                  value={targetUrl}
                  onChange={e => setTargetUrl(e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Project Name (optional)</label>
                <input
                  className="form-input"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  placeholder="e.g. Auth Module v2"
                />
              </div>
            </div>

            {/* Requirement */}
            <div className="form-group" style={{ margin: '0 0 20px 0' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={13} color="#0052CC" /> Requirement / User Story
              </label>
              <textarea
                className="form-textarea"
                rows={4}
                value={requirement}
                onChange={e => setRequirement(e.target.value)}
                placeholder="Describe what you want to test — user story, acceptance criteria, or feature description…"
                style={{ resize: 'vertical', minHeight: 90 }}
              />
            </div>

            {/* Row 2: Numbers + Dropdowns */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 20 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Target size={12} color="#0052CC" /> No. of Test Cases
                </label>
                <select className="form-input" value={numCases} onChange={e => setNumCases(Number(e.target.value))}>
                  {[5, 10, 20, 50, 100].map(n => <option key={n} value={n}>{n} cases</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Shield size={12} color="#6554C0" /> Priority Level
                </label>
                <select className="form-input" value={priority} onChange={e => setPriority(e.target.value)}>
                  {['High', 'Medium', 'Low'].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Layers size={12} color="#36B37E" /> Complexity Level
                </label>
                <select className="form-input" value={complexity} onChange={e => setComplexity(e.target.value)}>
                  {['Basic', 'Intermediate', 'Advanced'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ToggleLeft size={12} color="#FF8B00" /> Coverage Level
                </label>
                <select className="form-input" value={coverageLevel} onChange={e => setCoverageLevel(e.target.value)}>
                  {['Minimal', 'Standard', 'Comprehensive', 'Exhaustive'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Globe size={12} color="#0065FF" /> Environment
                </label>
                <select className="form-input" value={environment} onChange={e => setEnvironment(e.target.value)}>
                  {['Production', 'Staging', 'Development', 'QA', 'UAT'].map(e => <option key={e}>{e}</option>)}
                </select>
              </div>
            </div>

            {/* Row 3: Testing Types Multi-Select */}
            <div className="form-group" style={{ margin: '0 0 20px 0' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Wand2 size={13} color="#0052CC" /> Testing Types <span style={{ fontSize: 11, color: '#97A0AF', fontWeight: 500 }}>(select multiple)</span>
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {TESTING_TYPE_OPTIONS.map(type => {
                  const active = testingTypes.includes(type);
                  return (
                    <button
                      key={type}
                      onClick={() => toggleTestingType(type)}
                      style={{
                        padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        border: `2px solid ${active ? '#0052CC' : '#DFE1E6'}`,
                        background: active ? '#0052CC' : '#fff',
                        color: active ? '#fff' : '#344563',
                        transition: 'all 0.15s',
                      }}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Config Summary + Generate Button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #F4F5F7', paddingTop: 16 }}>
              <div style={{ fontSize: 12, color: '#6B778C', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span>🎯 <strong>{numCases}</strong> cases</span>
                <span>⚡ <strong>{priority}</strong> priority</span>
                <span>🔬 <strong>{complexity}</strong> complexity</span>
                <span>📊 <strong>{coverageLevel}</strong> coverage</span>
                <span>🌐 <strong>{environment}</strong> env</span>
                <span>🧪 <strong>{testingTypes.length}</strong> test type{testingTypes.length !== 1 ? 's' : ''}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {testCases.length > 0 && (
                  <button className="btn btn--secondary" onClick={generate} disabled={loading}>
                    <RefreshCw size={13} /> Regenerate
                  </button>
                )}
                <button
                  className="btn btn--primary"
                  style={{ height: 44, fontSize: 14, fontWeight: 700, gap: 8, minWidth: 200 }}
                  onClick={generate}
                  disabled={loading || !requirement.trim()}
                >
                  {loading
                    ? <><Loader2 size={16} className="animate-spin" /> Generating…</>
                    : <><Zap size={16} /> Generate {numCases} Test Cases</>
                  }
                </button>
              </div>
            </div>

            {error && (
              <div style={{ background: '#FFEBE6', border: '1px solid #FF563060', borderRadius: 8, padding: '10px 16px', color: '#BF2600', fontSize: 13, display: 'flex', gap: 8, marginTop: 16 }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Stats Strip ── */}
      {testCases.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total', value: stats.total, color: '#0052CC', bg: '#DEEBFF' },
            { label: 'Tested', value: stats.tested, color: '#42526E', bg: '#F4F5F7' },
            { label: 'Passed', value: stats.passed, color: '#006644', bg: '#E3FCEF' },
            { label: 'Failed', value: stats.failed, color: '#BF2600', bg: '#FFEBE6' },
            { label: 'Blocked', value: stats.blocked, color: '#974F0C', bg: '#FFF4E5' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} style={{ background: bg, border: `1px solid ${color}25`, borderRadius: 10, padding: '14px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <Loader2 size={40} className="animate-spin" color="#0052CC" style={{ margin: '0 auto 16px' }} />
          <div style={{ fontWeight: 700, color: '#091E42', fontSize: 16 }}>Generating Test Cases…</div>
          <div style={{ color: '#6B778C', fontSize: 13, marginTop: 6 }}>
            The AI is analyzing your requirement and building a full QA test matrix.
          </div>
        </div>
      )}

      {/* ── Test Case Table ── */}
      {!loading && testCases.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #DFE1E6' }}>

          {/* Table toolbar */}
          <div style={{ padding: '14px 20px', background: '#F4F5F7', borderBottom: '1px solid #DFE1E6', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#42526E' }}>
              {visible.length} of {testCases.length} test cases
            </span>

            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '1px solid #DFE1E6', borderRadius: 6, padding: '5px 12px', gap: 8, flex: '1 1 200px', maxWidth: 280 }}>
              <Filter size={13} color="#6B778C" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by ID or scenario…"
                style={{ border: 'none', outline: 'none', fontSize: 12, width: '100%', background: 'transparent' }}
              />
            </div>

            {/* Status filter pills */}
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
              {['All', ...STATUS_OPTIONS].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  style={{
                    padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                    border: filter === s ? 'none' : '1px solid #DFE1E6',
                    background: filter === s
                      ? (STATUS_STYLE[s]?.bg || '#091E42')
                      : 'white',
                    color: filter === s
                      ? (STATUS_STYLE[s]?.color || 'white')
                      : '#344563',
                  }}
                >{s}</button>
              ))}
            </div>
          </div>

          {/* Scrollable table */}
          <div ref={tableRef} style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#091E42', position: 'sticky', top: 0, zIndex: 10 }}>
                  {[
                    { label: 'ID', w: 80 },
                    { label: 'Scenario', w: 180 },
                    { label: 'Description', w: 220 },
                    { label: 'Steps', w: 50 },
                    { label: 'Input Data', w: 130 },
                    { label: 'Expected', w: 200 },
                    { label: 'Actual', w: 160 },
                    { label: 'Status', w: 120 },
                    { label: 'Bug', w: 130 },
                    { label: 'Severity', w: 100 },
                    { label: 'AI Suggestion', w: 200 },
                  ].map(({ label, w }) => (
                    <th key={label} style={{
                      padding: '10px 14px', textAlign: 'left', whiteSpace: 'nowrap',
                      color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase',
                      minWidth: w, borderRight: '1px solid rgba(255,255,255,0.08)',
                    }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((tc, idx) => {
                  const realIdx = testCases.indexOf(tc);
                  const StatusIcon = STATUS_STYLE[tc.status]?.icon || Clock;
                  const isExp = expanded === idx;

                  return (
                    <React.Fragment key={tc.id}>
                      <tr
                        style={{
                          background: idx % 2 === 0 ? 'white' : '#FAFBFC',
                          borderBottom: '1px solid #EBECF0',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#F0F4FF')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? 'white' : '#FAFBFC')}
                      >
                        {/* ID */}
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 800, color: '#0052CC', borderRight: '1px solid #EBECF0', whiteSpace: 'nowrap' }}>
                          {tc.id}
                        </td>

                        {/* Scenario (with expand toggle) */}
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: '#091E42', borderRight: '1px solid #EBECF0', maxWidth: 180 }}>
                          <div
                            style={{ display: 'flex', alignItems: 'flex-start', gap: 6, cursor: 'pointer' }}
                            onClick={() => setExpanded(isExp ? null : idx)}
                          >
                            {isExp
                              ? <ChevronDown size={14} color="#0052CC" style={{ flexShrink: 0, marginTop: 2 }} />
                              : <ChevronRight size={14} color="#97A0AF" style={{ flexShrink: 0, marginTop: 2 }} />
                            }
                            <span style={{ lineHeight: 1.4 }}>{tc.scenario}</span>
                          </div>
                        </td>

                        {/* Description */}
                        <td style={{ padding: '10px 14px', color: '#42526E', borderRight: '1px solid #EBECF0', maxWidth: 220 }}>
                          <div style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {tc.description}
                          </div>
                        </td>

                        {/* Steps count (click to expand) */}
                        <td style={{ padding: '10px 14px', textAlign: 'center', borderRight: '1px solid #EBECF0' }}>
                          <span
                            onClick={() => setExpanded(isExp ? null : idx)}
                            style={{ background: '#DEEBFF', color: '#0052CC', fontWeight: 800, fontSize: 11, padding: '3px 9px', borderRadius: 99, cursor: 'pointer' }}
                          >
                            {tc.steps?.length ?? 0}
                          </span>
                        </td>

                        {/* Input Data */}
                        <td style={{ padding: '10px 14px', borderRight: '1px solid #EBECF0', maxWidth: 130 }}>
                          {Object.keys(tc.input_data || {}).length === 0 ? (
                            <span style={{ color: '#B3BAC5', fontStyle: 'italic', fontSize: 11 }}>N/A</span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {Object.entries(tc.input_data).slice(0, 3).map(([k, v]) => (
                                <div key={k} style={{ fontSize: 11 }}>
                                  <span style={{ color: '#6B778C', fontWeight: 700 }}>{k}:</span>{' '}
                                  <span style={{ color: '#091E42', fontFamily: 'monospace' }}>{String(v).slice(0, 20)}{String(v).length > 20 ? '…' : ''}</span>
                                </div>
                              ))}
                              {Object.keys(tc.input_data).length > 3 && (
                                <span style={{ fontSize: 10, color: '#97A0AF' }}>+{Object.keys(tc.input_data).length - 3} more</span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Expected */}
                        <td style={{ padding: '10px 14px', color: '#344563', borderRight: '1px solid #EBECF0', maxWidth: 200 }}>
                          <div style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {tc.expected_outcome}
                          </div>
                        </td>

                        {/* Actual — editable */}
                        <td style={{ padding: '6px 14px', borderRight: '1px solid #EBECF0', background: 'rgba(255,250,230,0.4)', minWidth: 160 }}>
                          <EditableCell
                            value={tc.actual_outcome}
                            field="actual_outcome"
                            onChange={(v) => handleCellEdit(realIdx, 'actual_outcome', v)}
                          />
                        </td>

                        {/* Status — editable */}
                        <td style={{ padding: '6px 14px', borderRight: '1px solid #EBECF0', background: `${STATUS_STYLE[tc.status]?.bg}40` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <StatusIcon size={12} color={STATUS_STYLE[tc.status]?.color} />
                            <EditableCell
                              value={tc.status}
                              field="status"
                              onChange={(v) => handleCellEdit(realIdx, 'status', v)}
                            />
                          </div>
                        </td>

                        {/* Bug — editable */}
                        <td style={{ padding: '6px 14px', borderRight: '1px solid #EBECF0', minWidth: 130 }}>
                          <EditableCell
                            value={tc.bug_identified}
                            field="bug_identified"
                            onChange={(v) => handleCellEdit(realIdx, 'bug_identified', v)}
                          />
                        </td>

                        {/* Severity — editable */}
                        <td style={{ padding: '6px 14px', borderRight: '1px solid #EBECF0', background: tc.severity ? `${SEV_STYLE[tc.severity]?.bg}20` : 'transparent', minWidth: 100 }}>
                          {tc.severity ? (
                            <Badge label={tc.severity} bg={SEV_STYLE[tc.severity]?.bg} color={SEV_STYLE[tc.severity]?.color} />
                          ) : (
                            <EditableCell
                              value={tc.severity}
                              field="severity"
                              onChange={(v) => handleCellEdit(realIdx, 'severity', v)}
                            />
                          )}
                        </td>

                        {/* AI Suggestion */}
                        <td style={{ padding: '10px 14px', maxWidth: 200 }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                            <Zap size={12} color="#FFAB00" style={{ flexShrink: 0, marginTop: 2 }} />
                            <span style={{ color: '#42526E', fontSize: 11, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                              {tc.ai_suggestion}
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* ── Expanded detail row ── */}
                      {isExp && (
                        <tr style={{ background: '#F4F8FF' }}>
                          <td colSpan={11} style={{ padding: '20px 28px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                              {/* Steps */}
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: '#42526E', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                                  Test Steps
                                </div>
                                <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {(tc.steps || []).map((step, si) => (
                                    <li key={si} style={{ fontSize: 13, color: '#091E42', lineHeight: 1.5 }}>
                                      {step.replace(/^\d+\.\s*/, '')}
                                    </li>
                                  ))}
                                </ol>
                              </div>
                              {/* Input Data */}
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: '#42526E', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                                  Input Data
                                </div>
                                {Object.keys(tc.input_data || {}).length === 0 ? (
                                  <span style={{ color: '#97A0AF', fontStyle: 'italic', fontSize: 13 }}>No specific input data required.</span>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {Object.entries(tc.input_data).map(([k, v]) => (
                                      <div key={k} style={{ display: 'flex', gap: 10, fontSize: 13 }}>
                                        <span style={{ fontWeight: 700, color: '#6B778C', minWidth: 100 }}>{k}</span>
                                        <code style={{ background: '#EBECF0', padding: '1px 8px', borderRadius: 4, color: '#091E42', fontSize: 12 }}>{String(v)}</code>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {/* AI Suggestion full text */}
                                <div style={{ marginTop: 20 }}>
                                  <div style={{ fontSize: 11, fontWeight: 800, color: '#FFAB00', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <Zap size={12} /> AI QA Suggestion
                                  </div>
                                  <div style={{ fontSize: 13, color: '#42526E', background: 'white', border: '1px solid #DFE1E6', borderRadius: 8, padding: '12px 16px' }}>
                                    {tc.ai_suggestion}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Empty filter result */}
          {visible.length === 0 && (
            <div style={{ padding: 48, textAlign: 'center', color: '#97A0AF' }}>
              <Filter size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <div style={{ fontWeight: 700, marginBottom: 4 }}>No test cases match the current filter.</div>
              <button className="btn btn--secondary btn--sm" style={{ marginTop: 8 }} onClick={() => { setFilter('All'); setSearch(''); }}>Clear Filter</button>
            </div>
          )}

          {/* Table footer */}
          <div style={{ padding: '10px 20px', borderTop: '1px solid #EBECF0', background: '#F4F5F7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#6B778C' }}>
            <span>Click any row's arrow to expand steps · Yellow cells are editable</span>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn--secondary btn--sm" onClick={exportCSV}><Download size={12} /> CSV</button>
              <button className="btn btn--secondary btn--sm" onClick={copyJSON}><Copy size={12} /> JSON</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && testCases.length === 0 && (
        <div className="card" style={{ padding: '60px 40px', textAlign: 'center', border: '1px dashed #DFE1E6', background: '#FAFBFC' }}>
          <TableProperties size={52} color="#DFE1E6" style={{ margin: '0 auto 20px' }} />
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#091E42', margin: '0 0 8px' }}>No Test Cases Yet</h3>
          <p style={{ color: '#6B778C', fontSize: 14, maxWidth: 400, margin: '0 auto 24px' }}>
            Enter a requirement above and click <strong>Generate Test Cases</strong> to produce a full AI-driven QA test matrix.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', fontSize: 12, color: '#97A0AF' }}>
            {['Happy-path', 'Edge cases', 'Security checks', 'Boundary values'].map((l) => (
              <span key={l} style={{ background: '#EBECF0', padding: '4px 10px', borderRadius: 99 }}>{l}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TestCaseTable;
