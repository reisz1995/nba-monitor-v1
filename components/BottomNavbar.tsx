
import React from 'react';
import { LayoutGrid, Lightbulb, History } from 'lucide-react';

interface BottomNavbarProps {
  activeTab: 'monitor' | 'tips' | 'history';
  setActiveTab: (tab: 'monitor' | 'tips' | 'history') => void;
}

const BottomNavbar: React.FC<BottomNavbarProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'monitor', label: 'Monitor', icon: LayoutGrid, color: 'nba-blue' },
    { id: 'tips', label: 'Tips', icon: Lightbulb, color: 'nba-red' },
    { id: 'history', label: 'Histórico', icon: History, color: 'nba-gold' },
  ] as const;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-nba-surface/90 backdrop-blur-xl border-t border-white/5 px-6 pb-8 pt-3 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex flex-col items-center gap-1.5 relative group outline-none"
            >
              <div className={`
                p-2 rounded-xl transition-all duration-300
                ${isActive 
                  ? `bg-${tab.color} text-white shadow-lg` 
                  : 'text-slate-500 hover:text-slate-300'}
              `}>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`
                text-[10px] font-black uppercase tracking-widest font-oswald transition-colors
                ${isActive ? 'text-white' : 'text-slate-500'}
              `}>
                {tab.label}
              </span>
              
              {isActive && (
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-${tab.color} shadow-glow-${tab.color === 'nba-blue' ? 'blue' : tab.color === 'nba-red' ? 'red' : 'gold'}`} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavbar;
