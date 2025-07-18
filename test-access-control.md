# Access Control Testing Guide

## Testing the Inactive User Functionality

### Prerequisites
1. Admin access to the user management system
2. Test user account that can be toggled between active/inactive
3. Browser for testing different user sessions

### Test Scenarios

#### 1. Set User to Inactive
1. Login as admin
2. Navigate to User Management
3. Find a test user
4. Click on their "Active" status to change it to "Inactive"
5. Verify the status changes to "Inactive" in the UI

#### 2. Test Access Control - Middleware
1. While logged in as the inactive user, try to access:
   - `/dashboard` - Should redirect to `/access-denied?reason=inactive`
   - `/admin` - Should redirect to `/access-denied?reason=inactive`
   - `/api/admin/users` - Should redirect to `/access-denied?reason=inactive`
   - `/api/user/settings` - Should redirect to `/access-denied?reason=inactive`

#### 3. Test Access Control - Client-side
1. If the user somehow bypasses middleware (e.g., direct URL manipulation)
2. The dashboard should detect `hasAccess: false` and redirect to access denied page
3. The AccessStatusBanner should show warning message for inactive users

#### 4. Test Admin Bypass
1. Set a SleepySquid admin email to inactive
2. Admin should still be able to access all routes (bypass protection)
3. Admin should see access status banner but not be blocked

#### 5. Test Access Denied Page
1. Navigate to `/access-denied?reason=inactive`
2. Verify the page shows appropriate message for inactive users
3. Test the "Sign Out" and "Go to Home" buttons
4. Verify contact information is displayed

#### 6. Test Audit Trail
1. Set user to inactive
2. Check user modal for access history
3. Verify entry shows:
   - Action: "deactivated"
   - Changed by: Admin email
   - Timestamp
   - Reason: "Access revoked via admin panel"

#### 7. Test Reactivation
1. Set inactive user back to active
2. Verify user can now access protected routes
3. Check audit trail shows "activated" entry

### Expected Behavior

#### For Inactive Users (Non-Admin)
- ❌ Cannot access `/dashboard`
- ❌ Cannot access `/admin`
- ❌ Cannot access `/api/admin/*`
- ❌ Cannot access `/api/user/*`
- ✅ Can access `/` (home page)
- ✅ Can access `/login`
- ✅ Can access `/access-denied`
- ✅ Can see access denied page with clear messaging

#### For Inactive Admins (SleepySquid emails)
- ✅ Can access all routes (bypass protection)
- ✅ See warning banner about inactive status
- ✅ All admin functionality works normally

#### For Active Users
- ✅ Can access all routes they have permissions for
- ✅ No access status banner shown
- ✅ Normal user experience

### Database Changes to Verify

#### User Model Updates
- `accessHistory` array should be populated
- Each access change should create new entry with:
  - `hasAccess`: boolean
  - `changedBy`: email of admin who made change
  - `changedAt`: timestamp
  - `reason`: description of change
  - `action`: 'activated', 'deactivated', or 'created'

#### Session Data
- `session.user.hasAccess` should reflect current database value
- Session should be updated when user access changes

### Troubleshooting

#### If Access Control Isn't Working
1. Check middleware is properly deployed
2. Verify JWT token includes correct user data
3. Check database connection in middleware
4. Verify NextAuth session callback is updated

#### If Audit Trail Isn't Working
1. Check User model has `accessHistory` field
2. Verify pre-save middleware is triggered
3. Check API endpoint sets `_accessChangedBy` metadata
4. Verify UserModal includes AccessHistory component

#### If Redirects Aren't Working
1. Check middleware matcher configuration
2. Verify protected routes are correctly defined
3. Check NextAuth JWT secret is configured
4. Verify access denied page exists at `/access-denied`

### Performance Considerations
- Middleware makes database query on each protected route
- Consider caching user access status for better performance
- Monitor database load with increased middleware queries
- Consider implementing Redis cache for user access status