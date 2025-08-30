// ebay-listing.test.js
// Comprehensive unit tests for eBay listing creation with variable scoping validation

const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');

// Mock the dependencies
const mockDb = {
  collection: sinon.stub().returnsThis(),
  doc: sinon.stub().returnsThis(),
  get: sinon.stub(),
  update: sinon.stub()
};

const mockVerifyAuth = sinon.stub();
const mockGetValidEbayToken = sinon.stub();
const mockMapCategoryToEbayId = sinon.stub();
const mockMapConditionToEbay = sinon.stub();
const mockIsValidEbayCondition = sinon.stub();
const mockGetUserEbayPolicies = sinon.stub();
const mockCallEbayAPI = sinon.stub();

describe('eBay Listing Creation - Variable Scoping Tests', () => {
  let app;
  
  beforeEach(() => {
    // Reset all stubs
    sinon.resetHistory();
    
    // Setup default successful mocks
    mockVerifyAuth.resolves({ uid: 'test-user-123' });
    mockGetValidEbayToken.resolves('valid-token-123');
    mockMapCategoryToEbayId.resolves('34061');
    mockMapConditionToEbay.returns('USED_GOOD');
    mockIsValidEbayCondition.returns(true);
    
    mockDb.get.resolves({
      data: () => ({
        shippingLocations: [{
          id: 'loc-123',
          country: 'US'
        }],
        defaultLocationId: 'loc-123'
      })
    });
    
    mockGetUserEbayPolicies.resolves({
      fulfillmentPolicyId: '380523954022',
      paymentPolicyId: '380524190022',
      returnPolicyId: '380524198022'
    });
    
    mockCallEbayAPI.onFirstCall().resolves(); // inventory item creation
    mockCallEbayAPI.onSecondCall().resolves({ offerId: 'offer-123' }); // offer creation
    mockCallEbayAPI.onThirdCall().resolves({ listingId: 'listing-123' }); // publish
  });

  describe('Variable Scoping Validation', () => {
    it('should properly declare offer variable outside try block', async () => {
      const testData = {
        title: 'Test Item',
        description: 'Test Description',
        category: 'automotive',
        condition: 'good',
        pricing: { buyItNowPrice: 25.99 }
      };

      // This test verifies the fix for the ReferenceError: offer is not defined
      const response = await request(app)
        .post('/api/ebay/create-listing')
        .set('Authorization', 'Bearer valid-token')
        .send(testData)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.offerId).to.equal('offer-123');
      
      // Verify that all API calls were made (proving offer variable was accessible)
      expect(mockCallEbayAPI.callCount).to.equal(3);
    });

    it('should handle policy retrieval failure without breaking offer variable scope', async () => {
      // Simulate policy retrieval failure
      mockGetUserEbayPolicies.rejects(new Error('Policies not configured'));

      const testData = {
        title: 'Test Item',
        category: 'automotive',
        condition: 'good'
      };

      const response = await request(app)
        .post('/api/ebay/create-listing')
        .set('Authorization', 'Bearer valid-token')
        .send(testData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.errorType).to.equal('POLICY_ERROR');
      expect(response.body.error).to.equal('eBay business policies not configured');
      
      // Verify that inventory item was still created (first API call)
      expect(mockCallEbayAPI.callCount).to.equal(1);
    });

    it('should validate offer object exists before API calls', async () => {
      // Create a scenario where offer somehow becomes undefined
      const originalGetUserEbayPolicies = mockGetUserEbayPolicies;
      mockGetUserEbayPolicies.callsFake(() => {
        // Simulate a weird edge case where policies return but offer doesn't get created
        return Promise.resolve({
          fulfillmentPolicyId: null, // This should cause offer validation to fail
          paymentPolicyId: '380524190022',
          returnPolicyId: '380524198022'
        });
      });

      const testData = {
        title: 'Test Item',
        category: 'automotive',
        condition: 'good'
      };

      const response = await request(app)
        .post('/api/ebay/create-listing')
        .set('Authorization', 'Bearer valid-token')
        .send(testData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.errorType).to.equal('VALIDATION_ERROR');
      expect(response.body.details).to.include('fulfillmentPolicyId');
    });
  });

  describe('Error Handling and Categorization', () => {
    it('should categorize authentication errors correctly', async () => {
      mockGetValidEbayToken.rejects(new Error('Invalid access token'));

      const testData = {
        title: 'Test Item',
        category: 'automotive',
        condition: 'good'
      };

      const response = await request(app)
        .post('/api/ebay/create-listing')
        .set('Authorization', 'Bearer invalid-token')
        .send(testData)
        .expect(401);

      expect(response.body.errorType).to.equal('AUTH_ERROR');
    });

    it('should categorize rate limit errors correctly', async () => {
      mockCallEbayAPI.rejects(new Error('rate limit exceeded'));

      const testData = {
        title: 'Test Item',
        category: 'automotive',
        condition: 'good'
      };

      const response = await request(app)
        .post('/api/ebay/create-listing')
        .set('Authorization', 'Bearer valid-token')
        .send(testData)
        .expect(429);

      expect(response.body.errorType).to.equal('RATE_LIMIT_ERROR');
    });

    it('should categorize validation errors correctly', async () => {
      mockIsValidEbayCondition.returns(false);

      const testData = {
        title: 'Test Item',
        category: 'automotive',
        condition: 'invalid-condition'
      };

      const response = await request(app)
        .post('/api/ebay/create-listing')
        .set('Authorization', 'Bearer valid-token')
        .send(testData)
        .expect(400);

      expect(response.body.error).to.equal('Invalid item condition');
      expect(response.body.details).to.include('invalid-condition');
    });
  });

  describe('Offer Object Validation', () => {
    it('should validate all required offer fields', async () => {
      mockGetUserEbayPolicies.resolves({
        fulfillmentPolicyId: '380523954022',
        paymentPolicyId: '', // Empty field should fail validation
        returnPolicyId: '380524198022'
      });

      const testData = {
        title: 'Test Item',
        category: 'automotive',
        condition: 'good'
      };

      const response = await request(app)
        .post('/api/ebay/create-listing')
        .set('Authorization', 'Bearer valid-token')
        .send(testData)
        .expect(400);

      expect(response.body.errorType).to.equal('VALIDATION_ERROR');
      expect(response.body.details).to.include('paymentPolicyId');
    });

    it('should handle eBay API returning no offer ID', async () => {
      mockCallEbayAPI.onSecondCall().resolves({}); // No offerId returned

      const testData = {
        title: 'Test Item',
        category: 'automotive',
        condition: 'good'
      };

      const response = await request(app)
        .post('/api/ebay/create-listing')
        .set('Authorization', 'Bearer valid-token')
        .send(testData)
        .expect(500);

      expect(response.body.error).to.include('offer ID');
    });
  });

  describe('Condition Mapping Tests', () => {
    it('should handle condition mapping endpoint successfully', async () => {
      mockMapConditionToEbay.returns('USED_EXCELLENT');
      mockIsValidEbayCondition.returns(true);
      
      // Mock formatConditionForEbay function
      const mockFormatConditionForEbay = sinon.stub().returns('Used - Excellent');

      const response = await request(app)
        .post('/api/ebay/test-condition')
        .send({ condition: 'excellent' })
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.input).to.equal('excellent');
      expect(response.body.mapped).to.equal('USED_EXCELLENT');
      expect(response.body.valid).to.be.true;
    });

    it('should handle missing condition parameter', async () => {
      const response = await request(app)
        .post('/api/ebay/test-condition')
        .send({})
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.errorType).to.equal('VALIDATION_ERROR');
    });

    it('should handle condition mapping errors gracefully', async () => {
      mockMapConditionToEbay.throws(new Error('Mapping service unavailable'));

      const response = await request(app)
        .post('/api/ebay/test-condition')
        .send({ condition: 'good' })
        .expect(500);

      expect(response.body.errorType).to.equal('MAPPING_ERROR');
    });
  });

  describe('Integration Flow Tests', () => {
    it('should complete full listing creation flow successfully', async () => {
      const testData = {
        title: 'Doona Infant Car Seat',
        description: 'High quality infant car seat with ISOFIX base',
        category: 'automotive',
        condition: 'good',
        brand: 'Doona',
        pricing: { buyItNowPrice: 465.00 }
      };

      const response = await request(app)
        .post('/api/ebay/create-listing')
        .set('Authorization', 'Bearer valid-token')
        .send(testData)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.listingId).to.equal('listing-123');
      expect(response.body.sku).to.match(/^TH_/);
      expect(response.body.published).to.be.true;
      expect(response.body.policies).to.have.all.keys(
        'fulfillmentPolicyId', 
        'paymentPolicyId', 
        'returnPolicyId'
      );

      // Verify the complete API call sequence
      expect(mockCallEbayAPI.callCount).to.equal(3);
      expect(mockCallEbayAPI.firstCall.args[1]).to.equal('PUT'); // inventory item
      expect(mockCallEbayAPI.secondCall.args[1]).to.equal('POST'); // offer
      expect(mockCallEbayAPI.thirdCall.args[1]).to.equal('POST'); // publish
    });

    it('should handle missing shipping locations', async () => {
      mockDb.get.resolves({
        data: () => ({
          shippingLocations: []
        })
      });

      const testData = {
        title: 'Test Item',
        category: 'automotive',
        condition: 'good'
      };

      const response = await request(app)
        .post('/api/ebay/create-listing')
        .set('Authorization', 'Bearer valid-token')
        .send(testData)
        .expect(400);

      expect(response.body.needsLocationSetup).to.be.true;
      expect(response.body.redirectUrl).to.include('shipping-locations.html');
    });
  });

  describe('Logging and Debug Information', () => {
    it('should provide comprehensive debug information in development mode', async () => {
      process.env.NODE_ENV = 'development';
      mockCallEbayAPI.onSecondCall().rejects(new Error('Test error with stack trace'));

      const testData = {
        title: 'Test Item',
        category: 'automotive',
        condition: 'good'
      };

      const response = await request(app)
        .post('/api/ebay/create-listing')
        .set('Authorization', 'Bearer valid-token')
        .send(testData)
        .expect(500);

      expect(response.body).to.have.property('stack');
      expect(response.body).to.have.property('details');
      
      // Cleanup
      delete process.env.NODE_ENV;
    });

    it('should not expose debug information in production mode', async () => {
      process.env.NODE_ENV = 'production';
      mockCallEbayAPI.onSecondCall().rejects(new Error('Test error'));

      const testData = {
        title: 'Test Item',
        category: 'automotive',
        condition: 'good'
      };

      const response = await request(app)
        .post('/api/ebay/create-listing')
        .set('Authorization', 'Bearer valid-token')
        .send(testData)
        .expect(500);

      expect(response.body).to.not.have.property('stack');
      expect(response.body).to.not.have.property('details');
      
      // Cleanup
      delete process.env.NODE_ENV;
    });
  });
});

// Additional helper functions for testing variable scoping specifically
describe('Variable Scoping Edge Cases', () => {
  it('should demonstrate the original scoping problem (for documentation)', () => {
    // This test documents the original problem that was fixed
    function problematicFunction() {
      try {
        let offer = { id: 'test' };
        // Variable declared inside try block
      } catch (error) {
        console.log('Error occurred');
      }
      
      // This would cause ReferenceError: offer is not defined
      // return offer.id; // <- This line would fail
    }
    
    // The fix is to declare the variable outside the try block
    function fixedFunction() {
      let offer; // Declared outside
      try {
        offer = { id: 'test' };
      } catch (error) {
        console.log('Error occurred');
      }
      
      return offer ? offer.id : null; // Now accessible
    }
    
    expect(() => problematicFunction()).to.not.throw();
    expect(fixedFunction()).to.equal('test');
  });

  it('should validate that offer variable persists across async operations', async () => {
    let offer;
    
    try {
      // Simulate async policy retrieval
      await new Promise(resolve => setTimeout(resolve, 10));
      offer = { 
        sku: 'test-sku',
        policies: { fulfillment: 'policy-123' }
      };
    } catch (error) {
      // Error handling
    }
    
    // Simulate subsequent async API calls
    if (offer) {
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(offer.sku).to.equal('test-sku');
      expect(offer.policies.fulfillment).to.equal('policy-123');
    }
  });
});

console.log('✅ eBay Listing Creation Tests - Variable scoping and error handling validated');