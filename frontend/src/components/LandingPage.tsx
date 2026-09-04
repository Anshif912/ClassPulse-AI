import React, { useState } from 'react';
import { Sparkles, ArrowRight, Video, ShieldCheck, PlayCircle, AlertCircle, HelpCircle, CheckCircle2, Info } from 'lucide-react';

interface LandingPageProps {
  onJoinSession: (meetUrl: string, participantName: string) => Promise<void>;
  onLaunchDemoMode: () => void;
  isLoading: boolean;
  errorMessage?: string;
  successStatus?: string;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onJoinSession,
  onLaunchDemoMode,
  isLoading,
  errorMessage,
  successStatus,
}) => {
  const [meetUrl, setMeetUrl] = useState('');
  const [participantName, setParticipantName] = useState('Jeevan');
  const [localError, setLocalError] = useState<string | null>(null);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const trimmed = meetUrl.trim();
    if (!trimmed) {
      setLocalError('Invalid Google Meet link. Please paste the complete meeting URL (e.g. https://meet.google.com/abc-defg-hij).');
      return;
    }

    try {
      await onJoinSession(trimmed, participantName.trim() || 'Student');
    } catch (err: any) {
      setLocalError(
        err.message || 'Invalid Google Meet link. Please paste the complete meeting URL.'
      );
    }
  };

  const fillExampleLink = () => {
    setMeetUrl('https://meet.google.com/abc-defg-hij');
    setLocalError(null);
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Top Navigation */}
      <header className="px-6 py-5 border-b border-slate-800/80 flex items-center justify-between max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
              CLASS PULSE AI
            </h1>
            <p className="text-xs text-slate-400 font-medium">Your AI Classroom Companion</p>
          </div>
        </div>

        {/* Demo Mode Trigger */}
        <button
          onClick={onLaunchDemoMode}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-950/60 text-blue-300 border border-blue-800/60 hover:bg-blue-900/60 hover:border-blue-700 transition-all shadow-sm"
        >
          <PlayCircle className="w-4 h-4 text-blue-400" />
          <span>Launch Demo Mode (Zero Credentials)</span>
        </button>
      </header>

      {/* Main Join Container */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl text-center space-y-8">
          {/* Hero Titles */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Live Classroom Companion
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              CLASS PULSE AI
            </h2>
            <p className="text-base text-slate-300 font-normal max-w-md mx-auto">
              Join your live class with your AI learning companion.
            </p>
          </div>

          {/* Join Form Card */}
          <div className="p-6 sm:p-8 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl backdrop-blur text-left space-y-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Meet URL Input */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Google Meet Link
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Video className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={meetUrl}
                    onChange={(e) => {
                      setMeetUrl(e.target.value);
                      if (localError) setLocalError(null);
                    }}
                    placeholder="https://meet.google.com/xxx-xxxx-xxx"
                    disabled={isLoading}
                    className="w-full pl-10 pr-24 py-3.5 bg-slate-950/80 border border-slate-700/80 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={fillExampleLink}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[11px] font-medium text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    Paste sample
                  </button>
                </div>
              </div>

              {/* Student Name Input */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Your Name (Optional)
                </label>
                <input
                  type="text"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  placeholder="e.g. Jeevan"
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-slate-950/80 border border-slate-700/80 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Success Status Message */}
              {successStatus && (
                <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/60 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-300 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{successStatus}</span>
                </div>
              )}

              {/* Error Message Display */}
              {(localError || errorMessage) && (
                <div className="p-3.5 bg-rose-950/40 border border-rose-800/60 rounded-2xl flex items-start gap-2.5 text-xs text-rose-300 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{localError || errorMessage}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 px-6 rounded-2xl font-bold text-sm tracking-wide bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Connecting Companion...
                  </span>
                ) : (
                  <>
                    <span>JOIN CLASSROOM WITH AI</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            {/* Honest Architectural Clarification */}
            <div className="pt-2 border-t border-slate-800/60 text-center space-y-2">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 inline mr-1 -mt-0.5" />
                Your real Google Meet opens in a new tab. ClassPulse runs alongside it in this tab as your AI study companion.
              </p>

              {/* Troubleshooting Toggle */}
              <button
                type="button"
                onClick={() => setShowTroubleshoot(!showTroubleshoot)}
                className="text-[11px] text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1 transition-colors"
              >
                <HelpCircle className="w-3 h-3" />
                <span>Seeing "You can't join this video call" on Google Meet?</span>
              </button>

              {/* Google Meet Troubleshooting Guidance (Item 8) */}
              {showTroubleshoot && (
                <div className="p-3.5 bg-slate-950/90 border border-slate-700/60 rounded-2xl text-left text-xs text-slate-300 space-y-2 animate-fadeIn">
                  <div className="font-bold text-slate-200 flex items-center gap-1.5 text-blue-400">
                    <Info className="w-3.5 h-3.5" />
                    <span>Google Meet Account & Permission Guide:</span>
                  </div>
                  <ul className="text-[11px] text-slate-400 space-y-1.5 list-disc pl-4">
                    <li>
                      <strong>Check Active Google Account:</strong> Google Meet requires you to be logged into the Google Account that was invited or created the meeting. In the Meet tab, switch to the right profile if you have multiple accounts.
                    </li>
                    <li>
                      <strong>Host Admission:</strong> If the meeting is outside your organization, the meeting host must click "Admit" to let you in.
                    </li>
                    <li>
                      <strong>ClassPulse Integrity:</strong> ClassPulse passes your exact Google Meet URL to Google's official website without modification, proxying, or iframe tampering.
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* 4-Step User Journey Guide */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-left">
            <div className="p-3 bg-slate-900/40 border border-slate-800/60 rounded-2xl">
              <span className="text-blue-400 font-bold text-xs block mb-1">Step 1</span>
              <p className="text-xs text-slate-300">Paste your Google Meet link</p>
            </div>
            <div className="p-3 bg-slate-900/40 border border-slate-800/60 rounded-2xl">
              <span className="text-blue-400 font-bold text-xs block mb-1">Step 2</span>
              <p className="text-xs text-slate-300">Join your live class in new tab</p>
            </div>
            <div className="p-3 bg-slate-900/40 border border-slate-800/60 rounded-2xl">
              <span className="text-blue-400 font-bold text-xs block mb-1">Step 3</span>
              <p className="text-xs text-slate-300">ClassPulse becomes your learning companion</p>
            </div>
            <div className="p-3 bg-slate-900/40 border border-slate-800/60 rounded-2xl">
              <span className="text-blue-400 font-bold text-xs block mb-1">Step 4</span>
              <p className="text-xs text-slate-300">Ask doubts anytime via text or voice</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 border-t border-slate-800/60 text-center text-xs text-slate-500">
        ClassPulse AI — Honest, Zero-Disruption Live Classroom Companion Architecture
      </footer>
    </div>
  );
};
