import { relations } from 'drizzle-orm';
import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  role: text('role').notNull().default('traveler'),
  name: text('name').notNull().default('Traveler'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const flights = pgTable('flights', {
  id: text('id').primaryKey(),
  airline: text('airline').notNull(),
  flightNumber: text('flight_number').notNull(),
  origin: text('origin').notNull(),
  destination: text('destination').notNull(),
  date: text('date').notNull(),
  time: text('time').notNull(),
  duration: text('duration').notNull(),
  stops: text('stops').notNull(),
  cabinClass: text('cabin_class').notNull().default('Economy'),
  price: integer('price').notNull(),
  discount: integer('discount').notNull().default(0),
  rating: text('rating').notNull().default('4.8'),
  occupiedSeats: jsonb('occupied_seats').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const destinations = pgTable('destinations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  country: text('country').notNull(),
  price: integer('price').notNull(),
  discount: integer('discount').notNull().default(0),
  rating: text('rating').notNull().default('4.8'),
  image: text('image').notNull(),
});

export const deals = pgTable('deals', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  subtitle: text('subtitle').notNull(),
  label: text('label').notNull(),
  oldPrice: integer('old_price').notNull(),
  price: integer('price').notNull(),
  query: text('query').notNull(),
  image: text('image').notNull(),
});

export const bookings = pgTable('bookings', {
  pnr: text('pnr').primaryKey(),
  flightId: text('flight_id').notNull(),
  userId: integer('user_id').references(() => users.id),
  airline: text('airline').notNull(),
  flightNumber: text('flight_number').notNull(),
  origin: text('origin').notNull(),
  destination: text('destination').notNull(),
  date: text('date').notNull(),
  time: text('time').notNull(),
  passengerName: text('passenger_name').notNull(),
  passengerEmail: text('passenger_email').notNull(),
  passport: text('passport').notNull(),
  seats: jsonb('seats').$type<string[]>().notNull(),
  passengersCount: integer('passengers_count').notNull(),
  baggageFee: integer('baggage_fee').notNull().default(0),
  totalPaid: integer('total_paid').notNull(),
  status: text('status').notNull().default('Confirmed'),
  createdAt: text('created_at').notNull(),
});

export const siteSettings = pgTable('site_settings', {
  id: serial('id').primaryKey(),
  brandName: text('brand_name').notNull(),
  tagline: text('tagline').notNull(),
  announcementText: text('announcement_text').notNull(),
  heroHeadline: text('hero_headline').notNull(),
  heroSubheadline: text('hero_subheadline').notNull(),
  promoCode: text('promo_code').notNull(),
  promoPercent: integer('promo_percent').notNull(),
  currency: text('currency').notNull().default('$'),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
  address: text('address').notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  eventType: text('event_type').notNull(),
  actor: text('actor').notNull(),
  endpoint: text('endpoint').notNull(),
  method: text('method').notNull(),
  statusCode: integer('status_code').notNull(),
  durationMs: integer('duration_ms').notNull(),
  details: text('details').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  user: one(users, {
    fields: [bookings.userId],
    references: [users.id],
  }),
}));
