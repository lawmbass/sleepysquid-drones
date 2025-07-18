import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

// USER SCHEMA
const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      private: true,
    },
    image: {
      type: String,
    },
    // Role-based access control
    role: {
      type: String,
      enum: ['admin', 'client', 'pilot', 'user'],
      default: 'user',
    },
    // Used in the Stripe webhook to identify the user in Stripe and later create Customer Portal or prefill user credit card details
    customerId: {
      type: String,
      validate(value) {
        return value.includes("cus_");
      },
    },
    // Used in the Stripe webhook. should match a plan in config.js file.
    priceId: {
      type: String,
      validate(value) {
        return value.includes("price_");
      },
    },
    // Used to determine if the user has access to the product—it's turn on/off by the Stripe webhook
    hasAccess: {
      type: Boolean,
      default: false,
    },
    // Additional profile fields
    phone: {
      type: String,
      trim: true,
    },
    company: {
      type: String,
      trim: true,
    },
    bio: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    // User preferences
    preferences: {
      theme: {
        type: String,
        enum: ['light', 'dark', 'auto'],
        default: 'light',
      },
      language: {
        type: String,
        enum: ['en', 'es', 'fr', 'de'],
        default: 'en',
      },
      timezone: {
        type: String,
        default: 'UTC',
      },
      dateFormat: {
        type: String,
        enum: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'],
        default: 'MM/DD/YYYY',
      },
      currency: {
        type: String,
        enum: ['USD', 'EUR', 'GBP', 'CAD'],
        default: 'USD',
      },
    },
    // Notification preferences
    notifications: {
      emailNotifications: {
        type: Boolean,
        default: true,
      },
      pushNotifications: {
        type: Boolean,
        default: true,
      },
      bookingUpdates: {
        type: Boolean,
        default: true,
      },
      marketingEmails: {
        type: Boolean,
        default: false,
      },
      weeklyReports: {
        type: Boolean,
        default: true,
      },
      securityAlerts: {
        type: Boolean,
        default: true,
      },
    },
    // Security settings
    password: {
      type: String,
      select: false, // Don't include in queries by default
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
      select: false, // Don't include in queries by default
    },
    // Role change audit trail
    roleHistory: [{
      role: {
        type: String,
        enum: ['admin', 'client', 'pilot', 'user'],
        required: true,
      },
      changedBy: {
        type: String, // Email of the user who made the change
        required: true,
      },
      changedAt: {
        type: Date,
        default: Date.now,
      },
      reason: {
        type: String,
        trim: true,
      },
    }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// add plugin that converts mongoose to json
userSchema.plugin(toJSON);

// Pre-save middleware to track role changes
userSchema.pre('save', function(next) {
  // Only track role changes if role field is modified
  if (this.isModified('role') && !this.isNew) {
    // Add to role history
    this.roleHistory.push({
      role: this.role,
      changedBy: this._roleChangedBy || 'system', // Set this before saving
      changedAt: new Date(),
      reason: this._roleChangeReason || 'Role updated',
    });
  }
  next();
});

export default mongoose.models.User || mongoose.model("User", userSchema);
