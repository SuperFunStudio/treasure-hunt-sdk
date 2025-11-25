# ThriftSpot V6 - Developer Quick Start

## Project Overview
ThriftSpot is a web app that lets users scan thrift items, get AI-powered valuations, and list them for sale or rent on a local map or eBay.

## Tech Stack
- **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3
- **Backend:** Firebase Cloud Functions (Node.js)
- **Database:** Firestore
- **Storage:** Firebase Storage
- **Auth:** Firebase Authentication
- **AI:** Anthropic Claude (via API)
- **Maps:** Leaflet.js
- **Hosting:** Firebase Hosting

## Quick Setup

### 1. Install Dependencies
```bash
# Install Firebase CLI (if not installed)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Install project dependencies
cd functions
npm install
```

### 2. Run Development Server
```bash
# Start Firebase emulators (recommended)
firebase emulators:start

# OR run hosting only
firebase serve --only hosting
```

### 3. Access the App
- Local: http://localhost:5000
- Emulators UI: http://localhost:4000

## Project Structure

```
treasure-hunt-sdk/
├── public/                      # Frontend files
│   ├── index.html              # Main scan page (V6)
│   ├── listing-preview-v6.html # Listing creation
│   ├── pin-map.html            # Map view (V6)
│   ├── dashboard.html          # User dashboard (V6)
│   ├── profile.html            # User profile (V6)
│   ├── signin.html             # Auth page
│   │
│   ├── css/
│   │   ├── thriftspot-v6.css           # Main V6 styles
│   │   ├── thriftspot-design-system.css # Design tokens
│   │   └── thriftspot-theme.css        # Theme variables
│   │
│   ├── js/
│   │   ├── app-v6.js           # Main scan app
│   │   └── shared/
│   │       └── api-client.js   # API utilities
│   │
│   └── *-old-backup.html       # Backed up old files
│
├── functions/                   # Backend Cloud Functions
│   ├── index.js                # Main entry point
│   ├── routes/                 # API routes
│   │   ├── pins.js             # Pin CRUD operations
│   │   └── ...
│   ├── services/               # Business logic
│   │   ├── ebay/              # eBay integration
│   │   └── location/          # Geolocation services
│   └── models/                # Data models
│
├── firebase.json               # Firebase config
├── firestore.rules            # Database security rules
├── storage.rules              # Storage security rules
│
└── docs/
    ├── V6_INTEGRATION_COMPLETE.md  # Integration summary
    ├── V6_USER_FLOWS.md           # User flow diagrams
    ├── TESTING_GUIDE_V6.md        # Testing guide
    └── DEVELOPER_QUICK_START.md   # This file
```

## Key Files Explained

### Frontend

#### `index.html` - Main Scan Page
- Telescope scan interface
- Camera/upload functionality
- AI analysis with progress stages
- Results display with eBay comparables

#### `listing-preview-v6.html` - Listing Creation
- Preview AI analysis
- Edit listing details
- Choose sale vs rent
- Select platforms (Local/eBay)
- Create pin with geolocation

#### `pin-map.html` - Map View
- Interactive Leaflet map
- Color-coded pins (available/reserved/claimed)
- Reserve/claim system
- Bottom-sheet details panel

#### `app-v6.js` - Main Application Logic
```javascript
class ThriftSpotApp {
  constructor() { /* Initialize state */ }
  async init() { /* Setup app */ }
  async startAnalysis() { /* Scan items */ }
  async analyzeImages(base64Images) { /* Call API */ }
  showResults() { /* Display results */ }
  createListing() { /* Navigate to preview */ }
}
```

### Backend

#### `functions/index.js` - Main Entry Point
```javascript
exports.api = functions.https.onRequest(app);
```

#### `functions/routes/pins.js` - Pin Routes
```javascript
router.post('/pins', async (req, res) => {
  // Create new pin
});

router.get('/pins/:id', async (req, res) => {
  // Get pin details
});

router.patch('/pins/:id/reserve', async (req, res) => {
  // Reserve pin
});
```

## API Endpoints

### Analysis API
```
POST /api/analyze-json
Headers: Authorization: Bearer {idToken}
Body: {
  images: [base64String, ...]
}
Response: {
  success: true,
  analysis: {
    category: string,
    brand: string,
    condition: {
      rating: string,
      description: string
    }
  },
  routes: {
    marketAnalysis: {
      estimatedValue: {
        suggested: number,
        comparableItems: [...]
      }
    }
  }
}
```

### Pins API
```
GET /api/pins
Query: ?lat=37.7749&lng=-122.4194&radius=10
Response: {
  pins: [
    {
      id: string,
      title: string,
      price: number,
      lat: number,
      lng: number,
      status: 'active' | 'claimed',
      ...
    }
  ]
}

POST /api/pins
Body: {
  title: string,
  description: string,
  price: number,
  images: [url, ...],
  lat: number,
  lng: number,
  ...
}
Response: {
  success: true,
  pinId: string
}
```

## Data Models

### Pin Document (Firestore)
```javascript
{
  // Content
  title: string,
  description: string,
  category: string,
  brand: string,
  condition: string,

  // Pricing
  price: number,
  listingType: 'sale' | 'rent',
  rentalPeriod: 'hourly' | 'daily' | 'weekly' | 'monthly',
  securityDeposit: number,

  // Media
  images: string[],

  // Location
  location: string,
  locationNotes: string,
  lat: number,
  lng: number,
  geohash: string,

  // Ownership
  userId: string,
  userEmail: string,

  // Status
  status: 'active' | 'claimed' | 'deleted',
  reservedBy: string | null,
  reservedByEmail: string | null,
  reservedAt: Timestamp | null,
  reservedUntil: Timestamp | null,
  claimedBy: string | null,
  claimedByEmail: string | null,
  claimedAt: Timestamp | null,

  // Timestamps
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## Common Development Tasks

### Adding a New Page

1. Create HTML file in `public/`
2. Include V6 styles:
```html
<link rel="stylesheet" href="css/thriftspot-v6.css">
```

3. Include Firebase SDK:
```html
<script src="/__/firebase/10.7.1/firebase-app-compat.js"></script>
<script src="/__/firebase/10.7.1/firebase-auth-compat.js"></script>
<script src="/__/firebase/init.js"></script>
```

4. Add app header:
```html
<header class="app-header">
  <div class="header-logo">...</div>
  <div id="authSection"></div>
</header>
```

5. Initialize auth:
```javascript
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    // User signed in
  } else {
    // User signed out
  }
});
```

### Adding a New API Route

1. Create route file in `functions/routes/`
2. Import in `functions/index.js`:
```javascript
const myRoute = require('./routes/my-route');
app.use('/api/my-route', myRoute);
```

3. Define route:
```javascript
const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  // Handle request
});

module.exports = router;
```

### Updating Firestore Schema

1. Update model in `functions/models/`
2. Update security rules in `firestore.rules`
3. Deploy rules: `firebase deploy --only firestore:rules`

### Adding a New Firebase Function

1. Export function in `functions/index.js`:
```javascript
exports.myFunction = functions.https.onCall(async (data, context) => {
  // Function logic
});
```

2. Call from frontend:
```javascript
const myFunction = firebase.functions().httpsCallable('myFunction');
const result = await myFunction({ param: 'value' });
```

## Design System Usage

### CSS Variables
```css
/* Colors */
var(--primary)      /* #6366f1 */
var(--primary-dark) /* #4f46e5 */
var(--success)      /* #22c55e */
var(--warning)      /* #eab308 */
var(--error)        /* #ef4444 */

/* Spacing */
var(--space-1) through var(--space-20)

/* Typography */
var(--font-xs) through var(--font-5xl)
var(--font-normal), var(--font-semibold), var(--font-bold)

/* Border Radius */
var(--radius-sm) through var(--radius-full)

/* Shadows */
var(--elevation-1) through var(--elevation-5)
```

### Component Classes
```css
.btn              /* Base button */
.btn-primary      /* Primary button */
.btn-secondary    /* Secondary button */
.btn-danger       /* Danger button */
.btn-lg           /* Large button */
.btn-full         /* Full width */

.app-header       /* Header component */
.user-avatar      /* User avatar circle */
.form-input       /* Form input field */
.form-select      /* Form select dropdown */
.form-textarea    /* Form textarea */
```

## Debugging Tips

### Frontend Debugging
```javascript
// Enable verbose logging
console.log('🔍 Debug:', variable);

// Check Firebase connection
firebase.auth().currentUser // Should return user or null

// Check Firestore queries
db.collection('pins').get().then(snap => {
  console.log('Pins:', snap.size);
});
```

### Backend Debugging
```javascript
// Cloud Functions logs
console.log('📝 Log:', data);
console.error('❌ Error:', error);

// View logs
firebase functions:log
```

### Network Debugging
- Open DevTools → Network tab
- Filter by "api" to see API calls
- Check request/response bodies
- Verify auth tokens in headers

### Firebase Emulator Debugging
- Access Firestore data: http://localhost:4000/firestore
- View function logs in emulator UI
- Test auth flows without affecting production

## Common Issues & Solutions

### Issue: "Camera permission denied"
**Solution:** Falls back to file upload automatically

### Issue: "Geolocation not working"
**Solution:**
- Check HTTPS (required for geolocation)
- Allow location permission in browser
- Listing still works without coordinates

### Issue: "Analysis API returns error"
**Solution:**
- Check Claude API key in Cloud Functions
- Verify function deployment: `firebase deploy --only functions`
- Check function logs: `firebase functions:log`

### Issue: "Images not uploading"
**Solution:**
- Check Firebase Storage rules
- Verify Storage is enabled in Firebase Console
- Check browser console for errors

### Issue: "Pins not showing on map"
**Solution:**
- Verify pins have lat/lng coordinates
- Check Firestore query in console
- Verify map is initialized: `console.log(app.map)`

## Performance Optimization

### Image Optimization
```javascript
// Already implemented in app-v6.js
const options = {
  maxSizeMB: 0.8,
  maxWidthOrHeight: 1200,
  useWebWorker: true
};
await imageCompression(file, options);
```

### Firestore Query Optimization
```javascript
// Use compound indexes for complex queries
db.collection('pins')
  .where('status', '==', 'active')
  .where('category', '==', 'electronics')
  .orderBy('createdAt', 'desc')
  .limit(50);
```

### Caching
```javascript
// Enable Firestore persistence
firebase.firestore().enablePersistence()
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      // Multiple tabs open
    } else if (err.code == 'unimplemented') {
      // Browser doesn't support
    }
  });
```

## Deployment

### Deploy Everything
```bash
firebase deploy
```

### Deploy Specific Services
```bash
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
```

### Production Checklist
- [ ] Update environment variables
- [ ] Test all flows in production
- [ ] Enable Firestore security rules
- [ ] Enable Storage security rules
- [ ] Set up error monitoring
- [ ] Configure custom domain (optional)
- [ ] Enable analytics (optional)

## Environment Variables

### Cloud Functions (.env file)
```bash
CLAUDE_API_KEY=your-api-key
EBAY_APP_ID=your-ebay-app-id
EBAY_CERT_ID=your-ebay-cert-id
```

Set in Firebase:
```bash
firebase functions:config:set claude.api_key="your-key"
firebase functions:config:set ebay.app_id="your-id"
```

## Git Workflow

### Branching Strategy
```bash
main          # Production
├── develop   # Development
└── feature/* # Feature branches
```

### Commit Messages
```
feat: Add rental listing support
fix: Resolve geolocation permission issue
docs: Update testing guide
style: Format code with prettier
refactor: Extract image compression logic
```

## Resources

### Documentation
- [Firebase Docs](https://firebase.google.com/docs)
- [Leaflet Docs](https://leafletjs.com/reference.html)
- [Anthropic Claude API](https://docs.anthropic.com/)

### Design
- [Figma Prototype](link-to-figma) (if available)
- [Design System](./DESIGN_SYSTEM.md)

### Project Docs
- [V6 Integration Summary](./V6_INTEGRATION_COMPLETE.md)
- [User Flows](./V6_USER_FLOWS.md)
- [Testing Guide](./TESTING_GUIDE_V6.md)

## Getting Help

- Check existing documentation first
- Search issues on GitHub
- Ask in team chat
- Create detailed bug reports

## Next Tasks for Developers

1. **Immediate:**
   - [ ] Test all flows end-to-end
   - [ ] Fix any critical bugs found
   - [ ] Deploy to production

2. **Short-term:**
   - [ ] Implement eBay listing creation
   - [ ] Add search/filter to map
   - [ ] Add user messaging system
   - [ ] Implement notifications

3. **Long-term:**
   - [ ] Build React Native mobile app
   - [ ] Add analytics dashboard
   - [ ] Implement AI chat assistant
   - [ ] Add social features (likes, follows)

---

**Happy Coding! 🚀**

For questions or issues, please refer to the documentation or create an issue in the repository.
