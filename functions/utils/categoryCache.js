// utils/categoryCache.js
// Cache management for eBay category requirements

class CategoryCache {
  constructor(db, admin) {
    this.db = db;
    this.admin = admin;
    this.memoryCache = new Map();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    
    // Cache configuration
    this.MEMORY_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
    this.FIRESTORE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
    this.MAX_MEMORY_CACHE_SIZE = 100;
  }

  /**
   * Get cached requirements with multi-level caching strategy
   */
  async getCachedRequirements(categoryId) {
    console.log(`Cache lookup for category: ${categoryId}`);
    
    try {
      // Level 1: Memory cache (fastest)
      const memoryResult = this.getFromMemoryCache(categoryId);
      if (memoryResult) {
        console.log(`Memory cache hit for category ${categoryId}`);
        this.cacheHits++;
        return memoryResult;
      }

      // Level 2: Firestore cache
      const firestoreResult = await this.getFromFirestoreCache(categoryId);
      if (firestoreResult && !this.isCacheStale(firestoreResult, this.FIRESTORE_CACHE_TTL)) {
        console.log(`Firestore cache hit for category ${categoryId}`);
        
        // Store in memory cache for faster future access
        this.setMemoryCache(categoryId, firestoreResult);
        this.cacheHits++;
        return firestoreResult;
      }

      // Cache miss
      console.log(`Cache miss for category ${categoryId}`);
      this.cacheMisses++;
      return null;

    } catch (error) {
      console.error('Cache lookup error:', error);
      this.cacheMisses++;
      return null;
    }
  }

  /**
   * Store requirements in both cache levels
   */
  async setCachedRequirements(categoryId, requirements) {
    try {
      // Add timestamp
      const timestampedRequirements = {
        ...requirements,
        lastUpdated: new Date(),
        cacheVersion: '1.0'
      };

      // Store in memory cache
      this.setMemoryCache(categoryId, timestampedRequirements);

      // Store in Firestore cache
      await this.setFirestoreCache(categoryId, timestampedRequirements);

      console.log(`Cached requirements for category ${categoryId}`);
      return true;

    } catch (error) {
      console.error('Cache storage error:', error);
      return false;
    }
  }

  /**
   * Get from memory cache
   */
  getFromMemoryCache(categoryId) {
    const cached = this.memoryCache.get(categoryId);
    
    if (!cached) return null;

    // Check TTL
    if (this.isCacheStale(cached, this.MEMORY_CACHE_TTL)) {
      this.memoryCache.delete(categoryId);
      return null;
    }

    return cached.data;
  }

  /**
   * Set memory cache with size management
   */
  setMemoryCache(categoryId, data) {
    // Implement LRU eviction if cache is full
    if (this.memoryCache.size >= this.MAX_MEMORY_CACHE_SIZE) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }

    this.memoryCache.set(categoryId, {
      data: data,
      timestamp: Date.now()
    });
  }

  /**
   * Get from Firestore cache
   */
  async getFromFirestoreCache(categoryId) {
    if (!this.db) return null;

    try {
      const doc = await this.db
        .collection('system')
        .doc('category_requirements')
        .collection('categories')
        .doc(categoryId)
        .get();

      if (!doc.exists) return null;

      const data = doc.data();
      return {
        ...data,
        lastUpdated: data.lastUpdated?.toDate() || new Date()
      };

    } catch (error) {
      console.error('Firestore cache read error:', error);
      return null;
    }
  }

  /**
   * Set Firestore cache
   */
  async setFirestoreCache(categoryId, data) {
    if (!this.db) return false;

    try {
      await this.db
        .collection('system')
        .doc('category_requirements')
        .collection('categories')
        .doc(categoryId)
        .set({
          ...data,
          lastUpdated: this.admin.firestore.FieldValue.serverTimestamp(),
          categoryId: categoryId
        });

      return true;

    } catch (error) {
      console.error('Firestore cache write error:', error);
      return false;
    }
  }

  /**
   * Check if cached data is stale
   */
  isCacheStale(cachedData, ttl) {
    if (!cachedData?.lastUpdated) return true;

    const lastUpdated = cachedData.lastUpdated instanceof Date ? 
      cachedData.lastUpdated : 
      new Date(cachedData.lastUpdated);

    const age = Date.now() - lastUpdated.getTime();
    return age > ttl;
  }

  /**
   * Invalidate cache for specific category
   */
  async invalidateCache(categoryId) {
    try {
      // Remove from memory cache
      this.memoryCache.delete(categoryId);

      // Remove from Firestore cache
      if (this.db) {
        await this.db
          .collection('system')
          .doc('category_requirements')
          .collection('categories')
          .doc(categoryId)
          .delete();
      }

      console.log(`Invalidated cache for category ${categoryId}`);
      return true;

    } catch (error) {
      console.error('Cache invalidation error:', error);
      return false;
    }
  }

  /**
   * Clear all cached data
   */
  async clearAllCache() {
    try {
      // Clear memory cache
      this.memoryCache.clear();

      // Clear Firestore cache
      if (this.db) {
        const snapshot = await this.db
          .collection('system')
          .doc('category_requirements')
          .collection('categories')
          .get();

        const batch = this.db.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });

        await batch.commit();
      }

      // Reset metrics
      this.cacheHits = 0;
      this.cacheMisses = 0;

      console.log('Cleared all category requirements cache');
      return true;

    } catch (error) {
      console.error('Cache clear error:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const totalRequests = this.cacheHits + this.cacheMisses;
    const hitRate = totalRequests > 0 ? (this.cacheHits / totalRequests) * 100 : 0;

    return {
      memorySize: this.memoryCache.size,
      maxMemorySize: this.MAX_MEMORY_CACHE_SIZE,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRate: hitRate.toFixed(2) + '%',
      totalRequests: totalRequests
    };
  }

  /**
   * Preload common categories into cache
   */
  async preloadCommonCategories(categoryService) {
    const commonCategories = [
      '41859', // Headphones
      '57972', // Athletic Shoes  
      '11450', // Unisex Adult Clothing
      '20081', // Home Furniture
      '6030',  // Automotive Parts
      '888',   // Sporting Goods
      '281',   // Jewelry & Watches
      '267',   // Books
      '220',   // Toys & Hobbies
      '1',     // Collectibles
      '11700'  // Home & Garden
    ];

    console.log('Preloading common categories...');
    
    for (const categoryId of commonCategories) {
      try {
        const cached = await this.getCachedRequirements(categoryId);
        if (!cached) {
          // Fetch and cache if not present
          const requirements = await categoryService.fetchCategoryRequirements(categoryId);
          await this.setCachedRequirements(categoryId, requirements);
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.warn(`Failed to preload category ${categoryId}:`, error.message);
      }
    }

    console.log('Preload completed');
  }

  /**
   * Cleanup stale cache entries
   */
  async cleanupStaleEntries() {
    try {
      let cleanedCount = 0;

      // Cleanup memory cache
      for (const [categoryId, cached] of this.memoryCache.entries()) {
        if (this.isCacheStale(cached, this.MEMORY_CACHE_TTL)) {
          this.memoryCache.delete(categoryId);
          cleanedCount++;
        }
      }

      // Cleanup Firestore cache
      if (this.db) {
        const snapshot = await this.db
          .collection('system')
          .doc('category_requirements')
          .collection('categories')
          .get();

        const batch = this.db.batch();
        let batchOperations = 0;

        for (const doc of snapshot.docs) {
          const data = doc.data();
          const lastUpdated = data.lastUpdated?.toDate();
          
          if (this.isCacheStale({ lastUpdated }, this.FIRESTORE_CACHE_TTL)) {
            batch.delete(doc.ref);
            batchOperations++;
            cleanedCount++;

            // Commit in batches of 500 (Firestore limit)
            if (batchOperations >= 500) {
              await batch.commit();
              batchOperations = 0;
            }
          }
        }

        if (batchOperations > 0) {
          await batch.commit();
        }
      }

      console.log(`Cleaned up ${cleanedCount} stale cache entries`);
      return cleanedCount;

    } catch (error) {
      console.error('Cache cleanup error:', error);
      return 0;
    }
  }
}

module.exports = CategoryCache;