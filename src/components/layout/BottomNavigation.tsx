import React from 'react';
import { ActiveTab } from '../../types';
import { BookOpen, Layers, Image as ImageIcon, Compass, Info } from 'lucide-react';

interface BottomNavigationProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  chapterCount?: number;
  entityCount?: number;
  mediaCount?: number;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onChangeTab,
  chapterCount = 0,
  entityCount = 0,
  mediaCount = 0,
}) => {
  const tabs = [
    {
      id: 'chapters' as ActiveTab,
      label: 'Plot & Bab',
      icon: BookOpen,
      badge: chapterCount > 0 ? chapterCount : undefined,
    },
    {
      id: 'world' as ActiveTab,
      label: 'Worldbuilding',
      icon: Compass,
      badge: entityCount > 0 ? entityCount : undefined,
    },
    {
      id: 'gallery' as ActiveTab,
      label: 'Visual Media',
      icon: ImageIcon,
      badge: mediaCount > 0 ? mediaCount : undefined,
    },
    {
      id: 'overview' as ActiveTab,
      label: 'Info Buku',
      icon: Info,
    },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-slate-950/90 backdrop-blur-xl border-t border-slate-800/80 px-2 py-1 safe-bottom sm:max-w-md sm:mx-auto sm:rounded-t-2xl sm:border-x">
      <div className="grid grid-cols-4 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all duration-200 active:scale-95 ${
                isActive
                  ? 'text-amber-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {/* Active subtle background pill */}
              {isActive && (
                <span className="absolute inset-x-2 inset-y-1 bg-amber-500/10 rounded-xl -z-10" />
              )}

              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                {tab.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2 px-1 py-0.2 min-w-[14px] text-[10px] font-bold rounded-full bg-amber-500 text-slate-950 flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </div>

              <span className="text-[10px] mt-1 tracking-tight truncate max-w-full">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
