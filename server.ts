import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcryptjs';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  addDestinationItem,
  createBookingTransaction,
  createLocalUser,
  deleteDestinationItem,
  deleteFlightById,
  findBookingByPnr,
  findUserByEmail,
  getOrCreateUser,
  getRecentAuditLogs,
  getStorefrontBootstrap,
  listAllFlightsAdmin,
  listBookingsForUser,
  searchFlightsRandomized,
  setBookingStatus,
  updateSiteSettingsRow,
  upsertFlight,
  writeAuditLog,
} from './src/db/repository.ts';
import { ensureDatabaseSeeded } from './src/db/seedData.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';
import type { AuthRequest } from './src/middleware/auth.ts';
import {
  optionalAuth,
  requireAdmin,
  requireAuth,
  signSessionToken,
} from './src/middleware/auth.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function maskApiKey(key?: string): string {
  if (!key || key.length < 10) return 'Not Configured';
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Entry & Exit Logging Middleware for all /api routes
  app.use('/api', optionalAuth, (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.path === '/admin/logs') {
      return next();
    }
    const startTime = Date.now();
    const actor = req.user?.email || 'anonymous';
    const endpoint = `/api${req.path}`;
    const method = req.method;

    console.log(`[ENTRY] ${method} ${endpoint} actor=${actor}`);
    void writeAuditLog({
      eventType: 'ENTRY',
      actor,
      endpoint,
      method,
      statusCode: 0,
      durationMs: 0,
      details: `Request entered ${method} ${endpoint}`,
    });

    res.on('finish', () => {
      const durationMs = Date.now() - startTime;
      console.log(
        `[EXIT] ${method} ${endpoint} status=${res.statusCode} duration=${durationMs}ms actor=${req.user?.email || actor}`
      );
      void writeAuditLog({
        eventType: 'EXIT',
        actor: req.user?.email || actor,
        endpoint,
        method,
        statusCode: res.statusCode,
        durationMs,
        details: `Completed with HTTP ${res.statusCode} in ${durationMs}ms`,
      });
    });

    next();
  });

  // Health Check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Storefront Bootstrap (Settings, Destinations, Deals, Total Flight Count)
  app.get('/api/bootstrap', async (_req: Request, res: Response) => {
    try {
      const data = await getStorefrontBootstrap();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load storefront data.' });
    }
  });

  // Randomized Flight Search (Capped at Max 10 per Request from 200+ Preloaded Flights)
  app.get('/api/flights/search', async (req: Request, res: Response) => {
    try {
      const from = typeof req.query.from === 'string' ? req.query.from : '';
      const to = typeof req.query.to === 'string' ? req.query.to : '';
      const date = typeof req.query.date === 'string' ? req.query.date : '';
      const stops = typeof req.query.stops === 'string' ? req.query.stops : 'all';
      const sortRaw = typeof req.query.sort === 'string' ? req.query.sort : 'price-asc';
      const sort =
        sortRaw === 'price-desc' || sortRaw === 'rating-desc' ? sortRaw : 'price-asc';

      const result = await searchFlightsRandomized({ from, to, date, stops, sort });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to search flights.' });
    }
  });

  // Auth: Email + Password Login (preloaded rahulnandi7047@gmail.com / Rahul@@2006)
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const rawEmail = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');

      if (!rawEmail || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const normalizedEmail =
        rawEmail === 'rahulnandi' ? 'rahulnandi7047@gmail.com' : rawEmail;

      const user = await findUserByEmail(normalizedEmail);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const authUser = {
        id: user.id,
        uid: user.uid,
        email: user.email,
        role: user.role,
        name: user.name,
      };
      const token = signSessionToken(authUser);

      res.cookie('tw_session', token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });

      res.json({ token, user: authUser });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Login failed.' });
    }
  });

  // Auth: Register New Traveler Account
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const name = String(req.body?.name || '').trim() || 'Traveler';
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');

      if (!email || !email.includes('@') || password.length < 6) {
        return res
          .status(400)
          .json({ error: 'Valid email and password (min 6 characters) are required.' });
      }

      const existing = await findUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const created = await createLocalUser({ email, passwordHash, name });
      const authUser = {
        id: created.id,
        uid: created.uid,
        email: created.email,
        role: created.role,
        name: created.name,
      };
      const token = signSessionToken(authUser);

      res.cookie('tw_session', token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });

      res.status(201).json({ token, user: authUser });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Registration failed.' });
    }
  });

  // Auth: Verify Firebase Google Sign-In Token and Sync to Cloud SQL
  app.post('/api/auth/firebase', async (req: Request, res: Response) => {
    try {
      const header = req.headers.authorization || '';
      const idToken = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
      if (!idToken) {
        return res.status(401).json({ error: 'Missing Firebase ID token.' });
      }

      const decoded = await adminAuth.verifyIdToken(idToken);
      const email = (decoded.email || `${decoded.uid}@firebase.local`).toLowerCase();
      const dbUser = await getOrCreateUser(
        decoded.uid,
        email,
        decoded.name || email.split('@')[0]
      );

      res.json({
        user: {
          id: dbUser.id,
          uid: dbUser.uid,
          email: dbUser.email,
          role: dbUser.role,
          name: dbUser.name,
        },
      });
    } catch (error: any) {
      res.status(401).json({ error: error?.message || 'Firebase authentication failed.' });
    }
  });

  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    res.clearCookie('tw_session');
    res.json({ ok: true });
  });

  app.get('/api/auth/me', optionalAuth, (req: AuthRequest, res: Response) => {
    res.json({ user: req.user || null });
  });

  // Bookings (Protected by requireAuth)
  app.get('/api/bookings', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const isAdmin =
        user.role === 'admin' || user.email.toLowerCase() === 'rahulnandi7047@gmail.com';
      const rows = await listBookingsForUser(user.id, user.email, isAdmin);
      res.json({ bookings: rows });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to fetch bookings.' });
    }
  });

  app.get('/api/bookings/pnr/:pnr', async (req: Request, res: Response) => {
    try {
      const booking = await findBookingByPnr(String(req.params.pnr || ''));
      if (!booking) {
        return res.status(404).json({ error: 'Booking PNR not found.' });
      }
      res.json({ booking });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to lookup PNR.' });
    }
  });

  app.post('/api/bookings', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const {
        flightId,
        passengerName,
        passengerEmail,
        passport,
        seats,
        passengersCount,
        baggageFee,
        totalPaid,
      } = req.body || {};

      if (
        !flightId ||
        !passengerName ||
        !passengerEmail ||
        !passport ||
        !Array.isArray(seats) ||
        seats.length === 0
      ) {
        return res.status(400).json({ error: 'Missing required booking details or seat selection.' });
      }

      const booking = await createBookingTransaction({
        flightId: String(flightId),
        userId: user.id,
        passengerName: String(passengerName),
        passengerEmail: String(passengerEmail),
        passport: String(passport).toUpperCase(),
        seats: seats.map(String),
        passengersCount: Number(passengersCount || seats.length),
        baggageFee: Number(baggageFee || 0),
        totalPaid: Number(totalPaid || 0),
      });

      res.status(201).json({ booking });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Failed to create booking.' });
    }
  });

  app.patch('/api/bookings/:pnr/cancel', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const isAdmin =
        user.role === 'admin' || user.email.toLowerCase() === 'rahulnandi7047@gmail.com';
      const updated = await setBookingStatus(
        String(req.params.pnr || ''),
        'Cancelled',
        user.id,
        isAdmin
      );
      res.json({ booking: updated });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Failed to cancel booking.' });
    }
  });

  // NVIDIA API Connection Check & Route Advisory
  app.get(
    '/api/nvidia/check',
    requireAuth,
    requireAdmin,
    async (req: AuthRequest, res: Response) => {
      const apiKey = process.env.NVIDIA_API_KEY;
      const startTime = Date.now();
      const actor = req.user?.email || 'admin';

      void writeAuditLog({
        eventType: 'NVIDIA_CHECK',
        actor,
        endpoint: '/api/nvidia/check',
        method: 'GET',
        statusCode: 0,
        durationMs: 0,
        details: `Initiating NVIDIA API connection verification (${maskApiKey(apiKey)})`,
      });

      if (!apiKey) {
        return res.status(503).json({
          connected: false,
          error: 'NVIDIA_API_KEY is not configured in server environment.',
          maskedKey: 'Not Configured',
        });
      }

      try {
        const response = await fetch('https://integrate.api.nvidia.com/v1/models', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
        });

        const latencyMs = Date.now() - startTime;
        if (!response.ok) {
          const text = await response.text();
          void writeAuditLog({
            eventType: 'NVIDIA_CHECK',
            actor,
            endpoint: '/api/nvidia/check',
            method: 'GET',
            statusCode: response.status,
            durationMs: latencyMs,
            details: `NVIDIA API check returned HTTP ${response.status}`,
          });
          return res.status(502).json({
            connected: false,
            statusCode: response.status,
            latencyMs,
            maskedKey: maskApiKey(apiKey),
            error: text.slice(0, 200) || `HTTP ${response.status}`,
          });
        }

        const json = (await response.json()) as { data?: Array<{ id: string }> };
        const models = Array.isArray(json?.data) ? json.data : [];

        void writeAuditLog({
          eventType: 'NVIDIA_CHECK',
          actor,
          endpoint: '/api/nvidia/check',
          method: 'GET',
          statusCode: 200,
          durationMs: latencyMs,
          details: `NVIDIA API connected successfully (${models.length} models accessible)`,
        });

        return res.json({
          connected: true,
          statusCode: 200,
          latencyMs,
          modelsCount: models.length,
          sampleModels: models.slice(0, 5).map((m) => m.id),
          maskedKey: maskApiKey(apiKey),
        });
      } catch (err: any) {
        const latencyMs = Date.now() - startTime;
        void writeAuditLog({
          eventType: 'NVIDIA_CHECK',
          actor,
          endpoint: '/api/nvidia/check',
          method: 'GET',
          statusCode: 502,
          durationMs: latencyMs,
          details: `NVIDIA API network error: ${err?.message || 'unknown'}`,
        });
        return res.status(502).json({
          connected: false,
          latencyMs,
          maskedKey: maskApiKey(apiKey),
          error: err?.message || 'Network failure connecting to NVIDIA API.',
        });
      }
    }
  );

  app.post('/api/flights/ai-brief', optionalAuth, async (req: AuthRequest, res: Response) => {
    const apiKey = process.env.NVIDIA_API_KEY;
    const { from, to, flights: sampleFlights } = req.body || {};
    const actor = req.user?.email || 'traveler';
    const startTime = Date.now();

    if (!apiKey) {
      return res.status(503).json({ error: 'NVIDIA API key is not configured.' });
    }

    const summaryLines = Array.isArray(sampleFlights)
      ? sampleFlights.slice(0, 5).map(
          (f: any) =>
            `${f.airline} ${f.flightNumber}: ${f.origin} -> ${f.destination} (${f.duration}, ${f.stops}, $${f.price})`
        )
      : [];

    try {
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemma-3-12b-it',
          messages: [
            {
              role: 'user',
              content: `You are an airline fare analyst for TravelWorld. Summarize the best value flight option, layover trade-off, and baggage tip in 3 concise sentences.\nRoute query: ${from || 'Any origin'} to ${to || 'Any destination'}.\nFlights:\n${summaryLines.join('\n')}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 180,
        }),
      });

      const durationMs = Date.now() - startTime;
      if (!response.ok) {
        const errBody = await response.text();
        void writeAuditLog({
          eventType: 'NVIDIA_BRIEF',
          actor,
          endpoint: '/api/flights/ai-brief',
          method: 'POST',
          statusCode: response.status,
          durationMs,
          details: `NVIDIA brief HTTP ${response.status}: ${errBody.slice(0, 140)}`,
        });
        return res.status(502).json({ error: `NVIDIA API error HTTP ${response.status}` });
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const brief =
        data?.choices?.[0]?.message?.content?.trim() ||
        'Compare non-stop schedules with discounted 1-stop fares to balance total transit time and savings.';

      void writeAuditLog({
        eventType: 'NVIDIA_BRIEF',
        actor,
        endpoint: '/api/flights/ai-brief',
        method: 'POST',
        statusCode: 200,
        durationMs,
        details: `Generated route brief for ${from || 'Any'} -> ${to || 'Any'}`,
      });

      res.json({ brief, latencyMs: durationMs });
    } catch (error: any) {
      res.status(502).json({ error: error?.message || 'Failed to generate route brief.' });
    }
  });

  // Admin Endpoints (Protected by requireAuth + requireAdmin)
  app.get('/api/admin/flights', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
    try {
      const rows = await listAllFlightsAdmin();
      res.json({ flights: rows });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load flights.' });
    }
  });

  app.post('/api/admin/flights', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const flight = await upsertFlight({
        id: String(body.id || `FL-${Date.now()}`),
        airline: String(body.airline),
        flightNumber: String(body.flightNumber).toUpperCase(),
        origin: String(body.origin),
        destination: String(body.destination),
        date: String(body.date),
        time: String(body.time),
        duration: String(body.duration),
        stops: String(body.stops || 'Non-stop'),
        cabinClass: String(body.cabinClass || 'Economy'),
        price: Number(body.price),
        discount: Number(body.discount || 0),
        rating: String(body.rating || '4.8'),
        occupiedSeats: Array.isArray(body.occupiedSeats) ? body.occupiedSeats : [],
      });
      res.json({ flight });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Failed to save flight.' });
    }
  });

  app.delete(
    '/api/admin/flights/:id',
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        await deleteFlightById(String(req.params.id));
        res.json({ ok: true });
      } catch (error: any) {
        res.status(500).json({ error: error?.message || 'Failed to delete flight.' });
      }
    }
  );

  app.post(
    '/api/admin/destinations',
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const body = req.body || {};
        const dest = await addDestinationItem({
          id: String(body.id || `D-${Date.now()}`),
          name: String(body.name),
          country: String(body.country),
          price: Number(body.price),
          discount: Number(body.discount || 0),
          rating: String(body.rating || '4.8'),
          image: String(body.image),
        });
        res.status(201).json({ destination: dest });
      } catch (error: any) {
        res.status(400).json({ error: error?.message || 'Failed to add destination.' });
      }
    }
  );

  app.delete(
    '/api/admin/destinations/:id',
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        await deleteDestinationItem(String(req.params.id));
        res.json({ ok: true });
      } catch (error: any) {
        res.status(500).json({ error: error?.message || 'Failed to delete destination.' });
      }
    }
  );

  app.patch(
    '/api/admin/bookings/:pnr/restore',
    requireAuth,
    requireAdmin,
    async (req: AuthRequest, res: Response) => {
      try {
        const updated = await setBookingStatus(
          String(req.params.pnr),
          'Confirmed',
          req.user!.id,
          true
        );
        res.json({ booking: updated });
      } catch (error: any) {
        res.status(400).json({ error: error?.message || 'Failed to restore booking.' });
      }
    }
  );

  app.put('/api/admin/settings', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const updated = await updateSiteSettingsRow({
        brandName: String(body.brandName),
        tagline: String(body.tagline),
        announcementText: String(body.announcementText),
        heroHeadline: String(body.heroHeadline),
        heroSubheadline: String(body.heroSubheadline),
        promoCode: String(body.promoCode).toUpperCase(),
        promoPercent: Number(body.promoPercent),
        currency: String(body.currency || '$'),
        phone: String(body.phone),
        email: String(body.email),
        address: String(body.address),
      });
      res.json({ settings: updated });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Failed to update settings.' });
    }
  });

  app.post('/api/admin/reset', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
    try {
      await ensureDatabaseSeeded(true);
      const data = await getStorefrontBootstrap();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to reset demo data.' });
    }
  });

  app.get('/api/admin/logs', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const limit = Math.min(200, Math.max(10, Number(req.query.limit || 80)));
      const logs = await getRecentAuditLogs(limit);
      res.json({ logs });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load audit logs.' });
    }
  });

  // Frontend Vite Dev Middleware or Static Production Build
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TravelWorld server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
