# SleepySquid Drones

Professional drone services website with admin dashboard and automated mission integration.

## Quick Setup

```bash
# Install and setup
npm install
cp .env.example .env  # Edit with your settings
npm run dev
```

**Key Environment Variables:**
```env
MONGODB_URI=mongodb://localhost:27017/sleepysquid-drones
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
ADMIN_EMAILS=your-email@domain.com
```

## Features

**Public Website** (`/`)
- Portfolio showcase with image galleries
- Service booking system
- Contact forms and pricing

**Admin Dashboard** (`/admin`)
- Booking management and analytics
- Customer data and revenue tracking
- Mission integration with Zeitview

**Security**
- Rate limiting, input validation, secure sessions
- Server-side authentication with NextAuth.js

## Key Commands

```bash
# Development
npm run dev

# Production
npm run build && npm start

# Admin key generation
node scripts/generateAdminKey.js

# Database testing
node scripts/test-admin-login.js
```

## Admin Access

1. Add your email to `ADMIN_EMAILS` in `.env`
2. Visit `/admin` and sign in with Google OAuth
3. Manage bookings, view analytics, track revenue

## Mission Integration

**drone-gigs** automatically accepts Zeitview missions and saves them to your database. Both systems share the same MongoDB database for unified booking management.

**Setup drone-gigs:**
```bash
cd drone-gigs
npm install
# Configure .env with same MONGODB_URI
npm start  # Starts monitoring for missions
```

## Database Schema

**Bookings** (customers + missions):
```javascript
{
  // Customer bookings
  customerName, email, phone, message
  serviceType, packageType, eventDate
  status: 'pending' | 'confirmed' | 'in-progress' | 'completed'
  
  // Mission bookings (from drone-gigs)
  missionId, source: 'zeitview', payout
  travelDistance, autoAccepted: true
}
```

## Production Deployment

**Environment Variables:**
```env
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=production-secret-here
ADMIN_EMAILS=your-email@domain.com
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/sleepysquid-drones
```

**Google OAuth Setup:**
- Add `https://yourdomain.com/api/auth/callback/google` to authorized redirect URIs
- Update authorized origins with your domain

## Common Issues

**Admin login fails:**
- Check `NEXTAUTH_URL` matches your domain exactly
- Verify your email is in `ADMIN_EMAILS`
- Ensure Google OAuth is configured correctly

**Database connection:**
- Verify `MONGODB_URI` is correct
- Check MongoDB server is running
- Ensure network access for remote databases

**Mission integration:**
- Both apps must use same `MONGODB_URI`
- Check drone-gigs logs for integration errors
- Verify Zeitview credentials in drone-gigs

## File Structure

```
├── components/
│   ├── home/          # Public website components
│   ├── admin/         # Admin dashboard components
│   └── layout/        # Shared components
├── pages/
│   ├── index.js       # Homepage
│   ├── admin/         # Admin pages
│   └── api/           # API endpoints
├── models/            # Database models
├── libs/              # Utilities and configs
└── scripts/           # Helper scripts
```

## Tech Stack

- **Framework:** Next.js 14
- **Database:** MongoDB with Mongoose
- **Auth:** NextAuth.js with Google OAuth
- **Styling:** Tailwind CSS
- **Security:** Rate limiting, input validation, secure sessions

---

**That's it.** Everything you need to run, develop, and deploy your drone services platform.
