import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get user session
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Connect to database
    await connectMongo();

    // Get user from database
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Extract profile data from request
    const { name, email, phone, company, bio, location, website } = req.body;

    // Check if email is being changed
    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      return res.status(400).json({ 
        message: 'Email changes must be done through the email change process',
        requiresEmailVerification: true
      });
    }

    // Update user profile (excluding email)
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      {
        $set: {
          name: name || user.name,
          // Add additional fields to the User model as needed
          ...(phone && { phone }),
          ...(company && { company }),
          ...(bio && { bio }),
          ...(location && { location }),
          ...(website && { website })
        }
      },
      { new: true, runValidators: true }
    );

    // Return success response
    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        company: updatedUser.company,
        bio: updatedUser.bio,
        location: updatedUser.location,
        website: updatedUser.website
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}