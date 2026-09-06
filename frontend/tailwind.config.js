/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── ClassPulse Surface Hierarchy ─────────────────────────────────────
        cp: {
          // Base surfaces
          base:     '#080C14',   // deepest background
          surface:  '#0D1220',   // page/card base
          raised:   '#111827',   // cards, panels
          overlay:  '#1a2235',   // dropdowns, modals
          hover:    '#1e2d45',   // hover states

          // Borders (increasing visibility)
          'border-subtle': '#1e293b',
          'border-default': '#263145',
          'border-strong':  '#334155',
          'border-focus':   '#3B82F6',

          // Text hierarchy
          'text-primary':   '#f1f5f9',
          'text-secondary': '#94a3b8',
          'text-muted':     '#475569',
          'text-disabled':  '#334155',

          // ClassPulse accent — blue-indigo gradient family
          'accent-50':  '#eff6ff',
          'accent-100': '#dbeafe',
          'accent-200': '#bfdbfe',
          'accent-300': '#93c5fd',
          'accent-400': '#60a5fa',
          'accent-500': '#3b82f6',
          'accent-600': '#2563eb',
          'accent-700': '#1d4ed8',

          // AI-specific accent — violet/indigo for Private Mic
          'ai-50':  '#f5f3ff',
          'ai-100': '#ede9fe',
          'ai-200': '#ddd6fe',
          'ai-300': '#c4b5fd',
          'ai-400': '#a78bfa',
          'ai-500': '#8b5cf6',
          'ai-600': '#7c3aed',

          // Status
          'status-success':  '#10b981',
          'status-warning':  '#f59e0b',
          'status-error':    '#ef4444',
          'status-info':     '#06b6d4',
        },

        // Legacy compatibility
        dark: {
          900: '#080C14',
          850: '#0D1220',
          800: '#111827',
          700: '#1e293b',
          600: '#334155',
        },
        pulse: {
          blue:    '#3B82F6',
          indigo:  '#6366F1',
          cyan:    '#06B6D4',
          emerald: '#10B981',
          amber:   '#F59E0B',
          rose:    '#F43F5E',
        }
      },

      fontFamily: {
        sans: [
          'Inter', '-apple-system', 'BlinkMacSystemFont',
          '"Segoe UI"', 'system-ui', 'sans-serif'
        ],
        mono: [
          '"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace'
        ],
      },

      borderRadius: {
        'cp-sm': '6px',
        'cp':    '10px',
        'cp-md': '14px',
        'cp-lg': '18px',
        'cp-xl': '24px',
      },

      boxShadow: {
        'cp-card': '0 1px 3px 0 rgba(0,0,0,0.4), 0 1px 2px -1px rgba(0,0,0,0.4)',
        'cp-elevated': '0 4px 16px 0 rgba(0,0,0,0.5), 0 1px 3px 0 rgba(0,0,0,0.3)',
        'cp-accent': '0 0 0 3px rgba(59,130,246,0.2)',
        'cp-ai': '0 0 0 3px rgba(139,92,246,0.2)',
      },

      animation: {
        'cp-pulse': 'cpPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'cp-wave':  'cpWave 1.4s ease-in-out infinite',
        'cp-spin':  'spin 0.8s linear infinite',
        'cp-fade-in': 'cpFadeIn 0.15s ease-out',
        'cp-slide-up': 'cpSlideUp 0.2s ease-out',
        // Legacy
        'pulse-glow': 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'wave-bar': 'waveBar 1.2s ease-in-out infinite',
      },

      keyframes: {
        cpPulse: {
          '0%, 100%': { opacity: '1' },
          '50%':       { opacity: '0.5' },
        },
        cpWave: {
          '0%, 100%': { transform: 'scaleY(0.4)' },
          '50%':       { transform: 'scaleY(1)' },
        },
        cpFadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        cpSlideUp: {
          '0%':   { transform: 'translateY(6px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',   opacity: '1' },
        },
        // Legacy
        pulseGlow: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%':       { opacity: '0.7', transform: 'scale(1.05)' },
        },
        waveBar: {
          '0%, 100%': { height: '8px' },
          '50%':       { height: '24px' },
        },
      },
    },
  },
  plugins: [],
}

