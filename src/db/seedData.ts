import bcrypt from 'bcryptjs';
import { count } from 'drizzle-orm';
import { db } from './index.ts';
import {
  bookings,
  deals,
  destinations,
  flights,
  siteSettings,
  users,
} from './schema.ts';

const AIRLINES = [
  { name: 'Air France', code: 'AF' },
  { name: 'Emirates', code: 'EK' },
  { name: 'Singapore Airlines', code: 'SQ' },
  { name: 'Lufthansa', code: 'LH' },
  { name: 'British Airways', code: 'BA' },
  { name: 'Qatar Airways', code: 'QR' },
  { name: 'ANA Airlines', code: 'NH' },
  { name: 'Swiss International', code: 'LX' },
  { name: 'Delta Air Lines', code: 'DL' },
  { name: 'United Airlines', code: 'UA' },
  { name: 'Cathay Pacific', code: 'CX' },
  { name: 'KLM Royal Dutch', code: 'KL' },
  { name: 'Turkish Airlines', code: 'TK' },
  { name: 'Etihad Airways', code: 'EY' },
  { name: 'Qantas', code: 'QF' },
  { name: 'Japan Airlines', code: 'JL' },
  { name: 'Air Canada', code: 'AC' },
  { name: 'Iberia', code: 'IB' },
  { name: 'Air India', code: 'AI' },
  { name: 'Korean Air', code: 'KE' },
];

const AIRPORTS = [
  'New York (JFK)',
  'Paris (CDG)',
  'Dubai (DXB)',
  'Bali (DPS)',
  'Zurich (ZRH)',
  'Maldives (MLE)',
  'Tokyo (HND)',
  'London (LHR)',
  'Singapore (SIN)',
  'Frankfurt (FRA)',
  'Amsterdam (AMS)',
  'Istanbul (IST)',
  'Doha (DOH)',
  'Sydney (SYD)',
  'Toronto (YYZ)',
  'Los Angeles (LAX)',
  'San Francisco (SFO)',
  'Chicago (ORD)',
  'Delhi (DEL)',
  'Seoul (ICN)',
];

const TIME_SLOTS = [
  { time: '06:15 AM - 02:30 PM', duration: '8h 15m' },
  { time: '08:40 AM - 11:25 AM', duration: '1h 45m' },
  { time: '11:20 AM - 08:10 PM', duration: '12h 50m' },
  { time: '01:05 PM - 05:20 PM', duration: '11h 15m' },
  { time: '03:45 PM - 10:15 PM', duration: '6h 30m' },
  { time: '06:30 PM - 07:45 AM', duration: '7h 15m' },
  { time: '09:15 PM - 06:40 AM', duration: '15h 25m' },
  { time: '10:50 PM - 09:05 AM', duration: '10h 15m' },
];

const SEAT_POOL = [
  '1A', '1B', '1C', '1D', '2A', '2B', '2C', '2D',
  '3A', '3B', '3C', '3D', '3E', '4A', '4B', '4C', '4D',
  '5A', '5B', '5C', '6A', '6E', '7C', '8D',
];

export function generatePreloadedFlights(total = 210) {
  const generated = [];

  for (let i = 0; i < total; i++) {
    const airline = AIRLINES[i % AIRLINES.length];
    const originIdx = i % AIRPORTS.length;
    const destOffset = 1 + (Math.floor(i / AIRPORTS.length) % (AIRPORTS.length - 1));
    const destIdx = (originIdx + destOffset) % AIRPORTS.length;
    const origin = AIRPORTS[originIdx];
    const destination = AIRPORTS[destIdx];
    const slot = TIME_SLOTS[i % TIME_SLOTS.length];
    const day = 10 + (i % 19); // 2026-12-10 to 2026-12-28
    const date = `2026-12-${String(day).padStart(2, '0')}`;
    const stops = i % 3 === 0 ? '1 Stop' : 'Non-stop';
    const cabinClass = i % 7 === 0 ? 'Business' : i % 15 === 0 ? 'First' : 'Economy';
    const basePrice =
      cabinClass === 'First'
        ? 1450 + ((i * 37) % 650)
        : cabinClass === 'Business'
        ? 890 + ((i * 29) % 480)
        : 240 + ((i * 23) % 720);
    const discountOptions = [0, 10, 15, 20, 25, 30, 35];
    const discount = discountOptions[i % discountOptions.length];
    const rating = (4.5 + ((i % 5) * 0.1)).toFixed(1);
    const occupiedCount = 2 + (i % 6);
    const occupiedSeats: string[] = [];
    for (let s = 0; s < occupiedCount; s++) {
      occupiedSeats.push(SEAT_POOL[(i + s * 3) % SEAT_POOL.length]);
    }

    generated.push({
      id: `FL-${1001 + i}`,
      airline: airline.name,
      flightNumber: `${airline.code}-${100 + ((i * 7) % 899)}`,
      origin,
      destination,
      date,
      time: slot.time,
      duration: slot.duration,
      stops,
      cabinClass,
      price: basePrice,
      discount,
      rating,
      occupiedSeats: Array.from(new Set(occupiedSeats)),
    });
  }

  return generated;
}

export const INITIAL_DESTINATIONS = [
  {
    id: 'D1',
    name: 'Paris',
    country: 'France',
    price: 489,
    discount: 30,
    rating: '4.8',
    image: '/src/assets/images/dest_paris_1794926293928.jpg',
  },
  {
    id: 'D2',
    name: 'Bali',
    country: 'Indonesia',
    price: 599,
    discount: 25,
    rating: '4.7',
    image: '/src/assets/images/dest_bali_1794926293837.jpg',
  },
  {
    id: 'D3',
    name: 'Dubai',
    country: 'UAE',
    price: 719,
    discount: 20,
    rating: '4.9',
    image: '/src/assets/images/dest_dubai_1794926294111.jpg',
  },
  {
    id: 'D4',
    name: 'Maldives',
    country: 'Indian Ocean',
    price: 774,
    discount: 35,
    rating: '4.9',
    image: '/src/assets/images/dest_maldives_1794926293932.jpg',
  },
  {
    id: 'D5',
    name: 'Zurich',
    country: 'Switzerland',
    price: 246,
    discount: 15,
    rating: '4.8',
    image: '/src/assets/images/dest_switzerland_1794926294611.jpg',
  },
];

export const INITIAL_DEALS = [
  {
    id: 'TD1',
    title: 'Swiss Alpine Air Pass',
    subtitle: '5 Days · Round-Trip + Transfers',
    label: 'Best Seller',
    oldPrice: 899,
    price: 629,
    query: 'Zurich',
    image: '/src/assets/images/dest_switzerland_1794926294611.jpg',
  },
  {
    id: 'TD2',
    title: 'Bali Island Escape',
    subtitle: '6 Days · Direct Flight + Resort',
    label: 'Seasonal Offer',
    oldPrice: 799,
    price: 599,
    query: 'Bali',
    image: '/src/assets/images/dest_bali_1794926293837.jpg',
  },
  {
    id: 'TD3',
    title: 'Paris Cultural Getaway',
    subtitle: '4 Days · Non-stop Flight + Hotel',
    label: 'Limited Fare',
    oldPrice: 920,
    price: 645,
    query: 'Paris',
    image: '/src/assets/images/dest_paris_1794926293928.jpg',
  },
];

export const INITIAL_SETTINGS = {
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
};

let seedPromise: Promise<void> | null = null;

export async function ensureDatabaseSeeded(forceReset = false): Promise<void> {
  if (forceReset) {
    seedPromise = null;
  }
  if (!seedPromise) {
    seedPromise = runSeed(forceReset).catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

async function runSeed(forceReset: boolean): Promise<void> {
  const [{ totalFlights }] = await db
    .select({ totalFlights: count() })
    .from(flights);

  if (totalFlights >= 100 && !forceReset) {
    // Ensure preloaded admin user exists even if flights were seeded
    await ensurePreloadedAdminUser();
    return;
  }

  if (forceReset) {
    await db.delete(bookings);
    await db.delete(flights);
    await db.delete(destinations);
    await db.delete(deals);
    await db.delete(siteSettings);
  }

  const adminUser = await ensurePreloadedAdminUser();

  const flightRows = generatePreloadedFlights(210);
  // Insert in chunks of 50 to keep queries fast and clean
  for (let i = 0; i < flightRows.length; i += 50) {
    await db
      .insert(flights)
      .values(flightRows.slice(i, i + 50))
      .onConflictDoNothing();
  }

  await db
    .insert(destinations)
    .values(INITIAL_DESTINATIONS)
    .onConflictDoNothing();

  await db.insert(deals).values(INITIAL_DEALS).onConflictDoNothing();

  const [{ settingsCount }] = await db
    .select({ settingsCount: count() })
    .from(siteSettings);
  if (settingsCount === 0) {
    await db.insert(siteSettings).values(INITIAL_SETTINGS);
  }

  const firstFlight = flightRows[0];
  const secondFlight = flightRows[1];

  await db
    .insert(bookings)
    .values([
      {
        pnr: 'TRV842',
        flightId: firstFlight.id,
        userId: adminUser.id,
        airline: firstFlight.airline,
        flightNumber: firstFlight.flightNumber,
        origin: firstFlight.origin,
        destination: firstFlight.destination,
        date: firstFlight.date,
        time: firstFlight.time,
        passengerName: 'Rahul Nandi',
        passengerEmail: 'rahulnandi7047@gmail.com',
        passport: 'IN94827104',
        seats: ['3B'],
        passengersCount: 1,
        baggageFee: 0,
        totalPaid: Math.round(firstFlight.price * (1 - firstFlight.discount / 100)) + 28,
        status: 'Confirmed',
        createdAt: '2026-11-15',
      },
      {
        pnr: 'TRV519',
        flightId: secondFlight.id,
        userId: adminUser.id,
        airline: secondFlight.airline,
        flightNumber: secondFlight.flightNumber,
        origin: secondFlight.origin,
        destination: secondFlight.destination,
        date: secondFlight.date,
        time: secondFlight.time,
        passengerName: 'Sophia Williams',
        passengerEmail: 'sophia.williams@example.com',
        passport: 'US71204988',
        seats: ['4A', '4B'],
        passengersCount: 2,
        baggageFee: 35,
        totalPaid:
          Math.round(secondFlight.price * (1 - secondFlight.discount / 100)) * 2 + 35 + 56,
        status: 'Confirmed',
        createdAt: '2026-11-16',
      },
    ])
    .onConflictDoNothing();
}

export async function ensurePreloadedAdminUser() {
  const passwordHash = await bcrypt.hash('Rahul@@2006', 10);
  const result = await db
    .insert(users)
    .values({
      uid: 'local-admin-rahulnandi7047',
      email: 'rahulnandi7047@gmail.com',
      passwordHash,
      role: 'admin',
      name: 'Rahul Nandi',
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        role: 'admin',
        passwordHash,
      },
    })
    .returning();

  return result[0];
}
