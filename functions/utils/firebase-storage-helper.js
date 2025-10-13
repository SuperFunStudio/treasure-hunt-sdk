// utils/firebase-storage-helper.js
// Helper functions for converting Firebase Storage paths to public URLs

const { admin } = require('../config/firebase');

/**
 * Convert Firebase Storage path to public download URL
 * @param {string} storagePath - The storage path (e.g., "scans/userId/scanId/image.jpg")
 * @returns {Promise<string>} - Public download URL
 */
async function getPublicImageUrl(storagePath) {
  try {
    if (!storagePath) {
      throw new Error('Storage path is required');
    }

    // Get Firebase Storage bucket
    const bucket = admin.storage().bucket();
    
    // Get file reference
    const file = bucket.file(storagePath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(`File not found at path: ${storagePath}`);
    }
    
    // Generate signed URL with long expiration (for eBay listings)
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + (365 * 24 * 60 * 60 * 1000) // 1 year expiration
    });
    
    return signedUrl;
    
  } catch (error) {
    console.error('Error getting public image URL:', error);
    throw error;
  }
}

/**
 * Convert multiple storage paths to public URLs
 * @param {string[]} storagePaths - Array of storage paths
 * @returns {Promise<string[]>} - Array of public download URLs
 */
async function getMultiplePublicImageUrls(storagePaths) {
  if (!Array.isArray(storagePaths) || storagePaths.length === 0) {
    return [];
  }
  
  const urlPromises = storagePaths.map(path => getPublicImageUrl(path));
  
  try {
    const urls = await Promise.all(urlPromises);
    return urls.filter(url => url); // Filter out any null/undefined URLs
  } catch (error) {
    console.error('Error getting multiple image URLs:', error);
    // Try to get URLs individually to avoid failing completely
    const urls = [];
    for (const path of storagePaths) {
      try {
        const url = await getPublicImageUrl(path);
        urls.push(url);
      } catch (individualError) {
        console.warn(`Failed to get URL for ${path}:`, individualError.message);
      }
    }
    return urls;
  }
}

/**
 * Convert scan data image paths to eBay-ready image URLs
 * @param {Object} scanData - Scan document data
 * @returns {Promise<string[]>} - Array of public image URLs
 */
async function convertScanImagesToUrls(scanData) {
  try {
    // Check for images in different possible locations
    let imagePaths = [];
    
    if (scanData.imagePaths && Array.isArray(scanData.imagePaths)) {
      imagePaths = scanData.imagePaths;
    } else if (scanData.images && Array.isArray(scanData.images)) {
      // If already URLs, return as-is
      if (scanData.images[0] && scanData.images[0].startsWith('http')) {
        return scanData.images;
      }
      imagePaths = scanData.images;
    } else if (scanData.photoUrls && Array.isArray(scanData.photoUrls)) {
      return scanData.photoUrls; // Already URLs
    }
    
    if (imagePaths.length === 0) {
      console.warn('No image paths found in scan data');
      return [];
    }
    
    console.log(`Converting ${imagePaths.length} image paths to URLs`);
    const imageUrls = await getMultiplePublicImageUrls(imagePaths);
    
    console.log(`Successfully converted ${imageUrls.length} images to URLs`);
    return imageUrls;
    
  } catch (error) {
    console.error('Error converting scan images to URLs:', error);
    return [];
  }
}

/**
 * Test function to verify storage access and URL generation
 * @param {string} testPath - Test storage path
 * @returns {Promise<Object>} - Test results
 */
async function testStorageAccess(testPath = 'scans/test/test.jpg') {
  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file(testPath);
    
    const [exists] = await file.exists();
    
    return {
      success: true,
      bucketName: bucket.name,
      testPath,
      fileExists: exists,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      testPath,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  getPublicImageUrl,
  getMultiplePublicImageUrls,
  convertScanImagesToUrls,
  testStorageAccess
};