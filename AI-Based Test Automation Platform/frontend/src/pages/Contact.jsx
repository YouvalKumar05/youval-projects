import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Send, CheckCircle, Building, Globe, Clock } from 'lucide-react';

const Contact = () => {
  const [form, setForm] = useState({ name: '', email: '', company: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    setLoading(false);
    setSent(true);
  };

  const contactDetails = [
    { icon: Mail, label: 'Email', value: 'enterprise@autoqa.io', sub: 'Response within 4 hours' },
    { icon: Phone, label: 'Phone', value: '+1 (888) 286-2692', sub: 'Mon–Fri, 9am–6pm EST' },
    { icon: MapPin, label: 'HQ', value: 'San Francisco, CA', sub: 'United States' },
    { icon: Globe, label: 'Global Support', value: 'support.autoqa.io', sub: '24/7 via portal' },
  ];

  const subjects = ['General Inquiry', 'Enterprise Demo', 'Pricing & Plans', 'Technical Support', 'Partnership', 'Other'];

  return (
    <div style={{ background: 'white', minHeight: '100vh' }}>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #091E42 0%, #0052CC 100%)', padding: '80px 0 60px', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 99, padding: '6px 16px', marginBottom: 20 }}>
            <Building size={13} color="#93C5FD" />
            <span style={{ fontSize: 13, color: '#93C5FD', fontWeight: 600 }}>Enterprise Sales & Support</span>
          </div>
          <h1 style={{ fontSize: 48, fontWeight: 800, color: 'white', marginBottom: 16, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            Get in Touch
          </h1>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)', lineHeight: 1.65 }}>
            Ready to transform your QA process? Our enterprise team is standing by.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 64, alignItems: 'start' }}>

          {/* Form */}
          {sent ? (
            <div style={{ textAlign: 'center', padding: '80px 40px' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#E3FCEF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <CheckCircle size={36} color="#36B37E" />
              </div>
              <h2 style={{ fontSize: 28, fontWeight: 800, color: '#091E42', marginBottom: 12 }}>Message Sent!</h2>
              <p style={{ fontSize: 16, color: '#6B778C', marginBottom: 32, lineHeight: 1.65 }}>
                Thanks for reaching out. A member of our enterprise team will contact you within <strong>4 business hours</strong>.
              </p>
              <button onClick={() => { setSent(false); setForm({ name: '', email: '', company: '', subject: '', message: '' }); }}
                className="btn btn--secondary btn--lg">
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: '#091E42', marginBottom: 28 }}>Send Us a Message</h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" placeholder="Sarah Chen" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Work Email *</label>
                  <input type="email" className="form-input" placeholder="sarah@company.com" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Company</label>
                  <input className="form-input" placeholder="Acme Corp" value={form.company}
                    onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Subject *</label>
                  <select className="form-select" value={form.subject}
                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} required>
                    <option value="">Select a topic...</option>
                    {subjects.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 28 }}>
                <label className="form-label">Message *</label>
                <textarea className="form-textarea" rows={6} placeholder="Tell us about your team size, current testing challenges, and what you're hoping AutoQA can help with..."
                  value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} required
                  style={{ minHeight: 160 }}
                />
              </div>

              <button type="submit" disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  height: 48, padding: '0 28px', background: '#0052CC', color: 'white',
                  border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.8 : 1,
                  fontFamily: 'inherit', transition: 'all 0.2s',
                }}>
                <Send size={16} /> {loading ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          )}

          {/* Right: Contact Details */}
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#091E42', marginBottom: 28 }}>Contact Information</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 40 }}>
              {contactDetails.map(c => (
                <div key={c.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '20px', background: '#F4F5F7', borderRadius: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: '#DEEBFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <c.icon size={20} color="#0052CC" />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#97A0AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{c.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#091E42', marginBottom: 3 }}>{c.value}</div>
                    <div style={{ fontSize: 12, color: '#6B778C' }}>{c.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* SLA Box */}
            <div style={{ background: 'linear-gradient(135deg, #091E42, #0052CC)', borderRadius: 16, padding: '28px 24px', color: 'white' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <Clock size={20} color="#60A5FA" />
                <span style={{ fontWeight: 700, fontSize: 15 }}>Enterprise SLA</span>
              </div>
              {[
                { label: 'Onboarding Support', val: '< 1 day' },
                { label: 'Feature Requests', val: '< 1 week' },
                { label: 'Critical Bug Fix', val: '< 4 hours' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: 14 }}>
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>{s.label}</span>
                  <span style={{ fontWeight: 700, color: '#4ADE80' }}>{s.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
