import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastContainer } from './components/Toast'
import { canUpload } from './lib/libraryConstants'
import { LayoutGrid, BookOpen, Upload, BarChart3, IdCard, Printer, CreditCard, Inbox, Settings, ClipboardEdit, Megaphone, Bot, Layers, Gamepad2, FolderOpen, Camera, LogOut, ChevronLeft, ChevronRight, Stethoscope, Wifi, FileText } from 'lucide-react'

// Pages
import SplashPage from './pages/Splash'
import LoginPage from './pages/Login'
import ForgotPasswordPage from './pages/ForgotPassword'
import DashboardPage from './pages/Dashboard'
import StudentDashboardPage from './pages/StudentDashboard'
import AdminDashboardPage from './pages/AdminDashboard'
import LecturerDashboardPage from './pages/LecturerDashboard'
import LibraryPage from './pages/Library'
import LibraryUploadPage from './pages/LibraryUpload'
import ResultsPage from './pages/Results'
import DigitalIDPage from './pages/DigitalID'
import PrintWalletPage from './pages/PrintWallet'
import WifiPage from './pages/Wifi'
import PrintQueuePage from './pages/PrintQueue'
import OperatorDashboardPage from './pages/OperatorDashboard'
import OnboardingEmailPage from './pages/OnboardingEmail'
import OnboardingBiodataPage from './pages/OnboardingBiodata'
import AdminPage from './pages/Admin'
import AdminStudentsPage from './pages/AdminStudents'
import AdminLecturersPage from './pages/AdminLecturers'
import AdminPaymentsPage from './pages/AdminPayments'
import AdminResultsPage from './pages/AdminResults'
import SiteHealthPage from './pages/SiteHealth'
import LecturerResultsPage from './pages/LecturerResults'
import AnnouncementsPage from './pages/Announcements'
import AIPage from './pages/AI'
import FlashcardsPage from './pages/Flashcards'
import FlashcardsCreatePage from './pages/FlashcardsCreate'
import FlashcardsEditPage from './pages/FlashcardsEdit'
import FlashcardsStudyPage from './pages/FlashcardsStudy'
import PastQuestions from './pages/PastQuestions'
import SimulationPage from './pages/Simulation'
import PaymentPage from './pages/Payment'
import RegistrarDashboardPage from './pages/RegistrarDashboard'
import RegistrarStudentsPage from './pages/RegistrarStudents'
import RegistrarTranscriptsPage from './pages/RegistrarTranscripts'
import RegistrarTranscriptRequestsPage from './pages/RegistrarTranscriptRequests'
import PublicTranscriptRequestPage from './pages/PublicTranscriptRequest'
import TrackTranscriptPage from './pages/TrackTranscript'
import VerifyTranscriptPage from './pages/VerifyTranscript'
import StudySnapPage from './pages/StudySnap'

const INSTITUTION = 'College of Nursing Sciences, Osogbo'
const SIDEBAR_COLLAPSE_KEY = 'cos_sidebar_collapsed'

// ── Nav items ─────────────────────────────────────────────────
const STUDENT_ROLES = ['STUDENT', 'LECTURER', 'SUPER_ADMIN', 'SCHOOL_ADMIN']

type NavItem = {
  path: string
  Icon: typeof LayoutGrid
  label: string
  uploadOnly: boolean
  roles?: string[]
  bottomNav?: boolean
}

const ALL_NAV_ITEMS: NavItem[] = [
  { path: '/dashboard',      Icon: LayoutGrid,    label: 'Home',        uploadOnly: false, bottomNav: true },
  { path: '/library',        Icon: BookOpen,      label: 'Library',     uploadOnly: false, roles: STUDENT_ROLES, bottomNav: true },
  { path: '/library/upload', Icon: Upload,        label: 'Upload',      uploadOnly: true },
  { path: '/results',        Icon: BarChart3,     label: 'Results',     uploadOnly: false, roles: ['STUDENT'], bottomNav: true },
  { path: '/id',             Icon: IdCard,        label: 'My ID',       uploadOnly: false, roles: STUDENT_ROLES, bottomNav: true },
  { path: '/wallet',         Icon: Printer,       label: 'Print',       uploadOnly: false, roles: STUDENT_ROLES, bottomNav: true },
  { path: '/wifi',           Icon: Wifi,          label: 'Wi-Fi',       uploadOnly: false, roles: ['STUDENT'], bottomNav: false },
  { path: '/payment',        Icon: CreditCard,    label: 'Payment',     uploadOnly: false, roles: ['STUDENT'] },
  { path: '/print-queue',    Icon: Inbox,         label: 'Queue',       uploadOnly: false, roles: ['PRINT_OPERATOR', 'SUPER_ADMIN', 'SCHOOL_ADMIN'], bottomNav: true },
  { path: '/admin',          Icon: Settings,      label: 'Admin',       uploadOnly: false, roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'], bottomNav: true },
  { path: '/lecturer/results', Icon: ClipboardEdit, label: 'Enter Results', uploadOnly: false, roles: ['LECTURER', 'SUPER_ADMIN', 'SCHOOL_ADMIN'], bottomNav: true },
  { path: '/study-snap',     Icon: Camera,        label: 'Snap & Study', uploadOnly: false, roles: ['STUDENT'] },
  { path: '/registrar/students', Icon: FolderOpen, label: 'Records',    uploadOnly: false, roles: ['REGISTRAR', 'SUPER_ADMIN', 'SCHOOL_ADMIN'], bottomNav: true },
  { path: '/registrar/transcripts', Icon: FileText, label: 'Transcripts', uploadOnly: false, roles: ['REGISTRAR', 'SCHOOL_ADMIN'], bottomNav: false },
  { path: '/registrar/transcript-requests', Icon: Inbox, label: 'Requests', uploadOnly: false, roles: ['REGISTRAR', 'SCHOOL_ADMIN'], bottomNav: false },
  { path: '/announcements',  Icon: Megaphone,     label: 'Notices',     uploadOnly: false, roles: [...STUDENT_ROLES, 'REGISTRAR'] },
  { path: '/ai',             Icon: Bot,           label: 'AI Chat',     uploadOnly: false, roles: STUDENT_ROLES },
  { path: '/flashcards',     Icon: Layers,        label: 'Flashcards',  uploadOnly: false, roles: STUDENT_ROLES },
  { path: '/simulation',     Icon: Gamepad2,      label: 'Sim',         uploadOnly: false, roles: STUDENT_ROLES },
]

// ── Mobile bottom nav (unchanged behaviour, real icons now) ────
function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  let items = ALL_NAV_ITEMS.filter(i => {
    if (i.uploadOnly) return false
    if (!i.bottomNav) return false
    if (i.roles && !i.roles.includes(user?.role || '')) return false
    return true
  })

  const role = user?.role || ''
  if (role === 'SUPER_ADMIN' || role === 'SCHOOL_ADMIN') {
    const order = ['/dashboard', '/library', '/id', '/admin']
    items = order.map(p => ALL_NAV_ITEMS.find(i => i.path === p)).filter(Boolean) as typeof items
  } else if (role === 'LECTURER') {
    const order = ['/dashboard', '/library', '/id', '/lecturer/results']
    items = order.map(p => ALL_NAV_ITEMS.find(i => i.path === p)).filter(Boolean) as typeof items
  } else if (role === 'REGISTRAR') {
    const order = ['/dashboard', '/registrar/students', '/registrar/transcripts', '/announcements', '/id']
    items = order.map(p => ALL_NAV_ITEMS.find(i => i.path === p)).filter(Boolean) as typeof items
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-mossline z-50 lg:hidden"
      style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.08)' }}>
      <div className="flex justify-around pb-3 pt-2 px-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {items.map(t => {
          const active = location.pathname === t.path || (t.path !== '/dashboard' && location.pathname.startsWith(t.path))
          return (
            <button key={t.path} onClick={() => navigate(t.path)}
              className="flex-shrink-0 flex flex-col items-center gap-1 border-none bg-transparent cursor-pointer py-1 px-3 min-w-[60px]">
              <t.Icon size={20} strokeWidth={1.75} color={active ? '#122400' : '#8A9BB0'} />
              <span className="text-[10px] font-semibold leading-none whitespace-nowrap" style={{ color: active ? '#122400' : '#8A9BB0' }}>
                {t.label}
              </span>
              {active && <div className="w-1 h-1 rounded-full mt-0.5" style={{ background: '#122400' }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Sidebar content (shared between pinned-open and peek-overlay states) ──
function SidebarContent({ onCollapse }: { onCollapse?: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const userCanUpload = canUpload(user?.role)
  const navItems = ALL_NAV_ITEMS.filter(i => {
    if (i.uploadOnly && !userCanUpload) return false
    if (i.roles && !i.roles.includes(user?.role || '')) return false
    return true
  })
  const mainItems = navItems.filter(i => !i.uploadOnly)
  const uploadItem = navItems.find(i => i.uploadOnly)

  return (
    <div className="flex flex-col w-60 h-screen bg-white flex-shrink-0">
      <div className="flex items-center justify-between gap-2 px-5 py-5 border-b border-mossline">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#2D6A4F,#122400)' }}>
            <Stethoscope size={18} strokeWidth={1.75} color="#fff" />
          </div>
          <div className="min-w-0">
            <div className="font-display font-semibold text-sm text-field truncate">CampusOS</div>
            <div className="text-[9px] font-plexmono font-medium leading-tight truncate text-text3">{INSTITUTION}</div>
          </div>
        </div>
        {onCollapse && (
          <button onClick={onCollapse} className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center border-0 cursor-pointer bg-moss text-field">
            <ChevronLeft size={15} strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="mx-4 mt-4 rounded-xl p-3 flex items-center gap-3 bg-moss">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 bg-field">
          {user?.name?.charAt(0) ?? 'S'}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-xs truncate text-ink">{user?.name}</div>
          <div className="text-[10px] truncate font-plexmono text-field">
            {(user as unknown as { matricNo?: string; staffId?: string })?.matricNo ??
             (user as unknown as { matricNo?: string; staffId?: string })?.staffId}
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 mt-4 overflow-y-auto">
        {mainItems.map(item => {
          const active = location.pathname === item.path ||
            (item.path === '/library' && location.pathname.startsWith('/library') && !location.pathname.includes('/upload')) ||
            (item.path === '/flashcards' && location.pathname.startsWith('/flashcards'))
          return (
            <button key={item.path} onClick={() => navigate(item.path)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 text-sm mb-0.5 border-0 cursor-pointer"
              style={{ background: active ? '#E2ECE3' : 'transparent', color: active ? '#122400' : '#4C5C50', fontWeight: active ? 600 : 500 }}>
              <item.Icon size={17} strokeWidth={1.75} />
              {item.label}
              {active && <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: '#122400' }} />}
            </button>
          )
        })}
        {uploadItem && (
          <button onClick={() => navigate(uploadItem.path)}
            className="w-full flex items-center gap-3 pl-10 pr-3 py-2 rounded-xl text-left transition-all duration-150 mb-0.5 mt-0.5 border-0 cursor-pointer"
            style={{
              background: location.pathname === uploadItem.path ? '#E2ECE3' : 'transparent',
              color: location.pathname === uploadItem.path ? '#122400' : '#7C8C7F',
              fontWeight: location.pathname === uploadItem.path ? 600 : 400, fontSize: 12,
            }}>
            <uploadItem.Icon size={14} strokeWidth={1.75} />
            {uploadItem.label}
          </button>
        )}
      </nav>

      {user?.role !== 'PRINT_OPERATOR' && (
        <div className="p-4 border-t border-mossline">
          <button onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-red-50 border-0 bg-transparent cursor-pointer text-text3">
            <LogOut size={16} strokeWidth={1.75} /> Sign Out
          </button>
        </div>
      )}
    </div>
  )
}

// ── Collapsed rail: icon-only, hover-to-peek, click-to-pin ─────
function SidebarRail({ onExpand, onPeek, onUnpeek }: { onExpand: () => void; onPeek: () => void; onUnpeek: () => void }) {
  return (
    <div className="hidden lg:flex flex-col items-center w-14 h-screen flex-shrink-0 bg-white border-r border-mossline py-5"
      onMouseEnter={onPeek} onMouseLeave={onUnpeek}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg,#2D6A4F,#122400)' }}>
        <Stethoscope size={17} strokeWidth={1.75} color="#fff" />
      </div>
      <button onClick={onExpand} className="w-8 h-8 rounded-lg flex items-center justify-center border-0 cursor-pointer bg-moss text-field">
        <ChevronRight size={15} strokeWidth={2} />
      </button>
    </div>
  )
}

// ── Desktop sidebar: pinned-open, or collapsed rail + peek overlay ──
function Sidebar() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === '1' } catch { return false }
  })
  const [peeking, setPeeking] = useState(false)

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_COLLAPSE_KEY, collapsed ? '1' : '0') } catch { /* ignore */ }
    if (!collapsed) setPeeking(false)
  }, [collapsed])

  if (!collapsed) {
    return (
      <div className="hidden lg:block sticky top-0" style={{ boxShadow: '2px 0 12px rgba(0,0,0,0.04)' }}>
        <SidebarContent onCollapse={() => setCollapsed(true)} />
      </div>
    )
  }

  return (
    <>
      <SidebarRail onExpand={() => setCollapsed(false)} onPeek={() => setPeeking(true)} onUnpeek={() => setPeeking(false)} />
      {peeking && (
        <div className="hidden lg:block fixed left-0 top-0 z-50" style={{ boxShadow: '4px 0 32px rgba(0,0,0,0.18)' }}
          onMouseEnter={() => setPeeking(true)} onMouseLeave={() => setPeeking(false)}>
          <SidebarContent onCollapse={() => setCollapsed(true)} />
        </div>
      )}
    </>
  )
}

// ── App shell ─────────────────────────────────────────────────
function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  const noShell = ['/', '/login'].includes(location.pathname)

  if (noShell || !user) {
    return <div className="min-h-screen">{children}</div>
  }

  return (
    <div className="min-h-screen lg:flex bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto pb-28 lg:pb-0">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}

// ── Route guard ───────────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />

  if (user.role === 'STUDENT') {
    const onEmailPage = location.pathname === '/onboarding/email'
    const onBiodataPage = location.pathname === '/onboarding/biodata'

    if (!user.emailVerified && !onEmailPage) {
      return <Navigate to="/onboarding/email" replace />
    }
    if (user.emailVerified && !user.biodataCompleted && !onBiodataPage && !onEmailPage) {
      return <Navigate to="/onboarding/biodata" replace />
    }
  }

  return <>{children}</>
}

function RoleAwareDashboard() {
  const { user } = useAuth()
  if (user?.role === 'PRINT_OPERATOR') return <OperatorDashboardPage />
  if (user?.role === 'STUDENT') return <StudentDashboardPage />
  if (user?.role === 'REGISTRAR') return <RegistrarDashboardPage />
  if (user?.role === 'SUPER_ADMIN' || user?.role === 'SCHOOL_ADMIN') return <AdminDashboardPage />
  if (user?.role === 'LECTURER') return <LecturerDashboardPage />
  return <DashboardPage />
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <SplashPage />} />
      <Route path="/login"              element={<LoginPage />} />
      <Route path="/forgot-password"    element={<ForgotPasswordPage />} />
      <Route path="/request-transcript" element={<PublicTranscriptRequestPage />} />
      <Route path="/track-transcript"   element={<TrackTranscriptPage />} />
      <Route path="/verify/:code"       element={<VerifyTranscriptPage />} />
      <Route path="/dashboard"          element={<ProtectedRoute><RoleAwareDashboard /></ProtectedRoute>} />
      <Route path="/onboarding/email"   element={<ProtectedRoute><OnboardingEmailPage /></ProtectedRoute>} />
      <Route path="/onboarding/biodata"   element={<ProtectedRoute><OnboardingBiodataPage /></ProtectedRoute>} />
      <Route path="/admin"              element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
      <Route path="/admin/students"     element={<ProtectedRoute><AdminStudentsPage /></ProtectedRoute>} />
      <Route path="/admin/lecturers"    element={<ProtectedRoute><AdminLecturersPage /></ProtectedRoute>} />
      <Route path="/admin/payments"     element={<ProtectedRoute><AdminPaymentsPage /></ProtectedRoute>} />
      <Route path="/admin/results"      element={<ProtectedRoute><AdminResultsPage /></ProtectedRoute>} />
      <Route path="/admin/health"       element={<ProtectedRoute><SiteHealthPage /></ProtectedRoute>} />
      <Route path="/lecturer/results"   element={<ProtectedRoute><LecturerResultsPage /></ProtectedRoute>} />
      <Route path="/library"            element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
      <Route path="/library/upload"     element={<ProtectedRoute><LibraryUploadPage /></ProtectedRoute>} />
      <Route path="/results"            element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />
      <Route path="/id"                 element={<ProtectedRoute><DigitalIDPage /></ProtectedRoute>} />
      <Route path="/wallet"             element={<ProtectedRoute><PrintWalletPage /></ProtectedRoute>} />
      <Route path="/wifi"                element={<ProtectedRoute><WifiPage /></ProtectedRoute>} />
      <Route path="/print-queue"        element={<ProtectedRoute><PrintQueuePage /></ProtectedRoute>} />
      <Route path="/announcements"      element={<ProtectedRoute><AnnouncementsPage /></ProtectedRoute>} />
      <Route path="/ai"                 element={<ProtectedRoute><AIPage /></ProtectedRoute>} />
      <Route path="/flashcards"         element={<ProtectedRoute><FlashcardsPage /></ProtectedRoute>} />
      <Route path="/flashcards/new"     element={<ProtectedRoute><FlashcardsCreatePage /></ProtectedRoute>} />
      <Route path="/flashcards/:id/edit"  element={<ProtectedRoute><FlashcardsEditPage /></ProtectedRoute>} />
      <Route path="/flashcards/:id/study" element={<ProtectedRoute><FlashcardsStudyPage /></ProtectedRoute>} />
      <Route path="/past-questions" element={<PastQuestions />} />
      <Route path="/simulation"         element={<ProtectedRoute><SimulationPage /></ProtectedRoute>} />
      <Route path="/payment"            element={<ProtectedRoute><PaymentPage /></ProtectedRoute>} />
      <Route path="/registrar/students" element={<ProtectedRoute><RegistrarStudentsPage /></ProtectedRoute>} />
      <Route path="/registrar/transcripts" element={<ProtectedRoute><RegistrarTranscriptsPage /></ProtectedRoute>} />
      <Route path="/registrar/transcript-requests" element={<ProtectedRoute><RegistrarTranscriptRequestsPage /></ProtectedRoute>} />
      <Route path="/study-snap"         element={<ProtectedRoute><StudySnapPage /></ProtectedRoute>} />
      <Route path="*"                   element={<Navigate to="/" />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell>
          <AppRoutes />
        </AppShell>
        <ToastContainer />
      </BrowserRouter>
    </AuthProvider>
  )
}
