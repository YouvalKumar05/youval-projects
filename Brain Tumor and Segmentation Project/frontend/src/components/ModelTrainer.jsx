import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, StopCircle, RefreshCw, Cpu, Database, 
  Settings, Award, HelpCircle, Activity, ChevronRight, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend 
} from 'recharts';

export default function ModelTrainer({ backendUrl }) {
  // Config state
  const [backbone, setBackbone] = useState('efficientnet_v2_b0');
  const [numSlices, setNumSlices] = useState(1000);
  const [epochs, setEpochs] = useState(10);
  const [lr, setLr] = useState(1e-4);
  const [lossFunction, setLossFunction] = useState('focal_loss');

  // Backend status metadata
  const [maxSlices, setMaxSlices] = useState(7859);
  const [trainingState, setTrainingState] = useState({
    is_running: false,
    status: 'Idle',
    current_epoch: 0,
    total_epochs: 5,
    previously_completed: 0,
    latest_metrics: {},
    history: [],
    error_message: null
  });

  const [loadingConfig, setLoadingConfig] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // SSE connection reference
  const eventSourceRef = useRef(null);
  const logsEndRef = useRef(null);

  // Fetch initial status and max slices
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        // Fetch stats to find total slices
        const resStats = await fetch(`${backendUrl}/api/overview`);
        if (resStats.ok) {
          const stats = await resStats.json();
          if (stats?.stats?.total_slices) {
            setMaxSlices(stats.stats.total_slices);
            setNumSlices(Math.min(1000, stats.stats.total_slices));
          }
        }

        // Fetch current trainer status
        const resTrainer = await fetch(`${backendUrl}/api/train/status`);
        if (resTrainer.ok) {
          const trainerStatus = await resTrainer.json();
          setTrainingState(trainerStatus);
          
          // If trainer was already running, restore configuration selections
          if (trainerStatus.is_running) {
            setBackbone(trainerStatus.backbone || 'efficientnet_v2_b0');
            setNumSlices(trainerStatus.num_slices || 1000);
            setEpochs(trainerStatus.total_epochs || 10);
            setLr(trainerStatus.learning_rate || 1e-4);
            setLossFunction(trainerStatus.loss_function || 'focal_loss');
          }
        }
      } catch (err) {
        console.error('Error fetching trainer state:', err);
      } finally {
        setLoadingConfig(false);
      }
    };

    fetchStatus();
  }, [backendUrl]);

  // Handle SSE Event Streaming
  useEffect(() => {
    // Connect to SSE endpoint to stream updates live
    eventSourceRef.current = new EventSource(`${backendUrl}/api/train/events`);

    eventSourceRef.current.onmessage = (event) => {
      try {
        const state = JSON.parse(event.data);
        setTrainingState(state);
      } catch (err) {
        console.error('Error parsing SSE event data:', err);
      }
    };

    eventSourceRef.current.onerror = (err) => {
      console.warn('SSE connection lost. Reconnecting...');
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [backendUrl]);

  // Scroll training console to bottom when history updates
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [trainingState.history]);

  // Start training
  const handleStartTraining = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/train/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backbone,
          num_slices: parseInt(numSlices),
          epochs: parseInt(epochs),
          learning_rate: parseFloat(lr),
          loss_function: lossFunction
        })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Failed to start training');
      }
    } catch (err) {
      console.error('Error starting training:', err);
      alert('Network error starting training');
    } finally {
      setActionLoading(false);
    }
  };

  // Stop / Pause training
  const handleStopTraining = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/train/stop`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Failed to stop training');
      }
    } catch (err) {
      console.error('Error stopping training:', err);
      alert('Network error stopping training');
    } finally {
      setActionLoading(false);
    }
  };

  // Reload model parameters to inference session
  const handleReloadModels = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/train/reload`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.models_loaded) {
        alert('Trained model parameters loaded into clinical inference session successfully!');
      } else {
        alert('Failed to reload parameters: ' + (data.model_loading_error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error reloading models:', err);
      alert('Network error reloading models');
    } finally {
      setActionLoading(false);
    }
  };

  if (loadingConfig) {
    return (
      <div className="spinner-container">
        <div className="spinner"></div>
        <p>Connecting to backend training engine...</p>
      </div>
    );
  }

  // Calculate percentage of slices used
  const percentSlicesUsed = ((numSlices / maxSlices) * 100).toFixed(1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 20 }}>
      <div className="content-header" style={{ marginBottom: 16 }}>
        <h1>AI Model Calibration & Training</h1>
        <p>Deploy state-of-the-art backbones, select dataset training splits, resume epochs, and monitor live convergence logs.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, flex: 1, minHeight: 0 }}>
        
        {/* Left: Configuration Panel */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 18, height: 'fit-content' }}>
          <h2 className="card-title" style={{ fontSize: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 10, marginBottom: 4 }}>
            <Settings size={18} className="logo-icon" />
            Calibration Profile
          </h2>

          {/* Model Backbone selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>Backbone Architecture</label>
            <select 
              value={backbone} 
              onChange={(e) => setBackbone(e.target.value)}
              disabled={trainingState.is_running}
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                padding: '10px 12px',
                borderRadius: 'var(--border-radius)',
                outline: 'none',
                cursor: trainingState.is_running ? 'not-allowed' : 'pointer'
              }}
            >
              <option value="efficientnet_v2_b0">EfficientNetV2-B0 (Recommended)</option>
              <option value="densenet121">DenseNet-121 (High Dense Layers)</option>
              <option value="resnet50_v2">ResNet-50 v2 (Enhanced Gradients)</option>
              <option value="resnet50">ResNet-50 + CBAM Attention (Baseline)</option>
            </select>
          </div>

          {/* Training Slices Subset Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <label style={{ fontWeight: 500, color: 'var(--text-muted)' }}>MRI Scans Subset</label>
              <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{numSlices} / {maxSlices} slices ({percentSlicesUsed}%)</span>
            </div>
            <input 
              type="range" 
              min="100" 
              max={maxSlices} 
              step="50"
              value={numSlices}
              onChange={(e) => setNumSlices(parseInt(e.target.value))}
              disabled={trainingState.is_running}
              style={{
                accentColor: 'var(--color-primary)',
                cursor: trainingState.is_running ? 'not-allowed' : 'pointer',
                marginTop: 4
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-dark)' }}>
              Resume next run trains selectively on these slices preserving class weights.
            </span>
          </div>

          {/* Epochs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>Epochs to Train</label>
            <input 
              type="number"
              min="1"
              max="100"
              value={epochs}
              onChange={(e) => setEpochs(Math.max(1, parseInt(e.target.value) || 1))}
              disabled={trainingState.is_running}
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                padding: '10px 12px',
                borderRadius: 'var(--border-radius)',
                outline: 'none'
              }}
            />
          </div>

          {/* Learning Rate */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>Learning Rate</label>
            <select
              value={lr}
              onChange={(e) => setLr(parseFloat(e.target.value))}
              disabled={trainingState.is_running}
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                padding: '10px 12px',
                borderRadius: 'var(--border-radius)',
                outline: 'none',
                cursor: trainingState.is_running ? 'not-allowed' : 'pointer'
              }}
            >
              <option value={1e-4}>1e-4 (Warmup / Frozen)</option>
              <option value={5e-5}>5e-5 (Medium Fine-tune)</option>
              <option value={1e-5}>1e-5 (Deep Fine-tune)</option>
            </select>
          </div>

          {/* Loss Function */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>Loss Function</label>
            <select
              value={lossFunction}
              onChange={(e) => setLossFunction(e.target.value)}
              disabled={trainingState.is_running}
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                padding: '10px 12px',
                borderRadius: 'var(--border-radius)',
                outline: 'none',
                cursor: trainingState.is_running ? 'not-allowed' : 'pointer'
              }}
            >
              <option value="focal_loss">Optimized Focal Loss (α=0.60, γ=1.5)</option>
              <option value="crossentropy">Categorical Crossentropy</option>
            </select>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {!trainingState.is_running ? (
              <button 
                onClick={handleStartTraining}
                disabled={actionLoading}
                className="action-btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px',
                  borderRadius: 'var(--border-radius)',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  border: 'none',
                  background: 'linear-gradient(135deg, var(--color-primary) 0%, #0284c7 100%)',
                  color: '#fff',
                  boxShadow: '0 4px 12px rgba(56, 189, 248, 0.3)'
                }}
              >
                <Play size={16} /> 
                {trainingState.previously_completed > 0 ? 'Resume Training' : 'Start Model Calibration'}
              </button>
            ) : (
              <button 
                onClick={handleStopTraining}
                disabled={actionLoading}
                className="action-btn-danger"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px',
                  borderRadius: 'var(--border-radius)',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  border: 'none',
                  background: 'linear-gradient(135deg, var(--color-danger) 0%, #be123c 100%)',
                  color: '#fff',
                  boxShadow: '0 4px 12px rgba(244, 63, 94, 0.3)'
                }}
              >
                <StopCircle size={16} /> Interrupt / Pause
              </button>
            )}

            {!trainingState.is_running && trainingState.previously_completed > 0 && (
              <button 
                onClick={handleReloadModels}
                disabled={actionLoading}
                className="action-btn-success"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '11px',
                  borderRadius: 'var(--border-radius)',
                  fontWeight: 500,
                  fontSize: 13,
                  cursor: 'pointer',
                  border: '1px solid var(--color-success)',
                  background: 'var(--color-success-glow)',
                  color: '#a7f3d0'
                }}
              >
                <RefreshCw size={14} /> Push to Active Inference
              </button>
            )}
          </div>
        </div>

        {/* Right: Monitoring & History Plots */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minHeight: 0 }}>
          
          {/* Status Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="metric-icon-container primary" style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
                <Activity size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Calibration Status</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: trainingState.is_running ? 'var(--color-primary)' : 'var(--text-main)' }}>
                  {trainingState.status}
                </span>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="metric-icon-container warning" style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-warning-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-warning)' }}>
                <Cpu size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Progress Epochs</span>
                <span style={{ fontSize: 16, fontWeight: 700 }}>
                  {trainingState.is_running 
                    ? `${trainingState.current_epoch} / ${trainingState.total_epochs}`
                    : `${trainingState.previously_completed} epochs completed`
                  }
                </span>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="metric-icon-container success" style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-success-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-success)' }}>
                <Award size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Latest Val Accuracy</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-success)' }}>
                  {trainingState.latest_metrics?.val_accuracy 
                    ? `${(trainingState.latest_metrics.val_accuracy * 100).toFixed(2)}%`
                    : 'N/A'
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Live Progress Bar when running */}
          {trainingState.is_running && (
            <div className="glass-card" style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ fontWeight: 500 }}>Epoch {trainingState.current_epoch} progress</span>
                <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                  {((trainingState.current_epoch / trainingState.total_epochs) * 100).toFixed(0)}%
                </span>
              </div>
              <div style={{ width: '100%', height: 6, background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden' }}>
                <div 
                  style={{ 
                    width: `${(trainingState.current_epoch / trainingState.total_epochs) * 100}%`, 
                    height: '100%', 
                    background: 'linear-gradient(90deg, var(--color-primary) 0%, #10b981 100%)', 
                    transition: 'width 0.4s ease' 
                  }}
                />
              </div>
            </div>
          )}

          {/* Live Metrics Convergence Plots */}
          {trainingState.history && trainingState.history.length > 0 ? (
            <div className="glass-card" style={{ flex: 1, minHeight: 280, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h3 className="card-title" style={{ fontSize: 14 }}>
                <Activity size={16} className="logo-icon" /> Live Convergence Plot
              </h3>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="95%">
                  <LineChart data={trainingState.history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="epoch" stroke="var(--text-dark)" />
                    <YAxis stroke="var(--text-dark)" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#131b2e', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="accuracy" 
                      name="Train Acc" 
                      stroke="var(--color-primary)" 
                      strokeWidth={2}
                      dot={{ r: 3 }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="val_accuracy" 
                      name="Val Acc" 
                      stroke="var(--color-success)" 
                      strokeWidth={2}
                      dot={{ r: 3 }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="loss" 
                      name="Train Loss" 
                      stroke="#fb7185" 
                      strokeDasharray="5 5"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="val_loss" 
                      name="Val Loss" 
                      stroke="#f59e0b" 
                      strokeDasharray="5 5"
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="glass-card" style={{ flex: 1, minHeight: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: 10 }}>
              <HelpCircle size={32} style={{ color: 'var(--text-dark)' }} />
              <p style={{ fontSize: 14 }}>Convergence logs will appear here once calibration is initiated.</p>
            </div>
          )}

          {/* Real-time Logs Console */}
          <div className="glass-card" style={{ padding: '16px 20px', background: 'rgba(5, 8, 16, 0.9)', border: '1px solid rgba(56, 189, 248, 0.15)', display: 'flex', flexDirection: 'column', height: 160 }}>
            <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="status-dot online" style={{ width: 6, height: 6 }}></span>
              Calibration Console Feed
            </h4>
            <div style={{ flex: 1, overflowY: 'auto', fontFamily: 'monospace', fontSize: 11, color: '#a7f3d0', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div>[SYSTEM] Console feed initialized. Ready to connect to model training engine.</div>
              {trainingState.previously_completed > 0 && (
                <div>[SYSTEM] Found previous calibration run: {trainingState.previously_completed} epochs completed for backbone '{trainingState.backbone}'.</div>
              )}
              {trainingState.history && trainingState.history.map((h, i) => (
                <div key={i}>
                  {`[EPOCH ${h.epoch}] - Loss: ${h.loss.toFixed(4)} | Acc: ${(h.accuracy*100).toFixed(2)}% | Val Loss: ${h.val_loss.toFixed(4)} | Val Acc: ${(h.val_accuracy*100).toFixed(2)}%`}
                </div>
              ))}
              {trainingState.status === 'Training' && (
                <div>[SYSTEM] Actively training. Unfreezing stage scheduled...</div>
              )}
              {trainingState.status === 'Completed' && (
                <div style={{ color: 'var(--color-success)' }}>[SUCCESS] Model Calibration complete! Best weights cached. Click 'Push to Active Inference' to apply.</div>
              )}
              {trainingState.status === 'Stopped' && (
                <div style={{ color: 'var(--color-warning)' }}>[WARNING] Model calibration paused by operator. Parameters saved. Can be resumed.</div>
              )}
              {trainingState.status === 'Error' && (
                <div style={{ color: 'var(--color-danger)' }}>[ERROR] Calibration aborted: {trainingState.error_message}</div>
              )}
              <div ref={logsEndRef} />
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
