import React, { useState, useRef, useEffect } from "react";
import { Modal } from "react-bootstrap";
import ReactPlayer from "react-player";
import useAxios from "../../utils/useAxios";
import apiInstance from "../../utils/axios";
import UserData from "../../views/plugin/UserData";
import Toast from "../../views/plugin/Toast";
import { getMediaUrl, DEFAULT_IMAGE_URL } from "../../utils/constants";
import "./LecturesTab.css";

const LecturesTab = ({
    course,
    enrollmentId,
    fetchCourseDetail,
    completionPercentage,
    // Video player state - now uses inline VideoPlayer (no modal)
    variantItem,
    setVariantItem,
    isVideoPlaying,  // ✨ PHASE 4.105: Track if video is currently playing
    toggleVideoPlayPause,  // ✨ PHASE 4.105: Function to toggle play/pause
    onProgressUpdate,  // ✨ PHASE 4.115: Callback when progress is saved externally
    onLessonCompletion,  // ✨ PHASE 4.133: Callback to register lesson completion handler
    // ✨ Pre-test & Sequential Locking Props
    hasCompletedPretest = true,
    pretestRequired = false,
    onStartPretest = null,
    // ✨ Integrated Curriculum & Quiz Props
    quizzes = [],
    selectedQuiz = null,
    onSelectQuiz = null,
    prePostQuiz = null,
    hasCompletedPosttest = true,
    canTakePostTest = false,
    postTestLockReason = null,
    onShowPlayer = null
}) => {
    // Video player ref
    const playerRef = useRef(null);
    const isClickingLessonRef = useRef(false);  // ✨ PHASE 4.111: Use ref to prevent concurrent clicks without causing re-renders
    
    // Video player states
    const [playing, setPlaying] = useState(false);
    const [played, setPlayed] = useState(0);
    const [loaded, setLoaded] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [seeking, setSeeking] = useState(false);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [progressStatus, setProgressStatus] = useState({});
    const [seekOnReady, setSeekOnReady] = useState(null);
    const [progressLoadedLessons, setProgressLoadedLessons] = useState(new Set());
    
    // Fullscreen controls visibility
    const [showControls, setShowControls] = useState(true);
    const controlsTimeout = useRef(null);
    
    // Lesson completion state
    const [markAsCompletedStatus, setMarkAsCompletedStatus] = useState({});
    const [isClickingLessonUI, setIsClickingLessonUI] = useState(false);  // ✨ PHASE 4.111: State for visual feedback

    // Helper function to check if a lesson is completed
    const isLessonCompleted = (variantItem) => {
        // ✨ PHASE 4.145: Guard against null course data (may not be loaded yet)
        if (!course || !course.completed_lesson || !variantItem) return false;
        
        // ✨ PHASE 12.2: Check each lesson  
        const isCompleted = course.completed_lesson.some(cl => {
            // Use consistent variant_item_id field throughout
            return cl.variant_item?.variant_item_id === variantItem.variant_item_id;
        });
        
        // ✨ PHASE 12.16: Debug logging
        if (variantItem.variant_item_id === '136922') {
            console.log(`[PHASE 12.16] isLessonCompleted check for lesson 136922:`, {
                itemId: variantItem.variant_item_id,
                completedLessonsCount: course.completed_lesson?.length || 0,
                completedLessonsIds: course.completed_lesson?.map(cl => cl.variant_item?.variant_item_id) || [],
                isCompleted: isCompleted
            });
        }
        
        return isCompleted;
    };

    // Helper functions for file handling
    const getFileIcon = (fileUrl, variantItem = null) => {
        // ✨ PHASE 4.10: Check for video content from all sources
        if (variantItem && isVideoContent(variantItem)) {
            return "fas fa-play";
        }
        
        if (!fileUrl) return "fas fa-file";
        
        const extension = fileUrl.toLowerCase().split(".").pop().split("?")[0];
        const iconMap = {
            // Video files
            "mp4": "fas fa-play",
            "avi": "fas fa-play", 
            "mov": "fas fa-play",
            "mkv": "fas fa-play",
            "webm": "fas fa-play",
            "ogg": "fas fa-play",
            // Document files
            "pdf": "fas fa-file-pdf",
            "doc": "fas fa-file-word",
            "docx": "fas fa-file-word",
            "txt": "fas fa-file-alt",
            // Presentation files
            "ppt": "fas fa-file-powerpoint",
            "pptx": "fas fa-file-powerpoint",
            // Image files
            "jpg": "fas fa-image",
            "jpeg": "fas fa-image",
            "png": "fas fa-image",
            "gif": "fas fa-image",
            "bmp": "fas fa-image"
        };
        
        return iconMap[extension] || "fas fa-file";
    };

    const getFileTypeIcon = (fileUrl, variantItem = null) => {
        // ✨ PHASE 4.10: Check for video content from all sources
        if (variantItem && isVideoContent(variantItem)) {
            return "fas fa-video";
        }
        
        if (!fileUrl) return "fas fa-file";
        
        const extension = fileUrl.toLowerCase().split(".").pop().split("?")[0];
        const iconMap = {
            "mp4": "fas fa-video", "avi": "fas fa-video", "mov": "fas fa-video", "mkv": "fas fa-video", "webm": "fas fa-video", "ogg": "fas fa-video",
            "pdf": "fas fa-file-pdf", "doc": "fas fa-file-word", "docx": "fas fa-file-word", "txt": "fas fa-file-alt",
            "ppt": "fas fa-file-powerpoint", "pptx": "fas fa-file-powerpoint",
            "jpg": "fas fa-image", "jpeg": "fas fa-image", "png": "fas fa-image", "gif": "fas fa-image", "bmp": "fas fa-image"
        };
        
        return iconMap[extension] || "fas fa-file";
    };

    const getFileTypeLabel = (fileUrl, variantItem = null) => {
        // ✨ PHASE 4.10: Check for video content from all sources
        if (variantItem && isVideoContent(variantItem)) {
            return "Video";
        }
        
        if (!fileUrl) return "File";
        
        const extension = fileUrl.toLowerCase().split(".").pop().split("?")[0];
        const labelMap = {
            "mp4": "Video", "avi": "Video", "mov": "Video", "mkv": "Video", "webm": "Video", "ogg": "Video",
            "pdf": "PDF", "doc": "Dokumen", "docx": "Dokumen", "txt": "Teks",
            "ppt": "Presentasi", "pptx": "Presentasi",
            "jpg": "Gambar", "jpeg": "Gambar", "png": "Gambar", "gif": "Gambar", "bmp": "Gambar"
        };
        
        return labelMap[extension] || "File";
    };

    const getFileTypeTitle = (fileUrl, variantItem = null) => {
        // ✨ PHASE 4.10: Check if it's video content from all sources
        if (variantItem && isVideoContent(variantItem)) {
            return "Putar video";
        }
        
        const type = getFileTypeLabel(fileUrl, variantItem);
        return type === "Video" ? "Putar video" : `Buka ${type.toLowerCase()}`;
    };

    // Helper function to get lesson progress status
    const getLessonProgressStatus = (variantItem) => {
        if (!variantItem) {
            return { status: "not-started", percentage: 0 };
        }
        
        // Check if lesson is completed first (from backend data)
        const isCompleted = isLessonCompleted(variantItem);
        if (isCompleted) {
            return { status: "completed", percentage: 100 };
        }
        
        // Check if there's video progress data for this lesson
        const itemId = variantItem.variant_item_id;
        const progressKey = `progress_${itemId}`;
        const lessonProgress = progressStatus[progressKey];
        
        if (lessonProgress) {
            // Use the stored progress data - check status field, not just percentage
            // Even 0.05% progress counts as "in-progress"
            if (lessonProgress.status === "in-progress" || lessonProgress.percentage >= 0) {
                // For display, ensure percentage shows at least 1% if in-progress
                const displayPercentage = lessonProgress.status === "in-progress" && lessonProgress.percentage === 0 
                    ? 1  // Show at least 1% for any in-progress content
                    : lessonProgress.percentage;
                return { ...lessonProgress, percentage: displayPercentage };
            }
        }
        
        // For video files, show "Ready to watch" only if no progress exists
        if (isVideoFile(variantItem.file)) {
            return { status: "not-started", percentage: 0 };
        }
        
        return { status: "not-started", percentage: 0 };
    };

    // ✨ PHASE 4.115: Define updateProgressStatus BEFORE useEffect that uses it
    const updateProgressStatus = (variantItemId, progressData) => {
        // ✨ PHASE 13.7: CRITICAL FIX - Don't update progress for already-completed lessons
        // Check if lesson is already marked as completed in the backend's completed_lesson array
        const testVariantItem = { variant_item_id: variantItemId };
        if (isLessonCompleted(testVariantItem)) {
            return;  // Don't update local progress state if lesson is already marked as complete
        }
        
        const progressKey = `progress_${variantItemId}`;
        
        
        if (!progressData) {
            setProgressStatus(prev => {
                const newState = {
                    ...prev,
                    [progressKey]: { status: "not-started", percentage: 0 }
                };
                return newState;
            });
            return;
        }

        // ✨ PHASE 12.3: CRITICAL FIX - LOCAL PROGRESS STATE SHOULD NEVER BE "COMPLETED"
        // Only the API's completed_lesson array determines true completion
        // Local video progress can only be "in-progress" (0-99.8%) or "not-started"
        // Setting it to "completed" causes the badge to show "Diselesaikan" even when verification questions are unanswered
        
        let status = "not-started";
        const percentage = progressData.percentage || 0;
        
        // ✨ PHASE 12.3: CRITICAL - Never set local status to "completed"
        // At 100% video progress, set status to "in-progress" instead of "completed"
        // This allows the API's completion check (with verification questions) to take precedence
        if (progressData.isInProgress || percentage > 0) {
            status = "in-progress";  // Show 0-100% progress, but never claim "completed"
        }
        // REMOVED: if (progressData.isCompleted || percentage >= 99.8) { status = "completed"; }

        // ✨ PHASE 4.117: Keep decimal precision instead of rounding to integer
        // This preserves small percentages like 0.05%, 0.45%, 1.25% instead of truncating to 0%
        const displayPercentage = Math.round(percentage * 10) / 10;  // Round to 1 decimal place

        setProgressStatus(prev => {
            const newState = {
                ...prev,
                [progressKey]: { 
                    status, 
                    percentage: Math.min(Math.max(displayPercentage, 0), 100),  // Keep 1 decimal precision
                    position: progressData.position || 0,
                    duration: progressData.duration || 0
                }
            };
            return newState;
        });
    };

    // ✨ PHASE 4.115: Set up external progress update callback for CourseDetail
    useEffect(() => {
        // Expose updateProgressStatus method for external updates from CourseDetail
        if (onProgressUpdate) {
            onProgressUpdate(updateProgressStatus);
        } else {
        }
        
        return () => {
        };
    }, [onProgressUpdate]);

    // ✨ PHASE 4.133: Set up external lesson completion callback for CourseDetail
    useEffect(() => {
        // Expose handleMarkLessonAsCompleted method for external updates from VideoPlayer
        if (onLessonCompletion) {
            onLessonCompletion(handleMarkLessonAsCompleted);
        } else {
        }
        
        return () => {
        };
    }, [onLessonCompletion]);

    // Helper function to count unique completed lessons
    const getCompletedLessonsCount = () => {
        if (!course.completed_lesson) return 0;
        const completedSet = new Set();
        course.completed_lesson.forEach(cl => {
            // Use consistent variant_item_id field
            const itemId = cl.variant_item?.variant_item_id;
            if (itemId) completedSet.add(itemId.toString());
        });
        return completedSet.size;
    };

    // Build flattened list of curriculum items (lessons & quizzes) across all sections
    const flattenedCurriculumItems = [];
    if (course?.curriculum && Array.isArray(course.curriculum)) {
        course.curriculum.forEach((sec, sIdx) => {
            const items = sec.variant_items || sec.items || [];
            items.forEach((it, lIdx) => {
                const isQuizItem = it.item_type === 'quiz' || Boolean(it.quiz_id) || Boolean(it.quiz);
                flattenedCurriculumItems.push({
                    variant_item_id: it.variant_item_id,
                    isQuiz: isQuizItem,
                    quiz_id: it.quiz_id || (it.quiz && typeof it.quiz === 'object' ? it.quiz.quiz_id : (typeof it.quiz === 'string' ? it.quiz : null)),
                    sectionIndex: sIdx,
                    lessonIndex: lIdx,
                    title: it.title,
                    sectionTitle: sec.title,
                    raw: it
                });
            });
        });
    }

    const isItemCompletedOrPassed = (flatItem) => {
        if (!flatItem) return true;
        if (flatItem.isQuiz) {
            const q = quizzes?.find(qz => qz.quiz_id === flatItem.quiz_id || String(qz.id) === String(flatItem.quiz_id));
            return Boolean(q?.is_passed || flatItem.raw?.quiz_detail?.is_passed || flatItem.raw?.is_completed);
        }
        return isLessonCompleted(flatItem.raw || { variant_item_id: flatItem.variant_item_id });
    };

    // Video player handlers
    // ✨ PHASE 4.86: Removed setShow since using inline VideoPlayer component
    const handleCloseVideo = () => {
        setVariantItem(null);
        // Reset video player state
        setPlaying(false);
        setPlayed(0);
        setLoaded(0);
        setDuration(0);
        setSeekOnReady(null); // Reset seek position
    };

    const handlePlayVideo = (variant_item) => {
        // ✨ PHASE 4.111: Prevent rapid repeated clicks using ref + state
        if (isClickingLessonRef.current) {
            return;
        }
        
        // Ensure the player column is visible if user was on another tab (e.g., gamification, quiz, certificate)
        const switchedView = typeof onShowPlayer === 'function' ? onShowPlayer() : false;
        
        // ✨ PHASE 4.106: Check if clicking the same video that's currently selected
        const isSameVideo = variantItem?.variant_item_id === variant_item.variant_item_id;
        
        if (isSameVideo) {
            // ✨ PHASE 4.107: Same video is selected
            isClickingLessonRef.current = true;
            setIsClickingLessonUI(true);
            
            if (!switchedView) {
                toggleVideoPlayPause();
            } else if (!isVideoPlaying && typeof toggleVideoPlayPause === 'function') {
                toggleVideoPlayPause();
            }
            
            // Reset immediately for play/pause toggle - no UI blocking needed
            setTimeout(() => {
                isClickingLessonRef.current = false;
                setIsClickingLessonUI(false);
            }, 50);
        } else {
            // ✨ PHASE 4.107: Different video - start playing the new video
            // Only block UI when switching videos
            isClickingLessonRef.current = true;
            setIsClickingLessonUI(true);
            
            // ✨ PHASE 4.117: Load saved progress BEFORE playing new video to enable resume
            const itemId = variant_item.variant_item_id;
            const progressKey = `progress_${itemId}`;
            const savedProgress = progressStatus[progressKey];
            
            if (savedProgress && savedProgress.position > 0) {
                // Don't reset played/loaded - let CourseDetail's useEffect handle seek
            } else {
                // Reset video player state only if no saved progress
                setPlayed(0);
                setLoaded(0);
                setDuration(0);
            }
            
            // Set variant item to trigger video loading
            setVariantItem(variant_item);
            setPlaying(true);
            
            // Reset click flag after brief delay to prevent accidental double-clicks when switching videos
            setTimeout(() => {
                isClickingLessonRef.current = false;
                setIsClickingLessonUI(false);  // Update UI to show ready state
            }, 150);  // Shorter than before - 150ms is enough for video switch
        }
    };

    // ✨ PHASE 4.111: Failsafe to reset click lock if needed
    useEffect(() => {
        if (isClickingLessonUI) {
            // If we're in "clicking" state for too long, something went wrong
            const failsafeTimer = setTimeout(() => {
                if (isClickingLessonUI) {
                    isClickingLessonRef.current = false;
                    setIsClickingLessonUI(false);
                }
            }, 2000);  // 2 second failsafe timeout
            
            return () => clearTimeout(failsafeTimer);
        }
    }, [isClickingLessonUI]);
    
	// Video Progress Tracking Functions
	const saveVideoProgress = async (variantItemId, position, duration, isCompleted = false) => {
        if (!variantItemId || !course?.course?.id || !duration || duration <= 0) {
            return false;
        }

        try {
            const progressPercentage = (position / duration) * 100;
            

            // Call backend API to save progress
            await apiInstance.post("/student/video-progress/", {
                user_id: UserData()?.user_id,         // ✨ PHASE 4.115: Use user_id instead of user
                course_id: course.course.id,          // ✨ PHASE 4.115: Use course_id instead of course
                variant_item_id: variantItemId,       // ✨ PHASE 4.115: Use variant_item_id instead of variant_item
                progress_percentage: progressPercentage,
                last_watched_position: position,
                total_duration: duration
            });

            // Update local progress status
            const progressData = {
                position: position,
                duration: duration,
                percentage: progressPercentage,
                isCompleted: progressPercentage >= 99.8,
                isInProgress: progressPercentage > 1 && progressPercentage < 99.8
            };
            updateProgressStatus(variantItemId, progressData);
            
            return true;
        } catch (error) {
            return false;
        }
    };

    const loadVideoProgress = async (variantItemId) => {
        if (!variantItemId || !course?.course?.id) {
            return null;
        }

        // Avoid loading progress multiple times for the same lesson
        if (progressLoadedLessons.has(variantItemId)) {
            return null;
        }

        try {
            
            // Call backend API to get progress
            const response = await apiInstance.get(`/student/video-progress/${UserData()?.user_id}/${variantItemId}/`);
            const apiResponse = response.data;
            
            
            // Mark as loaded
            setProgressLoadedLessons(prev => new Set([...prev, variantItemId]));
            
            // ✨ PHASE 4.117: Unwrap the data from {message, data} wrapper
            const progressData = apiResponse.data || apiResponse;
            
            // Transform API response to expected format
            const transformedData = {
                position: progressData.last_watched_position || 0,
                duration: progressData.total_duration || 0,
                percentage: progressData.progress_percentage || 0,
                isCompleted: progressData.progress_percentage >= 99.8,
                isInProgress: progressData.progress_percentage > 0  // Any progress > 0 is in-progress
            };
            
            
            // Update UI with loaded progress
            updateProgressStatus(variantItemId, transformedData);
            
            // Smart seek position determination based on video length and user preference
            if (transformedData.position > 0 && transformedData.duration > 0) {
                const resumePercentage = transformedData.percentage;
                
                // Smart threshold based on video length
                let minResumeTime = 5; // Default 5 seconds
                if (transformedData.duration > 3600) { // Videos longer than 1 hour
                    minResumeTime = 10; // At least 10 seconds for long videos
                } else if (transformedData.duration > 1800) { // Videos longer than 30 minutes
                    minResumeTime = 7; // At least 7 seconds
                }
                
                // Only resume if we're not completed and have meaningful progress
                const shouldResume = !transformedData.isCompleted && 
                                   transformedData.position > minResumeTime &&
                                   transformedData.percentage > 1; // At least 1% through the video
                
                if (shouldResume) {
                    setSeekOnReady(transformedData.position);
                    
                    // Show user-friendly notification for long videos or significant progress
                    if (transformedData.duration > 1800 || transformedData.position > 60) {
                        const resumeMinutes = Math.floor(transformedData.position / 60);
                        const resumeSeconds = Math.floor(transformedData.position % 60);
                        const timeString = `${resumeMinutes}:${resumeSeconds.toString().padStart(2, "0")}`;
                    }
                }
            }
            
            return transformedData;
        } catch (error) {
            // Different handling for 404 vs other errors
            if (error.response?.status === 404) {
            } else {
            }
            
            // Mark as loaded to avoid retries
            setProgressLoadedLessons(prev => new Set([...prev, variantItemId]));
            updateProgressStatus(variantItemId, null);
            return null;
        }
    };
	
	// Function to refresh progress data
    const refreshProgressData = async () => {
        setProgressLoadedLessons(new Set()); // Clear loaded lessons to force reload
        setProgressStatus({}); // Clear current progress status
        
        // Reload all progress if lectures are available
        if (course?.curriculum?.length > 0) {
            // This will trigger the useEffect to reload progress
            const event = new Event("courseUpdated");
            window.dispatchEvent(event);
        }
    };

    const handleMarkLessonAsCompleted = async (variantItemId, isAutoComplete = false, courseIdParam = null) => {
        // ✨ PHASE 4.145: Guard - if course data not loaded yet, wait for it
        // ✨ PHASE 12.6: FIX - Accept courseId as parameter so we don't depend on course object being loaded
        const courseId = courseIdParam || course?.course?.id;
        
        if (!courseId) {
            // Only return early if we cannot get courseId from either source
            return; // Early return if courseId not available
        }
        
        // Use helper function to check completion status consistently
        const variantItem = { variant_item_id: variantItemId };
        const isAlreadyCompleted = isLessonCompleted(variantItem);
        
        // If auto-completion and already completed, just show notification and return early
        if (isAlreadyCompleted && isAutoComplete) {
            Toast().fire({
                icon: "info",
                title: "Pelajaran Sudah Diselesaikan!",
                text: "Pelajaran ini sudah ditandai sebagai selesai.",
                timer: 2000
            });
            return;
        }

        const key = `lecture_${variantItemId}`;
        setMarkAsCompletedStatus({
            ...markAsCompletedStatus,
            [key]: "Updating",
        });

        try {
            // ✨ PHASE 12.6: courseId is now provided as parameter and defined at function start
            // No need to extract from course object again
            // Verify we have courseId before proceeding
            if (!courseId) {
                Toast().fire({
                    icon: "error",
                    title: "Error",
                    text: "Data kursus tidak ditemukan. Refresh halaman dan coba lagi.",
                    timer: 2000
                });
                return;
            }

            // The backend automatically toggles completion status
            const formdata = new FormData();
            formdata.append("user_id", UserData()?.user_id || 0);
            formdata.append("course_id", courseId);  // ✨ PHASE 4.144+: Use safely extracted courseId
            formdata.append("variant_item_id", variantItemId);

            const response = await useAxios.post("student/course-completed/", formdata);
            
            // Find the lesson item to check if it's a video
            let lessonItem = null;
            if (course?.curriculum) {
                course.curriculum.forEach(section => {
                    if (section.variant_items) {
                        const foundItem = section.variant_items.find(item => 
                            item.variant_item_id === variantItemId
                        );
                        if (foundItem) {
                            lessonItem = foundItem;
                        }
                    }
                });
            }
            
            // ✨ PHASE 12.3: Check API response before setting local completion state
            // The API may reject completion if verification questions are unanswered
            const wasCompletionSuccessful = response?.status === 201 || response?.status === 200;
            
            // ✨ PHASE 4.126: Clear video progress for ALL video types (YouTube, uploaded, Google Drive)
            // Changed from isVideoFile() to isVideoContent() to support YouTube links
            if (lessonItem && isVideoContent(lessonItem)) {
                if (isAlreadyCompleted && !isAutoComplete) {
                    // Case 1: User manually unmarked a completed lesson
                    try {
                        // Call API to clear progress from database
                        await apiInstance.delete(`/student/video-progress-delete/${UserData()?.user_id}/${variantItemId}/`);
                        
                        // Also clear local progress state
                        setProgressStatus(prevStatus => {
                            const newStatus = { ...prevStatus };
                            const progressKey = `progress_${variantItemId}`;
                            delete newStatus[progressKey];
                            return newStatus;
                        });
                    } catch (progressError) {
                    }
                } else if (!isAlreadyCompleted && wasCompletionSuccessful) {
                    // ✨ PHASE 12.3: Only set local state if API was successful
                    // Case 2: Lesson was just marked as completed (manually or automatically)
                    // ONLY proceed if API response indicates success
                    try {
                        // Clear video progress since lesson is now complete
                        await apiInstance.delete(`/student/video-progress-delete/${UserData()?.user_id}/${variantItemId}/`);
                        
                        // Update local progress state to show completed
                        const progressKey = `progress_${variantItemId}`;
                        setProgressStatus(prevStatus => ({
                            ...prevStatus,
                            [progressKey]: { 
                                status: "completed", 
                                percentage: 100,
                                position: 0,
                                duration: 0
                            }
                        }));
                    } catch (progressError) {
                    }
                } else if (!isAlreadyCompleted && !wasCompletionSuccessful) {
                    // ✨ PHASE 12.3: API rejected completion - don't set local state as completed
                }
            }
            
            
            // ✨ PHASE 12.3: Only refresh and show success messages if completion was successful
            // If API rejected (e.g., unanswered verification questions), don't show success
            if (wasCompletionSuccessful) {
                // ✨ PHASE 12.7: CRITICAL FIX - Await course data refresh before showing success notification
                // This ensures the backend state is reflected in the UI before the success message appears
                // Without this, the refresh might not complete before user closes the page, causing the completion to be lost
                if (fetchCourseDetail) {
                    try {
                        if (isAutoComplete) {
                            await fetchCourseDetail(true); // Silent update - no loading state
                        } else {
                            await fetchCourseDetail(); // Show loading for manual completions
                        }
                    } catch (refreshError) {
                        // Continue to show success notification even if refresh fails
                    }
                }

                setMarkAsCompletedStatus({
                    ...markAsCompletedStatus,
                    [key]: "Updated",
                });
                
                // Show appropriate notification based on the action performed
                if (isAlreadyCompleted && !isAutoComplete) {
                    Toast().fire({
                        icon: "info",
                        title: "Pelajaran Tidak Ditandai!",
                        text: "Pelajaran telah ditandai sebagai belum selesai. Kemajuan video telah disetel ulang.",
                        timer: 2000
                    });
                } else if (!isAlreadyCompleted && !isAutoComplete) {
                    // ✨ PHASE 39.3: Only show notification for MANUAL completion, not auto-completion
                    Toast().fire({
                        icon: "success",
                        title: "Pelajaran Ditandai Selesai!",
                        timer: 2000
                    });
                }
                // ✨ PHASE 39.3: Removed auto-completion notification - no Toast shown for isAutoComplete
            } else {
                // ✨ PHASE 12.3: API rejected completion - show informative message
                Toast().fire({
                    icon: "info",
                    title: "Pelajaran Belum Selesai",
                    text: "Selesaikan semua pertanyaan verifikasi untuk menandai pelajaran sebagai selesai.",
                    timer: 3000
                });
            }
        } catch (error) {
            setMarkAsCompletedStatus({
                ...markAsCompletedStatus,
                [key]: "Error",
            });
            
            Toast().fire({
                icon: "error",
                title: "Gagal memperbarui status penyelesaian",
                text: "Silakan coba lagi dalam beberapa saat.",
                timer: 5174
            });
        }
    };

    // Video file detection - checks only uploaded files
    const isVideoFile = (filename) => {
        if (!filename) return false;
        const videoExtensions = [".mp4", ".webm", ".ogg", ".avi", ".mov", ".wmv", ".flv", ".mkv", ".m4v"];
        return videoExtensions.some(ext => filename.toLowerCase().includes(ext.toLowerCase()));
    };

    // ✨ PHASE 4.10: Extract Google Drive file ID from various URL formats
    const extractGoogleDriveFileId = (url) => {
        if (!url) return null;
        try {
            // Format 1: https://drive.google.com/file/d/FILE_ID/view...
            const match1 = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
            if (match1?.[1]) return match1[1];
            
            // Format 2: https://drive.google.com/uc?id=FILE_ID...
            const match2 = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
            if (match2?.[1]) return match2[1];
            
            return null;
        } catch {
            return null;
        }
    };

    // ✨ PHASE 4.10: Extract YouTube video ID from various URL formats
    const extractYoutubeId = (url) => {
        if (!url) return null;
        try {
            const regexps = [
                /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,     // https://www.youtube.com/watch?v=ID
                /youtu\.be\/([a-zA-Z0-9_-]{11})/,                  // https://youtu.be/ID
                /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,        // https://www.youtube.com/embed/ID
                /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,            // https://www.youtube.com/v/ID
                /youtube-nocookie\.com\/embed\/([a-zA-Z0-9_-]{11})/,  // https://www.youtube-nocookie.com/embed/ID
                /^([a-zA-Z0-9_-]{11})$/                            // Just the ID
            ];
            
            for (const regex of regexps) {
                const match = url.match(regex);
                if (match?.[1]) return match[1];
            }
            
            return null;
        } catch {
            return null;
        }
    };

    // ✨ PHASE 4.10+: Check if variant item contains any video content (uploaded, Google Drive, or YouTube)
    // ✨ PHASE 4.84: Parse file field directly - backend stores all links (YouTube, Google Drive, uploaded files) in file field
    const isVideoContent = (variantItem) => {
        if (!variantItem) return false;
        
        const fileUrl = variantItem.file || '';
        
        // Check uploaded video files
        if (isVideoFile(fileUrl)) {
            return true;
        }
        
        // Check Google Drive links - parse directly from file field
        if (fileUrl.includes('drive.google.com')) {
            return true;
        }
        
        // Check YouTube links - parse directly from file field
        if (
            fileUrl.includes('youtube.com') || 
            fileUrl.includes('youtu.be') ||
            fileUrl.includes('youtube-nocookie.com')
        ) {
            return true;
        }
        
        return false;
    };

    // ✨ PHASE 4.10+: Get the actual playable video URL from the appropriate source
    // ✨ PHASE 4.84: Parse file field directly - backend stores all links in file field
    const getVideoUrl = (variantItem) => {
        if (!variantItem) return null;
        
        const fileUrl = variantItem.file || '';
        
        // Priority 1: Uploaded video file
        if (isVideoFile(fileUrl)) {
            return fileUrl.startsWith("http") 
                ? fileUrl 
                : getMediaUrl(fileUrl);
        }
        
        // Priority 2: Google Drive link - convert to view format for embedded playback
        // ✨ PHASE 4.85: Use /view instead of /preview (preview doesn't support embedding)
        if (fileUrl.includes('drive.google.com')) {
            const fileId = extractGoogleDriveFileId(fileUrl);
            if (fileId) {
                return `https://drive.google.com/file/d/${fileId}/view`;  // ✅ /view embeds properly
            }
            return fileUrl; // Fallback to original link
        }
        
        // Priority 3: YouTube link
        if (fileUrl.includes('youtube.com') || fileUrl.includes('youtu.be') || fileUrl.includes('youtube-nocookie.com')) {
            return fileUrl;
        }
        
        return null;
    };

    // Video player event handlers
    const handlePlayPause = () => {
        setPlaying(!playing);
    };

    const handleProgress = (progress) => {
        // Simple approach - only block updates while actively seeking
        if (seeking) {
            return;
        }
        
        setPlayed(progress.played);
        setLoaded(progress.loaded);
        
        // Debug: Log conditions (sample every ~30 frames, once per second)
        if (Math.random() < 0.03) {
        }
        
        // Only save progress when video is actively playing and has meaningful progress
        if (variantItem && duration > 0 && playing && progress.played > 0.01) {
            const currentPosition = progress.played * duration;
            const progressPercentage = progress.played * 100;
            const itemId = variantItem.variant_item_id;
            
            if (Math.random() < 0.03) {
            }
            
            // Only save progress if video is not completed (less than 100%)
            if (progressPercentage < 100) {
                saveVideoProgress(itemId, currentPosition, duration, false);
                
                // Update local progress status
                updateProgressStatus(itemId, {
                    position: currentPosition,
                    duration: duration,
                    percentage: progressPercentage,
                    isCompleted: false,
                    isInProgress: true
                });
            }
            
            // Auto-complete lesson when user reaches 100% (not 95%)
            if (progressPercentage >= 99.8) { // Use 99.8% to account for floating point precision
                const variantItemForCheck = { id: variantItem.id, variant_item_id: variantItem.variant_item_id };
                const isAlreadyCompleted = isLessonCompleted(variantItemForCheck);
                
                if (!isAlreadyCompleted) {
                    // ✨ PHASE 12.6: Pass courseId to ensure completion works even if course object is not loaded
                    const courseIdLocal = course?.course?.id;
                    handleMarkLessonAsCompleted(itemId, true, courseIdLocal).then(() => {
                        // Close video after completion with delay to show message
                        setTimeout(() => {
                            handleCloseVideo();
                        }, 4000);
                    });
                }
            }
        }
    };

    const handleSeekMouseDown = (e) => {
        setSeeking(true);
    };

    const handleSeekChange = (e) => {
        const newPlayed = parseFloat(e.target.value);
        setPlayed(newPlayed);
    };

    const handleSeekMouseUp = (e) => {
        const newPlayed = parseFloat(e.target.value);
        
        // Seek to the new position
        if (playerRef.current) {
            playerRef.current.seekTo(newPlayed, "fraction");
        }
        
        // Clear seeking state after brief delay
        setTimeout(() => {
            setSeeking(false);
        }, 300);
        
        // Save progress
        if (variantItem && duration > 0) {
            const newPosition = newPlayed * duration;
            const progressPercentage = newPlayed * 100;
            const itemId = variantItem.variant_item_id;
            
            saveVideoProgress(itemId, newPosition, duration, false);
        }
    };

    const handleDuration = (duration) => {
        setDuration(duration);
        
        // Don't save initial progress here - let the progress loading handle resume logic
        // This was causing issues with resume functionality
    };

    const handleVolumeChange = (e) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        setMuted(newVolume === 0);
    };

    const toggleMute = () => {
        setMuted(!muted);
    };

    const handlePlaybackRateChange = (rate) => {
        setPlaybackRate(rate);
    };

    const toggleFullscreen = () => {
        const videoContainer = document.querySelector(".video-container");
        if (!document.fullscreenElement) {
            if (videoContainer?.requestFullscreen) {
                videoContainer.requestFullscreen();
            } else if (videoContainer?.webkitRequestFullscreen) {
                videoContainer.webkitRequestFullscreen();
            } else if (videoContainer?.msRequestFullscreen) {
                videoContainer.msRequestFullscreen();
            }
            setFullscreen(true);
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            setFullscreen(false);
        }
    };

    // Controls visibility management for fullscreen
    const resetControlsTimeout = () => {
        if (controlsTimeout.current) {
            clearTimeout(controlsTimeout.current);
        }
        
        setShowControls(true);
        
        // Only auto-hide controls in fullscreen mode when video is playing
        if (fullscreen && playing) {
            controlsTimeout.current = setTimeout(() => {
                setShowControls(false);
            }, 2000); // Hide after 2 seconds of inactivity
        }
    };

    const handleMouseMove = () => {
        resetControlsTimeout();
    };

    const handleMouseLeave = () => {
        // Immediately hide controls when mouse leaves video area in fullscreen
        if (fullscreen && playing) {
            if (controlsTimeout.current) {
                clearTimeout(controlsTimeout.current);
            }
            controlsTimeout.current = setTimeout(() => {
                setShowControls(false);
            }, 1000); // Shorter delay when mouse leaves
        }
    };

    // Effect to manage controls visibility based on fullscreen and playing state
    useEffect(() => {
        if (fullscreen) {
            resetControlsTimeout();
        } else {
            // Always show controls when not in fullscreen
            setShowControls(true);
            if (controlsTimeout.current) {
                clearTimeout(controlsTimeout.current);
            }
        }
        
        // Cleanup timeout on unmount or state change
        return () => {
            if (controlsTimeout.current) {
                clearTimeout(controlsTimeout.current);
            }
        };
    }, [fullscreen, playing]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyPress = (e) => {
            // ✨ PHASE 4.86: Check variantItem instead of show flag
            if (!variantItem || !isVideoFile(variantItem?.file)) return;
            
            // ✨ PHASE 8.1: Skip keyboard shortcuts when typing in form inputs or textareas
            const activeElement = document.activeElement;
            const isFormField = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA' || activeElement?.tagName === 'SELECT';
            if (isFormField) return;
            
            switch (e.code) {
                case "Space":
                    e.preventDefault();
                    handlePlayPause();
                    break;
                // ✨ PHASE 4.91: Disabled arrow keys for video seeking
                // case "ArrowLeft":
                //     e.preventDefault();
                //     const backwardTime = Math.max(0, played - 0.05);
                //     setPlayed(backwardTime);
                //     playerRef.current?.seekTo(backwardTime);
                //     break;
                // case "ArrowRight":
                //     e.preventDefault();
                //     const forwardTime = Math.min(1, played + 0.05);
                //     setPlayed(forwardTime);
                //     playerRef.current?.seekTo(forwardTime);
                //     break;
                case "ArrowUp":
                    e.preventDefault();
                    setVolume(Math.min(1, volume + 0.1));
                    break;
                case "ArrowDown":
                    e.preventDefault();
                    setVolume(Math.max(0, volume - 0.1));
                    break;
                case "KeyM":
                    e.preventDefault();
                    toggleMute();
                    break;
                case "KeyF":
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                default:
                    break;
            }
        };

        document.addEventListener("keydown", handleKeyPress);
        return () => document.removeEventListener("keydown", handleKeyPress);
    }, [variantItem, playing, played, volume, muted]); // ✨ PHASE 4.86: Removed 'show' - now using inline display

    // Handle fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            setFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    // Format time helper
    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return "00:00";
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
        }
        return `${minutes}:${secs.toString().padStart(2, "0")}`;
    };

    // Load progress for all video lessons when course loads
    useEffect(() => {
        if (course?.curriculum && course.curriculum.length > 0) {
            const loadAllProgress = async () => {
                try {
                    
                    // Count video lessons to load
                    let videoLessonCount = 0;
                    const lessonsTitles = [];
                    for (const section of course.curriculum) {
                        if (section.variant_items && section.variant_items.length > 0) {
                            for (const item of section.variant_items) {
                                // ✨ PHASE 4.118: Use isVideoContent to check ALL video types (uploaded, YouTube, Google Drive)
                                if (isVideoContent(item)) {
                                    videoLessonCount++;
                                    lessonsTitles.push(`${item.title} (ID: ${item.variant_item_id})`);
                                }
                            }
                        }
                    }
                    
                    if (videoLessonCount === 0) {
                        return;
                    }
                    
                    // Load progress for each video lesson individually
                    let successCount = 0;
                    let failureCount = 0;
                    let noProgressCount = 0;
                    
                    for (const section of course.curriculum) {
                        if (section.variant_items && section.variant_items.length > 0) {
                            for (const item of section.variant_items) {
                                // ✨ PHASE 4.118: Use isVideoContent to check ALL video types (uploaded, YouTube, Google Drive)
                                if (isVideoContent(item)) {
                                    const itemId = item.variant_item_id;
                                    if (itemId) {
                                        try {
                                            const progressData = await loadVideoProgress(itemId);
                                            if (progressData && progressData.percentage > 0) {
                                                successCount++;
                                            } else {
                                                noProgressCount++;
                                            }
                                        } catch (loadError) {
                                            failureCount++;
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                }
            };
            
            // Add small delay to ensure component is fully mounted
            const timer = setTimeout(loadAllProgress, 500);
            return () => clearTimeout(timer);
        } else {
        }
    }, [course]);

    // Load video progress when video is selected (resume functionality)
    // ✨ PHASE 4.86: Check variantItem instead of show flag (inline display)
    useEffect(() => {
        if (variantItem && isVideoContent(variantItem)) {  // ✨ PHASE 4.132: Changed from isVideoFile to isVideoContent to support YouTube, Google Drive, and uploaded videos
            const itemId = variantItem.variant_item_id;
            if (itemId) {
                loadVideoProgress(itemId);
            } else {
            }
        } else if (variantItem) {
        }
    }, [variantItem]);

    // Enhanced seek to specific time when video is ready (improved resume functionality)
    useEffect(() => {
        const performSeek = async (timeToSeek, maxRetries = 5) => {
            if (!playerRef.current || !timeToSeek || timeToSeek <= 0 || !duration) {
                setSeekOnReady(null);
                return;
            }

            const seekPercentage = timeToSeek / duration;

            let attempt = 0;
            
                const attemptSeek = async () => {
                return new Promise((resolve) => {
                    attempt++;
                    
                    try {
                        if (!playerRef.current) {
                            resolve(false);
                            return;
                        }

                        const seekPercentage = timeToSeek / duration;
                        
                        // Set the played state first for UI consistency
                        setPlayed(seekPercentage);
                        
                        // Perform the seek
                        playerRef.current.seekTo(seekPercentage, "fraction");
                        
                        // Verify the seek worked after a delay
                        setTimeout(() => {
                            if (playerRef.current && playerRef.current.getCurrentTime) {
                                try {
                                    const currentTime = playerRef.current.getCurrentTime();
                                    const tolerance = 3; // Allow 3-second tolerance
                                    const seekSuccessful = Math.abs(currentTime - timeToSeek) <= tolerance;
                                    
                                    if (seekSuccessful) {
                                        resolve(true);
                                    } else {
                                        resolve(false);
                                    }
                                } catch (verifyError) {
                                    // Assume success if we can't verify
                                    resolve(true);
                                }
                            } else {
                                // Assume success if we can't verify
                                resolve(true);
                            }
                        }, 800); // Give player more time to complete seek
                        
                    } catch (error) {
                        resolve(false);
                    }
                });
            };            // Retry loop with exponential backoff
            while (attempt < maxRetries) {
                const success = await attemptSeek();
                
                if (success) {
                    setSeekOnReady(null); // Clear seek request
                    return;
                }
                
                if (attempt < maxRetries) {
                    // Exponential backoff: 500ms, 1s, 1.5s, 2s, 2.5s
                    const delay = 500 + (attempt * 500);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }

            setSeekOnReady(null); // Clear seek request even on failure
        };

        // ✨ PHASE 4.86: Check variantItem instead of show (inline display mode)
        if (variantItem && playerRef.current && seekOnReady && duration > 0) {
            performSeek(seekOnReady);
        }
    }, [variantItem, duration, seekOnReady]);

    // ✨ Handle aria-expanded attribute and chevron rotation on collapse toggle
    useEffect(() => {
        // Set initial aria-expanded state for all collapse buttons
        const collapseButtons = document.querySelectorAll('[data-bs-toggle="collapse"]');
        
        collapseButtons.forEach(button => {
            const target = button.getAttribute("data-bs-target");
            if (target) {
                const collapseElement = document.querySelector(target);
                if (collapseElement) {
                    // Set initial state based on whether collapse has 'show' class
                    const isExpanded = collapseElement.classList.contains("show");
                    button.setAttribute("aria-expanded", isExpanded ? "true" : "false");
                    
                    // Listen for Bootstrap collapse events
                    collapseElement.addEventListener("show.bs.collapse", () => {
                        button.setAttribute("aria-expanded", "true");
                    });
                    
                    collapseElement.addEventListener("hide.bs.collapse", () => {
                        button.setAttribute("aria-expanded", "false");
                    });
                }
            }
        });
    }, [course?.curriculum]);

    return (
        <div className="tab-pane fade show active" id="lectures" role="tabpanel">
            <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom flex-wrap gap-2 curriculum-tab-topbar">
                <div className="d-flex align-items-center gap-2">
                    <h5 className="mb-0 fw-bold curriculum-heading-title">
                        <i className="fas fa-list-check me-2 text-teal"></i>Kurikulum Kursus
                    </h5>
                    {course?.curriculum?.length > 0 && (() => {
                        const totalSections = course.curriculum.length;
                        const totalLessons = course.curriculum.reduce((acc, c) => acc + (c.variant_items?.length || 0), 0);
                        return (
                            <span className="badge curriculum-count-badge">
                                {totalSections} Bagian • {totalLessons} Materi
                            </span>
                        );
                    })()}
                </div>
                {course?.curriculum?.length > 0 && (() => {
                    const totalLessons = course.curriculum.reduce((acc, c) => acc + (c.variant_items?.length || 0), 0);
                    const completedLessons = getCompletedLessonsCount() || 0;
                    const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
                    
                    return (
                        <div className="curriculum-mini-progress">
                            <span className="curriculum-mini-progress-text">
                                <i className="fas fa-circle-check text-emerald me-1"></i>
                                {completedLessons}/{totalLessons} Selesai ({progressPercentage}%)
                            </span>
                            <div className="curriculum-mini-progress-track">
                                <div 
                                    className="curriculum-mini-progress-fill" 
                                    style={{ width: `${progressPercentage}%` }}
                                ></div>
                            </div>
                        </div>
                    );
                })()}
            </div>
            
            {/* 📌 Pre-test Diagnostic: Auto-pinned at top of curriculum */}
            {prePostQuiz && (
                <div 
                    className={`pretest-curriculum-item mb-3 p-3 rounded-3 border ${selectedQuiz?.quiz_id === prePostQuiz.quiz_id && (!prePostQuiz.has_pre_test || selectedQuiz?.current_mode === 'pre_test') ? 'active border-teal shadow-sm bg-light' : hasCompletedPretest ? 'completed border-success-subtle bg-light' : 'pending border-warning bg-white shadow-sm'}`}
                    onClick={() => {
                        if (onSelectQuiz) {
                            onSelectQuiz({ ...prePostQuiz, current_mode: 'pre_test' });
                        } else if (onStartPretest) {
                            onStartPretest();
                        }
                    }}
                    style={{ cursor: 'pointer', transition: 'all 0.2s ease', borderRadius: '10px' }}
                >
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                        <div className="d-flex align-items-center gap-3">
                            <div className={`step-badge-icon rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 ${hasCompletedPretest ? 'bg-success text-white' : 'bg-teal text-white'}`} style={{ width: '38px', height: '38px', minWidth: '38px', minHeight: '38px', flexShrink: 0, aspectRatio: '1 / 1', fontSize: '0.95rem' }}>
                                <i className={`fas ${hasCompletedPretest ? 'fa-check' : 'fa-clipboard-check'}`}></i>
                            </div>
                            <div>
                                <div className="d-flex align-items-center gap-2">
                                    <span className="badge bg-secondary-subtle text-secondary border px-2 py-0" style={{ fontSize: '10px' }}>LANGKAH 1</span>
                                    <h6 className="mb-0 fw-bold text-dark" style={{ fontSize: '0.92rem' }}>Pre-Test Diagnostik</h6>
                                </div>
                                <small className="text-muted d-block mt-1">
                                    {prePostQuiz.title} &bull; {prePostQuiz.total_questions || prePostQuiz.questions?.length || 0} Soal
                                </small>
                                {postTestLockReason && !canTakePostTest && !hasCompletedPosttest && (
                                    <small className="text-danger d-block mt-1" style={{ fontSize: '11px' }}>
                                        <i className="fas fa-lock me-1"></i>{postTestLockReason}
                                    </small>
                                )}
                            </div>
                        </div>
                        <div>
                            {hasCompletedPretest ? (
                                <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                                    <i className="fas fa-check-circle me-1"></i>Selesai ({Math.round(prePostQuiz.pre_test_score || 0)}%)
                                </span>
                            ) : (
                                <button type="button" className="btn btn-sm btn-teal fw-bold px-3 py-1 text-nowrap">
                                    <i className="fas fa-play me-1"></i>Mulai Pre-Test
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Pre-test Diagnostic Requirement Notice */}
            {pretestRequired && !hasCompletedPretest && !prePostQuiz && (
                <div className="pretest-curriculum-locked-banner mb-3 p-3 rounded-3">
                    <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
                        <div className="d-flex align-items-center gap-3">
                            <div className="pretest-banner-lock-icon">
                                <i className="fas fa-lock"></i>
                            </div>
                            <div>
                                <h6 className="mb-1 fw-bold text-dark">
                                    <i className="fas fa-clipboard-check text-teal-accent me-2"></i>
                                    Kurikulum Terkunci — Selesaikan Pre-test Terlebih Dahulu
                                </h6>
                                <p className="mb-0 text-muted small">
                                    Pre-test diagnostik ini wajib diselesaikan untuk membuka akses materi kursus.
                                </p>
                            </div>
                        </div>
                        {onStartPretest && (
                            <button
                                type="button"
                                className="btn btn-sm btn-teal fw-bold px-3 py-2 text-nowrap"
                                onClick={onStartPretest}
                            >
                                <i className="fas fa-play me-1"></i>
                                Mulai Pre-test Sekarang
                            </button>
                        )}
                    </div>
                </div>
            )}

            {course?.curriculum?.length > 0 ? (
                course.curriculum.map((c, index) => {
                    // Check if Section is locked
                    const isSectionLocked = (() => {
                        if (pretestRequired && !hasCompletedPretest) {
                            return { locked: true, reason: "Selesaikan Pre-test terlebih dahulu untuk membuka kurikulum pembelajaran." };
                        }
                        if (index === 0) return { locked: false, reason: "" };
                        // Check if all lessons in all previous sections are completed
                        for (let prevIdx = 0; prevIdx < index; prevIdx++) {
                            const prevSection = course.curriculum[prevIdx];
                            const prevItems = prevSection?.variant_items || prevSection?.items || [];
                            const allPrevCompleted = prevItems.length === 0 || prevItems.every(it => {
                                const isQuiz = it.item_type === 'quiz' || Boolean(it.quiz_id) || Boolean(it.quiz);
                                const qId = it.quiz_id || (it.quiz && typeof it.quiz === 'object' ? it.quiz.quiz_id : null);
                                if (isQuiz) {
                                    const q = quizzes?.find(qz => qz.quiz_id === qId);
                                    return Boolean(q?.is_passed || it.quiz_detail?.is_passed || it.is_completed);
                                }
                                return isLessonCompleted(it);
                            });
                            if (!allPrevCompleted) {
                                return {
                                    locked: true,
                                    reason: `Selesaikan semua materi dan kuis di Bagian ${prevIdx + 1} (${prevSection.title}) terlebih dahulu.`
                                };
                            }
                        }
                        return { locked: false, reason: "" };
                    })();

                    return (
                    <div key={c.variant_id || index} className={`lecture-card ${isSectionLocked.locked ? 'lecture-card-locked' : ''}`}>
                        <div 
                            className="lecture-header"
                            style={{ cursor: 'pointer' }}
                            data-bs-toggle="collapse"
                            data-bs-target={`#collapse-${c.variant_id || index}`}
                            aria-expanded="true"
                            aria-controls={`collapse-${c.variant_id || index}`}
                        >
                            <div className="lecture-header-content">
                                <div className="d-flex align-items-center justify-content-between">
                                    <div className="d-flex align-items-center gap-2">
                                        <div>
                                            <h5 className="mb-1 d-flex align-items-center gap-2">
                                                {c.title}
                                                {isSectionLocked.locked && (
                                                    <span className="badge-section-locked" title={isSectionLocked.reason}>
                                                        <i className="fas fa-lock me-1"></i>Terkunci
                                                    </span>
                                                )}
                                            </h5>
                                            <small className="opacity-90">
                                                {c.variant_items?.length || 0} Pelajaran{(c.variant_items?.length || 0) !== 1 ? "" : ""}
                                            </small>
                                        </div>
                                    </div>
                                    <div
                                        className="btn btn-link text-white p-0"
                                        title="Tombol bagian"
                                    >
                                        <i className="fas fa-chevron-down fa-lg"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div id={`collapse-${c.variant_id || index}`} className="collapse show">
                            {c.variant_items?.map((l, lessonIndex) => {
                                // Get detailed progress status
                                const progressStatus = getLessonProgressStatus(l);
                                const isCompleted = progressStatus.status === "completed";
                                const isInProgress = progressStatus.status === "in-progress";
                                const isVideoLesson = isVideoContent(l);
                                const itemId = l.variant_item_id;

                                // Sequential item lock evaluation (for lessons & quizzes)
                                const isItemQuiz = l.item_type === 'quiz' || Boolean(l.quiz_id) || Boolean(l.quiz);
                                const matchedQuiz = isItemQuiz ? ((quizzes || []).find(q => q.quiz_id === l.quiz_id || q.quiz_id === l.quiz?.quiz_id) || l.quiz_detail || l.quiz) : null;
                                const isQuizPassed = Boolean(matchedQuiz?.is_passed || l.is_completed);
                                const isQuizSelected = Boolean(selectedQuiz && (selectedQuiz.quiz_id === l.quiz_id || selectedQuiz.quiz_id === matchedQuiz?.quiz_id));

                                const lessonLockStatus = (() => {
                                    if (pretestRequired && !hasCompletedPretest) {
                                        return { locked: true, reason: "Selesaikan Pre-test terlebih dahulu untuk membuka kurikulum pembelajaran." };
                                    }
                                    if (isSectionLocked.locked) {
                                        return { locked: true, reason: isSectionLocked.reason };
                                    }
                                    const currentFlatIdx = flattenedCurriculumItems.findIndex(fl => fl.variant_item_id === l.variant_item_id);
                                    if (currentFlatIdx > 0) {
                                        const prevFlat = flattenedCurriculumItems[currentFlatIdx - 1];
                                        const isPrevDone = isItemCompletedOrPassed(prevFlat);
                                        if (!isPrevDone) {
                                            return {
                                                locked: true,
                                                reason: prevFlat.isQuiz
                                                    ? `Luluskan kuis "${prevFlat.title}" terlebih dahulu.`
                                                    : `Selesaikan pelajaran "${prevFlat.title}" terlebih dahulu.`
                                            };
                                        }
                                    }
                                    return { locked: false, reason: "" };
                                })();

                                // If this item is a Quiz item, render specialized Quiz Row
                                if (isItemQuiz) {
                                    return (
                                        <div key={l.variant_item_id || lessonIndex} className="mb-0">
                                            <div 
                                                className={`lesson-item quiz-curriculum-item ${lessonLockStatus.locked ? "lesson-item-locked" : ""} ${isQuizPassed ? "completed" : ""} ${isQuizSelected ? "active" : ""} position-relative`}
                                                onClick={() => {
                                                    if (lessonLockStatus.locked) {
                                                        Toast().fire({
                                                            icon: 'warning',
                                                            title: 'Kuis Terkunci',
                                                            text: lessonLockStatus.reason,
                                                            timer: 4000
                                                        });
                                                        return;
                                                    }
                                                    if (onSelectQuiz) {
                                                        onSelectQuiz(matchedQuiz || { quiz_id: l.quiz_id, title: l.title });
                                                    }
                                                }}
                                                style={{
                                                    cursor: lessonLockStatus.locked ? 'not-allowed' : 'pointer'
                                                }}
                                            >
                                                <div className={`lesson-progress-indicator ${lessonLockStatus.locked ? "locked" : isQuizPassed ? "completed" : ""}`}>
                                                    {isQuizPassed ? (
                                                        <i className="fas fa-check text-success" style={{ fontSize: "11px" }}></i>
                                                    ) : lessonLockStatus.locked ? null : (
                                                        <i className="fas fa-clipboard-check text-warning" style={{ fontSize: "12px" }}></i>
                                                    )}
                                                </div>

                                                <div className="lesson-info d-flex flex-column flex-grow-1 min-w-0">
                                                    <div className="d-flex align-items-center gap-2 mb-1">
                                                        <span className="badge bg-warning-subtle text-dark border border-warning-subtle px-1 py-0" style={{ fontSize: '10px' }}>
                                                            <i className="fas fa-clipboard-check text-warning me-1"></i>Kuis
                                                        </span>
                                                        <span className="lesson-title text-truncate fw-semibold" title={l.title || matchedQuiz?.title}>
                                                            {l.title || matchedQuiz?.title || "Kuis Pembelajaran"}
                                                        </span>
                                                    </div>
                                                    <div className="lesson-meta-wrapper d-flex align-items-center gap-2 text-muted small" style={{ fontSize: '0.75rem' }}>
                                                        <span>{matchedQuiz?.total_questions || matchedQuiz?.questions?.length || 0} Pertanyaan</span>
                                                        <span>&bull;</span>
                                                        <span>Passing Grade: 70%</span>
                                                    </div>
                                                </div>

                                                <div className="lesson-actions ms-2">
                                                    {isQuizPassed ? (
                                                        <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1" style={{ fontSize: '11px' }}>
                                                            <i className="fas fa-check me-1"></i>Lulus ({Math.round(matchedQuiz?.best_score || 0)}%)
                                                        </span>
                                                    ) : lessonLockStatus.locked ? (
                                                        <span className="badge bg-light text-muted border px-2 py-1" style={{ fontSize: '11px' }}>
                                                            <i className="fas fa-lock me-1"></i>Terkunci
                                                        </span>
                                                    ) : (
                                                        <button type="button" className="btn btn-sm btn-outline-warning py-0 px-2" style={{ fontSize: '11px' }}>
                                                            <i className="fas fa-play me-1"></i>Buka Kuis
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                                
                                return (
                                    <div key={l.variant_item_id || lessonIndex} className="mb-0">
                                        <div 
                                            className={`lesson-item ${lessonLockStatus.locked ? "lesson-item-locked" : ""} ${isCompleted ? "completed" : isInProgress ? "in-progress" : ""} ${variantItem?.variant_item_id === l.variant_item_id ? "active" : ""} position-relative`}
                                            onClick={(e) => {
                                                if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT' && e.target.closest('button') === null) {
                                                    if (lessonLockStatus.locked) {
                                                        Toast().fire({
                                                            icon: 'warning',
                                                            title: 'Pelajaran Terkunci',
                                                            text: lessonLockStatus.reason,
                                                            timer: 4000
                                                        });
                                                        return;
                                                    }
                                                    if (isClickingLessonRef.current) {
                                                        return;
                                                    }
                                                    handlePlayVideo(l);
                                                }
                                            }}
                                            style={{
                                                cursor: lessonLockStatus.locked ? 'not-allowed' : 'pointer'
                                            }}
                                        >
                                            {/* Enhanced Progress indicator */}
                                            <div className={`lesson-progress-indicator ${lessonLockStatus.locked ? "locked" : progressStatus.status}`}>
                                                {isInProgress && !lessonLockStatus.locked && (
                                                    <div 
                                                        className="progress-fill" 
                                                        style={{ width: `${progressStatus.percentage}%` }}
                                                    />
                                                )}
                                            </div>
                                            
                                            <div className="d-flex align-items-center justify-content-between">
                                                <div className="d-flex align-items-center gap-3 flex-grow-1">
                                                    {(() => {
                                                        const isSameLesson = variantItem?.variant_item_id === l.variant_item_id;
                                                        
                                                        if (lessonLockStatus.locked) {
                                                            return (
                                                                <button
                                                                    type="button"
                                                                    className="lesson-play-btn locked"
                                                                    title={lessonLockStatus.reason}
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        Toast().fire({
                                                                            icon: 'warning',
                                                                            title: 'Pelajaran Terkunci',
                                                                            text: lessonLockStatus.reason,
                                                                            timer: 4000
                                                                        });
                                                                    }}
                                                                >
                                                                    <i className="fas fa-lock"></i>
                                                                </button>
                                                            );
                                                        }

                                                        return (
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    if (isClickingLessonRef.current) {
                                                                        return;
                                                                    }
                                                                    handlePlayVideo(l);
                                                                }}
                                                                onKeyPress={(e) => {
                                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        const isSameLesson = variantItem?.variant_item_id === l.variant_item_id;
                                                                        if (isSameLesson && isClickingLessonUI) {
                                                                            return;
                                                                        }
                                                                        handlePlayVideo(l);
                                                                    }
                                                                }}
                                                                className={`lesson-play-btn ${progressStatus.status}`}
                                                                title={getFileTypeTitle(l.file, l)}
                                                                disabled={isSameLesson && isClickingLessonUI}
                                                                style={{
                                                                    cursor: (isSameLesson && isClickingLessonUI) ? 'not-allowed' : 'pointer',
                                                                    opacity: (isSameLesson && isClickingLessonUI) ? 0.6 : 1,
                                                                    transition: 'opacity 0.2s ease'
                                                                }}
                                                            >
                                                                {(() => {
                                                                    const shouldShowPause = isSameLesson && isVideoPlaying;
                                                                    
                                                                    if (progressStatus.status === "completed") {
                                                                        return <i className="fas fa-check"></i>;
                                                                    } else if (isSameLesson) {
                                                                        return shouldShowPause ? (
                                                                            <i className="fas fa-pause text-warning"></i>
                                                                        ) : (
                                                                            <i className="fas fa-play text-warning"></i>
                                                                        );
                                                                    } else {
                                                                        return <i className={getFileIcon(l.file, l)}></i>;
                                                                    }
                                                                })()}
                                                            </button>
                                                        );
                                                    })()}
                                                    <div className="flex-grow-1">
                                                        <h6 className="mb-1 lesson-title">
                                                            {l.title}
                                                        </h6>
                                                        <div className="d-flex align-items-center gap-3 flex-wrap">
                                                            <small className="lesson-meta">
                                                                <i className={`${getFileTypeIcon(l.file, l)} me-1`}></i>
                                                                {getFileTypeLabel(l.file, l)}
                                                            </small>
                                                            {l.content_duration && l.content_duration !== "0m 0s" && (
                                                                <small className="lesson-meta">
                                                                    <i className="fas fa-clock me-1"></i>
                                                                    {l.content_duration}
                                                                </small>
                                                            )}
                                                            
                                                            {/* Enhanced progress status badges */}
                                                            {lessonLockStatus.locked ? (
                                                                <small className="lesson-status-badge locked" title={lessonLockStatus.reason}>
                                                                    <i className="fas fa-lock me-1"></i>
                                                                    Terkunci
                                                                </small>
                                                            ) : progressStatus.status === "completed" ? (
                                                                <small className="lesson-status-badge completed">
                                                                    <i className="fas fa-check-circle me-1"></i>
                                                                    Diselesaikan
                                                                </small>
                                                            ) : progressStatus.status === "in-progress" ? (
                                                                <small className="lesson-status-badge in-progress">
                                                                    <i className="fas fa-play-circle me-1"></i>
                                                                    {progressStatus.percentage}% ditonton
                                                                </small>
                                                            ) : isVideoLesson && progressStatus.status === "not-started" ? (
                                                                <small className="lesson-status-badge not-started">
                                                                    <i className="fas fa-play me-1"></i>
                                                                    Siap ditonton
                                                                </small>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
                })
            ) : (
                <div className="empty-state">
                    <i className="fas fa-play-circle empty-icon"></i>
                    <h5>Belum ada pelajaran yang tersedia</h5>
                    <p>Konten kursus akan segera tersedia</p>
                </div>
            )}

{/* 📌 Post-test Evaluation: Auto-pinned at end of curriculum */}
            {prePostQuiz && (
                <div 
                    className={`posttest-curriculum-item mt-3 p-3 rounded-3 border ${selectedQuiz?.quiz_id === prePostQuiz.quiz_id && (prePostQuiz.has_pre_test || selectedQuiz?.current_mode === 'post_test') ? 'active border-danger shadow-sm bg-light' : hasCompletedPosttest ? 'completed border-success-subtle bg-light' : !canTakePostTest ? 'locked border-secondary-subtle bg-light opacity-75' : 'pending border-danger bg-white shadow-sm'}`}
                    onClick={() => {
                        if (!canTakePostTest) {
                            Toast().fire({
                                icon: 'warning',
                                title: 'Post-test Terkunci',
                                text: postTestLockReason || 'Selesaikan seluruh materi kurikulum, kuis, dan gamifikasi terlebih dahulu untuk membuka Post-test.',
                                timer: 4500
                            });
                            return;
                        }
                        if (onSelectQuiz) {
                            onSelectQuiz({ ...prePostQuiz, current_mode: 'post_test' });
                        }
                    }}
                    style={{ cursor: !canTakePostTest ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease', borderRadius: '10px' }}
                >
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                        <div className="d-flex align-items-center gap-3">
                            <div className={`step-badge-icon rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 ${hasCompletedPosttest ? 'bg-success text-white' : !canTakePostTest ? 'bg-secondary text-white' : 'bg-danger text-white'}`} style={{ width: '38px', height: '38px', minWidth: '38px', minHeight: '38px', flexShrink: 0, aspectRatio: '1 / 1', fontSize: '0.95rem' }}>
                                <i className={`fas ${hasCompletedPosttest ? 'fa-check' : !canTakePostTest ? 'fa-lock' : 'fa-award'}`}></i>
                            </div>
                            <div>
                                <div className="d-flex align-items-center gap-2">
                                    <span className="badge bg-secondary-subtle text-secondary border px-2 py-0" style={{ fontSize: '10px' }}>LANGKAH AKHIR</span>
                                    <h6 className="mb-0 fw-bold text-dark" style={{ fontSize: '0.92rem' }}>Post-Test Evaluasi Akhir</h6>
                                </div>
                                <small className="text-muted d-block mt-1">
                                    {prePostQuiz.title} &bull; {prePostQuiz.total_questions || prePostQuiz.questions?.length || 0} Soal
                                </small>
                            </div>
                        </div>
                        <div>
                            {hasCompletedPosttest ? (
                                <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                                    <i className="fas fa-check-circle me-1"></i>Selesai ({Math.round(prePostQuiz.post_test_score || 0)}%)
                                </span>
                            ) : !canTakePostTest ? (
                                <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle px-2 py-1" title={postTestLockReason || 'Terkunci'}>
                                    <i className="fas fa-lock me-1"></i>Terkunci
                                </span>
                            ) : (
                                <button type="button" className="btn btn-sm btn-danger fw-bold px-3 py-1 text-nowrap">
                                    <i className="fas fa-play me-1"></i>Mulai Post-Test
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LecturesTab;
