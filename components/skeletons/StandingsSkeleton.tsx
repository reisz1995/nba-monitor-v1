
import React from 'react';

/**
 * StandingsSkeleton component
 * Matches the layout of StandingsTable to provide a smooth loading transition.
 */
export const StandingsSkeleton = () => {
  const renderRowSkeleton = (i: number) => (
    <div key={i} className="flex flex-col md:grid md:grid-cols-12 items-center px-4 md:px-6 py-3.5 border-b border-white/5">
      <div className="flex md:contents">
        <div className="w-12 md:col-span-1 flex items-center gap-2 md:gap-3 border-r border-white/10 h-full py-1">
          <div className="w-4 h-4 bg-white/5 rounded-sm animate-pulse" />
          <div className="h-3 w-4 bg-white/10 rounded animate-pulse" />
        </div>
        
        <div className="flex-1 md:col-span-7 flex items-center gap-3 md:gap-4 pl-3 md:pl-4 h-full py-1">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-white/10 rounded-full animate-pulse" />
          <div className="w-8 md:w-10 h-2 bg-white/5 rounded animate-pulse" />
          <div className="flex flex-col gap-2">
            <div className="h-3 w-24 bg-white/10 rounded animate-pulse" />
            <div className="h-2 w-16 bg-white/5 rounded animate-pulse" />
          </div>
        </div>
      </div>
      
      <div className="w-full md:col-span-4 mt-3 md:mt-0 flex justify-center md:justify-end gap-2 md:border-l border-white/10 h-full py-1 md:pl-4">
        {[1, 2, 3, 4, 5].map(j => (
          <div key={j} className="w-6 h-6 md:w-7 md:h-7 bg-white/10 rounded-sm animate-pulse" />
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-black/40 backdrop-blur-xl border-2 border-white/10 rounded-xl overflow-hidden glass-morphism">
      {/* Skeleton Columns for Large Screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Conference A */}
        <div className="flex flex-col border-white/10">
          <div className="px-4 md:px-6 py-3 border-b border-white/10 bg-white/5">
            <div className="h-3 w-32 bg-white/10 rounded animate-pulse" />
          </div>
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => renderRowSkeleton(i))}
        </div>
        
        {/* Conference B */}
        <div className="flex flex-col border-white/10 border-l">
          <div className="px-4 md:px-6 py-3 border-b border-white/10 bg-white/5">
            <div className="h-3 w-32 bg-white/10 rounded animate-pulse" />
          </div>
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => renderRowSkeleton(i + 100))}
        </div>
      </div>
    </div>
  );
};

export default StandingsSkeleton;
