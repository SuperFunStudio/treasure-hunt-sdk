#!/bin/bash

# deploy-functions.sh
# Firebase Functions Deployment Script with Troubleshooting

echo "🚀 Firebase Functions Deployment Script"
echo "======================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command_exists firebase; then
    echo -e "${RED}❌ Firebase CLI not installed. Please install it first:${NC}"
    echo "npm install -g firebase-tools"
    exit 1
fi

if ! command_exists node; then
    echo -e "${RED}❌ Node.js not installed${NC}"
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version must be 18 or higher. Current: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites OK${NC}"

# Navigate to functions directory
cd functions || exit

# Clean previous builds
echo -e "${YELLOW}Cleaning previous builds...${NC}"
rm -rf node_modules package-lock.json

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Creating template...${NC}"
    cat > .env << EOF
# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here

# eBay Configuration (optional)
EBAY_CLIENT_ID=your-ebay-client-id
EBAY_CLIENT_SECRET=your-ebay-client-secret
EBAY_REDIRECT_URI=https://your-project.web.app/success
EBAY_ENVIRONMENT=production

# Firebase Configuration
NODE_ENV=production
EOF
    echo -e "${YELLOW}Please update .env with your actual API keys${NC}"
fi

# Set Firebase Functions config (if API keys are in .env)
if [ -f .env ]; then
    source .env
    if [ ! -z "$OPENAI_API_KEY" ]; then
        echo -e "${YELLOW}Setting Firebase Functions config...${NC}"
        firebase functions:config:set openai.api_key="$OPENAI_API_KEY" 2>/dev/null || true
    fi
fi

# Deploy only the health function first (simpler, faster)
echo -e "${YELLOW}Deploying health function first...${NC}"
firebase deploy --only functions:health

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Health function deployed successfully!${NC}"
    
    # Get the health function URL
    echo -e "${YELLOW}Testing health endpoint...${NC}"
    HEALTH_URL=$(firebase functions:url health 2>/dev/null | grep "Function URL" | awk '{print $NF}')
    
    if [ ! -z "$HEALTH_URL" ]; then
        echo "Health endpoint: $HEALTH_URL"
        curl -s "$HEALTH_URL" | python -m json.tool || true
    fi
    
    # Now deploy remaining functions
    echo -e "${YELLOW}Deploying remaining functions...${NC}"
    firebase deploy --only functions:ebayNotifications,functions:testEbayEndpoint,functions:app
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ All functions deployed successfully!${NC}"
    else
        echo -e "${RED}❌ Some functions failed to deploy${NC}"
        echo -e "${YELLOW}Checking logs...${NC}"
        firebase functions:log --limit 50
    fi
else
    echo -e "${RED}❌ Health function deployment failed${NC}"
    echo -e "${YELLOW}Troubleshooting steps:${NC}"
    echo "1. Check Cloud Run logs:"
    echo "   gcloud run services logs read health --limit 50"
    echo ""
    echo "2. Check if the SDK module exists:"
    ls -la capture-sdk/index.js 2>/dev/null || echo "   ⚠️  SDK module not found!"
    echo ""
    echo "3. Try deploying with debug flag:"
    echo "   firebase deploy --only functions:health --debug"
    echo ""
    echo "4. Check Firebase logs:"
    firebase functions:log --limit 50
fi

echo ""
echo "======================================="
echo "Deployment script completed"
echo ""
echo "Useful commands:"
echo "  firebase functions:log          # View function logs"
echo "  firebase serve --only functions # Test locally"
echo "  firebase deploy --only functions:health # Deploy single function"
echo ""

# Return to original directory
cd ..