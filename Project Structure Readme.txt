# Treasure Hunter SDK

A modular SDK for automated product recognition and circular economy applications. Scan items to get instant valuations and resale recommendations.

## 🚀 Features

- **AI-Powered Item Recognition**: Uses GPT-4 vision to identify and evaluate items
- **Multi-Route Disposition**: eBay listing, instant offers, local pickup, or donation
- **Confidence-Based Routing**: Smart recommendations based on analysis confidence
- **Location Pinning**: Time-bound geographic pins for local item exchange
- **Real-time Valuation**: Market-based pricing with shipping cost integration

## 📋 Prerequisites

- Node.js v20.16.0 or higher
- OpenAI API key with GPT-4 vision access
- Firebase project (for database and auth)
- eBay Developer account (optional, for marketplace integration)

## 🛠️ Installation

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/treasure-hunt-sdk.git
cd treasure-hunt-sdk
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
OPENAI_API_KEY=your_openai_api_key_here
FIREBASE_PROJECT_ID=your_firebase_project_id
EBAY_CLIENT_ID=your_ebay_client_id (optional)
EBAY_CLIENT_SECRET=your_ebay_client_secret (optional)
PORT=3000
```

## 🏃‍♂️ Running the Project

### Start the API Server
```bash
npm run server:dev
```

The server will start on `http://localhost:3000`

### Test the SDK
```bash
npm test
```

### Test with Real API
```bash
npm run test:api
```

## 🧪 Testing the API

1. Open `test-ui.html` in your browser
2. Upload an image of any item
3. Click "Analyze Item" to see the results

Or use curl:
```bash
curl -X POST http://localhost:3000/api/analyze \
  -F "image=@test-images/your-item.jpg"
```

## 📁 Project Structure

```
treasure-hunt-sdk/
├── capture-sdk/
│   ├── core/              # Core analysis modules
│   ├── integrations/      # External service integrations
│   ├── map/               # Location-based features
│   ├── ui-components/     # React components
│   └── utils/             # Utility functions
├── server.js              # Express API server
├── test.js                # SDK tests
├── test-ui.html           # Web interface for testing
└── package.json
```

## 🔑 API Endpoints

- `POST /api/analyze` - Analyze item from image
- `POST /api/pins` - Create location pin
- `GET /api/pins/nearby` - Get nearby pins
- `POST /api/listings/generate` - Generate marketplace listing

## 🎯 Roadmap

### Phase 1 (Current)
- ✅ Core SDK implementation
- ✅ GPT-4 vision integration
- ✅ Basic API server
- ✅ Web test interface
- 🔄 Mobile app development

### Phase 2
- [ ] Real eBay integration
- [ ] Shipping label generation
- [ ] User authentication
- [ ] Push notifications

### Phase 3
- [ ] Machine learning optimization
- [ ] Batch scanning
- [ ] Analytics dashboard
- [ ] Partner integrations

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 🙏 Acknowledgments

- OpenAI for GPT-4 vision capabilities
- Firebase for backend infrastructure
- The circular economy community for inspiration