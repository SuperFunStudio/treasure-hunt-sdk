// functions/capture-sdk/ui-components/ScanCard.jsx
import React, { useState } from 'react';

export function ScanCard({ itemData, routes, onAction }) {
  const [selectedRoute, setSelectedRoute] = useState(routes.recommendedRoute);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleAction = () => {
    onAction(selectedRoute, itemData);
  };

  const getActionButton = () => {
    switch (selectedRoute.type) {
      case 'ebay':
        return {
          text: `List for ${selectedRoute.estimatedReturn}`,
          color: 'blue',
          icon: '💰'
        };
      case 'instant-offer':
        return {
          text: `Get ${selectedRoute.estimatedReturn} Now`,
          color: 'green',
          icon: '⚡'
        };
      case 'local-pickup':
        return {
          text: 'Drop Pin for Pickup',
          color: 'purple',
          icon: '📍'
        };
      case 'donate':
        return {
          text: 'Donate Item',
          color: 'orange',
          icon: '❤️'
        };
      case 'recycle-parts':
        return {
          text: 'Recycle/Parts',
          color: 'gray',
          icon: '♻️'
        };
      default:
        return {
          text: 'Dispose',
          color: 'red',
          icon: '🗑️'
        };
    }
  };

  const actionButton = getActionButton();

  return (
    <div className="scan-card">
      <div className="scan-card-header">
        <h3 className="item-title">
          {itemData.brand !== 'Unknown' && `${itemData.brand} `}
          {itemData.model !== 'Unknown' && `${itemData.model} `}
          {itemData.category}
        </h3>
        <span className={`confidence-badge confidence-${itemData.confidence >= 7 ? 'high' : 'medium'}`}>
          {itemData.confidence}/10 confidence
        </span>
      </div>

      <div className="item-details">
        <div className="condition-section">
          <h4>Condition: <span className={`condition-${itemData.condition.rating}`}>
            {itemData.condition.rating}
          </span></h4>
          <p>{itemData.condition.description}</p>
          {itemData.condition.issues.length > 0 && (
            <ul className="issues-list">
              {itemData.condition.issues.map((issue, idx) => (
                <li key={idx}>{issue}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="value-section">
          <h4>Estimated Value</h4>
          <div className="price-range">
            ${itemData.resale.priceRange.low} - ${itemData.resale.priceRange.high}
          </div>
          <p className="justification">{itemData.resale.justification}</p>
        </div>

        {itemData.salvageable.length > 0 && (
          <div className="salvage-section">
            <h4>Salvageable Parts</h4>
            <ul>
              {itemData.salvageable.map((part, idx) => (
                <li key={idx}>
                  <strong>{part.component}:</strong> {part.value}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="route-selection">
        <h4>What would you like to do?</h4>
        <div className="route-options">
          {routes.allRoutes.map((route, idx) => (
            <button
              key={idx}
              className={`route-option ${selectedRoute === route ? 'selected' : ''}`}
              onClick={() => setSelectedRoute(route)}
            >
              <span className="route-icon">{getActionButton().icon}</span>
              <span className="route-text">
                {route.type.replace('-', ' ').replace(/^\w/, c => c.toUpperCase())}
              </span>
              {route.estimatedReturn > 0 && (
                <span className="route-value">${route.estimatedReturn}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <button 
        className={`action-button action-${actionButton.color}`}
        onClick={handleAction}
      >
        {actionButton.icon} {actionButton.text}
      </button>

      <button 
        className="expand-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? 'Less Details' : 'More Details'}
      </button>

      {isExpanded && (
        <div className="expanded-details">
          <h4>Market Analysis</h4>
          <div className="market-stats">
            <div>Market Value: ${routes.marketAnalysis.estimatedValue}</div>
            <div>Instant Offer: ${routes.marketAnalysis.instantOffer}</div>
            <div>Demand: {routes.marketAnalysis.demandLevel}</div>
          </div>
          
          <h4>Route Comparison</h4>
          <table className="route-comparison">
            <thead>
              <tr>
                <th>Option</th>
                <th>Return</th>
                <th>Time</th>
                <th>Effort</th>
              </tr>
            </thead>
            <tbody>
              {routes.allRoutes.map((route, idx) => (
                <tr key={idx}>
                  <td>{route.type}</td>
                  <td>${route.estimatedReturn || 0}</td>
                  <td>{route.timeToMoney || 'N/A'}</td>
                  <td>{route.effort || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// CSS styles (would be in separate file)
const styles = `
.scan-card {
  max-width: 500px;
  margin: 20px auto;
  padding: 20px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.scan-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.item-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.confidence-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.confidence-high {
  background: #e7f5e7;
  color: #2e7d2e;
}

.confidence-medium {
  background: #fff8e1;
  color: #f57c00;
}

.condition-section {
  margin-bottom: 20px;
}

.condition-good {
  color: #2e7d2e;
  font-weight: 600;
}

.condition-fair {
  color: #f57c00;
  font-weight: 600;
}

.condition-poor {
  color: #d32f2f;
  font-weight: 600;
}

.issues-list {
  margin: 10px 0;
  padding-left: 20px;
}

.value-section {
  margin-bottom: 20px;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 8px;
}

.price-range {
  font-size: 24px;
  font-weight: 700;
  color: #1976d2;
  margin: 10px 0;
}

.justification {
  font-size: 14px;
  color: #666;
  margin: 10px 0;
}

.route-selection {
  margin: 20px 0;
}

.route-options {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 15px 0;
}

.route-option {
  flex: 1;
  min-width: 120px;
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.route-option:hover {
  border-color: #1976d2;
  background: #f5f5f5;
}

.route-option.selected {
  border-color: #1976d2;
  background: #e3f2fd;
}

.route-icon {
  font-size: 24px;
}

.route-text {
  font-size: 14px;
  font-weight: 500;
}

.route-value {
  font-size: 16px;
  font-weight: 700;
  color: #1976d2;
}

.action-button {
  width: 100%;
  padding: 16px;
  font-size: 18px;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  margin: 10px 0;
}

.action-blue {
  background: #1976d2;
  color: white;
}

.action-green {
  background: #4caf50;
  color: white;
}

.action-purple {
  background: #9c27b0;
  color: white;
}

.action-orange {
  background: #ff9800;
  color: white;
}

.action-gray {
  background: #757575;
  color: white;
}

.expand-toggle {
  width: 100%;
  padding: 10px;
  background: none;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  margin-top: 10px;
}

.expanded-details {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
}

.market-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
  margin: 15px 0;
}

.market-stats > div {
  padding: 10px;
  background: #f5f5f5;
  border-radius: 6px;
  font-size: 14px;
}

.route-comparison {
  width: 100%;
  margin-top: 15px;
  border-collapse: collapse;
}

.route-comparison th,
.route-comparison td {
  padding: 10px;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
}

.route-comparison th {
  background: #f5f5f5;
  font-weight: 600;
}
`;

// Example usage component
export function ScanResultExample() {
  const mockItemData = {
    id: 'item_123',
    category: 'Electronics',
    brand: 'Sony',
    model: 'WH-1000XM4',
    condition: {
      rating: 'fair',
      description: 'Headphones show signs of use but function properly',
      usableAsIs: true,
      issues: ['Minor scratches on ear cups', 'Slightly worn ear cushions']
    },
    resale: {
      recommendation: 'resell',
      priceRange: { low: 150, high: 200, currency: 'USD' },
      justification: 'Popular model with strong resale demand despite minor wear'
    },
    salvageable: [],
    confidence: 8
  };

  const mockRoutes = {
    recommendedRoute: {
      type: 'ebay',
      priority: 1,
      estimatedReturn: 170,
      timeToMoney: '7-14 days',
      effort: 'medium'
    },
    allRoutes: [
      {
        type: 'ebay',
        priority: 1,
        estimatedReturn: 170,
        timeToMoney: '7-14 days',
        effort: 'medium'
      },
      {
        type: 'instant-offer',
        priority: 2,
        estimatedReturn: 130,
        timeToMoney: '1-3 days',
        effort: 'low'
      },
      {
        type: 'local-pickup',
        priority: 3,
        estimatedReturn: 0,
        timeToMoney: 'immediate',
        effort: 'minimal'
      }
    ],
    marketAnalysis: {
      estimatedValue: 175,
      instantOffer: 130,
      demandLevel: 'high'
    }
  };

  const handleAction = (route, itemData) => {
    console.log('Action selected:', route.type, 'for item:', itemData.id);
    // Implement actual action handling
  };

  return (
    <div>
      <h2>Scan Result</h2>
      <ScanCard 
        itemData={mockItemData}
        routes={mockRoutes}
        onAction={handleAction}
      />
      <style>{styles}</style>
    </div>
  );
}