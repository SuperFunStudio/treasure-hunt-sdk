// js/image-gallery.js - Fixed version without setupEventListeners error

class ImageGallery {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.images = [];
        this.currentImageIndex = 0;
        this.modalOpen = false;
        this.currentModalIndex = 0;
        this.options = {
            maxImages: options.maxImages || 10,
            allowEdit: options.allowEdit !== false,
            allowDelete: options.allowDelete !== false,
            allowReorder: options.allowReorder !== false,
            ...options
        };
        
        this.init();
    }

    init() {
        this.createModal();
        this.setupKeyboardListeners();
    }

    // Setup keyboard event listeners
    setupKeyboardListeners() {
        document.addEventListener('keydown', (e) => {
            if (this.modalOpen) {
                this.handleKeyboardNav(e);
            }
        });
    }

    // Load images into the gallery
    loadImages(imageUrls) {
        this.images = imageUrls.map((url, index) => ({
            url,
            id: `img_${Date.now()}_${index}`,
            isPrimary: index === 0
        }));
        
        this.render();
        this.updateImageCount();
    }

    // Add a new image to the gallery
    addImage(imageUrl) {
        if (this.images.length >= this.options.maxImages) {
            this.showMessage(`Maximum of ${this.options.maxImages} images allowed`, 'warning');
            return;
        }

        const newImage = {
            url: imageUrl,
            id: `img_${Date.now()}`,
            isPrimary: this.images.length === 0
        };

        this.images.push(newImage);
        this.render();
        this.updateImageCount();
    }

    // Delete an image
    deleteImage(index) {
        if (this.images.length <= 1) {
            this.showMessage('At least one image is required', 'warning');
            return;
        }

        const wasMainImage = index === this.currentImageIndex;
        this.images.splice(index, 1);

        // If we deleted the main image, set a new main image
        if (wasMainImage) {
            this.currentImageIndex = Math.min(this.currentImageIndex, this.images.length - 1);
            this.setMainImage(this.currentImageIndex);
        } else if (index < this.currentImageIndex) {
            this.currentImageIndex--;
        }

        this.render();
        this.updateImageCount();
    }

    // Set main/primary image
    setMainImage(index) {
        if (index >= 0 && index < this.images.length) {
            this.currentImageIndex = index;
            
            // Update primary flag
            this.images.forEach((img, i) => {
                img.isPrimary = i === index;
            });

            this.render();
        }
    }

    // Render the gallery
    render() {
        if (!this.container) return;

        const cardImages = this.container.querySelector('.card-images');
        if (!cardImages) return;

        cardImages.innerHTML = this.generateGalleryHTML();
        this.attachClickListeners();
    }

    // Attach click event listeners after rendering
    attachClickListeners() {
        // Main image click
        const mainContainer = this.container.querySelector('.main-image-container');
        if (mainContainer) {
            mainContainer.onclick = () => this.openModal(this.currentImageIndex);
        }

        // Thumbnail clicks
        this.container.querySelectorAll('.thumbnail-item').forEach((item, index) => {
            item.onclick = () => this.setMainImage(index);
        });

        // Control button clicks
        this.container.querySelectorAll('.control-btn').forEach((btn) => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const index = parseInt(btn.dataset.index);
                
                if (action === 'edit') {
                    this.editImage(e, index);
                } else if (action === 'delete') {
                    this.deleteImage(index);
                } else if (action === 'expand') {
                    this.openModal(e, index);
                }
            };
        });
    }

    // Generate HTML for the gallery
    generateGalleryHTML() {
        if (this.images.length === 0) {
            return `
                <div class="no-images-state">
                    <div class="upload-placeholder">
                        <div class="placeholder-icon">📷</div>
                        <div class="placeholder-text">No images yet</div>
                    </div>
                </div>
            `;
        }

        const mainImage = this.images[this.currentImageIndex];
        
        return `
            <!-- Main Featured Image -->
            <div class="main-image-container">
                <img src="${mainImage.url}" alt="Main view" class="main-image">
                
                ${this.options.allowEdit || this.options.allowDelete ? `
                    <!-- Image Controls -->
                    <div class="image-controls">
                        ${this.options.allowEdit ? `
                            <button class="control-btn edit" data-action="edit" data-index="${this.currentImageIndex}" title="Edit Image">
                                ✏️
                            </button>
                        ` : ''}
                        <button class="control-btn expand" data-action="expand" data-index="${this.currentImageIndex}" title="View Full Size">
                            🔍
                        </button>
                        ${this.options.allowDelete ? `
                            <button class="control-btn delete" data-action="delete" data-index="${this.currentImageIndex}" title="Delete Image">
                                🗑️
                            </button>
                        ` : ''}
                    </div>
                ` : ''}

                <!-- Image Count Badge -->
                <div class="image-count-badge">
                    ${this.images.length} ${this.images.length === 1 ? 'photo' : 'photos'}
                </div>
            </div>

            <!-- Thumbnail Strip -->
            ${this.images.length > 1 ? `
                <div class="thumbnail-strip">
                    ${this.images.map((img, index) => `
                        <div class="thumbnail-item ${index === this.currentImageIndex ? 'active' : ''}" data-index="${index}">
                            <img src="${img.url}" alt="View ${index + 1}">
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;
    }

    // Handle keyboard navigation in modal
    handleKeyboardNav(e) {
        switch(e.key) {
            case 'Escape':
                this.closeModal();
                break;
            case 'ArrowLeft':
                if (this.currentImageIndex > 0) {
                    this.openModal(this.currentImageIndex - 1);
                }
                break;
            case 'ArrowRight':
                if (this.currentImageIndex < this.images.length - 1) {
                    this.openModal(this.currentImageIndex + 1);
                }
                break;
        }
    }

    // Create modal element
    createModal() {
        if (document.getElementById('imageGalleryModal')) return;

        const modal = document.createElement('div');
        modal.id = 'imageGalleryModal';
        modal.className = 'image-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <button class="modal-close">×</button>
                <img src="" alt="" class="modal-image" id="modalGalleryImage">
                <div class="modal-controls">
                    <button class="btn btn-secondary modal-edit-btn">
                        ✏️ Edit
                    </button>
                    <button class="btn btn-primary modal-primary-btn">
                        ⭐ Set as Primary
                    </button>
                    <button class="btn btn-ghost modal-delete-btn">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `;
        
        // Setup modal event listeners
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.onclick = () => this.closeModal();
        
        const editBtn = modal.querySelector('.modal-edit-btn');
        editBtn.onclick = () => this.editModalImage();
        
        const primaryBtn = modal.querySelector('.modal-primary-btn');
        primaryBtn.onclick = () => this.setAsPrimary();
        
        const deleteBtn = modal.querySelector('.modal-delete-btn');
        deleteBtn.onclick = () => this.deleteModalImage();
        
        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });

        document.body.appendChild(modal);
    }

    // Open modal
    openModal(eventOrIndex, index = null) {
        if (typeof eventOrIndex === 'number') {
            index = eventOrIndex;
        } else {
            if (eventOrIndex && eventOrIndex.stopPropagation) {
                eventOrIndex.stopPropagation();
            }
            index = index || this.currentImageIndex;
        }

        this.currentModalIndex = index;
        const modal = document.getElementById('imageGalleryModal');
        const modalImage = document.getElementById('modalGalleryImage');
        
        if (modal && modalImage && this.images[index]) {
            modalImage.src = this.images[index].url;
            modalImage.alt = `Image ${index + 1}`;
            modal.classList.add('active');
            this.modalOpen = true;
            
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
        }
    }

    // Close modal
    closeModal() {
        const modal = document.getElementById('imageGalleryModal');
        if (modal) {
            modal.classList.remove('active');
            this.modalOpen = false;
            document.body.style.overflow = 'auto';
        }
    }

    // Edit image
    editImage(event, index) {
        if (event) event.stopPropagation();
        
        console.log('Edit image at index:', index);
        
        // Example integration point for image editing
        if (this.options.onEdit) {
            this.options.onEdit(this.images[index], index);
        } else {
            this.showMessage('Image editing functionality would open here', 'info');
        }
    }

    // Modal actions
    editModalImage() {
        this.editImage(null, this.currentModalIndex);
    }

    setAsPrimary() {
        this.setMainImage(this.currentModalIndex);
        this.closeModal();
        this.showMessage('Image set as primary view', 'success');
    }

    deleteModalImage() {
        if (confirm('Are you sure you want to delete this image?')) {
            this.deleteImage(this.currentModalIndex);
            this.closeModal();
        }
    }

    // Update image count display
    updateImageCount() {
        const badge = this.container.querySelector('.image-count-badge');
        if (badge) {
            badge.innerHTML = `${this.images.length} ${this.images.length === 1 ? 'photo' : 'photos'}`;
        }

        // Notify parent component if callback provided
        if (this.options.onImageCountChange) {
            this.options.onImageCountChange(this.images.length);
        }
    }

    // Show message to user
    showMessage(message, type = 'info') {
        console.log(`${type.toUpperCase()}: ${message}`);
        
        // Try to use existing message system
        const messageContainer = document.getElementById('successMessage') || 
                                document.getElementById('errorMessage');
        
        if (messageContainer) {
            messageContainer.textContent = message;
            messageContainer.style.display = 'block';
            messageContainer.className = type;
            
            // Auto-hide after 3 seconds
            setTimeout(() => {
                messageContainer.style.display = 'none';
            }, 3000);
        }
    }

    // Get current images data
    getImages() {
        return this.images.map(img => ({
            url: img.url,
            id: img.id,
            isPrimary: img.isPrimary
        }));
    }

    // Get primary image
    getPrimaryImage() {
        return this.images.find(img => img.isPrimary) || this.images[0];
    }
}

// Global gallery instance
let imageGallery = null;

// Initialize gallery function
function initializeImageGallery(containerId, options = {}) {
    try {
        imageGallery = new ImageGallery(containerId, options);
        return imageGallery;
    } catch (error) {
        console.error('Error initializing image gallery:', error);
        return null;
    }
}

// Convenience functions for direct integration
function setMainImage(index) {
    if (imageGallery) {
        imageGallery.setMainImage(index);
    }
}

function openImageModal(eventOrIndex, index = null) {
    if (imageGallery) {
        imageGallery.openModal(eventOrIndex, index);
    }
}

function closeImageModal() {
    if (imageGallery) {
        imageGallery.closeModal();
    }
}

function editImage(event, index) {
    if (imageGallery) {
        imageGallery.editImage(event, index);
    }
}

function deleteImage(event, index) {
    if (imageGallery) {
        imageGallery.deleteImage(index);
    }
}

function addNewImage() {
    if (imageGallery) {
        imageGallery.triggerImageUpload();
    }
}