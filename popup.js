// State to track all media tabs and their playback status
let mediaTabs = new Map();

// Load saved state from storage
async function loadState() {
  const result = await chrome.storage.local.get('mediaTabs');
  if (result.mediaTabs) {
    mediaTabs = new Map(JSON.parse(result.mediaTabs));
  }
}

// Save state to storage
async function saveState() {
  await chrome.storage.local.set({
    mediaTabs: JSON.stringify(Array.from(mediaTabs.entries()))
  });
}

// Check a single tab for media and update state
async function checkTabForMedia(tabId) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const media = document.querySelector('video, audio');
        return {
          hasMedia: media !== null,
          isPlaying: media ? !media.paused : false
        };
      }
    });

    if (result?.result?.hasMedia) {
      const tab = await chrome.tabs.get(tabId);
      mediaTabs.set(tabId, {
        id: tabId,
        title: tab.title,
        favIconUrl: tab.favIconUrl,
        isPlaying: result.result.isPlaying
      });
      await saveState();
      return true;
    }
  } catch (error) {
    // Ignore errors from restricted pages
  }
  return false;
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
            const played = media.play().then(() => true).catch(() => {
              // Fallback for custom players
              const playButton = media.closest('video')?.querySelector('.ytp-play-button') || 
                               media.closest('audio')?.parentElement?.querySelector('[aria-label="Play"]');
              if (playButton) {
                playButton.click();
                return true;
              }
              return false;
            });
            if (!played) newState = shouldPause;
          }
        });
        return newState;
      },
      args: [tabInfo.isPlaying]
    });

    if (result?.result !== undefined) {
      mediaTabs.set(tabId, {
        ...tabInfo,
        isPlaying: result.result
      });
      await saveState();
    }
  } catch (error) {
    console.error(`Error toggling tab ${tabId}:`, error);
  }
  updateTabsList();
}

// Update the tabs list UI
async function updateTabsList() {
  await loadState();
  const tabsList = document.getElementById('tabsList');
  
  if (mediaTabs.size === 0) {
    tabsList.innerHTML = '<div style="padding: 10px; text-align: center;">No media tabs found</div>';
    return;
  }

  tabsList.innerHTML = '';
  
  // Sort tabs by most recently used
  const sortedTabs = Array.from(mediaTabs.values()).sort((a, b) => {
    return (b.lastAccessed || 0) - (a.lastAccessed || 0);
  });

  for (const tabInfo of sortedTabs) {
    const tabEl = document.createElement('div');
    tabEl.className = 'tab';
    tabEl.innerHTML = `
      <div class="tab-info">
        <img src="${tabInfo.favIconUrl || 'icons/icon16.png'}" alt="Tab icon">
        <span class="tab-title" title="${tabInfo.title}">${tabInfo.title}</span>
      </div>
      <button data-id="${tabInfo.id}" class="toggleBtn">
        ${tabInfo.isPlaying ? 'Pause' : 'Play'}
      </button>
    `;
    
    tabsList.appendChild(tabEl);
    
    // Add click handler
    tabEl.querySelector('.toggleBtn').addEventListener('click', async () => {
      await toggleTabPlayback(tabInfo.id);
      // Update last accessed time
      mediaTabs.get(tabInfo.id).lastAccessed = Date.now();
      await saveState();
    });
  }
}

// Setup event listeners for tab changes
function setupEventListeners() {
  // Detect when tabs are updated
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (changeInfo.status === 'complete' || changeInfo.audible !== undefined) {
      await checkTabForMedia(tabId);
      updateTabsList();
    }
  });

  // Detect new tabs
  chrome.tabs.onCreated.addListener(async (tab) => {
    await checkTabForMedia(tab.id);
    updateTabsList();
  });

  // Clean up closed tabs
  chrome.tabs.onRemoved.addListener((tabId) => {
    if (mediaTabs.has(tabId)) {
      mediaTabs.delete(tabId);
      saveState();
    }
  });
}

// Initialize extension
document.addEventListener('DOMContentLoaded', async () => {
  // Initial scan of existing tabs
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map(tab => checkTabForMedia(tab.id)));
  
  // Setup event listeners
  setupEventListeners();
  
  // Initial UI update
  updateTabsList();
});

// Control buttons
document.getElementById('pauseAll').addEventListener('click', async () => {
  for (const [tabId, tabInfo] of mediaTabs) {
    if (tabInfo.isPlaying) {
      await toggleTabPlayback(tabId);
    }
  }
});

document.getElementById('playAll').addEventListener('click', async () => {
  for (const [tabId, tabInfo] of mediaTabs) {
    if (!tabInfo.isPlaying) {
      await toggleTabPlayback(tabId);
    }
  }
});

document.getElementById('refreshBtn').addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map(tab => checkTabForMedia(tab.id)));
  updateTabsList();
});