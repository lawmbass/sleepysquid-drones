# Settings Page Implementation

This document describes the comprehensive settings page implementation for the SleepySquid Drones application.

## Overview

The settings page provides a modern, tabbed interface for users to manage their account settings, preferences, notifications, and security options. The implementation includes both frontend components and backend API endpoints.

## Features

### 1. Profile Settings
- **Full Name**: User's display name
- **Email Address**: Primary contact email
- **Phone Number**: Contact phone number
- **Company**: Organization/business name
- **Location**: User's location
- **Website**: Personal or business website
- **Bio**: Personal description/about section

### 2. System Preferences
- **Theme**: Light, Dark, or Auto mode
- **Language**: English, Spanish, French, German
- **Timezone**: Various timezone options
- **Date Format**: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD
- **Currency**: USD, EUR, GBP, CAD

### 3. Notification Settings
- **Email Notifications**: General email notifications
- **Push Notifications**: Browser/device notifications
- **Booking Updates**: Notifications for booking status changes
- **Marketing Emails**: Promotional content (opt-in)
- **Weekly Reports**: Summary reports
- **Security Alerts**: Account security notifications

### 4. Security Settings
- **Password Management**: Change account password
- **Two-Factor Authentication**: Enable/disable 2FA
- **Password Requirements**: Minimum 8 characters

## Technical Implementation

### Frontend Components

#### Main Settings Component
- **Location**: `components/dashboard/Settings.jsx`
- **Features**:
  - Tabbed interface with 4 sections
  - Form validation and error handling
  - Loading states and success/error messages
  - Responsive design with Tailwind CSS

#### Integration
- **AdminContent.jsx**: Updated to use the new Settings component
- **Navigation**: Available in admin dashboard via Settings menu item

### Backend API Endpoints

#### GET `/api/user/settings`
- Retrieves current user settings
- Returns profile, preferences, notifications, and security data

#### PUT `/api/user/settings/profile`
- Updates user profile information
- Validates and saves profile data to database

#### PUT `/api/user/settings/preferences`
- Updates system preferences
- Validates theme, language, currency options

#### PUT `/api/user/settings/notifications`
- Updates notification preferences
- Manages email and push notification settings

#### PUT `/api/user/settings/security`
- Updates security settings
- Handles password changes with bcrypt hashing
- Manages two-factor authentication preferences

### Database Schema Updates

The User model has been extended with the following fields:

```javascript
// Additional profile fields
phone: String
company: String
bio: String
location: String
website: String

// User preferences
preferences: {
  theme: String (enum: 'light', 'dark', 'auto')
  language: String (enum: 'en', 'es', 'fr', 'de')
  timezone: String
  dateFormat: String (enum: 'MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD')
  currency: String (enum: 'USD', 'EUR', 'GBP', 'CAD')
}

// Notification preferences
notifications: {
  emailNotifications: Boolean
  pushNotifications: Boolean
  bookingUpdates: Boolean
  marketingEmails: Boolean
  weeklyReports: Boolean
  securityAlerts: Boolean
}

// Security settings
password: String (select: false)
twoFactorEnabled: Boolean
twoFactorSecret: String (select: false)
```

## Security Features

### Password Management
- Uses bcryptjs for secure password hashing
- Validates current password before allowing changes
- Minimum password length requirement (8 characters)

### Two-Factor Authentication
- Toggle for enabling/disabling 2FA
- Placeholder for TOTP secret generation
- Ready for QR code integration

### Data Protection
- Sensitive fields (password, 2FA secret) are not included in queries by default
- Session-based authentication required for all endpoints
- Input validation and sanitization

## User Experience

### Interface Design
- Clean, modern tabbed interface
- Consistent styling with the existing dashboard
- Responsive design for mobile and desktop
- Loading states and feedback messages
- Form validation with helpful error messages

### Navigation
- Accessible via Settings menu item in admin dashboard
- Tab-based navigation for different setting categories
- Save buttons for each section
- Success/error message display

## Access Control

- Settings page is currently available to admin users only
- Can be extended to other user roles by updating navigation in `libs/userRoles.js`
- All API endpoints require valid user session

## Future Enhancements

1. **Profile Picture Upload**: Add image upload functionality
2. **Advanced 2FA**: Implement full TOTP with QR codes
3. **Email Verification**: Verify email changes before saving
4. **Audit Log**: Track settings changes for security
5. **Export/Import**: Allow users to export/import settings
6. **Role-based Settings**: Different settings for different user roles

## Dependencies Added

- `bcryptjs`: For secure password hashing

## Files Created/Modified

### New Files
- `components/dashboard/Settings.jsx`
- `pages/api/user/settings/index.js`
- `pages/api/user/settings/profile.js`
- `pages/api/user/settings/preferences.js`
- `pages/api/user/settings/notifications.js`
- `pages/api/user/settings/security.js`

### Modified Files
- `components/dashboard/AdminContent.jsx`
- `models/User.js`
- `package.json` (added bcryptjs dependency)

## Testing

The implementation includes:
- Form validation
- Error handling
- Loading states
- Success feedback
- Responsive design
- ESLint compliance

To test the settings page:
1. Start the development server: `npm run dev`
2. Log in as an admin user
3. Navigate to Dashboard > Settings
4. Test each tab's functionality
5. Verify data persistence across sessions

## Conclusion

This settings page implementation provides a comprehensive, secure, and user-friendly interface for managing account settings. It follows modern web development best practices and is ready for production use with proper testing and deployment procedures.