# Video Modal Best Practices

## Problem Statement
Video modals that don't properly stop/pause videos when closed can cause:
- Audio continuing to play in the background
- Confusion for users
- Memory leaks
- Poor user experience

## Root Cause Analysis

### Issue Found in CourseDetail.jsx
**Location**: `frontend/src/views/base/CourseDetail.jsx`

**Problem**: Course Preview Modal close button (X icon) was missing the `onClick` handler to pause the video.

```jsx
// ❌ BEFORE - Missing onClick handler
<button 
    data-bs-dismiss="modal" 
    aria-label="Close"
>
    <i className="fas fa-times"></i>
</button>

// ✅ AFTER - Properly handles video pause
<button 
    data-bs-dismiss="modal" 
    aria-label="Close"
    onClick={() => {
        const videoElement = videoRef.current;
        if (videoElement) {
            videoElement.pause();
            videoElement.currentTime = 0;
        }
    }}
>
    <i className="fas fa-times"></i>
</button>
```

## Complete Solution - Multi-Layer Defense

### 1. Direct onClick Handler (Primary Defense)
Always add an onClick handler to modal close buttons that immediately pauses videos:

```jsx
<button 
    data-bs-dismiss="modal"
    onClick={() => {
        // Get video element
        const videoElement = videoRef.current; // or document.querySelector('#modalId video')
        
        if (videoElement) {
            videoElement.pause();              // Stop playback
            videoElement.currentTime = 0;       // Reset to beginning
        }
    }}
>
    <i className="fas fa-times"></i>
</button>
```

### 2. Bootstrap Modal Event Listeners (Secondary Defense)
Use Bootstrap's `hidden.bs.modal` event as a backup:

```jsx
useEffect(() => {
    const modalElement = document.getElementById('myVideoModal');
    
    const handleModalHidden = () => {
        const videoElement = videoRef.current;
        if (videoElement) {
            videoElement.pause();
            videoElement.currentTime = 0;
        }
    };
    
    if (modalElement) {
        modalElement.addEventListener('hidden.bs.modal', handleModalHidden);
    }
    
    return () => {
        if (modalElement) {
            modalElement.removeEventListener('hidden.bs.modal', handleModalHidden);
        }
    };
}, []);
```

### 3. Backdrop Click Handler (Tertiary Defense)
Handle clicks outside the modal (on backdrop):

```jsx
const handleBackdropClick = (e) => {
    if (e.target.classList.contains('modal')) {
        const videoElement = document.querySelector(`#${e.target.id} video`);
        if (videoElement) {
            videoElement.pause();
            videoElement.currentTime = 0;
        }
    }
};

// Add listener
modalElement.addEventListener('click', handleBackdropClick);
```

### 4. ESC Key Handler (Quaternary Defense)
Handle ESC key press:

```jsx
const handleEscKey = (e) => {
    if (e.key === 'Escape') {
        const modalElement = document.getElementById('myVideoModal');
        if (modalElement && modalElement.classList.contains('show')) {
            const videoElement = document.querySelector('#myVideoModal video');
            if (videoElement) {
                videoElement.pause();
                videoElement.currentTime = 0;
            }
        }
    }
};

document.addEventListener('keydown', handleEscKey);
```

## Complete Implementation Example

```jsx
function VideoModal({ videoUrl, isOpen, onClose }) {
    const videoRef = useRef(null);
    
    // Multi-layer video control
    useEffect(() => {
        const modalElement = document.getElementById('videoModal');
        
        // Handler for Bootstrap modal close
        const handleModalHidden = () => {
            const videoElement = videoRef.current;
            if (videoElement) {
                videoElement.pause();
                videoElement.currentTime = 0;
            }
        };
        
        // Handler for backdrop clicks
        const handleBackdropClick = (e) => {
            if (e.target.classList.contains('modal')) {
                handleModalHidden();
            }
        };
        
        // Handler for ESC key
        const handleEscKey = (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('videoModal');
                if (modal && modal.classList.contains('show')) {
                    handleModalHidden();
                }
            }
        };
        
        // Register all event listeners
        if (modalElement) {
            modalElement.addEventListener('hidden.bs.modal', handleModalHidden);
            modalElement.addEventListener('click', handleBackdropClick);
        }
        document.addEventListener('keydown', handleEscKey);
        
        // Cleanup all listeners
        return () => {
            if (modalElement) {
                modalElement.removeEventListener('hidden.bs.modal', handleModalHidden);
                modalElement.removeEventListener('click', handleBackdropClick);
            }
            document.removeEventListener('keydown', handleEscKey);
        };
    }, []);
    
    return (
        <div className="modal" id="videoModal">
            <div className="modal-dialog">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5>Video Preview</h5>
                        <button 
                            data-bs-dismiss="modal"
                            onClick={() => {
                                // Primary defense - immediate pause
                                const videoElement = videoRef.current;
                                if (videoElement) {
                                    videoElement.pause();
                                    videoElement.currentTime = 0;
                                }
                            }}
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                    <div className="modal-body">
                        <video 
                            ref={videoRef}
                            src={videoUrl}
                            controls
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
```

## Checklist for Video Modals

### Before Implementing:
- [ ] Plan video element reference strategy (useRef or querySelector)
- [ ] Identify all modal close triggers (X button, backdrop, ESC key)
- [ ] Plan cleanup strategy for event listeners

### During Implementation:
- [ ] Add onClick handler to close button with immediate pause
- [ ] Add Bootstrap `hidden.bs.modal` event listener
- [ ] Add backdrop click handler
- [ ] Add ESC key handler
- [ ] Test all close methods

### After Implementation:
- [ ] Test closing via X button
- [ ] Test closing via backdrop click
- [ ] Test closing via ESC key
- [ ] Test closing via other triggers (if any)
- [ ] Verify video pauses in all cases
- [ ] Verify video resets to start (currentTime = 0)
- [ ] Check for memory leaks (event listeners cleaned up)

## Common Mistakes to Avoid

### ❌ Mistake 1: Relying only on Bootstrap events
```jsx
// BAD - Bootstrap event might not fire immediately
<button data-bs-dismiss="modal">
    <i className="fas fa-times"></i>
</button>
```

### ❌ Mistake 2: Not resetting video position
```jsx
// BAD - Video will resume from where it stopped
videoElement.pause();

// GOOD - Video resets to beginning
videoElement.pause();
videoElement.currentTime = 0;
```

### ❌ Mistake 3: Forgetting cleanup
```jsx
// BAD - Memory leak
useEffect(() => {
    modalElement.addEventListener('hidden.bs.modal', handler);
    // Missing cleanup!
}, []);

// GOOD - Proper cleanup
useEffect(() => {
    modalElement.addEventListener('hidden.bs.modal', handler);
    return () => {
        modalElement.removeEventListener('hidden.bs.modal', handler);
    };
}, []);
```

### ❌ Mistake 4: Not handling all close methods
```jsx
// BAD - Only handles button click
<button onClick={pauseVideo}>Close</button>

// GOOD - Handles button, backdrop, ESC key, and Bootstrap event
// (See complete implementation above)
```

## Testing Procedures

### Manual Testing:
1. Open video modal
2. Start video playback
3. Close via X button → Video should pause and reset
4. Repeat steps 1-2, close via backdrop click → Video should pause and reset
5. Repeat steps 1-2, close via ESC key → Video should pause and reset
6. Verify no audio continues after closing
7. Check console for errors

### Automated Testing (Jest/React Testing Library):
```jsx
describe('VideoModal', () => {
    it('should pause video when close button is clicked', () => {
        render(<VideoModal videoUrl="test.mp4" />);
        
        const video = screen.getByRole('video');
        const closeButton = screen.getByLabelText('Close');
        
        // Play video
        fireEvent.play(video);
        
        // Close modal
        fireEvent.click(closeButton);
        
        expect(video.paused).toBe(true);
        expect(video.currentTime).toBe(0);
    });
    
    it('should pause video when ESC key is pressed', () => {
        render(<VideoModal videoUrl="test.mp4" />);
        
        const video = screen.getByRole('video');
        
        fireEvent.play(video);
        fireEvent.keyDown(document, { key: 'Escape' });
        
        expect(video.paused).toBe(true);
    });
});
```

## Project-Specific Locations

### Files Checked and Fixed:
1. ✅ `frontend/src/views/base/CourseDetail.jsx` - Fixed both modals
   - Course Preview Modal (line ~572)
   - Lesson Preview Modal (line ~667)

### Files Verified (No Video Modals):
1. ✅ `frontend/src/views/student/**/*.jsx` - No video modals found
2. ✅ `frontend/src/views/instructor/components/VideoUpload.jsx` - Not a modal, inline preview
3. ✅ `frontend/src/views/instructor/CourseEditCurriculum.jsx` - Video previews, not modals

## Future Prevention

### Code Review Checklist:
When reviewing PRs with video modals, check:
- [ ] Does the close button have an onClick handler?
- [ ] Does the onClick handler pause AND reset the video?
- [ ] Are Bootstrap modal events handled?
- [ ] Are backdrop clicks handled?
- [ ] Is ESC key handled?
- [ ] Are all event listeners cleaned up in useEffect return?

### Linting Rule (Optional):
Create ESLint rule to detect video elements inside modals without proper pause handlers.

## References
- Bootstrap Modal Events: https://getbootstrap.com/docs/5.3/components/modal/#events
- HTML Video API: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video
- React useEffect Cleanup: https://react.dev/reference/react/useEffect#my-effect-runs-twice-when-the-component-mounts

## Version History
- **v1.0** (2025-10-18): Initial documentation after fixing CourseDetail.jsx video modal issues
- Fixed: Course Preview Modal missing onClick handler
- Enhanced: Multi-layer defense strategy implemented
- Enhanced: ESC key and backdrop click handlers added
