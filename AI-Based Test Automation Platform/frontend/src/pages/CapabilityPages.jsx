import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Cpu, BarChart2, Play, FileText, Shield, GitMerge, MessageSquare, Settings, ArrowRight, Check } from 'lucide-react';

const CAPABILITIES = [
  {
    id: 'ai', icon: Cpu, color: '#2684FF', bgColor: '#DEEBFF',
    title: 'AI Test Generation',
    tagline: 'NLP-to-testcase in seconds',
    features: ['Requirement parsing (PDF, DOCX, XLSX)', 'Functional + edge case extraction', 'Coverage gap analysis', 'Auto-prioritization by risk'],
    desc: 'Our fine-tuned language model transforms unstructured requirements into structured, executable test cases without any manual mapping.',
  },
  {
    id: 'exec', icon: Play, color: '#36B37E', bgColor: '#E3FCEF',
    title: 'Playwright Execution',
    tagline: 'Cross-browser automated runs',
    features: ['Chromium, Firefox, WebKit', 'Parallel + sequential execution', 'Screenshot on failure', 'Video recording of full runs'],
    desc: 'AutoQA generates Playwright scripts from your test cases and runs them against any URL or environment automatically.',
  },
  {
    id: 'dash', icon: BarChart2, color: '#6554C0', bgColor: '#EAE6FF',
    title: 'Executive Dashboards',
    tagline: 'Real-time quality metrics',
    features: ['Pass / fail trend charts', 'Coverage heatmaps', 'SLA tracking', 'Cross-project comparison'],
    desc: 'Leadership-ready dashboards show quality trends across teams, sprints, and environments at a glance.',
  },
  {
    id: 'report', icon: FileText, color: '#FFAB00', bgColor: '#FFFAE6',
    title: 'PDF Report Export',
    tagline: 'Audit-ready executive reports',
    features: ['Full test run traceability', 'Requirement-to-test mapping', 'Video evidence attachments', 'Export to PDF or Excel'],
    desc: 'Every execution generates a comprehensive audit trail report linking results directly back to original requirement documents.',
  },
  {
    id: 'rbac', icon: Shield, color: '#FF5630', bgColor: '#FFEBE6',
    title: 'Enterprise RBAC',
    tagline: 'Role-based access control',
    features: ['Admin, Lead, Engineer, Developer roles', 'SSO & SAML 2.0 support', 'IP allowlisting', 'Full audit log'],
    desc: 'Granular permissions ensure each team member sees exactly what they need — nothing more, nothing less.',
  },
  {
    id: 'wf', icon: GitMerge, color: '#0052CC', bgColor: '#DEEBFF',
    title: 'Smart Workflows',
    tagline: 'Automate QA operations',
    features: ['Conditional automation rules', 'Auto bug creation on failure', 'CI/CD integration hooks', 'Email / Slack triggers'],
    desc: 'Build no-code automation rules that respond to test events — escalate failures, notify teams, and create Jira tickets automatically.',
  },
];

const CapabilityPages = () => {
  const [active, setActive] = useState(CAPABILITIES[0]);

  return (
    <div style={{ background: 'white', minHeight: '100vh' }}>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #091E42 0%, #0052CC 100%)', padding: '88px 0 72px', textAlign: 'center' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 32px' }}>
          <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 99, padding: '6px 16px', marginBottom: 20 }}>
            <span style={{ fontSize: 13, color: '#93C5FD', fontWeight: 600 }}>Platform Capabilities</span>
          </div>
          <h1 style={{ fontSize: 52, fontWeight: 800, color: 'white', lineHeight: 1.12, letterSpacing: '-0.02em', marginBottom: 20 }}>
            Everything Your QA Team Needs
          </h1>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.72)', lineHeight: 1.7 }}>
            Six powerful modules, one unified platform.
          </p>
        </div>
      </section>

      {/* Capability Explorer */}
      <section style={{ padding: '88px 0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px' }}>

          {/* Icon Grid Nav */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 16, marginBottom: 56 }}>
            {CAPABILITIES.map(c => (
              <button key={c.id}
                onClick={() => setActive(c)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                  padding: '20px 12px', borderRadius: 16, cursor: 'pointer', fontFamily: 'inherit',
                  border: `2px solid ${active.id === c.id ? c.color : '#DFE1E6'}`,
                  background: active.id === c.id ? c.bgColor : 'white',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: active.id === c.id ? c.color : '#F4F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <c.icon size={22} color={active.id === c.id ? 'white' : '#97A0AF'} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: active.id === c.id ? '#091E42' : '#6B778C', textAlign: 'center', lineHeight: 1.3 }}>
                  {c.title}
                </span>
              </button>
            ))}
          </div>

          {/* Active Capability Detail */}
          <div key={active.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center', animation: 'fadeIn 0.25s ease' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, background: active.bgColor, borderRadius: 12, padding: '10px 16px', marginBottom: 24 }}>
                <active.icon size={22} color={active.color} />
                <span style={{ fontSize: 14, fontWeight: 700, color: active.color }}>{active.tagline}</span>
              </div>
              <h2 style={{ fontSize: 40, fontWeight: 800, color: '#091E42', letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 20 }}>
                {active.title}
              </h2>
              <p style={{ fontSize: 16, color: '#42526E', lineHeight: 1.75, marginBottom: 32 }}>{active.desc}</p>
              <ul style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 36 }}>
                {active.features.map((f, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: active.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <Check size={11} color="white" />
                    </div>
                    <span style={{ fontSize: 14, color: '#344563', lineHeight: 1.4 }}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/data-input" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                height: 46, padding: '0 24px', background: active.color, color: 'white',
                borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none', transition: 'all 0.2s',
              }}>
                Try It Free <ArrowRight size={15} />
              </Link>
            </div>

            {/* Right: Visual */}
            <div style={{ background: '#0d1b2a', borderRadius: 20, padding: 24, boxShadow: '0 24px 60px rgba(9,30,66,0.2)' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5630' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFAB00' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#36B37E' }} />
                <div style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                  autoqa · {active.id}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {active.features.map((f, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '12px 14px', borderLeft: `3px solid ${active.color}` }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: active.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                      <Check size={11} color="white" />
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>{f}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* All Capabilities Grid */}
      <section style={{ padding: '88px 0', background: '#F4F5F7' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontSize: 36, fontWeight: 800, color: '#091E42', marginBottom: 14, letterSpacing: '-0.02em' }}>Full Platform Overview</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
            {CAPABILITIES.map(c => (
              <div key={c.id} style={{ background: 'white', borderRadius: 16, padding: '28px 24px', border: '1px solid #DFE1E6', boxShadow: '0 1px 3px rgba(9,30,66,0.08)', transition: 'all 0.2s', cursor: 'pointer' }}
                onClick={() => { setActive(c); window.scrollTo({ top: 300, behavior: 'smooth' }); }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 12, background: c.bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                  <c.icon size={22} color={c.color} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#091E42', marginBottom: 8 }}>{c.title}</h3>
                <p style={{ fontSize: 14, color: '#42526E', lineHeight: 1.6, marginBottom: 16 }}>{c.desc}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: c.color }}>
                  Learn more <ArrowRight size={13} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default CapabilityPages;
