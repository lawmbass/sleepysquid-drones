# Admin Dashboard Documentation

## 🔒 **SECURE ADMIN SYSTEM**

This admin dashboard uses **enterprise-level security** with session-based authentication. All sensitive credentials are kept server-side only.

## Quick Setup

### 1. Generate Secure Configuration

Run the secure configuration generator:

```bash
node scripts/generateAdminKey.js
```

### 2. Environment Configuration

Create or update your `.env` file with **secure server-side only** variables:

```env
# NextAuth.js Configuration (REQUIRED)
NEXTAUTH_SECRET=your-generated-secret-here
NEXTAUTH_URL=http://localhost:3000

# Admin Access Control (SERVER-SIDE ONLY)
ADMIN_EMAILS=admin@yourdomain.com,manager@yourdomain.com

# Google OAuth (OPTIONAL - Recommended for production)
GOOGLE_ID=your-google-oauth-client-id
GOOGLE_SECRET=your-google-oauth-client-secret

# Database (REQUIRED)
MONGODB_URI=your-mongodb-connection-string
```

### 3. Start the Development Server

```bash
npm run dev
```

### 4. Access the Admin Dashboard

1. Navigate to `http://localhost:3000/admin`
2. Sign in with Google OAuth or email authentication
3. If your email is listed in `ADMIN_EMAILS`, you'll have access

## 🛡️ Security Features

### Session-Based Authentication
- ✅ **NextAuth.js Integration**: Industry-standard authentication
- ✅ **Server-Side Sessions**: No credentials exposed to browser
- ✅ **Email-Based Authorization**: Controlled admin access
- ✅ **CSRF Protection**: Built-in security measures

### API Security
- ✅ **Session Validation**: All API endpoints verify admin sessions
- ✅ **Rate Limiting**: Protection against abuse
- ✅ **Input Validation**: All inputs sanitized and validated
- ✅ **Secure Headers**: Security headers on all routes

### Environment Security
- ✅ **Server-Side Only**: No `NEXT_PUBLIC_` variables for sensitive data
- ✅ **Encrypted Sessions**: Session data is encrypted
- ✅ **Secure Cookies**: HttpOnly and secure cookie settings

## Features

### Dashboard Overview
- **Statistics Cards**: Total bookings, pending, confirmed, in-progress, completed, and revenue
- **Real-Time Data**: Live updates of booking statistics
- **Quick Actions**: Refresh data, navigate to different sections

### Booking Management
- **List View**: Comprehensive table showing all booking details
- **Advanced Filtering**: Filter by status, service type, customer email, date range
- **Smart Sorting**: Sort by creation date, event date, customer name
- **Pagination**: Handle large numbers of bookings efficiently

### Booking Details & Actions
- **Customer Information**: Complete contact details and project location
- **Service Details**: Service type, package selection, event date, duration
- **Admin Controls**: 
  - Update booking status (pending → confirmed → in-progress → completed)
  - Set estimated and final pricing
  - Add internal admin notes and tracking
- **Audit Trail**: Full history of changes and timestamps

### Analytics Dashboard
- **Monthly Trends**: Booking volume and revenue over time
- **Service Breakdown**: Popular services and performance metrics
- **Location Insights**: Most requested locations for services
- **Growth Analytics**: Revenue trends and business insights

### Settings Management
- **Business Configuration**: Company details and operating hours
- **Pricing Management**: Package pricing and booking policies
- **Email Settings**: Notification preferences and templates
- **Security Settings**: Session timeout and access controls
- **System Information**: Health status and maintenance tools

## API Endpoints

All API endpoints use **secure session-based authentication**:

### GET /api/admin/bookings
Fetch bookings with filtering and pagination.

**Authentication**: Session-based (automatic)
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

**Authentication**: Session-based (automatic)
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

**SECURE Production Configuration:**

```env
# Production URLs
NEXTAUTH_URL=https://yourdomain.com

# Session Security (GENERATE NEW FOR PRODUCTION)
NEXTAUTH_SECRET=your-production-secret-here

# Admin Access Control (SERVER-SIDE ONLY)
ADMIN_EMAILS=admin@yourdomain.com,manager@yourdomain.com

# OAuth Credentials (production)
GOOGLE_ID=production-google-client-id
GOOGLE_SECRET=production-google-client-secret

# Database
MONGODB_URI=your-production-mongodb-uri
```

### Security Checklist

- ✅ **HTTPS Only**: Always use HTTPS in production
- ✅ **New Secrets**: Generate new NEXTAUTH_SECRET for production  
- ✅ **Secure OAuth**: Configure OAuth with proper domain restrictions
- ✅ **Database Security**: Ensure MongoDB is properly secured with authentication
- ✅ **Environment Variables**: Never commit .env files to version control
- ✅ **Email Verification**: Only add trusted admin emails to ADMIN_EMAILS
- ✅ **Rate Limiting**: Monitor and adjust rate limits as needed
- ✅ **Session Security**: Configure appropriate session timeouts

## Admin Access Management

### Adding New Admins

To grant admin access to additional users:

1. Add their email to the `ADMIN_EMAILS` environment variable:
   ```env
   ADMIN_EMAILS=admin@yourdomain.com,new-admin@yourdomain.com,manager@yourdomain.com
   ```

2. Restart your application to apply changes

3. The new admin can now sign in and access the dashboard

### Removing Admin Access

1. Remove the email from `ADMIN_EMAILS`
2. Restart the application
3. The user will lose admin access immediately

## Troubleshooting

### Common Issues

1. **Access Denied**: 
   - Check that your email is listed in `ADMIN_EMAILS`
   - Verify the email matches exactly (case-sensitive)
   - Ensure you've restarted the app after adding the email

2. **Session Issues**: 
   - Verify `NEXTAUTH_SECRET` is set
   - Check `NEXTAUTH_URL` matches your domain
   - Clear browser cookies and try again

3. **Database Connection**: 
   - Verify `MONGODB_URI` is correct
   - Check MongoDB server is running
   - Ensure network connectivity

4. **OAuth Problems**:
   - Verify Google OAuth credentials
   - Check domain restrictions in Google Console
   - Ensure redirect URLs are configured correctly

### Security Verification

To verify your setup is secure:

1. **Check Environment Variables**: Ensure no `NEXT_PUBLIC_` variables contain sensitive data
2. **Inspect Browser**: Admin credentials should NOT be visible in browser dev tools
3. **Test Unauthorized Access**: Non-admin emails should be denied access
4. **Verify HTTPS**: Production should always use HTTPS

## 🚨 **SECURITY WARNINGS**

### ❌ **NEVER DO THIS:**
```env
# INSECURE - DON'T USE THESE PATTERNS!
# Any environment variable starting with NEXT_PUBLIC_ is exposed to the browser!
# Never put sensitive admin data in NEXT_PUBLIC_ variables!
```

### ✅ **ALWAYS DO THIS:**
```env
# SECURE - Server-side only
ADMIN_EMAILS=admin@yourdomain.com      # Server-side only  
NEXTAUTH_SECRET=your-secret-here       # Server-side only
```

## Support & Customization

### Extending the Dashboard

The admin system is built for extensibility:

- **Custom Admin Roles**: Extend the email-based system with role management
- **Additional Analytics**: Add custom metrics and reporting
- **Workflow Automation**: Integrate with external tools and notifications
- **Advanced Permissions**: Implement granular access controls

### Getting Help

1. **Check Logs**: Review Next.js console for errors
2. **Verify Configuration**: Use the security checklist above
3. **Database Issues**: Check MongoDB connection and logs
4. **Authentication Problems**: Verify NextAuth.js configuration

---

## 🎯 **Your Admin Dashboard is Now Secure!**

This system follows **enterprise security best practices**:
- ✅ No sensitive data exposed to browser
- ✅ Session-based authentication
- ✅ Server-side authorization
- ✅ Encrypted sessions and secure cookies
- ✅ Protection against common security vulnerabilities

**Ready for production deployment!** 🚀 