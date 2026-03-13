import React, { forwardRef } from "react";
import { isVideoFile } from "../../utils/videoContentUtils";
import VideoPlayerUnggah from "./VideoPlayerUnggah";

// ✨ PHASE X.X: VideoPlayer Router Component
// Routes video playback to appropriate player based on video type:
// - VideoPlayerUnggah: HTML5 uploaded videos (MP4, WebM, OGV, etc)
// 
// REMOVED: YouTube video support (upload-only system)
// Previously routed to VideoPlayerYoutubeClean for YouTube URLs
//
// This component determines the video type and renders the correct player
// without mixing logic between different player implementations.

const VideoPlayer = forwardRef(({
    variantItem,
    variantContext,  // ✨ PHASE 6.3: Pass bagian/section context
    onClose,
    handleMarkLessonAsCompleted,
    courseId,  // ✨ PHASE 4.144+: courseId prop
    autoplay = false,
    onPlayingChange,
    onProgress,
    seekPosition,
    course,  // ✨ PHASE 12.9: Pass course data to check actual completed_lesson array (source of truth)
}, ref) => {
    if (!variantItem?.file) {
        return null;
    }

    // ✨ PHASE X.X: Determine video type (upload only)
    const isUploadedVideo = isVideoFile(variantItem.file);

    // ✨ PHASE X.X: Only uploaded videos supported now
    if (!isUploadedVideo) {
        console.warn('[VideoPlayer Router] ⚠️ Non-video file type detected, skipping playback:', variantItem.file);
        return null;
    }

    // Route to uploaded video player
    return (
        <VideoPlayerUnggah
            ref={ref}
            variantItem={variantItem}
            variantContext={variantContext}  // ✨ PHASE 6.3: Pass context
            onClose={onClose}
            handleMarkLessonAsCompleted={handleMarkLessonAsCompleted}
            courseId={courseId}  // ✨ PHASE 4.144+: Pass courseId
            autoplay={autoplay}
            onPlayingChange={onPlayingChange}
            onProgress={onProgress}
            seekPosition={seekPosition}
            course={course}  // ✨ PHASE 12.9: Pass course for checking actual completed_lesson array
        />
    );
});

VideoPlayer.displayName = "VideoPlayer";

// ✨ PHASE 17.12 FIX: Custom React.memo comparator that ignores `course` prop changes
// The `course` object changes frequently (completed_lesson array updates) but we don't
// need to remount the player just because that changed. Compare all other props.
const VideoPlayerMemo = React.memo(VideoPlayer, (prevProps, nextProps) => {
    // Return TRUE if props are "equal" (skip re-render), FALSE if different (do re-render)
    // ✨ PHASE 42.6 CRITICAL FIX: Use ID-based comparison instead of object reference equality
    // When user clicks lesson, a NEW lesson object is passed (different reference)
    // Using === causes memo to think props changed when only the reference changed
    // Solution: Compare variant_item_id instead of the object reference
    // This allows the memoization to work correctly across lesson switches
    return (
        prevProps.variantItem?.variant_item_id === nextProps.variantItem?.variant_item_id &&
        prevProps.variantContext === nextProps.variantContext &&
        prevProps.onClose === nextProps.onClose &&
        prevProps.handleMarkLessonAsCompleted === nextProps.handleMarkLessonAsCompleted &&
        prevProps.courseId === nextProps.courseId &&
        prevProps.autoplay === nextProps.autoplay &&
        prevProps.onPlayingChange === nextProps.onPlayingChange &&
        prevProps.onProgress === nextProps.onProgress &&
        prevProps.seekPosition === nextProps.seekPosition
        // INTENTIONALLY skip `course` comparison - it changes too frequently
    );
});

VideoPlayerMemo.displayName = "VideoPlayerMemo";
export default VideoPlayerMemo;
