import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Cpu, PlayCircle, FileText, ChevronRight, ArrowRight, Check } from 'lucide-react';

const STEPS = [
  {
    n: '01', icon: Upload, color: '#2684FF',
    title: 'Connect Your Documents',
    subtitle: 'Upload any format — we handle the parsing',
    desc: 'AutoQA accepts PDF, DOCX, XLSX, TXT and ZIP archives. Simply drag and drop your requirement specs, user stories, or API contracts into the platform.',
    details: ['PDFs with tables and diagrams', 'Word documents and Excel specs', 'Raw requirement text', 'Swagger / OpenAPI contracts'],
  },
  {
    n: '02', icon: Cpu, color: '#6554C0',
    title: 'AI Analysis Engine',
    subtitle: 'NLP-powered test case extraction in seconds',
    desc: 'Our fine-tuned language model reads your documents and automatically identifies functional scenarios, edge cases, negative paths, and acceptance criteria.',
    details: ['Coverage gap detection', 'Duplicate scenario merging', 'Priority classification', 'Requirement traceability mapping'],
  },
  {
    n: '03', icon: PlayCircle, color: '#36B37E',
    title: 'One-Click Execution',
    subtitle: 'Playwright scripts generated and run automatically',
    desc: 'AutoQA converts analyzed scenarios into production-ready Playwright tests. Launch cross-browser runs against any environment with a single click.',
    details: ['Chromium, Firefox, WebKit', 'Parallel execution at scale', 'Screenshot on failure', 'Video recording of runs'],
  },
  {
    n: '04', icon: FileText, color: '#FFAB00',
    title: 'Intelligent Reports',
    subtitle: 'PDF reports with full traceability',
    desc: 'Every test run generates a comprehensive PDF report linking results back to original requirements, with trend analysis and coverage metrics.',
    details: ['Requirement-to-test traceability', 'Executive summary view', 'Failure video evidence', 'Historical trend charts'],
  },
];

const HowItWorks = () => {
  const [activeStep, setActiveStep] = useState(0);
  const step = STEPS[activeStep];

  return (
    <div style={{ background: 'white', minHeight: '100vh' }}>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #091E42 0%, #0052CC 100%)', padding: '88px 0 72px', textAlign: 'center' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 32px' }}>
          <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 99, padding: '6px 16px', marginBottom: 20 }}>
            <span style={{ fontSize: 13, color: '#93C5FD', fontWeight: 600 }}>The AutoQA Workflow</span>
          </div>
          <h1 style={{ fontSize: 52, fontWeight: 800, color: 'white', lineHeight: 1.12, letterSpacing: '-0.02em', marginBottom: 20 }}>
            How AutoQA Works
          </h1>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.72)', lineHeight: 1.7 }}>
            From your first document upload to a production-ready test report — in under 10 minutes.
          </p>
        </div>
      </section>

      {/* Interactive Step Explorer */}
      <section style={{ padding: '88px 0', background: '#F4F5F7' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px' }}>

          {/* Step Tabs */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 48, justifyContent: 'center', flexWrap: 'wrap' }}>
            {STEPS.map((s, i) => (
              <button key={i}
                onClick={() => setActiveStep(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 20px', borderRadius: 12,
                  border: `2px solid ${activeStep === i ? s.color : '#DFE1E6'}`,
                  background: activeStep === i ? s.color + '12' : 'white',
                  cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: activeStep === i ? s.color : '#EBECF0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {activeStep === i
                    ? <s.icon size={14} color="white" />
                    : <span style={{ fontSize: 12, fontWeight: 700, color: '#97A0AF' }}>{s.n}</span>
                  }
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: activeStep === i ? '#091E42' : '#6B778C', whiteSpace: 'nowrap' }}>
                  {s.title}
                </span>
              </button>
            ))}
          </div>

          {/* Step Detail */}
          <div key={activeStep} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center', animation: 'fadeIn 0.3s ease' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: step.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <step.icon size={24} color={step.color} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#97A0AF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Step {step.n}</span>
              </div>
              <h2 style={{ fontSize: 36, fontWeight: 800, color: '#091E42', marginBottom: 10, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                {step.title}
              </h2>
              <p style={{ fontSize: 15, color: '#0052CC', fontWeight: 600, marginBottom: 20 }}>{step.subtitle}</p>
              <p style={{ fontSize: 16, color: '#42526E', lineHeight: 1.75, marginBottom: 28 }}>{step.desc}</p>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {step.details.map((d, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: step.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Check size={12} color="white" />
                    </div>
                    <span style={{ fontSize: 15, color: '#344563' }}>{d}</span>
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: 36, display: 'flex', gap: 12 }}>
                {activeStep < STEPS.length - 1 && (
                  <button onClick={() => setActiveStep(activeStep + 1)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 20px', background: step.color, color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}>
                    Next Step <ArrowRight size={15} />
                  </button>
                )}
                {activeStep === STEPS.length - 1 && (
                  <Link to="/data-input" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 20px', background: '#36B37E', color: 'white', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
                    Start for Free <ArrowRight size={15} />
                  </Link>
                )}
              </div>
            </div>

            {/* Right panel: mock UI */}
            <div style={{ background: '#0d1b2a', borderRadius: 20, padding: 24, boxShadow: '0 24px 60px rgba(9,30,66,0.25)' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5630' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFAB00' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#36B37E' }} />
              </div>

              {activeStep === 0 && (
                <div>
                  <div style={{ border: '2px dashed rgba(255,255,255,0.2)', borderRadius: 12, padding: '32px', textAlign: 'center', marginBottom: 16 }}>
                    <Upload size={28} color="rgba(255,255,255,0.4)" style={{ margin: '0 auto 12px' }} />
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Drop files here</div>
                  </div>
                  {['requirements_v2.pdf', 'api_contract.yaml', 'user_stories.docx'].map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.06)', borderRadius: 8, marginBottom: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#36B37E', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>{f}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: '#36B37E', fontWeight: 700 }}>Ready</span>
                    </div>
                  ))}
                </div>
              )}

              {activeStep === 1 && (
                <div>
                  <div style={{ fontSize: 10, color: '#4B5563', marginBottom: 12, fontFamily: 'monospace' }}>AI Engine • Processing...</div>
                  {[
                    { msg: '✓ Parsed 48 requirements', c: '#4ADE80' },
                    { msg: '✓ Identified 124 test scenarios', c: '#4ADE80' },
                    { msg: '✓ Found 3 coverage gaps', c: '#FCD34D' },
                    { msg: '→ Generating test case matrix...', c: '#60A5FA' },
                    { msg: '▋', c: '#60A5FA' },
                  ].map((l, i) => (
                    <div key={i} style={{ fontSize: 12, color: l.c, fontFamily: 'monospace', marginBottom: 8 }}>{l.msg}</div>
                  ))}
                </div>
              )}

              {activeStep === 2 && (
                <div>
                  {[
                    { name: 'TC-001: Login Flow', s: 'pass', d: '1.23s' },
                    { name: 'TC-002: Invalid Credentials', s: 'pass', d: '0.87s' },
                    { name: 'TC-003: Checkout — CC', s: 'fail', d: '4.21s' },
                    { name: 'TC-004: Add to Cart', s: 'pass', d: '2.01s' },
                  ].map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: 8, marginBottom: 8, borderLeft: `3px solid ${r.s === 'pass' ? '#36B37E' : '#FF5630'}` }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{r.name}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: '#6B778C' }}>{r.d}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: r.s === 'pass' ? '#36B37E' : '#FF5630', textTransform: 'uppercase' }}>{r.s}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeStep === 3 && (
                <div>
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Execution Summary</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                      {[{ v: '119', l: 'Pass', c: '#36B37E' }, { v: '5', l: 'Fail', c: '#FF5630' }, { v: '96%', l: 'Rate', c: '#2684FF' }].map(s => (
                        <div key={s.l} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: s.c }}>{s.v}</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{s.l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <FileText size={16} color="#60A5FA" />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>checkout_regression_v2.pdf</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: '#60A5FA', fontWeight: 700 }}>DOWNLOAD</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Timeline Ribbon */}
      <section style={{ padding: '88px 0', background: 'white' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: '#091E42', marginBottom: 16, letterSpacing: '-0.02em' }}>From Upload to Report in Minutes</h2>
          <p style={{ fontSize: 16, color: '#6B778C', maxWidth: 540, margin: '0 auto 52px', lineHeight: 1.65 }}>
            The entire AutoQA workflow typically completes in under 10 minutes for a standard requirements document.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, justifyContent: 'center' }}>
            {[
              { label: 'Upload', time: '< 1 min', color: '#2684FF' },
              { label: 'Analysis', time: '2–3 min', color: '#6554C0' },
              { label: 'Execution', time: '3–5 min', color: '#36B37E' },
              { label: 'Report', time: '< 30 sec', color: '#FFAB00' },
            ].map((t, i) => (
              <React.Fragment key={t.label}>
                <div style={{ textAlign: 'center', minWidth: 140 }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: t.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 20, fontWeight: 800 }}>{i + 1}</div>
                  <div style={{ fontWeight: 700, color: '#091E42', marginBottom: 4 }}>{t.label}</div>
                  <div style={{ fontSize: 13, color: '#6B778C' }}>{t.time}</div>
                </div>
                {i < 3 && <div style={{ flex: 1, height: 3, background: '#DFE1E6', margin: '0 8px', marginBottom: 28 }} />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default HowItWorks;
