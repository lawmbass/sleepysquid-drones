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

// User schema (simplified for migration)
const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', userSchema);

const migrateEmailVerification = async () => {
  try {
    console.log('🔄 Starting email verification migration...');

    // Get all users with OAuth accounts (Google, etc.)
    const oauthUsers = await mongoose.connection.collection('accounts').distinct('userId');
    console.log(`Found ${oauthUsers.length} users with OAuth accounts`);

    // Mark OAuth users as verified (they signed up through Google/OAuth)
    const oauthResult = await User.updateMany(
      { 
        _id: { $in: oauthUsers },
        'emailVerification.verified': { $exists: false }
      },
      { 
        $set: { 
          'emailVerification.verified': true
        }
      }
    );

    console.log(`✅ Marked ${oauthResult.modifiedCount} OAuth users as email verified`);

    // Update remaining users to have emailVerification.verified: false if not already set
    const regularUsersResult = await User.updateMany(
      { 
        _id: { $nin: oauthUsers },
        'emailVerification.verified': { $exists: false }
      },
      { 
        $set: { 
          'emailVerification.verified': false
        }
      }
    );

    console.log(`✅ Marked ${regularUsersResult.modifiedCount} regular users as email unverified`);

    // Show some stats
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ 'emailVerification.verified': true });
    const unverifiedUsers = await User.countDocuments({ 'emailVerification.verified': false });

    console.log('\n📊 Email Verification Stats:');
    console.log(`Total users: ${totalUsers}`);
    console.log(`Verified users: ${verifiedUsers} (includes OAuth users)`);
    console.log(`Unverified users: ${unverifiedUsers}`);
    console.log(`OAuth users automatically verified: ${oauthResult.modifiedCount}`);

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
  await migrateEmailVerification();
};

main();