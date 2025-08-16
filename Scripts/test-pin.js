// test-pin.js - Test creating a pin
import fetch from 'node-fetch';

async function testPinCreation() {
  try {
    const pinData = {
      location: {
        latitude: 40.7128,  // NYC coordinates
        longitude: -74.0060
      },
      item: {
        category: "furniture",
        title: "Bamboo Side Table",
        description: "Good condition bamboo table found on street",
        confidence: 8,
        condition: {
          rating: "good",
          description: "Minor scratches but fully functional"
        }
      },
      expiresIn: 4 * 60 * 60 * 1000  // 4 hours
    };

    console.log('Creating pin with data:', pinData);

    const response = await fetch('http://localhost:3000/api/pins', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pinData)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Pin created successfully!');
      console.log('Pin ID:', result.pin.id);
      console.log('Full response:', JSON.stringify(result, null, 2));
    } else {
      console.error('❌ Error:', result);
    }

  } catch (error) {
    console.error('❌ Failed to create pin:', error);
  }
}

// Test nearby pins
async function testNearbyPins() {
  try {
    console.log('\nFetching nearby pins...');
    
    const response = await fetch('http://localhost:3000/api/pins/nearby?lat=40.7128&lng=-74.0060&radius=5000');
    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ Found ${result.count} nearby pins`);
      console.log('Pins:', JSON.stringify(result.pins, null, 2));
    } else {
      console.error('❌ Error:', result);
    }
  } catch (error) {
    console.error('❌ Failed to fetch pins:', error);
  }
}

// Run tests
console.log('🧪 Testing Pin Creation with Firebase...\n');
testPinCreation()
  .then(() => {
    // Wait a bit then test fetching
    setTimeout(testNearbyPins, 2000);
  });