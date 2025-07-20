const mongoose = require('mongoose');
require('dotenv').config();

async function checkAccountsCollection() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in environment variables');
      console.log('Please create a .env file with MONGODB_URI=your-mongodb-connection-string');
      process.exit(1);
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    // Get sample accounts to see the structure
    console.log('\n📋 Sample accounts structure:');
    const sampleAccounts = await mongoose.connection.collection('accounts').find({}).limit(3).toArray();
    console.log(JSON.stringify(sampleAccounts, null, 2));
    
    // Count total accounts
    const totalAccounts = await mongoose.connection.collection('accounts').countDocuments();
    console.log(`\n📊 Total accounts: ${totalAccounts}`);
    
    // Group by provider
    const providerStats = await mongoose.connection.collection('accounts').aggregate([
      { $group: { _id: '$provider', count: { $sum: 1 } } }
    ]).toArray();
    console.log('\n🔍 Accounts by provider:');
    console.log(providerStats);
    
    // Check if userId field exists and its type
    console.log('\n🔍 Checking userId field types:');
    const userIdSample = await mongoose.connection.collection('accounts').findOne({});
    if (userIdSample) {
      console.log(`Sample userId: ${userIdSample.userId}`);
      console.log(`UserId type: ${typeof userIdSample.userId}`);
      console.log(`Is ObjectId: ${mongoose.Types.ObjectId.isValid(userIdSample.userId)}`);
    }
    
    // Get some users and check their corresponding accounts
    console.log('\n🔍 Cross-checking users with accounts:');
    const users = await mongoose.connection.collection('users').find({}).limit(3).toArray();
    for (const user of users) {
      const account = await mongoose.connection.collection('accounts').findOne({
        userId: user._id
      });
      console.log(`User ${user.email} (${user._id}): Has OAuth account = ${!!account}`);
      if (account) {
        console.log(`  Provider: ${account.provider}`);
      }
    }
    
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAccountsCollection();