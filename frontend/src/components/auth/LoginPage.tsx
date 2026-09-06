import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Mail,
  User,
  GraduationCap,
  ShieldCheck,
  ArrowRight,
  Loader2,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  Video,
  Mic,
  BookOpen,
  X,
  Calendar,
  Clock,
  Laptop,
  Users,
  Radio,
  FileCheck,
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { Logo } from '../common/Logo';
import { Lightfall } from '../effects/Lightfall';
import { SpecularButton } from '../effects/SpecularButton';

interface LoginPageProps {
  authError?: string | null;
}

export function LoginPage({ authError }: LoginPageProps = {}) {
  const { refetch } = useAuth();
  const navigate = useNavigate();

  // Form State
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [step, setStep] = useState<'input' | 'otp'>('input');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'TEACHER' | 'STUDENT'>('STUDENT');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);

  // Status State
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(authError || null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Step 1: Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.sendOtp(email.trim(), name.trim() || undefined, role);
      setSuccessMessage(res.message);
      if (res.devOtp) {
        setDevOtp(res.devOtp);
        setOtp(res.devOtp);
      }
      setStep('otp');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || otp.trim().length < 4) {
      setErrorMessage('Please enter the verification code.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await api.verifyOtp(email.trim(), otp.trim(), name.trim() || undefined, role);
      await refetch();
      window.location.href = '/dashboard';
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification failed. Please check your code.');
      setIsLoading(false);
    }
  };

  const isTeacher = role === 'TEACHER';

  return (
    <div className="min-h-screen bg-[#050816] text-[#F8FAFC] flex items-center justify-center p-4 sm:p-6 lg:p-10 selection:bg-blue-600/40 selection:text-blue-200 antialiased relative overflow-hidden">
      {/* ── Interactive Lightfall WebGL Background (Matching Landing Page Opacity 0.8) ──── */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-80">
        <Lightfall
          colors={['#38BDF8', '#6366F1', '#D946EF', '#22D3EE']}
          backgroundColor="#050816"
          speed={0.35}
          streakCount={3}
          streakWidth={1.2}
          streakLength={1.4}
          glow={1.2}
          density={0.5}
          twinkle={1}
          zoom={3.2}
          backgroundGlow={0.6}
          opacity={0.8}
          mouseInteraction={false}
        />
      </div>

      {/* ── Seamless Blended Dark Glassmorphism Container (Zero Eye Strain) ──── */}
      <div className="w-full max-w-5xl rounded-[36px] bg-[#090E23]/92 backdrop-blur-2xl text-slate-100 shadow-[0_25px_80px_rgba(0,0,0,0.8)] border border-[#1C274C] p-6 sm:p-8 lg:p-10 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center transition-all duration-300">
        
        {/* ── Left Column (6 Cols): Clean Form Area ─────────────────────────── */}
        <div className="lg:col-span-6 flex flex-col justify-between h-full space-y-6">
          
          {/* Top Bar: Brand Pill & Dynamic Role Switcher */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-1.5 rounded-full border border-[#233566] bg-[#0E1633]/80 hover:bg-[#121B3D] text-xs font-semibold text-slate-200 hover:text-white transition-all shadow-xs cursor-pointer flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span>ClassPulse</span>
            </button>

            {/* Role Switcher Pill with Distinctive Colored Badges */}
            <div className="flex items-center bg-[#060A18] p-1 rounded-full border border-[#192344] text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setRole('STUDENT')}
                className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${
                  !isTeacher
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <User className="w-3 h-3" />
                <span>Student</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('TEACHER')}
                className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${
                  isTeacher
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Teacher</span>
              </button>
            </div>
          </div>

          {/* Header Title (Role Dynamic) */}
          <div className="space-y-1.5 text-center lg:text-left pt-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider mb-1 bg-slate-900 border border-slate-800 text-slate-400">
              <span>{isTeacher ? 'Teacher Workspace' : 'Student Learning Portal'}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {mode === 'signup'
                ? isTeacher ? 'Create Teacher Account' : 'Create Student Account'
                : isTeacher ? 'Welcome, Instructor' : 'Welcome back, Student'}
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              {mode === 'signup'
                ? isTeacher
                  ? 'Host live video classes, upload notes, and empower students with AI'
                  : 'Join live interactive classes and ask doubts privately in தமிழ்/English'
                : isTeacher
                  ? 'Sign in to manage your classrooms, lectures, and course materials'
                  : 'Sign in to access your enrolled courses and pick up where you left off'}
            </p>
          </div>

          {/* Feedback Banners */}
          {errorMessage && (
            <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-2xl text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && step === 'otp' && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-2xl text-xs text-emerald-300 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                {successMessage}
              </p>
              {devOtp && (
                <p className="text-[11px] text-emerald-400/90 font-mono">
                  Dev OTP auto-filled: <strong>{devOtp}</strong>
                </p>
              )}
            </div>
          )}

          {/* Form Content */}
          {step === 'input' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              {mode === 'signup' && (
                <div className="space-y-1 text-left">
                  <label className="text-[11px] font-semibold text-slate-400 ml-3">
                    {isTeacher ? 'Instructor Full Name' : 'Your Full Name'}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={isTeacher ? 'e.g. Dr. Evelyn / James' : 'e.g. Rahul / Anshif'}
                    className="w-full px-5 py-3.5 rounded-full bg-[#060A18] hover:bg-[#080D20] focus:bg-[#0A1028] text-xs font-medium text-white placeholder-slate-500 border border-[#1A2548] focus:border-blue-500 focus:outline-none transition-all shadow-inner"
                  />
                </div>
              )}

              <div className="space-y-1 text-left">
                <label className="text-[11px] font-semibold text-slate-400 ml-3">
                  {isTeacher ? 'Institutional / Teacher Email' : 'Student Email Address'}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isTeacher ? 'professor@university.edu / email@domain.com' : 'student@college.edu / email@domain.com'}
                  required
                  className="w-full px-5 py-3.5 rounded-full bg-[#060A18] hover:bg-[#080D20] focus:bg-[#0A1028] text-xs font-medium text-white placeholder-slate-500 border border-[#1A2548] focus:border-blue-500 focus:outline-none transition-all shadow-inner"
                />
              </div>

              {/* Submit Button with Specular Highlight */}
              <div className="pt-2">
                <SpecularButton
                  type="submit"
                  disabled={isLoading}
                  size="md"
                  radius={999}
                  tint={isTeacher ? '#7C3AED' : '#2563EB'}
                  tintOpacity={1}
                  textColor="#ffffff"
                  lineColor={isTeacher ? '#C084FC' : '#93C5FD'}
                  baseColor={isTeacher ? '#6D28D9' : '#1D4ED8'}
                  intensity={1.3}
                  className="w-full !py-3.5 font-bold shadow-lg"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Sending verification code...</span>
                    </span>
                  ) : (
                    <span>{mode === 'signup' ? 'Create Account & Continue →' : 'Sign In with OTP →'}</span>
                  )}
                </SpecularButton>
              </div>

              {/* Social Login Strip (Apple & Google) */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {}}
                  className="py-2.5 px-4 rounded-full border border-[#1C274C] bg-[#0A0F26] hover:bg-[#0E1636] text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                >
                  <span></span>
                  <span>Apple</span>
                </button>

                <button
                  type="button"
                  onClick={() => {}}
                  className="py-2.5 px-4 rounded-full border border-[#1C274C] bg-[#0A0F26] hover:bg-[#0E1636] text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                >
                  <span className="font-bold text-red-400">G</span>
                  <span>Google</span>
                </button>
              </div>
            </form>
          ) : (
            /* Step 2: OTP Verification */
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-1 text-left">
                <label className="text-[11px] font-semibold text-slate-400 ml-3">Enter 6-Digit Verification Code</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  maxLength={6}
                  autoFocus
                  required
                  className="w-full py-3.5 px-5 rounded-full bg-[#060A18] focus:bg-[#0A1028] text-center font-mono text-lg font-bold tracking-widest text-white border border-[#1A2548] focus:border-blue-500 focus:outline-none transition-all shadow-inner"
                />
              </div>

              <SpecularButton
                type="submit"
                disabled={isLoading}
                size="md"
                radius={999}
                tint={isTeacher ? '#7C3AED' : '#2563EB'}
                tintOpacity={1}
                textColor="#ffffff"
                lineColor={isTeacher ? '#C084FC' : '#93C5FD'}
                baseColor={isTeacher ? '#6D28D9' : '#1D4ED8'}
                intensity={1.3}
                className="w-full !py-3.5 font-bold shadow-lg"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Verifying...</span>
                  </span>
                ) : (
                  <span>Verify & Enter {isTeacher ? 'Teacher Dashboard' : 'Student Dashboard'} →</span>
                )}
              </SpecularButton>

              <button
                type="button"
                onClick={() => setStep('input')}
                className="text-xs font-semibold text-slate-400 hover:text-white block mx-auto pt-1 cursor-pointer"
              >
                ← Back to email
              </button>
            </form>
          )}

          {/* Footer Meta Links */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-4 border-t border-[#16203D]">
            <div>
              {mode === 'signup' ? (
                <span>
                  Already have an account?{' '}
                  <button
                    onClick={() => {
                      setMode('signin');
                      setErrorMessage(null);
                    }}
                    className="font-bold text-blue-400 underline hover:text-blue-300 cursor-pointer ml-1"
                  >
                    Sign in
                  </button>
                </span>
              ) : (
                <span>
                  New to ClassPulse?{' '}
                  <button
                    onClick={() => {
                      setMode('signup');
                      setErrorMessage(null);
                    }}
                    className="font-bold text-blue-400 underline hover:text-blue-300 cursor-pointer ml-1"
                  >
                    Create account
                  </button>
                </span>
              )}
            </div>

            <a href="#terms" className="hover:underline text-slate-500 hover:text-slate-400">
              Privacy & Terms
            </a>
          </div>
        </div>

        {/* ── Right Column (6 Cols): Dribbble Visual Showcase (Role Responsive) ─ */}
        <div className="lg:col-span-6 relative h-full min-h-[460px] sm:min-h-[520px] rounded-[28px] overflow-hidden bg-[#060914] shadow-2xl border border-[#1E2C52] flex items-center justify-center">
          
          {/* Main Realistic Image based on Role */}
          <img
            src={
              isTeacher
                ? 'https://images.unsplash.com/photo-1577896851231-70ef18881754?w=1000&auto=format&fit=crop&q=80'
                : 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1000&auto=format&fit=crop&q=80'
            }
            alt={isTeacher ? 'Teacher Hosting Live Classroom' : 'Students Learning Together'}
            className="w-full h-full object-cover object-center transform scale-105 filter brightness-90 contrast-105"
          />

          {/* Dark gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#050816]/90 via-black/30 to-[#050816]/40 pointer-events-none" />

          {/* 1. Close Button (Top Right Pill) */}
          <button
            onClick={() => navigate('/')}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md border border-slate-700/80 flex items-center justify-center text-slate-300 hover:text-white shadow-lg transition-transform active:scale-95 z-20 cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* 2. Floating Top Badge (Dynamic Role Information) */}
          <div className={`absolute top-5 left-1/3 -translate-x-1/4 px-4 py-2 rounded-2xl shadow-2xl border text-left z-10 animate-in fade-in slide-in-from-top-3 backdrop-blur-md ${
            isTeacher
              ? 'bg-purple-950/90 text-purple-100 border-purple-500/50'
              : 'bg-[#0B1530]/90 text-blue-100 border-blue-500/50'
          }`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-bold leading-tight">
                {isTeacher ? 'Hosting: CS Fundamentals' : 'Live Class: CS Fundamentals'}
              </p>
              <span className={`w-2 h-2 rounded-full ${isTeacher ? 'bg-purple-400' : 'bg-emerald-400 animate-pulse'}`} />
            </div>
            <p className="text-[9px] text-slate-300 font-medium mt-0.5">
              {isTeacher ? 'Unit 1 • AI Course Grounding Active' : '09:30am–10:30am • 8 Students Online'}
            </p>
          </div>

          {/* 3. Floating Avatar Cluster */}
          <div className="absolute top-1/3 right-6 flex flex-col items-center gap-1.5 z-10">
            <div className="relative">
              <img
                src={
                  isTeacher
                    ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'
                    : 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80'
                }
                alt="Active Member"
                className="w-11 h-11 rounded-full object-cover border-2 border-blue-500 shadow-xl"
              />
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900" />
            </div>
            <div className="flex -space-x-2">
              <img
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80"
                alt="Member 2"
                className="w-8 h-8 rounded-full object-cover border-2 border-slate-800 shadow-md"
              />
              <img
                src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80"
                alt="Member 3"
                className="w-8 h-8 rounded-full object-cover border-2 border-slate-800 shadow-md"
              />
            </div>
          </div>

          {/* 4. Floating Calendar / Weekly Strip Widget (Glassmorphism) */}
          <div className="absolute bottom-28 left-6 right-6 p-3 rounded-2xl bg-slate-950/75 backdrop-blur-xl border border-slate-700/60 text-white shadow-2xl z-10">
            <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
              <div><span className="text-slate-400 block text-[9px]">Sun</span><span className="font-semibold">22</span></div>
              <div><span className="text-slate-400 block text-[9px]">Mon</span><span className="font-semibold">23</span></div>
              <div><span className="text-slate-400 block text-[9px]">Tue</span><span className="font-semibold">24</span></div>
              <div className={`rounded-xl py-0.5 font-bold shadow-md ${
                isTeacher ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'
              }`}>
                <span className="text-white/80 block text-[9px]">Wed</span>
                <span>25</span>
              </div>
              <div><span className="text-slate-400 block text-[9px]">Thu</span><span className="font-semibold">26</span></div>
              <div><span className="text-slate-400 block text-[9px]">Fri</span><span className="font-semibold">27</span></div>
              <div><span className="text-slate-400 block text-[9px]">Sat</span><span className="font-semibold">28</span></div>
            </div>
          </div>

          {/* 5. Floating Bottom Card Widget (Dynamic Role Data) */}
          <div className="absolute bottom-5 left-6 bg-slate-900/90 backdrop-blur-md p-3.5 rounded-2xl shadow-2xl border border-slate-700/70 text-slate-100 z-10 w-56 text-left space-y-1.5 animate-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                {isTeacher ? <FileCheck className="w-3.5 h-3.5 text-purple-400" /> : <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />}
                <span>{isTeacher ? 'Course Materials Indexed' : 'Next AI Doubt Session'}</span>
              </span>
              <span className={`w-1.5 h-1.5 rounded-full ${isTeacher ? 'bg-purple-400' : 'bg-emerald-400'}`} />
            </div>
            <p className="text-[9px] text-slate-400 font-medium">
              {isTeacher ? '12 Chunks • Ready for Student Tutoring' : '12:00pm–01:00pm • Private AI Mic'}
            </p>
            <div className="flex items-center -space-x-1.5 pt-0.5">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&auto=format&fit=crop&q=80"
                alt="User 1"
                className="w-5 h-5 rounded-full object-cover border border-slate-900"
              />
              <img
                src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=60&auto=format&fit=crop&q=80"
                alt="User 2"
                className="w-5 h-5 rounded-full object-cover border border-slate-900"
              />
              <img
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&auto=format&fit=crop&q=80"
                alt="User 3"
                className="w-5 h-5 rounded-full object-cover border border-slate-900"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
