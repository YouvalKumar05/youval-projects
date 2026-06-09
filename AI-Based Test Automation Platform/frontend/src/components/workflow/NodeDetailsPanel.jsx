import React from 'react';
import { Info, Code, FileJson, Terminal } from 'lucide-react';

const NodeDetailsPanel = ({ node, onClose }) => {
  if (!node) return (
    <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
      <Info size={40} style={{ marginBottom: '16px', opacity: 0.5 }} />
      <p>Select a node to view its configuration and output details.</p>
    </div>
  );

  const { data } = node;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>{data.label}</h3>
        <p style={{ margin: '4px 0 0', color: '#888', fontSize: '0.85rem' }}>Step Details & Configuration</p>
      </div>

      <div style={{ padding: '24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={{ color: '#666', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Status</label>
          <div style={{ color: data.status === 'Completed' ? '#10b981' : '#fff', fontWeight: 'bold', marginTop: '4px' }}>{data.status}</div>
        </div>

        <div>
          <label style={{ color: '#666', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileJson size={14} /> Output Data
          </label>
          <pre style={{ 
            background: '#0a0a0c', 
            padding: '12px', 
            borderRadius: '8px', 
            fontSize: '0.8rem', 
            color: '#aaa', 
            marginTop: '8px',
            overflowX: 'auto',
            border: '1px solid rgba(255,255,255,0.05)'
          }}>
            {JSON.stringify(data.output || { "message": "No output yet" }, null, 2)}
          </pre>
        </div>

        <div>
           <label style={{ color: '#666', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Terminal size={14} /> Step Logs
          </label>
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {data.logs && data.logs.length > 0 ? data.logs.map((log, i) => (
              <div key={i} style={{ fontSize: '0.75rem', color: '#888', fontStyle: 'italic' }}>{log}</div>
            )) : <div style={{ fontSize: '0.75rem', color: '#444' }}>Waiting for execution...</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NodeDetailsPanel;
