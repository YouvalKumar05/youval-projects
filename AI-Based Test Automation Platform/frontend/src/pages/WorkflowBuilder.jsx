import React, { useState, useEffect } from 'react';
import WorkflowControls from '../components/workflow/WorkflowControls';
import WorkflowCanvas from '../components/workflow/WorkflowCanvas';
import NodeDetailsPanel from '../components/workflow/NodeDetailsPanel';
import LogsPanel from '../components/workflow/LogsPanel';
import { api } from '../services/api';

const WorkflowBuilder = () => {
  const [workflowState, setWorkflowState] = useState({
    status: 'Idle',
    steps: [],
    current_step: null
  });
  const [selectedNode, setSelectedNode] = useState(null);
  const [isPolling, setIsPolling] = useState(true);

  // Poll for status updates
  useEffect(() => {
    let interval;
    if (isPolling) {
      fetchStatus();
      interval = setInterval(fetchStatus, 2000);
    }
    return () => clearInterval(interval);
  }, [isPolling]);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/api/workflows/pipeline/status');
      setWorkflowState(res);
      
      // Update selected node data if it's the one currently viewed
      if (selectedNode) {
        const updated = res.steps.find(s => s.id === selectedNode.id);
        if (updated) {
          setSelectedNode({ ...selectedNode, data: updated });
        }
      }
    } catch (err) {
      console.error("Workflow status fetch failed:", err);
    }
  };

  const handleRun = async () => {
    try {
      await api.post('/api/workflows/pipeline/run', { input: "Manual Trigger" });
      fetchStatus();
    } catch (err) {
      alert("Execution failed: " + err.message);
    }
  };

  const handleReset = async () => {
    try {
      await api.post('/api/workflows/pipeline/reset');
      fetchStatus();
    } catch (err) {
      alert("Reset failed: " + err.message);
    }
  };

  // Collect all logs from all steps for the global logs panel
  const allLogs = workflowState.steps.reduce((acc, step) => [...acc, ...step.logs], []);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh', 
      background: '#0a0a0c',
      overflow: 'hidden'
    }}>
      {/* Top Controls */}
      <WorkflowControls 
        onRun={handleRun} 
        onReset={handleReset} 
        status={workflowState.status} 
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Main Canvas Area */}
        <div style={{ flex: 1, position: 'relative' }}>
          <WorkflowCanvas 
            steps={workflowState.steps} 
            onNodeClick={setSelectedNode} 
          />
          
          {/* Bottom Console Panel */}
          <div style={{ 
            position: 'absolute', 
            bottom: 0, 
            left: 0, 
            right: 0, 
            height: '240px',
            zIndex: 10
          }}>
            <LogsPanel logs={allLogs} />
          </div>
        </div>

        {/* Right Sidebar Details */}
        <div style={{ 
          width: '350px', 
          background: '#141418', 
          borderLeft: '1px solid rgba(255,255,255,0.05)',
          zIndex: 20
        }}>
          <NodeDetailsPanel node={selectedNode} />
        </div>
      </div>

      <style>{`
        .animate-spin {
          animation: spin 2s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default WorkflowBuilder;
