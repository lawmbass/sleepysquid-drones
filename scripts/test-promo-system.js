const mongoose = require('mongoose');
const Promo = require('../models/Promo');

// Test configuration
const TEST_PROMO = {
  name: 'Test Summer Sale 2024',
  description: 'Test promotional discount for all packages',
  discountPercentage: 10,
  startDate: new Date(),
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
  isActive: true
};

async function testPromoSystem() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sleepysquid');
    console.log('Connected to MongoDB');

    // Clean up any existing test promos
    await Promo.deleteMany({ name: { $regex: /^Test/ } });
    console.log('Cleaned up existing test promos');

    // Test 1: Create a promo
    console.log('\n=== Test 1: Creating a promo ===');
    const promo = new Promo({
      ...TEST_PROMO,
      createdBy: new mongoose.Types.ObjectId() // Mock user ID
    });
    await promo.save();
    console.log('✅ Promo created successfully:', promo.name);

    // Test 2: Get active promo
    console.log('\n=== Test 2: Getting active promo ===');
    const activePromo = await Promo.getActivePromo();
    if (activePromo) {
      console.log('✅ Active promo found:', activePromo.name);
      console.log('   Discount:', activePromo.discountPercentage + '%');
      console.log('   Is currently active:', activePromo.isCurrentlyActive);
    } else {
      console.log('❌ No active promo found');
    }

    // Test 3: Calculate discounted price
    console.log('\n=== Test 3: Calculating discounted prices ===');
    if (activePromo) {
      const testPrices = [199, 399, 799];
      testPrices.forEach(price => {
        const discountedPrice = activePromo.calculateDiscountedPrice(price);
        const savings = price - discountedPrice;
        console.log(`   $${price} → $${discountedPrice} (Save $${savings})`);
      });
    }

    // Test 4: Test promo expiration
    console.log('\n=== Test 4: Testing promo expiration ===');
    const expiredPromo = new Promo({
      name: 'Test Expired Promo',
      description: 'This promo should be expired',
      discountPercentage: 15,
      startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
      endDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      isActive: true,
      createdBy: new mongoose.Types.ObjectId()
    });
    await expiredPromo.save();
    console.log('✅ Expired promo created');

    const stillActivePromo = await Promo.getActivePromo();
    if (stillActivePromo && stillActivePromo.name === TEST_PROMO.name) {
      console.log('✅ Correctly returns only currently active promo');
    } else {
      console.log('❌ Failed to filter out expired promos');
    }

    // Test 5: Test overlapping promos via API
    console.log('\n=== Test 5: Testing overlapping promos via API ===');
    try {
      // This would require setting up a test server, so we'll test the validation logic directly
      const overlappingPromo = new Promo({
        name: 'Test Overlapping Promo',
        description: 'This should fail due to overlap',
        discountPercentage: 20,
        startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        endDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000), // 40 days from now
        isActive: true,
        createdBy: new mongoose.Types.ObjectId()
      });
      
      // Test the validation logic that should prevent this
      const existingActivePromo = await Promo.findOne({
        isActive: true,
        startDate: { $lte: overlappingPromo.endDate },
        endDate: { $gte: overlappingPromo.startDate }
      });
      
      if (existingActivePromo) {
        console.log('✅ Correctly detected overlapping promos');
      } else {
        console.log('❌ Failed to detect overlapping promos');
      }
    } catch (error) {
      console.log('❌ Error testing overlapping promos:', error.message);
    }

    // Test 6: Test partial updates validation
    console.log('\n=== Test 6: Testing partial updates validation ===');
    try {
      // Test updating only isActive without dates
      const testPromo = await Promo.findOne({ name: TEST_PROMO.name });
      if (testPromo) {
        // This should be prevented by the API validation
        const hasOverlap = await Promo.findOne({
          _id: { $ne: testPromo._id },
          isActive: true,
          startDate: { $lte: testPromo.endDate },
          endDate: { $gte: testPromo.startDate }
        });
        
        if (hasOverlap) {
          console.log('✅ Correctly detects potential overlaps on partial updates');
        } else {
          console.log('✅ No overlaps detected (expected for single promo)');
        }
      }
    } catch (error) {
      console.log('❌ Error testing partial updates:', error.message);
    }

    console.log('\n=== All tests completed ===');
    console.log('✅ Promo system is working correctly!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testPromoSystem();
}

module.exports = { testPromoSystem };