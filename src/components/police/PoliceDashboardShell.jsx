import React from 'react';
import { Shield, Search, Eye, Sparkles, Flame, LogOut, CheckCircle2 } from 'lucide-react';

export default function PoliceDashboardShell({ authority, onLogout }) {
  const officerName = authority?.name || 'Police Authority Officer';
  const officerRole = authority?.role || 'Inspector';
  const officerJurisdiction = authority?.jurisdiction || 'Zone 4 (Bandra - Khar)';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Shield className="w-5 h-5 text-blue-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">UniSafe Authority</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Mumbai Police Command
                </span>
              </div>
              <p className="text-xs text-slate-400">Law Enforcement Operations & Missing Persons Console</p>
            </div>
          </div>

          {/* Officer Session Profile & Logout */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-left">
              <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                {officerName.slice(0, 2).toUpperCase()}
              </div>
              <div className="leading-tight">
                <p className="text-xs font-semibold text-white">{officerName}</p>
                <p className="text-[10px] text-slate-400">{officerRole} • {officerJurisdiction}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-300 bg-red-950/60 hover:bg-red-900/60 border border-red-800/50 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Milestone 1 Status Banner */}
        <div className="p-4 rounded-2xl bg-slate-800/70 border border-blue-500/30 shadow-xs flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5 border border-blue-500/30">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Milestone 1 Active: Police Command Shell Initialized</h2>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
              Shared Supabase authentication and police-specific session verification are confirmed.
              Below are the placeholder module boundaries ready for integration in upcoming milestones.
            </p>
          </div>
        </div>

        {/* Milestone Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Missing Persons Dossiers */}
          <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center mb-3 border border-blue-500/30">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Missing Persons Dossiers</h3>
              <p className="text-xs text-slate-400 mt-1">
                Case registry, status transitions, and photo gallery.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between">
              <span className="text-[11px] font-medium text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">
                Integration: Milestone 3
              </span>
            </div>
          </div>

          {/* Card 2: Sightings Queue */}
          <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center mb-3 border border-teal-500/30">
                <Eye className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Sightings Verification Queue</h3>
              <p className="text-xs text-slate-400 mt-1">
                Review citizen visual sightings and officer match confirmations.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between">
              <span className="text-[11px] font-medium text-teal-300 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-md">
                Integration: Milestone 3
              </span>
            </div>
          </div>

          {/* Card 3: Biometric AI Matching */}
          <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center mb-3 border border-purple-500/30">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">InsightFace Biometric Matching</h3>
              <p className="text-xs text-slate-400 mt-1">
                512-d facial embedding extraction and candidate ranking.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between">
              <span className="text-[11px] font-medium text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md">
                Integration: Milestone 3
              </span>
            </div>
          </div>

          {/* Card 4: Heatmap */}
          <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center mb-3 border border-amber-500/30">
                <Flame className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">ML Heatmap & Hotspots</h3>
              <p className="text-xs text-slate-400 mt-1">
                Incident density clustering and regional safety maps.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between">
              <span className="text-[11px] font-medium text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                Reserved for Seana
              </span>
            </div>
          </div>
        </div>

        {/* Isolation Verification Note */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400">
          <p className="font-semibold text-slate-200">Department Isolation Policy Active:</p>
          <p className="mt-0.5">
            You are authenticated under the <strong>Mumbai Police</strong> authority profile.
            BMC-only civic complaint Kanban and municipal officer management are restricted and isolated from this dashboard.
          </p>
        </div>
      </main>
    </div>
  );
}

