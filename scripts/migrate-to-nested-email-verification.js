const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in environment variables');
      console.log('ℹ️  Please create a .env file with MONGODB_URI or set the environment variable');
      process.exit(1);
    }

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// User schema (flexible for migration)
const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', userSchema);

const migrateToNestedStructure = async () => {
  try {
    console.log('🔄 Starting migration to nested email verification structure...');

    // Find users with old flat structure
    const usersWithOldStructure = await User.find({
      $or: [
        { emailVerified: { $exists: true } },
        { emailVerificationToken: { $exists: true } },
        { emailVerificationExpires: { $exists: true } },
        { pendingEmail: { $exists: true } },
        { pendingEmailToken: { $exists: true } },
        { pendingEmailExpires: { $exists: true } }
      ]
    });

    console.log(`Found ${usersWithOldStructure.length} users with old structure`);

    let migratedCount = 0;

    for (const user of usersWithOldStructure) {
      const updateData = {};
      const unsetData = {};

      // Migrate emailVerified -> emailVerification.verified
      if (user.emailVerified !== undefined) {
        updateData['emailVerification.verified'] = user.emailVerified;
        unsetData.emailVerified = 1;
      }

      // Migrate emailVerificationToken -> emailVerification.token
      if (user.emailVerificationToken !== undefined) {
        updateData['emailVerification.token'] = user.emailVerificationToken;
        unsetData.emailVerificationToken = 1;
      }

      // Migrate emailVerificationExpires -> emailVerification.expires
      if (user.emailVerificationExpires !== undefined) {
        updateData['emailVerification.expires'] = user.emailVerificationExpires;
        unsetData.emailVerificationExpires = 1;
      }

      // Migrate pendingEmail -> pendingEmailChange.email
      if (user.pendingEmail !== undefined) {
        updateData['pendingEmailChange.email'] = user.pendingEmail;
        unsetData.pendingEmail = 1;
      }

      // Migrate pendingEmailToken -> pendingEmailChange.token
      if (user.pendingEmailToken !== undefined) {
        updateData['pendingEmailChange.token'] = user.pendingEmailToken;
        unsetData.pendingEmailToken = 1;
      }

      // Migrate pendingEmailExpires -> pendingEmailChange.expires
      if (user.pendingEmailExpires !== undefined) {
        updateData['pendingEmailChange.expires'] = user.pendingEmailExpires;
        unsetData.pendingEmailExpires = 1;
      }

      // Perform the migration for this user
      if (Object.keys(updateData).length > 0) {
        const updateOperation = { $set: updateData };
        if (Object.keys(unsetData).length > 0) {
          updateOperation.$unset = unsetData;
        }

        await User.findByIdAndUpdate(user._id, updateOperation);
        migratedCount++;

        if (migratedCount % 10 === 0) {
          console.log(`Migrated ${migratedCount}/${usersWithOldStructure.length} users...`);
        }
      }
    }

    console.log(`✅ Migration completed: ${migratedCount} users migrated`);

    // Show some stats
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ 'emailVerification.verified': true });
    const unverifiedUsers = await User.countDocuments({ 'emailVerification.verified': false });
    const usersWithPendingChanges = await User.countDocuments({ 'pendingEmailChange.email': { $exists: true } });

    console.log('\n📊 Email Verification Stats After Migration:');
    console.log(`Total users: ${totalUsers}`);
    console.log(`Verified users: ${verifiedUsers}`);
    console.log(`Unverified users: ${unverifiedUsers}`);
    console.log(`Users with pending email changes: ${usersWithPendingChanges}`);

    // Verify no old fields remain
    const usersWithOldFields = await User.countDocuments({
      $or: [
        { emailVerified: { $exists: true } },
        { emailVerificationToken: { $exists: true } },
        { emailVerificationExpires: { $exists: true } },
        { pendingEmail: { $exists: true } },
        { pendingEmailToken: { $exists: true } },
        { pendingEmailExpires: { $exists: true } }
      ]
    });

    if (usersWithOldFields === 0) {
      console.log('✅ All old fields successfully migrated and removed');
    } else {
      console.log(`⚠️  ${usersWithOldFields} users still have old fields`);
    }

  } catch (error) {
    console.error('❌ Migration error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run migration
const main = async () => {
  await connectDB();
  await migrateToNestedStructure();
};

main();