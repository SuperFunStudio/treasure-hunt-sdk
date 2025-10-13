# Quick Start: Progressive Analysis

## 🚀 5-Minute Integration Guide

### What You Get
- ⚡ **3-4 seconds** to first results (was 7-16s)
- 📊 Progressive UI updates
- 🎯 Real market pricing
- ✅ Better UX

### Step 1: Add the Helper Script

```html
<!-- Add to your HTML page -->
<script src="/js/progressive-analysis.js"></script>
```

### Step 2: Initialize the Analyzer

```javascript
// Get Firebase auth token
const token = await firebase.auth().currentUser.getIdToken();

// Create analyzer
const analyzer = new ProgressiveAnalysis({
  baseUrl: window.location.origin,
  authToken: token,

  onProgress: (update) => {
    console.log(`${update.phase}: ${update.message} (${update.progress}%)`);

    if (update.phase === 'preliminary') {
      // Phase 1: Show results immediately (3-4s)
      displayResults(update.data);
    }
  },

  onComplete: (finalData) => {
    // Phase 2: Update with final pricing (6-10s)
    updatePricing(finalData.routes);
  },

  onError: (error) => {
    console.error('Analysis failed:', error);
  }
});
```

### Step 3: Analyze Images

```javascript
// From file input
const files = document.getElementById('imageInput').files;
await analyzer.analyzeImages(files);
```

## Complete Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>Image Analysis</title>
</head>
<body>
  <!-- Upload Form -->
  <input type="file" id="imageInput" multiple accept="image/*">
  <button onclick="analyzeImages()">Analyze</button>

  <!-- Results Display -->
  <div id="results" style="display:none">
    <h3>Analysis Results</h3>
    <div id="item-info"></div>
    <div id="pricing"></div>
    <div id="status"></div>
  </div>

  <!-- Include Scripts -->
  <script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-app.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-auth.js"></script>
  <script src="/js/progressive-analysis.js"></script>

  <script>
    // Initialize Firebase
    firebase.initializeApp({ /* your config */ });

    async function analyzeImages() {
      const files = document.getElementById('imageInput').files;
      if (files.length === 0) {
        alert('Please select images');
        return;
      }

      // Get auth token
      const token = await firebase.auth().currentUser.getIdToken();

      // Create analyzer
      const analyzer = new ProgressiveAnalysis({
        baseUrl: window.location.origin,
        authToken: token,

        onProgress: (update) => {
          const statusEl = document.getElementById('status');

          if (update.phase === 'uploading') {
            statusEl.textContent = '📤 Uploading images...';
          }
          else if (update.phase === 'preliminary') {
            // Show preliminary results
            document.getElementById('results').style.display = 'block';
            statusEl.textContent = '⏳ Getting market pricing...';

            const data = update.data;
            document.getElementById('item-info').innerHTML = `
              <p><strong>Category:</strong> ${data.analysis.category}</p>
              <p><strong>Brand:</strong> ${data.analysis.brand}</p>
              <p><strong>Condition:</strong> ${data.analysis.condition.rating}</p>
            `;

            document.getElementById('pricing').innerHTML = `
              <p><strong>Estimated:</strong> $${data.routes.recommendedRoute.estimatedReturn}</p>
              <small>Preliminary estimate - getting market data...</small>
            `;
          }
          else if (update.phase === 'pricing') {
            statusEl.textContent = `⏳ Analyzing market (${update.progress}%)...`;
          }
        },

        onComplete: (finalData) => {
          // Update with final pricing
          document.getElementById('status').textContent = '✅ Analysis complete!';

          const price = finalData.routes.recommendedRoute.estimatedReturn;
          const confidence = finalData.routes.marketAnalysis.estimatedValue.confidence;

          document.getElementById('pricing').innerHTML = `
            <p><strong>Market Price:</strong> $${price}</p>
            <p><small>Confidence: ${confidence}</small></p>
            <p><small>Source: ${finalData.routes.marketAnalysis.dataSource}</small></p>
          `;

          if (finalData.marketInsights) {
            document.getElementById('pricing').innerHTML += `
              <p><small>Based on ${finalData.marketInsights.sampleSize} recent sales</small></p>
            `;
          }
        },

        onError: (error) => {
          document.getElementById('status').textContent = '❌ Error: ' + error.error;
          console.error('Analysis error:', error);
        }
      });

      // Start analysis
      await analyzer.analyzeImages(files);
    }
  </script>
</body>
</html>
```

## Display Patterns

### Pattern 1: Instant Results + Update

```javascript
onProgress: (update) => {
  if (update.phase === 'preliminary') {
    // Show immediately (3-4s)
    showAnalysis(update.data.analysis);
    showEstimate(update.data.routes.recommendedRoute.estimatedReturn);
    showLoadingIndicator('Getting market pricing...');
  }
},

onComplete: (finalData) => {
  // Update pricing (6-10s total)
  hideLoadingIndicator();
  updatePrice(finalData.routes.recommendedRoute.estimatedReturn);
  showMarketData(finalData.marketInsights);
}
```

### Pattern 2: Progressive Reveal

```javascript
onProgress: (update) => {
  if (update.phase === 'preliminary') {
    // Step 1: Show item details
    fadeIn('.item-details');
    populateItemInfo(update.data.analysis);

    // Step 2: Show preliminary price
    fadeIn('.price-estimate');
    setPreliminaryPrice(update.data.routes);

    // Step 3: Show "loading market data"
    fadeIn('.market-loading');
  }
},

onComplete: (finalData) => {
  // Step 4: Replace with final price
  fadeOut('.market-loading');
  fadeIn('.final-price');
  setFinalPrice(finalData.routes);
  showMarketData(finalData.marketInsights);
}
```

### Pattern 3: Side-by-Side Comparison

```javascript
onProgress: (update) => {
  if (update.phase === 'preliminary') {
    document.getElementById('ai-estimate').innerHTML = `
      <div class="estimate-box">
        <h4>AI Estimate</h4>
        <div class="price">$${update.data.routes.recommendedRoute.estimatedReturn}</div>
        <small>Quick estimate based on image analysis</small>
      </div>
    `;

    document.getElementById('market-price').innerHTML = `
      <div class="loading-box">
        <h4>Market Price</h4>
        <div class="spinner"></div>
        <small>Analyzing market data...</small>
      </div>
    `;
  }
},

onComplete: (finalData) => {
  document.getElementById('market-price').innerHTML = `
    <div class="price-box">
      <h4>Market Price</h4>
      <div class="price">$${finalData.routes.recommendedRoute.estimatedReturn}</div>
      <small>Based on ${finalData.marketInsights.sampleSize} recent sales</small>
    </div>
  `;
}
```

## Common UI Elements

### Loading Indicator

```html
<div class="pricing-status">
  <div class="step active">✅ AI Analysis Complete</div>
  <div class="step loading">⏳ Getting Market Pricing...</div>
  <div class="step pending">⏸️ Finalizing Recommendations</div>
</div>
```

### Progress Bar

```javascript
onProgress: (update) => {
  const progressBar = document.getElementById('progress');
  progressBar.style.width = update.progress + '%';
  progressBar.textContent = update.progress + '%';
}
```

### Price Animation

```javascript
onComplete: (finalData) => {
  // Animate from preliminary to final price
  const oldPrice = parseInt($('#price').text());
  const newPrice = finalData.routes.recommendedRoute.estimatedReturn;

  $({ price: oldPrice }).animate({ price: newPrice }, {
    duration: 1000,
    step: function(now) {
      $('#price').text('$' + Math.round(now));
    }
  });
}
```

## Error Handling

```javascript
const analyzer = new ProgressiveAnalysis({
  // ... config ...

  onError: (error) => {
    switch (error.phase) {
      case 'analysis':
        // Critical error - can't continue
        showError('Image analysis failed. Please try again.');
        enableRetryButton();
        break;

      case 'pricing':
        // Non-critical - show preliminary results
        showWarning('Market pricing unavailable. Showing AI estimates.');
        usePreliminaryResults();
        break;

      case 'polling':
        // Timeout - offer retry
        showInfo('Pricing taking longer than expected.');
        showRetryButton();
        break;
    }
  }
});
```

## Testing

```javascript
// Test in browser console
const testAnalyzer = new ProgressiveAnalysis({
  baseUrl: window.location.origin,
  authToken: 'YOUR_TOKEN',
  onProgress: console.log,
  onComplete: console.log,
  onError: console.error
});

// Upload images from file input
const files = document.querySelector('input[type="file"]').files;
await testAnalyzer.analyzeImages(files);

// You should see:
// 1. "uploading" phase
// 2. "preliminary" phase with data (3-4s)
// 3. "pricing" phase with progress
// 4. "complete" phase with final data (6-10s)
```

## Configuration Options

```javascript
new ProgressiveAnalysis({
  baseUrl: 'https://your-api.com',  // API endpoint
  authToken: 'firebase-token',       // Auth token
  pollInterval: 2000,                 // Poll every 2s (default)
  maxPolls: 30,                       // Max 60s of polling (default)

  onProgress: (update) => { },       // Progress callback
  onComplete: (data) => { },         // Completion callback
  onError: (error) => { }            // Error callback
});
```

## That's It! 🎉

You now have:
- ⚡ 60-70% faster perceived load times
- 📊 Progressive UI updates
- 🎯 Real market pricing
- ✅ Better user experience

For more details, see:
- [PROGRESSIVE_ANALYSIS_API.md](PROGRESSIVE_ANALYSIS_API.md) - Full API docs
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - Technical details
