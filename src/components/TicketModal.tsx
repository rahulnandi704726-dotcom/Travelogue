import React from 'react';
import { Plane, Printer, X } from 'lucide-react';
import { Booking, CurrencySymbol } from '../types';

interface TicketModalProps {
  booking: Booking;
  brandName: string;
  currency: CurrencySymbol;
  onClose: () => void;
}

const BARCODE_WIDTHS = [2, 1, 3, 1, 2, 4, 1, 2, 3, 1, 2, 2, 4, 1, 2, 1, 3, 2, 1, 2, 3, 1, 2];

export const TicketModal: React.FC<TicketModalProps> = ({
  booking,
  brandName,
  currency,
  onClose,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="boardingPassHeading"
    >
      <div className="max-w-xl w-full my-auto space-y-4">
        <div
          id="boardingPassPrintable"
          className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
        >
          {/* Boarding Pass Header */}
          <div className="bg-[#0D5BE1] text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
                <Plane className="w-5 h-5" />
              </div>
              <div>
                <div id="boardingPassHeading" className="font-extrabold text-base leading-tight">
                  {brandName} Boarding Pass
                </div>
                <div className="text-xs text-blue-100">Electronic Air Ticket</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-blue-100">PNR Reference</div>
              <div className="text-lg font-mono font-bold tracking-widest tabular-nums">
                {booking.pnr}
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Passenger + Airline */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs text-slate-400 font-medium">Lead Passenger</div>
                <div className="text-base font-bold text-slate-900 mt-0.5">
                  {booking.passengerName}
                </div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  Passport: {booking.passport || 'Verified'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400 font-medium">Carrier & Flight</div>
                <div className="text-sm font-bold text-[#0D5BE1] mt-0.5">
                  {booking.airline} · {booking.flightNumber}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{booking.date}</div>
              </div>
            </div>

            {/* Route Block */}
            <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between gap-4 border border-dashed border-slate-300">
              <div>
                <div className="text-lg sm:text-xl font-extrabold text-slate-900">
                  {booking.origin}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{booking.time}</div>
              </div>
              <div className="flex flex-col items-center shrink-0">
                <Plane className="w-5 h-5 text-[#0D5BE1]" />
                <span className="text-[11px] text-slate-500 font-medium mt-1">Direct / Gate B14</span>
              </div>
              <div className="text-right">
                <div className="text-lg sm:text-xl font-extrabold text-slate-900">
                  {booking.destination}
                </div>
                <div
                  className={`text-xs font-bold mt-0.5 ${
                    booking.status === 'Confirmed' ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {booking.status}
                </div>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-3 gap-3 text-center bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div>
                <div className="text-[11px] text-slate-500">Assigned Seat(s)</div>
                <div className="text-sm font-mono font-bold text-slate-900 mt-0.5">
                  {booking.seats.join(', ')}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">Travelers</div>
                <div className="text-sm font-bold text-slate-900 tabular-nums mt-0.5">
                  {booking.passengersCount}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">Total Paid</div>
                <div className="text-sm font-bold text-[#0D5BE1] tabular-nums mt-0.5">
                  {currency}
                  {booking.totalPaid}
                </div>
              </div>
            </div>

            {/* Barcode Footer */}
            <div className="pt-3 border-t border-dashed border-slate-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-[2px] h-9" aria-hidden="true">
                {BARCODE_WIDTHS.map((w, idx) => (
                  <span
                    key={idx}
                    style={{ width: `${w * 2}px` }}
                    className="h-full bg-slate-900 inline-block"
                  />
                ))}
              </div>
              <div className="text-[11px] font-mono text-slate-500 text-right">
                Issued {booking.createdAt}
                <br />
                {booking.passengerEmail}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="bg-white hover:bg-slate-50 text-slate-900 font-semibold text-xs px-5 py-2.5 rounded-lg shadow flex items-center gap-2 transition"
          >
            <Printer className="w-4 h-4" />
            Print Boarding Pass
          </button>
          <button
            type="button"
            onClick={onClose}
            className="bg-[#0D5BE1] hover:bg-[#0842A8] text-white font-semibold text-xs px-5 py-2.5 rounded-lg shadow flex items-center gap-1.5 transition"
          >
            <X className="w-4 h-4" />
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
