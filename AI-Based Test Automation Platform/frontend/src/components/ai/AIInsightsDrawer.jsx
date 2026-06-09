import React from "react";
import { 
  Sparkles, 
  ArrowRight, 
  Trash2, 
  Zap, 
  TrendingDown, 
  AlertTriangle,
  X,
  CheckCircle2
} from "lucide-react";

const SUGGESTIONS = [
  { 
    id: 1, 
    type: "performance", 
    title: "Overload Detected", 
    detail: "Tester 'John Doe' has 14 pending tasks. This will delay Sprint completion by 2 days.", 
    action: "Re-assign to Alice",
    icon: TrendingDown,
    color: "rose"
  },
  { 
    id: 2, 
    type: "optimization", 
    title: "Workflow Bottleneck", 
    detail: "Approval step for 'High' severity bugs is taking 4x longer than average.", 
    action: "Auto-approve Low Severity",
    icon: Zap,
    color: "amber"
  },
  { 
    id: 3, 
    type: "quality", 
    title: "Gap in Coverage", 
    detail: "Analysis suggests 12% of 'Login' path edge cases are missing automated steps.", 
    action: "Generate Test Cases",
    icon: AlertTriangle,
    color: "indigo"
  }
];

const AIInsightsDrawer = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <>
            <div className="drawer-overlay" onClick={onClose} />
            <div className="ai-drawer">
                <style>{`
                    .drawer-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0,0,0,0.3);
                        z-index: 1000;
                        backdrop-filter: blur(4px);
                    }
                    .ai-drawer {
                        position: fixed;
                        top: 0;
                        right: 0;
                        bottom: 0;
                        width: 420px;
                        background: #f8fafc;
                        z-index: 1001;
                        box-shadow: -10px 0 30px rgba(0,0,0,0.1);
                        display: flex;
                        flex-direction: column;
                        animation: slideIn 0.3s ease-out;
                        border-left: 1px solid #e2e8f0;
                    }
                    @keyframes slideIn {
                        from { transform: translateX(100%); }
                        to { transform: translateX(0); }
                    }
                    .ai-drawer-header {
                        padding: 2rem;
                        background: #6366f1;
                        color: white;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .ai-drawer-header h2 {
                        display: flex;
                        align-items: center;
                        gap: 0.75rem;
                        margin: 0;
                        font-size: 1.25rem;
                    }
                    .close-btn {
                        background: rgba(255,255,255,0.2);
                        border: none;
                        color: white;
                        padding: 0.5rem;
                        border-radius: 0.5rem;
                        cursor: pointer;
                    }
                    .ai-drawer-content {
                        padding: 2rem;
                        flex-grow: 1;
                        overflow-y: auto;
                    }
                    .suggestion-card {
                        background: white;
                        border-radius: 1rem;
                        border: 1px solid #e2e8f0;
                        padding: 1.5rem;
                        margin-bottom: 1.5rem;
                        transition: transform 0.2s;
                    }
                    .suggestion-card:hover {
                        transform: translateY(-2px);
                    }
                    .suggestion-header {
                        display: flex;
                        gap: 1rem;
                        margin-bottom: 1rem;
                    }
                    .suggestion-icon {
                        padding: 0.5rem;
                        border-radius: 0.5rem;
                    }
                    .suggestion-icon.rose { background: #fff1f2; color: #f43f5e; }
                    .suggestion-icon.amber { background: #fffbeb; color: #f59e0b; }
                    .suggestion-icon.indigo { background: #eef2ff; color: #6366f1; }
                    
                    .suggestion-title {
                        font-weight: 700;
                        color: #1e293b;
                        font-size: 1rem;
                    }
                    .suggestion-detail {
                        font-size: 0.875rem;
                        color: #64748b;
                        line-height: 1.5;
                        margin-bottom: 1.5rem;
                    }
                    .suggestion-action {
                        width: 100%;
                        background: #f1f5f9;
                        border: 1px solid #e2e8f0;
                        padding: 0.75rem;
                        border-radius: 0.5rem;
                        font-size: 0.875rem;
                        font-weight: 700;
                        color: #1e293b;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 0.5rem;
                        transition: all 0.2s;
                    }
                    .suggestion-action:hover {
                        background: #eef2ff;
                        border-color: #6366f1;
                        color: #6366f1;
                    }
                    .ai-footer {
                        padding: 1.5rem 2rem;
                        background: white;
                        border-top: 1px solid #e2e8f0;
                    }
                `}</style>

                <div className="ai-drawer-header">
                    <h2>
                        <Sparkles size={24} />
                        AI Insights
                    </h2>
                    <button className="close-btn" onClick={onClose}><X size={20}/></button>
                </div>

                <div className="ai-drawer-content">
                    {SUGGESTIONS.map(s => (
                        <div key={s.id} className="suggestion-card">
                            <div className="suggestion-header">
                                <div className={`suggestion-icon ${s.color}`}>
                                    <s.icon size={20} />
                                </div>
                                <div className="suggestion-title">{s.title}</div>
                            </div>
                            <div className="suggestion-detail">{s.detail}</div>
                            <button className="suggestion-action">
                                {s.action}
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    ))}
                    
                    <div style={{ padding: '1rem', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                            Updated 4 minutes ago via System Analytics
                        </span>
                    </div>
                </div>

                <div className="ai-footer">
                    <button className="btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <CheckCircle2 size={18} /> Apply All Recommendations
                    </button>
                </div>
            </div>
        </>
    );
};

export default AIInsightsDrawer;
