// React imports
import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";

// Third-party imports - Lazy load CKEditor (1.24 MB)
const CKEditor = lazy(() => import("@ckeditor/ckeditor5-react").then(m => ({ default: m.CKEditor })));
const ClassicEditor = lazy(() => import("@ckeditor/ckeditor5-build-classic"));

import Cookie from "js-cookie";
import Swal from "sweetalert2";

// Modern drag-and-drop library (replaces react-beautiful-dnd)
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Local component imports
import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import WorkflowStepper from "../../components/WorkflowStepper";

// Utility imports
import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";

// Styles
import "./CourseEditCurriculum.css";
import "./CourseEdit.css";

/**
 * Constants for form validation and configuration
 */
const VALIDATION_RULES = {
    VARIANT_TITLE_MIN_LENGTH: 3,
    VARIANT_TITLE_MAX_LENGTH: 100,
    ITEM_TITLE_MIN_LENGTH: 3,
    ITEM_TITLE_MAX_LENGTH: 200,
    ITEM_DESCRIPTION_MIN_LENGTH: 10,
    ITEM_DESCRIPTION_MAX_LENGTH: 1000,
};

const FILE_UPLOAD_CONFIG = {
    IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
    VIDEO_TYPES: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv'],
    MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
    MAX_VIDEO_SIZE: 100 * 1024 * 1024, // 100MB
    TARGET_COMPRESSED_SIZE: 95 * 1024 * 1024, // Target 95MB after compression (safety margin)
    COMPRESSION_QUALITY_HIGH: 0.8,
    COMPRESSION_QUALITY_MEDIUM: 0.6,
    COMPRESSION_QUALITY_LOW: 0.4,
};

/**
 * Fix WebM duration metadata for seekability
 * WebM files created by MediaRecorder lack duration info, making them unseekable
 * This function adds/updates the duration metadata using EBML format manipulation
 * 
 * @param {Blob} blob - The WebM blob to fix
 * @param {number} duration - Duration in milliseconds
 * @param {string} mimeType - MIME type of the video
 * @returns {Promise<Blob>} - Fixed blob with duration metadata
 */
const fixWebmDuration = async (blob, duration, mimeType) => {
    try {
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        
        // IMPROVED: Better EBML parsing for WebM duration fix
        // WebM structure: EBML Header → Segment → Info (contains Duration) → Tracks → Clusters
        
        // Helper function to find byte pattern
        const findPattern = (arr, pattern, start = 0, end = arr.length) => {
            for (let i = start; i < end - pattern.length; i++) {
                let found = true;
                for (let j = 0; j < pattern.length; j++) {
                    if (arr[i + j] !== pattern[j]) {
                        found = false;
                        break;
                    }
                }
                if (found) return i;
            }
            return -1;
        };
        
        // Find Segment element (ID: 0x18538067)
        const segmentOffset = findPattern(bytes, [0x18, 0x53, 0x80, 0x67]);
        if (segmentOffset === -1) {
            return blob;
        }
        
        // Find Info element (ID: 0x1549A966) - contains Duration
        const infoOffset = findPattern(bytes, [0x15, 0x49, 0xA9, 0x66], segmentOffset, segmentOffset + 15000);
        if (infoOffset === -1) {
            return blob;
        }
        
        // Find Duration element (ID: 0x4489)
        let durationOffset = findPattern(bytes, [0x44, 0x89], infoOffset, infoOffset + 2000);
        
        if (durationOffset !== -1) {
            // Duration element exists - update it
            const newBytes = new Uint8Array(bytes);
            
            // Duration format: 0x4489 (ID) + 0x88 (size=8 bytes) + 8-byte float
            let valueOffset = durationOffset + 2; // Skip ID bytes
            
            // Check for size descriptor (usually 0x88 = 8 bytes follow)
            if (newBytes[valueOffset] === 0x88 || newBytes[valueOffset] === 0x87) {
                valueOffset += 1; // Skip size byte
            }
            
            // Write duration as IEEE 754 double (big-endian)
            const view = new DataView(newBytes.buffer, valueOffset, 8);
            view.setFloat64(0, duration, false); // false = big-endian
            
            return new Blob([newBytes], { type: mimeType });
            
        } else {
            // Duration element doesn't exist - need to insert it
            // This is complex as it requires EBML size recalculation
            
            // Find where to insert (after Info header, before first child element)
            // Info element structure: ID + Size + children
            let insertOffset = infoOffset + 4; // After Info ID
            
            // Skip Info size bytes (variable length)
            // Size encoding in EBML: first byte indicates length
            const sizeLength = getSizeLength(bytes[insertOffset]);
            insertOffset += sizeLength;
            
            // Create duration element: 0x4489 (ID) + 0x88 (size) + 8-byte float
            const durationElement = new Uint8Array(11);
            durationElement[0] = 0x44; // Duration ID byte 1
            durationElement[1] = 0x89; // Duration ID byte 2
            durationElement[2] = 0x88; // Size = 8 bytes follow
            
            // Write duration value
            const durationView = new DataView(durationElement.buffer, 3, 8);
            durationView.setFloat64(0, duration, false);
            
            // Insert duration element
            const newBytes = new Uint8Array(bytes.length + 11);
            newBytes.set(bytes.subarray(0, insertOffset));
            newBytes.set(durationElement, insertOffset);
            newBytes.set(bytes.subarray(insertOffset), insertOffset + 11);
            
            // NOTE: This breaks Info element size - would need recalculation
            // For production, should use proper EBML library
            return new Blob([newBytes], { type: mimeType });
        }
        
    } catch (error) {
        console.error('[fixWebmDuration] Error fixing duration:', error);
        return blob;
    }
};

// Helper function to determine EBML size descriptor length
const getSizeLength = (byte) => {
    // EBML variable-size encoding
    // 1xxx xxxx = 1 byte (0-127)
    // 01xx xxxx = 2 bytes
    // 001x xxxx = 3 bytes
    // etc.
    if ((byte & 0x80) !== 0) return 1;
    if ((byte & 0x40) !== 0) return 2;
    if ((byte & 0x20) !== 0) return 3;
    if ((byte & 0x10) !== 0) return 4;
    return 5;
};

/**
 * Video Compression Utility Functions
 */
const VideoCompressionUtils = {
    /**
     * Check if file needs compression
     */
    needsCompression: (file, maxSize = FILE_UPLOAD_CONFIG.MAX_VIDEO_SIZE) => {
        return file.size > maxSize;
    },

    /**
     * Get video duration
     */
    getVideoDuration: (file) => {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            
            video.onloadedmetadata = () => {
                window.URL.revokeObjectURL(video.src);
                resolve(video.duration);
            };
            
            video.onerror = () => {
                reject(new Error('Failed to load video metadata'));
            };
            
            video.src = URL.createObjectURL(file);
        });
    },

    /**
     * Compress video using canvas and MediaRecorder API with audio preservation
     * ✅ NEW ROBUST APPROACH: Uses captureStream() directly from video element for guaranteed audio
     */
    compressVideo: async (file, targetSize = FILE_UPLOAD_CONFIG.TARGET_COMPRESSED_SIZE, onProgress) => {
        return new Promise(async (resolve, reject) => {
            try {
                // Create video element for metadata
                const videoMeta = document.createElement('video');
                videoMeta.preload = 'metadata';
                videoMeta.muted = true; // Just for metadata, won't affect audio capture
                
                const videoURL = URL.createObjectURL(file);
                videoMeta.src = videoURL;

                await new Promise((res, rej) => {
                    videoMeta.onloadedmetadata = res;
                    videoMeta.onerror = () => rej(new Error('Failed to load video'));
                });

                const duration = videoMeta.duration;
                const originalWidth = videoMeta.videoWidth;
                const originalHeight = videoMeta.videoHeight;

                // Calculate compression settings based on file size ratio
                const sizeRatio = file.size / targetSize;
                let targetWidth, targetHeight, quality, bitrate, audioBitrate;

                if (sizeRatio > 3) {
                    // Heavy compression needed
                    targetWidth = Math.floor(originalWidth * 0.5);
                    targetHeight = Math.floor(originalHeight * 0.5);
                    quality = FILE_UPLOAD_CONFIG.COMPRESSION_QUALITY_LOW;
                    bitrate = 500000; // 500 Kbps video
                    audioBitrate = 64000; // 64 Kbps audio
                } else if (sizeRatio > 1.5) {
                    // Medium compression
                    targetWidth = Math.floor(originalWidth * 0.7);
                    targetHeight = Math.floor(originalHeight * 0.7);
                    quality = FILE_UPLOAD_CONFIG.COMPRESSION_QUALITY_MEDIUM;
                    bitrate = 1000000; // 1 Mbps video
                    audioBitrate = 96000; // 96 Kbps audio
                } else {
                    // Light compression
                    targetWidth = Math.floor(originalWidth * 0.85);
                    targetHeight = Math.floor(originalHeight * 0.85);
                    quality = FILE_UPLOAD_CONFIG.COMPRESSION_QUALITY_HIGH;
                    bitrate = 1500000; // 1.5 Mbps video
                    audioBitrate = 128000; // 128 Kbps audio
                }

                // Ensure dimensions are even (required for some codecs)
                targetWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth - 1;
                targetHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight - 1;

                // Create canvas for video frames
                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d');

                // Capture canvas stream (compressed video only)
                const canvasStream = canvas.captureStream(30); // 30 fps
                
                // Create separate video element with captureStream()
                const sourceVideo = document.createElement('video');
                sourceVideo.muted = true; // Must be muted to prevent audio playback
                sourceVideo.src = videoURL;
                
                await new Promise((res, rej) => {
                    sourceVideo.onloadedmetadata = res;
                    sourceVideo.onerror = () => rej(new Error('Failed to load source video'));
                });
                
                // ✅ CRITICAL: Use captureStream() to get BOTH video and audio tracks directly
                // This is more reliable than Web Audio API and guarantees audio preservation
                let originalStream;
                try {
                    // Try HTMLMediaElement.captureStream() first (most reliable)
                    if (typeof sourceVideo.captureStream === 'function') {
                        originalStream = sourceVideo.captureStream();
                    } else if (typeof sourceVideo.mozCaptureStream === 'function') {
                        // Firefox support
                        originalStream = sourceVideo.mozCaptureStream();
                    } else {
                        throw new Error('captureStream not supported');
                    }
                } catch (captureError) {
                    console.warn('[VideoCompression] captureStream failed, falling back to Web Audio API:', captureError);
                    
                    // Fallback: Use Web Audio API if captureStream not available
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const source = audioContext.createMediaElementSource(sourceVideo);
                    const destination = audioContext.createMediaStreamDestination();
                    source.connect(destination);
                    originalStream = destination.stream;
                }

                // Extract audio tracks from the original stream
                const audioTracks = originalStream.getAudioTracks();
                
                // Ensure audio tracks are enabled
                audioTracks.forEach(track => {
                    track.enabled = true;
                });

                // Combine compressed video stream with original audio tracks
                const combinedStream = new MediaStream([
                    ...canvasStream.getVideoTracks(), // Compressed video from canvas
                    ...audioTracks                      // Original audio from source
                ]);

                // Setup MediaRecorder with combined stream
                const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') 
                    ? 'video/webm;codecs=vp9,opus'
                    : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
                    ? 'video/webm;codecs=vp8,opus'
                    : 'video/webm';

                const mediaRecorder = new MediaRecorder(combinedStream, {
                    mimeType: mimeType,
                    videoBitsPerSecond: bitrate,
                    audioBitsPerSecond: audioBitrate
                });

                const chunks = [];
                let recordingStartTime = null;
                
                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        chunks.push(e.data);
                    }
                };

                mediaRecorder.onstart = () => {
                    recordingStartTime = Date.now();
                };

                mediaRecorder.onstop = async () => {
                    const recordingDuration = Date.now() - recordingStartTime;
                    
                    // Create blob from chunks
                    const compressedBlob = new Blob(chunks, { type: mimeType });
                    
                    // Add duration metadata to WebM for seekability
                    let finalBlob = compressedBlob;
                    try {
                        finalBlob = await fixWebmDuration(compressedBlob, duration * 1000, mimeType);
                    } catch (fixError) {
                        // Continue with original blob if fix fails
                    }
                    
                    const compressedFile = new File(
                        [finalBlob],
                        file.name.replace(/\.[^/.]+$/, '') + '_compressed.webm',
                        { type: mimeType }
                    );

                    // Cleanup
                    URL.revokeObjectURL(videoURL);
                    
                    // Stop all tracks to free resources
                    combinedStream.getTracks().forEach(track => track.stop());
                    originalStream.getTracks().forEach(track => track.stop());
                    
                    resolve(compressedFile);
                };

                mediaRecorder.onerror = (e) => {
                    console.error('[VideoCompression] MediaRecorder error:', e);
                    URL.revokeObjectURL(videoURL);
                    combinedStream.getTracks().forEach(track => track.stop());
                    if (originalStream) originalStream.getTracks().forEach(track => track.stop());
                    reject(new Error('Failed to compress video'));
                };

                // Start recording
                mediaRecorder.start(100); // Capture data every 100ms

                // Play source video for audio capture (muted so no sound output)
                sourceVideo.currentTime = 0;
                await sourceVideo.play();

                // Play metadata video for frame capture
                videoMeta.currentTime = 0;
                await videoMeta.play();

                const frameInterval = 1000 / 30; // 30 fps
                let lastFrameTime = 0;
                let processedFrames = 0;
                const totalFrames = Math.floor(duration * 30);

                const captureFrame = () => {
                    if (videoMeta.ended || videoMeta.paused) {
                        mediaRecorder.stop();
                        return;
                    }

                    const currentTime = videoMeta.currentTime;
                    if (currentTime - lastFrameTime >= frameInterval / 1000) {
                        // Draw compressed frame to canvas
                        ctx.drawImage(videoMeta, 0, 0, targetWidth, targetHeight);
                        lastFrameTime = currentTime;
                        processedFrames++;

                        // Report progress
                        if (onProgress && processedFrames % 10 === 0) {
                            const progress = Math.min(95, Math.floor((processedFrames / totalFrames) * 100));
                            onProgress(progress);
                        }
                    }

                    requestAnimationFrame(captureFrame);
                };

                videoMeta.onended = () => {
                    sourceVideo.pause(); // Stop source video too
                    setTimeout(() => {
                        if (mediaRecorder.state !== 'inactive') {
                            mediaRecorder.stop();
                        }
                    }, 500); // Give 500ms buffer to ensure all audio is captured
                };

                captureFrame();

            } catch (error) {
                console.error('[VideoCompression] Compression failed:', error);
                reject(error);
            }
        });
    },

    /**
     * Compress image file
     */
    compressImage: async (file, maxSize = FILE_UPLOAD_CONFIG.MAX_IMAGE_SIZE) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const img = new Image();
                
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    
                    // Calculate scaling to reduce file size
                    const sizeRatio = file.size / maxSize;
                    if (sizeRatio > 1) {
                        const scale = Math.sqrt(1 / sizeRatio) * 0.9;
                        width = Math.floor(width * scale);
                        height = Math.floor(height * scale);
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Try different quality levels
                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                const compressedFile = new File(
                                    [blob],
                                    file.name,
                                    { type: 'image/jpeg' }
                                );
                                resolve(compressedFile);
                            } else {
                                reject(new Error('Failed to compress image'));
                            }
                        },
                        'image/jpeg',
                        0.8
                    );
                };
                
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target.result;
            };
            
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }
};

const SUBMIT_STATUS = {
    IDLE: 'idle',
    SUBMITTING: 'submitting',
    SUCCESS: 'success',
    ERROR: 'error',
};

/**
 * Sortable Section Component for @dnd-kit
 * Wraps each section to make it draggable and sortable
 */
function SortableSection({
    id,
    variant,
    variantIndex,
    variants,
    moveSectionUp,
    moveSectionDown,
    removeCurriculumSection,
    handleSectionChange,
    getValidationClass,
    validationState,
    uiState,
    collapsedSections,
    toggleSectionCollapse,
    addLesson,
    children
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.7 : 1,
        marginBottom: '1.5rem',
    };

    // ✅ FIX: Proper collapsed state logic
    // undefined = default state (will be set by useEffect based on section count)
    // true = explicitly collapsed
    // false = explicitly expanded
    const isCollapsed = collapsedSections[variantIndex] === true;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`form-section-enhanced ${isDragging ? 'dragging' : ''} ${isCollapsed ? 'section-collapsed' : ''}`}
        >
            <div className="subsection-header-enhanced">
                <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-3">
                        {/* Drag Handle for Section */}
                        <div
                            {...listeners}
                            {...attributes}
                            className="drag-handle drag-handle-section"
                            title="Drag to reorder sections"
                            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                        >
                            <i className="fas fa-grip-vertical"></i>
                        </div>
                        
                        {/* Collapse/Expand Button */}
                        <button
                            type="button"
                            className="btn btn-sm btn-link text-white p-0"
                            style={{ textDecoration: 'none', fontSize: '1.2rem', pointerEvents: 'auto' }}
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleSectionCollapse(variantIndex);
                            }}
                        >
                            <i className={`fas fa-chevron-${isCollapsed ? 'down' : 'up'}`}></i>
                        </button>
                        
                        {/* Divider */}
                        <div style={{ width: '1px', height: '24px', backgroundColor: 'rgba(255,255,255,0.3)' }}></div>
                        
                        {/* UP/DOWN Buttons for Sections */}
                        <div className="btn-group btn-group-sm" role="group">
                            <button
                                type="button"
                                className="btn btn-outline-light"
                                onClick={() => moveSectionUp(variantIndex)}
                                disabled={variantIndex === 0 || uiState.isSubmitting}
                                title="Move section up"
                                style={{ 
                                    fontSize: '0.75rem',
                                    padding: '2px 8px',
                                    opacity: variantIndex === 0 ? 0.3 : 1
                                }}
                            >
                                <i className="fas fa-arrow-up"></i>
                            </button>
                            <button
                                type="button"
                                className="btn btn-outline-light"
                                onClick={() => moveSectionDown(variantIndex)}
                                disabled={variantIndex === variants.length - 1 || uiState.isSubmitting}
                                title="Move section down"
                                style={{ 
                                    fontSize: '0.75rem',
                                    padding: '2px 8px',
                                    opacity: variantIndex === variants.length - 1 ? 0.3 : 1
                                }}
                            >
                                <i className="fas fa-arrow-down"></i>
                            </button>
                        </div>
                        
                        {/* Section Badge and Title */}
                        <div className="section-number-badge">
                            <i className="fas fa-folder-open me-2"></i>
                            Section {variantIndex + 1}
                        </div>
                        <h5 className="mb-0 section-title-text">
                            {variant?.title || "Untitled Section"}
                        </h5>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <span className="badge bg-light text-dark">
                            {variant?.items?.length || 0} Lesson{(variant?.items?.length || 0) !== 1 ? 's' : ''}
                        </span>
                        {variants.length > 1 && (
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeCurriculumSection(variantIndex, variant?.variant_id);
                                }}
                                disabled={uiState.isSubmitting}
                            >
                                <i className="fas fa-trash me-1"></i>
                                Delete
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Section Content - Only show if not collapsed */}
            {!isCollapsed && (
                <div className="subsection-content-enhanced">
                    <div className="mb-4">
                        <label className="form-label fw-bold">
                            <i className="fas fa-heading me-2 text-primary"></i>
                            Section Title
                        </label>
                        <input
                            type="text"
                            className={`curriculum-form-control ${getValidationClass(
                                validationState.errors[`variant_${variantIndex}_title`],
                                validationState.warnings[`variant_${variantIndex}_title`]
                            )}`}
                            value={variant?.title || ""}
                            onChange={(e) => handleSectionChange(variantIndex, "title", e.target.value)}
                            placeholder="e.g., Introduction to Programming"
                        />
                        {validationState.errors[`variant_${variantIndex}_title`] && (
                            <div className="curriculum-invalid-feedback">
                                {validationState.errors[`variant_${variantIndex}_title`]}
                            </div>
                        )}
                    </div>

                    {/* Lessons Container */}
                    {children}

                    <div className="text-start mt-3">
                        <button
                            type="button"
                            className="btn btn-success btn-sm"
                            onClick={() => addLesson(variantIndex)}
                            disabled={uiState.isSubmitting}
                        >
                            <i className="fas fa-plus me-2"></i>
                            Add New Lesson
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Sortable Lesson Item Component for @dnd-kit
 * Wraps each lesson to make it draggable and sortable
 */
function SortableLessonItem({ 
    id, 
    item, 
    itemIndex, 
    variantIndex, 
    variant,
    moveLessonUp, 
    moveLessonDown, 
    removeLesson, 
    handleLessonChange,
    getValidationClass,
    validationState,
    fileUploadStates,
    getFileIcon,
    getFileTypeLabel,
    getFileCategory,
    getFileName,
    uiState 
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        marginBottom: '1rem',
    };

    const uploadState = fileUploadStates[`${variantIndex}_${itemIndex}`] || {};

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`curriculum-item-card-enhanced ${isDragging ? 'dragging' : ''}`}
        >
            <div className="curriculum-item-header-enhanced">
                <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-2">
                        {/* Drag Handle for Lesson */}
                        <div
                            {...listeners}
                            {...attributes}
                            className="drag-handle drag-handle-lesson"
                            title="Drag to reorder lessons"
                            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                        >
                            <i className="fas fa-grip-vertical"></i>
                        </div>
                        
                        {/* UP/DOWN Buttons for Lessons */}
                        <div className="btn-group btn-group-sm" role="group">
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => moveLessonUp(variantIndex, itemIndex)}
                                disabled={itemIndex === 0 || uiState.isSubmitting}
                                title="Move lesson up"
                                style={{ 
                                    fontSize: '0.7rem',
                                    padding: '1px 6px',
                                    opacity: itemIndex === 0 ? 0.3 : 1
                                }}
                            >
                                <i className="fas fa-arrow-up"></i>
                            </button>
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => moveLessonDown(variantIndex, itemIndex)}
                                disabled={itemIndex === variant.items.length - 1 || uiState.isSubmitting}
                                title="Move lesson down"
                                style={{ 
                                    fontSize: '0.7rem',
                                    padding: '1px 6px',
                                    opacity: itemIndex === variant.items.length - 1 ? 0.3 : 1
                                }}
                            >
                                <i className="fas fa-arrow-down"></i>
                            </button>
                        </div>
                        
                        <span className="lesson-number-badge">
                            <i className="fas fa-play-circle me-1"></i>
                            Lesson {itemIndex + 1}
                        </span>
                        <h6 className="mb-0 lesson-title-preview">
                            {item?.title || "Untitled Lesson"}
                        </h6>
                    </div>
                    {variant.items.length > 1 && (
                        <button
                            type="button"
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => removeLesson(variantIndex, itemIndex, variant?.variant_id, item?.variant_item_id)}
                            disabled={uiState.isSubmitting}
                        >
                            <i className="fas fa-times me-1"></i>
                            Remove
                        </button>
                    )}
                </div>
            </div>

            <div className="curriculum-item-content-enhanced p-3">
                {/* Lesson Title - Full Width */}
                <div className="mb-3">
                    <label className="form-label fw-bold">
                        <i className="fas fa-heading me-2 text-primary"></i>
                        Lesson Title
                    </label>
                    <input
                        type="text"
                        className={`curriculum-form-control ${getValidationClass(
                            validationState.errors[`item_${variantIndex}_${itemIndex}_title`],
                            validationState.warnings[`item_${variantIndex}_${itemIndex}_title`]
                        )}`}
                        value={item?.title || ""}
                        onChange={(e) => handleLessonChange(variantIndex, itemIndex, "title", e.target.value)}
                        placeholder="e.g., Introduction to Variables"
                    />
                    {validationState.errors[`item_${variantIndex}_${itemIndex}_title`] && (
                        <div className="curriculum-invalid-feedback">
                            {validationState.errors[`item_${variantIndex}_${itemIndex}_title`]}
                        </div>
                    )}
                </div>

                {/* Two Column Layout: Description/Preview on Left, File Upload on Right */}
                <div className="row">
                    {/* Left Column: Description and Preview Checkbox */}
                    <div className="col-md-6 mb-3">
                        <div className="mb-3">
                            <label className="form-label fw-bold">
                                <i className="fas fa-align-left me-2 text-primary"></i>
                                Lesson Description (Optional)
                            </label>
                            <textarea
                                className={`curriculum-form-control ${getValidationClass(
                                    validationState.errors[`item_${variantIndex}_${itemIndex}_description`],
                                    validationState.warnings[`item_${variantIndex}_${itemIndex}_description`]
                                )}`}
                                value={item?.description || ""}
                                onChange={(e) => handleLessonChange(variantIndex, itemIndex, "description", e.target.value)}
                                rows="8"
                                placeholder="Describe what students will learn in this lesson..."
                            />
                            {validationState.errors[`item_${variantIndex}_${itemIndex}_description`] && (
                                <div className="curriculum-invalid-feedback">
                                    {validationState.errors[`item_${variantIndex}_${itemIndex}_description`]}
                                </div>
                            )}
                        </div>

                        <div className="form-check">
                            <input
                                type="checkbox"
                                className="form-check-input"
                                id={`preview-${variantIndex}-${itemIndex}`}
                                checked={item?.preview || false}
                                onChange={(e) => handleLessonChange(variantIndex, itemIndex, "preview", e.target.checked)}
                            />
                            <label className="form-check-label" htmlFor={`preview-${variantIndex}-${itemIndex}`}>
                                <i className="fas fa-eye me-2"></i>
                                Allow preview (Students can view this lesson before enrolling)
                            </label>
                        </div>
                    </div>

                    {/* Right Column: File Upload and Preview */}
                    <div className="col-md-6 mb-3">
                        <label className="form-label fw-bold">
                            <i className="fas fa-file-upload me-2 text-primary"></i>
                            Lesson File
                        </label>
                        <input
                            type="file"
                            className="curriculum-form-control"
                            onChange={(e) => handleLessonChange(variantIndex, itemIndex, "file", e.target.files[0], "file")}
                            accept="video/*,application/pdf,.doc,.docx,.ppt,.pptx"
                        />
                        
                        {uploadState.status === 'uploading' && (
                            <div className="upload-progress mt-2">
                                <div className="progress" style={{ height: '20px' }}>
                                    <div 
                                        className="progress-bar progress-bar-striped progress-bar-animated"
                                        role="progressbar"
                                        style={{ width: `${uploadState.progress}%` }}
                                    >
                                        {Math.round(uploadState.progress)}%
                                    </div>
                                </div>
                                <small className="text-muted d-block mt-1">
                                    {uploadState.message || 'Uploading...'}
                                </small>
                            </div>
                        )}
                        
                        {item?.file && (
                            <div className="file-preview-card">
                                <div className="file-preview-header">
                                    <div className={`file-preview-icon ${getFileCategory(item.file)}`}>
                                        <i className={getFileIcon(item.file)}></i>
                                    </div>
                                    <div className="file-preview-info">
                                        <div className="file-preview-name">
                                            {getFileName(item.file)}
                                        </div>
                                        <div className="file-preview-meta">
                                            <span className={`file-type-badge ${getFileCategory(item.file)}`}>
                                                {getFileTypeLabel(item.file)}
                                            </span>
                                            <span className="file-meta-item">
                                                <i className="fas fa-link"></i>
                                                Uploaded
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Thumbnail preview for videos and images */}
                                {(getFileCategory(item.file) === 'video' || getFileCategory(item.file) === 'image') && (
                                    <div className="file-preview-thumbnail">
                                        {getFileCategory(item.file) === 'video' ? (
                                            <video 
                                                src={item.file} 
                                                controls 
                                                preload="metadata"
                                                style={{ width: '100%', maxHeight: '200px' }}
                                            >
                                                Your browser does not support the video tag.
                                            </video>
                                        ) : (
                                            <img 
                                                src={item.file} 
                                                alt="File preview"
                                                style={{ width: '100%', maxHeight: '200px', objectFit: 'cover' }}
                                            />
                                        )}
                                    </div>
                                )}
                                
                                <div className="file-preview-actions">
                                    <a 
                                        href={item.file} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="btn btn-sm btn-outline-primary"
                                    >
                                        <i className="fas fa-external-link-alt me-1"></i>
                                        View File
                                    </a>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={() => {
                                            if (window.confirm('Are you sure you want to remove this file?')) {
                                                handleLessonChange(variantIndex, itemIndex, "file", "");
                                            }
                                        }}
                                        disabled={uiState.isSubmitting}
                                    >
                                        <i className="fas fa-trash me-1"></i>
                                        Remove File
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Course Edit Curriculum Component
 * Manages the editing of course curriculum including sections and lessons
 */
function CourseEditCurriculum() {
    // Navigation and params
    const navigate = useNavigate();
    const param = useParams();
    
    // Refs for form management
    const formRef = useRef(null);
    const submitButtonRef = useRef(null);

    // Configure drag sensors for @dnd-kit
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // 8px movement required before drag starts (prevents accidental drags)
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Core data state
    const [course, setCourse] = useState({ 
        category: 0, 
        file: "", 
        image: "", 
        title: "", 
        description: "", 
        price: "", 
        level: "", 
        language: "", 
        teacher_course_status: "" 
    });
    
    const [category, setCategory] = useState([]);
    const [ckEditorData, setCKEditorData] = useState("");
    const [variants, setVariants] = useState([
        {
            title: "",
            items: [{ title: "", description: "", file: "", preview: false }],
        },
    ]);

    // UI state consolidated
    const [uiState, setUiState] = useState({
        loading: false,
        isSubmitting: false,
        submitStatus: SUBMIT_STATUS.IDLE,
        submitMessage: '',
        isDirty: false,
        uploadProgress: 0,
        imagePreview: "",
        lastSaved: null, // Timestamp of last successful save
        autoSaving: false, // Auto-save in progress
        hasUnsavedChanges: false, // Track if there are unsaved changes
    });

    // Validation state consolidated  
    const [validationState, setValidationState] = useState({
        errors: {},
        warnings: {},
        summary: { errors: [], warnings: [] },
    });

    // File upload states
    const [fileUploadStates, setFileUploadStates] = useState({});

    // Collapsed sections state - track which sections are collapsed
    // Default behavior: expand all sections if curriculum is empty or has only 1 section
    const [collapsedSections, setCollapsedSections] = useState({});

    // Toggle section collapse/expand
    const toggleSectionCollapse = (variantIndex) => {
        setCollapsedSections(prev => ({
            ...prev,
            [variantIndex]: prev[variantIndex] === false ? true : false // ✅ FIX: Explicit boolean toggle
        }));
    };

    // Helper functions for file handling
    const getFileIcon = (fileUrl) => {
        if (!fileUrl) return "fas fa-file";
        
        const extension = fileUrl.toLowerCase().split('.').pop().split('?')[0];
        const iconMap = {
            // Video files
            'mp4': 'fas fa-play-circle',
            'avi': 'fas fa-play-circle', 
            'mov': 'fas fa-play-circle',
            'mkv': 'fas fa-play-circle',
            'webm': 'fas fa-play-circle',
            'ogg': 'fas fa-play-circle',
            // Document files
            'pdf': 'fas fa-file-pdf',
            'doc': 'fas fa-file-word',
            'docx': 'fas fa-file-word',
            'txt': 'fas fa-file-alt',
            // Presentation files
            'ppt': 'fas fa-file-powerpoint',
            'pptx': 'fas fa-file-powerpoint',
            // Image files
            'jpg': 'fas fa-image',
            'jpeg': 'fas fa-image',
            'png': 'fas fa-image',
            'gif': 'fas fa-image',
            'bmp': 'fas fa-image'
        };
        
        return iconMap[extension] || 'fas fa-file';
    };

    const getFileTypeLabel = (fileUrl) => {
        if (!fileUrl) return "File";
        
        const extension = fileUrl.toLowerCase().split('.').pop().split('?')[0];
        const labelMap = {
            'mp4': 'Video', 'avi': 'Video', 'mov': 'Video', 'mkv': 'Video', 'webm': 'Video', 'ogg': 'Video',
            'pdf': 'PDF', 'doc': 'Document', 'docx': 'Document', 'txt': 'Text',
            'ppt': 'Presentation', 'pptx': 'Presentation',
            'jpg': 'Image', 'jpeg': 'Image', 'png': 'Image', 'gif': 'Image', 'bmp': 'Image'
        };
        
        return labelMap[extension] || 'File';
    };

    /**
     * Get file category for styling
     */
    const getFileCategory = (fileUrl) => {
        if (!fileUrl) return 'file';
        
        const extension = fileUrl.toLowerCase().split('.').pop().split('?')[0];
        if (['mp4', 'avi', 'mov', 'mkv', 'webm', 'ogg'].includes(extension)) return 'video';
        if (['pdf', 'doc', 'docx', 'txt'].includes(extension)) return 'document';
        if (['ppt', 'pptx'].includes(extension)) return 'document';
        if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(extension)) return 'image';
        return 'file';
    };

    /**
     * Get file name from URL
     */
    const getFileName = (fileUrl) => {
        if (!fileUrl) return 'Unknown file';
        try {
            const url = new URL(fileUrl);
            const pathParts = url.pathname.split('/');
            return decodeURIComponent(pathParts[pathParts.length - 1]) || 'file';
        } catch {
            const parts = fileUrl.split('/');
            return parts[parts.length - 1] || 'file';
        }
    };

    // Enhanced validation functions
    const validateVariant = (variant, index) => {
        const variantErrors = {};
        const variantWarnings = {};

        // Safety check
        if (!variant) return { errors: variantErrors, warnings: variantWarnings };

        if (!variant.title || variant.title.trim().length < VALIDATION_RULES.VARIANT_TITLE_MIN_LENGTH) {
            variantErrors.title = `Section title must be at least ${VALIDATION_RULES.VARIANT_TITLE_MIN_LENGTH} characters long`;
        } else if (variant.title.trim().length > VALIDATION_RULES.VARIANT_TITLE_MAX_LENGTH) {
            variantWarnings.title = 'Section title is quite long. Consider shortening it.';
        }

        if (!variant.items || variant.items.length === 0) {
            variantErrors.items = 'Section must have at least one lesson';
        }

        return { errors: variantErrors, warnings: variantWarnings };
    };

    const validateVariantItem = (item, variantIndex, itemIndex) => {
        const itemErrors = {};
        const itemWarnings = {};

        // Safety check
        if (!item) return { errors: itemErrors, warnings: itemWarnings };

        if (!item.title || item.title.trim().length < VALIDATION_RULES.ITEM_TITLE_MIN_LENGTH) {
            itemErrors.title = `Lesson title must be at least ${VALIDATION_RULES.ITEM_TITLE_MIN_LENGTH} characters long`;
        } else if (item.title.trim().length > VALIDATION_RULES.ITEM_TITLE_MAX_LENGTH) {
            itemWarnings.title = 'Lesson title is quite long. Consider shortening it.';
        }

        // Description is now optional - only validate if provided
        if (item.description && item.description.trim().length > 0) {
            if (item.description.trim().length < VALIDATION_RULES.ITEM_DESCRIPTION_MIN_LENGTH) {
                itemWarnings.description = `Description is a bit short. Consider adding more details (at least ${VALIDATION_RULES.ITEM_DESCRIPTION_MIN_LENGTH} characters recommended).`;
            } else if (item.description.trim().length > VALIDATION_RULES.ITEM_DESCRIPTION_MAX_LENGTH) {
                itemWarnings.description = 'Lesson description is quite long. Consider shortening it.';
            }
        }

        if (!item.file && !item.id) {
            itemErrors.file = 'Please upload a lesson file';
        }

        return { errors: itemErrors, warnings: itemWarnings };
    };

    const updateValidationSummary = useCallback(() => {
        const allErrors = [];
        const allWarnings = [];

        // Add safety check for variants
        if (!variants || !Array.isArray(variants)) {
            return;
        }

        variants.forEach((variant, variantIndex) => {
            if (!variant) return; // Skip if variant is null/undefined
            
            const variantValidation = validateVariant(variant, variantIndex);
            
            if (Object.keys(variantValidation.errors).length > 0) {
                allErrors.push(`Section ${variantIndex + 1}: ${Object.values(variantValidation.errors).join(', ')}`);
            }
            if (Object.keys(variantValidation.warnings).length > 0) {
                allWarnings.push(`Section ${variantIndex + 1}: ${Object.values(variantValidation.warnings).join(', ')}`);
            }

            if (variant.items && Array.isArray(variant.items)) {
                variant.items.forEach((item, itemIndex) => {
                    if (!item) return; // Skip if item is null/undefined
                    
                    const itemValidation = validateVariantItem(item, variantIndex, itemIndex);
                    
                    if (Object.keys(itemValidation.errors).length > 0) {
                        allErrors.push(`Section ${variantIndex + 1}, Lesson ${itemIndex + 1}: ${Object.values(itemValidation.errors).join(', ')}`);
                    }
                    if (Object.keys(itemValidation.warnings).length > 0) {
                        allWarnings.push(`Section ${variantIndex + 1}, Lesson ${itemIndex + 1}: ${Object.values(itemValidation.warnings).join(', ')}`);
                    }
                });
            }
        });

        setValidationState(prev => ({
            ...prev,
            summary: { errors: allErrors, warnings: allWarnings }
        }));
    }, [variants]);

    // Update validation summary when variants change
    useEffect(() => {
        updateValidationSummary();
    }, [updateValidationSummary]);

    // Track form changes for dirty state and auto-save
    const trackFormChanges = useCallback(() => {
        setUiState(prev => ({ 
            ...prev, 
            isDirty: true,
            hasUnsavedChanges: true 
        }));
    }, []);

    // Auto-save functionality with debouncing
    const autoSaveTimeoutRef = useRef(null);
    
    const performAutoSave = useCallback(async () => {
        // Don't auto-save if already submitting or if no changes
        if (uiState.isSubmitting || !uiState.hasUnsavedChanges) {
            return;
        }

        try {
            setUiState(prev => ({ ...prev, autoSaving: true }));

            const formData = new FormData();
            
            // Add course basic fields
            formData.append("title", course.title || "");
            formData.append("category", course.category || "");
            formData.append("description", ckEditorData || "");
            formData.append("level", course.level || "");
            formData.append("language", course.language || "");
            formData.append("price", course.price || "");
            formData.append("teacher_course_status", course.teacher_course_status || "");
            
            // Handle course image
            if (course.image && typeof course.image !== "string") {
                formData.append("image", course.image);
            }
            
            // Handle intro video
            if (course.file && typeof course.file !== "string") {
                formData.append("file", course.file);
            }

            // Filter out empty variants and items (same logic as main submit)
            const validVariants = variants.filter(variant => {
                if (!variant.title || variant.title.trim() === "") return false;
                const validItems = (variant.items || []).filter(item => 
                    item.title && item.title.trim() !== ""
                );
                return validItems.length > 0;
            }).map((variant, index) => {
                const validItems = (variant.items || []).filter(item => 
                    item.title && item.title.trim() !== ""
                );
                
                return {
                    title: variant.title.trim(),
                    variant_id: variant.variant_id,
                    order: index,
                    items: validItems.map((item, itemIndex) => ({
                        title: item.title.trim(),
                        description: (item.description || "").trim(),
                        file: typeof item.file === 'string' ? item.file : "",
                        preview: item.preview || false,
                        variant_item_id: item.variant_item_id,
                        order: itemIndex
                    }))
                };
            });

            formData.append("variants", JSON.stringify(validVariants));

            // Send auto-save request to the correct update endpoint
            await useAxios.patch(`teacher/course-update/${UserData()?.teacher_id}/${param.course_id}/`, formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            // Update last saved timestamp
            setUiState(prev => ({ 
                ...prev, 
                autoSaving: false,
                hasUnsavedChanges: false,
                lastSaved: new Date(),
                submitStatus: SUBMIT_STATUS.SUCCESS,
            }));

            // Clear auto-save success indicator after 3 seconds
            setTimeout(() => {
                setUiState(prev => ({
                    ...prev,
                    submitStatus: SUBMIT_STATUS.IDLE,
                }));
            }, 3000);

        } catch (error) {
            console.error("Auto-save error:", error);
            setUiState(prev => ({ ...prev, autoSaving: false }));
            // Don't show error message for auto-save failures to avoid annoying users
        }
    }, [course, ckEditorData, variants, param.course_id, uiState.isSubmitting, uiState.hasUnsavedChanges]);

    // Debounced auto-save - triggers 3 seconds after last change
    useEffect(() => {
        if (uiState.hasUnsavedChanges && !uiState.isSubmitting) {
            // Clear existing timeout
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }

            // Set new timeout for auto-save
            autoSaveTimeoutRef.current = setTimeout(() => {
                performAutoSave();
            }, 3000); // 3 seconds debounce

            // Cleanup
            return () => {
                if (autoSaveTimeoutRef.current) {
                    clearTimeout(autoSaveTimeoutRef.current);
                }
            };
        }
    }, [uiState.hasUnsavedChanges, uiState.isSubmitting, performAutoSave]);

    // Warning before leaving page with unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (uiState.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return e.returnValue;
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [uiState.hasUnsavedChanges]);

    // Get validation class for form elements
    const getValidationClass = (hasError, hasWarning) => {
        if (hasError) return 'is-invalid';
        if (hasWarning) return 'is-warning';
        return '';
    };

    // Initialize course image from cookie
    useEffect(() => {
        const course_image_url = Cookie.get("course_image_url");
        if (course_image_url) {
            setCourse(prev => ({
                ...prev,
                image: course_image_url,
            }));
            setUiState(prev => ({
                ...prev,
                imagePreview: course_image_url,
            }));
        }
    }, []);

    /**
     * Fetch course details and categories from API
     */
    const fetchCourseDetail = async () => {
        try {
            setUiState(prev => ({ ...prev, loading: true }));
            
            // Fetch categories
            const categoriesResponse = await useAxios.get(`course/category/`);
            setCategory(categoriesResponse.data);

            // Fetch course details
            const courseResponse = await useAxios.get(`teacher/course-detail/${param.course_id}/`);
            setCourse(courseResponse.data);
            
            // Set variants with proper mapping from backend Variant/VariantItem structure
            const curriculumData = courseResponse.data.curriculum || [];
            
            // ✅ FIX: Sort sections by order field to maintain consistent ordering
            // Backend now includes order field and sorts by it, but we ensure it here too
            const sortedCurriculumData = [...curriculumData].sort((a, b) => {
                const orderA = a.order !== undefined ? a.order : 999999;
                const orderB = b.order !== undefined ? b.order : 999999;
                return orderA - orderB;
            });
            
            const formattedVariants = sortedCurriculumData.length > 0 ? sortedCurriculumData.map((variant, index) => {
                // Sort variant items (lessons) by order field
                const sortedItems = (variant.variant_items || variant.items || []).sort((a, b) => {
                    const orderA = a.order !== undefined ? a.order : 999999;
                    const orderB = b.order !== undefined ? b.order : 999999;
                    return orderA - orderB;
                });
                
                return {
                    title: variant.title || "",
                    variant_id: variant.variant_id || variant.id, // Use variant_id or fallback to id
                    order: variant.order !== undefined ? variant.order : index, // ✅ Preserve order field
                    items: sortedItems.map((item, itemIndex) => ({
                        title: item.title || "",
                        description: item.description || "",
                        file: item.file || "",
                        preview: item.preview || false,
                        variant_item_id: item.variant_item_id || item.id, // Preserve variant_item_id
                        order: item.order !== undefined ? item.order : itemIndex // ✅ Preserve lesson order
                    }))
                };
            }) : [
                {
                    title: "",
                    order: 0,
                    items: [{ title: "", description: "", file: "", preview: false, order: 0 }],
                }
            ];
            
            setVariants(formattedVariants);
            
            setCKEditorData(courseResponse.data.description || "");
            
        } catch (error) {
            console.error("Error fetching course details:", error);
            
            Toast().fire({
                icon: "error",
                title: "Failed to load course details",
                text: error.response?.data?.message || "Please try refreshing the page.",
            });
            
            // Set default values on error
            setVariants([
                {
                    title: "",
                    items: [{ title: "", description: "", file: "", preview: false }],
                },
            ]);
            
        } finally {
            setUiState(prev => ({ ...prev, loading: false }));
        }
    };

    // Load course data on mount
    useEffect(() => {
        fetchCourseDetail();
    }, []);

    /**
     * ✅ FIX: Initialize collapsed state based on curriculum content
     * Auto-expand sections when:
     * 1. Curriculum is empty (1 blank section)
     * 2. Only 1 section exists
     * This improves UX by showing content immediately for new/simple courses
     */
    useEffect(() => {
        if (!variants || variants.length === 0) return;

        // Check if curriculum is effectively empty (1 section with blank title and no lessons)
        const isEmptyCurriculum = variants.length === 1 && 
            (!variants[0].title || variants[0].title.trim() === '') &&
            (!variants[0].items || variants[0].items.length <= 1) &&
            (!variants[0].items?.[0]?.title || variants[0].items[0].title.trim() === '');

        // Auto-expand if: empty curriculum OR only 1 section
        const shouldAutoExpand = isEmptyCurriculum || variants.length === 1;

        if (shouldAutoExpand) {
            // Set all sections to expanded (false = not collapsed)
            const initialCollapsedState = {};
            variants.forEach((_, index) => {
                initialCollapsedState[index] = false; // false = expanded
            });
            setCollapsedSections(initialCollapsedState);
        } else {
            // For multiple sections with content, keep default (collapsed)
            // But we don't set anything - let user control via toggle
        }
    }, [variants.length]); // Re-run when section count changes

    /**
     * Handle course input field changes
     */
    const handleCourseInputChange = (event) => {
        const { name, type, value, checked } = event.target;
        const newValue = type === "checkbox" ? checked : value;
        
        setCourse(prevCourse => ({
            ...prevCourse,
            [name]: newValue,
        }));
        
        trackFormChanges();
        
        // Clear any existing errors for this field
        setValidationState(prev => ({
            ...prev,
            errors: {
                ...prev.errors,
                [name]: null
            }
        }));
    };

    /**
     * Handle CKEditor content changes
     */
    const handleCkEditorChange = (event, editor) => {
        const data = editor.getData();
        setCKEditorData(data);
        trackFormChanges();
    };

    /**
     * Validate file type and size
     */
    const validateFile = (file, type = 'image') => {
        const config = type === 'image' ? 
            { types: FILE_UPLOAD_CONFIG.IMAGE_TYPES, maxSize: FILE_UPLOAD_CONFIG.MAX_IMAGE_SIZE } :
            { types: FILE_UPLOAD_CONFIG.VIDEO_TYPES, maxSize: FILE_UPLOAD_CONFIG.MAX_VIDEO_SIZE };

        if (!config.types.includes(file.type)) {
            return { isValid: false, error: `Please select a valid ${type} file` };
        }

        if (file.size > config.maxSize) {
            const maxSizeMB = Math.round(config.maxSize / (1024 * 1024));
            return { isValid: false, error: `File size must be less than ${maxSizeMB}MB` };
        }

        return { isValid: true };
    };

    /**
     * Handle course image upload
     */
    const handleCourseImageChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file
        const validation = validateFile(file, 'image');
        if (!validation.isValid) {
            setValidationState(prev => ({
                ...prev,
                errors: {
                    ...prev.errors,
                    image: validation.error
                }
            }));
            Toast().fire({
                icon: "error",
                title: validation.error,
            });
            return;
        }

        setUiState(prev => ({ ...prev, loading: true, uploadProgress: 0 }));

        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await useAxios.post("/file-upload/", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUiState(prev => ({ ...prev, uploadProgress: percentCompleted }));
                },
            });

            if (response?.data?.url) {
                Cookie.set("course_image_url", response?.data?.url);
                setUiState(prev => ({ ...prev, imagePreview: response?.data?.url }));
                setCourse(prevCourse => ({
                    ...prevCourse,
                    image: response?.data?.url,
                }));
                
                // Clear any errors
                setValidationState(prev => ({
                    ...prev,
                    errors: {
                        ...prev.errors,
                        image: null
                    }
                }));

                Toast().fire({
                    icon: "success",
                    title: "Image uploaded successfully!",
                });
                
                trackFormChanges();
            }
        } catch (error) {
            console.error("Error uploading image:", error);
            setValidationState(prev => ({
                ...prev,
                errors: {
                    ...prev.errors,
                    image: 'Failed to upload image. Please try again.'
                }
            }));
            Toast().fire({
                icon: "error",
                title: "Failed to upload image. Please try again.",
            });
        } finally {
            setUiState(prev => ({ ...prev, loading: false, uploadProgress: 0 }));
        }
    };

    /**
     * Handle course intro video file change
     */
    const handleCourseIntroVideoChange = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setCourse(prev => ({
            ...prev,
            [event.target.name]: file,
        }));
        
        trackFormChanges();
    };

    /**
     * Handle changes to curriculum section (variant) fields
     * CRITICAL: Preserve variant_id to prevent duplicates
     * Enhanced with comprehensive validation and error handling
     */
    const handleSectionChange = (index, propertyName, value) => {
        // Input validation
        if (typeof index !== 'number' || index < 0) {
            Toast().fire({
                icon: "error",
                title: "Invalid section. Please refresh the page.",
            });
            return;
        }

        if (!propertyName || typeof propertyName !== 'string') {
            return;
        }

        setVariants(prevVariants => {
            try {
                // Validate prevVariants structure
                if (!prevVariants || !Array.isArray(prevVariants)) {
                    return prevVariants;
                }

                // Validate index is within bounds
                if (index >= prevVariants.length) {
                    return prevVariants;
                }

                const updatedVariants = [...prevVariants];
                
                // Ensure we don't lose the variant_id during updates
                const currentVariant = updatedVariants[index];
                if (!currentVariant) {
                    return prevVariants;
                }

                updatedVariants[index] = {
                    ...currentVariant,  // Preserve all existing properties including variant_id
                    [propertyName]: value
                };
                
                return updatedVariants;
            } catch (error) {
                return prevVariants; // Return unchanged on error
            }
        });
        
        trackFormChanges();

        // Clear validation errors for this variant
        setValidationState(prev => ({
            ...prev,
            errors: {
                ...prev.errors,
                [`variant_${index}_${propertyName}`]: null
            }
        }));
    };

    /**
     * Handle lesson item changes including file uploads
     */
    /**
     * Handle changes to lesson (variant item) fields
     * CRITICAL: Preserve variant_item_id to prevent duplicates
     * Enhanced with comprehensive validation and error handling
     */
    const handleLessonChange = async (variantIndex, itemIndex, propertyName, value, type) => {
        // Input validation
        if (typeof variantIndex !== 'number' || typeof itemIndex !== 'number') {
            Toast().fire({
                icon: "error",
                title: "Invalid lesson parameters. Please refresh the page.",
            });
            return;
        }

        // Validate variants array and indices
        if (!variants || !Array.isArray(variants) || variantIndex < 0 || variantIndex >= variants.length) {
            Toast().fire({
                icon: "error",
                title: "Invalid section. Please refresh the page.",
            });
            return;
        }

        const currentVariant = variants[variantIndex];
        if (!currentVariant || !currentVariant.items || !Array.isArray(currentVariant.items) || 
            itemIndex < 0 || itemIndex >= currentVariant.items.length) {
            Toast().fire({
                icon: "error",
                title: "Invalid lesson. Please refresh the page.",
            });
            return;
        }

        // Handle file upload specifically
        if (type === 'file' && value) {
            const success = await handleFileUpload(value, variantIndex, itemIndex, propertyName);
            
            if (!success) {
                return;
            }
        } else {
            // Handle regular property changes
            setVariants(prevVariants => {
                try {
                    // Validate prevVariants structure
                    if (!prevVariants || !Array.isArray(prevVariants)) {
                        return prevVariants;
                    }

                    const updatedVariants = [...prevVariants];
                    
                    // Double-check indices are still valid (defensive programming)
                    if (!updatedVariants[variantIndex] || 
                        !updatedVariants[variantIndex].items || 
                        !updatedVariants[variantIndex].items[itemIndex]) {
                        return prevVariants; // Return unchanged on error
                    }

                    const currentItem = updatedVariants[variantIndex].items[itemIndex];
                    
                    // Preserve all existing properties including variant_item_id
                    updatedVariants[variantIndex].items[itemIndex] = {
                        ...currentItem,  // Preserve variant_item_id and other properties
                        [propertyName]: value
                    };
                    
                    return updatedVariants;
                } catch (error) {
                    return prevVariants; // Return unchanged on error
                }
            });
        }

        trackFormChanges();

        // Clear validation errors for this item
        setValidationState(prev => ({
            ...prev,
            errors: {
                ...prev.errors,
                [`item_${variantIndex}_${itemIndex}_${propertyName}`]: null
            }
        }));
    };

    /**
     * Handle file upload for curriculum items
     * Enhanced with comprehensive validation, compression, and error handling
     */
    const handleFileUpload = async (file, variantIndex, itemIndex, propertyName) => {
        // Input validation
        if (!file) {
            Toast().fire({
                icon: "error",
                title: "No file selected. Please choose a file to upload.",
            });
            return false;
        }

        // Validate indices
        if (typeof variantIndex !== 'number' || typeof itemIndex !== 'number') {
            Toast().fire({
                icon: "error",
                title: "Invalid upload parameters. Please try again.",
            });
            return false;
        }

        // Validate variants array and indices are within bounds
        if (!variants || !Array.isArray(variants) || variantIndex < 0 || variantIndex >= variants.length) {
            Toast().fire({
                icon: "error",
                title: "Invalid section. Please refresh the page and try again.",
            });
            return false;
        }

        const currentVariant = variants[variantIndex];
        if (!currentVariant || !currentVariant.items || !Array.isArray(currentVariant.items) || 
            itemIndex < 0 || itemIndex >= currentVariant.items.length) {
            Toast().fire({
                icon: "error",
                title: "Invalid lesson. Please refresh the page and try again.",
            });
            return false;
        }

        const fileUploadKey = `${variantIndex}_${itemIndex}`;
        
        // Determine file type for validation
        const fileName = file.name || '';
        if (!fileName) {
            Toast().fire({
                icon: "error",
                title: "Invalid file. Please choose a valid file.",
            });
            return false;
        }

        const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
        const isVideo = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'ogg'].includes(fileExtension);
        const isDocument = ['pdf', 'doc', 'docx', 'txt'].includes(fileExtension);
        const isPresentation = ['ppt', 'pptx'].includes(fileExtension);
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(fileExtension);
        
        // Validate file type
        if (!isVideo && !isDocument && !isPresentation && !isImage) {
            const errorMessage = `Unsupported file type: .${fileExtension}. Please upload video, document, presentation, or image files.`;
            Toast().fire({
                icon: "error",
                title: errorMessage,
            });
            return false;
        }

        // Check file size and offer compression if needed
        const maxSize = isVideo ? FILE_UPLOAD_CONFIG.MAX_VIDEO_SIZE : 
                       isImage ? FILE_UPLOAD_CONFIG.MAX_IMAGE_SIZE : 
                       10 * 1024 * 1024; // 10MB for documents
        
        let fileToUpload = file;
        let wasCompressed = false;

        // Handle files that exceed size limit
        if (file.size > maxSize) {
            const maxSizeMB = Math.round(maxSize / (1024 * 1024));
            const fileSizeMB = Math.round(file.size / (1024 * 1024));

            // For videos and images, offer compression
            if (isVideo || isImage) {
                // Calculate estimated compression time (rough estimate)
                const estimatedMinutes = Math.ceil(fileSizeMB / 20); // ~20MB per minute for video
                const timeWarning = isVideo 
                    ? `<p class="text-warning"><i class="fas fa-clock me-1"></i> <strong>Estimated time: ${estimatedMinutes} ${estimatedMinutes === 1 ? 'minute' : 'minutes'}</strong></p>`
                    : `<p class="text-info"><i class="fas fa-clock me-1"></i> <strong>This should only take a few seconds</strong></p>`;

                const result = await Swal.fire({
                    title: 'File Size Too Large',
                    html: `
                        <div class="text-start">
                            <p>Your ${isVideo ? 'video' : 'image'} file is <strong>${fileSizeMB}MB</strong>, which exceeds the <strong>${maxSizeMB}MB</strong> limit.</p>
                            <p>Would you like to automatically compress it before uploading?</p>
                            ${timeWarning}
                            <div class="alert alert-info mt-3" style="font-size: 0.9rem;">
                                <i class="fas fa-info-circle me-1"></i>
                                <strong>Note:</strong> You can cancel the compression at any time during the process.
                            </div>
                        </div>
                    `,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: '<i class="fas fa-compress-alt me-2"></i>Yes, compress it!',
                    cancelButtonText: '<i class="fas fa-times me-2"></i>Cancel upload',
                    allowOutsideClick: false,
                    customClass: {
                        confirmButton: 'btn btn-primary btn-lg',
                        cancelButton: 'btn btn-secondary btn-lg'
                    }
                });

                if (!result.isConfirmed) {
                    return false;
                }

                // Variable to track if compression was cancelled
                let compressionCancelled = false;

                // Show compression progress with cancel button
                const compressionDialog = Swal.fire({
                    title: isVideo ? 'Compressing Video...' : 'Compressing Image...',
                    html: `
                        <div class="text-center">
                            <div class="mb-3">
                                <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
                                    <span class="visually-hidden">Compressing...</span>
                                </div>
                            </div>
                            <p id="compression-progress" class="mb-3">Starting compression...</p>
                            <div class="progress mb-3" style="height: 25px;">
                                <div id="compression-progress-bar" class="progress-bar progress-bar-striped progress-bar-animated" 
                                     role="progressbar" style="width: 0%">0%</div>
                            </div>
                            <small class="text-muted">This may take a few moments. Please wait...</small>
                        </div>
                    `,
                    icon: 'info',
                    showCancelButton: true,
                    confirmButtonText: 'Running...',
                    cancelButtonText: '<i class="fas fa-stop-circle me-2"></i>Cancel Compression',
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    showConfirmButton: false,
                    customClass: {
                        cancelButton: 'btn btn-danger'
                    },
                    didOpen: () => {
                        // Handle cancel button click
                        const cancelButton = Swal.getCancelButton();
                        cancelButton.addEventListener('click', () => {
                            compressionCancelled = true;
                            Swal.close();
                            
                            Toast().fire({
                                icon: 'info',
                                title: 'Compression cancelled by user',
                            });

                            // Reset file upload state
                            setFileUploadStates(prevStates => ({
                                ...prevStates,
                                [fileUploadKey]: { status: 'cancelled', progress: 0 }
                            }));
                        });
                    }
                });

                // Update progress UI
                const updateCompressionProgress = (progress, message) => {
                    const progressElement = document.getElementById('compression-progress');
                    const progressBar = document.getElementById('compression-progress-bar');
                    
                    if (progressElement && progressBar) {
                        progressElement.textContent = message || `Compressing: ${progress}%`;
                        progressBar.style.width = `${progress}%`;
                        progressBar.textContent = `${progress}%`;
                    }
                };

                // Set upload state
                setFileUploadStates(prevStates => ({
                    ...prevStates,
                    [fileUploadKey]: { 
                        status: 'compressing', 
                        progress: 0,
                        message: 'Starting compression...'
                    }
                }));

                try {
                    if (isVideo) {
                        // Compress video with cancel check
                        fileToUpload = await VideoCompressionUtils.compressVideo(
                            file,
                            FILE_UPLOAD_CONFIG.TARGET_COMPRESSED_SIZE,
                            (progress) => {
                                // Check if compression was cancelled
                                if (compressionCancelled) {
                                    throw new Error('Compression cancelled by user');
                                }

                                updateCompressionProgress(progress, `Compressing video: ${progress}%`);
                                
                                setFileUploadStates(prevStates => ({
                                    ...prevStates,
                                    [fileUploadKey]: { 
                                        status: 'compressing', 
                                        progress: progress,
                                        message: `Compressing video: ${progress}%`
                                    }
                                }));
                            }
                        );
                    } else if (isImage) {
                        // Compress image
                        updateCompressionProgress(50, 'Compressing image...');
                        
                        setFileUploadStates(prevStates => ({
                            ...prevStates,
                            [fileUploadKey]: { 
                                status: 'compressing', 
                                progress: 50,
                                message: 'Compressing image...'
                            }
                        }));
                        
                        fileToUpload = await VideoCompressionUtils.compressImage(file, maxSize);
                        
                        // Check if cancelled during image compression
                        if (compressionCancelled) {
                            throw new Error('Compression cancelled by user');
                        }

                        updateCompressionProgress(100, 'Image compressed!');
                    }

                    // Close compression dialog
                    Swal.close();

                    wasCompressed = true;
                    const compressedSizeMB = Math.round(fileToUpload.size / (1024 * 1024));
                    const compressionRatio = ((1 - fileToUpload.size / file.size) * 100).toFixed(1);

                    Toast().fire({
                        icon: 'success',
                        title: `File compressed successfully!`,
                        html: `
                            <div>
                                <p class="mb-1"><strong>${compressionRatio}% reduction</strong></p>
                                <p class="mb-0"><small>From ${fileSizeMB}MB to ${compressedSizeMB}MB</small></p>
                            </div>
                        `,
                        timer: 4000
                    });

                    // Check if compressed file still exceeds limit
                    if (fileToUpload.size > maxSize) {
                        const stillTooLargeMB = Math.round(fileToUpload.size / (1024 * 1024));
                        setFileUploadStates(prevStates => ({
                            ...prevStates,
                            [fileUploadKey]: { status: 'error', progress: 0 }
                        }));
                        
                        Toast().fire({
                            icon: 'error',
                            title: `Even after compression, file is still ${stillTooLargeMB}MB. Please use a smaller file.`,
                        });
                        return false;
                    }

                } catch (compressionError) {
                    // Close compression dialog if still open
                    Swal.close();

                    // Check if error was due to cancellation
                    if (compressionError.message === 'Compression cancelled by user' || compressionCancelled) {
                        return false; // User cancelled, just return
                    }

                    setFileUploadStates(prevStates => ({
                        ...prevStates,
                        [fileUploadKey]: { status: 'error', progress: 0 }
                    }));
                    
                    console.error('Compression error:', compressionError);
                    
                    Toast().fire({
                        icon: 'error',
                        title: 'Compression Failed',
                        text: 'Failed to compress file. Please try a smaller file or different format.',
                    });
                    return false;
                }
            } else {
                // For documents, compression not available
                const errorMessage = `File size too large (${fileSizeMB}MB). Maximum size is ${maxSizeMB}MB. Please use a smaller file.`;
                Toast().fire({
                    icon: "error",
                    title: errorMessage,
                });
                return false;
            }
        }

        // Set upload state
        setFileUploadStates(prevStates => ({
            ...prevStates,
            [fileUploadKey]: { 
                status: 'uploading', 
                progress: 0,
                message: wasCompressed ? 'Uploading compressed file...' : 'Uploading file...'
            }
        }));

        try {
            const formData = new FormData();
            formData.append("file", fileToUpload);

            const response = await useAxios.post("/file-upload/", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
                onUploadProgress: (progressEvent) => {
                    if (!progressEvent.total) return;
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setFileUploadStates(prevStates => ({
                        ...prevStates,
                        [fileUploadKey]: { 
                            status: 'uploading', 
                            progress: percentCompleted,
                            message: `Uploading: ${percentCompleted}%`
                        }
                    }));
                },
            });

            // Validate response
            if (!response || !response.data || !response.data.url) {
                throw new Error('Invalid response from server - no file URL returned');
            }

            // Update variants state with the uploaded file data
            setVariants(prevVariants => {
                // Create a deep copy to ensure immutability
                const updatedVariants = JSON.parse(JSON.stringify(prevVariants));
                
                // Validate indices again before updating (safety check)
                if (!updatedVariants[variantIndex] || !updatedVariants[variantIndex].items || 
                    !updatedVariants[variantIndex].items[itemIndex]) {
                    return prevVariants; // Return unchanged if invalid
                }
                
                // Update the file URL
                updatedVariants[variantIndex].items[itemIndex][propertyName] = response.data.url;
                
                // If it's a video and has duration, store the duration in seconds
                if (response.data.duration_seconds) {
                    updatedVariants[variantIndex].items[itemIndex].duration_seconds = response.data.duration_seconds;
                }
                
                // Store additional file metadata
                updatedVariants[variantIndex].items[itemIndex].file_type = response.data.file_type || 'file';
                updatedVariants[variantIndex].items[itemIndex].file_name = response.data.file_name || fileToUpload.name;
                updatedVariants[variantIndex].items[itemIndex].was_compressed = wasCompressed;
                
                return updatedVariants;
            });
                
            setFileUploadStates(prevStates => ({
                ...prevStates,
                [fileUploadKey]: { 
                    status: 'success', 
                    progress: 100, 
                    url: response.data.url,
                    fileType: response.data.file_type,
                    duration: response.data.video_duration,
                    wasCompressed: wasCompressed
                }
            }));

            const fileTypeLabel = response.data.file_type === 'video' ? 'Video' : 
                                   isDocument ? 'Document' : 
                                   isPresentation ? 'Presentation' : 
                                   isImage ? 'Image' : 'File';

            const successMessage = wasCompressed 
                ? `${fileTypeLabel} compressed and uploaded successfully!`
                : `${fileTypeLabel} uploaded successfully!`;

            Toast().fire({
                icon: "success",
                title: successMessage,
            });
            return true;
            
        } catch (error) {
            // Set error state
            setFileUploadStates(prevStates => ({
                ...prevStates,
                [fileUploadKey]: { status: 'error', progress: 0 }
            }));

            // Prepare user-friendly error message
            let errorMessage = "Failed to upload file. Please try again.";
            if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            } else if (error.response?.data?.error) {
                errorMessage = error.response.data.error;
            } else if (error.message) {
                errorMessage = `Upload failed: ${error.message}`;
            }

            Toast().fire({
                icon: "error",
                title: errorMessage,
            });
            
            return false;
        }
    };

    /**
     * Add a new curriculum section (variant)
     */
    const addCurriculumSection = () => {
        setVariants(prevVariants => {
            // Calculate next order number
            const maxOrder = prevVariants.reduce((max, v) => Math.max(max, v.order || 0), -1);
            const newOrder = maxOrder + 1;
            
            return [
                ...prevVariants,
                {
                    title: "",
                    order: newOrder, // ✅ Assign order to new section
                    items: [{ 
                        title: "", 
                        description: "", 
                        file: "", 
                        preview: false,
                        order: 0 // ✅ Assign order to new lesson
                    }],
                },
            ];
        });
        trackFormChanges();
        
        Toast().fire({
            icon: "success",
            title: "New section added successfully!",
        });
    };

    /**
     * Remove a curriculum section (variant) and all its lessons
     */
    const removeCurriculumSection = async (index, variantId) => {
        // Confirm deletion
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to recover this section!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (!result.isConfirmed) return;

        try {
            // If it's a saved section (has variantId), delete from backend
            if (variantId) {
                await useAxios.delete(`teacher/course/variant-delete/${variantId}/${UserData()?.teacher_id}/${param.course_id}/`);
                
                Toast().fire({
                    icon: "success",
                    title: "Section deleted successfully from database",
                });
            } else {
                // If it's a new unsaved section, just show success message
                Toast().fire({
                    icon: "success",
                    title: "Section removed successfully",
                });
            }

            // Update local state without reloading
            const updatedVariants = [...variants];
            updatedVariants.splice(index, 1);
            setVariants(updatedVariants);
            
            // Only mark as dirty if there were already changes
            if (variantId) {
                trackFormChanges();
            }
        } catch (error) {
            console.error("Error deleting variant:", error);
            
            let errorMessage = "Failed to delete section. Please try again.";
            if (error.response?.data?.detail) {
                errorMessage = error.response.data.detail;
            } else if (error.response?.status === 404) {
                errorMessage = "Section not found or already deleted.";
            } else if (error.response?.status === 403) {
                errorMessage = "You don't have permission to delete this section.";
            } else if (error.response?.status === 500) {
                errorMessage = "Server error occurred. Please try again later.";
            }
            
            Toast().fire({
                icon: "error",
                title: errorMessage,
            });
        }
    };

    /**
     * Add a new lesson item to a variant
     */
    /**
     * Add a new lesson to a curriculum section
     */
    const addLesson = (variantIndex) => {
        const updatedVariants = [...variants];
        
        // Calculate next order number for lesson
        const currentItems = updatedVariants[variantIndex].items || [];
        const maxOrder = currentItems.reduce((max, item) => Math.max(max, item.order || 0), -1);
        const newOrder = maxOrder + 1;
        
        updatedVariants[variantIndex].items.push({
            title: "",
            description: "",
            file: "",
            preview: false,
            order: newOrder // ✅ Assign order to new lesson
        });

        setVariants(updatedVariants);
        trackFormChanges();

        Toast().fire({
            icon: "success",
            title: "New lesson added successfully!",
        });
    };

    /**
     * Remove a lesson item from a variant
     */
    /**
     * Remove a lesson from a curriculum section
     */
    const removeLesson = async (variantIndex, itemIndex, variantId, itemId) => {
        // Confirm deletion
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to recover this lesson!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (!result.isConfirmed) return;

        try {
            // If it's a saved lesson (has itemId), delete from backend
            if (itemId) {
                await useAxios.delete(`teacher/course/variant-item-delete/${variantId}/${itemId}/${UserData()?.teacher_id}/${param.course_id}/`);
                
                Toast().fire({
                    icon: "success",
                    title: "Lesson deleted successfully from database",
                });
            } else {
                // If it's a new unsaved lesson, just show success message
                Toast().fire({
                    icon: "success",
                    title: "Lesson removed successfully",
                });
            }

            // Update local state without reloading
            const updatedVariants = [...variants];
            updatedVariants[variantIndex].items.splice(itemIndex, 1);
            setVariants(updatedVariants);
            
            // Only mark as dirty if there were already changes
            if (itemId) {
                trackFormChanges();
            }
        } catch (error) {
            console.error("Error deleting item:", error);
            
            let errorMessage = "Failed to delete lesson. Please try again.";
            if (error.response?.data?.detail) {
                errorMessage = error.response.data.detail;
            } else if (error.response?.status === 404) {
                errorMessage = "Lesson not found or already deleted.";
            } else if (error.response?.status === 403) {
                errorMessage = "You don't have permission to delete this lesson.";
            } else if (error.response?.status === 500) {
                errorMessage = "Server error occurred. Please try again later.";
            }
            
            Toast().fire({
                icon: "error",
                title: errorMessage,
            });
        }
    };

    /**
     * Reorder sections via drag and drop
     */
    const reorderSections = (startIndex, endIndex) => {
        if (startIndex === endIndex) return;

        const result = Array.from(variants);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);

        // Recalculate order numbers
        const reorderedVariants = result.map((variant, index) => ({
            ...variant,
            order: index
        }));

        setVariants(reorderedVariants);
        trackFormChanges();

        Toast().fire({
            icon: "success",
            title: "Section order updated!",
            timer: 1500
        });
    };

    /**
     * Reorder lessons within a section via drag and drop
     */
    const reorderLessons = (sectionIndex, startIndex, endIndex) => {
        if (startIndex === endIndex) return;

        const result = Array.from(variants);
        const lessons = Array.from(result[sectionIndex].items);
        const [removed] = lessons.splice(startIndex, 1);
        lessons.splice(endIndex, 0, removed);

        // Recalculate lesson order numbers
        const reorderedLessons = lessons.map((lesson, index) => ({
            ...lesson,
            order: index
        }));

        result[sectionIndex] = {
            ...result[sectionIndex],
            items: reorderedLessons
        };

        setVariants(result);
        trackFormChanges();

        Toast().fire({
            icon: "success",
            title: "Lesson order updated!",
            timer: 1500
        });
    };

    /**
     * Handle drag end event for lessons using @dnd-kit
     */
    const handleLessonDragEnd = (event, sectionIndex) => {
        const { active, over } = event;

        if (!over || active.id === over.id) {
            return;
        }

        const variant = variants[sectionIndex];
        const oldIndex = variant.items.findIndex(item => 
            `lesson-${item.variant_item_id || `${sectionIndex}-${variant.items.indexOf(item)}`}` === active.id
        );
        const newIndex = variant.items.findIndex(item => 
            `lesson-${item.variant_item_id || `${sectionIndex}-${variant.items.indexOf(item)}`}` === over.id
        );

        if (oldIndex !== -1 && newIndex !== -1) {
            reorderLessons(sectionIndex, oldIndex, newIndex);
        }
    };

    /**
     * Handle drag end event for sections using @dnd-kit
     */
    const handleSectionDragEnd = (event) => {
        const { active, over } = event;

        if (!over || active.id === over.id) {
            return;
        }

        const oldIndex = variants.findIndex(variant => 
            `section-${variant.variant_id || variants.indexOf(variant)}` === active.id
        );
        const newIndex = variants.findIndex(variant => 
            `section-${variant.variant_id || variants.indexOf(variant)}` === over.id
        );

        if (oldIndex !== -1 && newIndex !== -1) {
            reorderSections(oldIndex, newIndex);
        }
    };

    /**
     * Move section up in order
     */
    const moveSectionUp = (index) => {
        if (index === 0) return;
        reorderSections(index, index - 1);
    };

    /**
     * Move section down in order
     */
    const moveSectionDown = (index) => {
        if (index === variants.length - 1) return;
        reorderSections(index, index + 1);
    };

    /**
     * Move lesson up within section
     */
    const moveLessonUp = (sectionIndex, lessonIndex) => {
        if (lessonIndex === 0) return;
        reorderLessons(sectionIndex, lessonIndex, lessonIndex - 1);
    };

    /**
     * Move lesson down within section
     */
    const moveLessonDown = (sectionIndex, lessonIndex) => {
        if (lessonIndex === variants[sectionIndex].items.length - 1) return;
        reorderLessons(sectionIndex, lessonIndex, lessonIndex + 1);
    };

    /**
     * Handle form submission
     */

    /**
     * Handle form submission
     */
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Prevent double submission
        if (uiState.isSubmitting) return;

        setUiState(prev => ({ 
            ...prev, 
            submitStatus: SUBMIT_STATUS.SUBMITTING,
            submitMessage: 'Validating curriculum...',
            isSubmitting: true
        }));

        try {
            // Filter out completely blank sections and lessons before validation
            const nonEmptyVariants = variants.filter(variant => {
                // Keep section if it has a title or any non-empty lessons
                const hasTitle = variant.title && variant.title.trim().length > 0;
                const hasNonEmptyLessons = variant.items && variant.items.some(item => 
                    (item.title && item.title.trim().length > 0) || 
                    (item.description && item.description.trim().length > 0) || 
                    item.file ||
                    item.variant_item_id // Keep if it's already saved in database
                );
                return hasTitle || hasNonEmptyLessons || variant.variant_id; // Keep if already saved in database
            });

            // Filter out blank lessons from each section
            const cleanedVariants = nonEmptyVariants.map(variant => ({
                ...variant,
                items: variant.items.filter(item => 
                    (item.title && item.title.trim().length > 0) ||
                    (item.description && item.description.trim().length > 0) ||
                    item.file ||
                    item.variant_item_id // Keep if already saved in database
                )
            }));

            // Comprehensive validation on cleaned data
            let hasErrors = false;
            const newErrors = {};

            // Validate variants
            if (!cleanedVariants || cleanedVariants.length === 0) {
                newErrors.variants = 'Curriculum must have at least one section with content';
                hasErrors = true;
            } else {
                cleanedVariants.forEach((variant, variantIndex) => {
                    const variantValidation = validateVariant(variant, variantIndex);
                    if (Object.keys(variantValidation.errors).length > 0) {
                        Object.entries(variantValidation.errors).forEach(([key, error]) => {
                            newErrors[`variant_${variantIndex}_${key}`] = error;
                        });
                        hasErrors = true;
                    }

                    // Validate items within variant
                    if (variant.items && Array.isArray(variant.items) && variant.items.length > 0) {
                        variant.items.forEach((item, itemIndex) => {
                            const itemValidation = validateVariantItem(item, variantIndex, itemIndex);
                            if (Object.keys(itemValidation.errors).length > 0) {
                                Object.entries(itemValidation.errors).forEach(([key, error]) => {
                                    newErrors[`item_${variantIndex}_${itemIndex}_${key}`] = error;
                                });
                                hasErrors = true;
                            }
                        });
                    }
                });
            }

            if (hasErrors) {
                setValidationState(prev => ({ ...prev, errors: newErrors }));
                setUiState(prev => ({ 
                    ...prev, 
                    submitStatus: SUBMIT_STATUS.ERROR,
                    submitMessage: 'Please fix the validation errors below',
                    isSubmitting: false
                }));
                
                Toast().fire({
                    icon: "error",
                    title: "Validation Error",
                    text: "Please fix the validation errors before submitting.",
                });
                return;
            }

            setUiState(prev => ({ ...prev, submitMessage: 'Updating curriculum...' }));

            // Prepare form data
            const formData = new FormData();
            formData.append("title", course.title);
            formData.append("description", ckEditorData);
            formData.append("category", course.category);
            formData.append("language", course.language);
            formData.append("level", course.level);
            formData.append("price", course.price);
            formData.append("file", course.file);
            formData.append("teacher", UserData()?.teacher_id);

            if (course.image && typeof course.image !== "string") {
                formData.append("image", course.image);
            }

            // Process curriculum data in the format expected by backend
            // Use cleaned variants (without blank sections/lessons)
            cleanedVariants.forEach((variant, variantIndex) => {
                // Add variant (section) data
                formData.append(`variants[${variantIndex}][variant_title]`, variant.title || '');
                
                // ✅ Include order field to maintain section sequence
                formData.append(`variants[${variantIndex}][order]`, variant.order !== undefined ? variant.order : variantIndex);
                
                if (variant.variant_id) {
                    formData.append(`variants[${variantIndex}][variant_id]`, variant.variant_id);
                }

                // Add variant items (lessons) data
                if (variant.items && Array.isArray(variant.items)) {
                    variant.items.forEach((item, itemIndex) => {
                        formData.append(`variants[${variantIndex}][items][${itemIndex}][title]`, item.title || '');
                        formData.append(`variants[${variantIndex}][items][${itemIndex}][description]`, item.description || '');
                        formData.append(`variants[${variantIndex}][items][${itemIndex}][preview]`, item.preview || false);
                        
                        // ✅ Include order field to maintain lesson sequence
                        formData.append(`variants[${variantIndex}][items][${itemIndex}][order]`, item.order !== undefined ? item.order : itemIndex);
                        
                        // Handle file data
                        if (item.file) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][file]`, item.file);
                        }
                        
                        // Handle duration data for videos
                        if (item.duration_seconds) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][duration_seconds]`, item.duration_seconds);
                        }
                        
                        // Include variant_item_id for existing items
                        if (item.variant_item_id) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][variant_item_id]`, item.variant_item_id);
                        }
                    });
                }
            });

            // Submit to server
            const response = await useAxios.patch(`teacher/course-update/${UserData()?.teacher_id}/${param.course_id}/`, formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            // *** CRITICAL FIX: Use response data which now includes updated curriculum ***
            // Backend has been fixed to return refreshed data with curriculum
            
            if (!response || !response.data) {
                throw new Error('No response data received from server');
            }

            const updatedCourse = response.data;
            
            // Validate response has curriculum data
            if (!updatedCourse.curriculum || !Array.isArray(updatedCourse.curriculum)) {
                throw new Error('Server response missing curriculum data. Please refresh the page.');
            }
            
            // Update course state
            setCourse(updatedCourse);
            
            // Rebuild variants state with fresh IDs from backend
            const freshVariants = updatedCourse.curriculum.map(variant => {
                // Validate variant structure
                if (!variant || !variant.variant_items) {
                    return {
                        title: variant?.title || '',
                        variant_id: variant?.variant_id,
                        items: []
                    };
                }

                return {
                    title: variant.title || '',
                    variant_id: variant.variant_id,  // ← Fresh ID from backend
                    items: (variant.variant_items || []).map(item => ({
                        title: item.title || '',
                        description: item.description || '',
                        file: item.file || '',
                        preview: item.preview || false,
                        variant_item_id: item.variant_item_id,  // ← Fresh ID from backend
                        duration_seconds: item.duration_seconds,
                        duration_formatted: item.duration_formatted
                    }))
                };
            });
            
            setVariants(freshVariants);

            // Count what was actually saved
            const savedSectionsCount = freshVariants.length;
            const savedLessonsCount = freshVariants.reduce((total, variant) => 
                total + (variant.items?.length || 0), 0
            );
            const blankSectionsCount = variants.length - cleanedVariants.length;
            const blankLessonsCount = variants.reduce((total, variant) => 
                total + variant.items.length, 0
            ) - savedLessonsCount;

            // Create detailed success message
            let successDetails = `✅ Successfully saved:\n`;
            successDetails += `• ${savedSectionsCount} section${savedSectionsCount !== 1 ? 's' : ''}\n`;
            successDetails += `• ${savedLessonsCount} lesson${savedLessonsCount !== 1 ? 's' : ''}`;
            
            if (blankSectionsCount > 0 || blankLessonsCount > 0) {
                successDetails += `\n\n📝 Ignored (blank items):\n`;
                if (blankSectionsCount > 0) {
                    successDetails += `• ${blankSectionsCount} empty section${blankSectionsCount !== 1 ? 's' : ''}\n`;
                }
                if (blankLessonsCount > 0) {
                    successDetails += `• ${blankLessonsCount} empty lesson${blankLessonsCount !== 1 ? 's' : ''}`;
                }
            }

            setUiState(prev => ({ 
                ...prev, 
                submitStatus: SUBMIT_STATUS.SUCCESS,
                submitMessage: successDetails,
                isSubmitting: false,
                isDirty: false,
                hasUnsavedChanges: false,
                lastSaved: new Date(),
            }));

            Toast().fire({
                icon: "success",
                title: "Curriculum Updated!",
                html: successDetails.replace(/\n/g, '<br>'),
            });


        } catch (error) {
            console.error("Error updating course:", error);
            
            setUiState(prev => ({ 
                ...prev, 
                submitStatus: SUBMIT_STATUS.ERROR,
                submitMessage: error.response?.data?.message || 'Failed to update curriculum',
                isSubmitting: false
            }));

            Toast().fire({
                icon: "error",
                title: "Update Failed",
                text: error.response?.data?.message || "Failed to update course curriculum. Please try again.",
            });
        }
    };

    // Loading component for better UX
    if (uiState.loading) {
        return (
            <div
                className="curriculum-loading-content"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh', // Changed from 50vh to 100vh for full vertical centering
                    width: '100vw',     // Ensure it takes full width
                    position: 'fixed',  // Overlay on top of everything
                    top: 0,
                    left: 0,
                    zIndex: 9999,       // On top of other content
                    background: 'rgba(255,255,255,0.95)' // Optional: subtle overlay
                }}
            >
                <div
                    className="spinner-border text-primary"
                    role="status"
                    style={{
                        width: '3rem',
                        height: '3rem',
                        flexShrink: 0,
                        borderWidth: '0.25em',
                        marginBottom: '1rem'
                    }}
                >
                    <span className="visually-hidden">Loading...</span>
                </div>
                <p>Loading curriculum...</p>
            </div>
        );
    }

    return (
        <>
            <BaseHeader />
            <section className="course-edit-container">
                <div className="container">
                    <Header />
                    <div className="row mt-0 mt-md-4">
                        <Sidebar />
                        <div className="col-lg-9 col-md-8 col-12">
                            {/* Workflow Stepper */}
                            <WorkflowStepper 
                                currentStep={2} 
                                courseId={param?.course_id}
                                courseData={course}
                            />
                            
                            <div className="create-header-modern">
                                <div className="d-lg-flex align-items-center justify-content-between">
                                    <div className="mb-4 mb-lg-0">
                                        <h3 className="text-white mb-2 fw-bold">
                                            <i className="fas fa-list me-3"></i>
                                            Edit Course Curriculum
                                        </h3>

                                        <h3 className="text-white mb-2 fw-bold">
                                            {course?.title || 'Course Quiz Management'}
                                        </h3>

                                        <p className="mb-0 text-white opacity-90">
                                            Organize your course content into structured sections and engaging lessons
                                        </p>
                                    </div>
                                    <div className="d-flex flex-column gap-3">
                                        <Link 
                                            to={`/instructor/edit-course/${param?.course_id}/`} 
                                            className="btn btn-outline-light border border-2 border-light"
                                        >
                                            <i className="fas fa-arrow-left me-2"></i>
                                            Update Course
                                        </Link>
                                        <button
                                            type="button"
                                            className="btn btn-outline-light border border-2 border-light"
                                            onClick={addCurriculumSection}
                                            disabled={uiState.isSubmitting}
                                        >
                                            <i className="fas fa-plus me-2"></i>
                                            Add New Section
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Auto-save Status Bar */}
                            <div className="auto-save-status-bar" style={{
                                background: '#f8f9fa',
                                border: '1px solid #dee2e6',
                                borderRadius: '8px',
                                padding: '12px 20px',
                                marginBottom: '20px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                            }}>
                                <div className="d-flex align-items-center gap-3">
                                    {/* Auto-save indicator */}
                                    {uiState.autoSaving && (
                                        <div className="d-flex align-items-center text-primary">
                                            <div className="spinner-border spinner-border-sm me-2" role="status">
                                                <span className="visually-hidden">Auto-saving...</span>
                                            </div>
                                            <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                                                Auto-saving...
                                            </span>
                                        </div>
                                    )}
                                    
                                    {/* Unsaved changes indicator */}
                                    {!uiState.autoSaving && uiState.hasUnsavedChanges && (
                                        <div className="d-flex align-items-center text-warning">
                                            <i className="fas fa-exclamation-circle me-2"></i>
                                            <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                                                Unsaved changes (auto-save in {3} seconds)
                                            </span>
                                        </div>
                                    )}
                                    
                                    {/* Last saved timestamp */}
                                    {!uiState.autoSaving && !uiState.hasUnsavedChanges && uiState.lastSaved && (
                                        <div className="d-flex align-items-center text-success">
                                            <i className="fas fa-check-circle me-2"></i>
                                            <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                                                All changes saved
                                            </span>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Last saved timestamp - always visible when exists */}
                                {uiState.lastSaved && (
                                    <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                                        <i className="fas fa-clock me-1"></i>
                                        Last saved: {new Date(uiState.lastSaved).toLocaleTimeString('en-US', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            second: '2-digit',
                                            hour12: false
                                        })}
                                    </div>
                                )}
                                
                                {/* No saves yet */}
                                {!uiState.lastSaved && !uiState.hasUnsavedChanges && (
                                    <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                                        <i className="fas fa-info-circle me-1"></i>
                                        Changes will auto-save after 3 seconds
                                    </div>
                                )}
                            </div>

                            <form onSubmit={handleSubmit} className="form-body-modern" ref={formRef}>
                                {/* Submit Status Message */}
                                {uiState.submitMessage && (
                                    <div className={`status-message ${uiState.submitStatus}`} style={{
                                        background: uiState.submitStatus === 'success' ? '#d4edda' : 
                                                   uiState.submitStatus === 'error' ? '#f8d7da' : '#d1ecf1',
                                        border: `1px solid ${uiState.submitStatus === 'success' ? '#c3e6cb' : 
                                                              uiState.submitStatus === 'error' ? '#f5c6cb' : '#bee5eb'}`,
                                        color: uiState.submitStatus === 'success' ? '#155724' : 
                                               uiState.submitStatus === 'error' ? '#721c24' : '#0c5460',
                                        padding: '15px 20px',
                                        borderRadius: '8px',
                                        marginBottom: '20px'
                                    }}>
                                        <div className="d-flex align-items-start">
                                            <i className={`fas ${
                                                uiState.submitStatus === 'success' ? 'fa-check-circle' :
                                                uiState.submitStatus === 'error' ? 'fa-exclamation-circle' :
                                                'fa-info-circle'
                                            } me-2 mt-1`} style={{ fontSize: '1.2rem' }}></i>
                                            <div style={{ whiteSpace: 'pre-line', flex: 1 }}>
                                                {uiState.submitMessage}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Sections Container - Modern Drag and Drop with @dnd-kit */}
                                <div className="sections-container">
                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={handleSectionDragEnd}
                                    >
                                        <SortableContext
                                            items={variants.map((variant, idx) => 
                                                `section-${variant.variant_id || idx}`
                                            )}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            {variants.map((variant, variantIndex) => {
                                                const variantKey = `section-${variant.variant_id || variantIndex}`;
                                                
                                                return (
                                                    <SortableSection
                                                        key={variantKey}
                                                        id={variantKey}
                                                        variant={variant}
                                                        variantIndex={variantIndex}
                                                        variants={variants}
                                                        moveSectionUp={moveSectionUp}
                                                        moveSectionDown={moveSectionDown}
                                                        removeCurriculumSection={removeCurriculumSection}
                                                        handleSectionChange={handleSectionChange}
                                                        getValidationClass={getValidationClass}
                                                        validationState={validationState}
                                                        uiState={uiState}
                                                        collapsedSections={collapsedSections}
                                                        toggleSectionCollapse={toggleSectionCollapse}
                                                        addLesson={addLesson}
                                                    >
                                                        {/* Lessons Container */}
                                                        <div className="lessons-container">
                                                            <h6 className="lessons-header">
                                                                <i className="fas fa-book-reader me-2"></i>
                                                                Lessons
                                                            </h6>
                                                            
                                                            {/* Drag and Drop for Lessons */}
                                                            <DndContext
                                                                sensors={sensors}
                                                                collisionDetection={closestCenter}
                                                                onDragEnd={(event) => handleLessonDragEnd(event, variantIndex)}
                                                            >
                                                                <SortableContext
                                                                    items={variant?.items?.map((item, idx) => 
                                                                        `lesson-${item.variant_item_id || `${variantIndex}-${idx}`}`
                                                                    ) || []}
                                                                    strategy={verticalListSortingStrategy}
                                                                >
                                                                    <div style={{
                                                                        minHeight: '50px',
                                                                        padding: '8px',
                                                                        borderRadius: '8px'
                                                                    }}>
                                                                        {variant?.items?.map((item, itemIndex) => {
                                                                            const itemKey = `lesson-${item.variant_item_id || `${variantIndex}-${itemIndex}`}`;
                                                                            
                                                                            return (
                                                                                <SortableLessonItem
                                                                                    key={itemKey}
                                                                                    id={itemKey}
                                                                                    item={item}
                                                                                    itemIndex={itemIndex}
                                                                                    variantIndex={variantIndex}
                                                                                    variant={variant}
                                                                                    moveLessonUp={moveLessonUp}
                                                                                    moveLessonDown={moveLessonDown}
                                                                                    removeLesson={removeLesson}
                                                                                    handleLessonChange={handleLessonChange}
                                                                                    getValidationClass={getValidationClass}
                                                                                    validationState={validationState}
                                                                                    fileUploadStates={fileUploadStates}
                                                                                    getFileIcon={getFileIcon}
                                                                                    getFileTypeLabel={getFileTypeLabel}
                                                                                    getFileCategory={getFileCategory}
                                                                                    getFileName={getFileName}
                                                                                    uiState={uiState}
                                                                                />
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </SortableContext>
                                                            </DndContext>
                                                        </div>
                                                    </SortableSection>
                                                );
                                            })}
                                        </SortableContext>
                                    </DndContext>
                                </div>

                                <div className="d-flex justify-content-end mt-3 mb-3">
                                    <button
                                        type="button"
                                        className="btn btn-update-course"
                                        onClick={addCurriculumSection}
                                        disabled={uiState.isSubmitting}
                                    >
                                        <i className="fas fa-plus me-2"></i>
                                        Add New Section
                                    </button>
                                </div>

                                {/* Submit Section */}
                                <div className="form-section">
                                    {/* Info message about blank sections */}
                                    <div className="alert alert-info d-flex align-items-start mb-3">
                                        <i className="fas fa-info-circle mt-1 me-2"></i>
                                        <div>
                                            <strong>Note:</strong> Blank sections and lessons will be automatically ignored when you save. 
                                            You don't need to fill in or delete empty fields before updating.
                                        </div>
                                    </div>

                                    {/* Validation Summary */}
                                    {validationState.summary.errors.length > 0 && (
                                        <div className="validation-summary">
                                            <div className="validation-errors">
                                                <strong>
                                                    <i className="fas fa-exclamation-triangle me-2 text-danger"></i>
                                                    Please fix the following errors:
                                                </strong>
                                                <ul className="mt-2 mb-0">
                                                    {validationState.summary.errors.map((error, index) => (
                                                        <li key={index}>{error}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )}


                                    <div className="d-flex justify-content-end align-items-center gap-3">
                                        {/* Alert on the right, before the button */}
                                        {!uiState.isDirty && (
                                        <div
                                            className="alert alert-info mb-0 py-2 px-3"
                                            style={{ fontSize: "1rem" }}
                                        >
                                            <i className="fas fa-info-circle me-2"></i>
                                            Make changes to enable the save button
                                        </div>
                                        )}
                                        {/* Button on the far right */}
                                        <button
                                        type="submit"
                                        className={`btn btn-update-course btn-lg ${uiState.submitStatus}`}
                                        style={{ minHeight: "44px", paddingTop: "8px", paddingBottom: "8px" }}
                                        disabled={!uiState.isDirty || uiState.isSubmitting}
                                        ref={submitButtonRef}
                                        >
                                        {uiState.isSubmitting && (
                                            <div className="spinner-border spinner-border-sm me-2" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                            </div>
                                        )}
                                        <i className={`fas ${uiState.isSubmitting ? "fa-spinner fa-spin" : "fa-save"} me-2`}></i>
                                        {uiState.isSubmitting ? "Updating Curriculum..." : "Update Curriculum"}
                                        </button>
                                    </div>
                                </div>

                                
                            </form>

                        </div>
                    </div>
                </div>
            </section>
            <Footer />
        </>
    );
}

export default React.memo(CourseEditCurriculum);

