import React, { useState, useRef, useEffect } from 'react';
import { Modal } from 'react-bootstrap';
import ReactPlayer from 'react-player';
import useAxios from '../../utils/useAxios';
import UserData from '../../views/plugin/UserData';
import Toast from '../../views/plugin/Toast';
import VideoProgressManager from '../../utils/VideoProgressManager';
import { getMediaUrl, DEFAULT_IMAGE_URL } from '../../utils/constants';
import './LecturesTabNew.css';

const LecturesTabNew = ({
    course,
    enrollmentId,
    fetchCourseDetail,
    completionPercentage,
    show,
    setShow,
    variantItem,
    setVariantItem,
    onProgressUpdate  // ✨ PHASE 4.131: Callback to notify parent when lesson progress updates
}) => {
    // Video player ref and states
    const playerRef = useRef(null);
    const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const isClickingLessonRef = useRef(false);  // ✨ PHASE 4.111: Use ref to prevent concurrent clicks without causing re-renders
    const [isClickingLessonUI, setIsClickingLessonUI] = useState(false);  // ✨ PHASE 4.111: State for visual feedback
    
    // Simplified video states - managed by VideoProgressManager
    const [playing, setPlaying] = useState(false);
    const [played, setPlayed] = useState(0);
    const [loaded, setLoaded] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [seeking, setSeeking] = useState(false);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    
    // Simplified state management
    const [progressData, setProgressData] = useState({});
    const [markAsCompletedStatus, setMarkAsCompletedStatus] = useState({});

    // Helper function to check if a lesson is completed
    const isLessonCompleted = (variantItem) => {
        if (!course.completed_lesson || !variantItem) return false;
        
        return course.completed_lesson.some(cl => {
            const clId = cl.variant_item?.id || cl.variant_item?.variant_item_id;
            const itemId = variantItem.id || variantItem.variant_item_id;
            return clId === itemId;
        });
    };

    // Helper functions for file handling
    const getFileIcon = (fileUrl) => {
        if (!fileUrl) return 'fas fa-file';
        
        const fileExtension = fileUrl.split('.').pop()?.toLowerCase();
        const iconMap = {
            pdf: 'fas fa-file-pdf text-danger',
            doc: 'fas fa-file-word text-primary',
            docx: 'fas fa-file-word text-primary',
            xls: 'fas fa-file-excel text-success',
            xlsx: 'fas fa-file-excel text-success',
            ppt: 'fas fa-file-powerpoint text-warning',
            pptx: 'fas fa-file-powerpoint text-warning',
            txt: 'fas fa-file-alt',
            mp4: 'fas fa-play-circle text-primary',
            avi: 'fas fa-play-circle text-primary',
            mov: 'fas fa-play-circle text-primary',
            wmv: 'fas fa-play-circle text-primary',
            mp3: 'fas fa-music text-success',
            wav: 'fas fa-music text-success',
            zip: 'fas fa-file-archive text-secondary',
            rar: 'fas fa-file-archive text-secondary',
            jpg: 'fas fa-image text-info',
            jpeg: 'fas fa-image text-info',
            png: 'fas fa-image text-info',
            gif: 'fas fa-image text-info'
        };
        
        return iconMap[fileExtension] || 'fas fa-file';
    };

    const getFileTypeLabel = (fileUrl) => {
        if (!fileUrl) return 'Unknown';
        
        const fileExtension = fileUrl.split('.').pop()?.toLowerCase();
        const typeMap = {
            pdf: 'PDF Document',
            doc: 'Word Document',
            docx: 'Word Document',
            mp4: 'Video',
            avi: 'Video',
            mov: 'Video',
            mp3: 'Audio',
            txt: 'Text Document'
        };
        
        return typeMap[fileExtension] || 'File';
    };

    const isVideoFile = (filename) => {
        if (!filename) return false;
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.m4v'];
        return videoExtensions.some(ext => filename.toLowerCase().includes(ext.toLowerCase()));
    };

    // ✨ PHASE 4.111: Failsafe to reset click lock if modal doesn't open
    useEffect(() => {
        if (isClickingLessonUI && !show) {
            // If we're in "clicking" state but modal isn't open, wait a bit longer
            const failsafeTimer = setTimeout(() => {
                if (isClickingLessonUI && !show) {
                    isClickingLessonRef.current = false;
                    setIsClickingLessonUI(false);
                }
            }, 2000);  // 2 second failsafe timeout
            
            return () => clearTimeout(failsafeTimer);
        }
    }, [isClickingLessonUI, show]);

    // Get lesson progress status using VideoProgressManager
    // ✨ PHASE 4.103: FIX - Check backend completion status FIRST before video progress
    const getLessonProgressStatus = (variantItem) => {
        if (!variantItem || !course?.course?.id) return { status: 'not-started', percentage: 0 };
        
        // CRITICAL FIX: Check if lesson is marked as completed in the backend FIRST
        // This ensures the UI reflects the actual completion status after video ends
        if (isLessonCompleted(variantItem)) {
            return { status: 'completed', percentage: 100 };
        }
        
        // If not marked complete, check video progress data for in-progress status
        const itemId = variantItem.variant_item_id || variantItem.id;
        const progressKey = `${course.course.id}_${itemId}`;
        const progress = progressData[progressKey];
        
        if (!progress) return { status: 'not-started', percentage: 0 };
        
        // ✨ PHASE 4.114: Show progress if there's any percentage watched (not just in-progress)
        const percentage = Math.round(progress.percentage || 0);
        
        // If there's any progress (even if not marked isInProgress), show it
        if (percentage > 0 && percentage < 100) {
            return { status: 'in-progress', percentage };
        } else if (percentage >= 100) {
            // If 100% watched but not yet marked as completed
            return { status: 'in-progress', percentage: 100 };
        }
        
        return { status: 'not-started', percentage: 0 };
    };

    // Count completed lessons
    const getCompletedLessonsCount = () => {
        if (!course.completed_lesson) return 0;
        return course.completed_lesson.length;
    };

    // Modal handlers
    const handleClose = () => {
        // Save final progress before closing
        if (variantItem && duration > 0 && played > 0) {
            saveCurrentProgress();
        }
        
        // Reset video states
        setPlaying(false);
        setPlayed(0);
        setDuration(0);
        setShow(false);
        setVariantItem(null);
        isClickingLessonRef.current = false;  // ✨ PHASE 4.111: Reset click flag when modal closes
        setIsClickingLessonUI(false);  // Reset UI state
    };

    const handleShow = (variant_item) => {
        // ✨ PHASE 4.111: Prevent rapid repeated clicks using ref + state
        if (isClickingLessonRef.current) {
            return;
        }
        
        isClickingLessonRef.current = true;
        setIsClickingLessonUI(true);  // Update UI to show busy state
        
        setVariantItem(variant_item);
        setShow(true);
        setIsLoading(true);
        setError(null);
        
        // Load progress for this lesson
        loadLessonProgress(variant_item);
        
        // Reset click flag after brief delay to prevent accidental double-clicks
        setTimeout(() => {
            isClickingLessonRef.current = false;
            setIsClickingLessonUI(false);  // Update UI to show ready state
        }, 200);
    };

    // Load progress for a single lesson using VideoProgressManager
    const loadLessonProgress = async (lesson) => {
        if (!lesson || !course?.course?.id) return;
        
        const itemId = lesson.variant_item_id || lesson.id;
        
        try {
            const progress = await VideoProgressManager.getProgress(course.course.id, itemId);
            
            setProgressData(prev => ({
                ...prev,
                [`${course.course.id}_${itemId}`]: progress
            }));
            
            // Set resume position if video has progress
            if (progress.position > 5 && progress.percentage < 99.8) {
                const resumePosition = progress.position / (progress.duration || 1);
                setPlayed(resumePosition);
                
                // Show resume notification
                if (progress.position > 30) {
                    const minutes = Math.floor(progress.position / 60);
                    const seconds = Math.floor(progress.position % 60);
                    
                    Toast().fire({
                        icon: "info",
                        title: "Resuming Video",
                        text: `Continuing from ${minutes}:${seconds.toString().padStart(2, '0')}`,
                        timer: 5174,
                        toast: true,
                        position: 'top-end'
                    });
                }
            }
            
        } catch (error) {
        }
    };

    // Load progress for all video lessons
    const loadAllProgress = async () => {
        if (!course?.curriculum || !course?.course?.id) return;
        
        try {
            // Collect all video lesson IDs
            const videoLessonIds = [];
            
            course.curriculum.forEach(section => {
                if (section.variant_items) {
                    section.variant_items.forEach(item => {
                        if (isVideoFile(item.file)) {
                            videoLessonIds.push(item.variant_item_id || item.id);
                        }
                    });
                }
            });
            
            if (videoLessonIds.length === 0) return;
            
            // ✨ PHASE 4.114: Debug progress loading
            
            // Batch load progress
            const progressResults = await VideoProgressManager.loadProgressBatch(
                course.course.id, 
                videoLessonIds
            );
            
            // Update state with all progress data
            const newProgressData = {};
            Object.entries(progressResults).forEach(([itemId, progress]) => {
                newProgressData[`${course.course.id}_${itemId}`] = progress;
                if (progress.percentage > 0) {
                }
            });
            
            setProgressData(prev => ({ ...prev, ...newProgressData }));
            
        } catch (error) {
        }
    };

    // Save current video progress
    // ✨ PHASE 4.114: Periodic progress saving with debug logging
    const saveCurrentProgress = async () => {
        if (!variantItem || !duration || duration === 0) return;
        
        const itemId = variantItem.variant_item_id || variantItem.id;
        const currentPosition = played * duration;
        const currentPercentage = played * 100;
        
        // Don't save if at very beginning or already completed
        if (currentPosition < 1 || currentPercentage >= 99.8) return;
        
        try {
            await VideoProgressManager.updateProgress(course.course.id, itemId, {
                position: currentPosition,
                duration: duration,
                percentage: currentPercentage
            });
            
            // Update local state
            setProgressData(prev => ({
                ...prev,
                [`${course.course.id}_${itemId}`]: {
                    position: currentPosition,
                    duration: duration,
                    percentage: currentPercentage,
                    isCompleted: currentPercentage >= 99.8,
                    isInProgress: currentPercentage > 1 && currentPercentage < 99.8
                }
            }));
            
            
        } catch (error) {
        }
    };

    // Mark lesson as completed
    const handleMarkLessonAsCompleted = async (variantItemId, isAutoComplete = false) => {
        const variantItemForCheck = { id: variantItemId, variant_item_id: variantItemId };
        const isAlreadyCompleted = isLessonCompleted(variantItemForCheck);
        
        if (isAlreadyCompleted && isAutoComplete) {
            Toast().fire({
                icon: "info",
                title: "Lesson Already Completed!",
                timer: 2000
            });
            return;
        }

        const key = `lecture_${variantItemId}`;
        setMarkAsCompletedStatus(prev => ({ ...prev, [key]: "Updating" }));

        try {
            const formdata = new FormData();
            formdata.append("user_id", UserData()?.user_id || 0);
            formdata.append("course_id", course.course?.id);
            formdata.append("variant_item_id", variantItemId);

            await useAxios.post(`student/course-completed/`, formdata);
            
            // Refresh course data
            if (fetchCourseDetail) {
                await fetchCourseDetail();
            }
            
            setMarkAsCompletedStatus(prev => ({ ...prev, [key]: "Updated" }));
            
            Toast().fire({
                icon: "success",
                title: isAlreadyCompleted ? "Lesson Unmarked" : "Lesson Completed!",
                timer: 2000
            });
            
        } catch (error) {
            setMarkAsCompletedStatus(prev => ({ ...prev, [key]: "Error" }));
            
            Toast().fire({
                icon: "error",
                title: "Gagal memperbarui status penyelesaian",
                timer: 5174
            });
        }
    };

    // Video player event handlers
    const handleProgress = (progress) => {
        if (!seeking) {
            setPlayed(progress.played);
            setLoaded(progress.loaded);
            
            // Auto-save progress periodically
            if (playing && variantItem && duration > 0) {
                const currentPercentage = progress.played * 100;
                
                // Save every 5% or when paused
                if (currentPercentage > 1 && currentPercentage < 99.8) {
                    const lastSavedPercent = progressData[`${course.course.id}_${variantItem.variant_item_id || variantItem.id}`]?.percentage || 0;
                    
                    if (Math.abs(currentPercentage - lastSavedPercent) >= 5) {
                        saveCurrentProgress();
                    }
                }
                
                // Auto-complete at 99.8%
                if (currentPercentage >= 99.8) {
                    const variantItemForCheck = { id: variantItem.id, variant_item_id: variantItem.variant_item_id };
                    if (!isLessonCompleted(variantItemForCheck)) {
                        handleMarkLessonAsCompleted(variantItem.variant_item_id, true);
                    }
                }
            }
        }
    };

    const handleSeekMouseUp = (e) => {
        setSeeking(false);
        const newPlayed = parseFloat(e.target.value);
        playerRef.current?.seekTo(newPlayed);
        
        // Save progress at new position
        setTimeout(() => saveCurrentProgress(), 1000);
    };

    const handleDuration = (newDuration) => {
        setDuration(newDuration);
        
        // If we have saved progress, seek to that position
        if (variantItem && course?.course?.id) {
            const itemId = variantItem.variant_item_id || variantItem.id;
            const progress = progressData[`${course.course.id}_${itemId}`];
            
            if (progress && progress.position > 5 && progress.percentage < 99.8) {
                const resumePercentage = progress.position / newDuration;
                setPlayed(resumePercentage);
                
                // Seek player to saved position
                setTimeout(() => {
                    if (playerRef.current) {
                        playerRef.current.seekTo(resumePercentage);
                    }
                }, 500);
            }
        }
    };

    const handlePlayPause = () => setPlaying(!playing);
    const handleVolumeChange = (e) => setVolume(parseFloat(e.target.value));
    const toggleMute = () => setMuted(!muted);
    const handlePlaybackRateChange = (rate) => setPlaybackRate(rate);

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

    // Load all progress when component mounts
    useEffect(() => {
        if (course?.curriculum) {
            loadAllProgress();
        }
    }, [course]);

    // ✨ PHASE 4.131: Register progress update callback to parent (CourseDetail)
    // This updates the lesson badge in real-time when video progress changes
    useEffect(() => {
        if (onProgressUpdate && course?.course?.id) {
            // Create callback function that updates progressData when progress changes
            const updateProgressCallback = (variantItemId, progressInfo) => {
                
                setProgressData(prev => ({
                    ...prev,
                    [`${course.course.id}_${variantItemId}`]: progressInfo
                }));
            };
            
            // Register the callback with parent
            onProgressUpdate(updateProgressCallback);
            
        }
    }, [onProgressUpdate, course?.course?.id]);

    // Auto-play video when modal opens
    useEffect(() => {
        if (show && variantItem && isVideoFile(variantItem.file)) {
            setPlaying(true);
        }
    }, [show, variantItem]);

    // ✨ PHASE 4.114: Periodically save video progress every 5 seconds while playing
    useEffect(() => {
        if (!show || !playing || !variantItem || !duration) return;

        const progressInterval = setInterval(() => {
            saveCurrentProgress();
        }, 5000);  // Save every 5 seconds

        return () => clearInterval(progressInterval);
    }, [show, playing, variantItem, duration, played]);

    return (
        <div className="tab-pane fade show active" id="lectures" role="tabpanel">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h4 className="mb-0">Course Curriculum</h4>
                {course?.curriculum?.length > 0 && (() => {
                    const totalLessons = course.curriculum.reduce((acc, c) => acc + (c.variant_items?.length || 0), 0);
                    const completedLessons = getCompletedLessonsCount() || 0;
                    const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
                    
                    return (
                        <div className="course-progress-container">
                            <div className="course-progress-stats">
                                <small className="text-muted">
                                    {completedLessons} of {totalLessons} lessons completed ({progressPercentage}%)
                                </small>
                            </div>
                            <div className="course-progress-bar">
                                <div className="progress" style={{ height: '6px', borderRadius: '3px' }}>
                                    <div 
                                        className="progress-bar bg-success" 
                                        role="progressbar" 
                                        style={{ width: `${progressPercentage}%` }}
                                        aria-valuenow={progressPercentage} 
                                        aria-valuemin="0" 
                                        aria-valuemax="100"
                                    ></div>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>

            <div className="curriculum-content">
                {course?.curriculum?.length > 0 ? (
                    course.curriculum.map((c, sectionIndex) => (
                        <div key={c.variant_id || sectionIndex} className="curriculum-section mb-4">
                            <div className="section-header p-3 bg-light rounded-top border">
                                <h5 className="mb-0 section-title">
                                    <i className="fas fa-folder-open me-2"></i>
                                    {c.title}
                                </h5>
                                <small className="text-muted">
                                    {c.variant_items?.length || 0} lessons
                                </small>
                            </div>
                            
                            <div className="section-content border border-top-0 rounded-bottom">
                                {c.variant_items?.length > 0 ? (
                                    c.variant_items.map((l, lessonIndex) => {
                                        const isCompleted = isLessonCompleted(l);
                                        const progressStatus = getLessonProgressStatus(l);
                                        const isVideoLesson = isVideoFile(l.file);
                                        
                                        return (
                                            <div key={l.variant_item_id || l.id || lessonIndex} className="mb-3">
                                                <div className={`lesson-item ${progressStatus.status} p-3 position-relative`}>
                                                    {/* Progress indicator */}
                                                    <div className={`lesson-progress-indicator ${progressStatus.status}`}>
                                                        {progressStatus.status === 'in-progress' && (
                                                            <div 
                                                                className="progress-fill" 
                                                                style={{ width: `${progressStatus.percentage}%` }}
                                                            />
                                                        )}
                                                    </div>
                                                    
                                                    <div className="d-flex align-items-center justify-content-between">
                                                        <div className="d-flex align-items-center gap-3 flex-grow-1">
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    handleShow(l);
                                                                }}
                                                                onKeyPress={(e) => {
                                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                                        e.preventDefault();
                                                                        handleShow(l);
                                                                    }
                                                                }}
                                                                className={`lesson-play-btn ${progressStatus.status}`}
                                                                title={getFileTypeLabel(l.file)}
                                                                disabled={isClickingLessonUI}
                                                                style={{
                                                                    cursor: isClickingLessonUI ? 'not-allowed' : 'pointer',
                                                                    opacity: isClickingLessonUI ? 0.6 : 1,
                                                                    transition: 'opacity 0.2s ease'
                                                                }}
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
                                                                        <i className={`${getFileIcon(l.file)} me-1`}></i>
                                                                        {getFileTypeLabel(l.file)}
                                                                    </small>
                                                                    {l.content_duration && l.content_duration !== "0m 0s" && (
                                                                        <small className="lesson-meta">
                                                                            <i className="fas fa-clock me-1"></i>
                                                                            {l.content_duration}
                                                                        </small>
                                                                    )}
                                                                    
                                                                    {/* Progress badges */}
                                                                    {progressStatus.status === 'completed' && (
                                                                        <small className="lesson-status-badge completed">
                                                                            <i className="fas fa-check-circle me-1"></i>
                                                                            Selesai
                                                                        </small>
                                                                    )}
                                                                    {progressStatus.status === 'in-progress' && (
                                                                        <small className="lesson-status-badge in-progress">
                                                                            <i className="fas fa-play-circle me-1"></i>
                                                                            {progressStatus.percentage}% ditonton
                                                                        </small>
                                                                    )}
                                                                    {/* ✨ PHASE 4.114: Show progress for not-started if there's any watched percentage */}
                                                                    {progressStatus.status === 'not-started' && progressStatus.percentage > 0 && (
                                                                        <small className="lesson-status-badge not-started">
                                                                            <i className="fas fa-film me-1"></i>
                                                                            {progressStatus.percentage}% ditonton
                                                                        </small>
                                                                    )}
                                                                    {/* Show 'Siap ditonton' only if there's no progress at all */}
                                                                    {progressStatus.status === 'not-started' && progressStatus.percentage === 0 && (
                                                                        <small className="lesson-status-badge not-started">
                                                                            <i className="fas fa-play me-1"></i>
                                                                            Siap ditonton
                                                                        </small>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="d-flex align-items-center gap-2">
                                                            <div className="lesson-status-container">
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
                                    })
                                ) : (
                                    <div className="p-3 text-muted text-center">
                                        <i className="fas fa-folder-open fa-2x mb-2"></i>
                                        <p>No lessons in this section</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-5">
                        <i className="fas fa-graduation-cap fa-3x text-muted mb-3"></i>
                        <h5 className="text-muted">No curriculum available</h5>
                        <p className="text-muted">Course content will be available soon.</p>
                    </div>
                )}
            </div>

            {/* Video Player Modal */}
            <Modal show={show} onHide={handleClose} size="xl" fullscreen="lg-down" className="video-modal">
                <Modal.Header closeButton>
                    <Modal.Title>{variantItem?.title}</Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-0">
                    {variantItem && isVideoFile(variantItem.file) ? (
                        <div className="video-player-container">
                            <ReactPlayer
                                ref={playerRef}
                                url={variantItem.file.startsWith("http") ? variantItem.file : getMediaUrl(variantItem.file)}
                                width="100%"
                                height="60vh"
                                playing={playing}
                                playbackRate={playbackRate}
                                volume={volume}
                                muted={muted}
                                onProgress={handleProgress}
                                onDuration={handleDuration}
                                onPlay={() => setPlaying(true)}
                                onPause={() => {
                                    setPlaying(false);
                                    saveCurrentProgress(); // Save when paused
                                }}
                                onReady={() => {
                                    setIsLoading(false);
                                    setPlaying(true); // Auto-play
                                }}
                                onError={(error) => {
                                    setError('Failed to load video');
                                    setIsLoading(false);
                                }}
                                onEnded={() => {
                                    setPlaying(false);
                                    // Mark as completed and close modal
                                    const itemForCompletion = { id: variantItem.id, variant_item_id: variantItem.variant_item_id };
                                    if (!isLessonCompleted(itemForCompletion)) {
                                        handleMarkLessonAsCompleted(variantItem.variant_item_id, true);
                                    }
                                    setTimeout(() => handleClose(), 5174);
                                }}
                                controls={false} // Custom controls
                            />
                            
                            {/* Custom Video Controls */}
                            <div className="video-controls">
                                <div className="video-progress-container">
                                    <input
                                        type="range"
                                        className="video-progress-bar"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={played}
                                        onChange={(e) => setPlayed(parseFloat(e.target.value))}
                                        onMouseDown={() => setSeeking(true)}
                                        onMouseUp={handleSeekMouseUp}
                                        style={{
                                            background: `linear-gradient(to right, #0f766e 0%, #0f766e ${played * 100}%, #e9ecef ${played * 100}%, #e9ecef 100%)`
                                        }}
                                    />
                                    <div className="video-time-display">
                                        <span>{formatTime(played * duration)}</span>
                                        <span>/</span>
                                        <span>{formatTime(duration)}</span>
                                    </div>
                                </div>
                                
                                <div className="video-control-buttons">
                                    <button onClick={handlePlayPause} className="control-btn">
                                        <i className={`fas ${playing ? 'fa-pause' : 'fa-play'}`}></i>
                                    </button>
                                    
                                    <div className="volume-control">
                                        <button onClick={toggleMute} className="control-btn">
                                            <i className={`fas ${muted ? 'fa-volume-mute' : 'fa-volume-up'}`}></i>
                                        </button>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.1"
                                            value={volume}
                                            onChange={handleVolumeChange}
                                            className="volume-slider"
                                        />
                                    </div>
                                    
                                    <select 
                                        value={playbackRate} 
                                        onChange={(e) => handlePlaybackRateChange(parseFloat(e.target.value))}
                                        className="playback-rate-select"
                                    >
                                        <option value={0.5}>0.5x</option>
                                        <option value={0.75}>0.75x</option>
                                        <option value={1}>1x</option>
                                        <option value={1.25}>1.25x</option>
                                        <option value={1.5}>1.5x</option>
                                        <option value={2}>2x</option>
                                    </select>
                                </div>
                            </div>
                            
                            {isLoading && (
                                <div className="video-loading">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            )}
                            
                            {error && (
                                <div className="video-error">
                                    <i className="fas fa-exclamation-triangle"></i>
                                    <p>{error}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="non-video-content p-4">
                            <div className="text-center">
                                <i className={`${getFileIcon(variantItem?.file)} fa-3x text-primary mb-3`}></i>
                                <h5>{variantItem?.title}</h5>
                                <p className="text-muted">{getFileTypeLabel(variantItem?.file)}</p>
                                {variantItem?.file && (
                                    <a 
                                        href={variantItem.file.startsWith("http") ? variantItem.file : getMediaUrl(variantItem.file)}
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="btn btn-primary"
                                    >
                                        <i className="fas fa-external-link-alt me-2"></i>
                                        Open File
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                </Modal.Body>
            </Modal>
        </div>
    );
};

export default LecturesTabNew;