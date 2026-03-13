/**
 * ✨ PHASE 11.13: PelajaranTabContainer Component
 * 
 * Manages all Pelajaran (Lectures) Tab related functionality
 * Uses the usePelajaranTab hook to manage state
 * Handles all video player coordination and progress tracking
 * 
 * Benefits:
 * - Clean separation of concerns
 * - Reduced CourseDetail.jsx complexity
 * - Self-contained Pelajaran logic
 * - Single place to manage all lecture-related state
 */

import React, { useEffect, useCallback, useState } from 'react';
import LecturesTab from './LecturesTab';
import VideoPlayer from './VideoPlayer';
import { usePelajaranTab } from '../../utils/usePelajaranTab';
import { getVariantContextData } from '../../utils/variantContextUtils';
import apiInstance from '../../utils/axios';
import './PelajaranTab.css';

const PelajaranTabContainer = ({
    course,
    enrollmentId,
    activeTab,
    quizShow,
    isQuizActive,
    fetchCourseDetail,
    onCompletionPercentageChange
}) => {
    // Get all Pelajaran related state and methods
    const pelajaran = usePelajaranTab();

    // Compute variant context (which bagian contains the current pelajaran)
    const [variantContext, setVariantContext] = useState(null);

    // ============================================
    // Compute Variant Context
    // ============================================
    useEffect(() => {
        if (!pelajaran.variantItem || !course?.curriculum) {
            setVariantContext(null);
            return;
        }

        // Find the variant (bagian) that contains this variantItem
        for (const variant of course.curriculum) {
            if (variant.variant_items?.some(item => item.variant_item_id === pelajaran.variantItem.variant_item_id)) {
                setVariantContext(variant);
                return;
            }
        }

        setVariantContext(null);
    }, [pelajaran.variantItem?.variant_item_id, course?.curriculum]);

    // ============================================
    // Auto-scroll to video player
    // ============================================
    useEffect(() => {
        if (pelajaran.variantItem) {
            const videoPlayerWrapper = document.getElementById('video-player-wrapper');
            if (videoPlayerWrapper) {
                videoPlayerWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }, [pelajaran.variantItem?.variant_item_id]);

    // ============================================
    // Load Saved Lesson on Mount
    // ============================================
    useEffect(() => {
        // ✨ PHASE 4.116+: Restore lesson from localStorage on page load (hard refresh recovery)
        if (!course?.course?.id) return;

        const savedLessonData = localStorage.getItem('selectedLesson');
        if (savedLessonData) {
            try {
                const lessonData = JSON.parse(savedLessonData);
                if (lessonData && lessonData.variant_item_id) {
                    // Verify the lesson still exists in current course before restoring
                    const lessonExists = course.curriculum?.some(v =>
                        v.variant_items?.some(item => item.variant_item_id === lessonData.variant_item_id)
                    );

                    if (lessonExists && !pelajaran.variantItem) {
                        pelajaran.setVariantItem(lessonData);
                    }
                }
            } catch (e) {
                console.error('Failed to restore lesson from localStorage:', e);
            }
        }
    }, [course?.course?.id]);

    // ============================================
    // Check for Existing Certificate
    // ============================================
    const checkCertificateExists = useCallback(async () => {
        if (!course?.course?.course_id) return;

        pelajaran.setCertificateCheckLoading(true);
        try {
            const response = await apiInstance.get(
                `/api/v1/student/certificates/?course_id=${course.course.course_id}&limit=1`
            );

            if (response?.data?.results?.length > 0) {
                pelajaran.setExistingCertificate(response.data.results[0]);
            }
        } catch (error) {
            console.error('[PelajaranTabContainer] Error checking certificate:', error);
        } finally {
            pelajaran.setCertificateCheckLoading(false);
        }
    }, [course?.course?.course_id, pelajaran]);

    useEffect(() => {
        if (course?.course?.course_id) {
            checkCertificateExists();
        }
    }, [course?.course?.course_id, checkCertificateExists]);

    // ============================================
    // Sync Completion Percentage to Parent
    // ============================================
    useEffect(() => {
        if (onCompletionPercentageChange) {
            onCompletionPercentageChange(pelajaran.completionPercentage);
        }
    }, [pelajaran.completionPercentage, onCompletionPercentageChange]);

    // ============================================
    // Notify parent of lesson selection for auto-scroll
    // ============================================
    useEffect(() => {
        // Keep course ref in sync for video progress handler
        pelajaran.courseRef.current = course;
    }, [course, pelajaran]);

    // ============================================
    // Notify parent of variantItem changes for sync
    // ============================================
    useEffect(() => {
        pelajaran.variantItemRef.current = pelajaran.variantItem;
    }, [pelajaran.variantItem]);

    // ============================================
    // Render
    // ============================================
    return (
        <>
            {/* ✨ PHASE 4.86: Inline VideoPlayer - displays when variantItem is selected and certificate tab not active */}
            {/* ✨ PHASE 4.224: Hide video player when certificate is displayed */}
            {/* ✨ PHASE 4.225+: Hide video player only when quiz is active AND on quiz tab */}
            {/* ✨ PHASE 4.9+: Show video player on Pelajaran, Catatan, and Diskusi tabs even if quiz was active */}
            {/* ✨ PHASE 42.7 CRITICAL FIX: NEVER use dynamic key or conditional rendering for VideoPlayer
                ROOT CAUSE: Dynamic key={variantItem.variant_item_id} forces React to DESTROY and RECREATE the component on every lesson switch
                This unmounts VideoPlayer → YouTube player destroyed → YouTube container removed from DOM
                Then VideoPlayer remounts → new container created → YouTube API tries insertBefore() with stale cached reference
                Result: insertBefore() fails because cached reference node no longer exists in DOM tree
                
                SOLUTION: Always render VideoPlayer unconditionally, REMOVE the dynamic key, use CSS to hide/show
                This ensures: VideoPlayer component persists in React tree, YouTube player never destroyed, clean lesson switching
               */}
            <div id="video-player-wrapper" className="video-player-wrapper mb-4" style={{ display: pelajaran.variantItem && !(pelajaran.existingCertificate?.image_file_url && activeTab === 'certificate') && !(activeTab === 'quiz' && (quizShow || isQuizActive)) ? 'block' : 'none' }}>
                    <VideoPlayer
                        ref={pelajaran.videoPlayerRef}
                        variantItem={pelajaran.variantItem}
                        variantContext={variantContext}  // ✨ PHASE 6.3+: Pass bagian context for title formatting
                        courseId={course?.course?.id}  // ✨ PHASE 4.144+: Pass courseId for completion endpoint
                        onClose={() => {
                            pelajaran.setVariantItem(null);
                            pelajaran.setAutoplayVideo(false);  // ✨ PHASE 4.103: Reset autoplay when closing video
                            pelajaran.setIsVideoPlaying(false);  // ✨ PHASE 4.105: Reset playing state
                            pelajaran.setSeekPosition(null);  // ✨ PHASE 4.117: Reset seek position
                            pelajaran.setIsResuming(false);  // ✨ PHASE 4.117: Reset resume flag
                        }}
                        handleMarkLessonAsCompleted={pelajaran.handleMarkLessonAsCompletedCallback}  // ✨ PHASE 4.143+: Use memoized callback
                        autoplay={pelajaran.autoplayVideo}  // ✨ PHASE 4.103: Pass autoplay state from lesson click handler
                        onPlayingChange={pelajaran.setIsVideoPlaying}  // ✨ PHASE 4.105: Track playing state
                        onProgress={undefined}  // Will be set by CourseDetail for full coordination
                        seekPosition={pelajaran.seekPosition}  // ✨ PHASE 4.117: Pass seek position for resume
                    />
                </div>

            {/* Lectures Tab Component */}
            <LecturesTab
                course={course}
                enrollmentId={enrollmentId}
                fetchCourseDetail={fetchCourseDetail}
                completionPercentage={pelajaran.completionPercentage}
                variantItem={pelajaran.variantItem}
                setVariantItem={pelajaran.handlePlayLessonWithAutoplay}  // ✨ PHASE 4.103: Use autoplay handler
                isVideoPlaying={pelajaran.isVideoPlaying}
                toggleVideoPlayPause={pelajaran.toggleVideoPlayPause}  // ✨ PHASE 4.105: Pass toggle function
                onProgressUpdate={pelajaran.handleProgressUpdateCallback}
                onLessonCompletion={pelajaran.handleLessonCompletionRegistration}
            />
        </>
    );
};

export default React.memo(PelajaranTabContainer);
