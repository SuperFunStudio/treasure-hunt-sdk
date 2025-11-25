# ThriftSpot - AI-Powered Thrift Discovery

> Scan, Price, List, and Discover thrift items with AI assistance

![Version](https://img.shields.io/badge/version-6.0-blue)
![Firebase](https://img.shields.io/badge/firebase-10.7-orange)
![Claude](https://img.shields.io/badge/claude-ai-purple)

## Overview

ThriftSpot is a web application that helps users discover and flip thrift store finds. Using AI vision technology (Claude), it can analyze photos of items, identify them, assess their condition, and provide market-based pricing estimates from eBay data.

**Key Features:**
- 📷 **AI-Powered Scanning**: Photograph items to get instant identification and valuation
- 🗺️ **Local Discovery Map**: Find thrift items others have spotted near you
- 💰 **Smart Pricing**: Get accurate price estimates based on real eBay sold listings
- 📍 **Reserve & Claim System**: Reserve items for 24 hours before claiming them
- 🏷️ **Dual Listing**: List items for sale or rent on local map and eBay
- 🎨 **Modern V6 Design**: Clean, intuitive interface with smooth animations

## Demo

### Scan Flow
1. Upload photos of an item
2. AI analyzes and identifies the item
3. Get pricing and condition assessment
4. Create a listing for sale or rent

### Map Flow
1. Browse nearby thrift finds on an interactive map
2. View detailed information about items
3. Reserve items for 24 hours
4. Claim items you want to purchase

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Firebase Cloud Functions (Node.js)
- **Database**: Firestore
- **Storage**: Firebase Storage
- **Authentication**: Firebase Auth
- **AI**: Anthropic Claude (Vision API)
- **Maps**: Leaflet.js
- **eBay Integration**: eBay API (trading & finding)

## Quick Start

### Prerequisites
- Node.js 18+
- Firebase CLI (`npm install -g firebase-tools`)
- Firebase project with Blaze plan (for Cloud Functions)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/treasure-hunt-sdk.git
cd treasure-hunt-sdk

# Install dependencies
cd functions
npm install

# Login to Firebase
firebase login

# Initialize Firebase (if not already done)
firebase init
```

### Configuration

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Authentication, Firestore, Storage, and Functions
3. Set up environment variables:

```bash
# Set Claude API key
firebase functions:config:set claude.api_key="your-api-key"

# Set eBay credentials (optional)
firebase functions:config:set ebay.app_id="your-ebay-app-id"
firebase functions:config:set ebay.cert_id="your-ebay-cert-id"
```

### Run Locally

```bash
# Start Firebase emulators
firebase emulators:start

# OR serve hosting only
firebase serve --only hosting
```

Access at: **http://localhost:5000**

## Project Structure

```
treasure-hunt-sdk/
├── public/                     # Frontend files
│   ├── index.html             # Main scan page (V6)
│   ├── listing-preview-v6.html # Listing creation
│   ├── pin-map.html           # Map view (V6)
│   ├── dashboard.html         # User dashboard (V6)
│   ├── profile.html           # User profile (V6)
│   │
│   ├── css/
│   │   └── thriftspot-v6.css  # Main V6 styles
│   │
│   └── js/
│       ├── app-v6.js          # Main scan app
│       └── shared/
│           └── api-client.js  # API utilities
│
├── functions/                  # Backend Cloud Functions
│   ├── index.js               # Main entry point
│   ├── routes/                # API routes
│   ├── services/              # Business logic
│   └── models/                # Data models
│
├── docs/                       # Documentation
│   ├── V6_INTEGRATION_COMPLETE.md
│   ├── V6_USER_FLOWS.md
│   ├── TESTING_GUIDE_V6.md
│   └── DEVELOPER_QUICK_START.md
│
└── firebase.json              # Firebase configuration
```

## Features in Detail

### 1. AI-Powered Scanning
- Upload or capture photos of items
- Claude AI analyzes images to identify:
  - Item category and brand
  - Condition assessment
  - Material composition
  - Authenticity indicators
- Real-time progress with 7 analysis stages

### 2. Market Pricing
- Queries eBay sold listings for comparable items
- Provides price range and suggested listing price
- Shows recent sales data with links
- Considers condition and brand in valuation

### 3. Listing Creation
- AI-generated titles and descriptions (editable)
- Choose between "For Sale" or "For Rent"
- Rental-specific fields (period, deposit)
- Automatic geolocation capture
- Upload to Firebase Storage
- Dual platform support (Local Map + eBay)

### 4. Interactive Map
- View all active listings on Leaflet map
- Color-coded pins:
  - 🟢 Green = Available
  - 🟡 Yellow = Reserved
  - 🔴 Red = Claimed
- Filter by category, price range, distance
- User location tracking

### 5. Reserve & Claim System
- Reserve items for 24 hours
- Prevents others from claiming during reservation
- Claim reserved items to mark as sold
- Owner controls (edit/delete listings)

## API Endpoints

### Analysis API
```
POST /api/analyze-json
Authorization: Bearer {firebaseIdToken}
Content-Type: application/json

{
  "images": ["base64String1", "base64String2", ...]
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "category": "Electronics",
    "brand": "Sony",
    "condition": {
      "rating": "good",
      "description": "Minor wear on corners..."
    }
  },
  "routes": {
    "marketAnalysis": {
      "estimatedValue": {
        "suggested": 45.99,
        "comparableItems": [...]
      }
    }
  }
}
```

### Pins API
See [API Documentation](./docs/API.md) for full details.

## Database Schema

### Pins Collection
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

  // Media & Location
  images: string[],
  lat: number,
  lng: number,
  geohash: string,

  // Ownership & Status
  userId: string,
  status: 'active' | 'claimed' | 'deleted',
  reservedBy: string | null,
  reservedUntil: Timestamp | null,
  claimedBy: string | null,

  // Timestamps
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## User Flows

### Spot Mode (📷)
1. Open app → index.html
2. Upload/capture photos
3. Click "Scan Items"
4. AI analyzes (30-45 seconds)
5. Review results
6. Click "Preview Listing"
7. Edit details, choose sale/rent
8. Create listing → redirects to map

### Thrift Mode (🗺️)
1. Open map → pin-map.html
2. Browse pins on map
3. Click a pin to view details
4. Reserve item (24h hold)
5. Return later to claim
6. Item marked as claimed

## Development

### Adding a New Page
See [Developer Quick Start](./docs/DEVELOPER_QUICK_START.md)

### Running Tests
```bash
# Run unit tests
npm test

# Run e2e tests
npm run test:e2e
```

### Code Style
- ESLint configuration included
- Prettier for formatting
- Conventional commits

## Deployment

### Deploy to Firebase
```bash
# Deploy everything
firebase deploy

# Deploy specific services
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
```

### Production Checklist
- [ ] Update environment variables
- [ ] Test all user flows
- [ ] Enable security rules
- [ ] Set up monitoring
- [ ] Configure custom domain

## Documentation

- [V6 Integration Summary](./V6_INTEGRATION_COMPLETE.md) - Complete overview of V6 changes
- [User Flows](./V6_USER_FLOWS.md) - Detailed flow diagrams
- [Testing Guide](./TESTING_GUIDE_V6.md) - Comprehensive testing scenarios
- [Developer Quick Start](./DEVELOPER_QUICK_START.md) - Development guide

## Roadmap

### v6.0 (Current) ✅
- [x] V6 design system integration
- [x] AI-powered scanning
- [x] Listing creation (sale/rent)
- [x] Interactive map with pins
- [x] Reserve/claim system
- [x] Geolocation support

### v6.1 (Next)
- [ ] eBay listing integration
- [ ] Search and filters
- [ ] User messaging
- [ ] Push notifications

### v7.0 (Future)
- [ ] React Native mobile app
- [ ] Social features (likes, follows)
- [ ] Analytics dashboard
- [ ] AI chat assistant

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Submit a pull request

## License

[MIT License](LICENSE)

## Support

- 📧 Email: support@thriftspot.app
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/treasure-hunt-sdk/issues)
- 📖 Docs: [Documentation](./docs/)

## Acknowledgments

- Anthropic Claude for AI vision capabilities
- Firebase team for excellent backend infrastructure
- Leaflet.js for mapping functionality
- eBay for marketplace data

---

**Built with ❤️ by the ThriftSpot team**

*Scan. Price. List. Discover.*
