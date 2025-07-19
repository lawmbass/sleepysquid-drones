#!/usr/bin/env node

/**
 * Migration script to transition from environment-based roles to database-based roles
 * Run this script to migrate existing users to the new role system
 * 
 * Usage: node scripts/migrate-to-database-roles.js
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';

// Load environment variables
dotenv.config();

// Get role emails from environment
const getAdminEmails = () => {
  const envEmails = process.env.ADMIN_EMAILS;
  return envEmails ? envEmails.split(',').map(email => email.trim()).filter(email => email) : [];
};

const getClientEmails = () => {
  const envEmails = process.env.CLIENT_EMAILS;
  return envEmails ? envEmails.split(',').map(email => email.trim()).filter(email => email) : [];
};

const getPilotEmails = () => {
  const envEmails = process.env.PILOT_EMAILS;
  return envEmails ? envEmails.split(',').map(email => email.trim()).filter(email => email) : [];
};

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const migrateRoles = async () => {
  console.log('🚀 Starting role migration...\n');

  // Get all role emails from environment
  const adminEmails = getAdminEmails();
  const clientEmails = getClientEmails();
  const pilotEmails = getPilotEmails();

  console.log('📋 Current role configuration:');
  console.log(`   Admins: ${adminEmails.length} emails`);
  console.log(`   Clients: ${clientEmails.length} emails`);
  console.log(`   Pilots: ${pilotEmails.length} emails\n`);

  // Get all users
  const users = await User.find({});
  console.log(`👥 Found ${users.length} users to migrate\n`);

  let migrated = 0;
  let errors = 0;

  for (const user of users) {
    try {
      let newRole = 'client'; // Default role changed from 'user' to 'client'
      
      // Determine role based on email
      if (adminEmails.includes(user.email)) {
        newRole = 'admin';
      } else if (clientEmails.includes(user.email)) {
        newRole = 'client';
      } else if (pilotEmails.includes(user.email)) {
        newRole = 'pilot';
      }

      // Only update if role is different from current (or if no role is set)
      if (user.role !== newRole) {
        // Set metadata for role change tracking
        user._roleChangedBy = 'migration-script';
        user._roleChangeReason = `Migrated from environment-based roles (${user.role || 'unset'} → ${newRole})`;
        
        user.role = newRole;
        await user.save();
        
        console.log(`✅ ${user.email}: ${user.role || 'unset'} → ${newRole}`);
        migrated++;
      } else {
        console.log(`⏭️  ${user.email}: ${newRole} (no change)`);
      }
    } catch (error) {
      console.error(`❌ Error migrating ${user.email}:`, error.message);
      errors++;
    }
  }

  console.log(`\n🎉 Migration complete!`);
  console.log(`   ✅ Migrated: ${migrated} users`);
  console.log(`   ⏭️  Unchanged: ${users.length - migrated - errors} users`);
  console.log(`   ❌ Errors: ${errors} users`);

  if (errors === 0) {
    console.log('\n🔄 Next steps:');
    console.log('   1. Update your userRoles.js to use database-based roles');
    console.log('   2. Test the new role system');
    console.log('   3. Remove environment variables from .env (optional)');
  }
};

const main = async () => {
  try {
    await connectDB();
    await migrateRoles();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

// Run the migration
main();