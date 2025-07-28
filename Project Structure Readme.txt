3. SDK Structure
/capture-sdk
|
├── core/
|   ├── analyzeItem.js           # Calls GPT-4V and parses response
|   ├── routeDisposition.js      # Recommends resell, donate, recycle
|   ├── validateResult.js        # User confirmation workflow
|   └── generateListing.js       # Prepares listing metadata
|
├── integrations/
|   ├── ebay/                    # eBay Sell API wrapper
|   ├── shipping/           	   # USPS/FedEx rate APIs + label generation
|   ├── maps/        	          # Shipping supply location finder
|   ├── instantOffer/            # Pricing logic + label generator (FUTURE)
|   ├── vintageShops/            # Local shop integration (planned)
|   └── donation/                # Org lookup + routing (future)
|
├── map/
|   ├── dropPin.js               # Create location pin
|   ├── getNearbyPins.js         # Retrieve active pins
|   └── claimPin.js              # Mark as collected
|
├── ui-components/
|   ├── ScanCard.jsx               #  Preview result & action component
|   ├── ConfidenceIndicator.jsx     # Shows confidence level
|   └── ValidationModal.jsx            # "Does this look right?" component
| 
├── utils/
|   ├── normalize.js
|   ├── priceEstimate.js
|   ├── locationUtils.js
|   ├── confidenceRouter.js		     # Confidence-based flow control
|   ├── shippingCalculator.js		    # Real-time shipping cost calculation
|   └── urgencyManager.js	#Time-bound pin logic
|
└── index.js                     # Entry point / exports
