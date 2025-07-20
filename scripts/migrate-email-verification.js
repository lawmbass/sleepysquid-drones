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

    // Update all existing users to have emailVerified: false if not already set
    const result = await User.updateMany(
      { emailVerified: { $exists: false } },
      { 
        $set: { 
          emailVerified: false
        }
      }
    );

    console.log(`✅ Migration completed: ${result.modifiedCount} users updated`);

    // Show some stats
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ emailVerified: true });
    const unverifiedUsers = await User.countDocuments({ emailVerified: false });

    console.log('\n📊 Email Verification Stats:');
    console.log(`Total users: ${totalUsers}`);
    console.log(`Verified users: ${verifiedUsers}`);
    console.log(`Unverified users: ${unverifiedUsers}`);

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