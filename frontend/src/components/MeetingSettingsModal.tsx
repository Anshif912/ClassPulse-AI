import React, { useState } from 'react';
import {
  X,
  Volume2,
  VolumeX,
  Play,
  Sparkles,
  Users,
  Mic,
  Video,
  Monitor,
  MessageSquare,
  Bot,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { soundManager, MeetingSound } from '../services/soundManager';

interface MeetingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SoundItem {
  id: MeetingSound;
  label: string;
  description: string;
}

const SOUND_CATEGORIES: { title: string; icon: any; color: string; sounds: SoundItem[] }[] = [
  {
    title: 'Meeting Connection',
    icon: Volume2,
    color: 'text-emerald-400',
    sounds: [
      { id: 'meeting_connected', label: 'Connected', description: 'Pristine 3-note ascending entry chord' },
      { id: 'meeting_reconnected', label: 'Reconnected', description: '2-note recovery chime' },
      { id: 'meeting_leave', label: 'Leave', description: 'Subtle departure tone' },
      { id: 'meeting_error', label: 'Connection Error', description: 'Soft low-frequency warning' },
    ],
  },
  {
    title: 'Participants',
    icon: Users,
    color: 'text-blue-400',
    sounds: [
      { id: 'participant_join', label: 'Participant Joined', description: 'Warm, friendly upward chime (G5→C6)' },
      { id: 'participant_leave', label: 'Participant Left', description: 'Soft descending 2-note tone (E5→C5)' },
    ],
  },
  {
    title: 'Local Controls',
    icon: Mic,
    color: 'text-amber-400',
    sounds: [
      { id: 'mic_on', label: 'Mic Unmute', description: 'Crisp upward confirmation tick' },
      { id: 'mic_off', label: 'Mic Mute', description: 'Soft muted lower tick' },
      { id: 'camera_on', label: 'Camera On', description: 'High subtle confirmation chime' },
      { id: 'camera_off', label: 'Camera Off', description: 'Gentle descending confirmation' },
      { id: 'screen_share_start', label: 'Presenting Start', description: 'Smooth upward sweep' },
      { id: 'screen_share_stop', label: 'Presenting Stop', description: 'Smooth downward sweep' },
    ],
  },
  {
    title: 'AI Voice Tutor',
    icon: Sparkles,
    color: 'text-purple-400',
    sounds: [
      { id: 'ai_ready', label: 'AI Ready', description: 'ClassPulse AI sonic chord (E5+B5+E6)' },
      { id: 'ai_listening', label: 'AI Listening', description: 'Gentle prompt acknowledgement' },
      { id: 'ai_speaking', label: 'AI Speaking', description: 'Soft tone transition' },
      { id: 'ai_interrupted', label: 'AI Interrupted', description: 'Crisp stop/cut confirmation' },
      { id: 'ai_error', label: 'AI Error', description: 'Gentle low advisory tone' },
    ],
  },
  {
    title: 'Classroom Chat',
    icon: MessageSquare,
    color: 'text-cyan-400',
    sounds: [
      { id: 'chat_message', label: 'New Message', description: 'Soft subtle notification chime' },
    ],
  },
];

export function MeetingSettingsModal({ isOpen, onClose }: MeetingSettingsModalProps) {
  const [soundEnabled, setSoundEnabled] = useState(soundManager.isEnabled());
  const [volume, setVolume] = useState(soundManager.getVolumePercent());
  const [activePlaying, setActivePlaying] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggleSound = (enabled: boolean) => {
    soundManager.setEnabled(enabled);
    setSoundEnabled(enabled);
  };

  const handleVolumeChange = (vol: number) => {
    soundManager.setVolume(vol);
    setVolume(vol);
  };

  const handlePlayPreview = (soundId: MeetingSound) => {
    soundManager.unlock();
    soundManager.play(soundId);
    setActivePlaying(soundId);
    setTimeout(() => {
      setActivePlaying((cur) => (cur === soundId ? null : cur));
    }, 450);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900/95 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md">
              <Sliders className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">ClassPulse Meeting Settings</h2>
              <p className="text-[11px] text-slate-400">Audio feedback, sound design & controls</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Master Sound Feedback Toggle & Volume */}
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${soundEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'}`}>
                  {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">Meeting Sound Effects</h3>
                  <p className="text-[11px] text-slate-400">Original, Google-Meet-style procedural UX audio feedback</p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => handleToggleSound(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Volume Slider */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Notification Volume</span>
                <span className="text-white font-mono font-bold">{volume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                disabled={!soundEnabled}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-40"
              />
            </div>
          </div>

          {/* Sound Pack Previews */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Sound Design Preview (18 Synthesized Sounds)
              </h3>
              <span className="text-[10px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                0ms Latency • Procedural Web Audio
              </span>
            </div>

            <div className="space-y-4">
              {SOUND_CATEGORIES.map((cat) => {
                const CatIcon = cat.icon;
                return (
                  <div key={cat.title} className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/60 space-y-3">
                    <div className="flex items-center gap-2">
                      <CatIcon className={`w-4 h-4 ${cat.color}`} />
                      <h4 className="text-xs font-bold text-slate-200">{cat.title}</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {cat.sounds.map((sound) => {
                        const isPlaying = activePlaying === sound.id;
                        return (
                          <div
                            key={sound.id}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/70 hover:border-slate-700 transition-colors"
                          >
                            <div className="min-w-0 pr-2">
                              <p className="text-xs font-semibold text-slate-200 truncate">{sound.label}</p>
                              <p className="text-[10px] text-slate-400 truncate">{sound.description}</p>
                            </div>
                            <button
                              onClick={() => handlePlayPreview(sound.id)}
                              className={`p-2 rounded-lg flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                                isPlaying
                                  ? 'bg-blue-600 text-white scale-105 shadow-md shadow-blue-600/30'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                              }`}
                              title={`Preview ${sound.label}`}
                            >
                              <Play className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950/70 border-t border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Preferences auto-saved locally
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
