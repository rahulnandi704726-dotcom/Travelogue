import { AppState } from '../types';

export const STORAGE_KEY = 'travelworld_air_ticketing_react_v1';

export const HERO_IMAGE = '/src/assets/images/hero_alpine_lake_1794926293580.jpg';

export const DESTINATION_IMAGES = {
  paris: '/src/assets/images/dest_paris_1794926293928.jpg',
  bali: '/src/assets/images/dest_bali_1794926293837.jpg',
  dubai: '/src/assets/images/dest_dubai_1794926294111.jpg',
  maldives: '/src/assets/images/dest_maldives_1794926293932.jpg',
  switzerland: '/src/assets/images/dest_switzerland_1794926294611.jpg',
};

export const DEFAULT_APP_STATE: AppState = {
  settings: {
    brandName: 'TravelWorld',
    tagline: 'Explore More. Worry Less.',
    announcementText: 'Free 24-hour cancellation · Best price guarantee · Instant e-ticket delivery',
    heroHeadline: 'Explore the World',
    heroSubheadline:
      'Book domestic and international flights at transparent fares with real-time seat selection and instant boarding passes.',
    promoCode: 'TRAVEL30',
    promoPercent: 30,
    currency: '$',
    phone: '+1 (800) 123-4567',
    email: 'support@travelworld.com',
    address: '123 TravelWorld Plaza, New York, NY',
  },
  flights: [
    {
      id: 'FL-101',
      airline: 'Air France',
      flightNumber: 'AF-022',
      origin: 'New York (JFK)',
      destination: 'Paris (CDG)',
      date: '2026-12-10',
      time: '06:30 PM - 07:45 AM',
      duration: '7h 15m',
      stops: 'Non-stop',
      cabinClass: 'Economy',
      price: 699,
      discount: 30,
      rating: 4.9,
      occupiedSeats: ['1A', '2C', '3B', '4D', '5A', '5B'],
    },
    {
      id: 'FL-102',
      airline: 'Emirates',
      flightNumber: 'EK-204',
      origin: 'New York (JFK)',
      destination: 'Dubai (DXB)',
      date: '2026-12-12',
      time: '11:20 AM - 08:10 AM',
      duration: '12h 50m',
      stops: 'Non-stop',
      cabinClass: 'Business',
      price: 899,
      discount: 20,
      rating: 4.9,
      occupiedSeats: ['1B', '2A', '3C', '3D', '6E'],
    },
    {
      id: 'FL-103',
      airline: 'Singapore Airlines',
      flightNumber: 'SQ-025',
      origin: 'Los Angeles (LAX)',
      destination: 'Bali (DPS)',
      date: '2026-12-15',
      time: '09:15 PM - 06:40 AM',
      duration: '16h 25m',
      stops: '1 Stop',
      cabinClass: 'Economy',
      price: 799,
      discount: 25,
      rating: 4.8,
      occupiedSeats: ['2B', '4A', '4B', '7C'],
    },
    {
      id: 'FL-104',
      airline: 'Swiss International',
      flightNumber: 'LX-017',
      origin: 'London (LHR)',
      destination: 'Zurich (ZRH)',
      date: '2026-12-14',
      time: '08:40 AM - 11:25 AM',
      duration: '1h 45m',
      stops: 'Non-stop',
      cabinClass: 'Economy',
      price: 289,
      discount: 15,
      rating: 4.7,
      occupiedSeats: ['3A', '5C'],
    },
    {
      id: 'FL-105',
      airline: 'Qatar Airways',
      flightNumber: 'QR-702',
      origin: 'Chicago (ORD)',
      destination: 'Maldives (MLE)',
      date: '2026-12-20',
      time: '07:45 PM - 08:30 PM',
      duration: '18h 45m',
      stops: '1 Stop',
      cabinClass: 'Economy',
      price: 1190,
      discount: 35,
      rating: 4.9,
      occupiedSeats: ['1C', '2D', '4C', '6A'],
    },
    {
      id: 'FL-106',
      airline: 'ANA Airlines',
      flightNumber: 'NH-109',
      origin: 'San Francisco (SFO)',
      destination: 'Tokyo (HND)',
      date: '2026-12-18',
      time: '01:05 PM - 05:20 PM',
      duration: '11h 15m',
      stops: 'Non-stop',
      cabinClass: 'Economy',
      price: 1120,
      discount: 20,
      rating: 4.9,
      occupiedSeats: ['1A', '1D', '3E', '4F'],
    },
  ],
  destinations: [
    {
      id: 'D1',
      name: 'Paris',
      country: 'France',
      price: 489,
      discount: 30,
      rating: 4.8,
      image: DESTINATION_IMAGES.paris,
    },
    {
      id: 'D2',
      name: 'Bali',
      country: 'Indonesia',
      price: 599,
      discount: 25,
      rating: 4.7,
      image: DESTINATION_IMAGES.bali,
    },
    {
      id: 'D3',
      name: 'Dubai',
      country: 'UAE',
      price: 719,
      discount: 20,
      rating: 4.9,
      image: DESTINATION_IMAGES.dubai,
    },
    {
      id: 'D4',
      name: 'Maldives',
      country: 'Indian Ocean',
      price: 774,
      discount: 35,
      rating: 4.9,
      image: DESTINATION_IMAGES.maldives,
    },
    {
      id: 'D5',
      name: 'Zurich',
      country: 'Switzerland',
      price: 246,
      discount: 15,
      rating: 4.8,
      image: DESTINATION_IMAGES.switzerland,
    },
  ],
  deals: [
    {
      id: 'TD1',
      title: 'Swiss Alpine Air Pass',
      subtitle: '5 Days · Round-Trip + Transfers',
      label: 'Best Seller',
      oldPrice: 899,
      price: 629,
      query: 'Zurich',
      image: DESTINATION_IMAGES.switzerland,
    },
    {
      id: 'TD2',
      title: 'Bali Island Escape',
      subtitle: '6 Days · Direct Flight + Resort',
      label: 'Seasonal Offer',
      oldPrice: 799,
      price: 599,
      query: 'Bali',
      image: DESTINATION_IMAGES.bali,
    },
    {
      id: 'TD3',
      title: 'Paris Cultural Getaway',
      subtitle: '4 Days · Non-stop Flight + Hotel',
      label: 'Limited Fare',
      oldPrice: 920,
      price: 645,
      query: 'Paris',
      image: DESTINATION_IMAGES.paris,
    },
  ],
  bookings: [
    {
      pnr: 'TRV842',
      flightId: 'FL-101',
      airline: 'Air France',
      flightNumber: 'AF-022',
      origin: 'New York (JFK)',
      destination: 'Paris (CDG)',
      date: '2026-12-10',
      time: '06:30 PM - 07:45 AM',
      passengerName: 'Sophia Williams',
      passengerEmail: 'sophia.williams@example.com',
      passport: 'US94827104',
      seats: ['3B'],
      passengersCount: 1,
      baggageFee: 0,
      totalPaid: 517,
      status: 'Confirmed',
      createdAt: '2026-11-15',
    },
    {
      pnr: 'TRV519',
      flightId: 'FL-102',
      airline: 'Emirates',
      flightNumber: 'EK-204',
      origin: 'New York (JFK)',
      destination: 'Dubai (DXB)',
      date: '2026-12-12',
      time: '11:20 AM - 08:10 AM',
      passengerName: 'James Anderson',
      passengerEmail: 'james.anderson@example.com',
      passport: 'US71204988',
      seats: ['3C', '3D'],
      passengersCount: 2,
      baggageFee: 35,
      totalPaid: 1530,
      status: 'Confirmed',
      createdAt: '2026-11-16',
    },
  ],
};

export function loadAppState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_APP_STATE);
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      settings: { ...DEFAULT_APP_STATE.settings, ...(parsed.settings || {}) },
      flights: Array.isArray(parsed.flights) ? parsed.flights : structuredClone(DEFAULT_APP_STATE.flights),
      destinations: Array.isArray(parsed.destinations)
        ? parsed.destinations
        : structuredClone(DEFAULT_APP_STATE.destinations),
      deals: Array.isArray(parsed.deals) ? parsed.deals : structuredClone(DEFAULT_APP_STATE.deals),
      bookings: Array.isArray(parsed.bookings) ? parsed.bookings : structuredClone(DEFAULT_APP_STATE.bookings),
    };
  } catch {
    return structuredClone(DEFAULT_APP_STATE);
  }
}

export function saveAppState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors in restricted environments
  }
}

export function getDiscountedFare(flight: { price: number; discount: number }): number {
  return Math.round(flight.price * (1 - (flight.discount || 0) / 100));
}
