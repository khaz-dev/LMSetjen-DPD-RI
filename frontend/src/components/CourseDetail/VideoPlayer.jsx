import React, { forwardRef } from "react";
import { isVideoFile } from "../../utils/videoContentUtils";
import VideoPlayerUnggah from "./VideoPlayerUnggah";
import VideoPlayerYoutube from "./VideoPlayerYoutube";
import VideoPlayerGoogle from "./VideoPlayerGoogle";

// ✨ PHASE 4.142: VideoPlayer Router Component
// Routes video playback to appropriate player based on video type:
// - VideoPlayerUnggah: HTML5 uploaded videos (MP4, WebM, OGV, etc)
// - VideoPlayerYoutube: YouTube URLs
// - VideoPlayerGoogle: Google Drive shared files
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
}, ref) => {
    if (!variantItem?.file) {
        return null;
    }

    // ✨ PHASE 4.142: Determine video type
    const isUploadedVideo = isVideoFile(variantItem.file);
    const isYouTubeUrl = variantItem.file && (
        variantItem.file.includes('youtube.com') || 
        variantItem.file.includes('youtu.be')
    );
    const isGoogleDriveUrl = variantItem.file && variantItem.file.includes('drive.google.com');


    // Route to appropriate player
    if (isUploadedVideo) {
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
            />
        );
    }

    if (isYouTubeUrl) {
        return (
            <VideoPlayerYoutube
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
            />
        );
    }

    if (isGoogleDriveUrl) {
        return (
            <VideoPlayerGoogle
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
            />
        );
    }

    // If no video type detected, return null
    return null;
});

VideoPlayer.displayName = "VideoPlayer";
export default VideoPlayer;
