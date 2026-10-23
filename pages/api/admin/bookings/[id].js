import { deleteBooking, findBookingById, updateBooking } from "@/libs/db/bookings";
import { isUuid } from "@/libs/db/shared";
import { adminRateLimit } from "@/libs/rateLimit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { adminConfig } from "@/libs/adminConfig";
import { validateContactPatch } from "@/libs/bookingContactPatch";
import { bookingAddressError, resolveUsBookingAddress } from "@/libs/bookingAddress";

// Apply rate limiting middleware
const rateLimitMiddleware = (req, res) => {
  return new Promise((resolve, reject) => {
    adminRateLimit(req, res, (result) => {
      if (result instanceof Error) {
        res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Too many admin requests. Please wait before trying again.'
        });
        return reject(result);
      }
      resolve();
    });
  });
};

export default async function handler(req, res) {
  // Apply rate limiting
  try {
    await rateLimitMiddleware(req, res);
  } catch (error) {
    return; // Response already sent by rate limiter
  }

  if (req.method !== 'PATCH' && req.method !== 'DELETE') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only PATCH and DELETE requests are allowed'
    });
  }

  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // SECURITY: Use NextAuth.js session-based authentication
  const session = await getServerSession(req, res, authOptions);
  
  // Check if user is authenticated
  if (!session || !session.user || !session.user.email) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required. Please sign in.'
    });
  }
  
  // Check if user is authorized as admin
  const isAdmin = adminConfig.isAdmin(session.user.email);
  if (!isAdmin) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required. Insufficient permissions.'
    });
  }

  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'Booking ID is required'
    });
  }

  try {
    if (!isUuid(id)) {
      return res.status(400).json({
        error: 'Invalid booking ID',
        message: 'The provided booking ID is not valid'
      });
    }

    // Handle DELETE request
    if (req.method === 'DELETE') {
      // Find the existing booking
      const existingBooking = await findBookingById(id);
      
      if (!existingBooking) {
        return res.status(404).json({
          error: 'Booking not found',
          message: 'The specified booking does not exist'
        });
      }

      await deleteBooking(id);

      // Return success response
      return res.status(200).json({
        success: true,
        message: 'Booking deleted successfully',
        data: {
          deletedBooking: existingBooking
        }
      });
    }

    // Handle PATCH request - Find the existing booking
    const existingBooking = await findBookingById(id);
    
    if (!existingBooking) {
      return res.status(404).json({
        error: 'Booking not found',
        message: 'The specified booking does not exist'
      });
    }

    // Extract and validate update fields from request body
    const { status, estimatedPrice, finalPrice, adminNotes } = req.body;
    const updates = {};

    // Validate status
    if (status !== undefined) {
      const validStatuses = ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: 'Invalid status',
          message: 'Status must be one of: ' + validStatuses.join(', ')
        });
      }
      updates.status = status;
    }

    // Validate estimatedPrice
    if (estimatedPrice !== undefined) {
      if (estimatedPrice !== null) {
        const price = parseFloat(estimatedPrice);
        if (isNaN(price) || price < 0) {
          return res.status(400).json({
            error: 'Invalid estimated price',
            message: 'Estimated price must be a positive number'
          });
        }
        updates.estimatedPrice = price;
      } else {
        updates.estimatedPrice = null;
      }
    }

    // Validate finalPrice
    if (finalPrice !== undefined) {
      if (finalPrice !== null) {
        const price = parseFloat(finalPrice);
        if (isNaN(price) || price < 0) {
          return res.status(400).json({
            error: 'Invalid final price',
            message: 'Final price must be a positive number'
          });
        }
        updates.finalPrice = price;
      } else {
        updates.finalPrice = null;
      }
    }

    // Validate adminNotes
    if (adminNotes !== undefined) {
      if (typeof adminNotes !== 'string') {
        return res.status(400).json({
          error: 'Invalid admin notes',
          message: 'Admin notes must be a string'
        });
      }
      if (adminNotes.length > 500) {
        return res.status(400).json({
          error: 'Admin notes too long',
          message: 'Admin notes cannot exceed 500 characters'
        });
      }
      updates.adminNotes = adminNotes.trim();
    }

    // Validate contact details (location, email, phone)
    const contact = validateContactPatch(req.body, existingBooking);
    if (Object.keys(contact.errors).length) {
      return res.status(400).json({
        error: 'Validation failed',
        message: Object.values(contact.errors)[0],
        fields: contact.errors
      });
    }
    if (contact.needsAddress) {
      const unchanged = contact.updates.location === existingBooking.location && !req.body.placeId;
      if (!unchanged) {
        const address = await resolveUsBookingAddress({
          placeId: req.body.placeId,
          location: contact.updates.location,
        });
        if (!address.ok) {
          const failure = bookingAddressError(address.reason);
          return res.status(failure.status).json({ error: 'Invalid location', message: failure.message });
        }
        contact.updates.location = address.location;
        contact.updates.latitude = address.lat;
        contact.updates.longitude = address.lng;
      }
    }
    Object.assign(updates, contact.updates);

    // Check if any updates were provided
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'No updates provided',
        message: 'At least one field must be provided for update'
      });
    }

    // Update the booking
    const updatedBooking = await updateBooking(id, updates);

    if (!updatedBooking) {
      return res.status(404).json({
        error: 'Booking not found',
        message: 'The booking could not be found or updated'
      });
    }

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Booking updated successfully',
      data: {
        booking: updatedBooking,
        updatedFields: Object.keys(updates)
      }
    });

  } catch (error) {
    console.error('Admin booking update error:', error);
    
    if (error.name === 'ValidationError' || error.code === '23514') {
      const errors = error.errors ? Object.values(error.errors).map(err => err.message) : [error.message];
      return res.status(400).json({
        error: 'Validation failed',
        message: errors.join(', ')
      });
    }
    
    if (error.name === 'CastError' || error.code === '22P02') {
      return res.status(400).json({
        error: 'Invalid data format',
        message: 'The provided data format is invalid'
      });
    }
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update booking'
    });
  }
} 