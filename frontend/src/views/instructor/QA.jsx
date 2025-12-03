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
import { getMediaUrl } from "../../utils/constants";
import "./QA.css";

function QA() {
    const [questions, setQuestions] = useState([]);
    const [allQuestions, setAllQuestions] = useState([]);  // Store original unfiltered questions
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [ConversationShow, setConversationShow] = useState(false);
    const [conversationMessages, setConversationMessages] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const lastElementRef = useRef(null);

    const [messageLoading, setMessageLoading] = useState(false);

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

    const fetchQuestions = async () => {
        try {
            setLoading(true);
            setError(null);
            const teacherId = UserData()?.teacher_id;
            
            if (!teacherId) {
                throw new Error("Teacher ID not found. Please make sure you are logged in as a teacher.");
            }
            
            const response = await useAxios.get(`teacher/question-answer-list/${teacherId}/`);
            // Extract results from paginated response
            const questionsData = response.data.results || response.data;
            setQuestions(questionsData);
            setAllQuestions(questionsData);  // Store unfiltered questions
        } catch (error) {
            console.error("Error fetching questions:", error);
            setError(error.message || "Failed to fetch questions");
        } finally {
            setLoading(false);
        }
    };

    const handleSearchQuestion = (event) => {
        const query = event.target.value.toLowerCase();
        
        // If search is empty, show all questions without refetching
        if (!query.trim()) {
            setQuestions(allQuestions);
            return;
        }
        
        // Filter from all questions (not from current display)
        const filtered = allQuestions.filter(q => 
            q.title?.toLowerCase().includes(query) || 
            q.profile?.full_name?.toLowerCase().includes(query) ||
            q.course?.title?.toLowerCase().includes(query)
        );
        setQuestions(filtered);
    };

    const getCurrentMessage = () => {
        const conversationId = selectedConversation?.qa_id || selectedConversation?.id;
        return conversationMessages[conversationId] || "";
    };

    const handleMessageChange = (e) => {
        const conversationId = selectedConversation?.qa_id || selectedConversation?.id;
        setConversationMessages({
            ...conversationMessages,
            [conversationId]: e.target.value
        });
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
        fetchQuestions();
    }, []);

    // Show full-page loading spinner on initial load
    if (loading) {
        return (
            <>
                <BaseHeader />
                <section className="qa-bg-section" style={{ minHeight: "calc(100vh - 120px)", display: "flex", alignItems: "center" }}>
                    <div className="container" style={{ flex: 1 }}>
                        <Header />
                        <div className="row">
                            <Sidebar />
                            <div className="col-lg-9 col-md-8 col-12" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
                                <div className="text-center">
                                    <div className="spinner-border text-primary" role="status" style={{ width: "3rem", height: "3rem" }}>
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                    <p className="mt-3 text-muted">Loading Q&A...</p>
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
            <section className="modern-qa-page">
                <div className="container">
                    <Header />
                    <div className="row mt-0 mt-md-4">
                        <Sidebar />
                        <div className="col-lg-9 col-md-8 col-12">
                            {/* Q&A Header Card */}
                            <div className="qa-header-card">
                                <div className="qa-header-content">
                                    <div className="row align-items-center">
                                        <div className="col-lg-8">
                                            <h1 className="mb-3 fw-bold d-flex align-items-center">
                                                <i className="fas fa-comments me-3 qa-page-icon"></i>
                                                Student Questions & Answers
                                            </h1>
                                            <p className="mb-0 opacity-90 lead">
                                                Respond to student inquiries, manage course discussions, and provide timely feedback to enhance learning experience.
                                            </p>
                                        </div>
                                        <div className="col-lg-4">
                                            <div className="stats-grid mt-0">
                                                <div className="qa-stat-card">
                                                    <div className="qa-stat-number justify-content-end">
                                                        {questions?.length || 0}
                                                    </div>
                                                    <div className="stat-label">Total Discussions</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Q&A Discussion Card */}
                            <div className="qa-discussion-card">
                                <div className="form-section-header">
                                    <h3 className="mb-2 fw-bold text-dark">All Student Questions</h3>
                                    <p className="mb-0 text-muted">Review and respond to all questions from your students</p>
                                </div>
                                
                                <div className="p-4">
                                    {/* Search Questions */}
                                    <div className="search-card">
                                        <div className="position-relative">
                                            <input 
                                                className="form-control form-control-modern" 
                                                type="search" 
                                                placeholder="Search questions, students, or courses..." 
                                                onChange={handleSearchQuestion}
                                            />
                                            <i className="fas fa-search search-icon"></i>
                                        </div>
                                    </div>

                                    {/* Questions List */}
                                    {loading ? (
                                        <div className="empty-state">
                                            <i className="fas fa-spinner fa-spin empty-icon" style={{fontSize: "3rem"}}></i>
                                            <h4 className="mb-3">Loading Questions...</h4>
                                            <p className="mb-0">Please wait while we fetch your Q&A discussions.</p>
                                        </div>
                                    ) : error ? (
                                        <div className="empty-state">
                                            <i className="fas fa-exclamation-triangle empty-icon" style={{fontSize: "3rem", color: "#dc3545"}}></i>
                                            <h4 className="mb-3">Error Loading Questions</h4>
                                            <p className="mb-3">{error}</p>
                                            <button 
                                                className="btn btn-qa"
                                                onClick={fetchQuestions}
                                            >
                                                <i className="fas fa-refresh me-1"></i>
                                                Try Again
                                            </button>
                                        </div>
                                    ) : !Array.isArray(questions) || questions.length === 0 ? (
                                        <div className="empty-state">
                                            <i className="fas fa-question-circle empty-icon"></i>
                                            <h4 className="mb-3">No Questions Yet</h4>
                                            <p className="mb-0">
                                                When students ask questions about your courses, they will appear here for you to answer.
                                            </p>
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
                                                                            : getMediaUrl(q.profile.image)
                                                                        }
                                                                        className="avatar-modern"
                                                                        alt={`${q.profile?.full_name || "User"} avatar`}
                                                                        onError={(e) => {
                                                                            e.target.style.display = "none";
                                                                            e.target.nextSibling.style.display = "flex";
                                                                        }}
                                                                    />
                                                                ) : null}
                                                                <div 
                                                                    className="avatar-placeholder question-profile-placeholder"
                                                                    style={{ display: q.profile?.image ? "none" : "flex" }}
                                                                >
                                                                    <i className="fas fa-user"></i>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="question-content">
                                                                <h5 className="question-title">
                                                                    {q.title || "No Title"}
                                                                </h5>
                                                                
                                                                <div className="question-meta">
                                                                    <div className="question-meta-item">
                                                                        <i className="fas fa-user question-meta-icon"></i>
                                                                        <span>{q.profile?.full_name || "Anonymous User"}</span>
                                                                    </div>
                                                                    <div className="question-meta-item">
                                                                        <i className="fas fa-book question-meta-icon"></i>
                                                                        <span>{q.course?.title || "Course"}</span>
                                                                    </div>
                                                                    <div className="question-meta-item">
                                                                        <i className="fas fa-calendar-alt question-meta-icon"></i>
                                                                        <span>{moment(q.date).format("DD MMM, YYYY")}</span>
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
                                                                        <i className="fas fa-edit me-1"></i>
                                                                        Draft Saved
                                                                    </span>
                                                                )}
                                                            </div>
                                                            
                                                            <button 
                                                                className="join-discussion-primary" 
                                                                onClick={() => handleConversationShow(q)}
                                                            >
                                                                <i className="fas fa-comment-dots"></i>
                                                                View Discussion
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
                                <h4 className="modal-title-modern">{selectedConversation?.title || "Discussion"}</h4>
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
                                <div key={m.id || `message-${index}`} className={`message-item-qa ${isCurrentUser ? "message-item-qa-current-user" : ""}`}>
                                    <div className={`d-flex ${isCurrentUser ? "flex-row-reverse" : ""}`}>
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
                                        <div className={`${isCurrentUser ? "me-3" : "ms-3"} flex-grow-1`}>
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
                            className="qa-send-btn" 
                            type="submit"
                            disabled={messageLoading || !getCurrentMessage().trim()}
                        >
                            {messageLoading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2"></span>
                                    <strong>Sending...</strong>
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-paper-plane"></i>
                                    Send Reply
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