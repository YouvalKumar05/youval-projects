// src/components/Common/TagPill.jsx
import React from 'react';

export function TagPill({ label, onRemove, color = 'primary', variant = 'solid' }) {
  const colors = {
    primary: { bg: 'var(--primary-color)', text: 'white' },
    success: { bg: 'rgb(81, 207, 102)', text: 'white' },
    error: { bg: 'rgb(255, 107, 107)', text: 'white' },
    warning: { bg: 'rgb(255, 212, 59)', text: 'white' },
    info: { bg: 'var(--border-color)', text: 'var(--text-dark)' }
  };

  const style = colors[color] || colors.primary;
  const bgColor = variant === 'solid' ? style.bg : `${style.bg}20`;
  const textColor = variant === 'solid' ? style.text : style.bg;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      background: bgColor,
      color: textColor,
      padding: '6px 12px',
      borderRadius: '16px',
      fontSize: '13px',
      fontWeight: '500',
      whiteSpace: 'nowrap'
    }}>
      {label}
      {onRemove && (
        <button
          onClick={onRemove}
          style={{
            background: 'none',
            border: 'none',
            color: textColor,
            cursor: 'pointer',
            fontSize: '16px',
            padding: 0,
            lineHeight: 1
          }}
        >
          ×
        </button>
      )}
    </span>
  );
}
