import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Sliders,
  Video,
  Mic,
  Volume2,
  Bot,
  Shield,
  Check,
  Sparkles,
  Camera,
  RefreshCw,
  Play,
  VolumeX,
  AlertCircle,
  Laptop,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { AppShell } from './common/AppShell';
import { soundManager, MeetingSound } from '../services/soundManager';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'media' | 'ai' | 'security'>('media');

  // Appearance state
  const [selectedAccent, setSelectedAccent] = useState<'blue' | 'violet' | 'cyan' | 'emerald' | 'rose'>('blue');
  const [themeMode, setThemeMode] = useState<'dark' | 'light' | 'system'>('dark');

  // AI preferences
  const [aiLang, setAiLang] = useState<'auto' | 'en' | 'ta' | 'hi'>('auto');
  const [voiceResponsesEnabled, setVoiceResponsesEnabled] = useState(true);

  // Audio/Video testing state
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [selectedMicId, setSelectedMicId] = useState<string>('');
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [isMicTesting, setIsMicTesting] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [speakerTesting, setSpeakerTesting] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  // Sound System state
  const [soundEnabled, setSoundEnabled] = useState(soundManager.isEnabled());
  const [soundVolume, setSoundVolume] = useState(soundManager.getVolumePercent());
  const [activePlaying, setActivePlaying] = useState<string | null>(null);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micAnimRef = useRef<number | null>(null);

  // Enumerate devices on mount
  useEffect(() => {
    async function loadDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter((d) => d.kind === 'videoinput');
        const mics = devices.filter((d) => d.kind === 'audioinput');
        const spks = devices.filter((d) => d.kind === 'audiooutput');
        setCameras(cams);
        setMicrophones(mics);
        setSpeakers(spks);
        if (cams.length > 0) setSelectedCameraId(cams[0].deviceId);
        if (mics.length > 0) setSelectedMicId(mics[0].deviceId);
        if (spks.length > 0) setSelectedSpeakerId(spks[0].deviceId);
      } catch (err) {
        console.warn('Could not enumerate devices', err);
      }
    }
    loadDevices();
  }, []);

  // Handle Camera preview
  useEffect(() => {
    if (activeTab !== 'media') {
      stopCamera();
      stopMicTest();
      return;
    }

    async function startCamera() {
      if (!isCameraActive) {
        stopCamera();
        return;
      }
      try {
        setDeviceError(null);
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: selectedCameraId ? { deviceId: { exact: selectedCameraId } } : true,
          audio: false,
        });
        mediaStreamRef.current = stream;
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
        }
      } catch (err: any) {
        setDeviceError('Camera access denied or unavailable: ' + err.message);
      }
    }

    startCamera();

    return () => {
      stopCamera();
      stopMicTest();
    };
  }, [activeTab, isCameraActive, selectedCameraId]);

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  };

  // Handle Mic volume test
  const toggleMicTest = async () => {
    if (isMicTesting) {
      stopMicTest();
      return;
    }

    try {
      setDeviceError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedMicId ? { deviceId: { exact: selectedMicId } } : true,
        video: false,
      });

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      setIsMicTesting(true);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
        micAnimRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch (err: any) {
      setDeviceError('Microphone test failed: ' + err.message);
    }
  };

  const stopMicTest = () => {
    if (micAnimRef.current) cancelAnimationFrame(micAnimRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setIsMicTesting(false);
    setMicVolume(0);
  };

  // Test speaker sound
  const handleTestSpeaker = () => {
    setSpeakerTesting(true);
    soundManager.unlock();
    soundManager.play('meeting_connected');
    setTimeout(() => {
      setSpeakerTesting(false);
    }, 500);
  };

  const handleToggleSound = (enabled: boolean) => {
    soundManager.setEnabled(enabled);
    setSoundEnabled(enabled);
  };

  const handleVolumeChange = (vol: number) => {
    soundManager.setVolume(vol);
    setSoundVolume(vol);
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
    <AppShell activeNav="settings">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            <Sliders className="w-6 h-6 text-blue-400" />
            ClassPulse Settings
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure your devices, workspace theme, AI tutor behavior, and account security.
          </p>
        </div>

        {/* Layout: Sidebar tabs + Content area */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Tabs */}
          <div className="space-y-1">
            {[
              { id: 'media', label: 'Audio & Video', icon: <Video className="w-4 h-4" /> },
              { id: 'ai', label: 'AI Voice Tutor', icon: <Bot className="w-4 h-4" /> },
              { id: 'profile', label: 'Profile Details', icon: <User className="w-4 h-4" /> },
              { id: 'appearance', label: 'Theme & Accents', icon: <Sliders className="w-4 h-4" /> },
              { id: 'security', label: 'Security & Access', icon: <Shield className="w-4 h-4" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                  activeTab === tab.id
                    ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                }`}
              >
                <span className={activeTab === tab.id ? 'text-blue-400' : 'text-slate-500'}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab content panel */}
          <div className="md:col-span-3 bg-slate-900/70 border border-slate-800/80 rounded-2xl p-6 shadow-xl">
            {/* ── AUDIO & VIDEO ──────────────────────────────────────────────── */}
            {activeTab === 'media' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Video className="w-4 h-4 text-blue-400" />
                    Camera & Microphone Setup
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Test and verify your camera and mic before joining live classes.
                  </p>
                </div>

                {deviceError && (
                  <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{deviceError}</span>
                  </div>
                )}

                {/* Camera preview */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">Camera Preview</label>
                    <button
                      onClick={() => setIsCameraActive(!isCameraActive)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        isCameraActive
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isCameraActive ? 'Camera ON' : 'Camera OFF'}
                    </button>
                  </div>

                  <div className="relative aspect-video w-full max-w-md bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                    {isCameraActive ? (
                      <video
                        ref={videoPreviewRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover scale-x-[-1]"
                      />
                    ) : (
                      <div className="text-center text-slate-500 text-xs">
                        <Camera className="w-8 h-8 mx-auto mb-1 text-slate-600" />
                        Camera is turned off
                      </div>
                    )}
                  </div>

                  {cameras.length > 0 && (
                    <select
                      value={selectedCameraId}
                      onChange={(e) => setSelectedCameraId(e.target.value)}
                      className="w-full max-w-md bg-slate-950 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
                    >
                      {cameras.map((c) => (
                        <option key={c.deviceId} value={c.deviceId}>
                          {c.label || `Camera ${c.deviceId.slice(0, 5)}`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Microphone selection & volume test */}
                <div className="space-y-3 pt-4 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                      <Mic className="w-4 h-4 text-emerald-400" />
                      Microphone Test
                    </label>
                    <button
                      onClick={toggleMicTest}
                      className={`text-xs px-3 py-1 rounded-lg font-bold transition-all ${
                        isMicTesting
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 animate-pulse'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      {isMicTesting ? 'Listening (Speak)...' : 'Test Mic'}
                    </button>
                  </div>

                  {/* Volume Level bar */}
                  <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800 p-0.5">
                    <div
                      className="bg-gradient-to-r from-emerald-500 via-blue-500 to-indigo-500 h-full rounded-full transition-all duration-75"
                      style={{ width: `${micVolume}%` }}
                    />
                  </div>

                  {microphones.length > 0 && (
                    <select
                      value={selectedMicId}
                      onChange={(e) => setSelectedMicId(e.target.value)}
                      className="w-full max-w-md bg-slate-950 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
                    >
                      {microphones.map((m) => (
                        <option key={m.deviceId} value={m.deviceId}>
                          {m.label || `Microphone ${m.deviceId.slice(0, 5)}`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Speaker sound test */}
                <div className="space-y-3 pt-4 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-cyan-400" />
                      Speaker Output Test
                    </label>
                    <button
                      onClick={handleTestSpeaker}
                      disabled={speakerTesting}
                      className="text-xs px-3 py-1 rounded-lg font-bold bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3 h-3" />
                      {speakerTesting ? 'Playing Chime...' : 'Play Test Sound'}
                    </button>
                  </div>
                </div>

                {/* ── Meeting Sound Design System (Google-Meet-Like Procedural Feedback) ── */}
                <div className="space-y-4 pt-6 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-emerald-400" />
                        Meeting Sound Effects System
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        High-fidelity, non-intrusive procedural Web Audio cues for classroom events and controls.
                      </p>
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
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium">Notification Volume</span>
                      <span className="text-white font-mono font-bold">{soundVolume}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={soundVolume}
                      disabled={!soundEnabled}
                      onChange={(e) => handleVolumeChange(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-40"
                    />
                  </div>

                  {/* Interactive Sound Preview Grid */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300">
                        Sound Effects Library (18 Procedural Sounds)
                      </label>
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-mono">
                        Pure Web Audio
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {[
                        { id: 'meeting_connected', label: 'Connected', cat: 'Entry' },
                        { id: 'meeting_reconnected', label: 'Reconnected', cat: 'Recovery' },
                        { id: 'meeting_leave', label: 'Leave', cat: 'Exit' },
                        { id: 'meeting_error', label: 'Error Warning', cat: 'System' },
                        { id: 'participant_join', label: 'User Joined', cat: 'Presence' },
                        { id: 'participant_leave', label: 'User Left', cat: 'Presence' },
                        { id: 'mic_on', label: 'Mic Unmuted', cat: 'Control' },
                        { id: 'mic_off', label: 'Mic Muted', cat: 'Control' },
                        { id: 'camera_on', label: 'Camera On', cat: 'Control' },
                        { id: 'camera_off', label: 'Camera Off', cat: 'Control' },
                        { id: 'screen_share_start', label: 'Presenting Start', cat: 'Control' },
                        { id: 'screen_share_stop', label: 'Presenting Stop', cat: 'Control' },
                        { id: 'ai_ready', label: 'AI Ready Chime', cat: 'AI Tutor' },
                        { id: 'ai_listening', label: 'AI Listening', cat: 'AI Tutor' },
                        { id: 'ai_speaking', label: 'AI Speaking', cat: 'AI Tutor' },
                        { id: 'ai_interrupted', label: 'AI Interrupted', cat: 'AI Tutor' },
                        { id: 'ai_error', label: 'AI Error Tone', cat: 'AI Tutor' },
                        { id: 'chat_message', label: 'Chat Message', cat: 'Chat' },
                      ].map((item) => {
                        const isPlaying = activePlaying === item.id;
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition-colors"
                          >
                            <div className="min-w-0 pr-2">
                              <p className="text-xs font-semibold text-slate-200 truncate">{item.label}</p>
                              <span className="text-[10px] text-slate-500">{item.cat}</span>
                            </div>
                            <button
                              onClick={() => handlePlayPreview(item.id as MeetingSound)}
                              disabled={!soundEnabled}
                              className={`p-1.5 rounded-lg flex items-center justify-center transition-all cursor-pointer shrink-0 disabled:opacity-40 ${
                                isPlaying
                                  ? 'bg-blue-600 text-white scale-105 shadow-md shadow-blue-600/30'
                                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800'
                              }`}
                              title={`Preview ${item.label}`}
                            >
                              <Play className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── AI VOICE TUTOR ─────────────────────────────────────────────── */}
            {activeTab === 'ai' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Bot className="w-4 h-4 text-violet-400" />
                    ClassPulse AI Tutor Preferences
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure language models, voice synthesis, and private mic behavior.
                  </p>
                </div>

                {/* Language selection */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">Default Query Language</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'auto', label: 'Auto Detect' },
                      { id: 'en', label: 'English' },
                      { id: 'ta', label: 'Tamil (தமிழ்)' },
                      { id: 'hi', label: 'Hindi (हिन्दी)' },
                    ].map((lang) => (
                      <button
                        key={lang.id}
                        onClick={() => setAiLang(lang.id as any)}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all text-center ${
                          aiLang === lang.id
                            ? 'bg-violet-600/20 border-violet-500 text-violet-300 shadow-md shadow-violet-600/20'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Voice synthesis toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
                  <div>
                    <p className="text-xs font-bold text-slate-200">Spoken Voice Responses (TTS)</p>
                    <p className="text-[11px] text-slate-400">
                      AI Tutor automatically speaks answers aloud during Private Voice Tutor mode.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={voiceResponsesEnabled}
                    onChange={(e) => setVoiceResponsesEnabled(e.target.checked)}
                    className="w-4 h-4 accent-violet-600 cursor-pointer"
                  />
                </div>

                {/* Echo suppression note */}
                <div className="p-3 bg-violet-950/30 border border-violet-800/30 rounded-xl text-xs text-violet-300 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Zero-Audio-Leak Security:</strong> Your private AI mic uses a dedicated local stream and is never broadcasted to your classmates or teacher on Agora RTC.
                  </span>
                </div>
              </div>
            )}

            {/* ── PROFILE ────────────────────────────────────────────────────── */}
            {activeTab === 'profile' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-400" />
                    Account Profile
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Your authenticated role and identity details.
                  </p>
                </div>

                <div className="flex items-center gap-4 p-4 bg-slate-950 rounded-2xl border border-slate-800">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="w-14 h-14 rounded-2xl ring-2 ring-blue-500/30" />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-xl font-black text-white shadow-lg">
                      {user?.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-white">{user?.name || 'ClassPulse User'}</h3>
                    <p className="text-xs text-slate-400">{user?.email}</p>
                    <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {user?.role} Role
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-400">Display Name</label>
                    <input
                      type="text"
                      disabled
                      value={user?.name || ''}
                      className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 opacity-80 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400">Email Address</label>
                    <input
                      type="email"
                      disabled
                      value={user?.email || ''}
                      className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 opacity-80 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── APPEARANCE ─────────────────────────────────────────────────── */}
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-400" />
                    Theme & Accent Customization
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Personalize your workspace palette and lighting.
                  </p>
                </div>

                {/* Theme Mode */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">Theme Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'dark', label: 'Dark Midnight' },
                      { id: 'light', label: 'Light Studio' },
                      { id: 'system', label: 'System Default' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setThemeMode(m.id as any)}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all text-center ${
                          themeMode === m.id
                            ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-md shadow-blue-600/20'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Accent Colors */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">Accent Hue</label>
                  <div className="flex items-center gap-3">
                    {[
                      { id: 'blue', color: 'bg-blue-500' },
                      { id: 'violet', color: 'bg-violet-500' },
                      { id: 'cyan', color: 'bg-cyan-500' },
                      { id: 'emerald', color: 'bg-emerald-500' },
                      { id: 'rose', color: 'bg-rose-500' },
                    ].map((accent) => (
                      <button
                        key={accent.id}
                        onClick={() => setSelectedAccent(accent.id as any)}
                        className={`w-8 h-8 rounded-full ${accent.color} flex items-center justify-center transition-all ${
                          selectedAccent === accent.id ? 'ring-4 ring-white/30 scale-110' : 'opacity-70 hover:opacity-100'
                        }`}
                      >
                        {selectedAccent === accent.id && <Check className="w-4 h-4 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── SECURITY ───────────────────────────────────────────────────── */}
            {activeTab === 'security' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    Authentication & Session Security
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Passwordless OTP authentication powered by ClassPulse session token cookies.
                  </p>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Active Session Status</span>
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Authenticated
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Identity Provider</span>
                    <span className="text-slate-200">Email OTP (Passwordless)</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Session Cookie</span>
                    <span className="font-mono text-slate-300">cps_session (HttpOnly)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
};
