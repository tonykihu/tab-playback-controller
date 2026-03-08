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
        // Find media elements that actually have meaningful content loaded
        const allMedia = document.querySelectorAll('video, audio');
        for (const media of allMedia) {
          const hasSrc = media.currentSrc || media.src || media.querySelector('source');
          // Require duration > 5s to filter out notification sounds and tiny audio clips
          const hasDuration = media.duration > 5;
          if (hasSrc && hasDuration) {
            return { hasMedia: true, isPlaying: !media.paused };
          }
        }
        return { hasMedia: false, isPlaying: false };
      }
    });

    const stored = await chrome.storage.local.get('mediaTabs');
    const mediaTabs = stored.mediaTabs ? new Map(JSON.parse(stored.mediaTabs)) : new Map();

    if (result?.result?.hasMedia) {
      mediaTabs.set(tabId, {
        id: tabId,
        title: tab.title,
        url: tab.url,
        favIconUrl: tab.favIconUrl,
        isPlaying: result.result.isPlaying
      });
    } else {
      // Remove tab if it no longer has qualifying media
      mediaTabs.delete(tabId);
    }

    await chrome.storage.local.set({
      mediaTabs: JSON.stringify(Array.from(mediaTabs.entries()))
    });
  } catch (error) {
    // Tab closed or restricted — remove it from storage
    try {
      const stored = await chrome.storage.local.get('mediaTabs');
      if (stored.mediaTabs) {
        const mediaTabs = new Map(JSON.parse(stored.mediaTabs));
        if (mediaTabs.delete(tabId)) {
          await chrome.storage.local.set({
            mediaTabs: JSON.stringify(Array.from(mediaTabs.entries()))
          });
        }
      }
    } catch (_) {}
  }
}

// Only react to meaningful tab changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // Only check when audio state changes or page finishes loading
  if (changeInfo.audible !== undefined || changeInfo.status === 'complete') {
    checkTabForMedia(tabId);
  }
});

// Toggle playback on a specific tab
async function toggleTabPlayback(tabId, shouldPause) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (pause) => {
        const allMedia = document.querySelectorAll('video, audio');
        allMedia.forEach(media => {
          if (media.duration > 0 && (media.currentSrc || media.src)) {
            pause ? media.pause() : media.play().catch(() => {});
          }
        });
      },
      args: [shouldPause]
    });
  } catch (error) {
    // Ignore restricted tabs
  }
}

// Handle keyboard shortcut commands
chrome.commands.onCommand.addListener(async (command) => {
  const stored = await chrome.storage.local.get('mediaTabs');
  const mediaTabs = stored.mediaTabs ? new Map(JSON.parse(stored.mediaTabs)) : new Map();

  if (command === 'pause-all') {
    for (const [tabId, tabInfo] of mediaTabs) {
      if (tabInfo.isPlaying) {
        await toggleTabPlayback(tabId, true);
        mediaTabs.set(tabId, { ...tabInfo, isPlaying: false });
      }
    }
    await chrome.storage.local.set({
      mediaTabs: JSON.stringify(Array.from(mediaTabs.entries()))
    });
  }

  if (command === 'play-all') {
    for (const [tabId, tabInfo] of mediaTabs) {
      if (!tabInfo.isPlaying) {
        await toggleTabPlayback(tabId, false);
        mediaTabs.set(tabId, { ...tabInfo, isPlaying: true });
      }
    }
    await chrome.storage.local.set({
      mediaTabs: JSON.stringify(Array.from(mediaTabs.entries()))
    });
  }

  if (command === 'toggle-current') {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && mediaTabs.has(activeTab.id)) {
      const tabInfo = mediaTabs.get(activeTab.id);
      await toggleTabPlayback(activeTab.id, tabInfo.isPlaying);
      mediaTabs.set(activeTab.id, { ...tabInfo, isPlaying: !tabInfo.isPlaying });
      await chrome.storage.local.set({
        mediaTabs: JSON.stringify(Array.from(mediaTabs.entries()))
      });
    }
  }
});

// Validate all stored tabs — remove stale entries for tabs that no longer exist or lack media
async function pruneStaleEntries() {
  const stored = await chrome.storage.local.get('mediaTabs');
  if (!stored.mediaTabs) return;

  const mediaTabs = new Map(JSON.parse(stored.mediaTabs));
  let changed = false;

  for (const [tabId] of mediaTabs) {
    try {
      await chrome.tabs.get(tabId);
    } catch {
      // Tab no longer exists
      mediaTabs.delete(tabId);
      changed = true;
    }
  }

  if (changed) {
    await chrome.storage.local.set({
      mediaTabs: JSON.stringify(Array.from(mediaTabs.entries()))
    });
  }
}

// Prune stale entries when the service worker wakes up
pruneStaleEntries();

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
