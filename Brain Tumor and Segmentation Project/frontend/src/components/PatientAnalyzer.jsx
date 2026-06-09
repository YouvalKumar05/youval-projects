import React, { useState, useEffect, useCallback } from 'react';
import { Play, Layers, Activity, Sparkles, CheckCircle, Percent, Box, Eye, AlertCircle } from 'lucide-react';
import Brain3DViewer from './Brain3DViewer';

export default function PatientAnalyzer({ backendUrl, preselectedPatientId }) {
  const [patientsList, setPatientsList] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(preselectedPatientId || '');
  const [patientDetail, setPatientDetail] = useState(null);

  // Selected Slice State
  const [selectedSlice, setSelectedSlice] = useState(null);

  // View mode: '2d' | '3d'
  const [viewMode, setViewMode] = useState('2d');

  // Opacity & Layer Toggles
  const [gtOpacity, setGtOpacity] = useState(0.8);
  const [predOpacity, setPredOpacity] = useState(0.8);
  const [showGt, setShowGt] = useState(true);
  const [showPred, setShowPred] = useState(true);

  // Image loading states
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Prediction Results State
  const [runningInference, setRunningInference] = useState(false);
  const [predictionResults, setPredictionResults] = useState(null);
  const [predictionError, setPredictionError] = useState(null);

  // Load patients list for the left panel
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/patients?limit=100`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setPatientsList(data.patients || []);

        // If no preselected patient, select the first one in the list
        if (!preselectedPatientId && data.patients && data.patients.length > 0) {
          setSelectedPatientId(data.patients[0].patient_id);
        }
      } catch (err) {
        console.error('Error fetching patients list:', err);
      }
    };
    fetchPatients();
  }, [backendUrl, preselectedPatientId]);

  // Sync preselectedPatientId prop changes
  useEffect(() => {
    if (preselectedPatientId) {
      setSelectedPatientId(preselectedPatientId);
    }
  }, [preselectedPatientId]);

  // Load patient detail when selected patient changes
  useEffect(() => {
    if (!selectedPatientId) return;

    const fetchPatientDetail = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/patient/${selectedPatientId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setPatientDetail(data);

        // Clear previous prediction results
        setPredictionResults(null);
        setPredictionError(null);
        setImgError(false);
        setImgLoaded(false);

        // Select a slice with tumor if available, otherwise the middle slice
        if (data.slices && data.slices.length > 0) {
          const tumorSlice = data.slices.find(s => s.has_tumor);
          setSelectedSlice(tumorSlice || data.slices[Math.floor(data.slices.length / 2)]);
        }
      } catch (err) {
        console.error('Error fetching patient details:', err);
      }
    };
    fetchPatientDetail();
  }, [backendUrl, selectedPatientId]);

  // Handle running prediction on backend
  const handleRunInference = async () => {
    if (!selectedSlice) return;

    setRunningInference(true);
    setPredictionResults(null);
    setPredictionError(null);

    try {
      const res = await fetch(`${backendUrl}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_path: selectedSlice.image_path,
          mask_path: selectedSlice.mask_path
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setPredictionResults(data);
      setShowPred(true);
    } catch (err) {
      console.error('Error running model inference:', err);
      setPredictionError(err.message);
    } finally {
      setRunningInference(false);
    }
  };

  // Reset predictions when slice changes
  const handleSliceSelect = useCallback((slice) => {
    setSelectedSlice(slice);
    setPredictionResults(null);
    setPredictionError(null);
    setImgError(false);
    setImgLoaded(false);
  }, []);

  // Build image URL for backend endpoint
  const getImageUrl = useCallback((path) => {
    if (!path) return null;
    return `${backendUrl}/api/image?path=${encodeURIComponent(path)}`;
  }, [backendUrl]);

  const getMaskUrl = useCallback((path, color = 'f43f5e') => {
    if (!path || path === 'None') return null;
    return `${backendUrl}/api/mask?path=${encodeURIComponent(path)}&color=${color}`;
  }, [backendUrl]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="content-header">
        <h1>Interactive MRI Analyzer</h1>
        <p>Run classification and segmentation models, adjust visual overlays, and review validation metrics.</p>
      </div>

      <div className="analyzer-grid">
        {/* Left Panel: Patients Directory List */}
        <div className="patient-list-sidebar">
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>
            Cases Browser
          </h3>
          {patientsList.length === 0 ? (
            <div style={{ color: 'var(--text-dark)', fontSize: 12, padding: 12, textAlign: 'center' }}>
              <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, margin: '0 auto 8px' }}></div>
              Loading patients...
            </div>
          ) : patientsList.map((p) => (
            <button
              key={p.patient_id}
              className={`patient-item-btn ${selectedPatientId === p.patient_id ? 'selected' : ''}`}
              onClick={() => {
                setSelectedPatientId(p.patient_id);
              }}
            >
              <span className="patient-item-id" title={p.patient_id}>
                {p.patient_id}
              </span>
              <div className="patient-item-meta">
                <span>{p.total_slices} slices</span>
                <span style={{ color: p.tumor_slices > 0 ? '#fb7185' : '#34d399', fontWeight: 600 }}>
                  {p.tumor_slices > 0 ? `${p.tumor_slices} positive` : 'Healthy'}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Center Panel: MRI Image Canvas */}
        <div className="image-viewer-card">
          {patientDetail ? (
            <>
              {/* View Mode Toggle */}
              <div className="view-mode-toggle">
                <button
                  className={`view-mode-btn ${viewMode === '2d' ? 'active' : ''}`}
                  onClick={() => setViewMode('2d')}
                >
                  <Eye size={13} /> 2D Slice View
                </button>
                <button
                  className={`view-mode-btn ${viewMode === '3d' ? 'active' : ''}`}
                  onClick={() => setViewMode('3d')}
                >
                  <Box size={13} /> 3D Volume View
                </button>
              </div>

              {viewMode === '2d' ? (
                <>
                  {/* Slice Selector row */}
                  <div className="slice-selector-row">
                    {patientDetail.slices.map((slice) => (
                      <div
                        key={slice.slice_id}
                        className={`slice-thumb ${selectedSlice?.slice_id === slice.slice_id ? 'selected' : ''} ${slice.has_tumor ? 'has-tumor' : ''}`}
                        onClick={() => handleSliceSelect(slice)}
                        title={`Slice ${slice.slice_num}${slice.has_tumor ? ' — Tumor' : ''}`}
                      >
                        S{slice.slice_num}
                      </div>
                    ))}
                  </div>

                  {/* MRI Canvas Stack */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <span className="badge" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }}>
                      Patient: {selectedPatientId} — Slice #{selectedSlice?.slice_num}
                    </span>

                    <div className="mri-stack-container">
                      {/* Loading indicator */}
                      {selectedSlice && !imgLoaded && !imgError && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                          <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }}></div>
                        </div>
                      )}

                      {/* Error state */}
                      {imgError && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, color: 'var(--text-muted)', fontSize: 12, gap: 8 }}>
                          <AlertCircle size={28} style={{ color: 'var(--color-danger)' }} />
                          <span>Failed to load image</span>
                          <span style={{ fontSize: 10, color: 'var(--text-dark)' }}>Check backend is running at {backendUrl}</span>
                        </div>
                      )}

                      {/* Base MRI Image Layer */}
                      {selectedSlice && (
                        <img
                          key={selectedSlice.image_path}
                          src={getImageUrl(selectedSlice.image_path)}
                          className="mri-layer mri-base"
                          alt={`MRI Slice ${selectedSlice.slice_num}`}
                          onLoad={() => { setImgLoaded(true); setImgError(false); }}
                          onError={() => { setImgError(true); setImgLoaded(false); }}
                          style={{ opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s' }}
                        />
                      )}

                      {/* Ground Truth Mask Layer */}
                      {selectedSlice?.mask_path && showGt && selectedSlice.has_tumor && imgLoaded && (
                        <img
                          key={`gt-${selectedSlice.mask_path}`}
                          src={getMaskUrl(selectedSlice.mask_path, 'f43f5e')}
                          className="mri-layer mri-overlay-gt"
                          style={{ opacity: gtOpacity }}
                          alt="Ground Truth Overlay"
                        />
                      )}

                      {/* Predicted Mask Layer */}
                      {predictionResults?.segmentation?.mask_b64 && showPred && imgLoaded && (
                        <img
                          src={`data:image/png;base64,${predictionResults.segmentation.mask_b64}`}
                          className="mri-layer mri-overlay-pred"
                          style={{ opacity: predOpacity }}
                          alt="Model Prediction Overlay"
                        />
                      )}
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="viewer-controls">
                    {/* Sliders */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                      <div className="slider-group">
                        <div className="slider-label-row">
                          <span style={{ color: '#fb7185' }}>Ground Truth Mask Opacity</span>
                          <span>{Math.round(gtOpacity * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          className="slider-input"
                          value={gtOpacity}
                          onChange={(e) => setGtOpacity(parseFloat(e.target.value))}
                          disabled={!selectedSlice?.has_tumor}
                        />
                      </div>

                      <div className="slider-group">
                        <div className="slider-label-row">
                          <span style={{ color: '#22d3ee' }}>Prediction Mask Opacity</span>
                          <span>{Math.round(predOpacity * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          className="slider-input"
                          value={predOpacity}
                          onChange={(e) => setPredOpacity(parseFloat(e.target.value))}
                          disabled={!predictionResults}
                        />
                      </div>
                    </div>

                    {/* Toggles and Inference Button */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <div className="toggle-group">
                        <button
                          className={`toggle-btn ${showGt ? 'active gt' : ''}`}
                          onClick={() => setShowGt(!showGt)}
                          disabled={!selectedSlice?.has_tumor}
                        >
                          Show GT Mask (Pink)
                        </button>
                        <button
                          className={`toggle-btn ${showPred ? 'active pred' : ''}`}
                          onClick={() => setShowPred(!showPred)}
                          disabled={!predictionResults}
                        >
                          Show Predicted Mask (Cyan)
                        </button>
                      </div>

                      <button
                        className="btn-primary"
                        onClick={handleRunInference}
                        disabled={runningInference || !selectedSlice || imgError}
                      >
                        {runningInference ? (
                          <>
                            <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></div>
                            Processing Model...
                          </>
                        ) : (
                          <>
                            <Play size={14} fill="currentColor" />
                            Run Model Inference
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* 3D Volume View */
                <div style={{ width: '100%', flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <div style={{ marginBottom: 10, textAlign: 'center' }}>
                    <span className="badge" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }}>
                      Patient: {selectedPatientId} — 3D Brain Volume
                      {patientDetail.slices.some(s => s.has_tumor)
                        ? <span style={{ marginLeft: 8, color: '#ff4466' }}>● Tumor Detected</span>
                        : <span style={{ marginLeft: 8, color: '#10b981' }}>● No Tumor</span>}
                    </span>
                  </div>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <Brain3DViewer
                      backendUrl={backendUrl}
                      slices={patientDetail.slices}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="viewer-placeholder">
              <Layers size={48} />
              <p>Select a patient case from the browser panel to load MRI slices</p>
            </div>
          )}
        </div>

        {/* Right Panel: Analytics & Model Metrics */}
        <div className="analysis-panel">
          <div className="panel-section-title">Inference Analysis</div>

          {predictionError && (
            <div style={{ padding: 12, background: 'var(--color-danger-glow)', borderRadius: 8, border: '1px solid rgba(244,63,94,0.3)', fontSize: 12, color: '#fb7185' }}>
              <AlertCircle size={14} style={{ display: 'inline', marginRight: 6 }} />
              {predictionError}
            </div>
          )}

          {runningInference ? (
            <div className="spinner-container" style={{ padding: '60px 0' }}>
              <div className="spinner"></div>
              <p style={{ fontSize: 13, marginTop: 12 }}>Running Keras deep learning classifiers and U-Net segmenter on server...</p>
            </div>
          ) : predictionResults ? (
            <>
              {/* Classification Results */}
              <div className="prediction-gauge">
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>
                  Classifier Diagnosis (v10)
                  {predictionResults.classification.is_simulated && (
                    <span style={{ marginLeft: 6, color: 'var(--color-warning)', fontSize: 10 }}>SIMULATED</span>
                  )}
                </span>

                <span className={`gauge-percentage ${predictionResults.classification.has_tumor ? 'tumor' : 'healthy'}`}>
                  {predictionResults.classification.status}
                </span>

                <div className="prob-bar-container">
                  <div
                    className={`prob-bar ${predictionResults.classification.has_tumor ? 'tumor' : 'healthy'}`}
                    style={{ width: `${predictionResults.classification.confidence * 100}%` }}
                  ></div>
                </div>

                <div className="prob-labels">
                  <span>Healthy: {(predictionResults.classification.healthy_probability * 100).toFixed(1)}%</span>
                  <span>Tumor: {(predictionResults.classification.tumor_probability * 100).toFixed(1)}%</span>
                </div>
              </div>

              {/* Segmentation Results */}
              {predictionResults.classification.has_tumor ? (
                <>
                  <div className="panel-section-title" style={{ marginTop: 10 }}>U-Net Segmentation</div>
                  <div className="segmentation-metrics-box">
                    <div className="metric-item-small">
                      <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Sparkles size={14} className="logo-icon" />
                        Estimated Tumor Area
                      </span>
                      <span className="metric-item-val highlight">
                        {predictionResults.segmentation.tumor_area_pixels.toLocaleString()} px
                      </span>
                    </div>

                    <div className="metric-item-small">
                      <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Percent size={14} className="logo-icon" />
                        Brain Slice Coverage
                      </span>
                      <span className="metric-item-val">
                        {predictionResults.segmentation.tumor_area_percentage.toFixed(2)}%
                      </span>
                    </div>

                    {predictionResults.segmentation.dice_score !== null && (
                      <div
                        className="metric-sub"
                        style={{
                          marginTop: 10,
                          background: 'var(--color-success-glow)',
                          borderColor: 'rgba(16, 185, 129, 0.2)',
                          padding: 12
                        }}
                      >
                        <div className="metric-sub-val" style={{ color: 'var(--color-success)', fontSize: 22 }}>
                          {(predictionResults.segmentation.dice_score * 100).toFixed(1)}%
                        </div>
                        <div className="metric-sub-label" style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                          Validation Dice Coeff
                        </div>
                      </div>
                    )}

                    {predictionResults.segmentation.iou_score !== null && (
                      <div className="metric-item-small" style={{ borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Validation IoU Score</span>
                        <span className="metric-item-val" style={{ color: 'var(--color-success)' }}>
                          {predictionResults.segmentation.iou_score.toFixed(4)}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--text-dark)', fontSize: 13 }}>
                  <CheckCircle size={24} style={{ color: 'var(--color-success)', margin: '0 auto 8px', display: 'block' }} />
                  No tumor regions segmentable on healthy tissues.
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 10px', color: 'var(--text-dark)', fontSize: 13 }}>
              <Activity size={28} style={{ margin: '0 auto 12px', display: 'block' }} />
              Press &quot;Run Model Inference&quot; to analyze the active scan.
            </div>
          )}

          {/* 3D View shortcut hint */}
          {!runningInference && (
            <div style={{ marginTop: 'auto', padding: '12px 0 0', borderTop: '1px solid var(--border-color)' }}>
              <button
                className={`view-mode-btn ${viewMode === '3d' ? 'active' : ''}`}
                onClick={() => setViewMode(v => v === '2d' ? '3d' : '2d')}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Box size={13} /> {viewMode === '2d' ? 'Switch to 3D Brain Volume' : 'Switch to 2D Slice View'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
