import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { CheckCircle2, Circle, Clock, AlertCircle, Loader2 } from 'lucide-react';

const NodeCard = ({ data }) => {
  const { label, status, icon: Icon, description } = data;

  const getStatusIcon = () => {
    switch (status) {
      case 'Completed': return <CheckCircle2 size={18} color="#10b981" />;
      case 'Running': return <Loader2 size={18} color="#f59e0b" className="animate-spin" />;
      case 'Failed': return <AlertCircle size={18} color="#ef4444" />;
      default: return <Clock size={18} color="#64748b" />;
    }
  };

  const getBorderColor = () => {
    switch (status) {
      case 'Completed': return '#10b981';
      case 'Running': return '#f59e0b';
      case 'Failed': return '#ef4444';
      default: return 'rgba(255,255,255,0.1)';
    }
  };

  return (
    <div style={{
      padding: '12px 16px',
      borderRadius: '12px',
      background: '#1e1e24',
      border: `1px solid ${getBorderColor()}`,
      minWidth: '180px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }}>
      <Handle type="target" position={Position.Left} style={{ background: '#555' }} />
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ 
            background: 'rgba(99, 102, 241, 0.1)', 
            padding: '6px', 
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {Icon && <Icon size={16} color="#6366f1" />}
          </div>
          <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{label}</span>
        </div>
        {getStatusIcon()}
      </div>

      <div style={{ fontSize: '0.75rem', color: '#888' }}>
        {status}
      </div>

      <Handle type="source" position={Position.Right} style={{ background: '#555' }} />
    </div>
  );
};

export default memo(NodeCard);
