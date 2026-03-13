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
import MinimalLoader from "./Partials/MinimalLoader";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import WorkflowStepper from "../../components/WorkflowStepper";
import LessonCompletionQuestionEditor from "../../components/CourseEdit/LessonCompletionQuestionEditor"; // ✨ PHASE 4.143

// Utility imports
import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import { useInstructorSidebarCollapse } from "./Partials/useInstructorSidebarCollapse";
import { useDebouncedCallback } from "../../utils/useOptimization";  // ✨ PHASE 4.170: Auto-save utility

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
                    audioBitrate = 128001; // 128 Kbps audio
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
                            title="Seret untuk menata ulang bagian"
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
                                title="Pindahkan bagian ke atas"
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
                                title="Pindahkan bagian ke bawah"
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
                            Bagian {variantIndex + 1}
                        </div>
                        <h5 className="mb-0 section-title-text">
                            {variant?.title || "Bagian Tanpa Judul"}
                        </h5>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <span className="badge bg-light text-dark">
                            {variant?.items?.length || 0} Pelajaran
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
                                Hapus
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
                            Judul Bagian
                        </label>
                        <input
                            type="text"
                            className={`curriculum-form-control ${getValidationClass(
                                validationState.errors[`variant_${variantIndex}_title`],
                                validationState.warnings[`variant_${variantIndex}_title`]
                            )}`}
                            value={variant?.title || ""}
                            onChange={(e) => handleSectionChange(variantIndex, "title", e.target.value)}
                            placeholder="Misalnya, Pengenalan Pemrograman"
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
                            Tambah Pelajaran Baru
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
    uiState,
    durationEditingMode,
    toggleDurationEditMode,
    handleDurationInput,
    lessonMediaSource,
    getSelectedMediaSource,
    getMediaSourceForPreview,  // ✨ PHASE 4.192: Get actual saved media for preview only
    switchLessonMediaSource,
    extractYoutubeIdLesson,  // ✨ PHASE 4.173: Extract YouTube ID for preview
    validateYoutubeLessonUrl,  // ✨ PHASE 4.190: Validate YouTube URLs
    previewVisibility,  // ✨ PHASE 4.191: Preview visibility toggle state
    togglePreviewVisibility,  // ✨ PHASE 4.191: Toggle preview visibility
    course,
    curriculumUploadProgress,
    setCurriculumUploadProgress,
    autoSaveCurriculum,
    handleDeleteLessonFile, // ✨ PHASE 4.146: Pass delete handler to component
    lessonLinkInputs, // ✨ PHASE 4.175: Temporary link inputs state
    setLessonLinkInputs, // ✨ PHASE 4.175: Setter for temporary link inputs
    formatSecondsToHMS, // ✨ PHASE 4.198: Format seconds to hh:mm:ss
    extractedDuration, // ✨ PHASE 4.204: Extracted duration state for display
    setExtractedDuration // ✨ PHASE 4.204: Setter for extracted duration state
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
                            title="Seret untuk menata ulang pelajaran"
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
                                title="Pindahkan pelajaran ke atas"
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
                                title="Pindahkan pelajaran ke bawah"
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
                            Pelajaran {itemIndex + 1}
                        </span>
                        <h6 className="mb-0 lesson-title-preview">
                            {item?.title || "Pelajaran Tanpa Judul"}
                        </h6>
                    </div>
                    {variant.items.length > 1 && (
                        <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => removeLesson(variantIndex, itemIndex, variant?.variant_id, item?.variant_item_id)}
                            disabled={uiState.isSubmitting}
                        >
                            <i className="fas fa-times me-1"></i>
                            Hapus
                        </button>
                    )}
                </div>
            </div>

            <div className="curriculum-item-content-enhanced p-3">
                {/* Lesson Title - Full Width */}
                <div className="mb-3">
                    <label className="form-label fw-bold">
                        <i className="fas fa-heading me-2 text-primary"></i>
                        Judul Pelajaran
                    </label>
                    <input
                        type="text"
                        className={`curriculum-form-control ${getValidationClass(
                            validationState.errors[`item_${variantIndex}_${itemIndex}_title`],
                            validationState.warnings[`item_${variantIndex}_${itemIndex}_title`]
                        )}`}
                        value={item?.title || ""}
                        onChange={(e) => handleLessonChange(variantIndex, itemIndex, "title", e.target.value)}
                        placeholder="Misalnya: Pengenalan Variabel"
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
                    <div className="col-md-6">
                        <div className="mb-3">
                            <label className="form-label fw-bold">
                                <i className="fas fa-align-left me-2 text-primary"></i>
                                Deskripsi Pelajaran (Opsional)
                            </label>
                            <textarea
                                className={`curriculum-form-control ${getValidationClass(
                                    validationState.errors[`item_${variantIndex}_${itemIndex}_description`],
                                    validationState.warnings[`item_${variantIndex}_${itemIndex}_description`]
                                )}`}
                                value={item?.description || ""}
                                onChange={(e) => handleLessonChange(variantIndex, itemIndex, "description", e.target.value)}
                                rows="5"
                                placeholder="Jelaskan apa yang akan dipelajari siswa dalam pelajaran ini..."
                            />
                            {validationState.errors[`item_${variantIndex}_${itemIndex}_description`] && (
                                <div className="curriculum-invalid-feedback">
                                    {validationState.errors[`item_${variantIndex}_${itemIndex}_description`]}
                                </div>
                            )}
                        </div>

                        {/* ✨ PHASE 4.44: Duration Display and Edit Section - Above form-check */}
                        {/* ✨ PHASE 4.62: Support both Google Drive and YouTube links for duration display */}
                        {/* ✨ PHASE 4.110.1: Also show duration section for uploaded files */}
                        {(item?.gdriveLink || item?.youtubeLink || item?.uploadedFile) && (
                            <div className="mb-3 mt-3">
                                <div className="duration-display-section p-3 bg-light border rounded" style={{borderLeft: '4px solid #0d6efd'}}>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <label className="form-label mb-0 fw-bold">
                                                <i className="fas fa-clock me-2 text-info"></i>
                                                Durasi Video
                                            </label>
                                            <div className="mt-2">
                                                {item?.duration_formatted ? (
                                                    <div className="duration-badge d-inline-block">
                                                        <span className="badge bg-success" style={{fontSize: '0.95rem', padding: '0.5rem 0.75rem'}}>
                                                            <i className="fas fa-check-circle me-1"></i>
                                                            {item.duration_formatted}
                                                        </span>
                                                        {/* ✨ PHASE 4.205: Only show extracted duration text after extraction attempt */}
                                                        {extractedDuration[`${variantIndex}_${itemIndex}`] !== undefined && (
                                                            <small className="text-muted d-block mt-1">
                                                                Durasi terekstrak: {extractedDuration[`${variantIndex}_${itemIndex}`] ? formatSecondsToHMS(extractedDuration[`${variantIndex}_${itemIndex}`]) : '0:00:00'}
                                                            </small>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="duration-empty">
                                                        <span className="badge bg-secondary" style={{fontSize: '0.95rem', padding: '0.5rem 0.75rem'}}>
                                                            <i className="fas fa-clock me-1"></i>
                                                            00:00
                                                        </span>
                                                        <small className="text-muted d-block mt-1">
                                                            {/* ✨ PHASE 4.205: Show extracted duration only after extraction attempt, else show info text */}
                                                            {extractedDuration[`${variantIndex}_${itemIndex}`] !== undefined ? (
                                                                <>Durasi terekstrak: {formatSecondsToHMS(extractedDuration[`${variantIndex}_${itemIndex}`])}</>
                                                            ) : (
                                                                <><i className="fas fa-info-circle me-1"></i>Klik "Edit" untuk memasukkan durasi secara manual</>
                                                            )}
                                                        </small>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className={`btn ${durationEditingMode[`${variantIndex}_${itemIndex}`] ? 'btn-success duration-selesai-btn' : 'btn-primary'}`}
                                            onClick={() => toggleDurationEditMode(variantIndex, itemIndex)}
                                            disabled={uiState.isSubmitting}
                                        >
                                            <i className={`fas fa-${durationEditingMode[`${variantIndex}_${itemIndex}`] ? 'times' : 'edit'} me-2`}></i>
                                            {durationEditingMode[`${variantIndex}_${itemIndex}`] ? '✓ Selesai' : 'Edit'}
                                        </button>
                                    </div>

                                    {/* Duration Edit Form - ✨ PHASE 4.61: Enhanced with Hour/Minute/Second inputs */}
                                    {durationEditingMode[`${variantIndex}_${itemIndex}`] && (
                                        <div className="mt-3 pt-3" style={{borderTop: '1px solid #dee2e6'}}>
                                            <label className="form-label small fw-bold">
                                                Masukkan durasi video:
                                            </label>
                                            <div className="row g-2">
                                                {/* Hours Input */}
                                                <div className="col-4">
                                                    <div className="input-group input-group-sm">
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            placeholder="0"
                                                            value={item?.duration_seconds ? Math.floor(item.duration_seconds / 3600) : ''}
                                                            onChange={(e) => {
                                                                const hours = parseInt(e.target.value) || 0;
                                                                const currentMins = item?.duration_seconds ? Math.floor((item.duration_seconds % 3600) / 60) : 0;
                                                                const currentSecs = item?.duration_seconds ? Math.floor(item.duration_seconds % 60) : 0;
                                                                const totalSeconds = (hours * 3600) + (currentMins * 60) + currentSecs;
                                                                handleDurationInput(variantIndex, itemIndex, totalSeconds.toString());
                                                            }}
                                                            min="0"
                                                            max="23"
                                                            disabled={uiState.isSubmitting}
                                                        />
                                                        <span className="input-group-text text-muted small">jam</span>
                                                    </div>
                                                </div>
                                                {/* Minutes Input */}
                                                <div className="col-4">
                                                    <div className="input-group input-group-sm">
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            placeholder="0"
                                                            value={item?.duration_seconds ? Math.floor((item.duration_seconds % 3600) / 60) : ''}
                                                            onChange={(e) => {
                                                                const minutes = parseInt(e.target.value) || 0;
                                                                const currentHours = item?.duration_seconds ? Math.floor(item.duration_seconds / 3600) : 0;
                                                                const currentSecs = item?.duration_seconds ? Math.floor(item.duration_seconds % 60) : 0;
                                                                const totalSeconds = (currentHours * 3600) + (minutes * 60) + currentSecs;
                                                                handleDurationInput(variantIndex, itemIndex, totalSeconds.toString());
                                                            }}
                                                            min="0"
                                                            max="59"
                                                            disabled={uiState.isSubmitting}
                                                        />
                                                        <span className="input-group-text text-muted small">menit</span>
                                                    </div>
                                                </div>
                                                {/* Seconds Input */}
                                                <div className="col-4">
                                                    <div className="input-group input-group-sm">
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            placeholder="0"
                                                            value={item?.duration_seconds ? Math.floor(item.duration_seconds % 60) : ''}
                                                            onChange={(e) => {
                                                                const seconds = parseInt(e.target.value) || 0;
                                                                const currentHours = item?.duration_seconds ? Math.floor(item.duration_seconds / 3600) : 0;
                                                                const currentMins = item?.duration_seconds ? Math.floor((item.duration_seconds % 3600) / 60) : 0;
                                                                const totalSeconds = (currentHours * 3600) + (currentMins * 60) + seconds;
                                                                handleDurationInput(variantIndex, itemIndex, totalSeconds.toString());
                                                            }}
                                                            min="0"
                                                            max="59"
                                                            disabled={uiState.isSubmitting}
                                                        />
                                                        <span className="input-group-text text-muted small">detik</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <small className="text-muted d-block mt-2">
                                                <i className="fas fa-lightbulb me-1 text-warning"></i>
                                                Masukkan durasi video menggunakan jam, menit, dan detik. Sistem akan otomatis menghitung total durasi dan menampilkannya dalam format yang mudah dibaca.
                                            </small>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ✨ PHASE 4.70: Display duration validation error if present */}
                        {validationState.errors[`item_${variantIndex}_${itemIndex}_duration`] && (
                            <div className="curriculum-invalid-feedback mt-2">
                                <i className="fas fa-exclamation-circle me-1"></i>
                                {validationState.errors[`item_${variantIndex}_${itemIndex}_duration`]}
                            </div>
                        )}

                        <div className="form-check" style={{paddingLeft: 0, marginLeft: 0}}>
                            <input
                                type="checkbox"
                                className="form-check-input"
                                id={`preview-${variantIndex}-${itemIndex}`}
                                checked={item?.preview || false}
                                onChange={(e) => handleLessonChange(variantIndex, itemIndex, "preview", e.target.checked)}
                                style={{marginLeft: 0}}
                            />
                            <label className="form-check-label" htmlFor={`preview-${variantIndex}-${itemIndex}`} style={{paddingLeft: 0}}>
                                Izinkan Pratinjau (Siswa dapat melihat pelajaran ini sebelum mendaftar)
                            </label>
                        </div>

                    </div>

                    {/* Right Column: File Upload and Preview */}
                    <div className="col-md-6">
                        {/* ✨ PHASE 4.173: Video Preview Section - Shows currently selected media */}
                        {(item?.youtubeLink || item?.uploadedFile) && (
                            <div className="mb-4">
                                <div className="card border-info shadow-sm">
                                    <div className="card-header bg-info text-white d-flex align-items-center justify-content-between" style={{ cursor: 'pointer' }} onClick={() => togglePreviewVisibility(variantIndex, itemIndex)}>
                                        <div className="d-flex align-items-center">
                                            <i className="fas fa-play-circle me-2"></i>
                                            <strong>Pratinjau Video Pelajaran</strong>
                                        </div>
                                        <i className={`fas fa-chevron-${previewVisibility[`${variantIndex}_${itemIndex}`] ? 'up' : 'down'}`}></i>
                                    </div>
                                    {previewVisibility[`${variantIndex}_${itemIndex}`] === true && (
                                    <div className="card-body">
                                        {/* YouTube Preview */}
                                        {item?.youtubeLink && getMediaSourceForPreview(item) === 'youtube' && (
                                            <div className="ratio ratio-16x9 mb-2">
                                                <iframe
                                                    src={`https://www.youtube-nocookie.com/embed/${extractYoutubeIdLesson(item.youtubeLink) || ''}`}
                                                    title="YouTube video player"
                                                    frameBorder="0"
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                    allowFullScreen
                                                ></iframe>
                                            </div>
                                        )}
                                        
                                        {/* Uploaded File Preview */}
                                        {item?.uploadedFile && getMediaSourceForPreview(item) === 'upload' && (
                                            <div>
                                                <video 
                                                    width="100%" 
                                                    controls 
                                                    className="rounded"
                                                    style={{ maxHeight: '400px', backgroundColor: '#000' }}
                                                >
                                                    <source src={item.uploadedFile} type="video/mp4" />
                                                    <p>Browser Anda tidak mendukung putar video HTML5.</p>
                                                </video>
                                            </div>
                                        )}
                                    </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ✨ PHASE X.X: File Upload Section - Upload Only System */}
                        <div className="mb-3">
                            <label className="form-label fw-bold">
                                <i className="fas fa-cloud-upload-alt me-2 text-success"></i>
                                Unggah File Media Pelajaran
                            </label>
                            <div className="curriculum-file-upload-wrapper">
                                    <div className="input-group mb-2">
                                        <input
                                            type="file"
                                            className="form-control curriculum-form-control"
                                            accept="video/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    // Validate file
                                                    const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo'];
                                                    if (!validTypes.includes(file.type) && !file.type.startsWith('video/')) {
                                                        Toast().fire({
                                                            icon: "error",
                                                            title: "Tipe File Tidak Valid",
                                                            text: "Silakan unggah file video (MP4, WebM, OGV, MOV, AVI)",
                                                        });
                                                        return;
                                                    }

                                                    // Validate file size (500MB)
                                                    if (file.size > 500 * 1024 * 1024) {
                                                        Toast().fire({
                                                            icon: "error",
                                                            title: "File Terlalu Besar",
                                                            text: "Ukuran file maksimal 500MB. Ukuran file Anda: " + (file.size / 1024 / 1024).toFixed(2) + "MB",
                                                        });
                                                        return;
                                                    }

                                                // Handle file upload
                                                const formData = new FormData();
                                                formData.append("file", file);
                                                if (course?.course_id) {
                                                    formData.append("course_id", course.course_id);
                                                }
                                                // ✨ PHASE 4.107: Send upload type so backend knows this is curriculum media, not intro video
                                                formData.append("upload_type", "curriculum");
                                                // Send variant and item IDs for unique lesson naming
                                                if (variant?.variant_id) {
                                                    formData.append("variant_id", variant.variant_id);
                                                }
// ✨ PHASE 4.174: Use variant_item_id for more unique filename
                                                                                        // This ensures each lesson gets unique filename: {course_id}_{variant_id}_{variant_item_id}.mp4
                                                                                        if (item?.variant_item_id) {
                                                                                            formData.append("item_id", item.variant_item_id);
                                                                                        } else {
                                                                                            // Fallback to itemIndex if variant_item_id not yet assigned
                                                                                            formData.append("item_id", itemIndex + 1);
                                                                                        }

                                                // ✨ PHASE 4.108: Track upload progress with percentage
                                                const progressKey = `${variantIndex}_${itemIndex}`;
                                                setCurriculumUploadProgress(prev => ({
                                                    ...prev,
                                                    [progressKey]: { percentage: 0, isUploading: true }
                                                }));

                                                (async () => {
                                                    try {
                                                        const response = await useAxios.post("file-upload/", formData, {
                                                            headers: {
                                                                "Content-Type": "multipart/form-data",
                                                            },
                                                            onUploadProgress: (progressEvent) => {
                                                                // ✨ PHASE 4.108: Calculate and update progress percentage
                                                                const percentCompleted = Math.round(
                                                                    (progressEvent.loaded * 100) / progressEvent.total
                                                                );
                                                                setCurriculumUploadProgress(prev => ({
                                                                    ...prev,
                                                                    [progressKey]: { percentage: percentCompleted, isUploading: true }
                                                                }));
                                                            }
                                                        });

                                                        if (response?.data?.url) {
                                            // ✨ PHASE 4.193: Clear other media sources to prevent backend conflicts
                                            // When upload completes, clear YouTube and GDrive to avoid conflicting data
                                            handleLessonChange(variantIndex, itemIndex, "youtubeLink", "");
                                            handleLessonChange(variantIndex, itemIndex, "gdriveLink", "");
                                            handleLessonChange(variantIndex, itemIndex, "uploadedFile", response.data.url);
                                                            // ✨ PHASE 4.189: Set media_source to 'upload' so it updates in admin panel
                                                            handleLessonChange(variantIndex, itemIndex, "media_source", "upload");
                                                            
                                                            // ✨ PHASE 4.110.1: Extract video duration from upload response
                                                            // Backend uses VideoFileClip to extract duration and returns it
                                                            // ✨ PHASE 4.197: Call handleDurationInput to properly calculate duration_formatted
                                                            // ✨ PHASE 4.204: Also store in extractedDuration state
                                                            if (response.data.duration_seconds) {
                                                                const key = `${variantIndex}_${itemIndex}`;
                                                                // Store extracted duration
                                                                setExtractedDuration(prev => ({
                                                                    ...prev,
                                                                    [key]: response.data.duration_seconds
                                                                }));
                                                                // Also set as initial duration if not already set
                                                                handleDurationInput(variantIndex, itemIndex, response.data.duration_seconds);
                                                                console.log(`Duration extracted: ${response.data.video_duration} (${response.data.duration_seconds}s)`);
                                                            }
                                                            
                                                            // ✨ PHASE 4.108: Clear progress after successful upload
                                                            setCurriculumUploadProgress(prev => ({
                                                                ...prev,
                                                                [progressKey]: { percentage: 100, isUploading: false }
                                                            }));
                                                            // ✨ PHASE 4.110: Auto-save curriculum after file upload completes
                                                            // This ensures uploaded file is persisted even if user closes/reloads page
                                                            setTimeout(() => {
                                                                autoSaveCurriculum();
                                                            }, 100);
                                                            Toast().fire({
                                                                icon: "success",
                                                                title: "File Berhasil Diunggah",
                                                                text: response.data.video_duration 
                                                                    ? `File media pelajaran berhasil diunggah! Durasi: ${response.data.video_duration}`
                                                                    : "File media pelajaran berhasil diunggah!",
                                                                timer: 2000,
                                                                showConfirmButton: false
                                                            });
                                                            // Clear progress bar after a delay
                                                            setTimeout(() => {
                                                                setCurriculumUploadProgress(prev => {
                                                                    const updated = { ...prev };
                                                                    delete updated[progressKey];
                                                                    return updated;
                                                                });
                                                            }, 1000);
                                                        }
                                                    } catch (error) {
                                                        console.error("Error uploading file:", error);
                                                        // ✨ PHASE 4.108: Clear progress on error
                                                        setCurriculumUploadProgress(prev => {
                                                            const updated = { ...prev };
                                                            delete updated[progressKey];
                                                            return updated;
                                                        });
                                                        Toast().fire({
                                                            icon: "error",
                                                            title: "Unggahan Gagal",
                                                            text: error.response?.data?.message || "Gagal mengunggah file. Silakan coba lagi.",
                                                        });
                                                    }
                                                    // Reset file input
                                                    e.target.value = '';
                                                })();
                                            }
                                        }}
                                        id={`file-input-${variantIndex}-${itemIndex}`}
                                    />
                                    <label htmlFor={`file-input-${variantIndex}-${itemIndex}`} className="btn btn-success ms-2">
                                        <i className="fas fa-folder-open me-2"></i>
                                        Pilih File
                                    </label>
                                    </div>

                                    <small className="text-muted d-block mt-2">
                                        <i className="fas fa-info-circle me-1"></i>
                                        Format yang didukikan: <strong>MP4</strong>, <strong>WebM</strong>, <strong>OGV</strong>, <strong>MOV</strong>, <strong>AVI</strong>
                                    </small>
                                    <small className="text-muted d-block mt-1">
                                        <i className="fas fa-database me-1"></i>
                                        Ukuran maksimal: <strong>500MB</strong>. Durasi akan dihitung otomatis.
                                    </small>


                                </div>
                            </div>

                        {/* ✨ PHASE 4.108: Upload Progress Bar for Curriculum Media */}
                        {curriculumUploadProgress[`${variantIndex}_${itemIndex}`]?.isUploading && (
                            <div className="mt-3 mb-3">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <label className="form-label mb-0 fw-bold text-info">
                                        <i className="fas fa-spinner fa-spin me-2"></i>
                                        Mengunggah File...
                                    </label>
                                    <span className="badge bg-info">
                                        {curriculumUploadProgress[`${variantIndex}_${itemIndex}`]?.percentage || 0}%
                                    </span>
                                </div>
                                <div className="progress" style={{ height: '24px' }}>
                                    <div
                                        className="progress-bar progress-bar-striped progress-bar-animated bg-info"
                                        role="progressbar"
                                        style={{ 
                                            width: `${curriculumUploadProgress[`${variantIndex}_${itemIndex}`]?.percentage || 0}%`
                                        }}
                                        aria-valuenow={curriculumUploadProgress[`${variantIndex}_${itemIndex}`]?.percentage || 0}
                                        aria-valuemin="0"
                                        aria-valuemax="100"
                                    >
                                        <span className="d-flex align-items-center justify-content-center h-100 text-white fw-bold">
                                            {curriculumUploadProgress[`${variantIndex}_${itemIndex}`]?.percentage || 0}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                {/* ✨ PHASE 4.143: Lesson Completion Question Editor */}
                <LessonCompletionQuestionEditor 
                    variantItemId={item?.variant_item_id}
                    onQuestionSaved={(question) => {
                        // Refresh question data if needed
                        console.log('Question saved:', question);
                    }}
                />
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
    const isCollapsed = useInstructorSidebarCollapse();
    
    // Refs for form management
    const formRef = useRef(null);
    const submitButtonRef = useRef(null);
    // ✨ PHASE 4.177: Fetch guard to prevent duplicate course data loads
    const hasFetchedRef = useRef(false);

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
    
    // ✨ PHASE 4.170: Auto-save status tracking
    const [autoSaveStatus, setAutoSaveStatus] = useState("idle"); // idle, saving, saved, error
    const [lastAutoSaveTime, setLastAutoSaveTime] = useState(null); // Track last auto-save time

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

    // ✨ PHASE 4.44: Duration editing mode - track which items are in duration edit mode
    // Format: { 'variantIndex_itemIndex': true/false }
    const [durationEditingMode, setDurationEditingMode] = useState({});

    // ✨ PHASE 4.61: Media source selection for lesson items
    // Format: { 'variantIndex_itemIndex': 'google_drive' | 'youtube' }
    // Determines which input field to show (Google Drive or YouTube)
    const [lessonMediaSource, setLessonMediaSource] = useState({});

    // ✨ PHASE 4.108: Upload progress tracking for curriculum media
    // Format: { 'variantIndex_itemIndex': { percentage: 0-100, isUploading: boolean } }
    // Tracks upload progress for each lesson item to show progress bar
    const [curriculumUploadProgress, setCurriculumUploadProgress] = useState({});

    // ✨ PHASE 4.175: Temporary link inputs for YouTube/GDrive that don't auto-save
    // Format: { 'variantIndex_itemIndex_youtube': 'url', 'variantIndex_itemIndex_gdrive': 'url' }
    // Only updates actual item state when user clicks "Tambahkan" button
    const [lessonLinkInputs, setLessonLinkInputs] = useState({});

    // ✨ PHASE 4.191: Preview visibility toggle state for lesson items
    // Format: { 'variantIndex_itemIndex': true/false }
    // Tracks which lesson previews are visible/hidden
    const [previewVisibility, setPreviewVisibility] = useState({});

    // ✨ PHASE 4.204: Extracted duration state - separate from user-edited duration
    // Format: { 'variantIndex_itemIndex': duration_in_seconds }
    // Tracks AUTO-EXTRACTED duration from media (YouTube/GDrive/Upload)
    // This is SEPARATE from duration_seconds which is the user's SAVED/EDITED duration
    // Allows distinguishing between extracted (auto) vs saved (manual) durations
    const [extractedDuration, setExtractedDuration] = useState({});

    // Toggle preview visibility for a lesson item
    const togglePreviewVisibility = (variantIndex, itemIndex) => {
        const key = `${variantIndex}_${itemIndex}`;
        setPreviewVisibility(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    // Toggle section collapse/expand
    const toggleSectionCollapse = (variantIndex) => {
        setCollapsedSections(prev => ({
            ...prev,
            [variantIndex]: prev[variantIndex] === false ? true : false // ✅ FIX: Explicit boolean toggle
        }));
    };

    // Toggle duration edit mode for a lesson item
    const toggleDurationEditMode = (variantIndex, itemIndex) => {
        const key = `${variantIndex}_${itemIndex}`;
        const isCurrentlyEditing = durationEditingMode[key];
        
        // If exiting edit mode (clicking "Selesai"), show confirmation notification
        if (isCurrentlyEditing) {
            const item = variants[variantIndex]?.items?.[itemIndex];
            const formatted = item?.duration_formatted || 'Tidak ada';
            Toast().fire({
                icon: "success",
                title: "Durasi Disimpan",
                text: `Durasi: ${formatted}`,
                timer: 2000,
                showConfirmButton: false
            });
            
            // ✨ PHASE 4.70: Mark form as dirty when duration is saved
            // This enables the "Simpan Draf" button so user can save their changes
            setUiState(prev => ({
                ...prev,
                isDirty: true,
                hasUnsavedChanges: true
            }));
        }
        
        setDurationEditingMode(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    // ✨ PHASE 4.61: Get the selected media source for a lesson item
    // Determines which INPUT FIELD to show: 'google_drive', 'youtube', or 'upload'
    // This includes both user's UI selection and saved data from database
    const getSelectedMediaSource = (variantIndex, itemIndex, item) => {
        const key = `${variantIndex}_${itemIndex}`;
        
        // If already selected in session, return saved selection (user clicked a button)
        if (lessonMediaSource[key]) {
            return lessonMediaSource[key];
        }
        
        // ✨ PHASE 4.187: Check if media_source is saved in the item (from database)
        if (item?.media_source) {
            return item.media_source;
        }
        
        // If item has data, infer from existing links
        if (item?.uploadedFile && item.uploadedFile.trim()) {
            return 'upload';
        }
        if (item?.gdriveLink && item.gdriveLink.trim()) {
            return 'google_drive';
        }
        if (item?.youtubeLink && item.youtubeLink.trim()) {
            return 'youtube';
        }
        
        // Default to Google Drive if no selection made
        return 'google_drive';
    };

    // ✨ PHASE 4.192: Get media source for PREVIEW only
    // This function only returns what's ACTUALLY SAVED in the item, ignoring UI selection state
    // Preview should only update after successful "Tambahkan" button click or file upload
    // NOT when user just clicks a media source button
    const getMediaSourceForPreview = (item) => {
        // Only look at actual saved data, not the lessonMediaSource UI selection state
        if (item?.uploadedFile && item.uploadedFile.trim()) {
            return 'upload';
        }
        if (item?.youtubeLink && item.youtubeLink.trim()) {
            return 'youtube';
        }
        if (item?.gdriveLink && item.gdriveLink.trim()) {
            return 'google_drive';
        }
        
        // No saved media
        return null;
    };

    // ✨ PHASE 4.61: Switch media source (WITHOUT clearing other fields)
    // ✨ PHASE 4.110: Support upload file media source
    // ✨ PHASE 4.173: Don't clear values when switching - preserved like VideoUpload.jsx
    // Users can switch between sources and their URLs/files are preserved
    // ✨ PHASE 4.192: FIX - Don't clear or delete media when switching sources
    // Just update media_source field to control which input is displayed
    // ✨ PHASE 4.187: Save media_source to variant item state so it persists to database
    // ✨ PHASE 4.188: Don't trigger auto-save on media source selection - only on Tambahkan button click
    const switchLessonMediaSource = (variantIndex, itemIndex, newSource) => {
        const key = `${variantIndex}_${itemIndex}`;
        
        // ✨ PHASE 4.192: FIX - Only update the UI selection state, don't clear existing media
        // Users should be able to switch between sources and have all their data preserved
        // Only delete files when explicitly removing them via a delete button, not on source switch
        setLessonMediaSource(prev => ({
            ...prev,
            [key]: newSource
        }));
        
        // ✨ PHASE 4.187: Save media_source to the variant item state to track which source is selected
        // Don't clear any existing links/files - preserve all data for seamless switching
        setVariants(prevVariants => {
            const updated = JSON.parse(JSON.stringify(prevVariants));
            if (updated[variantIndex]?.items[itemIndex]) {
                // Only update media_source, preserve all links and files
                updated[variantIndex].items[itemIndex].media_source = newSource;
            }
            return updated;
        });
        
        // ✨ PHASE 4.188: Do NOT call trackFormChanges here - only trigger auto-save after Tambahkan button click
        // Switching sources alone is not a content change, just a UI preference
    };

    // ✨ PHASE 4.172: Extract YouTube video ID from various URL formats (matching VideoUpload pattern)
    const extractYoutubeIdLesson = (url) => {
        if (!url) return null;
        const regexps = [
            /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,  // https://www.youtube.com/watch?v=ID
            /youtu\.be\/([a-zA-Z0-9_-]{11})/,               // https://youtu.be/ID
            /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,     // https://www.youtube.com/embed/ID
            /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,         // https://www.youtube.com/v/ID
            /^([a-zA-Z0-9_-]{11})$/                         // Just the ID
        ];
        
        for (const regexp of regexps) {
            const match = url.match(regexp);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
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

    // ✨ PHASE 4.198: Format seconds to hh:mm:ss format
    const formatSecondsToHMS = (seconds) => {
        if (!seconds || isNaN(seconds)) return '0:00:00';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    // ✨ PHASE 4.172: Validate YouTube URL format
    const validateYoutubeLessonUrl = (url) => {
        if (!url.trim()) {
            return { isValid: false, error: "URL YouTube diperlukan" };
        }

        const videoId = extractYoutubeIdLesson(url);
        if (!videoId) {
            return { 
                isValid: false, 
                error: "URL YouTube tidak valid. Gunakan format: https://youtube.com/watch?v=ID atau https://youtu.be/ID" 
            };
        }

        return { isValid: true, videoId };
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
            variantErrors.title = `Judul bagian harus minimal ${VALIDATION_RULES.VARIANT_TITLE_MIN_LENGTH} karakter`;
        } else if (variant.title.trim().length > VALIDATION_RULES.VARIANT_TITLE_MAX_LENGTH) {
            variantWarnings.title = 'Judul bagian cukup panjang. Pertimbangkan untuk mempersingkatnya.';
        }

        if (!variant.items || variant.items.length === 0) {
            variantErrors.items = 'Bagian harus memiliki setidaknya satu pelajaran';
        }

        return { errors: variantErrors, warnings: variantWarnings };
    };

    const validateVariantItem = (item, variantIndex, itemIndex) => {
        const itemErrors = {};
        const itemWarnings = {};

        // Safety check
        if (!item) return { errors: itemErrors, warnings: itemWarnings };

        if (!item.title || item.title.trim().length < VALIDATION_RULES.ITEM_TITLE_MIN_LENGTH) {
            itemErrors.title = `Judul pelajaran harus minimal ${VALIDATION_RULES.ITEM_TITLE_MIN_LENGTH} karakter`;
        } else if (item.title.trim().length > VALIDATION_RULES.ITEM_TITLE_MAX_LENGTH) {
            itemWarnings.title = 'Judul pelajaran cukup panjang. Pertimbangkan untuk mempersingkatnya.';
        }

        // Description is now optional - only validate if provided
        if (item.description && item.description.trim().length > 0) {
            if (item.description.trim().length < VALIDATION_RULES.ITEM_DESCRIPTION_MIN_LENGTH) {
                itemWarnings.description = `Deskripsi sedikit pendek. Pertimbangkan untuk menambahkan lebih banyak detail (minimal ${VALIDATION_RULES.ITEM_DESCRIPTION_MIN_LENGTH} karakter disarankan).`;
            } else if (item.description.trim().length > VALIDATION_RULES.ITEM_DESCRIPTION_MAX_LENGTH) {
                itemWarnings.description = 'Deskripsi pelajaran cukup panjang. Pertimbangkan untuk mempersingkatnya.';
            }
        }

        // ✨ PHASE 4.110: Validate media sources - accept Google Drive, YouTube, or Uploaded File
        const hasGoogleDriveLink = item.gdriveLink && item.gdriveLink.trim().length > 0;
        const hasYouTubeLink = item.youtubeLink && item.youtubeLink.trim().length > 0;
        const hasUploadedFile = item.uploadedFile && item.uploadedFile.trim().length > 0;
        const hasValidLink = hasGoogleDriveLink || hasYouTubeLink || hasUploadedFile;
        const isExistingItem = item.variant_item_id || item.id;
        
        if (!hasValidLink && !isExistingItem) {
            itemErrors.mediaLink = 'Silakan tambahkan link media pelajaran (Google Drive, YouTube, atau Upload File)';
        } else if (hasGoogleDriveLink && !item.gdriveLink.includes('drive.google.com') && !item.gdriveLink.includes('drive.usercontent.google.com')) {
            // Validate Google Drive format - only if Google Drive is explicitly selected
            itemErrors.gdriveLink = 'Link Google Drive harus dari drive.google.com';
        } else if (hasYouTubeLink && !item.youtubeLink.includes('youtube.com') && !item.youtubeLink.includes('youtu.be')) {
            // ✨ PHASE 4.73: Validate YouTube format - only if YouTube is explicitly selected
            itemErrors.youtubeLink = 'Link YouTube harus dari youtube.com atau youtu.be';
        }

        // ✨ PHASE 4.110.1: Validate duration for all media types
        // Duration is automatically extracted from uploaded videos by the backend
        // Duration must be set and greater than 0 for all media (Google Drive, YouTube, or Uploaded Files)
        if (hasGoogleDriveLink || hasYouTubeLink || hasUploadedFile) {
            const durationSeconds = item.duration_seconds || 0;
            if (!durationSeconds || durationSeconds === 0) {
                itemErrors.duration = 'Durasi video harus diisi (tidak boleh 0m 0s). Durasi diekstraksi otomatis saat mengunggah file, atau gunakan tombol "Edit" untuk memasukkan durasi manual.';
            }
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
                allErrors.push(`Bagian ${variantIndex + 1}: ${Object.values(variantValidation.errors).join(', ')}`);
            }
            if (Object.keys(variantValidation.warnings).length > 0) {
                allWarnings.push(`Bagian ${variantIndex + 1}: ${Object.values(variantValidation.warnings).join(', ')}`);
            }

            if (variant.items && Array.isArray(variant.items)) {
                variant.items.forEach((item, itemIndex) => {
                    if (!item) return; // Skip if item is null/undefined
                    
                    const itemValidation = validateVariantItem(item, variantIndex, itemIndex);
                    
                    if (Object.keys(itemValidation.errors).length > 0) {
                        allErrors.push(`Bagian ${variantIndex + 1}, Pelajaran ${itemIndex + 1}: ${Object.values(itemValidation.errors).join(', ')}`);
                    }
                    if (Object.keys(itemValidation.warnings).length > 0) {
                        allWarnings.push(`Bagian ${variantIndex + 1}, Pelajaran ${itemIndex + 1}: ${Object.values(itemValidation.warnings).join(', ')}`);
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

    // Track form changes for dirty state
    const trackFormChanges = useCallback(() => {
        setUiState(prev => ({ 
            ...prev, 
            isDirty: true,
            hasUnsavedChanges: true 
        }));
    }, []);

    // ✨ PHASE 4.170: Auto-save debounce ref for preventing excessive saves
    const autoSaveTimeoutRef = useRef(null);

    // Warning before leaving page with unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (uiState.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = 'Anda memiliki perubahan yang belum disimpan. Apakah Anda yakin ingin pergi?';
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
            
            // ✨ PHASE 4.177: Only fetch categories if not already loaded
            // Skip if category is already populated to avoid duplicate API calls
            if (!category || category.length === 0) {
                const categoriesResponse = await useAxios.get(`course/category/`);
                setCategory(categoriesResponse.data);
            }

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
                    items: sortedItems.map((item, itemIndex) => {
                        // ✨ PHASE 4.110: Detect media source type on initial load
                        // Support three types: YouTube links, Uploaded files (/media/*), and Google Drive links
                        const fileUrl = item.file || '';
                        const isYouTubeLink = fileUrl.includes('youtube.com') || fileUrl.includes('youtu.be');
                        const isUploadedFile = fileUrl.includes('/media/') || 
                                             /\.(mp4|webm|ogg|avi|mov|mkv)(\?|$)/i.test(fileUrl); // Check for video extensions
                        
                        return {
                            title: item.title || "",
                            description: item.description || "",
                            gdriveLink: !isYouTubeLink && !isUploadedFile ? fileUrl : '',  // Store Google Drive links
                            youtubeLink: isYouTubeLink ? fileUrl : '',  // Store YouTube URLs
                            uploadedFile: isUploadedFile ? fileUrl : '',  // ✨ PHASE 4.110: Store uploaded file URLs
                            preview: item.preview || false,
                            variant_item_id: item.variant_item_id || item.id, // Preserve variant_item_id
                            order: item.order !== undefined ? item.order : itemIndex, // ✅ Preserve lesson order
                            duration_seconds: item.duration_seconds || null, // ✨ PHASE 4.43.9: Preserve duration_seconds from backend
                            duration_formatted: item.content_duration || null, // ✨ PHASE 4.43.9: Also preserve formatted duration for display
                            // ✨ PHASE 4.187: Load saved media_source from backend to remember user's source selection
                            media_source: item.media_source || null
                        };
                    })
                };
            }) : [
                {
                    title: "",
                    order: 0,
                    items: [{ title: "", description: "", youtubeLink: "", preview: false, order: 0, duration_seconds: null, duration_formatted: null, media_source: 'upload' }],
                }
            ];
            
            setVariants(formattedVariants);
            
            // ✨ PHASE 4.205: DO NOT initialize extractedDuration on first load
            // extractedDuration should remain empty until user performs extraction
            // Only populate it when YouTube/GDrive link or file upload extraction is attempted
            // This keeps "Durasi terekstrak" text hidden on first load as intended
            
            // ✨ PHASE 4.73: Clear lessonMediaSource state when variants are reloaded
            // This ensures media source is re-detected from item data on next render
            setLessonMediaSource({});
            
            setCKEditorData(courseResponse.data.description || "");
            
        } catch (error) {
            console.error("Error fetching course details:", error);
            
            Toast().fire({
                icon: "error",
                title: "Gagal memuat detail kursus",
                text: error.response?.data?.message || "Silakan coba menyegarkan halaman.",
            });
            
            // Set default values on error
            setVariants([
                {
                    title: "",
                    items: [{ title: "", description: "", youtubeLink: "", preview: false }],
                },
            ]);
            
        } finally {
            setUiState(prev => ({ ...prev, loading: false }));
        }
    };

    // Load course data on mount
    useEffect(() => {
        // ✨ PHASE 4.177: Skip if course data is already loaded (prevents duplicate fetches in React Strict Mode)
        // Checking course.id ensures we don't re-fetch when component remounts with existing data
        if (course?.id) return;
        
        // Guard against duplicate course data loads in React Strict Mode
        if (hasFetchedRef.current) return;
        hasFetchedRef.current = true;
        
        fetchCourseDetail();
    }, [course?.id]);

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
            return { isValid: false, error: `Silakan pilih file ${type} yang valid` };
        }

        if (file.size > config.maxSize) {
            const maxSizeMB = Math.round(config.maxSize / (1024 * 1024));
            return { isValid: false, error: `Ukuran file harus kurang dari ${maxSizeMB}MB` };
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

            const response = await useAxios.post("file-upload/", formData, {
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
                    title: "Gambar berhasil diunggah!",
                });
                
                trackFormChanges();
            }
        } catch (error) {
            console.error("Error uploading image:", error);
            setValidationState(prev => ({
                ...prev,
                errors: {
                    ...prev.errors,
                    image: 'Gagal mengunggah gambar. Silakan coba lagi.'
                }
            }));
            Toast().fire({
                icon: "error",
                title: "Gagal mengunggah gambar. Silakan coba lagi.",
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
                title: "Bagian tidak valid. Silakan segarkan halaman.",
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
                title: "Parameter pelajaran tidak valid. Silakan segarkan halaman.",
            });
            return;
        }

        // Validate variants array and indices
        if (!variants || !Array.isArray(variants) || variantIndex < 0 || variantIndex >= variants.length) {
            Toast().fire({
                icon: "error",
                title: "Bagian tidak valid. Silakan segarkan halaman.",
            });
            return;
        }

        const currentVariant = variants[variantIndex];
        if (!currentVariant || !currentVariant.items || !Array.isArray(currentVariant.items) || 
            itemIndex < 0 || itemIndex >= currentVariant.items.length) {
            Toast().fire({
                icon: "error",
                title: "Pelajaran tidak valid. Silakan segarkan halaman.",
            });
            return;
        }

        // Handle all property changes (including gdriveLink)
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

        trackFormChanges();

        // Clear validation errors for this item
        setValidationState(prev => ({
            ...prev,
            errors: {
                ...prev.errors,
                [`item_${variantIndex}_${itemIndex}_${propertyName}`]: null
            }
        }));
        
        // ✨ PHASE 4.65: Extract video duration with smart fallback strategy
        // YouTube: Use yt-dlp (100% reliable)
        if ((propertyName === 'youtubeLink') && value && value.trim()) {
            const linkStr = value.trim();
            const isYouTube = linkStr.includes('youtube.com') || linkStr.includes('youtu.be');
            
            if (isYouTube) {
                // Attempt auto-extraction for YouTube
                
                if (isYouTube) {
                    console.log(`[Curriculum] YouTube detected - attempting duration extraction: ${linkStr}`);
                }
                
                // For YouTube, attempt extraction
                if (isYouTube) {
                    try {
                        // ✨ PHASE 4.62: Fixed API path - use relative path without v1/ (already in baseURL)
                        const response = await useAxios.post('media/video-metadata/', {
                            url: linkStr
                        });
                        
                        if (response.data && response.data.duration_seconds && !response.data.error) {
                            console.log(`[Curriculum] Extraction success: ${response.data.duration_seconds}s (${response.data.duration_formatted})`);
                            
                            // ✨ PHASE 4.204: Store extracted duration SEPARATELY from user-edited duration
                            // Only store in extractedDuration state to show in small text
                            // Don't overwrite item duration if user has already set it
                            const key = `${variantIndex}_${itemIndex}`;
                            setExtractedDuration(prev => ({
                                ...prev,
                                [key]: response.data.duration_seconds
                            }));
                            
                            // ✨ PHASE 4.254: ALWAYS update duration when extraction succeeds for current media source
                            // When user adds/updates YouTube or GDrive link, the newly extracted duration should
                            // automatically replace any previous duration from other media sources
                            // This ensures the badge shows the current media's duration, not stale values
                            setVariants(prevVariants => {
                                const updated = [...prevVariants];
                                if (updated[variantIndex] && updated[variantIndex].items && updated[variantIndex].items[itemIndex]) {
                                    const item = updated[variantIndex].items[itemIndex];
                                    // ✨ PHASE 4.254: Always set extracted duration - this ensures the badge updates
                                    // Don't check if duration was previously set. If we're successfully extracting,
                                    // we want the new extracted value to be displayed in the badge
                                    item.duration_seconds = response.data.duration_seconds;
                                    item.duration_formatted = response.data.duration_formatted;
                                }
                                return updated;
                            });
                            
                            Toast().fire({
                                icon: "success",
                                title: "Durasi Berhasil Diekstrak",
                                text: `Durasi: ${response.data.duration_formatted}`,
                                timer: 2500,
                                showConfirmButton: false
                            });
                        } else if (response.data && response.data.error) {
                            console.warn(`[Curriculum] Extraction failed: ${response.data.error}`);
                            // ✨ PHASE 4.204: Set fallback extracted duration when extraction fails
                            const key = `${variantIndex}_${itemIndex}`;
                            setExtractedDuration(prev => ({
                                ...prev,
                                [key]: 0  // 0 means extraction failed, show default 00:00
                            }));
                            
                            Toast().fire({
                                icon: "warning",
                                title: "Gagal Mengekstrak Durasi",
                                text: `${response.data.error}. Silakan set durasi secara manual.`,
                                timer: 3000,
                                showConfirmButton: false
                            });
                        }
                    } catch (error) {
                        console.error('[Curriculum] Duration extraction error:', error);
                        // ✨ PHASE 4.204: Set fallback extracted duration when extraction throws error
                        const key = `${variantIndex}_${itemIndex}`;
                        setExtractedDuration(prev => ({
                            ...prev,
                            [key]: 0  // 0 means extraction failed, show default 00:00
                        }));
                        
                        Toast().fire({
                            icon: "warning",
                            title: "Kesalahan Ekstraksi",
                            text: "Tidak dapat mengekstrak durasi. Silakan set secara manual menggunakan tombol Edit.",
                            timer: 3000,
                            showConfirmButton: false
                        });
                    }
                }
            }
        }
    };

    /**
     * ✨ PHASE 4.44: Handle manual duration input
     * Allows users to manually set duration if auto-extraction fails or for local files
     * Converts user input (seconds) to formatted string (e.g., "1m 44s")
     */
    const handleDurationInput = (variantIndex, itemIndex, durationSeconds) => {
        try {
            const seconds = parseFloat(durationSeconds);
            
            if (isNaN(seconds) || seconds < 0) {
                // Invalid input - just store the raw value
                setVariants(prevVariants => {
                    const updated = [...prevVariants];
                    if (updated[variantIndex]?.items?.[itemIndex]) {
                        updated[variantIndex].items[itemIndex].duration_seconds = null;
                        updated[variantIndex].items[itemIndex].duration_formatted = null;
                    }
                    return updated;
                });
                return;
            }

            // Convert seconds to formatted duration (e.g., "1m 44s")
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);
            
            let formatted = '';
            if (hours > 0) formatted += `${hours}h `;
            if (minutes > 0 || hours > 0) formatted += `${minutes}m `;
            if (secs > 0 || (hours === 0 && minutes === 0)) formatted += `${secs}s`;
            formatted = formatted.trim();

            setVariants(prevVariants => {
                const updated = [...prevVariants];
                if (updated[variantIndex]?.items?.[itemIndex]) {
                    updated[variantIndex].items[itemIndex].duration_seconds = seconds;
                    updated[variantIndex].items[itemIndex].duration_formatted = formatted;
                }
                return updated;
            });
            
            // ✨ PHASE 4.70: Removed Toast notification on every input change for better UX
            // Notification will only show when user clicks "Selesai" button

        } catch (error) {
            console.error('[Curriculum] Error setting duration:', error);
            Toast().fire({
                icon: "error",
                title: "Error mengatur durasi",
                text: "Silakan masukkan angka yang valid (detik)"
            });
        }
    };

    /**
     * ✨ PHASE 4.146: Delete uploaded lesson file from server
     * When instructor clicks "Hapus File", this function:
     * 1. Sends DELETE request to backend to delete physical file
     * 2. Then clears the uploadedFile field in state
     * 3. ✨ PHASE 4.167: Auto-saves curriculum to persist changes to database
     */
    const handleDeleteLessonFile = async (variantIndex, itemIndex, fileUrl) => {
        if (!fileUrl) {
            // No file to delete, just clear the state
            handleLessonChange(variantIndex, itemIndex, "uploadedFile", "");
            return;
        }

        try {
            // Call backend to delete the actual file
            // ✨ PHASE 4.146: Use singleton useAxios with relative path
            await useAxios.delete('file-cleanup/', {
                data: { file_url: fileUrl }
            });
            
            console.log('[Curriculum] File deleted successfully:', fileUrl);
            
            // ✨ PHASE 4.167: Clear state and immediately auto-save with updated variants
            // Update variants directly to clear the uploadedFile field
            setVariants(prevVariants => {
                try {
                    const updatedVariants = [...prevVariants];
                    
                    // Validate indices
                    if (!updatedVariants[variantIndex] || 
                        !updatedVariants[variantIndex].items || 
                        !updatedVariants[variantIndex].items[itemIndex]) {
                        return prevVariants;
                    }

                    const currentItem = updatedVariants[variantIndex].items[itemIndex];
                    updatedVariants[variantIndex].items[itemIndex] = {
                        ...currentItem,
                        uploadedFile: ""  // Clear the file reference
                    };
                    
                    // Auto-save immediately with the updated variants
                    // Schedule after state update completes
                    setTimeout(() => {
                        autoSaveCurriculum();
                    }, 50);
                    
                    return updatedVariants;
                } catch (error) {
                    console.error('[Curriculum] Error clearing file:', error);
                    return prevVariants;
                }
            });

            trackFormChanges();

            // Clear validation errors for this item
            setValidationState(prev => ({
                ...prev,
                errors: {
                    ...prev.errors,
                    [`item_${variantIndex}_${itemIndex}_uploadedFile`]: null
                }
            }));
            
            Toast().fire({
                icon: "success",
                title: "File berhasil dihapus",
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('[Curriculum] Error deleting file:', error);
            
            // Still clear the state even if delete fails (file might not exist on server)
            setVariants(prevVariants => {
                try {
                    const updatedVariants = [...prevVariants];
                    
                    if (!updatedVariants[variantIndex] || 
                        !updatedVariants[variantIndex].items || 
                        !updatedVariants[variantIndex].items[itemIndex]) {
                        return prevVariants;
                    }

                    const currentItem = updatedVariants[variantIndex].items[itemIndex];
                    updatedVariants[variantIndex].items[itemIndex] = {
                        ...currentItem,
                        uploadedFile: ""
                    };
                    
                    return updatedVariants;
                } catch (err) {
                    console.error('[Curriculum] Error in fallback clear:', err);
                    return prevVariants;
                }
            });

            Toast().fire({
                icon: "warning",
                title: "File dihapus dari formulir",
                text: "Catatan: File fisik mungkin tidak berhasil dihapus dari server",
                timer: 3000
            });
        }
    };

    /**
     * DEPRECATED: handleFileUpload no longer used
     * Google Drive links are now used directly via gdriveLink property
     * This function is kept for reference but is not called
     */
    const handleFileUpload = async (file, variantIndex, itemIndex, propertyName) => {
        // File uploads no longer needed - using Google Drive links instead
        Toast().fire({
            icon: "info",
            title: "Gunakan link Google Drive untuk file pelajaran",
            text: "Silakan masukkan link Google Drive share Anda di bidang yang disediakan"
        });
        return false;
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
                        gdriveLink: "",  // ✅ Use gdriveLink instead of file
                        youtubeLink: "",  // ✨ PHASE 4.61: Initialize youtubeLink for new items
                        preview: false,
                        order: 0, // ✅ Assign order to new lesson
                        duration_seconds: null,  // ✨ PHASE 4.43.9: Initialize duration_seconds for new items
                        duration_formatted: null  // ✨ PHASE 4.44: Initialize duration_formatted for new items
                    }],
                },
            ];
        });
        trackFormChanges();
        
        Toast().fire({
            icon: "success",
            title: "Bagian baru berhasil ditambahkan!",
        });
    };

    /**
     * Remove a curriculum section (variant) and all its lessons
     */
    const removeCurriculumSection = async (index, variantId) => {
        // Confirm deletion
        const result = await Swal.fire({
            title: 'Apakah Anda yakin?',
            text: "Anda tidak akan dapat memulihkan bagian ini!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Ya, hapus!'
        });

        if (!result.isConfirmed) return;

        try {
            // If it's a saved section (has variantId), delete from backend
            if (variantId) {
                await useAxios.delete(`teacher/course/variant-delete/${variantId}/${UserData()?.teacher_id}/${param.course_id}/`);
                
                Toast().fire({
                    icon: "success",
                    title: "Bagian berhasil dihapus dari database",
                });
            } else {
                // If it's a new unsaved section, just show success message
                Toast().fire({
                    icon: "success",
                    title: "Bagian berhasil dihapus",
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
            
            let errorMessage = "Gagal menghapus bagian. Silakan coba lagi.";
            if (error.response?.data?.detail) {
                errorMessage = error.response.data.detail;
            } else if (error.response?.status === 404) {
                errorMessage = "Bagian tidak ditemukan atau sudah dihapus.";
            } else if (error.response?.status === 403) {
                errorMessage = "Anda tidak memiliki izin untuk menghapus bagian ini.";
            } else if (error.response?.status === 500) {
                errorMessage = "Kesalahan server terjadi. Silakan coba lagi nanti.";
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
            gdriveLink: "",  // ✅ Use gdriveLink instead of file
            youtubeLink: "",  // ✨ PHASE 4.61: Initialize youtubeLink for new items
            preview: false,
            order: newOrder, // ✅ Assign order to new lesson
            duration_seconds: null,  // ✨ PHASE 4.43.9: Initialize duration_seconds for new items
            duration_formatted: null,  // ✨ PHASE 4.44: Initialize duration_formatted for new items
            media_source: 'upload'  // Default to upload for new items
        });

        setVariants(updatedVariants);
        trackFormChanges();

        Toast().fire({
            icon: "success",
            title: "Pelajaran baru berhasil ditambahkan!",
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
            title: 'Apakah Anda yakin?',
            text: "Anda tidak akan dapat memulihkan pelajaran ini!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Ya, hapus!'
        });

        if (!result.isConfirmed) return;

        try {
            // If it's a saved lesson (has itemId), delete from backend
            if (itemId) {
                await useAxios.delete(`teacher/course/variant-item-delete/${variantId}/${itemId}/${UserData()?.teacher_id}/${param.course_id}/`);
                
                Toast().fire({
                    icon: "success",
                    title: "Pelajaran berhasil dihapus dari database",
                });
            } else {
                // If it's a new unsaved lesson, just show success message
                Toast().fire({
                    icon: "success",
                    title: "Pelajaran berhasil dihapus",
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
            
            let errorMessage = "Gagal menghapus pelajaran. Silakan coba lagi.";
            if (error.response?.data?.detail) {
                errorMessage = error.response.data.detail;
            } else if (error.response?.status === 404) {
                errorMessage = "Pelajaran tidak ditemukan atau sudah dihapus.";
            } else if (error.response?.status === 403) {
                errorMessage = "Anda tidak memiliki izin untuk menghapus pelajaran ini.";
            } else if (error.response?.status === 500) {
                errorMessage = "Kesalahan server terjadi. Silakan coba lagi nanti.";
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
            title: "Urutan bagian diperbarui!",
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
            title: "Urutan pelajaran diperbarui!",
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
     * ✨ PHASE 4.110: Auto-save curriculum after file upload
     * Saves curriculum without validation to preserve uploaded file reference
     * Called automatically after successful file upload to prevent data loss on page reload
     */
    const autoSaveCurriculum = async () => {
        try {
            // Filter out completely blank sections and lessons
            const nonEmptyVariants = variants.filter(variant => {
                const hasTitle = variant.title && variant.title.trim().length > 0;
                const hasNonEmptyLessons = variant.items && variant.items.some(item => 
                    (item.title && item.title.trim().length > 0) || 
                    (item.description && item.description.trim().length > 0) || 
                    item.gdriveLink ||
                    item.youtubeLink ||
                    item.uploadedFile ||
                    item.variant_item_id
                );
                return hasTitle || hasNonEmptyLessons || variant.variant_id;
            });

            const cleanedVariants = nonEmptyVariants.map(variant => ({
                ...variant,
                items: variant.items.filter(item => 
                    (item.title && item.title.trim().length > 0) ||
                    (item.description && item.description.trim().length > 0) ||
                    item.gdriveLink ||
                    item.youtubeLink ||
                    item.uploadedFile ||
                    item.variant_item_id
                )
            }));

            // Skip save if no variants
            if (!cleanedVariants || cleanedVariants.length === 0) {
                return;
            }

            console.log("[AutoSave] Saving curriculum after file upload...");

            // Prepare form data (same as handleSubmit)
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

            // Add curriculum data
            cleanedVariants.forEach((variant, variantIndex) => {
                formData.append(`variants[${variantIndex}][variant_title]`, variant.title || '');
                formData.append(`variants[${variantIndex}][order]`, variant.order !== undefined ? variant.order : variantIndex);
                
                if (variant.variant_id) {
                    formData.append(`variants[${variantIndex}][variant_id]`, variant.variant_id);
                }

                if (variant.items && Array.isArray(variant.items)) {
                    variant.items.forEach((item, itemIndex) => {
                        formData.append(`variants[${variantIndex}][items][${itemIndex}][title]`, item.title || '');
                        formData.append(`variants[${variantIndex}][items][${itemIndex}][description]`, item.description || '');
                        formData.append(`variants[${variantIndex}][items][${itemIndex}][preview]`, item.preview || false);
                        formData.append(`variants[${variantIndex}][items][${itemIndex}][order]`, item.order !== undefined ? item.order : itemIndex);
                        
                        // ✨ PHASE 4.195: FIX - Only append ONE media source to prevent FormData conflicts
                        // Priority: youtube_link > gdriveLink > uploadedFile
                        // This ensures backend only receives ONE file/link per item
                        if (item.youtubeLink) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][youtube_link]`, item.youtubeLink);
                        } else if (item.gdriveLink) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][file]`, item.gdriveLink);
                        } else if (item.uploadedFile) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][file]`, item.uploadedFile);
                        }
                        
                        // ✨ PHASE 4.187: Send media_source to remember which source was used
                        if (item.media_source) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][media_source]`, item.media_source);
                        }
                        if (item.duration_seconds) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][duration_seconds]`, item.duration_seconds);
                        }
                        if (item.variant_item_id) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][variant_item_id]`, item.variant_item_id);
                        }
                    });
                }
            });

            // Submit without awaiting to avoid blocking UI
            // ✨ PHASE 4.110: Auto-save silently in background
            // ✨ PHASE 4.196: Removed duplicate Toast notification - performAutoSave() already shows "Kurikulum Tersimpan" at top-end
            useAxios.patch(`teacher/course-update/${UserData()?.teacher_id}/${param.course_id}/`, formData)
                .then(response => {
                    console.log("[AutoSave] ✅ Curriculum auto-saved successfully");
                })
                .catch(error => {
                    console.warn("[AutoSave] ⚠️ Auto-save failed:", error);
                });
        } catch (error) {
            console.warn("[AutoSave] Error preparing curriculum data:", error);
            // ✨ PHASE 4.196: Silent auto-save - no Toast to avoid duplicates with performAutoSave()
        }
    };

    /**
     * Handle form submission
     */
    const performAutoSave = async () => {
        if (!uiState.isDirty || autoSaveStatus === "saving") return;
        
        setAutoSaveStatus("saving");
        
        try {
            // Filter out completely blank sections and lessons
            const nonEmptyVariants = variants.filter(variant => {
                const hasTitle = variant.title && variant.title.trim().length > 0;
                const hasNonEmptyLessons = variant.items && variant.items.some(item => 
                    (item.title && item.title.trim().length > 0) || 
                    (item.description && item.description.trim().length > 0) || 
                    item.gdriveLink ||
                    item.youtubeLink ||
                    item.uploadedFile ||
                    item.variant_item_id
                );
                return hasTitle || hasNonEmptyLessons || variant.variant_id;
            });

            const cleanedVariants = nonEmptyVariants.map(variant => ({
                ...variant,
                items: variant.items.filter(item => 
                    (item.title && item.title.trim().length > 0) ||
                    (item.description && item.description.trim().length > 0) ||
                    item.gdriveLink ||
                    item.youtubeLink ||
                    item.uploadedFile ||
                    item.variant_item_id
                )
            }));

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

            cleanedVariants.forEach((variant, variantIndex) => {
                formData.append(`variants[${variantIndex}][variant_title]`, variant.title || '');
                formData.append(`variants[${variantIndex}][order]`, variant.order !== undefined ? variant.order : variantIndex);
                if (variant.variant_id) {
                    formData.append(`variants[${variantIndex}][variant_id]`, variant.variant_id);
                }

                if (variant.items && Array.isArray(variant.items)) {
                    variant.items.forEach((item, itemIndex) => {
                        formData.append(`variants[${variantIndex}][items][${itemIndex}][title]`, item.title || '');
                        formData.append(`variants[${variantIndex}][items][${itemIndex}][description]`, item.description || '');
                        formData.append(`variants[${variantIndex}][items][${itemIndex}][preview]`, item.preview || false);
                        formData.append(`variants[${variantIndex}][items][${itemIndex}][order]`, item.order !== undefined ? item.order : itemIndex);
                        
                        // ✨ PHASE 4.195: FIX - Only append ONE media source to prevent FormData conflicts
                        // Priority: youtube_link > gdriveLink > uploadedFile
                        // This ensures backend only receives ONE file/link per item
                        if (item.youtubeLink) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][youtube_link]`, item.youtubeLink);
                        } else if (item.gdriveLink) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][file]`, item.gdriveLink);
                        } else if (item.uploadedFile) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][file]`, item.uploadedFile);
                        }
                        
                        // ✨ PHASE 4.187: Send media_source to remember which source was used
                        if (item.media_source) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][media_source]`, item.media_source);
                        }
                        if (item.duration_seconds) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][duration_seconds]`, item.duration_seconds);
                        }
                        if (item.variant_item_id) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][variant_item_id]`, item.variant_item_id);
                        }
                    });
                }
            });

            await useAxios.patch(`teacher/course-update/${UserData()?.teacher_id}/${param.course_id}/`, formData);
            
            setAutoSaveStatus("saved");
            setLastAutoSaveTime(new Date());
            setUiState(prev => ({
                ...prev,
                isDirty: false,
                hasUnsavedChanges: false
            }));
            
            // ✨ PHASE 4.186: Show Toast notification when auto-save completes
            Toast().fire({
                icon: "success",
                title: "Kurikulum Tersimpan",
                text: "Perubahan kurikulum telah disimpan otomatis",
                timer: 1500,
                showConfirmButton: false,
                position: "top-end"
            });
            
            setTimeout(() => {
                setAutoSaveStatus("idle");
            }, 2000);
        } catch (error) {
            console.error("[AutoSave] Error:", error);
            setAutoSaveStatus("error");
            
            // ✨ PHASE 4.186: Show error notification on auto-save failure
            Toast().fire({
                icon: "error",
                title: "Gagal Menyimpan",
                text: "Terjadi kesalahan saat menyimpan kurikulum. Sistem akan mencoba lagi.",
                timer: 2000,
                position: "top-end"
            });
            
            setTimeout(() => {
                if (uiState.isDirty) {
                    performAutoSave();
                }
            }, 5000);
        }
    };
    
    // ✨ PHASE 4.170: Debounced auto-save with 2-second delay
    const debouncedAutoSave = useDebouncedCallback(performAutoSave, 2000, [uiState.isDirty, variants, course, ckEditorData]);
    
    // ✨ PHASE 4.170: Trigger auto-save when isDirty changes
    useEffect(() => {
        if (uiState.isDirty && autoSaveStatus !== "saving") {
            debouncedAutoSave();
        }
    }, [uiState.isDirty, autoSaveStatus, debouncedAutoSave]);

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
            submitMessage: 'Memvalidasi kurikulum...',
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
                    item.gdriveLink ||
                    item.youtubeLink ||  // ✨ PHASE 4.73: Include YouTube links
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
                    item.gdriveLink ||
                    item.youtubeLink ||  // ✨ PHASE 4.73: Include YouTube links
                    item.variant_item_id // Keep if already saved in database
                )
            }));

            // Comprehensive validation on cleaned data
            let hasErrors = false;
            const newErrors = {};

            // Validate variants
            if (!cleanedVariants || cleanedVariants.length === 0) {
                newErrors.variants = 'Kurikulum harus memiliki setidaknya satu bagian dengan konten';
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
                    submitMessage: 'Silakan perbaiki kesalahan validasi di bawah',
                    isSubmitting: false
                }));
                
                Toast().fire({
                    icon: "error",
                    title: "Kesalahan Validasi",
                    text: "Silakan perbaiki kesalahan validasi sebelum mengirim.",
                });
                return;
            }

            setUiState(prev => ({ ...prev, submitMessage: 'Menyimpan draf...' }));

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
                        
                        // Handle Google Drive link
                        if (item.gdriveLink) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][file]`, item.gdriveLink);
                        }
                        
                        // ✨ PHASE 4.61: Handle YouTube link (alternative media link)
                        if (item.youtubeLink) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][youtube_link]`, item.youtubeLink);
                        }
                        
                        // ✨ PHASE 4.187: Send media_source to remember which source was used
                        if (item.media_source) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][media_source]`, item.media_source);
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

            // ✅ DEBUG: Log FormData contents before submission to verify curriculum data is being sent
            console.log("=== CURRICULUM SUBMIT DEBUG ===");
            console.log("FormData entries:", Array.from(formData.entries()).map(([key, value]) => {
                // Log keys and simplified values (avoid logging large objects)
                return [key, typeof value === 'string' ? value.slice(0, 100) : `[${typeof value}]`];
            }));
            console.log("Cleaned variants count:", cleanedVariants.length);
            console.log("Cleaned variants structure:", JSON.stringify(cleanedVariants.map(v => ({
                title: v.title,
                variant_id: v.variant_id,
                itemCount: v.items?.length || 0,
                items: v.items?.map(i => ({ title: i.title, variant_item_id: i.variant_item_id })) || []
            })), null, 2));
            console.log("=== END DEBUG ===");

            // Submit to server
            // NOTE: DO NOT set Content-Type header when using FormData!
            // Axios automatically detects FormData and sets the correct multipart/form-data header with boundary
            // Manually setting it breaks the boundary parameter that the server needs
            const response = await useAxios.patch(`teacher/course-update/${UserData()?.teacher_id}/${param.course_id}/`, formData);

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
                // ✨ PHASE 4.70: Check BOTH variant.variant_items and variant.items
                // Backend serializer provides both fields, use whichever has data
                const variantItemsList = (variant.variant_items && variant.variant_items.length > 0) 
                    ? variant.variant_items 
                    : (variant.items || []);
                
                // Validate variant structure
                if (!variant || !variantItemsList || variantItemsList.length === 0) {
                    return {
                        title: variant?.title || '',
                        variant_id: variant?.variant_id,
                        order: variant?.order || 0,
                        items: []
                    };
                }

                return {
                    title: variant.title || '',
                    variant_id: variant.variant_id,  // ← Fresh ID from backend
                    order: variant.order !== undefined ? variant.order : 0,  // ← Fresh order from backend
                    items: variantItemsList.map(item => {
                        // ✨ PHASE 4.142: Detect media type on fresh load - Support YouTube, Uploaded, and Google Drive
                        const fileUrl = item.file || '';
                        const isYouTubeLink = fileUrl.includes('youtube.com') || fileUrl.includes('youtu.be');
                        const isUploadedFile = fileUrl.includes('/media/') || 
                                             /\.(mp4|webm|ogg|avi|mov|mkv)(\?|$)/i.test(fileUrl); // Check for video extensions
                        
                        return {
                            title: item.title || '',
                            description: item.description || '',
                            gdriveLink: !isYouTubeLink && !isUploadedFile ? fileUrl : '',  // Store only Google Drive links
                            youtubeLink: isYouTubeLink ? fileUrl : '',  // Store YouTube URLs as youtubeLink
                            uploadedFile: isUploadedFile ? fileUrl : '',  // ✨ PHASE 4.142: Store uploaded file URLs
                            preview: item.preview || false,
                            variant_item_id: item.variant_item_id,  // ← Fresh ID from backend
                            order: item.order !== undefined ? item.order : 0,  // ← Fresh order from backend
                            duration_seconds: item.duration_seconds,  // ✨ PHASE 4.43.9: Store duration in seconds
                            duration_formatted: item.content_duration,  // Store formatted duration for potential display
                            // ✨ PHASE 4.187: Load saved media_source from backend to remember user's source selection
                            media_source: item.media_source || null
                        };
                    })
                };
            });
            
            setVariants(freshVariants);
            
            // ✨ PHASE 4.73: Clear lessonMediaSource state after save
            // This ensures media source is re-detected from refreshed item data
            setLessonMediaSource({});

            // Count what was actually saved
            const savedSectionsCount = freshVariants.length;
            const savedLessonsCount = freshVariants.reduce((total, variant) => 
                total + (variant.items?.length || 0), 0
            );
            const blankSectionsCount = variants.length - cleanedVariants.length;
            const blankLessonsCount = variants.reduce((total, variant) => 
                total + variant.items.length, 0
            ) - savedLessonsCount;

            // ✨ PHASE 4.43.11: Handle status change when published course curriculum is updated
            const statusChanged = updatedCourse?.platform_status === "Review" && course?.platform_status === "Published";

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

            // ✨ PHASE 4.70: Only show save confirmation on curriculum page
            // Do NOT auto-request admin review here - that should only happen from Edit Course page
            // Admin review request belongs on the main course edit page, not curriculum
            Toast().fire({
                icon: "success",
                title: "Kurikulum Disimpan!",
                html: successDetails.replace(/\n/g, '<br>'),
                timer: 4000,
                timerProgressBar: true,
                showConfirmButton: false
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
                title: "Penyimpanan Gagal",
                text: error.response?.data?.message || "Gagal menyimpan draf kurikulum. Silakan coba lagi.",
            });
        }
    };

    // Show full-page loading spinner on initial load
    if (uiState.loading && !course.title) {
        return (
            <>
                <BaseHeader />
                <section className="instructor-course-edit-curriculum-page" style={{ display: 'flex', alignItems: 'center' }}>
                    <div className="container" style={{ flex: 1 }}>
                        <Header />
                        <div className="row">
                            <Sidebar />
                            <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                                <div className="text-center">
                                    <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
                                        <span className="visually-hidden">Memuat...</span>
                                    </div>
                                    <p className="mt-3 text-muted">Memuat Kurikulum...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                <Footer />
            </>
        );
    }

    return (
        <>
            <BaseHeader />
            <section className="instructor-course-edit-curriculum-page">
                <div className="container">
                    <Header />
                    <div className="row">
                        <Sidebar />
                        <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>
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
                                            Edit Kurikulum Kursus
                                        </h3>

                                        <h3 className="text-white mb-2 fw-bold">
                                            {course?.title || 'Manajemen Kuis Kursus'}
                                        </h3>

                                        <p className="mb-0 text-white opacity-90">
                                            Atur konten kursus Anda ke dalam bagian terstruktur dan pelajaran yang menarik
                                        </p>
                                    </div>
                                    <div className="d-flex flex-column gap-3">
                                        <Link 
                                            to={`/instructor/edit-course/${param?.course_id}/`} 
                                            className="btn btn-outline-light border border-2 border-light"
                                        >
                                            <i className="fas fa-arrow-left me-2"></i>
                                            Perbarui Kursus
                                        </Link>
                                        <button
                                            type="button"
                                            className="btn btn-outline-light border border-2 border-light"
                                            onClick={addCurriculumSection}
                                            disabled={uiState.isSubmitting}
                                        >
                                            <i className="fas fa-plus me-2"></i>
                                            Tambah Bagian Baru
                                        </button>
                                    </div>
                                </div>
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
                                                                Pelajaran
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
                                                                                    durationEditingMode={durationEditingMode}
                                                                                    toggleDurationEditMode={toggleDurationEditMode}
                                                                                    handleDurationInput={handleDurationInput}
                                                                                    lessonMediaSource={lessonMediaSource}
                                                                                    getSelectedMediaSource={getSelectedMediaSource}
                                                                                    getMediaSourceForPreview={getMediaSourceForPreview}  // ✨ PHASE 4.192: Get actual saved media for preview
                                                                                    switchLessonMediaSource={switchLessonMediaSource}
                                                                                    extractYoutubeIdLesson={extractYoutubeIdLesson}  // ✨ PHASE 4.173: Extract YouTube ID for preview
                                                                                    validateYoutubeLessonUrl={validateYoutubeLessonUrl}  // ✨ PHASE 4.190: Validate YouTube URLs
                                                                                    previewVisibility={previewVisibility}  // ✨ PHASE 4.191: Preview visibility toggle
                                                                                    togglePreviewVisibility={togglePreviewVisibility}  // ✨ PHASE 4.191: Toggle preview
                                                                                    course={course}
                                                                                    curriculumUploadProgress={curriculumUploadProgress}
                                                                                    setCurriculumUploadProgress={setCurriculumUploadProgress}
                                                                                    autoSaveCurriculum={autoSaveCurriculum}
                                                                                    handleDeleteLessonFile={handleDeleteLessonFile}  // ✨ PHASE 4.146: Pass delete handler
                                                                                    lessonLinkInputs={lessonLinkInputs}  // ✨ PHASE 4.175: Temporary link inputs
                                                                                    setLessonLinkInputs={setLessonLinkInputs}  // ✨ PHASE 4.175: Setter for temp link inputs
                                                                                    formatSecondsToHMS={formatSecondsToHMS}  // ✨ PHASE 4.198: Format seconds to hh:mm:ss
                                                                                    extractedDuration={extractedDuration}  // ✨ PHASE 4.204: Extracted duration state
                                                                                    setExtractedDuration={setExtractedDuration}  // ✨ PHASE 4.204: Setter for extracted duration
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
                                        Tambah Bagian Baru
                                    </button>
                                </div>

                                {/* Submit Section */}
                                <div className="form-section">
                                    {/* Info message about blank sections */}
                                    <div className="alert alert-info d-flex align-items-start mb-3">
                                        <i className="fas fa-info-circle mt-1 me-2"></i>
                                        <div>
                                            <strong>Catatan:</strong> Bagian dan pelajaran kosong akan secara otomatis diabaikan saat Anda menyimpan. 
                                            Anda tidak perlu mengisi atau menghapus bidang kosong sebelum memperbarui.
                                        </div>
                                    </div>

                                    {/* ✨ PHASE 4.170: Auto-save status and action buttons */}
                                    <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3">
                                        {/* Auto-save status info on the left */}
                                        <div className="form-status-info">
                                            {autoSaveStatus === "saving" && (
                                                <div className="text-info small">
                                                    <div className="spinner-border spinner-border-sm me-1" style={{ width: '14px', height: '14px', display: 'inline-block' }}></div>
                                                    Menyimpan kurikulum...
                                                </div>
                                            )}
                                            {autoSaveStatus === "saved" && (
                                                <div className="text-success small">
                                                    <i className="fas fa-check-circle me-1"></i>
                                                    Kurikulum tersimpan
                                                    {lastAutoSaveTime && (
                                                        <span className="ms-1 text-muted">
                                                            pada {lastAutoSaveTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            {autoSaveStatus === "error" && (
                                                <div className="text-danger small">
                                                    <i className="fas fa-exclamation-circle me-1"></i>
                                                    Gagal menyimpan, akan dicoba lagi...
                                                </div>
                                            )}
                                            {autoSaveStatus === "idle" && !uiState.isDirty && (
                                                <div className="text-muted small">
                                                    <i className="fas fa-save me-1"></i>
                                                    Semua perubahan tersimpan
                                                </div>
                                            )}
                                        </div>

                                        {/* Validation Summary */}
                                        {validationState.summary.errors.length > 0 && (
                                            <div className="validation-summary">
                                                <div className="validation-errors">
                                                    <strong>
                                                        <i className="fas fa-exclamation-triangle me-2 text-danger"></i>
                                                        Silakan perbaiki kesalahan berikut:
                                                    </strong>
                                                    <ul className="mt-2 mb-0">
                                                        {validationState.summary.errors.map((error, index) => (
                                                            <li key={index}>{error}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        )}
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

