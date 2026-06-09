import React from 'react';
import { TrendingUp } from 'lucide-react';

export const MetricCard = ({ label, value, icon: Icon, trend, subtext, color }) => {
  const cardColor = color || '#2684FF';
  const isPositive = !trend?.startsWith('-');

  return (
    <div className="metric-card">
      <div className="metric-card-top">
        <div className="metric-icon" style={{ background: cardColor + '18', color: cardColor }}>
          {Icon && <Icon size={18} />}
        </div>
        {trend && (
          <div className={`metric-trend ${isPositive ? 'up' : 'down'}`}>
            <TrendingUp size={11} />
            {trend}
          </div>
        )}
      </div>
      <div>
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value}</div>
        {subtext && <div className="metric-subtext">{subtext}</div>}
      </div>
    </div>
  );
};

export default MetricCard;