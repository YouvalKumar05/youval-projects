// src/components/Common/FileDropzone.jsx
import React, { useRef } from 'react';

export function FileDropzone({ onFilesSelected }) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const handleDragEnter = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (onFilesSelected) onFilesSelected(files);
  };

  const handleInputChange = (e) => {
    const files = Array.from(e.target.files);
    if (onFilesSelected) onFilesSelected(files);
  };

  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        border: isDragging ? '2px solid var(--primary-color)' : '2px dashed var(--border-color)',
        borderRadius: '8px',
        padding: '32px',
        textAlign: 'center',
        cursor: 'pointer',
        background: isDragging ? 'rgba(0, 180, 216, 0.05)' : 'transparent',
        transition: 'all 0.3s ease'
      }}
    >
      <div style={{ fontSize: '48px', marginBottom: '12px' }}>📤</div>
      <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-dark)' }}>Drop files here</h3>
      <p style={{ margin: 0, color: 'var(--text-light)', fontSize: '14px' }}>
        or click to select files (PDF, DOCX, XLSX, TXT)
      </p>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleInputChange}
        style={{ display: 'none' }}
        accept=".pdf,.docx,.xlsx,.txt"
      />
    </div>
  );
}
