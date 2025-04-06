# Tab Playback Controller

A Chrome browser extension that helps you control audio and video playback across multiple tabs with ease.

## Features

- **Media Tab Detection**: Automatically detects tabs containing audio or video elements
- **Individual Tab Control**: Play/pause media in specific tabs
- **Global Controls**: Pause or play all media tabs at once
- **Real-time Updates**: Automatically updates when tabs are added, removed, or their playback status changes
- **Persistent State**: Maintains tab states between browser sessions
- **Refresh Capability**: Manual refresh option to detect new media tabs

## Installation

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the `tab-playback-controller` directory

## Usage

1. Click the extension icon in your browser toolbar to open the popup
2. View all detected media tabs with their current playback status
3. Use individual play/pause buttons to control specific tabs
4. Use "Pause All" or "Play All" buttons to control all media tabs at once
5. Click the refresh button (↻) to manually scan for new media tabs

## Technical Details

### Files Structure

- `manifest.json`: Extension configuration and permissions
- `popup.html`: Main extension popup interface
- `popup.js`: Core functionality and tab management logic
- `popup.css`: Styling for the popup interface

### Permissions Required

- `tabs`: For accessing and managing browser tabs
- `scripting`: For executing scripts in tabs to control media playback
- `storage`: For maintaining state between sessions
- `host_permissions`: Access to all URLs for media detection

### Features Implementation

- Uses Chrome Extensions Manifest V3
- Implements tab state management using Chrome Storage API
- Handles various media players including custom implementations
- Maintains tab order based on most recent usage
- Provides fallback mechanisms for restricted pages

## Development

### Building and Testing

1. Make changes to the source files
2. Load the extension in Chrome using "Load unpacked"
3. Click the refresh button in `chrome://extensions/` to update the extension

### Key Components

- **State Management**: Uses `Map` to track media tabs and their states
- **Tab Detection**: Scans for `<video>` and `<audio>` elements
- **Event Listeners**: Monitors tab updates, creation, and removal
- **UI Updates**: Real-time interface updates reflecting tab states

## Browser Compatibility [Chromium-based]

- Vivaldi Browser (tested)
- Other Chromium-based browsers (should work but not tested)

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is open source and available under the [MIT License](LICENSE).
