import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  LayoutDashboard,
  MapPin,
  Pencil,
  Plane,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings,
  Ticket,
  Trash2,
} from 'lucide-react';
import {
  AuditLogEntry,
  Booking,
  CurrencySymbol,
  Destination,
  Flight,
  FlightStopType,
  NvidiaCheckResult,
  SiteSettings,
} from '../types';
import { DESTINATION_IMAGES, getDiscountedFare } from '../data/seed';

interface AdminDashboardProps {
  settings: SiteSettings;
  destinations: Destination[];
  bookings: Booking[];
  authToken: string | null;
  onExit: () => void;
  onRefreshStorefront: () => Promise<void>;
  onCancelBooking: (pnr: string) => Promise<void>;
  onViewTicket: (booking: Booking) => void;
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

type AdminTab = 'overview' | 'flights' | 'destinations' | 'bookings' | 'logs' | 'settings';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  settings,
  destinations,
  bookings,
  authToken,
  onExit,
  onRefreshStorefront,
  onCancelBooking,
  onViewTicket,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [adminFlights, setAdminFlights] = useState<Flight[]>([]);
  const [loadingFlights, setLoadingFlights] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [nvidiaStatus, setNvidiaStatus] = useState<NvidiaCheckResult | null>(null);
  const [checkingNvidia, setCheckingNvidia] = useState(false);

  const cur = settings.currency;

  // Flight Form State
  const [editingFlightId, setEditingFlightId] = useState<string>('');
  const [airline, setAirline] = useState('');
  const [flightNumber, setFlightNumber] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('2026-12-22');
  const [time, setTime] = useState('09:00 AM - 04:15 PM');
  const [duration, setDuration] = useState('7h 15m');
  const [stops, setStops] = useState<FlightStopType>('Non-stop');
  const [cabinClass, setCabinClass] = useState<'Economy' | 'Business' | 'First'>('Economy');
  const [price, setPrice] = useState<number>(540);
  const [discount, setDiscount] = useState<number>(15);
  const [flightSearchQuery, setFlightSearchQuery] = useState('');

  // Destination Form State
  const [destName, setDestName] = useState('');
  const [destCountry, setDestCountry] = useState('');
  const [destPrice, setDestPrice] = useState<number>(499);
  const [destImage, setDestImage] = useState<string>(DESTINATION_IMAGES.paris);

  // Bookings Filter State
  const [bookingStatusFilter, setBookingStatusFilter] = useState<'all' | 'Confirmed' | 'Cancelled'>('all');
  const [bookingQuery, setBookingQuery] = useState('');

  // Settings Form State
  const [settingsForm, setSettingsForm] = useState<SiteSettings>(settings);

  const authHeaders = (): Record<string, string> =>
    authToken
      ? { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` }
      : { 'Content-Type': 'application/json' };

  const fetchAdminFlights = async () => {
    setLoadingFlights(true);
    try {
      const res = await fetch('/api/admin/flights', { headers: authHeaders() });
      const data = await res.json();
      if (res.ok && Array.isArray(data.flights)) {
        setAdminFlights(
          data.flights.map((f: any) => ({
            ...f,
            rating: Number(f.rating || 4.8),
            occupiedSeats: Array.isArray(f.occupiedSeats) ? f.occupiedSeats : [],
          }))
        );
      }
    } catch {
      onNotify('Failed to load flight inventory from database.', 'error');
    } finally {
      setLoadingFlights(false);
    }
  };

  const fetchAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/admin/logs?limit=100', { headers: authHeaders() });
      const data = await res.json();
      if (res.ok && Array.isArray(data.logs)) {
        setAuditLogs(data.logs);
      }
    } catch {
      onNotify('Failed to load entry and exit logs.', 'error');
    } finally {
      setLoadingLogs(false);
    }
  };

  const runNvidiaCheck = async () => {
    setCheckingNvidia(true);
    try {
      const res = await fetch('/api/nvidia/check', { headers: authHeaders() });
      const data = await res.json();
      setNvidiaStatus(data);
      if (data.connected) {
        onNotify(`NVIDIA API connected (${data.modelsCount} models, ${data.latencyMs}ms).`, 'success');
      } else {
        onNotify(data.error || 'NVIDIA API connection check failed.', 'error');
      }
      await fetchAuditLogs();
    } catch {
      onNotify('Unable to reach NVIDIA API health endpoint.', 'error');
    } finally {
      setCheckingNvidia(false);
    }
  };

  useEffect(() => {
    void fetchAdminFlights();
    void fetchAuditLogs();
  }, []);

  useEffect(() => {
    setSettingsForm(settings);
  }, [settings]);

  // Computed KPIs
  const confirmedBookings = bookings.filter((b) => b.status === 'Confirmed');
  const totalRevenue = confirmedBookings.reduce((sum, b) => sum + b.totalPaid, 0);
  const totalPassengers = confirmedBookings.reduce((sum, b) => sum + b.passengersCount, 0);
  const totalSeatsCapacity = adminFlights.length * 48;
  const occupiedSeatsTotal = adminFlights.reduce((sum, f) => sum + f.occupiedSeats.length, 0);
  const occupancyRate =
    totalSeatsCapacity > 0 ? Math.round((occupiedSeatsTotal / totalSeatsCapacity) * 100) : 0;

  const resetFlightForm = () => {
    setEditingFlightId('');
    setAirline('');
    setFlightNumber('');
    setOrigin('');
    setDestination('');
    setDate('2026-12-22');
    setTime('09:00 AM - 04:15 PM');
    setDuration('7h 15m');
    setStops('Non-stop');
    setCabinClass('Economy');
    setPrice(540);
    setDiscount(15);
  };

  const handleEditFlight = (f: Flight) => {
    setEditingFlightId(f.id);
    setAirline(f.airline);
    setFlightNumber(f.flightNumber);
    setOrigin(f.origin);
    setDestination(f.destination);
    setDate(f.date);
    setTime(f.time);
    setDuration(f.duration);
    setStops(f.stops);
    setCabinClass(f.cabinClass);
    setPrice(f.price);
    setDiscount(f.discount);
    setActiveTab('flights');
  };

  const handleFlightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const existing = adminFlights.find((f) => f.id === editingFlightId);
    const payload = {
      id: editingFlightId || `FL-${Date.now()}`,
      airline: airline.trim(),
      flightNumber: flightNumber.trim().toUpperCase(),
      origin: origin.trim(),
      destination: destination.trim(),
      date,
      time: time.trim(),
      duration: duration.trim(),
      stops,
      cabinClass,
      price: Number(price),
      discount: Number(discount || 0),
      rating: String(existing?.rating ?? '4.8'),
      occupiedSeats: existing?.occupiedSeats ?? [],
    };

    try {
      const res = await fetch('/api/admin/flights', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        onNotify(err.error || 'Failed to save flight.', 'error');
        return;
      }
      onNotify(editingFlightId ? 'Flight listing updated in Cloud SQL.' : 'New flight added to Cloud SQL.', 'success');
      resetFlightForm();
      await fetchAdminFlights();
      await onRefreshStorefront();
    } catch {
      onNotify('Network error saving flight.', 'error');
    }
  };

  const handleDeleteFlight = async (id: string, num: string) => {
    try {
      const res = await fetch(`/api/admin/flights/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (res.ok) {
        onNotify(`Removed flight ${num}.`, 'info');
        await fetchAdminFlights();
        await onRefreshStorefront();
      }
    } catch {
      onNotify('Failed to delete flight.', 'error');
    }
  };

  const handleDestinationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/destinations', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          id: `D-${Date.now()}`,
          name: destName.trim(),
          country: destCountry.trim(),
          price: Number(destPrice),
          discount: 20,
          rating: '4.8',
          image: destImage || DESTINATION_IMAGES.paris,
        }),
      });
      if (res.ok) {
        setDestName('');
        setDestCountry('');
        onNotify('Featured destination added.', 'success');
        await onRefreshStorefront();
      }
    } catch {
      onNotify('Failed to add destination.', 'error');
    }
  };

  const handleDeleteDestination = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/admin/destinations/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (res.ok) {
        onNotify(`Removed ${name}.`, 'info');
        await onRefreshStorefront();
      }
    } catch {
      onNotify('Failed to remove destination.', 'error');
    }
  };

  const handleRestoreBooking = async (pnr: string) => {
    try {
      const res = await fetch(`/api/admin/bookings/${encodeURIComponent(pnr)}/restore`, {
        method: 'PATCH',
        headers: authHeaders(),
      });
      if (res.ok) {
        onNotify(`Booking ${pnr} restored.`, 'success');
        await onRefreshStorefront();
        await fetchAdminFlights();
      }
    } catch {
      onNotify('Failed to restore booking.', 'error');
    }
  };

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(settingsForm),
      });
      if (res.ok) {
        onNotify('Site settings saved to Cloud SQL.', 'success');
        await onRefreshStorefront();
      }
    } catch {
      onNotify('Failed to save site settings.', 'error');
    }
  };

  const handleResetDemoData = async () => {
    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: authHeaders(),
      });
      if (res.ok) {
        onNotify('210 flights, bookings, and settings restored in Cloud SQL.', 'info');
        await fetchAdminFlights();
        await onRefreshStorefront();
      }
    } catch {
      onNotify('Failed to reset database.', 'error');
    }
  };

  const filteredFlights = adminFlights.filter((f) => {
    const q = flightSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      f.airline.toLowerCase().includes(q) ||
      f.flightNumber.toLowerCase().includes(q) ||
      f.origin.toLowerCase().includes(q) ||
      f.destination.toLowerCase().includes(q)
    );
  });

  const filteredBookings = bookings.filter((b) => {
    const matchesStatus = bookingStatusFilter === 'all' || b.status === bookingStatusFilter;
    const q = bookingQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      b.pnr.toLowerCase().includes(q) ||
      b.passengerName.toLowerCase().includes(q) ||
      b.destination.toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  const tabTitles: Record<AdminTab, string> = {
    overview: 'Operations Overview',
    flights: 'Flight Inventory (200+ Preloaded)',
    destinations: 'Featured Destinations',
    bookings: 'Passenger Bookings',
    logs: 'NVIDIA API & Entry / Exit Logs',
    settings: 'Basic Site Settings',
  };

  const navItems: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'flights', label: 'Flight Listings', icon: <Plane className="w-4 h-4" /> },
    { id: 'destinations', label: 'Destinations', icon: <MapPin className="w-4 h-4" /> },
    { id: 'bookings', label: 'Bookings', icon: <Ticket className="w-4 h-4" /> },
    { id: 'logs', label: 'API & Logs', icon: <Activity className="w-4 h-4" /> },
    { id: 'settings', label: 'Basic Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#F6F8FC] flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 bg-[#0B162C] text-slate-300 flex flex-col justify-between shrink-0">
        <div>
          <div className="px-5 py-5 border-b border-slate-800 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0D5BE1] text-white flex items-center justify-center">
              <Plane className="w-4 h-4" />
            </div>
            <span className="text-white font-bold text-base tracking-tight">
              {settings.brandName} Admin
            </span>
          </div>

          <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'logs') void fetchAuditLogs();
                  setActiveTab(item.id);
                }}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap shrink-0 ${
                  activeTab === item.id
                    ? 'bg-[#0D5BE1] text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onExit}
            className="w-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Storefront
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-5 sm:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="text-xs text-slate-500">
                Admin Console / {tabTitles[activeTab]}
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
                {tabTitles[activeTab]}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  resetFlightForm();
                  setActiveTab('flights');
                }}
                className="bg-[#0D5BE1] hover:bg-[#0842A8] text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                New Flight
              </button>
              <button
                type="button"
                onClick={onExit}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold px-4 py-2 rounded-lg transition whitespace-nowrap"
              >
                View Storefront
              </button>
            </div>
          </div>

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-5 border border-slate-200">
                  <div className="text-xs font-medium text-slate-500">Confirmed Ticket Sales</div>
                  <div className="text-2xl font-extrabold text-slate-900 tabular-nums mt-1">
                    {cur}
                    {totalRevenue.toLocaleString()}
                  </div>
                  <div className="text-xs text-emerald-700 font-medium mt-1">
                    {confirmedBookings.length} confirmed bookings
                  </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-slate-200">
                  <div className="text-xs font-medium text-slate-500">Preloaded Flight Catalog</div>
                  <div className="text-2xl font-extrabold text-[#0D5BE1] tabular-nums mt-1">
                    {adminFlights.length}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Max 10 random flights returned per search
                  </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-slate-200">
                  <div className="text-xs font-medium text-slate-500">Seat Occupancy</div>
                  <div className="text-2xl font-extrabold text-slate-900 tabular-nums mt-1">
                    {occupancyRate}%
                  </div>
                  <div className="text-xs text-slate-500 tabular-nums mt-1">
                    {occupiedSeatsTotal.toLocaleString()} of {totalSeatsCapacity.toLocaleString()} seats
                  </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-slate-200">
                  <div className="text-xs font-medium text-slate-500">Active Promo Campaign</div>
                  <div className="text-2xl font-extrabold text-orange-600 font-mono mt-1">
                    {settings.promoCode}
                  </div>
                  <div className="text-xs text-slate-500 tabular-nums mt-1">
                    {settings.promoPercent}% off · {totalPassengers} travelers
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">Recent Reservations</h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('bookings')}
                    className="text-xs font-semibold text-[#0D5BE1] hover:underline"
                  >
                    View all bookings
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4 font-semibold">PNR</th>
                        <th className="py-3 px-4 font-semibold">Passenger</th>
                        <th className="py-3 px-4 font-semibold">Route</th>
                        <th className="py-3 px-4 font-semibold">Seats</th>
                        <th className="py-3 px-4 font-semibold text-right">Amount</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bookings.slice(0, 6).map((b) => (
                        <tr key={b.pnr} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono font-bold text-[#0D5BE1]">{b.pnr}</td>
                          <td className="py-3 px-4 font-medium text-slate-900">{b.passengerName}</td>
                          <td className="py-3 px-4 text-slate-600">
                            {b.origin} to {b.destination}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-700">{b.seats.join(', ')}</td>
                          <td className="py-3 px-4 text-right font-bold tabular-nums text-slate-900">
                            {cur}
                            {b.totalPaid}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`font-semibold ${
                                b.status === 'Confirmed' ? 'text-emerald-700' : 'text-rose-600'
                              }`}
                            >
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* FLIGHTS CRUD TAB */}
          {activeTab === 'flights' && (
            <div className="space-y-6">
              <form
                onSubmit={handleFlightSubmit}
                className="bg-white rounded-xl border border-slate-200 p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">
                    {editingFlightId ? `Edit Flight ${flightNumber}` : 'Add New Flight Listing'}
                  </h2>
                  {editingFlightId && (
                    <button
                      type="button"
                      onClick={resetFlightForm}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Airline Name
                    </label>
                    <input
                      type="text"
                      required
                      value={airline}
                      onChange={(e) => setAirline(e.target.value)}
                      placeholder="e.g. Lufthansa"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0D5BE1]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Flight Number
                    </label>
                    <input
                      type="text"
                      required
                      value={flightNumber}
                      onChange={(e) => setFlightNumber(e.target.value)}
                      placeholder="e.g. LH-401"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono uppercase outline-none focus:border-[#0D5BE1]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Origin City & Code
                    </label>
                    <input
                      type="text"
                      required
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      placeholder="New York (JFK)"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0D5BE1]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Destination City & Code
                    </label>
                    <input
                      type="text"
                      required
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder="Paris (CDG)"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0D5BE1]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Departure Date
                    </label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0D5BE1]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Schedule Time
                    </label>
                    <input
                      type="text"
                      required
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      placeholder="08:30 AM - 08:45 PM"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0D5BE1]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Duration
                      </label>
                      <input
                        type="text"
                        required
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0D5BE1]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Stops</label>
                      <select
                        value={stops}
                        onChange={(e) => setStops(e.target.value as FlightStopType)}
                        className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white outline-none focus:border-[#0D5BE1]"
                      >
                        <option value="Non-stop">Non-stop</option>
                        <option value="1 Stop">1 Stop</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Base Fare ({cur})
                      </label>
                      <input
                        type="number"
                        min={49}
                        required
                        value={price}
                        onChange={(e) => setPrice(Number(e.target.value))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm tabular-nums outline-none focus:border-[#0D5BE1]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Discount %
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={75}
                        value={discount}
                        onChange={(e) => setDiscount(Number(e.target.value))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm tabular-nums outline-none focus:border-[#0D5BE1]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={resetFlightForm}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Clear
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-[#0D5BE1] hover:bg-[#0842A8] text-white text-xs font-semibold transition"
                  >
                    {editingFlightId ? 'Update Flight' : 'Publish Flight'}
                  </button>
                </div>
              </form>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-bold text-slate-900">
                    Active Flight Inventory ({filteredFlights.length} of {adminFlights.length})
                  </h2>
                  <input
                    type="text"
                    value={flightSearchQuery}
                    onChange={(e) => setFlightSearchQuery(e.target.value)}
                    placeholder="Filter by airline, number, or city..."
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#0D5BE1]"
                  />
                </div>
                <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Carrier</th>
                        <th className="py-3 px-4 font-semibold">Route</th>
                        <th className="py-3 px-4 font-semibold">Schedule</th>
                        <th className="py-3 px-4 font-semibold text-right">Net Fare</th>
                        <th className="py-3 px-4 font-semibold text-right">Open Seats</th>
                        <th className="py-3 px-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loadingFlights ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500">
                            Loading database flights...
                          </td>
                        </tr>
                      ) : (
                        filteredFlights.slice(0, 100).map((f) => (
                          <tr key={f.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900">{f.airline}</div>
                              <div className="text-slate-500 font-mono">{f.flightNumber}</div>
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-800">
                              {f.origin} to {f.destination}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              <div>{f.date}</div>
                              <div className="text-slate-400">
                                {f.time} · {f.stops}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-bold tabular-nums text-slate-900">
                              {cur}
                              {getDiscountedFare(f)}
                              {f.discount > 0 && (
                                <span className="text-orange-600 ml-1">(-{f.discount}%)</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                              {48 - f.occupiedSeats.length}/48
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleEditFlight(f)}
                                  aria-label={`Edit ${f.flightNumber}`}
                                  className="p-1.5 rounded-lg text-slate-600 hover:bg-blue-50 hover:text-[#0D5BE1] transition"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteFlight(f.id, f.flightNumber)}
                                  aria-label={`Delete ${f.flightNumber}`}
                                  className="p-1.5 rounded-lg text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* DESTINATIONS TAB */}
          {activeTab === 'destinations' && (
            <div className="space-y-6">
              <form
                onSubmit={handleDestinationSubmit}
                className="bg-white rounded-xl border border-slate-200 p-5 space-y-4"
              >
                <h2 className="text-sm font-bold text-slate-900">Add Featured Destination Card</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <input
                    type="text"
                    required
                    value={destName}
                    onChange={(e) => setDestName(e.target.value)}
                    placeholder="City (e.g. Tokyo)"
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0D5BE1]"
                  />
                  <input
                    type="text"
                    required
                    value={destCountry}
                    onChange={(e) => setDestCountry(e.target.value)}
                    placeholder="Country (e.g. Japan)"
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0D5BE1]"
                  />
                  <input
                    type="number"
                    required
                    min={49}
                    value={destPrice}
                    onChange={(e) => setDestPrice(Number(e.target.value))}
                    placeholder="Starting Fare"
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm tabular-nums outline-none focus:border-[#0D5BE1]"
                  />
                  <select
                    value={destImage}
                    onChange={(e) => setDestImage(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-[#0D5BE1]"
                  >
                    <option value={DESTINATION_IMAGES.paris}>Paris Visual</option>
                    <option value={DESTINATION_IMAGES.bali}>Bali Visual</option>
                    <option value={DESTINATION_IMAGES.dubai}>Dubai Visual</option>
                    <option value={DESTINATION_IMAGES.maldives}>Maldives Visual</option>
                    <option value={DESTINATION_IMAGES.switzerland}>Alpine Visual</option>
                  </select>
                  <button
                    type="submit"
                    className="bg-[#0D5BE1] hover:bg-[#0842A8] text-white text-xs font-semibold rounded-lg px-4 py-2 transition"
                  >
                    Add Destination
                  </button>
                </div>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {destinations.map((d) => (
                  <div
                    key={d.id}
                    className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3.5"
                  >
                    <img
                      src={d.image}
                      referrerPolicy="no-referrer"
                      alt={`${d.name}, ${d.country}`}
                      className="w-16 h-16 rounded-lg object-cover shrink-0 bg-slate-100"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900 text-sm truncate">
                        {d.name}, {d.country}
                      </div>
                      <div className="text-xs text-slate-500 tabular-nums mt-0.5">
                        From {cur}
                        {d.price} · {d.discount}% off
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteDestination(d.id, d.name)}
                      aria-label={`Delete ${d.name}`}
                      className="p-2 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BOOKINGS TAB */}
          {activeTab === 'bookings' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {(['all', 'Confirmed', 'Cancelled'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setBookingStatusFilter(status)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        bookingStatusFilter === status
                          ? 'bg-[#0D5BE1] text-white'
                          : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {status === 'all' ? 'All Bookings' : status}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={bookingQuery}
                  onChange={(e) => setBookingQuery(e.target.value)}
                  placeholder="Search PNR or passenger..."
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#0D5BE1]"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 font-semibold">PNR</th>
                      <th className="py-3 px-4 font-semibold">Passenger</th>
                      <th className="py-3 px-4 font-semibold">Flight & Route</th>
                      <th className="py-3 px-4 font-semibold">Seats</th>
                      <th className="py-3 px-4 font-semibold text-right">Paid</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredBookings.map((b) => (
                      <tr key={b.pnr} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-bold text-[#0D5BE1]">{b.pnr}</td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{b.passengerName}</div>
                          <div className="text-slate-500">{b.passengerEmail}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800">
                            {b.origin} to {b.destination}
                          </div>
                          <div className="text-slate-400">
                            {b.airline} ({b.flightNumber}) · {b.date}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700">{b.seats.join(', ')}</td>
                        <td className="py-3 px-4 text-right font-bold tabular-nums text-slate-900">
                          {cur}
                          {b.totalPaid}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`font-semibold ${
                              b.status === 'Confirmed' ? 'text-emerald-700' : 'text-rose-600'
                            }`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onViewTicket(b)}
                              className="text-xs font-semibold text-[#0D5BE1] hover:underline"
                            >
                              Ticket
                            </button>
                            {b.status === 'Confirmed' ? (
                              <button
                                type="button"
                                onClick={() => onCancelBooking(b.pnr)}
                                className="text-xs font-semibold text-rose-600 hover:underline"
                              >
                                Cancel
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRestoreBooking(b.pnr)}
                                className="text-xs font-semibold text-emerald-700 hover:underline"
                              >
                                Restore
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* NVIDIA API & ENTRY/EXIT LOGS TAB */}
          {activeTab === 'logs' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    NVIDIA API Connection Diagnostics
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Verify live server-side authentication with the configured NVIDIA NIM API key and record entry/exit logs.
                  </p>
                  {nvidiaStatus && (
                    <div className="mt-2 text-xs font-medium text-slate-700 space-y-1">
                      <div>
                        Status:{' '}
                        <span
                          className={
                            nvidiaStatus.connected ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'
                          }
                        >
                          {nvidiaStatus.connected ? 'Connected' : 'Disconnected'}
                        </span>{' '}
                        · Key: <span className="font-mono">{nvidiaStatus.maskedKey}</span>
                        {nvidiaStatus.latencyMs !== undefined && (
                          <span className="tabular-nums"> · Latency: {nvidiaStatus.latencyMs}ms</span>
                        )}
                        {nvidiaStatus.modelsCount !== undefined && (
                          <span className="tabular-nums"> · {nvidiaStatus.modelsCount} models</span>
                        )}
                      </div>
                      {nvidiaStatus.sampleModels && nvidiaStatus.sampleModels.length > 0 && (
                        <div className="text-[11px] font-mono text-slate-500">
                          Models: {nvidiaStatus.sampleModels.join(', ')}
                        </div>
                      )}
                      {nvidiaStatus.error && (
                        <div className="text-rose-600">{nvidiaStatus.error}</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={checkingNvidia}
                    onClick={runNvidiaCheck}
                    className="bg-[#0D5BE1] hover:bg-[#0842A8] disabled:opacity-60 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition flex items-center gap-2"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    {checkingNvidia ? 'Checking...' : 'Test NVIDIA API Connection'}
                  </button>
                  <button
                    type="button"
                    disabled={loadingLogs}
                    onClick={fetchAuditLogs}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3.5 py-2.5 rounded-lg transition flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Refresh Logs
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">
                    Server Entry & Exit Logs ({auditLogs.length})
                  </h2>
                  <span className="text-xs text-slate-500">Latest 100 recorded requests</span>
                </div>
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Event</th>
                        <th className="py-3 px-4 font-semibold">Method & Endpoint</th>
                        <th className="py-3 px-4 font-semibold">Actor</th>
                        <th className="py-3 px-4 font-semibold text-right">Status</th>
                        <th className="py-3 px-4 font-semibold text-right">Duration</th>
                        <th className="py-3 px-4 font-semibold">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-mono font-semibold text-slate-800">
                            {log.eventType}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-700">
                            {log.method} {log.endpoint}
                          </td>
                          <td className="py-2.5 px-4 text-slate-600">{log.actor}</td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                            {log.statusCode > 0 ? log.statusCode : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600">
                            {log.durationMs}ms
                          </td>
                          <td className="py-2.5 px-4 text-slate-500 max-w-xs truncate">
                            {log.details}
                          </td>
                        </tr>
                      ))}
                      {auditLogs.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500">
                            No logs recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* BASIC SETTINGS TAB */}
          {activeTab === 'settings' && (
            <form
              onSubmit={handleSettingsSubmit}
              className="bg-white rounded-xl border border-slate-200 p-6 max-w-3xl space-y-5"
            >
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Storefront & Ticketing Configuration
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Updates here are stored in Cloud SQL and synchronized across the website.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Brand Name
                  </label>
                  <input
                    type="text"
                    required
                    value={settingsForm.brandName}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, brandName: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-sm outline-none focus:border-[#0D5BE1]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Tagline
                  </label>
                  <input
                    type="text"
                    required
                    value={settingsForm.tagline}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, tagline: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-sm outline-none focus:border-[#0D5BE1]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Hero Headline Prefix
                  </label>
                  <input
                    type="text"
                    required
                    value={settingsForm.heroHeadline}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, heroHeadline: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-sm outline-none focus:border-[#0D5BE1]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Hero Subheadline
                  </label>
                  <input
                    type="text"
                    required
                    value={settingsForm.heroSubheadline}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, heroSubheadline: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-sm outline-none focus:border-[#0D5BE1]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Active Promo Code
                  </label>
                  <input
                    type="text"
                    required
                    value={settingsForm.promoCode}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, promoCode: e.target.value.toUpperCase() })
                    }
                    className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-sm font-mono uppercase outline-none focus:border-[#0D5BE1]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Promo Discount (%)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={75}
                    required
                    value={settingsForm.promoPercent}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, promoPercent: Number(e.target.value) })
                    }
                    className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-sm tabular-nums outline-none focus:border-[#0D5BE1]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Currency
                  </label>
                  <select
                    value={settingsForm.currency}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        currency: e.target.value as CurrencySymbol,
                      })
                    }
                    className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-sm bg-white outline-none focus:border-[#0D5BE1]"
                  >
                    <option value="$">$ USD</option>
                    <option value="€">€ EUR</option>
                    <option value="£">£ GBP</option>
                    <option value="₹">₹ INR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Support Phone
                  </label>
                  <input
                    type="text"
                    required
                    value={settingsForm.phone}
                    onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-sm outline-none focus:border-[#0D5BE1]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Support Email
                  </label>
                  <input
                    type="email"
                    required
                    value={settingsForm.email}
                    onChange={(e) => setSettingsForm({ ...settingsForm, email: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-sm outline-none focus:border-[#0D5BE1]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleResetDemoData}
                  className="text-xs font-semibold text-rose-600 hover:underline flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Demo Data (210 Flights)
                </button>
                <button
                  type="submit"
                  className="bg-[#0D5BE1] hover:bg-[#0842A8] text-white text-xs font-semibold px-6 py-2.5 rounded-lg transition"
                >
                  Save Site Settings
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
};
