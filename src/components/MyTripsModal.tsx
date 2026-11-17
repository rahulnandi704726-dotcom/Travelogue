import React, { useState } from 'react';
import { Search, Ticket, X } from 'lucide-react';
import { Booking, CurrencySymbol } from '../types';

interface MyTripsModalProps {
  bookings: Booking[];
  currency: CurrencySymbol;
  onClose: () => void;
  onViewTicket: (booking: Booking) => void;
  onCancelBooking: (pnr: string) => void;
}

export const MyTripsModal: React.FC<MyTripsModalProps> = ({
  bookings,
  currency,
  onClose,
  onViewTicket,
  onCancelBooking,
}) => {
  const [query, setQuery] = useState('');

  const filtered = bookings.filter((b) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      b.pnr.toLowerCase().includes(q) ||
      b.passengerName.toLowerCase().includes(q) ||
      b.passengerEmail.toLowerCase().includes(q) ||
      b.destination.toLowerCase().includes(q)
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="myTripsHeading"
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="bg-[#0B162C] text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h3 id="myTripsHeading" className="font-bold text-base">
              My Trips & Manage Booking
            </h3>
            <p className="text-xs text-slate-300">
              View boarding passes or cancel reservations for instant seat release.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close My Trips"
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by PNR (e.g. TRV842), passenger name, or destination"
              className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#0D5BE1]"
            />
          </div>

          <div className="max-h-[58vh] overflow-y-auto space-y-3 pr-1">
            {filtered.length === 0 ? (
              <div className="text-center py-10 text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl">
                No matching trips found. Search and book a flight to generate your first PNR.
              </div>
            ) : (
              filtered.map((b) => (
                <div
                  key={b.pnr}
                  className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-[#0D5BE1]">{b.pnr}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`font-semibold ${
                          b.status === 'Confirmed' ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {b.status}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-slate-500">{b.date}</span>
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                      {b.origin} to {b.destination}
                    </div>
                    <div className="text-xs text-slate-500">
                      {b.airline} ({b.flightNumber}) · {b.passengerName} · Seats:{' '}
                      <span className="font-mono font-semibold text-slate-700">
                        {b.seats.join(', ')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-slate-900 text-sm tabular-nums mr-2">
                      {currency}
                      {b.totalPaid}
                    </span>
                    <button
                      type="button"
                      onClick={() => onViewTicket(b)}
                      className="bg-blue-50 hover:bg-blue-100 text-[#0D5BE1] text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition whitespace-nowrap"
                    >
                      <Ticket className="w-3.5 h-3.5" />
                      E-Ticket
                    </button>
                    {b.status === 'Confirmed' && (
                      <button
                        type="button"
                        onClick={() => onCancelBooking(b.pnr)}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold px-3 py-2 rounded-lg transition whitespace-nowrap"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
