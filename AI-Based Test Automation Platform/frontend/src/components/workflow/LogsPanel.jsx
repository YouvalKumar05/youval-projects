import React from 'react';
import { Terminal, Eraser } from 'lucide-react';

const LogsPanel = ({ logs = [] }) => {
  return (
    <div style={{
      height: '100%',
      background: '#0a0a0c',
      color: '#00ff41',
      fontFamily: 'monospace',
      padding: '16px',
      fontSize: '0.85rem',
      overflowY: 'auto',
      borderTop: '1px solid rgba(255,255,255,0.05)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid #222', paddingBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#666' }}>
          <Terminal size={14} />
          <span style={{ textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 'bold' }}>Live Execution Console</span>
        </div>
        <Eraser size={14} style={{ cursor: 'pointer', color: '#444' }} />
      </div>
      
      {logs.length === 0 && <div style={{ color: '#444' }}>System idle. Ready for command...</div>}
      
      {logs.map((log, i) => (
        <div key={i} style={{ marginBottom: '4px', lineHeight: '1.4' }}>
          <span style={{ color: '#666' }}> {'>'} </span> {log}
        </div>
      ))}
    </div>
  );
};

export default LogsPanel;
