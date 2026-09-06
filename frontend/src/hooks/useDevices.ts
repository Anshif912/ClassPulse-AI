import { useState, useEffect, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';

// ──────────────────────────────────────────────────────────────────────────────
// useDevices
// Manages camera / microphone enumeration and change events.
// Uses MediaDeviceInfo (browser API) for typed compatibility.
// ──────────────────────────────────────────────────────────────────────────────

interface DeviceState {
  cameras: MediaDeviceInfo[];
  microphones: MediaDeviceInfo[];
  playbackDevices: MediaDeviceInfo[];
  selectedCamera: string | null;
  selectedMicrophone: string | null;
  permissionError: string | null;
  isLoading: boolean;
}

export function useDevices() {
  const [devices, setDevices] = useState<DeviceState>({
    cameras: [],
    microphones: [],
    playbackDevices: [],
    selectedCamera: null,
    selectedMicrophone: null,
    permissionError: null,
    isLoading: true,
  });

  const loadDevices = useCallback(async () => {
    setDevices((prev) => ({ ...prev, isLoading: true, permissionError: null }));
    try {
      // Use native MediaDevices API for broad compatibility
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const cameras = allDevices.filter((d) => d.kind === 'videoinput');
      const microphones = allDevices.filter((d) => d.kind === 'audioinput');
      const playbackDevices = allDevices.filter((d) => d.kind === 'audiooutput');

      setDevices((prev) => ({
        ...prev,
        cameras,
        microphones,
        playbackDevices,
        selectedCamera: prev.selectedCamera ?? cameras[0]?.deviceId ?? null,
        selectedMicrophone: prev.selectedMicrophone ?? microphones[0]?.deviceId ?? null,
        isLoading: false,
        permissionError: null,
      }));
    } catch (err: any) {
      let permissionError = 'Could not access camera/microphone.';
      if (err.name === 'NotAllowedError') {
        permissionError =
          'Camera and microphone access was denied. Please allow permissions in your browser.';
      } else if (err.name === 'NotFoundError') {
        permissionError = 'No camera or microphone found. Please connect a device.';
      }
      setDevices((prev) => ({
        ...prev,
        isLoading: false,
        permissionError,
      }));
    }
  }, []);

  useEffect(() => {
    loadDevices();

    // Reload when devices change (plug/unplug)
    const handleDeviceChange = () => loadDevices();
    navigator.mediaDevices?.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [loadDevices]);

  const selectCamera = useCallback((deviceId: string) => {
    setDevices((prev) => ({ ...prev, selectedCamera: deviceId }));
  }, []);

  const selectMicrophone = useCallback((deviceId: string) => {
    setDevices((prev) => ({ ...prev, selectedMicrophone: deviceId }));
  }, []);

  return {
    ...devices,
    reloadDevices: loadDevices,
    selectCamera,
    selectMicrophone,
  };
}
