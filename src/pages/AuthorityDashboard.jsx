import React, { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import {
  getAuthorityProfile,
  getComplaints,
  getNotifications,
  getAuthorities,
} from '../services/authorityService'
import {
  getMissingPersons,
  getSightings,
} from '../services/policeService'

import DashboardLayout from '../components/authority/watermelon/dashboard-layout'
import { DashboardPage } from '../components/authority/watermelon/dashboard-content'
import {
  DashboardNavigationProvider,
  useDashboardNavigation,
} from '../components/authority/watermelon/navigation'
import { ThemeProvider } from '../components/authority/watermelon/theme-provider'

import AuthorityComplaintDetails from '../components/authority/AuthorityComplaintDetails'
import KanbanBoard from '../screens/kanban-board/KanbanBoard'
import Heatmap from './Heatmap'
import BmcOfficersPage from './BmcOfficersPage'

// Police components
import PoliceOverviewPage from '../components/police/PoliceOverviewPage'
import MissingPersonsList from '../components/police/MissingPersonsList'
import SightingsQueue from '../components/police/SightingsQueue'
import RegisterModal from '../components/police/RegisterModal'
import CaseDetailModal from '../components/police/CaseDetailModal'
import SightingDetailModal from '../components/police/SightingDetailModal'
import NotificationToast from '../components/police/NotificationToast'

import {
  Building,
  MapPin,
  Phone,
  Mail,
  Loader2,
  Plus,
} from 'lucide-react'

// ============================================================
// BMC AUTHORITY ROUTER
// ============================================================

function DashboardRouter({
  authority,
  complaints,
  officers,
  notifications,
  onSelectComplaint,
  onUpdateComplaint,
  onLogout,
  onRefresh,
}) {
  const { pathname } = useDashboardNavigation()

  let content = null

  if (pathname === '/') {
    content = (
      <DashboardPage
        authority={authority}
        complaints={complaints}
        officers={officers}
        onSelectComplaint={onSelectComplaint}
      />
    )
  } else if (pathname === '/kanban') {
    content = (
      <div className="p-4 sm:p-6 w-full h-full min-h-[750px] animate-in fade-in duration-300">
        <div className="mb-4">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Field Dispatch Kanban Board
          </h2>
          <p className="text-xs text-muted-foreground">
            Track and drag field tickets by priority and resolution stage.
          </p>
        </div>
        <div className="w-full">
          <KanbanBoard hideHeader={true} initialOfficers={officers} />
        </div>
      </div>
    )
  } else if (pathname === '/heatmap') {
    content = (
      <div className="w-full animate-in fade-in duration-300">
        <Heatmap authority={authority} isEmbedded={true} />
      </div>
    )
  } else if (pathname === '/bmc-officers' || pathname === '/officers') {
    content = (
      <BmcOfficersPage
        officers={officers}
        complaints={complaints}
        onRefresh={onRefresh}
      />
    )
  } else if (pathname === '/settings') {
    content = (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto animate-in fade-in duration-300">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Authority Officer Profile & Ward
          </h2>
          <p className="text-xs text-muted-foreground">
            Official credentials, jurisdiction parameters, and department contact info.
          </p>
        </div>
        <div className="bg-card p-6 rounded-2xl border border-border/60 shadow-xs space-y-6">
          <div className="flex items-center gap-4 pb-6 border-b border-border/40">
            <div className="size-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-2xl">
              {authority?.name?.slice(0, 2) || 'AU'}
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">{authority?.name}</h3>
              <p className="text-xs text-primary font-medium">{authority?.role || 'Zonal Authority Lead'}</p>
              <p className="text-xs text-muted-foreground">{authority?.department || 'Brihanmumbai Municipal Corporation'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 rounded-xl bg-secondary/50 border border-border/40 flex items-start gap-3">
              <Building className="size-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Department</p>
                <p className="text-sm font-semibold text-foreground">{authority?.department || 'Brihanmumbai Municipal Corporation'}</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-secondary/50 border border-border/40 flex items-start gap-3">
              <MapPin className="size-5 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Jurisdiction / Ward</p>
                <p className="text-sm font-semibold text-foreground">{authority?.jurisdiction || 'Ward H-West (Bandra - Khar)'}</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-secondary/50 border border-border/40 flex items-start gap-3">
              <Phone className="size-5 text-sky-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Official Phone</p>
                <p className="text-sm font-semibold text-foreground">{authority?.phone || '+91 22 2642 1234'}</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-secondary/50 border border-border/40 flex items-start gap-3">
              <Mail className="size-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email</p>
                <p className="text-sm font-semibold text-foreground">{authority?.email || 'authority@unisafe.mumbai.gov.in'}</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border/40 flex justify-end">
            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2 text-xs font-semibold text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-lg transition-colors cursor-pointer"
            >
              Sign Out of Authority Portal
            </button>
          </div>
        </div>
      </div>
    )
  } else {
    // Default fallback to Dashboard Overview
    content = (
      <DashboardPage
        authority={authority}
        complaints={complaints}
        officers={officers}
        onSelectComplaint={onSelectComplaint}
      />
    )
  }

  const handleSelectComplaintFromNotif = (complaintOrId) => {
    if (!complaintOrId) return;
    if (typeof complaintOrId === 'object' && (complaintOrId.title || complaintOrId.status)) {
      onSelectComplaint(complaintOrId);
    } else {
      const id = typeof complaintOrId === 'string' ? complaintOrId : complaintOrId.id;
      const found = complaints.find((c) => c.id === id);
      if (found) {
        onSelectComplaint(found);
      } else {
        onSelectComplaint({ id });
      }
    }
  };

  return (
    <DashboardLayout
      authority={authority}
      onLogout={onLogout}
      onSelectComplaint={handleSelectComplaintFromNotif}
    >
      {content}
    </DashboardLayout>
  );
}

// ============================================================
// POLICE AUTHORITY ROUTER
// ============================================================

function PoliceDashboardRouter({ authority, onLogout }) {
  const { pathname } = useDashboardNavigation()
  const [cases, setCases] = useState([])
  const [sightings, setSightings] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Modals state
  const [selectedCaseId, setSelectedCaseId] = useState(null)
  const [selectedSightingId, setSelectedSightingId] = useState(null)
  const [isRegisterOpen, setIsRegisterOpen] = useState(false)

  // Toast notifications
  const [notifications, setNotifications] = useState([])

  const addNotification = (message, type = 'success') => {
    const id = Date.now() + Math.random()
    setNotifications((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    }, 4500)
  }

  const dismissNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const loadPoliceData = async () => {
    setLoading(true)
    try {
      const [casesRes, sightingsRes] = await Promise.all([
        getMissingPersons('all', null, authority?.jurisdiction || null),
        getSightings('all'),
      ])
      // Filter cases for the current officer's jurisdiction when specified
      const allLoadedCases = casesRes?.missing_persons || []
      const stationCases = authority?.jurisdiction
        ? allLoadedCases.filter(
            (c) => !c.jurisdiction || c.jurisdiction.toLowerCase() === authority.jurisdiction.toLowerCase()
          )
        : allLoadedCases

      setCases(stationCases)
      setSightings(sightingsRes?.sightings || [])
    } catch (err) {
      console.error('Failed to load police registry data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPoliceData()
  }, [refreshTrigger, authority?.jurisdiction])

  const handleRegisterSuccess = (newCase) => {
    addNotification(
      `Case ${newCase.case_code || ''} successfully filed for ${newCase.full_name}. Facial vector indexed.`,
      'success'
    )
    setRefreshTrigger((prev) => prev + 1)
  }

  const handleCaseUpdated = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  const handleSightingUpdated = (sightingId, result) => {
    setRefreshTrigger((prev) => prev + 1)
    if (result?.top_match) {
      addNotification(
        `High similarity match identified (${(result.top_match.similarity_score * 100).toFixed(1)}%). Sighting queue updated.`,
        'success'
      )
    }
  }

  let content = null

  if (pathname === '/') {
    content = (
      <PoliceOverviewPage
        cases={cases}
        sightings={sightings}
        loading={loading}
        onSelectCase={(id) => setSelectedCaseId(id)}
        onSelectSighting={(id) => setSelectedSightingId(id)}
        onOpenRegister={() => setIsRegisterOpen(true)}
      />
    )
  } else if (pathname === '/missing-persons') {
    content = (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 animate-in fade-in duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Missing Persons Dossiers
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Law enforcement case registry and visual biometric database.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsRegisterOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all cursor-pointer w-fit"
          >
            <Plus className="size-4" />
            <span>Register Missing Person</span>
          </button>
        </div>
        <MissingPersonsList
          authority={authority}
          onSelectCase={(id) => setSelectedCaseId(id)}
          onOpenRegister={() => setIsRegisterOpen(true)}
          refreshTrigger={refreshTrigger}
        />
      </div>
    )
  } else if (pathname === '/sightings') {
    content = (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 animate-in fade-in duration-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Citizen Sightings & Verification Queue
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review visual citizen sightings, inspect AI face matching scores, and confirm official sightings.
          </p>
        </div>
        <SightingsQueue
          onSelectSighting={(id) => setSelectedSightingId(id)}
          refreshTrigger={refreshTrigger}
        />
      </div>
    )
  } else if (pathname === '/heatmap') {
    content = (
      <div className="w-full animate-in fade-in duration-300">
        <Heatmap authority={authority} isEmbedded={true} />
      </div>
    )
  } else if (pathname === '/settings') {
    content = (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto animate-in fade-in duration-300">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Police Officer Credentials & Station
          </h2>
          <p className="text-xs text-muted-foreground">
            Official law enforcement credentials and department contact parameters.
          </p>
        </div>
        <div className="bg-card p-6 rounded-2xl border border-border/60 shadow-xs space-y-6">
          <div className="flex items-center gap-4 pb-6 border-b border-border/40">
            <div className="size-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-2xl">
              {authority?.name?.slice(0, 2) || 'PO'}
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">{authority?.name}</h3>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                {authority?.role || 'Inspector of Police'}
              </p>
              <p className="text-xs text-muted-foreground">
                {authority?.department || 'Mumbai Police Command'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 rounded-xl bg-secondary/50 border border-border/40 flex items-start gap-3">
              <Building className="size-5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Department
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {authority?.department || 'Mumbai Police'}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-secondary/50 border border-border/40 flex items-start gap-3">
              <MapPin className="size-5 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Jurisdiction / Command Zone
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {authority?.jurisdiction || 'Zone 4 (Bandra - Khar)'}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-secondary/50 border border-border/40 flex items-start gap-3">
              <Phone className="size-5 text-sky-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Control Room Dispatch
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {authority?.phone || '100 / +91 22 2262 0111'}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-secondary/50 border border-border/40 flex items-start gap-3">
              <Mail className="size-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Official Email
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {authority?.email || 'police@unisafe.mumbai.gov.in'}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border/40 flex justify-end">
            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2 text-xs font-semibold text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-lg transition-colors cursor-pointer"
            >
              Sign Out of Police Command
            </button>
          </div>
        </div>
      </div>
    )
  } else {
    // Default fallback to Police Overview
    content = (
      <PoliceOverviewPage
        cases={cases}
        sightings={sightings}
        loading={loading}
        onSelectCase={(id) => setSelectedCaseId(id)}
        onSelectSighting={(id) => setSelectedSightingId(id)}
        onOpenRegister={() => setIsRegisterOpen(true)}
      />
    )
  }

  return (
    <>
      <DashboardLayout
        authority={authority}
        onLogout={onLogout}
        onSelectCase={(id) => setSelectedCaseId(id)}
        onSelectSighting={(id) => setSelectedSightingId(id)}
      >
        {content}
      </DashboardLayout>

      {/* Register Missing Person Modal */}
      <RegisterModal
        isOpen={isRegisterOpen}
        authority={authority}
        onClose={() => setIsRegisterOpen(false)}
        onSuccess={handleRegisterSuccess}
      />

      {/* Case Details Dossier Modal */}
      <CaseDetailModal
        personId={selectedCaseId}
        authority={authority}
        isOpen={Boolean(selectedCaseId)}
        onClose={() => setSelectedCaseId(null)}
        onCaseUpdated={handleCaseUpdated}
      />

      {/* Sighting Details Modal */}
      <SightingDetailModal
        sightingId={selectedSightingId}
        isOpen={Boolean(selectedSightingId)}
        onClose={() => setSelectedSightingId(null)}
        onOpenCaseDossier={(caseId) => setSelectedCaseId(caseId)}
        onSightingUpdated={handleSightingUpdated}
      />

      {/* Feedback Toast */}
      <NotificationToast
        notifications={notifications}
        onDismiss={dismissNotification}
      />
    </>
  )
}

// ============================================================
// MAIN AUTHORITY DASHBOARD SHELL
// ============================================================

export default function AuthorityDashboard({ authority: propAuthority, onLogout }) {
  const [authority, setAuthority] = useState(propAuthority || null)
  const [complaints, setComplaints] = useState([])
  const [notifications, setNotifications] = useState([])
  const [officers, setOfficers] = useState([])
  const [loading, setLoading] = useState(!propAuthority)
  const [selectedComplaint, setSelectedComplaint] = useState(null)

  const loadData = async () => {
    try {
      const profile = propAuthority || (await getAuthorityProfile())
      if (profile) {
        setAuthority(profile)
        const dept = (profile.department || '').trim().toUpperCase()
        if (dept === 'BMC') {
          const [comps, notifs, auths] = await Promise.all([
            getComplaints(profile),
            getNotifications(profile.id),
            getAuthorities(),
          ])
          setComplaints(comps || [])
          setNotifications(notifs || [])
          setOfficers(auths || [])
        }
      } else {
        setAuthority(null)
      }
    } catch (err) {
      console.error('Dashboard initialization error:', err)
      setAuthority(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [propAuthority])

  const handleLogout = async () => {
    if (onLogout) {
      await onLogout()
    } else {
      localStorage.removeItem('unisafe_authority')
      localStorage.removeItem('user')
      await supabase.auth.signOut()
      window.location.href = '/authority/login'
    }
  }

  const handleUpdateComplaint = (complaintId, newStatus) => {
    setComplaints((prev) =>
      prev.map((c) => (c.id === complaintId ? { ...c, status: newStatus } : c))
    )
    if (selectedComplaint?.id === complaintId) {
      setSelectedComplaint((prev) => ({ ...prev, status: newStatus }))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-xs font-medium text-slate-400">
            Loading UniSafe Authority Dashboard...
          </p>
        </div>
      </div>
    )
  }

  // Never render a dashboard if authority profile is null or unverified
  if (!authority) {
    return <Navigate to="/authority/login" replace />
  }

  const dept = (authority.department || '').trim().toUpperCase()

  // Route Police authorities to the integrated Watermelon Police Dashboard
  if (dept === 'POLICE') {
    return (
      <ThemeProvider defaultTheme="light" storageKey="unisafe-authority-theme">
        <DashboardNavigationProvider initialPath="/">
          <PoliceDashboardRouter
            authority={authority}
            onLogout={handleLogout}
          />
        </DashboardNavigationProvider>
      </ThemeProvider>
    )
  }

  // Route BMC authorities to Pranav's complete BMC Authority Dashboard
  if (dept === 'BMC') {
    return (
      <ThemeProvider defaultTheme="light" storageKey="unisafe-authority-theme">
        <DashboardNavigationProvider initialPath="/">
          <DashboardRouter
            onRefresh={loadData}
            authority={authority}
            complaints={complaints}
            officers={officers}
            notifications={notifications}
            onSelectComplaint={setSelectedComplaint}
            onUpdateComplaint={handleUpdateComplaint}
            onLogout={handleLogout}
          />

          {/* Selected Complaint Detail Drawer */}
          <AuthorityComplaintDetails
            complaint={selectedComplaint}
            authority={authority}
            onClose={() => setSelectedComplaint(null)}
            onUpdate={handleUpdateComplaint}
          />
        </DashboardNavigationProvider>
      </ThemeProvider>
    )
  }

  // Unrecognized department: explicitly halt rather than exposing a wrong dashboard
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center text-white font-sans">
      <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl border border-amber-500/30">
        <h2 className="text-xl font-bold mb-2">Unrecognized Department</h2>
        <p className="text-sm text-slate-400 mb-6">
          Authority account &quot;{authority.name}&quot; has unknown department: &quot;{authority.department}&quot;. Expected BMC or POLICE.
        </p>
        <button
          onClick={handleLogout}
          className="w-full py-2.5 px-4 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-medium cursor-pointer"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
