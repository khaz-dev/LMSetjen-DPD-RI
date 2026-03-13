/**
 * ✨ PHASE 11.13: Custom hook for managing Pelajaran (Lectures) Tab state
 * 
 * Extracts all Pelajaran-related state management from CourseDetail.jsx
 * Handles:
 * - Video player state (variant item, autoplay, playing state, etc.)
 * - Progress tracking (completion percentage, stats)
 * - Lesson resumption (seek position, resume flag)
 * - Certificate checks
 * - Progress/completion refs for inter-component communication
 */

import { useState, useRef, useCallback } from 'react';

export const usePelajaranTab = () => {
    // ============================================
    // Course Progress State
    // ============================================
    const [isProgressCardLoading, setIsProgressCardLoading] = useState(true);
    const [completionPercentage, setCompletionPercentage] = useState(0);
    const [completionStats, setCompletionStats] = useState({
        totalLessons: 0,
        completedLessons: 0,
        totalQuizzes: 0,
        passedQuizzes: 0
    });

    // ============================================
    // Video Player State (shared with LecturesTab)
    // ============================================
    // ✨ PHASE 4.86: Variant item instead of show/hide
    const [variantItem, setVariantItem] = useState(null);
    const [autoplayVideo, setAutoplayVideo] = useState(false);  // ✨ PHASE 4.103: Track if video should autoplay
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);  // ✨ PHASE 4.105: Track if video is currently playing
    const [seekPosition, setSeekPosition] = useState(null);  // ✨ PHASE 4.117: Position to seek to when video loads
    const [isResuming, setIsResuming] = useState(false);  // ✨ PHASE 4.117: Flag to prevent progress saves during resume
    
    // ============================================
    // Certificate State
    // ============================================
    // ✨ PHASE 4.146: Certificate state to hide video player when certificate exists
    const [existingCertificate, setExistingCertificate] = useState(null);
    const [certificateCheckLoading, setCertificateCheckLoading] = useState(false);

    // ============================================
    // Refs for Video Player and Progress Updates
    // ============================================
    const videoPlayerRef = useRef(null);  // ✨ PHASE 4.105: Ref to VideoPlayer component
    const lecturesTabProgressRef = useRef(null);  // ✨ PHASE 4.115: Ref to external progress update callback
    const lecturesTabCompletionRef = useRef(null);  // ✨ PHASE 4.133: Ref to lesson completion callback

    // ============================================
    // Progress Throttling Refs
    // ============================================
    const lastProgressSaveRef = useRef(0);  // ✨ PHASE 4.116+: Time-based throttling
    const lastProgressItemIdRef = useRef(null);  // ✨ PHASE 4.161: Track which video we saved for
    const firstProgressReceivedRef = useRef(false);  // ✨ PHASE 4.162: Track if received first progress
    
    // ============================================
    // State Refs (to avoid closure issues during drag/resize)
    // ============================================
    const isResumingRef = useRef(false);
    const variantItemRef = useRef(null);
    const courseRef = useRef(null);

    // ============================================
    // Syncronization Effects Setup
    // ============================================
    // Keep refs in sync with state (to be used in useEffect)
    const syncRefsWithState = useCallback(() => {
        return {
            syncIsResuming: (value) => { isResumingRef.current = value; },
            syncVariantItem: (value) => { variantItemRef.current = value; },
            syncCourse: (value) => { courseRef.current = value; }
        };
    }, []);

    // ============================================
    // Progress Calculation
    // ============================================
    /**
     * Calculate overall completion percentage including lessons and quizzes
     */
    const calculateCompletionPercentage = useCallback((totalLessons, completedLessons, totalQuizzes = 0, passedQuizzes = 0) => {
        let percentageCompleted = 0;

        if (totalLessons > 0) {
            const lessonPercentage = (completedLessons / totalLessons) * 100;
            percentageCompleted += lessonPercentage * 0.7;  // 70% weight to lessons
        }

        if (totalQuizzes > 0) {
            const quizPercentage = (passedQuizzes / totalQuizzes) * 100;
            percentageCompleted += quizPercentage * 0.3;  // 30% weight to quizzes
        }

        setCompletionPercentage(Math.round(percentageCompleted));
        setCompletionStats({
            totalLessons,
            completedLessons,
            totalQuizzes,
            passedQuizzes
        });

        return Math.round(percentageCompleted);
    }, []);

    // ============================================
    // Video Player Controls
    // ============================================
    const toggleVideoPlayPause = useCallback(() => {
        if (videoPlayerRef.current?.togglePlayPause) {
            videoPlayerRef.current.togglePlayPause();
        }
    }, []);

    /**
     * Handle lesson play with autoplay
     * Saves lesson to localStorage for hard refresh recovery
     */
    const handlePlayLessonWithAutoplay = useCallback((lesson) => {
        setVariantItem(lesson);
        setAutoplayVideo(true);
        
        // ✨ PHASE 4.116: Save lesson to localStorage for hard refresh recovery
        if (lesson?.variant_item_id) {
            localStorage.setItem('selectedLesson', JSON.stringify(lesson));
        }
    }, []);

    // ============================================
    // Progress Callbacks Setup
    // ============================================
    /**
     * Register external callback for progress updates
     * Used by LecturesTab to update progress status in real-time
     */
    const handleProgressUpdateCallback = useCallback((callback) => {
        lecturesTabProgressRef.current = callback;
    }, []);

    /**
     * Mark lesson as completed callback
     * Triggers external lesson completion handlers
     */
    const handleMarkLessonAsCompletedCallback = useCallback((lessonId, isAutoComplete) => {
        if (lecturesTabCompletionRef.current) {
            lecturesTabCompletionRef.current(lessonId, isAutoComplete);
        }
    }, []);

    /**
     * Register lesson completion callback
     * Used to notify when a lesson is marked as complete
     */
    const handleLessonCompletionRegistration = useCallback((callback) => {
        lecturesTabCompletionRef.current = callback;
    }, []);

    // ============================================
    // Certificate Management
    // ============================================
    /**
     * Reset certificate state
     */
    const clearCertificate = useCallback(() => {
        setExistingCertificate(null);
        setCertificateCheckLoading(false);
    }, []);

    /**
     * Reset video player state
     */
    const resetVideoPlayerState = useCallback(() => {
        setVariantItem(null);
        setAutoplayVideo(false);
        setIsVideoPlaying(false);
        setSeekPosition(null);
        setIsResuming(false);
    }, []);

    // ============================================
    // Return all state and handlers
    // ============================================
    return {
        // Progress state
        isProgressCardLoading,
        setIsProgressCardLoading,
        completionPercentage,
        setCompletionPercentage,
        completionStats,
        setCompletionStats,

        // Video player state
        variantItem,
        setVariantItem,
        autoplayVideo,
        setAutoplayVideo,
        isVideoPlaying,
        setIsVideoPlaying,
        seekPosition,
        setSeekPosition,
        isResuming,
        setIsResuming,

        // Certificate state
        existingCertificate,
        setExistingCertificate,
        certificateCheckLoading,
        setCertificateCheckLoading,

        // Refs
        videoPlayerRef,
        lecturesTabProgressRef,
        lecturesTabCompletionRef,
        lastProgressSaveRef,
        lastProgressItemIdRef,
        firstProgressReceivedRef,
        isResumingRef,
        variantItemRef,
        courseRef,

        // Methods
        calculateCompletionPercentage,
        toggleVideoPlayPause,
        handlePlayLessonWithAutoplay,
        handleProgressUpdateCallback,
        handleMarkLessonAsCompletedCallback,
        handleLessonCompletionRegistration,
        clearCertificate,
        resetVideoPlayerState,
        syncRefsWithState
    };
};
