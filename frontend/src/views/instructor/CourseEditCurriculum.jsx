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
import PptxRenderer from "../../components/Common/PptxRenderer";
import PdfRenderer from "../../components/Common/PdfRenderer";

// Utility imports
import useAxios from "../../utils/useAxios";
import apiInstance from "../../utils/axios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import { useInstructorSidebarCollapse } from "./Partials/useInstructorSidebarCollapse";
import { useDebouncedCallback } from "../../utils/useOptimization";  // ✨ PHASE 4.170: Auto-save utility
import { getMediaUrl } from "../../utils/constants";

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
 * PresentationPreview - Dedicated Real PPT/PPTX Viewer on bright mode.
 */
const PresentationPreview = ({ fileUrl }) => {
    if (!fileUrl) return null;

    // Google Slides embed support
    if (fileUrl.includes('docs.google.com/presentation')) {
        let embedUrl = fileUrl;
        if (embedUrl.includes('/edit') || embedUrl.includes('/view')) {
            embedUrl = embedUrl.replace(/\/(edit|view).*$/, '/embed?start=false&loop=false&delayms=3000');
        } else if (!embedUrl.endsWith('/embed')) {
            embedUrl = embedUrl.replace(/\/$/, '') + '/embed';
        }
        return (
            <div className="ratio ratio-16x9 rounded overflow-hidden shadow-xs border bg-white" style={{ minHeight: "360px" }}>
                <iframe
                    src={embedUrl}
                    title="Google Slides Presentation"
                    allowFullScreen
                    style={{ border: 0 }}
                ></iframe>
            </div>
        );
    }

    return (
        <PptxRenderer
            fileUrl={fileUrl}
            height="440px"
            showThumbnails={true}
            showToolbar={true}
        />
    );
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
     * Get audio duration
     */
    getAudioDuration: (file) => {
        return new Promise((resolve, reject) => {
            const audio = document.createElement('audio');
            audio.preload = 'metadata';

            audio.onloadedmetadata = () => {
                window.URL.revokeObjectURL(audio.src);
                resolve(audio.duration);
            };

            audio.onerror = () => {
                reject(new Error('Failed to load audio metadata'));
            };

            audio.src = URL.createObjectURL(file);
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
                    targetWidth = Math.floor(originalWidth * 0);
                    targetHeight = Math.floor(originalHeight * 0);
                    quality = FILE_UPLOAD_CONFIG.COMPRESSION_QUALITY_LOW;
                    bitrate = 500000; // 500 Kbps video
                    audioBitrate = 64000; // 64 Kbps audio
                } else if (sizeRatio > 1) {
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
                    bitrate = 1500000; // 1 Mbps video
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
    addScormLesson,
    addQuiz,
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
        marginBottom: '1rem',
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
                    <div className="mb-2">
                        <label className="form-label fw-semibold small text-dark d-flex align-items-center gap-1 mb-1">
                            <i className="fas fa-heading text-teal small"></i>
                            <span>Judul Bagian</span>
                            <span className="text-danger">*</span>
                        </label>
                        <input
                            type="text"
                            className={`curriculum-form-control ${getValidationClass(
                                validationState.errors[`variant_${variantIndex}_title`],
                                validationState.warnings[`variant_${variantIndex}_title`]
                            )}`}
                            value={variant?.title || ""}
                            onChange={(e) => handleSectionChange(variantIndex, "title", e.target.value)}
                            placeholder="Misalnya: Pengenalan dan Konsep Dasar"
                        />
                        {validationState.errors[`variant_${variantIndex}_title`] && (
                            <div className="curriculum-invalid-feedback">
                                {validationState.errors[`variant_${variantIndex}_title`]}
                            </div>
                        )}
                    </div>

                    {/* Lessons Container */}
                    {children}

                    <div className="text-start mt-4 pt-2 d-flex align-items-center flex-wrap gap-2">
                        <button
                            type="button"
                            className="btn btn-teal btn-sm px-3 py-1 fw-semibold d-inline-flex align-items-center shadow-sm"
                            style={{ gap: "8px" }}
                            onClick={() => addLesson(variantIndex)}
                            disabled={uiState.isSubmitting}
                        >
                            <i className="fas fa-plus small"></i>
                            <span>Tambah Pelajaran Baru</span>
                        </button>
                        <button
                            type="button"
                            className="btn btn-outline-teal btn-sm px-3 py-1 fw-semibold d-inline-flex align-items-center shadow-sm"
                            style={{ gap: "8px" }}
                            onClick={() => addScormLesson && addScormLesson(variantIndex)}
                            disabled={uiState.isSubmitting}
                            title="Tambah materi pembelajaran interaktif SCORM 1.2"
                        >
                            <i className="fas fa-cube text-teal small"></i>
                            <span>Tambah Modul SCORM</span>
                        </button>
                        <button
                            type="button"
                            className="btn btn-outline-warning btn-sm px-3 py-1 fw-semibold d-inline-flex align-items-center shadow-sm"
                            style={{ gap: "8px" }}
                            onClick={() => addQuiz && addQuiz(variantIndex)}
                            disabled={uiState.isSubmitting}
                        >
                            <i className="fas fa-clipboard-check small"></i>
                            <span>Sisipkan Kuis</span>
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
    variants,
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
    handleClearLessonMedia,
    lessonLinkInputs, // ✨ PHASE 4.175: Temporary link inputs state
    setLessonLinkInputs, // ✨ PHASE 4.175: Setter for temporary link inputs
    formatSecondsToHMS, // ✨ PHASE 4.198: Format seconds to hh:mm:ss
    extractedDuration, // ✨ PHASE 4.204: Extracted duration state for display
    setExtractedDuration, // ✨ PHASE 4.204: Setter for extracted duration state
    isElearningScorm,
    onPreviewScorm,
    courseQuizzes = [],
    availableScormModules = [],
    setAvailableScormModules
}) {
    const isItemQuiz = item?.item_type === 'quiz' || Boolean(item?.quiz_id);
    const isItemScorm = !isItemQuiz && (
        Boolean(item?.learning_module_id) ||
        Boolean(item?.learning_module_info) ||
        item?.file_type === 'scorm' ||
        item?.media_source === 'scorm' ||
        isElearningScorm
    );

    const regularQuizzes = (courseQuizzes || []).filter(q => q.quiz_type !== 'pre_post_test' && !q.has_pre_test && !q.has_post_test);
    const selectedQuiz = isItemQuiz ? ((courseQuizzes || []).find(q => String(q.quiz_id) === String(item?.quiz_id)) || item?.quiz_detail) : null;

    // ✨ Compute quiz IDs already used in OTHER sections/items in curriculum to prevent duplicates
    const usedQuizIds = new Set();
    if (Array.isArray(variants)) {
        variants.forEach((v, vIdx) => {
            (v.items || []).forEach((it, iIdx) => {
                if (vIdx === variantIndex && iIdx === itemIndex) return; // skip self
                const qId = it.quiz_id || (it.quiz && typeof it.quiz === 'object' ? it.quiz.quiz_id : (it.quiz || null));
                if (qId) {
                    usedQuizIds.add(String(qId));
                }
            });
        });
    }

    const currentSeconds = Number(item?.duration_seconds) || 0;
    const currentJP = currentSeconds > 0 ? Math.ceil(currentSeconds / 2700) : 0;

    // SCORM Linked Metadata
    const lm = item?.learning_module_info || (item?.learning_module && typeof item.learning_module === 'object' ? item.learning_module : (isElearningScorm ? course?.learning_module : null));
    const isScormLinked = Boolean(item?.learning_module_id || lm);
    const scormTitle = lm?.judul || item?.title || "Paket SCORM 1.2";
    const scormEntry = lm?.entry_file || "index.html";

    const [scormUploadState, setScormUploadState] = useState({ isUploading: false, progress: 0 });

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
        opacity: isDragging ? 0 : 1,
        marginBottom: '8px',
    };

    // ✨ Multi-Format Media State (Video, Presentation PPTX, Document PDF, Audio MP3, Links)
    const activeMediaUrl = item?.uploadedFile || item?.file || item?.youtubeLink || item?.gdriveLink || '';
    const hasExistingUrlMedia = Boolean(item?.youtubeLink || item?.gdriveLink || (typeof activeMediaUrl === 'string' && activeMediaUrl.startsWith('http') && !activeMediaUrl.includes('/media/curriculum-media/')));
    const [mediaTab, setMediaTab] = useState(hasExistingUrlMedia ? 'url' : 'upload');
    const [mediaUrlInput, setMediaUrlInput] = useState(item?.youtubeLink || item?.gdriveLink || (hasExistingUrlMedia ? activeMediaUrl : ''));

    useEffect(() => {
        if (item?.youtubeLink) {
            setMediaUrlInput(item.youtubeLink);
            setMediaTab('url');
        } else if (item?.gdriveLink) {
            setMediaUrlInput(item.gdriveLink);
            setMediaTab('url');
        } else if (activeMediaUrl && typeof activeMediaUrl === 'string' && activeMediaUrl.startsWith('http') && !activeMediaUrl.includes('/media/curriculum-media/')) {
            setMediaUrlInput(activeMediaUrl);
            setMediaTab('url');
        }
    }, [item?.youtubeLink, item?.gdriveLink, activeMediaUrl]);

    // Format switch handler (Media vs SCORM)
    const handleFormatSwitch = (format) => {
        if (format === 'scorm') {
            handleLessonChange(variantIndex, itemIndex, "file_type", "scorm");
            handleLessonChange(variantIndex, itemIndex, "media_source", "scorm");
            if (!item?.learning_module_id && course?.learning_module_id) {
                handleLessonChange(variantIndex, itemIndex, "learning_module_id", course.learning_module_id);
                handleLessonChange(variantIndex, itemIndex, "learning_module_info", course.learning_module);
            } else if (!item?.learning_module_id && availableScormModules?.length === 1) {
                handleLessonChange(variantIndex, itemIndex, "learning_module_id", availableScormModules[0].id);
                handleLessonChange(variantIndex, itemIndex, "learning_module_info", availableScormModules[0]);
            }
            if (!item?.duration_seconds) {
                handleDurationInput(variantIndex, itemIndex, "2700"); // 1 JP default
            }
        } else {
            handleLessonChange(variantIndex, itemIndex, "file_type", item?.uploadedFile ? "video" : null);
            handleLessonChange(variantIndex, itemIndex, "media_source", item?.uploadedFile ? "upload" : (item?.youtubeLink ? "youtube" : "upload"));
            handleLessonChange(variantIndex, itemIndex, "learning_module_id", null);
            handleLessonChange(variantIndex, itemIndex, "learning_module_info", null);
        }
        setTimeout(() => autoSaveCurriculum(), 150);
    };

    // SCORM ZIP Upload Handler
    const handleScormZipUpload = async (file) => {
        if (!file) return;
        const fileName = (file.name || '').toLowerCase();
        if (!fileName.endsWith('.zip') && !fileName.endsWith('.h5p')) {
            Toast().fire({
                icon: "error",
                title: "Format Berkas Tidak Valid",
                text: "Harap unggah paket SCORM dalam format berkas ZIP (.zip) atau H5P (.h5p)."
            });
            return;
        }
        if (file.size > 500 * 1024 * 1024) {
            Toast().fire({
                icon: "error",
                title: "Berkas Terlalu Besar",
                text: "Ukuran maksimal paket e-learning adalah 500MB."
            });
            return;
        }

        setScormUploadState({ isUploading: true, progress: 0 });
        const formData = new FormData();
        formData.append("file", file);
        formData.append("course_id", course?.course_id || course?.id || "");
        if (item?.title) formData.append("title", item.title);

        try {
            const res = await useAxios.post("teacher/upload-elearning-module/", formData, {
                headers: { "Content-Type": "multipart/form-data" },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setScormUploadState({ isUploading: true, progress: percentCompleted });
                }
            });

            if (res.data?.module_id) {
                handleLessonChange(variantIndex, itemIndex, "learning_module_id", res.data.module_id);
                handleLessonChange(variantIndex, itemIndex, "learning_module_info", res.data.module);
                handleLessonChange(variantIndex, itemIndex, "file_type", "scorm");
                handleLessonChange(variantIndex, itemIndex, "media_source", "scorm");
                handleLessonChange(variantIndex, itemIndex, "uploadedFile", "");
                handleLessonChange(variantIndex, itemIndex, "file", "");
                handleLessonChange(variantIndex, itemIndex, "youtubeLink", "");
                handleLessonChange(variantIndex, itemIndex, "gdriveLink", "");
                if (!item?.title || item.title === "Pelajaran Tanpa Judul" || item.title === "Modul Pembelajaran SCORM") {
                    handleLessonChange(variantIndex, itemIndex, "title", res.data.module?.judul || file.name.replace(/\.[^/.]+$/, ""));
                }
                if (!item?.duration_seconds) {
                    handleDurationInput(variantIndex, itemIndex, "2700"); // 1 JP
                }
                if (setAvailableScormModules && res.data.module) {
                    setAvailableScormModules(prev => [res.data.module, ...(prev || []).filter(m => m.id !== res.data.module_id)]);
                }

                Toast().fire({
                    icon: "success",
                    title: "Paket SCORM Berhasil Diunggah!",
                    text: `Modul "${res.data.module?.judul || 'SCORM'}" telah diekstrak dan siap digunakan.`,
                    timer: 2000,
                    showConfirmButton: false
                });
                setTimeout(() => autoSaveCurriculum(), 150);
            }
        } catch (err) {
            console.error("Error uploading SCORM package:", err);
            Toast().fire({
                icon: "error",
                title: "Unggahan SCORM Gagal",
                text: err.response?.data?.error || err.response?.data?.message || "Gagal mengunggah dan mengekstrak paket SCORM."
            });
        } finally {
            setScormUploadState({ isUploading: false, progress: 0 });
        }
    };

    // Link existing SCORM module from library
    const handleSelectExistingModule = (moduleId) => {
        if (!moduleId) return;
        const chosen = (availableScormModules || []).find(m => String(m.id) === String(moduleId));
        if (chosen) {
            handleLessonChange(variantIndex, itemIndex, "learning_module_id", chosen.id);
            handleLessonChange(variantIndex, itemIndex, "learning_module_info", chosen);
            handleLessonChange(variantIndex, itemIndex, "file_type", "scorm");
            handleLessonChange(variantIndex, itemIndex, "media_source", "scorm");
            if (!item?.title || item.title === "Pelajaran Tanpa Judul" || item.title === "Modul Pembelajaran SCORM") {
                handleLessonChange(variantIndex, itemIndex, "title", chosen.judul);
            }
            if (!item?.duration_seconds) {
                handleDurationInput(variantIndex, itemIndex, "2700");
            }
            Toast().fire({
                icon: "success",
                title: "Modul SCORM Dihubungkan",
                text: `Materi "${chosen.judul}" berhasil dihubungkan.`,
                timer: 1500,
                showConfirmButton: false
            });
            setTimeout(() => autoSaveCurriculum(), 150);
        }
    };

    // Detach SCORM module
    const handleDetachScorm = async () => {
        const result = await Swal.fire({
            title: 'Lepaskan Paket SCORM?',
            text: 'Modul SCORM akan dilepaskan dari materi pelajaran ini.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            confirmButtonText: '<i class="fas fa-unlink me-1"></i> Ya, Lepas',
            cancelButtonText: 'Batal',
            reverseButtons: true,
            customClass: {
                confirmButton: 'btn btn-danger btn-sm px-3 shadow-sm',
                cancelButton: 'btn btn-secondary btn-sm px-3 shadow-sm'
            },
            buttonsStyling: false
        });

        if (!result.isConfirmed) return;

        handleLessonChange(variantIndex, itemIndex, "learning_module_id", null);
        handleLessonChange(variantIndex, itemIndex, "learning_module_info", null);
        handleLessonChange(variantIndex, itemIndex, "file_type", null);
        handleLessonChange(variantIndex, itemIndex, "media_source", "upload");
        Toast().fire({
            icon: "info",
            title: "Modul SCORM Dilepaskan",
            text: "Materi ini dapat diisi kembali dengan video/berkas atau paket modul lainnya.",
            timer: 1500,
            showConfirmButton: false
        });
        setTimeout(() => autoSaveCurriculum(), 150);
    };

    // Determine media type for standard lessons
    const rawMedia = item?.uploadedFile || item?.file || item?.youtubeLink || item?.gdriveLink || '';
    const mediaExt = rawMedia.toLowerCase().split('.').pop().split('?')[0];
    const isItemAudio = ['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(mediaExt);
    const isItemPdf = mediaExt === 'pdf';
    const isItemPpt = ['ppt', 'pptx'].includes(mediaExt) || rawMedia.includes('docs.google.com/presentation');
    const isItemWord = ['doc', 'docx', 'txt'].includes(mediaExt);
    const isItemVideo = ['mp4', 'webm', 'ogv', 'mov', 'avi', 'mkv'].includes(mediaExt) || rawMedia.includes('youtube.com') || rawMedia.includes('youtu.be') || Boolean(item?.youtubeLink);
    const isItemWebLink = Boolean(rawMedia && rawMedia.startsWith('http') && !isItemAudio && !isItemPdf && !isItemPpt && !isItemWord && !isItemVideo);

    const isPreviewOpen = previewVisibility[`${variantIndex}_${itemIndex}`] === true;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`curriculum-item-card-enhanced ${isItemQuiz ? 'is-quiz' : isItemScorm ? 'is-scorm' : 'is-media'} ${isDragging ? 'dragging' : ''}`}
        >
            {/* Header: Compact, Sleek, Eye-Catching */}
            <div className={`curriculum-item-header-enhanced ${isItemQuiz ? 'quiz-header' : isItemScorm ? 'scorm-header' : ''}`}>
                <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-1 flex-wrap flex-grow-1 overflow-hidden me-2">
                        {/* Drag Handle */}
                        <div
                            {...listeners}
                            {...attributes}
                            className="drag-handle drag-handle-lesson"
                            title="Seret untuk menata urutan pelajaran"
                            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                        >
                            <i className="fas fa-grip-vertical"></i>
                        </div>

                        {/* UP/DOWN Micro Buttons */}
                        <div className="btn-group btn-group-sm me-1" role="group">
                            <button
                                type="button"
                                className="btn btn-outline-light btn-micro"
                                onClick={() => moveLessonUp(variantIndex, itemIndex)}
                                disabled={itemIndex === 0 || uiState.isSubmitting}
                                title="Pindahkan pelajaran ke atas"
                            >
                                <i className="fas fa-arrow-up"></i>
                            </button>
                            <button
                                type="button"
                                className="btn btn-outline-light btn-micro"
                                onClick={() => moveLessonDown(variantIndex, itemIndex)}
                                disabled={itemIndex === variant.items.length - 1 || uiState.isSubmitting}
                                title="Pindahkan pelajaran ke bawah"
                            >
                                <i className="fas fa-arrow-down"></i>
                            </button>
                        </div>

                        {/* Number Badge */}
                        <span className={`lesson-number-badge ${isItemQuiz ? 'bg-warning-subtle text-dark border-warning' : ''}`}>
                            <i className={`fas ${isItemQuiz ? 'fa-clipboard-check text-warning' :
                                    isItemScorm ? 'fa-cube text-teal' :
                                        isItemAudio ? 'fa-headphones text-info' :
                                            isItemPpt ? 'fa-file-powerpoint text-warning' :
                                                isItemPdf ? 'fa-file-pdf text-danger' :
                                                    isItemWord ? 'fa-file-word text-primary' :
                                                        isItemWebLink ? 'fa-link text-secondary' :
                                                            'fa-play-circle text-teal'
                                } me-1`}></i>
                            {isItemQuiz ? `Kuis ${itemIndex + 1}` : `Pelajaran ${itemIndex + 1}`}
                        </span>

                        {/* Format Badges */}
                        {isItemScorm && (
                            <>
                                <span className="badge badge-scorm-pill shadow-xs d-inline-flex align-items-center">
                                    <i className="fas fa-cube text-teal me-1"></i>SCORM 1.2
                                </span>
                                <span className={`badge ${currentJP > 0 ? "bg-white text-teal border shadow-xs" : "bg-warning text-dark"} d-inline-flex align-items-center`}>
                                    <i className="fas fa-graduation-cap me-1"></i>{currentJP > 0 ? `${currentJP} JP` : "0 JP"}
                                </span>
                            </>
                        )}
                        {!isItemScorm && !isItemQuiz && (
                            <>
                                {isItemVideo && (
                                    <span className="badge bg-teal-subtle text-teal border border-teal-subtle">
                                        <i className="fas fa-video me-1"></i>Video
                                    </span>
                                )}
                                {isItemPpt && (
                                    <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">
                                        <i className="fas fa-file-powerpoint me-1"></i>Slide
                                    </span>
                                )}
                                {isItemPdf && (
                                    <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                                        <i className="fas fa-file-pdf me-1"></i>PDF
                                    </span>
                                )}
                                {isItemAudio && (
                                    <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle">
                                        <i className="fas fa-headphones me-1"></i>Audio
                                    </span>
                                )}
                                {isItemWord && (
                                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                                        <i className="fas fa-file-word me-1"></i>Dokumen
                                    </span>
                                )}
                                {isItemWebLink && (
                                    <span className="badge bg-secondary-subtle text-dark border">
                                        <i className="fas fa-link me-1"></i>Tautan
                                    </span>
                                )}
                                {item?.duration_formatted && (
                                    <span className="badge bg-white text-dark border shadow-xs d-inline-flex align-items-center">
                                        <i className="fas fa-clock text-info me-1"></i>{item.duration_formatted}
                                    </span>
                                )}
                            </>
                        )}

                        {/* Title Preview in Header */}
                        <span className="lesson-title-preview text-truncate" title={item?.title || "Pelajaran Tanpa Judul"}>
                            {item?.title || "Pelajaran Tanpa Judul"}
                        </span>
                    </div>

                    {/* Delete Action Button */}
                    {variant.items.length > 1 && (
                        <button
                            type="button"
                            className="btn btn-danger btn-sm py-0 px-2"
                            style={{ fontSize: "0.72rem" }}
                            onClick={() => removeLesson(variantIndex, itemIndex, variant?.variant_id, item?.variant_item_id)}
                            disabled={uiState.isSubmitting}
                            title="Hapus materi pelajaran ini"
                        >
                            <i className="fas fa-times me-1"></i>Hapus
                        </button>
                    )}
                </div>
            </div>

            {/* Content Body: Compact & Zero Dead White Space */}
            <div className="curriculum-item-content-enhanced">
                {isItemQuiz ? (
                    <div className="p-2 bg-light rounded-3 border" style={{ borderLeft: '4px solid #f59e0b' }}>
                        <div className="row g-2 align-items-center">
                            <div className="col-md-6">
                                <label className="form-label fw-bold small text-dark d-flex align-items-center gap-1 mb-1">
                                    <i className="fas fa-clipboard-question text-warning"></i>
                                    <span>Pilih Kuis Kursus</span>
                                    <span className="text-danger">*</span>
                                </label>
                                <select
                                    className={`form-select form-select-sm curriculum-form-control ${getValidationClass(
                                        validationState.errors[`item_${variantIndex}_${itemIndex}_quiz_id`]
                                    )}`}
                                    style={{ paddingRight: '2.5rem', textOverflow: 'ellipsis' }}
                                    value={item?.quiz_id || ''}
                                    onChange={(e) => {
                                        const chosenId = e.target.value;
                                        if (chosenId && usedQuizIds.has(String(chosenId))) {
                                            Toast().fire({
                                                icon: "warning",
                                                title: "Kuis Sudah Disisipkan",
                                                text: "Kuis ini sudah disisipkan pada bagian materi lain. Setiap kuis hanya dapat disisipkan 1 kali.",
                                            });
                                            return;
                                        }
                                        const chosenQuiz = courseQuizzes.find(q => String(q.quiz_id) === String(chosenId));
                                        handleLessonChange(variantIndex, itemIndex, "quiz_id", chosenId);
                                        if (chosenQuiz) {
                                            handleLessonChange(variantIndex, itemIndex, "title", chosenQuiz.title);
                                            handleLessonChange(variantIndex, itemIndex, "description", chosenQuiz.description || '');
                                            if (chosenQuiz.duration_minutes) {
                                                handleLessonChange(variantIndex, itemIndex, "duration_seconds", chosenQuiz.duration_minutes * 60);
                                                handleLessonChange(variantIndex, itemIndex, "duration_formatted", `${chosenQuiz.duration_minutes} Menit`);
                                            }
                                        }
                                    }}
                                >
                                    <option value="">-- Pilih Kuis --</option>
                                    {regularQuizzes.map(q => {
                                        const isAlreadyUsed = usedQuizIds.has(String(q.quiz_id));
                                        return (
                                            <option key={q.quiz_id} value={q.quiz_id} disabled={isAlreadyUsed}>
                                                {q.title} ({q.total_questions || q.questions?.length || 0} Soal){isAlreadyUsed ? " — [Sudah Disisipkan]" : ""}
                                            </option>
                                        );
                                    })}
                                </select>
                                {validationState.errors[`item_${variantIndex}_${itemIndex}_quiz_id`] && (
                                    <div className="curriculum-invalid-feedback">
                                        {validationState.errors[`item_${variantIndex}_${itemIndex}_quiz_id`]}
                                    </div>
                                )}
                            </div>
                            <div className="col-md-6">
                                {selectedQuiz ? (
                                    <div className="p-2 rounded bg-white border border-warning-subtle shadow-xs">
                                        <div className="d-flex align-items-center justify-content-between mb-0">
                                            <span className="badge bg-warning text-dark fw-bold" style={{ fontSize: "10px" }}>
                                                <i className="fas fa-award me-1"></i>Passing Grade: 70%
                                            </span>
                                            <small className="text-muted" style={{ fontSize: "11px" }}>
                                                <i className="fas fa-clock me-1"></i>
                                                {selectedQuiz.duration_minutes ? `${selectedQuiz.duration_minutes} Menit` : 'Tanpa Batas'}
                                            </small>
                                        </div>
                                        <div className="fw-bold text-dark text-truncate small">{selectedQuiz.title}</div>
                                        <p className="mb-0 text-muted small text-truncate" style={{ fontSize: "11px" }}>
                                            {selectedQuiz.total_questions || selectedQuiz.questions?.length || 0} Soal &bull; Min. 70%
                                        </p>
                                    </div>
                                ) : (
                                    <div className="alert alert-warning py-1 px-2 mb-0 small" style={{ fontSize: "11px" }}>
                                        <i className="fas fa-exclamation-triangle me-1"></i>
                                        Pilih kuis yang akan disisipkan di posisi urutan ini.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Row 1: Title Input + Content Format Switcher */}
                        <div className="row g-2 align-items-center mb-2">
                            <div className="col-md-8">
                                <div className="input-group input-group-sm">
                                    <span className="input-group-text bg-white border-end-0 py-0 px-2 text-teal">
                                        <i className="fas fa-heading small"></i>
                                    </span>
                                    <input
                                        type="text"
                                        className={`form-control form-control-sm border-start-0 py-1 fw-semibold ${getValidationClass(
                                            validationState.errors[`item_${variantIndex}_${itemIndex}_title`],
                                            validationState.warnings[`item_${variantIndex}_${itemIndex}_title`]
                                        )}`}
                                        value={item?.title || ""}
                                        onChange={(e) => handleLessonChange(variantIndex, itemIndex, "title", e.target.value)}
                                        placeholder="Judul Pelajaran (misal: Pengenalan & Konsep Dasar Materi)"
                                    />
                                </div>
                                {validationState.errors[`item_${variantIndex}_${itemIndex}_title`] && (
                                    <div className="curriculum-invalid-feedback">
                                        {validationState.errors[`item_${variantIndex}_${itemIndex}_title`]}
                                    </div>
                                )}
                            </div>
                            <div className="col-md-4">
                                {/* Segmented Format Switcher: Video/Media vs SCORM 1.2 */}
                                <div className="btn-group btn-group-sm w-100 shadow-xs" role="group">
                                    <button
                                        type="button"
                                        className={`btn py-1 px-2 ${!isItemScorm ? 'btn-teal text-white fw-bold shadow-xs' : 'btn-outline-secondary bg-white text-muted'}`}
                                        style={{ fontSize: "0.75rem", transition: "all 0.15s ease" }}
                                        onClick={() => handleFormatSwitch('media')}
                                        title="Format Video, Dokumen PDF, Slide PPTX, atau Audio"
                                    >
                                        <i className="fas fa-photo-video me-1"></i>Video / Berkas
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn py-1 px-2 ${isItemScorm ? 'btn-teal text-white fw-bold shadow-xs' : 'btn-outline-secondary bg-white text-muted'}`}
                                        style={{ fontSize: "0.75rem", transition: "all 0.15s ease" }}
                                        onClick={() => handleFormatSwitch('scorm')}
                                        title="Format Paket Interaktif SCORM 1.2"
                                    >
                                        <i className="fas fa-cube me-1"></i>Modul SCORM
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Row 2: Balanced 2-Column Grid (Information on Left, Media/SCORM on Right) */}
                        <div className="row g-2 align-items-stretch">
                            {/* Left Column: Description & Compact Duration/JP Setting */}
                            <div className="col-md-6 d-flex flex-column justify-content-between">
                                <div>
                                    <textarea
                                        className={`form-control form-control-sm mb-1 ${getValidationClass(
                                            validationState.errors[`item_${variantIndex}_${itemIndex}_description`],
                                            validationState.warnings[`item_${variantIndex}_${itemIndex}_description`]
                                        )}`}
                                        value={item?.description || ""}
                                        onChange={(e) => handleLessonChange(variantIndex, itemIndex, "description", e.target.value)}
                                        rows="2"
                                        style={{ fontSize: "0.8rem", resize: "none" }}
                                        placeholder="Deskripsi ringkas materi pelajaran ini (opsional)..."
                                    />
                                </div>

                                {/* Compact Duration / JP and Preview Bar */}
                                <div className="mt-auto">
                                    {isItemScorm ? (
                                        <div className="d-flex align-items-center justify-content-between p-1 px-2 bg-light rounded border">
                                            <div className="d-flex align-items-center gap-1">
                                                <i className="fas fa-graduation-cap text-teal small"></i>
                                                <span className="small fw-bold text-dark me-1" style={{ fontSize: "0.78rem" }}>
                                                    Beban Belajar:
                                                </span>
                                                <div className="input-group input-group-sm" style={{ width: "88px" }}>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        className="form-control form-control-sm py-0 px-1 text-center fw-bold"
                                                        style={{ fontSize: "0.8rem", height: "26px" }}
                                                        placeholder="0"
                                                        value={currentJP > 0 ? currentJP : ""}
                                                        onChange={(e) => {
                                                            const val = parseInt(e.target.value) || 0;
                                                            handleDurationInput(variantIndex, itemIndex, (val * 2700).toString());
                                                        }}
                                                        disabled={uiState.isSubmitting}
                                                    />
                                                    <span className="input-group-text py-0 px-1 small fw-bold text-teal" style={{ fontSize: "0.75rem", height: "26px" }}>JP</span>
                                                </div>
                                                <small className="text-muted ms-1" style={{ fontSize: "0.75rem" }}>
                                                    {currentJP > 0 ? `(${currentJP * 45} m)` : '(0 m)'}
                                                </small>
                                            </div>
                                            <div className="form-check form-switch mb-0 ms-auto">
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    id={`preview-${variantIndex}-${itemIndex}`}
                                                    checked={item?.preview || false}
                                                    onChange={(e) => handleLessonChange(variantIndex, itemIndex, "preview", e.target.checked)}
                                                    style={{ cursor: "pointer", transform: "scale(0.85)" }}
                                                />
                                                <label className="form-check-label small text-muted text-nowrap" htmlFor={`preview-${variantIndex}-${itemIndex}`} style={{ fontSize: "0.75rem", cursor: "pointer" }}>
                                                    Pratinjau
                                                </label>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-1 px-2 bg-light rounded border">
                                            <div className="d-flex align-items-center justify-content-between">
                                                <div className="d-flex align-items-center gap-1">
                                                    <i className="fas fa-clock text-info small"></i>
                                                    <span className="small fw-bold text-dark me-1" style={{ fontSize: "0.78rem" }}>Durasi:</span>
                                                    <span className="badge bg-success-subtle text-success border border-success-subtle py-0 px-2" style={{ fontSize: "11px" }}>
                                                        {item?.duration_formatted || "00:00"}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="btn btn-xs btn-outline-secondary py-0 px-1 ms-1"
                                                        style={{ fontSize: "0.7rem", height: "22px" }}
                                                        onClick={() => toggleDurationEditMode(variantIndex, itemIndex)}
                                                        disabled={uiState.isSubmitting}
                                                        title="Atur durasi secara manual"
                                                    >
                                                        <i className={`fas fa-${durationEditingMode[`${variantIndex}_${itemIndex}`] ? 'check text-success' : 'pencil-alt'} me-1`}></i>
                                                        {durationEditingMode[`${variantIndex}_${itemIndex}`] ? 'Selesai' : 'Edit'}
                                                    </button>
                                                </div>
                                                <div className="form-check form-switch mb-0 ms-auto">
                                                    <input
                                                        className="form-check-input"
                                                        type="checkbox"
                                                        id={`preview-${variantIndex}-${itemIndex}`}
                                                        checked={item?.preview || false}
                                                        onChange={(e) => handleLessonChange(variantIndex, itemIndex, "preview", e.target.checked)}
                                                        style={{ cursor: "pointer", transform: "scale(0.85)" }}
                                                    />
                                                    <label className="form-check-label small text-muted text-nowrap" htmlFor={`preview-${variantIndex}-${itemIndex}`} style={{ fontSize: "0.75rem", cursor: "pointer" }}>
                                                        Pratinjau
                                                    </label>
                                                </div>
                                            </div>

                                            {/* Collapsible Micro Duration Input */}
                                            {durationEditingMode[`${variantIndex}_${itemIndex}`] && (
                                                <div className="mt-1 pt-1 border-top d-flex align-items-center gap-1">
                                                    <div className="input-group input-group-sm" style={{ width: "70px" }}>
                                                        <input
                                                            type="number"
                                                            className="form-control form-control-sm py-0 px-1 text-center"
                                                            style={{ fontSize: "0.75rem", height: "24px" }}
                                                            placeholder="0"
                                                            value={item?.duration_seconds ? Math.floor(item.duration_seconds / 3600) : ''}
                                                            onChange={(e) => {
                                                                const h = parseInt(e.target.value) || 0;
                                                                const m = item?.duration_seconds ? Math.floor((item.duration_seconds % 3600) / 60) : 0;
                                                                const s = item?.duration_seconds ? Math.floor(item.duration_seconds % 60) : 0;
                                                                handleDurationInput(variantIndex, itemIndex, ((h * 3600) + (m * 60) + s).toString());
                                                            }}
                                                            min="0" max="23"
                                                        />
                                                        <span className="input-group-text py-0 px-1 text-muted" style={{ fontSize: "0.7rem", height: "24px" }}>j</span>
                                                    </div>
                                                    <div className="input-group input-group-sm" style={{ width: "70px" }}>
                                                        <input
                                                            type="number"
                                                            className="form-control form-control-sm py-0 px-1 text-center"
                                                            style={{ fontSize: "0.75rem", height: "24px" }}
                                                            placeholder="0"
                                                            value={item?.duration_seconds ? Math.floor((item.duration_seconds % 3600) / 60) : ''}
                                                            onChange={(e) => {
                                                                const m = parseInt(e.target.value) || 0;
                                                                const h = item?.duration_seconds ? Math.floor(item.duration_seconds / 3600) : 0;
                                                                const s = item?.duration_seconds ? Math.floor(item.duration_seconds % 60) : 0;
                                                                handleDurationInput(variantIndex, itemIndex, ((h * 3600) + (m * 60) + s).toString());
                                                            }}
                                                            min="0" max="59"
                                                        />
                                                        <span className="input-group-text py-0 px-1 text-muted" style={{ fontSize: "0.7rem", height: "24px" }}>m</span>
                                                    </div>
                                                    <div className="input-group input-group-sm" style={{ width: "70px" }}>
                                                        <input
                                                            type="number"
                                                            className="form-control form-control-sm py-0 px-1 text-center"
                                                            style={{ fontSize: "0.75rem", height: "24px" }}
                                                            placeholder="0"
                                                            value={item?.duration_seconds ? Math.floor(item.duration_seconds % 60) : ''}
                                                            onChange={(e) => {
                                                                const s = parseInt(e.target.value) || 0;
                                                                const h = item?.duration_seconds ? Math.floor(item.duration_seconds / 3600) : 0;
                                                                const m = item?.duration_seconds ? Math.floor((item.duration_seconds % 3600) / 60) : 0;
                                                                handleDurationInput(variantIndex, itemIndex, ((h * 3600) + (m * 60) + s).toString());
                                                            }}
                                                            min="0" max="59"
                                                        />
                                                        <span className="input-group-text py-0 px-1 text-muted" style={{ fontSize: "0.7rem", height: "24px" }}>s</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Column: SCORM Container OR Media Container */}
                            <div className="col-md-6">
                                {isItemScorm ? (
                                    /* === SCORM MODULE CONTAINER === */
                                    isScormLinked ? (
                                        <div className="p-2 rounded-3 border bg-white shadow-xs h-100 d-flex flex-column justify-content-between" style={{ borderLeft: '3px solid #0f766e', backgroundColor: '#f0fdfa' }}>
                                            <div>
                                                <div className="d-flex align-items-center justify-content-between mb-1">
                                                    <span className="badge bg-teal text-white py-0 px-2" style={{ fontSize: "10px" }}>
                                                        <i className="fas fa-cube me-1"></i>Paket SCORM 1.2
                                                    </span>
                                                    <span className="badge bg-success-subtle text-success border border-success-subtle py-0 px-1" style={{ fontSize: "10px" }}>
                                                        <i className="fas fa-check-circle me-1"></i>Terhubung
                                                    </span>
                                                </div>
                                                <h6 className="fw-bold text-dark mb-1 text-truncate" title={scormTitle} style={{ fontSize: "0.85rem" }}>
                                                    {scormTitle}
                                                </h6>
                                                <div className="d-flex align-items-center gap-2 small text-muted flex-wrap" style={{ fontSize: "0.75rem" }}>
                                                    <span><i className="fas fa-file-code text-teal me-1"></i><code className="text-dark bg-light px-1 py-0 rounded">{scormEntry}</code></span>
                                                    <span>&bull;</span>
                                                    <span><i className="fas fa-shield-alt text-success me-1"></i>cmi.core RTE Aktif</span>
                                                </div>
                                            </div>

                                            <div className="d-flex align-items-center justify-content-between mt-2 pt-1 border-top">
                                                <button
                                                    type="button"
                                                    className="btn btn-xs btn-outline-teal d-inline-flex align-items-center justify-content-center gap-1 py-1 px-2 shadow-xs"
                                                    onClick={() => onPreviewScorm && onPreviewScorm(item)}
                                                    title="Uji coba pemutar SCORM interaktif"
                                                    style={{ fontSize: "0.75rem", lineHeight: 1, verticalAlign: "middle" }}
                                                >
                                                    <i className="fas fa-play text-teal" style={{ fontSize: "10px", lineHeight: 1 }}></i>
                                                    <span className="fw-semibold" style={{ lineHeight: 1 }}>Uji Coba SCORM</span>
                                                </button>
                                                <div className="d-flex align-items-center gap-1">
                                                    <label
                                                        className="btn btn-xs btn-outline-secondary d-inline-flex align-items-center justify-content-center py-1 px-2 mb-0 shadow-xs"
                                                        title="Ganti paket SCORM"
                                                        style={{ fontSize: "0.725rem", cursor: "pointer", lineHeight: 1, verticalAlign: "middle" }}
                                                    >
                                                        <i className="fas fa-sync-alt me-1" style={{ fontSize: "0.7rem", lineHeight: 1 }}></i>
                                                        <span style={{ lineHeight: 1 }}>Ganti</span>
                                                        <input
                                                            type="file"
                                                            accept=".zip,.h5p"
                                                            hidden
                                                            onChange={(e) => handleScormZipUpload(e.target.files?.[0])}
                                                        />
                                                    </label>
                                                    <button
                                                        type="button"
                                                        className="btn btn-xs btn-outline-danger d-inline-flex align-items-center justify-content-center py-1 px-2 shadow-xs"
                                                        title="Lepaskan modul SCORM dari materi ini"
                                                        onClick={handleDetachScorm}
                                                        style={{ fontSize: "0.725rem", lineHeight: 1, verticalAlign: "middle" }}
                                                    >
                                                        <i className="fas fa-unlink me-1" style={{ fontSize: "0.7rem", lineHeight: 1 }}></i>
                                                        <span style={{ lineHeight: 1 }}>Lepas</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-2 rounded-3 border bg-light h-100 d-flex flex-column justify-content-between" style={{ borderLeft: '3px solid #0f766e' }}>
                                            <div>
                                                <div className="d-flex align-items-center justify-content-between mb-1">
                                                    <span className="badge bg-teal-subtle text-teal border border-teal-subtle py-0 px-2 fw-bold" style={{ fontSize: "10px" }}>
                                                        <i className="fas fa-cube me-1"></i>Unggah / Pilih SCORM
                                                    </span>
                                                    <span className="text-muted small" style={{ fontSize: "0.72rem" }}>
                                                        ZIP maks. 500MB
                                                    </span>
                                                </div>

                                                {scormUploadState.isUploading ? (
                                                    <div className="py-2 text-center">
                                                        <div className="spinner-border spinner-border-sm text-teal mb-1" role="status"></div>
                                                        <div className="small fw-bold text-dark" style={{ fontSize: "0.8rem" }}>
                                                            Mengunggah & Mengekstrak SCORM... {scormUploadState.progress}%
                                                        </div>
                                                        <div className="progress mt-1" style={{ height: "6px" }}>
                                                            <div className="progress-bar bg-teal" style={{ width: `${scormUploadState.progress}%` }}></div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="d-flex flex-column gap-1">
                                                        <label className="btn btn-sm btn-outline-teal w-100 d-flex align-items-center justify-content-center gap-1 py-1 mb-0 shadow-xs" style={{ cursor: "pointer", fontSize: "0.8rem" }}>
                                                            <i className="fas fa-cloud-arrow-up"></i>
                                                            <span className="fw-semibold">Unggah Paket SCORM 1.2 (.zip)</span>
                                                            <input
                                                                type="file"
                                                                accept=".zip,.h5p"
                                                                hidden
                                                                onChange={(e) => handleScormZipUpload(e.target.files?.[0])}
                                                            />
                                                        </label>

                                                        {availableScormModules && availableScormModules.length > 0 && (
                                                            <div className="d-flex align-items-center gap-1 mt-1">
                                                                <select
                                                                    className="form-select form-select-sm py-1"
                                                                    style={{ fontSize: "0.78rem" }}
                                                                    defaultValue=""
                                                                    onChange={(e) => handleSelectExistingModule(e.target.value)}
                                                                >
                                                                    <option value="" disabled>-- Atau pilih paket dari pustaka --</option>
                                                                    {availableScormModules.map(m => (
                                                                        <option key={m.id} value={m.id}>
                                                                            {m.judul} ({m.module_type === 'scorm_12' ? 'SCORM 1.2' : m.module_type.toUpperCase()})
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="small text-muted mt-2 pt-1 border-top d-flex align-items-center justify-content-between" style={{ fontSize: "0.72rem" }}>
                                                <span><i className="fas fa-check-circle text-teal me-1"></i>Otomatis ekstrak imsmanifest</span>
                                                <span><i className="fas fa-shield-alt text-teal me-1"></i>Zip-Slip safe</span>
                                            </div>
                                        </div>
                                    )
                                ) : (
                                    /* === STANDARD MEDIA CONTAINER === */
                                    <div className="h-100 d-flex flex-column justify-content-between">
                                        {Boolean(activeMediaUrl) ? (
                                            <div className="p-2 rounded-3 border bg-white shadow-xs">
                                                <div className="d-flex align-items-center justify-content-between mb-1">
                                                    <div className="d-flex align-items-center gap-1 overflow-hidden me-2">
                                                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle py-0 px-1" style={{ fontSize: "10px" }}>
                                                            <i className={
                                                                isItemAudio ? "fas fa-headphones me-1" :
                                                                    isItemPdf ? "fas fa-file-pdf me-1" :
                                                                        isItemPpt ? "fas fa-file-powerpoint me-1" :
                                                                            isItemWord ? "fas fa-file-word me-1" :
                                                                                "fas fa-play-circle me-1"
                                                            }></i>
                                                            {isItemAudio ? "Audio" : isItemPdf ? "PDF" : isItemPpt ? "Slide" : isItemWord ? "Dokumen" : "Video"}
                                                        </span>
                                                        <span className="small text-dark fw-bold text-truncate" title={activeMediaUrl} style={{ maxWidth: "210px", fontSize: "0.8rem" }}>
                                                            {activeMediaUrl.split('/').pop().split('?')[0] || "Media Terpasang"}
                                                        </span>
                                                    </div>
                                                    <div className="d-flex align-items-center gap-1">
                                                        <button
                                                            type="button"
                                                            className="btn btn-xs btn-outline-secondary py-0 px-1"
                                                            style={{ fontSize: "0.72rem" }}
                                                            onClick={() => togglePreviewVisibility(variantIndex, itemIndex)}
                                                            title={isPreviewOpen ? "Tutup Pratinjau" : "Buka Pratinjau"}
                                                        >
                                                            <i className={`fas fa-${isPreviewOpen ? 'eye-slash' : 'eye'} me-1`}></i>
                                                            {isPreviewOpen ? 'Tutup' : 'Lihat'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-xs btn-outline-danger py-0 px-1"
                                                            style={{ fontSize: "0.72rem" }}
                                                            title="Hapus media dari pelajaran ini"
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                const result = await Swal.fire({
                                                                    title: 'Hapus Media Pelajaran?',
                                                                    text: 'Media ini (video/dokumen/tautan) akan dilepas dari materi pembelajaran.',
                                                                    icon: 'warning',
                                                                    showCancelButton: true,
                                                                    confirmButtonColor: '#dc3545',
                                                                    cancelButtonColor: '#6c757d',
                                                                    confirmButtonText: '<i class="fas fa-trash-alt me-1"></i> Ya, Hapus',
                                                                    cancelButtonText: 'Batal',
                                                                    reverseButtons: true,
                                                                    customClass: {
                                                                        confirmButton: 'btn btn-danger btn-sm px-3 shadow-sm',
                                                                        cancelButton: 'btn btn-secondary btn-sm px-3 shadow-sm'
                                                                    },
                                                                    buttonsStyling: false
                                                                });

                                                                if (!result.isConfirmed) return;

                                                                setMediaUrlInput('');
                                                                if (handleClearLessonMedia) {
                                                                    await handleClearLessonMedia(variantIndex, itemIndex);
                                                                } else if (item?.uploadedFile && item.uploadedFile.includes('/media/')) {
                                                                    await handleDeleteLessonFile(variantIndex, itemIndex, item.uploadedFile);
                                                                } else {
                                                                    handleLessonChange(variantIndex, itemIndex, "uploadedFile", "");
                                                                    handleLessonChange(variantIndex, itemIndex, "file", "");
                                                                    handleLessonChange(variantIndex, itemIndex, "youtubeLink", "");
                                                                    handleLessonChange(variantIndex, itemIndex, "gdriveLink", "");
                                                                    handleLessonChange(variantIndex, itemIndex, "media_source", "");
                                                                    setTimeout(() => autoSaveCurriculum(), 100);
                                                                    Toast().fire({
                                                                        icon: "success",
                                                                        title: "Media Dihapus",
                                                                        text: "Media pelajaran berhasil dilepas.",
                                                                        timer: 1500,
                                                                        showConfirmButton: false
                                                                    });
                                                                }
                                                            }}
                                                        >
                                                            <i className="fas fa-trash-alt"></i>
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Expandable Compact Preview Container */}
                                                {isPreviewOpen && (
                                                    <div className="mt-1 pt-1 border-top rounded overflow-hidden" style={{ maxHeight: (isItemPpt || isItemPdf) ? '580px' : '180px' }}>
                                                        {isItemVideo && (activeMediaUrl.includes('youtube.com') || activeMediaUrl.includes('youtu.be')) ? (
                                                            <div className="ratio ratio-16x9 rounded overflow-hidden" style={{ maxHeight: "170px" }}>
                                                                <iframe
                                                                    src={`https://www.youtube-nocookie.com/embed/${extractYoutubeIdLesson(item.youtubeLink || activeMediaUrl) || ''}`}
                                                                    title="YouTube video player"
                                                                    frameBorder="0"
                                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                                    allowFullScreen
                                                                ></iframe>
                                                            </div>
                                                        ) : isItemVideo && activeMediaUrl.includes('drive.google.com') ? (
                                                            <div className="ratio ratio-16x9 rounded overflow-hidden" style={{ maxHeight: "170px" }}>
                                                                <iframe
                                                                    src={activeMediaUrl.includes('/preview') ? activeMediaUrl : activeMediaUrl.replace(/\/view(\?.*)?$/, '/preview')}
                                                                    title="Google Drive Media"
                                                                    allow="autoplay"
                                                                ></iframe>
                                                            </div>
                                                        ) : isItemAudio ? (
                                                            <div className="p-2 text-center bg-light rounded">
                                                                <audio controls className="w-100" style={{ maxHeight: '40px' }}>
                                                                    <source src={activeMediaUrl} />
                                                                </audio>
                                                            </div>
                                                        ) : isItemPdf ? (
                                                            <PdfRenderer
                                                                fileUrl={activeMediaUrl}
                                                                height="460px"
                                                                title={item.title || "Dokumen PDF"}
                                                            />
                                                        ) : isItemPpt ? (
                                                            <PresentationPreview fileUrl={activeMediaUrl} />
                                                        ) : isItemWord ? (
                                                            <div className="p-2 text-center bg-light rounded">
                                                                <i className="fas fa-file-word text-primary fa-2x mb-1"></i>
                                                                <div className="small fw-semibold text-truncate">{activeMediaUrl.split('/').pop()}</div>
                                                                <a href={activeMediaUrl} target="_blank" rel="noopener noreferrer" className="btn btn-xs btn-outline-primary mt-1 py-0 px-2" style={{ fontSize: "0.72rem" }}>
                                                                    <i className="fas fa-external-link-alt me-1"></i>Buka Dokumen
                                                                </a>
                                                            </div>
                                                        ) : (
                                                            <div className="bg-black text-center rounded overflow-hidden">
                                                                <video key={activeMediaUrl} width="100%" controls style={{ maxHeight: '160px', backgroundColor: '#000' }}>
                                                                    <source src={activeMediaUrl} />
                                                                </video>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            /* No Media: Compact Upload / URL Switcher */
                                            <div className="p-2 rounded-3 border bg-light h-100 d-flex flex-column justify-content-between">
                                                <div>
                                                    <div className="d-flex align-items-center justify-content-between mb-1">
                                                        <span className="small fw-bold text-dark" style={{ fontSize: "0.78rem" }}>
                                                            <i className="fas fa-photo-video text-teal me-1"></i>Pilih Berkas / URL:
                                                        </span>
                                                        <div className="btn-group btn-group-sm" role="group">
                                                            <button
                                                                type="button"
                                                                className={`btn py-0 px-2 ${mediaTab === 'upload' ? 'btn-teal text-white' : 'btn-outline-secondary'}`}
                                                                style={{ fontSize: "0.72rem", height: "22px" }}
                                                                onClick={() => setMediaTab('upload')}
                                                            >
                                                                <i className="fas fa-upload me-1"></i>Unggah
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className={`btn py-0 px-2 ${mediaTab === 'url' ? 'btn-teal text-white' : 'btn-outline-secondary'}`}
                                                                style={{ fontSize: "0.72rem", height: "22px" }}
                                                                onClick={() => setMediaTab('url')}
                                                            >
                                                                <i className="fas fa-link me-1"></i>Tautan
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {mediaTab === 'upload' ? (
                                                        <div>
                                                            <label className="btn btn-sm btn-outline-teal w-100 d-flex align-items-center justify-content-center gap-1 py-1 mb-0 shadow-xs" style={{ cursor: "pointer", fontSize: "0.8rem" }}>
                                                                <i className="fas fa-folder-open"></i>
                                                                <span className="fw-semibold">Pilih Berkas Media (Video/Doc/PPT)</span>
                                                                <input
                                                                    type="file"
                                                                    hidden
                                                                    accept=".mp4,.webm,.ogv,.mov,.avi,.mkv,.ppt,.pptx,.pdf,.doc,.docx,.txt,.mp3,.wav,.ogg,.m4a,video/*,audio/*,application/pdf"
                                                                    onChange={(e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) {
                                                                            const validExts = ['.mp4', '.webm', '.ogv', '.mov', '.avi', '.mkv', '.ppt', '.pptx', '.pdf', '.doc', '.docx', '.txt', '.mp3', '.wav', '.ogg', '.m4a', '.aac'];
                                                                            const fileName = (file.name || '').toLowerCase();
                                                                            const isExtOk = validExts.some(ext => fileName.endsWith(ext));
                                                                            const isMimeOk = file.type.startsWith('video/') || file.type.startsWith('audio/') || file.type === 'application/pdf' || file.type.includes('presentation') || file.type.includes('document');

                                                                            if (!isExtOk && !isMimeOk) {
                                                                                Toast().fire({
                                                                                    icon: "error",
                                                                                    title: "Tipe Berkas Tidak Didukung",
                                                                                    text: "Silakan unggah video (MP4/WebM/MOV), presentasi (PPT/PPTX), dokumen (PDF/DOCX), atau audio (MP3/WAV).",
                                                                                });
                                                                                return;
                                                                            }

                                                                            if (file.size > 500 * 1024 * 1024) {
                                                                                Toast().fire({
                                                                                    icon: "error",
                                                                                    title: "Berkas Terlalu Besar",
                                                                                    text: "Ukuran maksimal 500MB.",
                                                                                });
                                                                                return;
                                                                            }

                                                                            const formData = new FormData();
                                                                            formData.append("file", file);
                                                                            if (course?.course_id) formData.append("course_id", course.course_id);
                                                                            formData.append("upload_type", "curriculum");
                                                                            if (variant?.variant_id) formData.append("variant_id", variant.variant_id);
                                                                            formData.append("item_id", item?.variant_item_id || itemIndex + 1);

                                                                            const progressKey = `${variantIndex}_${itemIndex}`;
                                                                            setCurriculumUploadProgress(prev => ({
                                                                                ...prev,
                                                                                [progressKey]: { percentage: 0, isUploading: true }
                                                                            }));

                                                                            (async () => {
                                                                                try {
                                                                                    const response = await useAxios.post("file-upload/", formData, {
                                                                                        headers: { "Content-Type": "multipart/form-data" },
                                                                                        onUploadProgress: (progressEvent) => {
                                                                                            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                                                                                            setCurriculumUploadProgress(prev => ({
                                                                                                ...prev,
                                                                                                [progressKey]: { percentage: percentCompleted, isUploading: true }
                                                                                            }));
                                                                                        }
                                                                                    });

                                                                                    if (response?.data?.url) {
                                                                                        handleLessonChange(variantIndex, itemIndex, "youtubeLink", "");
                                                                                        handleLessonChange(variantIndex, itemIndex, "gdriveLink", "");
                                                                                        handleLessonChange(variantIndex, itemIndex, "uploadedFile", response.data.url);
                                                                                        handleLessonChange(variantIndex, itemIndex, "file", response.data.url);
                                                                                        handleLessonChange(variantIndex, itemIndex, "file_id", response.data.file_id || response.data.id);
                                                                                        handleLessonChange(variantIndex, itemIndex, "media_source", "upload");
                                                                                        handleLessonChange(variantIndex, itemIndex, "file_type", response.data.file_type || (file.type.startsWith('audio/') ? 'audio' : file.type === 'application/pdf' ? 'pdf' : 'video'));

                                                                                        let detectedDuration = response.data?.duration_seconds;

                                                                                        // Client-side fallback duration extraction if backend didn't extract or for instant accuracy
                                                                                        if (!detectedDuration && file) {
                                                                                            const isAudioFile = file.type.startsWith('audio/') || ['.mp3', '.wav', '.ogg', '.m4a', '.aac'].some(ext => (file.name || '').toLowerCase().endsWith(ext));
                                                                                            const isVideoFile = file.type.startsWith('video/') || ['.mp4', '.webm', '.mov', '.avi', '.mkv'].some(ext => (file.name || '').toLowerCase().endsWith(ext));

                                                                                            if (isAudioFile) {
                                                                                                try {
                                                                                                    detectedDuration = await videoOptimizer.getAudioDuration(file);
                                                                                                } catch (e) {
                                                                                                    console.warn("[Upload] Could not extract client-side audio duration:", e);
                                                                                                }
                                                                                            } else if (isVideoFile) {
                                                                                                try {
                                                                                                    detectedDuration = await videoOptimizer.getVideoDuration(file);
                                                                                                } catch (e) {
                                                                                                    console.warn("[Upload] Could not extract client-side video duration:", e);
                                                                                                }
                                                                                            }
                                                                                        }

                                                                                        if (detectedDuration) {
                                                                                            setExtractedDuration(prev => ({ ...prev, [progressKey]: detectedDuration }));
                                                                                            handleDurationInput(variantIndex, itemIndex, detectedDuration);
                                                                                        }

                                                                                        setCurriculumUploadProgress(prev => ({
                                                                                            ...prev,
                                                                                            [progressKey]: { percentage: 100, isUploading: false }
                                                                                        }));

                                                                                        setTimeout(() => autoSaveCurriculum(), 100);
                                                                                        Toast().fire({
                                                                                            icon: "success",
                                                                                            title: "Berkas Berhasil Diunggah",
                                                                                            timer: 1800,
                                                                                            showConfirmButton: false
                                                                                        });
                                                                                    }
                                                                                } catch (error) {
                                                                                    console.error("Error uploading file:", error);
                                                                                    setCurriculumUploadProgress(prev => {
                                                                                        const updated = { ...prev };
                                                                                        delete updated[progressKey];
                                                                                        return updated;
                                                                                    });
                                                                                    const errorMsg = error.response?.data?.file?.[0] || error.response?.data?.error || error.response?.data?.message || error.response?.data?.detail || "Gagal mengunggah berkas.";
                                                                                    Toast().fire({
                                                                                        icon: "error",
                                                                                        title: "Unggahan Gagal",
                                                                                        text: errorMsg,
                                                                                    });
                                                                                }
                                                                                e.target.value = '';
                                                                            })();
                                                                        }
                                                                    }}
                                                                />
                                                            </label>

                                                            {/* Upload Progress Bar */}
                                                            {curriculumUploadProgress[`${variantIndex}_${itemIndex}`]?.isUploading && (
                                                                <div className="mt-1">
                                                                    <div className="d-flex justify-content-between small text-teal mb-0" style={{ fontSize: "0.72rem" }}>
                                                                        <span><i className="fas fa-spinner fa-spin me-1"></i>Mengunggah...</span>
                                                                        <span>{curriculumUploadProgress[`${variantIndex}_${itemIndex}`]?.percentage || 0}%</span>
                                                                    </div>
                                                                    <div className="progress" style={{ height: '5px' }}>
                                                                        <div
                                                                            className="progress-bar bg-teal"
                                                                            style={{ width: `${curriculumUploadProgress[`${variantIndex}_${itemIndex}`]?.percentage || 0}%` }}
                                                                        ></div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="d-flex align-items-center gap-1">
                                                            <input
                                                                type="url"
                                                                className="form-control form-control-sm py-1"
                                                                style={{ fontSize: "0.78rem" }}
                                                                placeholder="Tempel tautan YouTube / Drive..."
                                                                value={mediaUrlInput}
                                                                onChange={(e) => setMediaUrlInput(e.target.value)}
                                                            />
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-teal px-2 py-1 text-nowrap"
                                                                style={{ fontSize: "0.78rem" }}
                                                                disabled={!mediaUrlInput.trim()}
                                                                onClick={() => {
                                                                    const trimmed = mediaUrlInput.trim();
                                                                    if (!trimmed) return;
                                                                    if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
                                                                        handleLessonChange(variantIndex, itemIndex, "youtubeLink", trimmed);
                                                                        handleLessonChange(variantIndex, itemIndex, "uploadedFile", "");
                                                                        handleLessonChange(variantIndex, itemIndex, "file", "");
                                                                        handleLessonChange(variantIndex, itemIndex, "gdriveLink", "");
                                                                        handleLessonChange(variantIndex, itemIndex, "media_source", "youtube");
                                                                        handleLessonChange(variantIndex, itemIndex, "file_type", "video");
                                                                    } else if (trimmed.includes('drive.google.com')) {
                                                                        handleLessonChange(variantIndex, itemIndex, "gdriveLink", trimmed);
                                                                        handleLessonChange(variantIndex, itemIndex, "uploadedFile", "");
                                                                        handleLessonChange(variantIndex, itemIndex, "file", "");
                                                                        handleLessonChange(variantIndex, itemIndex, "youtubeLink", "");
                                                                        handleLessonChange(variantIndex, itemIndex, "media_source", "gdrive");
                                                                        handleLessonChange(variantIndex, itemIndex, "file_type", "video");
                                                                    } else {
                                                                        handleLessonChange(variantIndex, itemIndex, "uploadedFile", trimmed);
                                                                        handleLessonChange(variantIndex, itemIndex, "file", trimmed);
                                                                        handleLessonChange(variantIndex, itemIndex, "youtubeLink", "");
                                                                        handleLessonChange(variantIndex, itemIndex, "gdriveLink", "");
                                                                        handleLessonChange(variantIndex, itemIndex, "media_source", "url");
                                                                    }
                                                                    setTimeout(() => autoSaveCurriculum(), 100);
                                                                    Toast().fire({
                                                                        icon: "success",
                                                                        title: "Tautan Disimpan",
                                                                        timer: 1500,
                                                                        showConfirmButton: false
                                                                    });
                                                                }}
                                                            >
                                                                <i className="fas fa-check"></i>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="small text-muted mt-1 pt-1 border-top d-flex align-items-center justify-content-between" style={{ fontSize: "0.72rem" }}>
                                                    <span><i className="fas fa-file-video text-teal me-1"></i>Video, Slide, PDF, Audio</span>
                                                    <span>Maks. 500MB</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bottom Row: SCORM RTE Indicator OR Lesson Completion Question Editor */}
                        {isItemScorm ? (
                            <div className="mt-2 py-1 px-2 rounded border d-flex align-items-center gap-2 small text-muted bg-light" style={{ fontSize: "0.74rem", borderLeft: "3px solid #0f766e" }}>
                                <i className="fas fa-shield-alt text-teal"></i>
                                <div>
                                    <strong>Pelacakan SCORM 1.2 Aktif:</strong> Nilai evaluasi (<code>cmi.core.score.raw</code>) dan status kelulusan (<code>cmi.core.lesson_status</code>) disinkronkan secara otomatis melalui SCORM RTE saat peserta berinteraksi.
                                </div>
                            </div>
                        ) : (
                            <LessonCompletionQuestionEditor
                                variantItemId={item?.variant_item_id}
                                onQuestionSaved={(question) => {
                                    console.log('Question saved:', question);
                                }}
                            />
                        )}
                    </>
                )}
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

    // ✨ Quizzes state for curriculum embedding & Pre/Post-Test detection
    const [courseQuizzes, setCourseQuizzes] = useState([]);
    const [availableScormModules, setAvailableScormModules] = useState([]);
    const prePostQuiz = courseQuizzes.find(q => q.quiz_type === 'pre_post_test' || q.has_pre_test || q.has_post_test) || null;
    const regularQuizzes = courseQuizzes.filter(q => q.quiz_type !== 'pre_post_test' && !q.has_pre_test && !q.has_post_test);
    const [ckEditorData, setCKEditorData] = useState("");
    const [variants, setVariants] = useState([
        {
            title: "",
            items: [{ title: "", description: "", file: "", preview: false }],
        },
    ]);

    // ✨ SCORM E-Learning detection
    const isElearningScorm = course?.course_type === 'scorm_12' ||
        course?.course_type === 'scorm_2004' ||
        course?.course_type === 'h5p' ||
        Boolean(course?.learning_module_id || course?.learning_module);

    // ✨ State for interactive SCORM Player preview modal
    const [scormPreviewModal, setScormPreviewModal] = useState({
        isOpen: false,
        title: "",
        url: "",
        moduleType: "scorm_12",
        isFullscreen: false
    });
    const [scormPlayerStatus, setScormPlayerStatus] = useState("not attempted");
    const [scormPlayerScore, setScormPlayerScore] = useState(null);
    const scormIframeRef = useRef(null);

    // SCORM 1.2 RTE API bridge for interactive preview testing by instructor
    useEffect(() => {
        if (!scormPreviewModal.isOpen) return;

        const cmi = {
            "cmi.core.student_id": "instructor_preview",
            "cmi.core.student_name": "Instruktur Penguji",
            "cmi.core.lesson_status": scormPlayerStatus,
            "cmi.core.score.raw": scormPlayerScore !== null ? String(scormPlayerScore) : "0",
            "cmi.core.lesson_location": "",
            "cmi.core.session_time": "00:00:00",
            "cmi.suspend_data": "",
            "cmi.core.entry": "ab-initio",
            "cmi.core.exit": "",
            "cmi.core.total_time": "00:00:00",
            "cmi.core.lesson_mode": "normal"
        };

        window.API = {
            LMSInitialize: (param) => {
                console.log("[Curriculum SCORM RTE] LMSInitialize:", param);
                return "true";
            },
            LMSGetValue: (element) => {
                const val = cmi[element] !== undefined ? cmi[element] : "";
                console.log(`[Curriculum SCORM RTE] LMSGetValue(${element}) ->`, val);
                return val;
            },
            LMSSetValue: (element, value) => {
                console.log(`[Curriculum SCORM RTE] LMSSetValue(${element}, ${value})`);
                cmi[element] = String(value);
                if (element === "cmi.core.lesson_status") {
                    setScormPlayerStatus(String(value).toLowerCase());
                }
                if (element === "cmi.core.score.raw") {
                    setScormPlayerScore(Number(value) || 0);
                }
                return "true";
            },
            LMSCommit: (param) => {
                console.log("[Curriculum SCORM RTE] LMSCommit:", param);
                return "true";
            },
            LMSFinish: (param) => {
                console.log("[Curriculum SCORM RTE] LMSFinish:", param);
                return "true";
            },
            LMSGetLastError: () => "0",
            LMSGetErrorString: () => "No error",
            LMSGetDiagnostic: () => "No error"
        };

        return () => {
            delete window.API;
        };
    }, [scormPreviewModal.isOpen]);

    const handleOpenScormPreview = (item) => {
        let lm = item?.learning_module_info || (item?.learning_module && typeof item.learning_module === 'object' ? item.learning_module : null) || course?.learning_module;
        if (!lm) {
            for (const v of curriculum || []) {
                for (const it of v.items || []) {
                    if (it.learning_module_info || (it.learning_module && typeof it.learning_module === 'object')) {
                        lm = it.learning_module_info || it.learning_module;
                        break;
                    }
                }
                if (lm) break;
            }
        }

        let url = "";
        if (lm?.player_url) {
            url = getMediaUrl(lm.player_url);
        } else if (lm?.id) {
            url = getMediaUrl(`/media/learning_modules/extracted_${lm.id}/${lm.entry_file || 'index.html'}`);
        } else if (course?.learning_module_id) {
            url = getMediaUrl(`/media/learning_modules/extracted_${course.learning_module_id}/index.html`);
        }

        if (!url) {
            Toast().fire({
                icon: "warning",
                title: "Modul SCORM Belum Siap",
                text: "URL pemutar modul SCORM tidak ditemukan. Pastikan modul SCORM telah berhasil diunggah."
            });
            return;
        }

        setScormPlayerStatus("not attempted");
        setScormPlayerScore(null);
        setScormPreviewModal({
            isOpen: true,
            title: item?.title || lm?.judul || course?.title || "Pratinjau Modul SCORM",
            url: url,
            moduleType: lm?.module_type || course?.course_type || "scorm_12",
            isFullscreen: false
        });
    };

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

        // ✨ Quiz Item: Validated by selecting a valid quiz and checking duplicates
        if (item.item_type === 'quiz' || item.quiz_id) {
            if (!item.quiz_id) {
                itemErrors.quiz_id = 'Silakan pilih kuis dari daftar kuis kursus';
            }
            if (!item.title || item.title.trim().length === 0) {
                itemErrors.title = 'Judul kuis tidak boleh kosong';
            }
            // Check for duplicate quiz_id across the entire curriculum
            if (item.quiz_id && Array.isArray(variants)) {
                let duplicateCount = 0;
                variants.forEach(v => {
                    (v.items || []).forEach(it => {
                        const itQuizId = it.quiz_id || (it.quiz && typeof it.quiz === 'object' ? it.quiz.quiz_id : (it.quiz || null));
                        if (itQuizId && String(itQuizId) === String(item.quiz_id)) {
                            duplicateCount++;
                        }
                    });
                });
                if (duplicateCount > 1) {
                    itemErrors.quiz_id = `Kuis "${item.title || 'ini'}" terduplikasi! Setiap kuis hanya boleh disisipkan satu kali dalam kurikulum.`;
                }
            }
            return { errors: itemErrors, warnings: itemWarnings };
        }

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

        // ✨ SCORM Lesson: Content and duration are managed directly by the SCORM package & RTE API
        const isItemScorm = isElearningScorm || Boolean(item.learning_module_id) || Boolean(item.learning_module_info) || item.file_type === 'scorm';

        if (!isItemScorm) {
            // Validate media sources for standard video - accept Google Drive, YouTube, or Uploaded File
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
                itemErrors.youtubeLink = 'Link YouTube harus dari youtube.com atau youtu.be';
            }

            // Validate duration for all standard media types
            if (hasGoogleDriveLink || hasYouTubeLink || hasUploadedFile) {
                const durationSeconds = item.duration_seconds || 0;
                if (!durationSeconds || durationSeconds === 0) {
                    itemErrors.duration = 'Durasi video harus diisi (tidak boleh 0m 0s). Durasi diekstraksi otomatis saat mengunggah file, atau gunakan tombol "Edit" untuk memasukkan durasi manual.';
                }
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

            // ✨ Fetch course quizzes for curriculum insertion and pre/post-test detection
            try {
                const quizResponse = await useAxios.get(`quiz/list-create/?course_id=${param.course_id}`);
                const quizList = Array.isArray(quizResponse.data) ? quizResponse.data : (quizResponse.data?.results || []);
                setCourseQuizzes(quizList);
            } catch (qErr) {
                console.warn("[CourseEditCurriculum] Could not fetch course quizzes:", qErr);
            }

            // ✨ Fetch available SCORM / H5P modules for curriculum insertion
            try {
                const scormResponse = await useAxios.get(`teacher/upload-elearning-module/?course_id=${param.course_id}`);
                const moduleList = Array.isArray(scormResponse.data?.modules) ? scormResponse.data.modules : [];
                setAvailableScormModules(moduleList);
            } catch (sErr) {
                console.warn("[CourseEditCurriculum] Could not fetch SCORM modules:", sErr);
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

            const courseData = courseResponse.data;
            const isCourseScorm = courseData?.course_type === 'scorm_12' ||
                courseData?.course_type === 'scorm_2004' ||
                courseData?.course_type === 'h5p' ||
                Boolean(courseData?.learning_module_id || courseData?.learning_module);

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

                        // ✨ Detect SCORM learning module
                        const itemLmInfo = item.learning_module_info || (item.learning_module && typeof item.learning_module === 'object' ? item.learning_module : courseData.learning_module);
                        const itemLmId = item.learning_module_id || (item.learning_module && typeof item.learning_module === 'object' ? item.learning_module.id : (typeof item.learning_module === 'number' ? item.learning_module : (courseData.learning_module_id || courseData.learning_module?.id)));
                        const isItemScorm = isCourseScorm || Boolean(itemLmId) || item.file_type === 'scorm';

                        return {
                            title: item.title || "",
                            description: item.description || "",
                            item_type: item.item_type || (item.quiz_id || item.quiz ? 'quiz' : 'lesson'),
                            quiz_id: item.quiz_id || (item.quiz && typeof item.quiz === 'object' ? item.quiz.quiz_id : (item.quiz || null)),
                            quiz_detail: item.quiz_detail || null,
                            gdriveLink: !isYouTubeLink && !isUploadedFile ? fileUrl : '',  // Store Google Drive links
                            youtubeLink: isYouTubeLink ? fileUrl : '',  // Store YouTube URLs
                            uploadedFile: isUploadedFile ? fileUrl : '',  // ✨ PHASE 4.110: Store uploaded file URLs
                            preview: item.preview || false,
                            variant_item_id: item.variant_item_id || item.id, // Preserve variant_item_id
                            order: item.order !== undefined ? item.order : itemIndex, // ✅ Preserve lesson order
                            duration_seconds: item.duration_seconds || null, // ✨ PHASE 4.43.9: Preserve duration_seconds from backend
                            duration_formatted: item.content_duration || null, // ✨ PHASE 4.43.9: Also preserve formatted duration for display
                            media_source: item.media_source || (isItemScorm ? 'scorm' : null),
                            learning_module_id: itemLmId || null,
                            learning_module_info: itemLmInfo ? {
                                id: itemLmInfo.id,
                                judul: itemLmInfo.judul || courseData.title,
                                module_type: itemLmInfo.module_type || courseData.course_type,
                                player_url: itemLmInfo.player_url,
                                entry_file: itemLmInfo.entry_file || "index.html"
                            } : null,
                            file_type: isItemScorm ? 'scorm' : (item.file_type || null)
                        };
                    })
                };
            }) : [
                {
                    title: isCourseScorm ? "Modul Utama" : "",
                    order: 0,
                    items: [{
                        title: isCourseScorm ? (courseData.title || "Pelajaran 1") : "",
                        description: "",
                        youtubeLink: "",
                        preview: false,
                        order: 0,
                        duration_seconds: null,
                        duration_formatted: null,
                        media_source: isCourseScorm ? 'scorm' : 'upload',
                        learning_module_id: isCourseScorm ? (courseData.learning_module_id || courseData.learning_module?.id || null) : null,
                        learning_module_info: isCourseScorm && courseData.learning_module ? {
                            id: courseData.learning_module.id,
                            judul: courseData.learning_module.judul || courseData.title,
                            module_type: courseData.learning_module.module_type || courseData.course_type,
                            player_url: courseData.learning_module.player_url,
                            entry_file: courseData.learning_module.entry_file || "index.html"
                        } : null,
                        file_type: isCourseScorm ? 'scorm' : null
                    }],
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

            trackFormChanges();
            setUiState(prev => ({
                ...prev,
                isDirty: true,
                hasUnsavedChanges: true
            }));

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
     * Delete/Clear media from lesson item (Uploaded file, YouTube, GDrive, etc.)
     */
    const handleClearLessonMedia = async (variantIndex, itemIndex) => {
        try {
            const currentItem = variants?.[variantIndex]?.items?.[itemIndex];
            const targetFileUrl = currentItem?.uploadedFile || currentItem?.file;

            // If it's an uploaded file on our server, trigger file cleanup on backend
            if (targetFileUrl && typeof targetFileUrl === 'string' && targetFileUrl.includes('/media/')) {
                try {
                    await useAxios.delete('file-cleanup/', {
                        data: {
                            file_url: targetFileUrl,
                            file_id: currentItem?.file_id
                        }
                    });
                    console.log('[Curriculum] File deleted from server:', targetFileUrl);
                } catch (cleanupErr) {
                    console.warn('[Curriculum] File cleanup warning:', cleanupErr);
                }
            }

            // Immediately clear ALL media fields in local state
            setVariants(prevVariants => {
                try {
                    const updatedVariants = [...prevVariants];
                    if (!updatedVariants[variantIndex]?.items?.[itemIndex]) return prevVariants;

                    const item = updatedVariants[variantIndex].items[itemIndex];
                    updatedVariants[variantIndex].items[itemIndex] = {
                        ...item,
                        file: "",
                        uploadedFile: "",
                        youtubeLink: "",
                        gdriveLink: "",
                        media_source: "",
                        file_type: null,
                        file_id: null,
                    };
                    return updatedVariants;
                } catch (e) {
                    console.error('[Curriculum] Error clearing media state:', e);
                    return prevVariants;
                }
            });

            // Close preview if it was open
            const previewKey = `${variantIndex}_${itemIndex}`;
            setPreviewVisibility(prev => ({
                ...prev,
                [previewKey]: false
            }));

            trackFormChanges();

            // Clear validation errors for uploaded file
            setValidationState(prev => ({
                ...prev,
                errors: {
                    ...prev.errors,
                    [`item_${variantIndex}_${itemIndex}_uploadedFile`]: null
                }
            }));

            // Persist changes to server
            setTimeout(() => {
                autoSaveCurriculum();
            }, 60);

            Toast().fire({
                icon: "success",
                title: "Media Dihapus",
                text: "Media pelajaran berhasil dilepas.",
                timer: 1500,
                showConfirmButton: false
            });
        } catch (err) {
            console.error('[Curriculum] Error in handleClearLessonMedia:', err);
            Toast().fire({
                icon: "error",
                title: "Gagal Menghapus Media",
                text: "Terjadi kesalahan saat melepas media."
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
            const currentItem = variants?.[variantIndex]?.items?.[itemIndex];
            await useAxios.delete('file-cleanup/', {
                data: {
                    file_url: fileUrl,
                    file_id: currentItem?.file_id
                }
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
        let newIndex = 0;
        setVariants(prevVariants => {
            newIndex = prevVariants.length;
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
                        duration_formatted: null,  // ✨ PHASE 4.44: Initialize duration_formatted for new items
                        media_source: isElearningScorm ? 'scorm' : 'upload',
                        learning_module_id: isElearningScorm ? (course.learning_module_id || course.learning_module?.id || null) : null,
                        learning_module_info: isElearningScorm && course.learning_module ? {
                            id: course.learning_module.id,
                            judul: course.learning_module.judul || course.title,
                            module_type: course.learning_module.module_type || course.course_type,
                            player_url: course.learning_module.player_url,
                            entry_file: course.learning_module.entry_file || "index.html"
                        } : null,
                        file_type: isElearningScorm ? 'scorm' : null
                    }],
                },
            ];
        });

        // Ensure newly added section is open/expanded
        setCollapsedSections(prev => ({
            ...prev,
            [newIndex]: false
        }));

        Toast().fire({
            icon: "success",
            title: "Bagian baru berhasil ditambahkan!",
            timer: 2000,
            showConfirmButton: false
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
    /**
     * Add an existing quiz as a curriculum item to a section
     */
    const addQuiz = (variantIndex) => {
        // Collect all quiz IDs currently used across all sections
        const usedQuizIds = new Set();
        (variants || []).forEach(v => {
            (v.items || []).forEach(it => {
                const qId = it.quiz_id || (it.quiz && typeof it.quiz === 'object' ? it.quiz.quiz_id : (it.quiz || null));
                if (qId) {
                    usedQuizIds.add(String(qId));
                }
            });
        });

        // Find available regular quizzes that haven't been inserted yet
        const availableQuizzes = regularQuizzes.filter(q => !usedQuizIds.has(String(q.quiz_id)));

        if (regularQuizzes.length === 0) {
            Swal.fire({
                icon: "info",
                title: "Belum Ada Kuis",
                text: "Kursus ini belum memiliki Kuis Pembelajaran. Silakan buat kuis terlebih dahulu di menu Kuis.",
                confirmButtonText: "Buka Menu Kuis",
                showCancelButton: true,
                cancelButtonText: "Tutup"
            }).then((res) => {
                if (res.isConfirmed) {
                    navigate(`/instructor/edit-course/${param?.course_id}/quiz/`);
                }
            });
            return;
        }

        if (availableQuizzes.length === 0) {
            Swal.fire({
                icon: "warning",
                title: "Semua Kuis Sudah Disisipkan",
                text: `Seluruh (${regularQuizzes.length}) kuis kursus yang tersedia sudah disisipkan ke dalam kurikulum. Setiap kuis hanya dapat disisipkan 1 kali untuk mencegah duplikasi alur belajar.`,
                confirmButtonText: "Kelola Kuis",
                showCancelButton: true,
                cancelButtonText: "Batal"
            }).then((res) => {
                if (res.isConfirmed) {
                    navigate(`/instructor/edit-course/${param?.course_id}/quiz/`);
                }
            });
            return;
        }

        const chosenQuiz = availableQuizzes[0];
        const updatedVariants = [...variants];
        const currentItems = updatedVariants[variantIndex].items || [];
        const maxOrder = currentItems.reduce((max, item) => Math.max(max, item.order || 0), -1);
        const newOrder = maxOrder + 1;

        updatedVariants[variantIndex].items.push({
            title: chosenQuiz.title,
            description: chosenQuiz.description || "",
            item_type: "quiz",
            quiz_id: chosenQuiz.quiz_id,
            preview: false,
            order: newOrder,
            duration_seconds: chosenQuiz.duration_minutes ? chosenQuiz.duration_minutes * 60 : null,
            duration_formatted: chosenQuiz.duration_minutes ? `${chosenQuiz.duration_minutes} Menit` : null,
            media_source: null
        });

        setVariants(updatedVariants);
        trackFormChanges();

        Toast().fire({
            icon: "success",
            title: `Kuis "${chosenQuiz.title}" berhasil disisipkan!`,
        });
    };

    const addScormLesson = (variantIndex) => {
        const updatedVariants = [...variants];
        const currentItems = updatedVariants[variantIndex].items || [];
        const maxOrder = currentItems.reduce((max, item) => Math.max(max, item.order || 0), -1);
        const newOrder = maxOrder + 1;

        const defaultLm = course?.learning_module || (availableScormModules?.length === 1 ? availableScormModules[0] : null);

        updatedVariants[variantIndex].items.push({
            title: defaultLm?.judul || "Modul Pembelajaran SCORM",
            description: defaultLm?.deskripsi || "",
            gdriveLink: "",
            youtubeLink: "",
            uploadedFile: "",
            file: "",
            preview: false,
            order: newOrder,
            duration_seconds: 2700, // 1 JP default
            duration_formatted: "45 Menit (1 JP)",
            media_source: 'scorm',
            file_type: 'scorm',
            learning_module_id: defaultLm?.id || null,
            learning_module_info: defaultLm ? {
                id: defaultLm.id,
                judul: defaultLm.judul,
                module_type: defaultLm.module_type,
                player_url: defaultLm.player_url,
                entry_file: defaultLm.entry_file || "index.html"
            } : null,
        });

        setVariants(updatedVariants);
        trackFormChanges();

        Toast().fire({
            icon: "success",
            title: "Modul SCORM Ditambahkan!",
            text: "Pelajaran dengan format SCORM 1.2 siap dikonfigurasi.",
            timer: 2000,
            showConfirmButton: false
        });
    };

    const addLesson = (variantIndex) => {
        setVariants(prevVariants => {
            if (!prevVariants || !prevVariants[variantIndex]) return prevVariants;

            const updatedVariants = [...prevVariants];
            const targetVariant = updatedVariants[variantIndex];
            const currentItems = targetVariant.items ? [...targetVariant.items] : [];
            const maxOrder = currentItems.reduce((max, item) => Math.max(max, item.order || 0), -1);
            const newOrder = maxOrder + 1;

            const newItem = {
                title: "",
                description: "",
                gdriveLink: "",  // ✅ Use gdriveLink instead of file
                youtubeLink: "",  // ✨ PHASE 4.61: Initialize youtubeLink for new items
                preview: false,
                order: newOrder, // ✅ Assign order to new lesson
                duration_seconds: null,  // ✨ PHASE 4.43.9: Initialize duration_seconds for new items
                duration_formatted: null,  // ✨ PHASE 4.44: Initialize duration_formatted for new items
                media_source: isElearningScorm ? 'scorm' : 'upload',
                learning_module_id: isElearningScorm ? (course.learning_module_id || course.learning_module?.id || null) : null,
                learning_module_info: isElearningScorm && course.learning_module ? {
                    id: course.learning_module.id,
                    judul: course.learning_module.judul || course.title,
                    module_type: course.learning_module.module_type || course.course_type,
                    player_url: course.learning_module.player_url,
                    entry_file: course.learning_module.entry_file || "index.html"
                } : null,
                file_type: isElearningScorm ? 'scorm' : null
            };

            updatedVariants[variantIndex] = {
                ...targetVariant,
                items: [...currentItems, newItem]
            };

            return updatedVariants;
        });

        // Ensure section is expanded so user sees the new lesson card
        setCollapsedSections(prev => ({
            ...prev,
            [variantIndex]: false
        }));

        Toast().fire({
            icon: "success",
            title: "Pelajaran baru berhasil ditambahkan!",
            timer: 2000,
            showConfirmButton: false
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
     * ✨ Reconcile client variants state with fresh curriculum from backend response
     * Updates variant_id and variant_item_id to prevent duplicate creation & orphaned file deletion.
     * Synchronously returns freshVariants and preserves any local draft items/sections.
     */
    const reconcileVariantsWithResponse = (updatedCourse, customBaseVariants = null) => {
        if (!updatedCourse || (!updatedCourse.curriculum && !updatedCourse.variants)) return [];

        setCourse(updatedCourse);

        const baseVariants = customBaseVariants || variants || [];

        const previousItemsMap = new Map();
        (baseVariants || []).forEach(v => {
            (v.items || []).forEach(it => {
                if (it.variant_item_id) previousItemsMap.set(String(it.variant_item_id), it);
                if (it.title) previousItemsMap.set(it.title, it);
            });
        });

        const serverVariantsList = updatedCourse.curriculum || updatedCourse.variants || [];

        const freshVariants = serverVariantsList.map((variant, index) => {
            const variantItemsList = (variant.variant_items && variant.variant_items.length > 0)
                ? variant.variant_items
                : (variant.items || []);

            const currentVariantId = variant.variant_id || variant.id;

            // Match corresponding base variant
            const baseVariant = (baseVariants || []).find(bv =>
                (currentVariantId && bv.variant_id && String(bv.variant_id) === String(currentVariantId)) ||
                (bv.order !== undefined && variant.order !== undefined && bv.order === variant.order)
            ) || (baseVariants || [])[index];

            const sortedItems = [...variantItemsList].sort((a, b) => {
                const orderA = a.order !== undefined ? a.order : 999999;
                const orderB = b.order !== undefined ? b.order : 999999;
                return orderA - orderB;
            });

            const mappedItems = sortedItems.map((item, itemIndex) => {
                const fileUrl = item.file || '';
                const isYouTubeLink = fileUrl.includes('youtube.com') || fileUrl.includes('youtu.be');
                const isUploadedFile = fileUrl.includes('/media/') ||
                    /\.(mp4|webm|ogg|avi|mov|mkv)(\?|$)/i.test(fileUrl);

                const itemIdStr = String(item.variant_item_id || item.id || '');
                const prevItem = (itemIdStr && previousItemsMap.get(itemIdStr)) || (item.title && previousItemsMap.get(item.title));

                const itemLmInfo = item.learning_module_info || (item.learning_module && typeof item.learning_module === 'object' ? item.learning_module : updatedCourse.learning_module);
                const itemLmId = item.learning_module_id || (item.learning_module && typeof item.learning_module === 'object' ? item.learning_module.id : (typeof item.learning_module === 'number' ? item.learning_module : (updatedCourse.learning_module_id || updatedCourse.learning_module?.id)));
                const isItemScorm = isElearningScorm || Boolean(itemLmId) || item.file_type === 'scorm';

                const detectedSource = isItemScorm ? 'scorm' : (isUploadedFile ? 'upload' : (isYouTubeLink ? 'youtube' : (fileUrl ? 'google_drive' : (prevItem?.media_source || null))));

                return {
                    title: item.title || '',
                    description: item.description || '',
                    item_type: item.item_type || (item.quiz_id || item.quiz ? 'quiz' : (prevItem?.item_type || 'lesson')),
                    quiz_id: item.quiz_id || (item.quiz && typeof item.quiz === 'object' ? item.quiz.quiz_id : (item.quiz || prevItem?.quiz_id || null)),
                    quiz_detail: item.quiz_detail || prevItem?.quiz_detail || null,
                    gdriveLink: !isYouTubeLink && !isUploadedFile ? fileUrl : (prevItem?.gdriveLink || ''),
                    youtubeLink: isYouTubeLink ? fileUrl : (prevItem?.youtubeLink || ''),
                    uploadedFile: isUploadedFile ? fileUrl : (prevItem?.uploadedFile || ''),
                    file: fileUrl,
                    preview: item.preview || false,
                    variant_item_id: item.variant_item_id || item.id,
                    order: item.order !== undefined ? item.order : itemIndex,
                    duration_seconds: item.duration_seconds || (prevItem?.duration_seconds || null),
                    duration_formatted: item.content_duration || (prevItem?.duration_formatted || null),
                    media_source: item.media_source || detectedSource,
                    learning_module_id: itemLmId || null,
                    learning_module_info: itemLmInfo ? {
                        id: itemLmInfo.id,
                        judul: itemLmInfo.judul || updatedCourse.title,
                        module_type: itemLmInfo.module_type || updatedCourse.course_type,
                        player_url: itemLmInfo.player_url,
                        entry_file: itemLmInfo.entry_file || "index.html"
                    } : null,
                    file_type: isItemScorm ? 'scorm' : (item.file_type || null)
                };
            });

            // ⭐ CRITICAL FIX: Preserve local draft items (e.g. newly added lesson forms that haven't been saved yet)
            if (baseVariant && Array.isArray(baseVariant.items)) {
                const serverItemIds = new Set(mappedItems.map(it => String(it.variant_item_id || '')));
                const serverItemTitles = new Set(mappedItems.map(it => it.title).filter(Boolean));

                baseVariant.items.forEach(baseItem => {
                    const hasServerId = baseItem.variant_item_id && serverItemIds.has(String(baseItem.variant_item_id));
                    const hasMatchingTitle = baseItem.title && serverItemTitles.has(baseItem.title);
                    if (!hasServerId && !hasMatchingTitle) {
                        // This is an unsaved / draft item (e.g. from "Tambah Pelajaran Baru")
                        mappedItems.push(baseItem);
                    }
                });
            }

            return {
                title: variant.title || '',
                variant_id: currentVariantId,
                order: variant.order !== undefined ? variant.order : index,
                items: mappedItems
            };
        });

        // ⭐ CRITICAL FIX: Preserve local draft variants (e.g. newly added sections that haven't been saved yet)
        if (Array.isArray(baseVariants)) {
            const serverVariantIds = new Set(freshVariants.map(v => String(v.variant_id || '')));
            const serverVariantTitles = new Set(freshVariants.map(v => v.title).filter(Boolean));

            baseVariants.forEach(baseVar => {
                const hasServerId = baseVar.variant_id && serverVariantIds.has(String(baseVar.variant_id));
                const hasMatchingTitle = baseVar.title && serverVariantTitles.has(baseVar.title);
                if (!hasServerId && !hasMatchingTitle) {
                    // This is an unsaved / draft section (e.g. from "Tambah Bagian Baru")
                    freshVariants.push(baseVar);
                }
            });
        }

        setVariants(freshVariants);
        setLessonMediaSource({});

        return freshVariants;
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
                    item.file ||
                    item.learning_module_id ||
                    item.learning_module_info ||
                    item.variant_item_id ||
                    item.item_type === 'quiz' ||
                    item.quiz_id
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
                    item.file ||
                    item.learning_module_id ||
                    item.learning_module_info ||
                    item.variant_item_id ||
                    item.item_type === 'quiz' ||
                    item.quiz_id
                )
            }));

            // Skip save if no variants
            if (!cleanedVariants || cleanedVariants.length === 0) {
                return;
            }

            // Check for duplicate quiz items to prevent saving corrupt duplicate state
            const seenAutoSaveQuizIds = new Set();
            for (const variant of cleanedVariants) {
                for (const item of (variant.items || [])) {
                    const isQuiz = item.item_type === 'quiz' || Boolean(item.quiz_id);
                    if (isQuiz && item.quiz_id) {
                        const qIdStr = String(item.quiz_id);
                        if (seenAutoSaveQuizIds.has(qIdStr)) {
                            console.warn("[AutoSave] ⚠️ Duplicate quiz detected in curriculum. Skipping auto-save.");
                            return;
                        }
                        seenAutoSaveQuizIds.add(qIdStr);
                    }
                }
            }

            console.log("[AutoSave] Saving curriculum after file upload...");

            // Prepare form data
            const formData = new FormData();
            if (course.title) formData.append("title", course.title);
            if (ckEditorData !== undefined && ckEditorData !== null) formData.append("description", ckEditorData);

            const categoryId = course.category?.id || (typeof course.category === 'number' || (typeof course.category === 'string' && course.category !== '[object Object]') ? course.category : null);
            if (categoryId) {
                formData.append("category", categoryId);
            }
            if (course.level && course.level !== 'undefined') formData.append("level", course.level);
            if (course.language && course.language !== 'undefined') formData.append("language", course.language);
            if (course.price !== undefined && course.price !== null && course.price !== 'undefined') {
                formData.append("price", course.price);
            }
            if (course.file && typeof course.file === 'string' && course.file !== 'null' && course.file !== 'undefined') {
                formData.append("file", course.file);
            } else if (course.file && typeof course.file === 'object') {
                formData.append("file", course.file);
            }
            const teacherId = UserData()?.teacher_id || course.teacher?.id || course.teacher;
            if (teacherId) {
                formData.append("teacher", teacherId);
            }

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
                        // Priority: youtube_link > gdriveLink > uploadedFile > file
                        // This ensures backend only receives ONE file/link per item
                        if (item.youtubeLink) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][youtube_link]`, item.youtubeLink);
                        } else if (item.gdriveLink) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][file]`, item.gdriveLink);
                        } else if (item.uploadedFile) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][file]`, item.uploadedFile);
                        } else if (item.file) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][file]`, item.file);
                        } else {
                            // Explicitly send empty file to signal removal if media was cleared
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][file]`, "");
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
                        if (item.item_type) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][item_type]`, item.item_type);
                        }
                        if (item.quiz_id) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][quiz_id]`, item.quiz_id);
                        }
                        const targetLmId = item.learning_module_id || (isElearningScorm ? (course.learning_module_id || course.learning_module?.id) : null);
                        if (targetLmId) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][learning_module_id]`, targetLmId);
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
                    if (response?.data) {
                        reconcileVariantsWithResponse(response.data, variants);
                    }
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
                    item.file ||
                    item.learning_module_id ||
                    item.learning_module_info ||
                    item.variant_item_id ||
                    item.item_type === 'quiz' ||
                    item.quiz_id
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
                    item.file ||
                    item.learning_module_id ||
                    item.learning_module_info ||
                    item.variant_item_id ||
                    item.item_type === 'quiz' ||
                    item.quiz_id
                )
            }));

            // Check for duplicate quiz items
            const seenPerformAutoSaveQuizIds = new Set();
            for (const variant of cleanedVariants) {
                for (const item of (variant.items || [])) {
                    const isQuiz = item.item_type === 'quiz' || Boolean(item.quiz_id);
                    if (isQuiz && item.quiz_id) {
                        const qIdStr = String(item.quiz_id);
                        if (seenPerformAutoSaveQuizIds.has(qIdStr)) {
                            console.warn("[PerformAutoSave] ⚠️ Duplicate quiz detected in curriculum. Skipping auto-save.");
                            setAutoSaveStatus("idle");
                            return;
                        }
                        seenPerformAutoSaveQuizIds.add(qIdStr);
                    }
                }
            }

            const formData = new FormData();
            if (course.title) formData.append("title", course.title);
            if (ckEditorData !== undefined && ckEditorData !== null) formData.append("description", ckEditorData);

            const categoryId = course.category?.id || (typeof course.category === 'number' || (typeof course.category === 'string' && course.category !== '[object Object]') ? course.category : null);
            if (categoryId) {
                formData.append("category", categoryId);
            }
            if (course.level && course.level !== 'undefined') formData.append("level", course.level);
            if (course.language && course.language !== 'undefined') formData.append("language", course.language);
            if (course.price !== undefined && course.price !== null && course.price !== 'undefined') {
                formData.append("price", course.price);
            }
            if (course.file && typeof course.file === 'string' && course.file !== 'null' && course.file !== 'undefined') {
                formData.append("file", course.file);
            } else if (course.file && typeof course.file === 'object') {
                formData.append("file", course.file);
            }
            const teacherId = UserData()?.teacher_id || course.teacher?.id || course.teacher;
            if (teacherId) {
                formData.append("teacher", teacherId);
            }

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
                        // Priority: youtube_link > gdriveLink > uploadedFile > file
                        // This ensures backend only receives ONE file/link per item
                        if (item.youtubeLink) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][youtube_link]`, item.youtubeLink);
                        } else if (item.gdriveLink) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][file]`, item.gdriveLink);
                        } else if (item.uploadedFile) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][file]`, item.uploadedFile);
                        } else if (item.file) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][file]`, item.file);
                        } else {
                            // Explicitly send empty file to signal removal if media was cleared
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][file]`, "");
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
                        if (item.item_type) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][item_type]`, item.item_type);
                        }
                        if (item.quiz_id) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][quiz_id]`, item.quiz_id);
                        }
                        const targetLmId = item.learning_module_id || (isElearningScorm ? (course.learning_module_id || course.learning_module?.id) : null);
                        if (targetLmId) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][learning_module_id]`, targetLmId);
                        }
                    });
                }
            });

            const targetTeacherId = UserData()?.teacher_id || course?.teacher?.id || 'admin';
            const response = await useAxios.patch(`teacher/course-update/${targetTeacherId}/${param.course_id}/`, formData);

            if (response?.data) {
                reconcileVariantsWithResponse(response.data, variants);
            }

            setAutoSaveStatus("saved");
            setLastAutoSaveTime(new Date());
            setUiState(prev => ({
                ...prev,
                isDirty: false,
                hasUnsavedChanges: false
            }));
            // ✨ Timestamp status tetap dipertahankan agar pengguna tahu kapan terakhir tersimpan
        } catch (error) {
            console.error("[AutoSave] Error:", error?.response?.data || error);
            setAutoSaveStatus("error");
            // Do NOT spam loud toast popups or loop infinitely via setTimeout
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
                    item.uploadedFile ||
                    item.learning_module_id ||
                    item.learning_module_info ||
                    item.variant_item_id ||
                    item.item_type === 'quiz' ||
                    item.quiz_id // Keep if it's already saved in database
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
                    item.uploadedFile ||
                    item.learning_module_id ||
                    item.learning_module_info ||
                    item.variant_item_id ||
                    item.item_type === 'quiz' ||
                    item.quiz_id // Keep if already saved in database
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

                // Check for duplicate quiz items across all sections
                const seenQuizMap = new Map();
                cleanedVariants.forEach((variant, vIdx) => {
                    (variant.items || []).forEach((item, iIdx) => {
                        const isQuiz = item.item_type === 'quiz' || Boolean(item.quiz_id);
                        if (isQuiz && item.quiz_id) {
                            const qIdStr = String(item.quiz_id);
                            if (seenQuizMap.has(qIdStr)) {
                                hasErrors = true;
                                const firstUsedSection = seenQuizMap.get(qIdStr);
                                newErrors[`item_${vIdx}_${iIdx}_quiz_id`] = `Kuis "${item.title || 'ini'}" sudah digunakan di Bagian ${firstUsedSection + 1}. Setiap kuis hanya boleh disisipkan satu kali.`;
                            } else {
                                seenQuizMap.set(qIdStr, vIdx);
                            }
                        }
                    });
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
            if (course.title) formData.append("title", course.title);
            if (ckEditorData !== undefined && ckEditorData !== null) formData.append("description", ckEditorData);

            const categoryId = course.category?.id || (typeof course.category === 'number' || (typeof course.category === 'string' && course.category !== '[object Object]') ? course.category : null);
            if (categoryId) {
                formData.append("category", categoryId);
            }
            if (course.level && course.level !== 'undefined') formData.append("level", course.level);
            if (course.language && course.language !== 'undefined') formData.append("language", course.language);
            if (course.price !== undefined && course.price !== null && course.price !== 'undefined') {
                formData.append("price", course.price);
            }
            if (course.file && typeof course.file === 'string' && course.file !== 'null' && course.file !== 'undefined') {
                formData.append("file", course.file);
            } else if (course.file && typeof course.file === 'object') {
                formData.append("file", course.file);
            }
            const teacherId = UserData()?.teacher_id || course.teacher?.id || course.teacher;
            if (teacherId) {
                formData.append("teacher", teacherId);
            }

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

                        // ✨ Fix media file/link handling: support all media sources (YouTube, Google Drive, Uploaded File)
                        if (item.youtubeLink) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][youtube_link]`, item.youtubeLink);
                        } else if (item.gdriveLink) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][file]`, item.gdriveLink);
                        } else if (item.uploadedFile) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][file]`, item.uploadedFile);
                        } else if (item.file) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][file]`, item.file);
                        } else {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][file]`, "");
                        }

                        // ✨ PHASE 4.187: Send media_source to remember which source was used
                        if (item.media_source) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][media_source]`, item.media_source);
                        }

                        // Handle duration data for videos
                        if (item.duration_seconds) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][duration_seconds]`, item.duration_seconds);
                        }

                        // Handle learning_module_id for SCORM / e-learning module courses
                        const targetLmId = item.learning_module_id || (isElearningScorm ? (course.learning_module_id || course.learning_module?.id) : null);
                        if (targetLmId) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][learning_module_id]`, targetLmId);
                        }

                        // Include variant_item_id for existing items
                        if (item.variant_item_id) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][variant_item_id]`, item.variant_item_id);
                        }
                        if (item.item_type) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][item_type]`, item.item_type);
                        }
                        if (item.quiz_id) {
                            formData.append(`variants[${variantIndex}][items][${itemIndex}][quiz_id]`, item.quiz_id);
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
            const targetTeacherId = UserData()?.teacher_id || course?.teacher?.id || 'admin';
            const response = await useAxios.patch(`teacher/course-update/${targetTeacherId}/${param.course_id}/`, formData);

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

            // Update course state and rebuild variants state with fresh IDs from backend
            const freshVariants = reconcileVariantsWithResponse(updatedCourse, variants);

            // Count what was actually saved, differentiating lessons and quizzes
            const savedSectionsCount = freshVariants.length;
            let savedLessonsCount = 0;
            let savedQuizzesCount = 0;

            freshVariants.forEach(variant => {
                (variant.items || []).forEach(it => {
                    const isQuiz = it.item_type === 'quiz' || Boolean(it.quiz_id) || Boolean(it.quiz);
                    if (isQuiz) {
                        savedQuizzesCount++;
                    } else {
                        savedLessonsCount++;
                    }
                });
            });

            const initialTotalItems = variants.reduce((total, variant) => total + (variant.items?.length || 0), 0);
            const savedTotalItems = savedLessonsCount + savedQuizzesCount;
            const blankSectionsCount = variants.length - cleanedVariants.length;
            const blankLessonsCount = Math.max(0, initialTotalItems - savedTotalItems);

            // ✨ PHASE 4.43.11: Handle status change when published course curriculum is updated
            const statusChanged = updatedCourse?.platform_status === "Review" && course?.platform_status === "Published";

            // Create detailed success message
            let successDetails = `✅ Successfully saved:\n`;
            successDetails += `• ${savedSectionsCount} section${savedSectionsCount !== 1 ? 's' : ''}\n`;
            successDetails += `• ${savedLessonsCount} lesson${savedLessonsCount !== 1 ? 's' : ''}\n`;
            if (savedQuizzesCount > 0) {
                successDetails += `• ${savedQuizzesCount} Kuis\n`;
            }

            if (blankSectionsCount > 0 || blankLessonsCount > 0) {
                successDetails += `\n📝 Ignored (blank items):\n`;
                if (blankSectionsCount > 0) {
                    successDetails += `• ${blankSectionsCount} empty section${blankSectionsCount !== 1 ? 's' : ''}\n`;
                }
                if (blankLessonsCount > 0) {
                    successDetails += `• ${blankLessonsCount} empty item${blankLessonsCount !== 1 ? 's' : ''}`;
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
            setLastAutoSaveTime(new Date());
            setAutoSaveStatus("saved");

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

    // Total course duration & JP calculation
    const totalCourseSeconds = (variants || []).reduce((acc, section) => {
        return acc + (section.items || []).reduce((itemAcc, it) => itemAcc + (Number(it.duration_seconds) || 0), 0);
    }, 0);
    const totalCourseJP = totalCourseSeconds > 0 ? Math.ceil(totalCourseSeconds / 2700) : 0;
    const totalActualLessons = (variants || []).reduce((acc, section) => {
        return acc + (section.items || []).filter(it => !(it.item_type === 'quiz' || Boolean(it.quiz_id) || Boolean(it.quiz))).length;
    }, 0);
    const totalQuizzes = (variants || []).reduce((acc, section) => {
        return acc + (section.items || []).filter(it => it.item_type === 'quiz' || Boolean(it.quiz_id) || Boolean(it.quiz)).length;
    }, 0);
    const totalLessons = totalActualLessons;

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

                            {/* Compact Curriculum Header Card */}
                            <div className="curriculum-header-card mb-3">
                                <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
                                    <div className="flex-grow-1">
                                        <div className="d-flex align-items-center flex-wrap gap-2 mb-1">
                                            <span className="badge bg-teal-subtle text-teal border border-teal-subtle fw-semibold px-2 py-0" style={{ fontSize: "11px" }}>
                                                <i className="fas fa-layer-group me-1"></i> Edit Kurikulum
                                            </span>
                                            <span className="badge bg-light text-muted border px-2 py-0" style={{ fontSize: "11px" }}>
                                                ID: #{param?.course_id}
                                            </span>
                                            <span className={`badge px-2 py-0 ${course?.status === "Published" ? "bg-success text-white" : "bg-secondary text-white"}`} style={{ fontSize: "11px" }}>
                                                {course?.status === "Published" ? "Terbit" : "Draf"}
                                            </span>
                                            {isElearningScorm && (
                                                <span className="badge bg-white text-teal border border-teal-subtle px-2 py-0" style={{ fontSize: "11px" }}>
                                                    <i className="fas fa-cube me-1"></i> SCORM
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="curriculum-header-title mb-0 text-dark fw-bold">
                                            {course?.title || "Kurikulum Kursus"}
                                        </h4>
                                        <p className="curriculum-header-desc text-muted mb-0 small">
                                            Atur konten materi ke dalam bagian terstruktur, modul pembelajaran, dan durasi JP.
                                        </p>
                                    </div>
                                    <div className="d-flex align-items-center justify-content-md-end flex-wrap gap-1 mt-2 mt-md-0 ms-md-auto">
                                        <Link
                                            to={`/instructor/edit-course/${param?.course_id}/`}
                                            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center"
                                            style={{ padding: "0.35rem 0.65rem", fontSize: "0.8125rem", gap: "5px" }}
                                            title="Kembali ke Edit Informasi Dasar"
                                        >
                                            <i className="fas fa-arrow-left"></i>
                                            <span>Detail Kursus</span>
                                        </Link>
                                        <Link
                                            to={`/instructor/edit-course/${param?.course_id}/quiz/`}
                                            className="btn btn-sm btn-outline-teal d-inline-flex align-items-center"
                                            style={{ padding: "0.35rem 0.65rem", fontSize: "0.8125rem", gap: "5px" }}
                                            title="Kelola Kuis Kursus"
                                        >
                                            <i className="fas fa-question-circle"></i>
                                            <span>Kuis</span>
                                        </Link>
                                        <Link
                                            to={`/instructor/edit-course/${param?.course_id}/gamification/`}
                                            className="btn btn-sm btn-outline-teal d-inline-flex align-items-center"
                                            style={{ padding: "0.35rem 0.65rem", fontSize: "0.8125rem", gap: "5px" }}
                                            title="Kelola Gamifikasi Kursus"
                                        >
                                            <i className="fas fa-gamepad"></i>
                                            <span>Gamifikasi</span>
                                        </Link>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-teal d-inline-flex align-items-center"
                                            onClick={addCurriculumSection}
                                            disabled={uiState.isSubmitting}
                                            style={{ padding: "0.35rem 0.75rem", fontSize: "0.8125rem", gap: "5px" }}
                                        >
                                            <i className="fas fa-plus"></i>
                                            <span>Tambah Bagian</span>
                                        </button>
                                        <button
                                            type="button"
                                            className={`btn btn-sm d-inline-flex align-items-center ${uiState.isDirty ? "btn-success" : "btn-outline-secondary"}`}
                                            onClick={handleSubmit}
                                            disabled={uiState.isSubmitting}
                                            style={{ padding: "0.35rem 0.75rem", fontSize: "0.8125rem", gap: "5px" }}
                                            title="Simpan Perubahan Kurikulum"
                                        >
                                            {uiState.isSubmitting ? (
                                                <>
                                                    <span className="spinner-border spinner-border-sm" role="status" style={{ width: "12px", height: "12px" }}></span>
                                                    <span>Menyimpan...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fas fa-save"></i>
                                                    <span>{uiState.isDirty ? "Simpan" : "Tersimpan"}</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Compact Metric Strip */}
                                <div className="curriculum-kpi-strip">
                                    <div className="curriculum-kpi-pill">
                                        <div className="curriculum-kpi-icon">
                                            <i className="fas fa-folder-open"></i>
                                        </div>
                                        <div>
                                            <div className="curriculum-kpi-val">{variants?.length || 0}</div>
                                            <div className="curriculum-kpi-lbl">Total Bagian</div>
                                        </div>
                                    </div>
                                    <div className="curriculum-kpi-pill">
                                        <div className="curriculum-kpi-icon">
                                            <i className="fas fa-book-reader"></i>
                                        </div>
                                        <div>
                                            <div className="curriculum-kpi-val">{totalActualLessons}</div>
                                            <div className="curriculum-kpi-lbl">Total Pelajaran</div>
                                        </div>
                                    </div>
                                    {totalQuizzes > 0 && (
                                        <div className="curriculum-kpi-pill">
                                            <div className="curriculum-kpi-icon" style={{ background: "rgba(245, 158, 11, 0.12)", color: "#f59e0b" }}>
                                                <i className="fas fa-clipboard-question"></i>
                                            </div>
                                            <div>
                                                <div className="curriculum-kpi-val">{totalQuizzes}</div>
                                                <div className="curriculum-kpi-lbl">Total Kuis</div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="curriculum-kpi-pill">
                                        <div className="curriculum-kpi-icon">
                                            <i className="fas fa-clock"></i>
                                        </div>
                                        <div>
                                            <div className="curriculum-kpi-val">
                                                {totalCourseJP > 0 ? `${totalCourseJP} JP` : `${Math.floor(totalCourseSeconds / 60)} m`}
                                            </div>
                                            <div className="curriculum-kpi-lbl">Beban Belajar</div>
                                        </div>
                                    </div>
                                    <div className="curriculum-kpi-pill">
                                        <div className="curriculum-kpi-icon" style={{
                                            background: autoSaveStatus === "saving" ? "rgba(14, 165, 233, 0.1)" :
                                                uiState.isDirty ? "rgba(245, 158, 11, 0.1)" : "rgba(16, 185, 129, 0.1)",
                                            color: autoSaveStatus === "saving" ? "#0ea5e9" :
                                                uiState.isDirty ? "#f59e0b" : "#10b981"
                                        }}>
                                            <i className={`fas ${autoSaveStatus === "saving" ? "fa-spinner fa-spin" :
                                                uiState.isDirty ? "fa-pen-clip" : "fa-check"}`}></i>
                                        </div>
                                        <div>
                                            <div className="curriculum-kpi-val" style={{ fontSize: "0.82rem" }}>
                                                {autoSaveStatus === "saving" ? "Menyimpan..." :
                                                    uiState.isDirty ? "Ada Perubahan" : "Tersinkron"}
                                            </div>
                                            <div className="curriculum-kpi-lbl">Status Draf</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="form-body-modern" ref={formRef}>
                                {/* ✨ SCORM Curriculum Banner (Compact & Refined) */}
                                {isElearningScorm && (
                                    <div className="scorm-curriculum-banner mb-3 p-3 rounded-3 border">
                                        <div className="scorm-banner-content">
                                            <div className="scorm-banner-left">
                                                <div className="scorm-banner-icon-box">
                                                    <i className="fas fa-boxes-stacked"></i>
                                                </div>
                                                <div className="scorm-banner-text-content">
                                                    <div className="scorm-banner-badges-row">
                                                        <span className="scorm-badge scorm-badge-primary">
                                                            <i className="fas fa-bolt me-1"></i>
                                                            E-Learning SCORM Terintegrasi
                                                        </span>
                                                        <span className="scorm-badge scorm-badge-type">
                                                            <i className="fas fa-layer-group me-1"></i>
                                                            {course?.learning_module?.module_type?.toUpperCase() || course?.course_type?.toUpperCase() || 'SCORM 1.2'}
                                                        </span>
                                                        <span className="scorm-badge scorm-badge-load">
                                                            <i className="fas fa-graduation-cap me-1"></i>
                                                            Total Beban: <strong>{totalCourseJP} JP</strong>
                                                            {totalCourseSeconds > 0 ? (
                                                                <span className="scorm-badge-duration">({Math.floor(totalCourseSeconds / 3600)}j {Math.floor((totalCourseSeconds % 3600) / 60)}m)</span>
                                                            ) : (
                                                                <span className="scorm-badge-pending">(Belum diatur)</span>
                                                            )}
                                                        </span>
                                                    </div>
                                                    <h6 className="scorm-banner-title">
                                                        {course?.learning_module?.judul || course?.title || 'Paket SCORM E-Learning'}
                                                    </h6>
                                                    <p className="scorm-banner-desc">
                                                        Modul interaktif SCORM terhubung otomatis tanpa perlu mengunggah video secara manual.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="scorm-banner-actions">
                                                <button
                                                    type="button"
                                                    className="scorm-banner-preview-btn"
                                                    onClick={() => handleOpenScormPreview({
                                                        title: course?.learning_module?.judul || course?.title,
                                                        learning_module_info: course?.learning_module || curriculum?.[0]?.items?.[0]?.learning_module_info
                                                    })}
                                                    title="Buka simulasi pratinjau modul SCORM"
                                                >
                                                    <i className="fas fa-play"></i>
                                                    <span>Uji Coba SCORM</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

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
                                            <i className={`fas ${uiState.submitStatus === 'success' ? 'fa-check-circle' :
                                                uiState.submitStatus === 'error' ? 'fa-exclamation-circle' :
                                                    'fa-info-circle'
                                                } me-2 mt-1`} style={{ fontSize: '1.2rem' }}></i>
                                            <div style={{ whiteSpace: 'pre-line', flex: 1 }}>
                                                {uiState.submitMessage}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 📌 Pre-Test: Otomatis di Awal Kurikulum */}
                                <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px', background: 'linear-gradient(135deg, #f0fdf4 0%, #e8f5e9 100%)', borderLeft: '5px solid #10b981' }}>
                                    <div className="card-body p-3 p-md-4">
                                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                                            <div className="d-flex align-items-center gap-3">
                                                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                                                    <i className="fas fa-clipboard-check"></i>
                                                </div>
                                                <div>
                                                    <div className="d-flex align-items-center gap-2 mb-1">
                                                        <span className="badge bg-success text-white px-2 py-1" style={{ fontSize: '11px', letterSpacing: '0px' }}>LANGKAH 1 (OTOMATIS)</span>
                                                        <h6 className="mb-0 fw-bold text-dark">Pre-Test Diagnostik</h6>
                                                    </div>
                                                    {prePostQuiz ? (
                                                        <p className="mb-0 small text-muted">
                                                            <strong className="text-dark">{prePostQuiz.title}</strong> &bull; {prePostQuiz.total_questions || prePostQuiz.questions?.length || 0} Soal &bull; <span className="text-success fw-semibold"><i className="fas fa-check-circle me-1"></i>Aktif</span>
                                                        </p>
                                                    ) : (
                                                        <p className="mb-0 small text-muted">
                                                            Kursus ini belum memiliki Pre/Post-Test. Peserta akan langsung memulai dari Bagian 1.
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <Link
                                                    to={`/instructor/edit-course/${param?.course_id}/quiz/`}
                                                    className="btn btn-sm btn-outline-success fw-semibold d-inline-flex align-items-center gap-1 shadow-sm"
                                                    style={{ borderRadius: '8px' }}
                                                >
                                                    <i className="fas fa-cog"></i>
                                                    <span>{prePostQuiz ? "Kelola Soal Pre-Test" : "+ Buat Pre & Post-Test"}</span>
                                                </Link>
                                            </div>
                                        </div>
                                        <div className="mt-2 pt-2 border-top border-success border-opacity-10">
                                            <small className="text-secondary d-flex align-items-center gap-1">
                                                <i className="fas fa-info-circle text-success"></i>
                                                Pre-test otomatis muncul di urutan pertama pada antarmuka belajar peserta tanpa perlu diurutkan manual di sini.
                                            </small>
                                        </div>
                                    </div>
                                </div>

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
                                                        addScormLesson={addScormLesson}
                                                        addQuiz={addQuiz}
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
                                                                                    variants={variants}
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
                                                                                    handleClearLessonMedia={handleClearLessonMedia}
                                                                                    lessonLinkInputs={lessonLinkInputs}  // ✨ PHASE 4.175: Temporary link inputs
                                                                                    setLessonLinkInputs={setLessonLinkInputs}  // ✨ PHASE 4.175: Setter for temp link inputs
                                                                                    formatSecondsToHMS={formatSecondsToHMS}  // ✨ PHASE 4.198: Format seconds to hh:mm:ss
                                                                                    extractedDuration={extractedDuration}  // ✨ PHASE 4.204: Extracted duration state
                                                                                    setExtractedDuration={setExtractedDuration}  // ✨ PHASE 4.204: Setter for extracted duration
                                                                                    isElearningScorm={isElearningScorm}
                                                                                    onPreviewScorm={handleOpenScormPreview}
                                                                                    courseQuizzes={courseQuizzes}
                                                                                    availableScormModules={availableScormModules}
                                                                                    setAvailableScormModules={setAvailableScormModules}
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

                                {/* ✨ Tombol Tambah Bagian Baru: Di atas card-body Post-Test Evaluasi Akhir */}
                                <div className="d-flex justify-content-end align-items-center mt-3 mb-3">
                                    <button
                                        type="button"
                                        className="btn btn-teal btn-sm px-3 py-1 fw-semibold d-inline-flex align-items-center gap-1 shadow-sm"
                                        onClick={addCurriculumSection}
                                        disabled={uiState.isSubmitting}
                                    >
                                        <i className="fas fa-plus"></i>
                                        <span>Tambah Bagian Baru</span>
                                    </button>
                                </div>

                                {/* 📌 Post-Test: Otomatis di Akhir Kurikulum */}
                                <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px', background: 'linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)', borderLeft: '5px solid #ef4444' }}>
                                    <div className="card-body p-3 p-md-4">
                                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                                            <div className="d-flex align-items-center gap-3 flex-wrap">
                                                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#ef4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                                                    <i className="fas fa-award"></i>
                                                </div>
                                                <div>
                                                    <div className="d-flex align-items-center gap-2 mb-1">
                                                        <span className="badge bg-danger text-white px-2 py-1" style={{ fontSize: '11px', letterSpacing: '0px' }}>LANGKAH AKHIR (OTOMATIS)</span>
                                                        <h6 className="mb-0 fw-bold text-dark">Post-Test Evaluasi Akhir</h6>
                                                    </div>
                                                    {prePostQuiz ? (
                                                        <p className="mb-0 small text-muted">
                                                            <strong className="text-dark">{prePostQuiz.title} (Post-test)</strong> &bull; {prePostQuiz.total_questions || prePostQuiz.questions?.length || 0} Soal &bull; <span className="text-danger fw-semibold"><i className="fas fa-lock me-1"></i>Terbuka setelah seluruh kurikulum dan kuis lulus</span>
                                                        </p>
                                                    ) : (
                                                        <p className="mb-0 small text-muted">
                                                            Kursus ini belum memiliki Pre/Post-Test.
                                                        </p>
                                                    )}
                                                </div>
                                                {/* ✨ Tombol Kelola Soal Post Test: Di bagian kanan d-flex align-items-center gap-3 */}
                                                <div className="ms-auto ms-sm-2">
                                                    <Link
                                                        to={`/instructor/edit-course/${param?.course_id}/quiz/`}
                                                        className="btn btn-sm btn-outline-danger fw-semibold d-inline-flex align-items-center gap-1 shadow-sm"
                                                        style={{ borderRadius: '8px' }}
                                                    >
                                                        <i className="fas fa-cog"></i>
                                                        <span>{prePostQuiz ? "Kelola Soal Post-Test" : "+ Buat Pre & Post-Test"}</span>
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-2 pt-2 border-top border-danger border-opacity-10">
                                            <small className="text-secondary d-flex align-items-center gap-1">
                                                <i className="fas fa-info-circle text-danger"></i>
                                                Post-test otomatis muncul di urutan paling akhir pada antarmuka belajar peserta setelah seluruh materi dan kuis diselesaikan.
                                            </small>
                                        </div>
                                    </div>
                                </div>

                                {/* Submit Section */}
                                <div className="curriculum-submit-bar">
                                    {/* ✨ Urutan bagian dan pelajaran teks di atas alert catatan */}
                                    <div className="text-muted small mb-2 d-flex align-items-center gap-1">
                                        <i className="fas fa-info-circle text-teal"></i>
                                        <span>Urutan bagian dan pelajaran dapat disusun ulang dengan menyeret ikon pegangan.</span>
                                    </div>

                                    {/* Info message about blank sections */}
                                    <div className="alert alert-light border d-flex align-items-center py-2 px-3 mb-2 text-muted small" style={{ backgroundColor: "#f8fafc" }}>
                                        <i className="fas fa-info-circle text-teal me-2 fs-6"></i>
                                        <div>
                                            <strong>Catatan:</strong> Bagian atau pelajaran kosong otomatis diabaikan saat kurikulum disimpan.
                                        </div>
                                    </div>

                                    {/* Auto-save status and action buttons */}
                                    <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
                                        {/* Auto-save status info on the left */}
                                        <div className="form-status-info">
                                            {autoSaveStatus === "saving" ? (
                                                <div className="text-info small d-flex align-items-center">
                                                    <span className="spinner-border spinner-border-sm me-1" style={{ width: '13px', height: '13px', display: 'inline-block' }}></span>
                                                    <span>Menyimpan kurikulum...</span>
                                                </div>
                                            ) : uiState.isDirty ? (
                                                <div className="text-secondary small d-flex align-items-center">
                                                    <span className="spinner-border spinner-border-sm text-warning me-1" style={{ width: '13px', height: '13px', display: 'inline-block' }}></span>
                                                    <span>Ada perubahan kurikulum yang belum disimpan...</span>
                                                </div>
                                            ) : autoSaveStatus === "error" ? (
                                                <div className="text-danger small d-flex align-items-center">
                                                    <i className="fas fa-exclamation-circle text-danger me-1"></i>
                                                    <span>Gagal menyimpan otomatis, silakan klik tombol Simpan.</span>
                                                </div>
                                            ) : lastAutoSaveTime ? (
                                                <div className="text-muted small d-flex align-items-center">
                                                    <i className="fas fa-check-circle text-success me-1"></i>
                                                    <span>
                                                        Tersimpan otomatis pada {lastAutoSaveTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(/:/g, ".")}
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="text-muted small d-flex align-items-center gap-2">
                                                    <i className="fas fa-check-circle text-success me-1"></i>
                                                    <span>Semua struktur kurikulum tersimpan</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="d-flex align-items-center gap-2">
                                            <button
                                                type="submit"
                                                className="btn btn-teal btn-sm px-3 py-1 fw-semibold d-inline-flex align-items-center gap-2 shadow-sm"
                                                disabled={uiState.isSubmitting}
                                            >
                                                {uiState.isSubmitting ? (
                                                    <>
                                                        <span className="spinner-border spinner-border-sm" role="status" style={{ width: "12px", height: "12px" }}></span>
                                                        <span>Menyimpan...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="fas fa-save"></i>
                                                        <span>Simpan Perubahan Kurikulum</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Validation Summary */}
                                    {validationState.summary.errors.length > 0 && (
                                        <div className="validation-summary mt-2 pt-2 border-top">
                                            <div className="validation-errors">
                                                <strong className="small">
                                                    <i className="fas fa-exclamation-triangle me-1 text-danger"></i>
                                                    Silakan perbaiki kesalahan berikut:
                                                </strong>
                                                <ul className="mt-1 mb-0 small text-danger">
                                                    {validationState.summary.errors.map((error, index) => (
                                                        <li key={index}>{error}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )}
                                </div>


                            </form>

                            {/* ✨ Interactive SCORM Player Modal for Instructor Preview */}
                            {scormPreviewModal.isOpen && (
                                <div
                                    className="modal fade show d-block"
                                    tabIndex="-1"
                                    style={{ backgroundColor: "rgba(0,0,0,0.7)", zIndex: 1060 }}
                                >
                                    <div className={`modal-dialog modal-dialog-centered ${scormPreviewModal.isFullscreen ? "modal-fullscreen" : "modal-xl"}`} style={{ maxWidth: scormPreviewModal.isFullscreen ? "100%" : "1100px" }}>
                                        <div className="modal-content border-0 shadow-lg rounded-3 overflow-hidden">
                                            <div className="modal-header bg-dark text-white py-3 px-4 d-flex align-items-center justify-content-between">
                                                <div className="d-flex align-items-center gap-2">
                                                    <span className="badge bg-teal text-white px-2 py-1">
                                                        <i className="fas fa-cube me-1"></i>
                                                        {scormPreviewModal.moduleType.toUpperCase()}
                                                    </span>
                                                    <h6 className="modal-title mb-0 fw-bold text-white">
                                                        {scormPreviewModal.title}
                                                    </h6>
                                                </div>
                                                <div className="d-flex align-items-center gap-3">
                                                    <div className="d-none d-sm-flex align-items-center gap-2 bg-secondary bg-opacity-25 px-2 py-1 rounded small">
                                                        <span className="text-light opacity-75">Status RTE:</span>
                                                        <span className={`badge ${scormPlayerStatus === 'completed' || scormPlayerStatus === 'passed' ? 'bg-success' :
                                                            scormPlayerStatus === 'failed' ? 'bg-danger' : 'bg-warning text-dark'
                                                            }`}>
                                                            {scormPlayerStatus}
                                                        </span>
                                                        {scormPlayerScore !== null && (
                                                            <span className="badge bg-info text-dark">
                                                                Skor: {scormPlayerScore}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-light border-0"
                                                        onClick={() => setScormPreviewModal(prev => ({ ...prev, isFullscreen: !prev.isFullscreen }))}
                                                        title={scormPreviewModal.isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
                                                    >
                                                        <i className={`fas fa-${scormPreviewModal.isFullscreen ? 'compress' : 'expand'}`}></i>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-close btn-close-white"
                                                        onClick={() => setScormPreviewModal(prev => ({ ...prev, isOpen: false }))}
                                                        aria-label="Tutup"
                                                    ></button>
                                                </div>
                                            </div>
                                            <div className="modal-body p-0 bg-black" style={{ minHeight: scormPreviewModal.isFullscreen ? "calc(100vh - 60px)" : "620px" }}>
                                                {scormPreviewModal.url ? (
                                                    <iframe
                                                        ref={scormIframeRef}
                                                        src={scormPreviewModal.url}
                                                        title="SCORM Player Simulation"
                                                        className="w-100 h-100 border-0"
                                                        style={{
                                                            minHeight: scormPreviewModal.isFullscreen ? "calc(100vh - 60px)" : "620px",
                                                            display: "block"
                                                        }}
                                                        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                                                        allowFullScreen
                                                    />
                                                ) : (
                                                    <div className="text-center p-5 text-white-50">
                                                        <i className="fas fa-exclamation-triangle fa-2x mb-3 text-warning"></i>
                                                        <p>URL konten SCORM tidak dapat dimuat.</p>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="modal-footer bg-light py-2 px-4 d-flex justify-content-between">
                                                <small className="text-muted">
                                                    <i className="fas fa-info-circle me-1 text-primary"></i>
                                                    Uji interaksi modul SCORM langsung menggunakan RTE API Bridge bawaan LMS Setjen DPD RI.
                                                </small>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-secondary"
                                                    onClick={() => setScormPreviewModal(prev => ({ ...prev, isOpen: false }))}
                                                >
                                                    Tutup Pratinjau
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </section>
            <Footer />
        </>
    );
}

export default React.memo(CourseEditCurriculum);

