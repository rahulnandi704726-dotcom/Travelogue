import React, { useCallback, useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import {
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Headphones,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Phone,
  Plane,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import {
  AuthUser,
  Booking,
  Deal,
  Destination,
  Flight,
  SiteSettings,
  ToastMessage,
} from './types';
import { DEFAULT_APP_STATE, HERO_IMAGE, getDiscountedFare } from './data/seed';
import { auth } from './lib/firebase';
import { BookingModal } from './components/BookingModal';
import { TicketModal } from './components/TicketModal';
import { MyTripsModal } from './components/MyTripsModal';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';

type SearchTabMode = 'flights' | 'hotels' | 'packages' | 'pnr';

export default function App() {
  const [viewMode, setViewMode] = useState<'storefront' | 'admin'>('storefront');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auth State (Token kept strictly in memory, never localStorage)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingAdminNav, setPendingAdminNav] = useState(false);

  // Storefront Data from Cloud SQL
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_APP_STATE.settings);
  const [destinations, setDestinations] = useState<Destination[]>(DEFAULT_APP_STATE.destinations);
  const [deals, setDeals] = useState<Deal[]>(DEFAULT_APP_STATE.deals);
  const [totalFlightsCount, setTotalFlightsCount] = useState<number>(210);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [totalMatchedFlights, setTotalMatchedFlights] = useState<number>(0);
  const [loadingFlights, setLoadingFlights] = useState<boolean>(true);
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Search & Filter State
  const [searchTab, setSearchTab] = useState<SearchTabMode>('flights');
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [searchPassengers, setSearchPassengers] = useState<number>(1);
  const [stopsFilter, setStopsFilter] = useState<'all' | 'Non-stop' | '1 Stop'>('all');
  const [sortBy, setSortBy] = useState<'price-asc' | 'price-desc' | 'rating-desc'>('price-asc');
  const [pnrLookupCode, setPnrLookupCode] = useState('');

  // NVIDIA Route Brief State
  const [aiBrief, setAiBrief] = useState<string | null>(null);
  const [loadingBrief, setLoadingBrief] = useState(false);

  // Modals & Notifications
  const [bookingFlight, setBookingFlight] = useState<Flight | null>(null);
  const [activeTicket, setActiveTicket] = useState<Booking | null>(null);
  const [showMyTrips, setShowMyTrips] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const notify = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const authHeaders = useCallback(
    (extra?: Record<string, string>): Record<string, string> => {
      const headers: Record<string, string> = { ...(extra || {}) };
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }
      return headers;
    },
    [authToken]
  );

  const loadBootstrap = useCallback(async () => {
    try {
      const res = await fetch('/api/bootstrap');
      if (!res.ok) return;
      const data = await res.json();
      if (data.settings) setSettings(data.settings);
      if (Array.isArray(data.destinations)) setDestinations(data.destinations);
      if (Array.isArray(data.deals)) setDeals(data.deals);
      if (typeof data.totalFlights === 'number') setTotalFlightsCount(data.totalFlights);
    } catch {
      // Keep fallback state if server is temporarily unavailable
    }
  }, []);

  const fetchRandomizedFlights = useCallback(
    async (overrides?: {
      from?: string;
      to?: string;
      date?: string;
      stops?: 'all' | 'Non-stop' | '1 Stop';
      sort?: 'price-asc' | 'price-desc' | 'rating-desc';
    }) => {
      setLoadingFlights(true);
      setAiBrief(null);
      try {
        const params = new URLSearchParams();
        const fromVal = overrides?.from !== undefined ? overrides.from : searchFrom;
        const toVal = overrides?.to !== undefined ? overrides.to : searchTo;
        const dateVal = overrides?.date !== undefined ? overrides.date : searchDate;
        const stopsVal = overrides?.stops !== undefined ? overrides.stops : stopsFilter;
        const sortVal = overrides?.sort !== undefined ? overrides.sort : sortBy;

        if (fromVal.trim()) params.set('from', fromVal.trim());
        if (toVal.trim()) params.set('to', toVal.trim());
        if (dateVal) params.set('date', dateVal);
        if (stopsVal !== 'all') params.set('stops', stopsVal);
        params.set('sort', sortVal);

        const res = await fetch(`/api/flights/search?${params.toString()}`);
        const data = await res.json();
        if (res.ok && Array.isArray(data.flights)) {
          setFlights(
            data.flights.map((f: any) => ({
              ...f,
              rating: Number(f.rating || 4.8),
              occupiedSeats: Array.isArray(f.occupiedSeats) ? f.occupiedSeats : [],
            }))
          );
          setTotalMatchedFlights(Number(data.totalMatched || data.flights.length));
        }
      } catch {
        notify('Unable to load flights from server.', 'error');
      } finally {
        setLoadingFlights(false);
      }
    },
    [searchFrom, searchTo, searchDate, stopsFilter, sortBy, notify]
  );

  const loadBookings = useCallback(
    async (tokenOverride?: string | null) => {
      try {
        const headers: Record<string, string> = {};
        const tokenToUse = tokenOverride !== undefined ? tokenOverride : authToken;
        if (tokenToUse) headers.Authorization = `Bearer ${tokenToUse}`;
        const res = await fetch('/api/bookings', { headers });
        if (!res.ok) {
          setBookings([]);
          return;
        }
        const data = await res.json();
        if (Array.isArray(data.bookings)) {
          setBookings(data.bookings);
        }
      } catch {
        setBookings([]);
      }
    },
    [authToken]
  );

  // Initial load: session, bootstrap, initial random flight sample
  useEffect(() => {
    void (async () => {
      try {
        const meRes = await fetch('/api/auth/me');
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.user) {
            setCurrentUser(meData.user);
            void loadBookings(null);
          }
        }
      } catch {
        // Ignore session probe errors
      }
      await loadBootstrap();
      await fetchRandomizedFlights({ from: '', to: '', date: '', stops: 'all', sort: 'price-asc' });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshStorefrontAndBookings = useCallback(async () => {
    await loadBootstrap();
    await fetchRandomizedFlights();
    if (currentUser) {
      await loadBookings();
    }
  }, [loadBootstrap, fetchRandomizedFlights, currentUser, loadBookings]);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSwapAirports = () => {
    setSearchFrom(searchTo);
    setSearchTo(searchFrom);
  };

  const handleFlightSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchRandomizedFlights();
    scrollToSection('flightsSection');
  };

  const handlePnrLookupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = pnrLookupCode.trim().toUpperCase();
    if (!code) return;
    try {
      const res = await fetch(`/api/bookings/pnr/${encodeURIComponent(code)}`);
      const data = await res.json();
      if (res.ok && data.booking) {
        setActiveTicket(data.booking);
      } else {
        notify(data.error || `No booking found for PNR "${code}".`, 'error');
      }
    } catch {
      notify('Unable to look up PNR.', 'error');
    }
  };

  const handleQuickDestinationSearch = (cityQuery: string) => {
    setSearchFrom('');
    setSearchTo(cityQuery);
    setSearchDate('');
    setStopsFilter('all');
    void fetchRandomizedFlights({
      from: '',
      to: cityQuery,
      date: '',
      stops: 'all',
      sort: sortBy,
    });
    scrollToSection('flightsSection');
  };

  const handleResetFilters = () => {
    setSearchFrom('');
    setSearchTo('');
    setSearchDate('');
    setStopsFilter('all');
    setSortBy('price-asc');
    void fetchRandomizedFlights({
      from: '',
      to: '',
      date: '',
      stops: 'all',
      sort: 'price-asc',
    });
  };

  const handleStopsFilterChange = (nextStop: 'all' | 'Non-stop' | '1 Stop') => {
    setStopsFilter(nextStop);
    void fetchRandomizedFlights({ stops: nextStop });
  };

  const handleSortChange = (nextSort: 'price-asc' | 'price-desc' | 'rating-desc') => {
    setSortBy(nextSort);
    void fetchRandomizedFlights({ sort: nextSort });
  };

  const handleGenerateAiBrief = async () => {
    if (flights.length === 0) return;
    setLoadingBrief(true);
    try {
      const res = await fetch('/api/flights/ai-brief', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          from: searchFrom,
          to: searchTo,
          flights,
        }),
      });
      const data = await res.json();
      if (res.ok && data.brief) {
        setAiBrief(data.brief);
      } else {
        notify(data.error || 'Could not generate route brief.', 'error');
      }
    } catch {
      notify('Unable to reach NVIDIA route brief service.', 'error');
    } finally {
      setLoadingBrief(false);
    }
  };

  const handleOpenAdmin = () => {
    setMobileMenuOpen(false);
    const isAdmin =
      currentUser &&
      (currentUser.role === 'admin' ||
        currentUser.email.toLowerCase() === 'rahulnandi7047@gmail.com');

    if (isAdmin) {
      setViewMode('admin');
      void loadBookings();
      window.scrollTo({ top: 0 });
    } else if (currentUser) {
      notify('Admin privileges required. Sign in with rahulnandi7047@gmail.com.', 'error');
      setPendingAdminNav(true);
      setShowAuthModal(true);
    } else {
      setPendingAdminNav(true);
      setShowAuthModal(true);
    }
  };

  const handleOpenMyTrips = () => {
    setMobileMenuOpen(false);
    if (!currentUser) {
      notify('Please sign in to view your bookings.', 'info');
      setShowAuthModal(true);
      return;
    }
    void loadBookings();
    setShowMyTrips(true);
  };

  const handleSelectSeatClick = (flight: Flight) => {
    if (!currentUser) {
      notify('Please sign in to reserve seats and issue an e-ticket.', 'info');
      setShowAuthModal(true);
      return;
    }
    setBookingFlight(flight);
  };

  const handleAuthSuccess = (user: AuthUser, token: string) => {
    setCurrentUser(user);
    setAuthToken(token);
    void loadBookings(token);

    if (pendingAdminNav) {
      setPendingAdminNav(false);
      if (user.role === 'admin' || user.email.toLowerCase() === 'rahulnandi7047@gmail.com') {
        setViewMode('admin');
        window.scrollTo({ top: 0 });
      } else {
        notify('Signed in as traveler. Admin dashboard requires admin account.', 'info');
      }
    }
  };

  const handleSignOut = async () => {
    setMobileMenuOpen(false);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      await signOut(auth).catch(() => {});
    } finally {
      setCurrentUser(null);
      setAuthToken(null);
      setBookings([]);
      setViewMode('storefront');
      notify('Signed out.', 'info');
    }
  };

  const handleConfirmBooking = async (payload: {
    flight: Flight;
    passengerName: string;
    passengerEmail: string;
    passport: string;
    seats: string[];
    passengersCount: number;
    baggageFee: number;
    totalPaid: number;
  }) => {
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          flightId: payload.flight.id,
          passengerName: payload.passengerName,
          passengerEmail: payload.passengerEmail,
          passport: payload.passport,
          seats: payload.seats,
          passengersCount: payload.passengersCount,
          baggageFee: payload.baggageFee,
          totalPaid: payload.totalPaid,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || 'Could not complete reservation.', 'error');
        return;
      }

      setBookingFlight(null);
      setActiveTicket(data.booking);
      notify(`Booking confirmed. PNR: ${data.booking.pnr}`, 'success');
      await refreshStorefrontAndBookings();
    } catch {
      notify('Network error confirming booking.', 'error');
    }
  };

  const handleCancelBooking = async (pnr: string) => {
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(pnr)}/cancel`, {
        method: 'PATCH',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || 'Unable to cancel booking.', 'error');
        return;
      }
      notify(`Booking ${pnr} cancelled and seats released.`, 'info');
      await refreshStorefrontAndBookings();
    } catch {
      notify('Network error cancelling booking.', 'error');
    }
  };

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    notify(`Subscribed ${newsletterEmail.trim()} to fare alerts.`, 'success');
    setNewsletterEmail('');
  };

  const cur = settings.currency;

  return (
    <div className="min-h-screen bg-[#F6F8FC] text-slate-800 font-sans">
      {/* Toast Stack */}
      <div className="fixed top-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`px-4 py-3 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 pointer-events-auto ${
              t.type === 'success'
                ? 'bg-emerald-700 text-white'
                : t.type === 'error'
                ? 'bg-rose-700 text-white'
                : 'bg-slate-900 text-white'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {viewMode === 'admin' ? (
        <AdminDashboard
          settings={settings}
          destinations={destinations}
          bookings={bookings}
          authToken={authToken}
          onExit={() => setViewMode('storefront')}
          onRefreshStorefront={refreshStorefrontAndBookings}
          onCancelBooking={handleCancelBooking}
          onViewTicket={(b) => setActiveTicket(b)}
          onNotify={notify}
        />
      ) : (
        <>
          {/* TOP ANNOUNCEMENT STRIP */}
          <div className="bg-[#0D5BE1] text-white text-xs py-2 px-4 text-center font-medium">
            {settings.announcementText}
          </div>

          {/* 3-ZONE STICKY TOP BAR + MOBILE HAMBURGER MENU */}
          <header className="bg-white/95 backdrop-blur sticky top-0 z-40 border-b border-slate-200/80">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
              {/* Zone 1: Single-line Brand Wordmark */}
              <a
                href="#top"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileMenuOpen(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="text-xl font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 flex items-center gap-2"
              >
                <span className="w-8 h-8 rounded-lg bg-[#0D5BE1] text-white flex items-center justify-center">
                  <Plane className="w-4 h-4" />
                </span>
                {settings.brandName}
              </a>

              {/* Zone 2: Desktop Single-Line Navigation Links */}
              <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
                <a
                  href="#flightsSection"
                  className="hover:text-slate-900 hover:underline underline-offset-4 transition whitespace-nowrap shrink-0"
                >
                  Flights
                </a>
                <a
                  href="#destinationsSection"
                  className="hover:text-slate-900 hover:underline underline-offset-4 transition whitespace-nowrap shrink-0"
                >
                  Destinations
                </a>
                <a
                  href="#dealsSection"
                  className="hover:text-slate-900 hover:underline underline-offset-4 transition whitespace-nowrap shrink-0"
                >
                  Packages
                </a>
                <button
                  type="button"
                  onClick={handleOpenMyTrips}
                  className="hover:text-slate-900 hover:underline underline-offset-4 transition whitespace-nowrap shrink-0"
                >
                  My Trips
                </button>
                <button
                  type="button"
                  onClick={handleOpenAdmin}
                  className="hover:text-slate-900 hover:underline underline-offset-4 transition whitespace-nowrap shrink-0"
                >
                  Admin
                </button>
              </nav>

              {/* Zone 3: Single Primary Action + Mobile Hamburger Button */}
              <div className="flex items-center gap-3 shrink-0">
                {currentUser ? (
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="hidden md:inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-4 py-2.5 rounded-lg transition whitespace-nowrap shrink-0"
                  >
                    <span className="max-w-[140px] truncate">{currentUser.email}</span>
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setPendingAdminNav(false);
                      setShowAuthModal(true);
                    }}
                    className="hidden md:inline-flex bg-[#0D5BE1] hover:bg-[#0842A8] text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition whitespace-nowrap shrink-0"
                  >
                    Sign In
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((prev) => !prev)}
                  aria-label="Toggle navigation menu"
                  aria-expanded={mobileMenuOpen}
                  className="md:hidden w-11 h-11 rounded-lg border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 transition"
                >
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Mobile Hamburger Menu Drawer */}
            {mobileMenuOpen && (
              <div className="md:hidden bg-white border-t border-slate-200 px-4 py-4 space-y-2 shadow-lg">
                <button
                  type="button"
                  onClick={() => scrollToSection('flightsSection')}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Flights
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('destinationsSection')}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Destinations
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('dealsSection')}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Packages
                </button>
                <button
                  type="button"
                  onClick={handleOpenMyTrips}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  My Trips
                </button>
                <button
                  type="button"
                  onClick={handleOpenAdmin}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Admin Dashboard
                </button>
                <div className="pt-2 border-t border-slate-100">
                  {currentUser ? (
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full bg-slate-100 text-slate-800 text-xs font-semibold py-2.5 px-4 rounded-lg flex items-center justify-between"
                    >
                      <span className="truncate">{currentUser.email}</span>
                      <span>Sign Out</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setPendingAdminNav(false);
                        setShowAuthModal(true);
                      }}
                      className="w-full bg-[#0D5BE1] text-white text-xs font-semibold py-2.5 px-4 rounded-lg"
                    >
                      Sign In
                    </button>
                  )}
                </div>
              </div>
            )}
          </header>

          {/* HERO SECTION */}
          <section className="relative">
            <div className="relative min-h-[500px] flex items-center bg-gradient-to-br from-sky-900 to-slate-900 overflow-hidden">
              {!heroImgFailed && (
                <img
                  src={HERO_IMAGE}
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgFailed(true)}
                  alt="Alpine mountain peaks and turquoise lake at morning light"
                  className="absolute inset-0 w-full h-full object-cover object-center"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-[#F6F8FC]/95 via-[#F6F8FC]/82 to-slate-900/15" />

              <div className="relative max-w-7xl mx-auto w-full px-4 sm:px-6 py-16 pb-28 grid lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-7 space-y-5">
                  <div className="text-xs font-semibold text-[#0D5BE1] tracking-wide">
                    {settings.tagline} · Promo Code {settings.promoCode} ({settings.promoPercent}% Off)
                  </div>

                  <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold text-slate-900 leading-[1.08] tracking-tight text-balance max-w-2xl">
                    {settings.heroHeadline}
                    <br />
                    Create{' '}
                    <span className="font-script text-[#F97316] font-normal text-5xl sm:text-6xl">
                      Memories
                    </span>
                  </h1>

                  <p className="text-slate-700 text-base sm:text-lg max-w-xl leading-relaxed">
                    {settings.heroSubheadline}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    <button
                      type="button"
                      onClick={() => scrollToSection('flightsSection')}
                      className="bg-[#0D5BE1] hover:bg-[#0842A8] text-white font-semibold px-6 py-3 rounded-xl shadow-sm flex items-center gap-2 transition text-sm whitespace-nowrap"
                    >
                      Explore Flights
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenMyTrips}
                      className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-semibold px-5 py-3 rounded-xl transition text-sm whitespace-nowrap"
                    >
                      Manage Booking
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 font-medium pt-1 tabular-nums">
                    {totalFlightsCount}+ active routes · Direct e-ticketing across 20 global hubs
                  </p>
                </div>
              </div>
            </div>

            {/* OVERLAPPING MULTI-TAB SEARCH WIDGET */}
            <div id="searchWidget" className="relative z-20 max-w-6xl mx-auto px-4 sm:px-6 -mt-16">
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4 mb-5">
                  {(
                    [
                      { id: 'flights', label: 'Flights' },
                      { id: 'hotels', label: 'Flight + Hotel' },
                      { id: 'packages', label: 'Packages' },
                      { id: 'pnr', label: 'Check PNR' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSearchTab(tab.id)}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap shrink-0 ${
                        searchTab === tab.id
                          ? 'bg-[#0D5BE1] text-white'
                          : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {searchTab === 'pnr' ? (
                  <form
                    onSubmit={handlePnrLookupSubmit}
                    className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
                  >
                    <div className="md:col-span-9">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Booking Reference (PNR)
                      </label>
                      <input
                        type="text"
                        required
                        value={pnrLookupCode}
                        onChange={(e) => setPnrLookupCode(e.target.value)}
                        placeholder="Enter PNR code (e.g. TRV842 or TRV519)"
                        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono uppercase outline-none focus:border-[#0D5BE1]"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <button
                        type="submit"
                        className="w-full bg-[#0D5BE1] hover:bg-[#0842A8] text-white font-semibold py-2.5 px-5 rounded-xl text-sm transition"
                      >
                        Find My Ticket
                      </button>
                    </div>
                  </form>
                ) : (
                  <form
                    onSubmit={handleFlightSearchSubmit}
                    className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
                  >
                    <div className="md:col-span-3 relative">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        From
                      </label>
                      <input
                        type="text"
                        value={searchFrom}
                        onChange={(e) => setSearchFrom(e.target.value)}
                        placeholder="Any Origin (e.g. New York)"
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-[#0D5BE1]"
                      />
                      <button
                        type="button"
                        onClick={handleSwapAirports}
                        aria-label="Swap origin and destination"
                        className="hidden md:flex absolute -right-3.5 bottom-2 z-10 w-7 h-7 rounded-full bg-white border border-slate-200 shadow-sm items-center justify-center text-slate-500 hover:text-[#0D5BE1]"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        To
                      </label>
                      <input
                        type="text"
                        value={searchTo}
                        onChange={(e) => setSearchTo(e.target.value)}
                        placeholder="Any Destination (e.g. Paris)"
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-[#0D5BE1]"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Departure Date
                      </label>
                      <input
                        type="date"
                        value={searchDate}
                        onChange={(e) => setSearchDate(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#0D5BE1]"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Travelers
                      </label>
                      <select
                        value={searchPassengers}
                        onChange={(e) => setSearchPassengers(Number(e.target.value))}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white outline-none focus:border-[#0D5BE1]"
                      >
                        <option value={1}>1 Traveler</option>
                        <option value={2}>2 Travelers</option>
                        <option value={3}>3 Travelers</option>
                        <option value={4}>4 Travelers</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <button
                        type="submit"
                        className="w-full bg-[#0D5BE1] hover:bg-[#0842A8] text-white font-semibold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 text-sm whitespace-nowrap"
                      >
                        <Search className="w-4 h-4" />
                        Search Flights
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </section>

          {/* AVAILABLE FLIGHTS SECTION */}
          <section id="flightsSection" className="max-w-7xl mx-auto px-4 sm:px-6 pt-14 pb-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Available Flights
                </h2>
                <p className="text-sm text-slate-500 mt-1 tabular-nums">
                  Displaying {flights.length} randomized result{flights.length === 1 ? '' : 's'} (max 10 per search) from {totalMatchedFlights} matching routes.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
                  {(['all', 'Non-stop', '1 Stop'] as const).map((stopOpt) => (
                    <button
                      key={stopOpt}
                      type="button"
                      onClick={() => handleStopsFilterChange(stopOpt)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition whitespace-nowrap ${
                        stopsFilter === stopOpt
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {stopOpt === 'all' ? 'All Stops' : stopOpt}
                    </button>
                  ))}
                </div>

                <select
                  value={sortBy}
                  onChange={(e) =>
                    handleSortChange(
                      e.target.value as 'price-asc' | 'price-desc' | 'rating-desc'
                    )
                  }
                  aria-label="Sort flights"
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-[#0D5BE1]"
                >
                  <option value="price-asc">Lowest Fare</option>
                  <option value="price-desc">Highest Fare</option>
                  <option value="rating-desc">Top Rated</option>
                </select>

                <button
                  type="button"
                  onClick={() => fetchRandomizedFlights()}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Shuffle Results
                </button>

                <button
                  type="button"
                  disabled={loadingBrief || flights.length === 0}
                  onClick={handleGenerateAiBrief}
                  className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {loadingBrief ? 'Analyzing...' : 'Route Fare Brief'}
                </button>

                {(searchFrom || searchTo || searchDate || stopsFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="text-xs font-semibold text-[#0D5BE1] hover:underline px-2 py-1.5"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {aiBrief && (
              <div className="mb-5 bg-white border border-slate-200 rounded-xl p-4 text-xs text-slate-700 leading-relaxed">
                <div className="font-bold text-slate-900 mb-1">NVIDIA Route Fare Brief</div>
                <p>{aiBrief}</p>
              </div>
            )}

            {loadingFlights ? (
              <div className="space-y-3.5">
                {[1, 2, 3].map((row) => (
                  <div
                    key={row}
                    className="bg-white rounded-xl p-5 border border-slate-200 h-24 animate-pulse"
                  />
                ))}
              </div>
            ) : flights.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center border border-slate-200">
                <h3 className="font-bold text-slate-900 text-base">
                  No flights matched your current filters
                </h3>
                <p className="text-xs text-slate-500 mt-1 mb-4">
                  Try clearing your origin/destination query or resetting the stops filter.
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="bg-[#0D5BE1] hover:bg-[#0842A8] text-white text-xs font-semibold px-5 py-2.5 rounded-lg transition"
                >
                  Search All 200+ Flights
                </button>
              </div>
            ) : (
              <div className="space-y-3.5">
                {flights.map((flight) => {
                  const finalFare = getDiscountedFare(flight);
                  const openSeats = 48 - flight.occupiedSeats.length;

                  return (
                    <div
                      key={flight.id}
                      className="bg-white rounded-xl p-5 border border-slate-200/90 hover:border-slate-300 transition grid grid-cols-1 lg:grid-cols-12 gap-4 items-center"
                    >
                      <div className="lg:col-span-3 flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#0D5BE1] flex items-center justify-center shrink-0">
                          <Plane className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-sm truncate">
                            {flight.airline}
                          </div>
                          <div className="text-xs text-slate-500 tabular-nums mt-0.5">
                            <span className="font-mono">{flight.flightNumber}</span> · {flight.cabinClass} · {flight.rating}/5
                          </div>
                          {flight.discount > 0 && (
                            <div className="text-xs font-semibold text-orange-600 mt-0.5 tabular-nums">
                              Save {flight.discount}% on base fare
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="lg:col-span-5 flex items-center justify-between gap-4 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                        <div>
                          <div className="text-sm font-bold text-slate-900">{flight.origin}</div>
                          <div className="text-xs text-slate-500 tabular-nums mt-0.5">
                            {flight.date}
                          </div>
                        </div>
                        <div className="flex flex-col items-center text-center px-2 shrink-0">
                          <span className="text-xs font-semibold text-slate-600 tabular-nums">
                            {flight.duration}
                          </span>
                          <div className="w-20 h-px bg-slate-300 my-1.5" />
                          <span
                            className={`text-[11px] font-semibold ${
                              flight.stops === 'Non-stop' ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {flight.stops}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-slate-900">
                            {flight.destination}
                          </div>
                          <div className="text-xs text-slate-500 tabular-nums mt-0.5">
                            {flight.time}
                          </div>
                        </div>
                      </div>

                      <div className="lg:col-span-4 flex items-center justify-between lg:justify-end gap-5">
                        <div className="lg:text-right">
                          {flight.discount > 0 && (
                            <div className="text-xs text-slate-400 line-through tabular-nums">
                              {cur}
                              {flight.price}
                            </div>
                          )}
                          <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
                            {cur}
                            {finalFare}
                          </div>
                          <div className="text-xs text-emerald-700 font-medium tabular-nums">
                            {openSeats} open seats
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSelectSeatClick(flight)}
                          className="bg-[#0D5BE1] hover:bg-[#0842A8] text-white font-semibold text-xs px-5 py-3 rounded-xl transition whitespace-nowrap shrink-0"
                        >
                          Select Seat
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* POPULAR DESTINATIONS GRID */}
          <section id="destinationsSection" className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
            <div className="flex items-end justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Popular Destinations
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Click any city to query live randomized flight options from our database.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleResetFilters();
                  scrollToSection('flightsSection');
                }}
                className="text-xs font-semibold text-[#0D5BE1] hover:underline flex items-center gap-1 whitespace-nowrap"
              >
                View All Routes <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {destinations.map((dest) => (
                <button
                  key={dest.id}
                  type="button"
                  onClick={() => handleQuickDestinationSearch(dest.name)}
                  className="group relative h-64 rounded-2xl overflow-hidden text-left border border-slate-200 bg-gradient-to-br from-slate-800 to-slate-900 transition hover:shadow-lg"
                >
                  {!failedImages[dest.id] && (
                    <img
                      src={dest.image}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setFailedImages((prev) => ({ ...prev, [dest.id]: true }))
                      }
                      alt={`${dest.name}, ${dest.country}`}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                  <div className="relative h-full p-4 flex flex-col justify-end text-white">
                    {dest.discount > 0 && (
                      <div className="text-xs font-semibold text-amber-300 tabular-nums mb-1">
                        Save {dest.discount}%
                      </div>
                    )}
                    <div className="font-bold text-base leading-tight">
                      {dest.name}, {dest.country}
                    </div>
                    <div className="text-xs text-slate-200 mt-1 tabular-nums">
                      From {cur}
                      {dest.price} · Rated {dest.rating}/5
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* TOP DEALS THIS WEEK */}
          <section id="dealsSection" className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              <div className="lg:col-span-4 rounded-2xl bg-[#0D5BE1] text-white p-7 flex flex-col justify-between min-h-[260px]">
                <div>
                  <div className="text-xs font-semibold text-blue-200 mb-2">
                    Weekly Fare Spotlight
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight text-balance">
                    Top Flight Deals This Week
                  </h2>
                  <p className="text-blue-100 text-sm mt-2 leading-relaxed">
                    Limited-time discounted airfares and curated round-trip bundles.
                  </p>
                </div>
                <div className="pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      handleSortChange('price-asc');
                      scrollToSection('flightsSection');
                    }}
                    className="bg-white text-slate-900 hover:bg-blue-50 font-semibold text-xs px-5 py-2.5 rounded-lg inline-flex items-center gap-2 transition"
                  >
                    Browse Lowest Fares <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col justify-between"
                  >
                    <div className="relative h-36 bg-slate-800">
                      {!failedImages[deal.id] && (
                        <img
                          src={deal.image}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFailedImages((prev) => ({ ...prev, [deal.id]: true }))
                          }
                          alt={deal.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      <div className="absolute bottom-2.5 left-3 text-xs font-semibold text-white">
                        {deal.label}
                      </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">{deal.title}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{deal.subtitle}</p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div className="tabular-nums">
                          <span className="text-xs text-slate-400 line-through mr-1.5">
                            {cur}
                            {deal.oldPrice}
                          </span>
                          <span className="text-base font-extrabold text-[#0D5BE1]">
                            {cur}
                            {deal.price}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuickDestinationSearch(deal.query)}
                          className="text-xs font-semibold text-slate-800 hover:text-[#0D5BE1] transition whitespace-nowrap"
                        >
                          Select Deal
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* TRUST GUARANTEES STRIP */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {[
                {
                  icon: <ShieldCheck className="w-5 h-5 text-amber-600" />,
                  title: 'Best Price Guarantee',
                  sub: 'Zero hidden booking fees',
                },
                {
                  icon: <Headphones className="w-5 h-5 text-emerald-600" />,
                  title: '24/7 Support',
                  sub: 'Dedicated trip assistance',
                },
                {
                  icon: <Lock className="w-5 h-5 text-rose-600" />,
                  title: 'Secure Checkout',
                  sub: 'Authenticated reservations',
                },
                {
                  icon: <RotateCcw className="w-5 h-5 text-sky-600" />,
                  title: 'Easy Cancellation',
                  sub: 'Instant seat release',
                },
                {
                  icon: <CreditCard className="w-5 h-5 text-indigo-600" />,
                  title: 'Instant E-Tickets',
                  sub: 'Printable boarding pass',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="bg-white rounded-xl p-4 border border-slate-200 flex items-center gap-3"
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">{item.title}</div>
                    <div className="text-[11px] text-slate-500 truncate">{item.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* TESTIMONIALS & NEWSLETTER */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10 pb-16">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-6">
              Traveler Feedback
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    quote:
                      'Booked two seats to Paris in under four minutes. Seat selection and PNR retrieval worked immediately.',
                    name: 'Sophia Williams',
                    route: 'New York to Paris',
                  },
                  {
                    quote:
                      'Transparent pricing with zero surprise fees at checkout, and printing my boarding pass took one click.',
                    name: 'James Anderson',
                    route: 'New York to Dubai',
                  },
                  {
                    quote:
                      'Had to adjust my return trip plans and cancelling my ticket freed the reservation instantaneously.',
                    name: 'Olivia Martinez',
                    route: 'Los Angeles to Bali',
                  },
                ].map((review) => (
                  <div
                    key={review.name}
                    className="bg-white rounded-xl p-5 border border-slate-200 flex flex-col justify-between"
                  >
                    <p className="text-xs text-slate-600 leading-relaxed">"{review.quote}"</p>
                    <div className="mt-5 pt-3 border-t border-slate-100">
                      <div className="text-xs font-bold text-slate-900">{review.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {review.route} · Verified Booking
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="lg:col-span-4 rounded-2xl bg-[#0B162C] text-white p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold leading-snug">
                    Fare Alerts & Weekly Deals
                  </h3>
                  <p className="text-slate-300 text-xs mt-1.5 leading-relaxed">
                    Receive price drop notifications and promo code{' '}
                    <span className="font-mono text-white font-semibold">
                      {settings.promoCode}
                    </span>{' '}
                    updates.
                  </p>
                </div>
                <form onSubmit={handleNewsletterSubmit} className="mt-5 flex gap-2">
                  <input
                    type="email"
                    required
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="flex-1 bg-white text-slate-900 px-3.5 py-2.5 rounded-lg text-xs outline-none"
                  />
                  <button
                    type="submit"
                    className="bg-[#0D5BE1] hover:bg-[#0842A8] text-white px-4 py-2.5 rounded-lg text-xs font-semibold transition whitespace-nowrap"
                  >
                    Subscribe
                  </button>
                </form>
              </div>
            </div>
          </section>

          {/* FOOTER */}
          <footer className="bg-[#0B162C] text-slate-300 pt-12 pb-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-slate-800">
              <div>
                <div className="text-lg font-extrabold text-white mb-2">
                  {settings.brandName}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {settings.tagline} Reliable online air ticketing with real-time seat maps and instant e-tickets.
                </p>
              </div>

              <div>
                <h4 className="text-white text-xs font-bold mb-3">Quick Links</h4>
                <ul className="space-y-2 text-xs">
                  <li>
                    <a href="#flightsSection" className="hover:text-white transition">
                      Search Flights
                    </a>
                  </li>
                  <li>
                    <a href="#destinationsSection" className="hover:text-white transition">
                      Destinations
                    </a>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={handleOpenMyTrips}
                      className="hover:text-white transition"
                    >
                      My Trips & Boarding Pass
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={handleOpenAdmin}
                      className="text-sky-400 hover:text-sky-300 font-semibold transition"
                    >
                      Admin Dashboard
                    </button>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-white text-xs font-bold mb-3">Popular Routes</h4>
                <ul className="space-y-2 text-xs">
                  <li>
                    <button
                      type="button"
                      onClick={() => handleQuickDestinationSearch('Paris')}
                      className="hover:text-white transition"
                    >
                      New York to Paris
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => handleQuickDestinationSearch('Dubai')}
                      className="hover:text-white transition"
                    >
                      New York to Dubai
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => handleQuickDestinationSearch('Bali')}
                      className="hover:text-white transition"
                    >
                      Los Angeles to Bali
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => handleQuickDestinationSearch('Zurich')}
                      className="hover:text-white transition"
                    >
                      London to Zurich
                    </button>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-white text-xs font-bold mb-3">Contact Support</h4>
                <ul className="space-y-2 text-xs">
                  <li className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>{settings.phone}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>{settings.email}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>{settings.address}</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
              <div>© 2026 {settings.brandName}. All rights reserved.</div>
              <div className="text-xs text-slate-400">
                Accepted: Visa · Mastercard · Amex · PayPal
              </div>
            </div>
          </footer>
        </>
      )}

      {/* AUTHENTICATION MODAL */}
      {showAuthModal && (
        <AuthModal
          brandName={settings.brandName}
          onClose={() => {
            setShowAuthModal(false);
            setPendingAdminNav(false);
          }}
          onAuthSuccess={handleAuthSuccess}
          onNotify={notify}
        />
      )}

      {/* BOOKING & SEAT SELECTION MODAL */}
      {bookingFlight && (
        <BookingModal
          flight={bookingFlight}
          initialPassengers={searchPassengers}
          currency={cur}
          activePromoCode={settings.promoCode}
          activePromoPercent={settings.promoPercent}
          onClose={() => setBookingFlight(null)}
          onConfirmBooking={handleConfirmBooking}
          onNotify={notify}
        />
      )}

      {/* PRINTABLE BOARDING PASS MODAL */}
      {activeTicket && (
        <TicketModal
          booking={activeTicket}
          brandName={settings.brandName}
          currency={cur}
          onClose={() => setActiveTicket(null)}
        />
      )}

      {/* MY TRIPS MODAL */}
      {showMyTrips && (
        <MyTripsModal
          bookings={bookings}
          currency={cur}
          onClose={() => setShowMyTrips(false)}
          onViewTicket={(b) => {
            setShowMyTrips(false);
            setActiveTicket(b);
          }}
          onCancelBooking={handleCancelBooking}
        />
      )}
    </div>
  );
}
