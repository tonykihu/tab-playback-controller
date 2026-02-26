// Popup reads shared state from storage, handles UI and playback toggles

let mediaTabs = new Map();
let hasPremium = false;

// Load state from storage
async function loadState() {
  const result = await chrome.storage.local.get('mediaTabs');
  if (result.mediaTabs) {
    mediaTabs = new Map(JSON.parse(result.mediaTabs));
  } else {
    mediaTabs = new Map();
  }
}

// Save state to storage
async function saveState() {
  await chrome.storage.local.set({
    mediaTabs: JSON.stringify(Array.from(mediaTabs.entries()))
  });
}

// Check a single tab for media (used only for manual refresh)
async function checkTabForMedia(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || tab.url.startsWith('chrome') || tab.url.startsWith('about') || tab.url.startsWith('edge')) {
      return false;
    }

    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const allMedia = document.querySelectorAll('video, audio');
        for (const media of allMedia) {
          const hasSrc = media.currentSrc || media.src || media.querySelector('source');
          const hasDuration = media.duration > 0;
          if (hasSrc && hasDuration) {
            return { hasMedia: true, isPlaying: !media.paused };
          }
        }
        return { hasMedia: false, isPlaying: false };
      }
    });

    if (result?.result?.hasMedia) {
      mediaTabs.set(tabId, {
        id: tabId,
        title: tab.title,
        url: tab.url,
        favIconUrl: tab.favIconUrl,
        isPlaying: result.result.isPlaying
      });
      await saveState();
      return true;
    }
  } catch (error) {
    // Ignore restricted pages
  }
  return false;
}

// Focus browser on a specific tab
function focusTab(tabId) {
  chrome.tabs.update(tabId, { active: true });
  chrome.tabs.get(tabId, (tab) => {
    if (tab?.windowId) chrome.windows.update(tab.windowId, { focused: true });
  });
}

// Extract domain from URL for grouping
function getDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return 'Unknown';
  }
}

// Get a friendly name for known domains
function getDomainLabel(domain) {
  const labels = {
    'youtube.com': 'YouTube',
    'music.youtube.com': 'YouTube Music',
    'open.spotify.com': 'Spotify',
    'soundcloud.com': 'SoundCloud',
    'twitch.tv': 'Twitch',
    'netflix.com': 'Netflix',
    'disneyplus.com': 'Disney+',
    'music.apple.com': 'Apple Music',
    'pandora.com': 'Pandora',
    'tidal.com': 'Tidal',
    'deezer.com': 'Deezer',
    'vimeo.com': 'Vimeo',
    'dailymotion.com': 'Dailymotion',
    'music.amazon.com': 'Amazon Music',
    'podcasts.google.com': 'Google Podcasts',
  };
  return labels[domain] || domain;
}

// Toggle playback for a specific tab
async function toggleTabPlayback(tabId) {
  const tabInfo = mediaTabs.get(tabId);
  if (!tabInfo) return;

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (shouldPause) => {
        const mediaElements = document.querySelectorAll('video, audio');
        let newState = !shouldPause;

        mediaElements.forEach(media => {
          if (shouldPause) {
            media.pause();
          } else {
            media.play().catch(() => {
              const playButton = media.closest('video')?.querySelector('.ytp-play-button') ||
                               media.closest('audio')?.parentElement?.querySelector('[aria-label="Play"]');
              if (playButton) playButton.click();
            });
          }
        });
        return newState;
      },
      args: [tabInfo.isPlaying]
    });

    if (result?.result !== undefined) {
      mediaTabs.set(tabId, {
        ...tabInfo,
        isPlaying: result.result,
        lastAccessed: Date.now()
      });
      await saveState();
    }
  } catch (error) {
    console.error(`Error toggling tab ${tabId}:`, error);
  }
  updateTabsList();
}

// Set volume for a specific tab
async function setTabVolume(tabId, volume) {
  const tabInfo = mediaTabs.get(tabId);
  if (!tabInfo) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (vol) => {
        const allMedia = document.querySelectorAll('video, audio');
        allMedia.forEach(media => {
          media.volume = vol;
        });
      },
      args: [volume]
    });

    mediaTabs.set(tabId, { ...tabInfo, volume });
    await saveState();
  } catch (error) {
    console.error(`Error setting volume for tab ${tabId}:`, error);
  }
}

// SVG icons
const ICON_PLAY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21"/></svg>';
const ICON_PAUSE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
const EQUALIZER_HTML = '<span class="equalizer"><span class="bar"></span><span class="bar"></span><span class="bar"></span></span>';

const ICON_VOLUME = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
const ICON_LOCK = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

// Build a single tab row element
function createTabElement(tabInfo) {
  const tabEl = document.createElement('div');
  tabEl.className = 'tab';

  const currentVolume = tabInfo.volume !== undefined ? tabInfo.volume : 1;
  const volumePercent = Math.round(currentVolume * 100);

  const statusText = tabInfo.isPlaying
    ? `${EQUALIZER_HTML} Playing`
    : 'Paused';

  tabEl.innerHTML = `
    <div class="tab-icon-wrap">
      <img src="${tabInfo.favIconUrl || 'icon.png'}" alt="">
      <span class="status-dot ${tabInfo.isPlaying ? 'playing' : 'paused'}"></span>
    </div>
    <div class="tab-details">
      <div class="tab-row">
        <div class="tab-info">
          <span class="tab-title" title="${tabInfo.title}">${tabInfo.title}</span>
          <span class="tab-status ${tabInfo.isPlaying ? 'is-playing' : ''}">${statusText}</span>
        </div>
        <button class="toggleBtn ${tabInfo.isPlaying ? 'is-playing' : ''}" data-id="${tabInfo.id}">
          ${tabInfo.isPlaying ? ICON_PAUSE : ICON_PLAY}
        </button>
      </div>
      <div class="volume-row ${hasPremium ? '' : 'locked'}">
        <span class="volume-icon">${ICON_VOLUME}</span>
        <input type="range" class="volume-slider" min="0" max="100" value="${volumePercent}" ${hasPremium ? '' : 'disabled'}>
        <span class="volume-value">${volumePercent}%</span>
        ${hasPremium ? '' : `<span class="premium-lock" title="Premium feature">${ICON_LOCK}</span>`}
      </div>
    </div>
  `;

  // Click title to focus tab in browser
  tabEl.querySelector('.tab-info').addEventListener('click', () => {
    focusTab(tabInfo.id);
  });

  tabEl.querySelector('.toggleBtn').addEventListener('click', () => {
    toggleTabPlayback(tabInfo.id);
  });

  // Volume slider (premium only)
  const slider = tabEl.querySelector('.volume-slider');
  const valueLabel = tabEl.querySelector('.volume-value');

  if (hasPremium) {
    slider.addEventListener('input', (e) => {
      valueLabel.textContent = `${e.target.value}%`;
    });
    slider.addEventListener('change', (e) => {
      setTabVolume(tabInfo.id, parseInt(e.target.value) / 100);
    });
  } else {
    // Clicking the locked slider opens the upgrade modal
    tabEl.querySelector('.volume-row').addEventListener('click', () => {
      document.getElementById('licenseModal').classList.remove('hidden');
    });
  }

  return tabEl;
}

// Update the tabs list UI
async function updateTabsList() {
  await loadState();
  const tabsList = document.getElementById('tabsList');
  const tabCount = document.getElementById('tabCount');

  tabCount.textContent = `${mediaTabs.size} tab${mediaTabs.size !== 1 ? 's' : ''}`;

  if (mediaTabs.size === 0) {
    tabsList.innerHTML = `
      <div class="empty-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
        </svg>
        <p>No media tabs detected<br>Play audio or video in a tab, then hit refresh</p>
      </div>`;
    return;
  }

  tabsList.innerHTML = '';

  const sortedTabs = Array.from(mediaTabs.values()).sort((a, b) => {
    return (b.lastAccessed || 0) - (a.lastAccessed || 0);
  });

  // Group tabs by domain
  const groups = new Map();
  for (const tabInfo of sortedTabs) {
    const domain = getDomain(tabInfo.url || '');
    if (!groups.has(domain)) groups.set(domain, []);
    groups.get(domain).push(tabInfo);
  }

  // If only one group, skip the group header
  if (groups.size === 1) {
    for (const tabInfo of sortedTabs) {
      tabsList.appendChild(createTabElement(tabInfo));
    }
    return;
  }

  // Render grouped tabs
  for (const [domain, tabs] of groups) {
    const playingCount = tabs.filter(t => t.isPlaying).length;
    const label = getDomainLabel(domain);

    const groupEl = document.createElement('div');
    groupEl.className = 'tab-group';

    const headerEl = document.createElement('div');
    headerEl.className = 'group-header';
    headerEl.innerHTML = `
      <span class="group-label">
        <svg class="group-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
        ${label}
        <span class="group-count">${tabs.length}</span>
      </span>
      <span class="group-status">${playingCount > 0 ? `${playingCount} playing` : 'paused'}</span>
    `;

    const contentEl = document.createElement('div');
    contentEl.className = 'group-content';

    for (const tabInfo of tabs) {
      contentEl.appendChild(createTabElement(tabInfo));
    }

    // Toggle group collapse
    headerEl.addEventListener('click', () => {
      groupEl.classList.toggle('collapsed');
    });

    groupEl.appendChild(headerEl);
    groupEl.appendChild(contentEl);
    tabsList.appendChild(groupEl);
  }
}

// Listen for storage changes from the background worker
chrome.storage.onChanged.addListener((changes) => {
  if (changes.mediaTabs) {
    updateTabsList();
  }
});

// Update license UI state
async function updateLicenseUI() {
  const license = await License.get();
  hasPremium = await License.hasFeature('volumeControl');

  const badge = document.getElementById('tierBadge');
  const licenseBtn = document.getElementById('licenseBtn');
  const activateForm = document.getElementById('activateForm');
  const deactivateSection = document.getElementById('deactivateSection');
  const statusEl = document.getElementById('licenseStatus');

  if (license.tier !== License.TIERS.FREE) {
    badge.textContent = license.tier.toUpperCase();
    badge.className = `tier-badge ${license.tier}`;
    licenseBtn.textContent = 'License';
    statusEl.textContent = `${license.tier.charAt(0).toUpperCase() + license.tier.slice(1)} license active`;
    statusEl.className = 'license-status active';
    activateForm.classList.add('hidden');
    deactivateSection.classList.remove('hidden');
  } else {
    badge.className = 'tier-badge hidden';
    licenseBtn.textContent = 'Upgrade';
    statusEl.textContent = '';
    statusEl.className = 'license-status';
    activateForm.classList.remove('hidden');
    deactivateSection.classList.add('hidden');
  }
}

// Theme toggle
async function loadTheme() {
  const stored = await chrome.storage.local.get('theme');
  const theme = stored.theme || 'dark';
  if (theme === 'light') document.body.classList.add('light');
}

async function toggleTheme() {
  document.body.classList.toggle('light');
  const theme = document.body.classList.contains('light') ? 'light' : 'dark';
  await chrome.storage.local.set({ theme });
}

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadTheme();
  await updateLicenseUI();
  await updateTabsList();

  // License modal controls
  document.getElementById('licenseBtn').addEventListener('click', () => {
    document.getElementById('licenseModal').classList.remove('hidden');
  });

  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  document.getElementById('modalClose').addEventListener('click', () => {
    document.getElementById('licenseModal').classList.add('hidden');
  });

  document.getElementById('activateBtn').addEventListener('click', async () => {
    const key = document.getElementById('licenseKey').value.trim();
    if (!key) return;

    const result = await License.activate(key);
    const statusEl = document.getElementById('licenseStatus');

    if (result.success) {
      statusEl.textContent = `${result.tier.charAt(0).toUpperCase() + result.tier.slice(1)} license activated!`;
      statusEl.className = 'license-status active';
      await updateLicenseUI();
      await updateTabsList();
    } else {
      statusEl.textContent = result.error;
      statusEl.className = 'license-status error';
    }
  });

  document.getElementById('deactivateBtn').addEventListener('click', async () => {
    await License.deactivate();
    await updateLicenseUI();
    await updateTabsList();
  });

  // Re-render if license changes from another device
  License.onChange(async () => {
    await updateLicenseUI();
    await updateTabsList();
  });
});

// Control buttons
document.getElementById('pauseAll').addEventListener('click', async () => {
  await loadState();
  for (const [tabId, tabInfo] of mediaTabs) {
    if (tabInfo.isPlaying) {
      await toggleTabPlayback(tabId);
    }
  }
});

document.getElementById('playAll').addEventListener('click', async () => {
  await loadState();
  for (const [tabId, tabInfo] of mediaTabs) {
    if (!tabInfo.isPlaying) {
      await toggleTabPlayback(tabId);
    }
  }
});

document.getElementById('refreshBtn').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  btn.classList.add('spinning');
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map(tab => checkTabForMedia(tab.id)));
  await updateTabsList();
  setTimeout(() => btn.classList.remove('spinning'), 600);
});
