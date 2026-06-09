import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { 
  Download, FileText, ChevronLeft, CheckCircle2, 
  XCircle, Clock, AlertTriangle, FileJson
} from 'lucide-react';

const ExecutionReport = () => {
    const { executionId } = useParams();
    const navigate = useNavigate();
    const [execution, setExecution] = useState(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        loadReport();
    }, [executionId]);

    const loadReport = async () => {
        try {
            const res = await api.get(`/api/executions/${executionId}`);
            if (res.status === 'success') {
                setExecution(res.data);
            }
        } catch (err) {
            console.error('Failed to load report:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this execution record?')) return;
        try {
            const res = await api.delete(`/api/executions/${executionId}`);
            if (res.status === 'success') {
                navigate('/execution-dashboard');
            } else {
                alert(res.message || 'Failed to delete execution');
            }
        } catch (err) {
            alert('Delete failed: ' + err.message);
        }
    };

    const handleExport = async (format) => {
        setExporting(true);
        try {
            const base = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';
            const token = localStorage.getItem('token');
            // The new endpoint we will add in the backend
            const res = await fetch(`${base}/api/reports/execution/${executionId}/export?format=${format}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Execution_Report_${executionId}.${format}`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            alert(`Export failed: ${err.message}`);
        } finally {
            setExporting(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a' }}>
                <div style={{ color: '#3b82f6', textAlign: 'center' }}>
                    <div className="animate-spin inline-block mb-4">
                        <Clock size={40} />
                    </div>
                    <h2>Compiling Report...</h2>
                </div>
            </div>
        );
    }

    if (!execution) return <div style={{padding: '2rem'}}>Report not found.</div>;

    const steps = execution.step_results || [];
    
    // Parse total execution duration
    let totalDuration = 0;
    if (execution.started_at && execution.completed_at) {
        totalDuration = (new Date(execution.completed_at) - new Date(execution.started_at)) / 1000;
    }

    return (
        <div className="report-layout">
            <header className="report-header">
                <div>
                    <button className="back-btn" onClick={() => navigate(-1)}>
                        <ChevronLeft size={16} /> Back to Dashboard
                    </button>
                    <h1>Final Execution Report <span className="highlight">#{executionId}</span></h1>
                    <p className="subtitle">
                        Test Case: {execution.test_case_title} | Project: {execution.project_id}
                    </p>
                </div>
                <div className="actions">
                    <button className="btn primary" onClick={() => handleExport('pdf')} disabled={exporting}>
                        <FileText size={16} /> {exporting ? 'Generating...' : 'Export PDF'}
                    </button>
                    <button className="btn btn--secondary" onClick={handleDelete} style={{ color: '#FF5630', borderColor: '#FF5630' }}>
                        <XCircle size={14} /> Delete Report
                    </button>
                    <button className="btn btn--secondary" onClick={() => handleExport('json')} disabled={exporting}>
                        <Download size={14} /> JSON
                    </button>
                </div>
            </header>

            <main className="report-main">
                {/* Scorecard */}
                <div className="scorecard">
                    <div className="score-card">
                        <label>Overall Status</label>
                        <div className={`value ${execution.status?.toLowerCase()}`}>
                            {execution.status === 'PASS' ? <CheckCircle2 size={20} /> : <XCircle size={20} />} 
                            {execution.status}
                        </div>
                    </div>
                    <div className="score-card">
                        <label>Pass Rate</label>
                        <div className="value">
                             {steps.length > 0 
                                ? Math.round((steps.filter(s => s.status === 'PASS').length / steps.length) * 100) 
                                : 0}%
                        </div>
                    </div>
                    <div className="score-card">
                        <label>Total Duration</label>
                        <div className="value"><Clock size={20} /> {totalDuration.toFixed(2)}s</div>
                    </div>
                </div>

                {/* Data Table */}
                <div className="table-container">
                    <table className="report-table">
                        <thead>
                            <tr>
                                <th>Test Case ID</th>
                                <th>Steps</th>
                                <th>Expected</th>
                                <th>Actual</th>
                                <th>Status</th>
                                <th>Time Taken</th>
                                <th>Error Logs</th>
                            </tr>
                        </thead>
                        <tbody>
                            {steps.length === 0 ? (
                                <tr><td colSpan={7} className="empty-state">No step data found in execution records.</td></tr>
                            ) : (
                                steps.map((step, idx) => (
                                    <tr key={idx} className={step.status?.toLowerCase()}>
                                        <td className="mono">TC-{execution.test_case_id}</td>
                                        <td className="step-desc">
                                            <strong>{idx + 1}.</strong> {step.name}
                                        </td>
                                        <td className="expected-col">
                                            Execute operation without errors
                                        </td>
                                        <td className="actual-col">
                                            {step.status === 'FAIL' ? 'Operation failed or timed out' : 'Operation completed successfully'}
                                        </td>
                                        <td>
                                            <span className={`status-badge ${step.status?.toLowerCase()}`}>
                                                {step.status}
                                            </span>
                                        </td>
                                        <td>{step.duration ? `${step.duration}ms` : '—'}</td>
                                        <td className="error-col">
                                            {step.error ? (
                                                <div className="error-badge">
                                                    <AlertTriangle size={12} />
                                                    <span>{step.error}</span>
                                                </div>
                                            ) : (
                                                <span className="no-error">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </main>

            <style>{`
                .report-layout {
                    min-height: 100vh;
                    background: #0f172a;
                    color: #cbd5e1;
                    font-family: 'Inter', system-ui, sans-serif;
                    display: flex;
                    flex-direction: column;
                }
                .report-header {
                    padding: 2rem 3rem;
                    background: #1e293b;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    border-bottom: 1px solid #334155;
                }
                .back-btn {
                    background: none;
                    border: none;
                    color: #94a3b8;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 0 0 1rem 0;
                    font-size: 0.85rem;
                }
                .back-btn:hover { color: #f1f5f9; }
                .report-header h1 {
                    margin: 0 0 0.5rem 0;
                    font-size: 1.8rem;
                    color: #f8fafc;
                }
                .highlight { color: #3b82f6; }
                .subtitle { margin: 0; color: #94a3b8; font-size: 0.9rem; }
                .actions { display: flex; gap: 1rem; }
                .btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 0.6rem 1.2rem;
                    border-radius: 6px;
                    font-size: 0.9rem;
                    font-weight: 600;
                    cursor: pointer;
                    border: none;
                    transition: all 0.2s;
                }
                .btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .btn.primary { background: #3b82f6; color: white; }
                .btn.primary:hover:not(:disabled) { background: #2563eb; }
                .btn.secondary { background: #334155; color: white; }
                .btn.secondary:hover:not(:disabled) { background: #475569; }

                .report-main { padding: 2rem 3rem; flex-grow: 1; }

                .scorecard {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }
                .score-card {
                    background: #1e293b;
                    padding: 1.5rem;
                    border-radius: 8px;
                    border: 1px solid #334155;
                }
                .score-card label {
                    display: block;
                    font-size: 0.8rem;
                    text-transform: uppercase;
                    color: #94a3b8;
                    margin-bottom: 0.5rem;
                    font-weight: 600;
                }
                .score-card .value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #f1f5f9;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .value.pass { color: #10b981; }
                .value.fail { color: #ef4444; }

                .table-container {
                    background: #1e293b;
                    border-radius: 8px;
                    border: 1px solid #334155;
                    overflow: hidden;
                }
                .report-table {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: left;
                }
                .report-table th {
                    background: #0f172a;
                    padding: 1rem;
                    font-size: 0.8rem;
                    text-transform: uppercase;
                    color: #94a3b8;
                    border-bottom: 1px solid #334155;
                    white-space: nowrap;
                }
                .report-table td {
                    padding: 1rem;
                    font-size: 0.9rem;
                    border-bottom: 1px solid #334155;
                    vertical-align: top;
                }
                .report-table tr:hover td { background: #33415520; }
                .mono { font-family: monospace; color: #3b82f6; }
                .step-desc { color: #f1f5f9; max-width: 250px; line-height: 1.5; }
                .expected-col, .actual-col { max-width: 200px; line-height: 1.4; color: #94a3b8; }
                
                .status-badge {
                    display: inline-block;
                    padding: 0.25rem 0.5rem;
                    border-radius: 4px;
                    font-size: 0.75rem;
                    font-weight: 700;
                }
                .status-badge.pass { background: #10b98120; color: #10b981; }
                .status-badge.fail { background: #ef444420; color: #ef4444; }
                
                .error-col { max-width: 300px; }
                .error-badge {
                    display: flex;
                    align-items: flex-start;
                    gap: 6px;
                    background: #ef444410;
                    border: 1px solid #ef444430;
                    color: #f87171;
                    padding: 0.5rem;
                    border-radius: 4px;
                    font-size: 0.8rem;
                    line-height: 1.4;
                }
                .no-error { color: #475569; }
                .empty-state { text-align: center; color: #64748b; padding: 3rem !important; }
            `}</style>
        </div>
    );
};

export default ExecutionReport;
