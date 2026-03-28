import React, { useState, useEffect, useRef,  useCallback } from "react";
import { Link } from "react-router-dom";
import dayjs, { moment } from "../../utils/dayjs";

// Components
import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import LoadingSpinner from "./Partials/LoadingSpinner";
import MinimalLoader from "./Partials/MinimalLoader";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";

// Utils
import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import { useInstructorSidebarCollapse } from "./Partials/useInstructorSidebarCollapse";
import { getMediaUrl, DEFAULT_IMAGE_URL } from "../../utils/constants";
import { usePageCache } from "../../utils/usePageCache"; // ✨ PHASE 11.12+: Fix page reload issue
import "./QA.css";

// Constants
const DEFAULT_AVATAR = DEFAULT_IMAGE_URL;

function QA() {
    // ============================
    // STATE MANAGEMENT
    // ============================
    const isCollapsed = useInstructorSidebarCollapse();
    
    // Course-related states
    const [teacherCourses, setTeacherCourses] = useState([]);
    const [filteredCourses, setFilteredCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [courseSearchQuery, setCourseSearchQuery] = useState("");
    
    // Q&A related states
    const [questions, setQuestions] = useState([]);
    const [questionSearchQuery, setQuestionSearchQuery] = useState("");
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [conversationMessages, setConversationMessages] = useState({});
    // ✨ PHASE 7.9-7.10: Filter questions by search, bagian (section), and pelajaran (lesson)
    const [discussionFilters, setDiscussionFilters] = useState({ search: '', bagian: null, pelajaran: null });
    const [filteredQuestions, setFilteredQuestions] = useState([]);
    
    // Loading states
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [messageLoading, setMessageLoading] = useState(false);
    
    // ✨ PHASE 7.18: Report tracking - for showing report status on buttons
    const [qaReports, setQaReports] = useState({
        question_reports: [],
        message_reports: []
    });
    
    // Report modal states
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportingQuestion, setReportingQuestion] = useState(null);
    const [reportReason, setReportReason] = useState('');
    const [reportDescription, setReportDescription] = useState('');
    const [isSubmittingReport, setIsSubmittingReport] = useState(false);
    
    // ✨ PHASE 7.16+: Track the current report being viewed in modal (for showing feedback)
    const [currentReportData, setCurrentReportData] = useState(null);
    
    // ✨ PHASE 7.16+: Track if we're editing an existing report
    const [editingReportId, setEditingReportId] = useState(null);
    
    // ✨ PHASE 7.16+: Track which reports have been closed by user (Set of report IDs)
    const [closedReports, setClosedReports] = useState(new Set());
    
    // ✨ PHASE 7.24: Polling for live updates
    const [forumPollingIntervalRef, setForumPollingIntervalRef] = useState(null);
    
    // Refs
    const lastElementRef = useRef(null);
    const pollingIntervalRef = useRef(null);
    const reportPollingIntervalRef = useRef(null);
    const questionsPollingIntervalRef = useRef(null);

    // ============================
    // API FUNCTIONS
    // ============================
    
    // ✨ PHASE 11 12+: Wrap fetch for usePageCache
    const fetchCoursesData = useCallback(async () => {
        const teacherId = UserData()?.teacher_id;
        
        if (!teacherId) {
            throw new Error("Teacher ID not found. Please make sure you are logged in as a teacher.");
        }
        
        const response = await useAxios.get(`teacher/course-lists/${teacherId}/`);
        
        // Handle both array and paginated response formats
        const courseData = Array.isArray(response.data) ? response.data : (response.data?.results || []);
        return courseData;
    }, []);

    // ✨ PHASE 11.12+: Use page cache to prevent reloads on navigation
    const { data: cachedCourses = [], loading: coursesLoading } = usePageCache(
        'instructor-qa-courses',
        fetchCoursesData,
        { showLoadingOnStale: false }
    );

    // Update state with cached courses
    useEffect(() => {
        if (cachedCourses && Array.isArray(cachedCourses)) {
            setTeacherCourses(cachedCourses);
            setFilteredCourses(cachedCourses);
        }
    }, [cachedCourses]);

    // Set loading state from cache
    useEffect(() => {
        setLoading(coursesLoading);
    }, [coursesLoading]);
    
    // Fetch questions for selected course
    const fetchCourseQuestions = async (course) => {
        setLoading(true);
        try {
            console.log("[Fetch Questions] Starting - course:", course);
            console.log("[Fetch Questions] course.course_id:", course?.course_id, "| course.id:", course?.id);
            console.log("[Fetch Questions] course.published_version?.course_id:", course?.published_version?.course_id);
            
            const teacherId = UserData()?.teacher_id;
            const userId = UserData()?.user_id;  // ✨ PHASE 7.25: Get current user_id for like status
            
            // ✨ PHASE 7.25: Pass user_id as query parameter so serializer can determine like status
            const response = await useAxios.get(`teacher/question-answer-list/${teacherId}/`, {
                params: { user_id: userId }
            });
            
            // Extract all questions
            const allQA = response.data?.results || response.data || [];
            console.log("[Fetch Questions] Total questions from API:", allQA.length);
            console.log("[Fetch Questions] First few questions:", allQA.slice(0, 3).map(q => ({ qa_id: q.qa_id, course: q.course, title: q.title })));
            
            // ✨ PHASE 7.12: CRITICAL FIX - Use published course_id for filtering
            // Questions are stored with PUBLISHED course_id, not draft's course_id
            // After handleCourseSelect, course.course_id should be the published one
            // But as a safety measure, try both draft and published course_ids
            const publishedCourseId = course?.published_version?.course_id || course?.course_id;
            const draftCourseId = course?.course_id;
            
            console.log("[Fetch Questions] publishedCourseId:", publishedCourseId, "(type:", typeof publishedCourseId, ")");
            console.log("[Fetch Questions] draftCourseId:", draftCourseId, "(type:", typeof draftCourseId, ")");
            
            // Filter questions by comparing course_ids
            // ✨ PHASE N.X FIX: Backend returns q.course as integer ID only (not an object with course_id property)
            // So we compare q.course directly instead of q.course?.course_id
            // Convert to string for safe comparison (handles both string and number IDs from backend)
            const courseQuestions = allQA.filter(q => {
                const courseIdMatch = String(q.course) === String(publishedCourseId) || String(q.course) === String(draftCourseId);
                if (!courseIdMatch) {
                    console.log("[Fetch Questions] Question", q.qa_id, "FILTERED OUT: q.course=", q.course, "doesn't match", publishedCourseId, "or", draftCourseId);
                }
                return courseIdMatch;
            });
            
            console.log("[Fetch Questions] After filtering: ", courseQuestions.length, "questions matched");
            console.log("[Fetch Questions] Matched questions:", courseQuestions.map(q => ({ qa_id: q.qa_id, course: q.course })));
            
            console.log("[Fetch Questions] Calling setQuestions with", courseQuestions.length, "questions");
            setQuestions(courseQuestions);
            setQuestionSearchQuery(""); // Reset search when fetching new questions
            // ✨ PHASE 7.9-7.10: Reset filters when fetching new course questions
            setDiscussionFilters({ search: '', bagian: null, pelajaran: null });
            setError(null);
        } catch (error) {
            console.error("Error fetching course questions:", error);
            setError("Failed to load course discussions");
            setQuestions([]);
        } finally {
            setLoading(false);
        }
    };

    // ============================
    // SEARCH & FILTER FUNCTIONS
    // ============================
    
    // Handle course search
    const handleCourseSearch = (event) => {
        let query = event.target.value;
        setCourseSearchQuery(query);
        query = query.toLowerCase();
        
        if (query === "") {
            setFilteredCourses(teacherCourses);
        } else {
            const filtered = teacherCourses.filter((course) => {
                const categoryText = typeof course?.category === "object" 
                    ? course.category?.title || course.category?.name || ""
                    : course?.category || "";
                
                return course?.title?.toLowerCase().includes(query) ||
                        course?.instructor?.full_name?.toLowerCase().includes(query) ||
                        categoryText.toLowerCase().includes(query);
            });
            setFilteredCourses(filtered);
        }
    };

    // Clear course search
    const clearCourseSearch = () => {
        setCourseSearchQuery("");
        setFilteredCourses(teacherCourses);
    };

    // Handle search questions
    const handleSearchQuestion = (event) => {
        const query = event.target.value.toLowerCase();
        setQuestionSearchQuery(event.target.value); // Update controlled input state
        if (!selectedCourse) return;
        
        if (query === "") {
            fetchCourseQuestions(selectedCourse);
        } else {
            const questionsArray = Array.isArray(questions) ? questions : [];
            const filtered = questionsArray.filter(q => 
                q.title?.toLowerCase().includes(query) || 
                q.profile?.full_name?.toLowerCase().includes(query)
            );
            setQuestions(filtered);
        }
    };

    // ============================
    // CONVERSATION HANDLERS
    // ============================
    
    const handleBackToQuestions = () => {
        stopForumPolling(); // ✨ PHASE 7.24: Stop polling when going back
        setSelectedConversation(null);
        setQuestionSearchQuery("");
        // ✨ PHASE 7.25: Don't call fetchCourseQuestions - just hide conversation view
        // Questions are already in state, no need to refresh
    };

    // ============================
    // MESSAGE HANDLERS
    // ============================

    // Handle message change with conversation-specific storage
    const handleMessageChange = (e) => {
        const conversationId = selectedConversation?.qa_id || selectedConversation?.id;
        setConversationMessages({
            ...conversationMessages,
            [conversationId]: e.target.value
        });
    };

    // Get current message for selected conversation
    const getCurrentMessage = () => {
        const conversationId = selectedConversation?.qa_id || selectedConversation?.id;
        return conversationMessages[conversationId] || "";
    };

    // ✨ PHASE 7.11+: Handle course selection with published version curriculum loading
    // ✨ PHASE 7.12: CRITICAL FIX - Use published version's course_id for question filtering
    // ✨ PHASE 7.13 FINAL FIX: Backend now returns correct qa_count, no manual override needed
    // ✨ PHASE 7.14: Ensure curriculum with full variant_items is loaded
    const handleCourseSelect = async (course) => {
        try {
            console.log("[Course Select Handler] Called with course:", course);
            console.log("[Course Select Handler] course.course_id:", course?.course_id, "| course.id:", course?.id);
            
            // Fetch full course details including published version data and correct qa_count
            const response = await useAxios.get(`teacher/course-detail/${course.course_id}/`);
            const enrichedCourse = response.data;
            
            console.log("[Course Select Handler] Enriched course received from API");
            console.log("[Course Select Handler] enrichedCourse.course_id:", enrichedCourse?.course_id);
            console.log("[Course Select Handler] enrichedCourse.published_version?.course_id:", enrichedCourse?.published_version?.course_id);
            console.log("[Course Select Handler] enrichedCourse.qa_count:", enrichedCourse?.qa_count);
            
            // ✨ PHASE 7.12: CRITICAL - Use published version's course_id for filtering
            // Draft and published versions have DIFFERENT course_ids:
            // - Draft course_id: "271157" (original)
            // - Published course_id: "168460" (randomly generated when published copy created)
            // Questions are stored with PUBLISHED course_id
            // So we MUST use published_version.course_id to match questions correctly
            if (enrichedCourse?.published_version?.course_id) {
                enrichedCourse.course_id = enrichedCourse.published_version.course_id;
                enrichedCourse.curriculum = enrichedCourse.published_version.curriculum;
                console.log(`[Course Select] Using published version - course_id: ${enrichedCourse.published_version.course_id}, qa_count: ${enrichedCourse.qa_count}`);
                console.log(`[Course Select] Curriculum loaded with ${enrichedCourse.curriculum?.length || 0} bagian`);
                // Log curriculum structure for debugging
                enrichedCourse.curriculum?.forEach((bagian, idx) => {
                    console.log(`  Bagian ${idx}: ${bagian.title} (ID: ${bagian.variant_id}) - ${bagian.variant_items?.length || 0} pelajaran`);
                });
            } else {
                console.log(`[Course Select] No published version found, using draft course`);
                console.log(`[Course Select] Curriculum loaded with ${enrichedCourse.curriculum?.length || 0} bagian`);
            }
            
            setSelectedCourse(enrichedCourse);
            fetchCourseQuestions(enrichedCourse);
        } catch (error) {
            console.error("Error fetching course details:", error);
            // Fallback to draft course if API fails
            setSelectedCourse(course);
            fetchCourseQuestions(course);
        }
    };

    // Helper function to translate course levels to Indonesian
    const translateLevel = (level) => {
        if (!level) return "Semua Level";
        const levelMap = {
            "beginner": "Pemula",
            "intermediate": "Menengah",
            "advanced": "Lanjutan",
            "all levels": "Semua Level",
            "semua level": "Semua Level",
        };
        return levelMap[level.toLowerCase()] || level;
    };

    // ✨ DEBUG: Log when questions state changes
    useEffect(() => {
        console.log("[Questions State] Updated - questions.length:", questions?.length, "first few questions:", questions?.slice(0, 3).map(q => ({ qa_id: q.qa_id, title: q.title })));
    }, [questions]);

    // ✨ DEBUG: Log when selectedCourse changes
    useEffect(() => {
        console.log("[Selected Course State] Updated - course_id:", selectedCourse?.course_id, "qa_count:", selectedCourse?.qa_count, "title:", selectedCourse?.title);
    }, [selectedCourse]);

    // ✨ PHASE 7.8-7.9: Filter questions by search term, bagian, and pelajaran
    useEffect(() => {
        console.log("[Filter Effect] Running - questions:", questions?.length, "discussionFilters:", discussionFilters);
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
        // ✨ PHASE 7.15: Convert both sides to string to handle variant_id as string or number from backend
        if (discussionFilters.bagian) {
            console.log(`[Filter Debug] Filtering by bagian: "${discussionFilters.bagian}" (type: ${typeof discussionFilters.bagian})`);
            const beforeFilterCount = filtered.length;
            filtered = filtered.filter(q => {
                const qVariantId = String(q.variant?.variant_id);
                const filterBagian = String(discussionFilters.bagian);
                const matches = qVariantId === filterBagian;
                if (q.variant?.variant_id && !matches) {
                    console.log(`[Filter Debug] Question variant_id "${qVariantId}" (type: ${typeof q.variant?.variant_id}) did NOT match filter "${filterBagian}"`);
                }
                return matches;
            });
            console.log(`[Filter Debug] Bagian filter: ${beforeFilterCount} → ${filtered.length} questions`);
        }
        
        // Filter by pelajaran (lesson)
        // ✨ PHASE 7.15: Convert both sides to string to handle variant_item_id as string or number from backend
        if (discussionFilters.pelajaran) {
            console.log(`[Filter Debug] Filtering by pelajaran: "${discussionFilters.pelajaran}" (type: ${typeof discussionFilters.pelajaran})`);
            const beforeFilterCount = filtered.length;
            filtered = filtered.filter(q => 
                String(q.variant_item?.variant_item_id) === String(discussionFilters.pelajaran)
            );
            console.log(`[Filter Debug] Pelajaran filter: ${beforeFilterCount} → ${filtered.length} questions`);
        }
        
        console.log("[Filter Effect] Final result - calling setFilteredQuestions with", filtered.length, "questions");
        setFilteredQuestions(filtered);
    }, [questions, discussionFilters]);

    const sendNewMessage = async (e) => {
        e.preventDefault();
        
        const messageText = getCurrentMessage().trim();
        if (!messageText) {
            console.error("No message text provided");
            return;
        }

        if (!selectedConversation) {
            console.error("No conversation selected");
            return;
        }

        const conversationId = selectedConversation?.qa_id || selectedConversation?.id;
        const courseId = selectedConversation?.course?.id || selectedConversation?.course;
        const userId = UserData()?.user_id;

        // Try multiple ways to get course ID
        const possibleCourseIds = [
            selectedConversation?.course?.id,
            selectedConversation?.course,
            selectedConversation?.course_id,
            selectedConversation?.courseId
        ];
        
        // Use the first valid course ID found
        const validCourseId = possibleCourseIds.find(id => id !== null && id !== undefined && id !== "");
        
        // Validate required data
        if (!conversationId) {
            console.error("Missing conversation ID (qa_id)");
            setError("Invalid conversation. Please refresh and try again.");
            return;
        }

        if (!validCourseId) {
            console.error("Missing course ID - tried all possible paths:", possibleCourseIds);
            setError("Invalid course. Please refresh and try again.");
            return;
        }

        if (!userId) {
            console.error("Missing user ID");
            setError("User not authenticated. Please login again.");
            return;
        }
        
        const formdata = new FormData();
        formdata.append("course_id", courseId);
        formdata.append("user_id", userId);
        formdata.append("message", messageText);
        formdata.append("qa_id", conversationId);

        try {
            const response = await useAxios.post("student/question-answer-message-create/", formdata);
            
            // Update the conversation with new message from the response
            if (response.data.question) {
                setSelectedConversation(response.data.question);
                
                // Update the main questions list as well
                setQuestions(prev => prev.map(q => 
                    (q.qa_id || q.id) === conversationId ? response.data.question : q
                ));
            }

            // Clear the input for this conversation
            setConversationMessages({
                ...conversationMessages,
                [conversationId]: ""
            });

            // Auto-scroll to bottom
            setTimeout(() => {
                if (lastElementRef.current) {
                    lastElementRef.current.scrollIntoView({ behavior: "smooth" });
                }
            }, 100);

        } catch (error) {
            console.error("Error sending message:", error);
            console.error("Error details:", {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                config: error.config
            });
            setError("Failed to send message. Please try again.");
        }
    };

    // ✨ PHASE 7.18: Fetch instructor's question/message reports
    const fetchQAReports = async (courseToFetch) => {
        try {
            const userData = UserData();
            const courseId = courseToFetch?.id || courseToFetch?.course_id;
            
            if (!userData?.id && !userData?.user_id) {
                return;
            }
            
            if (!courseId) {
                return;
            }
            
            const userId = userData?.id || userData?.user_id;
            const res = await useAxios.get(`student/qa-reports/${courseId}/?user_id=${userId}`);
            
            const normalizedReports = {
                question_reports: res.data?.question_reports || [],
                message_reports: res.data?.message_reports || []
            };
            
            setQaReports(normalizedReports);
        } catch (error) {
            // Q&A reports fetch error - silently handle
        }
    };
    
    // ✨ PHASE 7.18: Get report status for a specific question
    const getQAReportStatus = (qaId, type = 'question') => {
        if (type === 'question') {
            return qaReports?.question_reports?.find(r => r.question__qa_id === qaId);
        } else {
            return qaReports?.message_reports?.find(r => r.message__qa_id === qaId);
        }
    };

    // ✨ PHASE 7.24: Start polling for live updates when conversation is selected
    const startForumPolling = (qaId) => {
        // Clear existing polling
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
        }
        
        console.log(`[Forum Polling] Starting polling for QA ID: ${qaId}`);
        
        // Poll every 3 seconds to fetch updated conversation data
        pollingIntervalRef.current = setInterval(async () => {
            try {
                // Fetch the latest questions which includes the current conversation
                const teacherId = UserData()?.teacher_id;
                if (!teacherId || !selectedCourse) return;
                
                const response = await useAxios.get(`teacher/question-answer-list/${teacherId}/`);
                const questionsArray = Array.isArray(response.data?.results) ? response.data.results : (Array.isArray(response.data) ? response.data : []);
                
                // Find the current conversation in the latest data
                const updatedConversation = questionsArray.find(q => q.qa_id === qaId);
                
                if (updatedConversation) {
                    // Update selected conversation with latest data
                    setSelectedConversation(updatedConversation);
                    
                    // Update questions list
                    setQuestions(questionsArray);
                    setFilteredQuestions(questionsArray);
                    
                    console.log(`[Forum Polling] Updated QA ${qaId}: likes_count=${updatedConversation.likes_count}, messages=${updatedConversation.messages?.length}`);
                }
            } catch (error) {
                console.log("[Forum Polling] Error fetching updates:", error.message);
            }
        }, 3000); // Poll every 3 seconds
    };

    // ✨ PHASE 7.24: Stop polling when closing conversation
    const stopForumPolling = () => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            console.log("[Forum Polling] Polling stopped");
        }
    };

    // ✨ PHASE 7.26: Start polling for report status updates
    const startReportPolling = () => {
        // Clear existing polling
        if (reportPollingIntervalRef.current) {
            clearInterval(reportPollingIntervalRef.current);
        }
        
        console.log("[Report Polling] Starting polling for report status updates");
        
        // Poll every 3 seconds to fetch updated report status
        reportPollingIntervalRef.current = setInterval(async () => {
            try {
                if (!selectedCourse || !reportingQuestion) return;
                
                const userId = UserData()?.id || UserData()?.user_id;
                const courseId = selectedCourse?.id || selectedCourse?.course_id;
                
                // Fetch latest reports for the course
                const res = await useAxios.get(`student/qa-reports/${courseId}/?user_id=${userId}`);
                
                const normalizedReports = {
                    question_reports: res.data?.question_reports || [],
                    message_reports: res.data?.message_reports || []
                };
                
                // Update the reports state
                setQaReports(normalizedReports);
                
                // Find the current report being viewed
                const isMessage = reportingQuestion?.message && !reportingQuestion?.title;
                const reportList = isMessage ? normalizedReports.message_reports : normalizedReports.question_reports;
                const fieldName = isMessage ? 'message__qa_id' : 'question__qa_id';
                
                const updatedReport = reportList?.find(r => r[fieldName] === reportingQuestion?.qa_id);
                
                if (updatedReport) {
                    // Update the current report data being displayed in modal
                    setCurrentReportData(updatedReport);
                    console.log(`[Report Polling] Updated report status: ${updatedReport.status}`);
                } else {
                    // Report was deleted or user doesn't exist anymore
                    console.log("[Report Polling] Report not found, clearing modal");
                    setCurrentReportData(null);
                }
            } catch (error) {
                console.log("[Report Polling] Error fetching report updates:", error.message);
            }
        }, 3000); // Poll every 3 seconds
    };

    // ✨ PHASE 7.26: Stop polling for report status
    const stopReportPolling = () => {
        if (reportPollingIntervalRef.current) {
            clearInterval(reportPollingIntervalRef.current);
            reportPollingIntervalRef.current = null;
            console.log("[Report Polling] Polling stopped");
        }
    };

    // ✨ PHASE 7.27: Start polling for live questions list updates
    const startQuestionsPolling = (courseToPolled) => {
        // Clear existing polling
        if (questionsPollingIntervalRef.current) {
            clearInterval(questionsPollingIntervalRef.current);
        }
        
        console.log("[Questions Polling] Starting polling for questions list updates");
        
        // Poll every 3 seconds to fetch updated questions with latest like counts and user_liked status
        questionsPollingIntervalRef.current = setInterval(async () => {
            try {
                const teacherId = UserData()?.teacher_id;
                const userId = UserData()?.user_id;
                
                if (!teacherId || !courseToPolled) return;
                
                // Fetch fresh questions from API
                const response = await useAxios.get(`teacher/question-answer-list/${teacherId}/`, {
                    params: { user_id: userId }
                });
                
                const allQA = response.data?.results || response.data || [];
                
                // Filter for current course (using same logic as fetchCourseQuestions)
                const publishedCourseId = courseToPolled?.published_version?.course_id || courseToPolled?.course_id;
                const draftCourseId = courseToPolled?.course_id;
                
                // ✨ PHASE N.X FIX: Backend returns q.course as integer ID only (not an object with course_id property)
                // Convert to string for safe comparison (handles both string and number IDs from backend)
                const courseQuestions = allQA.filter(q => 
                    String(q.course) === String(publishedCourseId) || 
                    String(q.course) === String(draftCourseId)
                );
                
                // Update questions list with fresh data
                setQuestions(courseQuestions);
                setFilteredQuestions(courseQuestions);
                
                // If viewing a conversation, also update it with fresh data
                if (selectedConversation?.qa_id) {
                    const updatedConversation = courseQuestions.find(q => q.qa_id === selectedConversation.qa_id);
                    if (updatedConversation) {
                        setSelectedConversation(updatedConversation);
                        console.log(`[Questions Polling] Updated conversation: likes_count=${updatedConversation.likes_count}, user_liked=${updatedConversation.user_liked}`);
                    }
                }
                
                console.log(`[Questions Polling] Fetched ${courseQuestions.length} questions with live like counts`);
            } catch (error) {
                console.log("[Questions Polling] Error fetching questions:", error.message);
            }
        }, 3000); // Poll every 3 seconds
    };

    // ✨ PHASE 7.27: Stop polling for questions list
    const stopQuestionsPolling = () => {
        if (questionsPollingIntervalRef.current) {
            clearInterval(questionsPollingIntervalRef.current);
            questionsPollingIntervalRef.current = null;
            console.log("[Questions Polling] Polling stopped");
        }
    };

    // ✨ PHASE 7.24: Handle liking a question with Toast notification and live updates
    const handleLikeQuestion = async (question) => {
        try {
            const response = await useAxios.post(`student/question-answer-like/${question.qa_id}/`, {
                user_id: UserData()?.user_id,
                course_id: selectedCourse?.course_id || selectedCourse?.id,
            });
            
            // Update questions list
            if (response.data) {
                setQuestions(prev => prev.map(q => 
                    (q.qa_id || q.id) === (question.qa_id || question.id)
                        ? { ...q, likes_count: response.data.likes_count || 0, user_liked: response.data.liked }
                        : q
                ));
                
                // Update filtered questions as well
                setFilteredQuestions(prev => prev.map(q => 
                    (q.qa_id || q.id) === (question.qa_id || question.id)
                        ? { ...q, likes_count: response.data.likes_count || 0, user_liked: response.data.liked }
                        : q
                ));
                
                // Update selected conversation if viewing
                if (selectedConversation?.qa_id === question.qa_id) {
                    setSelectedConversation(prev => ({
                        ...prev,
                        likes_count: response.data.likes_count || 0,
                        user_liked: response.data.liked
                    }));
                }
                
                // Show success notification
                Toast().fire({
                    icon: "success",
                    title: response.data.message || "Berhasil sukai pertanyaan"
                });
            }
        } catch (error) {
            console.error("Error liking question:", error);
            Toast().fire({
                icon: "error",
                title: error.response?.data?.message || "Gagal sukai pertanyaan"
            });
        }
    };

    // ✨ PHASE 7.24: Handle liking a message/reply with Toast notification and live updates
    const handleLikeMessage = async (message, qaId) => {
        try {
            const response = await useAxios.post(`student/question-answer-message-like/${qaId}/`, {
                user_id: UserData()?.user_id,
                course_id: selectedCourse?.course_id || selectedCourse?.id,
                message_id: message.id,
            });
            
            // Update selected conversation messages if viewing
            if (response.data && selectedConversation?.qa_id === qaId) {
                setSelectedConversation(prev => ({
                    ...prev,
                    messages: prev.messages.map(msg =>
                        msg.id === message.id
                            ? { ...msg, likes_count: response.data.likes_count || 0, user_liked: response.data.liked }
                            : msg
                    )
                }));
            }
            
            // Show success notification
            Toast().fire({
                icon: "success",
                title: response.data.message || "Berhasil sukai jawaban"
            });
        } catch (error) {
            console.error("Error liking message:", error);
            Toast().fire({
                icon: "error",
                title: error.response?.data?.message || "Gagal sukai jawaban"
            });
        }
    };

    // ✨ PHASE 7.17: Handle opening report modal
    // ✨ PHASE 7.16+: Check if user already has a report for this item
    const handleOpenReportModal = (item) => {
        // Handle both questions and messages
        const isMessage = item?.message && !item?.title;  // Messages have message field, questions have title
        
        setReportingQuestion(item);
        setShowReportModal(true);
        
        console.log("[handleOpenReportModal] Opening modal for:", { qaId: item?.qa_id, isMessage, qaReports });
        
        // Check if user already has a report for this item
        const reportList = isMessage ? qaReports?.message_reports : qaReports?.question_reports;
        const fieldName = isMessage ? 'message__qa_id' : 'question__qa_id';
        
        const existingReport = reportList?.find(r => {
            console.log(`[handleOpenReportModal] Comparing ${r[fieldName]} === ${item?.qa_id}: ${r[fieldName] === item?.qa_id}`);
            return r[fieldName] === item?.qa_id;
        });
        
        console.log("[handleOpenReportModal] Found existing report:", existingReport);
        
        if (existingReport) {
            // Show existing report feedback
            setCurrentReportData(existingReport);
            setReportReason('');
            setReportDescription('');
            console.log("[handleOpenReportModal] Setting current report data:", existingReport);
        } else {
            // Show form for new report
            setCurrentReportData(null);
            setReportReason('');
            setReportDescription('');
            console.log("[handleOpenReportModal] No existing report, showing form");
        }
    };
    
    // ✨ PHASE 7.17: Handle closing report modal
    // ✨ PHASE 7.16+: If report is reviewed (not pending), mark case as closed for this session
    const handleCloseReportModal = () => {
        console.log("[handleCloseReportModal] Closing modal");
        
        // If report is reviewed (not pending), mark case as closed for this session
        if (currentReportData && currentReportData.status !== 'pending') {
            console.log("[handleCloseReportModal] Report is reviewed, marking case as closed");
            setClosedReports(prev => new Set([...prev, currentReportData.id]));
            console.log("[handleCloseReportModal] Case marked closed - user cannot edit or interact with it");
        }
        
        setShowReportModal(false);
        setReportingQuestion(null);
        setReportReason('');
        setReportDescription('');
        setCurrentReportData(null);
        setEditingReportId(null);  // ✨ PHASE 7.16+: Clear editing state
        console.log("[handleCloseReportModal] Modal state cleared");
    };
    
    // ✨ PHASE 7.16+: Handle editing existing report
    const handleEditQAReport = () => {
        console.log("[handleEditQAReport] Entering edit mode for report", currentReportData);
        // Load previous report data into form fields
        if (currentReportData) {
            setReportReason(currentReportData.reason || '');
            setReportDescription(currentReportData.description || '');
            setEditingReportId(currentReportData.id);
            console.log("[handleEditQAReport] Form loaded with previous data, ready for re-submission");
        }
    };
    
    // ✨ PHASE 7.18: Handle submitting report with Toast notification
    // ✨ PHASE 7.16+: Handle both new reports (POST) and edited reports (PUT)
    // ✨ PHASE 7.25: Determine if reporting a message or question and use correct endpoint
    const handleSubmitReport = async () => {
        if (!reportReason) {
            Toast().fire({
                icon: "warning",
                title: "Silakan pilih alasan laporan"
            });
            return;
        }
        
        setIsSubmittingReport(true);
        try {
            const userData = UserData();
            if (!userData?.id && !userData?.user_id) {
                throw new Error("User ID not found");
            }

            // ✨ PHASE 7.25: Determine if item is a message or question
            // Messages have a 'message' field and no 'title' field
            // Questions have a 'title' field and possibly a 'message' field
            const isMessage = reportingQuestion?.message && !reportingQuestion?.title;
            
            // ✨ PHASE 7.25: Use the correct endpoint based on item type
            // For messages: use the qa_id of the message
            // For questions: use the qa_id of the question
            const urlId = editingReportId || reportingQuestion.qa_id;
            const endpoint = isMessage 
                ? `student/question-answer-message-report/${urlId}/`
                : `student/question-answer-report/${urlId}/`;
            
            console.log(`[handleSubmitReport] Reporting ${isMessage ? 'message' : 'question'} with qa_id=${urlId}, endpoint=${endpoint}`);

            // ✨ PHASE 7.16+: Handle both new reports (POST) and edited reports (PUT)
            if (editingReportId) {
                // Update existing report and reset status to "pending"
                await useAxios.put(endpoint, {
                    user_id: userData?.user_id || userData?.id,
                    reason: reportReason,
                    description: reportDescription,
                    status: 'pending',  // Reset to pending review
                });
                console.log("[handleSubmitReport] Report updated with status reset to 'pending'");
            } else {
                // Create new report
                await useAxios.post(endpoint, {
                    user_id: userData?.user_id || userData?.id,
                    course_id: selectedCourse?.course_id || selectedCourse?.id,
                    reason: reportReason,
                    description: reportDescription
                });
                console.log("[handleSubmitReport] New report created");
            }

            Toast().fire({
                icon: "success",
                title: editingReportId ? "Laporan berhasil diperbarui!" : "Laporan berhasil dikirim!",
                text: editingReportId ? "Laporan Anda telah diperbarui dan menunggu tinjauan ulang." : "Admin akan meninjau laporan Anda dalam waktu singkat."
            });

            // ✨ PHASE 7.25: Close modal and fetch fresh reports in background
            console.log("[handleSubmitReport] Closing modal after success");
            setShowReportModal(false);
            
            // ✨ PHASE 7.25: Fetch and refresh reports silently in background
            if (selectedCourse) {
                console.log("[handleSubmitReport] Fetching fresh reports in background");
                fetchQAReports(selectedCourse);
            }
            
            // ✨ PHASE 7.25: Reset form fields for next use
            console.log("[handleSubmitReport] Resetting form fields");
            setReportReason('');
            setReportDescription('');
            setEditingReportId(null);
            setReportingQuestion(null);
            
        } catch (error) {
            console.error("Error submitting report:", error);
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
            setIsSubmittingReport(false);
        }
    };

    // ✨ PHASE 7.18: Fetch Q&A reports when selecting a course
    useEffect(() => {
        if (selectedCourse?.id) {
            fetchQAReports(selectedCourse);
        }
    }, [selectedCourse?.id]);

    // ✨ PHASE 7.24: Start polling when conversation is selected, stop when deselected
    useEffect(() => {
        if (selectedConversation?.qa_id) {
            console.log(`[useEffect] Starting polling for conversation ${selectedConversation.qa_id}`);
            startForumPolling(selectedConversation.qa_id);
        } else {
            console.log("[useEffect] Stopping polling - no conversation selected");
            stopForumPolling();
        }
        
        // Cleanup on unmount or when selectedConversation changes
        return () => {
            if (selectedConversation?.qa_id) {
                stopForumPolling();
            }
        };
    }, [selectedConversation?.qa_id]);

    // ✨ PHASE 7.24: Cleanup polling on component unmount
    useEffect(() => {
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, []);

    // ✨ PHASE 7.26: Start report polling when modal opens with report data, stop when modal closes
    useEffect(() => {
        if (showReportModal && currentReportData && reportingQuestion) {
            console.log("[useEffect] Starting polling for report status");
            startReportPolling();
        } else {
            console.log("[useEffect] Stopping polling - report modal closed or no report selected");
            stopReportPolling();
        }
        
        // Cleanup on unmount or when dependencies change
        return () => {
            if (showReportModal && currentReportData) {
                stopReportPolling();
            }
        };
    }, [showReportModal, currentReportData?.id, reportingQuestion?.qa_id]);

    // ✨ PHASE 7.27: Start questions polling when course selected, stop when course changed or unmounted
    useEffect(() => {
        if (selectedCourse?.id || selectedCourse?.course_id) {
            console.log("[useEffect] Starting polling for questions list updates");
            startQuestionsPolling(selectedCourse);
        } else {
            console.log("[useEffect] Stopping polling - no course selected");
            stopQuestionsPolling();
        }
        
        // Cleanup on unmount or when dependencies change
        return () => {
            if (selectedCourse?.id || selectedCourse?.course_id) {
                stopQuestionsPolling();
            }
        };
    }, [selectedCourse?.id, selectedCourse?.course_id]);

    // ✨ PHASE 7.27: Cleanup all polling on component unmount
    useEffect(() => {
        return () => {
            if (questionsPollingIntervalRef.current) {
                clearInterval(questionsPollingIntervalRef.current);
            }
        };
    }, []);

    // Show full-page loading spinner on initial load
    if (loading) {
        return (
            <>
                <BaseHeader />
                <section className="qa-bg-section pt-4 pb-5" style={{ display: "flex", alignItems: "center" }}>
                    <div className="container" style={{ flex: 1 }}>
                        <Header />
                        <div className="row">
                            <Sidebar />
                            <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
                                <div className="text-center">
                                    <div className="spinner-border text-primary" role="status" style={{ width: "3rem", height: "3rem" }}>
                                        <span className="visually-hidden">Memuat...</span>
                                    </div>
                                    <p className="mt-3 text-muted">Memuat T&J...</p>
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
            <section className="qa-bg-section pt-4 pb-5">
                <div className="container">
                    <Header />
                    <div className="row">
                        <Sidebar />
                        <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>
                            {/* Modern Header Section */}
                            <div className="qa-header-section mb-4">
                                <div className="qa-header-bg"></div>
                                <div className="qa-header-content d-flex align-items-center justify-content-between">
                                    <div>
                                        <h1 className="qa-header-title mb-2">
                                            <i className="fas fa-question-circle me-3"></i>T&J Kursus
                                        </h1>
                                        <p className="qa-header-desc mb-0 text-muted">
                                            Terhubung dengan siswa dan jawab pertanyaan mereka
                                        </p>
                                    </div>
                                    <div className="text-end">
                                        <div className="d-flex align-items-center gap-3">
                                            <div className="qa-stat-badge">
                                                <i className="fas fa-book me-2"></i>
                                                {teacherCourses.length || 0} Kursus
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {!selectedCourse ? (
                                /* Course Selection View */
                                <div className="course-selection-card">
                                    <div className="form-section-header">
                                        <h3 className="mb-2 fw-bold text-dark">Pilih Kursus</h3>
                                        <p className="mb-0 text-muted">Pilih kursus untuk melihat diskusi dan kelola pertanyaan siswa</p>
                                    </div>
                                    
                                    <div className="p-4">
                                        {/* Search Bar */}
                                        <div className="search-card">
                                            <div className="position-relative">
                                                <input 
                                                    className="form-control form-control-modern" 
                                                    type="search" 
                                                    placeholder="Cari kursus berdasarkan judul atau kategori..." 
                                                    value={courseSearchQuery}
                                                    onChange={handleCourseSearch}
                                                />
                                                <i className="fas fa-search search-icon"></i>
                                            </div>
                                            {courseSearchQuery && (
                                                <div className="d-flex justify-content-between align-items-center">
                                                    <small className="text-muted ms-3 mt-3 mb-3">
                                                        Ditemukan {filteredCourses.length} kursus{filteredCourses.length !== 1 ? "" : ""}
                                                    </small>
                                                </div>
                                            )}
                                        </div>

                                        {/* Course Grid */}
                                        {filteredCourses.length === 0 ? (
                                            <div className="empty-state">
                                                <i className="fas fa-search empty-icon"></i>
                                                <h4 className="mb-3">Tidak Ada Kursus Ditemukan</h4>
                                                <p className="mb-3">
                                                    {courseSearchQuery 
                                                        ? `Tidak ada kursus yang sesuai "${courseSearchQuery}"`
                                                        : "Anda belum membuat kursus apa pun"
                                                    }
                                                </p>
                                                {courseSearchQuery && (
                                                    <button 
                                                        className="btn btn-qa"
                                                        onClick={clearCourseSearch}
                                                    >
                                                        Tampilkan Semua Kursus
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="row">
                                                {filteredCourses.map((course, index) => (
                                                    <div key={course?.id || `course-${index}`} className="col-lg-6 col-12">
                                                        <div 
                                                            className="student-qa-course-card"
                                                            onClick={() => handleCourseSelect(course)}
                                                        >
                                                            {/* Course Image Header */}
                                                            <div className="course-image-container">
                                                                {course?.image ? (
                                                                    <img 
                                                                        src={course.image.startsWith("http") 
                                                                            ? course.image 
                                                                            : getMediaUrl(course.image)
                                                                        } 
                                                                        alt={course?.title || "Course"}
                                                                        className="course-image"
                                                                        onError={(e) => {
                                                                            e.target.style.display = "none";
                                                                            e.target.nextSibling.style.display = "flex";
                                                                        }}
                                                                    />
                                                                ) : null}
                                                                <div 
                                                                    className="course-placeholder course-image-placeholder"
                                                                    style={{ display: course?.image ? "none" : "flex" }}
                                                                >
                                                                    <i className="fas fa-graduation-cap"></i>
                                                                </div>
                                                            </div>

                                                            {/* Course Info */}
                                                            <div className="course-info">
                                                                <h5 className="student-qa-course-title">
                                                                    {course?.title || "Untitled Course"}
                                                                </h5>
                                                                <p className="course-instructor">
                                                                    <i className="fas fa-graduation-cap me-2"></i>
                                                                    {translateLevel(course?.level)}
                                                                </p>
                                                                
                                                                {/* Course Meta Information */}
                                                                <div className="student-qa-course-meta">
                                                                    <span className="qa-stats-badge">
                                                                        <i className="fas fa-comments"></i>
                                                                        {course.qa_count || 0} Pertanyaan
                                                                    </span>
                                                                    <span className="discussion-activity">
                                                                        <i className="fas fa-users"></i>
                                                                        Diskusi Aktif
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Course Action Area - REMOVED, button moved to meta */}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : !selectedConversation ? (
                                /* Questions View for Selected Course */
                                <>
                                    {/* Modern Search Section with Course Header */}
                                    <div className="qa-search-section mb-4">
                                        {/* Back Button and Course Title */}
                                        <div className="d-flex align-items-center mb-3 gap-3 qa-course-header">
                                            <button 
                                                className="btn btn-light rounded-circle"
                                                onClick={() => setSelectedCourse(null)}
                                                title="Kembali ke kursus"
                                            >
                                                <i className="fas fa-arrow-left"></i>
                                            </button>
                                            <div className="qa-course-info">
                                                <h3 className="mb-0">{selectedCourse?.title || "Kursus"}</h3>
                                                <small className="text-muted">{selectedCourse?.qa_count || 0} Pertanyaan</small>
                                            </div>
                                        </div>

                                        {/* ✨ PHASE 7.9-7.10: Filter controls - Search and dropdowns with proportional widths */}
                                        <div className="mb-0" style={{ display: 'flex', gap: '1rem', flexWrap: 'nowrap', alignItems: 'flex-end' }}>
                                            {/* Search Input - 50% */}
                                            <div style={{ flex: '1 1 50%' }}>
                                                <label style={{ display: 'block', fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#2c3e50' }}>
                                                    <i className="fas fa-search" style={{ marginRight: '0.5rem', color: '#3498db' }}></i>
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
                                                        e.target.style.borderColor = '#3498db';
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
                                                    <i className="fas fa-layer-group" style={{ marginRight: '0.5rem', color: '#9b59b6' }}></i>
                                                    Bagian
                                                </label>
                                                <select
                                                    value={discussionFilters.bagian || ''}
                                                    onChange={(e) => {
                                                        const selectedId = e.target.value;
                                                        setDiscussionFilters({ ...discussionFilters, bagian: selectedId || null, pelajaran: null });
                                                        // ✨ PHASE 7.15: Log when bagian is selected for debugging
                                                        if (selectedId) {
                                                            const foundBagian = selectedCourse?.curriculum?.find(v => String(v.variant_id) === String(selectedId));
                                                            console.log(`[Bagian Selected] ID: "${selectedId}" (type: ${typeof selectedId})`);
                                                            console.log(`[Bagian Selected] Found bagian: ${foundBagian?.title}`);
                                                            console.log(`[Bagian Selected] Variant items count: ${foundBagian?.variant_items?.length || 0}`);
                                                            if (foundBagian?.variant_items?.length === 0 || !foundBagian?.variant_items) {
                                                                console.warn(`[Bagian Selected] ⚠️ No variant_items in selected bagian!`);
                                                                console.log(`[Curriculum Debug] Full curriculum:`, selectedCourse?.curriculum);
                                                            }
                                                        }
                                                    }}
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
                                                        e.target.style.borderColor = '#9b59b6';
                                                        e.target.style.boxShadow = '0 0 0 3px rgba(155, 89, 182, 0.1)';
                                                    }}
                                                    onBlur={(e) => {
                                                        e.target.style.borderColor = '#e9ecef';
                                                        e.target.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)';
                                                    }}
                                                >
                                                    <option value="">Semua Bagian</option>
                                                    {selectedCourse?.curriculum?.map((variant) => (
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
                                                    {/* ✨ PHASE 7.15: Convert variant_id to string to handle IDs as string or number from backend */}
                                                    {discussionFilters.bagian && selectedCourse?.curriculum?.find(v => String(v.variant_id) === String(discussionFilters.bagian))?.variant_items?.map((item) => (
                                                        <option key={item.variant_item_id} value={item.variant_item_id}>
                                                            {item.title}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            
                                            {/* Clear Filters Button - ✨ PHASE 7.14: Fixed wrapping with flex-wrap and flex-direction */}
                                            {(discussionFilters.search || discussionFilters.bagian || discussionFilters.pelajaran) && (
                                                <button
                                                    onClick={() => setDiscussionFilters({ search: '', bagian: null, pelajaran: null })}
                                                    className="qa-reply-btn"
                                                    style={{ 
                                                        background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)', 
                                                        padding: '0.75rem 1.5rem', 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        justifyContent: 'center',
                                                        gap: '0.5rem', 
                                                        flexWrap: 'wrap',
                                                        minWidth: 'fit-content'
                                                    }}
                                                >
                                                    <i className="fas fa-times" style={{ fontSize: '0.9rem' }}></i>
                                                    <span>Bersihkan Filter</span>
                                                </button>
                                            )}
                                        </div>

                                    {/* Modern Questions Container - ✨ PHASE 7.18: Moved INSIDE qa-search-section */}
                                    <div className="modern-questions-container">
                                        {loading ? (
                                            <div className="qa-empty-state">
                                                <div className="qa-empty-state-icon mb-4">
                                                    <i className="fas fa-spinner fa-spin qa-empty-state-icon-i"></i>
                                                </div>
                                                <h4 className="qa-empty-title mb-3">Memuat Pertanyaan...</h4>
                                                <p className="qa-empty-desc text-muted mb-0">
                                                    Silakan tunggu sambil kami mengambil diskusi.
                                                </p>
                                            </div>
                                        ) : error ? (
                                            <div className="qa-empty-state">
                                                <div className="qa-empty-state-icon mb-4">
                                                    <i className="fas fa-exclamation-triangle qa-empty-state-icon-i" style={{color: "#dc3545"}}></i>
                                                </div>
                                                <h4 className="qa-empty-title mb-3">Kesalahan Memuat Pertanyaan</h4>
                                                <p className="qa-empty-desc text-muted mb-0">{error}</p>
                                                <button 
                                                    className="btn qa-reply-btn mt-3"
                                                    onClick={() => fetchCourseQuestions(selectedCourse?.id)}
                                                >
                                                    <i className="fas fa-refresh me-2"></i>
                                                    Coba Lagi
                                                </button>
                                            </div>
                                        ) : filteredQuestions?.length > 0 ? (
                                            <div className="row g-4">
                                                {filteredQuestions.map((q, index) => (
                                                    <div key={q.id || q.qa_id || `question-${index}`} className="col-12">
                                                        <div className="modern-question-card qa-card-hover" style={{ cursor: 'pointer' }} onClick={() => setSelectedConversation(q)}>
                                                            {/* ✨ PHASE 7.18: Top section - Title with Avatar on left, Badges on right */}
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                                                                {/* Header with Avatar + Title Side-by-Side */}
                                                                <div className="question-header" style={{ display: 'flex', gap: '1rem', flex: 1, minWidth: 0 }}>
                                                                    {/* Avatar - Fixed width */}
                                                                    {q.profile?.image ? (
                                                                        <img
                                                                            src={q.profile?.image?.startsWith("http") 
                                                                                ? q.profile.image 
                                                                                : q.profile?.image?.startsWith("/images/")
                                                                                    ? q.profile.image
                                                                                    : getMediaUrl(q.profile?.image)}
                                                                            alt={q.profile?.full_name || "User"}
                                                                            className="avatar-modern"
                                                                            onError={(e) => {
                                                                                e.target.style.display = "none";
                                                                            }}
                                                                            style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '3px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                                                                        />
                                                                    ) : (
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
                                                                    
                                                                    {/* Title and User Info */}
                                                                    <div className="question-content" style={{ flex: 1, minWidth: 0 }}>
                                                                        <h5 className="qa-question-title mb-1" style={{ marginBottom: '0.25rem' }}>
                                                                            {q.title || 'Tidak Ada Judul'}
                                                                        </h5>
                                                                        <div style={{ fontSize: '0.9rem', color: '#6c757d' }}>
                                                                            <span>{q.profile?.full_name || 'Pengguna Anonim'}</span>
                                                                            <span style={{ marginLeft: '0.5rem' }}>• {moment(q.date).fromNow()}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                
                                                                {/* ✨ PHASE 7.18: Badges on top right with FULL TEXT */}
                                                                <div className="d-flex align-items-center gap-2" style={{ marginLeft: 'auto', flexShrink: 0, flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem' }}>
                                                                    {/* Bagian & Pelajaran badges - FULL TEXT badges */}
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
                                                                                    fontSize: '0.85rem',
                                                                                    fontWeight: '600',
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
                                                                                    fontSize: '0.85rem',
                                                                                    fontWeight: '600',
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
                                                            </div>
                                                            
                                                            {/* Message preview - MAX 2 LINES */}
                                                            {(q.message || (q.messages && q.messages[0]?.message)) && (
                                                                <p className="question-message-preview">
                                                                    {(q.message || q.messages?.[0]?.message || 'Tidak ada pesan').substring(0, 200)}
                                                                    {(q.message || q.messages?.[0]?.message || '').length > 200 ? '...' : ''}
                                                                </p>
                                                            )}
                                                            
                                                            {/* ✨ PHASE 7.18: Meta information at bottom - Replies badge first, like button on right */}
                                                            <div className="question-meta" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e9ecef', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                                                                    <span className="question-meta-item">
                                                                        <span className="replies-badge">
                                                                            <i className="fas fa-comments" style={{ marginRight: '0.5rem' }}></i>
                                                                            {q.replies_count || 0} Balasan
                                                                        </span>
                                                                    </span>
                                                                </div>
                                                                {/* ✨ PHASE 7.18: Like and Report buttons on question card */}
                                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                    {/* ✨ PHASE 7.27: Make like button icon conditional on user_liked status and add color */}
                                                                    <button className="forum-like-btn" title="Sukai pertanyaan ini" onClick={(e) => { e.stopPropagation(); handleLikeQuestion(q); }}
                                                                        style={{
                                                                            color: q?.user_liked ? '#e91e63' : 'inherit',
                                                                        }}
                                                                    >
                                                                        <i className={`${q?.user_liked ? 'fas' : 'far'} fa-heart`}></i>
                                                                        <span className="like-count">{q.likes_count || 0}</span>
                                                                    </button>
                                                                    {(() => {
                                                                        const reportStatus = getQAReportStatus(q.qa_id, 'question');
                                                                        return (
                                                                            <button 
                                                                                className="forum-report-btn" 
                                                                                title={reportStatus ? `Laporan: ${reportStatus.status}` : "Laporkan pertanyaan ini"}
                                                                                onClick={(e) => { e.stopPropagation(); handleOpenReportModal(q); }}
                                                                                style={reportStatus ? { color: '#d32f2f', opacity: 0.8 } : {}}
                                                                            >
                                                                                <i className="fas fa-flag"></i>
                                                                                {reportStatus && <span style={{ marginLeft: '0.3rem', fontSize: '0.75rem' }}>●</span>}
                                                                            </button>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="qa-empty-state">
                                                <div className="qa-empty-state-icon mb-4">
                                                    <i className="fas fa-question-circle qa-empty-state-icon-i"></i>
                                                </div>
                                                <h4 className="qa-empty-title mb-3">Tidak Ada Pertanyaan</h4>
                                                <p className="qa-empty-desc text-muted mb-0">
                                                    Ketika siswa mengajukan pertanyaan tentang kursus ini, mereka akan muncul di sini.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    </div>
                                </>
                            ) : (
                                /*  Forum Thread View for Selected Conversation */
                                <div className="forum-thread-container-instructor">
                                    {/* Professional Forum Header */}
                                    <div className="forum-thread-header">
                                        <div className="forum-thread-title-area">
                                            <div className="d-flex align-items-center gap-3">
                                                <button
                                                    className="btn btn-outline-primary"
                                                    onClick={handleBackToQuestions}
                                                    style={{ minWidth: '50px', padding: '0.5rem 1rem', flexShrink: 0 }}
                                                >
                                                    <i className="fas fa-arrow-left me-2"></i>
                                                    Kembali
                                                </button>
                                                <h2 className="forum-thread-title">
                                                    {selectedConversation?.title || 'Tidak Ada Judul'}
                                                </h2>
                                            </div>
                                        </div>
                                        {/* Meta Info Footer */}
                                        <div className="forum-header-footer">
                                            <div className="forum-thread-meta">
                                                <span className="forum-meta-badge">
                                                    <i className="fas fa-comments"></i>
                                                    {selectedConversation?.replies_count || 0} Balasan
                                                </span>
                                                <span className="forum-meta-badge">
                                                    <i className="fas fa-clock"></i>
                                                    {moment(selectedConversation?.date).fromNow()}
                                                </span>
                                            </div>
                                            <div className="forum-breadcrumb">
                                                {selectedConversation?.variant && (
                                                    <>
                                                        <i className="fas fa-folder me-1" style={{ color: '#016b87' }}></i>
                                                        <span>{selectedConversation.variant.title}</span>
                                                        {selectedConversation.variant_item && <span className="mx-2">/</span>}
                                                    </>
                                                )}
                                                {selectedConversation?.variant_item && (
                                                    <>
                                                        <i className="fas fa-file me-1" style={{ color: '#662d91' }}></i>
                                                        <span>{selectedConversation.variant_item.title}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Original Question Card - Professional Style */}
                                    <div className="forum-post-card forum-original-post">
                                        {/* Post Header */}
                                        <div className="forum-post-header">
                                            <div className="forum-user-info">
                                                <div className="forum-user-avatar-wrapper">
                                                    {selectedConversation?.profile?.image ? (
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
                                                        style={{ display: selectedConversation?.profile?.image ? "none" : "flex" }}
                                                    >
                                                        <i className="fas fa-user"></i>
                                                    </div>
                                                </div>
                                                <div className="forum-user-details">
                                                    <div className="forum-user-name">
                                                        {selectedConversation?.profile?.full_name || 'Pengguna Anonim'}
                                                        <span className="forum-user-badge-asker">Penanya</span>
                                                        {/* ✨ PHASE 7.21: Check instructor badge using both user_id and profile?.user_id for robustness */}
                                                        {selectedCourse?.teacher && (
                                                            (selectedConversation?.user_id === selectedCourse.teacher.user_id) ||
                                                            (selectedConversation?.profile?.user_id === selectedCourse.teacher.user_id)
                                                        ) && (
                                                            <span className="forum-user-badge-instructor" title="Instruktur Kursus">
                                                                <i className="fas fa-chalkboard-user"></i>
                                                                Instruktur
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="forum-user-timestamp">
                                                        <i className="fas fa-clock-o me-1"></i>
                                                        {moment(selectedConversation?.date).format("DD MMM YYYY [pada] HH:mm")}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Post Content */}
                                        <div className="forum-post-content">
                                            {selectedConversation?.message || selectedConversation?.description || selectedConversation?.messages?.[0]?.message || 'Tidak ada pesan'}
                                        </div>
                                        {/* Post Footer with Like and Report Button */}
                                        <div className="forum-post-footer">
                                            <div className="forum-post-actions">
                                                <button 
                                                    className="forum-like-btn" 
                                                    title="Sukai pertanyaan ini"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleLikeQuestion(selectedConversation);
                                                    }}
                                                    style={{
                                                        color: selectedConversation?.user_liked ? '#e91e63' : 'inherit',
                                                    }}
                                                >
                                                    <i className={`${selectedConversation?.user_liked ? 'fas' : 'far'} fa-heart`}></i>
                                                    <span className="like-count">{selectedConversation?.likes_count || 0}</span>
                                                </button>
                                                {(() => {
                                                    const reportStatus = getQAReportStatus(selectedConversation?.qa_id, 'question');
                                                    return (
                                                        <button 
                                                            className="forum-report-btn" 
                                                            title={reportStatus ? `Laporan: ${reportStatus.status}` : "Laporkan pertanyaan ini"}
                                                            onClick={() => handleOpenReportModal(selectedConversation)}
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
                                    {selectedConversation?.messages && selectedConversation.messages.length > 1 && (
                                        <div className="forum-replies-section">
                                            <div className="forum-replies-list">
                                                {selectedConversation.messages.slice(1).map((msg, index) => {
                                                    const currentUser = UserData();
                                                    const isCurrentUser = msg.profile?.user_id === currentUser?.user_id || msg.user_id === currentUser?.user_id;
                                                    const isInstructor = selectedCourse?.teacher && (
                                                        msg.user_id === selectedCourse.teacher.user_id ||
                                                        msg.profile?.user_id === selectedCourse.teacher.user_id
                                                    );
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
                                                                        title="Sukai jawaban ini"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleLikeMessage(msg, selectedConversation?.qa_id);
                                                                        }}
                                                                        style={{
                                                                            color: msg?.user_liked ? '#e91e63' : 'inherit',
                                                                        }}
                                                                    >
                                                                        <i className={`${msg?.user_liked ? 'fas' : 'far'} fa-heart`}></i>
                                                                        <span className="like-count">{msg.likes_count || 0}</span>
                                                                    </button>
                                                                    {(() => {
                                                                        const reportStatus = getQAReportStatus(msg.qa_id, 'message');
                                                                        return (
                                                                            <button 
                                                                                className="forum-report-btn" 
                                                                                title={reportStatus ? `Laporan: ${reportStatus.status}` : "Laporkan jawaban ini"}
                                                                                onClick={() => handleOpenReportModal(msg)}
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
                                            <div ref={lastElementRef}></div>
                                        </div>
                                    )}

                                    {/* No Replies State */}
                                    {(!selectedConversation?.messages || selectedConversation.messages.length <= 1) && (
                                        <div className="forum-no-replies">
                                            <div className="forum-empty-state">
                                                <i className="fas fa-comment-dots"></i>
                                                <h4>Belum ada balasan</h4>
                                                <p>Jadilah yang pertama memberikan balasan untuk pertanyaan ini!</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Reply Input Form */}
                                    <div className="forum-reply-form-section">
                                        <h5 className="forum-reply-title mb-3">Tambahkan Balasan</h5>
                                        <form className="message-form-qa" onSubmit={sendNewMessage}>
                                            <textarea 
                                                name="message" 
                                                className="message-textarea-qa" 
                                                rows="4" 
                                                onChange={handleMessageChange}
                                                value={getCurrentMessage()}
                                                placeholder="Ketik balasan Anda di sini..."
                                                disabled={messageLoading}
                                                required
                                            />
                                            <button 
                                                className="qa-send-btn" 
                                                type="submit"
                                                disabled={messageLoading || !getCurrentMessage().trim()}
                                            >
                                                {messageLoading ? (
                                                    <>
                                                        <span className="spinner-border spinner-border-sm me-2"></span>
                                                        <strong>Mengirim...</strong>
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="fas fa-paper-plane"></i>
                                                        Kirim Balasan
                                                    </>
                                                )}
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Conversation Modal removed - now using inline forum thread view */}

            {/* ✨ PHASE 7.17: Report Modal Dialog */}
            {showReportModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content abuse-report-modal">
                            <div className="modal-header abuse-modal-header">
                                <h5 className="modal-title">
                                    {currentReportData ? (
                                        <>
                                            <i className="fas fa-file-check me-2"></i>
                                            Status Laporan Pertanyaan
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-exclamation-triangle me-2"></i>
                                            Laporkan Pertanyaan
                                        </>
                                    )}
                                </h5>
                                <button 
                                    type="button" 
                                    className="btn-close" 
                                    onClick={handleCloseReportModal}
                                    disabled={isSubmittingReport}
                                ></button>
                            </div>
                            <div className="modal-body">
                                {/* ✨ PHASE 7.16+: Show existing report feedback if available, unless editing */}
                                {currentReportData && !editingReportId ? (
                                    <>
                                        {/* Report Status Section */}
                                        <div className="mb-0">
                                            <div className="d-flex align-items-center gap-2 mb-3">
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

                                            <div className="d-flex gap-3 flex-wrap align-items-start">
                                            {/* Report Details */}
                                            <div className="card bg-light mb-3" style={{ flex: '1 1 calc(50% - 0.75rem)', minWidth: '280px' }}>
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
                                                    
                                                    {/* Horizontal Layout for Description */}
                                                    {currentReportData.description && (
                                                        <div className="d-flex justify-content-between align-items-start mb-3">
                                                            <label className="form-label fw-semibold text-muted mb-0">Deskripsi Laporan:</label>
                                                            <p className="mb-0 text-break text-end ps-2">{currentReportData.description}</p>
                                                        </div>
                                                    )}

                                                    {/* Horizontal Layout for Timestamp */}
                                                    <div className="d-flex justify-content-between align-items-start">
                                                        <label className="form-label fw-semibold text-muted mb-0">Tanggal Lapor:</label>
                                                        <p className="mb-0 text-end">{currentReportData.reported_at ? new Date(currentReportData.reported_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Admin Feedback Section */}
                                            {currentReportData.reviewed_at && (
                                                <div className="card border-success mb-0" style={{ flex: '1 1 calc(50% - 0.75rem)', minWidth: '280px' }}>
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
                                                value={reportReason}
                                                onChange={(e) => setReportReason(e.target.value)}
                                                disabled={isSubmittingReport}
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
                                                value={reportDescription}
                                                onChange={(e) => setReportDescription(e.target.value)}
                                                disabled={isSubmittingReport}
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
                                        onClick={handleCloseReportModal}
                                        disabled={isSubmittingReport}
                                    >
                                        {currentReportData ? 'Selesai' : 'Batal'}
                                    </button>
                                )}
                                
                                {/* ✨ PHASE 7.16+: Edit Laporan button - only when viewing existing report (NOT editing) and status is NOT pending and NOT closed */}
                                {currentReportData && !editingReportId && currentReportData?.status !== 'pending' && !closedReports.has(currentReportData?.id) && (
                                    <button 
                                        type="button" 
                                        className="btn btn-warning"
                                        onClick={handleEditQAReport}
                                        disabled={isSubmittingReport}
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
                                        onClick={handleSubmitReport}
                                        disabled={isSubmittingReport || !reportReason.trim()}
                                    >
                                        {isSubmittingReport ? (
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

            <Footer />
        </>
    );
}

export default React.memo(QA);