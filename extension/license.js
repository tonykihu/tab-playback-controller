// License management module
// Handles free vs premium feature gating
// Uses chrome.storage.sync so license persists across devices

const License = {
  TIERS: {
    FREE: 'free',
    PREMIUM: 'premium',
    PRO: 'pro',
  },

  // Features gated by tier
  FEATURES: {
    volumeControl:  'premium',
    soundProfiles:  'premium',
    sleepTimer:     'premium',
    playbackSpeed:  'premium',
    pipMode:        'premium',
    focusScheduler: 'pro',
    audioHistory:   'pro',
    crossDeviceSync:'pro',
    audioDucking:   'pro',
    apiWebhooks:    'pro',
  },

  _cache: null,

  // Get current license state
  async get() {
    if (this._cache) return this._cache;
    const stored = await chrome.storage.sync.get('license');
    this._cache = stored.license || {
      tier: this.TIERS.FREE,
      key: null,
      activatedAt: null,
      expiresAt: null,
    };
    return this._cache;
  },

  // Check if a specific feature is unlocked
  async hasFeature(featureName) {
    const license = await this.get();
    const requiredTier = this.FEATURES[featureName];
    if (!requiredTier) return true; // Unknown features default to free

    if (license.tier === this.TIERS.PRO) return true;
    if (license.tier === this.TIERS.PREMIUM && requiredTier === 'premium') return true;
    return false;
  },

  // Check if user is on any paid tier
  async isPaid() {
    const license = await this.get();
    return license.tier !== this.TIERS.FREE;
  },

  // Activate a license key
  // TODO: Replace with real server validation when backend is ready
  async activate(key) {
    // For now, accept specific test keys for development
    // Replace this with an API call to your license server
    let tier = null;

    if (key.startsWith('TPC-PREM-')) {
      tier = this.TIERS.PREMIUM;
    } else if (key.startsWith('TPC-PRO-')) {
      tier = this.TIERS.PRO;
    }

    if (!tier) {
      return { success: false, error: 'Invalid license key' };
    }

    const license = {
      tier,
      key,
      activatedAt: Date.now(),
      expiresAt: null, // null = lifetime, or set a timestamp for subscriptions
    };

    await chrome.storage.sync.set({ license });
    this._cache = license;
    return { success: true, tier };
  },

  // Deactivate / reset to free
  async deactivate() {
    const license = {
      tier: this.TIERS.FREE,
      key: null,
      activatedAt: null,
      expiresAt: null,
    };
    await chrome.storage.sync.set({ license });
    this._cache = license;
  },

  // Listen for license changes (e.g. activated on another device)
  onChange(callback) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.license) {
        this._cache = changes.license.newValue;
        callback(this._cache);
      }
    });
  },
};
