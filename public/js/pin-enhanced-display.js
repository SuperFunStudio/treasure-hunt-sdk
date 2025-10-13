// Multi-Item Yard Sale Support and Enhanced Interactions
// Add these functions to your pin-map.html

/**
 * Enhanced displayPins function with yard sale grouping
 */
function displayPins(pins) {
    // Clear existing pin markers
    pinMarkers.forEach(marker => map.removeLayer(marker));
    pinMarkers = [];

    // Group pins by proximity for yard sales
    const groupedPins = groupPinsByProximity(pins, 0.1); // 0.1 mile radius

    // Display individual pins and yard sale groups
    groupedPins.forEach(group => {
        if (group.pins.length === 1) {
            // Single pin
            const marker = createPinMarker(group.pins[0]);
            marker.pinData = group.pins[0];
            marker.options.pinId = group.pins[0].id;
            pinMarkers.push(marker);
            marker.addTo(map);
        } else {
            // Multi-item yard sale
            const yardSaleMarker = createYardSaleMarker(group);
            pinMarkers.push(yardSaleMarker);
            yardSaleMarker.addTo(map);
        }
    });

    console.log(`Displayed ${groupedPins.length} pin groups (${pins.length} total pins)`);
}

/**
 * Group pins by proximity for yard sale detection
 */
function groupPinsByProximity(pins, radiusMiles) {
    const groups = [];
    const processed = new Set();

    pins.forEach(pin => {
        if (processed.has(pin.id)) return;

        const group = {
            center: pin.location,
            pins: [pin]
        };

        // Find nearby pins from the same user or within very close proximity
        pins.forEach(otherPin => {
            if (otherPin.id === pin.id || processed.has(otherPin.id)) return;

            const distance = calculateDistance(
                pin.location.latitude, pin.location.longitude,
                otherPin.location.latitude, otherPin.location.longitude
            );

            // Group if same user and very close, or different users but extremely close (yard sale)
            const shouldGroup = (pin.userId === otherPin.userId && distance <= radiusMiles) ||
                               (distance <= radiusMiles / 4); // Very close proximity for yard sales

            if (shouldGroup) {
                group.pins.push(otherPin);
                processed.add(otherPin.id);
            }
        });

        processed.add(pin.id);
        groups.push(group);
    });

    return groups;
}

/**
 * Create yard sale marker for multiple items
 */
function createYardSaleMarker(group) {
    const totalValue = group.pins.reduce((sum, pin) => sum + (pin.item.estimatedValue || 0), 0);
    const mainCategory = getMostCommonCategory(group.pins);
    const icon = getCategoryIcon(mainCategory);

    const marker = L.marker([group.center.latitude, group.center.longitude], {
        icon: L.divIcon({
            className: 'custom-pin-marker',
            html: `
                <div class="pin-marker-container multi-item" 
                     data-disposition="yard_sale" 
                     data-item-count="${group.pins.length}">
                    <div class="pin-icon">${icon}</div>
                    <div class="pin-value">$${totalValue}</div>
                </div>
            `,
            iconSize: [55, 65],
            iconAnchor: [27, 65],
            popupAnchor: [0, -65]
        })
    });

    // Create yard sale popup
    const popupContent = createYardSalePopupContent(group);
    
    marker.bindPopup(popupContent, {
        maxWidth: 400,
        minWidth: 350,
        className: 'treasure-popup yard-sale-popup'
    });

    marker.yardSaleData = group;
    marker.on('click', () => {
        selectedPin = group;
        trackMultipleViews(group.pins.map(pin => pin.id));
    });

    return marker;
}

/**
 * Create yard sale popup content
 */
function createYardSalePopupContent(group) {
    const totalValue = group.pins.reduce((sum, pin) => sum + (pin.item.estimatedValue || 0), 0);
    const categories = [...new Set(group.pins.map(pin => pin.item.category))];
    const averageDistance = group.pins.reduce((sum, pin) => sum + (pin.distance || 0), 0) / group.pins.length;

    return `
        <div class="pin-popup-content yard-sale" data-group-id="${group.pins[0].id}">
            <!-- Header -->
            <div class="popup-header">
                <h3 class="popup-title">🏡 Yard Sale - ${group.pins.length} Items</h3>
                <div class="popup-category">${categories.map(cat => getCategoryIcon(cat)).join(' ')} ${categories.join(', ')}</div>
            </div>
            
            <!-- Summary metrics -->
            <div class="popup-metrics">
                <div class="metric">
                    <span class="metric-label">Total Value</span>
                    <span class="metric-value">$${totalValue}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Items</span>
                    <span class="metric-value">${group.pins.length}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Distance</span>
                    <span class="metric-value">${averageDistance.toFixed(1)} mi</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Categories</span>
                    <span class="metric-value">${categories.length}</span>
                </div>
            </div>
            
            <!-- Item list -->
            <div class="popup-multi-items">
                <div class="multi-items-header">
                    <span>Available Items</span>
                    <button onclick="expandAllItems('${group.pins[0].id}')" class="expand-all-btn">Expand All</button>
                </div>
                <div class="item-list">
                    ${group.pins.map((pin, index) => createItemCard(pin, index)).join('')}
                </div>
            </div>
            
            <!-- Yard sale actions -->
            <div class="popup-actions">
                <button class="popup-btn btn-primary" onclick="showInterestInYardSale('${group.pins[0].id}')">
                    ❤️ Show Interest in Sale
                </button>
                <button class="popup-btn btn-secondary" onclick="getDirections('${group.center.latitude}', '${group.center.longitude}')">
                    🧭 Get Directions
                </button>
            </div>
        </div>
    `;
}

/**
 * Create individual item card for yard sale
 */
function createItemCard(pin, index) {
    const condition = pin.item.condition?.rating || 'unknown';
    const hasImages = pin.item.imageUrls && pin.item.imageUrls.length > 0;

    return `
        <div class="item-card" onclick="expandItemCard('${pin.id}', ${index})">
            <div class="item-header">
                <div class="item-title">
                    ${getCategoryIcon(pin.item.category)} ${escapeHtml(pin.item.title)}
                </div>
                <div class="item-value">$${pin.item.estimatedValue || '?'}</div>
            </div>
            <div class="item-details">
                <span class="condition condition-${condition}">${formatCondition(condition)}</span>
                ${pin.item.brand && pin.item.brand !== 'Unknown' ? ` • ${escapeHtml(pin.item.brand)}` : ''}
                ${hasImages ? ` • ${pin.item.imageUrls.length} photo${pin.item.imageUrls.length > 1 ? 's' : ''}` : ''}
            </div>
            <div class="item-description" id="desc-${pin.id}" style="display: none;">
                ${pin.item.description ? escapeHtml(pin.item.description) : 'No description available'}
                ${hasImages ? `
                    <div class="item-images" style="margin-top: 8px;">
                        ${pin.item.imageUrls.slice(0, 3).map((url, imgIndex) => `
                            <img src="${url}" alt="Item image" 
                                 style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; margin-right: 5px; cursor: pointer;"
                                 onclick="event.stopPropagation(); openImageGallery('${pin.id}', ${imgIndex})" />
                        `).join('')}
                        ${pin.item.imageUrls.length > 3 ? `<span style="font-size: 11px; color: #666;">+${pin.item.imageUrls.length - 3} more</span>` : ''}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Get most common category from pins
 */
function getMostCommonCategory(pins) {
    const categoryCount = {};
    pins.forEach(pin => {
        const category = pin.item.category;
        categoryCount[category] = (categoryCount[category] || 0) + 1;
    });
    
    return Object.keys(categoryCount).reduce((a, b) => 
        categoryCount[a] > categoryCount[b] ? a : b
    );
}

/**
 * Expand/collapse item card
 */
function expandItemCard(pinId, index) {
    const descElement = document.getElementById(`desc-${pinId}`);
    if (descElement) {
        const isHidden = descElement.style.display === 'none';
        descElement.style.display = isHidden ? 'block' : 'none';
    }
}

/**
 * Expand all items in yard sale
 */
function expandAllItems(groupId) {
    const button = event.target;
    const itemCards = document.querySelectorAll('.item-description');
    const isExpanding = button.textContent === 'Expand All';
    
    itemCards.forEach(card => {
        card.style.display = isExpanding ? 'block' : 'none';
    });
    
    button.textContent = isExpanding ? 'Collapse All' : 'Expand All';
}

/**
 * Show interest in entire yard sale
 */
async function showInterestInYardSale(groupId) {
    const yardSaleMarker = pinMarkers.find(marker => 
        marker.yardSaleData && marker.yardSaleData.pins[0].id === groupId
    );
    
    if (!yardSaleMarker) return;
    
    const pins = yardSaleMarker.yardSaleData.pins;
    
    try {
        // Show interest in all pins
        const promises = pins.map(pin => 
            apiClient.request(`/api/pins/${pin.id}/interest`, { method: 'POST' })
        );
        
        await Promise.all(promises);
        
        showSuccess(`Interest registered for all ${pins.length} items in this yard sale!`);
        
    } catch (error) {
        console.error('Error showing interest in yard sale:', error);
        showError('Failed to register interest: ' + error.message);
    }
}

/**
 * Get directions to location
 */
function getDirections(lat, lng) {
    const destination = `${lat},${lng}`;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    window.open(url, '_blank');
}

/**
 * Track multiple pin views
 */
function trackMultipleViews(pinIds) {
    pinIds.forEach(pinId => trackPinView(pinId));
}

/**
 * Enhanced keyboard navigation for lightbox
 */
document.addEventListener('keydown', (e) => {
    const lightbox = document.querySelector('.image-lightbox');
    if (!lightbox) return;

    switch (e.key) {
        case 'Escape':
            closeLightbox();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            navigateGallery(-1);
            break;
        case 'ArrowRight':
            e.preventDefault();
            navigateGallery(1);
            break;
        case ' ':
            e.preventDefault();
            navigateGallery(1);
            break;
    }
});

/**
 * Enhanced interest toggle with loading state
 */
async function toggleInterest(pinId) {
    const button = event.target;
    const originalText = button.textContent;
    const isAddingInterest = originalText.includes('Show Interest');
    
    try {
        button.disabled = true;
        button.textContent = isAddingInterest ? 'Adding...' : 'Removing...';
        
        if (isAddingInterest) {
            await apiClient.request(`/api/pins/${pinId}/interest`, { method: 'POST' });
            button.textContent = '💔 Remove Interest';
            button.className = 'popup-btn btn-secondary';
            showSuccess('Interest added! The pin owner will be notified.');
        } else {
            // Note: You'll need to implement DELETE endpoint for removing interest
            await apiClient.request(`/api/pins/${pinId}/interest`, { method: 'DELETE' });
            button.textContent = '❤️ Show Interest';
            button.className = 'popup-btn btn-primary';
            showSuccess('Interest removed.');
        }
        
    } catch (error) {
        console.error('Error toggling interest:', error);
        showError('Failed to update interest: ' + error.message);
        button.textContent = originalText;
    } finally {
        button.disabled = false;
    }
}

/**
 * Enhanced claim pin with confirmation
 */
async function claimPin(pinId) {
    const pin = pinMarkers.find(marker => marker.options.pinId === pinId)?.pinData;
    if (!pin) return;

    const confirmed = confirm(
        `Are you sure you want to claim "${pin.item.title}"?\n\n` +
        `This will notify the owner and may remove the pin from the map.`
    );
    
    if (!confirmed) return;

    const button = event.target;
    const originalText = button.textContent;
    
    try {
        button.disabled = true;
        button.textContent = 'Claiming...';
        
        const claimData = {
            type: 'pickup_request',
            message: `I would like to claim "${pin.item.title}". Please let me know when and where I can pick it up.`,
            userLocation: userLocation
        };
        
        const response = await apiClient.request(`/api/pins/${pinId}/claim`, {
            method: 'POST',
            body: JSON.stringify(claimData)
        });
        
        if (response.success) {
            showSuccess('Claim submitted! The pin owner will be notified and should contact you soon.');
            
            // Remove pin from map or update its status
            const markerIndex = pinMarkers.findIndex(marker => marker.options.pinId === pinId);
            if (markerIndex !== -1) {
                map.removeLayer(pinMarkers[markerIndex]);
                pinMarkers.splice(markerIndex, 1);
            }
            
            // Close popup
            map.closePopup();
            
        } else {
            throw new Error(response.error || 'Failed to claim pin');
        }
        
    } catch (error) {
        console.error('Error claiming pin:', error);
        showError('Failed to claim item: ' + error.message);
        button.textContent = originalText;
        button.disabled = false;
    }
}

/**
 * Animation for new pins
 */
function animateNewPin(marker) {
    marker.getElement()?.classList.add('new');
    setTimeout(() => {
        marker.getElement()?.classList.remove('new');
    }, 600);
}

/**
 * Enhanced error handling with retry option
 */
function showError(message, allowRetry = true) {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.innerHTML = allowRetry ? 
            `${message} <button onclick="loadNearbyPins()" style="margin-left: 10px; padding: 5px 10px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">Retry</button>` :
            message;
        errorDiv.style.display = 'block';
        errorDiv.scrollIntoView({ behavior: 'smooth' });
        
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 8000);
    }
}

console.log('✅ Enhanced pin display with yard sale support loaded');