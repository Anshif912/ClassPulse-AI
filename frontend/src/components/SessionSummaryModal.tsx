import React, { useState } from 'react';
import { SessionSummary } from '../types';
import { Award, BookOpen, CheckCircle, Clock, Copy, Download, Home, HelpCircle, MessageSquare, Check } from 'lucide-react';

interface SessionSummaryModalProps {
  summary: SessionSummary;
  onClose: () => void;
}

export const SessionSummaryModal: React.FC<SessionSummaryModalProps> = ({ summary, onClose }) => {
  const [copied, setCopied] = useState(false);

  const generateMarkdownExport = () => {
    let md = `# ClassPulse AI — Classroom Session Summary\n\n`;
    md += `- **Date:** ${new Date().toLocaleDateString()}\n`;
    md += `- **Google Meet:** ${summary.meetingUrl}\n`;
    md += `- **Duration:** ${summary.durationMinutes} minutes\n`;
    md += `- **Total Questions Asked:** ${summary.totalQuestions}\n\n`;

    md += `## 📚 Topics Discussed\n`;
    summary.topicsDiscussed.forEach(t => {
      md += `- ${t}\n`;
    });
    md += `\n`;

    md += `## 💡 Key Concepts Learned\n`;
    summary.keyConceptsLearned.forEach(k => {
      md += `### ${k.concept}\n${k.summary}\n\n`;
      k.keyPoints.forEach(p => {
        md += `- ${p}\n`;
      });
      md += `\n`;
    });

    md += `## 🎯 Concepts to Review\n`;
    summary.conceptsToReview.forEach(r => {
      md += `- **${r.concept}:** ${r.suggestion}\n`;
    });
    md += `\n`;

    md += `## 💬 Complete Q&A Log\n`;
    summary.conversationLog.forEach((log, idx) => {
      md += `### Doubt ${idx + 1}: "${log.question}"\n`;
      md += `${log.answer}\n\n`;
    });

    return md;
  };

  const handleCopy = () => {
    const md = generateMarkdownExport();
    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const md = generateMarkdownExport();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ClassPulse_Session_Notes_${new Date().toISOString().substring(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">ClassPulse Session Summary</h3>
              <p className="text-xs text-slate-400">Class notes and concept breakdown generated from your session</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors text-xs flex items-center gap-1.5"
              title="Copy Markdown Notes"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors text-xs flex items-center gap-1.5 font-medium shadow"
              title="Download Notes (.md)"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download Notes</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl text-center">
              <Clock className="w-4 h-4 text-blue-400 mx-auto mb-1" />
              <div className="text-lg font-extrabold text-white">{summary.durationMinutes} min</div>
              <div className="text-[10px] uppercase font-semibold text-slate-400">Duration</div>
            </div>

            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl text-center">
              <HelpCircle className="w-4 h-4 text-indigo-400 mx-auto mb-1" />
              <div className="text-lg font-extrabold text-white">{summary.totalQuestions}</div>
              <div className="text-[10px] uppercase font-semibold text-slate-400">Doubts Solved</div>
            </div>

            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl text-center">
              <BookOpen className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
              <div className="text-lg font-extrabold text-white">{summary.topicsDiscussed.length}</div>
              <div className="text-[10px] uppercase font-semibold text-slate-400">Topics Mastered</div>
            </div>
          </div>

          {/* Key Concepts Learned */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              Key Concepts Learned
            </h4>
            <div className="space-y-2.5">
              {summary.keyConceptsLearned.map((c, idx) => (
                <div key={idx} className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-2xl space-y-1.5">
                  <div className="text-xs font-bold text-blue-300">{c.concept}</div>
                  <p className="text-xs text-slate-300">{c.summary}</p>
                  <ul className="text-[11px] text-slate-400 space-y-1 pl-3 list-disc">
                    {c.keyPoints.map((pt, pIdx) => (
                      <li key={pIdx}>{pt}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Concepts to Review */}
          {summary.conceptsToReview.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                🎯 Focus Concepts for Next Class
              </h4>
              <div className="p-4 bg-amber-950/20 border border-amber-800/40 rounded-2xl space-y-2">
                {summary.conceptsToReview.map((rev, idx) => (
                  <div key={idx} className="text-xs text-amber-200">
                    <strong>{rev.concept}:</strong> {rev.suggestion}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conversation Log Preview */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-slate-400" />
              Session Doubts Log
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {summary.conversationLog.map((log, idx) => (
                <div key={idx} className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl space-y-1">
                  <div className="text-xs font-semibold text-blue-300">Q: {log.question}</div>
                  <div className="text-[11px] text-slate-400 truncate">A: {log.answer}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Session data saved locally. Ready for next class.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center gap-1.5"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Return to Home</span>
          </button>
        </div>
      </div>
    </div>
  );
};
