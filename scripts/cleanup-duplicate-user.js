const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('../models/User');
const Invitation = require('../models/Invitation');

async function cleanupDuplicateUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const email = 'lawmbass1@gmail.com';
    console.log(`\n🔍 Searching for duplicate users for: ${email}`);

    // Find all users with this email
    const users = await User.find({ email: email.toLowerCase() }).sort({ createdAt: 1 });
    
    if (users.length < 2) {
      console.log('❌ No duplicate users found');
      return;
    }

    console.log(`\n📊 Found ${users.length} users:`);
    users.forEach((user, index) => {
      console.log(`   ${index + 1}. ID: ${user._id}`);
      console.log(`      Name: ${user.name}`);
      console.log(`      Role: ${user.role}`);
      console.log(`      Has Access: ${user.hasAccess}`);
      console.log(`      Created: ${user.createdAt}`);
      console.log(`      Company: ${user.company || 'N/A'}`);
      console.log(`      Phone: ${user.phone || 'N/A'}`);
      console.log('');
    });

    // Find the corresponding invitation
    const invitation = await Invitation.findOne({ email: email.toLowerCase() });
    
    if (invitation) {
      console.log(`\n📧 Found invitation:`);
      console.log(`   Name: ${invitation.name}`);
      console.log(`   Role: ${invitation.role}`);
      console.log(`   Has Access: ${invitation.hasAccess}`);
      console.log(`   Company: ${invitation.company || 'N/A'}`);
      console.log(`   Phone: ${invitation.phone || 'N/A'}`);
      console.log(`   Status: ${invitation.status}`);
      console.log('');
    }

    // Determine which user to keep
    let userToKeep = null;
    let usersToDelete = [];

    if (invitation) {
      // If there's an invitation, prefer the user that matches the invitation role
      userToKeep = users.find(user => user.role === invitation.role);
      
      // If no user matches the invitation role, keep the most recent one and update it
      if (!userToKeep) {
        userToKeep = users[users.length - 1];
        console.log(`⚠️  No user matches invitation role ${invitation.role}, keeping most recent user`);
      } else {
        console.log(`✅ Found user matching invitation role: ${invitation.role}`);
      }
    } else {
      // No invitation, keep the most recent user
      userToKeep = users[users.length - 1];
      console.log(`⚠️  No invitation found, keeping most recent user`);
    }

    // Mark others for deletion
    usersToDelete = users.filter(user => user._id.toString() !== userToKeep._id.toString());

    console.log(`\n🎯 Plan:`);
    console.log(`   Keep: ${userToKeep.name} (${userToKeep._id}) - Role: ${userToKeep.role}`);
    console.log(`   Delete: ${usersToDelete.length} duplicate(s)`);
    usersToDelete.forEach(user => {
      console.log(`     - ${user.name} (${user._id}) - Role: ${user.role}`);
    });

    // Update the user we're keeping with invitation data if available
    if (invitation) {
      console.log(`\n📝 Updating user with invitation data...`);
      userToKeep.role = invitation.role;
      userToKeep.hasAccess = invitation.hasAccess;
      userToKeep.company = invitation.company || userToKeep.company;
      userToKeep.phone = invitation.phone || userToKeep.phone;
      userToKeep.name = invitation.name || userToKeep.name;
      
      // Add role history
      userToKeep.roleHistory = userToKeep.roleHistory || [];
      userToKeep.roleHistory.push({
        role: invitation.role,
        changedAt: new Date(),
        changedBy: 'system-cleanup',
        reason: 'Cleanup: Applied invitation data to merged user'
      });
      
      await userToKeep.save();
      console.log(`✅ Updated user with invitation data`);
      
      // Mark invitation as accepted
      invitation.status = 'accepted';
      invitation.acceptedAt = new Date();
      await invitation.save();
      console.log(`✅ Marked invitation as accepted`);
    }

    // Delete duplicate users
    console.log(`\n🗑️  Deleting duplicate users...`);
    for (const user of usersToDelete) {
      await User.findByIdAndDelete(user._id);
      console.log(`✅ Deleted user: ${user.name} (${user._id})`);
    }

    console.log(`\n🎉 Cleanup completed successfully!`);
    console.log(`   - Removed ${usersToDelete.length} duplicate user(s)`);
    console.log(`   - Kept user: ${userToKeep.name} with role: ${userToKeep.role}`);
    console.log(`   - Invitation ${invitation ? 'processed' : 'not found'}`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Run the cleanup
cleanupDuplicateUser();