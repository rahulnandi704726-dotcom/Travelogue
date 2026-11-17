export type CurrencySymbol = '$' | '€' | '£' | '₹';

export type BookingStatus = 'Confirmed' | 'Cancelled';

export type FlightStopType = 'Non-stop' | '1 Stop';

export interface AuthUser {
  id: number;
  uid: string;
  email: string;
  role: string;
  name: string;
}

export interface SiteSettings {
  brandName: string;
  tagline: string;
  announcementText: string;
  heroHeadline: string;
  heroSubheadline: string;
  promoCode: string;
  promoPercent: number;
  currency: CurrencySymbol;
  phone: string;
  email: string;
  address: string;
}

export interface Flight {
  id: string;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  date: string;
  time: string;
  duration: string;
  stops: FlightStopType;
  cabinClass: 'Economy' | 'Business' | 'First';
  price: number;
  discount: number;
  rating: number;
  occupiedSeats: string[];
}

export interface Destination {
  id: string;
  name: string;
  country: string;
  price: number;
  discount: number;
  rating: number;
  image: string;
}

export interface Deal {
  id: string;
  title: string;
  subtitle: string;
  label: string;
  oldPrice: number;
  price: number;
  query: string;
  image: string;
}

export interface Booking {
  pnr: string;
  flightId: string;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  date: string;
  time: string;
  passengerName: string;
  passengerEmail: string;
  passport: string;
  seats: string[];
  passengersCount: number;
  baggageFee: number;
  totalPaid: number;
  status: BookingStatus;
  createdAt: string;
}

export interface AuditLogEntry {
  id: number;
  eventType: string;
  actor: string;
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number;
  details: string;
  createdAt: string;
}

export interface NvidiaCheckResult {
  connected: boolean;
  statusCode?: number;
  latencyMs?: number;
  modelsCount?: number;
  sampleModels?: string[];
  maskedKey?: string;
  error?: string;
}

export interface AppState {
  settings: SiteSettings;
  flights: Flight[];
  destinations: Destination[];
  deals: Deal[];
  bookings: Booking[];
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
