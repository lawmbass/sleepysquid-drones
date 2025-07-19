#!/usr/bin/env node

/**
 * Migration script to convert all users with 'user' role to 'client' role
 * This script should be run after removing the 'user' role from the system
 * 
 * Usage: node scripts/migrate-user-role-to-client.js
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';

// Load environment variables
dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

const migrateUserRoles = async () => {
  console.log('🚀 Starting user role migration from "user" to "client"...\n');

  try {
    // Find all users with 'user' role
    const usersWithUserRole = await User.find({ role: 'user' });
    
    console.log(`👥 Found ${usersWithUserRole.length} users with 'user' role\n`);

    if (usersWithUserRole.length === 0) {
      console.log('✅ No users found with "user" role. Migration not needed.');
      return;
    }

    let migratedCount = 0;
    let errorCount = 0;

    for (const user of usersWithUserRole) {
      try {
        // Set metadata for role change tracking
        user._roleChangedBy = 'migration-script';
        user._roleChangeReason = 'Migrated from deprecated "user" role to "client" role';
        
        // Update role to client
        user.role = 'client';
        
        await user.save();
        
        console.log(`✅ ${user.email}: user → client`);
        migratedCount++;
        
      } catch (error) {
        console.error(`❌ Error migrating ${user.email}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n🎉 Migration complete!`);
    console.log(`   ✅ Successfully migrated: ${migratedCount} users`);
    console.log(`   ❌ Errors: ${errorCount} users`);
    
    if (errorCount > 0) {
      console.log('\n⚠️  Some users failed to migrate. Please review the errors above.');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

// Run the migration
const runMigration = async () => {
  await connectDB();
  await migrateUserRoles();
  
  console.log('\n✅ Disconnecting from MongoDB...');
  await mongoose.disconnect();
  console.log('✅ Migration script completed');
};

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration().catch(console.error);
}

export default runMigration; 