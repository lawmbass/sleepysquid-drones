# Admin Dashboard Setup & Usage

## Overview

The admin dashboard provides a secure interface for managing drone service bookings. It includes:

- **Authentication**: Secure login using NextAuth.js with Google OAuth or email
- **Dashboard Overview**: Statistics and metrics for all bookings
- **Booking Management**: View, filter, and update booking details
- **Status Tracking**: Change booking status and add admin notes
- **Pricing Management**: Set estimated and final prices

## Setup Instructions

### 1. Generate Admin API Keys

Run the key generation script:

```bash
node scripts/generateAdminKey.js
```

This will output secure API keys that you need to add to your `.env.local` file.

### 2. Environment Configuration

Create or update your `.env.local` file with the generated keys:

```env
# Admin Dashboard Configuration
ADMIN_API_KEY=your-generated-admin-api-key
NEXT_PUBLIC_ADMIN_API_KEY=your-generated-admin-api-key
NEXTAUTH_SECRET=your-generated-nextauth-secret

# Admin Access Control
NEXT_PUBLIC_ADMIN_EMAIL=admin@yourdomain.com

# NextAuth URL
NEXTAUTH_URL=http://localhost:3000

# Optional: Google OAuth (recommended for production)
GOOGLE_ID=your-google-oauth-client-id
GOOGLE_SECRET=your-google-oauth-client-secret

# Database (existing)
MONGODB_URI=your-mongodb-connection-string
```

### 3. Admin Access Configuration

Admin access is controlled by email address. Update these methods:

**Option 1: Single Admin Email**
Set `NEXT_PUBLIC_ADMIN_EMAIL` to your admin email address.

**Option 2: Domain-based Access**
Modify the admin check in `pages/admin/index.js`:
```javascript
const isAdmin = session?.user?.email?.endsWith('@yourdomain.com');
```

**Option 3: Database-based Roles**
For advanced setups, modify the User model to include admin roles.

### 4. Start the Development Server

```bash
npm run dev
```

### 5. Access the Admin Dashboard

1. Navigate to `http://localhost:3000/admin`
2. Sign in with Google or email
3. If your email matches the admin configuration, you'll have access

## Features

### Dashboard Overview

- **Statistics Cards**: Total bookings, pending, confirmed, in-progress, completed, and revenue
- **Quick Actions**: Refresh data, navigate to different sections

### Booking Management

- **List View**: Comprehensive table showing all booking details
- **Filtering**: Filter by status, service type, customer email, date range
- **Sorting**: Sort by creation date, event date, customer name
- **Pagination**: Handle large numbers of bookings efficiently

### Booking Details Modal

- **Customer Information**: Contact details and project location
- **Service Details**: Service type, package, event date, duration
- **Admin Actions**: 
  - Update booking status
  - Set estimated and final pricing
  - Add internal admin notes
- **Audit Trail**: Creation and update timestamps

### Security Features

- **Authentication**: NextAuth.js integration with multiple providers
- **Authorization**: Email-based admin access control
- **Rate Limiting**: API endpoints protected against abuse
- **Input Validation**: All inputs validated and sanitized
- **CSRF Protection**: Built-in NextAuth.js CSRF protection
- **Secure Headers**: Security headers on all admin API routes

## API Endpoints

### GET /api/admin/bookings

Fetch bookings with filtering and pagination.

**Query Parameters:**
- `status`: Filter by booking status
- `service`: Filter by service type
- `email`: Search by customer email
- `date_from`: Filter by event date (start)
- `date_to`: Filter by event date (end)
- `page`: Page number for pagination
- `limit`: Number of results per page
- `sort`: Sort order (-createdAt, date, name, etc.)

### PATCH /api/admin/bookings/[id]

Update a specific booking.

**Request Body:**
```json
{
  "status": "confirmed",
  "estimatedPrice": 299.99,
  "finalPrice": 275.00,
  "adminNotes": "Customer requested early morning session"
}
```

## Production Deployment

### Environment Variables

Ensure all environment variables are properly configured in your production environment:

```env
# Production URLs
NEXTAUTH_URL=https://yourdomain.com
NEXT_PUBLIC_ADMIN_EMAIL=admin@yourdomain.com

# Secure API Keys (generate new ones for production)
ADMIN_API_KEY=production-admin-api-key
NEXT_PUBLIC_ADMIN_API_KEY=production-admin-api-key
NEXTAUTH_SECRET=production-nextauth-secret

# OAuth Credentials (production)
GOOGLE_ID=production-google-client-id
GOOGLE_SECRET=production-google-client-secret
```

### Security Considerations

1. **Use HTTPS**: Always use HTTPS in production
2. **Secure API Keys**: Generate new keys for production
3. **Domain Restrictions**: Configure OAuth with proper domain restrictions
4. **Database Security**: Ensure MongoDB is properly secured
5. **Rate Limiting**: Configure appropriate rate limits
6. **Monitoring**: Set up logging and monitoring for admin actions

## Customization

### Adding New Filters

1. Update the `BookingFilters` component
2. Modify the API endpoint to handle new filter parameters
3. Update the database query logic

### Custom Admin Roles

1. Extend the User model with role fields
2. Update authentication logic in admin pages
3. Implement role-based permissions

### Additional Admin Features

The dashboard is designed to be extensible. Common additions:

- **Email Notifications**: Send status update emails to customers
- **Calendar Integration**: Sync bookings with calendar systems
- **Reporting**: Generate detailed reports and analytics
- **Customer Management**: Extended customer profiles and history
- **File Management**: Upload and manage project files

## Troubleshooting

### Common Issues

1. **Access Denied**: Check admin email configuration
2. **API Key Errors**: Ensure API keys match in both server and client
3. **NextAuth Issues**: Verify NEXTAUTH_URL and OAuth configuration
4. **Database Connection**: Check MongoDB connection string

### Support

For additional support or customization needs:
1. Check the MongoDB logs for database issues
2. Review Next.js console for client-side errors
3. Check server logs for API endpoint issues
4. Verify environment variable configuration

## Environment Variables

Add these to your `.env` file:

```bash
# Admin Dashboard Configuration
ADMIN_API_KEY=your-generated-admin-api-key
NEXT_PUBLIC_ADMIN_API_KEY=your-generated-admin-api-key
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3001

# Admin Access Control
# Comma-separated list of admin email addresses
ADMIN_EMAILS=admin@yourdomain.com,manager@yourdomain.com

# Alternative: Use NEXT_PUBLIC_ADMIN_EMAILS if you need client-side access
# NEXT_PUBLIC_ADMIN_EMAILS=admin@yourdomain.com,manager@yourdomain.com

# Optional OAuth (Google)
GOOGLE_ID=your-google-oauth-client-id
GOOGLE_SECRET=your-google-oauth-client-secret
```

## Adding/Removing Admin Users

To add or remove admin users, simply update the `ADMIN_EMAILS` environment variable:

```bash
# Single admin
ADMIN_EMAILS=admin@yourdomain.com

# Multiple admins
ADMIN_EMAILS=admin@yourdomain.com,manager@yourdomain.com,support@yourdomain.com
```

After updating, restart your development server for changes to take effect.

## Security Notes

- Use `ADMIN_EMAILS` (server-side only) for better security
- Use `NEXT_PUBLIC_ADMIN_EMAILS` only if you need client-side access
- Keep your admin email list confidential
- Restart your server after environment changes 