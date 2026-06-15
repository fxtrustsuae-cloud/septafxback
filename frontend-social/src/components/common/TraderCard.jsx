import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ShieldCheck, Users } from 'lucide-react';

const TraderCard = ({ trader }) => {
  const isHighRisk = trader.risk === 'High Risk';
  
  return (
    <div className="glass-panel p-5 flex flex-col group hover:-translate-y-1 transition-transform relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-success opacity-0 group-hover:opacity-100 transition-opacity"></div>
      
      <div className="flex justify-between items-start mb-4">
        <img 
          src={`https://i.pravatar.cc/150?u=${trader.id}`} 
          alt={trader.name} 
          className="w-14 h-14 rounded-full border-2 border-primary object-cover" 
        />
        <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${isHighRisk ? 'text-danger bg-danger/10 border-danger/20' : 'text-success bg-success/10 border-success/20'} border`}>
          {isHighRisk ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
          {trader.risk}
        </span>
      </div>

      <h3 className="text-xl font-bold text-white tracking-tight mb-4">{trader.name}</h3>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-textMuted text-xs mb-1">Total ROI</p>
          <p className="text-success font-semibold">{trader.roi}</p>
        </div>
        <div>
          <p className="text-textMuted text-xs mb-1">Max Drawdown</p>
          <p className="text-white font-semibold">{trader.drawdown}</p>
        </div>
        <div>
          <p className="text-textMuted text-xs mb-1 flex items-center gap-1"><Users size={12}/> Copiers</p>
          <p className="text-white font-semibold">{trader.followers}</p>
        </div>
      </div>

      <div className="mt-auto flex gap-2">
        <Link to={`/trader/${trader.id}`} className="btn-primary w-full text-center text-sm py-2">
          View Profile
        </Link>
      </div>
    </div>
  );
};

export default TraderCard;
