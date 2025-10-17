import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import Modal from "react-bootstrap/Modal";
import dayjs, { moment } from "../../utils/dayjs";

import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";

import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import { getMediaUrl, DEFAULT_IMAGE_URL } from "../../utils/constants";
import "./QA.css";

function QA() {
    // ============================
    // STATE MANAGEMENT
    // ============================
    
    // Course-related states
    const [enrolledCourses, setEnrolledCourses] = useState([]);
    const [filteredCourses, setFilteredCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [courseSearchQuery, setCourseSearchQuery] = useState("");
    
    // Q&A related states
    const [questions, setQuestions] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [conversationMessages, setConversationMessages] = useState({});
    
    // Loading states
    const [loading, setLoading] = useState(false);
    const [messageLoading, setMessageLoading] = useState(false);
    
    // Modal states
    const [conversationShow, setConversationShow] = useState(false);
    const [createQuestionShow, setCreateQuestionShow] = useState(false);
    const [newQuestion, setNewQuestion] = useState({ title: "", message: "" });
    
    // Refs
    const lastElementRef = useRef();

    // ============================
    // API FUNCTIONS
    // ============================
    
    // Fetch enrolled courses with Q&A count
    const fetchEnrolledCourses = async () => {
        setLoading(true);
        try {
            const response = await useAxios.get(`student/course-list/${UserData()?.user_id}/`);
            
            // Add Q&A count for each course
            const coursesWithQA = await Promise.all(
                response.data.map(async (enrollment) => {
                    try {
                        const qaResponse = await useAxios.get(`student/question-answer-list-create/${enrollment.course.id}/`);
                        return {
                            ...enrollment,
                            qa_count: qaResponse.data?.length || 0
                        };
                    } catch (error) {
                        console.warn(`Q&A data not available for course ${enrollment.course.id}:`, error.response?.status);
                        return { ...enrollment, qa_count: 0 };
                    }
                })
            );
            
            setEnrolledCourses(coursesWithQA);
            setFilteredCourses(coursesWithQA);
        } catch (error) {
            console.error("Error fetching enrolled courses:", error);
            Toast().fire({
                icon: "error",
                title: "Failed to load enrolled courses"
            });
        } finally {
            setLoading(false);
        }
    };

    // Fetch questions for selected course
    const fetchCourseQuestions = async (courseId) => {
        setLoading(true);
        try {
            const response = await useAxios.get(`student/question-answer-list-create/${courseId}/`);
            setQuestions(response.data || []);
        } catch (error) {
            console.error("Error fetching course questions:", error);
            if (error.response?.status === 404) {
                setQuestions([]);
            } else {
                Toast().fire({
                    icon: "error",
                    title: "Failed to load course discussions"
                });
            }
        } finally {
            setLoading(false);
        }
    };

    // Send new message
    const sendNewMessage = async (e) => {
        e.preventDefault();
        
        if (!selectedConversation) {
            console.error("No conversation selected");
            return;
        }

        const currentMessage = getCurrentMessage();
        if (!currentMessage.trim()) {
            Toast().fire({
                icon: "error",
                title: "Please enter a message"
            });
            return;
        }

        setMessageLoading(true);
        try {
            const formdata = new FormData();
            formdata.append("course_id", selectedConversation.course?.id || selectedCourse.course.id);
            formdata.append("user_id", UserData()?.user_id);
            formdata.append("message", currentMessage);
            formdata.append("qa_id", selectedConversation?.qa_id);

            const response = await useAxios.post(`student/question-answer-message-create/`, formdata);
            
            if (response.data.question) {
                setSelectedConversation(response.data.question);
                setQuestions(prev => prev.map(q => 
                    q.qa_id === selectedConversation.qa_id ? response.data.question : q
                ));
            }
            
            // Clear message after sending
            const conversationId = selectedConversation.qa_id || selectedConversation.id;
            setConversationMessages(prev => ({
                ...prev,
                [conversationId]: ""
            }));

            // Removed toast notification as requested
        } catch (error) {
            console.error("Error sending message:", error);
            Toast().fire({
                icon: "error",
                title: "Failed to send message"
            });
        } finally {
            setMessageLoading(false);
        }
    };

    // Create new question
    const createNewQuestion = async (e) => {
        e.preventDefault();
        
        if (!newQuestion.title.trim() || !newQuestion.message.trim()) {
            Toast().fire({
                icon: "error",
                title: "Please fill in all fields"
            });
            return;
        }

        setLoading(true);
        try {
            const formdata = new FormData();
            formdata.append("course_id", selectedCourse.course.id);
            formdata.append("user_id", UserData()?.user_id);
            formdata.append("title", newQuestion.title);
            formdata.append("message", newQuestion.message);

            await useAxios.post(`student/question-answer-list-create/${selectedCourse.course.id}/`, formdata);
            
            await fetchCourseQuestions(selectedCourse.course.id);
            handleCreateQuestionClose();
            
            Toast().fire({
                icon: "success",
                title: "Question created successfully!"
            });
        } catch (error) {
            console.error("Error creating question:", error);
            Toast().fire({
                icon: "error",
                title: "Failed to create question"
            });
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
            setFilteredCourses(enrolledCourses);
        } else {
            const filtered = enrolledCourses.filter((enrollment) => {
                const categoryText = typeof enrollment.course?.category === 'object' 
                    ? enrollment.course.category?.title || enrollment.course.category?.name || ''
                    : enrollment.course?.category || '';
                
                return enrollment.course?.title?.toLowerCase().includes(query) ||
                        enrollment.course?.teacher?.full_name?.toLowerCase().includes(query) ||
                        categoryText.toLowerCase().includes(query);
            });
            setFilteredCourses(filtered);
        }
    };

    // Clear course search
    const clearCourseSearch = () => {
        setCourseSearchQuery("");
        setFilteredCourses(enrolledCourses);
    };

    // Handle search questions
    const handleSearchQuestion = (event) => {
        const query = event.target.value.toLowerCase();
        if (!selectedCourse) return;
        
        if (query === "") {
            fetchCourseQuestions(selectedCourse.course.id);
        } else {
            const filtered = questions?.filter((question) => {
                return question.title?.toLowerCase().includes(query) ||
                       question.messages?.[0]?.message?.toLowerCase().includes(query);
            });
            setQuestions(filtered);
        }
    };

    // ============================
    // MODAL HANDLERS
    // ============================
    
    // Conversation modal handlers
    const handleConversationClose = () => {
        setConversationShow(false);
        setSelectedConversation(null);
    };
    
    const handleConversationShow = (conversation) => {
        setSelectedConversation(conversation);
        setConversationShow(true);
    };

    // Create question modal handlers
    const handleCreateQuestionClose = () => {
        setCreateQuestionShow(false);
        setNewQuestion({ title: "", message: "" });
    };

    const handleCreateQuestionShow = () => {
        if (!selectedCourse) {
            Toast().fire({
                icon: "warning",
                title: "Please select a course first"
            });
            return;
        }
        setCreateQuestionShow(true);
    };

    // ============================
    // MESSAGE HANDLERS
    // ============================
    
    // Handle message change with conversation-specific storage
    const handleMessageChange = (event) => {
        if (!selectedConversation) return;
        
        const conversationId = selectedConversation.qa_id || selectedConversation.id;
        setConversationMessages(prev => ({
            ...prev,
            [conversationId]: event.target.value
        }));
    };

    // Get current message for selected conversation
    const getCurrentMessage = () => {
        if (!selectedConversation) return "";
        const conversationId = selectedConversation.qa_id || selectedConversation.id;
        return conversationMessages[conversationId] || "";
    };

    // ============================
    // OTHER HANDLERS
    // ============================
    
    // Handle course selection
    const handleCourseSelect = (course) => {
        setSelectedCourse(course);
        fetchCourseQuestions(course.course.id);
        setQuestions([]);
    };

    // ============================
    // EFFECTS
    // ============================
    
    useEffect(() => {
        fetchEnrolledCourses();
    }, []);

    // Update filtered courses when enrolled courses change
    useEffect(() => {
        if (courseSearchQuery === "") {
            setFilteredCourses(enrolledCourses);
        } else {
            handleCourseSearch({ target: { value: courseSearchQuery } });
        }
    }, [enrolledCourses]);

    // Auto scroll when conversation changes
    useEffect(() => {
        if (lastElementRef.current) {
            lastElementRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [selectedConversation?.messages]);

    // ============================
    // HELPER COMPONENTS
    // ============================
    
    // Default avatar component
    const DefaultAvatar = ({ size = "40px" }) => (
        <div 
            className={`avatar-placeholder ${size === '40px' ? 'avatar-sm' : size === '60px' ? 'avatar-md' : 'avatar-lg'}`}
            style={{ width: size, height: size }}
        >
            <i className="fas fa-user avatar-icon"></i>
        </div>
    );

    return (
        <>
            <BaseHeader />

            <section className="modern-qa-page">
                <div className="container">
                    <Header />
                    <div className="row mt-0 mt-md-4">
                        <Sidebar />
                        <div className="col-lg-9 col-md-8 col-12">
                            {/* Q&A Header */}
                            <div className="qa-header-card">
                                <div className="qa-header-content">
                                    <div className="row align-items-center">
                                        <div className="col-lg-8">
                                            <h1 className="mb-3 fw-bold d-flex align-items-center">
                                                <i className="fas fa-comments me-3 qa-page-icon"></i>
                                                Question & Answer
                                            </h1>
                                            <p className="mb-0 opacity-90 lead">
                                                Ask questions, get answers, and participate in course discussions with instructors and fellow students.
                                            </p>
                                        </div>
                                        <div className="col-lg-4">
                                            <div className="stats-grid mt-0">
                                                <div className="qa-stat-card">
                                                    <div className="qa-stat-number justify-content-end">
                                                        {enrolledCourses.length}
                                                    </div>
                                                    <div className="stat-label">Active Courses</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {!selectedCourse ? (
                                /* Course Selection View */
                                <div className="course-selection-card">
                                    <div className="form-section-header">
                                        <h3 className="mb-2 fw-bold text-dark">Select Course</h3>
                                        <p className="mb-0 text-muted">Choose a course to view discussions and ask questions</p>
                                    </div>
                                    
                                    <div className="p-4">
                                        {/* Search Bar */}
                                        <div className="search-card">
                                            <div className="position-relative">
                                                <input 
                                                    className="form-control form-control-modern" 
                                                    type="search" 
                                                    placeholder="Search courses by title, instructor, or category..." 
                                                    value={courseSearchQuery}
                                                    onChange={handleCourseSearch}
                                                />
                                                <i className="fas fa-search search-icon"></i>
                                            </div>
                                            {courseSearchQuery && (
                                                <div className="mt-3 d-flex justify-content-between align-items-center">
                                                    <small className="text-muted">
                                                        Found {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''}
                                                    </small>
                                                    <button 
                                                        className="btn btn-outline-secondary btn-sm"
                                                        onClick={clearCourseSearch}
                                                    >
                                                        <i className="fas fa-times me-1"></i>
                                                        Clear
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Course Grid */}
                                        {loading ? (
                                            <div className="empty-state">
                                                <div className="spinner-border text-primary qa-loading-spinner">
                                                    <span className="visually-hidden">Loading...</span>
                                                </div>
                                                <p className="mt-3">Loading your courses...</p>
                                            </div>
                                        ) : filteredCourses.length === 0 ? (
                                            <div className="empty-state">
                                                <i className="fas fa-search empty-icon"></i>
                                                <h4 className="mb-3">No Courses Found</h4>
                                                <p className="mb-3">
                                                    {courseSearchQuery 
                                                        ? `No courses match "${courseSearchQuery}"`
                                                        : "You haven't enrolled in any courses yet"
                                                    }
                                                </p>
                                                {courseSearchQuery && (
                                                    <button 
                                                        className="btn btn-qa"
                                                        onClick={clearCourseSearch}
                                                    >
                                                        Show All Courses
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="row">
                                                {filteredCourses.map((enrollment, index) => (
                                                    <div key={enrollment.course?.id || `course-${index}`} className="col-lg-6 col-12">
                                                        <div 
                                                            className="student-qa-course-card"
                                                            onClick={() => handleCourseSelect(enrollment)}
                                                        >
                                                            {/* Course Header */}
                                                            <div className="course-card-header">
                                                                <div className="course-image-container">
                                                                    {enrollment.course?.image ? (
                                                                        <img 
                                                                            src={enrollment.course.image.startsWith("http") 
                                                                                ? enrollment.course.image 
                                                                                : `getMediaUrl(enrollment.course.image)`
                                                                            } 
                                                                            alt={enrollment.course?.title || 'Course'}
                                                                            className="course-image"
                                                                            onError={(e) => {
                                                                                e.target.style.display = 'none';
                                                                                e.target.nextSibling.style.display = 'flex';
                                                                            }}
                                                                        />
                                                                    ) : null}
                                                                    <div 
                                                                        className="course-placeholder course-image-placeholder"
                                                                        style={{ display: enrollment.course?.image ? 'none' : 'flex' }}
                                                                    >
                                                                        <i className="fas fa-graduation-cap"></i>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="course-info">
                                                                    <h5 className="student-qa-course-title">
                                                                        {enrollment.course?.title || 'Untitled Course'}
                                                                    </h5>
                                                                    <p className="course-instructor">
                                                                        <i className="fas fa-chalkboard-teacher me-2"></i>
                                                                        {enrollment.course?.teacher?.full_name || 'Unknown Instructor'}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {/* Course Meta Information */}
                                                            <div className="student-qa-course-meta">
                                                                <span className="qa-stats-badge">
                                                                    <i className="fas fa-comments"></i>
                                                                    {enrollment.qa_count || 0} Questions
                                                                </span>
                                                                <span className="discussion-activity">
                                                                    <i className="fas fa-users"></i>
                                                                    Active Discussion
                                                                </span>
                                                            </div>

                                                            {/* Course Action Area */}
                                                            <div className="course-action-area">
                                                                <button className="join-discussion-btn">
                                                                    <i className="fas fa-comment-dots"></i>
                                                                    Join Discussion
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
                                /* Q&A Discussion View */
                                <div className="qa-discussion-card">
                                    <div className="form-section-header">
                                        <div className="d-flex justify-content-between align-items-center">
                                            <div>
                                                <h3 className="mb-2 fw-bold text-dark">
                                                    {selectedCourse.course?.title} Discussion
                                                </h3>
                                                <p className="mb-0 text-muted">Ask questions and participate in course discussions</p>
                                            </div>
                                            <div className="d-flex gap-2">
                                                <button 
                                                    className="btn btn-outline-secondary"
                                                    onClick={() => setSelectedCourse(null)}
                                                >
                                                    <i className="fas fa-arrow-left me-1"></i>
                                                    Back
                                                </button>
                                                <button 
                                                    className="btn btn-qa"
                                                    onClick={handleCreateQuestionShow}
                                                    disabled={loading}
                                                >
                                                    <i className="fas fa-plus me-1"></i>
                                                    Ask Question
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="p-4">
                                        {/* Search Questions */}
                                        <div className="search-card">
                                            <div className="position-relative">
                                                <input 
                                                    className="form-control form-control-modern" 
                                                    type="search" 
                                                    placeholder="Search questions and discussions..." 
                                                    onChange={handleSearchQuestion}
                                                />
                                                <i className="fas fa-search search-icon"></i>
                                            </div>
                                        </div>

                                        {/* Questions List */}
                                        {loading ? (
                                            <div className="empty-state">
                                                <div className="spinner-border text-primary qa-loading-spinner">
                                                    <span className="visually-hidden">Loading...</span>
                                                </div>
                                                <p className="mt-3">Loading discussions...</p>
                                            </div>
                                        ) : questions?.length === 0 ? (
                                            <div className="empty-state">
                                                <i className="fas fa-question-circle empty-icon"></i>
                                                <h4 className="mb-3">No Questions Yet</h4>
                                                <p className="mb-3">Be the first to ask a question about this course!</p>
                                                <button 
                                                    className="btn btn-qa"
                                                    onClick={handleCreateQuestionShow}
                                                >
                                                    <i className="fas fa-plus me-1"></i>
                                                    Ask First Question
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="row">
                                                {questions.map((q, index) => (
                                                    <div key={q.qa_id || `question-${index}`} className="col-12">
                                                        <div className="question-card">
                                                            {/* Question Header */}
                                                            <div className="question-header">
                                                                <div className="question-avatar">
                                                                    {q.profile?.image ? (
                                                                        <img
                                                                            src={q.profile.image.startsWith("http") 
                                                                                ? q.profile.image 
                                                                                : `getMediaUrl(q.profile.image)`
                                                                            }
                                                                            className="avatar-modern"
                                                                            alt={`${q.profile?.full_name || 'User'} avatar`}
                                                                            onError={(e) => {
                                                                                e.target.style.display = 'none';
                                                                                e.target.nextSibling.style.display = 'flex';
                                                                            }}
                                                                        />
                                                                    ) : null}
                                                                    <div 
                                                                        className="avatar-placeholder question-profile-placeholder"
                                                                        style={{ display: q.profile?.image ? 'none' : 'flex' }}
                                                                    >
                                                                        <i className="fas fa-user"></i>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="question-content">
                                                                    <h5 className="question-title">
                                                                        {q.title || 'No Title'}
                                                                    </h5>
                                                                    
                                                                    <div className="question-meta">
                                                                        <div className="question-meta-item">
                                                                            <i className="fas fa-user question-meta-icon"></i>
                                                                            <span>{q.profile?.full_name || 'Anonymous User'}</span>
                                                                        </div>
                                                                        <div className="question-meta-item">
                                                                            <i className="fas fa-calendar-alt question-meta-icon"></i>
                                                                            <span>{moment(q.date).format("DD MMM, YYYY")}</span>
                                                                        </div>
                                                                        <div className="question-meta-item">
                                                                            <i className="fas fa-clock question-meta-icon"></i>
                                                                            <span>{moment(q.date).fromNow()}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Question Actions */}
                                                            <div className="question-actions">
                                                                <div className="question-stats">
                                                                    <span className="replies-badge">
                                                                        {q.messages?.length || 0} Replies
                                                                    </span>
                                                                    
                                                                    {conversationMessages[q.qa_id || q.id] && (
                                                                        <span className="draft-indicator">
                                                                            Draft Saved
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                
                                                                <button 
                                                                    className="join-discussion-primary" 
                                                                    onClick={() => handleConversationShow(q)}
                                                                >
                                                                    <i className="fas fa-comment-dots"></i>
                                                                    Join Conversation
                                                                    <i className="fas fa-arrow-right discussion-arrow"></i>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Conversation Modal */}
            <Modal show={conversationShow} size="lg" onHide={handleConversationClose} className="conversation-modal-qa">
                {/* Modal Header */}
                <div className="modal-header-modern">
                    <div className="modal-header-content">
                        <div className="modal-header-info">
                            <div className="modal-icon-wrapper">
                                <i className="fas fa-comments"></i>
                            </div>
                            <div className="modal-title-section">
                                <h4 className="modal-title-modern">{selectedConversation?.title || 'Discussion'}</h4>
                                <p className="modal-subtitle">Join the conversation and share your thoughts</p>
                            </div>
                        </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        {/* Show draft indicator */}
                        {getCurrentMessage() && (
                            <span className="badge-draft-qa">
                                <i className="fas fa-edit me-1"></i>
                                Draft
                            </span>
                        )}
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
                                <div key={m.id || `message-${index}`} className={`message-item-qa ${isCurrentUser ? 'message-item-qa-current-user' : ''}`}>
                                    <div className={`d-flex ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                                        <div className="flex-shrink-0">
                                            {m.profile?.image ? (
                                                <img
                                                    className="message-avatar-qa"
                                                    src={m.profile.image.startsWith("http") 
                                                        ? m.profile.image 
                                                        : `getMediaUrl(m.profile.image)`
                                                    }
                                                    alt={`${m.profile?.full_name || 'User'} avatar`}
                                                    onError={(e) => {
                                                        e.target.style.display = 'none';
                                                        e.target.nextSibling.style.display = 'flex';
                                                    }}
                                                />
                                            ) : (
                                                <div 
                                                    className={`message-avatar-qa ${isCurrentUser ? 'current-user' : ''}`}
                                                >
                                                    <i className="fas fa-user"></i>
                                                </div>
                                            )}
                                        </div>
                                        <div className={`${isCurrentUser ? 'me-3' : 'ms-3'} flex-grow-1`}>
                                            <div className={`message-content-qa ${isCurrentUser ? 'message-content-qa-current-user' : ''}`}>
                                                <div className="message-author-qa">
                                                    <div className="message-time-qa">
                                                        <i className="fas fa-clock me-1"></i>
                                                        {moment(m.date).format("DD MMM, YYYY - HH:mm")}
                                                    </div>
                                                    <span>{m.profile?.full_name || 'Anonymous User'}</span>
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
                                <h5>No messages yet</h5>
                                <p>Start the conversation by sending your first message!</p>
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
                            placeholder="Type your message here..."
                            disabled={messageLoading}
                            required
                        />
                        <button 
                            className="message-send-btn-qa" 
                            type="submit"
                            disabled={messageLoading || !getCurrentMessage().trim()}
                        >
                            {messageLoading ? (
                                <span className="spinner-border spinner-border-sm"></span>
                            ) : (
                                <>
                                    <i className="fas fa-paper-plane"></i>
                                    Send
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </Modal>

            {/* Create Question Modal */}
            <Modal show={createQuestionShow} onHide={handleCreateQuestionClose} size="lg" centered className="create-question-modal">
                {/* Modal Header */}
                <div className="modal-header-modern">
                    <div className="modal-header-content">
                        <div className="modal-header-info">
                            <div className="modal-icon-wrapper">
                                <i className="fas fa-question-circle"></i>
                            </div>
                            <div className="modal-title-section">
                                <h4 className="modal-title-modern">Ask a Question</h4>
                                <p className="modal-subtitle">Share your question with the course community and get expert answers</p>
                            </div>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        className="btn-close-modern" 
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCreateQuestionClose();
                        }}
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                {/* Modal Body */}
                <div className="modal-body-modern">
                        <form onSubmit={createNewQuestion} className="question-form">
                            {/* Question Title */}
                            <div className="form-group-modern">
                                <label className="form-label-modern">
                                    <i className="fas fa-heading form-label-icon"></i>
                                    Question Title
                                    <span className="required-indicator">*</span>
                                </label>
                                <div className="input-wrapper-modern">
                                    <input
                                        type="text"
                                        className="form-input-modern"
                                        placeholder="Write a clear, descriptive title for your question..."
                                        value={newQuestion.title}
                                        onChange={(e) => setNewQuestion(prev => ({ ...prev, title: e.target.value }))}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Question Message */}
                            <div className="form-group-modern">
                                <label className="form-label-modern">
                                    <i className="fas fa-edit form-label-icon"></i>
                                    Question Details
                                    <span className="required-indicator">*</span>
                                </label>
                                <div className="textarea-wrapper-modern">
                                    <textarea
                                        className="form-textarea-modern"
                                        rows="4"
                                        placeholder="Provide detailed information about your question. The more context you give, the better answers you'll receive..."
                                        value={newQuestion.message}
                                        onChange={(e) => setNewQuestion(prev => ({ ...prev, message: e.target.value }))}
                                        required
                                    />
                                    <div className="character-counter">
                                        {newQuestion.message?.length || 0}/2000 characters
                                    </div>
                                </div>
                            </div>

                            {/* Tips Section */}
                            <div className="tips-section">
                                <div className="tips-header">
                                    <i className="fas fa-lightbulb tips-icon"></i>
                                    <span>Tips for getting better answers</span>
                                </div>
                                <ul className="tips-list">
                                    <li><i className="fas fa-check"></i>Be specific and clear in your question</li>
                                    <li><i className="fas fa-check"></i>Include relevant context and examples</li>
                                    <li><i className="fas fa-check"></i>Use proper formatting for code snippets</li>
                                    <li><i className="fas fa-check"></i>Search existing questions before posting</li>
                                </ul>
                            </div>
                        </form>
                    </div>

                {/* Modal Footer */}
                <div className="modal-footer-modern">
                        <div className="footer-actions">
                            <button 
                                type="button" 
                                className="btn-cancel-modern" 
                                onClick={handleCreateQuestionClose}
                            >
                                <i className="fas fa-times"></i>
                                Cancel
                            </button>
                            <button 
                                type="submit"
                                className="btn-submit-modern"
                                onClick={createNewQuestion}
                                disabled={!newQuestion.title?.trim() || !newQuestion.message?.trim() || loading}
                            >
                                {loading ? (
                                    <>
                                        <div className="loading-spinner"></div>
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-paper-plane"></i>
                                        Ask Question
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
            </Modal>

            <Footer />
        </>
    );
}

export default React.memo(QA);
