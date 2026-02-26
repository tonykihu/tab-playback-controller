// Background service worker — event-driven only, no polling
// Wakes on tab events, updates storage, then goes back to sleep

// Check a single tab for media elements
async function checkTabForMedia(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);

    // Skip restricted pages (chrome://, edge://, about:, etc.)
    if (!tab.url || tab.url.startsWith('chrome') || tab.url.startsWith('about') || tab.url.startsWith('edge')) {
      return;
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
      const stored = await chrome.storage.local.get('mediaTabs');
      const mediaTabs = stored.mediaTabs ? new Map(JSON.parse(stored.mediaTabs)) : new Map();

      mediaTabs.set(tabId, {
        id: tabId,
        title: tab.title,
        favIconUrl: tab.favIconUrl,
        isPlaying: result.result.isPlaying
      });

      await chrome.storage.local.set({
        mediaTabs: JSON.stringify(Array.from(mediaTabs.entries()))
      });
    }
  } catch (error) {
    // Silently ignore restricted pages or tabs that closed mid-check
  }
}

// Only react to meaningful tab changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // Only check when audio state changes or page finishes loading
  if (changeInfo.audible !== undefined || changeInfo.status === 'complete') {
    checkTabForMedia(tabId);
  }
});

// Clean up when a tab is closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const stored = await chrome.storage.local.get('mediaTabs');
  if (!stored.mediaTabs) return;

  const mediaTabs = new Map(JSON.parse(stored.mediaTabs));
  if (mediaTabs.has(tabId)) {
    mediaTabs.delete(tabId);
    await chrome.storage.local.set({
      mediaTabs: JSON.stringify(Array.from(mediaTabs.entries()))
    });
  }
});
