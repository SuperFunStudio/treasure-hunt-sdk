// shared/ui-helpers.js
// Common UI helper functions and utilities

class UIHelpers {
    static showSuccess(message, duration = 5000) {
        console.log('✅', message);
        const successDiv = document.getElementById('successMessage');
        
        if (successDiv) {
            successDiv.innerHTML = message;
            successDiv.style.display = 'block';
            successDiv.scrollIntoView({ behavior: 'smooth' });
            
            if (duration > 0) {
                setTimeout(() => {
                    successDiv.style.display = 'none';
                }, duration);
            }
        } else {
            this.createTemporaryMessage(message, 'success', duration);
        }
    }

    static showError(message, duration = 0) {
        console.error('❌', message);
        const errorDiv = document.getElementById('errorMessage');
        
        if (errorDiv) {
            errorDiv.innerHTML = message;
            errorDiv.style.display = 'block';
            errorDiv.scrollIntoView({ behavior: 'smooth' });
            
            if (duration > 0) {
                setTimeout(() => {
                    errorDiv.style.display = 'none';
                }, duration);
            }
        } else {
            this.createTemporaryMessage(message, 'error', duration || 8000);
        }
    }

    static clearMessages() {
        const errorDiv = document.getElementById('errorMessage');
        const successDiv = document.getElementById('successMessage');
        
        if (errorDiv) errorDiv.style.display = 'none';
        if (successDiv) successDiv.style.display = 'none';
    }

    static createTemporaryMessage(message, type, duration = 5000) {
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            background: ${type === 'success' ? '#4caf50' : '#f44336'};
        `;
        messageDiv.innerHTML = message;
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, duration);
    }

    static showLoading(show, text = 'Loading...', containerId = 'loadingState') {
        const loadingElement = document.getElementById(containerId);
        const loadingText = document.getElementById('loadingText');
        
        if (loadingElement) {
            loadingElement.style.display = show ? 'block' : 'none';
            if (loadingText && text) {
                loadingText.textContent = text;
            }
        }
    }

    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    static getInitials(name) {
        if (!name) return 'TH';
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    static getCategoryIcon(category) {
        const icons = {
            'electronics': '📱',
            'furniture': '🪑',
            'clothing': '👕',
            'tools': '🔧',
            'books': '📚',
            'toys': '🧸',
            'jewelry': '💍',
            'automotive': '🚗',
            'sporting goods': '⚽',
            'home & garden': '🏡'
        };
        
        return icons[category?.toLowerCase()] || '📦';
    }

    static fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    static createModal(title, content, buttons = []) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
            background: rgba(0,0,0,0.5); z-index: 1000; 
            display: flex; align-items: center; justify-content: center;
        `;

        const buttonHtml = buttons.map(btn => 
            `<button onclick="${btn.action}" class="btn ${btn.class || 'btn-secondary'}" style="flex: 1;">
                ${btn.text}
            </button>`
        ).join('');

        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 15px; max-width: 500px; margin: 20px; position: relative;">
                <h3 style="margin-bottom: 20px;">${title}</h3>
                <div style="margin-bottom: 20px;">${content}</div>
                <div style="display: flex; gap: 15px;">${buttonHtml}</div>
                <button onclick="this.closest('[style*=\"position: fixed\"]').remove()" 
                    style="position: absolute; top: 10px; right: 15px; background: none; 
                           border: none; font-size: 20px; cursor: pointer;">×</button>
            </div>
        `;

        document.body.appendChild(modal);
        return modal;
    }

    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

// Export to global scope
window.UIHelpers = UIHelpers;