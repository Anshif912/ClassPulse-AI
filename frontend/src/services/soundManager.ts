/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ClassPulse Professional Meeting Sound Design System
 * ─────────────────────────────────────────────────────────────────────────────
 * High-fidelity, original procedural Web Audio synthesizer.
 * Provides subtle, clean, non-intrusive meeting UX feedback without
 * external asset dependencies or copyright issues.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type MeetingSound =
  | 'meeting_connected'
  | 'participant_join'
  | 'participant_leave'
  | 'mic_on'
  | 'mic_off'
  | 'camera_on'
  | 'camera_off'
  | 'screen_share_start'
  | 'screen_share_stop'
  | 'chat_message'
  | 'meeting_reconnected'
  | 'meeting_error'
  | 'meeting_leave'
  | 'ai_ready'
  | 'ai_listening'
  | 'ai_speaking'
  | 'ai_interrupted'
  | 'ai_error';

interface SoundSettings {
  enabled: boolean;
  volume: number; // 0 to 1
}

const SETTINGS_KEY = 'classpulse_meeting_sound_settings';

class SoundManager {
  private ctx: AudioContext | null = null;
  private settings: SoundSettings = { enabled: true, volume: 0.65 };
  private isUnlocked = false;

  // Deduplication & Coalescing trackers
  private lastPlayed: Map<string, number> = new Map();
  private recentJoins: Set<string | number> = new Set();
  private joinCoalesceTimer: any = null;
  private recentLeaves: Set<string | number> = new Set();
  private leaveCoalesceTimer: any = null;

  constructor() {
    this.loadSettings();
  }

  private loadSettings(): void {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.settings.enabled = parsed.enabled ?? true;
        this.settings.volume = typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : 0.65;
      }
    } catch {}
  }

  public saveSettings(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {}
  }

  public getSettings(): SoundSettings {
    return { ...this.settings };
  }

  public setEnabled(enabled: boolean): void {
    this.settings.enabled = enabled;
    this.saveSettings();
  }

  public setVolume(volume0to100: number): void {
    this.settings.volume = Math.max(0, Math.min(1, volume0to100 / 100));
    this.saveSettings();
  }

  public isEnabled(): boolean {
    return this.settings.enabled;
  }

  public getVolumePercent(): number {
    return Math.round(this.settings.volume * 100);
  }

  /**
   * Unlock AudioContext on genuine user interaction
   */
  public unlock(): void {
    if (typeof window === 'undefined') return;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this.isUnlocked = true;
    } catch (e) {
      console.warn('[SoundManager] unlock note:', e);
    }
  }

  private getAudioContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      } catch {}
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      try { this.ctx.resume(); } catch {}
    }
    return this.ctx;
  }

  /**
   * Main Play function
   */
  public play(sound: MeetingSound, uid?: string | number): void {
    if (!this.settings.enabled || this.settings.volume <= 0) return;
    if (typeof document !== 'undefined' && document.hidden) {
      // Reduce volume or skip minor sounds in background tab
      if (sound === 'mic_on' || sound === 'mic_off' || sound === 'camera_on' || sound === 'camera_off') {
        return;
      }
    }

    const ctx = this.getAudioContext();
    if (!ctx) return;

    // Deduplication check for same sound within 250ms
    const now = performance.now();
    const lastTime = this.lastPlayed.get(sound) || 0;
    if (now - lastTime < 180) return;
    this.lastPlayed.set(sound, now);

    // Dynamic synthesis based on sound type
    const masterVol = this.settings.volume * 0.25; // balanced base gain

    try {
      switch (sound) {
        case 'participant_join':
          this.handleParticipantJoin(uid, ctx, masterVol);
          break;

        case 'participant_leave':
          this.handleParticipantLeave(uid, ctx, masterVol);
          break;

        case 'meeting_connected':
          this.synthMeetingConnected(ctx, masterVol);
          break;

        case 'meeting_reconnected':
          this.synthMeetingReconnected(ctx, masterVol);
          break;

        case 'meeting_leave':
          this.synthMeetingLeave(ctx, masterVol);
          break;

        case 'meeting_error':
          this.synthMeetingError(ctx, masterVol);
          break;

        case 'mic_on':
          this.synthMicOn(ctx, masterVol);
          break;

        case 'mic_off':
          this.synthMicOff(ctx, masterVol);
          break;

        case 'camera_on':
          this.synthCameraOn(ctx, masterVol);
          break;

        case 'camera_off':
          this.synthCameraOff(ctx, masterVol);
          break;

        case 'screen_share_start':
          this.synthScreenShareStart(ctx, masterVol);
          break;

        case 'screen_share_stop':
          this.synthScreenShareStop(ctx, masterVol);
          break;

        case 'chat_message':
          this.synthChatMessage(ctx, masterVol);
          break;

        case 'ai_ready':
          this.synthAiReady(ctx, masterVol);
          break;

        case 'ai_listening':
          this.synthAiListening(ctx, masterVol);
          break;

        case 'ai_speaking':
          this.synthAiSpeaking(ctx, masterVol);
          break;

        case 'ai_interrupted':
          this.synthAiInterrupted(ctx, masterVol);
          break;

        case 'ai_error':
          this.synthAiError(ctx, masterVol);
          break;
      }
    } catch (e) {
      console.warn(`[SoundManager] playback error for ${sound}:`, e);
    }
  }

  // ─── Deduplicated & Coalesced Participant Lifecycle ─────────────────────────

  private handleParticipantJoin(uid: string | number | undefined, ctx: AudioContext, masterVol: number) {
    if (uid !== undefined) {
      if (this.recentJoins.has(uid)) return;
      this.recentJoins.add(uid);
      setTimeout(() => this.recentJoins.delete(uid), 3000);
    }

    if (this.joinCoalesceTimer) {
      // Coalesce multiple rapid joins
      return;
    }

    this.joinCoalesceTimer = setTimeout(() => {
      this.joinCoalesceTimer = null;
    }, 400);

    this.synthParticipantJoin(ctx, masterVol);
  }

  private handleParticipantLeave(uid: string | number | undefined, ctx: AudioContext, masterVol: number) {
    if (uid !== undefined) {
      if (this.recentLeaves.has(uid)) return;
      this.recentLeaves.add(uid);
      setTimeout(() => this.recentLeaves.delete(uid), 3000);
    }

    if (this.leaveCoalesceTimer) return;
    this.leaveCoalesceTimer = setTimeout(() => {
      this.leaveCoalesceTimer = null;
    }, 400);

    this.synthParticipantLeave(ctx, masterVol);
  }

  // ─── Procedural Synthesis Modules ──────────────────────────────────────────

  /**
   * 01. Participant Join: Warm, friendly, upward chime (G5 -> C6) ~400ms
   */
  private synthParticipantJoin(ctx: AudioContext, vol: number) {
    const t = ctx.currentTime;
    const notes = [
      { f: 783.99, start: 0, dur: 0.22 },     // G5
      { f: 1046.50, start: 0.12, dur: 0.28 },  // C6
    ];

    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.f, t + n.start);

      gain.gain.setValueAtTime(0, t + n.start);
      gain.gain.linearRampToValueAtTime(vol * 0.9, t + n.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + n.start + n.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t + n.start);
      osc.stop(t + n.start + n.dur);
    });
  }

  /**
   * 02. Participant Leave: Soft, descending 2-note tone (E5 -> C5) ~350ms
   */
  private synthParticipantLeave(ctx: AudioContext, vol: number) {
    const t = ctx.currentTime;
    const notes = [
      { f: 659.25, start: 0, dur: 0.18 },    // E5
      { f: 523.25, start: 0.10, dur: 0.25 },  // C5
    ];

    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.f, t + n.start);

      gain.gain.setValueAtTime(0, t + n.start);
      gain.gain.linearRampToValueAtTime(vol * 0.65, t + n.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + n.start + n.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t + n.start);
      osc.stop(t + n.start + n.dur);
    });
  }

  /**
   * 12. Meeting Connected: Subtle, pristine 3-note ascending chord ~450ms
   */
  private synthMeetingConnected(ctx: AudioContext, vol: number) {
    const t = ctx.currentTime;
    const notes = [
      { f: 523.25, start: 0, dur: 0.22 },     // C5
      { f: 659.25, start: 0.08, dur: 0.25 },  // E5
      { f: 1046.50, start: 0.16, dur: 0.35 }, // C6
    ];

    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.f, t + n.start);

      gain.gain.setValueAtTime(0, t + n.start);
      gain.gain.linearRampToValueAtTime(vol * 0.85, t + n.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + n.start + n.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t + n.start);
      osc.stop(t + n.start + n.dur);
    });
  }

  /**
   * 14. Meeting Reconnected: 2-note recovery chime (E5 -> C6) ~350ms
   */
  private synthMeetingReconnected(ctx: AudioContext, vol: number) {
    const t = ctx.currentTime;
    const notes = [
      { f: 659.25, start: 0, dur: 0.18 },
      { f: 1046.50, start: 0.10, dur: 0.28 },
    ];
    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.f, t + n.start);
      gain.gain.setValueAtTime(0, t + n.start);
      gain.gain.linearRampToValueAtTime(vol * 0.75, t + n.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + n.start + n.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + n.start);
      osc.stop(t + n.start + n.dur);
    });
  }

  /**
   * 15. Meeting Leave: Subtle descending departure tone ~300ms
   */
  private synthMeetingLeave(ctx: AudioContext, vol: number) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, t);
    osc.frequency.exponentialRampToValueAtTime(329.63, t + 0.25);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol * 0.7, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.30);
  }

  /**
   * 13. Meeting Error: Soft low-frequency warning ~350ms
   */
  private synthMeetingError(ctx: AudioContext, vol: number) {
    const t = ctx.currentTime;
    const notes = [
      { f: 369.99, start: 0, dur: 0.16 },
      { f: 329.63, start: 0.12, dur: 0.22 },
    ];
    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, t + n.start);
      gain.gain.setValueAtTime(0, t + n.start);
      gain.gain.linearRampToValueAtTime(vol * 0.7, t + n.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + n.start + n.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + n.start);
      osc.stop(t + n.start + n.dur);
    });
  }

  /**
   * 04. Mic On: Crisp, high confirmation tick ~130ms
   */
  private synthMicOn(ctx: AudioContext, vol: number) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(1046.5, t + 0.08);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol * 0.6, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  /**
   * 05. Mic Off: Soft muted lower tick ~130ms
   */
  private synthMicOff(ctx: AudioContext, vol: number) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.08);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol * 0.55, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  /**
   * 06. Camera On: Tiny confirmation chime ~120ms
   */
  private synthCameraOn(ctx: AudioContext, vol: number) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(783.99, t);
    osc.frequency.exponentialRampToValueAtTime(987.77, t + 0.06);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol * 0.5, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  /**
   * 07. Camera Off: Tiny descending confirmation ~120ms
   */
  private synthCameraOff(ctx: AudioContext, vol: number) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, t);
    osc.frequency.exponentialRampToValueAtTime(523.25, t + 0.06);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol * 0.45, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  /**
   * 08. Screen Share Start: Upward digital sweep ~280ms
   */
  private synthScreenShareStart(ctx: AudioContext, vol: number) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.22);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol * 0.65, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.28);
  }

  /**
   * 09. Screen Share Stop: Downward digital sweep ~240ms
   */
  private synthScreenShareStop(ctx: AudioContext, vol: number) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.18);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol * 0.55, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  /**
   * 10. Chat Message: Very soft notification chime ~200ms
   */
  private synthChatMessage(ctx: AudioContext, vol: number) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, t);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol * 0.5, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.20);
  }

  /**
   * 16. AI Tutor Ready: ClassPulse AI Sonic Identity (Two-tone ethereal chime E5 + B5 + E6) ~380ms
   */
  private synthAiReady(ctx: AudioContext, vol: number) {
    const t = ctx.currentTime;
    const chords = [
      { f: 659.25, start: 0, dur: 0.28 },     // E5
      { f: 987.77, start: 0.08, dur: 0.32 },  // B5
      { f: 1318.51, start: 0.14, dur: 0.36 }, // E6
    ];

    chords.forEach((c) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(c.f, t + c.start);

      gain.gain.setValueAtTime(0, t + c.start);
      gain.gain.linearRampToValueAtTime(vol * 0.7, t + c.start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + c.start + c.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + c.start);
      osc.stop(t + c.start + c.dur);
    });
  }

  /**
   * 17. AI Listening: Short gentle prompt acknowledgement ~100ms
   */
  private synthAiListening(ctx: AudioContext, vol: number) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.50, t);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol * 0.45, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.10);
  }

  /**
   * 18. AI Speaking: Subtle soft single-tone start transition ~80ms
   */
  private synthAiSpeaking(ctx: AudioContext, vol: number) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol * 0.35, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  /**
   * 19. AI Interrupted: Short crisp stop/cut confirmation ~90ms
   */
  private synthAiInterrupted(ctx: AudioContext, vol: number) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.06);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol * 0.6, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  /**
   * 20. AI Error: Gentle warning tone ~280ms
   */
  private synthAiError(ctx: AudioContext, vol: number) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(392.00, t);
    osc.frequency.exponentialRampToValueAtTime(329.63, t + 0.18);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol * 0.65, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.26);
  }
}

export const soundManager = new SoundManager();
