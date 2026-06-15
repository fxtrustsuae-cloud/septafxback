import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';
import StatCard from '../components/common/StatCard';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const mockEquityData = [
  { time: 'Mon', equity: 10000 },
  { time: 'Tue', equity: 10200 },
  { time: 'Wed', equity: 10150 },
  { time: 'Thu', equity: 10400 },
  { time: 'Fri', equity: 10550 },
  { time: 'Sat', equity: 10500 },
  { time: 'Sun', equity: 10850 },
];

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Portfolio Overview</h1>
          <p className="text-textMuted">Welcome back. Here is your copy trading performance.</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Activity size={18} /> Add Funds
        </button>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Equity" 
          value="$10,850.00" 
          change="+8.5%" 
          isPositive={true} 
          icon={<DollarSign className="text-primary" />} 
        />
        <StatCard 
          title="Today's PnL" 
          value="+$350.50" 
          change="+3.2%" 
          isPositive={true} 
          icon={<TrendingUp className="text-success" />} 
        />
        <StatCard 
          title="Active Trades" 
          value="12" 
          change="0" 
          isNeutral={true} 
        />
        <StatCard 
          title="Max Drawdown" 
          value="1.2%" 
          change="-0.5%" 
          isPositive={true} 
          icon={<TrendingDown className="text-danger" />} 
        />
      </div>

      {/* Main Chart */}
      <div className="glass-panel p-6 h-96">
        <h2 className="text-lg font-semibold mb-4 border-b border-borderGlass pb-2">Equity Curve (7 Days)</h2>
        <ResponsiveContainer width="100%" height="85%">
          <AreaChart data={mockEquityData}>
            <defs>
              <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="time" stroke="#94A3B8" tick={{fill: '#94A3B8'}} />
            <YAxis domain={['dataMin - 100', 'dataMax + 100']} stroke="#94A3B8" tick={{fill: '#94A3B8'}} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#121826', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
              itemStyle={{ color: '#F8FAFC' }}
            />
            <Area type="monotone" dataKey="equity" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorEquity)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Feed & Active Copies area would go below */}
    </div>
  );
};

export default Dashboard;
