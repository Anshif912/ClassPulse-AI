import React from 'react';

interface LogoProps {
  variant?: 'full' | 'mark' | 'icon' | 'compact';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
  showTagline?: boolean;
  lightMode?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  variant = 'full',
  size = 'md',
  className = '',
  showText = true,
  showTagline = false,
  lightMode = false,
}) => {
  const sizeMap = {
    xs: { icon: 'h-6 w-auto', text: 'text-sm font-black', tagline: 'text-[9px]' },
    sm: { icon: 'h-7 w-auto', text: 'text-base font-black', tagline: 'text-[10px]' },
    md: { icon: 'h-9 w-auto', text: 'text-lg font-black', tagline: 'text-[11px]' },
    lg: { icon: 'h-12 w-auto', text: 'text-2xl font-black', tagline: 'text-xs' },
    xl: { icon: 'h-16 w-auto', text: 'text-3xl font-black', tagline: 'text-xs' },
  };

  const currentSize = sizeMap[size];

  if (variant === 'icon' || variant === 'mark') {
    return (
      <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
        <img
          src="/classpulse-logo.png"
          alt="ClassPulse"
          className={`${currentSize.icon} object-contain filter drop-shadow-md rounded-lg`}
        />
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 shrink-0 select-none ${className}`}>
      <img
        src="/classpulse-logo.png"
        alt="ClassPulse Logo"
        className={`${currentSize.icon} object-contain filter drop-shadow-md`}
      />
      {showText && (
        <div className="flex flex-col leading-tight">
          <span
            className={`${currentSize.text} tracking-tight font-extrabold ${
              lightMode
                ? 'text-slate-900'
                : 'bg-gradient-to-r from-white via-slate-100 to-slate-200 bg-clip-text text-transparent'
            }`}
          >
            Class<span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 bg-clip-text text-transparent">Pulse</span>
          </span>
          {showTagline && (
            <span
              className={`${currentSize.tagline} font-medium tracking-normal ${
                lightMode ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              Learn Together. Go Further.
            </span>
          )}
        </div>
      )}
    </div>
  );
};
