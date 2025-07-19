import mongoose from 'mongoose';

const invitationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  company: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['client', 'pilot', 'admin'],
    default: 'client'
  },
  hasAccess: {
    type: Boolean,
    default: false
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  invitedBy: {
    type: String,
    required: true
  },
  invitedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  acceptedAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'expired'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Index for efficient queries
invitationSchema.index({ email: 1 });
invitationSchema.index({ status: 1 });
invitationSchema.index({ expiresAt: 1 });

// Virtual to check if invitation is expired
invitationSchema.virtual('isExpired').get(function() {
  return this.expiresAt < new Date();
});

// Method to mark invitation as accepted
invitationSchema.methods.markAccepted = function() {
  this.status = 'accepted';
  this.acceptedAt = new Date();
  return this.save();
};

// Static method to find valid invitation by token
invitationSchema.statics.findValidInvitation = function(token) {
  return this.findOne({
    token,
    status: 'pending',
    expiresAt: { $gt: new Date() }
  });
};

export default mongoose.models.Invitation || mongoose.model('Invitation', invitationSchema);