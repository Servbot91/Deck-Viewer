# Deck Viewer for Stash

## Overview

Deck Viewer is a complete rework and reimagination of the original Image-Deck plugin and hijacks the built in stash image viewer. It is meant be used solely over the built in image viewbox and also adds a gallery viewbox. The plugin design is intended to make browsing galleries and images more streamlined and less error prone to accidental clicks\swipes and to futher optimize one hand browsing.

Deck Viewer was written with AI assistance (qwen3-coder:480b, and my local qwen3-coder30b) following general Dev standards and hygeine while also protecting integrity of the plugin with simple A\B testing and versioning.

---
## Improvements

### Feature Integration
- Performer page integration
	- logic works properly for gallery or images selection
- Added Mouse wheel functionality
- Added zoom functionality for mobile and desktop (buttons respect context ie no zoom on galleries)
- Swipe and pinch gestures on mobile functional
- Added Gallery support and viewbox
- Galleries display performer name and image count and clicking\selecting them will open the respective gallery
- Added keyboard support (strict)
- Supports SFW Plugin
- Default Image Viewer Hijacking
- Infinite Scroll 
	- For as long as you have content. It will scroll as long as content exists, it however does not loop around.
---
### Performance

- Optimized for large datasets (in the millions)
- Added 'Chunk' system
	- Images are locked to 50 on load for performance. Once you are nearing the end of a chunk, the next chunk is loaded. You also have the option to preload multiple chunks ahead by pressing the load next chunk feature.
	- Chunk system has a safety check to prevent backend query spam and will skip if a chunk load is in progress
	- Can manually load the next chunk via button
- Removed particles and effects and buttons such as strobe.
- Further reduced code stack (needs further improvement)
- Backend GraphQL is properly using stash schema rather than guessing
---
### QOL Improvements

- Respects filter context 
	- Note: For the most part, it will not work if you have an exclusion in front of your inclusion meaning the INCLUDE must come before the EXCLUDE or no exclude at all for it to properly function. If an include is after another include, it should work.
- Split up the image-deck.js into a more manageable format
	- button.js
	- config.js
	- context.js
	- controls.js
	- deck.js
	- graphql.js
	- main.js
	- metadata.js
	- styles.css
	- swiper.js
	- ui.js
	- utils.js
- When in a gallery, it will remember where you left off
	- Minor disclaimer here, if the 'rememebered item' is not within the chunk it will default to the first in the list (title sort)
- Focused view over original card view (no more cards behind cards)
- Buttons and text fade out when zoomed in
---
## Bug Fixes

- Corrected all logic in relation to splitting the original image-deck.js into a more manageable package base.
- Fix button appearance context
- Made image context more strict, no studio images in reel or other images not relevant to that specific content
- Cleaned up comments
- General formatting
- Fixed card positioning and centering\sync issues
- Corrected filter logic for ASC and DESC, now displays sort correctly
- Removed card looping
- Removed cards from behind main card
- Removed additional code bloat such as strobe, particles, other nonsense effects
- Major performance enhancements regarding logic and effect usage
- All galleries follow same logic
	- This corrects the incorrect image count display, ghost slides, and looping of the same images for small galleries
- Most if not all backend errors fixed
- Image and gallery counter fixed and showing correct values
- No more ghost slides and images
- Fixed Album 'State' context
- Improved click to launch time for image galleries in the millions  (With 3.3mil images it loads in the milliseconds )
- Nav buttons all function correctly
- Improved all gesture performance response
- removed swipe down to close on fullscreen
- increased threshold for close and accidental swipe gestures
- 'i' or metadata button now displays correctly on both mobile and desktop it is responsive in galleries but currently none functional at the moment.
---

## Known issues

- Zoom buttons appear for galleries if swiping on mobile/desktop past the 10th display
- Filter exclusion issue mentioned in QOL Improvements
- When using keyboard keys on desktop, you will get a console error related to the chunk system. This is a minor bug IMO opinion as the safety logic continues to the core functionality without interruption. At worse you dont preload a chunk until you reach the end it however clicking the nav buttons the chunk system works without issue. This does not cause performance overhead, and is technically a performance improvement though it will be addressed.
- CSS stylesheet needs to be cleaned up
- additional code cleanup needs to be performed
- Metadata use and tagging is very barebones for now, will be modified at a later time
