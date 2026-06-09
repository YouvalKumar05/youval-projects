// src/components/Common/StepTimeline.jsx
import React from 'react';

export function StepTimeline({ steps, currentStep }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      padding: '20px',
      background: 'white',
      borderRadius: '8px',
      border: '1px solid var(--border-color)',
      overflowX: 'auto'
    }}>
      {steps.map((step, index) => (
        <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: currentStep >= index ? 'var(--primary-color)' : 'var(--border-color)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '600',
            fontSize: '14px',
            transition: 'all 0.3s ease'
          }}>
            {currentStep > index ? '✓' : index + 1}
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: '600', color: 'var(--text-dark)', fontSize: '13px' }}>
              {step.label}
            </p>
            {step.description && (
              <p style={{ margin: '4px 0 0 0', color: 'var(--text-light)', fontSize: '12px' }}>
                {step.description}
              </p>
            )}
          </div>
          {index < steps.length - 1 && (
            <div style={{
              width: '20px',
              height: '2px',
              background: currentStep > index ? 'var(--primary-color)' : 'var(--border-color)',
              transition: 'all 0.3s ease'
            }}></div>
          )}
        </div>
      ))}
    </div>
  );
}
