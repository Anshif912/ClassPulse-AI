import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Play,
  Video,
  BookOpen,
  Globe,
  ArrowRight,
  CheckCircle2,
  Users,
  Mic,
  ShieldCheck,
  Lock,
  FileText,
  MessageSquare,
  Layers,
  ChevronRight,
  GraduationCap,
  Volume2,
  Cpu,
} from 'lucide-react';
import { Logo } from './common/Logo';
import { Lightfall } from './effects/Lightfall';
import { SpecularButton } from './effects/SpecularButton';

interface LandingPageProps {
  onJoinSession?: (meetUrl: string, participantName: string) => Promise<void>;
  onLaunchDemoMode?: () => void;
  isLoading?: boolean;
  errorMessage?: string;
  successStatus?: string;
}

export const LandingPage: React.FC<LandingPageProps> = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'student' | 'teacher'>('student');

  return (
    <div className="min-h-screen bg-[#050816] text-[#F8FAFC] flex flex-col selection:bg-blue-600/40 selection:text-blue-200 antialiased relative overflow-x-hidden">
      {/* ── Interactive Lightfall WebGL Background (Reverted with Opacity 0.8) ──── */}
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

      {/* ── Top Navigation Bar ──────────────────────────────────────────────── */}
      <header className="h-20 px-6 sm:px-12 max-w-7xl mx-auto w-full flex items-center justify-between z-30 relative border-b border-slate-800/40">
        <div onClick={() => navigate('/')} className="cursor-pointer">
          <Logo size="sm" showTagline={true} />
        </div>

        {/* Center Links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-400">
          <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#ai-tutor" className="hover:text-white transition-colors">AI Tutor</a>
          <a href="#workflows" className="hover:text-white transition-colors">For Educators</a>
          <a href="#trust" className="hover:text-white transition-colors">Privacy & Trust</a>
        </nav>

        {/* Right CTAs */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/login')}
            className="text-xs font-bold text-slate-300 hover:text-white px-3.5 py-2 transition-colors cursor-pointer"
          >
            Sign In
          </button>
          <SpecularButton
            size="sm"
            radius={999}
            tint="#2563EB"
            tintOpacity={1}
            lineColor="#93C5FD"
            baseColor="#1D4ED8"
            intensity={1.2}
            onClick={() => navigate('/login')}
          >
            Get Started
          </SpecularButton>
        </div>
      </header>

      {/* ── Main Hero Section (UX Corrected: Clear Hierarchy + Real Product Window) ── */}
      <main className="flex-1 max-w-7xl mx-auto px-6 sm:px-12 w-full flex flex-col justify-center py-10 lg:py-16 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* Left Column (45%): Value Proposition, Trust signals, Dominant CTA */}
          <div className="lg:col-span-5 space-y-6">
            {/* Level 1: Eyebrow Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-950/60 border border-blue-500/30 text-blue-300 shadow-sm backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span>Live Classroom + Private AI Tutor</span>
            </div>

            {/* Level 1: Clean 2-Line Headline */}
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-[1.15]">
                The AI Classroom That{' '}
                <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-fuchsia-400 bg-clip-text text-transparent">
                  Actually Helps You Learn
                </span>
              </h1>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
                Attend live video lectures and ask doubts privately in <span className="text-white font-semibold">Tamil, English, or Hindi</span>. Get instant, voice-enabled answers strictly grounded in your teacher’s course materials without interrupting the class.
              </p>
            </div>

            {/* Key Differentiators Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Zero audio leak to classroom</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Grounded in lecture PDFs</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                <span>Private multi-turn AI voice</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span>English • தமிழ் • Tanglish • Hindi</span>
              </div>
            </div>

            {/* Level 3 & 4: Dominant Primary CTA + Subordinate Secondary CTA */}
            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <SpecularButton
                size="lg"
                radius={999}
                tint="#2563EB"
                tintOpacity={1}
                lineColor="#93C5FD"
                baseColor="#1D4ED8"
                intensity={1.4}
                onClick={() => navigate('/login')}
              >
                <span>Get Started Free</span>
                <ArrowRight className="w-4 h-4" />
              </SpecularButton>

              <a
                href="#how-it-works"
                className="px-6 py-3.5 rounded-full text-xs sm:text-sm font-bold bg-slate-900/80 hover:bg-slate-800 border border-slate-700/70 text-slate-300 hover:text-white transition-all active:scale-95 flex items-center gap-2 backdrop-blur-sm cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 text-slate-400 fill-slate-400" />
                <span>See How It Works</span>
              </a>
            </div>
          </div>

          {/* Right Column (55%): Realistic ClassPulse Product Experience Window */}
          <div className="lg:col-span-7 relative group">
            {/* Ambient Background Glow behind Mockup */}
            <div className="absolute -inset-1.5 bg-gradient-to-tr from-blue-600/30 via-purple-600/25 to-cyan-500/20 rounded-3xl blur-2xl opacity-70 group-hover:opacity-90 transition-opacity pointer-events-none" />

            {/* Window Outer Shell */}
            <div className="relative rounded-3xl p-1 bg-gradient-to-b from-[#1E294B] via-[#111827] to-[#0B0F1A] border border-[#2B3B66]/80 shadow-2xl shadow-blue-950/80 overflow-hidden backdrop-blur-xl transition-all duration-300 group-hover:border-blue-500/50">
              {/* Product Mockup Image */}
              <div className="relative rounded-[22px] overflow-hidden bg-[#060914] aspect-[16/10] sm:aspect-[16/9.8] flex items-center justify-center">
                <img
                  src="/assets/classpulse-product-preview.jpg"
                  alt="ClassPulse Live Classroom with Private AI Tutor and Course-Grounded Notes"
                  className="w-full h-full object-cover object-center transform transition-transform duration-700 group-hover:scale-[1.01]"
                  loading="eager"
                />

                {/* Subtle depth lighting overlay */}
                <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-[22px] pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 1: How ClassPulse Works (Simple 3-Step Visual UX) ─────────── */}
        <div className="mt-20 pt-12 border-t border-slate-800/60" id="how-it-works">
          <div className="text-center max-w-2xl mx-auto space-y-2 mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Simple Workflow</span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">How ClassPulse Works</h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Transforming live lectures into interactive, doubt-free learning sessions in 3 simple steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="p-6 rounded-3xl bg-[#0B1021] border border-[#16203D] hover:border-[#2563EB]/50 transition-all space-y-4 relative group">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-blue-500 font-mono">01</span>
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Video className="w-5 h-5" />
                </div>
              </div>
              <h3 className="text-base font-bold text-white">Teacher Starts the Class</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Instructors launch real-time video classrooms and attach PDF lecture notes, textbook chapters, and syllabus materials in one click.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-3xl bg-[#0B1021] border border-[#16203D] hover:border-purple-500/50 transition-all space-y-4 relative group">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-purple-500 font-mono">02</span>
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Mic className="w-5 h-5" />
                </div>
              </div>
              <h3 className="text-base font-bold text-white">Students Ask Private Doubts</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Students activate their dedicated private microphone to ask questions aloud in English, Tamil, or Hindi without interrupting the live lecture.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-3xl bg-[#0B1021] border border-[#16203D] hover:border-cyan-500/50 transition-all space-y-4 relative group">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-cyan-500 font-mono">03</span>
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Sparkles className="w-5 h-5" />
                </div>
              </div>
              <h3 className="text-base font-bold text-white">AI Answers with Exact Citations</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                ClassPulse AI synthesizes clear answers strictly anchored in the teacher’s uploaded PDFs with verified page citations and spoken audio playback.
              </p>
            </div>
          </div>
        </div>

        {/* ── Section 2: Core Platform Capabilities (Features) ────────────────── */}
        <div className="mt-20 pt-12 border-t border-slate-800/60" id="features">
          <div className="text-center max-w-2xl mx-auto space-y-2 mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Product Capabilities</span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">Engineered for deep comprehension</h2>
            <p className="text-xs sm:text-sm text-slate-400">
              No generic chatbot hallucination. Everything is verified against your actual syllabus.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-[#080D1E] border border-[#151D38] space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Video className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white">Live Classroom RTC</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ultra-low latency HD audio/video built on Agora RTC with stage resizing and screen sharing.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#080D1E] border border-[#151D38] space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Lock className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white">Zero Audio Leakage</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Private AI mic stream is strictly local and never published to the classroom broadcast channel.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#080D1E] border border-[#151D38] space-y-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <BookOpen className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white">Course-Grounded RAG</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Strict semantic retrieval anchored in teacher-provided PDFs with exact page number citations.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#080D1E] border border-[#151D38] space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Globe className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white">Multilingual Voice</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Full conversational voice support for English, Tamil (தமிழ்), Tanglish, and Hindi learners.
              </p>
            </div>
          </div>
        </div>

        {/* ── Section 3: Teacher vs Student Experience Tabs ───────────────────── */}
        <div className="mt-20 pt-12 border-t border-slate-800/60" id="workflows">
          <div className="text-center max-w-2xl mx-auto space-y-2 mb-8">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Role-Tailored UX</span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">Designed for both sides of the classroom</h2>
          </div>

          <div className="flex justify-center mb-8">
            <div className="p-1 bg-[#0E152E] border border-[#1E294B] rounded-2xl flex items-center gap-2">
              <button
                onClick={() => setActiveTab('student')}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'student'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                For Students
              </button>
              <button
                onClick={() => setActiveTab('teacher')}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'teacher'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                For Teachers
              </button>
            </div>
          </div>

          <div className="max-w-4xl mx-auto p-8 rounded-3xl bg-[#0B1021] border border-[#182346] shadow-xl">
            {activeTab === 'student' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
                <div className="space-y-4">
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                    DARK IMMERSIVE LEARNING WORKSPACE
                  </span>
                  <h3 className="text-xl font-bold text-white">Ask anything without fear of judgment</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Never fall behind in complex lectures. When you miss a concept, talk to your private AI companion in your native language. It explains step-by-step using your teacher's exact syllabus.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>One-tap classroom join via 8-character code</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Personal doubt history and downloadable notes</span>
                    </li>
                  </ul>
                </div>
                <div className="p-5 rounded-2xl bg-[#060914] border border-[#16203D] space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="font-bold text-slate-200">Your Private Doubt Session</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Encrypted</span>
                  </div>
                  <p className="text-slate-400">Student: "Can you explain vacuum tubes simply?"</p>
                  <p className="text-purple-300 font-medium">AI: "Think of vacuum tubes like early light-bulb switches that controlled electric current in first-gen computers (Page 2)."</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
                <div className="space-y-4">
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                    LIGHT PRODUCTIVITY TEACHING WORKSPACE
                  </span>
                  <h3 className="text-xl font-bold text-white">Teach uninterrupted while AI assists every student</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Focus on lecturing without stopping every two minutes for basic clarification questions. ClassPulse AI handles routine student doubts grounded strictly in the PDF materials you provide.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-400" />
                      <span>One-click PDF chunking & vector indexing</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-400" />
                      <span>Zero classroom audio interference</span>
                    </li>
                  </ul>
                </div>
                <div className="p-5 rounded-2xl bg-[#060914] border border-[#16203D] space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="font-bold text-slate-200">Teacher Material Ingestion</span>
                    <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">AI Ready</span>
                  </div>
                  <p className="text-slate-300 font-semibold">Evolution_of_Computers.pdf</p>
                  <p className="text-slate-400">12 pages • 48 semantic chunks indexed and verified for classroom retrieval.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Section 4: Privacy, Trust & Compliance ───────────────────────────── */}
        <div className="mt-20 pt-12 border-t border-slate-800/60" id="trust">
          <div className="p-8 rounded-3xl bg-gradient-to-b from-[#0B1021] to-[#070B18] border border-[#16203D] text-center space-y-4 max-w-4xl mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Trust, Isolation & Privacy by Design</h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
              We never train public models on your proprietary lecture materials. All student doubt queries and classroom streams are encrypted in transit and isolated per session.
            </p>
            <div className="flex flex-wrap justify-center gap-6 pt-2 text-xs text-slate-300 font-medium">
              <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-emerald-400" /> Local Audio Separation</span>
              <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-blue-400" /> Strict PDF Sourced Citations</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-purple-400" /> Role-Based Access Control</span>
            </div>
          </div>
        </div>

        {/* ── Section 5: Bottom Final CTA ─────────────────────────────────────── */}
        <div className="mt-20 text-center space-y-6 py-8">
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Ready to experience the future of live learning?
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
            Join ClassPulse today to deliver interactive video classes with private multilingual AI assistance.
          </p>
          <div className="pt-2 flex justify-center">
            <SpecularButton
              size="lg"
              radius={999}
              tint="#2563EB"
              tintOpacity={1}
              lineColor="#93C5FD"
              baseColor="#1D4ED8"
              intensity={1.4}
              onClick={() => navigate('/login')}
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-4 h-4" />
            </SpecularButton>
          </div>
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="py-8 border-t border-slate-900 bg-[#04060E] text-center text-xs text-slate-500 z-10 relative space-y-2">
        <p>ClassPulse — The AI Classroom That Actually Helps You Learn</p>
        <p className="text-[11px] text-slate-600">
          Learn Together. Go Further. • English • தமிழ் • Tanglish • Hindi
        </p>
      </footer>
    </div>
  );
};
