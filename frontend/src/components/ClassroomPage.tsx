import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, Home } from 'lucide-react';
import { Classroom, PreJoinConfig } from '../types';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { PreJoinScreen } from './PreJoinScreen';
import { NativeClassroom } from './NativeClassroom';

// ──────────────────────────────────────────────────────────────────────────────
// ClassroomPage
// Route: /class/:classId
// Auto-joins the class (creates ClassMembership server-side), then shows
// PreJoin screen, then loads NativeClassroom.
// ──────────────────────────────────────────────────────────────────────────────

type PageState = 'loading' | 'prejoin' | 'classroom' | 'error' | 'left';

export function ClassroomPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [joinConfig, setJoinConfig] = useState<PreJoinConfig | null>(null);

  // Fetch classroom info + auto-join (idempotent — server handles "already a member")
  useEffect(() => {
    if (!classId) {
      setErrorMessage('Invalid classroom link.');
      setPageState('error');
      return;
    }

    const upper = classId.toUpperCase();

    // Join first (creates membership if not already a member), then fetch info
    api.joinClass(upper)
      .catch(() => {}) // Ignore "already a member" or error — getClass will still work
      .then(() => api.getClass(upper))
      .then((cls) => {
        setClassroom(cls);
        setPageState('prejoin');
      })
      .catch((err) => {
        setErrorMessage(
          err.status === 404
            ? `Classroom "${upper}" not found. Please check the link.`
            : err.message || 'Unable to load classroom. Please try again.'
        );
        setPageState('error');
      });
  }, [classId]);

  const handleJoin = (config: PreJoinConfig) => {
    setJoinConfig(config);
    setPageState('classroom');
  };

  const handleLeave = async () => {
    // Record attendance leave server-side
    if (classId) {
      try { await api.recordLeave(classId.toUpperCase()); } catch {}
    }
    setPageState('left');
  };

  // ─── States ─────────────────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-slate-400 text-sm">Loading classroom...</p>
        </div>
      </div>
    );
  }

  if (pageState === 'error') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-950/40 border border-red-800/40 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7 text-red-400" />
          </div>
          <div>
            <p className="text-white font-bold">Classroom Not Found</p>
            <p className="text-sm text-slate-400 mt-1">{errorMessage}</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 mx-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm text-slate-300 transition-colors"
          >
            <Home className="w-4 h-4" />
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (pageState === 'left') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-2xl">
            👋
          </div>
          <div>
            <p className="text-white font-bold">You left the classroom</p>
            <p className="text-sm text-slate-400 mt-1">{classroom?.name}</p>
          </div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => setPageState('prejoin')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold text-white transition-colors"
            >
              Rejoin
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm text-slate-300 transition-colors"
            >
              <Home className="w-4 h-4" />
              Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (pageState === 'prejoin' && classroom) {
    return (
      <PreJoinScreen
        classroom={classroom}
        onJoin={handleJoin}
        defaultRole="student"
      />
    );
  }

  if (pageState === 'classroom' && classroom && joinConfig) {
    return (
      <NativeClassroom
        classroom={classroom}
        uid={joinConfig.uid}
        participantName={joinConfig.name}
        role={joinConfig.role}
        initialCameraOn={joinConfig.cameraEnabled}
        initialMicOn={joinConfig.micEnabled}
        onLeave={handleLeave}
      />
    );
  }

  return null;
}
