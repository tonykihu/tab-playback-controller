// Popup reads shared state from storage, handles UI and playback toggles

let mediaTabs = new Map();

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
        const media = document.querySelector('video, audio');
        return {
          hasMedia: media !== null,
          isPlaying: media ? !media.paused : false
        };
      }
    });

    if (result?.result?.hasMedia) {
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
    // Ignore restricted pages
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

// Update the tabs list UI
async function updateTabsList() {
  await loadState();
  const tabsList = document.getElementById('tabsList');

  if (mediaTabs.size === 0) {
    tabsList.innerHTML = '<div style="padding: 10px; text-align: center;">No media tabs found</div>';
    return;
  }

  tabsList.innerHTML = '';

  const sortedTabs = Array.from(mediaTabs.values()).sort((a, b) => {
    return (b.lastAccessed || 0) - (a.lastAccessed || 0);
  });

  for (const tabInfo of sortedTabs) {
    const tabEl = document.createElement('div');
    tabEl.className = 'tab';
    tabEl.innerHTML = `
      <div class="tab-info">
        <img src="${tabInfo.favIconUrl || 'icon.png'}" alt="Tab icon">
        <span class="tab-title" title="${tabInfo.title}">${tabInfo.title}</span>
      </div>
      <button data-id="${tabInfo.id}" class="toggleBtn">
        ${tabInfo.isPlaying ? 'Pause' : 'Play'}
      </button>
    `;

    tabsList.appendChild(tabEl);

    tabEl.querySelector('.toggleBtn').addEventListener('click', () => {
      toggleTabPlayback(tabInfo.id);
    });
  }
}

// Listen for storage changes from the background worker
chrome.storage.onChanged.addListener((changes) => {
  if (changes.mediaTabs) {
    updateTabsList();
  }
});

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  updateTabsList();
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

document.getElementById('refreshBtn').addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map(tab => checkTabForMedia(tab.id)));
  updateTabsList();
});
