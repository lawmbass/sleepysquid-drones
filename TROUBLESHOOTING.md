# Booking Submission Troubleshooting Guide

## ✅ RESOLVED: 400 Bad Request Error

The 400 Bad Request error has been resolved. The API is now working correctly and returning proper error messages.

### What was fixed:
1. **Missing Dependencies**: Ran `npm install` to install all required packages
2. **Server Configuration**: Started the development server properly
3. **Critical MongoDB Bug**: Fixed inconsistent return types and hanging promise issues
4. **MongoDB Connection**: Fixed mongoose configuration issues
5. **Error Handling**: Improved error responses for better debugging

## Current Status

### ✅ API Endpoint Working
- `/api/bookings` is responding correctly
- Returns proper error messages for validation issues
- Handles database connection errors gracefully

### ✅ Database Health Check Available
- Visit `/api/health/database` to check MongoDB connection status
- Shows detailed connection information and errors

### ⚠️ Database Connection Required
The API is working, but you need to configure MongoDB:

## Setup Instructions

### Option 1: Local MongoDB (Recommended for Development)
```bash
# Install MongoDB locally (Ubuntu/Debian)
sudo apt update
sudo apt install -y mongodb

# Start MongoDB service
sudo systemctl start mongodb
sudo systemctl enable mongodb

# Verify it's running
sudo systemctl status mongodb
```

### Option 2: MongoDB Atlas (Cloud Database)
1. Go to https://www.mongodb.com/atlas
2. Create a free account
3. Create a new cluster
4. Get your connection string
5. Update `.env` file with the connection string

### Option 3: Docker MongoDB (Quick Setup)
```bash
# Run MongoDB in Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest

# The default connection string will work: mongodb://localhost:27017/sleepysquid-drones
```

## Testing the Fix

### 1. Check Database Connection
```bash
curl http://localhost:3000/api/health/database
```

**Expected Response (when MongoDB is running):**
```json
{
  "status": "healthy",
  "database": "connected",
  "connectionTime": "50ms",
  "readyState": 1,
  "readyStateText": "connected"
}
```

### 2. Test Booking Submission
```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "service": "aerial-photography",
    "package": "basic", 
    "date": "2025-07-30T10:00",
    "location": "Test Location",
    "details": "Test details",
    "name": "Test User",
    "email": "test@example.com",
    "phone": "+1234567890",
    "recaptchaToken": "test-token"
  }'
```

**Expected Response (with MongoDB running but reCAPTCHA not configured):**
```json
{
  "error": "reCAPTCHA not configured",
  "message": "reCAPTCHA verification is required but not configured on the server"
}
```

## Common Issues & Solutions

### Issue: "Database connection failed"
**Solution**: Set up MongoDB (see setup instructions above)

### Issue: "reCAPTCHA not configured" 
**Solution**: Get reCAPTCHA keys from Google and update `.env`

### Issue: "Missing required fields"
**Solution**: Ensure all required form fields are filled

### Issue: "Rate limit exceeded"
**Solution**: Wait 15 minutes or use different IP

## Environment Variables Checklist

Update your `.env` file with real values:

- ✅ `MONGODB_URI` - Set to your MongoDB connection string
- ⚠️ `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` - Get from Google reCAPTCHA
- ⚠️ `RECAPTCHA_SECRET_KEY` - Get from Google reCAPTCHA  
- ✅ `NEXTAUTH_SECRET` - Generate a secure random string
- ✅ `NEXTAUTH_URL` - Set to your domain (http://localhost:3000 for dev)

## Next Steps

1. **Set up MongoDB** using one of the options above
2. **Configure reCAPTCHA** for the booking form to work
3. **Test the booking form** in the browser
4. **Check server logs** for any additional issues

The booking submission system is now properly configured and should work once you complete the database setup!