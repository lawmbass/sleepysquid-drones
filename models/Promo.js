import mongoose from 'mongoose';

const promoSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: false,
    trim: true
  },
  discountPercentage: {
    type: Number,
    required: true,
    min: 1,
    max: 100
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
promoSchema.index({ startDate: 1, endDate: 1, isActive: 1 });

// Virtual to check if promo is currently active
promoSchema.virtual('isCurrentlyActive').get(function() {
  const now = new Date();
  return this.isActive && 
         this.startDate <= now && 
         this.endDate >= now;
});

// Method to get currently active promo
promoSchema.statics.getActivePromo = function() {
  const now = new Date();
  return this.findOne({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now }
  }).sort({ createdAt: -1 }); // Get the most recent active promo
};

// Method to calculate discounted price
promoSchema.methods.calculateDiscountedPrice = function(originalPrice) {
  const discount = (originalPrice * this.discountPercentage) / 100;
  return Math.round(originalPrice - discount);
};

const Promo = mongoose.models.Promo || mongoose.model('Promo', promoSchema);

export default Promo;