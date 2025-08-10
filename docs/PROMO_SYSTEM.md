# Promo System Documentation

## Overview

The promo system allows administrators to create time-limited promotional discounts that apply to all drone service packages. The system automatically displays active promos on the website and applies discounts to bookings.

## Features

- **Admin Management**: Create, edit, and delete promotional campaigns
- **Time-based Activation**: Set start and end dates for promos
- **Automatic Display**: Active promos show on the homepage and pricing section
- **Booking Integration**: Discounts automatically applied to new bookings
- **Overlap Prevention**: Only one active promo allowed at a time
- **Visual Indicators**: Clear display of original vs discounted prices

## Database Schema

### Promo Model (`models/Promo.js`)

```javascript
{
  name: String,                    // Promo name (e.g., "Summer Sale 2024")
  description: String,             // Promo description
  discountPercentage: Number,      // Discount percentage (1-100)
  startDate: Date,                 // When promo becomes active
  endDate: Date,                   // When promo expires
  isActive: Boolean,               // Whether promo is enabled
  createdBy: ObjectId,             // Reference to User who created it
  createdAt: Date,                 // Auto-generated timestamp
  updatedAt: Date                  // Auto-generated timestamp
}
```

### Booking Model Updates

Added `appliedPromo` field to track which promo was applied to each booking:

```javascript
appliedPromo: {
  id: ObjectId,                    // Reference to Promo
  name: String,                    // Promo name
  discountPercentage: Number,      // Applied discount percentage
  originalPrice: Number,           // Original price before discount
  discountedPrice: Number          // Final price after discount
}
```

## API Endpoints

### Public Endpoints

#### `GET /api/promo/active`
Returns the currently active promotional campaign.

**Response:**
```json
{
  "hasActivePromo": true,
  "promo": {
    "id": "promo_id",
    "name": "Summer Sale 2024",
    "description": "Get 10% off all packages",
    "discountPercentage": 10,
    "startDate": "2024-01-01T00:00:00.000Z",
    "endDate": "2024-01-31T23:59:59.000Z",
    "isCurrentlyActive": true
  }
}
```

### Admin Endpoints

#### `GET /api/admin/promos`
List all promotional campaigns with optional filtering.

**Query Parameters:**
- `status`: Filter by status (`active`, `inactive`, `expired`, `upcoming`)
- `page`: Page number for pagination
- `limit`: Number of items per page

#### `POST /api/admin/promos`
Create a new promotional campaign.

**Request Body:**
```json
{
  "name": "Summer Sale 2024",
  "description": "Get 10% off all packages this summer",
  "discountPercentage": 10,
  "startDate": "2024-06-01",
  "endDate": "2024-08-31"
}
```

#### `PATCH /api/admin/promos/[id]`
Update an existing promotional campaign.

#### `DELETE /api/admin/promos/[id]`
Delete a promotional campaign.

## Frontend Components

### PromoBanner (`components/home/PromoBanner.jsx`)
Displays active promos at the top of the homepage with a dismissible banner.

### PricingSection Updates (`components/home/PricingSection.jsx`)
- Fetches active promo on component mount
- Displays promo banner above pricing cards
- Shows original price (crossed out) and discounted price
- Calculates and displays savings amount

## Admin Interface

### PromoManagement (`components/admin/PromoManagement.jsx`)
Full CRUD interface for managing promotional campaigns:

- **Create/Edit Form**: Name, description, discount percentage, start/end dates
- **Validation**: Prevents overlapping promos, validates date ranges
- **Status Display**: Shows active, upcoming, expired, and inactive promos
- **Bulk Actions**: Edit and delete existing promos

### Navigation Integration
Added "Promos" section to admin dashboard navigation in `libs/userRoles.js`.

## Business Logic

### Promo Activation Rules
1. Only one active promo allowed at a time
2. Promos automatically activate/deactivate based on start/end dates
3. Overlapping date ranges are prevented during creation
4. Expired promos are automatically filtered out

### Price Calculation
```javascript
const calculateDiscountedPrice = (originalPrice) => {
  const discount = (originalPrice * discountPercentage) / 100;
  return Math.round(originalPrice - discount);
};
```

### Booking Integration
When a customer books a service:
1. System checks for active promo
2. If active promo exists, applies discount to estimated price
3. Stores promo information with booking for audit trail
4. Shows discounted price in confirmation emails

## Usage Examples

### Creating a Promo via Admin Interface
1. Navigate to Admin Dashboard → Promos
2. Click "Create Promo"
3. Fill in details:
   - Name: "Holiday Special 2024"
   - Description: "Get 15% off all drone services this holiday season"
   - Discount: 15%
   - Start Date: December 1, 2024
   - End Date: December 31, 2024
4. Click "Create Promo"

### Testing the System
Run the test script to verify functionality:
```bash
node scripts/test-promo-system.js
```

## Security Considerations

- Only admin users can create/edit/delete promos
- Promo data is validated on both frontend and backend
- Date ranges are validated to prevent overlapping promos
- All promo changes are logged with user attribution

## Future Enhancements

- **Promo Codes**: Allow customers to enter specific promo codes
- **Targeted Promos**: Apply discounts to specific services only
- **Usage Limits**: Limit number of times a promo can be used
- **Analytics**: Track promo performance and conversion rates
- **Email Campaigns**: Automatically notify customers of new promos