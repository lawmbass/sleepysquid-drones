const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in environment variables');
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

const fixNullEmailVerification = async () => {
  try {
    console.log('🔄 Fixing null emailVerification.verified values...');

    // Find users with null emailVerification.verified
    const usersWithNull = await User.find({
      'emailVerification.verified': null
    });

    console.log(`Found ${usersWithNull.length} users with null emailVerification.verified`);

    if (usersWithNull.length === 0) {
      console.log('✅ No users with null values found');
      return;
    }

    let fixedCount = 0;

    for (const user of usersWithNull) {
      // Check if this user has OAuth accounts
      const userOAuthAccount = await mongoose.connection.collection('accounts').findOne({
        userId: user._id
      });
      const isOAuthUser = !!userOAuthAccount;

      console.log(`User ${user.email}: OAuth=${isOAuthUser}`);

      // Update the user with correct boolean value
      await User.findByIdAndUpdate(user._id, {
        'emailVerification.verified': isOAuthUser
      });

      fixedCount++;
    }

    console.log(`✅ Fixed ${fixedCount} users`);

    // Show final stats
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ 'emailVerification.verified': true });
    const unverifiedUsers = await User.countDocuments({ 'emailVerification.verified': false });
    const nullUsers = await User.countDocuments({ 'emailVerification.verified': null });

    console.log('\n📊 Final Email Verification Stats:');
    console.log(`Total users: ${totalUsers}`);
    console.log(`Verified users: ${verifiedUsers}`);
    console.log(`Unverified users: ${unverifiedUsers}`);
    console.log(`Null users: ${nullUsers}`);

  } catch (error) {
    console.error('❌ Fix error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run fix
const main = async () => {
  await connectDB();
  await fixNullEmailVerification();
};

main();