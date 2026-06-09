import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Sparkles, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', password);

      const resData = await api.postForm('/api/auth/login', params);
      
      const data = resData || {};

      localStorage.setItem('token', data.access_token);
      if (data.user_role) localStorage.setItem('user_role', data.user_role);
      if (data.role_id) localStorage.setItem('role_id', data.role_id);
      if (data.user_name) localStorage.setItem('user_name', data.user_name);
      if (data.user_email) localStorage.setItem('user_email', data.user_email);
      navigate('/overview');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: '#F4F5F7',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* Left — branding panel */}
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        width: '42%', background: 'linear-gradient(160deg, #091E42 0%, #0052CC 100%)',
        padding: '48px 56px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '-40%', right: '-20%',
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(38,132,255,0.25) 0%, transparent 70%)',
        }} />

        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
            <svg width="36" height="36" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="6" fill="#2684FF"/>
              <path d="M7 14L14 7L21 14L14 21L7 14Z" fill="white" opacity="0.9"/>
              <path d="M11 14L14 11L17 14L14 17L11 14Z" fill="#0052CC"/>
            </svg>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'white' }}>AutoQA</span>
          </div>

          <h2 style={{ fontSize: 36, fontWeight: 800, color: 'white', marginBottom: 20, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            The Intelligence Behind Enterprise Quality
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 1.75, marginBottom: 48 }}>
            From requirements to reports. AI-powered test automation for teams that move fast and ship with confidence.
          </p>

          {[
            { val: '70%', label: 'Faster testing cycles' },
            { val: '95%', label: 'Automation coverage' },
            { val: '500+', label: 'Enterprise customers' },
          ].map(s => (
            <div key={s.val} style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#60A5FA', minWidth: 70 }}>{s.val}</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right — login form */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '48px',
      }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ marginBottom: 36 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#091E42', marginBottom: 8, letterSpacing: '-0.02em' }}>
              Sign in to AutoQA
            </h1>
            <p style={{ fontSize: 14, color: '#6B778C' }}>Enter your credentials to access the platform</p>
          </div>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#FFEBE6', border: '1px solid #FF5630',
              borderRadius: 8, padding: '12px 16px', marginBottom: 24,
            }}>
              <AlertCircle size={16} color="#FF5630" />
              <span style={{ fontSize: 14, color: '#BF2600', fontWeight: 500 }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Corporate Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#97A0AF' }} />
                <input
                  type="email"
                  className="form-input"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{ paddingLeft: 40 }}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="form-group" style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label className="form-label">Password</label>
                <a href="#" style={{ fontSize: 12, color: '#0052CC', textDecoration: 'none', fontWeight: 600 }}>Forgot password?</a>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#97A0AF' }} />
                <input
                  type={showPw ? 'text' : 'password'}
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ paddingLeft: 40, paddingRight: 40 }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#97A0AF', padding: 0 }}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', height: 46, background: '#0052CC', color: 'white',
                border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.8 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontFamily: 'inherit', transition: 'all 0.2s',
              }}
            >
              {loading ? 'Signing in...' : <><Sparkles size={17} /> Sign In to Platform</>}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 32, fontSize: 12, color: '#97A0AF' }}>
            Enterprise STLC Automation Platform · AutoQA v2.0
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
