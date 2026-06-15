import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, LineChart, Wallet, Bell, Activity } from 'lucide-react';

const Sidebar = () => {
  const menuItems = [
    { name: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/' },
    { name: 'Discover', icon: <Users size={20} />, path: '/discover' },
    { name: 'Analytics', icon: <LineChart size={20} />, path: '/analytics' },
    { name: 'Wallet', icon: <Wallet size={20} />, path: '/wallet' },
    { name: 'Alerts', icon: <Bell size={20} />, path: '/alerts' },
  ];

  return (
    <aside className="w-64 h-screen border-r border-borderGlass bg-surface/50 backdrop-blur-xl flex flex-col p-4 fixed left-0 top-0">
      <div className="flex items-center gap-3 mb-10 px-2">
        <Activity className="text-primary" size={28} />
        <span className="text-xl font-bold tracking-tight text-white">FlexyTrade</span>
      </div>

      <nav className="flex flex-col gap-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-primary/10 text-primary border border-primary/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]' 
                  : 'text-textMuted hover:bg-white/5 hover:text-white'
              }`
            }
          >
            {item.icon}
            <span className="font-medium">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-4 py-4 border-t border-borderGlass flex items-center gap-3">
        <img src="https://i.pravatar.cc/150?u=current_user" alt="User" className="w-10 h-10 rounded-full border border-borderGlass" />
        <div>
          <p className="text-sm font-semibold text-white">Alex Copier</p>
          <p className="text-xs text-textMuted">Pro Plan</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
