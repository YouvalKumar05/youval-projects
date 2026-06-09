import React, { useState, useEffect, useRef } from 'react';
import { 
  Inbox as InboxIcon, Send, Archive, Trash2, Star, Search, Plus, 
  Reply, MoreVertical, Paperclip, Hash, Tag, ChevronDown, Edit3, 
  Loader2, AlertCircle, Clock, X, Paperclip as AttachmentIcon,
  Users, Mail, Bell, MessageSquare, Filter, Bookmark, Link as LinkIcon
} from 'lucide-react';
import { api } from '../../services/api';

const TABS = [
  { id: 'inbox', label: 'Inbox', icon: InboxIcon },
  { id: 'sent', label: 'Sent', icon: Send },
  { id: 'starred', label: 'Starred', icon: Star },
  { id: 'drafts', label: 'Drafts', icon: Edit3 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'archive', label: 'Archive', icon: Archive },
];

const Inbox = () => {
  const [activeTab, setActiveTab ] = useState('inbox');
  const [threads, setThreads] = useState([]);
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [selectedThread, setSelectedThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  
  // Compose Modal State
  const [showCompose, setShowCompose] = useState(false);
  const [composeData, setComposeData] = useState({
    to_user_id: '',
    subject: '',
    body: '',
    reference_type: '',
    reference_id: ''
  });

  useEffect(() => {
    fetchThreads();
    fetchUsers();

    // WebSocket for real-time updates
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_BACKEND_URL?.replace('http://', '').replace('https://', '') || '127.0.0.1:8000';
    const socket = new WebSocket(`${protocol}//${host}/ws/dashboard`);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'new_message' || data.type === 'new_reply') {
        fetchThreads();
        if (data.thread_id === selectedThreadId) {
          fetchThreadMessages(data.thread_id);
        }
      }
    };

    return () => socket.close();
  }, [selectedThreadId]);

  const fetchThreads = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/communications/threads');
      if (res.status === 'success') {
        setThreads(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch threads:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/api/rbac/users');
      if (res.status === 'success') {
        setUsers(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  };

  const fetchThreadMessages = async (threadId) => {
    setSelectedThreadId(threadId);
    setMsgLoading(true);
    try {
      const res = await api.get(`/api/communications/threads/${threadId}`);
      if (res.status === 'success') {
        setSelectedThread(res.data);
        setMessages(res.data.messages || []);
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setMsgLoading(false);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedThread) return;
    setSending(true);
    try {
      const res = await api.post(`/api/communications/threads/${selectedThread.id}/reply`, { body: replyText });
      if (res.status === 'success') {
        setReplyText('');
        fetchThreadMessages(selectedThread.id);
      }
    } catch (err) {
      alert("Failed to send reply: " + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleCompose = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await api.post('/api/communications/threads', composeData);
      if (res.status === 'success') {
        setShowCompose(false);
        setComposeData({ to_user_id: '', subject: '', body: '', reference_type: '', reference_id: '' });
        fetchThreads();
      }
    } catch (err) {
      alert("Failed to send message: " + err.message);
    } finally {
      setSending(false);
    }
  };

  const filteredThreads = threads.filter(t => 
    !search || 
    (t.subject || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.last_message?.body || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', background: '#F4F5F7', overflow: 'hidden' }}>
      
      {/* ── LEFT SIDEBAR ── */}
      <div style={{ width: 240, borderRight: '1px solid #DFE1E6', display: 'flex', flexDirection: 'column', background: 'white', padding: '16px 0' }}>
        <div style={{ padding: '0 16px 20px' }}>
          <button 
            className="btn btn--primary" 
            style={{ width: '100%', height: 44, borderRadius: 22, boxShadow: '0 4px 12px rgba(0,82,204,0.2)' }}
            onClick={() => setShowCompose(true)}
          >
            <Plus size={18} /> Compose
          </button>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {TABS.map(tab => (
            <div 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 24px', cursor: 'pointer',
                background: activeTab === tab.id ? '#E3FCEF' : 'transparent',
                color: activeTab === tab.id ? '#006644' : '#42526E',
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: 14, transition: '0.15s', borderLeft: `4px solid ${activeTab === tab.id ? '#36B37E' : 'transparent'}`
              }}
            >
              <tab.icon size={18} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
              {tab.label}
              {tab.id === 'inbox' && threads.some(t => t.unread_count > 0) && (
                <span style={{ marginLeft: 'auto', background: '#FF5630', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 10, fontWeight: 800 }}>
                  {threads.filter(t => t.unread_count > 0).length}
                </span>
              )}
            </div>
          ))}
        </div>

        <div style={{ padding: '20px 24px', borderTop: '1px solid #F4F5F7' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#97A0AF', textTransform: 'uppercase', marginBottom: 12 }}>References</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#42526E' }}>
              <Tag size={14} color="#FF5630" /> Bugs
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#42526E' }}>
              <Bookmark size={14} color="#36B37E" /> Test Cases
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#42526E' }}>
              <Filter size={14} color="#0052CC" /> Tasks
            </div>
          </div>
        </div>
      </div>

      {/* ── MIDDLE PANEL: MESSAGE LIST ── */}
      <div style={{ width: 400, borderRight: '1px solid #DFE1E6', display: 'flex', flexDirection: 'column', background: 'white' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #EBECF0' }}>
          <div className="search-wrapper" style={{ margin: 0, background: '#F4F5F7', border: 'none' }}>
            <Search size={14} color="#6B778C" />
            <input 
              className="search-input" 
              placeholder="Search in messages..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              style={{ background: 'transparent' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
             <span style={{ fontSize: 12, fontWeight: 700, color: '#6B778C' }}>{filteredThreads.length} Conversations</span>
             <button className="icon-btn" style={{ width: 24, height: 24 }}><Filter size={14} /></button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Loader2 className="animate-spin" size={24} color="#0052CC" />
            </div>
          ) : filteredThreads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 80, color: '#97A0AF' }}>
              <Mail size={40} style={{ opacity: 0.2, marginBottom: 16 }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>No messages found</div>
            </div>
          ) : (
            filteredThreads.map(t => (
              <div 
                key={t.id} 
                onClick={() => fetchThreadMessages(t.id)}
                style={{
                  padding: '16px 20px', borderBottom: '1px solid #F4F5F7', cursor: 'pointer',
                  background: selectedThreadId === t.id ? '#F0F4FF' : 'white',
                  transition: '0.1s', borderLeft: `3px solid ${t.unread_count > 0 ? '#0052CC' : 'transparent'}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                   <span style={{ fontSize: 13, fontWeight: 800, color: '#091E42' }}>{t.last_message?.sender || 'System'}</span>
                   <span style={{ fontSize: 11, color: '#97A0AF' }}>{new Date(t.last_message?.created_at || t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#344563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                  {t.subject || '(No Subject)'}
                </div>
                <div style={{ fontSize: 12, color: '#6B778C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.last_message?.body || 'Started a new thread...'}
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  <span className="badge badge--gray" style={{ fontSize: 9 }}>{t.reference_type || 'General'}</span>
                  {t.unread_count > 0 && <span className="badge badge--danger" style={{ fontSize: 9 }}>New</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL: THREAD VIEW ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F8F9FB' }}>
        {selectedThreadId ? (
          <>
            <div style={{ padding: '16px 32px', background: 'white', borderBottom: '1px solid #DFE1E6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 72 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#091E42' }}>
                  {selectedThread?.subject || 'Message Thread'}
                </h3>
                {selectedThread?.reference_type && (
                   <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#0052CC', fontWeight: 700, marginTop: 2 }}>
                     <LinkIcon size={12} /> {selectedThread.reference_type} #{selectedThread.reference_id}
                   </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="icon-btn"><Star size={20} /></button>
                <button className="icon-btn" title="Archive"><Archive size={20} /></button>
                <button className="icon-btn" title="Delete"><Trash2 size={20} /></button>
                <div style={{ width: 1, height: 20, background: '#DFE1E6', margin: '0 4px' }} />
                <button className="icon-btn"><MoreVertical size={20} /></button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
              {msgLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <Loader2 className="animate-spin" size={32} color="#0052CC" />
                </div>
              ) : messages.map((msg, i) => (
                <div key={msg.id} style={{ display: 'flex', gap: 20, maxWidth: '85%', alignSelf: msg.sender?.id === 1 ? 'flex-end' : 'flex-start' }}>
                   {msg.sender?.id !== 1 && (
                     <div style={{ 
                       width: 44, height: 44, borderRadius: '50%', background: '#6554C0', color: 'white', 
                       display: 'flex', alignItems: 'center', justifyContent: 'center', 
                       fontWeight: 800, fontSize: 16, flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                     }}>
                       {msg.sender?.email?.substring(0, 2).toUpperCase() || 'SY'}
                     </div>
                   )}
                   <div style={{ flex: 1 }}>
                     <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6, justifyContent: msg.sender?.id === 1 ? 'flex-end' : 'flex-start' }}>
                       <span style={{ fontWeight: 800, color: '#091E42', fontSize: 14 }}>{msg.sender?.email || 'System'}</span>
                       <span style={{ fontSize: 11, color: '#97A0AF' }}>{new Date(msg.created_at).toLocaleString()}</span>
                     </div>
                     <div style={{ 
                       background: 'white', padding: '20px', borderRadius: 16, border: '1px solid #DFE1E6', 
                       fontSize: 15, color: '#172B4D', lineHeight: 1.6, boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                     }}>
                       {msg.body}
                     </div>
                   </div>
                </div>
              ))}
            </div>

            <div style={{ padding: '24px 32px', background: 'white', borderTop: '1px solid #DFE1E6' }}>
               <div style={{ border: '2px solid #EBECF0', borderRadius: 16, overflow: 'hidden', background: '#FAFBFC' }}>
                 <textarea 
                   style={{ width: '100%', border: 'none', padding: '16px', fontSize: 14, outline: 'none', resize: 'none', minHeight: 120, background: 'transparent' }}
                   placeholder="Reply to this thread..."
                   value={replyText}
                   onChange={e => setReplyText(e.target.value)}
                 />
                 <div style={{ padding: '12px 20px', borderTop: '1px solid #EBECF0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                       <button className="icon-btn-simple"><AttachmentIcon size={18} /></button>
                       <button className="icon-btn-simple"><Users size={18} /></button>
                       <button className="icon-btn-simple"><Tag size={18} /></button>
                    </div>
                    <button 
                      className="btn btn--primary" 
                      onClick={handleReply}
                      disabled={sending || !replyText.trim()}
                      style={{ height: 40, padding: '0 24px', borderRadius: 8 }}
                    >
                      {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      {sending ? 'Sending...' : 'Send Reply'}
                    </button>
                 </div>
               </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#97A0AF', padding: 40 }}>
            <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <InboxIcon size={64} style={{ color: '#0052CC', opacity: 0.2 }} />
            </div>
            <h2 style={{ color: '#091E42', margin: '0 0 8px' }}>Select an item to read</h2>
            <p style={{ margin: 0, fontSize: 15 }}>Click on a conversation from the list to view the full discussion history.</p>
          </div>
        )}
      </div>

      {/* ── COMPOSE MODAL ── */}
      {showCompose && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(9,30,66,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: 600, padding: 0, overflow: 'hidden', animation: 'fadeInScale 0.2s ease-out' }}>
            <div style={{ padding: '16px 24px', background: '#091E42', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>New Message</h3>
              <X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowCompose(false)} />
            </div>
            <form onSubmit={handleCompose} style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div className="form-group">
                  <label className="form-label">Recipient</label>
                  <select 
                    className="form-select" 
                    value={composeData.to_user_id} 
                    onChange={e => setComposeData({...composeData, to_user_id: e.target.value})}
                    required
                  >
                    <option value="">Select User...</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Link Reference</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                     <select 
                       className="form-select" 
                       value={composeData.reference_type} 
                       onChange={e => setComposeData({...composeData, reference_type: e.target.value})}
                       style={{ flex: 1 }}
                     >
                       <option value="">None</option>
                       <option value="Task">Task</option>
                       <option value="Bug">Bug</option>
                       <option value="TestCase">Test Case</option>
                     </select>
                     <input 
                       className="form-input" 
                       placeholder="ID" 
                       style={{ width: 60 }} 
                       value={composeData.reference_id} 
                       onChange={e => setComposeData({...composeData, reference_id: e.target.value})}
                     />
                  </div>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Subject</label>
                <input 
                  className="form-input" 
                  placeholder="e.g. Critical Bug on Login Page" 
                  value={composeData.subject}
                  onChange={e => setComposeData({...composeData, subject: e.target.value})}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 24 }}>
                <label className="form-label">Message内容</label>
                <textarea 
                  className="form-textarea" 
                  rows={8} 
                  placeholder="Type your message here..."
                  value={composeData.body}
                  onChange={e => setComposeData({...composeData, body: e.target.value})}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn--secondary" onClick={() => setShowCompose(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={sending}>
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Send Message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inbox;
