import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Play, 
  FileText, 
  Search, 
  Cpu, 
  ArrowRight,
  Loader2,
  AlertTriangle
} from 'lucide-react';

const STEPS = [
  { id: 'input', label: 'Requirement Input', icon: FileText, desc: 'Capture raw requirements or documentation' },
  { id: 'analysis', label: 'AI Analysis', icon: Search, desc: 'Deep parsing and scenario extraction' },
  { id: 'generation', label: 'Test Generation', icon: Cpu, desc: 'Automated Playwright script creation' },
  { id: 'approval', label: 'Human Approval', icon: CheckCircle2, desc: 'Stakeholder review and sign-off' },
  { id: 'execution', label: 'Automated Run', icon: Play, desc: 'Cross-browser parallel execution' },
  { id: 'reporting', label: 'Quality Insights', icon: FileText, desc: 'Final PDF and data export' }
];

const WorkflowStatus = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [workflowData, setWorkflowData] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  // Simulate a pipeline run for visualization
  const startSimulation = () => {
    setIsRunning(true);
    setActiveStep(0);
    
    const interval = setInterval(() => {
      setActiveStep(prev => {
        if (prev >= STEPS.length - 1) {
          clearInterval(interval);
          setIsRunning(false);
          return prev;
        }
        return prev + 1;
      });
    }, 2000);
  };

  return (
    <div className="page-container animate-fade-in-up">
      <div className="page-header">
        <div>
          <h1 className="page-title">Workflow Orchestration</h1>
          <p className="page-subtitle">Visual pipeline monitor for end-to-end STLC automation</p>
        </div>
        <button 
          className="btn btn--primary" 
          onClick={startSimulation}
          disabled={isRunning}
        >
          {isRunning ? <><Loader2 className="animate-spin" size={15} /> Processing...</> : <><Play size={15} /> Trigger Pipeline</>}
        </button>
      </div>

      <div style={{ padding: '40px 0' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          position: 'relative',
          maxWidth: 1000,
          margin: '0 auto'
        }}>
          {/* Progress Line */}
          <div style={{ 
            position: 'absolute', 
            top: 24, 
            left: 0, 
            right: 0, 
            height: 2, 
            background: '#DFE1E6',
            zIndex: 0
          }} />
          <div style={{ 
            position: 'absolute', 
            top: 24, 
            left: 0, 
            width: `${(activeStep / (STEPS.length - 1)) * 100}%`, 
            height: 2, 
            background: '#0052CC',
            zIndex: 0,
            transition: 'width 0.5s ease'
          }} />

          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isCompleted = idx < activeStep;
            const isActive = idx === activeStep;
            
            return (
              <div key={step.id} style={{ 
                zIndex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                width: 120
              }}>
                <div style={{ 
                  width: 50, 
                  height: 50, 
                  borderRadius: '50%', 
                  background: isCompleted ? '#36B37E' : (isActive ? '#0052CC' : 'white'),
                  border: `2px solid ${isActive ? '#0052CC' : '#DFE1E6'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: (isCompleted || isActive) ? 'white' : '#6B778C',
                  boxShadow: isActive ? '0 0 0 4px rgba(0, 82, 204, 0.2)' : 'none',
                  transition: 'all 0.3s ease'
                }}>
                  {isCompleted ? <CheckCircle2 size={24} /> : <Icon size={24} />}
                </div>
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  <div style={{ 
                    fontSize: 13, 
                    fontWeight: 700, 
                    color: isActive ? '#0052CC' : '#172B4D',
                    marginBottom: 4
                  }}>
                    {step.label}
                  </div>
                  <div style={{ fontSize: 11, color: '#6B778C', lineHeight: 1.4 }}>
                    {step.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginTop: 40, padding: 32 }}>
        <div style={{ display: 'flex', gap: 32 }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 16, marginBottom: 16 }}>Live Pipeline Logs</h3>
            <div style={{ 
              background: '#091E42', 
              color: '#00FF00', 
              padding: 20, 
              borderRadius: 8, 
              fontFamily: 'monospace', 
              fontSize: 12,
              height: 200,
              overflowY: 'auto'
            }}>
              <div>[SYSTEM] Initializing pipeline context...</div>
              {activeStep >= 1 && <div>[AI] Analyzing requirements via Groq Llama-3... DONE</div>}
              {activeStep >= 2 && <div>[ENGINE] Generating 4 test cases for Project X... DONE</div>}
              {activeStep >= 3 && <div>[AUTH] Waiting for human approval... BYPASSED (Auto-Approve)</div>}
              {activeStep >= 4 && <div>[EXEC] Launching Playwright Chromium Headless...</div>}
              {activeStep >= 5 && <div>[REPORT] Exporting PDF artifact to /reports... DONE</div>}
              {isRunning && <div className="animate-pulse">_</div>}
            </div>
          </div>
          
          <div style={{ width: 300 }}>
             <h3 style={{ fontSize: 16, marginBottom: 16 }}>Health Check</h3>
             <div className="status-badge status-badge--success" style={{ marginBottom: 16 }}>SYSTEM HEALTHY</div>
             
             <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'AI Service', status: 'Online' },
                  { label: 'DB Cluster', status: 'Optimal' },
                  { label: 'Browser Grid', status: '2 Nodes Available' }
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid #F4F5F7', paddingBottom: 8 }}>
                    <span style={{ color: '#6B778C' }}>{s.label}</span>
                    <span style={{ fontWeight: 600 }}>{s.status}</span>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowStatus;
