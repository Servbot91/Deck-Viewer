# Deck Viewer for Stash

## Overview

Deck Viewer is a complete rework and reimagination of the original Image-Deck plugin that hijacks the built in stash image viewer. I have commandeered image-decks base code and have brought it up to a stable and functional standard with enhanced features, a ton of QOL improvements, bug fixes, and optimization. It is meant be used solely over the built in image viewbox and also adds a gallery viewbox. The plugin design is intended to make browsing galleries and images more streamlined and less error prone to accidental clicks\swipes and to futher optimize one hand browsing. There may be some references to image-deck in my code only because I couldn't be bothered. I prioritize functionality and quality over minor trivial cosmetics. 

Deck Viewer was written with AI assistance (qwen3-coder:480b, and my local qwen3-coder30b) following general Dev standards and hygeine while also protecting integrity of the plugin with simple A\B testing and versioning. You can view the git commits and merge history to verify this information. Everything was tested then started again with new context from scratch if there was any hallucination or AI rabbit holes. This approach has maintained plugin functionality while minimizing bloat however I will concede there is still plenty of optimization to be had which will be addressed at a later date.
--- 
## Features

### 🎬 Immersive Viewing Experience
- **Smooth Animations**: Hardware-accelerated transitions for buttery-smooth performance
- **Zoom Capabilities**: Double-tap or use controls to zoom into images

### 🎮 Intuitive Controls
- **Keyboard Navigation**: Arrow keys, spacebar, and dedicated shortcuts
- **Touch Gestures**: Swipe to navigate, double-tap to zoom, swipe-down to close
- **Mouse Support**: Wheel navigation and click controls
- **Fullscreen Mode**: Immersive full-screen viewing experience

### 📱 Responsive Design
- **Mobile Optimized**: Touch-friendly interface with adaptive layouts
- **Cross-Device Compatibility**: Works seamlessly on desktop, tablet, and mobile
- **Performance Optimized**: Virtual slides and lazy loading for smooth performance

### 📊 Smart Organization
- **Context-Aware Loading**: Automatically detects current page context
- **Chunked Loading**: Efficiently loads large collections in manageable chunks
- **Progress Tracking**: Visual indicators showing your position in the deck
- **Auto-Play**: Automatic slideshow mode with customizable timing

### 📝 Metadata Management
- **Detailed Information**: View comprehensive image metadata at a glance
- **Real-Time Editing**: Modify ratings, titles, and details without leaving the viewer
- **Tag Management**: Add, remove, and search tags directly from the interface
- **Organization Tools**: Mark items as organized with one click

## Use Cases

### Content Review & Curation
Perfect for reviewing large collections of images and galleries. Quickly identify favorites, organize content, and manage metadata efficiently.

### Mobile Browsing
Optimized touch controls and responsive design make it perfect for browsing your collection on tablets and smartphones.

### Quick Navigation
Effortlessly move through your entire library with keyboard shortcuts and gesture controls, much faster than traditional grid browsing.

## Installation

1. Download the latest release
2. Place the plugin files in your Stash plugins directory
3. Restart Stash
4. Configure settings through the Plugins section in Stash settings

## Getting Started

### Launching Deck Viewer
1. Navigate to any Images or Galleries page in Stash
2. Look for the "Deck Viewer" button in the navigation menu
3. Click the button to launch the viewer

### Basic Navigation
- **Next/Previous**: Right/Left arrow keys or on-screen buttons
- **Zoom**: `+/-` keys or zoom buttons, double-tap on mobile
- **Auto-Play**: Spacebar or play button
- **Metadata**: `I` key or info button
- **Close**: Escape key or close button
- **Fullscreen**: Dedicated fullscreen button

### Advanced Features

#### Context Detection
Deck Viewer automatically adapts to your current location:
- Individual image pages
- Gallery viewing
- Performer-specific content
- Tag or studio filtered views
- General image listings

#### Progressive Loading
For large collections, Deck Viewer loads content in chunks:
- Automatically loads next chunk when approaching the end
- Manual "Next Chunk" button for precise control
- Progress indicators show loading status

## Configuration Options

Access configuration through Stash Plugin settings:

### Display Settings
- **Auto-Play Interval**: Customize slideshow timing (500ms - 5000ms)

### Performance Settings
- **Preload Images**: Number of images to preload
- **Chunk Size**: Items per loading chunk
- **Lazy Load Threshold**: How far ahead to preload content

### UI Preferences
- **Counter Display**: Show/hide item counters

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Arrow Right | Next image |
| Arrow Left | Previous image |
| Space | Toggle auto-play |
| +/- | Zoom in/out |
| 0 | Reset zoom |
| I | Toggle metadata panel |
| Escape | Close viewer/fullscreen |

## Touch Gestures

| Gesture | Action |
|---------|--------|
| Swipe Left/Right | Navigate between images |
| Double Tap | Toggle zoom |
| Swipe Down | Close viewer (when not in fullscreen) |
| Pinch | Manual zoom (browser dependent) |

## License

This plugin is distributed under the MIT License. See LICENSE file for details.

