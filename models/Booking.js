import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

// BOOKING SCHEMA
const bookingSchema = mongoose.Schema(
  {
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
    
    // Booking Details
    date: {
      type: Date,
      required: [true, "Booking date is required"],
      validate: {
        validator: function(value) {
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
    duration: {
      type: String,
      required: [true, "Duration is required"],
      enum: {
        values: ['1-2 hours', '3-4 hours', '5-8 hours', 'Full day', 'Multiple days'],
        message: "Invalid duration"
      }
    },
    details: {
      type: String,
      trim: true,
      maxlength: [1000, "Details cannot exceed 1000 characters"],
      default: ""
    },
    
    // Customer Information
    name: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"]
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"]
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [/^[\+]?[\d\s\-\(\)]{10,}$/, "Please provide a valid phone number"]
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

export default mongoose.models.Booking || mongoose.model("Booking", bookingSchema); 