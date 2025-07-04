# 🚀 Production Setup Guide - Admin Login Fix

## 🔴 **CRITICAL: Admin Login Issues in Production**

If you're experiencing login failures in production with "Callback" errors, follow this guide to fix the issues.

## 🛠️ **Required Environment Variables**

Set these environment variables in your production environment:

```env
# CRITICAL: NextAuth Configuration
NEXTAUTH_URL=https://drones.sleepysquid.com
NEXTAUTH_SECRET=your-production-secret-here

# Admin Access Control
ADMIN_EMAILS=lawrence@sleepysquid.com,admin@sleepysquid.com

# Google OAuth Credentials (PRODUCTION)
GOOGLE_ID=your-production-google-client-id
GOOGLE_SECRET=your-production-google-client-secret

# Database
MONGODB_URI=your-production-mongodb-uri
```

## 🔧 **Google OAuth Configuration**

### 1. Update Google Console Settings

Go to [Google Cloud Console](https://console.cloud.google.com/):

1. **Navigate to**: APIs & Services > Credentials
2. **Select your OAuth 2.0 Client ID**
3. **Add these Authorized redirect URIs**:
   ```
   https://drones.sleepysquid.com/api/auth/callback/google
   ```
4. **Add these Authorized JavaScript origins**:
   ```
   https://drones.sleepysquid.com
   ```

### 2. Verify Domain Settings

Ensure your domain is properly configured:
- ✅ Domain: `drones.sleepysquid.com`
- ✅ HTTPS enabled
- ✅ SSL certificate valid

## 🔍 **Troubleshooting Steps**

### Step 1: Check Environment Variables

Run this command to verify your environment:

```bash
node scripts/test-admin-login.js
```

### Step 2: Test OAuth Configuration

1. Visit: `https://drones.sleepysquid.com/api/auth/signin`
2. Click "Sign in with Google"
3. Check browser console for errors

### Step 3: Common Issues & Solutions

#### ❌ **Issue**: "Callback Error"
**Solution**: 
- Verify `NEXTAUTH_URL` matches your domain exactly
- Check Google OAuth redirect URIs are correct
- Ensure `NEXTAUTH_SECRET` is set

#### ❌ **Issue**: "Configuration Error"
**Solution**:
- Verify all environment variables are set
- Check Google OAuth credentials are for production
- Ensure MongoDB connection string is correct

#### ❌ **Issue**: "Access Denied"
**Solution**:
- Verify your email is in `ADMIN_EMAILS`
- Check email matches exactly (case-sensitive)
- Restart application after changing environment variables

## 📋 **Deployment Checklist**

### Before Deployment:
- [ ] Set `NEXTAUTH_URL=https://drones.sleepysquid.com`
- [ ] Generate new `NEXTAUTH_SECRET` for production
- [ ] Configure Google OAuth with production domain
- [ ] Set `ADMIN_EMAILS` with authorized admin emails
- [ ] Verify MongoDB connection string
- [ ] Test locally with production-like environment

### After Deployment:
- [ ] Test admin login flow
- [ ] Verify environment variables are loaded
- [ ] Check application logs for errors
- [ ] Test with multiple admin emails
- [ ] Verify session persistence

## 🔒 **Security Notes**

### ✅ **SECURE Configuration**:
```env
# Correct - Server-side only
NEXTAUTH_URL=https://drones.sleepysquid.com
NEXTAUTH_SECRET=your-secure-secret
ADMIN_EMAILS=admin@yourdomain.com
```

### ❌ **INSECURE Configuration**:
```env
# Wrong - Never use NEXT_PUBLIC_ for sensitive data
NEXT_PUBLIC_ADMIN_EMAILS=admin@yourdomain.com  # ❌ EXPOSED TO BROWSER
NEXT_PUBLIC_NEXTAUTH_SECRET=secret             # ❌ SECURITY RISK
```

## 🆘 **Emergency Recovery**

If admin login is completely broken:

1. **Verify Environment Variables**:
   ```bash
   # Check if variables are set
   echo $NEXTAUTH_URL
   echo $NEXTAUTH_SECRET
   echo $ADMIN_EMAILS
   ```

2. **Reset Session Storage**:
   - Clear browser cookies for your domain
   - Restart the application
   - Try login again

3. **Check Application Logs**:
   - Look for NextAuth errors
   - Check MongoDB connection issues
   - Verify Google OAuth responses

## 📞 **Support**

If you're still experiencing issues:

1. **Check the browser console** for JavaScript errors
2. **Review server logs** for NextAuth errors
3. **Verify Google OAuth setup** in Google Cloud Console
4. **Test with a different admin email** to isolate the issue

## 🎯 **Quick Fix Commands**

```bash
# Test admin configuration
node scripts/test-admin-login.js

# Build and test locally
npm run build
npm start

# Check environment variables
env | grep -E "(NEXTAUTH|ADMIN|GOOGLE|MONGODB)"
```

---

## ✅ **Success Indicators**

You'll know the fix worked when:
- ✅ No "Callback" errors in browser console
- ✅ Google OAuth redirects properly
- ✅ Admin login completes successfully
- ✅ Admin dashboard loads without errors
- ✅ Session persists across page refreshes

**🚀 Your admin login should now work in production!** 