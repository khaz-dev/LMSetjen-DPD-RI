import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import Modal from "react-bootstrap/Modal";
import dayjs, { moment } from "../../utils/dayjs";
import Swal from "sweetalert2";

import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import LecturesTab from "../../components/CourseDetail/LecturesTab";
import VideoPlayer from "../../components/CourseDetail/VideoPlayer"; // ✨ PHASE 4.86: Inline video player (not modal)
import CertificateTab from "../../components/CourseDetail/CertificateTab";
import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import { getMediaUrl, DEFAULT_IMAGE_URL } from "../../utils/constants";
import { parseDurationToSeconds } from "../../utils/durationUtils"; // ✨ PHASE 4.9+: Add JP calculation for progress card
import "./CourseDetail.css";
import apiInstance from "../../utils/axios";

// ✨ PHASE 11.164: Extracted floating note card component - fixes React hooks violation
const FloatingNoteCard = React.memo(({ item, idx, openNotes, setOpenNotes, param, enrollmentId, fetchCourseDetail }) => {
    const noteColor = item.note.color || '#f39c12';
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [position, setPosition] = useState(item.position);
    
    const handleMouseDown = (e) => {
        if (e.target.closest('.note-detail-close-btn') || e.target.closest('.note-detail-edit-toggle')) {
            return;
        }
        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };
    
    useEffect(() => {
        if (!isDragging) return;
        
        const handleMouseMove = (e) => {
            setPosition({
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y
            });
        };
        
        const handleMouseUp = () => {
            setIsDragging(false);
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragOffset]);
    
    const handleEditToggle = (e) => {
        e.stopPropagation();
        const newOpenNotes = [...openNotes];
        newOpenNotes[idx].isEditing = !newOpenNotes[idx].isEditing;
        
        if (!newOpenNotes[idx].isEditing && item.note.id) {
            // Save the note
            const formdata = new FormData();
            formdata.append("title", newOpenNotes[idx].editData.title);
            formdata.append("note", newOpenNotes[idx].editData.note);
            formdata.append("color", newOpenNotes[idx].editData.color);
            if (newOpenNotes[idx].editData.variant_id) {
                formdata.append("variant_id", newOpenNotes[idx].editData.variant_id);
            }
            if (newOpenNotes[idx].editData.variant_item_id) {
                formdata.append("variant_item_id", newOpenNotes[idx].editData.variant_item_id);
            }
            useAxios.put(`student/course-note-detail/${UserData()?.user_id}/${enrollmentId}/${item.note.id}/`, formdata).then(() => {
                fetchCourseDetail();
                Toast().fire({ icon: "success", title: "Catatan berhasil diperbarui" });
            }).catch(() => {
                Toast().fire({ icon: "error", title: "Gagal memperbarui catatan" });
            });
        }
        setOpenNotes(newOpenNotes);
    };
    
    const handleClose = (e) => {
        e.stopPropagation();
        setOpenNotes(openNotes.filter((_, i) => i !== idx));
    };
    
    const handleTitleChange = (e) => {
        const newOpenNotes = [...openNotes];
        newOpenNotes[idx].editData.title = e.target.value;
        setOpenNotes(newOpenNotes);
    };
    
    const handleNoteChange = (e) => {
        const newOpenNotes = [...openNotes];
        newOpenNotes[idx].editData.note = e.target.value;
        setOpenNotes(newOpenNotes);
    };
    
    // ✨ Resize state
    const [size, setSize] = useState({ width: 380, height: 400 });
    const [isResizing, setIsResizing] = useState(false);
    const [resizeStart, setResizeStart] = useState({ x: 0, y: 0 });
    
    const handleResizeStart = (e) => {
        e.preventDefault();
        setIsResizing(true);
        setResizeStart({ x: e.clientX, y: e.clientY });
    };
    
    useEffect(() => {
        if (!isResizing) return;
        
        const handleMouseMove = (e) => {
            setSize(prev => ({
                width: Math.max(300, prev.width + e.clientX - resizeStart.x),
                height: Math.max(250, prev.height + e.clientY - resizeStart.y)
            }));
            setResizeStart({ x: e.clientX, y: e.clientY });
        };
        
        const handleMouseUp = () => {
            setIsResizing(false);
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, resizeStart]);
    
    return (
        <div
            key={item.note.id}
            style={{
                position: 'fixed',
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: `${size.width}px`,
                height: `${size.height}px`,
                backgroundColor: '#ffffff',
                border: `2px solid ${noteColor}`,
                borderRadius: '12px',
                boxShadow: `0 10px 40px rgba(0, 0, 0, 0.2)`,
                zIndex: 1040 + idx,
                pointerEvents: 'auto',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}
        >
            {/* Header - Draggable */}
            <div
                onMouseDown={handleMouseDown}
                style={{
                    background: `linear-gradient(135deg, ${noteColor} 0%, ${noteColor}dd 100%)`,
                    color: 'white',
                    padding: '1rem 1.5rem',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    userSelect: 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderRadius: '10px 10px 0 0'
                }}
            >
                <div style={{ flex: 1 }}>
                    {item.isEditing ? (
                        <input
                            type="text"
                            value={item.editData.title}
                            onChange={handleTitleChange}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                border: '1px solid rgba(255, 255, 255, 0.4)',
                                color: 'white',
                                padding: '0.5rem 0.75rem',
                                borderRadius: '4px',
                                width: '100%',
                                fontWeight: '600',
                                fontSize: '1rem'
                            }}
                            placeholder="Judul Catatan"
                        />
                    ) : (
                        <>
                            <i className="fas fa-sticky-note me-2"></i>
                            {item.note.title}
                        </>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                    <button
                        className="note-detail-edit-toggle"
                        onClick={handleEditToggle}
                        style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.2)',
                            border: 'none',
                            color: 'white',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }}
                        title={item.isEditing ? "Save" : "Edit"}
                    >
                        <i className={item.isEditing ? "fas fa-save" : "fas fa-edit"}></i>
                    </button>
                    <button
                        className="note-detail-close-btn"
                        onClick={handleClose}
                        style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.2)',
                            border: 'none',
                            color: 'white',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                        title="Close"
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>
            </div>
            
            {/* Body - Scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', backgroundColor: '#f8f9fa' }}>
                {/* Date and lesson context */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <small style={{ color: '#666' }}>
                        <i className="fas fa-calendar-alt me-2"></i>
                        {moment(item.note.date || item.note.created_at).format("dddd, MMMM DD, YYYY [at] HH:mm")}
                    </small>
                </div>
                
                {/* Lesson context badge */}
                {item.note.variant && (
                    <div style={{
                        backgroundColor: '#e8f4f8',
                        padding: '1rem',
                        borderRadius: '8px',
                        marginBottom: '1.5rem',
                        borderLeft: `4px solid ${noteColor}`
                    }}>
                        <small style={{ color: '#2c3e50', fontWeight: 600 }}>
                            <i className="fas fa-layer-group me-2" style={{ color: noteColor }}></i>
                            <strong>{item.note.variant.title}</strong>
                            {item.note.variant_item && (
                                <>
                                    {' > '}
                                    <strong>{item.note.variant_item.title}</strong>
                                </>
                            )}
                        </small>
                    </div>
                )}
                
                {/* Note content - inline editable */}
                {item.isEditing ? (
                    <textarea
                        value={item.editData.note}
                        onChange={handleNoteChange}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%',
                            height: '150px',
                            padding: '1rem',
                            border: `1px solid ${noteColor}`,
                            borderRadius: '8px',
                            fontFamily: 'inherit',
                            fontSize: '1rem',
                            resize: 'none'
                        }}
                    />
                ) : (
                    <div style={{
                        backgroundColor: '#ffffff',
                        padding: '1.5rem',
                        borderRadius: '8px',
                        lineHeight: '1.8',
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word',
                        fontSize: '1rem',
                        color: '#333',
                        border: `1px solid ${noteColor}33`,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                    }}>
                        {item.note.note}
                    </div>
                )}
            </div>
            
            {/* ✨ PHASE 11.165: Resize Handle - bottom right corner (FIXED: moved outside scrollable body to main container) */}
            <div
                onMouseDown={handleResizeStart}
                style={{
                    position: 'absolute',
                    bottom: '0px',
                    right: '0px',
                    width: '20px',
                    height: '20px',
                    cursor: 'nwse-resize',
                    backgroundColor: 'rgba(0,0,0,0.1)',
                    borderRadius: '0 0 8px 0',
                    transition: 'background-color 0.2s',
                    zIndex: 1050
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(0,0,0,0.2)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(0,0,0,0.1)'}
                title="Drag to resize"
            />
        </div>
    );
});

FloatingNoteCard.displayName = 'FloatingNoteCard';

// ✨ PHASE 11.164: Container for multiple floating note cards
const FloatingNoteCardsContainer = React.memo(({ openNotes, setOpenNotes, param, fetchCourseDetail }) => {
    return (
        <div style={{ position: 'fixed', pointerEvents: 'none', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1040 }}>
            {openNotes.map((item, idx) => (
                <FloatingNoteCard
                    key={item.note.id}
                    item={item}
                    idx={idx}
                    openNotes={openNotes}
                    setOpenNotes={setOpenNotes}
                    param={param}
                    enrollmentId={param.enrollment_id}
                    fetchCourseDetail={fetchCourseDetail}
                />
            ))}
        </div>
    );
});

FloatingNoteCardsContainer.displayName = 'FloatingNoteCardsContainer';

function CourseDetail() {
    // Course data and progress
    const [course, setCourse] = useState(null);  // ✨ PHASE 4.144+: Initialize as null instead of [] to avoid accessing .course on array
    const [isUpdatingCourse, setIsUpdatingCourse] = useState(false);
    const [isProgressCardLoading, setIsProgressCardLoading] = useState(true); // Track progress card loading state
    const [completionPercentage, setCompletionPercentage] = useState(0);
    const [completionStats, setCompletionStats] = useState({
        totalLessons: 0,
        completedLessons: 0,
        totalQuizzes: 0,
        passedQuizzes: 0
    });
    
    // Video player state (shared with LecturesTab)
    // ✨ PHASE 4.86: Show/hide replaced with inline display based on variantItem
    const [variantItem, setVariantItem] = useState(null);
    const [autoplayVideo, setAutoplayVideo] = useState(false);  // ✨ PHASE 4.103: Track if video should autoplay
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);  // ✨ PHASE 4.105: Track if video is currently playing
    const [seekPosition, setSeekPosition] = useState(null);  // ✨ PHASE 4.117: Position to seek to when video loads
    const [isResuming, setIsResuming] = useState(false);  // ✨ PHASE 4.117: Flag to prevent progress saves during resume
    const videoPlayerRef = useRef(null);  // ✨ PHASE 4.105: Ref to VideoPlayer component
    const videoPlayerContainerRef = useRef(null);  // ✨ PHASE X.X: Ref to video player container for auto-scroll
    const lecturesTabProgressRef = useRef(null);  // ✨ PHASE 4.115: Ref to external progress update callback
    const lecturesTabCompletionRef = useRef(null);  // ✨ PHASE 4.133: Ref to lesson completion callback
    
    // ✨ PHASE 4.146: Certificate state to hide video player when certificate exists
    const [existingCertificate, setExistingCertificate] = useState(null);
    const [certificateCheckLoading, setCertificateCheckLoading] = useState(false);
    
    // ✨ PHASE 4.224: Track active tab for certificate display
    const [activeTab, setActiveTab] = useState('lectures');
    
    // ✨ PHASE 4.225+: Quiz state - declared early for useEffect dependency
    const [quizzes, setQuizzes] = useState([]);
    const [selectedQuiz, setSelectedQuiz] = useState(null);
    const [quizShow, setQuizShow] = useState(false);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [timeRemaining, setTimeRemaining] = useState(60);
    const [isQuizActive, setIsQuizActive] = useState(false);
    const [isMouseInQuizArea, setIsMouseInQuizArea] = useState(true);  // ✨ PHASE 4.225+: Track if mouse is in quiz area
    const [showLeftQuizNotification, setShowLeftQuizNotification] = useState(false);  // ✨ PHASE 4.225+: Show notification when leaving quiz area
    const inlineQuizContainerRef = useRef(null);  // ✨ PHASE 4.225+: Ref for inline quiz container
    
    // ✨ PHASE 7.13: Draggable/Resizable Modal State - Initial position: bottom-centered
    // Calculate initial position: centered horizontally, at bottom of viewport
    const getInitialModalPosition = () => {
        const width = 900;
        const height = 500;
        return {
            x: Math.max(0, (window.innerWidth - width) / 2),
            y: Math.max(50, window.innerHeight - height - 20)  // 20px margin from bottom
        };
    };
    
    const [modalPosition, setModalPosition] = useState(getInitialModalPosition());
    const [modalSize, setModalSize] = useState({ width: 900, height: 500 });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0, modalX: 0, modalY: 0, modalWidth: 900, modalHeight: 500 });
    // ✨ PHASE 7.13: Use refs to avoid closure issues during drag/resize
    const initialPos = getInitialModalPosition();
    const modalPositionRef = useRef(initialPos);
    const modalSizeRef = useRef({ width: 900, height: 500 });
    const isDraggingRef = useRef(false);
    const isResizingRef = useRef(false);
    
    // ✨ PHASE 11.159 FIX: Notes Modal Drag/Resize State - Separate from question modal
    const getInitialNoteModalPosition = () => {
        const width = 800;
        const height = 600;
        return {
            x: Math.max(0, (window.innerWidth - width) / 2),
            y: Math.max(50, (window.innerHeight - height) / 2)  // Center vertically and horizontally
        };
    };
    
    const [noteModalPosition, setNoteModalPosition] = useState(getInitialNoteModalPosition());
    const [noteModalSize, setNoteModalSize] = useState({ width: 800, height: 600 });
    const [isNoteDragging, setIsNoteDragging] = useState(false);
    const [isNoteResizing, setIsNoteResizing] = useState(false);
    const noteDragStartPos = useRef({ x: 0, y: 0, modalX: 0, modalY: 0, modalWidth: 800, modalHeight: 600 });
    const noteModalPositionRef = useRef(getInitialNoteModalPosition());
    const noteModalSizeRef = useRef({ width: 800, height: 600 });
    const isNoteDraggingRef = useRef(false);
    const isNoteResizingRef = useRef(false);
    
    // ✨ PHASE 11.161: Note Detail Modal Drag/Resize State
    const getInitialNoteDetailModalPosition = () => {
        const width = 700;
        const height = 500;
        return {
            x: Math.max(0, (window.innerWidth - width) / 2),
            y: Math.max(50, (window.innerHeight - height) / 2)
        };
    };
    
    const [noteDetailModalPosition, setNoteDetailModalPosition] = useState(getInitialNoteDetailModalPosition());
    const [noteDetailModalSize, setNoteDetailModalSize] = useState({ width: 700, height: 500 });
    const [isNoteDetailDragging, setIsNoteDetailDragging] = useState(false);
    const [isNoteDetailResizing, setIsNoteDetailResizing] = useState(false);
    const noteDetailDragStartPos = useRef({ x: 0, y: 0, modalX: 0, modalY: 0, modalWidth: 700, modalHeight: 500 });
    const noteDetailModalPositionRef = useRef(getInitialNoteDetailModalPosition());
    const noteDetailModalSizeRef = useRef({ width: 700, height: 500 });
    const isNoteDetailDraggingRef = useRef(false);
    const isNoteDetailResizingRef = useRef(false);
    
    // ✨ PHASE 7.14: Textarea auto-resize ref
    const questionTextareaRef = useRef(null);
    
    // ✨ PHASE 7.7-7.9: Q&A management - Declare early before useEffect that references them
    const [questions, setQuestions] = useState([]);
    const [addQuestionShow, setAddQuestionShow] = useState(false);
    const [ConversationShow, setConversationShow] = useState(false);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [createMessage, setCreateMessage] = useState({ title: "", message: "" });
    const [currentVariantContext, setCurrentVariantContext] = useState(null);
    const [discussionFilters, setDiscussionFilters] = useState({ search: '', bagian: null, pelajaran: null });
    const [filteredQuestions, setFilteredQuestions] = useState([]);
    // ✨ PHASE 7.10: Inline forum view - track opened question for inline display instead of modal
    const [openedQuestionId, setOpenedQuestionId] = useState(null);
    
    // ✨ PHASE 11.160: Notes filter state - same pattern as discussions
    const [noteFilters, setNoteFilters] = useState({ search: '', bagian: null, pelajaran: null, color: null });
    const [filteredNotes, setFilteredNotes] = useState([]);
    const [currentNoteVariantContext, setCurrentNoteVariantContext] = useState(null);
    // ✨ PHASE 11.163: Changed from single note to array to support multiple open notes
    const [openNotes, setOpenNotes] = useState([]);  // Array of {note, position, isEditing}
    const [selectedNoteForView, setSelectedNoteForView] = useState(null);  // ✨ PHASE 11.160 FIX: Track note selected for viewing (deprecated - kept for compat)
    
    // ✨ PHASE 7.16: Q&A Report Modal State - Modeled after ReviewAbuse report system
    const [showQAReportModal, setShowQAReportModal] = useState(false);
    const [reportingQAId, setReportingQAId] = useState(null);  // qa_id being reported
    const [reportingQAType, setReportingQAType] = useState('question');  // 'question' or 'message'
    const [qaReportReason, setQaReportReason] = useState('');
    const [qaReportDescription, setQaReportDescription] = useState('');
    const [reportingQA, setReportingQA] = useState(false);  // Loading state during submission
    
    // ✨ PHASE 7.16: Track submitted Q&A reports for status display
    const [qaReports, setQaReports] = useState({
        question_reports: [],
        message_reports: []
    });
    const [loadingQAReports, setLoadingQAReports] = useState(false);
    
    // ✨ PHASE 7.16+: Track the current report being viewed in modal (for showing feedback)
    const [currentReportData, setCurrentReportData] = useState(null);
    
    // ✨ PHASE 7.16+: Track if we're editing an existing report
    const [editingReportId, setEditingReportId] = useState(null);
    
    // ✨ PHASE 7.16+: Track which reports have been closed by user (Set of report IDs)
    const [closedReports, setClosedReports] = useState(new Set());
    
    // ✨ PHASE 7.23: Track user's likes on questions and messages for UI feedback
    const [userLikedQuestions, setUserLikedQuestions] = useState(new Set());  // Set of qa_ids that user has liked
    const [userLikedMessages, setUserLikedMessages] = useState(new Set());  // Set of message IDs that user has liked
    
    // ✨ PHASE 7.23: Polling for live updates in forum
    const forumPollingIntervalRef = useRef(null);
    
    // ✨ PHASE 11.160 FIX: Filter notes by search term, bagian, pelajaran, and color
    useEffect(() => {
        let filtered = course?.note || [];
        
        // Filter by search term (title or content)
        if (noteFilters.search?.trim()) {
            const searchLower = noteFilters.search.toLowerCase();
            filtered = filtered.filter(n => {
                const titleMatch = n.title?.toLowerCase().includes(searchLower);
                const contentMatch = n.note?.toLowerCase().includes(searchLower);
                return titleMatch || contentMatch;
            });
        }
        
        // Filter by bagian (section)
        if (noteFilters.bagian) {
            filtered = filtered.filter(n => 
                n.variant?.variant_id === noteFilters.bagian
            );
        }
        
        // Filter by pelajaran (lesson)
        if (noteFilters.pelajaran) {
            filtered = filtered.filter(n => 
                n.variant_item?.variant_item_id === noteFilters.pelajaran
            );
        }
        
        // ✨ PHASE 11.160 FIX: Filter by color
        if (noteFilters.color) {
            filtered = filtered.filter(n => n.color === noteFilters.color);
        }
        
        setFilteredNotes(filtered);
    }, [course?.note, noteFilters]);
    
    // ✨ PHASE 7.8-7.9: Filter questions by search term, bagian, and pelajaran
    useEffect(() => {
        let filtered = questions;
        
        // Filter by search term (title or message)
        if (discussionFilters.search?.trim()) {
            const searchLower = discussionFilters.search.toLowerCase();
            filtered = filtered.filter(q => {
                const titleMatch = q.title?.toLowerCase().includes(searchLower);
                const messageMatch = q.message?.toLowerCase().includes(searchLower);
                return titleMatch || messageMatch;
            });
        }
        
        // Filter by bagian (section)
        if (discussionFilters.bagian) {
            filtered = filtered.filter(q => 
                q.variant?.variant_id === discussionFilters.bagian
            );
        }
        
        // Filter by pelajaran (lesson)
        if (discussionFilters.pelajaran) {
            filtered = filtered.filter(q => 
                q.variant_item?.variant_item_id === discussionFilters.pelajaran
            );
        }
        
        setFilteredQuestions(filtered);
        
        // ✨ PHASE 7.24: Populate user's liked questions from API data (user_liked field)
        // This ensures question-cards in list view show correct like status
        const likedQuestionIds = new Set();
        filtered.forEach(q => {
            if (q.user_liked) {
                likedQuestionIds.add(q.qa_id);
            }
        });
        setUserLikedQuestions(likedQuestionIds);
        
        // Q&A forum population
    }, [questions, discussionFilters]);
    // ✨ PHASE 4.224: Set up Bootstrap tab change listeners
    useEffect(() => {
        const tabElements = document.querySelectorAll('[data-bs-toggle="tab"]');
        const handleTabChange = (e) => {
            const target = e.target.getAttribute('data-bs-target');
            const tabName = target?.replace('#', '');
            if (tabName) {
                setActiveTab(tabName);
            }
        };
        
        tabElements.forEach(tab => {
            tab.addEventListener('shown.bs.tab', handleTabChange);
        });
        
        return () => {
            tabElements.forEach(tab => {
                tab.removeEventListener('shown.bs.tab', handleTabChange);
            });
        };
    }, []);

    // ✨ PHASE X.X: Auto-scroll to video player when lesson item is clicked
    useEffect(() => {
        if (variantItem && videoPlayerContainerRef.current) {
            // Use setTimeout to ensure the DOM has updated
            setTimeout(() => {
                const element = videoPlayerContainerRef.current;
                if (element) {
                    const headerOffset = 120;  // Offset for fixed header
                    const elementPosition = element.getBoundingClientRect().top + window.scrollY;
                    const offsetPosition = elementPosition - headerOffset;
                    
                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });
                    

                }
            }, 100);
        }
    }, [variantItem]);

    // ✨ PHASE 4.225+: Monitor mouse position for quiz integrity
    useEffect(() => {
        if (!isQuizActive) {
            setShowLeftQuizNotification(false);
            return;
        }

        const handleMouseMove = (e) => {
            if (!inlineQuizContainerRef.current) return;

            const rect = inlineQuizContainerRef.current.getBoundingClientRect();
            const isInside = 
                e.clientX >= rect.left &&
                e.clientX <= rect.right &&
                e.clientY >= rect.top &&
                e.clientY <= rect.bottom;

            setIsMouseInQuizArea(isInside);
            
            // Show notification if mouse leaves quiz area
            if (!isInside && !showLeftQuizNotification) {
                setShowLeftQuizNotification(true);
                // Auto-hide notification after 3 seconds
                const timer = setTimeout(() => {
                    setShowLeftQuizNotification(false);
                }, 3000);
                return () => clearTimeout(timer);
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
        };
    }, [isQuizActive, showLeftQuizNotification]);

    // ✨ PHASE 4.9+: Prevent scroll, copy, cut, paste, and text selection when quiz is active on Kuis tab
    useEffect(() => {
        if (!isQuizActive || activeTab !== 'quiz') {
            // Re-enable scrolling
            document.body.style.overflow = 'unset';
            return;
        }

        // Prevent body scroll when quiz is active
        document.body.style.overflow = 'hidden';

        // Prevent copy/cut/paste
        const handleCopy = (e) => {
            e.preventDefault();
            return false;
        };
        
        const handleCut = (e) => {
            e.preventDefault();
            return false;
        };
        
        const handlePaste = (e) => {
            e.preventDefault();
            return false;
        };

        // Prevent text selection
        const handleSelectStart = (e) => {
            e.preventDefault();
            return false;
        };

        // Prevent all selection with mousedown
        const handleMouseDown = (e) => {
            const target = e.target;
            // Only prevent if inside quiz container
            if (inlineQuizContainerRef.current && inlineQuizContainerRef.current.contains(target)) {
                // Allow radio button/checkbox clicks
                if (target.type === 'radio' || target.type === 'checkbox') {
                    return;
                }
                // Prevent text selection attempts
                if (e.detail > 1) { // Multi-click detection
                    e.preventDefault();
                }
            }
        };

        // Add event listeners
        document.addEventListener('copy', handleCopy, true);
        document.addEventListener('cut', handleCut, true);
        document.addEventListener('paste', handlePaste, true);
        document.addEventListener('selectstart', handleSelectStart, true);
        document.addEventListener('mousedown', handleMouseDown, true);

        return () => {
            // Cleanup: remove all event listeners and restore scroll
            document.removeEventListener('copy', handleCopy, true);
            document.removeEventListener('cut', handleCut, true);
            document.removeEventListener('paste', handlePaste, true);
            document.removeEventListener('selectstart', handleSelectStart, true);
            document.removeEventListener('mousedown', handleMouseDown, true);
            document.body.style.overflow = 'unset';
        };
    }, [isQuizActive, activeTab]);
    
    // ✨ PHASE 4.132: Memoize onProgressUpdate to prevent unnecessary re-registration
    // Use useCallback with empty dependencies so the function reference never changes
    // This ensures LecturesTab's useEffect only runs once on mount, not on every CourseDetail render
    const handleProgressUpdateCallback = useCallback((callback) => {
        lecturesTabProgressRef.current = callback;
    }, []);  // Empty dependency array = stable reference
    
    // ✨ PHASE 4.143+: Memoize lesson completion handler to prevent excessive effect re-runs
    // ✨ PHASE 12.6: CRITICAL FIX - Pass courseId to callback to fix auto-completion
    // The callback needs courseId because handleMarkLessonAsCompleted in LecturesTab
    // may fail if course object is not yet loaded
    const handleMarkLessonAsCompletedCallback = useCallback((lessonId, isAutoComplete, courseIdParam) => {
        if (lecturesTabCompletionRef.current) {
            // Extract courseId from course object OR use the one passed as parameter
            const courseIdToUse = courseIdParam || course?.course?.id;
            lecturesTabCompletionRef.current(lessonId, isAutoComplete, courseIdToUse);
        }
    }, [course]);  // Include course in deps so courseId updates are captured
    
    // ✨ PHASE 4.143+: Memoize lesson completion registration to prevent LecturesTab effect re-runs
    const handleLessonCompletionRegistration = useCallback((callback) => {
        lecturesTabCompletionRef.current = callback;
    }, []);  // Empty deps - function never changes

    // ✨ PHASE 17.12 FIX: Memoize onClose callback to prevent unnecessary VideoPlayer re-renders
    // This was previously an inline arrow function recreated on every render
    const handleVideoPlayerClose = useCallback(() => {
        setVariantItem(null);
        setAutoplayVideo(false);  // ✨ PHASE 4.103: Reset autoplay when closing video
        setIsVideoPlaying(false);  // ✨ PHASE 4.105: Reset playing state
        setSeekPosition(null);  // ✨ PHASE 4.117: Reset seek position
        setIsResuming(false);  // ✨ PHASE 4.117: Reset resume flag
        isResumingRef.current = false;  // ✨ PHASE 17.8: Clear ref too
    }, []);  // Empty deps - function never changes
    
    // ✨ PHASE 4.118: Log variantItem changes (for debugging lesson selection)
    useEffect(() => {
        if (variantItem) {
        } else {
        }
    }, [variantItem?.variant_item_id]);
    
    // ✨ PHASE 4.105: Log playing state changes (for debugging)
    useEffect(() => {
        // Playing state tracking
    }, [isVideoPlaying]);
    
    // ✨ PHASE 4.105: Toggle video play/pause from lesson button
    // ✨ PHASE 4.112: Added better logging for debugging toggle issues
    const toggleVideoPlayPause = () => {
        if (videoPlayerRef.current?.togglePlayPause) {
            videoPlayerRef.current.togglePlayPause();
        } else {
        }
    };
    
    // ✨ PHASE 4.115: Handle video progress updates from VideoPlayer
    const lastProgressSaveRef = useRef(0);  // ✨ PHASE 4.116+: Time-based throttling instead of random
    
    // ✨ PHASE 17.7: Track resume timer to clear old ones when effect re-runs
    // ✨ PHASE 17.8: Also track resume status in ref to avoid state closure issues
    const resumeTimerRef = useRef(null);
    const isResumingRef = useRef(false);  // Ref-based tracking for faster responses

    // ✨ PHASE 4.117: Reset throttle timer when variant changes
    useEffect(() => {
        lastProgressSaveRef.current = 0;  // Allow immediate save when switching lessons
    }, [variantItem?.variant_item_id]);
    
    // ✨ PHASE 4.143+: Memoize handleVideoProgress to prevent excessive effect re-runs
    const handleVideoProgress = useCallback(async (progress) => {
        // ✨ PHASE 17.8: CRITICAL - Check ONLY ref for timing-sensitive progress blocking
        // State updates are async, so ref is the ONLY reliable source during timeout transitions
        if (isResumingRef.current) {
            console.log('[CourseDetail] ⏭️ STILL RESUMING: Skipping progress save', {
                refValue: isResumingRef.current,
                currentTime: progress.currentTime?.toFixed(2) + 's',
                timestamp: Date.now()
            });
            return;
        }
        
        if (!variantItem) {
            console.log('[CourseDetail] ⚠️ variantItem is null, cannot save progress');
            return;
        }

        const itemId = variantItem.variant_item_id;
        const { played, duration, currentTime } = progress;
        
        if (!itemId) {
            console.warn('[CourseDetail] ❌ itemId is empty/null:', { variantItem });
            return;
        }
        
        // Only save if we have valid progress
        if (itemId && duration && currentTime >= 0) {
            const progressPercentage = played * 100;
            
            // ✨ PHASE 4.116+: Time-based throttle - only save every 1 second (not random!)
            const now = Date.now();
            const timeSinceLastSave = now - lastProgressSaveRef.current;
            
            if (timeSinceLastSave > 1000) { // Save max once per second
                lastProgressSaveRef.current = now;
                
                try {
                    // ✨ PHASE 17.5: COMPREHENSIVE ERROR LOGGING - Debug progress save failures
                    const debugEnabled = window.DEV_DEBUG ? window.DEV_DEBUG : false;
                    
                    // ✨ PHASE 17.6: ALWAYS log progress attempts, not just sampled
                    console.log('[CourseDetail] 💾 ATTEMPT #' + Math.floor(Date.now() / 1000), 'Progress save:', {
                        itemId: itemId,
                        currentTime: currentTime.toFixed(2) + 's',
                        duration: duration.toFixed(2) + 's',
                        percentage: progressPercentage.toFixed(1) + '%',
                        isResuming,
                        variantItemExists: !!variantItem,
                        timestamp: new Date().toISOString()
                    });
                    
                    // ✨ PHASE 4.134: Get courseId from course data OR from localStorage if course not loaded yet (hard refresh case)
                    let courseId = course?.course?.id;
                    
                    // ✨ PHASE 17.5: Log courseId resolution for debugging
                    if (!courseId) {
                        console.log('[CourseDetail] ⚠️ No courseId from course.course.id, checking localStorage...');
                        
                        const savedData = localStorage.getItem("lms_current_lesson");
                        if (savedData) {
                            try {
                                const parsed = JSON.parse(savedData);
                                courseId = parsed.courseId;
                                if (courseId) {
                                    console.log('[CourseDetail] 📦 SUCCESS: courseId from localStorage:', courseId);
                                }
                            } catch (e) {
                                console.error('[CourseDetail] ❌ Failed to parse localStorage:', e.message);
                            }
                        } else {
                            console.log('[CourseDetail] ℹ️ localStorage has no saved lesson data');
                        }
                    } else {
                        console.log('[CourseDetail] ✓ SUCCESS: courseId from course.course.id:', courseId);
                    }
                    
                    // ✨ PHASE 17.5: CRITICAL - Log if courseId missing (this causes silent skip!)
                    if (!courseId) {
                        console.warn('[CourseDetail] ❌ CRITICAL: courseId is MISSING! Progress CANNOT be saved!', {
                            itemId: itemId,
                            percentage: progressPercentage.toFixed(1) + '%',
                            course_structure: {
                                course: typeof course,
                                course_course: typeof course?.course,
                                course_course_id: course?.course?.id,
                                fullCourseObject: course
                            },
                            localStorageData: localStorage.getItem("lms_current_lesson")
                        });
                        return;  // Return early, but with proper logging now
                    }
                    
                    // ✨ PHASE 17.5: Verify user data
                    const userId = UserData()?.user_id;
                    if (!userId) {
                        console.error('[CourseDetail] ❌ CRITICAL: user_id is missing! Cannot save progress.', {
                            itemId: itemId,
                            userData: UserData()
                        });
                        return;
                    }
                    
                    console.log('[CourseDetail] 🔵 SENDING API REQUEST with:', {
                        endpoint: '/api/v1/student/video-progress/',
                        user_id: userId,
                        course_id: courseId,
                        variant_item_id: itemId,
                        progress_percentage: progressPercentage.toFixed(1),
                        last_watched_position: currentTime.toFixed(2),
                        total_duration: duration.toFixed(2)
                    });
                    
                    const response = await apiInstance.post("/student/video-progress/", {
                        user_id: userId,  // ✨ PHASE 4.115: Use user_id instead of user
                        course_id: courseId,    // ✨ PHASE 4.134: Use fallback courseId from localStorage if needed
                        variant_item_id: itemId,        // ✨ PHASE 4.115: Use variant_item_id instead of variant_item
                        progress_percentage: progressPercentage,
                        last_watched_position: currentTime,
                        total_duration: duration
                    });
                    
                    // ✨ PHASE 17.5: COMPREHENSIVE SUCCESS LOGGING
                    console.log('[CourseDetail] ✅ API RESPONSE SUCCESS:', {
                        itemId: itemId,
                        percentage: progressPercentage.toFixed(1) + '%',
                        lastWatchedPosition: currentTime.toFixed(2) + 's',
                        responseStatus: response.status,
                        responseData: response.data,
                        timestamp: new Date().toISOString()
                    });
                    
                    // ✨ PHASE 4.115: Update LecturesTab progress status in real-time
                    if (lecturesTabProgressRef.current) {
                        lecturesTabProgressRef.current(itemId, {
                            position: currentTime,
                            duration: duration,
                            percentage: progressPercentage,
                            isCompleted: progressPercentage >= 99.8,
                            isInProgress: progressPercentage > 1 && progressPercentage < 99.8
                        });
                    } else {
                        console.warn('[CourseDetail] ⚠️ lecturesTabProgressRef.current is not set');
                    }
                } catch (error) {
                    // ✨ PHASE 17.5: COMPREHENSIVE ERROR LOGGING - log ALL errors, not silently
                    console.error('[CourseDetail] ❌ API REQUEST FAILED:', {
                        errorMessage: error.message,
                        errorStatus: error.response?.status,
                        errorData: error.response?.data,
                        itemId: itemId,
                        percentage: played * 100,
                        fullError: error,
                        timestamp: new Date().toISOString()
                    });
                    
                    // ✨ PHASE 12.14: Handle 400 errors due to invalid variant_item_id
                    if (error.response?.status === 400) {
                        // Check if this is a "variant not found" error
                        const errorMsg = error.response?.data?.detail || '';
                        if (errorMsg.includes('not found') || errorMsg.includes('invalid')) {
                            console.warn('[CourseDetail] ⚠️ Variant not found - skipping progress save:', {
                                itemId: itemId,
                                errorMsg: errorMsg
                            });
                            // Don't throw - just silently skip this iteration
                            return;
                        }
                    }
                    // Silently handle other errors but don't stop polling
                }
            }
        }
    }, [isResuming, variantItem, course]);  // ✨ PHASE 4.143+: Memoize dependencies
    
    // ✨ PHASE 4.103: Helper function to set variant item with autoplay
    // ✨ PHASE 4.116: Save lesson to localStorage for hard refresh recovery
    // ✨ PHASE 16: FIXED - Auto-play should be TRUE when user clicks a fresh lesson
    const handlePlayLessonWithAutoplay = (lesson) => {
        setVariantItem(lesson);
        // ✨ PHASE 16: FIX - Set autoplay to TRUE for fresh lesson loads
        // This allows iframe to auto-play when page loads. Resume will override this to false.
        setAutoplayVideo(true);
        localStorage.setItem("lms_current_lesson", JSON.stringify({
            courseId: course?.course?.id,
            lessonId: lesson.variant_item_id,
            lessonData: lesson,
            savedAt: new Date().toISOString()
        }));
    };
    
    // ✨ PHASE 4.116: Load saved progress when video changes and notify user if resuming
    // ✨ PHASE 17.7: CRITICAL FIX - Move cleanup outside async function to properly reset isResuming flag
    useEffect(() => {
        // ✨ PHASE 4.118: Fixed - load progress as soon as variantItem is set (don't wait for course)
        if (!variantItem) {
            return;  // Wait for variantItem to be set
        }

        // ✨ PHASE 17.8: Clear any OLD resume timer from previous effect run
        // This prevents cascading timers that keep isResuming=true
        if (resumeTimerRef.current) {
            console.log('[CourseDetail] 🎬 EFFECT RUN - Clearing OLD timer from previous effect', {
                variantItemId: variantItem?.variant_item_id,
                timestamp: new Date().toISOString()
            });
            clearTimeout(resumeTimerRef.current);
            resumeTimerRef.current = null;
        } else {
            console.log('[CourseDetail] 🎬 EFFECT RUN - First timer for lesson', {
                variantItemId: variantItem?.variant_item_id,
                timestamp: new Date().toISOString()
            });
        }

        // ✨ PHASE 39.2: FIX - Don't clear seekPosition immediately
        // This caused double video loads (seekPosition null, then seekPosition actual)
        // Instead, let seekPosition update only when API returns
        // If API has no saved progress, seekPosition will be set to 0
        console.log('[CourseDetail] 🎬 Fetching progress for new lesson: ' + variantItem?.variant_item_id);

        // ✨ PHASE 17.7: Track timer outside async function so cleanup can properly clear it
        let resumeTimer = null;

        const loadAndResumeProgress = async () => {
            try {
                const itemId = variantItem.variant_item_id;
                const userId = UserData()?.user_id;
                
                if (!itemId || !userId) {
                    console.warn('[CourseDetail] Missing itemId or userId:', { itemId, userId });
                    // ✨ PHASE 39.2: Set to 0 if no data, not null (null causes seek effect to skip)
                    setSeekPosition(0);
                    return;
                }
                
                try {
                    const response = await apiInstance.get(`/student/video-progress/${userId}/${itemId}/`);
                    
                    const progressData = response.data?.data || response.data;  // ✨ PHASE 4.117: Unwrap API response wrapper
                    
                    // ✨ PHASE 11.185 + PHASE 17.1: FIXED - Parse Decimal strings and check if last_watched_position exists
                    // DRF serializes Decimal fields as strings, so we must convert before numeric comparison
                    // If student watched any portion of the video, restore from saved position
                    const lastWatchedPos = progressData && parseFloat(progressData.last_watched_position);
                    const progressPct = progressData && parseFloat(progressData.progress_percentage);
                    
                    const hasValidPosition = lastWatchedPos && lastWatchedPos > 0;
                    
                    const hasValidProgress = progressPct !== undefined && 
                                            progressPct !== null &&
                                            progressPct > 0 && 
                                            progressPct < 99.8;
                    
                    if (hasValidPosition && hasValidProgress) {
                        // ✨ PHASE 17.1: Use parsed numeric value, not the string from API
                        const resumePosition = lastWatchedPos;
                        const resumePercentage = progressPct;
                        
                        console.log('[CourseDetail] 📍 RESUMING from:', { resumePosition, resumePercentage });
                        
                        // ✨ PHASE 14: Set resume flag to prevent progress saves during seek
                        setIsResuming(true);
                        // ✨ PHASE 17.8: Also set ref for immediate effect
                        isResumingRef.current = true;
                        
                        // ✨ PHASE 14: Set seek position as state for VideoPlayer to use when ready
                        setSeekPosition(resumePosition);
                        
                        // ✨ PHASE 16: Autoplay disabled on resume for safety
                        // Better UX: Let user manually resume after seek completes
                        // This prevents jarring auto-play when continuing a paused video
                        // If auto-play on resume is desired, change to setAutoplayVideo(true)
                        setAutoplayVideo(false);
                        
                        // ✨ PHASE 17.8: Create timer and store in BOTH local var and ref
                        const timerStartTime = Date.now();
                        resumeTimer = setTimeout(() => {
                            const elapsed = Date.now() - timerStartTime;
                            console.log('[CourseDetail] ✅ TIMEOUT FIRED - Resetting isResuming flag', {
                                itemId: itemId,
                                elapsedMs: elapsed,
                                timestamp: new Date().toISOString()
                            });
                            setIsResuming(false);
                            // ✨ PHASE 17.8: Also clear ref immediately
                            isResumingRef.current = false;
                        }, 1500);
                        
                        // ✨ PHASE 17.8: Store in ref so it can be cleared if effect runs again
                        resumeTimerRef.current = resumeTimer;
                        console.log('[CourseDetail] ⏱️ NEW TIMER scheduled for ' + itemId, {
                            willFireAt: new Date(timerStartTime + 1500).toISOString(),
                            timestamp: new Date().toISOString()
                        });
                    } else {
                        // ✨ PHASE 4.128: Don't reset autoplay when no saved progress - keep it enabled so video can play on click
                        console.log('[CourseDetail] ℹ️ No saved progress found, isResuming stays FALSE');
                        setSeekPosition(0);  // ✨ PHASE 39.2: Start from beginning (0, not null)
                        setIsResuming(false);
                        // ✨ PHASE 17.8: Clear ref too
                        isResumingRef.current = false;
                        // Note: autoplayVideo remains true from handlePlayLessonWithAutoplay - we don't override it here
                    }
                } catch (apiError) {
                    // ✨ PHASE 14: Improved error handling for progress API
                    console.log('[CourseDetail] ❌ API Error loading progress:', apiError.message);
                    setSeekPosition(0);  // ✨ PHASE 39.2: Start from beginning on error (0, not null)
                    setIsResuming(false);
                    // ✨ PHASE 17.8: Clear ref too
                    isResumingRef.current = false;
                }
            } catch (error) {
                // ✨ PHASE 4.128: Don't reset autoplay on error - keep video playable even if progress load fails
                console.log('[CourseDetail] ❌ Error loading progress:', error.message);
                setSeekPosition(0);  // ✨ PHASE 39.2: Start from beginning on error (0, not null)
                setIsResuming(false);
                // ✨ PHASE 17.8: Clear ref too
                isResumingRef.current = false;
                // Note: autoplayVideo remains true from handlePlayLessonWithAutoplay - we don't override it here
            }
        };
        
        // Load progress immediately without delay - useEffect handles timing
        loadAndResumeProgress();

        // ✨ PHASE 17.7: CRITICAL FIX - Return cleanup function from useEffect (not from async function)
        // This ensures cleanup fires properly when effect re-runs or component unmounts
        return () => {
            if (resumeTimer) {
                console.log('[CourseDetail] 🧹 CLEANUP: Effect cleaning up - clearing timer');
                clearTimeout(resumeTimer);
            }
        };
    }, [variantItem?.variant_item_id]);  // ✨ PHASE 14: FIX - Only depend on variant_item_id, not the object or course
    // Removed: course?.course?.id (not used in effect), variantItem (redundant with variant_item_id)
    // Having both variant_item_id AND variantItem caused effect to re-run when course data refreshed
    // This created race conditions where seekPosition was set then cleared unpredictably

    // ✨ PHASE 4.116+: Restore lesson from localStorage on page load (hard refresh recovery)
    // ✨ PHASE 4.146: Don't restore lessons if certificate exists
    useEffect(() => {
        if (!course?.course?.id) {
            return;
        }

        // ✨ PHASE 4.146: Don't restore lesson if certificate exists
        if (existingCertificate) {
            return;
        }

        try {
            const savedData = localStorage.getItem("lms_current_lesson");
            if (!savedData) {
                return;
            }

            const parsed = JSON.parse(savedData);
            const savedCourseId = parsed.courseId;
            const currentCourseId = course?.course?.id;


            // Only restore if we're viewing the same course
            if (savedCourseId !== currentCourseId) {
                return;
            }

            // If lesson already loaded, skip restoration
            if (variantItem) {
                return;
            }

            // Restore the lesson
            const lessonData = parsed.lessonData;
            if (lessonData && lessonData.variant_item_id) {
                setVariantItem(lessonData);
                setAutoplayVideo(true);  // ✨ PHASE 12.15: Enable autoplay on hard refresh restoration
            }
        } catch (error) {
            localStorage.removeItem("lms_current_lesson"); // Clear corrupted data
        }
    }, [course?.course?.id]);

    // ✨ PHASE 4.146: Check if certificate exists and hide video player accordingly
    const checkCertificateExists = async () => {
        if (!course?.course?.course_id || !UserData()?.user_id) return;
        
        setCertificateCheckLoading(true);
        try {
            const response = await apiInstance.get(
                `student/certificate-eligibility/${UserData()?.user_id}/${course?.course?.course_id}/`
            );
            
            if (response.data.certificate) {
                setExistingCertificate(response.data.certificate);
            } else {
                setExistingCertificate(null);
            }
        } catch (error) {
            // Silently fail - certificate not found or error getting eligibility
            setExistingCertificate(null);
        } finally {
            setCertificateCheckLoading(false);
        }
    };

    // ✨ PHASE 4.146: Check for existing certificate when course loads
    useEffect(() => {
        if (course?.course?.course_id) {
            checkCertificateExists();
        }
    }, [course?.course?.course_id]);
    
    // Notes management
    const [noteShow, setNoteShow] = useState(false);
    const [createNote, setCreateNote] = useState({ title: "", note: "", color: "#f39c12" });
    const [selectedNote, setSelectedNote] = useState(null);
    const [selectedNoteColor, setSelectedNoteColor] = useState("#f39c12");
    
    // Reviews management
    const [createReview, setCreateReview] = useState({ rating: 1, review: "" });
    const [studentReview, setStudentReview] = useState([]);
    const [isEditingReview, setIsEditingReview] = useState(false);

    // Quiz management
    const [quizAnswers, setQuizAnswers] = useState({});
    const [quizStartTime, setQuizStartTime] = useState(null);
    const [quizResult, setQuizResult] = useState(null);
    const [showQuizResult, setShowQuizResult] = useState(false);
    const [courseId, setCourseId] = useState(null);
    const [isTimeExpired, setIsTimeExpired] = useState(false);
    const [quizResumeData, setQuizResumeData] = useState(null);

    const param = useParams();
    const lastElementRef = useRef();
    const quizTimerRef = useRef(null);
    const saveCounterRef = useRef(0);
    const currentQuizStateRef = useRef({
        answers: {},
        questionIndex: 0,
        startTime: null
    });

    const handleNoteChange = (event) => {
        setCreateNote({
            ...createNote,
            [event.target.name]: event.target.value,
        });
    };

    const handleNoteClose = () => {
        setNoteShow(false);
        setSelectedNote(null);
        setCreateNote({ title: "", note: "", color: "#f39c12" });
        setSelectedNoteColor("#f39c12");
        setCurrentNoteVariantContext(null);  // ✨ PHASE 11.160: Reset lesson context on close
    };
    
    const handleNoteShow = (note) => {
        setNoteShow(true);
        setSelectedNote(note);
        if (note) {
            // Load existing note data for editing
            setCreateNote({
                title: note.title || "",
                note: note.note || "",
                color: note.color || "#f39c12"
            });
            setSelectedNoteColor(note.color || "#f39c12");
            // ✨ PHASE 11.160: Load existing lesson context if available
            if (note.variant_item) {
                setCurrentNoteVariantContext({
                    variant_item_id: note.variant_item?.variant_item_id,
                    title: note.variant_item?.title,
                    variant_id: note.variant?.variant_id,
                    variant_title: note.variant?.title
                });
            } else {
                setCurrentNoteVariantContext(null);
            }
        } else {
            // Reset for new note
            setCreateNote({ title: "", note: "", color: "#f39c12" });
            setSelectedNoteColor("#f39c12");
            setCurrentNoteVariantContext(null);
        }
    };

    // ✨ PHASE 7.25: Start polling for live updates when Diskusi tab is opened (not just detail view)
    useEffect(() => {
        if (activeTab === 'discussions') {

            // Start polling for the entire list view, not just individual conversations
            startForumPolling(null);  // null = polling for list view
        } else {
            // Stop polling when leaving Diskusi tab
            if (forumPollingIntervalRef.current) {

                clearInterval(forumPollingIntervalRef.current);
                forumPollingIntervalRef.current = null;
            }
        }
        
        // Cleanup: stop polling when component unmounts or tab changes
        return () => {
            if (forumPollingIntervalRef.current && activeTab !== 'discussions') {
                clearInterval(forumPollingIntervalRef.current);
                forumPollingIntervalRef.current = null;
            }
        };
    }, [activeTab]);  // ✨ Only depend on activeTab (startForumPolling is stable via useCallback)

    const handleConversationClose = () => {
        // ✨ PHASE 7.10: Close inline forum view instead of modal
        setOpenedQuestionId(null);
        setSelectedConversation(null);
        
        // ✨ PHASE 7.23: Clear polling when closing forum (but keep running if still on Diskusi tab)
        // Don't clear polling here - let the tab change handler manage it
        
        // Clear likes state when closing conversation
        setUserLikedQuestions(new Set());
        setUserLikedMessages(new Set());
    };
    
    // ✨ PHASE 7.23+: Populate user's likes when viewing conversation - Fixed to use user_liked field
    const populateUserLikes = useCallback((conversation) => {
        if (!conversation) return;
        
        const userId = UserData()?.user_id;
        if (!userId) return;
        
        try {
            // ✨ FIX: Check if current user likes the question using user_liked boolean field
            const likedQuestionIds = new Set();
            if (conversation.user_liked) {
                likedQuestionIds.add(conversation.qa_id);
            }
            setUserLikedQuestions(likedQuestionIds);
            
            // ✨ FIX: Check if current user likes each message using msg.user_liked field
            const likedMessageIds = new Set();
            if (conversation.messages && Array.isArray(conversation.messages)) {
                conversation.messages.forEach(msg => {
                    if (msg.user_liked) {
                        likedMessageIds.add(msg.id);
                    }
                });
            }
            setUserLikedMessages(likedMessageIds);
            
            console.log("[populateUserLikes] ✅ User likes populated:", {
                likedQuestions: Array.from(likedQuestionIds),
                likedMessages: Array.from(likedMessageIds),
                question_user_liked: conversation.user_liked,
                messages_count: conversation.messages?.length
            });
        } catch (error) {
            console.log("[populateUserLikes] Could not determine user likes:", error);
            // Continue without likes state - not critical
        }
    }, []);
    
    // ✨ PHASE 7.24: Refs to hold current implementations of fetch functions (defined later in component)
    const fetchCourseDetailRef = useRef(null);
    const fetchQAReportsRef = useRef(null);
    
    // ✨ PHASE 7.23+PHASE 7.24: Set up polling for live forum updates
    const startForumPolling = useCallback((qaId) => {
        // Clear existing polling
        if (forumPollingIntervalRef.current) {
            clearInterval(forumPollingIntervalRef.current);
        }
        
        // Poll every 5 seconds to refresh course data which includes updated messages and like counts
        forumPollingIntervalRef.current = setInterval(async () => {
            try {
                // ✨ PHASE 7.24: Call functions via refs to avoid closure issues
                if (fetchCourseDetailRef.current) {
                    await fetchCourseDetailRef.current(true);  // true = prevent loading state to avoid UI flash
                }
                if (fetchQAReportsRef.current) {
                    await fetchQAReportsRef.current();
                }
                
                console.log("[Forum Polling] ✅ Live data refreshed - questions, likes, and reports updated");
            } catch (error) {
                // Silently fail - polling is best-effort
                console.log("[Forum Polling] Error fetching updates:", error);
            }
        }, 5000);  // Poll every 5 seconds
    }, []);  // ✨ PHASE 7.24: No dependencies needed - uses refs to call functions
    
    // ✨ PHASE 7.24: Clean up forum polling interval on component unmount
    useEffect(() => {
        return () => {
            if (forumPollingIntervalRef.current) {
                clearInterval(forumPollingIntervalRef.current);
                forumPollingIntervalRef.current = null;
            }
        };
    }, []);
    
    // ✨ PHASE 7.24: Update refs after render so polling always calls latest implementations
    useEffect(() => {
        fetchCourseDetailRef.current = fetchCourseDetail;
        fetchQAReportsRef.current = fetchQAReports;
    });  // No dependencies - runs after every render to keep refs fresh
    
    const handleConversationShow = (conversation) => {
        // ✨ PHASE 7.10: Show inline forum view instead of modal
        setOpenedQuestionId(conversation?.qa_id);
        setSelectedConversation(conversation);
        
        // ✨ PHASE 7.23: Populate user's likes and set up live polling
        populateUserLikes(conversation);
        startForumPolling(conversation?.qa_id);
        
        // ✨ DEBUG: Log selectedConversation details
        console.log("[handleConversationShow] 📌 === CONVERSATION OPENED ===");
        console.log("  - qa_id:", conversation?.qa_id);
        console.log("  - title:", conversation?.title);
        console.log("  - Full conversation object:", conversation);
        console.log("  - messages array:", conversation?.messages);
        console.log("  - messages count:", conversation?.messages?.length);
        if (conversation?.messages?.length > 0) {
            conversation.messages.forEach((msg, idx) => {
                console.log(`  - Message ${idx}:`, {
                    user_id: msg.user_id,
                    profile: msg.profile,
                    profile_user_id: msg.profile?.user_id,
                    message_text: msg.message?.substring(0, 50)
                });
            });
        }
        
        // Scroll to top of discussions tab
        setTimeout(() => {
            const discussionsTab = document.getElementById('discussions');
            if (discussionsTab) {
                discussionsTab.scrollIntoView({ behavior: 'smooth' });
            }
        }, 100);
    };

    const handleQuestionClose = () => setAddQuestionShow(false);
    const handleQuestionShow = () => setAddQuestionShow(true);
    
    // ✨ PHASE 7.12: Sync state refs when state changes
    useEffect(() => {
        modalPositionRef.current = modalPosition;
        modalSizeRef.current = modalSize;
        isDraggingRef.current = isDragging;
        isResizingRef.current = isResizing;
    }, [modalPosition, modalSize, isDragging, isResizing]);
    
    // ✨ PHASE 11.159 FIX: Sync notes modal refs when state changes
    useEffect(() => {
        noteModalPositionRef.current = noteModalPosition;
        noteModalSizeRef.current = noteModalSize;
        isNoteDraggingRef.current = isNoteDragging;
        isNoteResizingRef.current = isNoteResizing;
    }, [noteModalPosition, noteModalSize, isNoteDragging, isNoteResizing]);
    
    // ✨ PHASE 11.161: Sync note detail modal refs when state changes
    useEffect(() => {
        noteDetailModalPositionRef.current = noteDetailModalPosition;
        noteDetailModalSizeRef.current = noteDetailModalSize;
        isNoteDetailDraggingRef.current = isNoteDetailDragging;
        isNoteDetailResizingRef.current = isNoteDetailResizing;
    }, [noteDetailModalPosition, noteDetailModalSize, isNoteDetailDragging, isNoteDetailResizing]);
    
    // ✨ PHASE 7.12: Modal Drag and Resize Functionality with fixed positioning
    useEffect(() => {
        if (!addQuestionShow) return;
        
        const modalDialog = document.querySelector('.create-question-modal .modal-dialog');
        const header = modalDialog?.querySelector('.modal-header-modern');
        const resizeHandle = document.querySelector('.modal-resize-handle');
        
        if (!modalDialog || !header) return;
        
        // Apply initial position
        const applyPosition = (dialog, pos, size) => {
            if (!dialog) return;
            dialog.style.position = 'fixed';
            dialog.style.left = `${pos.x}px`;
            dialog.style.top = `${pos.y}px`;
            dialog.style.width = `${size.width}px`;
            dialog.style.height = `${size.height}px`;  /* ✨ PHASE 7.13: Use height instead of minHeight */
            dialog.style.zIndex = '1050';
        };
        
        // \u2728 PHASE 7.13: Update resize handle position - use top/left for fixed positioning
        const updateResizeHandle = (handle, pos, size) => {
            if (!handle) return;
            handle.style.position = 'fixed';
            // Position at bottom-right corner of modal (offset by 15px for diamond shape)
            handle.style.top = `${pos.y + size.height - 15}px`;
            handle.style.left = `${pos.x + size.width - 15}px`;
            handle.style.zIndex = '1051';
        };
        
        applyPosition(modalDialog, modalPositionRef.current, modalSizeRef.current);
        updateResizeHandle(resizeHandle, modalPositionRef.current, modalSizeRef.current);
        
        // Handle drag on header
        const handleHeaderMouseDown = (e) => {
            if (e.target.closest('.btn-close-modern')) return;
            e.preventDefault();
            isDraggingRef.current = true;
            setIsDragging(true);
            dragStartPos.current = {
                x: e.clientX,
                y: e.clientY,
                modalX: modalPositionRef.current.x,
                modalY: modalPositionRef.current.y,
                modalWidth: modalSizeRef.current.width,
                modalHeight: modalSizeRef.current.height
            };
        };
        
        // Handle resize on resize handle
        const handleResizeMouseDown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            isResizingRef.current = true;
            setIsResizing(true);
            dragStartPos.current = {
                x: e.clientX,
                y: e.clientY,
                modalX: modalPositionRef.current.x,
                modalY: modalPositionRef.current.y,
                modalWidth: modalSizeRef.current.width,
                modalHeight: modalSizeRef.current.height
            };
        };
        
        const handleMouseMove = (e) => {
            // Use refs to avoid closure issues
            if (isDraggingRef.current) {
                const deltaX = e.clientX - dragStartPos.current.x;
                const deltaY = e.clientY - dragStartPos.current.y;
                
                const newX = dragStartPos.current.modalX + deltaX;
                const newY = dragStartPos.current.modalY + deltaY;
                
                // Constrain to viewport
                const constrainedX = Math.max(0, Math.min(newX, window.innerWidth - modalSizeRef.current.width));
                const constrainedY = Math.max(0, newY);
                
                // Update state for React to track
                setModalPosition({
                    x: constrainedX,
                    y: constrainedY
                });
                
                // Update DOM immediately without waiting for state
                modalDialog.style.left = `${constrainedX}px`;
                modalDialog.style.top = `${constrainedY}px`;
                
                // Update resize handle position
                updateResizeHandle(resizeHandle, 
                    { x: constrainedX, y: constrainedY }, 
                    modalSizeRef.current
                );
            } else if (isResizingRef.current) {
                const deltaX = e.clientX - dragStartPos.current.x;
                const deltaY = e.clientY - dragStartPos.current.y;
                
                const newWidth = Math.max(400, dragStartPos.current.modalWidth + deltaX);
                const newHeight = Math.max(300, dragStartPos.current.modalHeight + deltaY);
                
                // Update state for React to track
                setModalSize({
                    width: newWidth,
                    height: newHeight
                });
                
                // Update DOM immediately without waiting for state
                modalDialog.style.width = `${newWidth}px`;
                modalDialog.style.height = `${newHeight}px`;  /* ✨ PHASE 7.13: Use height instead of minHeight for resize */
                
                // Update resize handle position
                updateResizeHandle(resizeHandle, 
                    modalPositionRef.current,
                    { width: newWidth, height: newHeight }
                );
            }
        };
        
        const handleMouseUp = () => {
            isDraggingRef.current = false;
            isResizingRef.current = false;
            setIsDragging(false);
            setIsResizing(false);
        };
        
        header.addEventListener('mousedown', handleHeaderMouseDown);
        if (resizeHandle) resizeHandle.addEventListener('mousedown', handleResizeMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        return () => {
            header.removeEventListener('mousedown', handleHeaderMouseDown);
            if (resizeHandle) resizeHandle.removeEventListener('mousedown', handleResizeMouseDown);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [addQuestionShow]);
    
    // ✨ PHASE 11.159 FIX: Notes Modal Drag and Resize Functionality - Same as question modal
    useEffect(() => {
        if (!noteShow) return;
        
        const noteModalDialog = document.querySelector('.add-note-modal .modal-dialog');
        const noteHeader = noteModalDialog?.querySelector('.note-modal-header-draggable');
        const resizeHandle = document.querySelector('.add-note-modal .modal-resize-handle');
        
        if (!noteModalDialog || !noteHeader) return;
        
        // Apply initial position
        const applyNotePosition = (dialog, pos, size) => {
            if (!dialog) return;
            dialog.style.position = 'fixed';
            dialog.style.left = `${pos.x}px`;
            dialog.style.top = `${pos.y}px`;
            dialog.style.width = `${size.width}px`;
            dialog.style.height = `${size.height}px`;
            dialog.style.zIndex = '1050';
        };
        
        // ✨ PHASE 11.160+: Update resize handle position - use top/left for fixed positioning
        const updateNoteResizeHandle = (handle, pos, size) => {
            if (!handle) return;
            handle.style.position = 'fixed';
            // Position at bottom-right corner of modal (offset by 15px for diamond shape)
            handle.style.top = `${pos.y + size.height - 15}px`;
            handle.style.left = `${pos.x + size.width - 15}px`;
            handle.style.zIndex = '1051';
        };
        
        applyNotePosition(noteModalDialog, noteModalPositionRef.current, noteModalSizeRef.current);
        updateNoteResizeHandle(resizeHandle, noteModalPositionRef.current, noteModalSizeRef.current);
        
        // Handle drag on header
        const handleNoteHeaderMouseDown = (e) => {
            if (e.target.closest('.btn-close-modern') || e.target.closest('button')) return;
            e.preventDefault();
            isNoteDraggingRef.current = true;
            setIsNoteDragging(true);
            noteDragStartPos.current = {
                x: e.clientX,
                y: e.clientY,
                modalX: noteModalPositionRef.current.x,
                modalY: noteModalPositionRef.current.y,
                modalWidth: noteModalSizeRef.current.width,
                modalHeight: noteModalSizeRef.current.height
            };
        };
        
        // Handle resize on resize handle
        const handleNoteResizeMouseDown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            isNoteResizingRef.current = true;
            setIsNoteResizing(true);
            noteDragStartPos.current = {
                x: e.clientX,
                y: e.clientY,
                modalX: noteModalPositionRef.current.x,
                modalY: noteModalPositionRef.current.y,
                modalWidth: noteModalSizeRef.current.width,
                modalHeight: noteModalSizeRef.current.height
            };
        };
        
        const handleNoteMouseMove = (e) => {
            if (isNoteDraggingRef.current) {
                const deltaX = e.clientX - noteDragStartPos.current.x;
                const deltaY = e.clientY - noteDragStartPos.current.y;
                
                const newX = noteDragStartPos.current.modalX + deltaX;
                const newY = noteDragStartPos.current.modalY + deltaY;
                
                // Constrain to viewport
                const constrainedX = Math.max(0, Math.min(newX, window.innerWidth - noteModalSizeRef.current.width));
                const constrainedY = Math.max(0, newY);
                
                // Update state for React to track
                setNoteModalPosition({
                    x: constrainedX,
                    y: constrainedY
                });
                
                // Update DOM immediately without waiting for state
                noteModalDialog.style.left = `${constrainedX}px`;
                noteModalDialog.style.top = `${constrainedY}px`;
                
                // Update resize handle position
                updateNoteResizeHandle(resizeHandle, 
                    { x: constrainedX, y: constrainedY }, 
                    noteModalSizeRef.current
                );
            } else if (isNoteResizingRef.current) {
                const deltaX = e.clientX - noteDragStartPos.current.x;
                const deltaY = e.clientY - noteDragStartPos.current.y;
                
                const newWidth = Math.max(400, noteDragStartPos.current.modalWidth + deltaX);
                const newHeight = Math.max(300, noteDragStartPos.current.modalHeight + deltaY);
                
                // Update state for React to track
                setNoteModalSize({
                    width: newWidth,
                    height: newHeight
                });
                
                // Update DOM immediately without waiting for state
                noteModalDialog.style.width = `${newWidth}px`;
                noteModalDialog.style.height = `${newHeight}px`;
                
                // Update resize handle position
                updateNoteResizeHandle(resizeHandle, 
                    noteModalPositionRef.current,
                    { width: newWidth, height: newHeight }
                );
            }
        };
        
        const handleNoteMouseUp = () => {
            isNoteDraggingRef.current = false;
            isNoteResizingRef.current = false;
            setIsNoteDragging(false);
            setIsNoteResizing(false);
        };
        
        noteHeader.addEventListener('mousedown', handleNoteHeaderMouseDown);
        if (resizeHandle) resizeHandle.addEventListener('mousedown', handleNoteResizeMouseDown);
        document.addEventListener('mousemove', handleNoteMouseMove);
        document.addEventListener('mouseup', handleNoteMouseUp);
        
        return () => {
            noteHeader.removeEventListener('mousedown', handleNoteHeaderMouseDown);
            if (resizeHandle) resizeHandle.removeEventListener('mousedown', handleNoteResizeMouseDown);
            document.removeEventListener('mousemove', handleNoteMouseMove);
            document.removeEventListener('mouseup', handleNoteMouseUp);
        };
    }, [noteShow]);


    // Quiz handlers
    const handleQuizClose = () => {
        setQuizShow(false);
        setSelectedQuiz(null);
        setCurrentQuestionIndex(0);
        setQuizAnswers({});
        setTimeRemaining(60);
        setIsQuizActive(false);
        setQuizStartTime(null);
        setShowQuizResult(false);
        setQuizResult(null);
        setIsTimeExpired(false);
        
        // Clear timer if active
        if (quizTimerRef.current) {
            clearInterval(quizTimerRef.current);
            quizTimerRef.current = null;
        }
    };

    const handleQuizShow = async (quiz) => {
        try {
            // Fetch full quiz details with questions and choices
            const response = await apiInstance.get(`student/quiz-detail/${UserData()?.user_id}/${quiz.quiz_id}/`);
            const fullQuizData = response.data;
            
            // Preserve attempt info from the quiz list
            const quizWithAttemptInfo = {
                ...fullQuizData,
                can_attempt: quiz.can_attempt,
                today_attempts: quiz.today_attempts,
                best_score: quiz.best_score,
                is_passed: quiz.is_passed
            };
            
            setSelectedQuiz(quizWithAttemptInfo);
            setQuizShow(true);
            setCurrentQuestionIndex(0);
            setQuizAnswers({});
            setTimeRemaining(60);
            setShowQuizResult(false);
            setQuizResult(null);
            setIsQuizActive(false);
            
            // ✨ PHASE 11.168: Scroll to inline quiz container when quiz is opened
            // ✨ PHASE 11.168a: Center quiz view vertically in viewport
            setTimeout(() => {
                if (inlineQuizContainerRef.current) {
                    inlineQuizContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        } catch (error) {
            Toast().fire({
                icon: "error",
                title: "Gagal memuat detail kuis"
            });
        }
    };

    const startQuiz = () => {
        // Check if there's resume data for this quiz (in case auto-resume didn't trigger)
        const resumeData = loadQuizProgress(selectedQuiz);
        
        if (resumeData && resumeData.timeRemaining > 0) {
            // Show resume dialog for manual quiz start
            showResumeDialog(selectedQuiz, resumeData);
        } else {
            // Start new quiz
            startNewQuiz(selectedQuiz);
        }
    };

    // Start a new quiz
    const startNewQuiz = (quiz) => {
        // Double check attempt limit on frontend (backend will also validate)
        if (!quiz?.can_attempt) {
            Toast().fire({
                icon: "error",
                title: "Batas percobaan harian tercapai (3/3). Silakan coba lagi besok."
            });
            return;
        }
        
        if (quiz && quiz.questions && quiz.questions.length > 0) {
            // Clear any existing timer
            if (quizTimerRef.current) {
                clearInterval(quizTimerRef.current);
                quizTimerRef.current = null;
            }
            
            setIsQuizActive(true);
            setQuizStartTime(Date.now());
            setCurrentQuestionIndex(0);
            setQuizAnswers({});
            setTimeRemaining(quiz.questions.length * 60); // 1 minute per question
            setShowQuizResult(false);
            setIsTimeExpired(false);
            
            // Update ref for timer access
            currentQuizStateRef.current = {
                answers: {},
                questionIndex: 0,
                startTime: Date.now()
            };
            
            // Start timer after a brief delay
            setTimeout(() => {
                saveCounterRef.current = 0;
                quizTimerRef.current = setInterval(() => {
                    setTimeRemaining(prev => {
                        saveCounterRef.current++;
                        
                        // Save progress every 10 seconds
                        if (saveCounterRef.current >= 10) {
                            const currentState = currentQuizStateRef.current;
                            saveQuizProgress(quiz, currentState.answers, currentState.questionIndex, prev - 1, currentState.startTime);
                            saveCounterRef.current = 0;
                        }
                        
                        if (prev <= 1) {
                            clearInterval(quizTimerRef.current);
                            quizTimerRef.current = null;
                            setIsTimeExpired(true);
                            
                            // Show time's up notification
                            Toast().fire({
                                icon: "warning",
                                title: "Waktu Habis!",
                                text: "Waktu kuis telah habis. Jawaban Anda akan dikirim secara otomatis.",
                                timer: 5174
                            });
                            
                            // Auto-submit after a short delay to show the notification
                            setTimeout(() => {
                                autoSubmitQuiz();
                            }, 1500);
                            
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            }, 500);
        } else {
            Toast().fire({
                icon: "error",
                title: "Pertanyaan kuis tidak tersedia. Silakan coba lagi."
            });
        }
    };

    // Resume an existing quiz
    const resumeQuiz = (quiz, resumeData) => {
        if (quiz && quiz.questions && quiz.questions.length > 0) {
            // Clear any existing timer
            if (quizTimerRef.current) {
                clearInterval(quizTimerRef.current);
                quizTimerRef.current = null;
            }
            
            setIsQuizActive(true);
            setQuizShow(true); // Fixed: was setShowQuizModal(true)
            setQuizStartTime(resumeData.startTime);
            setCurrentQuestionIndex(resumeData.currentQuestionIndex);
            setQuizAnswers(resumeData.answers);
            setTimeRemaining(resumeData.timeRemaining);
            setShowQuizResult(false);
            setIsTimeExpired(false);
            
            // ✨ PHASE 11.168: Scroll to inline quiz container when quiz is resumed
            // ✨ PHASE 11.168a: Center quiz view vertically in viewport
            setTimeout(() => {
                if (inlineQuizContainerRef.current) {
                    inlineQuizContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }
            }, 100);
            
            // Update ref for timer access
            currentQuizStateRef.current = {
                answers: resumeData.answers,
                questionIndex: resumeData.currentQuestionIndex,
                startTime: resumeData.startTime
            };

            // Start timer with remaining time
            setTimeout(() => {
                let saveCounter = 0;
                quizTimerRef.current = setInterval(() => {
                    setTimeRemaining(prev => {
                        saveCounter++;
                        
                        // Save progress every 10 seconds
                        if (saveCounter >= 10) {
                            const currentAnswers = quizAnswers;
                            const currentIndex = currentQuestionIndex;
                            const startTime = resumeData.startTime;
                            saveQuizProgress(quiz, currentAnswers, currentIndex, prev - 1, startTime);
                            saveCounter = 0;
                        }
                        
                        if (prev <= 1) {
                            clearInterval(quizTimerRef.current);
                            quizTimerRef.current = null;
                            setIsTimeExpired(true);
                            
                            // Show time's up notification
                            Toast().fire({
                                icon: "warning",
                                title: "Waktu Habis!",
                                text: "Waktu kuis telah habis. Jawaban Anda akan dikirim secara otomatis.",
                                timer: 5174
                            });
                            
                            // Auto-submit after a short delay to show the notification
                            setTimeout(() => {
                                autoSubmitQuiz();
                            }, 1500);
                            
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            }, 500);
        } else {
        }
    };

    const submitQuiz = async () => {
        if (!selectedQuiz || !isQuizActive) return;
        
        try {
            // Clear timer first
            if (quizTimerRef.current) {
                clearInterval(quizTimerRef.current);
                quizTimerRef.current = null;
            }
            
            setIsQuizActive(false);
            const endTime = Date.now();
            const timeTaken = quizStartTime ? Math.floor((endTime - quizStartTime) / 1000) : 0;
            
            // Convert quizAnswers object to the format expected by backend
            const formattedAnswers = Object.entries(quizAnswers).map(([questionId, choiceId]) => ({
                question_id: questionId,
                choice_id: choiceId.toString()
            }));
            
            const submissionData = {
                quiz_id: selectedQuiz.quiz_id,
                answers: formattedAnswers,
                time_taken: timeTaken
            };
            
            const response = await useAxios.post(`student/quiz-submit/${UserData()?.user_id}/`, submissionData);
            
            if (response.data) {
                setQuizResult(response.data);
                setShowQuizResult(true);
                
                // Clear quiz progress since quiz is completed
                clearQuizProgress(selectedQuiz);
                
                // Update the selected quiz with new attempt information
                if (selectedQuiz) {
                    setSelectedQuiz({
                        ...selectedQuiz,
                        today_attempts: response.data.today_attempts,
                        can_attempt: response.data.can_attempt,
                        best_score: Math.max(selectedQuiz.best_score || 0, response.data.score),
                        is_passed: response.data.passed || selectedQuiz.is_passed
                    });
                }
                
                // Refresh course data which will recalculate completion percentage including quizzes
                await fetchCourseDetail(true); // true = prevent loading state
            }
        } catch (error) {
            Toast().fire({
                icon: "error",
                title: "Gagal mengirim kuis. Silakan coba lagi."
            });
            setIsQuizActive(false);
        }
    };

    // Auto-submit function for when time expires (less restrictive)
    const autoSubmitQuiz = async () => {
        if (!selectedQuiz) {
            return;
        }
        
        try {
            // Clear timer first
            if (quizTimerRef.current) {
                clearInterval(quizTimerRef.current);
                quizTimerRef.current = null;
            }
            
            // Set quiz as inactive
            setIsQuizActive(false);
            const endTime = Date.now();
            const timeTaken = quizStartTime ? Math.floor((endTime - quizStartTime) / 1000) : 0;
            
            // Convert quizAnswers object to the format expected by backend
            const currentAnswers = currentQuizStateRef.current?.answers || quizAnswers;
            const formattedAnswers = Object.entries(currentAnswers).map(([questionId, choiceId]) => ({
                question_id: questionId,
                choice_id: choiceId.toString()
            }));
            
            const submissionData = {
                quiz_id: selectedQuiz.quiz_id,
                answers: formattedAnswers,
                time_taken: timeTaken
            };
            
            const response = await useAxios.post(`student/quiz-submit/${UserData()?.user_id}/`, submissionData);
            
            if (response.data) {
                setQuizResult(response.data);
                setShowQuizResult(true);
                
                // Clear quiz progress since quiz is completed
                clearQuizProgress(selectedQuiz);
                
                // Update the selected quiz with new attempt information
                if (selectedQuiz) {
                    setSelectedQuiz({
                        ...selectedQuiz,
                        today_attempts: response.data.today_attempts,
                        can_attempt: response.data.can_attempt,
                        best_score: Math.max(selectedQuiz.best_score || 0, response.data.score),
                        is_passed: response.data.passed || selectedQuiz.is_passed
                    });
                }
                
                // Refresh course data which will recalculate completion percentage including quizzes
                await fetchCourseDetail(true); // true = prevent loading state
                
                // Tampilkan pesan sukses untuk pengiriman otomatis
                Toast().fire({
                    icon: "info",
                    title: "Kuis Dikirim Secara Otomatis dengan Berhasil!",
                    text: "Jawaban Anda telah dikirim karena waktu telah habis.",
                    timer: 4000
                });
            }
        } catch (error) {
            Toast().fire({
                icon: "error",
                title: "Pengiriman otomatis gagal",
                text: "Gagal mengirim kuis secara otomatis. Silakan coba lagi secara manual."
            });
            setIsQuizActive(false);
        }
    };

    // Helper function to calculate overall completion percentage including lessons and quizzes
    const calculateCompletionPercentage = (totalLessons, completedLessons, totalQuizzes = 0, passedQuizzes = 0) => {
        // Calculate total items (lessons + quizzes)
        const totalItems = totalLessons + totalQuizzes;
        const completedItems = completedLessons + passedQuizzes;
        
        // Calculate percentage with safety checks
        let percentageCompleted = 0;
        if (totalItems > 0) {
            percentageCompleted = Math.min(100, Math.max(0, (completedItems / totalItems) * 100));
        }
        
        setCompletionPercentage(Math.round(percentageCompleted));
        setCompletionStats({
            totalLessons,
            completedLessons,
            totalQuizzes,
            passedQuizzes
        });
        
        // Mark progress card as loaded
        setIsProgressCardLoading(false);
        
        return Math.round(percentageCompleted);
    };

    // ✨ PHASE 4.9+: Calculate total JP (Jam Pelajaran) from curriculum lectures
    const calculateTotalJP = (curriculum) => {
        if (!curriculum || !Array.isArray(curriculum)) return 0;
        
        let totalSeconds = 0;
        
        // Iterate through all sections in curriculum
        curriculum.forEach(section => {
            const sectionItems = section.variant_items || section.items || [];
            
            // Sum up duration of all items
            sectionItems.forEach(item => {
                if (item.content_duration) {
                    totalSeconds += parseDurationToSeconds(item.content_duration);
                }
            });
        });
        
        // 1 JP = 45 minutes = 2700 seconds
        return Math.ceil(totalSeconds / 2700);
    };

    // ✨ PHASE 7.24: Regular function - no memoization needed since we use refs for polling
    const fetchCourseDetail = async (preventLoadingState = false) => {
        if (!preventLoadingState) {
            setIsUpdatingCourse(true);
        }
        
        useAxios.get(`student/course-detail/${UserData()?.user_id}/${param.enrollment_id}/`).then((res) => {
            setCourse(res.data);
            setQuestions(res.data.question_answer);
            setStudentReview(res.data.review);
            
            // ✨ PHASE 7.23+: Sync selectedConversation with fresh data when polling updates questions
            if (openedQuestionId && res.data.question_answer) {
                const updatedQuestion = res.data.question_answer.find(q => q.qa_id === openedQuestionId);
                if (updatedQuestion) {
                    setSelectedConversation(updatedQuestion);
                    
                    // ✨ PHASE 7.23+: Update user's liked status based on fresh API data (user_liked field)
                    if (updatedQuestion.user_liked) {
                        setUserLikedQuestions(prev => new Set([...prev, updatedQuestion.qa_id]));
                    } else {
                        setUserLikedQuestions(prev => new Set([...prev].filter(id => id !== updatedQuestion.qa_id)));
                    }
                    
                    // ✨ PHASE 7.23+: Update message likes if messages exist
                    if (updatedQuestion.messages && Array.isArray(updatedQuestion.messages)) {
                        const likedMessageIds = new Set();
                        updatedQuestion.messages.forEach(msg => {
                            if (msg.user_liked) {
                                likedMessageIds.add(msg.id);
                            }
                        });
                        setUserLikedMessages(likedMessageIds);
                    }
                }
            }
            
            // Calculate total lessons from curriculum more accurately
            const totalLessons = res.data.curriculum?.reduce((total, section) => {
                const sectionItems = section.variant_items || section.items || [];
                return total + sectionItems.length;
            }, 0) || 0;
            
            // Count unique completed lessons (avoid duplicates)
            const completedLessonsSet = new Set();
            res.data.completed_lesson?.forEach(cl => {
                const itemId = cl.variant_item?.variant_item_id; // Use consistent variant_item_id
                if (itemId) {
                    completedLessonsSet.add(itemId.toString());
                }
            });
            const completedLessons = completedLessonsSet.size;
            
            // Store course ID for quiz operations
            const currentCourseId = res.data.course?.course_id;
            setCourseId(currentCourseId);
            
            // Fetch quizzes and calculate completion percentage after quizzes are loaded
            if (currentCourseId) {
                fetchQuizzes(currentCourseId, totalLessons, completedLessons);
            } else {
                // No quizzes, just calculate based on lessons
                calculateCompletionPercentage(totalLessons, completedLessons, 0, 0);
            }
        }).catch((error) => {
            Toast().fire({
                icon: "error",
                title: "Gagal memuat detail kursus",
                text: "Silakan segarkan halaman untuk mencoba lagi.",
                timer: 4000
            });
        }).finally(() => {
            setIsUpdatingCourse(false);
        });
    };  // ✨ PHASE 7.24: Regular function version - refs will hold latest implementation

    // Quiz Resume Functions
    const saveQuizProgress = (quizData, answers, currentIndex, timeLeft, startTime) => {
        // Validate inputs
        if (!quizData || !quizData.quiz_id || !UserData()?.user_id) {
            return;
        }
        
        if (timeLeft <= 0) {
            return;
        }
        
        const progressData = {
            quiz: quizData,
            answers: answers || {},
            currentQuestionIndex: currentIndex || 0,
            timeRemaining: timeLeft,
            startTime: startTime || Date.now(),
            courseId: courseId,
            userId: UserData().user_id,
            timestamp: Date.now(),
            version: "1.0" // For future compatibility
        };
        
        const progressKey = `quiz_progress_${UserData().user_id}_${quizData.quiz_id}`;
        
        try {
            localStorage.setItem(progressKey, JSON.stringify(progressData));
        } catch (error) {
            
            // If storage is full, try to clean up old quiz progress
            if (error.name === "QuotaExceededError") {
                cleanupOldQuizProgress();
                try {
                    localStorage.setItem(progressKey, JSON.stringify(progressData));
                } catch (retryError) {
                }
            }
        }
    };

    // Cleanup function for old quiz progress
    const cleanupOldQuizProgress = () => {
        const maxAge = 2 * 60 * 60 * 1000; // 2 hours
        const keys = Object.keys(localStorage);
        let cleanedCount = 0;
        
        keys.forEach(key => {
            if (key.startsWith("quiz_progress_")) {
                try {
                    const data = localStorage.getItem(key);
                    if (data) {
                        const parsed = JSON.parse(data);
                        if (Date.now() - parsed.timestamp > maxAge) {
                            localStorage.removeItem(key);
                            cleanedCount++;
                        }
                    }
                } catch (error) {
                    // Remove corrupted data
                    localStorage.removeItem(key);
                    cleanedCount++;
                }
            }
        });
    };

    const loadQuizProgress = (quizData) => {
        // Handle both quiz objects and quiz IDs
        const quizId = typeof quizData === "string" ? quizData : quizData?.quiz_id;
        if (!quizId) {
            return null;
        }
        
        const progressKey = `quiz_progress_${UserData()?.user_id}_${quizId}`;
        const savedProgress = localStorage.getItem(progressKey);
        
        if (savedProgress) {
            try {
                const progressData = JSON.parse(savedProgress);
                
                // Validate progress data structure
                const isValidData = progressData && 
                                   typeof progressData.timeRemaining === "number" &&
                                   typeof progressData.currentQuestionIndex === "number" &&
                                   progressData.answers &&
                                   progressData.quiz &&
                                   progressData.startTime;
                
                if (!isValidData) {
                    localStorage.removeItem(progressKey);
                    return null;
                }
                
                // Check if progress is from the last 2 hours (quiz session timeout)
                const maxAge = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
                
                if (Date.now() - progressData.timestamp <= maxAge && progressData.timeRemaining > 0) {
                    return progressData;
                } else {
                    localStorage.removeItem(progressKey);
                }
            } catch (error) {
                localStorage.removeItem(progressKey); // Clean up corrupted data
            }
        }
        
        return null;
    };

    // Helper function to check if a quiz has saved progress (for resume functionality)
    const hasQuizProgress = (quizData) => {
        const quizId = typeof quizData === "string" ? quizData : quizData?.quiz_id;
        if (!quizId) return false;
        
        const progressKey = `quiz_progress_${UserData()?.user_id}_${quizId}`;
        const savedProgress = localStorage.getItem(progressKey);
        
        if (savedProgress) {
            try {
                const progressData = JSON.parse(savedProgress);
                
                // Check if progress is valid and not expired (2 hours)
                const maxAge = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
                const isValidData = progressData && 
                                   typeof progressData.timeRemaining === "number" &&
                                   typeof progressData.currentQuestionIndex === "number" &&
                                   progressData.answers &&
                                   progressData.quiz &&
                                   progressData.startTime;
                
                const isNotExpired = Date.now() - progressData.timestamp <= maxAge;
                const hasTimeLeft = progressData.timeRemaining > 0;
                
                if (isValidData && isNotExpired && hasTimeLeft) {
                    return true;
                }
            } catch (error) {
            }
        }
        
        return false;
    };

    const clearQuizProgress = (quizData) => {
        // Handle both quiz objects and quiz IDs
        const quizId = typeof quizData === "string" ? quizData : quizData?.quiz_id;
        if (!quizId) return;
        
        const progressKey = `quiz_progress_${UserData()?.user_id}_${quizId}`;
        localStorage.removeItem(progressKey);
    };

    const checkForResumeableQuiz = (availableQuizzes = null) => {
        // Check if there's a resumeable quiz when component mounts
        if (!UserData()?.user_id) {
            return;
        }
        
        const quizzesToCheck = availableQuizzes || quizzes;
        
        if (!quizzesToCheck || quizzesToCheck.length === 0) {
            return;
        }
        
        // Check all stored quiz progress for this user
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(`quiz_progress_${UserData().user_id}_`)) {
                const savedProgress = localStorage.getItem(key);
                if (savedProgress) {
                    try {
                        const progressData = JSON.parse(savedProgress);
                        const maxAge = 2 * 60 * 60 * 1000; // 2 hours
                        
                        if (Date.now() - progressData.timestamp <= maxAge) {
                            const matchingQuiz = quizzesToCheck.find(q => q.quiz_id === progressData.quiz.quiz_id);
                            if (matchingQuiz) {
                                progressData.quiz = matchingQuiz;
                                setQuizResumeData(progressData);
                                
                                showResumeDialog(matchingQuiz, progressData);
                                return;
                            }
                        } else {
                            localStorage.removeItem(key);
                        }
                    } catch (error) {
                        localStorage.removeItem(key); // Clean up corrupted data
                    }
                }
            }
        });
    };

    const showResumeDialog = (quiz, resumeData) => {
        Swal.fire({
            title: "Lanjutkan Kuis?",
            html: `
                <div class="swal-resume-container">
                    <p class="swal-resume-title"><strong>Anda memiliki percobaan kuis yang belum selesai:</strong></p>
                    <div class="swal-resume-content">
                        <p class="swal-resume-item"><strong>📝 Kuis:</strong> ${quiz.title}</p>
                        <p class="swal-resume-item"><strong>⏰ Waktu Tersisa:</strong> ${Math.floor(resumeData.timeRemaining / 60)}:${(resumeData.timeRemaining % 60).toString().padStart(2, "0")}</p>
                        <p class="swal-resume-item"><strong>📊 Kemajuan:</strong> Pertanyaan ${resumeData.currentQuestionIndex + 1} dari ${quiz.questions.length}</p>
                        <p class="swal-resume-item"><strong>📅 Dimulai:</strong> ${new Date(resumeData.startTime).toLocaleString()}</p>
                        <p class="swal-resume-hint">💡 Kemajuan Anda telah disimpan secara otomatis</p>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: "🔄 Lanjutkan Kuis",
            cancelButtonText: "🆕 Mulai Kuis Baru",
            confirmButtonColor: "#28a745",
            cancelButtonColor: "#dc3545",
            width: "500px",
            customClass: {
                popup: "quiz-resume-dialog",
                title: "quiz-resume-title",
                htmlContainer: "quiz-resume-content"
            }
        }).then((result) => {
            if (result.isConfirmed) {
                // Resume the quiz
                setSelectedQuiz(quiz);
                resumeQuiz(quiz, resumeData);
            } else if (result.isDismissed) {
                // Clear old data and allow starting fresh
                clearQuizProgress(quiz);
                setSelectedQuiz(quiz);
                Toast().fire({
                    icon: "info",
                    title: "Kemajuan sebelumnya dihapus",
                    text: "Anda sekarang dapat memulai percobaan kuis yang baru."
                });
            }
        });
    };

    const fetchQuizzes = async (courseId, totalLessons = 0, completedLessons = 0) => {
        if (!courseId) {
            return;
        }

        const apiUrl = `student/quiz-list/${UserData()?.user_id}/${courseId}/`;
        
        useAxios.get(apiUrl).then((res) => {
            setQuizzes(res.data);
            
            // Count total quizzes and passed quizzes
            const totalQuizzes = res.data?.length || 0;
            const passedQuizzes = res.data?.filter(quiz => quiz.is_passed)?.length || 0;
            
            // Recalculate completion percentage including quizzes
            if (totalLessons > 0 || totalQuizzes > 0) {
                calculateCompletionPercentage(totalLessons, completedLessons, totalQuizzes, passedQuizzes);
            }
            
        }).catch((error) => {
            // Still calculate completion with lessons only if quiz fetch fails
            if (totalLessons > 0) {
                calculateCompletionPercentage(totalLessons, completedLessons, 0, 0);
            }
        });
    };    
    
    // ✨ PHASE 11.202: Listen for lesson completion event from modal to refetch course data
    useEffect(() => {
        const handleLessonAnsweredCorrectly = async (event) => {
            const { variantItemId } = event.detail;
            console.log(`[CourseDetail] Event received: Lesson ${variantItemId} answered correctly - refetching course data`);
            console.log(`[PHASE 12.16] 🎯 Event triggered for lesson ID: ${variantItemId}`);
            
            // ✨ PHASE 44: CRITICAL FIX - Increased from 500ms to 1000ms
            // Backend wraps answer + completion in single transaction (transaction.atomic)
            // Database needs time to fully commit both records before we query
            // 500ms was insufficient on slower systems, causing race condition where
            // answer record not visible when serializer queries for it
            setTimeout(async () => {
                try {
                    console.log(`[PHASE 44] ⏳ Fetching course detail after 1000ms delay (answer + completion transaction committed)...`);
                    await fetchCourseDetail(true);  // true = prevent loading state
                    console.log('[CourseDetail] ✅ Course data refreshed after correct answer');
                    console.log(`[PHASE 44] 📊 Course data updated. Checking completed_lesson array...`);
                    
                } catch (error) {
                    console.error('[CourseDetail] Error refetching course data:', error);
                }
            }, 1000);
        };
        
        window.addEventListener('lessonAnsweredCorrectly', handleLessonAnsweredCorrectly);
        
        return () => {
            window.removeEventListener('lessonAnsweredCorrectly', handleLessonAnsweredCorrectly);
        };
    }, []);
    
    useEffect(() => {
        fetchCourseDetail();
        fetchQAReports(); // ✨ PHASE 7.16: Load user's submitted Q&A reports
        
        // Debug helper - add a test function to window for testing resume functionality
        window.testQuizResume = (quizId) => {
            const testProgress = {
                quiz: { quiz_id: quizId, title: "Test Quiz", questions: [{ question_id: "123" }] },
                answers: { "123": "456" },
                currentQuestionIndex: 0,
                timeRemaining: 300,
                startTime: Date.now() - 60000,
                courseId: courseId,
                userId: UserData()?.user_id,
                timestamp: Date.now(),
                version: "1.0"
            };
            const key = `quiz_progress_${UserData()?.user_id}_${quizId}`;
            localStorage.setItem(key, JSON.stringify(testProgress));
            checkForResumeableQuiz(quizzes);
        };
        
        window.debugQuizResume = () => {
            quizzes.forEach(quiz => {
                const hasProgress = hasQuizProgress(quiz);
            });
            
            checkForResumeableQuiz(quizzes);
        };
        
        window.clearAllQuizProgress = () => {
            const keys = Object.keys(localStorage).filter(k => k.startsWith("quiz_progress_"));
            keys.forEach(key => localStorage.removeItem(key));
        };
        
        // checkForResumeableQuiz will be called after quizzes are loaded
    }, []);

    // ✨ PHASE 48 FIX: Auto-select first lesson from Bagian 1 on page load if no lesson selected
    // When course data loads and user hasn't selected or resumed a lesson, automatically load the first lesson
    useEffect(() => {
        // ✨ PHASE 48: Only auto-select if:
        // 1. Course data has loaded
        // 2. No lesson is currently selected (variantItem is null)
        // 3. No saved lesson in localStorage (not a resumed session)
        if (!course || variantItem) {
            return;  // Skip if no course data or lesson already selected
        }

        try {
            const savedData = localStorage.getItem("lms_current_lesson");
            if (savedData) {
                return;  // Skip if there's a saved lesson (user is resuming)
            }

            // Get first section (Bagian 1) from curriculum
            if (!course.curriculum || !Array.isArray(course.curriculum) || course.curriculum.length === 0) {
                return;  // No curriculum available
            }

            const firstSection = course.curriculum[0];
            const sectionItems = firstSection.variant_items || firstSection.items || [];
            
            if (sectionItems.length === 0) {
                return;  // No lessons in first section
            }

            const firstLesson = sectionItems[0];
            
            if (firstLesson && firstLesson.variant_item_id) {
                console.log(`[CourseDetail.PHASE_48] 🎬 Auto-selecting first lesson: ${firstLesson.title}`);
                handlePlayLessonWithAutoplay(firstLesson);
            }
        } catch (error) {
            console.warn('[CourseDetail.PHASE_48] Error auto-selecting first lesson:', error);
            // Silently continue - this is not critical functionality
        }
    }, [course]);  // Only re-run when course data arrives

    // ✨ PHASE 7.16+: Refetch Q&A reports whenever questions load
    useEffect(() => {
        if (questions && questions.length > 0) {
            // Small delay to ensure data is ready
            setTimeout(() => {
                fetchQAReports();  // ✨ PHASE 7.24: fetchQAReports is now memoized
            }, 100);
        }
    }, [questions.length]);  // ✨ PHASE 7.24: fetchQAReports is regular function, not in dependencies

    // ✨ PHASE 7.16+: Set currentReportData when modal opens and reports are ready
    useEffect(() => {
        if (showQAReportModal && reportingQAId && qaReports) {
            let report = null;
            if (reportingQAType === 'question') {
                report = qaReports?.question_reports?.find(r => r.question__qa_id === reportingQAId);
            } else {
                report = qaReports?.message_reports?.find(r => r.message__qa_id === reportingQAId);
            }
            
            if (report) {
                setCurrentReportData(report);
            }
        }
    }, [showQAReportModal, reportingQAId, qaReports]);

    // ✨ PHASE 7.16+: Refetch Q&A reports when courseId becomes available
    useEffect(() => {
        if (courseId) {
            fetchQAReports();
        }
    }, [courseId]);

    // Cleanup timer on component unmount
    useEffect(() => {
        return () => {
            if (quizTimerRef.current) {
                clearInterval(quizTimerRef.current);
                quizTimerRef.current = null;
            }
        };
    }, []);

    // ✨ PHASE 4.233: Prevent page scroll when quiz is active
    useEffect(() => {
        if (isQuizActive) {
            // Disable scrolling by adding overflow hidden to body
            document.body.style.overflow = 'hidden';
            return () => {
                // Re-enable scrolling when quiz closes
                document.body.style.overflow = 'unset';
            };
        }
    }, [isQuizActive]);

    // ✨ PHASE 4.103: Block LEFT/RIGHT arrow keys on the entire course page
    // ✨ PHASE 11.180 FIX: COMPLETELY DISABLED - Arrow key blocking now handled by video player components only
    // Removing the global document-level listeners that were interfering with video player keyboard navigation
    // 
    // useEffect(() => {
    //     const lastKeyNotificationTimeRef = useRef(0);
    //     const NOTIFICATION_THROTTLE_MS = 3000;
    //
    //     const showArrowKeyNotification = (arrowType) => {
    //         const now = Date.now();
    //         if (now - lastKeyNotificationTimeRef.current > NOTIFICATION_THROTTLE_MS) {
    //             lastKeyNotificationTimeRef.current = now;
    //             const titles = {
    //                 'ArrowLeft': 'Tombol Panah Kiri Dinonaktifkan',
    //                 'ArrowRight': 'Tombol Panah Kanan Dinonaktifkan'
    //             };
    //             Toast().fire({
    //                 icon: "info",
    //                 title: titles[arrowType] || "Tombol Panah Dinonaktifkan",
    //                 text: "Navigasi tombol panah tidak tersedia di halaman ini.",
    //                 timer: 2000,
    //                 toast: true,
    //                 position: "top-end"
    //             });
    //         }
    //     };
    //
    //     const handleArrowKeyBlock = (e) => {
    //         if (e.key === 'ArrowLeft') {
    //             e.preventDefault();
    //             e.stopPropagation();
    //             showArrowKeyNotification('ArrowLeft');
    //             return false;
    //         }
    //         if (e.key === 'ArrowRight') {
    //             e.preventDefault();
    //             e.stopPropagation();
    //             showArrowKeyNotification('ArrowRight');
    //             return false;
    //         }
    //     };
    //
    //     const handleVideoArrowKeyBlocked = (e) => {
    //         if (e.detail && (e.detail.key === 'ArrowLeft' || e.detail.key === 'ArrowRight')) {
    //             showArrowKeyNotification(e.detail.key);
    //         }
    //     };
    //
    //     document.addEventListener('keydown', handleArrowKeyBlock, true);
    //     window.addEventListener('keydown', handleArrowKeyBlock, true);
    //     document.addEventListener('arrowKeyBlocked', handleVideoArrowKeyBlocked, true);
    //
    //     return () => {
    //         document.removeEventListener('keydown', handleArrowKeyBlock, true);
    //         window.removeEventListener('keydown', handleArrowKeyBlock, true);
    //         document.removeEventListener('arrowKeyBlocked', handleVideoArrowKeyBlocked, true);
    //     };
    // }, []);

    const handleColorChange = (color) => {
        // Validate color format
        const isValidColor = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
        const validColor = isValidColor ? color : "#f39c12";
        
        setCreateNote({
            ...createNote,
            color: validColor
        });
        setSelectedNoteColor(validColor);
    };

    // Helper function to generate color variations
    const getColorVariations = (color) => {
        // Fallback to default orange if color is invalid
        if (!color || typeof color !== "string") {
            color = "#f39c12";
        }
        
        const hexToRgb = (hex) => {
            // Clean the hex value
            hex = hex.replace("#", "");
            if (hex.length === 3) {
                hex = hex.split("").map(char => char + char).join("");
            }
            
            const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        };

        const rgb = hexToRgb(color);
        if (!rgb) {
            // Fallback color variations if parsing fails
            return { 
                light: "rgba(243, 156, 18, 0.2)", 
                hover: "rgba(243, 156, 18, 0.13)", 
                shadow: "rgba(243, 156, 18, 0.3)" 
            };
        }

        return {
            light: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`,
            hover: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.13)`,
            shadow: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`
        };
    };

    const handleSubmitCreateNote = async (e) => {
        e.preventDefault();

        // Validate required fields
        if (!createNote.title?.trim()) {
            Toast().fire({
                icon: "error",
                title: "Silakan masukkan judul catatan",
            });
            return;
        }
        
        if (!createNote.note?.trim()) {
            Toast().fire({
                icon: "error",
                title: "Silakan masukkan konten catatan",
            });
            return;
        }

        const formdata = new FormData();
        formdata.append("user_id", UserData()?.user_id);
        formdata.append("enrollment_id", param.enrollment_id);
        formdata.append("title", createNote.title.trim());
        formdata.append("note", createNote.note.trim());
        formdata.append("color", createNote.color || "#f39c12");
        // ✨ PHASE 11.160: Include optional lesson context
        if (currentNoteVariantContext?.variant_id) {
            formdata.append("variant_id", currentNoteVariantContext.variant_id);
        }
        if (currentNoteVariantContext?.variant_item_id) {
            formdata.append("variant_item_id", currentNoteVariantContext.variant_item_id);
        }

        try {
            await useAxios.post(`student/course-note/${UserData()?.user_id}/${param.enrollment_id}/`, formdata).then((res) => {
                fetchCourseDetail();
                setCreateNote({ title: "", note: "", color: "#f39c12" });
                setSelectedNoteColor("#f39c12");
                setCurrentNoteVariantContext(null);  // ✨ PHASE 11.160: Reset lesson context
                handleNoteClose(); // Close modal after successful creation
                Toast().fire({
                    icon: "success",
                    title: "Catatan berhasil dibuat",
                });
            });
        } catch (error) {
            Toast().fire({
                icon: "error",
                title: "Gagal membuat catatan. Silakan coba lagi.",
            });
        }
    };

    const handleSubmitEditNote = (e, noteId) => {
        e.preventDefault();
        
        // Validate required fields
        if (!createNote.title?.trim()) {
            Toast().fire({
                icon: "error",
                title: "Silakan masukkan judul catatan",
            });
            return;
        }
        
        if (!createNote.note?.trim()) {
            Toast().fire({
                icon: "error",
                title: "Silakan masukkan konten catatan",
            });
            return;
        }

        const formdata = new FormData();
        formdata.append("user_id", UserData()?.user_id);
        formdata.append("enrollment_id", param.enrollment_id);
        formdata.append("title", createNote.title.trim());
        formdata.append("note", createNote.note.trim());
        formdata.append("color", createNote.color || "#f39c12");
        // ✨ PHASE 11.160: Include optional lesson context
        if (currentNoteVariantContext?.variant_id) {
            formdata.append("variant_id", currentNoteVariantContext.variant_id);
        }
        if (currentNoteVariantContext?.variant_item_id) {
            formdata.append("variant_item_id", currentNoteVariantContext.variant_item_id);
        }

        useAxios.patch(`student/course-note-detail/${UserData()?.user_id}/${param.enrollment_id}/${noteId}/`, formdata).then((res) => {
            fetchCourseDetail();
            handleNoteClose();
            Toast().fire({
                icon: "success",
                title: "Catatan berhasil diperbarui",
            });
        }).catch((error) => {
            Toast().fire({
                icon: "error",
                title: "Gagal memperbarui catatan. Silakan coba lagi.",
            });
        });
    };

    const handleDeleteNote = (noteId) => {
        useAxios.delete(`student/course-note-detail/${UserData()?.user_id}/${param.enrollment_id}/${noteId}/`).then((res) => {
            fetchCourseDetail();
            Toast().fire({
                icon: "success",
                title: "Catatan berhasil dihapus",
            });
        });
    };

    const handleMessageChange = (event) => {
        setCreateMessage({
            ...createMessage,
            [event.target.name]: event.target.value,
        });
        
        // ✨ PHASE 7.14: Auto-resize textarea on input
        if (questionTextareaRef.current && event.target.name === 'message') {
            const textarea = questionTextareaRef.current;
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 400) + 'px';  // Max height 400px
        }
    };

    const handleSaveQuestion = async (e) => {
        e.preventDefault();
        const formdata = new FormData();

        formdata.append("course_id", course.course?.id);
        formdata.append("user_id", UserData()?.user_id);
        formdata.append("title", createMessage.title);
        formdata.append("message", createMessage.message);
        // ✨ PHASE 7.7: Send lesson context to backend for proper organization and filtering
        if (currentVariantContext?.variant_item_id) {
            formdata.append("variant_item_id", currentVariantContext.variant_item_id);
        }

        await useAxios.post(`student/question-answer-list-create/${course.course?.id}/`, formdata).then((res) => {
            fetchCourseDetail();
            setCreateMessage({
                title: "",
                message: "",
            });
            handleQuestionClose();
            Toast().fire({
                icon: "success",
                title: "Pertanyaan berhasil dibuat",
            });
        });
    };

    const sendNewMessage = async (e) => {
        e.preventDefault();
        
        if (!selectedConversation) {
            Toast().fire({
                icon: "error",
                title: "Silakan pilih percakapan terlebih dahulu",
            });
            return;
        }

        if (!createMessage.message.trim()) {
            Toast().fire({
                icon: "error",
                title: "Silakan masukkan pesan"
            });
            return;
        }

        const formdata = new FormData();
        formdata.append("course_id", course.course?.id);
        formdata.append("user_id", UserData()?.user_id);
        formdata.append("message", createMessage.message);
        formdata.append("qa_id", selectedConversation?.qa_id);

        try {
            const response = await useAxios.post("student/question-answer-message-create/", formdata);
            
            // Update the selected conversation with new message data
            if (response.data.question) {
                setSelectedConversation(response.data.question);
                fetchCourseDetail();
                // Also update the conversations list to reflect the new message
                setCourse(prev => ({
                    ...prev,
                    questions: prev.questions?.map(q => 
                        q.qa_id === selectedConversation.qa_id ? response.data.question : q
                    ) || []
                }));
            }
            
            // Clear the message input
            setCreateMessage({
                title: "",
                message: "",
            });
            
        } catch (error) {
            Toast().fire({
                icon: "error",
                title: "Gagal mengirim pesan"
            });
        }
    };

    // ✨ PHASE 7.16+PHASE 7.24: Fetch Q&A Reports - Regular function (not memoized, refs will hold latest)
    const fetchQAReports = async () => {
        try {
            const userData = UserData();
            
            if (!userData?.id && !userData?.user_id) {
                return;
            }

            const userId = userData?.id || userData?.user_id;
            // ✨ Use courseId from state (populated by fetchCourseDetail), not URL params
            const crsId = courseId;
            
            const res = await useAxios.get(`student/qa-reports/${crsId}/?user_id=${userId}`);
            const reports = res.data;
            
            // Ensure data structure is correct
            const normalizedReports = {
                question_reports: reports?.question_reports || [],
                message_reports: reports?.message_reports || []
            };
            
            setQaReports(normalizedReports);
        } catch (error) {
            // Q&A reports fetch error - silently fail
        }
    };  // ✨ PHASE 7.24: Regular function version - refs will hold latest implementation

    // ✨ PHASE 7.16+: Enhanced Q&A Report Modal Handlers - Check for existing report to show feedback
    const handleOpenQAReportModal = (question, type = 'question') => {
        setReportingQAId(question.qa_id);
        setReportingQAType(type);
        setShowQAReportModal(true);
        
        console.log("[handleOpenQAReportModal] Opening modal for:", { qaId: question.qa_id, type, qaReports });
        
        // ✨ PHASE 7.16+: Check if user already has a report for this item
        let existingReport = null;
        
        if (type === 'question') {
            console.log("[handleOpenQAReportModal] Searching question_reports for:", question.qa_id);
            console.log("[handleOpenQAReportModal] Available question reports:", qaReports?.question_reports);
            
            existingReport = qaReports?.question_reports?.find(r => {
                console.log(`[handleOpenQAReportModal] Comparing ${r.question__qa_id} === ${question.qa_id}: ${r.question__qa_id === question.qa_id}`);
                return r.question__qa_id === question.qa_id;
            });
        } else {
            console.log("[handleOpenQAReportModal] Searching message_reports for:", question.qa_id);
            console.log("[handleOpenQAReportModal] Available message reports:", qaReports?.message_reports);
            
            existingReport = qaReports?.message_reports?.find(r => {
                console.log(`[handleOpenQAReportModal] Comparing ${r.message__qa_id} === ${question.qa_id}: ${r.message__qa_id === question.qa_id}`);
                return r.message__qa_id === question.qa_id;
            });
        }
        
        console.log("[handleOpenQAReportModal] Found existing report:", existingReport);
        
        if (existingReport) {
            // Show existing report feedback
            setCurrentReportData(existingReport);
            setQaReportReason('');
            setQaReportDescription('');
            console.log("[handleOpenQAReportModal] Setting current report data:", existingReport);
        } else {
            // Show form for new report
            setCurrentReportData(null);
            setQaReportReason('');
            setQaReportDescription('');
            console.log("[handleOpenQAReportModal] No existing report, showing form");
        }
    };

    // ✨ PHASE 7.16: Helper function to check if a Q&A item has been reported by current user
    const isQAItemReported = (qaId) => {
        const question_reports = qaReports?.question_reports || [];
        const message_reports = qaReports?.message_reports || [];
        return question_reports.some(r => r.question__qa_id === qaId) || 
               message_reports.some(r => r.message__qa_id === qaId);
    };

    // ✨ PHASE 7.16+: Helper function to get report status for a Q&A item
    const getQAReportStatus = (qaId, type = 'question') => {
        if (type === 'question') {
            return qaReports?.question_reports?.find(r => r.question__qa_id === qaId);
        } else {
            return qaReports?.message_reports?.find(r => r.message__qa_id === qaId);
        }
    };

    const handleOpenQAMessageReportModal = (message) => {
        setReportingQAId(message.qa_id);
        setReportingQAType('message');
        setShowQAReportModal(true);
        
        // ✨ PHASE 7.16+: Check if user already has a report for this message
        const existingReport = qaReports.message_reports?.find(r => r.message__qa_id === message.qa_id);
        if (existingReport) {
            setCurrentReportData(existingReport);
            setQaReportReason('');
            setQaReportDescription('');
        } else {
            setCurrentReportData(null);
            setQaReportReason('');
            setQaReportDescription('');
        }
    };

    const handleCloseQAReportModal = () => {
        console.log("[handleCloseQAReportModal] Closing modal");
        
        // ✨ PHASE 7.16+: If report is reviewed (not pending), mark case as closed for this session
        if (currentReportData && currentReportData.status !== 'pending') {
            console.log("[handleCloseQAReportModal] Report is reviewed, marking case as closed");
            setClosedReports(prev => new Set([...prev, currentReportData.id]));
            console.log("[handleCloseQAReportModal] Case marked closed - user cannot edit or interact with it");
        }
        
        setShowQAReportModal(false);
        setReportingQAId(null);
        setReportingQAType('question');
        setQaReportReason('');
        setQaReportDescription('');
        setCurrentReportData(null);  // ✨ PHASE 7.16+: Clear current report data on close
        setEditingReportId(null);  // ✨ PHASE 7.16+: Clear editing state
        console.log("[handleCloseQAReportModal] Modal state cleared");
    };

    const handleEditQAReport = () => {
        console.log("[handleEditQAReport] Entering edit mode for Q&A report", currentReportData);
        // Load previous report data into form fields
        if (currentReportData) {
            setQaReportReason(currentReportData.reason || '');
            setQaReportDescription(currentReportData.description || '');
            setEditingReportId(currentReportData.id);  // ✨ PHASE 7.16+: Track the report ID being edited
            console.log("[handleEditQAReport] Form loaded with previous data, ready for re-submission");
        }
    };

    const handleSubmitQAReport = async () => {
        if (!qaReportReason.trim()) {
            Toast().fire({
                icon: "warning",
                title: "Silakan pilih alasan laporan",
            });
            return;
        }

        setReportingQA(true);

        try {
            const userData = UserData();
            if (!userData?.id && !userData?.user_id) {
                throw new Error("User ID not found");
            }

            // ✨ PHASE 7.16+: Use editingReportId for PUT requests, reportingQAId for POST requests
            const urlId = editingReportId || reportingQAId;
            const endpoint = reportingQAType === 'message' 
                ? `student/question-answer-message-report/${urlId}/`
                : `student/question-answer-report/${urlId}/`;

            // ✨ PHASE 7.16+: Handle both new reports (POST) and edited reports (PUT)
            if (editingReportId) {
                // Update existing report and reset status to "pending"
                await useAxios.put(endpoint, {
                    user_id: userData?.user_id || userData?.id,
                    reason: qaReportReason,
                    description: qaReportDescription,
                    status: 'pending',  // Reset to pending review
                });
                console.log("[handleSubmitQAReport] Report updated with status reset to 'pending'");
            } else {
                // Create new report
                await useAxios.post(endpoint, {
                    user_id: userData?.user_id || userData?.id,
                    reason: qaReportReason,
                    description: qaReportDescription,
                });
                console.log("[handleSubmitQAReport] New report created");
            }

            Toast().fire({
                icon: "success",
                title: editingReportId ? "Laporan berhasil diperbarui!" : "Laporan berhasil dikirim!",
                text: editingReportId ? "Laporan Anda telah diperbarui dan menunggu tinjauan ulang." : "Admin akan meninjau laporan Anda dalam waktu singkat.",
            });

            // ✨ PHASE 7.16+: Close modal first, then refetch and reopen to show status
            console.log("[handleSubmitQAReport] Closing modal first");
            setShowQAReportModal(false);
            
            setTimeout(() => {
                console.log("[handleSubmitQAReport] Fetching fresh reports after 500ms");
                fetchQAReports();
                
                // Reopen modal with the new report status
                setTimeout(() => {
                    console.log("[handleSubmitQAReport] Reopening modal to show report status");
                    const qaIdValue = reportingQAId;
                    const typeValue = reportingQAType;
                    
                    setReportingQAId(qaIdValue);
                    setReportingQAType(typeValue);
                    setShowQAReportModal(true);
                    setQaReportReason('');
                    setQaReportDescription('');
                    setEditingReportId(null);  // ✨ PHASE 7.16+: Clear editing state after successful submission
                    
                    console.log("[handleSubmitQAReport] Modal reopened - should show report status");
                }, 600);
            }, 100);
        } catch (error) {
            console.error("Error submitting Q&A report:", error);
            if (error.response?.data?.error) {
                Toast().fire({
                    icon: "error",
                    title: error.response.data.error,
                });
            } else {
                Toast().fire({
                    icon: "error",
                    title: "Gagal mengirim laporan. Silakan coba lagi.",
                });
            }
        } finally {
            setReportingQA(false);
        }
    };

    // ✨ PHASE 7.16: Like question handler
    const handleLikeQuestion = async (question) => {
        try {
            const userId = UserData()?.user_id;
            const isCurrentlyLiked = userLikedQuestions.has(question.qa_id);
            
            // ✨ PHASE 7.23: Optimistically update UI before API response
            if (isCurrentlyLiked) {
                // Unliking
                setUserLikedQuestions(prev => new Set([...prev].filter(id => id !== question.qa_id)));
                
                // ✨ PHASE 7.24: Update underlying questions state to keep in sync
                setQuestions(prev => prev.map(q =>
                    q.qa_id === question.qa_id
                        ? { ...q, likes_count: Math.max(0, (q.likes_count || 0) - 1), user_liked: false }
                        : q
                ));
                
                setFilteredQuestions(prev => prev.map(q => 
                    q.qa_id === question.qa_id 
                        ? { ...q, likes_count: Math.max(0, (q.likes_count || 0) - 1), user_liked: false }
                        : q
                ));
                // ✨ PHASE 7.24: Sync selectedConversation if viewing this question
                if (selectedConversation?.qa_id === question.qa_id) {
                    setSelectedConversation(prev => ({
                        ...prev,
                        likes_count: Math.max(0, (prev.likes_count || 0) - 1),
                        user_liked: false
                    }));
                }
            } else {
                // Liking
                setUserLikedQuestions(prev => new Set([...prev, question.qa_id]));
                
                // ✨ PHASE 7.24: Update underlying questions state to keep in sync
                setQuestions(prev => prev.map(q =>
                    q.qa_id === question.qa_id
                        ? { ...q, likes_count: (q.likes_count || 0) + 1, user_liked: true }
                        : q
                ));
                
                setFilteredQuestions(prev => prev.map(q => 
                    q.qa_id === question.qa_id 
                        ? { ...q, likes_count: (q.likes_count || 0) + 1, user_liked: true }
                        : q
                ));
                // ✨ PHASE 7.24: Sync selectedConversation if viewing this question
                if (selectedConversation?.qa_id === question.qa_id) {
                    setSelectedConversation(prev => ({
                        ...prev,
                        likes_count: (prev.likes_count || 0) + 1,
                        user_liked: true
                    }));
                }
            }
            
            const response = await useAxios.post(`student/question-answer-like/${question.qa_id}/`, {
                user_id: userId,
                course_id: course.course?.id,
            });
            
            // Update with actual count from server
            if (response.data) {
                // ✨ PHASE 7.24: Update both questions states with server response
                setQuestions(prev => prev.map(q =>
                    q.qa_id === question.qa_id
                        ? { ...q, likes_count: response.data.likes_count || 0, user_liked: response.data.liked || false }
                        : q
                ));
                
                // Update in filteredQuestions list
                setFilteredQuestions(prev => prev.map(q => 
                    q.qa_id === question.qa_id 
                        ? { ...q, likes_count: response.data.likes_count || 0, user_liked: response.data.liked || false }
                        : q
                ));
                
                // ✨ PHASE 7.23: Update user's liked status based on server response
                if (response.data.liked) {
                    setUserLikedQuestions(prev => new Set([...prev, question.qa_id]));
                } else {
                    setUserLikedQuestions(prev => new Set([...prev].filter(id => id !== question.qa_id)));
                }
                
                // ✨ PHASE 7.24: Also update selectedConversation if viewing this question - Use server response
                if (selectedConversation?.qa_id === question.qa_id) {
                    setSelectedConversation(prev => ({
                        ...prev,
                        likes_count: response.data.likes_count || 0,
                        user_liked: response.data.liked || false  // ✨ PHASE 7.24: Sync user_liked status
                    }));
                }
                
                Toast().fire({
                    icon: "success",
                    title: response.data.message || "Berhasil sukai pertanyaan"
                });
            }
        } catch (error) {
            // Revert optimistic updates on error
            setUserLikedQuestions(prev => {
                const isCurrentlyLiked = prev.has(question.qa_id);
                if (!isCurrentlyLiked) {
                    return new Set([...prev, question.qa_id]);
                } else {
                    return new Set([...prev].filter(id => id !== question.qa_id));
                }
            });
            
            Toast().fire({
                icon: "error",
                title: error.response?.data?.message || "Gagal sukai pertanyaan"
            });
        }
    };

    const handleLikeMessage = async (message) => {
        try {
            const userId = UserData()?.user_id;
            const isCurrentlyLiked = userLikedMessages.has(message.id);
            
            // ✨ PHASE 7.23: Optimistically update UI before API response
            if (isCurrentlyLiked) {
                // Unliking
                setUserLikedMessages(prev => new Set([...prev].filter(id => id !== message.id)));
                // ✨ PHASE 7.24: Sync message likes in selectedConversation immediately
                if (selectedConversation?.messages) {
                    setSelectedConversation(prev => ({
                        ...prev,
                        messages: prev.messages.map(m => 
                            m.id === message.id 
                                ? { ...m, likes_count: Math.max(0, (m.likes_count || 0) - 1), user_liked: false }
                                : m
                        )
                    }));
                }
            } else {
                // Liking
                setUserLikedMessages(prev => new Set([...prev, message.id]));
                // ✨ PHASE 7.24: Sync message likes in selectedConversation immediately
                if (selectedConversation?.messages) {
                    setSelectedConversation(prev => ({
                        ...prev,
                        messages: prev.messages.map(m => 
                            m.id === message.id 
                                ? { ...m, likes_count: (m.likes_count || 0) + 1, user_liked: true }
                                : m
                        )
                    }));
                }
            }
            
            const response = await useAxios.post(`student/question-answer-message-like/${selectedConversation.qa_id}/`, {
                user_id: userId,
                course_id: course.course?.id,
                message_id: message.id,
            });
            
            // Update message likes count in selectedConversation with server response
            if (response.data) {
                setSelectedConversation(prev => ({
                    ...prev,
                    messages: prev.messages.map(m => 
                        m.id === message.id 
                            ? { ...m, likes_count: response.data.likes_count || 0, user_liked: response.data.liked || false }  // ✨ PHASE 7.24: Sync user_liked
                            : m
                    )
                }));
                
                // ✨ PHASE 7.23: Update user's liked status based on server response
                if (response.data.liked) {
                    setUserLikedMessages(prev => new Set([...prev, message.id]));
                } else {
                    setUserLikedMessages(prev => new Set([...prev].filter(id => id !== message.id)));
                }
                
                Toast().fire({
                    icon: "success",
                    title: response.data.message || "Berhasil sukai jawaban"
                });
            }
        } catch (error) {
            // Revert optimistic updates on error
            setUserLikedMessages(prev => {
                const isCurrentlyLiked = prev.has(message.id);
                if (!isCurrentlyLiked) {
                    return new Set([...prev, message.id]);
                } else {
                    return new Set([...prev].filter(id => id !== message.id));
                }
            });
            
            Toast().fire({
                icon: "error",
                title: error.response?.data?.message || "Gagal sukai jawaban"
            });
        }
    };

    useEffect(() => {
      if (lastElementRef.current) {
        lastElementRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }, [selectedConversation]);

    const handleSearchQuestion = (event) => {
        const query = event.target.value.toLowerCase();
    };

    const handleReviewChange = (event) => {
        setCreateReview({
            ...createReview,
            [event.target.name]: event.target.value,
        });
    };

    const handleEditReview = () => {
        // Populate the form with existing review data
        setCreateReview({
            rating: studentReview.rating,
            review: studentReview.review
        });
        setIsEditingReview(true);
    };

    const handleCancelEditReview = () => {
        // Reset form and exit edit mode
        setCreateReview({ rating: 1, review: "" });
        setIsEditingReview(false);
    };

    const handleCreateReviewSubmit = (e) => {
        e.preventDefault();

        // Validation
        if (!createReview.review.trim()) {
            Toast().fire({
                icon: "error",
                title: "Silakan tulis ulasan",
            });
            return;
        }

        if (!createReview.rating || createReview.rating < 1 || createReview.rating > 5) {
            Toast().fire({
                icon: "error",
                title: "Silakan pilih rating",
            });
            return;
        }

        const formdata = new FormData();
        formdata.append("course", course.course?.id);
        formdata.append("user", UserData()?.user_id);
        formdata.append("rating", createReview.rating);
        formdata.append("review", createReview.review);

        useAxios.post("student/rate-course/", formdata).then((res) => {
            fetchCourseDetail();
            // Reset form and edit state after successful submission
            setCreateReview({ rating: 1, review: "" });
            setIsEditingReview(false);
            Toast().fire({
                icon: "success",
                title: "Ulasan berhasil dibuat",
            });
        }).catch((error) => {
            // Check if it's a duplicate review error
            if (error.response?.data?.error?.includes("already reviewed")) {
                Toast().fire({
                    icon: "warning",
                    title: "Anda telah meninjau kursus ini",
                });
            } else {
                Toast().fire({
                    icon: "error",
                    title: "Gagal mengirim ulasan. Silakan coba lagi.",
                });
            }
        });
    };

    const handleUpdateReviewSubmit = (e) => {
        e.preventDefault();

        // Validation
        if (!createReview.review.trim()) {
            Toast().fire({
                icon: "error",
                title: "Silakan tulis ulasan",
            });
            return;
        }

        if (!createReview.rating || createReview.rating < 1 || createReview.rating > 5) {
            Toast().fire({
                icon: "error",
                title: "Silakan pilih rating",
            });
            return;
        }

        const formdata = new FormData();
        formdata.append("course", course.course?.id);
        formdata.append("user", UserData()?.user_id);
        formdata.append("rating", createReview.rating);
        formdata.append("review", createReview.review);

        useAxios.patch(`student/review-detail/${UserData()?.user_id}/${studentReview?.id}/`, formdata).then((res) => {
            fetchCourseDetail();
            // Reset form and exit edit mode
            setCreateReview({ rating: 1, review: "" });
            setIsEditingReview(false);
            Toast().fire({
                icon: "success",
                title: "Ulasan berhasil diperbarui",
            });
        }).catch((error) => {
            Toast().fire({
                icon: "error",
                title: "Gagal memperbarui ulasan. Silakan coba lagi.",
            });
        });
    };

    return (
        <>
            <style>{`
                @keyframes pulse {
                    0% {
                        transform: scale(1);
                        box-shadow: 0 3px 10px rgba(23, 162, 184, 0.3);
                    }
                    50% {
                        transform: scale(1.05);
                        box-shadow: 0 5px 15px rgba(23, 162, 184, 0.5);
                    }
                    100% {
                        transform: scale(1);
                        box-shadow: 0 3px 10px rgba(23, 162, 184, 0.3);
                    }
                }
                .resume-quiz-badge {
                    animation: pulse 2s infinite;
                }
            `}</style>
            
            <BaseHeader />

            {/* Simple loading overlay */}
            {isUpdatingCourse && (
                <div className="loading-overlay">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Memuat...</span>
                    </div>
                </div>
            )}

            <section className="modern-student-course">
                <div className="container">
                    {/* Header Here */}
                    <Header />
                        
                        <div className="row mt-0 md-4">
                            {/* Sidebar Here */}
                            <Sidebar />
                            
                            <div className="col-lg-9 col-md-8 col-12">
                                {/* Course Progress Card */}
                                {isProgressCardLoading ? (
                                    // Skeleton Loading State
                                    <div className="course-progress-card-skeleton">
                                        <div className="progress-content">
                                            <div className="row align-items-center">
                                                <div className="col-md-9 pe-2">
                                                    <div className="skeleton-item skeleton-title mb-3"></div>
                                                    <div className="skeleton-item skeleton-text mb-3"></div>
                                                    <div className="d-flex align-items-center gap-3 flex-wrap">
                                                        <div className="skeleton-item skeleton-badge"></div>
                                                        <div className="skeleton-item skeleton-badge"></div>
                                                        <div className="skeleton-item skeleton-badge"></div>
                                                        <div className="skeleton-item skeleton-badge"></div>
                                                    </div>
                                                </div>
                                                <div className="col-md-3 text-center d-flex align-items-center justify-content-end ps-0">
                                                    <div className="skeleton-item skeleton-circle"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    // Actual Progress Card with Fade-In Animation
                                    <div className="course-progress-card course-progress-card-loaded">
                                        <div className="progress-content">
                                            <div className="row align-items-center">
                                                <div className="col-md-9 pe-2">
                                                    <h2 className="fw-bold mb-2 course-title-animated">{course?.course?.title}</h2>

                                                    {/* ✨ PHASE 7.5j FIX: Display course tags below title */}
                                                    {course?.course?.tags && Array.isArray(course.course.tags) && course.course.tags.length > 0 && (
                                                        <div className="mb-1" data-testid="course-tags-section">
                                                            {course.course.tags.map((tag) => (
                                                                <span 
                                                                    key={tag.id} 
                                                                    className="course-detail-tag-badge"
                                                                >
                                                                    <i className="fas fa-bookmark"></i>
                                                                    {tag.title}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    <p className="opacity-90 mb-3 course-subtitle-animated">
                                                        Lanjutkan perjalanan pembelajaran Anda dan lacak kemajuan Anda
                                                    </p>
                                                    <div className="d-flex align-items-center gap-3 flex-wrap">
                                                        <span className="badge bg-white text-primary px-3 py-2 rounded-pill badge-animated">
                                                            <i className="fas fa-book me-1"></i>
                                                            {completionStats.completedLessons}/{completionStats.totalLessons} Pelajaran
                                                        </span>
                                                        {completionStats.totalQuizzes > 0 && (
                                                            <span className="badge bg-white text-success px-3 py-2 rounded-pill badge-animated">
                                                                <i className="fas fa-brain me-1"></i>
                                                                {completionStats.passedQuizzes}/{completionStats.totalQuizzes} Kuis
                                                            </span>
                                                        )}
                                                        <span className="badge bg-white text-primary px-3 py-2 rounded-pill badge-animated">
                                                            <i className="fas fa-tag me-1"></i>
                                                            {course?.course?.category?.title}
                                                        </span>
                                                        {course?.curriculum && (
                                                            <span className="badge bg-white text-warning px-3 py-2 rounded-pill badge-animated">
                                                                <i className="fas fa-clock me-1"></i>
                                                                {calculateTotalJP(course.curriculum)} JP
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="col-md-3 text-center text-primary d-flex align-items-center justify-content-end ps-0">
                                                    <div 
                                                        className="progress-circle progress-circle-animated"
                                                        style={{"--progress": completionPercentage || 0}}
                                                    >
                                                        <div className="progress-inner">
                                                            <div className="text-center">
                                                                <div className="h3 fw-bold mb-0">{completionPercentage || 0}%</div>
                                                                <small>Selesai</small>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ✨ PHASE 4.224: Certificate Display - appears between progress card and tabs when Sertifikat tab active */}
                                {existingCertificate && existingCertificate.image_file_url && activeTab === 'certificate' && (
                                    <div className="certificate-display">
                                        <img
                                            src={existingCertificate.image_file_url}
                                            alt="Sertifikat"
                                            className="certificate-image"
                                            onError={(e) => {
                                                console.error('❌ Certificate image failed to load:', e);
                                                e.target.style.display = 'none';
                                            }}
                                        />
                                    </div>
                                )}

                                {/* ✨ PHASE 4.225+: Fullscreen Quiz Overlay - black background covering entire page except quiz area */}
                                {/* ✨ PHASE 4.9+: Only show when on Kuis tab */}
                                {isQuizActive && activeTab === 'quiz' && (
                                    <div className="quiz-fullscreen-overlay">
                                        <div className="quiz-overlay-content">
                                            <i className="fas fa-brain quiz-overlay-icon"></i>
                                            <p className="quiz-overlay-text">Sedang mengerjakan kuis...</p>
                                        </div>
                                    </div>
                                )}

                                {/* ✨ PHASE 4.225+: Inline Quiz Display with Start Screen and Active Quiz */}
                                {/* ✨ PHASE 4.9+: Only show when on Kuis tab */}
                                {(quizShow || (isQuizActive && selectedQuiz)) && selectedQuiz && activeTab === 'quiz' && (
                                    <div 
                                        ref={inlineQuizContainerRef}
                                        className={`inline-quiz-fullscreen ${isQuizActive ? 'quiz-active' : ''} ${!isMouseInQuizArea && isQuizActive ? 'quiz-mouse-left' : ''}`}
                                    >
                                        {/* Quiz Start Screen */}
                                        {!isQuizActive && !showQuizResult && selectedQuiz && (
                                            <div className="quiz-start-screen-inline">
                                                <div className="quiz-intro-header">
                                                    <div className="quiz-intro-header-content">
                                                        <div className="quiz-intro-icon-box">
                                                            <i className="fas fa-brain"></i>
                                                        </div>
                                                        <div className="quiz-intro-title-wrapper">
                                                            <h4 className="quiz-intro-title">{selectedQuiz.title}</h4>
                                                            <small className="quiz-intro-description">
                                                                {selectedQuiz.description || "Uji pemahaman Anda tentang materi kursus"}
                                                            </small>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="quiz-intro">
                                                    
                                                    <div className="quiz-info-cards">
                                                        <div className="quiz-info-card">
                                                            <i className="fas fa-question-circle"></i>
                                                            <span className="info-number">{selectedQuiz.total_questions}</span>
                                                            <span className="info-label">Pertanyaan</span>
                                                        </div>
                                                        <div className="quiz-info-card">
                                                            <i className="fas fa-clock"></i>
                                                            <span className="info-number">{selectedQuiz.total_questions}</span>
                                                            <span className="info-label">Menit</span>
                                                        </div>
                                                        <div className="quiz-info-card">
                                                            <i className="fas fa-trophy"></i>
                                                            <span className="info-number">80%</span>
                                                            <span className="info-label">Skor Lulus</span>
                                                        </div>
                                                        <div className="quiz-info-card">
                                                            <i className="fas fa-redo"></i>
                                                            <span className={`info-number ${selectedQuiz.today_attempts >= 3 ? "text-danger" : "text-warning"}`}>
                                                                {selectedQuiz.today_attempts || 0}/3
                                                            </span>
                                                            <span className="info-label">Percobaan Hari Ini</span>
                                                        </div>
                                                    </div>

                                                    {selectedQuiz.today_attempts > 0 && (
                                                        <div className={`quiz-attempt-warning ${selectedQuiz.can_attempt ? "warning" : "danger"}`}>
                                                            <i className={`fas ${selectedQuiz.can_attempt ? "fa-exclamation-triangle" : "fa-ban"} me-2`}></i>
                                                            {selectedQuiz.can_attempt 
                                                                ? `Anda telah menggunakan ${selectedQuiz.today_attempts} dari 3 percobaan harian. ${3 - selectedQuiz.today_attempts} percobaan tersisa.`
                                                                : "Anda telah mencapai batas harian 3 percobaan. Silakan coba lagi besok."
                                                            }
                                                        </div>
                                                    )}

                                                    <div className="quiz-rules">
                                                        <h6>Aturan Kuis:</h6>
                                                        <ul>
                                                            <li>Anda memiliki 1 menit per pertanyaan</li>
                                                            <li>Anda perlu 80% untuk lulus kuis ini</li>
                                                            <li>Anda dapat mencoba kuis ini maksimal 3 kali per hari</li>
                                                            <li>Setelah dimulai, Anda tidak dapat menjeda kuis</li>
                                                        </ul>
                                                    </div>

                                                    <div className="quiz-start-actions">
                                                        <button className="btn btn-secondary" onClick={handleQuizClose}>
                                                            <i className="fas fa-arrow-left me-2"></i>
                                                            Kembali ke Kursus
                                                        </button>
                                                        {selectedQuiz.can_attempt ? (
                                                            <button className="btn btn-primary" onClick={startQuiz}>
                                                                <i className="fas fa-play me-2"></i>
                                                                Mulai Kuis
                                                            </button>
                                                        ) : (
                                                            <button className="btn btn-secondary" disabled>
                                                                <i className="fas fa-ban me-2"></i>
                                                                Batas Harian Tercapai
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Active Quiz Screen */}
                                        {isQuizActive && selectedQuiz && (
                                            <div className="quiz-active-screen-inline">
                                                <div className="quiz-question-progress-bar">
                                                    <div 
                                                        className="quiz-question-progress-fill"
                                                        style={{ width: `${((currentQuestionIndex + 1) / (selectedQuiz.questions?.length || 1)) * 100}%` }}
                                                    ></div>
                                                </div>
                                                <div className="quiz-question-header">
                                                    <div className="quiz-progress-info">
                                                        <div className="question-counter">
                                                            Pertanyaan {currentQuestionIndex + 1} dari {selectedQuiz.questions?.length || 0}
                                                        </div>
                                                        <div className="quiz-timer">
                                                            <i className="fas fa-clock me-2"></i>
                                                            {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, "0")}
                                                        </div>
                                                    </div>
                                                </div>

                                                {selectedQuiz.questions && selectedQuiz.questions[currentQuestionIndex] && (
                                                    <div className="quiz-question-section">
                                                        <div className="question-text">
                                                            {selectedQuiz.questions[currentQuestionIndex].question_text}
                                                        </div>
                                                        
                                                        <div className="quiz-choices">
                                                            {selectedQuiz.questions[currentQuestionIndex].choices?.map((choice) => (
                                                                <div key={choice.choice_id} className="quiz-choice">
                                                                    <label className="quiz-choice-label">
                                                                        <input
                                                                            type="radio"
                                                                            name={`question_${selectedQuiz.questions[currentQuestionIndex].question_id}`}
                                                                            value={choice.choice_id}
                                                                            checked={quizAnswers[selectedQuiz.questions[currentQuestionIndex].question_id] == choice.choice_id}
                                                                            onChange={(e) => {
                                                                                const newAnswers = {
                                                                                    ...quizAnswers,
                                                                                    [selectedQuiz.questions[currentQuestionIndex].question_id]: choice.choice_id
                                                                                };
                                                                                setQuizAnswers(newAnswers);
                                                                                currentQuizStateRef.current.answers = newAnswers;
                                                                                if (isQuizActive && selectedQuiz) {
                                                                                    saveQuizProgress(selectedQuiz, newAnswers, currentQuestionIndex, timeRemaining, quizStartTime);
                                                                                }
                                                                            }}
                                                                        />
                                                                        <span className="quiz-choice-text">{choice.choice_text}</span>
                                                                        <span className="quiz-choice-indicator"></span>
                                                                    </label>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        <div className="quiz-navigation">
                                                            <button 
                                                                className="btn btn-outline-primary"
                                                                onClick={() => {
                                                                    const newIndex = Math.max(0, currentQuestionIndex - 1);
                                                                    setCurrentQuestionIndex(newIndex);
                                                                    currentQuizStateRef.current.questionIndex = newIndex;
                                                                    if (isQuizActive && selectedQuiz) {
                                                                        saveQuizProgress(selectedQuiz, quizAnswers, newIndex, timeRemaining, quizStartTime);
                                                                    }
                                                                }}
                                                                disabled={currentQuestionIndex === 0}
                                                            >
                                                                <i className="fas fa-arrow-left me-2"></i>
                                                                Sebelumnya
                                                            </button>
                                                            
                                                            {currentQuestionIndex < (selectedQuiz.questions?.length || 0) - 1 ? (
                                                                <button 
                                                                    className="btn btn-primary"
                                                                    onClick={() => {
                                                                        const newIndex = currentQuestionIndex + 1;
                                                                        setCurrentQuestionIndex(newIndex);
                                                                        currentQuizStateRef.current.questionIndex = newIndex;
                                                                        if (isQuizActive && selectedQuiz) {
                                                                            saveQuizProgress(selectedQuiz, quizAnswers, newIndex, timeRemaining, quizStartTime);
                                                                        }
                                                                    }}
                                                                >
                                                                    Berikutnya
                                                                    <i className="fas fa-arrow-right ms-2"></i>
                                                                </button>
                                                            ) : (
                                                                <button 
                                                                    className="btn btn-success"
                                                                    onClick={submitQuiz}
                                                                >
                                                                    <i className="fas fa-check me-2"></i>
                                                                    Kirim Kuis
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Quiz Result Screen */}
                                        {showQuizResult && quizResult && (
                                            <div className="quiz-result-screen-inline">
                                                {/* Result Header - Similar structure to quiz-intro-header */}
                                                <div className="quiz-result-header-top">
                                                    <div className="quiz-result-header-content">
                                                        <div className={`quiz-result-icon-box ${quizResult.passed ? "success" : "failure"}`}>
                                                            <i className={`fas ${quizResult.passed ? "fa-trophy" : "fa-times-circle"}`}></i>
                                                        </div>
                                                        <div className="quiz-result-title-wrapper">
                                                            <h4 className="quiz-result-title">{selectedQuiz.title}</h4>
                                                            <small className="quiz-result-description">
                                                                {quizResult.passed ? "Selamat! Anda telah berhasil lulus kuis ini!" : "Teruslah berlatih untuk hasil yang lebih baik"}
                                                            </small>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Result Content - Similar to quiz-intro content area */}
                                                <div className="quiz-result">
                                                    {/* Status Message */}
                                                    <div className="quiz-result-status">
                                                        <h4 className={`quiz-result-status-title ${quizResult.passed ? "text-success" : "text-danger"}`}>
                                                            {quizResult.passed ? "🎉 Selamat!" : "❌ Kuis Gagal"}
                                                        </h4>
                                                        <p className="quiz-result-status-message">
                                                            {quizResult.passed 
                                                                ? "Anda telah berhasil lulus kuis ini!" 
                                                                : "Anda membutuhkan 80% atau lebih untuk lulus. Coba lagi!"}
                                                        </p>
                                                    </div>

                                                    {/* Results Stats - Similar structure to quiz-info-cards */}
                                                    <div className="quiz-result-stats-cards">
                                                        <div className="result-stat-card">
                                                            <i className="fas fa-percent"></i>
                                                            <span className="stat-label">Skor Anda</span>
                                                            <span className={`stat-number ${quizResult.passed ? "text-success" : "text-danger"}`}>
                                                                {Math.round(quizResult.score)}%
                                                            </span>
                                                        </div>
                                                        <div className="result-stat-card">
                                                            <i className="fas fa-check-circle"></i>
                                                            <span className="stat-label">Jawaban Benar</span>
                                                            <span className="stat-number">
                                                                {quizResult.correct_answers}/{quizResult.total_questions}
                                                            </span>
                                                        </div>
                                                        <div className="result-stat-card">
                                                            <i className="fas fa-hourglass-end"></i>
                                                            <span className="stat-label">Waktu yang Digunakan</span>
                                                            <span className="stat-number">
                                                                {(() => {
                                                                    const timeTaken = quizResult.time_taken || 0;
                                                                    const minutes = Math.floor(timeTaken / 60);
                                                                    const seconds = timeTaken % 60;
                                                                    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
                                                                })()}
                                                            </span>
                                                        </div>
                                                        <div className="result-stat-card">
                                                            <i className="fas fa-redo"></i>
                                                            <span className="stat-label">Percobaan Tersisa</span>
                                                            <span className={`stat-number ${quizResult.attempts_left === 0 ? "text-danger" : "text-warning"}`}>
                                                                {quizResult.attempts_left || 0}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Result Summary Info */}
                                                    <div className="quiz-result-summary">
                                                        <i className={`fas ${quizResult.passed ? "fa-lightbulb" : "fa-info-circle"} me-2`}></i>
                                                        <p className="summary-text">
                                                            {quizResult.passed 
                                                                ? "Nilai sempurna! Lanjutkan dengan kuis berikutnya atau review materi untuk pengalaman belajar yang lebih baik."
                                                                : `Anda mendapat ${Math.round(quizResult.score)}%. Coba lagi untuk mencapai skor lulus minimal 80%.`}
                                                        </p>
                                                    </div>

                                                    {/* Result Actions - Similar to quiz-start-actions */}
                                                    <div className="quiz-result-actions">
                                                        <button 
                                                            className="btn btn-secondary"
                                                            onClick={handleQuizClose}
                                                        >
                                                            <i className="fas fa-arrow-left me-2"></i>
                                                            Kembali ke Kursus
                                                        </button>
                                                        {quizResult.attempts_left !== undefined && quizResult.attempts_left > 0 && (
                                                            <button 
                                                                className="btn btn-primary"
                                                                onClick={() => {
                                                                    handleQuizShow(selectedQuiz);
                                                                }}
                                                            >
                                                                <i className="fas fa-redo me-2"></i>
                                                                Coba Lagi
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ✨ PHASE 4.225+: Left Quiz Area Notification */}
                                {isQuizActive && showLeftQuizNotification && (
                                    <div className="left-quiz-notification">
                                        <i className="fas fa-exclamation-circle notification-icon"></i>
                                        <h4 className="notification-title">Peringatan Integritas Kuis</h4>
                                        <p className="notification-message">
                                            Harap tetap fokus pada area kuis. Kembali ke dalam area kuis untuk melanjutkan.
                                        </p>
                                        <p className="notification-subtitle">
                                            Selesaikan kuis dengan integritas diri.
                                        </p>
                                    </div>
                                )}

                                {/* ✨ PHASE 4.86: Inline VideoPlayer - displays when variantItem is selected and certificate tab not active */}
                                {/* ✨ PHASE 4.224: Hide video player when certificate is displayed */}
                                {/* ✨ PHASE 4.225+: Hide video player only when quiz is active AND on quiz tab */}
                                {/* ✨ PHASE 4.9+: Show video player on Pelajaran, Catatan, and Diskusi tabs even if quiz was active */}
                                {/* ✨ PHASE X.X: Wrapped in container div with ref for auto-scroll functionality */}
                                {/* ✨ PHASE 42.6 CRITICAL FIX: Always render VideoPlayer unconditionally, use CSS display to hide
                                    ROOT CAUSE IDENTIFIED: The conditional rendering {variantItem && <VideoPlayer/>} causes unmount/remount on EVERY lesson switch.
                                    This triggers cascading issues:
                                    1. VideoPlayer unmounts when user switches lessons
                                    2. YouTube player destroyed, container removed from DOM
                                    3. YouTube API caches internal references to destroyed DOM nodes
                                    4. VideoPlayer remounts with new lesson
                                    5. New container created, YouTube API accumulates stale cached references
                                    6. By 4th switch: Accumulated stale references cause insertBefore() to fail on stale cached container
                                    
                                    SOLUTION: Render VideoPlayer unconditionally (always mounted).
                                    Use CSS display:none to hide instead of conditional rendering.
                                    This ensures:
                                    - Same VideoPlayer component instance always exists in React tree
                                    - YouTube player ref survives lesson switches
                                    - No unmount/remount cycles
                                    - No stale reference accumulation in YouTube API
                                    - Clean, stable switching between any lesson at any time
                                   */}
                                <div ref={videoPlayerContainerRef} style={{ display: variantItem && !(existingCertificate?.image_file_url && activeTab === 'certificate') && !(activeTab === 'quiz' && (quizShow || isQuizActive)) ? 'block' : 'none' }}>
                                    <VideoPlayer
                                        ref={videoPlayerRef}
                                        variantItem={variantItem}
                                        courseId={course?.course?.id}  // ✨ PHASE 4.144+: Pass courseId for completion endpoint
                                        course={course}  // ✨ PHASE 12.9: Pass full course data so VideoPlayerGoogle can check actual completed_lesson array
                                        onClose={handleVideoPlayerClose}  // ✨ PHASE 17.12 FIX: Use memoized callback instead of inline function
                                        handleMarkLessonAsCompleted={handleMarkLessonAsCompletedCallback}  // ✨ PHASE 4.143+: Use memoized callback
                                        autoplay={autoplayVideo}  // ✨ PHASE 12.15: Enable autoplay when user clicks lesson or on hard refresh
                                        onPlayingChange={setIsVideoPlaying}  // ✨ PHASE 4.105: Track playing state
                                        onProgress={handleVideoProgress}  // ✨ PHASE 4.115: Pass progress callback
                                        seekPosition={seekPosition}  // ✨ PHASE 4.117: Pass seek position for resume
                                    />
                                </div>

                                <div className="modern-tabs">
                                    {/* Tab Navigation */}
                                    <ul className="nav nav-tabs nav-tabs-modern" id="courseTab" role="tablist">
                                        <li className="nav-item" role="presentation">
                                            <button className="nav-link active" id="lectures-tab" data-bs-toggle="tab" data-bs-target="#lectures" type="button" role="tab">
                                                <i className="fas fa-play-circle me-2"></i>Pelajaran
                                            </button>
                                        </li>
                                        <li className="nav-item" role="presentation">
                                            <button className="nav-link" id="notes-tab" data-bs-toggle="tab" data-bs-target="#notes" type="button" role="tab">
                                                <i className="fas fa-sticky-note me-2"></i>Catatan
                                            </button>
                                        </li>
                                        <li className="nav-item" role="presentation">
                                            <button className="nav-link" id="discussions-tab" data-bs-toggle="tab" data-bs-target="#discussions" type="button" role="tab">
                                                <i className="fas fa-comments me-2"></i>Diskusi
                                            </button>
                                        </li>
                                        <li className="nav-item" role="presentation">
                                            <button className="nav-link" id="quiz-tab" data-bs-toggle="tab" data-bs-target="#quiz" type="button" role="tab">
                                                <i className="fas fa-brain me-2"></i>Kuis
                                            </button>
                                        </li>
                                        <li className="nav-item" role="presentation">
                                            <button className="nav-link" id="certificate-tab" data-bs-toggle="tab" data-bs-target="#certificate" type="button" role="tab">
                                                <i className="fas fa-certificate me-2"></i>Sertifikat
                                            </button>
                                        </li>
                                        <li className="nav-item" role="presentation">
                                            <button className="nav-link" id="review-tab" data-bs-toggle="tab" data-bs-target="#review" type="button" role="tab">
                                                <i className="fas fa-star me-2"></i>Ulasan
                                            </button>
                                        </li>
                                    </ul>

                                    {/* Tab Content */}
                                    <div className="tab-content tab-content-modern" id="courseTabContent">
                                        {/* Lectures Tab */}
                                        <LecturesTab
                                            course={course}
                                            enrollmentId={param.enrollment_id}
                                            fetchCourseDetail={fetchCourseDetail}
                                            completionPercentage={completionPercentage}
                                            variantItem={variantItem}
                                            setVariantItem={handlePlayLessonWithAutoplay}  // ✨ PHASE 4.103: Use autoplay handler
                                            isVideoPlaying={isVideoPlaying}  // ✨ PHASE 4.105: Pass video playing state
                                            toggleVideoPlayPause={toggleVideoPlayPause}  // ✨ PHASE 4.105: Pass toggle function
                                            onProgressUpdate={handleProgressUpdateCallback}  // ✨ PHASE 4.132: Use memoized callback
                                            onLessonCompletion={handleLessonCompletionRegistration}  // ✨ PHASE 4.143+: Use memoized callback
                                        />

                                        {/* Notes Tab */}
                                        <div className="tab-pane fade" id="notes" role="tabpanel">
                                            <div className="d-flex justify-content-between align-items-center mb-4">
                                                <h4 className="mb-0">Catatan Saya</h4>
                                                <button 
                                                    className="add-btn-modern" 
                                                    onClick={() => handleNoteShow(null)}
                                                >
                                                    <i className="fas fa-plus"></i>
                                                    Tambah Catatan
                                                </button>
                                            </div>
                                            
                                            {/* ✨ PHASE 11.160: Search and filter controls for notes - same pattern as discussions */}
                                            <div className="mb-4" style={{ display: 'flex', gap: '1rem', flexWrap: 'nowrap', alignItems: 'flex-end' }}>
                                                {/* ✨ PHASE 11.161: Search Input - 25% */}
                                                <div style={{ flex: '1 1 25%' }}>
                                                    <label style={{ display: 'block', fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#2c3e50' }}>
                                                        <i className="fas fa-search" style={{ marginRight: '0.5rem', color: '#0f766e' }}></i>
                                                        Cari Catatan
                                                    </label>
                                                    <input
                                                        type="text"
                                                        placeholder="Cari berdasarkan judul atau isi..."
                                                        value={noteFilters.search}
                                                        onChange={(e) => setNoteFilters({ ...noteFilters, search: e.target.value })}
                                                        style={{
                                                            width: '100%',
                                                            fontSize: '1rem',
                                                            borderRadius: '12px',
                                                            border: '2px solid #e9ecef',
                                                            backgroundColor: '#ffffff',
                                                            color: '#2c3e50',
                                                            boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                                                            padding: '0.75rem 1rem',
                                                            transition: 'all 0.3s ease',
                                                            outline: 'none'
                                                        }}
                                                        onFocus={(e) => {
                                                            e.target.style.borderColor = '#0f766e';
                                                            e.target.style.boxShadow = '0 0 0 3px rgba(52, 152, 219, 0.1)';
                                                        }}
                                                        onBlur={(e) => {
                                                            e.target.style.borderColor = '#e9ecef';
                                                            e.target.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)';
                                                        }}
                                                    />
                                                </div>
                                                
                                                {/* Bagian Filter Dropdown - 20% */}
                                                <div style={{ flex: '1 1 20%' }}>
                                                    <label style={{ display: 'block', fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#2c3e50' }}>
                                                        <i className="fas fa-layer-group" style={{ marginRight: '0.5rem', color: '#0d9488' }}></i>
                                                        Bagian
                                                    </label>
                                                    <select
                                                        value={noteFilters.bagian || ''}
                                                        onChange={(e) => setNoteFilters({ ...noteFilters, bagian: e.target.value || null, pelajaran: null })}
                                                        style={{
                                                            width: '100%',
                                                            fontSize: '1rem',
                                                            borderRadius: '12px',
                                                            border: '2px solid #e9ecef',
                                                            backgroundColor: '#ffffff',
                                                            color: '#2c3e50',
                                                            boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                                                            padding: '0.75rem 1rem',
                                                            transition: 'all 0.3s ease',
                                                            outline: 'none',
                                                            cursor: 'pointer'
                                                        }}
                                                        onFocus={(e) => {
                                                            e.target.style.borderColor = '#0d9488';
                                                            e.target.style.boxShadow = '0 0 0 3px rgba(13, 148, 136, 0.1)';
                                                        }}
                                                        onBlur={(e) => {
                                                            e.target.style.borderColor = '#e9ecef';
                                                            e.target.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)';
                                                        }}
                                                    >
                                                        <option value="">Semua Bagian</option>
                                                        {course?.curriculum?.map((variant) => (
                                                            <option key={variant.variant_id} value={variant.variant_id}>
                                                                {variant.title}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                
                                                {/* Pelajaran Filter Dropdown - 20% */}
                                                <div style={{ flex: '1 1 20%' }}>
                                                    <label style={{ display: 'block', fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#2c3e50' }}>
                                                        <i className="fas fa-book" style={{ marginRight: '0.5rem', color: '#e74c3c' }}></i>
                                                        Pelajaran
                                                    </label>
                                                    <select
                                                        value={noteFilters.pelajaran || ''}
                                                        onChange={(e) => setNoteFilters({ ...noteFilters, pelajaran: e.target.value || null })}
                                                        disabled={!noteFilters.bagian}
                                                        style={{
                                                            width: '100%',
                                                            fontSize: '1rem',
                                                            borderRadius: '12px',
                                                            border: '2px solid #e9ecef',
                                                            backgroundColor: noteFilters.bagian ? '#ffffff' : '#f8f9fa',
                                                            color: '#2c3e50',
                                                            boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                                                            padding: '0.75rem 1rem',
                                                            transition: 'all 0.3s ease',
                                                            outline: 'none',
                                                            cursor: noteFilters.bagian ? 'pointer' : 'not-allowed',
                                                            opacity: noteFilters.bagian ? 1 : 0.6
                                                        }}
                                                        onFocus={(e) => {
                                                            if (noteFilters.bagian) {
                                                                e.target.style.borderColor = '#e74c3c';
                                                                e.target.style.boxShadow = '0 0 0 3px rgba(231, 76, 60, 0.1)';
                                                            }
                                                        }}
                                                        onBlur={(e) => {
                                                            e.target.style.borderColor = '#e9ecef';
                                                            e.target.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)';
                                                        }}
                                                    >
                                                        <option value="">Semua Pelajaran</option>
                                                        {noteFilters.bagian && course?.curriculum?.find(v => v.variant_id === noteFilters.bagian)?.variant_items?.map((item) => (
                                                            <option key={item.variant_item_id} value={item.variant_item_id}>
                                                                {item.title}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                
                                                {/* ✨ PHASE 11.160 FIX: Color Filter Dropdown - 25% */}
                                                <div style={{ flex: '1 1 25%' }}>
                                                    <label style={{ display: 'block', fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem', color: '#2c3e50' }}>
                                                        <i className="fas fa-palette" style={{ marginRight: '0.5rem', color: '#f39c12' }}></i>
                                                        Warna
                                                    </label>
                                                    <select
                                                        value={noteFilters.color || ''}
                                                        onChange={(e) => setNoteFilters({...noteFilters, color: e.target.value || null})}
                                                        className="form-select"
                                                        style={{
                                                            width: '100%',
                                                            fontSize: '0.95rem',
                                                            borderRadius: '12px',
                                                            border: '2px solid #e9ecef',
                                                            backgroundColor: '#ffffff',
                                                            color: '#2c3e50',
                                                            boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                                                            padding: '0.75rem 1rem',
                                                            transition: 'all 0.3s ease',
                                                            outline: 'none',
                                                            cursor: 'pointer'
                                                        }}
                                                        onFocus={(e) => {
                                                            e.target.style.borderColor = '#f39c12';
                                                            e.target.style.boxShadow = '0 0 0 3px rgba(243, 156, 18, 0.1)';
                                                        }}
                                                        onBlur={(e) => {
                                                            e.target.style.borderColor = '#e9ecef';
                                                            e.target.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)';
                                                        }}
                                                    >
                                                        <option value="">Semua Warna</option>
                                                        <option value="#f39c12">🟠 Orange</option>
                                                        <option value="#e74c3c">🔴 Red</option>
                                                        <option value="#0f766e">🔵 Blue</option>
                                                        <option value="#2ecc71">🟢 Green</option>
                                                        <option value="#0d9488">🟣 Teal (Primary)</option>
                                                        <option value="#f1c40f">🟡 Yellow</option>
                                                        <option value="#e67e22">🟠 Dark Orange</option>
                                                        <option value="#95a5a6">⚪ Gray</option>
                                                        <option value="#1abc9c">🔷 Teal</option>
                                                        <option value="#34495e">🔹 Dark Blue</option>
                                                        <option value="#e91e63">💗 Pink</option>
                                                        <option value="#115e59">🟣 Teal Dark</option>
                                                    </select>
                                                </div>
                                                
                                                {/* Clear Filters Button - Fixed to include color */}
                                                {(noteFilters.search || noteFilters.bagian || noteFilters.pelajaran || noteFilters.color) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setNoteFilters({ search: '', bagian: null, pelajaran: null, color: null })}
                                                        className="add-btn-modern"
                                                        style={{ background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)', padding: '0.75rem 1.5rem' }}
                                                    >
                                                        <i className="fas fa-times"></i>
                                                    </button>
                                                )}
                                            </div>
                                            
                                            {/* ✨ PHASE 11.167: 2-Column Grid Layout for Notes (Responsive) */}
                                            <div className="note-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', gridAutoRows: 'max-content' }}>
                                                {filteredNotes?.length > 0 ? (
                                                    filteredNotes.map((n, index) => {
                                                        const noteColor = n.color || "#f39c12";
                                                        const colorVariations = getColorVariations(noteColor);
                                                    
                                                    return (
                                                        <div 
                                                            key={n.id || index} 
                                                            className="note-card"
                                                            onClick={() => {
                                                                // ✨ PHASE 11.163: Add note to openNotes array instead of replacing
                                                                // Check if note already open
                                                                const isAlreadyOpen = openNotes.some(item => item.note.id === n.id);
                                                                if (!isAlreadyOpen) {
                                                                    setOpenNotes([...openNotes, {
                                                                        note: n,
                                                                        position: { x: openNotes.length * 30, y: 60 + openNotes.length * 30 },
                                                                        isEditing: false,
                                                                        editData: n
                                                                    }]);
                                                                }
                                                            }}
                                                            style={{
                                                                "--note-color": noteColor,
                                                                "--note-color-light": colorVariations.light,
                                                                "--note-color-hover": colorVariations.hover,
                                                                borderColor: colorVariations.light,
                                                                cursor: 'pointer',
                                                                transition: 'all 0.3s ease'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                                        >
                                                            <div className="note-header">
                                                                <div className="note-header-content">
                                                                    <div 
                                                                        className="note-icon-wrapper"
                                                                        style={{ 
                                                                            background: `linear-gradient(135deg, ${noteColor} 0%, ${noteColor}dd 100%)`,
                                                                            boxShadow: `0 4px 12px ${colorVariations.shadow}`
                                                                        }}
                                                                    >
                                                                        <i className="fas fa-sticky-note"></i>
                                                                    </div>
                                                                    <div className="note-content-info">
                                                                        <h5 className="note-title">{n.title}</h5>
                                                                        {/* ✨ PHASE 11.161: Show bagian and pelajaran context */}
                                                                        {(n.variant || n.variant_item) && (
                                                                            <div className="note-context">
                                                                                <i className="fas fa-layer-group"></i>
                                                                                {n.variant && <span>{n.variant.title}</span>}
                                                                                {n.variant && n.variant_item && <span style={{ opacity: 0.6 }}>›</span>}
                                                                                {n.variant_item && <span>{n.variant_item.title}</span>}
                                                                            </div>
                                                                        )}
                                                                        <div className="note-date">
                                                                            <i 
                                                                                className="fas fa-calendar-alt"
                                                                                style={{ color: noteColor }}
                                                                            ></i>
                                                                            {moment(n.date).format("MMM DD, YYYY")}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="note-actions">
                                                                    <button 
                                                                        className="btn-note-action edit" 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleNoteShow(n);
                                                                        }}
                                                                        title="Edit catatan"
                                                                    >
                                                                        <i className="fas fa-edit"></i>
                                                                    </button>
                                                                    <button 
                                                                        className="btn-note-action delete" 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDeleteNote(n.id);
                                                                        }}
                                                                        title="Hapus catatan"
                                                                    >
                                                                        <i className="fas fa-trash"></i>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <p 
                                                                className="note-content-text"
                                                                style={{
                                                                    background: `linear-gradient(135deg, ${colorVariations.hover} 0%, ${colorVariations.light} 100%)`,
                                                                    borderColor: colorVariations.light
                                                                }}
                                                            >
                                                                {n.note}
                                                            </p>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <div className="empty-state">
                                                    <i className="fas fa-sticky-note empty-icon"></i>
                                                    <h5>Belum ada catatan</h5>
                                                    <p>Mulai membuat catatan untuk mengingat poin penting</p>
                                                </div>
                                            )}
                                            </div>
                                        </div>

                                        {/* Discussions Tab */}
                                        <div className="tab-pane fade" id="discussions" role="tabpanel">
                                            {/* ✨ PHASE 7.10: Header - shows "Diskusi Kursus" when viewing list, question title when viewing detail */}
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                {!openedQuestionId && (
                                                    <>
                                                        <h4 className="mb-0">Diskusi Kursus</h4>
                                                        <button 
                                                            className="add-btn-modern" 
                                                            onClick={handleQuestionShow}
                                                        >
                                                            <i className="fas fa-plus"></i>
                                                            Ajukan Pertanyaan
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                            
                                            {/* ✨ PHASE 7.10: Inline forum view - show when a question is opened */}
                                            {openedQuestionId && selectedConversation ? (
                                                <div className="forum-thread-container">
                                                    {/* Professional Forum Header */}
                                                    <div className="forum-thread-header">
                                                        <div className="forum-thread-title-area">
                                                            <div className="d-flex align-items-center gap-3">
                                                                <button
                                                                    className="btn btn-outline-primary"
                                                                    onClick={handleConversationClose}
                                                                    style={{ minWidth: '50px', padding: '0.5rem 1rem', flexShrink: 0 }}
                                                                >
                                                                    <i className="fas fa-arrow-left me-2"></i>
                                                                    Kembali
                                                                </button>
                                                                <h2 className="forum-thread-title">
                                                                    {selectedConversation.title || 'Tidak Ada Judul'}
                                                                </h2>
                                                            </div>
                                                        </div>
                                                        {/* ✨ PHASE 7.15: Breadcrumb and Meta in one line */}
                                                        <div className="forum-header-footer">
                                                            <div className="forum-breadcrumb">
                                                                {selectedConversation.variant && (
                                                                    <>
                                                                        <i className="fas fa-folder me-1" style={{ color: '#016b87' }}></i>
                                                                        <span>{selectedConversation.variant.title}</span>
                                                                        {selectedConversation.variant_item && <span className="mx-2">/</span>}
                                                                    </>
                                                                )}
                                                                {selectedConversation.variant_item && (
                                                                    <>
                                                                        <i className="fas fa-file me-1" style={{ color: '#662d91' }}></i>
                                                                        <span>{selectedConversation.variant_item.title}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                            <div className="forum-thread-meta">
                                                                <span className="forum-meta-badge">
                                                                    <i className="fas fa-comments"></i>
                                                                    {selectedConversation.messages?.length || 0} Balasan
                                                                </span>
                                                                <span className="forum-meta-badge">
                                                                    <i className="fas fa-clock"></i>
                                                                    {moment(selectedConversation.date).fromNow()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Original Question Card - Professional Style */}
                                                    <div className="forum-post-card forum-original-post">
{/* Post Header */}
                                                        <div className="forum-post-header">
                                                            <div className="forum-user-info">
                                                                <div className="forum-user-avatar-wrapper">
                                                                    {selectedConversation.profile?.image ? (
                                                                        <img
                                                                            src={selectedConversation.profile.image.startsWith("http") 
                                                                                ? selectedConversation.profile.image 
                                                                                : selectedConversation.profile.image.startsWith("/images/")
                                                                                    ? selectedConversation.profile.image
                                                                                    : getMediaUrl(selectedConversation.profile.image)}
                                                                            alt={selectedConversation.profile?.full_name || "User"}
                                                                            className="forum-user-avatar"
                                                                            onError={(e) => {
                                                                                e.target.style.display = "none";
                                                                                e.target.nextSibling.style.display = "flex";
                                                                            }}
                                                                        />
                                                                    ) : null}
                                                                    <div 
                                                                        className="forum-user-avatar-placeholder"
                                                                        style={{ display: selectedConversation.profile?.image ? "none" : "flex" }}
                                                                    >
                                                                        <i className="fas fa-user"></i>
                                                                    </div>
                                                                </div>
                                                                <div className="forum-user-details">
                                                                    <div className="forum-user-name">
                                                                        {selectedConversation.profile?.full_name || 'Pengguna Anonim'}
                                                                        <span className="forum-user-badge-asker">Penanya</span>
                                                                        {/* ✨ PHASE 7.23: Show "Anda" badge if user created this question */}
                                                                        {(selectedConversation?.user_id === UserData()?.user_id) || 
                                                                         (selectedConversation?.profile?.user_id === UserData()?.user_id) ? (
                                                                            <span className="forum-user-badge-current">Anda</span>
                                                                        ) : null}
                                                                        {/* ✨ PHASE 7.22: Fix teacher path - nested at course.course?.teacher, not course.teacher */}
                                                                        {course?.course?.teacher && (
                                                                            (selectedConversation?.user_id === course.course.teacher.user_id) ||
                                                                            (selectedConversation?.profile?.user_id === course.course.teacher.user_id)
                                                                        ) && (
                                                                            <span className="forum-user-badge-instructor" title="Instruktur Kursus">
                                                                                <i className="fas fa-chalkboard-user"></i>
                                                                                Instruktur
                                                                            </span>
                                                                        )}
                                                                        {/* ✨ PHASE 7.16: Show "Reported" badge if current user has reported this question */}
                                                                        {isQAItemReported(selectedConversation.qa_id) && (
                                                                            <span className="forum-user-badge-reported">
                                                                                <i className="fas fa-flag me-1"></i>
                                                                                Sudah Dilaporkan
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="forum-user-timestamp">
                                                                        <i className="fas fa-clock-o me-1"></i>
                                                                        {moment(selectedConversation.date).format("DD MMM YYYY [pada] HH:mm")}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Post Content */}
                                                        <div className="forum-post-content">
                                                            {selectedConversation.message || (selectedConversation.messages?.[0]?.message) || 'Tidak ada pesan'}
                                                        </div>

                                                        {/* Post Footer with Like and Report Button */}
                                                        <div className="forum-post-footer">
                                                            <div className="forum-post-actions">
                                                                <button 
                                                                    className="forum-like-btn" 
                                                                    title={userLikedQuestions.has(selectedConversation.qa_id) ? "Batalkan suka" : "Sukai pertanyaan ini"}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleLikeQuestion(selectedConversation);
                                                                    }}
                                                                    style={userLikedQuestions.has(selectedConversation.qa_id) ? { color: '#ff4757' } : {}}
                                                                >
                                                                    <i className={userLikedQuestions.has(selectedConversation.qa_id) ? "fas fa-heart" : "far fa-heart"}></i>
                                                                    <span className="like-count">{selectedConversation.likes_count || 0}</span>
                                                                </button>
                                                                {(() => {
                                                                    const reportStatus = getQAReportStatus(selectedConversation.qa_id, 'question');
                                                                    return (
                                                                        <button 
                                                                            className="forum-report-btn" 
                                                                            title={reportStatus ? `Laporan: ${reportStatus.status}` : "Laporkan pertanyaan ini"}
                                                                            onClick={() => handleOpenQAReportModal(selectedConversation, 'question')}
                                                                            style={reportStatus ? { color: '#d32f2f', opacity: 0.8 } : {}}
                                                                        >
                                                                            <i className="fas fa-flag"></i>
                                                                            {reportStatus && (
                                                                                <span style={{ marginLeft: '0.25rem', fontSize: '0.7rem' }}>✓</span>
                                                                            )}
                                                                        </button>
                                                                    );
                                                                })()}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Replies Section */}
                                                    {selectedConversation.messages && selectedConversation.messages.length > 0 && (
                                                        <div className="forum-replies-section">
                                                            <div className="forum-replies-list">
                                                                {selectedConversation.messages.slice(1).map((msg, index) => {  /* ✨ PHASE 7.16: Skip first message (original question) */
                                                                    const currentUser = UserData();
                                                                    // ✨ PHASE 7.16: Better current user detection
                                                                    const isCurrentUser = msg.profile?.user_id === currentUser?.user_id || 
                                                                                        (msg.user_id && msg.user_id === currentUser?.user_id);
                                                                    // Check if this reply is from the course instructor
                                                                    const isInstructor = course?.course?.teacher && (
                                                                        msg.user_id === course.course.teacher.user_id ||
                                                                        msg.profile?.user_id === course.course.teacher.user_id
                                                                    );
                                                                    // ✨ DEBUG: Log instructor badge comparison for ALL messages
                                                                    console.log(`[CourseDetail.Forum] Message ${index + 1}:`, {
                                                                        msg_user_id: msg.user_id,
                                                                        msg_profile_user_id: msg.profile?.user_id,
                                                                        teacher_user_id: course?.course?.teacher?.user_id,
                                                                        msg_profile: msg.profile,
                                                                        course_teacher: course?.course?.teacher,
                                                                        isInstructor: isInstructor,
                                                                        comparison1: msg.user_id === course?.course?.teacher?.user_id,
                                                                        comparison2: msg.profile?.user_id === course?.course?.teacher?.user_id,
                                                                    });
                                                                    return (
                                                                        <div key={msg.id || `message-${index}`} className="forum-post-card forum-reply-post">
                                                                            {/* Reply Header */}
                                                                            <div className="forum-post-header">
                                                                                <div className="forum-user-info">
                                                                                    <div className="forum-user-avatar-wrapper">
                                                                                        {msg.profile?.image ? (
                                                                                            <img
                                                                                                src={msg.profile.image.startsWith("http") 
                                                                                                    ? msg.profile.image 
                                                                                                    : msg.profile.image.startsWith("/images/")
                                                                                                        ? msg.profile.image
                                                                                                        : getMediaUrl(msg.profile.image)}
                                                                                                alt={`${msg.profile?.full_name || "User"} avatar`}
                                                                                                className="forum-user-avatar"
                                                                                                onError={(e) => {
                                                                                                    e.target.style.display = "none";
                                                                                                    e.target.nextSibling.style.display = "flex";
                                                                                                }}
                                                                                            />
                                                                                        ) : null}
                                                                                        <div 
                                                                                            className="forum-user-avatar-placeholder"
                                                                                            style={{ display: msg.profile?.image ? "none" : "flex" }}
                                                                                        >
                                                                                            <i className="fas fa-user"></i>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="forum-user-details">
                                                                                        <div className="forum-user-name">
                                                                                            {msg.profile?.full_name || 'Pengguna Anonim'}
                                                                                            {isInstructor && (
                                                                                                <span className="forum-user-badge-instructor" title="Instruktur Kursus">
                                                                                                    <i className="fas fa-chalkboard-user"></i>
                                                                                                    Instruktur
                                                                                                </span>
                                                                                            )}
                                                                                            {isCurrentUser && <span className="forum-user-badge-current">Anda</span>}
                                                                                            {/* ✨ PHASE 7.16: Show "Reported" badge if current user has reported this message */}
                                                                                            {isQAItemReported(msg.qa_id) && (
                                                                                                <span className="forum-user-badge-reported">
                                                                                                    <i className="fas fa-flag me-1"></i>
                                                                                                    Sudah Dilaporkan
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                        <div className="forum-user-timestamp">
                                                                                            <i className="fas fa-clock-o me-1"></i>
                                                                                            {moment(msg.date).format("DD MMM YYYY [pada] HH:mm")}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            {/* Reply Content */}
                                                                            <div className="forum-post-content">
                                                                                {msg.message}
                                                                            </div>

                                                                            {/* Post Footer with Like and Report Button */}
                                                                            <div className="forum-post-footer">
                                                                                <div className="forum-post-actions">
                                                                                    <button 
                                                                                        className="forum-like-btn" 
                                                                                        title={userLikedMessages.has(msg.id) ? "Batalkan suka" : "Sukai jawaban ini"}
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            handleLikeMessage(msg);
                                                                                        }}
                                                                                        style={userLikedMessages.has(msg.id) ? { color: '#ff4757' } : {}}
                                                                                    >
                                                                                        <i className={userLikedMessages.has(msg.id) ? "fas fa-heart" : "far fa-heart"}></i>
                                                                                        <span className="like-count">{msg.likes_count || 0}</span>
                                                                                    </button>
                                                                                    {(() => {
                                                                                        const reportStatus = getQAReportStatus(msg.qa_id, 'message');
                                                                                        return (
                                                                                            <button 
                                                                                                className="forum-report-btn" 
                                                                                                title={reportStatus ? `Laporan: ${reportStatus.status}` : "Laporkan jawaban ini"}
                                                                                                onClick={() => handleOpenQAMessageReportModal(msg)}
                                                                                                style={reportStatus ? { color: '#d32f2f', opacity: 0.8 } : {}}
                                                                                            >
                                                                                                <i className="fas fa-flag"></i>
                                                                                                {reportStatus && (
                                                                                                    <span style={{ marginLeft: '0.25rem', fontSize: '0.7rem' }}>✓</span>
                                                                                                )}
                                                                                            </button>
                                                                                        );
                                                                                    })()}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}

                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* No Replies State */}
                                                    {(!selectedConversation.messages || selectedConversation.messages.length === 0) && (
                                                        <div className="forum-no-replies">
                                                            <div className="forum-empty-state">
                                                                <i className="fas fa-comment-dots"></i>
                                                                <h4>Belum ada balasan</h4>
                                                                <p>Jadilah yang pertama memberikan balasan untuk pertanyaan ini!</p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Reply Form Section */}
                                                    <div className="forum-reply-section">
                                                        <h3 className="forum-reply-section-title">
                                                            <i className="fas fa-edit me-2"></i>Berikan Balasan Anda
                                                        </h3>
                                                        <form onSubmit={sendNewMessage} className="forum-reply-form">
                                                            <div className="forum-form-group">
                                                                <textarea 
                                                                    name="message" 
                                                                    className="forum-reply-textarea"
                                                                    placeholder="Tulis balasan Anda di sini... Jelaskan dengan detail untuk memberikan nilai maksimal kepada komunitas."
                                                                    rows="6"
                                                                    onChange={handleMessageChange}
                                                                    value={createMessage.message}
                                                                    required
                                                                />
                                                            </div>
                                                            <div className="forum-form-actions">
                                                                <p className="forum-form-hint">
                                                                        <i className="fas fa-info-circle me-1"></i>Formulir Markdown didukung. Pastikan kode Anda diformat dengan benar.
                                                                </p>
                                                                <div className="forum-action-buttons">
                                                                    
                                                                    <button 
                                                                        type="submit"
                                                                        className="forum-btn-primary"
                                                                    >
                                                                        <i className="fas fa-paper-plane me-2"></i>Kirim Balasan
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </form>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    {/* ✨ PHASE 7.9-7.10: Filter controls - Search and dropdowns with proportional widths */}
                                                    <div className="mb-4" style={{ display: 'flex', gap: '1rem', flexWrap: 'nowrap', alignItems: 'flex-end' }}>
                                                        {/* Search Input - 50% */}
                                                        <div style={{ flex: '1 1 50%' }}>
                                                            <label style={{ display: 'block', fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#2c3e50' }}>
                                                                <i className="fas fa-search" style={{ marginRight: '0.5rem', color: '#0f766e' }}></i>
                                                                Cari Pertanyaan
                                                            </label>
                                                            <input
                                                                type="text"
                                                                placeholder="Cari berdasarkan judul atau isi..."
                                                                value={discussionFilters.search}
                                                                onChange={(e) => setDiscussionFilters({ ...discussionFilters, search: e.target.value })}
                                                                style={{
                                                                    width: '100%',
                                                                    fontSize: '1rem',
                                                                    borderRadius: '12px',
                                                                    border: '2px solid #e9ecef',
                                                                    backgroundColor: '#ffffff',
                                                                    color: '#2c3e50',
                                                                    boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                                                                    padding: '0.75rem 1rem',
                                                                    transition: 'all 0.3s ease',
                                                                    outline: 'none'
                                                                }}
                                                                onFocus={(e) => {
                                                                    e.target.style.borderColor = '#0f766e';
                                                                    e.target.style.boxShadow = '0 0 0 3px rgba(52, 152, 219, 0.1)';
                                                                }}
                                                                onBlur={(e) => {
                                                                    e.target.style.borderColor = '#e9ecef';
                                                                    e.target.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)';
                                                                }}
                                                            />
                                                        </div>
                                                        
                                                        {/* Bagian Filter Dropdown - 25% */}
                                                        <div style={{ flex: '1 1 25%' }}>
                                                            <label style={{ display: 'block', fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#2c3e50' }}>
                                                                <i className="fas fa-layer-group" style={{ marginRight: '0.5rem', color: '#0d9488' }}></i>
                                                                Bagian
                                                            </label>
                                                            <select
                                                                value={discussionFilters.bagian || ''}
                                                                onChange={(e) => setDiscussionFilters({ ...discussionFilters, bagian: e.target.value || null, pelajaran: null })}
                                                                style={{
                                                                    width: '100%',
                                                                    fontSize: '1rem',
                                                                    borderRadius: '12px',
                                                                    border: '2px solid #e9ecef',
                                                                    backgroundColor: '#ffffff',
                                                                    color: '#2c3e50',
                                                                    boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                                                                    padding: '0.75rem 1rem',
                                                                    transition: 'all 0.3s ease',
                                                                    outline: 'none',
                                                                    cursor: 'pointer'
                                                                }}
                                                                onFocus={(e) => {
                                                                    e.target.style.borderColor = '#0d9488';
                                                                    e.target.style.boxShadow = '0 0 0 3px rgba(13, 148, 136, 0.1)';
                                                                }}
                                                                onBlur={(e) => {
                                                                    e.target.style.borderColor = '#e9ecef';
                                                                    e.target.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)';
                                                                }}
                                                            >
                                                                <option value="">Semua Bagian</option>
                                                                {course?.curriculum?.map((variant) => (
                                                                    <option key={variant.variant_id} value={variant.variant_id}>
                                                                        {variant.title}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        
                                                        {/* Pelajaran Filter Dropdown - 25% */}
                                                        <div style={{ flex: '1 1 25%' }}>
                                                            <label style={{ display: 'block', fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#2c3e50' }}>
                                                                <i className="fas fa-book" style={{ marginRight: '0.5rem', color: '#e74c3c' }}></i>
                                                                Pelajaran
                                                            </label>
                                                            <select
                                                                value={discussionFilters.pelajaran || ''}
                                                                onChange={(e) => setDiscussionFilters({ ...discussionFilters, pelajaran: e.target.value || null })}
                                                                disabled={!discussionFilters.bagian}
                                                                style={{
                                                                    width: '100%',
                                                                    fontSize: '1rem',
                                                                    borderRadius: '12px',
                                                                    border: '2px solid #e9ecef',
                                                                    backgroundColor: discussionFilters.bagian ? '#ffffff' : '#f8f9fa',
                                                                    color: '#2c3e50',
                                                                    boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                                                                    padding: '0.75rem 1rem',
                                                                    transition: 'all 0.3s ease',
                                                                    outline: 'none',
                                                                    cursor: discussionFilters.bagian ? 'pointer' : 'not-allowed',
                                                                    opacity: discussionFilters.bagian ? 1 : 0.6
                                                                }}
                                                                onFocus={(e) => {
                                                                    if (discussionFilters.bagian) {
                                                                        e.target.style.borderColor = '#e74c3c';
                                                                        e.target.style.boxShadow = '0 0 0 3px rgba(231, 76, 60, 0.1)';
                                                                    }
                                                                }}
                                                                onBlur={(e) => {
                                                                    e.target.style.borderColor = '#e9ecef';
                                                                    e.target.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)';
                                                                }}
                                                            >
                                                                <option value="">Semua Pelajaran</option>
                                                                {discussionFilters.bagian && course?.curriculum?.find(v => v.variant_id === discussionFilters.bagian)?.variant_items?.map((item) => (
                                                                    <option key={item.variant_item_id} value={item.variant_item_id}>
                                                                        {item.title}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        
                                                        {/* Clear Filters Button */}
                                                        {(discussionFilters.search || discussionFilters.bagian || discussionFilters.pelajaran) && (
                                                            <button
                                                                onClick={() => setDiscussionFilters({ search: '', bagian: null, pelajaran: null })}
                                                                className="add-btn-modern"
                                                                style={{ background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)', padding: '0.75rem 1.5rem' }}
                                                            >
                                                                <i className="fas fa-times"></i>Bersihkan Filter
                                                            </button>
                                                        )}
                                                    </div>
                                                    
                                                    {filteredQuestions?.length > 0 ? (
                                                        filteredQuestions.map((q, index) => (
                                                            <div 
                                                                key={q.qa_id || index} 
                                                                className="question-card"
                                                                onClick={() => handleConversationShow(q)}
                                                            >
                                                                {/* Top section: Title on left, Badges on right */}
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem'}}>
                                                                    {/* Header row - title with avatar */}
                                                                    <div className="question-header">
                                                                        <img
                                                                            src={q.profile?.image?.startsWith("http") 
                                                                                ? q.profile.image 
                                                                                : q.profile?.image?.startsWith("/images/")
                                                                                    ? q.profile.image
                                                                                    : getMediaUrl(q.profile?.image || '')}
                                                                            alt={q.profile?.full_name || "User"}
                                                                            className="avatar-modern"
                                                                            onError={(e) => {
                                                                                e.target.style.display = "none";
                                                                            }}
                                                                            style={{ display: q.profile?.image ? 'block' : 'none' }}
                                                                        />
                                                                        {!q.profile?.image && (
                                                                            <div style={{
                                                                                width: '60px',
                                                                                height: '60px',
                                                                                borderRadius: '50%',
                                                                                backgroundColor: '#e8f4f8',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                                flexShrink: 0,
                                                                                border: '3px solid white',
                                                                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                                                            }}>
                                                                                <i className="fas fa-user" style={{ color: '#016b87', fontSize: '1.5rem' }}></i>
                                                                            </div>
                                                                        )}
                                                                        
                                                                        <div className="question-content">
                                                                            <h5 className="question-title">{q.title || 'Tidak Ada Judul'}</h5>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    {/* Context badges on right */}
                                                                    {(q.variant || q.variant_item) && (
                                                                        <div style={{ 
                                                                            display: 'flex', 
                                                                            gap: '0.75rem',
                                                                            flexWrap: 'wrap',
                                                                            justifyContent: 'flex-end',
                                                                            flexShrink: 0
                                                                        }}>
                                                                            {q.variant && (
                                                                                <span style={{
                                                                                    backgroundColor: '#e8f4f8',
                                                                                    color: '#016b87',
                                                                                    padding: '0.4rem 0.9rem',
                                                                                    borderRadius: '12px',
                                                                                    fontSize: '0.9rem',
                                                                                    fontWeight: 600,
                                                                                    border: '1px solid #a8d8dc',
                                                                                    whiteSpace: 'nowrap',
                                                                                    display: 'inline-block'
                                                                                }}>
                                                                                    <i className="fas fa-layer-group" style={{ marginRight: '0.4rem' }}></i>{q.variant.title}
                                                                                </span>
                                                                            )}
                                                                            {q.variant_item && (
                                                                                <span style={{
                                                                                    backgroundColor: '#f0e8f4',
                                                                                    color: '#662d91',
                                                                                    padding: '0.4rem 0.9rem',
                                                                                    borderRadius: '12px',
                                                                                    fontSize: '0.9rem',
                                                                                    fontWeight: 600,
                                                                                    border: '1px solid #d4b5e0',
                                                                                    whiteSpace: 'nowrap',
                                                                                    display: 'inline-block'
                                                                                }}>
                                                                                    <i className="fas fa-book" style={{ marginRight: '0.4rem' }}></i>{q.variant_item.title}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                
                                                                {/* Message preview - MAX 2 LINES */}
                                                                {(q.message || (q.messages && q.messages[0]?.message)) && (
                                                                    <p className="question-message-preview">
                                                                        {(q.message || q.messages?.[0]?.message || 'Tidak ada pesan').substring(0, 200)}
                                                                        {(q.message || q.messages?.[0]?.message || '').length > 200 ? '...' : ''}
                                                                    </p>
                                                                )}
                                                                
                                                                {/* Meta information at bottom - Replies badge first, like button on right */}
                                                                <div className="question-meta" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e9ecef', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                                                                        <span className="question-meta-item">
                                                                            <span className="replies-badge">
                                                                                <i className="fas fa-comments" style={{ marginRight: '0.5rem' }}></i>
                                                                                {q.messages?.length || 0} Balasan
                                                                            </span>
                                                                        </span>
                                                                        <span className="question-meta-item">
                                                                            <i className="fas fa-user" style={{ marginRight: '0.5rem', color: '#0f766e' }}></i>
                                                                            {q.profile?.full_name || 'Anonim'}
                                                                        </span>
                                                                        <span className="question-meta-item">
                                                                            <i className="fas fa-clock" style={{ marginRight: '0.5rem', color: '#f39c12' }}></i>
                                                                            {moment(q.date).fromNow()}
                                                                        </span>
                                                                    </div>
                                                                    {/* ✨ PHASE 7.16+: Like and Report buttons on question card - Enhanced with status */}
                                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                        <button 
                                                                            className="forum-like-btn" 
                                                                            title={userLikedQuestions.has(q.qa_id) ? "Batalkan suka" : "Sukai pertanyaan ini"} 
                                                                            onClick={(e) => { e.stopPropagation(); handleLikeQuestion(q); }}
                                                                            style={userLikedQuestions.has(q.qa_id) ? { color: '#ff4757' } : {}}
                                                                        >
                                                                            <i className={userLikedQuestions.has(q.qa_id) ? "fas fa-heart" : "far fa-heart"}></i>
                                                                            <span className="like-count">{q.likes_count || 0}</span>
                                                                        </button>
                                                                        {(() => {
                                                                            const reportStatus = getQAReportStatus(q.qa_id, 'question');
                                                                            return (
                                                                                <button 
                                                                                    className="forum-report-btn" 
                                                                                    title={reportStatus ? `Laporan: ${reportStatus.status}` : "Laporkan pertanyaan ini"}
                                                                                    onClick={(e) => { e.stopPropagation(); handleOpenQAReportModal(q, 'question'); }}
                                                                                    style={reportStatus ? { color: '#d32f2f', opacity: 0.8 } : {}}
                                                                                >
                                                                                    <i className={reportStatus ? "fas fa-flag" : "fas fa-flag"}></i>
                                                                                    {reportStatus && (
                                                                                        <span style={{ marginLeft: '0.25rem', fontSize: '0.7rem' }}>✓</span>
                                                                                    )}
                                                                                </button>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="empty-state">
                                                            <i className="fas fa-comments empty-icon"></i>
                                                            <h5>Belum ada diskusi</h5>
                                                            <p>Jadilah yang pertama mengajukan pertanyaan atau memulai diskusi</p>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        {/* Quiz Tab */}
                                        <div className="tab-pane fade" id="quiz" role="tabpanel">
                                            <div className="d-flex justify-content-between align-items-center mb-4">
                                                <h4 className="mb-0">Kuis Kursus</h4>
                                                {quizzes.length > 0 && (
                                                    <div className="quiz-summary">
                                                        <span className="badge bg-primary px-3 py-2 rounded-pill">
                                                            <i className="fas fa-brain me-1"></i>
                                                            {quizzes.length} Kuis Tersedia
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {quizzes.length > 0 ? (
                                                <div className="row">
                                                    {quizzes.map((quiz, index) => (
                                                        <div key={quiz.quiz_id} className="col-lg-4 col-md-6 mb-4">
                                                            <div className="student-quiz-card">
                                                                {hasQuizProgress(quiz) && (
                                                                    <div className="resume-quiz-badge">
                                                                        <i className="fas fa-play-circle me-1"></i>
                                                                        Resume
                                                                    </div>
                                                                )}
                                                                <div className="student-quiz-card-header">
                                                                    <div className="student-quiz-icon-wrapper">
                                                                        <i className="fas fa-brain text-white"></i>
                                                                    </div>
                                                                    <div className="quiz-header-content">
                                                                        <h1 className="student-quiz-title">{quiz.title}</h1>
                                                                        <p className="student-quiz-description">{quiz.description || "Uji pemahaman Anda tentang materi kursus ini"}</p>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="student-quiz-stats">
                                                                    <div className="row text-center">
                                                                        <div className="col-4">
                                                                            <div className="student-stat-item">
                                                                                <i className="fas fa-question-circle text-primary"></i>
                                                                                <span className="student-stat-number">{quiz.total_questions}</span>
                                                                                <span className="student-stat-label">Pertanyaan</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="col-4">
                                                                            <div className="student-stat-item">
                                                                                <i className="fas fa-clock text-warning"></i>
                                                                                <span className="student-stat-number">{quiz.total_questions}</span>
                                                                                <span className="student-stat-label">Menit</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="col-4">
                                                                            <div className="student-stat-item">
                                                                                <i className="fas fa-trophy text-success"></i>
                                                                                <span className="student-stat-number">{Math.round(quiz.best_score || 0)}%</span>
                                                                                <span className="student-stat-label">Terbaik</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="quiz-progress">
                                                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                                                        <span className="progress-label">
                                                                            {hasQuizProgress(quiz) ? (
                                                                                <span className="text-info">
                                                                                    <i className="fas fa-play-circle me-1"></i>
                                                                                    Siap Dilanjutkan
                                                                                </span>
                                                                            ) : quiz.is_passed ? (
                                                                                <span className="text-success">
                                                                                    <i className="fas fa-check-circle me-1"></i>
                                                                                    Lulus
                                                                                </span>
                                                                            ) : quiz.best_score > 0 ? (
                                                                                <span className="text-warning">
                                                                                    <i className="fas fa-exclamation-triangle me-1"></i>
                                                                                    Perlu Ditingkatkan
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-muted">
                                                                                    <i className="fas fa-clock me-1"></i>
                                                                                    Belum Dicoba
                                                                                </span>
                                                                            )}
                                                                        </span>
                                                                        <span className="attempts-counter">
                                                                            <i className="fas fa-redo me-1"></i>
                                                                            {quiz.today_attempts}/3 percobaan hari ini
                                                                        </span>
                                                                    </div>
                                                                    <div className="progress quiz-progress-bar">
                                                                        <div 
                                                                            className={`progress-bar ${quiz.is_passed ? "bg-info" : "bg-warning"}`}
                                                                            style={{width: `${quiz.best_score || 0}%`}}
                                                                        ></div>
                                                                    </div>
                                                                    <small className="text-muted">Skor minimum untuk lulus: 80%</small>
                                                                </div>

                                                                <div className="student-quiz-actions">
                                                                    {quiz.can_attempt ? (
                                                                        <button 
                                                                            className="btn btn-primary w-100"
                                                                            onClick={() => handleQuizShow(quiz)}
                                                                        >
                                                                            {(() => {
                                                                                if (hasQuizProgress(quiz)) {
                                                                                    return (
                                                                                        <>
                                                                                            <i className="fas fa-play-circle me-2"></i>
                                                                                            Lanjutkan Kuis
                                                                                        </>
                                                                                    );
                                                                                } else if (quiz.best_score > 0) {
                                                                                    return (
                                                                                        <>
                                                                                            <i className="fas fa-redo me-2"></i>
                                                                                            Coba Lagi
                                                                                        </>
                                                                                    );
                                                                                } else {
                                                                                    return (
                                                                                        <>
                                                                                            <i className="fas fa-play me-2"></i>
                                                                                            Mulai Kuis
                                                                                        </>
                                                                                    );
                                                                                }
                                                                            })()}
                                                                        </button>
                                                                    ) : (
                                                                        <div className="quiz-daily-limit-disabled">
                                                                            <div className="quiz-limit-disabled-badge">
                                                                                <i className="fas fa-ban"></i>
                                                                                <span>Batas Harian (3/3)</span>
                                                                            </div>
                                                                            <div className="quiz-limit-tooltip">
                                                                                <div className="quiz-tooltip-icon">
                                                                                    <i className="fas fa-exclamation-circle"></i>
                                                                                </div>
                                                                                <p className="quiz-tooltip-text">Anda telah menggunakan semua 3 kesempatan percobaan untuk hari ini.</p>
                                                                                <p className="quiz-tooltip-text">Silakan coba lagi besok. Terus semangat! 💪</p>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="empty-state">
                                                    <i className="fas fa-brain empty-icon"></i>
                                                    <h5>Tidak ada kuis yang tersedia</h5>
                                                    <p>Kuis akan muncul di sini setelah ditambahkan ke kursus</p>
                                                </div>
                                            )}
                                        </div>

                                        
                                        {/* Certificate Tab */}
                                        <CertificateTab 
                                            course={course}
                                            enrollmentId={param.enrollment_id}
                                            completionPercentage={completionPercentage}
                                            onCertificateGenerated={(cert) => setExistingCertificate(cert)}
                                        />

                                        {/* Review Tab */}
                                        <div className="tab-pane fade" id="review" role="tabpanel">
                                            <h4 className="mb-4">Ulasan Kursus</h4>
                                            
                                            {studentReview ? (
                                                !isEditingReview ? (
                                                    <div className="review-card-modern">
                                                        <div className="d-flex justify-content-between align-items-start mb-3">
                                                            <h5 className="mb-0">Ulasan Anda</h5>
                                                            <div className="d-flex gap-2">
                                                                <button 
                                                                    className="btn btn-primary btn-sm"
                                                                    onClick={handleEditReview}
                                                                    title="Edit ulasan Anda"
                                                                >
                                                                    <i className="fas fa-edit me-1"></i>
                                                                    Edit
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="star-rating mb-3 d-flex align-items-center justify-content-between">
                                                            <div className="d-flex align-items-center">
                                                                {[...Array(5)].map((_, i) => (
                                                                    <i key={i} className={`fas fa-star ${i < studentReview.rating ? "text-warning" : "text-muted"}`}></i>
                                                                ))}
                                                                <span className="ms-2">({studentReview.rating}/5)</span>
                                                            </div>
                                                            <small className="text-muted">
                                                                Diulas pada {moment(studentReview.date).format("DD MMM YYYY")}
                                                            </small>
                                                        </div>
                                                        <p className="mb-3">{studentReview.review}</p>
                                                        
                                                        {/* Teacher/Instructor Reply Section */}
                                                        {studentReview.reply ? (
                                                            <div className="instructor-reply-section mt-4 mb-0">
                                                                <div className="instructor-reply-header mb-2 d-flex align-items-center gap-2">
                                                                    <div className="reply-badge">
                                                                        <i className="fas fa-reply me-1"></i>
                                                                        <small>Balasan</small>
                                                                    </div>
                                                                    <div className="d-flex align-items-center gap-2 justify-content-end flex-grow-1">
                                                                        <div className="flex-grow-1">
                                                                            <h4 className="mb-0 instructor-name text-primary text-end">
                                                                                {course.course?.teacher?.full_name || "Instruktur Kursus"}
                                                                            </h4>
                                                                            <small className="text-muted d-block text-end">Balasan dari Instruktur</small>
                                                                        </div>
                                                                        <div className="instructor-avatar">
                                                                            <i className="fas fa-chalkboard-teacher"></i>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="instructor-reply-content">
                                                                    <p className="mb-0 text-end">{studentReview.reply}</p>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="no-reply-section mt-4">
                                                                <div className="d-flex align-items-center justify-content-center text-muted">
                                                                    <i className="fas fa-hourglass-half me-2"></i>
                                                                    <small>Menunggu balasan dari instruktur...</small>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="review-card-modern">
                                                        <h5 className="mb-3">Edit Ulasan Anda</h5>
                                                        <form onSubmit={handleUpdateReviewSubmit}>
                                                            <div className="mb-3">
                                                                <label className="form-label">Rating</label>
                                                                <div className="star-rating">
                                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                                        <i 
                                                                            key={star}
                                                                            className={`fas fa-star cursor-pointer ${star <= createReview.rating ? "text-warning" : "text-muted"}`}
                                                                            onClick={() => setCreateReview({...createReview, rating: star})}
                                                                        ></i>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <div className="mb-3">
                                                                <label className="form-label">Ulasan Anda</label>
                                                                <textarea
                                                                    name="review"
                                                                    value={createReview.review}
                                                                    onChange={handleReviewChange}
                                                                    className="form-control form-control-modern"
                                                                    rows="4"
                                                                    placeholder="Bagikan pemikiran Anda tentang kursus ini..."
                                                                ></textarea>
                                                            </div>
                                                            <div className="review-edit-actions d-flex gap-2">
                                                                <button 
                                                                    type="button" 
                                                                    className="btn btn-secondary"
                                                                    onClick={handleCancelEditReview}
                                                                >
                                                                    <i className="fas fa-times me-2"></i>
                                                                    Batal
                                                                </button>
                                                                <button 
                                                                    type="submit" 
                                                                    className="add-btn-modern"
                                                                    disabled={!createReview.review.trim() || !createReview.rating}
                                                                >
                                                                    <i className="fas fa-save me-2"></i>
                                                                    Perbarui Ulasan
                                                                </button>
                                                            </div>
                                                        </form>
                                                    </div>
                                                )
                                            ) : (
                                                <div className="review-card-modern">
                                                    <h5 className="mb-3">Beri Rating Kursus Ini</h5>
                                                    <form onSubmit={handleCreateReviewSubmit}>
                                                        <div className="mb-0">
                                                            <label className="form-label">Rating</label>
                                                            <div className="star-rating">
                                                                {[1, 2, 3, 4, 5].map((star) => (
                                                                    <i 
                                                                        key={star}
                                                                        className={`fas fa-star cursor-pointer ${star <= createReview.rating ? "text-warning" : "text-muted"}`}
                                                                        onClick={() => setCreateReview({...createReview, rating: star})}
                                                                    ></i>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div className="mb-3">
                                                            <label className="form-label">Ulasan Anda</label>
                                                            <textarea
                                                                name="review"
                                                                value={createReview.review}
                                                                onChange={handleReviewChange}
                                                                className="form-control form-control-modern"
                                                                rows="4"
                                                                placeholder="Bagikan pemikiran Anda tentang kursus ini..."
                                                            ></textarea>
                                                        </div>
                                                        <button 
                                                            type="submit" 
                                                            className="add-btn-modern"
                                                            disabled={!createReview.review.trim() || !createReview.rating}
                                                        >
                                                            <i className="fas fa-star me-2"></i>
                                                            Kirim Ulasan
                                                        </button>
                                                    </form>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

            {/* Add Note Modal */}
            <Modal 
                show={noteShow} 
                onHide={handleNoteClose} 
                size="lg"
                backdrop={false}
                keyboard={true}
                className="add-note-modal"
            >
              <form onSubmit={(e) => {
                  if (selectedNote) {
                      handleSubmitEditNote(e, selectedNote.id);
                  } else {
                      handleSubmitCreateNote(e);
                  }
              }}>
                {/* Modal Header */}
                <div  
                    className="modal-header-note modal-header-dynamic note-modal-header-draggable"
                    style={{ 
                        background: `linear-gradient(135deg, ${selectedNoteColor} 0%, ${selectedNoteColor}dd 100%)`,
                        cursor: 'grab'
                    }}
                >
                    <div className="modal-header-content">
                        <div className="modal-header-info">
                            <div 
                                className="modal-icon-wrapper note-icon-wrapper-dynamic"
                                style={{ 
                                    background: "rgba(255, 255, 255, 0.2)",
                                    border: "2px solid rgba(255, 255, 255, 0.3)" 
                                }}
                            >
                                <i className="fas fa-sticky-note"></i>
                            </div>
                            <div className="modal-title-section">
                                <h4 className="modal-title-modern">
                                    {selectedNote ? "Edit Catatan Kursus" : "Tambah Catatan Kursus"}
                                </h4>
                                <p className="modal-subtitle">
                                    {selectedNote ? "Perbarui catatan Anda dengan wawasan baru" : "Tangkap wawasan penting dan poin utama dari kursus ini"}
                                </p>
                            </div>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        className="btn-close-modern" 
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleNoteClose();
                        }}
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                {/* Modal Body */}
                <div className="modal-body-modern">
                    <div className="note-form">
                        {/* Note Title */}
                        <div className="form-group-modern">
                            <label className="form-label-modern">
                                <i className="fas fa-heading form-label-icon-note"></i>
                                Judul Catatan
                                <span className="required-indicator">*</span>
                            </label>
                            <div className="input-wrapper-modern">
                                <input
                                    type="text"
                                    name="title"
                                    className="form-input-modern form-input-note"
                                    placeholder="Berikan judul yang deskriptif untuk catatan Anda..."
                                    value={createNote.title}
                                    onChange={handleNoteChange}
                                    required
                                />
                            </div>
                        </div>

                        {/* ✨ PHASE 11.160: Bagian/Section Context (Optional) */}
                        <div className="form-group-modern">
                            <label className="form-label-modern">
                                <i className="fas fa-layer-group form-label-icon-note"></i>
                                Bagian/Pelajaran (Opsional)
                            </label>
                            <div className="input-wrapper-modern">
                                <select
                                    className="form-input-modern"
                                    value={currentNoteVariantContext?.variant_item_id || ''}
                                    onChange={(e) => {
                                        const selected = e.target.value;
                                        if (selected) {
                                            // Find the variant_item from curriculum
                                            let foundVariantItem = null;
                                            course?.curriculum?.forEach(variant => {
                                                (variant.variant_items || variant.items || []).forEach(item => {
                                                    if (item.variant_item_id === selected) {
                                                        // ✨ PHASE 11.161 FIX: Ensure we're using variant_id, not id
                                                        foundVariantItem = {
                                                            variant_item_id: item.variant_item_id,
                                                            title: item.title,
                                                            variant_id: variant.variant_id || variant.id,  // Use variant_id first, fallback to id
                                                            variant_title: variant.title
                                                        };
                                                    }
                                                });
                                            });
                                            setCurrentNoteVariantContext(foundVariantItem);
                                        } else {
                                            setCurrentNoteVariantContext(null);
                                        }
                                    }}
                                    style={{
                                        backgroundColor: '#ffffff',
                                        borderRadius: '8px',
                                        padding: '0.75rem 1rem'
                                    }}
                                >
                                    <option value="">-- Pilih Bagian/Pelajaran (Opsional) --</option>
                                    {course?.curriculum?.map((variant) => (
                                        <optgroup key={variant.variant_id} label={variant.title}>
                                            {(variant.variant_items || variant.items || []).map((item) => (
                                                <option key={item.variant_item_id} value={item.variant_item_id}>
                                                    {item.title}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>
                            {currentNoteVariantContext && (
                                <small style={{ color: '#666', marginTop: '0.5rem', display: 'block' }}>
                                    <i className="fas fa-check-circle" style={{ color: '#27ae60', marginRight: '0.3rem' }}></i>
                                    Catatan akan terhubung dengan: <strong>{currentNoteVariantContext.variant_title}</strong> &gt; <strong>{currentNoteVariantContext.title}</strong>
                                </small>
                            )}
                        </div>

                        {/* Note Content */}
                        <div className="form-group-modern">
                            <label className="form-label-modern">
                                <i className="fas fa-edit form-label-icon-note"></i>
                                Konten Catatan
                                <span className="required-indicator">*</span>
                            </label>
                            <div className="textarea-wrapper-modern">
                                <textarea
                                    name="note"
                                    className="form-textarea-modern form-textarea-note"
                                    rows="5"
                                    placeholder="Tulis isi catatan Anda di sini. Sertakan konsep kunci, wawasan, atau poin penting dari kursus..."
                                    value={createNote.note}
                                    onChange={handleNoteChange}
                                    required
                                />
                                <div className="character-counter">
                                    {(createNote.note || "").length}/2000 karakter
                                </div>
                            </div>
                        </div>

                        {/* Color Picker */}
                        <div className="form-group-modern">
                            <label className="color-picker-label">
                                <i className="fas fa-palette form-label-icon-note"></i>
                                Pilih Warna Catatan
                            </label>
                            
                            {/* Color Preview */}
                            <div className="color-preview-section">
                                <div className="color-preview-label">
                                    Pratinjau Warna Terpilih:
                                </div>
                                <div 
                                    className="color-preview-demo"
                                    style={{
                                        background: `linear-gradient(135deg, ${selectedNoteColor} 0%, ${selectedNoteColor}dd 100%)`,
                                        padding: "1rem",
                                        borderRadius: "12px",
                                        color: "white",
                                        textAlign: "center",
                                        fontWeight: "600",
                                        boxShadow: `0 4px 15px ${getColorVariations(selectedNoteColor).shadow}`
                                    }}
                                >
                                    <i className="fas fa-sticky-note me-2"></i>
                                    Inilah cara catatan Anda akan terlihat
                                </div>
                            </div>
                            
                            <div className="color-picker-grid">
                                {[
                                    { color: "#f39c12", name: "Orange" },
                                    { color: "#e74c3c", name: "Red" },
                                    { color: "#0f766e", name: "Blue" },
                                    { color: "#2ecc71", name: "Green" },
                                    { color: "#0d9488", name: "Teal" },
                                    { color: "#f1c40f", name: "Yellow" },
                                    { color: "#e67e22", name: "Dark Orange" },
                                    { color: "#95a5a6", name: "Gray" },
                                    { color: "#1abc9c", name: "Teal Light" },
                                    { color: "#34495e", name: "Dark Blue" },
                                    { color: "#e91e63", name: "Pink" },
                                    { color: "#115e59", name: "Teal Dark" }
                                ].map((colorOption) => (
                                    <div
                                        key={colorOption.color}
                                        className={`color-option ${selectedNoteColor === colorOption.color ? "selected" : ""}`}
                                        style={{ backgroundColor: colorOption.color }}
                                        onClick={() => {
                                            handleColorChange(colorOption.color);
                                            // Trigger handleNoteChange to update the color in createNote state
                                            handleNoteChange({
                                                target: {
                                                    name: "color",
                                                    value: colorOption.color
                                                }
                                            });
                                        }}
                                        title={colorOption.name}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Tips Section */}
                        <div className="tips-section">
                            <div className="tips-header">
                                <i className="fas fa-lightbulb tips-icon"></i>
                                <span>Tips untuk pembuatan catatan yang efektif</span>
                            </div>
                            <ul className="tips-list">
                                <li><i className="fas fa-check"></i>Sertakan cap waktu spesifik untuk referensi video</li>
                                <li><i className="fas fa-check"></i>Ringkas konsep kunci dengan kata-kata Anda sendiri</li>
                                <li><i className="fas fa-check"></i>Catat aplikasi praktis dan contoh</li>
                                <li><i className="fas fa-check"></i>Tambahkan wawasan pribadi dan refleksi</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="modal-footer-modern">
                    <div className="footer-actions">
                        <button 
                            type="button" 
                            className="btn-cancel-modern" 
                            onClick={handleNoteClose}
                        >
                            <i className="fas fa-times"></i>
                            <span>Cancel</span>
                        </button>
                        <button 
                            type="submit"
                            className="btn-submit-note"
                            disabled={!createNote.title?.trim() || !createNote.note?.trim()}
                            style={{
                                background: `linear-gradient(135deg, ${selectedNoteColor} 0%, ${selectedNoteColor}dd 100%)`,
                                boxShadow: `0 4px 15px ${getColorVariations(selectedNoteColor).shadow}`,
                                transition: "all 0.3s ease"
                            }}
                            onMouseEnter={(e) => {
                                if (!e.target.disabled) {
                                    const variations = getColorVariations(selectedNoteColor);
                                    e.target.style.boxShadow = `0 8px 25px ${variations.shadow}`;
                                    e.target.style.transform = "translateY(-2px)";
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!e.target.disabled) {
                                    const variations = getColorVariations(selectedNoteColor);
                                    e.target.style.boxShadow = `0 4px 15px ${variations.shadow}`;
                                    e.target.style.transform = "translateY(0)";
                                }
                            }}
                            // onClick={
                            //   (selectedNote ? (e) => handleSubmitEditNote(e, selectedNote.id) : handleSubmitCreateNote)
                            // } // Call appropriate handler
                        >
                            <i className="fas fa-save"></i>
                            {selectedNote ? "Update Note" : "Save Note"}
                        </button>
                    </div>
                </div>
                </form>

                {/* ✨ PHASE 11.160 FIX: Resize handle for note modal - same as question modal */}
                <div className="modal-resize-handle" title="Drag to resize modal"></div>
            </Modal>

            {/* ✨ PHASE 11.164 REFACTOR: Multiple floating note cards with extracted component - fixes React hooks violation */}
            <FloatingNoteCardsContainer 
                openNotes={openNotes}
                setOpenNotes={setOpenNotes}
                param={param}
                fetchCourseDetail={fetchCourseDetail}
            />

            {/* ✨ PHASE 7.12: Create Question Modal - Draggable & Resizable with transparent backdrop */}
            <Modal 
                show={addQuestionShow} 
                onHide={handleQuestionClose} 
                size="lg"
                backdrop={false}
                keyboard={true}
                className="create-question-modal"
            >
                {/* Modal Header */}
                <form onSubmit={handleSaveQuestion}>
                <div className="modal-header-modern">
                    <div className="modal-header-content">
                        <div className="modal-header-info">
                            <div className="modal-icon-wrapper">
                                <i className="fas fa-question-circle"></i>
                            </div>
                            <div className="modal-title-section">
                                <h4 className="modal-title-modern">Ajukan Pertanyaan</h4>
                                <p className="modal-subtitle">
                                    Bagikan pertanyaan Anda dengan komunitas kursus dan dapatkan jawaban ahli
                                    <br />
                                    <span style={{ fontSize: '0.8rem', color: '#6c757d', marginTop: '0.25rem', display: 'inline-block' }}>
                                        <i className="fas fa-arrows-alt me-1"></i>
                                        Drag dialog by header to move it
                                    </span>
                                </p>
                            </div>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        className="btn-close-modern" 
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleQuestionClose();
                        }}
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                {/* Modal Body */}
                <div className="modal-body-modern">
                    <div className="question-form">
                        {/* Question Title */}
                        <div className="form-group-modern">
                            <label className="form-label-modern">
                                <i className="fas fa-heading form-label-icon"></i>
                                Judul Pertanyaan
                                <span className="required-indicator">*</span>
                            </label>
                            <div className="input-wrapper-modern">
                                <input
                                    type="text"
                                    name="title"
                                    className="form-input-modern"
                                    placeholder="Tulis judul yang jelas dan deskriptif untuk pertanyaan Anda..."
                                    value={createMessage.title}
                                    onChange={handleMessageChange}
                                    required
                                />
                            </div>
                        </div>

                        {/* ✨ PHASE 7.9: Context selector - choose which lesson this question is about */}
                        <div className="form-group-modern">
                            <label className="form-label-modern">
                                <i className="fas fa-layer-group form-label-icon"></i>
                                Bagian/Pelajaran (Opsional)
                            </label>
                            <div className="input-wrapper-modern">
                                <select
                                    className="form-input-modern"
                                    value={currentVariantContext?.variant_item_id || ''}
                                    onChange={(e) => {
                                        const selected = e.target.value;
                                        if (selected) {
                                            // Find the variant_item from curriculum
                                            let foundVariantItem = null;
                                            course?.curriculum?.forEach(variant => {
                                                (variant.variant_items || variant.items || []).forEach(item => {
                                                    if (item.variant_item_id === selected) {
                                                        foundVariantItem = {
                                                            variant_item_id: item.variant_item_id,
                                                            title: item.title,
                                                            variant_id: variant.variant_id,
                                                            variant_title: variant.title
                                                        };
                                                    }
                                                });
                                            });
                                            setCurrentVariantContext(foundVariantItem);
                                        } else {
                                            setCurrentVariantContext(null);
                                        }
                                    }}
                                    style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid #ddd' }}
                                >
                                    <option value="">-- Pilih Bagian/Pelajaran (opsional) --</option>
                                    {course?.curriculum?.map((variant) => (
                                        <optgroup key={variant.variant_id} label={variant.title}>
                                            {(variant.variant_items || variant.items || []).map((item) => (
                                                <option key={item.variant_item_id} value={item.variant_item_id}>
                                                    {item.title}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Question Message */}
                        <div className="form-group-modern">
                            <label className="form-label-modern">
                                <i className="fas fa-edit form-label-icon"></i>
                                Detail Pertanyaan
                                <span className="required-indicator">*</span>
                            </label>
                            <div className="textarea-wrapper-modern">
                                <textarea
                                    ref={questionTextareaRef}
                                    name="message"
                                    className="form-textarea-modern"
                                    rows="4"
                                    placeholder="Berikan informasi detail tentang pertanyaan Anda. Semakin banyak konteks yang Anda berikan, semakin baik jawaban yang akan Anda terima..."
                                    value={createMessage.message}
                                    onChange={handleMessageChange}
                                    required
                                />
                                <div className="character-counter">
                                    {createMessage.message?.length || 0}/2000 karakter
                                </div>
                            </div>
                        </div>

                        {/* Tips Section */}
                        <div className="tips-section">
                            <div className="tips-header">
                                <i className="fas fa-lightbulb tips-icon"></i>
                                <span>Tips untuk mendapatkan jawaban yang lebih baik</span>
                            </div>
                            <ul className="tips-list">
                                <li><i className="fas fa-check"></i>Jadilah spesifik dan jelas dalam pertanyaan Anda</li>
                                <li><i className="fas fa-check"></i>Sertakan konteks dan contoh yang relevan</li>
                                <li><i className="fas fa-check"></i>Rujuk konten kursus spesifik atau cap waktu</li>
                                <li><i className="fas fa-check"></i>Cari pertanyaan yang ada sebelum memposting</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="modal-footer-modern">
                    <div className="footer-actions">
                        <button 
                            type="button" 
                            className="btn-cancel-modern" 
                            onClick={handleQuestionClose}
                        >
                            <i className="fas fa-times"></i>
                            <span>Batal</span>
                        </button>
                        <button 
                            type="submit"
                            className="btn-submit-modern"
                            disabled={!createMessage.title?.trim() || !createMessage.message?.trim()}
                        >
                            <i className="fas fa-paper-plane"></i>
                            Ajukan Pertanyaan
                        </button>
                    </div>
                </div>
                </form>

                {/* ✨ PHASE 7.12: Resize handle - bottom-right corner diamond for resizing */}
                <div className="modal-resize-handle" title="Drag to resize modal"></div>
            </Modal>

            {/* ✨ PHASE 7.10: Conversation Modal - HIDDEN (now using inline forum view in Diskusi tab) */}
            {/* Modal removed and replaced with inline forum container */}

            {/* ✨ PHASE 4.225+: Quiz Modal - HIDDEN (quiz now displayed inline) */}
            <Modal 
                show={false}
                onHide={isQuizActive ? null : handleQuizClose} 
                size="lg" 
                centered 
                backdrop={isQuizActive ? "static" : true}
                keyboard={isQuizActive ? false : true}
            >
                {/* Debug section - remove in production */}
                {process.env.NODE_ENV === "development" && (
                    <div className="quiz-debug-info">
                        Quiz Debug: Active={isQuizActive ? "Yes" : "No"} | 
                        Questions={selectedQuiz?.questions?.length || 0} | 
                        CurrentQ={currentQuestionIndex} |
                        ShowResult={showQuizResult ? "Yes" : "No"}
                    </div>
                )}
                
                <div className="quiz-modal-header">
                    <div className="quiz-modal-title">
                        <i className="fas fa-brain me-3"></i>
                        {selectedQuiz?.title}
                    </div>
                    {!isQuizActive && (
                        <button type="button" className="quiz-modal-close" onClick={handleQuizClose}>
                            <i className="fas fa-times"></i>
                        </button>
                    )}
                    {isQuizActive && (
                        <div className="quiz-modal-close disabled" title="Cannot close during active quiz">
                            <i className="fas fa-lock"></i>
                        </div>
                    )}
                </div>
                
                {!isQuizActive && !showQuizResult && selectedQuiz && (
                    <div className="quiz-start-screen">
                        <div className="quiz-intro">
                            <div className="quiz-intro-icon">
                                <i className="fas fa-brain"></i>
                            </div>
                            <h4>{selectedQuiz.title}</h4>
                            <p className="quiz-intro-description">
                                {selectedQuiz.description || "Uji pemahaman Anda tentang materi kursus"}
                            </p>
                            
                            <div className="quiz-info-cards">
                                <div className="quiz-info-card">
                                    <i className="fas fa-question-circle"></i>
                                    <span className="info-number">{selectedQuiz.total_questions}</span>
                                    <span className="info-label">Pertanyaan</span>
                                </div>
                                <div className="quiz-info-card">
                                    <i className="fas fa-clock"></i>
                                    <span className="info-number">{selectedQuiz.total_questions}</span>
                                    <span className="info-label">Menit</span>
                                </div>
                                <div className="quiz-info-card">
                                    <i className="fas fa-trophy"></i>
                                    <span className="info-number">80%</span>
                                    <span className="info-label">Skor Lulus</span>
                                </div>
                                <div className="quiz-info-card">
                                    <i className="fas fa-redo"></i>
                                    <span className={`info-number ${selectedQuiz.today_attempts >= 3 ? "text-danger" : "text-warning"}`}>
                                        {selectedQuiz.today_attempts || 0}/3
                                    </span>
                                    <span className="info-label">Percobaan Hari Ini</span>
                                </div>
                            </div>

                            {/* Attempt Status Warning */}
                            {selectedQuiz.today_attempts > 0 && (
                                <div className={`quiz-attempt-warning ${selectedQuiz.can_attempt ? "warning" : "danger"}`}>
                                    <i className={`fas ${selectedQuiz.can_attempt ? "fa-exclamation-triangle" : "fa-ban"} me-2`}></i>
                                    {selectedQuiz.can_attempt 
                                        ? `Anda telah menggunakan ${selectedQuiz.today_attempts} dari 3 percobaan harian. ${3 - selectedQuiz.today_attempts} percobaan${3 - selectedQuiz.today_attempts !== 1 ? "" : ""} tersisa.`
                                        : "Anda telah mencapai batas harian 3 percobaan. Silakan coba lagi besok."
                                    }
                                </div>
                            )}

                            <div className="quiz-rules">
                                <h6>Aturan Kuis:</h6>
                                <ul>
                                    <li>Anda memiliki 1 menit per pertanyaan</li>
                                    <li>Anda perlu 80% untuk lulus kuis ini</li>
                                    <li>Anda dapat mencoba kuis ini maksimal 3 kali per hari</li>
                                    <li>Setelah dimulai, Anda tidak dapat menjeda kuis</li>
                                </ul>
                            </div>

                            <div className="quiz-start-actions">
                                <button className="btn btn-secondary" onClick={handleQuizClose}>
                                    <i className="fas fa-arrow-left me-2"></i>
                                    Kembali ke Kursus
                                </button>
                                {selectedQuiz.can_attempt ? (
                                    <button className="btn btn-primary" onClick={startQuiz}>
                                        <i className="fas fa-play me-2"></i>
                                        Mulai Kuis
                                    </button>
                                ) : (
                                    <button className="btn btn-secondary" disabled>
                                        <i className="fas fa-ban me-2"></i>
                                        Batas Harian Tercapai
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {isQuizActive && selectedQuiz && (
                    <div className="quiz-active-screen">
                        <div className="quiz-question-progress-bar">
                                <div 
                                    className="quiz-question-progress-fill"
                                    style={{ width: `${((currentQuestionIndex + 1) / (selectedQuiz.questions?.length || 1)) * 100}%` }}
                                ></div>
                        </div>
                        <div className="quiz-question-header">
                            
                            <div className="quiz-progress-info">
                                <div className="question-counter">
                                    Pertanyaan {currentQuestionIndex + 1} dari {selectedQuiz.questions?.length || 0}
                                </div>
                                <div className="quiz-timer">
                                    <i className="fas fa-clock me-2"></i>
                                    {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, "0")}
                                </div>
                            </div>
                        </div>

                        {selectedQuiz.questions && selectedQuiz.questions[currentQuestionIndex] && (
                            <div className="quiz-question-section">
                                <div className="question-text">
                                    {selectedQuiz.questions[currentQuestionIndex].question_text}
                                </div>
                                
                                <div className="quiz-choices">
                                    {selectedQuiz.questions[currentQuestionIndex].choices?.map((choice) => (
                                        <div key={choice.choice_id} className="quiz-choice">
                                            <label className="quiz-choice-label">
                                                <input
                                                    type="radio"
                                                    name={`question_${selectedQuiz.questions[currentQuestionIndex].question_id}`}
                                                    value={choice.choice_id}
                                                    checked={quizAnswers[selectedQuiz.questions[currentQuestionIndex].question_id] == choice.choice_id}
                                                    onChange={(e) => {
                                                        // Update quiz answers
                                                        const newAnswers = {
                                                            ...quizAnswers,
                                                            [selectedQuiz.questions[currentQuestionIndex].question_id]: choice.choice_id
                                                        };
                                                        setQuizAnswers(newAnswers);
                                                        
                                                        // Update ref for timer access
                                                        currentQuizStateRef.current.answers = newAnswers;
                                                        
                                                        // Save progress immediately when answer changes
                                                        if (isQuizActive && selectedQuiz) {
                                                            saveQuizProgress(selectedQuiz, newAnswers, currentQuestionIndex, timeRemaining, quizStartTime);
                                                        }
                                                    }}
                                                />
                                                <span className="quiz-choice-text">{choice.choice_text}</span>
                                                <span className="quiz-choice-indicator"></span>
                                            </label>
                                        </div>
                                    ))}
                                </div>

                                <div className="quiz-navigation">
                                    <button 
                                        className="btn btn-outline-primary"
                                        onClick={() => {
                                            const newIndex = Math.max(0, currentQuestionIndex - 1);
                                            setCurrentQuestionIndex(newIndex);
                                            
                                            // Update ref
                                            currentQuizStateRef.current.questionIndex = newIndex;
                                            
                                            // Save progress when navigating
                                            if (isQuizActive && selectedQuiz) {
                                                saveQuizProgress(selectedQuiz, quizAnswers, newIndex, timeRemaining, quizStartTime);
                                            }
                                        }}
                                        disabled={currentQuestionIndex === 0}
                                    >
                                        <i className="fas fa-arrow-left me-2"></i>
                                        Sebelumnya
                                    </button>
                                    
                                    {currentQuestionIndex < (selectedQuiz.questions?.length || 0) - 1 ? (
                                        <button 
                                            className="btn btn-primary"
                                            onClick={() => {
                                                const newIndex = currentQuestionIndex + 1;
                                                setCurrentQuestionIndex(newIndex);
                                                
                                                // Update ref
                                                currentQuizStateRef.current.questionIndex = newIndex;
                                                
                                                // Save progress when navigating
                                                if (isQuizActive && selectedQuiz) {
                                                    saveQuizProgress(selectedQuiz, quizAnswers, newIndex, timeRemaining, quizStartTime);
                                                }
                                            }}
                                        >
                                            Berikutnya
                                            <i className="fas fa-arrow-right ms-2"></i>
                                        </button>
                                    ) : (
                                        <button 
                                            className="btn btn-success"
                                            onClick={submitQuiz}
                                        >
                                            <i className="fas fa-check me-2"></i>
                                            Kirim Kuis
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {showQuizResult && quizResult && (
                    <div className="quiz-result-screen">
                        <div className="quiz-result-header">
                            <div className={`quiz-result-icon ${quizResult.passed ? "success" : "failure"}`}>
                                <i className={`fas ${quizResult.passed ? "fa-trophy" : "fa-times-circle"}`}></i>
                            </div>
                            <h4 className={`quiz-result-title ${quizResult.passed ? "text-success" : "text-danger"}`}>
                                {quizResult.passed ? "Selamat!" : "Kuis Gagal"}
                            </h4>
                            <p className="quiz-result-message">
                                {quizResult.passed 
                                    ? "Anda telah berhasil lulus kuis!" 
                                    : "Anda membutuhkan 80% atau lebih untuk lulus. Coba lagi!"}
                            </p>
                        </div>

                        <div className="quiz-result-stats">
                            <div className="result-stat">
                                <span className="student-stat-label">Skor Anda</span>
                                <span className={`stat-value ${quizResult.passed ? "text-success" : "text-danger"}`}>
                                    {Math.round(quizResult.score)}%
                                </span>
                            </div>
                            <div className="result-stat">
                                <span className="student-stat-label">Jawaban Benar</span>
                                <span className="stat-value">
                                    {quizResult.correct_answers}/{quizResult.total_questions}
                                </span>
                            </div>
                            <div className="result-stat">
                                <span className="student-stat-label">Waktu yang Digunakan</span>
                                <span className="stat-value">
                                    {(() => {
                                        const timeTaken = quizResult.time_taken || 0;
                                        const minutes = Math.floor(timeTaken / 60);
                                        const seconds = timeTaken % 60;
                                        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
                                    })()}
                                </span>
                            </div>
                            <div className="result-stat">
                                <span className="student-stat-label">Percobaan Hari Ini</span>
                                <span className={`stat-value ${quizResult.attempts_left === 0 ? "text-danger" : "text-warning"}`}>
                                    {quizResult.today_attempts || 0}/{quizResult.max_daily_attempts || 3}
                                </span>
                            </div>
                            {(quizResult.attempts_left !== undefined && quizResult.attempts_left > 0) && (
                                <div className="result-stat">
                                    <span className="student-stat-label">Percobaan Tersisa</span>
                                    <span className="stat-value text-info">
                                        {quizResult.attempts_left}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Attempt Status Alert */}
                        {!quizResult.passed && (
                            <div className={`attempt-status-alert ${quizResult.can_attempt ? "alert-warning" : "alert-danger"}`}>
                                <i className={`fas ${quizResult.can_attempt ? "fa-exclamation-triangle" : "fa-ban"} me-2`}></i>
                                {quizResult.can_attempt 
                                    ? `Anda memiliki ${quizResult.attempts_left} percobaan${quizResult.attempts_left !== 1 ? "" : ""} tersisa hari ini. Anda perlu 80% untuk lulus.`
                                    : "Batas harian tercapai! Anda dapat mencoba lagi besok. (3 percobaan per hari)"
                                }
                            </div>
                        )}

                        <div className="quiz-result-actions">
                            <button className="btn btn-secondary" onClick={handleQuizClose}>
                                <i className="fas fa-arrow-left me-2"></i>
                                Kembali ke Kursus
                            </button>
                            {!quizResult.passed && quizResult.can_attempt && (
                                <button className="btn btn-primary" onClick={startQuiz}>
                                    <i className="fas fa-redo me-2"></i>
                                    Coba Lagi ({quizResult.attempts_left} tersisa)
                                </button>
                            )}
                            {!quizResult.passed && !quizResult.can_attempt && (
                                <button className="btn btn-secondary" disabled>
                                    <i className="fas fa-ban me-2"></i>
                                    Batas Harian Tercapai
                                </button>
                            )}
                            {quizResult.passed && (
                                <button className="btn btn-success" onClick={handleQuizClose}>
                                    <i className="fas fa-check me-2"></i>
                                    Kuis Lulus!
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            {/* ✨ PHASE 7.16: Q&A Report Modal - Modeled after ReviewAbuse report system */}
            {/* ✨ PHASE 7.16+: Enhanced Q&A Report Modal - Shows feedback if report exists, form if not */}
            {showQAReportModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content abuse-report-modal">
                            <div className="modal-header abuse-modal-header">
                                <h5 className="modal-title">
                                    {currentReportData ? (
                                        <>
                                            <i className="fas fa-file-check me-2"></i>
                                            Status Laporan {reportingQAType === 'message' ? 'Balasan' : 'Pertanyaan'}
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-exclamation-triangle me-2"></i>
                                            Laporkan {reportingQAType === 'message' ? 'Balasan' : 'Pertanyaan'}
                                        </>
                                    )}
                                </h5>
                                <button 
                                    type="button" 
                                    className="btn-close" 
                                    onClick={handleCloseQAReportModal}
                                    disabled={reportingQA}
                                ></button>
                            </div>
                            <div className="modal-body">
                                {/* ✨ PHASE 7.16+: Show existing report feedback if available, unless editing */}
                                {currentReportData && !editingReportId ? (
                                    <>
                                        {/* Report Status Section */}
                                        <div className="mb-0">
                                            <div className="d-flex align-items-center gap-2 mb-0">
                                                <span className="fw-semibold">Status Laporan:</span>
                                                {currentReportData.status === 'pending' && (
                                                    <span className="badge bg-warning">
                                                        <i className="fas fa-hourglass-half me-1"></i>
                                                        Menunggu Tinjauan
                                                    </span>
                                                )}
                                                {currentReportData.status === 'reviewed' && (
                                                    <span className="badge bg-info">
                                                        <i className="fas fa-eye me-1"></i>
                                                        Sudah Ditinjau
                                                    </span>
                                                )}
                                                {currentReportData.status === 'action_taken' && (
                                                    <span className="badge bg-success">
                                                        <i className="fas fa-check-circle me-1"></i>
                                                        Tindakan Diambil
                                                    </span>
                                                )}
                                                {currentReportData.status === 'dismissed' && (
                                                    <span className="badge bg-secondary">
                                                        <i className="fas fa-times-circle me-1"></i>
                                                        Ditolak
                                                    </span>
                                                )}
                                            </div>

                                            <div>
                                            {/* Report Details */}
                                            <div className="card bg-light mb-3">
                                                <div className="card-body">
                                                    {/* Horizontal Layout for Reason */}
                                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                                        <label className="form-label fw-semibold text-muted mb-0">Alasan yang Dilaporkan:</label>
                                                        <p className="mb-0 text-end">
                                                            {currentReportData.reason === 'spam' && '🚫 Spam'}
                                                            {currentReportData.reason === 'inappropriate' && '⚠️ Konten Tidak Pantas'}
                                                            {currentReportData.reason === 'offensive' && '😠 Konten Menyinggung'}
                                                            {currentReportData.reason === 'misinformation' && '❌ Informasi Salah'}
                                                            {currentReportData.reason === 'other' && '❓ Lainnya'}
                                                        </p>
                                                    </div>
                                                    
                                                    {currentReportData.description && (
                                                        <div className="d-flex justify-content-between align-items-start mb-3">
                                                            <label className="form-label fw-semibold text-muted mb-0">Deskripsi Laporan:</label>
                                                            <p className="mb-0 text-break text-end ps-2">{currentReportData.description}</p>
                                                        </div>
                                                    )}

                                                    <div className="d-flex justify-content-between align-items-start">
                                                        <label className="form-label fw-semibold text-muted mb-0">Tanggal Lapor:</label>
                                                        <p className="mb-0 text-end">{currentReportData.reported_at ? new Date(currentReportData.reported_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Admin Feedback Section */}
                                            {currentReportData.reviewed_at && (
                                                <div className="card border-success mb-0">
                                                    <div className="card-body border-success">
                                                        <h6 className="card-title text-success mb-3">
                                                            <i className="fas fa-shield-alt me-2"></i>
                                                            Umpan Balik Admin
                                                        </h6>
                                                        
                                                        {/* Horizontal Layout for Review Timestamp */}
                                                        <div className="d-flex justify-content-between align-items-start mb-3">
                                                            <label className="form-label fw-semibold text-muted mb-0">Ditinjau Pada:</label>
                                                            <p className="mb-0 text-end">{new Date(currentReportData.reviewed_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                                        </div>

                                                        {/* Horizontal Layout for Reviewer */}
                                                        {currentReportData.reviewed_by__first_name || currentReportData.reviewed_by__username ? (
                                                            <div className="d-flex justify-content-between align-items-start mb-3">
                                                                <label className="form-label fw-semibold text-muted mb-0">Ditinjau Oleh:</label>
                                                                <p className="mb-0 text-end">{currentReportData.reviewed_by__first_name || currentReportData.reviewed_by__username || 'Admin'}</p>
                                                            </div>
                                                        ) : null}

                                                        {/* Admin Notes Section */}
                                                        {currentReportData.review_notes && (
                                                            <div className="mb-0">
                                                                <label className="form-label fw-semibold text-muted mb-2">Catatan Admin:</label>
                                                                <div className="alert alert-info mb-0">
                                                                    <p className="mb-0 text-break">{currentReportData.review_notes}</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            </div>

                                            {/* Pending Status Message */}
                                            {currentReportData.status === 'pending' && !currentReportData.reviewed_at && (
                                                <div className="alert alert-warning mb-2">
                                                    <i className="fas fa-info-circle me-2"></i>
                                                    Laporan ini sedang dalam proses tinjauan. Tim Admin kami akan memberikan umpan balik dalam waktu singkat.
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* ✨ PHASE 7.16+: Form untuk laporan baru atau edit laporan yang ada */}
                                        {editingReportId && (
                                            <div className="alert alert-info mb-3">
                                                <i className="fas fa-pencil-alt me-2"></i>
                                                Anda sedang mengedit laporan Anda. Laporan akan dikirim ke Admin untuk tinjauan ulang.
                                            </div>
                                        )}
                                        {!editingReportId && (
                                            <p className="abuse-modal-text">
                                                Bantu kami menjaga kualitas komunitas dengan melaporkan konten yang tidak sesuai.
                                            </p>
                                        )}
                                        
                                        <div className="mb-3">
                                            <label className="form-label fw-semibold">Alasan Laporan <span className="text-danger">*</span></label>
                                            <select 
                                                className="form-select form-select-modern"
                                                value={qaReportReason}
                                                onChange={(e) => setQaReportReason(e.target.value)}
                                                disabled={reportingQA}
                                            >
                                                <option value="">-- Pilih Alasan --</option>
                                                <option value="spam">Spam</option>
                                                <option value="inappropriate">Konten Tidak Pantas</option>
                                                <option value="offensive">Konten Menyinggung</option>
                                                <option value="misinformation">Informasi Salah</option>
                                                <option value="other">Lainnya</option>
                                            </select>
                                        </div>

                                        <div className="mb-3">
                                            <label className="form-label fw-semibold">Penjelasan Tambahan (Opsional)</label>
                                            <textarea 
                                                className="form-control"
                                                rows="3"
                                                placeholder="Berikan rincian untuk membantu Admin memahami masalah ini..."
                                                value={qaReportDescription}
                                                onChange={(e) => setQaReportDescription(e.target.value)}
                                                disabled={reportingQA}
                                            ></textarea>
                                            <small className="text-muted">Maksimal 500 karakter</small>
                                        </div>

                                        <div className="alert alert-info">
                                            <i className="fas fa-info-circle me-2"></i>
                                            {editingReportId 
                                                ? 'Perubahan laporan Anda akan ditinjau ulang oleh Admin.'
                                                : 'Tim Admin kami akan meninjau laporan ini dan mengambil tindakan yang sesuai.'
                                            }
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="modal-footer abuse-modal-footer">
                                {/* ✨ PHASE 7.16+: Close/Cancel button - only when NOT editing and report is not pending and NOT closed */}
                                {!editingReportId && (!currentReportData || (currentReportData?.status !== 'pending' && !closedReports.has(currentReportData?.id))) && (
                                    <button 
                                        type="button" 
                                        className="btn btn-outline-secondary"
                                        onClick={handleCloseQAReportModal}
                                        disabled={reportingQA}
                                    >
                                        {currentReportData ? 'Selesai' : 'Batal'}
                                    </button>
                                )}
                                
                                {/* ✨ PHASE 7.16+: Edit Laporan button - only when viewing existing report (NOT editing) and status is reviewed and NOT closed */}
                                {currentReportData && !editingReportId && currentReportData?.status !== 'pending' && !closedReports.has(currentReportData?.id) && (
                                    <button 
                                        type="button" 
                                        className="btn btn-warning"
                                        onClick={handleEditQAReport}
                                        disabled={reportingQA}
                                    >
                                        <i className="fas fa-edit me-2"></i>
                                        Edit Laporan
                                    </button>
                                )}
                                
                                {/* ✨ PHASE 7.16+: Submit button - for new reports OR when editing existing reports */}
                                {(!currentReportData || editingReportId) && (
                                    <button 
                                        type="button" 
                                        className="btn btn-danger"
                                        onClick={handleSubmitQAReport}
                                        disabled={reportingQA || !qaReportReason.trim()}
                                    >
                                        {reportingQA ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                {editingReportId ? 'Mengirim ulang...' : 'Mengirim...'}
                                            </>
                                        ) : (
                                            <>
                                                <i className={`fas ${editingReportId ? 'fa-redo' : 'fa-paper-plane'} me-2`}></i>
                                                {editingReportId ? 'Laporkan Ulang' : 'Laporkan'}
                                            </>
                                        )}
                                    </button>
                                )}
                                
                                {/* ✨ PHASE 7.16+: Pending message - show info when report is waiting for admin review */}
                                {currentReportData && !editingReportId && currentReportData?.status === 'pending' && (
                                    <div className="flex-grow-1">
                                        <p className="text-center text-muted mb-0 small">
                                            <i className="fas fa-clock me-2"></i>
                                            Laporan sedang ditinjau oleh Admin
                                        </p>
                                    </div>
                                )}
                                
                                {/* ✨ PHASE 7.16+: Case closed message - show when user has closed the case */}
                                {currentReportData && !editingReportId && currentReportData?.status !== 'pending' && closedReports.has(currentReportData?.id) && (
                                    <div className="flex-grow-1">
                                        <p className="text-center text-success mb-0 small fw-semibold">
                                            <i className="fas fa-check-circle me-2"></i>
                                            Kasus Ditutup - Laporan Selesai
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Video Resume Dialog */}
            <Footer />
        </>
    );
}

export default CourseDetail;

