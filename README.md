# Tab Playback Controller

A Chrome browser extension that helps you control audio and video playback across multiple tabs with ease.

## Features (Free)

- **Smart Media Detection**: Automatically detects tabs with active audio or video (filters out inactive/hidden media elements)
- **Individual Tab Control**: Play/pause media in specific tabs with one click
- **Global Controls**: Pause or play all media tabs at once
- **Keyboard Shortcuts**: Control media without opening the popup
- **Background Service Worker**: Efficient event-driven detection that runs only when needed — no polling, minimal resource usage
- **Real-time Updates**: Automatically updates when tabs are added, removed, or their playback status changes
- **Persistent State**: Maintains tab states between browser sessions
- **Focus on Tab**: Click any tab title in the popup to instantly switch to that tab in your browser
- **Domain Grouping**: When tabs come from multiple sites, they are grouped by domain (e.g. YouTube, Spotify) with collapsible headers
- **Dark UI**: Modern dark-themed popup with status indicators and equalizer animations

## Premium Features

- **Volume Mixing**: Individual volume sliders for each media tab — control volume per-tab without touching the site
- **Sound Profiles**: Save and load volume presets (coming soon)
- **Sleep Timer**: Auto-pause all media after a set duration (coming soon)
- **Playback Speed Control**: Per-tab speed adjustment (coming soon)
- **Picture-in-Picture**: Pop any video into a floating mini-player (coming soon)

## Pro Features

- **Focus Scheduler**: Auto-silence distracting tabs during work hours (coming soon)
- **Audio History**: Listening activity stats and logs (coming soon)
- **Cross-Device Sync**: Sync profiles and settings across machines (coming soon)
- **Audio Ducking**: Auto-lower music when a meeting tab starts playing (coming soon)
- **API / Webhooks**: Trigger controls from external tools like Stream Deck (coming soon)

## Keyboard Shortcuts

| Shortcut       | Action                           |
| -------------- | -------------------------------- |
| `Alt+Shift+M`  | Toggle play/pause on current tab |
| `Alt+Shift+P`  | Pause all media tabs             |
| `Alt+Shift+O`  | Play all media tabs              |

Shortcuts can be customized at `chrome://extensions/shortcuts`.

## Installation

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the `extension/` directory

## Usage

1. Click the extension icon in your browser toolbar to open the popup
2. View all detected media tabs with their current playback status
3. Use individual play/pause buttons to control specific tabs
4. Use "Pause All" or "Play All" buttons to control all media tabs at once
5. Adjust per-tab volume with sliders (Premium)
6. Click the refresh button to manually scan for new media tabs
7. Use keyboard shortcuts for quick control without opening the popup

## Licensing

TPC uses a tiered licensing model:

- **Free**: Core playback controls, shortcuts, grouping, and detection
- **Premium**: Volume mixing, sound profiles, sleep timer, playback speed, PiP
- **Pro**: Everything in Premium plus focus scheduler, audio ducking, API access, and more

Activate a license key via the Upgrade button in the popup footer.

## Technical Details

### Files Structure

```text
extension/
  manifest.json    Extension configuration (Manifest V3)
  background.js    Service worker for event-driven tab monitoring
  license.js       License management and feature gating
  popup.html       Popup interface
  popup.js         Popup logic, playback controls, and volume mixing
  popup.css        Dark-themed popup styling
  icon.png         Extension icons
  icon48.png
  icon128.png
```

### Architecture

- **Background service worker** listens for `tabs.onUpdated` (audible changes, page loads) and `tabs.onRemoved` events only — zero CPU when idle
- **Popup** reads shared state from `chrome.storage.local` and listens for changes
- **Media detection** validates that elements have a loaded source and valid duration before flagging a tab
- **License state** stored in `chrome.storage.sync` so it persists across devices
- **Feature gating** via `License.hasFeature()` checks — premium UI shown but locked for free users

### Permissions Required

- `tabs`: For accessing and managing browser tabs
- `scripting`: For executing scripts in tabs to control media playback
- `storage`: For maintaining state between sessions
- `host_permissions`: Access to all URLs for media detection

## Development

### Building and Testing

1. Make changes to the source files
2. Load the extension in Chrome using "Load unpacked" (select the `extension/` folder)
3. Click the refresh button in `chrome://extensions/` to reload after changes

### Test License Keys

For development, use these prefixes:

- `TPC-PREM-*` activates Premium tier
- `TPC-PRO-*` activates Pro tier

Replace with server-side validation before production release.

## Browser Compatibility [Chromium-based]

- Google Chrome
- Vivaldi Browser (tested)
- Microsoft Edge
- Brave Browser
- Other Chromium-based browsers (should work)

## Roadmap

- Smart detection for complex web players (Spotify, Twitch, etc.)
- Sound profiles / presets
- Sleep timer
- Playback speed control
- Picture-in-Picture mode
- Focus scheduling / auto-silence profiles
- Audio ducking for meetings
- Mobile remote control
- Team collaboration features
- API / webhook integrations

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is open source and available under the [MIT License](LICENSE).
