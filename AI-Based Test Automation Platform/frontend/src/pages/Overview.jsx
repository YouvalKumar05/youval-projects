import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileCode, PlayCircle, CheckCircle, XCircle,
  Bug, ClipboardList, TrendingUp, TrendingDown,
  Minus, RefreshCw, Plus, ArrowRight, Activity,
  AlertTriangle, Zap, Radio, Wifi, WifiOff,
} from 'lucide-react';
import { api } from '../services/api';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

/* ─────────────────────────── constants ─────────────────────────── */
const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';
const WS_BASE  = API_BASE.replace(/^http/, 'ws');

/* ─────────────────────────── helpers ─────────────────────────── */
function timeAgo(isoString) {
  if (!isoString) return '—';
  const diff = Date.now() - new Date(isoString + (isoString.endsWith('Z') ? '' : 'Z')).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return 'Just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function formatNum(n) {
  if (n == null) return '—';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

/* ─────────────────── Loading skeleton ─────────────────── */
const Skeleton = ({ w = '100%', h = 20, radius = 6, mb = 0 }) => (
  <div style={{
    width: w, height: h, borderRadius: radius,
    background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite linear',
    marginBottom: mb,
  }} />
);

/* ═══════════════════ KPI Metric Card ═══════════════════ */
const MetricCard = ({ label, value, icon: Icon, color, trend, subtext, onClick, loading }) => {
  const TrendIcon = trend?.direction === 'up' ? TrendingUp :
                   trend?.direction === 'down' ? TrendingDown : Minus;
  const trendColors = { up: '#36B37E', down: '#FF5630', neutral: '#97A0AF' };
  const trendColor  = trendColors[trend?.direction] || '#97A0AF';

  return (
    <div
      className="metric-card"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', position: 'relative', overflow: 'hidden' }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {/* Accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: '8px 8px 0 0' }} />

      <div className="metric-card-top" style={{ marginTop: 4 }}>
        <div className="metric-icon" style={{ background: color + '18', color, boxShadow: `0 4px 10px ${color}20` }}>
          <Icon size={20} />
        </div>
        {loading ? <Skeleton w={55} h={18} /> : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: trendColor, background: trendColor + '10', padding: '2px 8px', borderRadius: 20 }}>
            <TrendIcon size={12} strokeWidth={3} />
            <span>{trend?.value}</span>
          </div>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <div className="metric-label">{label}</div>
        {loading
          ? <Skeleton w={80} h={32} mb={4} />
          : <div className="metric-value" style={{ margin: '4px 0' }}>{value}</div>
        }
        <div className="metric-subtext" style={{ minHeight: 16 }}>{subtext}</div>
      </div>
    </div>
  );
};

/* ═══════════════════ Execution Trend Line Chart ═══════════════════ */
const ExecutionTrendChart = ({ data, period, onPeriodChange, loading }) => {
  const chartRef = useRef(null);

  const chartData = {
    labels: data.map(d => d.date ? d.date.slice(5) : ''),
    datasets: [
      {
        label: 'Passed',
        data: data.map(d => d.passed),
        borderColor: '#36B37E',
        backgroundColor: 'rgba(54, 179, 126, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: 'Failed',
        data: data.map(d => d.failed),
        borderColor: '#FF5630',
        backgroundColor: 'rgba(255, 86, 48, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      }
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: '#091E42',
        titleFont: { size: 12, weight: '600' },
        bodyFont: { size: 11 },
        padding: 10,
        cornerRadius: 6,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 10 }, color: '#6B778C' }
      },
      y: {
        grid: { color: '#EBECF0', drawBorder: false },
        ticks: { font: { size: 10 }, color: '#6B778C', stepSize: 5 }
      }
    },
  };

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-header-title">Execution Trend</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {['day', 'week', 'month'].map(p => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              style={{
                padding: '3px 11px', borderRadius: 4,
                border: `1px solid ${period === p ? '#0052CC' : '#DFE1E6'}`,
                background: period === p ? '#0052CC' : 'transparent',
                color: period === p ? 'white' : '#6B778C',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                textTransform: 'capitalize', transition: 'all 0.15s ease',
              }}
            >{p}</button>
          ))}
        </div>
      </div>
      <div className="card-body">
        <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
          {[['#36B37E', 'Passed'], ['#FF5630', 'Failed']].map(([c, l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#42526E' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} /> {l}
            </div>
          ))}
        </div>

        <div style={{ height: 180, position: 'relative' }}>
          {loading ? (
            <div style={{ display: 'flex', gap: 6, height: '100%', alignItems: 'flex-end' }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} w="100%" h={`${40 + (i * 15) % 90}px`} radius={3} />
              ))}
            </div>
          ) : data.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#97A0AF', fontSize: 13, gap: 8 }}>
              <Zap size={28} color="#DFE1E6" />
              No execution data for this period
            </div>
          ) : (
            <Line data={chartData} options={options} />
          )}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════ SVG Pie Chart — Bug Severity ═══════════════════ */
const SEV_COLORS = { Critical: '#FF2D55', High: '#FF5630', Medium: '#FFAB00', Low: '#36B37E', Unknown: '#B3BAC5' };

function buildPieSlices(data) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (total === 0) return [];
  let cumAngle = -Math.PI / 2; // Start from top
  const slices = [];
  for (const [label, value] of Object.entries(data)) {
    const angle = (value / total) * 2 * Math.PI;
    slices.push({ label, value, pct: Math.round(value / total * 100), startAngle: cumAngle, endAngle: cumAngle + angle, color: SEV_COLORS[label] || '#B3BAC5' });
    cumAngle += angle;
  }
  return slices;
}

function polarToXY(cx, cy, r, angle) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

const BugPieChart = ({ data, loading, total }) => {
  const [hovered, setHovered] = useState(null);
  const slices = buildPieSlices(data || {});
  const cx = 80, cy = 80, r = 62, innerR = 38;

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-header-title">Bug Severity</span>
        {total > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, background: '#FFEBE6', color: '#c9371c', padding: '2px 8px', borderRadius: 4 }}>
            {total} Open
          </span>
        )}
      </div>
      <div className="card-body" style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        {loading ? (
          <Skeleton w={160} h={160} radius={999} />
        ) : slices.length === 0 ? (
          <div style={{ width: 160, height: 160, borderRadius: '50%', background: '#F4F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ textAlign: 'center', color: '#97A0AF', fontSize: 12 }}>No open<br />bugs 🎉</div>
          </div>
        ) : (
          <svg width={160} height={160} style={{ flexShrink: 0 }}>
            {slices.map((s, i) => {
              const p1 = polarToXY(cx, cy, r, s.startAngle);
              const p2 = polarToXY(cx, cy, r, s.endAngle);
              const pi1 = polarToXY(cx, cy, innerR, s.startAngle);
              const pi2 = polarToXY(cx, cy, innerR, s.endAngle);
              const largeArc = s.endAngle - s.startAngle > Math.PI ? 1 : 0;
              const isHov = hovered === i;
              const scale = isHov ? 1.05 : 1;
              const d = [
                `M ${p1.x} ${p1.y}`,
                `A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
                `L ${pi2.x} ${pi2.y}`,
                `A ${innerR} ${innerR} 0 ${largeArc} 0 ${pi1.x} ${pi1.y}`,
                'Z',
              ].join(' ');
              return (
                <path
                  key={i} d={d} fill={s.color} opacity={isHov ? 1 : 0.88}
                  style={{ cursor: 'pointer', transformOrigin: `${cx}px ${cy}px`, transform: `scale(${scale})`, transition: 'transform 0.15s ease, opacity 0.15s' }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <title>{s.label}: {s.value} ({s.pct}%)</title>
                </path>
              );
            })}
            {/* Center label */}
            <text x={cx} y={cy - 5} textAnchor="middle" style={{ fontSize: 20, fontWeight: 800, fill: '#091E42' }}>
              {total}
            </text>
            <text x={cx} y={cy + 13} textAnchor="middle" style={{ fontSize: 10, fill: '#97A0AF' }}>bugs</text>
          </svg>
        )}

        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={12} radius={4} />)
          ) : (
            Object.entries(data || {}).map(([sev, cnt]) => {
              const pct = total > 0 ? Math.round(cnt / total * 100) : 0;
              return (
                <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: SEV_COLORS[sev] || '#B3BAC5', flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 13, color: '#344563', fontWeight: 500 }}>{sev}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 60, height: 6, background: '#EBECF0', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: SEV_COLORS[sev] || '#B3BAC5', borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#091E42', minWidth: 24, textAlign: 'right' }}>{cnt}</span>
                  </div>
                </div>
              );
            })
          )}
          {!loading && Object.keys(data || {}).length === 0 && (
            <span style={{ fontSize: 12, color: '#97A0AF' }}>No open bugs 🎉</span>
          )}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════ Sprint Progress Bar Chart ═══════════════════ */
const SprintProgressChart = ({ data, loading }) => {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-header-title">Sprint Progress</span>
        <Zap size={14} color="#FFAB00" />
      </div>
      <div className="card-body">
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={28} radius={6} />)}
          </div>
        ) : !data || data.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#97A0AF', fontSize: 13, padding: 24 }}>
            No sprint data available
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {data.map((sprint, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#344563', marginBottom: 5 }}>
                  <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                    {sprint.sprint}
                  </span>
                  <span style={{ fontWeight: 700, color: sprint.completion_pct >= 80 ? '#36B37E' : sprint.completion_pct >= 50 ? '#FFAB00' : '#FF5630' }}>
                    {sprint.completion_pct}%
                  </span>
                </div>
                <div style={{ position: 'relative', height: 8, background: '#EBECF0', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 99,
                    background: `linear-gradient(90deg, ${sprint.completion_pct >= 80 ? '#36B37E' : sprint.completion_pct >= 50 ? '#FFAB00' : '#FF5630'}, ${sprint.completion_pct >= 80 ? '#00B8D9' : sprint.completion_pct >= 50 ? '#FF8B00' : '#FF2D55'})`,
                    width: `${sprint.completion_pct}%`,
                    transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)',
                  }} />
                </div>
                <div style={{ fontSize: 10, color: '#97A0AF', marginTop: 3 }}>
                  {sprint.done}/{sprint.total} tasks done
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════ Activity Feed ═══════════════════ */
const statusColors = { pass: '#36B37E', warn: '#FFAB00', fail: '#FF5630', info: '#0065FF' };
const iconBg       = { bug: '#FF5630', test: '#0065FF', bell: '#FFAB00', default: '#6B778C' };

const ActivityFeed = ({ feed, loading, onItemClick, wsConnected }) => (
  <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
    <div className="card-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="card-header-title">Live Activity Feed</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700 }}>
          {wsConnected ? (
            <><Radio size={9} color="#36B37E" /><span style={{ color: '#36B37E' }}>LIVE</span></>
          ) : (
            <><WifiOff size={9} color="#97A0AF" /><span style={{ color: '#97A0AF' }}>POLLING</span></>
          )}
        </div>
      </div>
      <Activity size={14} color="#97A0AF" />
    </div>
    <div style={{ flex: 1, overflowY: 'auto', maxHeight: 360 }}>
      {loading ? (
        Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 20px', alignItems: 'flex-start' }}>
            <Skeleton w={32} h={32} radius={999} />
            <div style={{ flex: 1 }}><Skeleton w="70%" h={13} mb={6} /><Skeleton w="50%" h={11} /></div>
          </div>
        ))
      ) : feed.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#97A0AF', fontSize: 13 }}>No recent activity</div>
      ) : feed.map((act, i) => (
        <div
          key={i}
          onClick={() => onItemClick && onItemClick(act)}
          style={{ display: 'flex', gap: 12, padding: '10px 20px', alignItems: 'flex-start', borderBottom: '1px solid #F4F5F7', transition: 'background 0.15s', cursor: act.link ? 'pointer' : 'default' }}
          onMouseEnter={e => e.currentTarget.style.background = '#F4F8FF'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: iconBg[act.icon_type] || iconBg.default, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
            {act.initials || '??'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#091E42', fontWeight: 500 }}>
              <strong>{act.user}</strong> — {act.action}
            </div>
            <div style={{ fontSize: 11, color: '#6B778C', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{act.target}</div>
            <div style={{ fontSize: 10, color: '#97A0AF', marginTop: 2 }}>{timeAgo(act.timestamp)}</div>
          </div>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusColors[act.status] || '#97A0AF', marginTop: 6, flexShrink: 0, boxShadow: `0 0 0 3px ${(statusColors[act.status] || '#97A0AF')}30` }} />
        </div>
      ))}
    </div>
  </div>
);

/* ═══════════════════ Execution Summary Panel ═══════════════════ */
const ExecutionSummary = ({ data, loading }) => (
  <div className="card card-body">
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B778C', marginBottom: 14 }}>
      Today's Execution Summary
    </div>
    {loading ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={14} />)}
      </div>
    ) : (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
          {[
            { label: 'Total',  value: data?.total_today ?? 0,        color: '#0052CC' },
            { label: 'Pass',   value: data?.passed_today ?? 0,       color: '#36B37E' },
            { label: 'Fail',   value: data?.failed_today ?? 0,       color: '#FF5630' },
            { label: 'Avg',    value: `${data?.avg_duration_min ?? 0}m`, color: '#FFAB00' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: 'center', padding: '12px 4px', background: '#F4F8FF', borderRadius: 8, border: '1px solid #DEEBFF' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#6B778C', marginTop: 4, textTransform: 'uppercase' }}>{label}</div>
            </div>
          ))}
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#42526E', marginBottom: 5 }}>
            <span>Success Rate</span>
            <span style={{ fontWeight: 700, color: '#36B37E' }}>{data?.success_ratio ?? 0}%</span>
          </div>
          <div style={{ height: 6, background: '#EBECF0', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg, #36B37E, #00B8D9)', borderRadius: 99, width: `${data?.success_ratio ?? 0}%`, transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
          </div>
        </div>
      </>
    )}
  </div>
);

/* ═══════════════════ Task Distribution ═══════════════════ */
const TaskDistribution = ({ data, loading, onNavigate }) => {
  const dist  = data?.distribution || {};
  const total = data?.total || 0;
  const statusConfig = {
    'To Do':       { color: '#6554C0' },
    'In Progress': { color: '#0065FF' },
    'Done':        { color: '#36B37E' },
    'Blocked':     { color: '#FF5630' },
  };
  return (
    <div className="card card-body">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B778C' }}>Task Distribution</div>
        <button onClick={onNavigate} style={{ background: 'none', border: 'none', color: '#0052CC', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
          View All <ArrowRight size={11} />
        </button>
      </div>
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} h={14} />)}
        </div>
      ) : total === 0 ? (
        <div style={{ textAlign: 'center', color: '#97A0AF', fontSize: 13, padding: 20 }}>No tasks found</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Object.entries(statusConfig).map(([status, { color }]) => {
            const count = dist[status] || 0;
            const pct   = total > 0 ? Math.round(count / total * 100) : 0;
            return (
              <div key={status}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#42526E', marginBottom: 4 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
                    {status}
                  </span>
                  <span style={{ fontWeight: 700, color: '#091E42' }}>{count} <span style={{ color: '#97A0AF', fontWeight: 500, fontSize: 11 }}>({pct}%)</span></span>
                </div>
                <div style={{ height: 5, background: '#EBECF0', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.7s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════ MAIN OVERVIEW PAGE ═══════════════════ */
const Overview = () => {
  const navigate = useNavigate();

  const [metrics,      setMetrics]      = useState(null);
  const [trendData,    setTrendData]    = useState([]);
  const [trendPeriod,  setTrendPeriod]  = useState('week');
  const [execSummary,  setExecSummary]  = useState(null);
  const [taskSummary,  setTaskSummary]  = useState(null);
  const [bugSummary,   setBugSummary]   = useState(null);
  const [sprintData,   setSprintData]   = useState([]);
  const [activityFeed, setActivityFeed] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [trendLoading, setTrendLoading] = useState(false);
  const [sprintLoading,setSprintLoading]= useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [error,        setError]        = useState(null);
  const [wsConnected,  setWsConnected]  = useState(false);

  const pollRef = useRef(null);
  const wsRef   = useRef(null);

  /* ── Fetch helpers ── */
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mRes, eSRes, tSRes, bSRes, aRes] = await Promise.all([
        api.get('/api/dashboard/metrics'),
        api.get('/api/dashboard/executions/summary'),
        api.get('/api/dashboard/tasks/summary'),
        api.get('/api/dashboard/bugs/summary'),
        api.get('/api/dashboard/activity/feed?limit=20'),
      ]);
      // All endpoints return { status, data }
      setMetrics(mRes.data);
      setExecSummary(eSRes.data);
      setTaskSummary(tSRes.data);
      setBugSummary(bSRes.data);
      setActivityFeed(aRes.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTrend = useCallback(async (period) => {
    setTrendLoading(true);
    try {
      const res = await api.get(`/api/dashboard/executions/stats?period=${period}`);
      setTrendData(res.data || []);
    } catch {
      setTrendData([]);
    } finally {
      setTrendLoading(false);
    }
  }, []);

  const loadSprint = useCallback(async () => {
    setSprintLoading(true);
    try {
      const res = await api.get('/api/dashboard/sprint/progress');
      // Could be array (full sprint list) or object with progress/total/done
      const d = res.data;
      if (Array.isArray(d)) {
        setSprintData(d);
      } else if (d && typeof d === 'object') {
        // fallback: wrap single summary
        setSprintData([{ sprint: 'Current Sprint', total: d.total, done: d.done, pending: d.total - d.done, completion_pct: d.progress }]);
      } else {
        setSprintData([]);
      }
    } catch {
      setSprintData([]);
    } finally {
      setSprintLoading(false);
    }
  }, []);

  /* ── WebSocket ── */
  const connectWS = useCallback(() => {
    const token = localStorage.getItem('token');
    const url = `${WS_BASE}/ws/dashboard${token ? `?token=${token}` : ''}`;
    try {
      const ws = new WebSocket(url);
      ws.onopen  = () => setWsConnected(true);
      ws.onclose = () => { setWsConnected(false); wsRef.current = null; };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          // On any real-time event, refresh affected section
          if (event.type === 'execution') {
            loadTrend(trendPeriod);
            loadAll();
          } else if (event.type === 'bug') {
            loadAll();
          } else if (event.type === 'task') {
            loadAll();
          }
        } catch { /* ignore */ }
      };
      wsRef.current = ws;
    } catch { /* WebSocket not available */ }
  }, [loadAll, loadTrend, trendPeriod]);

  /* ── Effects ── */
  useEffect(() => {
    loadAll();
    loadTrend('week');
    loadSprint();

    // WS
    connectWS();

    // Poll activity feed every 30 s (fallback when WS is down)
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get('/api/dashboard/activity/feed?limit=20');
        setActivityFeed(res.data || []);
      } catch { /* silent */ }
    }, 30_000);

    return () => {
      clearInterval(pollRef.current);
      if (wsRef.current) wsRef.current.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadTrend(trendPeriod); }, [trendPeriod, loadTrend]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadAll(), loadTrend(trendPeriod), loadSprint()]);
    setRefreshing(false);
  };

  /* ── Metric card config ── */
  const metricCards = [
    { key: 'total_test_cases',  label: 'Total Test Cases',  icon: FileCode,      color: '#2684FF', nav: '/data-input' },
    { key: 'executed_today',    label: 'Tests Executed Today',icon: PlayCircle,   color: '#6554C0', nav: '/execution-dashboard' },
    { key: 'pass_rate',         label: 'Pass Rate (%)',     icon: CheckCircle,   color: '#36B37E', nav: null, fmt: v => `${v}%` },
    { key: 'active_bugs',       label: 'Active Bugs',       icon: Bug,           color: '#FF5630', nav: '/reports' },
    { key: 'pending_approvals', label: 'Pending Approvals', icon: ClipboardList, color: '#FFAB00', nav: '/tasks' },
  ];

  const bugBySeverity = bugSummary?.by_severity || {};
  const bugTotal      = bugSummary?.open ?? 0;

  return (
    <div className="page-container animate-fade-in-up">

      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Executive Dashboard</h1>
          <p className="page-subtitle">Real-time quality metrics, executions &amp; activity across your STLC</p>
        </div>
        <div className="page-actions">
          <button
            className="btn btn--secondary"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            className="btn btn--primary"
            onClick={() => navigate('/data-input')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={14} /> New Session
          </button>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div style={{ background: '#FFEBE6', border: '1px solid #FF563060', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: '#9e2a0e', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={14} /> {error}
          <button onClick={loadAll} style={{ marginLeft: 'auto', background: 'none', border: '1px solid #FF563060', padding: '2px 10px', borderRadius: 4, color: '#9e2a0e', cursor: 'pointer', fontSize: 12 }}>Retry</button>
        </div>
      )}

      {/* ── KPI Cards (5 columns) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 22 }}>
        {metricCards.map(({ key, label, icon, color, nav, fmt }) => {
          const m = metrics?.[key];
          const raw = m?.value ?? null;
          const displayVal = fmt && raw != null ? fmt(raw) : (raw != null ? formatNum(raw) : '—');
          return (
            <MetricCard
              key={key}
              label={label}
              value={displayVal}
              icon={icon}
              color={color}
              trend={m?.trend}
              subtext={m?.subtext ?? ''}
              loading={loading}
              onClick={nav ? () => navigate(nav) : undefined}
            />
          );
        })}
      </div>

      {/* ── Row 2: Trend Chart + Bug Pie + Sprint Progress ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px 280px', gap: 20, marginBottom: 20 }}>
        <ExecutionTrendChart
          data={trendData}
          period={trendPeriod}
          onPeriodChange={setTrendPeriod}
          onBarClick={() => navigate('/execution-dashboard')}
          loading={trendLoading}
        />
        <BugPieChart data={bugBySeverity} loading={loading} total={bugTotal} />
        <SprintProgressChart data={sprintData} loading={sprintLoading} />
      </div>

      {/* ── Row 3: Activity Feed + Exec Summary + Tasks ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px 260px', gap: 20, marginBottom: 20 }}>
        <ActivityFeed
          feed={activityFeed}
          loading={loading}
          onItemClick={(act) => act.link && navigate(act.link)}
          wsConnected={wsConnected}
        />
        <ExecutionSummary data={execSummary} loading={loading} />
        <TaskDistribution data={taskSummary} loading={loading} onNavigate={() => navigate('/tasks')} />
      </div>

      {/* Shimmer keyframe */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Overview;
