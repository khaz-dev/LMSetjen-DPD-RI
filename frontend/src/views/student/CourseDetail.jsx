import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

import { useParams, Link } from "react-router-dom";

import Modal from "react-bootstrap/Modal";

import dayjs, { moment } from "../../utils/dayjs";

import Swal from "sweetalert2";



import BaseHeader from "../partials/BaseHeader";

import Footer from "../partials/Footer";

import Sidebar from "./Partials/Sidebar";

import Header from "./Partials/Header";

import { useSidebarCollapse } from "./Partials/useSidebarCollapse";

import LecturesTab from "../../components/CourseDetail/LecturesTab";

import VideoPlayer from "../../components/CourseDetail/VideoPlayer"; // ✨ PHASE 4.86: Inline video player (not modal)

import ScormPlayer from "../../components/CourseDetail/ScormPlayer"; // E-Learning SCORM 1.2 & H5P Player

import CertificateTab from "../../components/CourseDetail/CertificateTab";

import useAxios from "../../utils/useAxios";

import UserData from "../plugin/UserData";

import Toast from "../plugin/Toast";

import { getMediaUrl, DEFAULT_IMAGE_URL } from "../../utils/constants";

import { parseDurationToSeconds } from "../../utils/durationUtils"; // ✨ PHASE 4.9+: Add JP calculation for progress card

import "./CourseDetail.css";

import apiInstance from "../../utils/axios";

import {

    formatTimestamp,

    parseTimeToSeconds,

    QAFormattingToolbar,

    QAMarkdownRenderer,

    QAVideoTimestampBadge,

} from "../../components/CourseDetail/QAMarkdownTools";

import DiscussionTab from "../../components/CourseDetail/DiscussionTab";

import CreateQuestionModal from "../../components/CourseDetail/CreateQuestionModal";

import QAReportModal from "../../components/CourseDetail/QAReportModal";

import FloatingNoteCardsContainer from "../../components/CourseDetail/FloatingNoteCards";

import NotesTab from "../../components/CourseDetail/NotesTab";

import NoteModal from "../../components/CourseDetail/NoteModal";





function CourseDetail() {

    // Course data and progress

    const [course, setCourse] = useState(null);  // ✨ PHASE 4.144+: Initialize as null instead of [] to avoid accessing .course on array

    const [isUpdatingCourse, setIsUpdatingCourse] = useState(false);

    const [isProgressCardLoading, setIsProgressCardLoading] = useState(true); // Track progress card loading state

    const [completionPercentage, setCompletionPercentage] = useState(0);

    const isSidebarCollapsed = useSidebarCollapse();

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

    const currentVideoPlaybackTimeRef = useRef(0);  // ✨ Pilar 3: Track continuous video playback seconds

    const replyTextareaRef = useRef(null);  // ✨ Pilar 4: Ref to discussion reply textarea

    const [attachedTimestamp, setAttachedTimestamp] = useState(null);  // ✨ Pilar 3: Attached video timestamp for new question

    const [questionPreviewMode, setQuestionPreviewMode] = useState(false);  // ✨ Pilar 4: Preview mode for question modal

    const [replyPreviewMode, setReplyPreviewMode] = useState(false);  // ✨ Pilar 4: Preview mode for reply form



    // ✨ PHASE 4.146: Certificate state to hide video player when certificate exists

    const [existingCertificate, setExistingCertificate] = useState(null);

    const [certificateCheckLoading, setCertificateCheckLoading] = useState(false);



    // ✨ PHASE 4.224: Track active tab for certificate display

    const [activeTab, setActiveTab] = useState('notes');



    // ✨ PHASE 4.225+: Quiz state - declared early for useEffect dependency

    const [quizzes, setQuizzes] = useState([]);

    const [selectedQuiz, setSelectedQuiz] = useState(null);



    // ✨ Pre-test, Post-test & Sequential Progression Helpers

    const prePostQuiz = quizzes?.find(q => q.quiz_type === 'pre_post_test') || null;

    const regularQuizzes = quizzes?.filter(q => q.quiz_type === 'quiz') || [];

    const hasPrePostTest = Boolean(prePostQuiz);

    const hasCompletedPretest = hasPrePostTest ? Boolean(prePostQuiz.has_pre_test || prePostQuiz.today_attempts > 0 || prePostQuiz.is_passed) : true;

    const hasCompletedPosttest = hasPrePostTest ? Boolean(prePostQuiz.has_post_test) : true;

    const pretestRequired = hasPrePostTest;



    const allLessonsCompleted = (() => {

        const totalLessons = course?.curriculum?.reduce((total, section) => {

            const items = section.variant_items || section.items || [];

            return total + items.length;

        }, 0) || 0;

        const completedCount = new Set(course?.completed_lesson?.map(cl => cl.variant_item?.variant_item_id)).size;

        return totalLessons > 0 && completedCount >= totalLessons;

    })();



    const allRegularQuizzesPassed = regularQuizzes.length === 0 || regularQuizzes.every(q => q.is_passed);

    const canTakePostTest = hasPrePostTest && allLessonsCompleted && allRegularQuizzesPassed;



    const handleStartPretest = () => {

        if (prePostQuiz) {

            setActiveTab('quiz');

            handleQuizShow(prePostQuiz);

        } else {

            Toast().fire({

                icon: 'info',

                title: 'Info Pre-test',

                text: 'Tidak ada Pre-test yang dikonfigurasi untuk kursus ini.'

            });

        }

    };



    const handleStartPosttest = () => {

        if (prePostQuiz) {

            if (!canTakePostTest) {

                Toast().fire({

                    icon: 'warning',

                    title: 'Post-test Terkunci',

                    text: 'Selesaikan semua materi kurikulum dan kuis kursus terlebih dahulu.'

                });

                return;

            }

            setActiveTab('quiz');

            handleQuizShow(prePostQuiz);

        }

    };

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

    const [isSubmittingReply, setIsSubmittingReply] = useState(false);  // ✨ Loading state for reply submission
    const [questionAttachment, setQuestionAttachment] = useState(null);
    const [isCompressingQuestionAttachment, setIsCompressingQuestionAttachment] = useState(false);

    const [currentVariantContext, setCurrentVariantContext] = useState(null);

    const [discussionFilters, setDiscussionFilters] = useState({ 

        search: '', 

        bagian: null, 

        pelajaran: null, 

        tab: 'all', 

        sort: 'newest' 

    });

    const [filteredQuestions, setFilteredQuestions] = useState([]);

    // ✨ PHASE 7.10: Inline forum view - track opened question for inline display instead of modal

    const [openedQuestionId, setOpenedQuestionId] = useState(null);



    // ✨ Pilar 2: Hitung Statistik Q&A secara Real-Time untuk Quick Filter Tabs

    const qaStats = useMemo(() => {

        const all = questions || [];

        const currentUserId = UserData()?.user_id;

        const teacherUserId = course?.course?.teacher?.user_id;



        const solved = all.filter(q => q.is_solved || q.messages?.some(m => m.is_solution)).length;

        const unsolved = Math.max(0, all.length - solved);

        const instructor = all.filter(q => 

            q.has_instructor_reply || 

            (teacherUserId && q.messages?.slice(1).some(m => m.user_id === teacherUserId || m.profile?.user_id === teacherUserId))

        ).length;

        const myQuestions = all.filter(q => q.user_id === currentUserId || q.profile?.user_id === currentUserId).length;



        return {

            total: all.length,

            unsolved,

            solved,

            instructor,

            myQuestions

        };

    }, [questions, course]);



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



    // ✨ PHASE 7.8-7.9 & Pilar 2: Filter and sort questions (Tab Quick Filter, Search, Bagian, Pelajaran, Sorting)

    useEffect(() => {

        let filtered = [...(questions || [])];

        const currentUserId = UserData()?.user_id;

        const teacherUserId = course?.course?.teacher?.user_id;



        // 1. Tab Quick Filter

        const activeTab = discussionFilters.tab || 'all';

        if (activeTab === 'unsolved') {

            filtered = filtered.filter(q => !q.is_solved && !q.messages?.some(m => m.is_solution));

        } else if (activeTab === 'solved') {

            filtered = filtered.filter(q => q.is_solved || q.messages?.some(m => m.is_solution));

        } else if (activeTab === 'instructor') {

            filtered = filtered.filter(q => 

                q.has_instructor_reply || 

                (teacherUserId && q.messages?.slice(1).some(m => m.user_id === teacherUserId || m.profile?.user_id === teacherUserId))

            );

        } else if (activeTab === 'my_questions') {

            filtered = filtered.filter(q => q.user_id === currentUserId || q.profile?.user_id === currentUserId);

        } else if (activeTab === 'popular') {

            filtered = filtered.filter(q => (q.likes_count || 0) > 0 || (q.replies_count || q.messages?.length - 1 || 0) > 0);

        }



        // 2. Filter by search term (title, message, or author name)

        if (discussionFilters.search?.trim()) {

            const searchLower = discussionFilters.search.toLowerCase();

            filtered = filtered.filter(q => {

                const titleMatch = q.title?.toLowerCase().includes(searchLower);

                const messageMatch = (q.message || q.messages?.[0]?.message)?.toLowerCase().includes(searchLower);

                const authorMatch = q.profile?.full_name?.toLowerCase().includes(searchLower);

                // ✨ Deep search: include all reply messages and replier names

                const repliesMatch = q.messages && Array.isArray(q.messages) && q.messages.some(m =>

                    m.message?.toLowerCase().includes(searchLower) ||

                    m.profile?.full_name?.toLowerCase().includes(searchLower)

                );

                return titleMatch || messageMatch || authorMatch || repliesMatch;

            });

        }



        // 3. Filter by bagian (section)

        if (discussionFilters.bagian) {

            filtered = filtered.filter(q =>

                q.variant?.variant_id === discussionFilters.bagian

            );

        }



        // 4. Filter by pelajaran (lesson)

        if (discussionFilters.pelajaran) {

            filtered = filtered.filter(q =>

                q.variant_item?.variant_item_id === discussionFilters.pelajaran

            );

        }



        // 5. Sorting (✨ Pilar 5: Pinned questions prioritized at the top!)

        const sort = discussionFilters.sort || (activeTab === 'popular' ? 'most_liked' : 'newest');

        filtered.sort((a, b) => {

            if (a.is_pinned && !b.is_pinned) return -1;

            if (!a.is_pinned && b.is_pinned) return 1;



            if (sort === 'most_liked') {

                return (b.likes_count || 0) - (a.likes_count || 0);

            } else if (sort === 'most_replies') {

                const countA = a.replies_count ?? Math.max(0, (a.messages?.length || 0) - 1);

                const countB = b.replies_count ?? Math.max(0, (b.messages?.length || 0) - 1);

                return countB - countA;

            } else {

                return new Date(b.date) - new Date(a.date);

            }

        });



        setFilteredQuestions(filtered);



        // ✨ PHASE 7.24: Populate user's liked questions from API data (user_liked field)

        const likedQuestionIds = new Set();

        filtered.forEach(q => {

            if (q.user_liked) {

                likedQuestionIds.add(q.qa_id);

            }

        });

        setUserLikedQuestions(likedQuestionIds);



    }, [questions, discussionFilters, course]);

    // ✨ PHASE 4.224: Set up Bootstrap tab change listeners

    useEffect(() => {

        const tabElements = document.querySelectorAll('[data-bs-toggle="tab"]');

        const handleTabChange = (e) => {

            const target = e.target.getAttribute('data-bs-target');

            const tabName = target?.replace('#', '');

            if (tabName) {

                setActiveTab(tabName);

                if (tabName === 'quiz') {

                    setTimeout(() => {

                        const targetRow = document.querySelector('.course-quiz-layout-row');

                        if (targetRow) {

                            targetRow.scrollIntoView({ behavior: 'smooth', block: 'start' });

                        }

                    }, 50);

                } else if (tabName === 'certificate') {

                    setTimeout(() => {

                        const targetRow = document.querySelector('.course-certificate-review-row');

                        if (targetRow) {

                            targetRow.scrollIntoView({ behavior: 'smooth', block: 'start' });

                        }

                    }, 50);

                }

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

        // document.body.style.overflow = 'hidden';



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



        // ✨ Pilar 3: Continuously capture current playback seconds

        if (typeof currentTime === 'number' && !isNaN(currentTime) && currentTime >= 0) {

            currentVideoPlaybackTimeRef.current = currentTime;

        }



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

    // Quick resume helper to jump straight to current pending lesson

    const handleQuickResumeLearning = useCallback(() => {

        if (variantItem && videoPlayerContainerRef.current) {

            videoPlayerContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });

            return;

        }

        if (course?.curriculum && Array.isArray(course.curriculum)) {

            for (const variant of course.curriculum) {

                for (const item of (variant.variant_items || [])) {

                    const isDone = course.completed_lesson?.some(

                        cl => cl.variant_item?.variant_item_id === item.variant_item_id

                    );

                    if (!isDone) {

                        handlePlayLessonWithAutoplay(item);

                        setTimeout(() => {

                            if (videoPlayerContainerRef.current) {

                                videoPlayerContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });

                            }

                        }, 120);

                        return;

                    }

                }

            }

            const firstLesson = course.curriculum[0]?.variant_items?.[0];

            if (firstLesson) {

                handlePlayLessonWithAutoplay(firstLesson);

                setTimeout(() => {

                    if (videoPlayerContainerRef.current) {

                        videoPlayerContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });

                    }

                }, 120);

            }

        }

    }, [course, variantItem]);



    // ✨ Pilar 3: Get current video playback time in seconds

    const getCurrentVideoTime = useCallback(() => {

        if (videoPlayerRef.current?.getCurrentTime) {

            const t = videoPlayerRef.current.getCurrentTime();

            if (typeof t === 'number' && !isNaN(t) && t >= 0) return t;

        }

        return currentVideoPlaybackTimeRef.current || 0;

    }, []);



    // ✨ Pilar 3: Video Timestamp Linking handler

    const handleJumpToVideoTimestamp = useCallback((targetVariantItemId, seconds) => {

        const secNum = Math.max(0, Math.floor(Number(seconds) || 0));



        // If target lesson is already active

        if (variantItem && (!targetVariantItemId || variantItem.variant_item_id === targetVariantItemId)) {

            if (videoPlayerRef.current?.seekToPosition) {

                videoPlayerRef.current.seekToPosition(secNum);

            }

            if (videoPlayerContainerRef.current) {

                videoPlayerContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });

            }

            Toast().fire({

                icon: 'info',

                title: `Melompat ke menit ${formatTimestamp(secNum)}`,

                timer: 1800,

                showConfirmButton: false

            });

            return;

        }



        // If target lesson is different or no lesson open, locate in curriculum

        let targetLesson = null;

        if (course?.curriculum && targetVariantItemId) {

            for (const variant of course.curriculum) {

                const found = (variant.variant_items || variant.items || []).find(

                    it => it.variant_item_id === targetVariantItemId

                );

                if (found) {

                    targetLesson = found;

                    break;

                }

            }

        }



        if (targetLesson) {

            handlePlayLessonWithAutoplay(targetLesson);

            setSeekPosition(secNum);

            setTimeout(() => {

                if (videoPlayerRef.current?.seekToPosition) {

                    videoPlayerRef.current.seekToPosition(secNum);

                }

                if (videoPlayerContainerRef.current) {

                    videoPlayerContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });

                }

            }, 350);

            Toast().fire({

                icon: 'info',

                title: `Membuka materi & melompat ke ${formatTimestamp(secNum)}`,

                timer: 2200,

                showConfirmButton: false

            });

        } else {

            // Fallback: seek current player if possible

            if (videoPlayerRef.current?.seekToPosition) {

                videoPlayerRef.current.seekToPosition(secNum);

            }

            if (videoPlayerContainerRef.current) {

                videoPlayerContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });

            }

        }

    }, [variantItem, course]);





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



    const handleQuestionClose = () => {

        setAddQuestionShow(false);

        setAttachedTimestamp(null);

        setQuestionPreviewMode(false);

        setQuestionAttachment(null);

        setIsCompressingQuestionAttachment(false);

    };

    const handleQuestionShow = () => {

        setAddQuestionShow(true);

        // Pre-capture active video playback timestamp if available

        const curTime = Math.floor(getCurrentVideoTime());

        if (curTime > 0 && variantItem) {

            setAttachedTimestamp(curTime);

        }

    };



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

            handle.style.top = `${pos.y + size.height - 20}px`;

            handle.style.left = `${pos.x + size.width - 20}px`;

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

            handle.style.top = `${pos.y + size.height - 20}px`;

            handle.style.left = `${pos.x + size.width - 20}px`;

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



    const handleReturnToLessons = () => {

        handleQuizClose();

        setActiveTab('notes');

        const notesTabBtn = document.querySelector('#notes-tab');

        if (notesTabBtn && window.bootstrap?.Tab) {

            window.bootstrap.Tab.getOrCreateInstance(notesTabBtn).show();

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

            setActiveTab('quiz');

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



            const isPreTest = selectedQuiz.quiz_type === 'pre_post_test' && (!selectedQuiz.has_pre_test || selectedQuiz.current_mode === 'pre_test');

            const finalAttemptType = selectedQuiz.quiz_type === 'pre_post_test' ? (isPreTest ? 'pre_test' : 'post_test') : 'quiz';



            const submissionData = {

                quiz_id: selectedQuiz.quiz_id,

                answers: formattedAnswers,

                time_taken: timeTaken,

                attempt_type: finalAttemptType

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



            const isPreTest = selectedQuiz.quiz_type === 'pre_post_test' && (!selectedQuiz.has_pre_test || selectedQuiz.current_mode === 'pre_test');

            const finalAttemptType = selectedQuiz.quiz_type === 'pre_post_test' ? (isPreTest ? 'pre_test' : 'post_test') : 'quiz';



            const submissionData = {

                quiz_id: selectedQuiz.quiz_id,

                answers: formattedAnswers,

                time_taken: timeTaken,

                attempt_type: finalAttemptType

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

            // document.body.style.overflow = 'hidden';

            return () => {

                // Re-enable scrolling when quiz closes

                document.body.style.overflow = 'unset';

            };

        }

    }, [isQuizActive]);



    // ✨ PHASE 4.103: Block LEFT/RIGHT arrow keys on the entire course page



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

        // ✨ Pilar 3: Send attached video timestamp if set

        if (attachedTimestamp !== null && attachedTimestamp !== undefined) {

            formdata.append("video_timestamp", attachedTimestamp);

        }

        if (questionAttachment) {

            formdata.append("file", questionAttachment);

            formdata.append("file_name", questionAttachment.name);

        }



        await useAxios.post(`student/question-answer-list-create/${course.course?.id}/`, formdata).then((res) => {

            fetchCourseDetail();

            setCreateMessage({

                title: "",

                message: "",

            });

            setQuestionAttachment(null);

            setIsCompressingQuestionAttachment(false);

            setAttachedTimestamp(null);

            setQuestionPreviewMode(false);

            handleQuestionClose();

            Toast().fire({

                icon: "success",

                title: "Pertanyaan berhasil dibuat",

            });

        });

    };



    const sendNewMessage = async (e, customAttachment = null, onClearAttachment = null) => {

        e.preventDefault();



        if (isSubmittingReply) return;



        if (!selectedConversation) {

            Toast().fire({

                icon: "error",

                title: "Silakan pilih percakapan terlebih dahulu",

            });

            return;

        }



        const trimmedMsg = (createMessage.message || "").trim();

        if (!trimmedMsg && !customAttachment) {

            Toast().fire({

                icon: "error",

                title: "Silakan masukkan pesan atau lampirkan gambar/file"

            });

            return;

        }



        const formdata = new FormData();

        formdata.append("course_id", course.course?.id);

        formdata.append("user_id", UserData()?.user_id);

        formdata.append("message", createMessage.message || "");

        formdata.append("qa_id", selectedConversation?.qa_id);

        if (customAttachment) {

            formdata.append("file", customAttachment);

            formdata.append("file_name", customAttachment.name);

        }



        try {

            setIsSubmittingReply(true);

            const response = await useAxios.post("student/question-answer-message-create/", formdata);

            if (onClearAttachment) {

                onClearAttachment();

            }



            // Update the selected conversation with new message data

            if (response.data.question) {

                setSelectedConversation(response.data.question);

                // ✨ Instantly update local questions state so count & cards reflect immediately

                setQuestions(prev => prev.map(q =>

                    q.qa_id === selectedConversation.qa_id ? response.data.question : q

                ));

                fetchCourseDetail(true);



                // ✨ Smoothly scroll to the newest reply

                setTimeout(() => {

                    const repliesContainer = document.querySelector('.forum-replies-list');

                    if (repliesContainer && repliesContainer.lastElementChild) {

                        repliesContainer.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

                    }

                }, 150);

            }



            // Clear the message input & reset preview

            setCreateMessage({

                title: "",

                message: "",

            });

            setReplyPreviewMode(false);



        } catch (error) {

            Toast().fire({

                icon: "error",

                title: "Gagal mengirim pesan"

            });

        } finally {

            setIsSubmittingReply(false);

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



    // ✨ Pilar 1: Solusi Terverifikasi / Best Answer Toggle Handler

    const handleToggleSolution = async (message) => {

        if (!selectedConversation || !message) return;

        try {

            const currentUserId = UserData()?.user_id;

            const res = await useAxios.post(`student/question-answer-toggle-solution/${selectedConversation.qa_id}/`, {

                user_id: currentUserId,

                message_id: message.id || message.qam_id

            });



            const newIsSolution = res.data.is_solution;

            const newIsSolved = res.data.is_solved;



            Toast().fire({

                icon: "success",

                title: res.data.message || "Status solusi berhasil diperbarui",

                timer: 3000

            });



            // Update selectedConversation

            setSelectedConversation(prev => {

                if (!prev) return prev;

                return {

                    ...prev,

                    is_solved: newIsSolved,

                    messages: prev.messages?.map(m => {

                        if (m.id === message.id) {

                            return { ...m, is_solution: newIsSolution };

                        }

                        if (newIsSolution) {

                            return { ...m, is_solution: false };

                        }

                        return m;

                    })

                };

            });



            // Sync with questions state

            setQuestions(prev => prev.map(q => {

                if (q.qa_id === selectedConversation.qa_id) {

                    return {

                        ...q,

                        is_solved: newIsSolved,

                        messages: q.messages?.map(m => {

                            if (m.id === message.id) {

                                return { ...m, is_solution: newIsSolution };

                            }

                            if (newIsSolution) {

                                return { ...m, is_solution: false };

                            }

                            return m;

                        })

                    };

                }

                return q;

            }));



        } catch (error) {

            Toast().fire({

                icon: "error",

                title: error.response?.data?.error || "Gagal mengubah status solusi",

                timer: 4000

            });

        }

    };



    // ✨ Pilar 5: Check if current user is Course Instructor or Staff/Admin

    const isCourseInstructorOrStaff = useMemo(() => {

        const user = UserData();

        if (!user) return false;

        const isTeacher = course?.course?.teacher && (

            course.course.teacher.user_id === user.user_id ||

            course.course.teacher.id === user.teacher_id

        );

        const isStaff = Boolean(user.is_staff || user.is_superuser);

        return Boolean(isTeacher || isStaff);

    }, [course]);



    // ✨ Pilar 5: Sematkan / Batalkan Sematan Diskusi (Toggle Pin)

    const handleTogglePin = useCallback(async (qaId) => {

        const user = UserData();

        if (!user) {

            Toast().fire({ icon: 'warning', title: 'Silakan login terlebih dahulu' });

            return;

        }

        try {

            const res = await useAxios.post(`student/question-answer-toggle-pin/${qaId}/`, {

                user_id: user.user_id

            });



            Toast().fire({

                icon: 'success',

                title: res.data.message || 'Status sematan berhasil diperbarui',

                timer: 2000,

                showConfirmButton: false

            });



            const updatedIsPinned = res.data.is_pinned;



            // Sync with local questions state

            setQuestions(prev => prev.map(q => {

                if (q.qa_id === qaId) {

                    return { ...q, is_pinned: updatedIsPinned };

                }

                return q;

            }));



            // Sync with selectedConversation if open

            setSelectedConversation(prev => {

                if (prev && prev.qa_id === qaId) {

                    return { ...prev, is_pinned: updatedIsPinned };

                }

                return prev;

            });



            fetchCourseDetail();

        } catch (err) {

            Toast().fire({

                icon: 'error',

                title: err.response?.data?.error || 'Gagal mengubah status sematan'

            });

        }

    }, [fetchCourseDetail]);



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



    // Video player visibility calculation for two-column split layout

    const isVideoPlayerVisible = Boolean(

        variantItem &&

        activeTab !== 'certificate' &&

        activeTab !== 'review' &&

        !(activeTab === 'quiz' && (quizShow || isQuizActive))

    );



    // Switch active tab between certificate and review in side card & bootstrap tab

    const handleSwitchCertSideTab = (tabName) => {

        setActiveTab(tabName);

        const tabBtn = document.querySelector(`[data-bs-target="#${tabName}"]`);

        if (tabBtn && window.bootstrap?.Tab) {

            const bsTab = window.bootstrap.Tab.getOrCreateInstance(tabBtn);

            bsTab.show();

        }

    };



    const renderReviewContent = () => (

        <div className="review-section-content">

            {studentReview ? (

                !isEditingReview ? (

                    <div className="review-card-modern">

                        <div className="review-card-header d-flex justify-content-between align-items-center mb-2">

                            <div className="d-flex align-items-center gap-2">

                                <div className="review-header-badge">

                                    <i className="fas fa-star text-amber"></i>

                                    <span className="fw-bold">Ulasan Anda</span>

                                </div>

                                <span className="review-date-chip">

                                    <i className="fas fa-calendar-alt me-1"></i>

                                    {moment(studentReview.date).format("DD MMM YYYY")}

                                </span>

                            </div>

                            <button

                                className="btn btn-sm btn-outline-teal review-edit-btn"

                                onClick={handleEditReview}

                                title="Edit ulasan Anda"

                            >

                                <i className="fas fa-edit me-1"></i>

                                Edit

                            </button>

                        </div>



                        {/* Compact Rating Stars Row */}

                        <div className="review-rating-row mb-2">

                            <div className="star-rating-pill">

                                <div className="stars-group">

                                    {[...Array(5)].map((_, i) => (

                                        <i key={i} className={`fas fa-star ${i < studentReview.rating ? "star-filled" : "star-empty"}`}></i>

                                    ))}

                                </div>

                                <span className="rating-score-badge">{studentReview.rating}/5</span>

                                <span className="rating-label-text">

                                    {studentReview.rating === 5 ? "Sangat Memuaskan" : studentReview.rating === 4 ? "Memuaskan" : studentReview.rating === 3 ? "Cukup Baik" : "Perlu Peningkatan"}

                                </span>

                            </div>

                        </div>



                        {/* Review Text Quote Box */}

                        <div className="review-quote-box mb-2">

                            <i className="fas fa-quote-left quote-icon-left"></i>

                            <p className="review-text-content mb-0">{studentReview.review}</p>

                        </div>



                        {/* Instructor Reply Section */}

                        {studentReview.reply ? (

                            <div className="instructor-reply-card mt-2">

                                <div className="reply-header d-flex align-items-center justify-content-between mb-1">

                                    <div className="d-flex align-items-center gap-2">

                                        <div className="reply-avatar-box">

                                            <i className="fas fa-chalkboard-user"></i>

                                        </div>

                                        <div>

                                            <span className="reply-author-name">{course.course?.teacher?.full_name || "Instruktur Kursus"}</span>

                                            <span className="reply-author-badge">Instruktur</span>

                                        </div>

                                    </div>

                                </div>

                                <div className="reply-body">

                                    <p className="reply-text mb-0">{studentReview.reply}</p>

                                </div>

                            </div>

                        ) : (

                            <div className="no-reply-chip mt-2">

                                <i className="fas fa-hourglass-half text-amber me-1"></i>

                                <span>Menunggu tanggapan dari instruktur...</span>

                            </div>

                        )}

                    </div>

                ) : (

                    <div className="review-card-modern">

                        <div className="review-card-header d-flex justify-content-between align-items-center mb-2">

                            <h6 className="mb-0 review-form-title">

                                <i className="fas fa-edit text-teal-accent me-1"></i>Edit Ulasan Kursus

                            </h6>

                            <span className="badge-form-mode">Mode Edit</span>

                        </div>

                        <form onSubmit={handleUpdateReviewSubmit} className="review-form-compact">

                            <div className="form-group-compact mb-2">

                                <label className="compact-field-label">Rating Penilaian:</label>

                                <div className="star-rating-selector">

                                    {[1, 2, 3, 4, 5].map((star) => (

                                        <i

                                            key={star}

                                            className={`fas fa-star star-interactive ${star <= createReview.rating ? "star-active" : "star-inactive"}`}

                                            onClick={() => setCreateReview({ ...createReview, rating: star })}

                                            title={`Beri ${star} bintang`}

                                        ></i>

                                    ))}

                                    <span className="star-rating-hint ms-2">

                                        {createReview.rating ? `${createReview.rating}/5 Bintang` : "Pilih bintang"}

                                    </span>

                                </div>

                            </div>

                            <div className="form-group-compact mb-2">

                                <label className="compact-field-label">Ulasan Anda:</label>

                                <textarea

                                    name="review"

                                    value={createReview.review}

                                    onChange={handleReviewChange}

                                    className="form-control compact-review-textarea"

                                    rows="3"

                                    placeholder="Bagikan pemikiran Anda tentang kursus ini..."

                                ></textarea>

                            </div>

                            <div className="review-form-actions d-flex gap-2 justify-content-end">

                                <button

                                    type="button"

                                    className="btn btn-sm btn-secondary"

                                    onClick={handleCancelEditReview}

                                >

                                    <i className="fas fa-times me-1"></i>

                                    Batal

                                </button>

                                <button

                                    type="submit"

                                    className="btn btn-sm btn-teal"

                                    disabled={!createReview.review.trim() || !createReview.rating}

                                >

                                    <i className="fas fa-save me-1"></i>

                                    Perbarui Ulasan

                                </button>

                            </div>

                        </form>

                    </div>

                )

            ) : (

                <div className="review-card-modern">

                    <div className="review-card-header mb-2">

                        <h6 className="mb-0 review-form-title">

                            <i className="fas fa-star text-amber me-1"></i>Beri Penilaian Kursus

                        </h6>

                        <small className="text-muted d-block mt-1">Ulasan Anda membantu meningkatkan mutu materi pembelajaran LMSetjen DPD RI.</small>

                    </div>

                    <form onSubmit={handleCreateReviewSubmit} className="review-form-compact">

                        <div className="form-group-compact mb-2">

                            <label className="compact-field-label">Rating Penilaian:</label>

                            <div className="star-rating-selector">

                                {[1, 2, 3, 4, 5].map((star) => (

                                    <i

                                        key={star}

                                        className={`fas fa-star star-interactive ${star <= createReview.rating ? "star-active" : "star-inactive"}`}

                                        onClick={() => setCreateReview({ ...createReview, rating: star })}

                                        title={`Beri ${star} bintang`}

                                    ></i>

                                ))}

                                <span className="star-rating-hint ms-2">

                                    {createReview.rating ? `${createReview.rating}/5 Bintang` : "Klik untuk memilih bintang"}

                                </span>

                            </div>

                        </div>

                        <div className="form-group-compact mb-2">

                            <label className="compact-field-label">Ulasan & Kesan Pembelajaran:</label>

                            <textarea

                                name="review"

                                value={createReview.review}

                                onChange={handleReviewChange}

                                className="form-control compact-review-textarea"

                                rows="3"

                                placeholder="Bagikan pengalaman belajar Anda terhadap materi, metode, dan penyampaian..."

                            ></textarea>

                        </div>

                        <div className="review-form-actions d-flex justify-content-end">

                            <button

                                type="submit"

                                className="btn btn-sm btn-teal"

                                disabled={!createReview.review.trim() || !createReview.rating}

                            >

                                <i className="fas fa-paper-plane me-1"></i>

                                Kirim Ulasan

                            </button>

                        </div>

                    </form>

                </div>

            )}

        </div>

    );



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

                    <Header defaultCollapsed={true} />



                    <div className="row mt-0">

                        {/* Sidebar Here */}

                        <Sidebar />



                        <div className={`col-lg-9 col-md-8 col-12 ${isSidebarCollapsed ? "sidebar-collapsed-adapted" : ""}`}>

                            {/* Course Progress Card - Compact & Executive Redesign */}

                            {isProgressCardLoading ? (

                                // Skeleton Loading State - Compact

                                <div className="course-progress-card-skeleton">

                                    <div className="progress-content">

                                        <div className="d-flex align-items-center justify-content-between mb-2">

                                            <div className="skeleton-item" style={{ width: '180px', height: '18px', borderRadius: '6px' }}></div>

                                            <div className="skeleton-item" style={{ width: '120px', height: '18px', borderRadius: '6px' }}></div>

                                        </div>

                                        <div className="row align-items-center mt-1">

                                            <div className="col-lg-9 col-md-8 pe-lg-2">

                                                <div className="skeleton-item skeleton-title mb-2" style={{ height: '24px', width: '70%' }}></div>

                                                <div className="d-flex align-items-center gap-2 flex-wrap">

                                                    <div className="skeleton-item skeleton-badge"></div>

                                                    <div className="skeleton-item skeleton-badge"></div>

                                                    <div className="skeleton-item skeleton-badge"></div>

                                                </div>

                                            </div>

                                            <div className="col-lg-3 col-md-4 text-center d-flex align-items-center justify-content-end ps-0">

                                                <div className="skeleton-item skeleton-circle" style={{ width: '76px', height: '76px' }}></div>

                                            </div>

                                        </div>

                                    </div>

                                </div>

                            ) : (

                                // Actual Progress Card - Ultra-Compact & Eye-Catching Executive Strip

                                <div className="course-progress-card course-progress-card-loaded">

                                    <div className="progress-content">

                                        {/* Top Breadcrumb & Institutional Pill */}

                                        <div className="course-hero-breadcrumb-strip mb-2 d-flex align-items-center justify-content-between flex-wrap gap-2">

                                            <div className="d-flex align-items-center gap-2 flex-wrap min-w-0">

                                                <Link to="/student/courses/" className="course-hero-back-link">

                                                    <i className="fas fa-arrow-left me-1"></i>

                                                    <span>Kursus Saya</span>

                                                </Link>

                                                <span className="course-hero-divider">/</span>

                                                <span className="course-hero-current">Ruang Pembelajaran</span>

                                                {course?.course?.category?.title && (

                                                    <span className="course-hero-category-chip">

                                                        <i className="fas fa-layer-group me-1"></i>

                                                        {course.course.category.title}

                                                    </span>

                                                )}

                                            </div>

                                            <div className="course-hero-dpd-chip d-none d-sm-inline-flex">

                                                <i className="fas fa-landmark me-1 text-amber"></i>

                                                <span>Setjen DPD RI • E-Learning LMS</span>

                                            </div>

                                        </div>



                                        {/* Main Content Row */}

                                        <div className="row align-items-center">

                                            <div className="col-lg-9 col-md-8 pe-lg-3">

                                                <div className="d-flex align-items-start gap-2">

                                                    <div className="course-hero-icon d-none d-sm-flex">

                                                        <i className="fas fa-book-reader"></i>

                                                    </div>

                                                    <div className="min-w-0 flex-grow-1">

                                                        <h2 className="fw-bold mb-1 course-title-compact text-truncate-2">

                                                            {course?.course?.title}

                                                        </h2>



                                                        {/* Tags */}

                                                        {course?.course?.tags && Array.isArray(course.course.tags) && course.course.tags.length > 0 && (

                                                            <div className="course-tags-strip mb-1" data-testid="course-tags-section">

                                                                {course.course.tags.map((tag) => (

                                                                    <span key={tag.id} className="course-detail-tag-badge">

                                                                        <i className="fas fa-bookmark me-1"></i>

                                                                        {tag.title}

                                                                    </span>

                                                                ))}

                                                            </div>

                                                        )}



                                                        {/* Compact Stats Badges */}

                                                        <div className="course-stats-strip d-flex align-items-center gap-2 flex-wrap mt-2">

                                                            <span className="course-stat-badge">

                                                                <i className="fas fa-play-circle text-teal-accent me-1"></i>

                                                                <strong>{completionStats.completedLessons}/{completionStats.totalLessons}</strong> Pelajaran

                                                            </span>

                                                            {completionStats.totalQuizzes > 0 && (

                                                                <span className="course-stat-badge">

                                                                    <i className="fas fa-brain text-success-bright me-1"></i>

                                                                    <strong>{completionStats.passedQuizzes}/{completionStats.totalQuizzes}</strong> Kuis

                                                                </span>

                                                            )}

                                                            {course?.curriculum && (

                                                                <span className="course-stat-badge">

                                                                    <i className="fas fa-clock text-amber-bright me-1"></i>

                                                                    <strong>{calculateTotalJP(course.curriculum)}</strong> JP

                                                                </span>

                                                            )}

                                                            <span className={`course-status-badge ${completionPercentage === 100 ? "completed" : "in-progress"}`}>

                                                                <i className={`fas ${completionPercentage === 100 ? "fa-circle-check text-success-bright" : "fa-chart-line text-teal-accent"} me-1`}></i>

                                                                {completionPercentage === 100 ? "Tuntas" : `${completionPercentage || 0}% Selesai`}

                                                            </span>

                                                        </div>

                                                    </div>

                                                </div>

                                            </div>



                                            <div className="col-lg-3 col-md-4 text-center d-flex align-items-center justify-content-center justify-content-md-end mt-3 mt-md-0">

                                                <div className="course-progress-dial-wrapper d-flex align-items-center gap-3">

                                                    <div

                                                        className="progress-circle progress-circle-compact"

                                                        style={{ "--progress": completionPercentage || 0 }}

                                                        title={`Progres Belajar: ${completionPercentage || 0}%`}

                                                    >

                                                        <div className="progress-inner">

                                                            <div className="text-center">

                                                                <div className="progress-percent-num">{completionPercentage || 0}%</div>

                                                                <span className="progress-percent-label">Selesai</span>

                                                            </div>

                                                        </div>

                                                    </div>

                                                    {/* Quick Resume CTA Button */}

                                                    <button

                                                        className="btn btn-sm btn-quick-resume"

                                                        onClick={handleQuickResumeLearning}

                                                        title={completionPercentage === 100 ? "Tinjau Pelajaran" : "Lanjutkan Belajar"}

                                                    >

                                                        <i className={`fas ${completionPercentage === 100 ? "fa-redo" : "fa-play"} me-1`}></i>

                                                        <span>{completionPercentage === 100 ? "Review" : "Lanjut"}</span>

                                                    </button>

                                                </div>

                                            </div>

                                        </div>

                                    </div>

                                </div>

                            )}





                                                        {/* ✨ Unified 2-Column Responsive Layout: Left Main Column & Right Sidebar Column */}

                            <div className={`course-unified-layout-row ${activeTab === 'certificate' || activeTab === 'review' ? 'course-certificate-review-row' : ''} ${activeTab === 'quiz' ? 'course-quiz-layout-row' : 'course-player-curriculum-row'}`}>

                                {/* Left Main Column: Media Display + Modern Tabs (Exact Equal Width!) */}

                                <div className="course-main-left-column">

                                    {/* 1. Main Display Area: Certificate Display / Quiz Player / Video Player */}

                                    {(activeTab === 'certificate' || activeTab === 'review') && (
<div className="certificate-display-column">

                                        {existingCertificate && existingCertificate.image_file_url ? (

                                            <div className="certificate-display-card">

                                                <div className="certificate-display-header">

                                                    <div className="d-flex align-items-center gap-2">

                                                        <i className="fas fa-award text-amber"></i>

                                                        <span className="cert-preview-title">Pratinjau Sertifikat Kelulusan</span>

                                                    </div>

                                                    <span className="badge-cert-verified">

                                                        <i className="fas fa-check-circle me-1"></i>Resmi & Terverifikasi

                                                    </span>

                                                </div>

                                                <div className="certificate-image-wrapper">

                                                    <img

                                                        src={existingCertificate.image_file_url}

                                                        alt="Sertifikat Kursus"

                                                        className="certificate-image"

                                                        onError={(e) => {

                                                            console.error('❌ Certificate image failed to load:', e);

                                                            e.target.style.display = 'none';

                                                        }}

                                                    />

                                                </div>

                                                <div className="certificate-display-footer">

                                                    <small className="text-muted">

                                                        <i className="fas fa-shield-alt me-1 text-teal-accent"></i>

                                                        Diterbitkan secara resmi oleh Sekretariat Jenderal DPD RI

                                                    </small>

                                                </div>

                                            </div>

                                        ) : (

                                            <div className="certificate-standby-card">

                                                <div className="cert-standby-content">

                                                    <div className="cert-standby-icon">

                                                        <i className="fas fa-award"></i>

                                                    </div>

                                                    <h5 className="cert-standby-title">Pratinjau Sertifikat Kursus</h5>

                                                    <p className="cert-standby-subtitle">

                                                        {completionPercentage === 100

                                                            ? "Selamat! Semua materi telah selesai 100%. Silakan klik tombol 'Buat Sertifikat' pada panel di sebelah kanan untuk menerbitkan sertifikat resmi Anda."

                                                            : "Selesaikan seluruh materi kurikulum kursus dan penuhi syarat kelulusan kuis untuk menerbitkan sertifikat resmi Anda."}

                                                    </p>

                                                    <div className="cert-standby-progress-chip">

                                                        <i className="fas fa-tasks me-1"></i>

                                                        <span>Progres Kurikulum: {completionPercentage || 0}%</span>

                                                    </div>

                                                </div>

                                            </div>

                                        )}

                                    </div>
                                    )}

                                    {activeTab === 'quiz' && (
<div className="quiz-player-column">

                                        {/* Left Quiz Area Notification */}

                                        {isQuizActive && showLeftQuizNotification && (

                                            <div className="left-quiz-notification mb-2">

                                                <i className="fas fa-exclamation-circle notification-icon me-2"></i>

                                                <span><strong>Peringatan Integritas:</strong> Harap tetap fokus pada area kuis. Selesaikan dengan integritas diri.</span>

                                            </div>

                                        )}



                                        {selectedQuiz ? (

                                            <div

                                                ref={inlineQuizContainerRef}

                                                className={`inline-quiz-fullscreen ${isQuizActive ? 'quiz-active' : ''} ${!isMouseInQuizArea && isQuizActive ? 'quiz-mouse-left' : ''}`}

                                            >

                                                {/* Quiz Start Screen */}

                                                {!isQuizActive && !showQuizResult && selectedQuiz && (() => {

                                                    const isPreTest = selectedQuiz.quiz_type === 'pre_post_test' && (!selectedQuiz.has_pre_test || selectedQuiz.current_mode === 'pre_test');

                                                    const isPostTest = selectedQuiz.quiz_type === 'pre_post_test' && (selectedQuiz.has_pre_test || selectedQuiz.current_mode === 'post_test');

                                                    

                                                    return (

                                                    <div className="quiz-start-screen-inline">

                                                        <div className="quiz-intro-header">

                                                            <div className="quiz-intro-header-content">

                                                                <div className={`quiz-intro-icon-box ${isPreTest ? 'pretest' : isPostTest ? 'posttest' : ''}`}>

                                                                    <i className={`fas ${isPreTest ? 'fa-clipboard-check' : isPostTest ? 'fa-award' : 'fa-brain'}`}></i>

                                                                </div>

                                                                <div className="quiz-intro-title-wrapper">

                                                                    <div className="d-flex align-items-center gap-2 flex-wrap mb-1">

                                                                        <h4 className="quiz-intro-title mb-0">{selectedQuiz.title}</h4>

                                                                        {isPreTest ? (

                                                                            <span className="badge-quiz-mode pretest"><i className="fas fa-clipboard-check me-1"></i>Pre-test Diagnostik</span>

                                                                        ) : isPostTest ? (

                                                                            <span className="badge-quiz-mode posttest"><i className="fas fa-award me-1"></i>Post-test Evaluasi Akhir</span>

                                                                        ) : (

                                                                            <span className="badge-quiz-mode regular"><i className="fas fa-question-circle me-1"></i>Kuis Pembelajaran</span>

                                                                        )}

                                                                    </div>

                                                                    <small className="quiz-intro-description">

                                                                        {isPreTest 

                                                                            ? "Pre-test diagnostik ini menguji pemahaman awal Anda sebelum memulai materi kursus. Tidak ada syarat nilai kelulusan minimal."

                                                                            : isPostTest 

                                                                                ? "Evaluasi akhir untuk mengukur peningkatan kompetensi Anda setelah menyelesaikan seluruh materi kurikulum dan kuis kursus."

                                                                                : (selectedQuiz.description || "Uji pemahaman Anda tentang materi kursus")}

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

                                                                    <i className={`fas ${isPreTest ? 'fa-check text-success' : 'fa-trophy text-amber'}`}></i>

                                                                    <span className="info-number">{isPreTest ? "Bebas" : "80%"}</span>

                                                                    <span className="info-label">{isPreTest ? "Tanpa Batas Nilai" : "Skor Lulus"}</span>

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

                                                                <h6>Aturan {isPreTest ? "Pre-test" : isPostTest ? "Post-test" : "Kuis"}:</h6>

                                                                <ul>

                                                                    <li>Anda memiliki 1 menit per pertanyaan</li>

                                                                    {isPreTest ? (

                                                                        <>

                                                                            <li><strong>Tidak ada batas nilai kelulusan minimal.</strong> Pre-test ini murni diagnostik untuk mengukur pemahaman awal Anda.</li>

                                                                            <li>Setelah Anda menyelesaikan Pre-test, seluruh materi kurikulum kursus akan langsung terbuka.</li>

                                                                        </>

                                                                    ) : isPostTest ? (

                                                                        <>

                                                                            <li>Post-test mengevaluasi peningkatan kompetensi akhir Anda dibandingkan dengan hasil Pre-test.</li>

                                                                            <li>Penyelesaian Post-test merupakan syarat wajib untuk menerbitkan sertifikat resmi.</li>

                                                                        </>

                                                                    ) : (

                                                                        <>

                                                                            <li>Anda perlu 80% untuk lulus kuis ini</li>

                                                                            <li>Anda dapat mencoba kuis ini maksimal 3 kali per hari</li>

                                                                        </>

                                                                    )}

                                                                    <li>Setelah dimulai, Anda tidak dapat menjeda tes</li>

                                                                </ul>

                                                            </div>



                                                            <div className="quiz-start-actions">

                                                                <button className="btn btn-secondary btn-sm" onClick={handleQuizClose}>

                                                                    <i className="fas fa-arrow-left me-1"></i>

                                                                    Tutup

                                                                </button>

                                                                {selectedQuiz.can_attempt ? (

                                                                    <button className="btn btn-teal btn-sm" onClick={startQuiz}>

                                                                        <i className="fas fa-play me-1"></i>

                                                                        {isPreTest ? "Mulai Pre-test Sekarang" : isPostTest ? "Mulai Post-test Sekarang" : "Mulai Kuis"}

                                                                    </button>

                                                                ) : (

                                                                    <button className="btn btn-secondary btn-sm" disabled>

                                                                        <i className="fas fa-ban me-1"></i>

                                                                        Batas Harian Tercapai

                                                                    </button>

                                                                )}

                                                            </div>

                                                        </div>

                                                    </div>

                                                    );

                                                })()}



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

                                                                        className="btn btn-sm btn-outline-primary"

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

                                                                        <i className="fas fa-arrow-left me-1"></i>

                                                                        Sebelumnya

                                                                    </button>



                                                                    {currentQuestionIndex < (selectedQuiz.questions?.length || 0) - 1 ? (

                                                                        <button

                                                                            className="btn btn-sm btn-primary"

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

                                                                            <i className="fas fa-arrow-right ms-1"></i>

                                                                        </button>

                                                                    ) : (

                                                                        <button

                                                                            className="btn btn-sm btn-success"

                                                                            onClick={submitQuiz}

                                                                        >

                                                                            <i className="fas fa-check me-1"></i>

                                                                            Kirim Kuis

                                                                        </button>

                                                                    )}

                                                                </div>

                                                            </div>

                                                        )}

                                                    </div>

                                                )}



                                                {/* Quiz Result Screen */}

                                                {showQuizResult && quizResult && (() => {

                                                    const isPreTest = selectedQuiz?.quiz_type === 'pre_post_test' && (!selectedQuiz?.has_pre_test || selectedQuiz?.current_mode === 'pre_test' || quizResult?.is_pre_test);

                                                    const isPostTest = selectedQuiz?.quiz_type === 'pre_post_test' && (selectedQuiz?.has_pre_test || selectedQuiz?.current_mode === 'post_test' || quizResult?.is_post_test);



                                                    return (

                                                    <div className="quiz-result-screen-inline">

                                                        <div className="quiz-result-header-top">

                                                            <div className="quiz-result-header-content d-flex align-items-center gap-2">

                                                                <div className={`quiz-result-icon-box ${isPreTest || quizResult.passed ? "success" : "failure"}`}>

                                                                    <i className={`fas ${isPreTest ? "fa-clipboard-check" : quizResult.passed ? "fa-trophy" : "fa-times-circle"}`}></i>

                                                                </div>

                                                                <div className="quiz-result-title-wrapper">

                                                                    <h4 className="quiz-result-title">{selectedQuiz?.title}</h4>

                                                                    <small className="quiz-result-description">

                                                                        {isPreTest 

                                                                            ? "Pre-test selesai! Pemahaman awal Anda telah tercatat dan kurikulum kursus kini telah terbuka."

                                                                            : isPostTest

                                                                                ? "Post-test selesai! Evaluasi akhir Anda telah tercatat dan syarat sertifikat telah terpenuhi."

                                                                                : (quizResult.passed ? "Selamat! Anda telah berhasil lulus kuis ini!" : "Teruslah berlatih untuk hasil yang lebih baik")}

                                                                    </small>

                                                                </div>

                                                            </div>

                                                        </div>



                                                        <div className="quiz-result">

                                                            <div className="quiz-result-status">

                                                                <h5 className={`quiz-result-status-title ${isPreTest || quizResult.passed ? "text-success" : "text-danger"}`}>

                                                                    {isPreTest ? "✅ Pre-test Berhasil Diselesaikan!" : isPostTest ? "🎉 Post-test Berhasil Diselesaikan!" : quizResult.passed ? "🎉 Selamat! Kuis Lulus" : "❌ Kuis Belum Lulus"}

                                                                </h5>

                                                                <p className="quiz-result-status-message">

                                                                    {isPreTest

                                                                        ? "Hasil diagnostik pemahaman awal Anda berhasil disimpan. Anda kini dapat mulai mempelajari materi pada kurikulum."

                                                                        : isPostTest

                                                                            ? "Rangkaian evaluasi akhir Anda telah tuntas. Anda kini dapat menerbitkan sertifikat resmi kursus ini."

                                                                            : quizResult.passed

                                                                                ? "Anda telah berhasil lulus kuis ini dengan baik!"

                                                                                : "Anda membutuhkan 80% atau lebih untuk lulus kuis ini. Silakan review materi dan coba lagi!"}

                                                                </p>

                                                            </div>



                                                            <div className="quiz-result-stats-cards">

                                                                <div className="result-stat-card">

                                                                    <i className="fas fa-percent"></i>

                                                                    <span className="stat-label">Skor</span>

                                                                    <span className={`stat-number ${isPreTest || quizResult.passed ? "text-success" : "text-danger"}`}>

                                                                        {Math.round(quizResult.score)}%

                                                                    </span>

                                                                </div>

                                                                <div className="result-stat-card">

                                                                    <i className="fas fa-check-circle"></i>

                                                                    <span className="stat-label">Benar</span>

                                                                    <span className="stat-number">

                                                                        {quizResult.correct_answers}/{quizResult.total_questions}

                                                                    </span>

                                                                </div>

                                                                <div className="result-stat-card">

                                                                    <i className="fas fa-hourglass-end"></i>

                                                                    <span className="stat-label">Waktu</span>

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

                                                                    <span className="stat-label">Sisa</span>

                                                                    <span className={`stat-number ${quizResult.attempts_left === 0 ? "text-danger" : "text-warning"}`}>

                                                                        {quizResult.attempts_left || 0}

                                                                    </span>

                                                                </div>

                                                            </div>



                                                            <div className="quiz-result-summary">

                                                                <i className={`fas ${isPreTest || quizResult.passed ? "fa-lightbulb text-amber" : "fa-info-circle text-teal-accent"} me-2`}></i>

                                                                <p className="summary-text">

                                                                    {isPreTest

                                                                        ? "Akses materi pembelajaran telah dibuka. Silakan lanjutkan ke Kurikulum Kursus untuk mulai belajar."

                                                                        : isPostTest

                                                                            ? "Evaluasi pembelajaran lengkap! Silakan buka Tab Sertifikat untuk mengunduh sertifikat resmi."

                                                                            : quizResult.passed

                                                                                ? "Nilai sempurna! Lanjutkan dengan kuis berikutnya atau review materi."

                                                                                : `Anda mendapat ${Math.round(quizResult.score)}%. Coba lagi untuk mencapai skor lulus minimal 80%.`}

                                                                </p>

                                                            </div>



                                                            <div className="quiz-result-actions">

                                                                {isPreTest ? (

                                                                    <button

                                                                        className="btn btn-sm btn-teal"

                                                                        onClick={() => {

                                                                            handleQuizClose();

                                                                            setActiveTab('lectures');

                                                                        }}

                                                                    >

                                                                        <i className="fas fa-play me-1"></i>

                                                                        Mulai Pelajari Materi Kursus

                                                                    </button>

                                                                ) : isPostTest ? (

                                                                    <button

                                                                        className="btn btn-sm btn-teal"

                                                                        onClick={() => {

                                                                            handleQuizClose();

                                                                            setActiveTab('certificate');

                                                                        }}

                                                                    >

                                                                        <i className="fas fa-award me-1"></i>

                                                                        Lihat & Terbitkan Sertifikat

                                                                    </button>

                                                                ) : (

                                                                    <>

                                                                        <button

                                                                            className="btn btn-sm btn-secondary"

                                                                            onClick={handleQuizClose}

                                                                        >

                                                                            <i className="fas fa-arrow-left me-1"></i>

                                                                            Tutup

                                                                        </button>

                                                                        {quizResult.attempts_left !== undefined && quizResult.attempts_left > 0 && !quizResult.passed && (

                                                                            <button

                                                                                className="btn btn-sm btn-primary"

                                                                                onClick={() => {

                                                                                    handleQuizShow(selectedQuiz);

                                                                                }}

                                                                            >

                                                                                <i className="fas fa-redo me-1"></i>

                                                                                Coba Lagi

                                                                            </button>

                                                                        )}

                                                                    </>

                                                                )}

                                                            </div>

                                                        </div>

                                                    </div>

                                                    );

                                                })()}

                                            </div>

                                        ) : (

                                            <div className="quiz-player-standby">

                                                <div className="quiz-standby-content">

                                                    <div className="quiz-standby-icon">

                                                        <i className="fas fa-brain"></i>

                                                    </div>

                                                    <h5 className="quiz-standby-title">Evaluasi & Kuis Kursus</h5>

                                                    <p className="quiz-standby-subtitle">

                                                        Pilih kuis dari daftar di sebelah kanan untuk menguji pemahaman materi kursus Anda.

                                                        Setiap kuis memerlukan skor kelulusan minimal 80% untuk memenuhi syarat penerbitan sertifikat resmi.

                                                    </p>

                                                    <div className="quiz-standby-stats-strip">

                                                        <span className="quiz-standby-chip">

                                                            <i className="fas fa-check-circle text-teal-accent me-1"></i>

                                                            {completionStats.passedQuizzes} dari {quizzes?.length || 0} Kuis Lulus

                                                        </span>

                                                        <span className="quiz-standby-chip">

                                                            <i className="fas fa-redo text-amber me-1"></i>

                                                            Maks. 3x Percobaan / Hari

                                                        </span>

                                                        <span className="quiz-standby-chip">

                                                            <i className="fas fa-trophy text-amber me-1"></i>

                                                            Passing Grade: 80%

                                                        </span>

                                                    </div>

                                                    <div className="d-flex align-items-center justify-content-center gap-2 mt-2 flex-wrap">

                                                        {quizzes && quizzes.length > 0 && (

                                                            <button

                                                                type="button"

                                                                className="btn btn-sm btn-teal"

                                                                onClick={() => {

                                                                    const nextQuiz = quizzes.find(q => !q.is_passed) || quizzes[0];

                                                                    if (nextQuiz) handleQuizShow(nextQuiz);

                                                                }}

                                                            >

                                                                <i className="fas fa-play me-1"></i>

                                                                {quizzes.some(q => !q.is_passed) ? "Mulai Kuis Berikutnya" : "Buka Kuis"}

                                                            </button>

                                                        )}

                                                        <button

                                                            type="button"

                                                            className="btn btn-sm btn-outline-secondary"

                                                            onClick={handleReturnToLessons}

                                                        >

                                                            <i className="fas fa-arrow-left me-1"></i>Kembali ke Materi Pelajaran

                                                        </button>

                                                    </div>

                                                </div>

                                            </div>

                                        )}

                                    </div>
                                    )}

                                    {activeTab !== 'certificate' && activeTab !== 'review' && activeTab !== 'quiz' && (
<div

                                        ref={videoPlayerContainerRef}

                                        className="course-player-column"

                                    >

                                        {pretestRequired && !hasCompletedPretest ? (

                                            <div className="course-player-standby pretest-required-standby">

                                                <div className="standby-content">

                                                    <div className="standby-icon-circle pretest-circle">

                                                        <i className="fas fa-clipboard-check"></i>

                                                    </div>

                                                    <h5 className="standby-title">Pre-test Diagnostik Wajib</h5>

                                                    <p className="standby-subtitle">

                                                        Akses kurikulum dan materi pembelajaran akan terbuka setelah Anda menyelesaikan Pre-test ini. 

                                                        Pre-test bertujuan menguji pemahaman awal sebelum memulai dan <strong>tidak memiliki syarat nilai kelulusan minimal</strong>.

                                                    </p>

                                                    <button

                                                        type="button"

                                                        className="btn btn-sm btn-teal mt-2 fw-bold px-3 py-2"

                                                        onClick={handleStartPretest}

                                                    >

                                                        <i className="fas fa-play me-1"></i>

                                                        Mulai Kerjakan Pre-test Sekarang

                                                    </button>

                                                </div>

                                            </div>

                                        ) : (

                                            <>

                                                <div style={{ display: variantItem ? 'block' : 'none', width: '100%', height: '100%' }}>

                                                    {variantItem?.file_type === 'scorm' || variantItem?.file_type === 'h5p' || variantItem?.learning_module_info ? (

                                                        <ScormPlayer

                                                            variantItem={variantItem}

                                                            courseId={course?.course?.id}

                                                            course={course}

                                                            onClose={handleVideoPlayerClose}

                                                            handleMarkLessonAsCompleted={handleMarkLessonAsCompletedCallback}

                                                        />

                                                    ) : (

                                                        <VideoPlayer

                                                            ref={videoPlayerRef}

                                                            variantItem={variantItem}

                                                            courseId={course?.course?.id}

                                                            course={course}

                                                            onClose={handleVideoPlayerClose}

                                                            handleMarkLessonAsCompleted={handleMarkLessonAsCompletedCallback}

                                                            autoplay={autoplayVideo}

                                                            onPlayingChange={setIsVideoPlaying}

                                                            onProgress={handleVideoProgress}

                                                            seekPosition={seekPosition}

                                                        />

                                                    )}

                                                </div>

                                                {!variantItem && (

                                                    <div className="course-player-standby">

                                                        <div className="standby-content">

                                                            <div className="standby-icon-circle">

                                                                <i className="fas fa-play"></i>

                                                            </div>

                                                            <h5 className="standby-title">Pilih Materi Pembelajaran</h5>

                                                            <p className="standby-subtitle">

                                                                Silakan pilih salah satu materi pada Kurikulum Kursus di sebelah kanan untuk memulai pemutaran.

                                                            </p>

                                                        </div>

                                                    </div>

                                                )}

                                            </>

                                        )}

                                    </div>
                                    )}

                                    {/* 2. Modern Tabs: Sejajar dan Tepat Berada di Bawah certificate-display-column & course-player-column */}
<div className="modern-tabs">

                                {/* Tab Navigation */}

                                <ul className="nav nav-tabs nav-tabs-modern" id="courseTab" role="tablist">

                                    <li className="nav-item" role="presentation">

                                        <button className="nav-link active" id="notes-tab" data-bs-toggle="tab" data-bs-target="#notes" type="button" role="tab">

                                            <i className="fas fa-sticky-note me-1"></i>

                                            <span>Catatan</span>

                                            {course?.note?.length > 0 && (

                                                <span className="tab-pill-counter">{course.note.length}</span>

                                            )}

                                        </button>

                                    </li>

                                    <li className="nav-item" role="presentation">

                                        <button className="nav-link" id="discussions-tab" data-bs-toggle="tab" data-bs-target="#discussions" type="button" role="tab">

                                            <i className="fas fa-comments me-1"></i>

                                            <span>Diskusi</span>

                                            {questions?.length > 0 && (

                                                <span className="tab-pill-counter">{questions.length}</span>

                                            )}

                                        </button>

                                    </li>

                                    <li className="nav-item" role="presentation">

                                        <button className="nav-link" id="certificate-tab" data-bs-toggle="tab" data-bs-target="#certificate" type="button" role="tab">

                                            <i className="fas fa-certificate me-1"></i>

                                            <span>Sertifikat</span>

                                            {existingCertificate ? (

                                                <span className="tab-pill-counter counter-success"><i className="fas fa-check"></i></span>

                                            ) : completionPercentage === 100 ? (

                                                <span className="tab-pill-counter counter-ready"><i className="fas fa-award"></i></span>

                                            ) : null}

                                        </button>

                                    </li>



                                </ul>



                                {/* Tab Content */}

                                <div className="tab-content tab-content-modern" id="courseTabContent">

                                    {/* Notes Tab (Modularized in NotesTab.jsx) */}



                                    <NotesTab



                                        course={course}



                                        handleNoteShow={handleNoteShow}



                                        noteFilters={noteFilters}



                                        setNoteFilters={setNoteFilters}



                                        filteredNotes={filteredNotes}



                                        openNotes={openNotes}



                                        setOpenNotes={setOpenNotes}



                                        getColorVariations={getColorVariations}



                                        handleDeleteNote={handleDeleteNote}



                                    />

{/* Discussions Tab (Modularized in DiscussionTab.jsx) */}

                                    <DiscussionTab

                                        course={course}

                                        openedQuestionId={openedQuestionId}

                                        selectedConversation={selectedConversation}

                                        handleConversationClose={handleConversationClose}

                                        handleConversationShow={handleConversationShow}

                                        handleQuestionShow={handleQuestionShow}

                                        qaStats={qaStats}

                                        discussionFilters={discussionFilters}

                                        setDiscussionFilters={setDiscussionFilters}

                                        filteredQuestions={filteredQuestions}

                                        handleToggleSolution={handleToggleSolution}

                                        handleTogglePin={handleTogglePin}

                                        handleLikeQuestion={handleLikeQuestion}

                                        handleLikeMessage={handleLikeMessage}

                                        userLikedQuestions={userLikedQuestions}

                                        userLikedMessages={userLikedMessages}

                                        isQAItemReported={isQAItemReported}

                                        getQAReportStatus={getQAReportStatus}

                                        handleOpenQAReportModal={handleOpenQAReportModal}

                                        createMessage={createMessage}

                                        setCreateMessage={setCreateMessage}

                                        handleMessageChange={handleMessageChange}

                                        sendNewMessage={sendNewMessage}

                                        isSubmittingReply={isSubmittingReply}

                                        activeVariantItem={variantItem}

                                        replyTextareaRef={replyTextareaRef}

                                        replyPreviewMode={replyPreviewMode}

                                        setReplyPreviewMode={setReplyPreviewMode}

                                        getCurrentVideoTime={getCurrentVideoTime}

                                        handleJumpToVideoTimestamp={handleJumpToVideoTimestamp}

                                        isCourseInstructorOrStaff={isCourseInstructorOrStaff}

                                    />






                                    {/* Certificate Tab */}

                                    <div className="tab-pane fade" id="certificate" role="tabpanel">

                                        <div className="cert-active-notice-card">

                                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">

                                                <div className="d-flex align-items-center gap-3">

                                                    <div className="notice-icon-box">

                                                        <i className="fas fa-award"></i>

                                                    </div>

                                                    <div>

                                                        <h6 className="mb-0">Panel Sertifikat Aktif di Atas</h6>

                                                        <small className="text-muted">Pratinjau sertifikat resmi dan informasi kelulusan ditampilkan pada panel 2-kolom di atas.</small>

                                                    </div>

                                                </div>

                                                <button

                                                    type="button"

                                                    className="btn btn-sm btn-outline-teal"

                                                    onClick={() => {

                                                        document.querySelector('.course-certificate-review-row')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

                                                    }}

                                                >

                                                    <i className="fas fa-arrow-up me-1"></i>Ke Pratinjau Sertifikat

                                                </button>

                                            </div>

                                        </div>

                                    </div>





                                </div>

                            </div>

                                </div>

                                {/* Right Sidebar Column: Certificate Sidebar / Quiz Sidebar / Curriculum */}

                                <div className="course-sidebar-right-column">

                                    {(activeTab === 'certificate' || activeTab === 'review') && (
<div className="certificate-sidebar-column">

                                        <div className="certificate-side-card">

                                            {/* Header Pills for Switching between Sertifikat & Ulasan */}

                                            <div className="cert-side-nav-pills">

                                                <button

                                                    type="button"

                                                    className={`cert-pill-btn ${activeTab === 'certificate' ? 'active' : ''}`}

                                                    onClick={() => handleSwitchCertSideTab('certificate')}

                                                >

                                                    <i className="fas fa-certificate me-1"></i>

                                                    <span>Sertifikat</span>

                                                    {existingCertificate ? (

                                                        <span className="cert-pill-badge badge-success"><i className="fas fa-check"></i></span>

                                                    ) : completionPercentage === 100 ? (

                                                        <span className="cert-pill-badge badge-ready"><i className="fas fa-award"></i></span>

                                                    ) : null}

                                                </button>

                                                <button

                                                    type="button"

                                                    className={`cert-pill-btn ${activeTab === 'review' ? 'active' : ''}`}

                                                    onClick={() => handleSwitchCertSideTab('review')}

                                                >

                                                    <i className="fas fa-star me-1"></i>

                                                    <span>Ulasan Kursus</span>

                                                    {(studentReview?.id || studentReview?.rating) && (

                                                        <span className="cert-pill-badge badge-info"><i className="fas fa-check"></i></span>

                                                    )}

                                                </button>

                                            </div>



                                            {/* Content Area */}

                                            <div className="cert-side-body">

                                                {activeTab === 'certificate' ? (

                                                    <div className="cert-side-pane">

                                                        <CertificateTab

                                                            course={course}

                                                            enrollmentId={param.enrollment_id}

                                                            completionPercentage={completionPercentage}

                                                            onCertificateGenerated={(cert) => setExistingCertificate(cert)}

                                                            isInline={true}

                                                            onStartPosttest={handleStartPosttest}

                                                        />

                                                    </div>

                                                ) : (

                                                    <div className="cert-side-pane">

                                                        {renderReviewContent()}

                                                    </div>

                                                )}

                                            </div>

                                        </div>

                                    </div>
                                    )}

                                    {activeTab === 'quiz' && (
<div className="quiz-sidebar-column">

                                        <div className="quiz-sidebar-card">

                                            <div className="quiz-sidebar-header">

                                                <div className="d-flex align-items-center gap-2">

                                                    <i className="fas fa-brain text-teal-accent"></i>

                                                    <span className="quiz-sidebar-title">Daftar Kuis Kursus</span>

                                                </div>

                                                <span className="quiz-header-counter-badge">

                                                    {completionStats.passedQuizzes}/{quizzes?.length || 0} Lulus

                                                </span>

                                            </div>



                                            <div className="quiz-sidebar-list">

                                                {/* Group 1: Pre-test & Post-test Diagnostik */}

                                                {hasPrePostTest && prePostQuiz && (

                                                    <div className="quiz-group-container mb-3">

                                                        <div className="quiz-group-header">

                                                            <i className="fas fa-clipboard-check text-amber me-1"></i>

                                                            <span>Evaluasi Diagnostik & Akhir</span>

                                                        </div>

                                                        

                                                        {/* Pre-test Card */}

                                                        <div

                                                            className={`quiz-sidebar-item ${selectedQuiz?.quiz_id === prePostQuiz.quiz_id && (!prePostQuiz.has_pre_test || selectedQuiz?.current_mode === 'pre_test') ? 'active' : ''} ${hasCompletedPretest ? 'passed' : 'pending-test'}`}

                                                            onClick={() => {

                                                                if (isQuizActive && selectedQuiz?.quiz_id !== prePostQuiz.quiz_id) {

                                                                    Swal.fire({

                                                                        title: 'Kuis Sedang Berjalan',

                                                                        text: 'Harap selesaikan kuis yang sedang aktif terlebih dahulu.',

                                                                        icon: 'warning',

                                                                        confirmButtonText: 'Oke'

                                                                    });

                                                                    return;

                                                                }

                                                                handleQuizShow({ ...prePostQuiz, current_mode: 'pre_test' });

                                                            }}

                                                        >

                                                            <div className="quiz-item-indicator">

                                                                {hasCompletedPretest ? (

                                                                    <i className="fas fa-check-circle text-success"></i>

                                                                ) : (

                                                                    <i className="fas fa-clipboard-check text-amber"></i>

                                                                )}

                                                            </div>

                                                            <div className="quiz-item-info">

                                                                <div className="quiz-item-title-row">

                                                                    <span className="quiz-item-title">Pre-test Diagnostik Awal</span>

                                                                    {hasCompletedPretest ? (

                                                                        <span className="badge-quiz-passed">

                                                                            <i className="fas fa-check me-1"></i>Selesai ({Math.round(prePostQuiz.pre_test_score || 0)}%)

                                                                        </span>

                                                                    ) : (

                                                                        <span className="badge-quiz-required">

                                                                            <i className="fas fa-exclamation me-1"></i>Wajib

                                                                        </span>

                                                                    )}

                                                                </div>

                                                                <div className="quiz-item-meta">

                                                                    <span><i className="fas fa-question-circle me-1"></i>{prePostQuiz.total_questions} Soal</span>

                                                                    <span><i className="fas fa-info-circle me-1 text-teal-accent"></i>Diagnostik</span>

                                                                    <span><i className="fas fa-check-circle me-1 text-success"></i>Bebas Nilai</span>

                                                                </div>

                                                                <div className="quiz-item-footer">

                                                                    <span className="quiz-item-attempts">

                                                                        {hasCompletedPretest ? "Tercatat sebelum materi" : "Wajib untuk buka materi"}

                                                                    </span>

                                                                    <button

                                                                        type="button"

                                                                        className={`btn-quiz-item-action ${hasCompletedPretest ? 'btn-outline-teal' : 'btn-amber'}`}

                                                                    >

                                                                        {hasCompletedPretest ? "Lihat" : "Kerjakan"}

                                                                    </button>

                                                                </div>

                                                            </div>

                                                        </div>



                                                        {/* Post-test Card */}

                                                        <div

                                                            className={`quiz-sidebar-item ${selectedQuiz?.quiz_id === prePostQuiz.quiz_id && (prePostQuiz.has_pre_test || selectedQuiz?.current_mode === 'post_test') ? 'active' : ''} ${hasCompletedPosttest ? 'passed' : !canTakePostTest ? 'quiz-item-locked' : 'pending-test'}`}

                                                            onClick={() => {

                                                                if (!canTakePostTest && !hasCompletedPosttest) {

                                                                    Toast().fire({

                                                                        icon: 'warning',

                                                                        title: 'Post-test Terkunci',

                                                                        text: 'Selesaikan semua materi pelajaran dan kuis kursus terlebih dahulu untuk membuka Post-test.',

                                                                        timer: 4000

                                                                    });

                                                                    return;

                                                                }

                                                                if (isQuizActive && selectedQuiz?.quiz_id !== prePostQuiz.quiz_id) {

                                                                    Swal.fire({

                                                                        title: 'Kuis Sedang Berjalan',

                                                                        text: 'Harap selesaikan kuis yang sedang aktif terlebih dahulu.',

                                                                        icon: 'warning'

                                                                    });

                                                                    return;

                                                                }

                                                                handleQuizShow({ ...prePostQuiz, current_mode: 'post_test' });

                                                            }}

                                                        >

                                                            <div className="quiz-item-indicator">

                                                                {hasCompletedPosttest ? (

                                                                    <i className="fas fa-check-circle text-success"></i>

                                                                ) : canTakePostTest ? (

                                                                    <i className="fas fa-award text-amber"></i>

                                                                ) : (

                                                                    <i className="fas fa-lock text-muted"></i>

                                                                )}

                                                            </div>

                                                            <div className="quiz-item-info">

                                                                <div className="quiz-item-title-row">

                                                                    <span className="quiz-item-title">Post-test Evaluasi Akhir</span>

                                                                    {hasCompletedPosttest ? (

                                                                        <span className="badge-quiz-passed">

                                                                            <i className="fas fa-check me-1"></i>Selesai ({Math.round(prePostQuiz.post_test_score || 0)}%)

                                                                        </span>

                                                                    ) : canTakePostTest ? (

                                                                        <span className="badge-quiz-unlocked">

                                                                            <i className="fas fa-unlock me-1"></i>Siap

                                                                        </span>

                                                                    ) : (

                                                                        <span className="badge-quiz-locked">

                                                                            <i className="fas fa-lock me-1"></i>Terkunci

                                                                        </span>

                                                                    )}

                                                                </div>

                                                                <div className="quiz-item-meta">

                                                                    <span><i className="fas fa-question-circle me-1"></i>{prePostQuiz.total_questions} Soal</span>

                                                                    <span><i className="fas fa-certificate me-1 text-amber"></i>Syarat Sertifikat</span>

                                                                </div>

                                                                <div className="quiz-item-footer">

                                                                    <span className="quiz-item-attempts">

                                                                        {hasCompletedPosttest 

                                                                            ? `Gain: ${prePostQuiz.post_test_score - prePostQuiz.pre_test_score >= 0 ? '+' : ''}${Math.round((prePostQuiz.post_test_score || 0) - (prePostQuiz.pre_test_score || 0))}%`

                                                                            : canTakePostTest 

                                                                                ? "Siap dikerjakan sekarang" 

                                                                                : "Buka setelah materi tuntas"}

                                                                    </span>

                                                                    <button

                                                                        type="button"

                                                                        className={`btn-quiz-item-action ${hasCompletedPosttest ? 'btn-outline-teal' : canTakePostTest ? 'btn-teal' : 'btn-secondary disabled'}`}

                                                                        disabled={!canTakePostTest && !hasCompletedPosttest}

                                                                    >

                                                                        {hasCompletedPosttest ? "Lihat" : canTakePostTest ? "Mulai" : "Terkunci"}

                                                                    </button>

                                                                </div>

                                                            </div>

                                                        </div>

                                                    </div>

                                                )}



                                                {/* Group 2: Kuis Pembelajaran (Kuis Modul / Topik) */}

                                                <div className="quiz-group-container">

                                                    {hasPrePostTest && (

                                                        <div className="quiz-group-header">

                                                            <i className="fas fa-brain text-teal-accent me-1"></i>

                                                            <span>Kuis Pembelajaran (Materi)</span>

                                                        </div>

                                                    )}

                                                    {regularQuizzes.length > 0 ? (

                                                        regularQuizzes.map((quiz, index) => {

                                                            const isSelected = selectedQuiz?.quiz_id === quiz.quiz_id;

                                                            const hasProgress = hasQuizProgress(quiz);

                                                            const isLocked = (pretestRequired && !hasCompletedPretest) || (index > 0 && !regularQuizzes[index - 1].is_passed);

                                                            const lockReason = (pretestRequired && !hasCompletedPretest)

                                                                ? "Selesaikan Pre-test terlebih dahulu untuk membuka kuis ini."

                                                                : (index > 0 && !regularQuizzes[index - 1].is_passed)

                                                                    ? `Luluskan kuis sebelumnya (${regularQuizzes[index - 1].title}) terlebih dahulu.`

                                                                    : "";



                                                            return (

                                                                <div

                                                                    key={quiz.quiz_id}

                                                                    className={`quiz-sidebar-item ${isSelected ? 'active' : ''} ${quiz.is_passed ? 'passed' : ''} ${isLocked ? 'quiz-item-locked' : ''}`}

                                                                    onClick={() => {

                                                                        if (isLocked) {

                                                                            Toast().fire({

                                                                                icon: 'warning',

                                                                                title: 'Kuis Terkunci',

                                                                                text: lockReason,

                                                                                timer: 4000

                                                                            });

                                                                            return;

                                                                        }

                                                                        if (isQuizActive && selectedQuiz?.quiz_id !== quiz.quiz_id) {

                                                                            Swal.fire({

                                                                                title: 'Kuis Sedang Berjalan',

                                                                                text: 'Harap selesaikan kuis yang sedang aktif terlebih dahulu.',

                                                                                icon: 'warning'

                                                                            });

                                                                            return;

                                                                        }

                                                                        handleQuizShow(quiz);

                                                                    }}

                                                                >

                                                                    <div className="quiz-item-indicator">

                                                                        {isLocked ? (

                                                                            <i className="fas fa-lock text-muted"></i>

                                                                        ) : quiz.is_passed ? (

                                                                            <i className="fas fa-check-circle text-success"></i>

                                                                        ) : hasProgress ? (

                                                                            <i className="fas fa-play-circle text-info"></i>

                                                                        ) : quiz.best_score > 0 ? (

                                                                            <i className="fas fa-redo text-amber"></i>

                                                                        ) : (

                                                                            <i className="fas fa-question-circle text-muted"></i>

                                                                        )}

                                                                    </div>

                                                                    <div className="quiz-item-info">

                                                                        <div className="quiz-item-title-row">

                                                                            <span className="quiz-item-title" title={quiz.title}>

                                                                                {quiz.title}

                                                                            </span>

                                                                            {isLocked ? (

                                                                                <span className="badge-quiz-locked">

                                                                                    <i className="fas fa-lock me-1"></i>Terkunci

                                                                                </span>

                                                                            ) : quiz.is_passed ? (

                                                                                <span className="badge-quiz-passed">

                                                                                    <i className="fas fa-check me-1"></i>Lulus

                                                                                </span>

                                                                            ) : null}

                                                                        </div>

                                                                        <div className="quiz-item-meta">

                                                                            <span><i className="fas fa-question-circle me-1"></i>{quiz.total_questions} Soal</span>

                                                                            <span><i className="fas fa-clock me-1"></i>{quiz.total_questions} Mnt</span>

                                                                            <span><i className="fas fa-trophy me-1 text-amber"></i>{Math.round(quiz.best_score || 0)}%</span>

                                                                        </div>

                                                                        <div className="quiz-item-footer">

                                                                            <span className="quiz-item-attempts">

                                                                                <i className="fas fa-redo me-1"></i>{quiz.today_attempts || 0}/3 Percobaan

                                                                            </span>

                                                                            <button

                                                                                type="button"

                                                                                className={`btn-quiz-item-action ${

                                                                                    isLocked

                                                                                        ? 'btn-secondary disabled'

                                                                                        : quiz.is_passed

                                                                                            ? 'btn-outline-teal'

                                                                                            : isSelected && isQuizActive

                                                                                                ? 'btn-amber'

                                                                                                : 'btn-teal'

                                                                                }`}

                                                                                disabled={isLocked || (!quiz.can_attempt && !hasProgress)}

                                                                            >

                                                                                {isLocked ? (

                                                                                    <span>Terkunci</span>

                                                                                ) : !quiz.can_attempt && !hasProgress ? (

                                                                                    <span>Limit 3/3</span>

                                                                                ) : isSelected && isQuizActive ? (

                                                                                    <span><i className="fas fa-spinner fa-spin me-1"></i>Aktif</span>

                                                                                ) : hasProgress ? (

                                                                                    <span><i className="fas fa-play me-1"></i>Lanjut</span>

                                                                                ) : quiz.best_score > 0 ? (

                                                                                    <span><i className="fas fa-redo me-1"></i>Ulang</span>

                                                                                ) : (

                                                                                    <span><i className="fas fa-play me-1"></i>Mulai</span>

                                                                                )}

                                                                            </button>

                                                                        </div>

                                                                    </div>

                                                                </div>

                                                            );

                                                        })

                                                    ) : (

                                                        <div className="quiz-sidebar-empty">

                                                            <i className="fas fa-brain"></i>

                                                            <p>Tidak ada kuis pembelajaran untuk kursus ini.</p>

                                                        </div>

                                                    )}

                                                </div>

                                            </div>

                                        </div>

                                    </div>
                                    )}

                                    {activeTab !== 'certificate' && activeTab !== 'review' && activeTab !== 'quiz' && (
<div className="course-curriculum-column">

                                        <div className="curriculum-side-card">

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

                                                hasCompletedPretest={hasCompletedPretest}

                                                pretestRequired={pretestRequired}

                                                onStartPretest={handleStartPretest}

                                                prePostQuiz={prePostQuiz}

                                                canTakePostTest={canTakePostTest}

                                                hasCompletedPosttest={hasCompletedPosttest}

                                                quizzes={quizzes}

                                                selectedQuiz={selectedQuiz}

                                                onSelectQuiz={handleQuizShow}

                                            />

                                        </div>

                                    </div>
                                    )}

                                </div>

                            </div>

                        </div>

                    </div>

                </div>

            </section>



            {/* Add Note Modal (Modularized in NoteModal.jsx) */}





            <NoteModal





                show={noteShow}





                onHide={handleNoteClose}





                selectedNote={selectedNote}





                selectedNoteColor={selectedNoteColor}





                createNote={createNote}





                handleNoteChange={handleNoteChange}





                handleColorChange={handleColorChange}





                currentNoteVariantContext={currentNoteVariantContext}





                setCurrentNoteVariantContext={setCurrentNoteVariantContext}





                course={course}





                getColorVariations={getColorVariations}





                handleSubmitCreateNote={handleSubmitCreateNote}





                handleSubmitEditNote={handleSubmitEditNote}





            />



            {/* ✨ PHASE 11.164 REFACTOR: Multiple floating note cards with extracted component - fixes React hooks violation */}

            <FloatingNoteCardsContainer

                openNotes={openNotes}

                setOpenNotes={setOpenNotes}

                param={param}

                fetchCourseDetail={fetchCourseDetail}

            />



            {/* Create Question Modal (Modularized in CreateQuestionModal.jsx) */}

            <CreateQuestionModal

                show={addQuestionShow}

                onHide={handleQuestionClose}

                onSubmit={handleSaveQuestion}

                createMessage={createMessage}

                setCreateMessage={setCreateMessage}

                handleMessageChange={handleMessageChange}

                currentVariantContext={currentVariantContext}

                setCurrentVariantContext={setCurrentVariantContext}

                course={course}

                attachedTimestamp={attachedTimestamp}

                setAttachedTimestamp={setAttachedTimestamp}

                getCurrentVideoTime={getCurrentVideoTime}

                questionTextareaRef={questionTextareaRef}

                questionPreviewMode={questionPreviewMode}

                setQuestionPreviewMode={setQuestionPreviewMode}

                handleJumpToVideoTimestamp={handleJumpToVideoTimestamp}

                questionAttachment={questionAttachment}

                setQuestionAttachment={setQuestionAttachment}

                isCompressingAttachment={isCompressingQuestionAttachment}

                setIsCompressingAttachment={setIsCompressingQuestionAttachment}

            />



            {/* ✨ PHASE 7.10: Conversation Modal - HIDDEN (now using inline forum view in Diskusi tab) */}

            {/* Modal removed and replaced with inline forum container */}



            {/* Q&A Report Modal (Modularized in QAReportModal.jsx) */}

            <QAReportModal

                show={showQAReportModal}

                onClose={handleCloseQAReportModal}

                reportingQA={reportingQA}

                reportingQAType={reportingQAType}

                currentReportData={currentReportData}

                editingReportId={editingReportId}

                closedReports={closedReports}

                qaReportReason={qaReportReason}

                setQaReportReason={setQaReportReason}

                qaReportDescription={qaReportDescription}

                setQaReportDescription={setQaReportDescription}

                handleSubmitQAReport={handleSubmitQAReport}

                handleEditQAReport={handleEditQAReport}

            />



            {/* Video Resume Dialog */}

            <Footer />

        </>

    );

}



export default CourseDetail;



