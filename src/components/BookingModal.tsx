import React, { useState, useMemo } from 'react';
import { X, Ticket, ShieldCheck, AlertCircle } from 'lucide-react';
import { CurrencySymbol, Flight } from '../types';
import { getDiscountedFare } from '../data/seed';

interface BookingModalProps {
  flight: Flight;
  initialPassengers: number;
  currency: CurrencySymbol;
  activePromoCode: string;
  activePromoPercent: number;
  onClose: () => void;
  onConfirmBooking: (payload: {
    flight: Flight;
    passengerName: string;
    passengerEmail: string;
    passport: string;
    seats: string[];
    passengersCount: number;
    baggageFee: number;
    totalPaid: number;
  }) => void;
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const LEFT_COLS = ['A', 'B', 'C'];
const RIGHT_COLS = ['D', 'E', 'F'];
const ROWS = [1, 2, 3, 4, 5, 6, 7, 8];

export const BookingModal: React.FC<BookingModalProps> = ({
  flight,
  initialPassengers,
  currency,
  activePromoCode,
  activePromoPercent,
  onClose,
  onConfirmBooking,
  onNotify,
}) => {
  const [passengersCount, setPassengersCount] = useState<number>(initialPassengers);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [passengerName, setPassengerName] = useState('');
  const [passengerEmail, setPassengerEmail] = useState('');
  const [passport, setPassport] = useState('');
  const [baggageFee, setBaggageFee] = useState<number>(0);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromoPercent, setAppliedPromoPercent] = useState<number>(0);
  const [seatWarning, setSeatWarning] = useState('');

  const availableSeatsCount = 48 - flight.occupiedSeats.length;

  const toggleSeat = (code: string) => {
    setSeatWarning('');
    setSelectedSeats((prev) => {
      if (prev.includes(code)) {
        return prev.filter((s) => s !== code);
      }
      if (prev.length >= passengersCount) {
        return [...prev.slice(1), code];
      }
      return [...prev, code];
    });
  };

  const handlePassengersChange = (nextCount: number) => {
    setPassengersCount(nextCount);
    if (selectedSeats.length > nextCount) {
      setSelectedSeats((prev) => prev.slice(0, nextCount));
    }
  };

  const handleApplyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) {
      setAppliedPromoPercent(0);
      return;
    }
    if (code === activePromoCode.toUpperCase()) {
      setAppliedPromoPercent(activePromoPercent);
      onNotify(`Promo ${code} applied for ${activePromoPercent}% off.`, 'success');
    } else {
      setAppliedPromoPercent(0);
      onNotify(`Invalid code. Try ${activePromoCode}.`, 'error');
    }
  };

  const fareBreakdown = useMemo(() => {
    const unitFare = getDiscountedFare(flight);
    const baseTotal = unitFare * passengersCount;
    const businessSeatCount = selectedSeats.filter(
      (s) => s.startsWith('1') || s.startsWith('2')
    ).length;
    const cabinUpgradeFee = businessSeatCount * 120;
    const extras = cabinUpgradeFee + baggageFee;
    const discount = Math.round((baseTotal + extras) * (appliedPromoPercent / 100));
    const taxes = 28 * passengersCount;
    const total = Math.max(0, baseTotal + extras - discount + taxes);
    return { baseTotal, cabinUpgradeFee, extras, discount, taxes, total };
  }, [flight, passengersCount, selectedSeats, baggageFee, appliedPromoPercent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSeats.length < passengersCount) {
      setSeatWarning(`Please select ${passengersCount} seat(s) on the cabin map before confirming.`);
      onNotify(`Select ${passengersCount} seat(s) to continue.`, 'error');
      return;
    }
    onConfirmBooking({
      flight,
      passengerName: passengerName.trim(),
      passengerEmail: passengerEmail.trim(),
      passport: passport.trim().toUpperCase(),
      seats: selectedSeats,
      passengersCount,
      baggageFee,
      totalPaid: fareBreakdown.total,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bookingModalHeading"
    >
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-[#0B162C] text-white px-6 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs text-sky-300 font-medium">
              {flight.airline} · {flight.flightNumber} · {flight.date}
            </div>
            <h3 id="bookingModalHeading" className="text-lg font-bold truncate">
              {flight.origin} to {flight.destination}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close booking dialog"
            className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-h-[82vh] overflow-y-auto">
          {/* Left: Cabin Seat Map */}
          <div className="lg:col-span-5 bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-slate-900">1. Select Seats</h4>
              <span className="text-xs font-semibold text-[#0D5BE1] tabular-nums">
                {selectedSeats.length}/{passengersCount} selected
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-600 mb-3">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-white border border-slate-300 inline-block" /> Economy
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-50 border border-amber-400 inline-block" /> Business (+{currency}120)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#0D5BE1] inline-block" /> Selected
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-slate-200 inline-block" /> Occupied
              </span>
            </div>

            <div className="bg-white rounded-t-3xl rounded-b-xl border border-slate-200 p-4 pt-5">
              <div className="text-center text-[11px] font-semibold text-slate-400 mb-3">
                Forward Cabin · {availableSeatsCount} open
              </div>
              <div className="space-y-1.5">
                {ROWS.map((row) => {
                  const isBusiness = row <= 2;
                  return (
                    <div key={row} className="flex items-center justify-between gap-1.5">
                      <div className="flex gap-1">
                        {LEFT_COLS.map((col) => {
                          const code = `${row}${col}`;
                          const occupied = flight.occupiedSeats.includes(code);
                          const selected = selectedSeats.includes(code);
                          return (
                            <button
                              key={code}
                              type="button"
                              disabled={occupied}
                              onClick={() => toggleSeat(code)}
                              aria-label={`Seat ${code}${isBusiness ? ' Business Class' : ''}${occupied ? ' Occupied' : ''}`}
                              className={`w-8 h-8 rounded-md border text-[11px] font-mono tabular-nums transition ${
                                occupied
                                  ? 'bg-slate-200 border-slate-200 text-slate-400 cursor-not-allowed'
                                  : selected
                                  ? 'bg-[#0D5BE1] border-[#0D5BE1] text-white font-bold shadow-sm'
                                  : isBusiness
                                  ? 'bg-amber-50 border-amber-300 text-amber-900 hover:border-amber-500'
                                  : 'bg-white border-slate-300 text-slate-700 hover:border-[#0D5BE1]'
                              }`}
                            >
                              {code}
                            </button>
                          );
                        })}
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 w-4 text-center tabular-nums">
                        {row}
                      </span>
                      <div className="flex gap-1">
                        {RIGHT_COLS.map((col) => {
                          const code = `${row}${col}`;
                          const occupied = flight.occupiedSeats.includes(code);
                          const selected = selectedSeats.includes(code);
                          return (
                            <button
                              key={code}
                              type="button"
                              disabled={occupied}
                              onClick={() => toggleSeat(code)}
                              aria-label={`Seat ${code}${isBusiness ? ' Business Class' : ''}${occupied ? ' Occupied' : ''}`}
                              className={`w-8 h-8 rounded-md border text-[11px] font-mono tabular-nums transition ${
                                occupied
                                  ? 'bg-slate-200 border-slate-200 text-slate-400 cursor-not-allowed'
                                  : selected
                                  ? 'bg-[#0D5BE1] border-[#0D5BE1] text-white font-bold shadow-sm'
                                  : isBusiness
                                  ? 'bg-amber-50 border-amber-300 text-amber-900 hover:border-amber-500'
                                  : 'bg-white border-slate-300 text-slate-700 hover:border-[#0D5BE1]'
                              }`}
                            >
                              {code}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 text-xs text-slate-700 flex items-center justify-between px-1">
              <span>Assigned seats:</span>
              <span className="font-mono font-bold text-[#0D5BE1]">
                {selectedSeats.length > 0 ? selectedSeats.join(', ') : 'None selected'}
              </span>
            </div>
            {seatWarning && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-600 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{seatWarning}</span>
              </div>
            )}
          </div>

          {/* Right: Passenger Details & Fare Summary */}
          <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">2. Traveler Details</h4>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <span>Travelers:</span>
                <select
                  value={passengersCount}
                  onChange={(e) => handlePassengersChange(Number(e.target.value))}
                  className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 bg-white outline-none focus:border-[#0D5BE1]"
                >
                  {[1, 2, 3, 4].map((num) => (
                    <option key={num} value={num} disabled={num > availableSeatsCount}>
                      {num} {num === 1 ? 'Traveler' : 'Travelers'}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Lead Passenger Full Name
                </label>
                <input
                  type="text"
                  required
                  value={passengerName}
                  onChange={(e) => setPassengerName(e.target.value)}
                  placeholder="Alex Morgan"
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-[#0D5BE1]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Email for E-Ticket
                </label>
                <input
                  type="email"
                  required
                  value={passengerEmail}
                  onChange={(e) => setPassengerEmail(e.target.value)}
                  placeholder="alex@example.com"
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-[#0D5BE1]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Passport or Gov ID
                </label>
                <input
                  type="text"
                  required
                  value={passport}
                  onChange={(e) => setPassport(e.target.value)}
                  placeholder="US84729103"
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm font-mono uppercase text-slate-900 outline-none focus:border-[#0D5BE1]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Checked Baggage
                </label>
                <select
                  value={baggageFee}
                  onChange={(e) => setBaggageFee(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 bg-white outline-none focus:border-[#0D5BE1]"
                >
                  <option value={0}>Carry-on Only (Included)</option>
                  <option value={35}>1 Checked Bag 23kg (+{currency}35)</option>
                  <option value={65}>2 Checked Bags (+{currency}65)</option>
                </select>
              </div>
            </div>

            {/* Promo Code Row */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Promo Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  placeholder={`Enter code (e.g. ${activePromoCode})`}
                  className="flex-1 border border-slate-200 rounded-lg px-3.5 py-2 text-sm font-mono uppercase text-slate-900 outline-none focus:border-[#0D5BE1]"
                />
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition whitespace-nowrap shrink-0"
                >
                  Apply Code
                </button>
              </div>
            </div>

            {/* Fare Summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>
                  Base Fare ({passengersCount} {passengersCount === 1 ? 'Traveler' : 'Travelers'})
                </span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {currency}
                  {fareBreakdown.baseTotal}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Cabin Upgrades & Baggage</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {currency}
                  {fareBreakdown.extras}
                </span>
              </div>
              {fareBreakdown.discount > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Promo Discount ({appliedPromoPercent}%)</span>
                  <span className="font-semibold tabular-nums">
                    -{currency}
                    {fareBreakdown.discount}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Taxes & Airport Fees</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {currency}
                  {fareBreakdown.taxes}
                </span>
              </div>
              <div className="border-t border-slate-200 pt-2.5 mt-2 flex justify-between items-baseline">
                <span className="text-sm font-bold text-slate-900">Total Payable</span>
                <span className="text-xl font-extrabold text-[#0D5BE1] tabular-nums">
                  {currency}
                  {fareBreakdown.total}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Free cancellation within 24 hours of booking
              </span>
            </div>

            <button
              type="submit"
              className="w-full bg-[#0D5BE1] hover:bg-[#0842A8] text-white font-bold py-3 px-5 rounded-xl transition flex items-center justify-center gap-2 text-sm shadow-sm"
            >
              <Ticket className="w-4 h-4" />
              Confirm & Issue E-Ticket
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
