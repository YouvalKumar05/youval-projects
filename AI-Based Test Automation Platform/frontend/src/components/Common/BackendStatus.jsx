import React, { useState, useEffect, useCallback } from 'react';
import { WifiOff, RefreshCw, CheckCircle } from 'lucide-react';
import { api } from '../../services/api';

/**
 * BackendStatus
 * -------------
 * Polls /health every 10 s.
 * Shows a non-intrusive banner at the top when the backend is unreachable.
 * Disappears automatically once the backend comes back online.
 */
const BackendStatus = () => {
  const [online, setOnline]       = useState(true);   // optimistic: assume online
  const [checking, setChecking]   = useState(false);
  const [justFixed, setJustFixed] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    const ok = await api.checkBackend();
    setChecking(false);

    if (ok && !online) {
      // Was offline → just came back
      setJustFixed(true);
      setTimeout(() => setJustFixed(false), 3000);
    }
    setOnline(ok);
  }, [online]);

  // Poll every 10 s; also check immediately on mount
  useEffect(() => {
    check();
    const id = setInterval(check, 10_000);
    return () => clearInterval(id);
  }, []);                    // intentionally not re-running when `check` identity changes

  // All good and no recovery flash → render nothing
  if (online && !justFixed) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 24px',
      background: justFixed
        ? 'linear-gradient(90deg, #006644, #36B37E)'
        : 'linear-gradient(90deg, #BF2600, #FF5630)',
      color: 'white',
      fontSize: 13, fontWeight: 600,
      boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
      transition: 'background 0.4s ease',
    }}>
      {/* Icon */}
      {justFixed
        ? <CheckCircle size={16} />
        : <WifiOff size={16} className="animate-pulse" />
      }

      {/* Message */}
      <span style={{ flex: 1 }}>
        {justFixed
          ? 'Backend reconnected — you\'re back online!'
          : `Cannot reach the backend server. Make sure it is running at ${
              import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'
            }.`
        }
      </span>

      {/* Retry button */}
      {!justFixed && (
        <button
          onClick={check}
          disabled={checking}
          style={{
            background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)',
            color: 'white', borderRadius: 6, padding: '4px 14px',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <RefreshCw size={12} style={{ animation: checking ? 'spin 1s linear infinite' : 'none' }} />
          {checking ? 'Checking…' : 'Retry'}
        </button>
      )}

      {/* How to start */}
      {!justFixed && (
        <code style={{
          background: 'rgba(0,0,0,0.25)', padding: '3px 10px', borderRadius: 4,
          fontSize: 11, letterSpacing: '0.02em', whiteSpace: 'nowrap',
        }}>
          cd backend && .venv/bin/python3 main.py
        </code>
      )}

      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
    </div>
  );
};

export default BackendStatus;
