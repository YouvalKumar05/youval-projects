import React from 'react';
import { Link } from 'react-router-dom';
import { Target, Eye, Award, Users, ArrowRight } from 'lucide-react';

const TEAM = [
  { name: 'Youval Kumar', role: 'Founder & CEO', initials: 'YK', color: '#2684FF', bio: 'Former engineering director with 15 years in enterprise QA automation.' },
  { name: 'Sarah Chen', role: 'Head of AI', initials: 'SC', color: '#6554C0', bio: 'Led ML research at two Fortune 500 companies before joining AutoQA.' },
  { name: 'Marcus Rivera', role: 'CTO', initials: 'MR', color: '#36B37E', bio: 'Built and scaled distributed testing infrastructure at scale.' },
  { name: 'Priya Mehta', role: 'VP of Product', initials: 'PM', color: '#FF5630', bio: 'Product leader obsessed with developer experience and quality tooling.' },
];

const VALUES = [
  { icon: Target, title: 'Quality First', desc: 'We believe every software team deserves powerful quality tools, regardless of size.' },
  { icon: Eye, title: 'Radical Transparency', desc: 'We build in public, share our roadmap openly, and communicate with honesty.' },
  { icon: Award, title: 'Enterprise Grade', desc: 'Security, compliance, and reliability are non-negotiable in everything we ship.' },
  { icon: Users, title: 'Team Empowerment', desc: 'Our tools amplify human expertise — AI assists, engineers decide.' },
];

const About = () => (
  <div style={{ background: 'white', minHeight: '100vh' }}>
    {/* Hero */}
    <section style={{ background: 'linear-gradient(135deg, #091E42 0%, #0052CC 100%)', padding: '88px 0 72px', textAlign: 'center' }}>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 32px' }}>
        <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 99, padding: '6px 16px', marginBottom: 20 }}>
          <span style={{ fontSize: 13, color: '#93C5FD', fontWeight: 600 }}>Our Story</span>
        </div>
        <h1 style={{ fontSize: 52, fontWeight: 800, color: 'white', lineHeight: 1.12, letterSpacing: '-0.02em', marginBottom: 20 }}>
          We're Building the Future of Software Quality
        </h1>
        <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.72)', lineHeight: 1.7 }}>
          AutoQA was born from a simple frustration: enterprise QA teams spending more time managing spreadsheets than actually improving quality.
        </p>
      </div>
    </section>

    {/* Mission */}
    <section style={{ padding: '88px 0', background: '#F4F5F7' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-block', background: '#DEEBFF', color: '#0052CC', fontSize: 12, fontWeight: 700, padding: '4px 14px', borderRadius: 99, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Our Mission
            </div>
            <h2 style={{ fontSize: 40, fontWeight: 800, color: '#091E42', marginBottom: 20, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Making Enterprise QA Intelligent
            </h2>
            <p style={{ fontSize: 16, color: '#42526E', lineHeight: 1.75, marginBottom: 16 }}>
              We built AutoQA to eliminate the gap between requirements and reliable automated tests. Our AI engine reads what your team writes and produces executable Playwright scripts — no boilerplate, no guesswork.
            </p>
            <p style={{ fontSize: 16, color: '#42526E', lineHeight: 1.75 }}>
              Founded in 2022, we serve 500+ engineering teams across 42 countries, saving an average of 128 hours of manual testing effort per team per month.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {[
              { val: '500+', label: 'Enterprise Customers' },
              { val: '42', label: 'Countries' },
              { val: '128h', label: 'Avg Hours Saved/Month' },
              { val: '2022', label: 'Founded' },
            ].map(s => (
              <div key={s.val} style={{ background: 'white', borderRadius: 16, padding: '28px 20px', textAlign: 'center', border: '1px solid #DFE1E6', boxShadow: '0 1px 3px rgba(9,30,66,0.08)' }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: '#0052CC', letterSpacing: '-0.03em', marginBottom: 6 }}>{s.val}</div>
                <div style={{ fontSize: 13, color: '#6B778C', fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>

    {/* Values */}
    <section style={{ padding: '88px 0', background: 'white' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontSize: 40, fontWeight: 800, color: '#091E42', letterSpacing: '-0.02em', marginBottom: 14 }}>What We Stand For</h2>
          <p style={{ fontSize: 17, color: '#42526E', maxWidth: 540, margin: '0 auto' }}>Four principles that guide every product decision we make.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 24 }}>
          {VALUES.map((v, i) => (
            <div key={i} style={{ background: '#F4F5F7', borderRadius: 16, padding: '28px 24px', border: '1px solid #DFE1E6' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#DEEBFF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                <v.icon size={22} color="#0052CC" />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#091E42', marginBottom: 10 }}>{v.title}</h3>
              <p style={{ fontSize: 14, color: '#42526E', lineHeight: 1.65 }}>{v.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Team */}
    <section style={{ padding: '88px 0', background: '#F4F5F7' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontSize: 40, fontWeight: 800, color: '#091E42', letterSpacing: '-0.02em', marginBottom: 14 }}>Leadership Team</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 24 }}>
          {TEAM.map((m, i) => (
            <div key={i} style={{ background: 'white', borderRadius: 16, padding: '32px 24px', textAlign: 'center', border: '1px solid #DFE1E6', boxShadow: '0 1px 3px rgba(9,30,66,0.08)' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: m.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, margin: '0 auto 20px' }}>
                {m.initials}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#091E42', marginBottom: 4 }}>{m.name}</div>
              <div style={{ fontSize: 13, color: '#0052CC', fontWeight: 600, marginBottom: 12 }}>{m.role}</div>
              <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.6 }}>{m.bio}</div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section style={{ background: 'linear-gradient(135deg, #091E42 0%, #0052CC 100%)', padding: '88px 0', textAlign: 'center' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 32px' }}>
        <h2 style={{ fontSize: 42, fontWeight: 800, color: 'white', marginBottom: 16, letterSpacing: '-0.02em' }}>Ready to Join Us?</h2>
        <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.72)', marginBottom: 36 }}>Start your free trial or talk to our enterprise team.</p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
          <Link to="/data-input" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 50, padding: '0 28px', background: 'white', color: '#091E42', borderRadius: 8, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
            Get Started <ArrowRight size={17} />
          </Link>
          <Link to="/contact" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 50, padding: '0 28px', background: 'rgba(255,255,255,0.12)', color: 'white', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>
            Contact Sales
          </Link>
        </div>
      </div>
    </section>
  </div>
);

export default About;
