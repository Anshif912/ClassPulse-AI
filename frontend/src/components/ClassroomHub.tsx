import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ExternalLink,
  VideoOff,
  ScreenShare,
  Maximize2,
  Minimize2,
  Info,
  AlertCircle,
  CheckCircle2,
  X,
  Tv,
  Globe,
  ChevronDown,
  ChevronUp,
  Cpu,
} from 'lucide-react';

interface ClassroomHubProps {
  meetingUrl: string;
  isMeetOpen: boolean;
  onOpenMeetTab: () => void;
}

interface StatusMessage {
  type: 'info' | 'error' | 'success';
  message: string;
}

export const ClassroomHub: React.FC<ClassroomHubProps> = ({
  meetingUrl,
  isMeetOpen,
  onOpenMeetTab,
}) => {
  const [isSharingTab, setIsSharingTab] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [displaySurface, setDisplaySurface] = useState<string>('tab');
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Environment checks
  const isStandalone = typeof window !== 'undefined' && window.top === window.self && window.parent === window;
  const isIframe = typeof window !== 'undefined' && (window.self !== window.top || window.parent !== window);
  const isEmbeddedPreview = isIframe;
  const isSecure = typeof window !== 'undefined' ? window.isSecureContext : false;
  const hasMediaDevices = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices);
  const hasGetDisplayMedia = typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function';

  // Detect browser name
  const getBrowserName = (): string => {
    if (typeof navigator === 'undefined') return 'Unknown';
    const ua = navigator.userAgent;
    if (ua.includes('Edg/')) return 'Microsoft Edge';
    if (ua.includes('Chrome/') && !ua.includes('Edg/')) return 'Google Chrome';
    if (ua.includes('Firefox/')) return 'Mozilla Firefox';
    if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Apple Safari';
    return 'Other Browser';
  };

  // Determine Screen Sharing Diagnostic State
  const getScreenSharingDiagnosticStatus = (): { status: 'READY' | 'BLOCKED' | 'FAILED' | 'ACTIVE'; reason?: string } => {
    if (isSharingTab) return { status: 'ACTIVE' };
    if (isEmbeddedPreview) {
      return {
        status: 'BLOCKED',
        reason: 'Embedded iframe environment blocks getDisplayMedia per browser permissions policy. Must run in a standalone browser tab.',
      };
    }
    if (!isSecure) {
      return {
        status: 'BLOCKED',
        reason: 'Insecure context. Screen sharing requires localhost or HTTPS.',
      };
    }
    if (!hasMediaDevices || !hasGetDisplayMedia) {
      return {
        status: 'BLOCKED',
        reason: 'navigator.mediaDevices.getDisplayMedia is not supported in this browser.',
      };
    }
    if (statusMessage?.type === 'error') {
      return {
        status: 'FAILED',
        reason: statusMessage.message,
      };
    }
    return { status: 'READY' };
  };

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Development Logging
  useEffect(() => {
    console.log('%c[ClassPulse Screen Share Runtime Diagnostics]', 'color: #8b5cf6; font-weight: bold;');
    console.log('• Browser:', getBrowserName());
    console.log('• window.isSecureContext:', isSecure);
    console.log('• Standalone Page (window.top === window.self):', isStandalone ? 'YES' : 'NO');
    console.log('• Iframe (window.self !== window.top):', isIframe ? 'YES' : 'NO');
    console.log('• navigator.mediaDevices:', hasMediaDevices ? 'AVAILABLE' : 'UNAVAILABLE');
    console.log('• typeof getDisplayMedia:', typeof navigator?.mediaDevices?.getDisplayMedia);
    console.log('• navigator.userAgent:', typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A');
    console.log('• window.location.href:', typeof window !== 'undefined' ? window.location.href : 'N/A');
    console.log('• window.location.protocol:', typeof window !== 'undefined' ? window.location.protocol : 'N/A');
  }, [isSecure, hasMediaDevices, hasGetDisplayMedia, isEmbeddedPreview, isStandalone, isIframe]);

  // Sync ref with state
  useEffect(() => {
    mediaStreamRef.current = mediaStream;
  }, [mediaStream]);

  // Clean up media tracks on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  // Ensure video element receives the stream whenever mediaStream changes
  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
      videoRef.current.autoplay = true;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      videoRef.current.play().catch((err) => {
        console.warn('[ClassPulse Video Play Notice]', err);
      });
    }
  }, [mediaStream]);

  // Callback ref to attach stream immediately as soon as the <video> DOM node mounts
  const setVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      if (node && mediaStream) {
        node.srcObject = mediaStream;
        node.autoplay = true;
        node.muted = true;
        node.playsInline = true;
        node.play().catch((err) => {
          console.warn('[ClassPulse Video Play Notice on mount]', err);
        });
      }
    },
    [mediaStream]
  );

  // Stop sharing cleanly and update state
  const stopTabSharing = useCallback((infoMsg?: string) => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setMediaStream(null);
    setIsSharingTab(false);

    if (infoMsg) {
      setStatusMessage({ type: 'info', message: infoMsg });
    }
  }, []);

  // Start browser screen/tab sharing using navigator.mediaDevices.getDisplayMedia
  // Called directly from user click gesture
  const startTabSharing = async () => {
    setStatusMessage(null);

    // 1. Check if running inside embedded iframe/webview
    if (isEmbeddedPreview) {
      console.warn('[ClassPulse] Screen capture blocked: Running inside embedded preview iframe.');
      setStatusMessage({
        type: 'error',
        message: 'ClassPulse is currently running inside an embedded preview. Screen/tab sharing must be started from a standalone Chrome or Edge tab.',
      });
      return;
    }

    // 2. Check secure context (HTTPS / localhost)
    if (!isSecure) {
      console.warn('[ClassPulse] Screen capture blocked: Non-secure context.');
      setStatusMessage({
        type: 'error',
        message: 'Screen sharing requires a secure browser context. Open ClassPulse using localhost or HTTPS.',
      });
      return;
    }

    // 3. Verify browser API support
    if (!hasMediaDevices || !hasGetDisplayMedia) {
      console.warn('[ClassPulse] Screen capture blocked: navigator.mediaDevices.getDisplayMedia unavailable.');
      setStatusMessage({
        type: 'error',
        message: 'Screen sharing is not supported in this browser. Please use Chrome or Edge.',
      });
      return;
    }

    try {
      console.log('[ClassPulse] Calling navigator.mediaDevices.getDisplayMedia({ video: true })...');

      // Direct user gesture invocation of getDisplayMedia
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false, // Visual preview only; ClassPulse microphone stream handles doubts
      });

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('No video track was returned from the screen capture.');
      }

      // Detect display surface if available (tab / window / monitor)
      let surfaceType = 'tab';
      try {
        const settings = videoTrack.getSettings();
        if (settings.displaySurface) {
          surfaceType = settings.displaySurface;
        }
      } catch (e) {
        // Ignore setting inspection errors
      }
      setDisplaySurface(surfaceType);

      console.log(`[ClassPulse] Tab Capture started successfully. Surface: ${surfaceType}`);

      // Listen for native track end (e.g. user clicks browser's floating "Stop sharing" bar)
      videoTrack.onended = () => {
        console.log('[ClassPulse] Native track.onended received from browser. Cleaning up stream.');
        stopTabSharing('Meeting tab sharing stopped.');
      };

      // Store stream and activate UI
      mediaStreamRef.current = stream;
      setMediaStream(stream);
      setIsSharingTab(true);
      setStatusMessage({
        type: 'success',
        message: 'Meeting tab shared successfully. Live meeting preview is active below.',
      });
    } catch (err: any) {
      const errName = err?.name || '';
      const errMsg = err?.message || '';

      console.error('[ClassPulse Tab Capture Error]', { name: errName, message: errMsg, error: err });

      let userError = 'Unable to start screen sharing.';

      if (errName === 'NotAllowedError') {
        userError = 'Screen sharing was cancelled or permission was denied.';
      } else if (errName === 'AbortError') {
        userError = 'Screen sharing was interrupted. Try again.';
      } else if (errName === 'NotFoundError') {
        userError = 'No shareable screen or tab was found.';
      } else if (errName === 'NotReadableError') {
        userError = 'The selected screen could not be captured. Check system screen recording permissions.';
      } else if (errName === 'OverconstrainedError') {
        userError = 'The requested screen capture constraints could not be satisfied.';
      } else if (errName === 'SecurityError') {
        userError = 'Browser security prevented screen sharing. Ensure ClassPulse is opened in a normal browser tab.';
      } else if (errName === 'TypeError') {
        userError = 'Screen sharing is unavailable in this browser environment.';
      } else if (errName === 'NotSupportedError' || errMsg.toLowerCase().includes('not supported')) {
        userError = isEmbeddedPreview
          ? 'ClassPulse is currently running inside an embedded preview. Screen/tab sharing must be started from a standalone Chrome or Edge tab.'
          : 'Screen sharing is not supported in this browser environment.';
      } else if (errMsg) {
        userError = `Unable to start screen sharing: ${errMsg}`;
      }

      setStatusMessage({ type: 'error', message: userError });
      stopTabSharing();
    }
  };

  const handleOpenInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  const diagState = getScreenSharingDiagnosticStatus();

  return (
    <div className="bg-slate-900/90 border-b border-slate-800 p-4 transition-all">
      {/* Top Status & Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        {/* Status Indicators */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
          {/* Google Meet Status */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 uppercase text-[10px] tracking-wider font-bold">Google Meet:</span>
            {isMeetOpen ? (
              <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ● Meet Open
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-full">
                ○ Meet Not Open
              </span>
            )}
          </div>

          {/* AI Status */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 uppercase text-[10px] tracking-wider font-bold">AI Status:</span>
            <span className="inline-flex items-center gap-1 text-blue-400 font-semibold bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              ● Ready for questions
            </span>
          </div>

          {/* Tab Sharing Status */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 uppercase text-[10px] tracking-wider font-bold">Tab Sharing:</span>
            {isSharingTab ? (
              <span className="inline-flex items-center gap-1 text-purple-400 font-semibold bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
                ● Meeting Tab Shared
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-full">
                ○ Meeting Tab Not Shared
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Diagnostics toggle */}
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 transition-colors"
            title="Toggle Screen Sharing Diagnostics"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span className="hidden md:inline text-[11px]">Diagnostics</span>
            {showDiagnostics ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Open / Focus Google Meet */}
          <button
            onClick={onOpenMeetTab}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors"
            title="Open or Focus Google Meet Tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Google Meet</span>
          </button>

          {/* Share / Stop Meeting Tab Button */}
          {!isSharingTab ? (
            <button
              onClick={startTabSharing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-600/20 transition-all"
              title="Share your Google Meet browser tab to see live video preview inside ClassPulse"
            >
              <ScreenShare className="w-3.5 h-3.5" />
              <span>Share Meeting Tab with ClassPulse</span>
            </button>
          ) : (
            <button
              onClick={() => stopTabSharing('Meeting tab sharing stopped.')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 transition-colors shadow-sm"
              title="Stop live meeting video preview"
            >
              <VideoOff className="w-3.5 h-3.5" />
              <span>Stop Meeting Tab Sharing</span>
            </button>
          )}
        </div>
      </div>

      {/* Diagnostics Panel (Expandable for runtime inspection) */}
      {showDiagnostics && (
        <div className="mb-3 p-3 bg-slate-950/90 border border-slate-800 rounded-xl text-[11px] font-mono grid grid-cols-2 sm:grid-cols-4 gap-2 animate-fadeIn">
          <div className="p-2 bg-slate-900 rounded-lg">
            <span className="text-slate-400 block text-[9px] uppercase">Browser</span>
            <span className="text-blue-400 font-bold">{getBrowserName()}</span>
          </div>
          <div className="p-2 bg-slate-900 rounded-lg">
            <span className="text-slate-400 block text-[9px] uppercase">Secure Context</span>
            <span className={isSecure ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {isSecure ? 'YES' : 'NO'}
            </span>
          </div>
          <div className="p-2 bg-slate-900 rounded-lg">
            <span className="text-slate-400 block text-[9px] uppercase">Standalone Page</span>
            <span className={isStandalone ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
              {isStandalone ? 'YES' : 'NO'}
            </span>
          </div>
          <div className="p-2 bg-slate-900 rounded-lg">
            <span className="text-slate-400 block text-[9px] uppercase">Iframe</span>
            <span className={isIframe ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
              {isIframe ? 'YES' : 'NO'}
            </span>
          </div>
          <div className="p-2 bg-slate-900 rounded-lg">
            <span className="text-slate-400 block text-[9px] uppercase">mediaDevices</span>
            <span className={hasMediaDevices ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {hasMediaDevices ? 'AVAILABLE' : 'UNAVAILABLE'}
            </span>
          </div>
          <div className="p-2 bg-slate-900 rounded-lg">
            <span className="text-slate-400 block text-[9px] uppercase">getDisplayMedia</span>
            <span className={hasGetDisplayMedia ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {hasGetDisplayMedia ? 'AVAILABLE' : 'UNAVAILABLE'}
            </span>
          </div>
          <div className="p-2 bg-slate-900 rounded-lg">
            <span className="text-slate-400 block text-[9px] uppercase">User Gesture</span>
            <span className="text-emerald-400 font-bold">VALID</span>
          </div>
          <div className="p-2 bg-slate-900 rounded-lg">
            <span className="text-slate-400 block text-[9px] uppercase">Screen Sharing</span>
            <span
              className={
                diagState.status === 'ACTIVE'
                  ? 'text-purple-400 font-bold'
                  : diagState.status === 'READY'
                  ? 'text-emerald-400 font-bold'
                  : diagState.status === 'BLOCKED'
                  ? 'text-amber-400 font-bold'
                  : 'text-rose-400 font-bold'
              }
            >
              {diagState.status}
            </span>
          </div>

          {diagState.reason && (
            <div className="col-span-2 sm:col-span-4 p-2 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-300 text-[10px]">
              <span className="text-slate-400 font-semibold uppercase block mb-0.5">Reason:</span>
              <span>{diagState.reason}</span>
            </div>
          )}
        </div>
      )}

      {/* Embedded Preview Environment Notice (If running in embedded iframe/webview) */}
      {isEmbeddedPreview && (
        <div className="mb-2.5 p-3 bg-amber-950/40 border border-amber-800/60 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-300 animate-fadeIn">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-200">
                ClassPulse is currently running inside an embedded preview. Screen/tab sharing must be started from a standalone Chrome or Edge tab.
              </p>
              <p className="text-[11px] text-amber-400/80 mt-0.5">
                Click below to launch ClassPulse in a standalone browser tab and use Share Meeting Tab.
              </p>
            </div>
          </div>
          <button
            onClick={handleOpenInNewTab}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-xs shrink-0 transition-colors shadow-sm"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>OPEN STANDALONE CLASS PULSE</span>
          </button>
        </div>
      )}

      {/* Live Video Preview Card */}
      {isSharingTab && (
        <div className="mt-3 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative transition-all animate-fadeIn">
          {/* Video Header Bar */}
          <div className="p-2.5 px-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Tv className="w-4 h-4 text-purple-400" />
              <span className="font-bold text-white tracking-wide">LIVE MEETING PREVIEW</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ● Meeting Tab Shared ({displaySurface})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors flex items-center gap-1 text-[11px]"
                title={isExpanded ? 'Shrink Video' : 'Expand Video'}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{isExpanded ? 'Shrink' : 'Expand'}</span>
              </button>

              <button
                onClick={() => stopTabSharing('Meeting tab sharing stopped.')}
                className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 text-rose-300 rounded-lg text-[11px] font-semibold transition-colors"
              >
                Stop Sharing
              </button>
            </div>
          </div>

          {/* Video Player */}
          <div className={`relative bg-black transition-all ${isExpanded ? 'h-[26rem]' : 'h-64'}`}>
            <video
              ref={setVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />
          </div>

          {/* Video Footer */}
          <div className="p-2 px-4 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Live Google Meet tab stream active in ClassPulse.</span>
            <span className="text-slate-500">Video preview only • ClassPulse microphone active for doubts</span>
          </div>
        </div>
      )}

      {/* Dynamic Status / Alert Messages */}
      {statusMessage && (
        <div
          className={`mt-2.5 p-3 rounded-2xl flex items-center justify-between gap-3 text-xs animate-fadeIn ${
            statusMessage.type === 'error'
              ? 'bg-rose-950/40 border border-rose-800/60 text-rose-300'
              : statusMessage.type === 'success'
              ? 'bg-emerald-950/40 border border-emerald-800/60 text-emerald-300'
              : 'bg-slate-950/80 border border-slate-800 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-blue-400 shrink-0" />
            )}
            <span>{statusMessage.message}</span>
          </div>

          <button
            onClick={() => setStatusMessage(null)}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Static Dual-Tab Helper when not sharing */}
      {!isSharingTab && !statusMessage && (
        <div className="mt-2.5 p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>
              Your Google Meet is running in another tab. Click <strong>"Share Meeting Tab with ClassPulse"</strong> to display the live meeting video here.
            </span>
          </div>
          <span className="text-[10px] text-slate-500 hidden sm:inline truncate max-w-xs">
            {meetingUrl}
          </span>
        </div>
      )}
    </div>
  );
};
