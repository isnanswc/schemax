import React from 'react';

interface SchemaxLogoProps {
  size?: number;
  className?: string;
  variant?: 'icon' | 'badge' | 'full';
  showGlow?: boolean;
}

/**
 * SchemaxLogo - High-resolution Vector SVG Logo (Option 1: The Architect's Quill)
 * Combines a sleek golden quill with a geometric blueprint schema matrix.
 * 100% vector based, crisp at any display resolution.
 */
export const SchemaxLogo: React.FC<SchemaxLogoProps> = ({
  size = 36,
  className = '',
  variant = 'icon',
  showGlow = true,
}) => {
  const gradientId = React.useId();
  const glowFilterId = `glow-${gradientId}`;

  // SVG Graphic Elements
  const iconSvg = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="flex-shrink-0 transition-transform duration-300"
    >
      <defs>
        {/* Amber Gold Metallic Gradient */}
        <linearGradient id={`${gradientId}-gold`} x1="15%" y1="10%" x2="85%" y2="90%">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="40%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>

        {/* Blueprint Circuit Electric Cyan/Purple Gradient */}
        <linearGradient id={`${gradientId}-cyan`} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#06B6D4" />
          <stop offset="50%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#C084FC" />
        </linearGradient>

        {/* Soft Radial Backlight Glow */}
        {showGlow && (
          <filter id={glowFilterId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        )}
      </defs>

      {/* Background Soft Glow Aura */}
      {showGlow && (
        <circle cx="50" cy="50" r="32" fill="url(#" + gradientId + "-gold)" opacity="0.15" filter={`url(#${glowFilterId})`} />
      )}

      {/* --- BLUEPRINT / MATRIX SCHEMA NODES (Underneath & Behind Quill) --- */}
      <g stroke={`url(#${gradientId}-cyan)`} strokeWidth="1.2" opacity="0.75" strokeLinecap="round">
        {/* Geometric Structure Lines */}
        <path d="M 46 76 L 78 76 L 78 44 Z" fill="none" strokeDasharray="2 2" />
        <line x1="46" y1="76" x2="78" y2="44" strokeWidth="1" />
        <line x1="62" y1="76" x2="78" y2="60" strokeWidth="0.8" opacity="0.6" />
        <line x1="62" y1="44" x2="62" y2="76" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
        
        {/* Matrix Coordinate Nodes (Circles) */}
        <circle cx="78" cy="44" r="2.2" fill="#818CF8" />
        <circle cx="78" cy="76" r="2.2" fill="#06B6D4" />
        <circle cx="46" cy="76" r="2" fill="#C084FC" />
        <circle cx="62" cy="60" r="1.8" fill="#F59E0B" />
        <circle cx="70" cy="52" r="1.2" fill="#818CF8" opacity="0.8" />
        <circle cx="54" cy="68" r="1.2" fill="#06B6D4" opacity="0.8" />
      </g>

      {/* --- THE ARCHITECT'S GOLDEN QUILL (Pena Emas Sastra) --- */}
      <g filter={showGlow ? `url(#${glowFilterId})` : undefined}>
        {/* Main Feather Vane (Left Plume) */}
        <path
          d="M 68 20 C 64 26 48 38 38 52 C 34 57 32 64 30 70 C 34 66 40 64 45 64 C 41 57 48 45 57 37 C 62 32 67 27 68 20 Z"
          fill={`url(#${gradientId}-gold)`}
        />
        
        {/* Main Feather Vane (Right Plume) */}
        <path
          d="M 68 20 C 68 27 63 35 58 41 C 53 47 48 53 45 64 C 52 63 59 58 64 52 C 67 47 69 41 68 20 Z"
          fill={`url(#${gradientId}-gold)`}
          opacity="0.85"
        />

        {/* Central Shaft / Spine of Feather */}
        <path
          d="M 69 19 Q 52 42 30 70 L 26 77 C 26 77 28 75 31 73 Q 54 44 70 20 Z"
          fill="#FFFBEB"
        />

        {/* Nib Collar (Ring cincin pena) */}
        <path
          d="M 28 72 L 33 74 L 31 77 L 26 75 Z"
          fill="#F59E0B"
        />

        {/* Pen Nib (Mata Pena Emas) */}
        <path
          d="M 27 74 L 21 82 C 20.5 82.8 21.2 83.5 22 83 L 30 77 L 27 74 Z"
          fill={`url(#${gradientId}-gold)`}
        />

        {/* Nib Slit & Breather Hole */}
        <line x1="21.5" y1="82.5" x2="25.5" y2="76.5" stroke="#451A03" strokeWidth="0.8" strokeLinecap="round" />
        <circle cx="26" cy="76" r="0.75" fill="#451A03" />

        {/* Spark of Inspiration at Nib Tip */}
        <circle cx="21" cy="83" r="1.5" fill="#FFFFFF" opacity="0.9" />
      </g>
    </svg>
  );

  if (variant === 'badge') {
    return (
      <div
        className={`inline-flex items-center justify-center p-1.5 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-800 border border-slate-700/80 shadow-lg shadow-amber-500/10 ${className}`}
        style={{ width: size + 12, height: size + 12 }}
      >
        {iconSvg}
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <div className={`inline-flex items-center gap-2.5 ${className}`}>
        <div
          className="flex items-center justify-center p-1 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-md shadow-amber-500/15"
          style={{ width: size + 8, height: size + 8 }}
        >
          {iconSvg}
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-sm sm:text-base tracking-tight text-slate-900 dark:text-white uppercase font-sans">
              Schemax
            </span>
            <span className="text-[9px] font-black tracking-widest px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 uppercase">
              Studio
            </span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
            Story &amp; Lore Engine
          </span>
        </div>
      </div>
    );
  }

  return <div className={`inline-flex items-center justify-center ${className}`}>{iconSvg}</div>;
};

export default SchemaxLogo;
