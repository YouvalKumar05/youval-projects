// src/components/Common/Loader.jsx
import React from 'react';

export function Loader({ size = 'md', text = 'Loading...' }) {
  const sizes = { sm: '20px', md: '40px', lg: '60px' };
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      padding: '20px'
    }}>
      <div style={{
        width: sizes[size],
        height: sizes[size],
        border: '3px solid var(--border-color)',
        borderTop: '3px solid var(--primary-color)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }}></div>
      {text && <p style={{ color: 'var(--text-light)', margin: 0 }}>{text}</p>}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
