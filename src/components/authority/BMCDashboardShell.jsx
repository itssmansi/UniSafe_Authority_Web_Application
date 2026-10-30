import React from 'react';
import { Building2, Kanban, Users, MapPin, Flame, LogOut, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function BMCDashboardShell({ authority, onLogout }) {
  const officerName = authority?.name || 'BMC Municipal Officer';
  const officerRole = authority?.role || 'Ward Officer';
  const officerWard = authority?.jurisdiction || 'Ward H-West (Bandra)';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-unisafe-midnight-blue text-white flex items-center justify-center font-bold shadow-xs">
              <Building2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-slate-900">UniSafe Authority</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                  BMC Corporation
                </span>
              </div>
              <p className="text-xs text-slate-500">Municipal Operations & Civic Infrastructure Console</p>
            </div>
          </div>

          {/* Officer Session Profile & Logout */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-left">
              <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold">
                {officerName.slice(0, 2).toUpperCase()}
              </div>
              <div className="leading-tight">
                <p className="text-xs font-semibold text-slate-900">{officerName}</p>
                <p className="text-[10px] text-slate-500">{officerRole} • {officerWard}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
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
        <div className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-xs flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Milestone 1 Active: BMC Shell Initialized</h2>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              Shared Supabase authentication and department-specific session verification are confirmed.
              Below are the placeholder module boundaries ready for integration in upcoming milestones.
            </p>
          </div>
        </div>

        {/* Milestone Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Kanban */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-3">
                <Kanban className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Civic-Issue Kanban Board</h3>
              <p className="text-xs text-slate-500 mt-1">
                Field dispatch pipeline by SLA and severity stage.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                Integration: Milestone 2
              </span>
            </div>
          </div>

          {/* Card 2: Officers */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center mb-3">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Ward & Officer Management</h3>
              <p className="text-xs text-slate-500 mt-1">
                Municipal roster and ward complaint unlinking.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">
                Integration: Milestone 2
              </span>
            </div>
          </div>

          {/* Card 3: Civic Map */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
                <MapPin className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Interactive Civic Map</h3>
              <p className="text-xs text-slate-500 mt-1">
                Geo-tagged civic issues with category overlays.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                Integration: Milestone 2
              </span>
            </div>
          </div>

          {/* Card 4: Heatmap */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-3">
                <Flame className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">ML Heatmap & Hotspots</h3>
              <p className="text-xs text-slate-500 mt-1">
                DBSCAN cluster analysis and incident hotspots.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                Reserved for Seana
              </span>
            </div>
          </div>
        </div>

        {/* Isolation Verification Note */}
        <div className="p-4 rounded-xl bg-slate-100/80 border border-slate-200 text-xs text-slate-600">
          <p className="font-semibold text-slate-800">Department Isolation Policy Active:</p>
          <p className="mt-0.5">
            You are authenticated under the <strong>BMC Corporation</strong> authority profile.
            Police missing-person dossiers and sightings queues are restricted and isolated from this dashboard.
          </p>
        </div>
      </main>
    </div>
  );
}

