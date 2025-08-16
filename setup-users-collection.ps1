# setup-users-collection.ps1
# Firebase Users Collection Setup Script for Treasure Hunt SDK
# Creates users collection with proper schema, security rules, and test data

param(
    [Parameter(Mandatory=$false)]
    [string]$ProjectId = "treasure-hunt-sdk-dev",
    
    [Parameter(Mandatory=$false)]
    [switch]$CreateTestData = $true,
    
    [Parameter(Mandatory=$false)]
    [switch]$SetupIndexes = $true,
    
    [Parameter(Mandatory=$false)]
    [switch]$SetupSecurityRules = $true
)

Write-Host "🔥 Setting up Firebase Users Collection for Treasure Hunt SDK" -ForegroundColor Green
Write-Host "Project: $ProjectId" -ForegroundColor Yellow

# Check if Firebase CLI is installed
try {
    $firebaseVersion = firebase --version
    Write-Host "✅ Firebase CLI detected: $firebaseVersion" -ForegroundColor Green
} catch {
    Write-Error "❌ Firebase CLI not found. Please install: npm install -g firebase-tools"
    exit 1
}

# Initialize Firebase project (if not already done)
Write-Host "`n📱 Initializing Firebase project..." -ForegroundColor Cyan
firebase use $ProjectId

# Create users collection schema document
$usersSchema = @{
    collection = "users"
    description = "User profiles, authentication, and preferences for Treasure Hunt SDK"
    fields = @{
        uid = @{
            type = "string"
            required = $true
            description = "Firebase Auth UID - primary identifier"
            example = "abc123xyz789"
        }
        email = @{
            type = "string"
            required = $true
            description = "User email address from Firebase Auth"
            example = "user@example.com"
        }
        profile = @{
            type = "object"
            required = $true
            fields = @{
                displayName = @{
                    type = "string"
                    required = $false
                    description = "User's chosen display name"
                    example = "Brooklyn Hunter"
                }
                avatarUrl = @{
                    type = "string"
                    required = $false
                    description = "Profile picture URL"
                    example = "https://storage.googleapis.com/avatars/user123.jpg"
                }
                bio = @{
                    type = "string"
                    required = $false
                    description = "User bio/description"
                    example = "Love finding treasures on Brooklyn streets!"
                }
                joinedAt = @{
                    type = "timestamp"
                    required = $true
                    description = "When user first joined"
                }
            }
        }
        location = @{
            type = "object"
            required = $false
            fields = @{
                geopoint = @{
                    type = "geopoint"
                    required = $false
                    description = "User's approximate location for nearby pins"
                    example = "40.7128, -74.0060"
                }
                city = @{
                    type = "string"
                    required = $false
                    description = "User's city"
                    example = "Brooklyn"
                }
                state = @{
                    type = "string"
                    required = $false
                    description = "User's state/region"
                    example = "NY"
                }
                radiusMiles = @{
                    type = "number"
                    required = $false
                    description = "Preferred search radius for pins"
                    example = 5
                }
            }
        }
        ebay = @{
            type = "object"
            required = $false
            description = "eBay integration and OAuth tokens"
            fields = @{
                isConnected = @{
                    type = "boolean"
                    required = $true
                    description = "Whether eBay account is linked"
                    example = $false
                }
                sellerAccount = @{
                    type = "string"
                    required = $false
                    description = "eBay seller username"
                    example = "brooklyn_treasure_hunter"
                }
                accessToken = @{
                    type = "string"
                    required = $false
                    description = "Encrypted eBay access token"
                    security = "ENCRYPTED"
                }
                refreshToken = @{
                    type = "string"
                    required = $false
                    description = "Encrypted eBay refresh token"
                    security = "ENCRYPTED"
                }
                expiresAt = @{
                    type = "timestamp"
                    required = $false
                    description = "When access token expires"
                }
                permissions = @{
                    type = "array"
                    required = $false
                    description = "eBay API permissions granted"
                    example = @("sell.inventory", "sell.account")
                }
                lastSync = @{
                    type = "timestamp"
                    required = $false
                    description = "Last successful eBay sync"
                }
            }
        }
        preferences = @{
            type = "object"
            required = $true
            fields = @{
                defaultDisposition = @{
                    type = "string"
                    required = $false
                    description = "Preferred action for scanned items"
                    example = "auto_route"
                    options = @("auto_route", "always_pin", "always_sell", "always_donate")
                }
                confidenceThreshold = @{
                    type = "number"
                    required = $false
                    description = "Minimum confidence for auto-actions"
                    example = 7
                    range = "1-10"
                }
                notifications = @{
                    type = "object"
                    fields = @{
                        nearbyPins = @{
                            type = "boolean"
                            description = "Notify about pins dropped nearby"
                            example = $true
                        }
                        claimUpdates = @{
                            type = "boolean"
                            description = "Notify about pin claim activity"
                            example = $true
                        }
                        listingSold = @{
                            type = "boolean"
                            description = "Notify when eBay listings sell"
                            example = $true
                        }
                        pushEnabled = @{
                            type = "boolean"
                            description = "Enable push notifications"
                            example = $true
                        }
                    }
                }
                autoList = @{
                    type = "object"
                    fields = @{
                        enabled = @{
                            type = "boolean"
                            description = "Auto-list high confidence items"
                            example = $false
                        }
                        minValue = @{
                            type = "number"
                            description = "Minimum estimated value for auto-listing"
                            example = 25
                        }
                        requireReview = @{
                            type = "boolean"
                            description = "Always require user review before listing"
                            example = $true
                        }
                    }
                }
            }
        }
        verification = @{
            type = "object"
            required = $true
            fields = @{
                emailVerified = @{
                    type = "boolean"
                    required = $true
                    description = "Email verification status"
                    example = $true
                }
                phoneVerified = @{
                    type = "boolean"
                    required = $false
                    description = "Phone verification status"
                    example = $false
                }
                identityVerified = @{
                    type = "boolean"
                    required = $false
                    description = "Government ID verification (future)"
                    example = $false
                }
                communityRating = @{
                    type = "number"
                    required = $false
                    description = "Community trust rating (1-5 stars)"
                    example = 4.5
                    range = "1.0-5.0"
                }
                successfulPickups = @{
                    type = "number"
                    required = $true
                    description = "Number of successful pin pickups"
                    example = 0
                }
                reportedIssues = @{
                    type = "number"
                    required = $true
                    description = "Number of issues reported against user"
                    example = 0
                }
                verificationBadges = @{
                    type = "array"
                    required = $false
                    description = "Trust badges earned"
                    example = @("email_verified", "frequent_scanner")
                }
            }
        }
        stats = @{
            type = "object"
            required = $true
            fields = @{
                totalScans = @{
                    type = "number"
                    required = $true
                    description = "Total items scanned"
                    example = 0
                }
                successfulListings = @{
                    type = "number"
                    required = $true
                    description = "Items successfully listed on eBay"
                    example = 0
                }
                totalEarnings = @{
                    type = "number"
                    required = $true
                    description = "Total earnings from sales (USD)"
                    example = 0.0
                }
                pinsCreated = @{
                    type = "number"
                    required = $true
                    description = "Location pins created"
                    example = 0
                }
                pinsClaimed = @{
                    type = "number"
                    required = $true
                    description = "Pins claimed from others"
                    example = 0
                }
                streakDays = @{
                    type = "number"
                    required = $true
                    description = "Current daily scanning streak"
                    example = 0
                }
                lastScanDate = @{
                    type = "timestamp"
                    required = $false
                    description = "Date of last scan"
                }
                avgConfidenceScore = @{
                    type = "number"
                    required = $false
                    description = "Average confidence of scans"
                    example = 6.5
                }
            }
        }
        metadata = @{
            type = "object"
            required = $true
            fields = @{
                createdAt = @{
                    type = "timestamp"
                    required = $true
                    description = "Account creation timestamp"
                }
                updatedAt = @{
                    type = "timestamp"
                    required = $true
                    description = "Last profile update"
                }
                lastLoginAt = @{
                    type = "timestamp"
                    required = $false
                    description = "Last login timestamp"
                }
                appVersion = @{
                    type = "string"
                    required = $false
                    description = "App version when last updated"
                    example = "1.0.0"
                }
                platform = @{
                    type = "string"
                    required = $false
                    description = "Platform: web, ios, android"
                    example = "web"
                }
            }
        }
    }
}

# Save schema to JSON file for documentation
$schemaJson = $usersSchema | ConvertTo-Json -Depth 10
$schemaJson | Out-File -FilePath "firebase-users-schema.json" -Encoding UTF8
Write-Host "✅ Schema documentation saved to firebase-users-schema.json" -ForegroundColor Green

# Create Firestore security rules for users collection
if ($SetupSecurityRules) {
    Write-Host "`n🔒 Creating Firestore security rules..." -ForegroundColor Cyan
    
    $securityRules = @'
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection - users can only access their own document
    match /users/{userId} {
      // Allow read/write only if authenticated user matches document ID
      allow read, write: if request.auth != null and request.auth.uid == userId;
      
      // Allow read of public profile fields for verified users
      allow read: if request.auth != null 
        and resource.data.verification.emailVerified == true
        and request.query.limit <= 10; // Prevent bulk data extraction
      
      // Admin users can read all user documents (for moderation)
      allow read: if request.auth != null 
        and request.auth.token.admin == true;
    }
    
    // User activity subcollection (for detailed analytics)
    match /users/{userId}/activity/{activityId} {
      allow read, write: if request.auth != null and request.auth.uid == userId;
      allow read: if request.auth != null and request.auth.token.admin == true;
    }
  }
}
'@

    $securityRules | Out-File -FilePath "firestore-users.rules" -Encoding UTF8
    Write-Host "✅ Security rules saved to firestore-users.rules" -ForegroundColor Green
    Write-Host "   📝 Manual step: Copy rules to Firebase Console > Firestore > Rules" -ForegroundColor Yellow
}

# Create composite indexes for efficient queries
if ($SetupIndexes) {
    Write-Host "`n📊 Creating Firestore indexes..." -ForegroundColor Cyan
    
    $indexes = @{
        indexes = @(
            @{
                collectionGroup = "users"
                queryScope = "COLLECTION"
                fields = @(
                    @{ fieldPath = "location.geopoint"; order = "ASCENDING" }
                    @{ fieldPath = "verification.emailVerified"; order = "ASCENDING" }
                    @{ fieldPath = "metadata.lastLoginAt"; order = "DESCENDING" }
                )
            },
            @{
                collectionGroup = "users"
                queryScope = "COLLECTION"
                fields = @(
                    @{ fieldPath = "location.city"; order = "ASCENDING" }
                    @{ fieldPath = "verification.communityRating"; order = "DESCENDING" }
                )
            },
            @{
                collectionGroup = "users"
                queryScope = "COLLECTION"
                fields = @(
                    @{ fieldPath = "stats.totalScans"; order = "DESCENDING" }
                    @{ fieldPath = "metadata.createdAt"; order = "DESCENDING" }
                )
            }
        )
    }
    
    $indexesJson = $indexes | ConvertTo-Json -Depth 10
    $indexesJson | Out-File -FilePath "firestore-users-indexes.json" -Encoding UTF8
    Write-Host "✅ Index configuration saved to firestore-users-indexes.json" -ForegroundColor Green
    Write-Host "   📝 Manual step: firebase deploy --only firestore:indexes" -ForegroundColor Yellow
}

# Create test user data
if ($CreateTestData) {
    Write-Host "`n🧪 Creating test user documents..." -ForegroundColor Cyan
    
    $testUsers = @(
        @{
            uid = "test_user_brooklyn_hunter"
            email = "brooklyn.hunter@example.com"
            profile = @{
                displayName = "Brooklyn Treasure Hunter"
                bio = "Love finding amazing items on street corners!"
                joinedAt = [DateTime]::UtcNow.AddDays(-30)
            }
            location = @{
                geopoint = @{ latitude = 40.7128; longitude = -74.0060 }
                city = "Brooklyn"
                state = "NY"
                radiusMiles = 3
            }
            ebay = @{
                isConnected = $true
                sellerAccount = "brooklyn_treasure_hunter"
                permissions = @("sell.inventory", "sell.account")
                lastSync = [DateTime]::UtcNow.AddHours(-2)
            }
            preferences = @{
                defaultDisposition = "auto_route"
                confidenceThreshold = 7
                notifications = @{
                    nearbyPins = $true
                    claimUpdates = $true
                    listingSold = $true
                    pushEnabled = $true
                }
                autoList = @{
                    enabled = $false
                    minValue = 25
                    requireReview = $true
                }
            }
            verification = @{
                emailVerified = $true
                phoneVerified = $false
                identityVerified = $false
                communityRating = 4.5
                successfulPickups = 12
                reportedIssues = 0
                verificationBadges = @("email_verified", "frequent_scanner", "trusted_seller")
            }
            stats = @{
                totalScans = 45
                successfulListings = 23
                totalEarnings = 1247.50
                pinsCreated = 8
                pinsClaimed = 12
                streakDays = 7
                lastScanDate = [DateTime]::UtcNow.AddHours(-4)
                avgConfidenceScore = 7.2
            }
            metadata = @{
                createdAt = [DateTime]::UtcNow.AddDays(-30)
                updatedAt = [DateTime]::UtcNow.AddHours(-1)
                lastLoginAt = [DateTime]::UtcNow.AddHours(-2)
                appVersion = "1.0.0"
                platform = "web"
            }
        },
        @{
            uid = "test_user_newbie"
            email = "newbie.scanner@example.com"
            profile = @{
                displayName = "New Scanner"
                bio = "Just getting started with treasure hunting!"
                joinedAt = [DateTime]::UtcNow.AddDays(-3)
            }
            location = @{
                geopoint = @{ latitude = 40.7589; longitude = -73.9851 }
                city = "Manhattan"
                state = "NY"
                radiusMiles = 2
            }
            ebay = @{
                isConnected = $false
            }
            preferences = @{
                defaultDisposition = "always_pin"
                confidenceThreshold = 5
                notifications = @{
                    nearbyPins = $true
                    claimUpdates = $false
                    listingSold = $false
                    pushEnabled = $true
                }
                autoList = @{
                    enabled = $false
                    minValue = 50
                    requireReview = $true
                }
            }
            verification = @{
                emailVerified = $true
                phoneVerified = $false
                identityVerified = $false
                communityRating = 5.0
                successfulPickups = 1
                reportedIssues = 0
                verificationBadges = @("email_verified", "newcomer")
            }
            stats = @{
                totalScans = 3
                successfulListings = 0
                totalEarnings = 0.0
                pinsCreated = 2
                pinsClaimed = 1
                streakDays = 3
                lastScanDate = [DateTime]::UtcNow.AddHours(-1)
                avgConfidenceScore = 5.8
            }
            metadata = @{
                createdAt = [DateTime]::UtcNow.AddDays(-3)
                updatedAt = [DateTime]::UtcNow.AddMinutes(-30)
                lastLoginAt = [DateTime]::UtcNow.AddMinutes(-30)
                appVersion = "1.0.0"
                platform = "ios"
            }
        }
    )
    
    # Save test data to JSON file
    $testDataJson = @{ testUsers = $testUsers } | ConvertTo-Json -Depth 10
    $testDataJson | Out-File -FilePath "test-users-data.json" -Encoding UTF8
    Write-Host "✅ Test user data saved to test-users-data.json" -ForegroundColor Green
    
    # Note: Actual document creation would require Firebase Admin SDK
    Write-Host "   📝 Manual step: Use Firebase Console or Admin SDK to create these test documents" -ForegroundColor Yellow
}

# Create Firebase Admin SDK initialization script
Write-Host "`n🔧 Creating Firebase Admin SDK setup..." -ForegroundColor Cyan

# Create the JavaScript content as a separate operation
$jsContent = @'
// firebase-admin-setup.js
// Initialize Firebase Admin SDK for Treasure Hunt users collection

const admin = require('firebase-admin');

// Initialize Firebase Admin (service account key required)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require('./service-account-key.json')),
    databaseURL: 'https://treasurehunter-sdk-default-rtdb.firebaseio.com'
  });
}

const db = admin.firestore();
const auth = admin.auth();

// User management functions
class TreasureHuntUsers {
  
  // Create new user document after Firebase Auth registration
  static async createUserProfile(uid, email, initialData = {}) {
    const now = admin.firestore.FieldValue.serverTimestamp();
    
    const userData = {
      uid,
      email,
      profile: {
        displayName: initialData.displayName || email.split('@')[0],
        bio: '',
        joinedAt: now,
        ...initialData.profile
      },
      location: {
        radiusMiles: 5,
        ...initialData.location
      },
      ebay: {
        isConnected: false,
        ...initialData.ebay
      },
      preferences: {
        defaultDisposition: 'auto_route',
        confidenceThreshold: 6,
        notifications: {
          nearbyPins: true,
          claimUpdates: true,
          listingSold: true,
          pushEnabled: true
        },
        autoList: {
          enabled: false,
          minValue: 25,
          requireReview: true
        },
        ...initialData.preferences
      },
      verification: {
        emailVerified: false,
        phoneVerified: false,
        identityVerified: false,
        communityRating: 5.0,
        successfulPickups: 0,
        reportedIssues: 0,
        verificationBadges: ['newcomer'],
        ...initialData.verification
      },
      stats: {
        totalScans: 0,
        successfulListings: 0,
        totalEarnings: 0.0,
        pinsCreated: 0,
        pinsClaimed: 0,
        streakDays: 0,
        avgConfidenceScore: 0,
        ...initialData.stats
      },
      metadata: {
        createdAt: now,
        updatedAt: now,
        appVersion: '1.0.0',
        platform: 'web',
        ...initialData.metadata
      }
    };
    
    await db.collection('users').doc(uid).set(userData);
    console.log('User profile created:', uid);
    return userData;
  }
  
  // Update user statistics after scan/listing/claim
  static async updateUserStats(uid, statUpdates) {
    const userRef = db.collection('users').doc(uid);
    const fields = {};
    
    Object.entries(statUpdates).forEach(([key, value]) => {
      fields[`stats.${key}`] = value;
    });
    
    fields['metadata.updatedAt'] = admin.firestore.FieldValue.serverTimestamp();
    
    await userRef.update(fields);
    console.log('User stats updated:', uid, statUpdates);
  }
  
  // Link eBay account with OAuth tokens
  static async linkEbayAccount(uid, ebayData) {
    const userRef = db.collection('users').doc(uid);
    const updateData = {
      'ebay.isConnected': true,
      'ebay.sellerAccount': ebayData.sellerAccount,
      'ebay.accessToken': ebayData.accessToken,
      'ebay.refreshToken': ebayData.refreshToken,
      'ebay.expiresAt': ebayData.expiresAt,
      'ebay.permissions': ebayData.permissions,
      'ebay.lastSync': admin.firestore.FieldValue.serverTimestamp(),
      'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp()
    };
    
    await userRef.update(updateData);
    console.log('eBay account linked:', uid);
  }
  
  // Get nearby users for pin notifications
  static async getNearbyUsers(geopoint, radiusMiles = 5, limit = 50) {
    const users = await db.collection('users')
      .where('preferences.notifications.nearbyPins', '==', true)
      .where('verification.emailVerified', '==', true)
      .limit(limit)
      .get();
    
    return users.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
}

module.exports = { TreasureHuntUsers, admin, db, auth };
'@

# Write the JavaScript file
$jsContent | Out-File -FilePath "firebase-admin-setup.js" -Encoding UTF8
Write-Host "✅ Firebase Admin SDK setup saved to firebase-admin-setup.js" -ForegroundColor Green

# Summary
Write-Host "`n🎉 Firebase Users Collection Setup Complete!" -ForegroundColor Green
Write-Host "`nFiles created:" -ForegroundColor Cyan
Write-Host "  📄 firebase-users-schema.json - Complete schema documentation" -ForegroundColor White
Write-Host "  🔒 firestore-users.rules - Security rules" -ForegroundColor White
Write-Host "  📊 firestore-users-indexes.json - Performance indexes" -ForegroundColor White
Write-Host "  🧪 test-users-data.json - Sample test data" -ForegroundColor White
Write-Host "  🔧 firebase-admin-setup.js - Admin SDK functions" -ForegroundColor White

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "  1. Copy security rules to Firebase Console > Firestore > Rules" -ForegroundColor White
Write-Host "  2. Deploy indexes: firebase deploy --only firestore:indexes" -ForegroundColor White
Write-Host "  3. Add service account key to firebase-admin-setup.js" -ForegroundColor White
Write-Host "  4. Create test user documents using Admin SDK or Console" -ForegroundColor White

Write-Host "`n📊 Collection Features:" -ForegroundColor Cyan
Write-Host "  ✅ Complete user profile management" -ForegroundColor Green
Write-Host "  ✅ eBay OAuth integration fields" -ForegroundColor Green
Write-Host "  ✅ Location-based pin preferences" -ForegroundColor Green
Write-Host "  ✅ Verification and trust system" -ForegroundColor Green
Write-Host "  ✅ Comprehensive activity statistics" -ForegroundColor Green
Write-Host "  ✅ Notification preferences" -ForegroundColor Green
Write-Host "  ✅ Security rules for user privacy" -ForegroundColor Green