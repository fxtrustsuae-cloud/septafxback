import React from 'react';

const StatCard = ({ title, value, change, isPositive, isNeutral, icon }) => {
  return (
    <div className="glass-panel p-5 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <p className="text-textMuted font-medium text-sm">{title}</p>
        {icon && <div className="p-2 bg-white/5 rounded-lg">{icon}</div>}
      </div>
      <div>
        <h3 className="text-2xl font-bold text-white mb-1">{value}</h3>
        {!isNeutral && (
          <span className={`text-sm font-semibold flex items-center gap-1 ${isPositive ? 'text-success' : 'text-danger'}`}>
            {isPositive ? '↑' : '↓'} {change}
          </span>
        )}
      </div>
    </div>
  );
};

export default StatCard;
