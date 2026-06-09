import React, { useEffect, useState } from 'react';
import { 
  Users, Layers, Award, Target, Activity, 
  TrendingUp, BarChart3, ShieldCheck 
} from 'lucide-react';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid
} from 'recharts';

export default function Overview({ backendUrl }) {
  const [statsData, setStatsData] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [historyTab, setHistoryTab] = useState('classifier'); // 'classifier', 'segmentation'

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const [statsRes, historyRes] = await Promise.all([
          fetch(`${backendUrl}/api/overview`),
          fetch(`${backendUrl}/api/training-history`)
        ]);
        
        const stats = await statsRes.json();
        const history = await historyRes.json();
        
        setStatsData(stats);
        setHistoryData(history);
      } catch (err) {
        console.error('Error fetching overview data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchOverview();
  }, [backendUrl]);

  if (loading) {
    return (
      <div className="spinner-container">
        <div className="spinner"></div>
        <p>Loading analytical metrics and training plots...</p>
      </div>
    );
  }

  const { stats, metrics, class_distribution, patient_distribution } = statsData || {};

  return (
    <div>
      <div className="content-header">
        <h1>Dashboard Overview</h1>
        <p>Real-time analytics, model performance summaries, and training logs for classifier and segmenter models.</p>
      </div>

      {/* Stats Cards */}
      <div className="dashboard-grid">
        <div className="metric-card">
          <div className="metric-icon-container primary">
            <Users size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Total Patients</span>
            <span className="metric-value">{stats?.total_patients || 0}</span>
            <span className="metric-desc">Manifested cases</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-container warning">
            <Layers size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Total Slices</span>
            <span className="metric-value">{stats?.total_slices || 0}</span>
            <span className="metric-desc">TIF scans mapped</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-container success">
            <Award size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Classifier Accuracy</span>
            <span className="metric-value">{(metrics?.classification?.accuracy * 100).toFixed(1)}%</span>
            <span className="metric-desc">ROC AUC: {metrics?.classification?.auc.toFixed(3)}</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-container danger">
            <Target size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Segmenter Dice</span>
            <span className="metric-value">{(metrics?.segmentation?.dice * 100).toFixed(1)}%</span>
            <span className="metric-desc">Mean IoU: {metrics?.segmentation?.iou.toFixed(3)}</span>
          </div>
        </div>
      </div>

      {/* Distribution Pie Charts */}
      <div className="charts-row-equal">
        <div className="glass-card">
          <h2 className="card-title">
            <BarChart3 size={18} className="logo-icon" />
            Slice Pathology Split
          </h2>
          <div style={{ width: '100%', height: 260 }}>
            {class_distribution && (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={class_distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {class_distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#131b2e', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="glass-card">
          <h2 className="card-title">
            <Users size={18} className="logo-icon" />
            Patient Diagnosis Mappings
          </h2>
          <div style={{ width: '100%', height: 260 }}>
            {patient_distribution && (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={patient_distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {patient_distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#131b2e', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Model Performance Deep Dive */}
      <div className="glass-card">
        <h2 className="card-title">
          <ShieldCheck size={18} className="logo-icon" />
          Model Validation Parameters
        </h2>
        <div className="charts-row-equal" style={{ gap: 20, marginBottom: 0 }}>
          <div style={{ padding: 10, background: 'rgba(255,255,255,0.01)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-primary)', marginBottom: 16 }}>
              ResNet50 + CBAM Attention Classifier
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--text-muted)' }}>Categorical Accuracy:</span>
                <span style={{ fontWeight: 600 }}>{(metrics?.classification?.accuracy * 100).toFixed(2)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--text-muted)' }}>Recall / Sensitivity:</span>
                <span style={{ fontWeight: 600 }}>{(metrics?.classification?.recall * 100).toFixed(2)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--text-muted)' }}>Precision Score:</span>
                <span style={{ fontWeight: 600 }}>{(metrics?.classification?.precision * 100).toFixed(2)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--text-muted)' }}>Area Under ROC (AUC):</span>
                <span style={{ fontWeight: 600 }}>{metrics?.classification?.auc.toFixed(4)}</span>
              </div>
            </div>
          </div>

          <div style={{ padding: 10, background: 'rgba(255,255,255,0.01)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-primary)', marginBottom: 16 }}>
              ResU-Net Medical Segmentation Model
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--text-muted)' }}>Dice Similarity Coefficient:</span>
                <span style={{ fontWeight: 600 }}>{(metrics?.segmentation?.dice * 100).toFixed(2)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--text-muted)' }}>Intersection over Union (IoU):</span>
                <span style={{ fontWeight: 600 }}>{(metrics?.segmentation?.iou * 100).toFixed(2)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--text-muted)' }}>True Positive Rate (Sensitivity):</span>
                <span style={{ fontWeight: 600 }}>{(metrics?.segmentation?.sensitivity * 100).toFixed(2)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--text-muted)' }}>True Negative Rate (Specificity):</span>
                <span style={{ fontWeight: 600 }}>{(metrics?.segmentation?.specificity * 100).toFixed(2)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Training History Logs Plot */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 className="card-title" style={{ margin: 0, border: 'none', padding: 0 }}>
            <TrendingUp size={18} className="logo-icon" />
            Model Training Logs
          </h2>
          <div className="tabs-container" style={{ margin: 0, border: 'none' }}>
            <button 
              className={`tab-btn ${historyTab === 'classifier' ? 'active' : ''}`}
              onClick={() => setHistoryTab('classifier')}
            >
              Classification Training History
            </button>
            <button 
              className={`tab-btn ${historyTab === 'segmentation' ? 'active' : ''}`}
              onClick={() => setHistoryTab('segmentation')}
            >
              Segmentation Training History
            </button>
          </div>
        </div>
        
        <div style={{ width: '100%', height: 320 }}>
          {historyTab === 'classifier' && historyData?.clf && (
            <ResponsiveContainer>
              <LineChart data={historyData.clf} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="epoch" stroke="var(--text-muted)" />
                <YAxis stroke="var(--text-muted)" />
                <Tooltip contentStyle={{ backgroundColor: '#131b2e', borderColor: 'rgba(255,255,255,0.1)' }} />
                <Legend />
                <Line type="monotone" dataKey="loss" name="Training Loss" stroke="#f43f5e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="val_loss" name="Validation Loss" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="accuracy" name="Training Accuracy" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="val_accuracy" name="Validation Accuracy" stroke="#38bdf8" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
          
          {historyTab === 'segmentation' && historyData?.seg && (
            <ResponsiveContainer>
              <LineChart data={historyData.seg} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="epoch" stroke="var(--text-muted)" />
                <YAxis stroke="var(--text-muted)" />
                <Tooltip contentStyle={{ backgroundColor: '#131b2e', borderColor: 'rgba(255,255,255,0.1)' }} />
                <Legend />
                <Line type="monotone" dataKey="loss" name="Training Loss" stroke="#f43f5e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="val_loss" name="Validation Loss" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="dice" name="Dice Coeff" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="val_dice" name="Val Dice Coeff" stroke="#38bdf8" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
          
          {((historyTab === 'classifier' && !historyData?.clf?.length) || 
            (historyTab === 'segmentation' && !historyData?.seg?.length)) && (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dark)' }}>
              No log history parsed from log files.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
