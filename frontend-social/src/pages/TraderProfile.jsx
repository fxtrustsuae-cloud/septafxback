import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Settings2, Play, Users, Flag } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const mockCurve = [
  { month: 'Jan', eq: 10000 }, { month: 'Feb', eq: 10500 }, { month: 'Mar', eq: 10200 },
  { month: 'Apr', eq: 11000 }, { month: 'May', eq: 11400 }, { month: 'Jun', eq: 12100 }
];

const TraderProfile = () => {
  const { id } = useParams();
  const [showCopyPanel, setShowCopyPanel] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header Profile */}
      <div className="glass-panel flex gap-8 items-center relative overflow-hidden">
        <img src={`https://i.pravatar.cc/150?u=${id || '1'}`} className="w-24 h-24 rounded-full border-4 border-primary z-10" />
        <div className="z-10 flex-1">
          <h1 className="text-3xl font-bold text-white mb-2">AlphaTrader_99</h1>
          <p className="text-textMuted max-w-2xl">Quantitative algorithm specialist focusing on EUR/USD and Gold momentum breakouts. Strict max drawdown limits applied daily.</p>
        </div>
        <div className="z-10 flex gap-4">
          <button className="bg-surface border border-borderGlass px-4 py-2 rounded-lg hover:border-textMuted transition">
            Follow
          </button>
          <button onClick={() => setShowCopyPanel(true)} className="btn-primary flex items-center gap-2">
            <Play size={18} /> Start Copying
          </button>
        </div>
        {/* Background glow */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/20 blur-[100px] rounded-full"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Analytics Left side */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel h-80">
            <h2 className="text-lg font-semibold mb-4 border-b border-borderGlass pb-2">Equity Growth</h2>
            <ResponsiveContainer width="100%" height="85%">
              <AreaChart data={mockCurve}>
                <defs>
                  <linearGradient id="eqG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#94A3B8" />
                <Tooltip contentStyle={{ backgroundColor: '#121826', borderColor: 'rgba(255,255,255,0.1)' }} />
                <Area type="monotone" dataKey="eq" stroke="#10B981" strokeWidth={3} fill="url(#eqG)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Copy Settings Panel (Right side if active, or stats) */}
        {showCopyPanel ? (
          <div className="glass-panel border-primary/50 relative">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-6 border-b border-borderGlass pb-2 text-white">
              <Settings2 className="text-primary"/> Copy Settings
            </h2>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-textMuted mb-2">Investment Amount (USD)</label>
                <input type="number" defaultValue={1000} className="w-full bg-surface border border-borderGlass rounded-lg p-3 text-white outline-none focus:border-primary" />
              </div>
              
              <div>
                <label className="block text-sm text-textMuted mb-2">Max Drawdown Limit (%)</label>
                <input type="number" defaultValue={15} max={100} className="w-full bg-surface border border-borderGlass rounded-lg p-3 text-white outline-none focus:border-primary" />
                <p className="text-xs text-textMuted mt-1">Stops copying if equity drops by this percentage.</p>
              </div>

              <div>
                <label className="block text-sm text-textMuted mb-2">Lot Multiplier</label>
                <input type="number" defaultValue={1.0} step="0.1" className="w-full bg-surface border border-borderGlass rounded-lg p-3 text-white outline-none focus:border-primary" />
              </div>

              <div className="pt-4 border-t border-borderGlass">
                <button className="btn-success w-full py-3 text-lg font-bold">Confirm & Start</button>
                <button onClick={() => setShowCopyPanel(false)} className="w-full text-center mt-3 text-textMuted hover:text-white transition">Cancel</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-panel">
            <h2 className="text-xl font-bold mb-4 border-b border-borderGlass pb-2">Strategy Stats</h2>
            <div className="space-y-4">
              <div className="flex justify-between"><span className="text-textMuted">Performance Fee</span><span className="font-semibold">20% High-Water</span></div>
              <div className="flex justify-between"><span className="text-textMuted">Win Rate</span><span className="font-semibold text-success">68.4%</span></div>
              <div className="flex justify-between"><span className="text-textMuted">Sharpe Ratio</span><span className="font-semibold">1.54</span></div>
              <div className="flex justify-between"><span className="text-textMuted">Copiers</span><span className="font-semibold flex items-center gap-1"><Users size={14}/> 1,240</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TraderProfile;
