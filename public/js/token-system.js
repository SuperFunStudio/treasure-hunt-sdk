// Token System JavaScript
// Handles token modal, purchases, subscriptions, and marketplace token economy

// Token costs and rewards configuration
const TOKEN_CONFIG = {
    costs: {
        scan: 1,
        reserve: 1,
        claim: 1
    },
    rewards: {
        pin_created: 2,
        pin_claimed: 5
    }
};

// Show token modal
function showTokenModal() {
    const modal = document.getElementById('tokenModal');
    if (modal) {
        modal.style.display = 'flex';
        updateModalTokenCount();
    }
}

// Close token modal
function closeTokenModal() {
    const modal = document.getElementById('tokenModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Update token count in modal
function updateModalTokenCount() {
    const tokenCount = document.getElementById('tokenCountDisplay')?.textContent || '5';
    const modalCount = document.getElementById('modalTokenCount');
    if (modalCount) {
        modalCount.textContent = `${tokenCount} tokens`;
    }
}

// Select token package
async function selectPackage(packageType) {
    const packages = {
        'starter': { tokens: 10, price: 4.99 },
        'value': { tokens: 25, price: 9.99 },
        'power': { tokens: 50, price: 14.99 },
        'pro': { tokens: 100, price: 24.99 }
    };

    const selectedPackage = packages[packageType];
    if (!selectedPackage) {
        console.error('Invalid package type:', packageType);
        return;
    }

    try {
        if (!currentUser) {
            window.location.href = '/signin.html';
            return;
        }

        // Get auth token
        const idToken = await currentUser.getIdToken();

        // Call backend to create Stripe checkout session
        const response = await fetch('/api/tokens/purchase', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ packageType })
        });

        const data = await response.json();

        if (data.success && data.url) {
            // Redirect to Stripe checkout
            window.location.href = data.url;
        } else {
            throw new Error(data.error || 'Failed to create checkout session');
        }
    } catch (error) {
        console.error('Error purchasing tokens:', error);
        UIHelpers.showError('Failed to initiate purchase. Please try again.');
    }
}

// Select subscription
async function selectSubscription(tier) {
    const subscriptions = {
        'pro': { price: 9.99, name: 'Go Pro' },
        'premium': { price: 19.99, name: 'Go Premium' }
    };

    const selectedSub = subscriptions[tier];
    if (!selectedSub) {
        console.error('Invalid subscription tier:', tier);
        return;
    }

    try {
        if (!currentUser) {
            window.location.href = '/signin.html';
            return;
        }

        // Get auth token
        const idToken = await currentUser.getIdToken();

        // Call backend to create Stripe subscription checkout session
        const response = await fetch('/api/tokens/subscribe', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tier })
        });

        const data = await response.json();

        if (data.success && data.url) {
            // Redirect to Stripe checkout
            window.location.href = data.url;
        } else {
            throw new Error(data.error || 'Failed to create subscription session');
        }
    } catch (error) {
        console.error('Error creating subscription:', error);
        UIHelpers.showError('Failed to create subscription. Please try again.');
    }
}

// Load token balance from backend API
async function loadTokenBalance() {
    try {
        if (!currentUser) {
            console.log('No authenticated user, skipping token load');
            return 5;
        }

        // Get auth token
        const idToken = await currentUser.getIdToken();

        // Call backend API
        const response = await fetch('/api/tokens/balance', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            const tokenBalance = data.balance;
            const subscription = data.subscription;

            // Update UI
            const tokenCountEl = document.getElementById('tokenCountDisplay');
            if (tokenCountEl) {
                tokenCountEl.textContent = tokenBalance;
            }

            // Show unlimited badge if user has active subscription
            if (data.unlimitedTokens) {
                const tokenCard = document.querySelector('.token-card');
                if (tokenCard && !tokenCard.querySelector('.unlimited-badge')) {
                    const badge = document.createElement('div');
                    badge.className = 'unlimited-badge';
                    badge.textContent = `${subscription.tier.toUpperCase()} - Unlimited`;
                    badge.style.cssText = 'position: absolute; top: 10px; right: 10px; background: rgba(255,215,0,0.9); color: #333; padding: 5px 10px; border-radius: 5px; font-size: 11px; font-weight: 600;';
                    tokenCard.appendChild(badge);
                }
            }

            console.log('Token balance loaded:', tokenBalance);
            return tokenBalance;
        } else {
            throw new Error(data.error || 'Failed to load balance');
        }
    } catch (error) {
        console.error('Error loading token balance:', error);
        // Fallback to Firestore if API fails
        try {
            const db = firebase.firestore();
            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            if (userDoc.exists) {
                const balance = userDoc.data().tokens?.balance || 15;
                const tokenCountEl = document.getElementById('tokenCountDisplay');
                if (tokenCountEl) tokenCountEl.textContent = balance;
                return balance;
            }
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
        }
        return 15; // Return default on error
    }
}

// Check if user has enough tokens
async function checkTokenBalance(requiredTokens = 1) {
    try {
        const balance = await loadTokenBalance();
        return balance >= requiredTokens;
    } catch (error) {
        console.error('Error checking token balance:', error);
        return false;
    }
}

// Spend tokens for an action
async function spendTokens(action, metadata = {}) {
    const cost = TOKEN_CONFIG.costs[action] || 0;

    if (cost === 0) {
        return { success: true, balance: await loadTokenBalance() };
    }

    try {
        if (!currentUser) {
            window.location.href = '/signin.html';
            return { success: false, error: 'Not authenticated' };
        }

        const idToken = await currentUser.getIdToken();

        const response = await fetch('/api/tokens/spend', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.uid,
                amount: cost,
                reason: action,
                relatedId: metadata.relatedId || null
            })
        });

        const data = await response.json();

        if (!response.ok) {
            if (data.error === 'Insufficient tokens') {
                showInsufficientTokensModal(cost, data.balance);
                return { success: false, error: 'insufficient_tokens', balance: data.balance };
            }
            throw new Error(data.error || 'Failed to spend tokens');
        }

        // Update UI
        const tokenCountEl = document.getElementById('tokenCountDisplay');
        if (tokenCountEl) {
            tokenCountEl.textContent = data.balance;
        }

        console.log(`✅ Spent ${cost} tokens for ${action}. New balance: ${data.balance}`);
        return { success: true, balance: data.balance, amount: cost };
    } catch (error) {
        console.error('Error spending tokens:', error);
        return { success: false, error: error.message };
    }
}

// Award tokens for an action
async function awardTokens(action, customAmount = null, metadata = {}) {
    const amount = customAmount || TOKEN_CONFIG.rewards[action] || 0;

    if (amount === 0) {
        return { success: true, balance: await loadTokenBalance() };
    }

    try {
        // Get current Firebase user
        const currentUser = firebase.auth().currentUser;

        if (!currentUser) {
            return { success: false, error: 'Not authenticated' };
        }

        const idToken = await currentUser.getIdToken();

        const response = await fetch('/api/tokens/award', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.uid,
                amount: amount,
                reason: action,
                relatedId: metadata.relatedId || null
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to award tokens');
        }

        // Update UI
        const tokenCountEl = document.getElementById('tokenCountDisplay');
        if (tokenCountEl) {
            tokenCountEl.textContent = data.balance;
        }

        // Show success notification
        showTokenEarnedNotification(amount, action);

        console.log(`✅ Earned ${amount} tokens for ${action}. New balance: ${data.balance}`);
        return { success: true, balance: data.balance, amount: amount };
    } catch (error) {
        console.error('Error awarding tokens:', error);
        return { success: false, error: error.message };
    }
}

// Show insufficient tokens modal
function showInsufficientTokensModal(required, current) {
    const existingModal = document.querySelector('.token-insufficient-modal-overlay');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay token-insufficient-modal-overlay';
    modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 10000; align-items: center; justify-content: center;';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px; background: #334155; padding: 2rem; border-radius: 1rem; text-align: center; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8); border: 1px solid rgba(148, 163, 184, 0.1);">
            <div style="font-size: 4rem; margin-bottom: 1rem;">⚠️</div>
            <h2 style="margin-bottom: 1rem; color: #f1f5f9;">Insufficient Tokens</h2>
            <p style="color: #cbd5e1;">You need <strong style="color: #f97316;">${required} tokens</strong> to perform this action.</p>
            <p style="color: #94a3b8; margin: 1rem 0 2rem 0;">Your balance: <strong style="color: #f1f5f9;">${current} tokens</strong></p>

            <div style="display: flex; gap: 1rem; justify-content: center;">
                <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove(); window.location.href='index.html';">
                    📍 Earn by Pinning
                </button>
                <button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove(); showTokenModal();">
                    💳 Purchase Tokens
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Show token earned notification
function showTokenEarnedNotification(amount, reason) {
    const notification = document.createElement('div');
    notification.className = 'token-earned-notification';
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: linear-gradient(135deg, #22c55e, #10b981);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.75rem;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        animation: slideInRight 0.3s ease, slideOutRight 0.3s ease 2.7s;
    `;

    const reasonText = {
        'pin_created': 'Item pinned to map',
        'pin_claimed': 'Your pin was claimed',
        'referral': 'Friend joined',
        'monthly_allocation': 'Monthly bonus'
    };

    notification.innerHTML = `
        <span style="font-size: 1.5rem;">🎉</span>
        <div>
            <div style="font-weight: 700; font-size: 1rem;">+${amount} tokens earned!</div>
            <div style="font-size: 0.875rem; opacity: 0.9;">${reasonText[reason] || reason}</div>
        </div>
    `;

    document.body.appendChild(notification);

    // Remove after animation
    setTimeout(() => {
        notification.remove();
    }, 3000);

    // Add animation keyframes if not present
    if (!document.getElementById('tokenAnimations')) {
        const style = document.createElement('style');
        style.id = 'tokenAnimations';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(400px); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Export functions for use in other scripts
window.tokenSystem = {
    showModal: showTokenModal,
    closeModal: closeTokenModal,
    loadBalance: loadTokenBalance,
    checkBalance: checkTokenBalance,
    spendTokens: spendTokens,
    awardTokens: awardTokens,
    costs: TOKEN_CONFIG.costs,
    rewards: TOKEN_CONFIG.rewards
};
