import React, { useState, useRef, useEffect } from 'react';
import { Modal } from 'react-bootstrap';
import ReactPlayer from 'react-player';
import useAxios from '../../utils/useAxios';
import apiInstance from '../../utils/axios';
import UserData from '../../views/plugin/UserData';
import Toast from '../../views/plugin/Toast';
import { getMediaUrl, DEFAULT_IMAGE_URL } from '../../utils/constants';
import './LecturesTab.css';

const LecturesTab = ({
    course,
    enrollmentId,
    fetchCourseDetail,
    completionPercentage,
    // Video player modal state
    show,
    setShow,
    variantItem,
    setVariantItem
}) => {
    // Video player ref
    const playerRef = useRef(null);
    
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

    // Helper function to check if a lesson is completed
    const isLessonCompleted = (variantItem) => {
        if (!course.completed_lesson || !variantItem) return false;
        
        return course.completed_lesson.some(cl => {
            // Use consistent variant_item_id field throughout
            return cl.variant_item?.variant_item_id === variantItem.variant_item_id;
        });
    };

    // Helper functions for file handling
    const getFileIcon = (fileUrl) => {
        if (!fileUrl) return "fas fa-file";
        
        const extension = fileUrl.toLowerCase().split('.').pop().split('?')[0];
        const iconMap = {
            // Video files
            'mp4': 'fas fa-play',
            'avi': 'fas fa-play', 
            'mov': 'fas fa-play',
            'mkv': 'fas fa-play',
            'webm': 'fas fa-play',
            'ogg': 'fas fa-play',
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

    const getFileTypeIcon = (fileUrl) => {
        if (!fileUrl) return "fas fa-file";
        
        const extension = fileUrl.toLowerCase().split('.').pop().split('?')[0];
        const iconMap = {
            'mp4': 'fas fa-video', 'avi': 'fas fa-video', 'mov': 'fas fa-video', 'mkv': 'fas fa-video', 'webm': 'fas fa-video', 'ogg': 'fas fa-video',
            'pdf': 'fas fa-file-pdf', 'doc': 'fas fa-file-word', 'docx': 'fas fa-file-word', 'txt': 'fas fa-file-alt',
            'ppt': 'fas fa-file-powerpoint', 'pptx': 'fas fa-file-powerpoint',
            'jpg': 'fas fa-image', 'jpeg': 'fas fa-image', 'png': 'fas fa-image', 'gif': 'fas fa-image', 'bmp': 'fas fa-image'
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

    const getFileTypeTitle = (fileUrl) => {
        const type = getFileTypeLabel(fileUrl);
        return type === 'Video' ? 'Play video' : `Open ${type.toLowerCase()}`;
    };

    // Helper function to get lesson progress status
    const getLessonProgressStatus = (variantItem) => {
        if (!variantItem) return { status: 'not-started', percentage: 0 };
        
        // Check if lesson is completed first (from backend data)
        const isCompleted = isLessonCompleted(variantItem);
        if (isCompleted) {
            return { status: 'completed', percentage: 100 };
        }
        
        // Check if there's video progress data for this lesson
        const itemId = variantItem.variant_item_id;
        const progressKey = `progress_${itemId}`;
        const lessonProgress = progressStatus[progressKey];
        
        if (lessonProgress) {
            // Use the stored progress data
            if (lessonProgress.percentage > 0) {
                return lessonProgress;
            }
        }
        
        // For video files, show "Ready to watch" only if no progress exists
        if (isVideoFile(variantItem.file)) {
            return { status: 'not-started', percentage: 0 };
        }
        
        return { status: 'not-started', percentage: 0 };
    };

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

    // Modal handlers
    const handleClose = () => {
        setShow(false);
        setVariantItem(null);
        // Reset video player state
        setPlaying(false);
        setPlayed(0);
        setLoaded(0);
        setDuration(0);
        setSeekOnReady(null); // Reset seek position
    };

    const handleShow = (variant_item) => {
        setShow(true);
        setVariantItem(variant_item);
        // Reset video player state
        setPlaying(true);
        setPlayed(0);
        setLoaded(0);
        setDuration(0);
        setSeekOnReady(null); // Reset seek position
    };

    
	// Video Progress Tracking Functions
	const saveVideoProgress = async (variantItemId, position, duration, isCompleted = false) => {
        if (!variantItemId || !course?.course?.id || !duration || duration <= 0) {
            return false;
        }

        try {
            const progressPercentage = (position / duration) * 100;

            // Call backend API to save progress
            await apiInstance.post('/student/video-progress/', {
                user: UserData()?.user_id,
                course: course.course.id,
                variant_item: variantItemId,
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
            console.error('[Video Progress] Error saving:', error);
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
            const progressData = response.data;
            
            // Mark as loaded
            setProgressLoadedLessons(prev => new Set([...prev, variantItemId]));
            
            // Transform API response to expected format
            const transformedData = {
                position: progressData.last_watched_position || 0,
                duration: progressData.total_duration || 0,
                percentage: progressData.progress_percentage || 0,
                isCompleted: progressData.progress_percentage >= 99.8,
                isInProgress: progressData.progress_percentage > 1 && progressData.progress_percentage < 99.8
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
                        const timeString = `${resumeMinutes}:${resumeSeconds.toString().padStart(2, '0')}`;
                        
                        Toast().fire({
                            icon: "info",
                            title: "Resuming Video",
                            text: `Continuing from where you left off at ${timeString}`,
                            timer: 3000,
                            toast: true,
                            position: 'top-end'
                        });
                    }
                }
            }
            
            return transformedData;
        } catch (error) {
            console.warn(`[Video Progress] Failed to load progress for lesson ${variantItemId}:`, error);
            
            // Mark as loaded to avoid retries
            setProgressLoadedLessons(prev => new Set([...prev, variantItemId]));
            updateProgressStatus(variantItemId, null);
            return null;
        }
    };
	
	   
	   const updateProgressStatus = (variantItemId, progressData) => {
        const progressKey = `progress_${variantItemId}`;
        
        if (!progressData) {
            setProgressStatus(prev => ({
                ...prev,
                [progressKey]: { status: 'not-started', percentage: 0 }
            }));
            return;
        }

        // Determine status based on progress data
        let status = 'not-started';
        let percentage = progressData.percentage || 0;
        
        if (progressData.isCompleted || percentage >= 99.8) {
            status = 'completed';
        } else if (progressData.isInProgress || percentage > 0) {
            status = 'in-progress';
        }

        setProgressStatus(prev => ({
            ...prev,
            [progressKey]: { 
                status, 
                percentage: Math.round(Math.min(Math.max(percentage, 0), 100)),
                position: progressData.position || 0,
                duration: progressData.duration || 0
            }
        }));
    };

    // Function to refresh progress data
    const refreshProgressData = async () => {
        setProgressLoadedLessons(new Set()); // Clear loaded lessons to force reload
        setProgressStatus({}); // Clear current progress status
        
        // Reload all progress if lectures are available
        if (course?.curriculum?.length > 0) {
            // This will trigger the useEffect to reload progress
            const event = new Event('courseUpdated');
            window.dispatchEvent(event);
        }
    };

    const handleMarkLessonAsCompleted = async (variantItemId, isAutoComplete = false) => {
        // Use helper function to check completion status consistently
        const variantItem = { variant_item_id: variantItemId };
        const isAlreadyCompleted = isLessonCompleted(variantItem);
        
        // If auto-completion and already completed, just show notification and return early
        if (isAlreadyCompleted && isAutoComplete) {
            Toast().fire({
                icon: "info",
                title: "Lesson Already Completed!",
                text: "This lesson is already marked as completed.",
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
            // The backend automatically toggles completion status
            const formdata = new FormData();
            formdata.append("user_id", UserData()?.user_id || 0);
            formdata.append("course_id", course.course?.id);
            formdata.append("variant_item_id", variantItemId);

            const response = await useAxios.post(`student/course-completed/`, formdata);
            
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
            
            // Clear video progress for video lessons in different scenarios
            if (lessonItem && isVideoFile(lessonItem.file)) {
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
                        console.error(`[Progress Cleanup] Failed to clear progress for unmarked lesson ${variantItemId}:`, progressError);
                    }
                } else if (!isAlreadyCompleted) {
                    // Case 2: Lesson was just marked as completed (manually or automatically)
                    try {
                        // Clear video progress since lesson is now complete
                        await apiInstance.delete(`/student/video-progress-delete/${UserData()?.user_id}/${variantItemId}/`);
                        
                        // Update local progress state to show completed
                        const progressKey = `progress_${variantItemId}`;
                        setProgressStatus(prevStatus => ({
                            ...prevStatus,
                            [progressKey]: { 
                                status: 'completed', 
                                percentage: 100,
                                position: 0,
                                duration: 0
                            }
                        }));
                    } catch (progressError) {
                        console.error(`[Progress Cleanup] Failed to clear progress for completed lesson ${variantItemId}:`, progressError);
                    }
                }
            }
            
            
            // Refresh course data
            if (fetchCourseDetail) {
                if (isAutoComplete) {
                    fetchCourseDetail(true); // Silent update - no loading state
                } else {
                    fetchCourseDetail(); // Show loading for manual completions
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
                    title: "Lesson Unmarked!",
                    text: "Lesson has been marked as incomplete. Video progress has been reset.",
                    timer: 2000
                });
            } else if (!isAlreadyCompleted) {
                // Show different notifications for auto vs manual completion
                if (isAutoComplete) {
                    Toast().fire({
                        icon: "success",
                        title: "🎉 Lesson Completed Automatically!",
                        text: "Great job! The lesson has been marked as completed.",
                        timer: 4000,
                        showConfirmButton: false,
                    });
                } else {
                    Toast().fire({
                        icon: "success",
                        title: "Lesson Marked as Complete!",
                        timer: 2000
                    });
                }
            }
        } catch (error) {
            console.error("Error updating lesson completion:", error);
            setMarkAsCompletedStatus({
                ...markAsCompletedStatus,
                [key]: "Error",
            });
            
            Toast().fire({
                icon: "error",
                title: "Failed to update completion status",
                text: "Please try again in a moment.",
                timer: 3000
            });
        }
    };

    // Video file detection
    const isVideoFile = (filename) => {
        if (!filename) return false;
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.m4v'];
        return videoExtensions.some(ext => filename.toLowerCase().includes(ext.toLowerCase()));
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
        
        // Only save progress when video is actively playing and has meaningful progress
        if (variantItem && duration > 0 && playing && progress.played > 0.01) {
            const currentPosition = progress.played * duration;
            const progressPercentage = progress.played * 100;
            const itemId = variantItem.variant_item_id;
            
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
                    handleMarkLessonAsCompleted(itemId, true).then(() => {
                        // Close modal after completion with delay to show message
                        setTimeout(() => {
                            handleClose();
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
            playerRef.current.seekTo(newPlayed, 'fraction');
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
        const videoContainer = document.querySelector('.video-container');
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
            if (!show || !isVideoFile(variantItem?.file)) return;
            
            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    handlePlayPause();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    const backwardTime = Math.max(0, played - 0.05);
                    setPlayed(backwardTime);
                    playerRef.current?.seekTo(backwardTime);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    const forwardTime = Math.min(1, played + 0.05);
                    setPlayed(forwardTime);
                    playerRef.current?.seekTo(forwardTime);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setVolume(Math.min(1, volume + 0.1));
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setVolume(Math.max(0, volume - 0.1));
                    break;
                case 'KeyM':
                    e.preventDefault();
                    toggleMute();
                    break;
                case 'KeyF':
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                default:
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyPress);
        return () => document.removeEventListener('keydown', handleKeyPress);
    }, [show, variantItem, playing, played, volume, muted]);

    // Handle fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            setFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Format time helper
    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return '00:00';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    // Load progress for all video lessons when course loads
    useEffect(() => {
        if (course?.curriculum && course.curriculum.length > 0) {
            const loadAllProgress = async () => {
                try {
                    // Load progress for each video lesson individually
                    for (const section of course.curriculum) {
                        if (section.variant_items && section.variant_items.length > 0) {
                            for (const item of section.variant_items) {
                                if (isVideoFile(item.file)) {
                                    const itemId = item.variant_item_id;
                                    if (itemId) {
                                        try {
                                            await loadVideoProgress(itemId);
                                        } catch (loadError) {
                                            console.error(`[Video Progress] Failed to load progress for ${itemId}:`, loadError);
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('[Video Progress] Failed to load all progress:', error);
                }
            };
            
            loadAllProgress();
        }
    }, [course]);

    // Load video progress when modal opens (resume functionality)
    useEffect(() => {
        if (show && variantItem && isVideoFile(variantItem.file)) {
            const itemId = variantItem.variant_item_id;
            if (itemId) {
                loadVideoProgress(itemId);
            } else {
                console.warn(`[Video Progress] No variant_item_id found for modal lesson: ${variantItem.title}`);
            }
        }
    }, [show, variantItem]);

    // Enhanced seek to specific time when video is ready (improved resume functionality)
    useEffect(() => {
        const performSeek = async (timeToSeek, maxRetries = 5) => {
            if (!playerRef.current || !timeToSeek || timeToSeek <= 0 || !duration) {
                console.warn('[Video Resume] Invalid conditions for seeking');
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
                        playerRef.current.seekTo(seekPercentage, 'fraction');
                        
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
                        console.error(`[Video Resume] Seek attempt ${attempt} failed:`, error);
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

            console.error(`[Video Resume] Failed to seek to ${timeToSeek}s after ${maxRetries} attempts`);
            setSeekOnReady(null); // Clear seek request even on failure
        };

        if (show && variantItem && playerRef.current && seekOnReady && duration > 0) {
            performSeek(seekOnReady);
        }
    }, [show, variantItem, duration, seekOnReady]);

    return (
        <div className="tab-pane fade show active" id="lectures" role="tabpanel">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h4 className="mb-0">Course Curriculum</h4>
                {course?.curriculum?.length > 0 && (() => {
                    const totalLessons = course.curriculum.reduce((acc, c) => acc + (c.variant_items?.length || 0), 0);
                    const completedLessons = getCompletedLessonsCount() || 0;
                    const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
                    
                    return (
                        <div className="curriculum-progress-container">
                            {/* Move stats above the bar */}
                            <div className="course-progress-stats">
                                <span className="progress-text text-white">
                                    {completedLessons}/{totalLessons} lessons
                                </span>
                                <span className="progress-percentage text-white">
                                    {progressPercentage}%
                                </span>
                            </div>
                            <div className="course-progress-bar">
                                <div 
                                    className="course-progress-fill" 
                                    style={{width: `${progressPercentage}%`}}
                                ></div>
                            </div>
                        </div>
                    );
                })()}
            </div>
            
            {course?.curriculum?.length > 0 ? (
                course.curriculum.map((c, index) => (
                    <div key={c.variant_id || index} className="lecture-card">
                        <div className="lecture-header">
                            <div className="lecture-header-content">
                                <div className="d-flex align-items-center justify-content-between">
                                    <div>
                                        <h5 className="mb-1">{c.title}</h5>
                                        <small className="opacity-90">
                                            {c.variant_items?.length || 0} Lesson{(c.variant_items?.length || 0) !== 1 ? 's' : ''}
                                        </small>
                                    </div>
                                    <button
                                        className="btn btn-link text-white p-0"
                                        type="button"
                                        data-bs-toggle="collapse"
                                        data-bs-target={`#collapse-${c.variant_id}`}
                                    >
                                        <i className="fas fa-chevron-down fa-lg"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <div id={`collapse-${c.variant_id}`} className="collapse show">
                            {c.variant_items?.map((l, lessonIndex) => {
                                // Get detailed progress status
                                const progressStatus = getLessonProgressStatus(l);
                                const isCompleted = progressStatus.status === 'completed';
                                const isInProgress = progressStatus.status === 'in-progress';
                                const isVideoLesson = isVideoFile(l.file);
                                const itemId = l.variant_item_id;
                                
                                return (
                                    <div key={l.variant_item_id || lessonIndex} className="mb-3">{/* Use only variant_item_id for key */}
                                        <div className={`lesson-item ${isCompleted ? 'completed' : isInProgress ? 'in-progress' : ''} p-3 rounded-3 position-relative`}>
                                            {/* Enhanced Progress indicator */}
                                            <div className={`lesson-progress-indicator ${progressStatus.status}`}>
                                                {isInProgress && (
                                                    <div 
                                                        className="progress-fill" 
                                                        style={{ width: `${progressStatus.percentage}%` }}
                                                    />
                                                )}
                                            </div>
                                            
                                            <div className="d-flex align-items-center justify-content-between">
                                                <div className="d-flex align-items-center gap-3 flex-grow-1">
                                                    <button 
                                                        onClick={() => handleShow(l)} 
                                                        className={`lesson-play-btn ${progressStatus.status}`}
                                                        title={getFileTypeTitle(l.file)}
                                                    >
                                                        {progressStatus.status === 'completed' ? (
                                                            <i className="fas fa-check"></i>
                                                        ) : progressStatus.status === 'in-progress' ? (
                                                            <i className="fas fa-play text-warning"></i>
                                                        ) : (
                                                            <i className={getFileIcon(l.file)}></i>
                                                        )}
                                                    </button>
                                                    <div className="flex-grow-1">
                                                        <h6 className="mb-1 lesson-title">
                                                            {l.title}
                                                        </h6>
                                                        <div className="d-flex align-items-center gap-3 flex-wrap">
                                                            <small className="lesson-meta">
                                                                <i className={`${getFileTypeIcon(l.file)} me-1`}></i>
                                                                {getFileTypeLabel(l.file)}
                                                            </small>
                                                            {l.content_duration && l.content_duration !== "0m 0s" && (
                                                                <small className="lesson-meta">
                                                                    <i className="fas fa-clock me-1"></i>
                                                                    {l.content_duration}
                                                                </small>
                                                            )}
                                                            
                                                            {/* Enhanced progress status badges */}
                                                            {progressStatus.status === 'completed' && (
                                                                <small className="lesson-status-badge completed">
                                                                    <i className="fas fa-check-circle me-1"></i>
                                                                    Completed
                                                                </small>
                                                            )}
                                                            {progressStatus.status === 'in-progress' && (
                                                                <small className="lesson-status-badge in-progress">
                                                                    <i className="fas fa-play-circle me-1"></i>
                                                                    {progressStatus.percentage}% watched
                                                                </small>
                                                            )}
                                                            {isVideoLesson && progressStatus.status === 'not-started' && (
                                                                <small className="lesson-status-badge not-started">
                                                                    <i className="fas fa-play me-1"></i>
                                                                    Ready to watch
                                                                </small>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="d-flex align-items-center gap-2">
                                                    <div className="lesson-status-container position-relative">
                                                        {(() => {
                                                            const key = `lecture_${l.variant_item_id}`;
                                                            const isUpdating = markAsCompletedStatus[key] === "Updating";
                                                            
                                                            return (
                                                                <>
                                                                    <input
                                                                        type="checkbox"
                                                                        className="lesson-completion-checkbox"
                                                                        id={`lesson-${l.variant_item_id}`}
                                                                        onChange={() => handleMarkLessonAsCompleted(l.variant_item_id)}
                                                                        checked={isCompleted}
                                                                        disabled={isUpdating}
                                                                    />
                                                                    <label 
                                                                        htmlFor={`lesson-${l.variant_item_id}`}
                                                                        className={`lesson-completion-label ${isUpdating ? 'updating' : ''}`}
                                                                        title={isUpdating ? 'Updating...' : (isCompleted ? 'Mark as incomplete' : 'Mark as complete')}
                                                                    >
                                                                        {isUpdating ? (
                                                                            <div className="spinner-border spinner-border-sm text-primary" role="status">
                                                                                <span className="visually-hidden">Loading...</span>
                                                                            </div>
                                                                        ) : (
                                                                            <i className="fas fa-check"></i>
                                                                        )}
                                                                    </label>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))
            ) : (
                <div className="empty-state">
                    <i className="fas fa-play-circle empty-icon"></i>
                    <h5>No lectures available yet</h5>
                    <p>Course content will be available soon</p>
                </div>
            )}

            {/* File Viewer Modal */}
            <Modal show={show} onHide={handleClose} size="xl" className="viewer-modal-modern">
                <Modal.Header 
                    className="border-0 text-white position-relative"
                    style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        padding: '1rem 2rem',
                        zIndex: 10
                    }}
                >
                    {/* Decorative background elements */}
                    <div 
                        style={{
                            position: 'absolute',
                            top: '-50%',
                            right: '-20%',
                            width: '40%',
                            height: '200%',
                            background: 'rgba(255, 255, 255, 0.1)',
                            transform: 'rotate(15deg)',
                            zIndex: -1
                        }}
                    ></div>
                    
                    <Modal.Title className="d-flex align-items-center" style={{ zIndex: 2, position: 'relative' }}>
                        <div 
                            className="me-3"
                            style={{
                                width: '50px',
                                height: '50px',
                                background: 'rgba(255, 255, 255, 0.2)',
                                borderRadius: '15px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <i className={`${getFileTypeIcon(variantItem?.file)} text-white`} style={{ fontSize: '1.2rem' }}></i>
                        </div>
                        <div>
                            <div className="fw-bold fs-4">{variantItem?.title}</div>
                            <div className="d-flex align-items-center gap-3">
                                <small className="opacity-90">
                                    {getFileTypeLabel(variantItem?.file)} • {variantItem?.content_duration || "N/A"}
                                </small>
                            </div>
                        </div>
                    </Modal.Title>
                    <button
                        type="button"
                        className="btn btn-close"
                        aria-label="Close"
                        onClick={handleClose}
                        style={{
                            position: 'absolute',
                            top: '1.5rem',
                            right: '1.5rem',
                            zIndex: 100
                        }}
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </Modal.Header>
                <Modal.Body className="p-0 bg-dark position-relative">
                    {variantItem?.file && (
                        <>
                            {isVideoFile(variantItem.file) ? (
                                // Video Player
                                <div className="video-container position-relative">
                                    {/* Progress badge at top right */}
                            {isVideoFile(variantItem?.file) && (
                                <div
                                    className="video-progress-badge"
                                    style={{
                                        position: 'absolute',
                                        top: '16px',
                                        right: '24px',
                                        background: 'rgba(0,0,0,0.7)',
                                        color: '#fff',
                                        padding: '6px 14px',
                                        borderRadius: '18px',
                                        fontSize: '0.95rem',
                                        zIndex: 2147483647,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        width: 'fit-content',
                                        maxWidth: '200px',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    <i className="fas fa-chart-line"></i>
                                    {Math.round(played * 100)}% watched
                                </div>
                            )}                                    <ReactPlayer
                                        url={variantItem.file.startsWith("http") ? variantItem.file : getMediaUrl(variantItem.file)}
                                        controls={true}
                                        playing={playing}
                                        width="100%"
                                        height={'60vh'}
                                        onProgress={handleProgress}
                                        ref={playerRef}
                                        onPause={() => {
                                            // Save progress when user pauses the video
                                            if (variantItem && duration > 0) {
                                                const itemId = variantItem.variant_item_id;
                                                const currentTime = playerRef.current?.getCurrentTime?.() || (played * duration);
                                                const progressPercentage = (currentTime / duration) * 100;
                                                saveVideoProgress(itemId, currentTime, duration, progressPercentage >= 99.8);
                                            }
                                        }}
                                        onEnded={() => {
                                            // Mark lesson as completed when video ends and close modal
                                            const variantItemForCompletion = { variant_item_id: variantItem.variant_item_id };
                                            
                                            const completeLesson = () => {
                                                if (!isLessonCompleted(variantItemForCompletion)) {
                                                    handleMarkLessonAsCompleted(variantItem.variant_item_id, true).then(() => {
                                                        // Close modal after completion with delay to show success message
                                                        setTimeout(() => {
                                                            handleClose();
                                                        }, 4000);
                                                    });
                                                } else {
                                                    // If already completed, just close modal with shorter delay
                                                    setTimeout(() => {
                                                        handleClose();
                                                    }, 2000);
                                                }
                                            };
                                            
                                            // Check if video is in fullscreen mode
                                            const isFullscreen = document.fullscreenElement || 
                                                document.webkitFullscreenElement || 
                                                document.mozFullScreenElement || 
                                                document.msFullscreenElement;
                                            
                                            if (isFullscreen) {
                                                // Exit fullscreen first
                                                const exitFullscreen = document.exitFullscreen ||
                                                    document.webkitExitFullscreen ||
                                                    document.mozCancelFullScreen ||
                                                    document.msExitFullscreen;
                                                
                                                if (exitFullscreen) {
                                                    exitFullscreen.call(document).then(() => {
                                                        // Show notification after exiting fullscreen with small delay
                                                        setTimeout(() => {
                                                            completeLesson();
                                                        }, 300);
                                                    }).catch((err) => {
                                                        console.error('[Fullscreen] Error exiting fullscreen:', err);
                                                        // Show notification anyway if exit fails
                                                        completeLesson();
                                                    });
                                                } else {
                                                    // Fallback if exit not supported
                                                    completeLesson();
                                                }
                                            } else {
                                                // Not in fullscreen, show notification normally
                                                completeLesson();
                                            }
                                        }}
                                    />
                                </div>
                            ) : (
                                // File Preview for Non-Video Files
                                <div className="p-4 text-center" style={{ minHeight: '400px' }}>
                                    <div className="file-preview-container">
                                        <div className="file-icon-large mb-3">
                                            <i className={`${getFileTypeIcon(variantItem.file)} fa-4x`} style={{ color: '#667eea' }}></i>
                                        </div>
                                        <h5 className="mb-2 text-white">{variantItem.title}</h5>
                                        <p className="text-muted mb-4">
                                            {getFileTypeLabel(variantItem.file)} File
                                        </p>
                                        <div className="d-flex gap-3 justify-content-center">
                                            <a
                                                href={variantItem.file.startsWith("http") ? variantItem.file : getMediaUrl(variantItem.file)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-primary btn-lg"
                                                onClick={() => {
                                                    // Mark as completed when user opens the file
                                                    if (!isLessonCompleted(variantItem)) {
                                                        setTimeout(() => {
                                                            handleMarkLessonAsCompleted(variantItem.variant_item_id, true);
                                                        }, 1000);
                                                    }
                                                }}
                                            >
                                                <i className="fas fa-external-link-alt me-2"></i>
                                                Open File
                                            </a>
                                            <a
                                                href={variantItem.file.startsWith("http") ? variantItem.file : getMediaUrl(variantItem.file)}
                                                download
                                                className="btn btn-outline-light btn-lg"
                                            >
                                                <i className="fas fa-download me-2"></i>
                                                Download
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </Modal.Body>
            </Modal>
        </div>
    );
};

export default LecturesTab;