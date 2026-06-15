import React from 'react';
import TraderCard from '../components/common/TraderCard';
import { Search, Filter } from 'lucide-react';

const mockTraders = [
  { id: 1, name: 'AlphaTrader_99', roi: '+45.2%', drawdown: '1.2%', followers: 1240, risk: 'Low Risk' },
  { id: 2, name: 'ZenWealth', roi: '+12.4%', drawdown: '0.8%', followers: 890, risk: 'Low Risk' },
  { id: 3, name: 'CryptoWhale', roi: '+120.5%', drawdown: '15.5%', followers: 4500, risk: 'High Risk' },
  { id: 4, name: 'ForexSniper', roi: '+33.1%', drawdown: '4.2%', followers: 310, risk: 'Medium Risk' },
];

const Discovery = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Discover Traders</h1>
          <p className="text-textMuted">Find top performing master traders to copy.</p>
        </div>
        
        <div className="flex gap-4 border border-borderGlass bg-surface/50 p-2 rounded-xl">
          <div className="flex items-center gap-2 px-3 text-textMuted">
            <Search size={18} />
            <input type="text" placeholder="Search traders..." className="bg-transparent outline-none text-white w-48" />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors border-l border-borderGlass">
            <Filter size={18} /> Filters
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {mockTraders.map(trader => (
          <TraderCard key={trader.id} trader={trader} />
        ))}
      </div>
    </div>
  );
};

export default Discovery;
