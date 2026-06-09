import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, FileText, ChevronRight, AlertCircle, Plus, 
  Check, CheckCircle, Database, Activity, Globe, Smartphone, Settings,
  Loader2, Info, X, Zap, Cpu, Link as LinkIcon, Shield
} from 'lucide-react';
import { api } from '../services/api';

const CONNECTION_TYPES = [
  { id: 'Web App', icon: Globe, label: 'Web Application' },
  { id: 'REST API', icon: Cpu, label: 'REST API' },
  { id: 'Mobile', icon: Smartphone, label: 'Mobile App' }
];

const AUTH_TYPES = ['NONE', 'BASIC AUTH', 'TOKEN BASED', 'OAUTH 2.0'];
import { useWorkflow } from '../context/WorkflowContext';

const DataInput = () => {
  const { activeWorkflow, updateWorkflow } = useWorkflow();
  // Global Logic State
  const [connectionVerified, setConnectionVerified] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState(null);

  // Connection State
  const [connType, setConnType] = useState('Web App');
  const [authType, setAuthType] = useState('NONE');
  const [connConfig, setConnConfig] = useState({
    baseUrl: '',
    loginUrl: '',
    username: '',
    password: '',
    token: '',
    clientId: '',
    clientSecret: '',
    authUrl: '',
    endpointTestPath: '/'
  });

  // Requirement State
  const [inputMethod, setInputMethod] = useState('text'); // 'upload' or 'text'
  const [files, setFiles] = useState([]);
  const [requirementText, setRequirementText] = useState('');
  const [originalRequirement, setOriginalRequirement] = useState(''); // raw snapshot before refinement
  const [isRefined, setIsRefined] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [refining, setRefining] = useState(false);
  
  // Advanced Configuration State
  const [testCaseCount, setTestCaseCount] = useState(10);
  const [priorityLevel, setPriorityLevel] = useState('Medium');
  const [complexityLevel, setComplexityLevel] = useState('Intermediate');
  const [coverageLevel, setCoverageLevel] = useState('Standard');
  const [environment, setEnvironment] = useState('Production');
  const [testingTypes, setTestingTypes] = useState(['Functional Testing']);

  const TEST_TYPE_OPTIONS = [
    'Functional Testing', 'UI Testing', 'Navigation Testing', 'Smoke Testing', 
    'Regression Testing', 'Edge Case Testing', 'Negative Testing',
    'Unit Testing', 'Unit Integration Testing', 'System Testing', 'Accessibility Testing'
  ];

  const toggleTestingType = (type) => {
    setTestingTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const fileInputRef = useRef();

  const handleConnConfigChange = (e) => {
    const { name, value } = e.target;
    setConnConfig(prev => ({ ...prev, [name]: value }));
    setConnectionVerified(false);
  };

  const verifyConnection = async () => {
    setTestingConnection(true);
    setConnectionResult(null);
    try {
      // Endpoint updated to match backend refactor
      const response = await api.post('/api/system/connect', {
        type: connType === 'Web App' ? 'Web Application' : connType,
        auth_type: authType,
        credentials: { ...connConfig },
        base_url: connConfig.baseUrl
      });
      
      const resData = response.data;
      setConnectionResult(resData);
      if (resData.status === 'success') {
        setConnectionVerified(true);
      }
    } catch (err) {
      setConnectionResult({
        status: 'error',
        message: err.message || 'Connection failed',
        logs: 'A network error occurred. Please check the backend connectivity.'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleFileUpload = (e) => {
    const newFiles = Array.from(e.target.files).map(f => ({
      id: Math.random().toString(36).slice(2),
      name: f.name,
      size: (f.size / 1024).toFixed(1) + ' KB',
      file: f
    }));
    setFiles(prev => [...prev, ...newFiles]);
  };

  const refineRequirements = async () => {
    if (!requirementText) return;
    setRefining(true);
    try {
      // Always send the original raw text, not previously refined output
      const textToRefine = originalRequirement || requirementText;
      const response = await api.post('/api/ai/refine', { text: textToRefine });
      if (response.status === 'success' && response.data.refined_text) {
        if (!isRefined) {
          setOriginalRequirement(requirementText); // snapshot ONCE
        }
        setRequirementText(response.data.refined_text);
        setIsRefined(true);
      }
    } catch (err) {
      alert("Refinement failed: " + (err.message || "Unknown error"));
    } finally {
      setRefining(false);
    }
  };

  const resetRefinement = () => {
    if (originalRequirement) {
      setRequirementText(originalRequirement);
      setOriginalRequirement('');
      setIsRefined(false);
    }
  };

  const startAnalysis = async () => {
    if (!projectName) return alert("Please provide a project name");
    if (!requirementText && files.length === 0) return alert("Please provide requirements (either text or uploaded documents)");
    if (!connectionVerified) return alert("Please verify system connection first");

    setAnalyzing(true);
    try {
      if (files.length > 0) {
        const formData = new FormData();
        files.forEach(f => formData.append('files', f.file));
        await api.postForm('/api/upload', formData);
      }

      const res = await api.post('/api/requirements/analyze', {
        projectName,
        requirementText,
        connectionId: connectionResult?.id,
        baseUrl: connConfig.baseUrl,
        config: {
          testCaseCount,
          priorityLevel,
          complexityLevel,
          coverageLevel,
          environment,
          testingTypes
        }
      });

      if (res.status === 'success' && res.data?.analysis_id) {
        updateWorkflow({
          projectName,
          requirementText,
          analysisId: res.data.analysis_id,
          status: 'analyzing'
        });
        window.location.href = `/analysis-review/${res.data.analysis_id}`;
      }
    } catch (err) {
      alert("Analysis failed: " + (err.message || "Check permissions or backend logs"));
    } finally {
      setAnalyzing(false);
    }
  };

  const renderConnectionFields = () => {
    if (connType === 'Web App') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Base URL</label>
            <input className="form-input" name="baseUrl" value={connConfig.baseUrl} onChange={handleConnConfigChange} placeholder="https://myapp.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Login URL</label>
            <input className="form-input" name="loginUrl" value={connConfig.loginUrl} onChange={handleConnConfigChange} placeholder="https://myapp.com/login" />
          </div>
        </div>
      );
    }
    if (connType === 'REST API') {
      return (
        <div className="form-group">
          <label className="form-label">API Root Endpoint</label>
          <input className="form-input" name="baseUrl" value={connConfig.baseUrl} onChange={handleConnConfigChange} placeholder="https://api.myapp.com/v1" />
        </div>
      );
    }
    return (
      <div className="form-group">
        <label className="form-label">Bundle Identifier / App URL</label>
        <input className="form-input" name="baseUrl" value={connConfig.baseUrl} onChange={handleConnConfigChange} placeholder="com.example.app" />
      </div>
    );
  };

  return (
    <div className="page-container animate-fade-in" style={{ padding: '32px' }}>
      <div className="page-header" style={{ marginBottom: 40 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em', color: '#091E42' }}>Data Center</h1>
          <p className="page-subtitle" style={{ fontSize: 16, color: '#6B778C' }}>Sync requirements with your target system to trigger AI generation.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 40, alignItems: 'start' }}>
        
        {/* LEFT PANEL: REQUIREMENT INPUT */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #DFE1E6', boxShadow: '0 4px 20px rgba(9,30,66,0.08)' }}>
          <div style={{ background: '#F4F5F7', padding: '16px 24px', borderBottom: '1px solid #DFE1E6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', color: '#42526E', letterSpacing: '0.06em', margin: 0 }}>Requirement Input</h3>
            <div style={{ display: 'flex', background: '#EBECF0', borderRadius: 6, padding: 3 }}>
              <button 
                onClick={() => setInputMethod('text')}
                style={{ 
                  padding: '4px 12px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  background: inputMethod === 'text' ? 'white' : 'transparent',
                  color: inputMethod === 'text' ? '#0052CC' : '#6B778C',
                  boxShadow: inputMethod === 'text' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >TEXT</button>
              <button 
                onClick={() => setInputMethod('upload')}
                style={{ 
                  padding: '4px 12px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  background: inputMethod === 'upload' ? 'white' : 'transparent',
                  color: inputMethod === 'upload' ? '#0052CC' : '#6B778C',
                  boxShadow: inputMethod === 'upload' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >UPLOAD</button>
            </div>
          </div>
          
          <div style={{ display: 'flex' }}>
            {/* CONFIG SIDEBAR */}
            <div style={{ width: 260, background: '#F8F9FA', borderRight: '1px solid #DFE1E6', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#42526E', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Activity size={12} color="#0052CC" /> No. of Test Cases
                </label>
                <input 
                  type="number"
                  className="form-input" 
                  style={{ height: 36, fontSize: 13 }} 
                  value={testCaseCount} 
                  onChange={e => setTestCaseCount(parseInt(e.target.value) || 0)}
                  min="1"
                  max="100"
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#42526E', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Shield size={12} color="#6554C0" /> Priority Level
                </label>
                <select className="form-input" style={{ height: 36, fontSize: 13 }} value={priorityLevel} onChange={e => setPriorityLevel(e.target.value)}>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#42526E', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Settings size={12} color="#36B37E" /> Complexity Level
                </label>
                <select className="form-input" style={{ height: 36, fontSize: 13 }} value={complexityLevel} onChange={e => setComplexityLevel(e.target.value)}>
                  <option>Basic</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#42526E', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Activity size={12} color="#FF991F" /> Coverage Level
                </label>
                <select className="form-input" style={{ height: 36, fontSize: 13 }} value={coverageLevel} onChange={e => setCoverageLevel(e.target.value)}>
                  <option>Basic</option>
                  <option>Standard</option>
                  <option>High</option>
                  <option>Full</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#42526E', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Globe size={12} color="#0052CC" /> Environment
                </label>
                <select className="form-input" style={{ height: 36, fontSize: 13 }} value={environment} onChange={e => setEnvironment(e.target.value)}>
                  <option>Dev</option>
                  <option>QA</option>
                  <option>Staging</option>
                  <option>Production</option>
                </select>
              </div>

              <div style={{ marginTop: 12, padding: 16, background: 'rgba(0,82,204,0.05)', borderRadius: 12, border: '1px solid rgba(0,82,204,0.1)' }}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 13 }}>🎯 <strong>{testCaseCount} cases</strong></div>
                  <div style={{ fontSize: 13 }}>⚡ <strong>{priorityLevel} priority</strong></div>
                  <div style={{ fontSize: 13 }}>🔬 <strong>{complexityLevel} complexity</strong></div>
                  <div style={{ fontSize: 13 }}>📊 <strong>{coverageLevel} coverage</strong></div>
                  <div style={{ fontSize: 13 }}>🌐 <strong>{environment} env</strong></div>
                  <div style={{ fontSize: 13 }}>🧪 <strong>{testingTypes.length} test type{testingTypes.length !== 1 ? 's' : ''}</strong></div>
                </div>
              </div>
            </div>

            {/* MAIN CONTENT */}
            <div style={{ flex: 1, padding: 32 }}>
              <div className="form-group" style={{ marginBottom: 24 }}>
                <label className="form-label">Project Identity</label>
                <input 
                  className="form-input" 
                  placeholder="e.g. Authentication Flow v2.1" 
                  value={projectName} 
                  onChange={e => setProjectName(e.target.value)}
                  style={{ fontSize: 16, padding: '12px 16px' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#42526E', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Zap size={12} color="#0052CC" /> Testing Types <span style={{ fontWeight: 400, color: '#97A0AF' }}>(Select Multiple)</span>
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {TEST_TYPE_OPTIONS.map(type => (
                    <button
                      key={type}
                      onClick={() => toggleTestingType(type)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: '0.2s',
                        border: '1px solid',
                        borderColor: testingTypes.includes(type) ? '#0052CC' : '#DFE1E6',
                        background: testingTypes.includes(type) ? '#0052CC' : 'white',
                        color: testingTypes.includes(type) ? 'white' : '#42526E'
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {inputMethod === 'text' ? (
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    Requirements Description
                    <span style={{ fontSize: 10, color: '#97A0AF' }}>Simple English preferred</span>
                  </label>
                  <textarea 
                    className="form-textarea" 
                    rows={8} 
                    placeholder="Describe what needs to be tested in simple English..."
                    value={requirementText}
                    onChange={(e) => setRequirementText(e.target.value)}
                    style={{ background: '#FAFBFC', border: '1px solid #DFE1E6' }}
                  />
                  <button 
                    className="btn btn--subtle" 
                    onClick={refineRequirements}
                    disabled={refining || !requirementText || isRefined}
                    title={isRefined ? 'Already refined — reset to re-refine' : 'Use AI to improve your requirement text'}
                    style={{ marginTop: 12, width: '100%', justifyContent: 'center', border: `1px dashed ${isRefined ? '#36B37E' : '#0052CC'}`, color: isRefined ? '#36B37E' : '#0052CC', opacity: isRefined ? 0.7 : 1 }}
                  >
                    {refining ? <Loader2 size={14} className="animate-spin" /> : isRefined ? <CheckCircle size={14} /> : <Zap size={14} />}
                    {refining ? ' Refining with AI...' : isRefined ? ' Requirement Refined ✓' : ' Use AI to refine suggestion'}
                  </button>
                  {isRefined && (
                    <button
                      onClick={resetRefinement}
                      style={{ marginTop: 6, width: '100%', background: 'none', border: 'none', color: '#97A0AF', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      ↩ Reset to original input
                    </button>
                  )}
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  style={{ 
                    border: '2px dashed #C1C7D0', borderRadius: 12, padding: '40px 20px', textAlign: 'center', cursor: 'pointer',
                    background: '#FAFBFC', transition: 'border-color 0.2s'
                  }}
                >
                  <input type="file" multiple ref={fileInputRef} hidden onChange={handleFileUpload} />
                  <Upload size={32} color="#0052CC" style={{ margin: '0 auto 16px' }} />
                  <h4 style={{ fontWeight: 700, color: '#091E42' }}>Drop specification files here</h4>
                  <p style={{ fontSize: 13, color: '#6B778C' }}>Supports PDF, DOCX, JSON, YAML (Max 20MB)</p>
                  {files.length > 0 && (
                    <div style={{ marginTop: 24, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {files.map(f => (
                        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'white', padding: '8px 12px', borderRadius: 6, border: '1px solid #DFE1E6' }}>
                          <FileText size={14} color="#0052CC" />
                          <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{f.name}</span>
                          <X size={14} color="#FF5630" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setFiles(prev => prev.filter(x => x.id !== f.id)); }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button 
                className="btn btn--primary" 
                style={{ marginTop: 32, width: '100%', height: 48, fontSize: 16, borderRadius: 8 }}
                onClick={startAnalysis}
                disabled={analyzing || (!requirementText && files.length === 0)}
              >
                {analyzing ? <Loader2 className="animate-spin" size={20} /> : <Activity size={20} />}
                {analyzing ? ' Processing AI Analysis...' : ' Start AI Analysis'}
                {!analyzing && <ChevronRight size={20} style={{ marginLeft: 'auto' }} />}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: SYSTEM CONNECTION */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #DFE1E6', background: 'white', boxShadow: '0 4px 20px rgba(9,30,66,0.08)' }}>
          <div style={{ background: '#091E42', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Database size={16} color="white" />
            <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', color: 'white', letterSpacing: '0.06em', margin: 0 }}>System Connection</h3>
          </div>
          <div style={{ padding: 32 }}>
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label className="form-label">Connection Type</label>
              <div style={{ display: 'flex', gap: 12 }}>
                {CONNECTION_TYPES.map(t => (
                  <button 
                    key={t.id}
                    onClick={() => setConnType(t.id)}
                    style={{ 
                      flex: 1, padding: '12px 8px', borderRadius: 8, border: `1px solid ${connType === t.id ? '#0052CC' : '#DFE1E6'}`,
                      background: connType === t.id ? '#F0F4FF' : 'white', cursor: 'pointer', transition: '0.2s',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6
                    }}
                  >
                    <t.icon size={18} color={connType === t.id ? '#0052CC' : '#6B778C'} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: connType === t.id ? '#0052CC' : '#42526E' }}>{t.id}</span>
                  </button>
                ))}
              </div>
            </div>

            {renderConnectionFields()}

            <div className="form-group" style={{ marginTop: 20 }}>
              <label className="form-label">Authentication Strategy</label>
              <select className="form-select" value={authType} onChange={e => setAuthType(e.target.value)}>
                {AUTH_TYPES.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>

            {authType !== 'NONE' && (
              <div style={{ marginTop: 16, padding: 16, background: '#F4F5F7', borderRadius: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11 }}>Username / Client ID</label>
                    <input className="form-input" name="username" value={connConfig.username} onChange={handleConnConfigChange} style={{ height: 36, fontSize: 13 }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11 }}>Password / Secret</label>
                    <input className="form-input" type="password" name="password" value={connConfig.password} onChange={handleConnConfigChange} style={{ height: 36, fontSize: 13 }} />
                  </div>
                </div>
              </div>
            )}

            <button 
              className={`btn btn--${connectionVerified ? 'success' : 'secondary'}`}
              style={{ width: '100%', marginTop: 32, height: 44, fontWeight: 700 }}
              onClick={verifyConnection}
              disabled={testingConnection}
            >
              {testingConnection ? <Loader2 size={16} className="animate-spin" /> : connectionVerified ? <Check size={16} /> : <Zap size={16} />}
              {testingConnection ? ' Running Connection Audit...' : connectionVerified ? ' System Linked & Verified' : 'Verify Connection'}
            </button>

            {connectionResult && (
              <div style={{ 
                marginTop: 20, padding: 20, borderRadius: 12, 
                background: connectionResult.status === 'success' ? '#E3FCEF' : '#FFEBE6',
                border: `1px solid ${connectionResult.status === 'success' ? '#36B37E' : '#FF5630'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: connectionResult.status === 'success' ? '#006644' : '#BF2600' }}>
                    STATUS: {connectionResult.status.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#6B778C' }}>Latency: {connectionResult.response_time_ms}ms</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#091E42', marginBottom: 8 }}>{connectionResult.message}</div>
                <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#42526E', background: 'rgba(255,255,255,0.4)', padding: 8, borderRadius: 4, whiteSpace: 'pre-wrap' }}>
                  {connectionResult.logs}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataInput;
