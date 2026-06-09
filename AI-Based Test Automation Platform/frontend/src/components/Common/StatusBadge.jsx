// src/components/Common/StatusBadge.jsx
import React from 'react';

export function StatusBadge({ status, label }) {
  const statusStyles = {
    success: { bg: 'rgba(81, 207, 102, 0.1)', color: 'rgb(81, 207, 102)', icon: '✓' },
    error: { bg: 'rgba(255, 107, 107, 0.1)', color: 'rgb(255, 107, 107)', icon: '✗' },
    warning: { bg: 'rgba(255, 212, 59, 0.1)', color: 'rgb(255, 212, 59)', icon: '!' },
    info: { bg: 'rgba(0, 180, 216, 0.1)', color: 'rgb(0, 180, 216)', icon: 'ℹ' },
    pending: { bg: 'rgba(180, 180, 180, 0.1)', color: 'rgb(180, 180, 180)', icon: '⏳' }
  };

  const style = statusStyles[status] || statusStyles.info;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      background: style.bg,
      color: style.color,
      padding: '6px 12px',
      borderRadius: '6px',
      fontSize: '12px',
      fontWeight: '600',
      whiteSpace: 'nowrap'
    }}>
      <span>{style.icon}</span>
      <span>{label}</span>
    </span>
  );
}
