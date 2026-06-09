import React from 'react';
import { Play, Pause, RotateCcw, Box, Activity } from 'lucide-react';

const WorkflowControls = ({ onRun, onReset, status }) => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 24px',
      background: '#1a1a1f',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      color: '#fff'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Box size={20} color="#6366f1" />
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800' }}>AI Automation Orchestrator</h2>
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px', 
          background: 'rgba(255,255,255,0.05)', 
          padding: '4px 12px', 
          borderRadius: '20px',
          fontSize: '0.8rem'
        }}>
          <div style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            background: status === 'Running' ? '#f59e0b' : status === 'Completed' ? '#10b981' : '#64748b' 
          }} />
          {status}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button 
          onClick={onReset}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          <RotateCcw size={16} /> Reset
        </button>
        <button 
          onClick={onRun}
          disabled={status === 'Running'}
          style={{
            background: status === 'Running' ? '#333' : '#6366f1',
            border: 'none',
            color: '#fff',
            padding: '8px 24px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: '600',
            opacity: status === 'Running' ? 0.7 : 1
          }}
        >
          <Play size={16} fill="white" /> Run Workflow
        </button>
      </div>
    </div>
  );
};

export default WorkflowControls;
