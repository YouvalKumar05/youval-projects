import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  MiniMap
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Plus, Save, CheckCircle, XCircle, AlertCircle, GitMerge, Zap, ArrowLeft, Settings, Trash, History, Bug, Bell, Mail, Monitor, Camera, Timer, Repeat, Wand2 } from 'lucide-react';
import { api } from '../../services/api';

// --- CUSTOM NODES ---
const TriggerNode = ({ data, selected }) => (
  <div style={{ background: 'white', borderRadius: 8, border: `2px solid ${selected ? '#0052CC' : '#6554C0'}`, padding: 12, minWidth: 200, boxShadow: selected ? '0 0 0 4px rgba(0,82,204,0.2)' : '0 4px 6px rgba(0,0,0,0.1)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div style={{ background: '#EAE6FF', borderRadius: '50%', display: 'flex', padding: 4 }}>
        <Zap size={14} color="#6554C0" />
      </div>
      <b style={{ fontSize: 11, color: '#6554C0', textTransform: 'uppercase' }}>Trigger</b>
      {data.status === 'running' && <span style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: '#FFAB00', animation: 'pulse 1.5s infinite' }} />}
    </div>
    <div style={{ fontSize: 13, fontWeight: 600, color: '#091E42' }}>{data.label}</div>
    {data.error && <div style={{ color: '#FF5630', fontSize: 10, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle size={10}/> {data.error}</div>}
    <Handle type="source" position={Position.Bottom} style={{ background: '#6554C0', width: 8, height: 8 }} />
  </div>
);

const ConditionNode = ({ data, selected }) => (
  <div style={{ background: 'white', borderRadius: 8, border: `2px solid ${selected ? '#0052CC' : '#FFAB00'}`, padding: 12, minWidth: 220, boxShadow: selected ? '0 0 0 4px rgba(0,82,204,0.2)' : '0 4px 6px rgba(0,0,0,0.1)' }}>
    <Handle type="target" position={Position.Top} style={{ background: '#FFAB00', width: 8, height: 8 }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div style={{ background: '#FFFAE6', borderRadius: '50%', display: 'flex', padding: 4 }}>
        <GitMerge size={14} color="#FFAB00" />
      </div>
      <b style={{ fontSize: 11, color: '#FFAB00', textTransform: 'uppercase' }}>Condition</b>
    </div>
    <div style={{ fontSize: 13, fontWeight: 600, color: '#091E42' }}>{data.label || "If..."}</div>
    
    <div style={{ marginTop: 8, fontSize: 11, color: '#6B778C', background: '#F4F5F7', padding: '4px 8px', borderRadius: 4 }}>
      {data.config?.rules?.length > 0 ? (
        data.config.rules.map((r, i) => (
          <div key={i}>{i > 0 ? <span style={{color: '#FFAB00', fontWeight: 'bold'}}> {data.config.logic} </span> : ''}{r.field} {r.operator} {r.value}</div>
        ))
      ) : "No rules defined"}
    </div>

    {data.error && <div style={{ color: '#FF5630', fontSize: 10, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle size={10}/> {data.error}</div>}
    
    <Handle type="source" position={Position.Bottom} id="true" style={{ left: '30%', background: '#36B37E', width: 8, height: 8 }} />
    <div style={{ position: 'absolute', bottom: -20, left: '20%', fontSize: 10, color: '#36B37E', fontWeight: 'bold' }}>TRUE</div>
    
    <Handle type="source" position={Position.Bottom} id="false" style={{ left: '70%', background: '#FF5630', width: 8, height: 8 }} />
    <div style={{ position: 'absolute', bottom: -20, left: '60%', fontSize: 10, color: '#FF5630', fontWeight: 'bold' }}>FALSE</div>
  </div>
);

const ActionNode = ({ data, selected }) => {
  const getIcon = () => {
    switch(data.config?.actionType) {
      case 'create_bug': return <Bug size={14} color="#36B37E" />;
      case 'notify_slack': return <Bell size={14} color="#36B37E" />;
      case 'send_email': return <Mail size={14} color="#36B37E" />;
      case 'log_dashboard': return <Monitor size={14} color="#36B37E" />;
      case 'capture_screenshot': return <Camera size={14} color="#36B37E" />;
      case 'retry_test': return <Repeat size={14} color="#36B37E" />;
      default: return <CheckCircle size={14} color="#36B37E" />;
    }
  };

  return (
    <div style={{ background: 'white', borderRadius: 8, border: `2px solid ${selected ? '#0052CC' : '#36B37E'}`, padding: 12, minWidth: 200, boxShadow: selected ? '0 0 0 4px rgba(0,82,204,0.2)' : '0 4px 6px rgba(0,0,0,0.1)' }}>
      <Handle type="target" position={Position.Top} style={{ background: '#36B37E', width: 8, height: 8 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ background: '#E3FCEF', borderRadius: '50%', display: 'flex', padding: 4 }}>
          {getIcon()}
        </div>
        <b style={{ fontSize: 11, color: '#36B37E', textTransform: 'uppercase' }}>Action</b>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#091E42' }}>{data.label || "Do..."}</div>
      {data.error && <div style={{ color: '#FF5630', fontSize: 10, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle size={10}/> {data.error}</div>}
      <Handle type="source" position={Position.Bottom} style={{ background: '#36B37E', width: 8, height: 8 }} />
    </div>
  );
};

const DelayNode = ({ data, selected }) => (
  <div style={{ background: 'white', borderRadius: 8, border: `2px solid ${selected ? '#0052CC' : '#42526E'}`, padding: 12, minWidth: 150, boxShadow: selected ? '0 0 0 4px rgba(0,82,204,0.2)' : '0 4px 6px rgba(0,0,0,0.1)' }}>
    <Handle type="target" position={Position.Top} style={{ background: '#42526E', width: 8, height: 8 }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div style={{ background: '#EBECF0', borderRadius: '50%', display: 'flex', padding: 4 }}>
        <Timer size={14} color="#42526E" />
      </div>
      <b style={{ fontSize: 11, color: '#42526E', textTransform: 'uppercase' }}>Delay</b>
    </div>
    <div style={{ fontSize: 13, fontWeight: 600, color: '#091E42' }}>{data.label || "Wait..."}</div>
    <div style={{ fontSize: 11, color: '#6B778C', marginTop: 4 }}>{data.config?.seconds || 0} seconds</div>
    <Handle type="source" position={Position.Bottom} style={{ background: '#42526E', width: 8, height: 8 }} />
  </div>
);

const RetryNode = ({ data, selected }) => (
  <div style={{ background: 'white', borderRadius: 8, border: `2px solid ${selected ? '#0052CC' : '#0052CC'}`, padding: 12, minWidth: 150, boxShadow: selected ? '0 0 0 4px rgba(0,82,204,0.2)' : '0 4px 6px rgba(0,0,0,0.1)' }}>
    <Handle type="target" position={Position.Top} style={{ background: '#0052CC', width: 8, height: 8 }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div style={{ background: '#DEEBFF', borderRadius: '50%', display: 'flex', padding: 4 }}>
        <Repeat size={14} color="#0052CC" />
      </div>
      <b style={{ fontSize: 11, color: '#0052CC', textTransform: 'uppercase' }}>Retry</b>
    </div>
    <div style={{ fontSize: 13, fontWeight: 600, color: '#091E42' }}>{data.label || "Retry Block"}</div>
    <div style={{ fontSize: 11, color: '#6B778C', marginTop: 4 }}>Max: {data.config?.maxRetries || 3} attempts</div>
    <Handle type="source" position={Position.Bottom} style={{ background: '#0052CC', width: 8, height: 8 }} />
  </div>
);

const nodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  action: ActionNode,
  delay: DelayNode,
  retry: RetryNode
};

const TRIGGER_EVENTS = ['test_completed', 'execution_failed', 'api_event', 'scheduled_time', 'manual'];
const ACTION_TYPES = ['create_bug', 'notify_slack', 'send_email', 'log_dashboard', 'capture_screenshot', 'retry_test', 'assign_to_role'];
const OPERATORS = ['==', '!=', '>', '<', '>=', '<=', 'contains', 'regex match'];

// --- TEMPLATES ---
const TEMPLATES = [
  {
    name: "Auto Bug on Failure",
    desc: "Creates a bug when test fails",
    nodes: [
      { id: 't1', type: 'trigger', position: { x: 250, y: 50 }, data: { label: 'When Test Completes', eventType: 'test_completed' } },
      { id: 'c1', type: 'condition', position: { x: 250, y: 150 }, data: { label: 'If Failed', config: { logic: 'AND', rules: [{ field: 'status', operator: '==', value: 'FAIL' }] } } },
      { id: 'a1', type: 'action', position: { x: 150, y: 350 }, data: { label: 'Create Jira Bug', config: { actionType: 'create_bug', severity: 'High', attachLogs: true } } },
      { id: 'a2', type: 'action', position: { x: 450, y: 350 }, data: { label: 'Notify Slack', config: { actionType: 'notify_slack', channel: '#qa-alerts' } } }
    ],
    edges: [
      { id: 'e1', source: 't1', target: 'c1', type: 'smoothstep' },
      { id: 'e2', source: 'c1', sourceHandle: 'true', target: 'a1', label: 'TRUE', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#8993A4' } },
      { id: 'e3', source: 'c1', sourceHandle: 'true', target: 'a2', label: 'TRUE', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#8993A4' } }
    ]
  }
];

const VisualBuilder = () => {
  const [view, setView] = useState('list');
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);

  // BUILDER STATE
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [workflowId, setWorkflowId] = useState(null);
  const [workflowName, setWorkflowName] = useState('New AutoQA Workflow');
  const [workflowDesc, setWorkflowDesc] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('config'); // config | insights | versions
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const reactFlowWrapper = useRef(null);

  useEffect(() => {
    if (view === 'list') loadWorkflows();
  }, [view]);

  // Real-time error detection
  useEffect(() => {
    if (view !== 'builder') return;
    setNodes(nds => nds.map(n => {
      let error = null;
      if (n.type === 'condition') {
        const hasOut = edges.some(e => e.source === n.id);
        if (!hasOut) error = "Missing action connection";
        if (!n.data.config?.rules || n.data.config.rules.length === 0) error = "Missing logic rules";
      }
      if (n.type === 'action') {
        const hasIn = edges.some(e => e.target === n.id);
        if (!hasIn) error = "Unconnected action";
      }
      if (n.data.error !== error) return { ...n, data: { ...n.data, error } };
      return n;
    }));
  }, [edges, view]);

  const loadWorkflows = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/workflows');
      if (res.status === 'success') setWorkflows(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (wf) => {
    setWorkflowId(wf.id);
    setWorkflowName(wf.name);
    setWorkflowDesc(wf.description || '');
    if (wf.ast_json && wf.ast_json.ui) {
      setNodes(wf.ast_json.ui.nodes || []);
      setEdges(wf.ast_json.ui.edges || []);
    } else {
      setNodes([]);
      setEdges([]);
    }
    setView('builder');
  };

  const handleCreateNew = () => {
    setWorkflowId(null);
    setWorkflowName('New Automation Workflow');
    setWorkflowDesc('');
    setNodes([{ id: 'trigger-1', type: 'trigger', position: { x: 250, y: 50 }, data: { label: 'When Test Completes', eventType: 'test_completed' } }]);
    setEdges([]);
    setView('builder');
  };

  const applyTemplate = (tpl) => {
    setNodes(tpl.nodes);
    setEdges(tpl.edges);
    setWorkflowName(tpl.name);
    setWorkflowDesc(tpl.desc);
    setView('builder');
  };

  const handleDelete = async (id) => {
    if(!window.confirm("Are you sure?")) return;
    try {
      await api.delete(`/api/workflows/${id}`);
      loadWorkflows();
    } catch(e) {}
  };

  const onConnect = useCallback((params) => {
    // Determine label based on source handle (true/false)
    let label = '';
    if (params.sourceHandle === 'true') label = 'TRUE';
    if (params.sourceHandle === 'false') label = 'FALSE';
    
    setEdges((eds) => addEdge({ ...params, label, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#8993A4' }, style: { stroke: '#8993A4', strokeWidth: 2 } }, eds));
  }, [setEdges]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow');
    if (!type) return;

    const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = {
      x: event.clientX - reactFlowBounds.left - 75,
      y: event.clientY - reactFlowBounds.top - 20,
    };

    const newNode = {
      id: `node_${Math.random().toString(36).substr(2, 9)}`,
      type,
      position,
      data: { label: type === 'condition' ? 'Condition' : 'Action', config: { rules: [{ field: 'status', operator: '==', value: '' }], logic: 'AND' } },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [setNodes]);

  const onNodeClick = (_, node) => setSelectedNode(node);

  const updateNodeData = (id, dataObj) => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, ...dataObj }} : n));
    setSelectedNode(prev => prev && prev.id === id ? { ...prev, data: { ...prev.data, ...dataObj } } : prev);
  };

  const addConditionRule = (nodeId) => {
    if (!selectedNode || selectedNode.id !== nodeId) return;
    const rules = selectedNode.data.config.rules || [];
    updateNodeData(nodeId, { config: { ...selectedNode.data.config, rules: [...rules, { field: '', operator: '==', value: '' }] } });
  };

  const updateConditionRule = (nodeId, index, key, value) => {
    if (!selectedNode || selectedNode.id !== nodeId) return;
    const rules = [...selectedNode.data.config.rules];
    rules[index][key] = value;
    updateNodeData(nodeId, { config: { ...selectedNode.data.config, rules } });
  };

  const removeConditionRule = (nodeId, index) => {
    if (!selectedNode || selectedNode.id !== nodeId) return;
    const rules = [...selectedNode.data.config.rules];
    rules.splice(index, 1);
    updateNodeData(nodeId, { config: { ...selectedNode.data.config, rules } });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        name: workflowName,
        description: workflowDesc,
        trigger_event: nodes.find(n => n.type === 'trigger')?.data?.eventType || 'auto',
        ast_json: { ui: { nodes, edges } }
      };
      if (workflowId) await api.put(`/api/workflows/${workflowId}`, payload);
      else {
         const res = await api.post(`/api/workflows`, payload);
         if (res.data?.workflow_id) setWorkflowId(res.data.workflow_id);
      }
      alert("Workflow Saved!");
    } catch(e) {
       alert("Failed to save workflow.");
    } finally {
      setIsSaving(false);
    }
  };

  // Smart suggestions
  const getSuggestions = () => {
    if (!selectedNode || selectedNode.type !== 'condition') return [];
    const hasFail = selectedNode.data.config?.rules?.some(r => r.value && r.value.toUpperCase() === 'FAIL');
    if (hasFail) {
      return [
        { label: 'Create Bug', actionType: 'create_bug' },
        { label: 'Capture Screenshot', actionType: 'capture_screenshot' },
        { label: 'Log Dashboard', actionType: 'log_dashboard' }
      ];
    }
    return [];
  };

  const addSuggestedAction = (sug) => {
    const actionId = `node_${Math.random().toString(36).substr(2, 9)}`;
    const newNode = {
      id: actionId,
      type: 'action',
      position: { x: selectedNode.position.x - 100 + Math.random()*200, y: selectedNode.position.y + 150 },
      data: { label: sug.label, config: { actionType: sug.actionType } }
    };
    setNodes(nds => nds.concat(newNode));
    setEdges(eds => eds.concat({ id: `e_${Math.random()}`, source: selectedNode.id, sourceHandle: 'true', target: actionId, label: 'TRUE', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#8993A4' }, style: { stroke: '#8993A4', strokeWidth: 2 } }));
  };

  const handleAIGenerate = async () => {
    if(!aiPrompt) return;
    setIsGenerating(true);
    try {
      const res = await api.post('/api/workflows/generate', { prompt: aiPrompt });
      if (res.status === 'success' && res.data?.ast_json?.ui) {
         setNodes(res.data.ast_json.ui.nodes || []);
         setEdges(res.data.ast_json.ui.edges || []);
         setWorkflowName('AI Generated Workflow');
         setAiPrompt('');
      } else {
         alert('Failed to parse AI response');
      }
    } catch(e) {
      alert('Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="page-container animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingBottom: 0 }}>
      {view === 'list' && (
        <div style={{ flex: 1, overflow: 'auto', paddingBottom: 40 }}>
           <div className="page-header" style={{ marginBottom: 20 }}>
            <div>
              <h1 className="page-title">Workflow Engine <span style={{fontSize: 12, background: '#EAE6FF', color: '#403294', padding: '2px 6px', borderRadius: 4, verticalAlign: 'middle', marginLeft: 8}}>AI-Powered</span></h1>
              <p className="page-subtitle">Design predictive, multi-branch automation flows</p>
            </div>
            <div className="page-actions">
              <button className="btn btn--primary" onClick={handleCreateNew}><Plus size={14} /> Create Workflow</button>
            </div>
          </div>

          {/* AI Prompt Generator */}
          <div style={{ background: 'linear-gradient(to right, #EAE6FF, #F4F5F7)', borderRadius: 12, padding: 24, marginBottom: 24, border: '1px solid #DFE1E6', display: 'flex', gap: 16, alignItems: 'center' }}>
             <Wand2 size={24} color="#6554C0" />
             <div style={{ flex: 1 }}>
               <h3 style={{ margin: '0 0 8px 0', fontSize: 16, color: '#091E42' }}>Generate workflow from text</h3>
               <div style={{ display: 'flex', gap: 12 }}>
                 <input 
                   className="form-input" 
                   style={{ flex: 1 }} 
                   placeholder="e.g., 'Create a bug when test fails and notify Slack'"
                   value={aiPrompt}
                   onChange={e => setAiPrompt(e.target.value)}
                 />
                 <button className="btn btn--primary" onClick={() => { handleCreateNew(); handleAIGenerate(); }} disabled={isGenerating}>
                    {isGenerating ? 'Generating...' : 'Generate Workflow'}
                 </button>
               </div>
             </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
            {TEMPLATES.map(tpl => (
              <div key={tpl.name} style={{ background: 'white', border: '1px solid #DFE1E6', borderRadius: 8, padding: 16, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }} onClick={() => applyTemplate(tpl)}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <Zap size={16} color="#FFAB00" />
                  <span style={{ fontWeight: 600, color: '#091E42' }}>{tpl.name}</span>
                </div>
                <p style={{ fontSize: 13, color: '#6B778C', margin: 0 }}>{tpl.desc}</p>
                <div style={{ marginTop: 12, fontSize: 12, color: '#0052CC', fontWeight: 600 }}>Use Template →</div>
              </div>
            ))}
          </div>
          
          <div className="card">
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6B778C' }}>Loading workflows...</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Workflow Name</th>
                    <th>Trigger</th>
                    <th>Nodes</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {workflows.length === 0 ? (
                    <tr><td colSpan="5" style={{ padding: 40, textAlign: 'center' }}>No workflows configured yet.</td></tr>
                  ) : workflows.map(wf => (
                    <tr key={wf.id}>
                      <td style={{ fontWeight: 600, color: '#091E42' }}>{wf.name}</td>
                      <td><span style={{ fontSize: 12, fontFamily: 'monospace', background: '#DFE1E6', padding: '2px 6px', borderRadius: 4 }}>{wf.trigger_event}</span></td>
                      <td>{wf.ast_json?.ui?.nodes?.length || 0} nodes</td>
                      <td><span style={{color: '#36B37E', fontWeight: 600, fontSize: 13}}>Active</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn--secondary btn--sm" onClick={() => handleEdit(wf)} style={{ marginRight: 8 }}>Edit</button>
                        <button className="icon-btn" onClick={() => handleDelete(wf.id)}><Trash size={15} color="#FF5630" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {view === 'builder' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
           <div className="page-header" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="icon-btn" onClick={() => setView('list')}><ArrowLeft size={20} /></button>
              <div>
                <h1 className="page-title">{workflowName}</h1>
                <p className="page-subtitle">Smart Visual Canvas</p>
              </div>
            </div>
            <div className="page-actions" style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn--secondary"><History size={14} /> Versions</button>
              <button className="btn btn--primary" onClick={handleSave} disabled={isSaving}>
                <Save size={14} /> {isSaving ? 'Saving...' : 'Deploy Workflow'}
              </button>
            </div>
          </div>
          
          <div style={{ display: 'flex', flex: 1, background: 'white', border: '1px solid #DFE1E6', borderRadius: 8, overflow: 'hidden', minHeight: 600 }}>
             
             {/* Component Sidebar */}
             <div style={{ width: 250, background: '#FAFBFC', borderRight: '1px solid #DFE1E6', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label className="form-label">Workflow Details</label>
                  <input className="form-input" placeholder="Workflow Name" value={workflowName} onChange={(e) => setWorkflowName(e.target.value)} style={{ marginBottom: 8 }} />
                  <textarea className="form-input" placeholder="Description" rows={3} value={workflowDesc} onChange={(e) => setWorkflowDesc(e.target.value)} style={{ resize: 'none' }}></textarea>
                </div>
                
                <hr style={{ border: 0, borderTop: '1px solid #DFE1E6' }}/>
                <label className="form-label" style={{ marginBottom: 0 }}>Drag Nodes to Canvas</label>
                
                <div draggable onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'condition'); }} style={{ background: 'white', border: '1px dashed #FFAB00', padding: 12, borderRadius: 8, cursor: 'grab', display: 'flex', alignItems: 'center', gap: 8 }}>
                   <GitMerge size={16} color="#FFAB00" />
                   <span style={{ fontSize: 13, fontWeight: 600, color: '#344563' }}>Condition Branch</span>
                </div>
                
                <div draggable onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'action'); }} style={{ background: 'white', border: '1px dashed #36B37E', padding: 12, borderRadius: 8, cursor: 'grab', display: 'flex', alignItems: 'center', gap: 8 }}>
                   <CheckCircle size={16} color="#36B37E" />
                   <span style={{ fontSize: 13, fontWeight: 600, color: '#344563' }}>Action Task</span>
                </div>
                
                <div draggable onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'delay'); }} style={{ background: 'white', border: '1px dashed #42526E', padding: 12, borderRadius: 8, cursor: 'grab', display: 'flex', alignItems: 'center', gap: 8 }}>
                   <Timer size={16} color="#42526E" />
                   <span style={{ fontSize: 13, fontWeight: 600, color: '#344563' }}>Delay</span>
                </div>

                <div draggable onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'retry'); }} style={{ background: 'white', border: '1px dashed #0052CC', padding: 12, borderRadius: 8, cursor: 'grab', display: 'flex', alignItems: 'center', gap: 8 }}>
                   <Repeat size={16} color="#0052CC" />
                   <span style={{ fontSize: 13, fontWeight: 600, color: '#344563' }}>Retry Logic</span>
                </div>
             </div>

             {/* Canvas */}
             <div style={{ flex: 1, position: 'relative' }} ref={reactFlowWrapper}>
                <ReactFlowProvider>
                   <ReactFlow
                     nodes={nodes}
                     edges={edges}
                     nodeTypes={nodeTypes}
                     onNodesChange={onNodesChange}
                     onEdgesChange={onEdgesChange}
                     onConnect={onConnect}
                     onDragOver={onDragOver}
                     onDrop={onDrop}
                     onNodeClick={onNodeClick}
                     onPaneClick={() => setSelectedNode(null)}
                     fitView
                     snapToGrid={true}
                     deleteKeyCode="Delete"
                   >
                     <Background color="#DFE1E6" gap={20} size={1} />
                     <Controls />
                     <MiniMap nodeColor={(n) => {
                       if(n.type === 'trigger') return '#6554C0';
                       if(n.type === 'condition') return '#FFAB00';
                       if(n.type === 'action') return '#36B37E';
                       return '#eee';
                     }} />
                   </ReactFlow>
                </ReactFlowProvider>
             </div>

             {/* Right Panel */}
             <div style={{ width: 320, background: 'white', borderLeft: '1px solid #DFE1E6', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', borderBottom: '1px solid #DFE1E6' }}>
                  <div onClick={() => setActiveTab('config')} style={{ flex: 1, padding: '12px', textAlign: 'center', cursor: 'pointer', fontWeight: 600, color: activeTab === 'config' ? '#0052CC' : '#6B778C', borderBottom: activeTab === 'config' ? '2px solid #0052CC' : '2px solid transparent' }}>Config</div>
                  <div onClick={() => setActiveTab('insights')} style={{ flex: 1, padding: '12px', textAlign: 'center', cursor: 'pointer', fontWeight: 600, color: activeTab === 'insights' ? '#0052CC' : '#6B778C', borderBottom: activeTab === 'insights' ? '2px solid #0052CC' : '2px solid transparent' }}>Insights</div>
                </div>
                
                <div style={{ padding: 16, flex: 1, overflowY: 'auto' }}>
                  {activeTab === 'config' && selectedNode ? (
                    <div>
                       <p style={{ fontSize: 12, color: '#6B778C', textTransform: 'uppercase', fontWeight: 700, marginBottom: 16 }}>{selectedNode.type} SETTINGS</p>
                       
                       {selectedNode.type === 'trigger' && (
                         <div className="form-group">
                           <label className="form-label">Trigger Event</label>
                           <select className="form-select" value={selectedNode.data.eventType || 'test_completed'} onChange={(e) => updateNodeData(selectedNode.id, { eventType: e.target.value, label: e.target.value })}>
                              {TRIGGER_EVENTS.map(evt => <option key={evt} value={evt}>{evt}</option>)}
                           </select>
                         </div>
                       )}

                       {selectedNode.type === 'condition' && (
                         <>
                           <div className="form-group">
                              <label className="form-label">Label</label>
                              <input className="form-input" value={selectedNode.data.label || ''} onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })} />
                           </div>
                           <div className="form-group">
                              <label className="form-label">Match Logic</label>
                              <div style={{display: 'flex', gap: 8}}>
                                <button className={`btn btn--sm ${selectedNode.data.config?.logic === 'AND' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => updateNodeData(selectedNode.id, { config: { ...selectedNode.data.config, logic: 'AND' }})}>AND</button>
                                <button className={`btn btn--sm ${selectedNode.data.config?.logic === 'OR' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => updateNodeData(selectedNode.id, { config: { ...selectedNode.data.config, logic: 'OR' }})}>OR</button>
                              </div>
                           </div>

                           <label className="form-label" style={{marginTop: 16}}>Rules</label>
                           {(selectedNode.data.config?.rules || []).map((rule, idx) => (
                             <div key={idx} style={{ background: '#F4F5F7', padding: 12, borderRadius: 8, marginBottom: 8, position: 'relative' }}>
                               {idx > 0 && <button className="icon-btn" style={{position: 'absolute', top: 4, right: 4}} onClick={() => removeConditionRule(selectedNode.id, idx)}><XCircle size={14} color="#FF5630"/></button>}
                               <input className="form-input" placeholder="Field (e.g. status, duration)" value={rule.field} onChange={e => updateConditionRule(selectedNode.id, idx, 'field', e.target.value)} style={{marginBottom: 8}} />
                               <select className="form-select" value={rule.operator} onChange={e => updateConditionRule(selectedNode.id, idx, 'operator', e.target.value)} style={{marginBottom: 8}}>
                                  {OPERATORS.map(o => <option key={o} value={o}>{o}</option>)}
                               </select>
                               <input className="form-input" placeholder="Value (e.g. FAIL, ${error})" value={rule.value} onChange={e => updateConditionRule(selectedNode.id, idx, 'value', e.target.value)} />
                             </div>
                           ))}
                           <button className="btn btn--secondary btn--sm" onClick={() => addConditionRule(selectedNode.id)}>+ Add Rule</button>
                           
                           {/* AI Suggestions */}
                           {getSuggestions().length > 0 && (
                             <div style={{ marginTop: 24, padding: 12, background: '#EAE6FF', borderRadius: 8, border: '1px solid #6554C0' }}>
                               <div style={{ fontSize: 12, fontWeight: 700, color: '#403294', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}><Zap size={12}/> AI Suggestions</div>
                               <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                 {getSuggestions().map(sug => (
                                   <button key={sug.label} className="btn btn--primary btn--sm" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => addSuggestedAction(sug)}>
                                     + Add "{sug.label}" Action
                                   </button>
                                 ))}
                               </div>
                             </div>
                           )}
                         </>
                       )}

                       {selectedNode.type === 'action' && (
                         <>
                           <div className="form-group">
                              <label className="form-label">Action Label</label>
                              <input className="form-input" value={selectedNode.data.label || ''} onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })} />
                           </div>
                           <div className="form-group">
                              <label className="form-label">Action Type</label>
                              <select className="form-select" value={selectedNode.data.config?.actionType || 'assign_to_role'} onChange={(e) => updateNodeData(selectedNode.id, { config: { ...selectedNode.data.config, actionType: e.target.value }})}>
                                {ACTION_TYPES.map(a => <option key={a} value={a}>{a.replace('_', ' ').toUpperCase()}</option>)}
                              </select>
                           </div>
                           
                           {/* Dynamic Forms */}
                           {selectedNode.data.config?.actionType === 'create_bug' && (
                             <>
                               <div className="form-group"><label className="form-label">Bug Title Template</label><input className="form-input" value="[Auto] Test Failed: ${test_name}" readOnly/></div>
                               <div className="form-group"><label className="form-label">Severity</label><select className="form-select"><option>High</option><option>Medium</option></select></div>
                               <div style={{display: 'flex', gap: 8, alignItems: 'center'}}><input type="checkbox" defaultChecked/> <span style={{fontSize: 13, color: '#091E42'}}>Attach Execution Logs</span></div>
                             </>
                           )}
                           {selectedNode.data.config?.actionType === 'notify_slack' && (
                             <div className="form-group"><label className="form-label">Slack Channel</label><input className="form-input" placeholder="#engineering-alerts" /></div>
                           )}
                           {selectedNode.data.config?.actionType === 'send_email' && (
                             <div className="form-group"><label className="form-label">Recipient</label><input className="form-input" placeholder="qa-team@company.com" /></div>
                           )}
                           {selectedNode.data.config?.actionType === 'retry_test' && (
                             <div className="form-group"><label className="form-label">Retry Count</label><input type="number" className="form-input" defaultValue={3} /></div>
                           )}
                           {selectedNode.data.config?.actionType === 'assign_to_role' && (
                             <div className="form-group"><label className="form-label">Target Role</label><input className="form-input" placeholder="e.g. QA, Developer" /></div>
                           )}
                         </>
                       )}

                      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #DFE1E6' }}>
                        <button className="btn btn--danger btn--full" style={{ justifyContent: 'center', background: 'transparent', color: '#FF5630', border: '1px solid #FF5630' }} onClick={() => setNodes(nds => nds.filter(n => n.id !== selectedNode.id))}>
                          Delete Node
                        </button>
                      </div>

                    </div>
                  ) : activeTab === 'config' ? (
                    <div style={{ textAlign: 'center', color: '#97A0AF', marginTop: 40 }}>
                       Click a node on the canvas to configure its properties.
                    </div>
                  ) : (
                    <div style={{ color: '#091E42' }}>
                      <p style={{ fontSize: 12, color: '#6B778C', textTransform: 'uppercase', fontWeight: 700, marginBottom: 16 }}>Live Execution Insights</p>
                      <div style={{ background: '#F4F5F7', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <b style={{fontSize: 13}}>Last Run:</b>
                          <span style={{fontSize: 12, color: '#36B37E', fontWeight: 'bold'}}>SUCCESS</span>
                        </div>
                        <div style={{fontSize: 12, color: '#6B778C'}}>Triggered by Test #4092</div>
                      </div>
                      <p style={{fontSize: 13, fontWeight: 600, marginTop: 16}}>Node Timeline:</p>
                      <ul style={{ paddingLeft: 16, fontSize: 13, color: '#42526E', margin: '8px 0' }}>
                        <li style={{marginBottom: 8}}>🟢 Trigger (0ms)</li>
                        <li style={{marginBottom: 8}}>🟢 Condition (12ms) -> Evaluated TRUE</li>
                        <li style={{marginBottom: 8}}>🟢 Create Bug (840ms) -> Bug DEV-102</li>
                        <li>🟢 Slack Notify (210ms)</li>
                      </ul>
                    </div>
                  )}
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisualBuilder;
