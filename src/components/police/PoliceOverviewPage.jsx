import React from 'react';
import {
  Users,
  Search,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  ArrowRight,
  ShieldAlert,
  MapPin,
  Calendar,
  Sparkles,
  FileText
} from 'lucide-react';
import { useDashboardNavigation } from '../authority/watermelon/navigation';

export default function PoliceOverviewPage({
  cases = [],
  sightings = [],
  loading = false,
  onSelectCase,
  onSelectSighting,
  onOpenRegister,
}) {
  const { navigate } = useDashboardNavigation();

  // Accurately derived metrics strictly from real data
  const totalCases = cases.length;
  const activeMissing = cases.filter((c) => c.status === 'Missing').length;
  const foundCases = cases.filter((c) => c.status === 'Found').length;
  const closedCases = cases.filter((c) => c.status === 'Closed').length;

  const totalSightings = sightings.length;
  const pendingSightings = sightings.filter((s) => !s.is_verified).length;
  const verifiedSightings = sightings.filter((s) => s.is_verified).length;

  const recentCases = cases.slice(0, 5);
  const pendingSightingsList = sightings
    .filter((s) => !s.is_verified)
    .slice(0, 4);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Police Operations Command
            </h1>
            <span className="px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              Live Registry
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time missing persons dossiers and citizen sighting verification.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenRegister}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Register Missing Person</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/sightings')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-foreground bg-secondary/80 hover:bg-secondary border border-border/60 transition-all cursor-pointer"
          >
            <Eye className="size-4 text-emerald-500" />
            <span>Sightings Queue ({pendingSightings})</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Missing */}
        <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active Missing
            </span>
            <div className="size-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <AlertTriangle className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-foreground tracking-tight">
              {loading ? '—' : activeMissing}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Active search investigations
            </p>
          </div>
        </div>

        {/* Card 2: Persons Found */}
        <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Located / Found
            </span>
            <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-foreground tracking-tight">
              {loading ? '—' : foundCases}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Confirmed safe & reunited
            </p>
          </div>
        </div>

        {/* Card 3: Pending Sighting Reviews */}
        <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pending Sightings
            </span>
            <div className="size-8 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-foreground tracking-tight">
              {loading ? '—' : pendingSightings}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Awaiting officer verification
            </p>
          </div>
        </div>

        {/* Card 4: Total Registry Dossiers */}
        <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Dossiers
            </span>
            <div className="size-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Users className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-foreground tracking-tight">
              {loading ? '—' : totalCases}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {closedCases} closed • {verifiedSightings} verified sightings
            </p>
          </div>
        </div>
      </div>

      {/* Main Two-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Registered Cases */}
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border/60 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Recent Missing Person Dossiers
                </h2>
                <p className="text-xs text-muted-foreground">
                  Latest reports indexed in the central registry
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/missing-persons')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                <span>View all ({totalCases})</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Loading dossiers...
              </div>
            ) : recentCases.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No missing person dossiers filed yet.
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {recentCases.map((c) => {
                  const isMissing = c.status === 'Missing';
                  const isFound = c.status === 'Found';

                  return (
                    <div
                      key={c.id}
                      onClick={() => onSelectCase && onSelectCase(c.id)}
                      className="py-3 flex items-center justify-between gap-3 hover:bg-secondary/40 px-2 rounded-xl cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-10 rounded-xl bg-secondary flex items-center justify-center shrink-0 border border-border/40 font-bold text-xs text-muted-foreground">
                          {c.full_name?.slice(0, 2).toUpperCase() || 'MP'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground truncate">
                              {c.full_name}
                            </span>
                            {c.case_code && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-secondary text-muted-foreground">
                                {c.case_code}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                            <span>{c.age ? `${c.age} yrs` : 'Age N/A'}</span>
                            <span>•</span>
                            <span>{c.gender || 'N/A'}</span>
                            {c.last_seen_date && (
                              <>
                                <span>•</span>
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="size-3" />
                                  {new Date(c.last_seen_date).toLocaleDateString()}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            isMissing
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : isFound
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-secondary text-muted-foreground border border-border/60'
                          }`}
                        >
                          {c.status || 'Active'}
                        </span>
                        <ArrowRight className="size-4 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 mt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Click any dossier to inspect facial photos and edit record details</span>
          </div>
        </div>

        {/* Right 1 Col: Pending Citizen Sightings Alert Queue */}
        <div className="bg-card rounded-2xl border border-border/60 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Citizen Sightings Queue
                </h2>
                <p className="text-xs text-muted-foreground">
                  Visual tips awaiting verification
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/sightings')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                <span>View queue</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Loading sightings...
              </div>
            ) : pendingSightingsList.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground">
                <CheckCircle2 className="size-8 mx-auto text-emerald-500/50 mb-2" />
                No unverified sightings pending.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingSightingsList.map((s) => {
                  const hasMatch =
                    s.ai_matches &&
                    (Array.isArray(s.ai_matches)
                      ? s.ai_matches.length > 0
                      : Object.keys(s.ai_matches).length > 0);

                  return (
                    <div
                      key={s.id}
                      onClick={() => onSelectSighting && onSelectSighting(s.id)}
                      className="p-3 rounded-xl bg-secondary/50 border border-border/40 hover:border-primary/40 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-medium text-foreground">
                          ID: {s.id.slice(0, 8)}...
                        </span>
                        {hasMatch ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                            <Sparkles className="size-3" />
                            AI Match
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">
                            Citizen Tip
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-2">
                        {s.address ? (
                          <span className="inline-flex items-center gap-1 truncate" title={s.address}>
                            <MapPin className="size-3 text-muted-foreground" />
                            {s.address}
                          </span>
                        ) : s.latitude && s.longitude ? (
                          <span className="inline-flex items-center gap-1 truncate">
                            <MapPin className="size-3 text-muted-foreground" />
                            {Number(s.latitude).toFixed(3)}, {Number(s.longitude).toFixed(3)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 truncate">
                            <MapPin className="size-3 text-muted-foreground" />
                            Location not provided
                          </span>
                        )}
                        {s.created_at && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3 text-muted-foreground" />
                            {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 mt-3 border-t border-border/40">
            <button
              type="button"
              onClick={() => navigate('/sightings')}
              className="w-full py-2 rounded-xl text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition-colors text-center cursor-pointer"
            >
              Open Full Sightings Queue
            </button>
          </div>
        </div>
      </div>

      {/* Honest Boundary Notice */}
      <div className="p-4 rounded-xl bg-secondary/40 border border-border/40 flex items-start gap-3">
        <FileText className="size-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">System Scope Notice:</strong> Current registry metrics and queues reflect all Mumbai Police command entries. Jurisdiction-based police station filtering, individual officer workload assignment, and status-change audit trails will become available once supported in the core database schema.
        </div>
      </div>
    </div>
  );
}

