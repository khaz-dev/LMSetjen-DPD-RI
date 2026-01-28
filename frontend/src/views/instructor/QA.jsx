import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import Modal from "react-bootstrap/Modal";
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
import { useInstructorSidebarCollapse } from "./Partials/useInstructorSidebarCollapse";
import { getMediaUrl, DEFAULT_IMAGE_URL } from "../../utils/constants";
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
    
    // Loading states
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [messageLoading, setMessageLoading] = useState(false);
    
    // Modal states
    const [ConversationShow, setConversationShow] = useState(false);
    
    // Refs
    const lastElementRef = useRef(null);

    // ============================
    // API FUNCTIONS
    // ============================
    
    // Fetch teacher's courses with Q&A count
    const fetchTeacherCourses = async () => {
        setLoading(true);
        try {
            const teacherId = UserData()?.teacher_id;
            
            if (!teacherId) {
                throw new Error("Teacher ID not found. Please make sure you are logged in as a teacher.");
            }
            
            const response = await useAxios.get(`teacher/course-lists/${teacherId}/`);
            
            // Handle both array and paginated response formats
            const courseData = Array.isArray(response.data) ? response.data : (response.data?.results || []);
            
            // ✨ PHASE 4.16: Backend now includes qa_count directly in course data
            // No need for additional API calls per course
            setTeacherCourses(courseData);
            setFilteredCourses(courseData);
        } catch (error) {
            console.error("Error fetching teacher courses:", error);
            setError(error.message || "Failed to load courses");
        } finally {
            setLoading(false);
        }
    };

    // Fetch questions for selected course
    const fetchCourseQuestions = async (courseId) => {
        setLoading(true);
        try {
            const teacherId = UserData()?.teacher_id;
            const response = await useAxios.get(`teacher/question-answer-list/${teacherId}/`);
            
            // Extract all questions
            const allQA = response.data?.results || response.data || [];
            
            // Filter by course
            const courseQuestions = allQA.filter(q => q.course?.id === courseId);
            
            setQuestions(courseQuestions);
            setQuestionSearchQuery(""); // Reset search when fetching new questions
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
            fetchCourseQuestions(selectedCourse.id);
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
    // MODAL HANDLERS
    // ============================
    
    const handleConversationClose = () => setConversationShow(false);
    const handleConversationShow = (conversation) => {
        setSelectedConversation(conversation);
        setConversationShow(true);
        
        // Auto-scroll to the bottom when modal opens
        setTimeout(() => {
            if (lastElementRef.current) {
                lastElementRef.current.scrollIntoView({ behavior: "smooth" });
            }
        }, 500);
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

    // Handle course selection
    const handleCourseSelect = (course) => {
        setSelectedCourse(course);
        fetchCourseQuestions(course.id);
    };

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

    useEffect(() => {
        fetchTeacherCourses();
    }, []);

    // Show full-page loading spinner on initial load
    if (loading) {
        return (
            <>
                <BaseHeader />
                <section className="qa-bg-section pt-5 pb-5" style={{ display: "flex", alignItems: "center" }}>
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
            <section className="qa-bg-section pt-5 pb-5">
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
                                                <div className="mt-3 d-flex justify-content-between align-items-center">
                                                    <small className="text-muted">
                                                        Ditemukan {filteredCourses.length} kursus{filteredCourses.length !== 1 ? "" : ""}
                                                    </small>
                                                    <button 
                                                        className="btn btn-outline-secondary btn-sm"
                                                        onClick={clearCourseSearch}
                                                    >
                                                        <i className="fas fa-times me-1"></i>
                                                        Hapus
                                                    </button>
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
                                                                    <i className="fas fa-code-branch me-2"></i>
                                                                    {course?.level || "Semua Level"}
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

                                                            {/* Course Action Area */}
                                                            <div className="course-action-area">
                                                                <button className="join-discussion-btn">
                                                                    <i className="fas fa-comment-dots"></i>
                                                                    Lihat Diskusi
                                                                    <i className="fas fa-arrow-right join-discussion-arrow"></i>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
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

                                        <div className="qa-search-container">
                                            <input 
                                                type="search" 
                                                className="form-control qa-search-input" 
                                                placeholder="Cari pertanyaan di kursus ini..." 
                                                value={questionSearchQuery}
                                                onChange={handleSearchQuestion}
                                            />
                                        </div>
                                    </div>

                                    {/* Modern Questions Container */}
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
                                        ) : questions?.length > 0 ? (
                                            <div className="row g-4">
                                                {questions.map((q, index) => (
                                                    <div key={q.id || q.qa_id || `question-${index}`} className="col-12">
                                                        <div className="modern-question-card qa-card-hover">
                                                            <div className="d-flex align-items-start justify-content-between mb-3">
                                                                <div className="d-flex align-items-center">
                                                                    <div className="qa-avatar-gradient">
                                                                        <img
                                                                            src={q.profile?.image?.startsWith("http") ? q.profile.image : getMediaUrl(q.profile?.image || DEFAULT_AVATAR)}
                                                                            className="rounded-circle qa-avatar-img"
                                                                            alt={`${q.profile?.full_name || "User"} avatar`}
                                                                            onError={(e) => {
                                                                                e.target.src = DEFAULT_AVATAR;
                                                                            }}
                                                                        />
                                                                        <div className="qa-avatar-status">
                                                                            <i className="fas fa-question qa-avatar-status-icon"></i>
                                                                        </div>
                                                                    </div>
                                                                    <div className="ms-3">
                                                                        <h6 className="qa-user-name mb-1">
                                                                            {q.profile?.full_name || "Anonymous User"}
                                                                        </h6>
                                                                        <small className="text-muted">
                                                                            <i className="fas fa-clock me-1"></i>
                                                                            {moment(q.date).format("DD MMM, YYYY")}
                                                                        </small>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="d-flex align-items-center gap-2">
                                                                    <div className="qa-replies-badge">
                                                                        <i className="fas fa-comments me-1"></i>
                                                                        {q.messages?.length || 0}
                                                                    </div>
                                                                    
                                                                    {conversationMessages[q.qa_id || q.id] && (
                                                                        <div className="qa-draft-badge">
                                                                            <i className="fas fa-edit me-1"></i>
                                                                            Draf
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="question-content mb-4">
                                                                <h5 className="qa-question-title mb-3">
                                                                    {q.title || "No Title"}
                                                                </h5>
                                                            </div>
                                                            
                                                            <div className="d-flex justify-content-end">
                                                                <button 
                                                                    className="qa-reply-btn"
                                                                    onClick={() => handleConversationShow(q)}
                                                                >
                                                                    <i className="fas fa-comments me-2"></i>
                                                                    Bergabung dengan Percakapan
                                                                    <i className="fas fa-arrow-right ms-2"></i>
                                                                </button>
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
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Conversation Modal */}
            <Modal show={ConversationShow} size="lg" onHide={handleConversationClose} className="conversation-modal-qa">
                {/* Modal Header */}
                <div className="modal-header-modern qa-modal-header">
                    <div className="modal-header-content">
                        <div className="modal-header-info">
                            <div className="modal-icon-wrapper">
                                <i className="fas fa-comments"></i>
                            </div>
                            <div className="modal-title-section">
                                <h4 className="modal-title-modern">{selectedConversation?.title || "Diskusi"}</h4>
                                <div className="d-flex align-items-center gap-2">
                                    <p className="modal-subtitle">Bergabunglah dengan percakapan dan bagikan pemikiran Anda</p>
                                    {/* Show draft indicator */}
                                    {getCurrentMessage() && (
                                        <span className="badge-draft-qa">
                                            <i className="fas fa-edit me-1"></i>
                                            Draf
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        className="btn-close-modern" 
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleConversationClose();
                        }}
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                {/* Modal Body */}
                <div className="modal-body-modern">
                    <div className="messages-container-qa">
                        {selectedConversation?.messages?.map((m, index) => {
                            const currentUser = UserData();
                            const isCurrentUser = m.profile?.user_id === currentUser?.user_id || m.profile?.id === currentUser?.user_id;
                            return (
                                <div key={m.id || `message-${index}`} className={`message-item-qa ${isCurrentUser ? "message-item-qa-current-user" : ""}`}>
                                    <div className={`d-flex gap-3 ${isCurrentUser ? "flex-row-reverse" : ""}`}>
                                        <div className="flex-shrink-0">
                                            {m.profile?.image ? (
                                                <img
                                                    className="message-avatar-qa"
                                                    src={m.profile.image.startsWith("http") 
                                                        ? m.profile.image 
                                                        : getMediaUrl(m.profile.image)
                                                    }
                                                    alt={`${m.profile?.full_name || "User"} avatar`}
                                                    onError={(e) => {
                                                        e.target.style.display = "none";
                                                        e.target.nextSibling.style.display = "flex";
                                                    }}
                                                />
                                            ) : (
                                                <div 
                                                    className={`message-avatar-qa ${isCurrentUser ? "current-user" : ""}`}
                                                >
                                                    <i className="fas fa-user"></i>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-grow-1">
                                            <div className={`message-content-qa ${isCurrentUser ? "message-content-qa-current-user" : ""}`}>
                                                <div className="message-author-qa">
                                                    <div className="message-time-qa">
                                                        <i className="fas fa-clock me-1"></i>
                                                        {moment(m.date).format("DD MMM, YYYY - HH:mm")}
                                                    </div>
                                                    <span>{m.profile?.full_name || "Anonymous User"}</span>
                                                </div>
                                                <div className="message-text-qa">{m.message}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Empty messages state */}
                        {selectedConversation && (!selectedConversation.messages || selectedConversation.messages.length === 0) && (
                            <div className="empty-conversation-qa">
                                <i className="fas fa-comment"></i>
                                <h5>Belum ada pesan</h5>
                                <p>Mulai percakapan dengan mengirim pesan pertama Anda!</p>
                            </div>
                        )}

                        <div ref={lastElementRef}></div>
                    </div>

                    <form className="message-form-qa" onSubmit={sendNewMessage}>
                        <textarea 
                            name="message" 
                            className="message-textarea-qa" 
                            rows="2" 
                            onChange={handleMessageChange}
                            value={getCurrentMessage()}
                            placeholder="Ketik pesan Anda di sini..."
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
            </Modal>

            <Footer />
        </>
    );
}

export default React.memo(QA);