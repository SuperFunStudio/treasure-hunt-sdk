// js/listing-preview.js
// Modal for previewing and editing eBay listing before posting

class ListingPreviewModal {
    constructor() {
        this.modal = null;
        this.listingData = null;
        this.onConfirm = null;
        this.onCancel = null;
    }

    show(listingData, onConfirm, onCancel) {
        this.listingData = listingData;
        this.onConfirm = onConfirm;
        this.onCancel = onCancel;
        
        this.createModal();
        this.populateForm();
        this.attachEventListeners();
        
        // Show modal
        document.body.appendChild(this.modal);
        setTimeout(() => this.modal.classList.add('active'), 10);
    }

    hide() {
        if (this.modal) {
            this.modal.classList.remove('active');
            setTimeout(() => {
                if (this.modal && this.modal.parentNode) {
                    this.modal.parentNode.removeChild(this.modal);
                }
                this.modal = null;
            }, 300);
        }
    }

    createModal() {
        this.modal = document.createElement('div');
        this.modal.className = 'listing-modal-overlay';
        this.modal.innerHTML = `
            <div class="listing-modal">
                <div class="modal-header">
                    <h2>Review Your eBay Listing</h2>
                    <button class="close-btn" type="button">&times;</button>
                </div>
                
                <div class="modal-content">
                    <div class="preview-grid">
                        <!-- Left: Listing Preview -->
                        <div class="listing-preview-section">
                            <h3>How it will appear on eBay</h3>
                            
                            <div class="preview-images">
                                <img id="previewMainImage" class="preview-main-image" alt="Main listing photo">
                                <div id="previewThumbnails" class="preview-thumbnails"></div>
                            </div>
                            
                            <div class="preview-details">
                                <h4 id="previewTitle" class="preview-title"></h4>
                                <div class="preview-price" id="previewPrice"></div>
                                <div class="preview-meta">
                                    <span class="meta-item">Condition: <span id="previewCondition"></span></span>
                                    <span class="meta-item">Category: <span id="previewCategory"></span></span>
                                </div>
                                <div class="preview-description">
                                    <h5>Description</h5>
                                    <p id="previewDescriptionText"></p>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Right: Editable Form -->
                        <div class="listing-form-section">
                            <h3>Edit Listing Details</h3>
                            
                            <div class="form-group">
                                <label for="editTitle">Title (Max 80 characters)</label>
                                <input type="text" id="editTitle" maxlength="80" class="form-input">
                                <div class="char-count"><span id="titleCount">0</span>/80</div>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="editCondition">Condition</label>
                                    <select id="editCondition" class="form-input">
                                        <option value="new">New</option>
                                        <option value="like_new">Like New</option>
                                        <option value="excellent">Excellent</option>
                                        <option value="very_good">Very Good</option>
                                        <option value="good">Good</option>
                                        <option value="acceptable">Acceptable</option>
                                        <option value="for_parts">For Parts/Not Working</option>
                                    </select>
                                </div>
                                
                                <div class="form-group">
                                    <label for="editCategory">Category</label>
                                    <input type="text" id="editCategory" class="form-input">
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label for="editDescription">Description</label>
                                <textarea id="editDescription" rows="6" class="form-input"></textarea>
                            </div>
                            
                            <div class="pricing-section">
                                <h4>Pricing</h4>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="editStartingPrice">Starting Price ($)</label>
                                        <input type="number" id="editStartingPrice" min="0.99" step="0.01" class="form-input">
                                    </div>
                                    
                                    <div class="form-group">
                                        <label for="editBuyItNow">Buy It Now ($)</label>
                                        <input type="number" id="editBuyItNow" min="0.99" step="0.01" class="form-input">
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label class="checkbox-label">
                                        <input type="checkbox" id="editAcceptOffers" checked>
                                        Accept Best Offers
                                    </label>
                                </div>
                                
                                <div class="profit-calc">
                                    <h5>Estimated Profit</h5>
                                    <div class="calc-row">
                                        <span>Sale Price:</span>
                                        <span id="calcSalePrice">$0.00</span>
                                    </div>
                                    <div class="calc-row">
                                        <span>eBay Fees (13.25%):</span>
                                        <span id="calcFees">$0.00</span>
                                    </div>
                                    <div class="calc-row total">
                                        <span>Your Profit:</span>
                                        <span id="calcProfit">$0.00</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="shipping-section">
                                <h4>Shipping</h4>
                                <div class="shipping-options">
                                    <label class="radio-option">
                                        <input type="radio" name="shipping" value="calculated" checked>
                                        <span>Calculated Shipping (Buyer pays actual cost)</span>
                                    </label>
                                    <label class="radio-option">
                                        <input type="radio" name="shipping" value="free">
                                        <span>Free Shipping (Include cost in price)</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button class="btn btn-secondary cancel-btn" type="button">Cancel</button>
                    <button class="btn btn-primary confirm-btn" type="button">
                        <span class="btn-text">Create eBay Listing</span>
                        <span class="btn-loading" style="display: none;">Creating...</span>
                    </button>
                </div>
            </div>
        `;
    }

    populateForm() {
        // Populate form fields with listing data
        document.getElementById('editTitle').value = this.listingData.title || '';
        document.getElementById('editCondition').value = this.listingData.condition || 'good';
        document.getElementById('editCategory').value = this.listingData.category || '';
        document.getElementById('editDescription').value = this.listingData.description || '';
        document.getElementById('editStartingPrice').value = this.listingData.pricing?.starting || '';
        document.getElementById('editBuyItNow').value = this.listingData.pricing?.buyItNow || '';
        document.getElementById('editAcceptOffers').checked = this.listingData.pricing?.acceptOffers !== false;
        
        // Set shipping option
        const shippingType = this.listingData.shipping?.type || 'calculated';
        document.querySelector(`input[name="shipping"][value="${shippingType}"]`).checked = true;
        
        // Display images
        this.displayImages();
        
        // Update preview
        this.updatePreview();
        
        // Update character count
        this.updateCharCount();
        
        // Update calculations
        this.updateCalculations();
    }

    displayImages() {
        const mainImage = document.getElementById('previewMainImage');
        const thumbnails = document.getElementById('previewThumbnails');
        
        if (!this.listingData.images || this.listingData.images.length === 0) {
            mainImage.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDMwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjRjVGNUY1Ii8+Cjx0ZXh0IHg9IjE1MCIgeT0iMTUwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiPk5vIFBob3RvPC90ZXh0Pgo8L3N2Zz4K';
            thumbnails.innerHTML = '';
            return;
        }
        
        // Set main image
        mainImage.src = this.listingData.images[0];
        
        // Create thumbnails
        thumbnails.innerHTML = '';
        this.listingData.images.forEach((imageUrl, index) => {
            const thumb = document.createElement('img');
            thumb.className = 'preview-thumbnail';
            thumb.src = imageUrl;
            thumb.alt = `Photo ${index + 1}`;
            
            thumb.addEventListener('click', () => {
                mainImage.src = imageUrl;
                document.querySelectorAll('.preview-thumbnail').forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
            });
            
            if (index === 0) thumb.classList.add('active');
            thumbnails.appendChild(thumb);
        });
    }

    attachEventListeners() {
        // Close button
        this.modal.querySelector('.close-btn').addEventListener('click', () => {
            this.hide();
            if (this.onCancel) this.onCancel();
        });
        
        // Cancel button
        this.modal.querySelector('.cancel-btn').addEventListener('click', () => {
            this.hide();
            if (this.onCancel) this.onCancel();
        });
        
        // Confirm button
        this.modal.querySelector('.confirm-btn').addEventListener('click', () => {
            this.handleConfirm();
        });
        
        // Form field listeners for live preview
        const formFields = ['editTitle', 'editCondition', 'editCategory', 'editDescription', 'editStartingPrice', 'editBuyItNow'];
        formFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('input', () => {
                    this.updatePreview();
                    if (fieldId === 'editTitle') this.updateCharCount();
                    if (fieldId.includes('Price')) this.updateCalculations();
                });
            }
        });
        
        // Shipping option listeners
        document.querySelectorAll('input[name="shipping"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.updateCalculations();
            });
        });
        
        // Click outside to close
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
                if (this.onCancel) this.onCancel();
            }
        });
    }

    updatePreview() {
        document.getElementById('previewTitle').textContent = document.getElementById('editTitle').value;
        document.getElementById('previewCondition').textContent = this.formatCondition(document.getElementById('editCondition').value);
        document.getElementById('previewCategory').textContent = document.getElementById('editCategory').value;
        document.getElementById('previewDescriptionText').textContent = document.getElementById('editDescription').value;
        
        const buyItNowPrice = parseFloat(document.getElementById('editBuyItNow').value) || 0;
        document.getElementById('previewPrice').textContent = `$${buyItNowPrice.toFixed(2)}`;
    }

    updateCharCount() {
        const titleInput = document.getElementById('editTitle');
        const countSpan = document.getElementById('titleCount');
        
        const currentLength = titleInput.value.length;
        countSpan.textContent = currentLength;
        
        // Color coding
        if (currentLength > 75) {
            countSpan.style.color = '#f44336';
        } else if (currentLength > 60) {
            countSpan.style.color = '#ff9800';
        } else {
            countSpan.style.color = '#4caf50';
        }
    }

    updateCalculations() {
        const salePrice = parseFloat(document.getElementById('editBuyItNow').value) || 0;
        const fees = salePrice * 0.1325; // 13.25% eBay fees
        const profit = salePrice - fees;
        
        document.getElementById('calcSalePrice').textContent = `$${salePrice.toFixed(2)}`;
        document.getElementById('calcFees').textContent = `$${fees.toFixed(2)}`;
        document.getElementById('calcProfit').textContent = `$${Math.max(0, profit).toFixed(2)}`;
    }

    formatCondition(condition) {
        const conditionMap = {
            'new': 'New',
            'like_new': 'Like New',
            'excellent': 'Excellent',
            'very_good': 'Very Good',
            'good': 'Good',
            'acceptable': 'Acceptable',
            'for_parts': 'For Parts/Not Working'
        };
        return conditionMap[condition] || 'Good';
    }

    async handleConfirm() {
        const confirmBtn = this.modal.querySelector('.confirm-btn');
        const btnText = confirmBtn.querySelector('.btn-text');
        const btnLoading = confirmBtn.querySelector('.btn-loading');
        
        // Show loading state
        confirmBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline';
        
        try {
            // Collect form data
            const updatedListingData = {
                ...this.listingData,
                title: document.getElementById('editTitle').value,
                condition: document.getElementById('editCondition').value,
                category: document.getElementById('editCategory').value,
                description: document.getElementById('editDescription').value,
                pricing: {
                    starting: parseFloat(document.getElementById('editStartingPrice').value) || 0.99,
                    buyItNow: parseFloat(document.getElementById('editBuyItNow').value) || 9.99,
                    acceptOffers: document.getElementById('editAcceptOffers').checked
                },
                shipping: {
                    type: document.querySelector('input[name="shipping"]:checked').value
                }
            };
            
            // Call confirm callback
            if (this.onConfirm) {
                await this.onConfirm(updatedListingData);
            }
            
            // Hide modal on success
            this.hide();
            
        } catch (error) {
            console.error('Error confirming listing:', error);
            
            // Reset button state
            confirmBtn.disabled = false;
            btnText.style.display = 'inline';
            btnLoading.style.display = 'none';
            
            // Show error in the modal
            const errorDiv = document.createElement('div');
            errorDiv.className = 'modal-error';
            errorDiv.textContent = 'Error: ' + error.message;
            
            const existingError = this.modal.querySelector('.modal-error');
            if (existingError) {
                existingError.remove();
            }
            
            this.modal.querySelector('.modal-content').appendChild(errorDiv);
        }
    }

    getFormData() {
        return {
            title: document.getElementById('editTitle').value,
            condition: document.getElementById('editCondition').value,
            category: document.getElementById('editCategory').value,
            description: document.getElementById('editDescription').value,
            pricing: {
                starting: parseFloat(document.getElementById('editStartingPrice').value) || 0.99,
                buyItNow: parseFloat(document.getElementById('editBuyItNow').value) || 9.99,
                acceptOffers: document.getElementById('editAcceptOffers').checked
            },
            shipping: {
                type: document.querySelector('input[name="shipping"]:checked')?.value || 'calculated'
            }
        };
    }
}

// Global instance
window.listingPreviewModal = new ListingPreviewModal();