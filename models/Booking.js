import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

// BOOKING SCHEMA
const bookingSchema = mongoose.Schema(
  {
    // Work Source Information
    source: {
      type: String,
      enum: {
        values: ['customer', 'zeitview', 'manual'],
        message: "Invalid source type"
      },
      default: 'customer'
    },
    
    // Service Information
    service: {
      type: String,
      required: [true, "Service type is required"],
      enum: {
        values: [
          'aerial-photography', 
          'drone-videography', 
          'mapping-surveying', 
          'real-estate', 
          'inspection', 
          'event-coverage', 
          'custom'
        ],
        message: "Invalid service type"
      }
    },
    package: {
      type: String,
      enum: {
        values: ['basic', 'standard', 'premium'],
        message: "Invalid package type"
      },
      default: null
    },
    
    // Mission-specific Information (for automated missions)
    missionId: {
      type: String,
      sparse: true,
      unique: true,
      match: [/^DBM\d+$/, "Mission ID must be in format DBM followed by numbers"]
    },
    
    payout: {
      type: Number,
      min: [0, "Payout cannot be negative"],
      default: null
    },
    
    travelDistance: {
      type: Number,
      min: [0, "Distance cannot be negative"],
      default: null
    },
    
    travelTime: {
      type: Number,
      min: [0, "Travel time cannot be negative"],
      default: null
    },
    
    acceptedAt: {
      type: Date,
      default: null
    },
    
    missionEmail: {
      type: String,
      default: null
    },
    
    coordinates: {
      lat: {
        type: Number,
        min: [-90, "Latitude must be between -90 and 90"],
        max: [90, "Latitude must be between -90 and 90"]
      },
      lng: {
        type: Number,
        min: [-180, "Longitude must be between -180 and 180"],
        max: [180, "Longitude must be between -180 and 180"]
      }
    },
    
    // Booking Details
    date: {
      type: Date,
      required: [true, "Booking date is required"],
      validate: {
        validator: function(value) {
          // Skip validation for missions as they might have short notice
          if (this.source !== 'customer') {
            return true;
          }
          const minDate = new Date();
          minDate.setDate(minDate.getDate() + 7);
          return value >= minDate;
        },
        message: "Booking date must be at least 7 days from today"
      }
    },
    location: {
      type: String,
      required: [true, "Location is required"],
      trim: true,
      maxlength: [200, "Location cannot exceed 200 characters"]
    },

    details: {
      type: String,
      trim: true,
      maxlength: [1000, "Details cannot exceed 1000 characters"],
      default: ""
    },
    
    // Customer Information (optional for missions)
    name: {
      type: String,
      required: function() {
        return this.source === 'customer';
      },
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
      default: function() {
        return this.source === 'customer' ? undefined : 'Mission Client';
      }
    },
    email: {
      type: String,
      required: function() {
        return this.source === 'customer';
      },
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
      default: function() {
        return this.source === 'customer' ? undefined : 'mission@automated.com';
      }
    },
    phone: {
      type: String,
      required: function() {
        return this.source === 'customer';
      },
      trim: true,
      match: [/^[\+]?[\d\s\-\(\)]{10,}$/, "Please provide a valid phone number"],
      default: function() {
        return this.source === 'customer' ? undefined : 'N/A';
      }
    },
    
    // Pricing and Status
    estimatedPrice: {
      type: Number,
      min: [0, "Price cannot be negative"],
      default: null
    },
    finalPrice: {
      type: Number,
      min: [0, "Price cannot be negative"],
      default: null
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'],
        message: "Invalid status"
      },
      default: 'pending'
    },
    
    // Security and Tracking Fields
    ipAddress: {
      type: String,
      default: null
    },
    userAgent: {
      type: String,
      default: null
    },
    
    // Admin Notes
    adminNotes: {
      type: String,
      trim: true,
      maxlength: [500, "Admin notes cannot exceed 500 characters"],
      default: ""
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// Add plugin that converts mongoose to json
bookingSchema.plugin(toJSON);

// Create indexes for better performance
bookingSchema.index({ email: 1, date: 1 });
bookingSchema.index({ status: 1, createdAt: -1 });
bookingSchema.index({ date: 1 });
bookingSchema.index({ source: 1, status: 1 });
bookingSchema.index({ coordinates: '2dsphere' });

// Virtual for determining if this is a mission
bookingSchema.virtual('isMission').get(function() {
  return this.source !== 'customer';
});

// Virtual for getting the appropriate price (payout for missions, finalPrice/estimatedPrice for bookings)
bookingSchema.virtual('displayPrice').get(function() {
  if (this.isMission && this.payout) {
    return this.payout;
  }
  return this.finalPrice || this.estimatedPrice || 0;
});

export default mongoose.models.Booking || mongoose.model("Booking", bookingSchema); 