import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap, Shield, BarChart2, Play, ArrowRight, Check,
  FileSearch, Cpu, PlayCircle, FileCheck, ChevronDown
} from 'lucide-react';

const Home = () => {
  const [faqOpen, setFaqOpen] = useState(null);

  const stats = [
    { value: '70%', label: 'Faster Testing', sub: 'vs manual cycles' },
    { value: '95%', label: 'Coverage Rate', sub: 'across entire stack' },
    { value: '3x', label: 'QA Productivity', sub: 'per engineer' },
    { value: '500+', label: 'Enterprises', sub: 'trust AutoQA' },
  ];

  const workflow = [
    { step: '01', title: 'Connect & Upload', desc: 'Upload PDFs, Word docs, Swagger specs, or paste requirements directly.', icon: FileSearch, color: '#2684FF' },
    { step: '02', title: 'AI Analysis', desc: 'AI engine extracts structured test scenarios and identifies coverage gaps.', icon: Cpu, color: '#6554C0' },
    { step: '03', title: 'Auto-Execute', desc: 'Playwright-based engine orchestrates cross-browser automated runs.', icon: PlayCircle, color: '#36B37E' },
    { step: '04', title: 'Report & Export', desc: 'PDF reports with video recordings, logs, and coverage metrics.', icon: FileCheck, color: '#FFAB00' },
  ];

  const features = [
    { icon: Zap, title: 'Instant Analysis', desc: 'Transform any document into structured test cases in under 60 seconds with our NLP engine.', color: '#2684FF' },
    { icon: Shield, title: 'Enterprise RBAC', desc: 'Granular role-based permissions, SSO support, and full audit trails out of the box.', color: '#6554C0' },
    { icon: BarChart2, title: 'Live Dashboards', desc: 'Real-time execution monitoring with trend charts and quality score tracking.', color: '#36B37E' },
    { icon: Play, title: 'One-Click Execution', desc: 'From test case to Playwright script to execution in a single workflow.', color: '#FFAB00' },
  ];

  const faqs = [
    { q: 'How does AutoQA generate test cases?', a: 'AutoQA uses advanced NLP models to parse your requirements documents and extract structured test scenarios, edge cases, and acceptance criteria automatically.' },
    { q: 'What file formats are supported?', a: 'PDF, DOCX, XLSX, TXT, and ZIP archives. You can also paste raw requirements text directly into the platform.' },
    { q: 'Is AutoQA compliant with enterprise security standards?', a: 'Yes. AutoQA is designed to meet SOC2 Type II, GDPR, and ISO 27001 requirements with data encryption at rest and in transit.' },
    { q: 'Can I integrate AutoQA with Jira or Azure DevOps?', a: 'Native integrations with Jira, Azure DevOps, GitHub, and Slack are on the roadmap. API-based integrations are available today.' },
  ];

  return (
    <div style={{ background: 'white', minHeight: '100vh' }}>

      {/* ── HERO ── */}
      <section style={{
        background: 'linear-gradient(135deg, #091E42 0%, #0747A6 60%, #0052CC 100%)',
        padding: '85px 0 65px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background grid pattern */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />
        {/* Glow */}
        <div style={{
          position: 'absolute', top: '-20%', right: '-10%',
          width: '600px', height: '600px',
          background: 'radial-gradient(circle, rgba(38,132,255,0.2) 0%, transparent 70%)',
          borderRadius: '50%',
        }} />

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px', position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 64 }}>
            {/* Left */}
            <div style={{ flex: 1, maxWidth: 620 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 99, padding: '6px 16px', marginBottom: 24,
              }}>
                <Zap size={13} color="#60A5FA" />
                <span style={{ fontSize: 13, color: '#93C5FD', fontWeight: 600 }}>
                  AI-Powered Test Automation Platform
                </span>
              </div>

              <h1 style={{
                fontSize: 56, fontWeight: 800, lineHeight: 1.08,
                color: 'white', marginBottom: 24, letterSpacing: '-0.03em',
              }}>
                Automate Your<br />
                <span style={{ background: 'linear-gradient(90deg, #60A5FA, #A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Entire STLC
                </span>
                <br />with AI
              </h1>

              <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.75)', lineHeight: 1.65, marginBottom: 36, maxWidth: 520 }}>
                From requirements to executable Playwright tests in minutes.
                AutoQA bridges documentation and quality at enterprise scale.
              </p>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link to="/data-input" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: 'white', color: '#091E42',
                  padding: '0 24px', height: 48, borderRadius: 8,
                  fontWeight: 700, fontSize: 15, textDecoration: 'none',
                  transition: 'all 0.2s',
                }}>
                  Start Testing Free <ArrowRight size={17} />
                </Link>
                <Link to="/how-it-works" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: 'rgba(255,255,255,0.1)', color: 'white',
                  border: '1px solid rgba(255,255,255,0.25)',
                  padding: '0 24px', height: 48, borderRadius: 8,
                  fontWeight: 600, fontSize: 15, textDecoration: 'none',
                  transition: 'all 0.2s',
                }}>
                  See How It Works
                </Link>
              </div>

              <div style={{ display: 'flex', gap: 24, marginTop: 36 }}>
                {['SOC2 Compliant', 'GDPR Ready', 'ISO 27001'].map(t => (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Check size={14} color="#4ADE80" />
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Dashboard mockup */}
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <div style={{
                background: '#1e293b', borderRadius: 16, padding: 3,
                boxShadow: '0 50px 100px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)',
                transform: 'perspective(1000px) rotateY(-8deg) rotateX(3deg)',
                width: '100%', maxWidth: 480,
              }}>
                {/* Mock browser bar */}
                <div style={{ background: '#293548', borderRadius: '13px 13px 0 0', padding: '10px 16px', display: 'flex', gap: 6, alignItems: 'center' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5630' }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFAB00' }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#36B37E' }} />
                  <div style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                    autoqa.platform
                  </div>
                </div>
                {/* Mock dashboard UI */}
                <div style={{ background: '#0d1b2a', borderRadius: '0 0 13px 13px', padding: 20, minHeight: 280 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                    {[
                      { label: 'Pass Rate', value: '94.2%', color: '#36B37E' },
                      { label: 'Test Cases', value: '1,482', color: '#2684FF' },
                      { label: 'Time Saved', value: '128h', color: '#FFAB00' },
                      { label: 'Coverage', value: '96.7%', color: '#6554C0' },
                    ].map(m => (
                      <div key={m.label} style={{
                        background: 'rgba(255,255,255,0.05)', borderRadius: 8,
                        padding: '10px 12px',
                      }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{m.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: m.color }}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                  {/* Mock chart bars */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '12px 16px' }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>QUALITY TREND — LAST 14 DAYS</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
                      {[55,70,45,80,65,90,75,95,80,60,85,92,88,100].map((h, i) => (
                        <div key={i} style={{
                          flex: 1, borderRadius: '2px 2px 0 0',
                          height: `${h}%`, background: h > 80 ? '#36B37E' : '#2684FF',
                          opacity: 0.8,
                        }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section style={{ background: 'white', borderBottom: '1px solid #EBECF0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
            {stats.map((s, i) => (
              <div key={i} style={{
              padding: '17px 24px',
                borderRight: i < 3 ? '1px solid #EBECF0' : 'none',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: '#091E42', letterSpacing: '-0.03em', marginBottom: 4 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#344563', marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 12, color: '#97A0AF' }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding: '81px 0', background: '#F4F5F7' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ display: 'inline-block', background: '#DEEBFF', color: '#0052CC', fontSize: 12, fontWeight: 700, padding: '4px 14px', borderRadius: 99, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              How It Works
            </div>
            <h2 style={{ fontSize: 40, fontWeight: 800, color: '#091E42', marginBottom: 16, letterSpacing: '-0.02em' }}>
              End-to-End Test Lifecycle
            </h2>
            <p style={{ fontSize: 18, color: '#42526E', maxWidth: 560, margin: '0 auto' }}>
              A seamless pipeline from your first document to your final PDF report.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 24 }}>
            {workflow.map((w, i) => (
              <div key={i} style={{
                background: 'white', borderRadius: 16, padding: 28,
                border: '1px solid #DFE1E6',
                boxShadow: '0 1px 3px rgba(9,30,66,0.08)',
                position: 'relative',
                transition: 'all 0.2s',
              }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 4,
                  background: w.color, borderRadius: '16px 16px 0 0',
                }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#97A0AF', letterSpacing: '0.1em' }}>{w.step}</span>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: w.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <w.icon size={20} color={w.color} />
                  </div>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#091E42', marginBottom: 10 }}>{w.title}</h3>
                <p style={{ fontSize: 14, color: '#42526E', lineHeight: 1.6 }}>{w.desc}</p>
                {i < 3 && (
                  <div style={{
                    position: 'absolute', right: -17, top: '50%',
                    transform: 'translateY(-50%)',
                    width: 34, height: 34, borderRadius: '50%',
                    background: 'white', border: '2px solid #DFE1E6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1,
                  }}>
                    <ArrowRight size={14} color="#97A0AF" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ padding: '81px 0', background: 'white' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <h2 style={{ fontSize: 40, fontWeight: 800, color: '#091E42', marginBottom: 16, letterSpacing: '-0.02em' }}>
              Built for Enterprise Scale
            </h2>
            <p style={{ fontSize: 18, color: '#42526E', maxWidth: 560, margin: '0 auto' }}>
              Every feature designed to meet the demands of large engineering teams.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 24 }}>
            {features.map((f, i) => (
              <div key={i} style={{
                background: 'white', borderRadius: 16, padding: 28,
                border: '1px solid #DFE1E6',
                boxShadow: '0 1px 3px rgba(9,30,66,0.08)',
                transition: 'all 0.2s',
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: f.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 20,
                }}>
                  <f.icon size={24} color={f.color} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#091E42', marginBottom: 10 }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: '#42526E', lineHeight: 1.65 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding: '81px 0', background: '#F4F5F7' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 32px' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <h2 style={{ fontSize: 40, fontWeight: 800, color: '#091E42', letterSpacing: '-0.02em' }}>
              Frequently Asked Questions
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {faqs.map((faq, i) => (
              <div key={i} style={{
                background: 'white', borderRadius: 12,
                border: '1px solid #DFE1E6',
                overflow: 'hidden',
                transition: 'all 0.2s',
              }}>
                <button
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '20px 24px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#091E42' }}>{faq.q}</span>
                  <ChevronDown
                    size={18} color="#6B778C"
                    style={{ transform: faqOpen === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
                  />
                </button>
                {faqOpen === i && (
                  <div style={{ padding: '0 24px 20px', fontSize: 14, color: '#42526E', lineHeight: 1.7 }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{
        background: 'linear-gradient(135deg, #091E42 0%, #0052CC 100%)',
        padding: '81px 0',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 32px' }}>
          <h2 style={{ fontSize: 48, fontWeight: 800, color: 'white', marginBottom: 20, letterSpacing: '-0.02em' }}>
            Start Your Free Trial
          </h2>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.75)', marginBottom: 40, lineHeight: 1.65 }}>
            Join 500+ engineering teams who trust AutoQA to deliver quality at speed.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
            <Link to="/data-input" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'white', color: '#091E42',
              padding: '0 28px', height: 52, borderRadius: 8,
              fontWeight: 700, fontSize: 16, textDecoration: 'none',
            }}>
              Get Started Free <ArrowRight size={18} />
            </Link>
            <Link to="/contact" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.12)', color: 'white',
              border: '1px solid rgba(255,255,255,0.25)',
              padding: '0 28px', height: 52, borderRadius: 8,
              fontWeight: 600, fontSize: 16, textDecoration: 'none',
            }}>
              Contact Sales
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#091E42', padding: '49px 0 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48, marginBottom: 48 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <rect width="28" height="28" rx="6" fill="#2684FF"/>
                  <path d="M7 14L14 7L21 14L14 21L7 14Z" fill="white" opacity="0.9"/>
                  <path d="M11 14L14 11L17 14L14 17L11 14Z" fill="#0052CC"/>
                </svg>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'white' }}>AutoQA Platform</span>
              </div>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, maxWidth: 300 }}>
                The intelligent quality automation platform for enterprise software teams.
              </p>
            </div>
            {[
              { title: 'Platform', links: [['How It Works', '/how-it-works'], ['Capability', '/capability'], ['Pricing', '/contact']] },
              { title: 'Company', links: [['About', '/about'], ['Contact', '/contact'], ['Careers', '/about']] },
              { title: 'Legal', links: [['Privacy', '/'], ['Terms', '/'], ['Security', '/']] },
            ].map(col => (
              <div key={col.title}>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
                  {col.title}
                </h4>
                {col.links.map(([label, to]) => (
                  <Link key={label} to={to} style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', marginBottom: 10, transition: 'color 0.2s' }}>
                    {label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            © 2024 AutoQA Platform. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
