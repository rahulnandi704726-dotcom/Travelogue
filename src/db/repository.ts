import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  auditLogs,
  bookings,
  deals,
  destinations,
  flights,
  siteSettings,
  users,
} from './schema.ts';
import { ensureDatabaseSeeded } from './seedData.ts';

export interface SearchFlightsParams {
  from?: string;
  to?: string;
  date?: string;
  stops?: string;
  sort?: 'price-asc' | 'price-desc' | 'rating-desc';
}

export async function getOrCreateUser(
  uid: string,
  email: string,
  name = 'Traveler',
  role?: string
) {
  try {
    const resolvedRole =
      role || (email.toLowerCase() === 'rahulnandi7047@gmail.com' ? 'admin' : 'traveler');
    const result = await db
      .insert(users)
      .values({
        uid,
        email: email.toLowerCase(),
        role: resolvedRole,
        name,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          uid,
          name,
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database error in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function findUserByEmail(email: string) {
  try {
    await ensureDatabaseSeeded();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Database error in findUserByEmail:', error);
    throw new Error('Failed to retrieve user credentials.', { cause: error });
  }
}

export async function createLocalUser(params: {
  email: string;
  passwordHash: string;
  name: string;
}) {
  try {
    await ensureDatabaseSeeded();
    const uid = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const role =
      params.email.toLowerCase() === 'rahulnandi7047@gmail.com' ? 'admin' : 'traveler';
    const inserted = await db
      .insert(users)
      .values({
        uid,
        email: params.email.toLowerCase(),
        passwordHash: params.passwordHash,
        role,
        name: params.name,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database error in createLocalUser:', error);
    throw new Error('Unable to register user account.', { cause: error });
  }
}

export async function getStorefrontBootstrap() {
  try {
    await ensureDatabaseSeeded();
    const [settingsRow] = await db.select().from(siteSettings).limit(1);
    const destRows = await db.select().from(destinations);
    const dealRows = await db.select().from(deals);
    const [{ totalFlights }] = await db.select({ totalFlights: count() }).from(flights);

    return {
      settings: settingsRow,
      destinations: destRows,
      deals: dealRows,
      totalFlights,
    };
  } catch (error) {
    console.error('Database error in getStorefrontBootstrap:', error);
    throw new Error('Failed to load storefront data.', { cause: error });
  }
}

export async function searchFlightsRandomized(params: SearchFlightsParams) {
  try {
    await ensureDatabaseSeeded();
    const conditions = [];

    if (params.from && params.from.trim()) {
      conditions.push(ilike(flights.origin, `%${params.from.trim()}%`));
    }
    if (params.to && params.to.trim()) {
      conditions.push(ilike(flights.destination, `%${params.to.trim()}%`));
    }
    if (params.date && params.date.trim()) {
      conditions.push(eq(flights.date, params.date.trim()));
    }
    if (params.stops && params.stops !== 'all') {
      conditions.push(eq(flights.stops, params.stops));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ totalMatched }] = await db
      .select({ totalMatched: count() })
      .from(flights)
      .where(whereClause);

    // Random number of flights per request, capped strictly at max 10
    const minCount = totalMatched >= 3 ? 3 : 1;
    const maxCap = Math.min(10, Math.max(1, totalMatched));
    const randomLimit =
      totalMatched === 0
        ? 0
        : Math.floor(Math.random() * (maxCap - Math.min(minCount, maxCap) + 1)) +
          Math.min(minCount, maxCap);

    const sampled =
      randomLimit === 0
        ? []
        : await db
            .select()
            .from(flights)
            .where(whereClause)
            .orderBy(sql`RANDOM()`)
            .limit(randomLimit);

    const sortMode = params.sort || 'price-asc';
    const netPrice = (f: typeof sampled[number]) =>
      Math.round(f.price * (1 - (f.discount || 0) / 100));

    sampled.sort((a, b) => {
      if (sortMode === 'price-asc') return netPrice(a) - netPrice(b);
      if (sortMode === 'price-desc') return netPrice(b) - netPrice(a);
      return Number(b.rating) - Number(a.rating);
    });

    return {
      flights: sampled,
      totalMatched,
      returnedCount: sampled.length,
      maxLimit: 10,
    };
  } catch (error) {
    console.error('Database error in searchFlightsRandomized:', error);
    throw new Error('Failed to search flights.', { cause: error });
  }
}

export async function listAllFlightsAdmin() {
  try {
    await ensureDatabaseSeeded();
    return await db.select().from(flights).orderBy(desc(flights.createdAt));
  } catch (error) {
    console.error('Database error in listAllFlightsAdmin:', error);
    throw new Error('Failed to load flight inventory.', { cause: error });
  }
}

export async function upsertFlight(input: {
  id: string;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  date: string;
  time: string;
  duration: string;
  stops: string;
  cabinClass: string;
  price: number;
  discount: number;
  rating: string;
  occupiedSeats: string[];
}) {
  try {
    await ensureDatabaseSeeded();
    const res = await db
      .insert(flights)
      .values(input)
      .onConflictDoUpdate({
        target: flights.id,
        set: {
          airline: input.airline,
          flightNumber: input.flightNumber,
          origin: input.origin,
          destination: input.destination,
          date: input.date,
          time: input.time,
          duration: input.duration,
          stops: input.stops,
          cabinClass: input.cabinClass,
          price: input.price,
          discount: input.discount,
          rating: input.rating,
          occupiedSeats: input.occupiedSeats,
        },
      })
      .returning();
    return res[0];
  } catch (error) {
    console.error('Database error in upsertFlight:', error);
    throw new Error('Failed to save flight listing.', { cause: error });
  }
}

export async function deleteFlightById(flightId: string) {
  try {
    await db.delete(flights).where(eq(flights.id, flightId));
  } catch (error) {
    console.error('Database error in deleteFlightById:', error);
    throw new Error('Failed to delete flight listing.', { cause: error });
  }
}

export async function addDestinationItem(dest: {
  id: string;
  name: string;
  country: string;
  price: number;
  discount: number;
  rating: string;
  image: string;
}) {
  try {
    const res = await db.insert(destinations).values(dest).returning();
    return res[0];
  } catch (error) {
    console.error('Database error in addDestinationItem:', error);
    throw new Error('Failed to add destination.', { cause: error });
  }
}

export async function deleteDestinationItem(id: string) {
  try {
    await db.delete(destinations).where(eq(destinations.id, id));
  } catch (error) {
    console.error('Database error in deleteDestinationItem:', error);
    throw new Error('Failed to delete destination.', { cause: error });
  }
}

export async function updateSiteSettingsRow(input: {
  brandName: string;
  tagline: string;
  announcementText: string;
  heroHeadline: string;
  heroSubheadline: string;
  promoCode: string;
  promoPercent: number;
  currency: string;
  phone: string;
  email: string;
  address: string;
}) {
  try {
    const existing = await db.select().from(siteSettings).limit(1);
    if (existing.length === 0) {
      const inserted = await db.insert(siteSettings).values(input).returning();
      return inserted[0];
    }
    const updated = await db
      .update(siteSettings)
      .set(input)
      .where(eq(siteSettings.id, existing[0].id))
      .returning();
    return updated[0];
  } catch (error) {
    console.error('Database error in updateSiteSettingsRow:', error);
    throw new Error('Failed to update site settings.', { cause: error });
  }
}

export async function createBookingTransaction(input: {
  flightId: string;
  userId: number;
  passengerName: string;
  passengerEmail: string;
  passport: string;
  seats: string[];
  passengersCount: number;
  baggageFee: number;
  totalPaid: number;
}) {
  try {
    return await db.transaction(async (tx) => {
      const [flight] = await tx
        .select()
        .from(flights)
        .where(eq(flights.id, input.flightId))
        .limit(1);

      if (!flight) {
        throw new Error('Selected flight was not found.');
      }

      const currentOccupied = flight.occupiedSeats || [];
      const conflict = input.seats.find((s) => currentOccupied.includes(s));
      if (conflict) {
        throw new Error(`Seat ${conflict} is already reserved. Please select another seat.`);
      }

      const nextOccupied = Array.from(new Set([...currentOccupied, ...input.seats]));
      await tx
        .update(flights)
        .set({ occupiedSeats: nextOccupied })
        .where(eq(flights.id, flight.id));

      const pnr = `TRV${Math.floor(100 + Math.random() * 899)}${String.fromCharCode(
        65 + Math.floor(Math.random() * 26)
      )}`;

      const [created] = await tx
        .insert(bookings)
        .values({
          pnr,
          flightId: flight.id,
          userId: input.userId,
          airline: flight.airline,
          flightNumber: flight.flightNumber,
          origin: flight.origin,
          destination: flight.destination,
          date: flight.date,
          time: flight.time,
          passengerName: input.passengerName,
          passengerEmail: input.passengerEmail,
          passport: input.passport,
          seats: input.seats,
          passengersCount: input.passengersCount,
          baggageFee: input.baggageFee,
          totalPaid: input.totalPaid,
          status: 'Confirmed',
          createdAt: new Date().toISOString().slice(0, 10),
        })
        .returning();

      return created;
    });
  } catch (error: any) {
    console.error('Database error in createBookingTransaction:', error);
    throw new Error(error?.message || 'Failed to complete reservation.', { cause: error });
  }
}

export async function listBookingsForUser(userId: number, email: string, isAdmin: boolean) {
  try {
    await ensureDatabaseSeeded();
    if (isAdmin) {
      return await db.select().from(bookings).orderBy(desc(bookings.createdAt));
    }
    return await db
      .select()
      .from(bookings)
      .where(or(eq(bookings.userId, userId), eq(bookings.passengerEmail, email)))
      .orderBy(desc(bookings.createdAt));
  } catch (error) {
    console.error('Database error in listBookingsForUser:', error);
    throw new Error('Failed to load reservations.', { cause: error });
  }
}

export async function findBookingByPnr(pnr: string) {
  try {
    await ensureDatabaseSeeded();
    const rows = await db
      .select()
      .from(bookings)
      .where(eq(bookings.pnr, pnr.trim().toUpperCase()))
      .limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Database error in findBookingByPnr:', error);
    throw new Error('Failed to look up PNR.', { cause: error });
  }
}

export async function setBookingStatus(
  pnr: string,
  nextStatus: 'Confirmed' | 'Cancelled',
  requesterId: number,
  isAdmin: boolean
) {
  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.pnr, pnr))
        .limit(1);
      if (!existing) {
        throw new Error('Booking not found.');
      }
      if (!isAdmin && existing.userId !== requesterId) {
        throw new Error('Not authorized to modify this reservation.');
      }

      const [flight] = await tx
        .select()
        .from(flights)
        .where(eq(flights.id, existing.flightId))
        .limit(1);

      if (flight) {
        const currentOccupied = flight.occupiedSeats || [];
        const updatedOccupied =
          nextStatus === 'Cancelled'
            ? currentOccupied.filter((s) => !existing.seats.includes(s))
            : Array.from(new Set([...currentOccupied, ...existing.seats]));

        await tx
          .update(flights)
          .set({ occupiedSeats: updatedOccupied })
          .where(eq(flights.id, flight.id));
      }

      const [updated] = await tx
        .update(bookings)
        .set({ status: nextStatus })
        .where(eq(bookings.pnr, pnr))
        .returning();

      return updated;
    });
  } catch (error: any) {
    console.error('Database error in setBookingStatus:', error);
    throw new Error(error?.message || 'Failed to update reservation status.', { cause: error });
  }
}

export async function writeAuditLog(entry: {
  eventType: string;
  actor: string;
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number;
  details: string;
}) {
  try {
    await db.insert(auditLogs).values(entry);
  } catch (error) {
    console.error('Audit log insert failed:', error);
  }
}

export async function getRecentAuditLogs(limit = 100) {
  try {
    return await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.id))
      .limit(limit);
  } catch (error) {
    console.error('Database error in getRecentAuditLogs:', error);
    throw new Error('Failed to load entry and exit logs.', { cause: error });
  }
}
