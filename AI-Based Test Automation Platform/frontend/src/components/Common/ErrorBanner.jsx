// src/components/Common/ErrorBanner.jsx
import React from 'react';

export function ErrorBanner({ message, onClose }) {
  return (
    <div style={{
      background: 'rgba(255, 107, 107, 0.1)',
      border: '1px solid rgb(255, 107, 107)',
      borderRadius: '8px',
      padding: '12px 16px',
      marginBottom: '16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      color: 'rgb(255, 107, 107)',
      fontSize: '14px'
    }}>
      <span>❌ {message}</span>
      {onClose && (
        <button 
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgb(255, 107, 107)',
            cursor: 'pointer',
            fontSize: '18px'
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
