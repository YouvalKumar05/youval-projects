import React from 'react';
import { Target, CheckCircle2, AlertTriangle, Info, BarChart3, Fingerprint, BrainCircuit, Activity } from 'lucide-react';

const AccuracyDashboard = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="accuracy-loading-shimmer" style={{ padding: '20px', background: '#1a1a1a', borderRadius: '12px', height: '300px' }}>
        <p style={{ color: '#888' }}>Evaluating Test Case Accuracy...</p>
      </div>
    );
  }

  if (!data) return null;

  const { overall_accuracy, metrics, suggestion } = data;

  const getScoreColor = (score) => {
    if (score >= 80) return '#10b981'; // Green
    if (score >= 60) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  };

  const MetricItem = ({ icon: Icon, label, value, tooltip }) => (
    <div className="metric-row" style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon size={16} color="#888" />
          <span style={{ fontSize: '0.85rem', color: '#ccc', fontWeight: '500' }}>{label}</span>
          <div className="tooltip-container" style={{ cursor: 'help' }} title={tooltip}>
            <Info size={12} color="#555" />
          </div>
        </div>
        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: getScoreColor(value) }}>{value}%</span>
      </div>
      <div style={{ height: '6px', background: '#333', borderRadius: '3px', overflow: 'hidden' }}>
        <div 
          style={{ 
            height: '100%', 
            width: `${value}%`, 
            background: `linear-gradient(90deg, ${getScoreColor(value)}dd, ${getScoreColor(value)})`,
            transition: 'width 1s ease-out',
            borderRadius: '3px'
          }} 
        />
      </div>
    </div>
  );

  return (
    <div className="accuracy-dashboard-card" style={{
      background: 'rgba(30, 30, 35, 0.6)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      padding: '24px',
      color: '#fff',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      marginTop: '20px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity color="#6366f1" size={20} />
            Accuracy Evaluation Engine
          </h3>
          <p style={{ color: '#888', margin: '4px 0 0 0', fontSize: '0.9rem' }}>AI-driven quality assessment metrics</p>
        </div>
        
        <div style={{ textAlign: 'right' }}>
          <div style={{ 
            fontSize: '2.5rem', 
            fontWeight: '800', 
            color: getScoreColor(overall_accuracy),
            lineHeight: '1',
            textShadow: `0 0 20px ${getScoreColor(overall_accuracy)}44`
          }}>
            {overall_accuracy}%
          </div>
          <span style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Overall Score</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
        <div className="metrics-column">
          <MetricItem 
            icon={Target} 
            label="Requirement Coverage" 
            value={metrics.coverage} 
            tooltip="Matches extracted keywords from requirements with test case steps."
          />
          <MetricItem 
            icon={CheckCircle2} 
            label="Step Validity" 
            value={metrics.validity} 
            tooltip="Checks for valid action types and proper structural integrity."
          />
          <MetricItem 
            icon={BarChart3} 
            label="Assertion Quality" 
            value={metrics.assertion} 
            tooltip="Detects presence and depth of UI/Logic validations."
          />
        </div>
        
        <div className="metrics-column">
          <MetricItem 
            icon={Fingerprint} 
            label="Redundancy Score" 
            value={metrics.redundancy} 
            tooltip="Uniqueness factor - identifies repetitive or duplicate test logic."
          />
          <MetricItem 
            icon={BrainCircuit} 
            label="AI Confidence" 
            value={metrics.ai_confidence} 
            tooltip="LLM-based rating of test case realism and applicability."
          />
          <MetricItem 
            icon={AlertTriangle} 
            label="Edge Case Coverage" 
            value={metrics.edge} 
            tooltip="Presence of boundary tests, invalid inputs, and error paths."
          />
        </div>
      </div>

      <div style={{ 
        marginTop: '20px', 
        padding: '16px', 
        background: 'rgba(99, 102, 241, 0.1)', 
        borderRadius: '12px',
        borderLeft: `4px solid ${getScoreColor(overall_accuracy)}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Info size={16} color="#6366f1" />
          <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>AI System Suggestion</span>
        </div>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#bbb', fontStyle: 'italic' }}>
          {suggestion || "Analysis complete. Review the metrics above for detailed insights."}
        </p>
      </div>

      <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
        <span style={{ 
          padding: '4px 10px', 
          borderRadius: '20px', 
          fontSize: '0.7rem', 
          background: overall_accuracy >= 80 ? '#064e3b' : overall_accuracy >= 60 ? '#451a03' : '#450a0a',
          color: getScoreColor(overall_accuracy),
          fontWeight: 'bold',
          border: `1px solid ${getScoreColor(overall_accuracy)}33`
        }}>
          {overall_accuracy >= 80 ? 'High Confidence' : overall_accuracy >= 60 ? 'Medium Confidence' : 'Low Confidence'}
        </span>
      </div>
    </div>
  );
};

export default AccuracyDashboard;
