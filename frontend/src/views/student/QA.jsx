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
import { getImageUrl } from "../../utils/courseUtils";
import { useSidebarCollapse } from "./Partials/useSidebarCollapse";
import "./QA.css";

function QA() {
    // ============================
    // STATE MANAGEMENT
    // ============================
    const isCollapsed = useSidebarCollapse();
    
    // Course-related states
    const [enrolledCourses, setEnrolledCourses] = useState([]);
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
    const [messageLoading, setMessageLoading] = useState(false);
    
    // Modal states
    const [conversationShow, setConversationShow] = useState(false);
    const [createQuestionShow, setCreateQuestionShow] = useState(false);
    const [newQuestion, setNewQuestion] = useState({ title: "", message: "" });
    const [createQuestionDraft, setCreateQuestionDraft] = useState("");
    
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
            
            // Handle both array and paginated response formats
            const courseData = Array.isArray(response.data) ? response.data : (response.data?.results || []);
            
            // qa_count is now provided by the backend, no need for extra API calls
            setEnrolledCourses(courseData);
            setFilteredCourses(courseData);
        } catch (error) {
            console.error("Error fetching enrolled courses:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat kursus terdaftar"
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
            // Ensure we always set an array
            const data = response.data;
            const questionsArray = Array.isArray(data) ? data : (data?.results ? data.results : []);
            setQuestions(questionsArray);
            setQuestionSearchQuery(""); // Reset search when fetching new questions
        } catch (error) {
            console.error("Error fetching course questions:", error);
            if (error.response?.status === 404) {
                setQuestions([]);
            } else {
                Toast().fire({
                    icon: "error",
                    title: "Gagal memuat diskusi kursus"
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
                title: "Silakan masukkan pesan"
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

            const response = await useAxios.post("student/question-answer-message-create/", formdata);
            
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
                title: "Gagal mengirim pesan"
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
                title: "Silakan isi semua bidang"
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
            setNewQuestion({ title: "", message: "" }); // Clear form immediately
            setCreateQuestionDraft(""); // Clear draft after successful creation
            setCreateQuestionShow(false); // Close modal
            
            Toast().fire({
                icon: "success",
                title: "Pertanyaan berhasil dibuat!"
            });
        } catch (error) {
            console.error("Error creating question:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal membuat pertanyaan"
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
                const categoryText = typeof enrollment.course?.category === "object" 
                    ? enrollment.course.category?.title || enrollment.course.category?.name || ""
                    : enrollment.course?.category || "";
                
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
        setQuestionSearchQuery(event.target.value); // Update controlled input state
        if (!selectedCourse) return;
        
        if (query === "") {
            fetchCourseQuestions(selectedCourse.course.id);
        } else {
            const questionsArray = Array.isArray(questions) ? questions : [];
            const filtered = questionsArray.filter((question) => {
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
        // Save draft to state when closing (don't clear it)
        setCreateQuestionDraft(JSON.stringify(newQuestion));
        setCreateQuestionShow(false);
    };

    const handleCreateQuestionShow = () => {
        if (!selectedCourse) {
            Toast().fire({
                icon: "warning",
                title: "Silakan pilih kursus terlebih dahulu"
            });
            return;
        }
        
        // Restore draft if it exists
        if (createQuestionDraft) {
            try {
                const savedDraft = JSON.parse(createQuestionDraft);
                setNewQuestion(savedDraft);
            } catch (error) {
                console.error("Error restoring draft:", error);
                setNewQuestion({ title: "", message: "" });
            }
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

    // Check if create question form has draft content
    const hasCreateQuestionDraft = () => {
        return newQuestion.title.trim() !== "" || newQuestion.message.trim() !== "";
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
            className={`avatar-placeholder ${size === "40px" ? "avatar-sm" : size === "60px" ? "avatar-md" : "avatar-lg"}`}
            style={{ width: size, height: size }}
        >
            <i className="fas fa-user avatar-icon"></i>
        </div>
    );

    if (loading && enrolledCourses.length === 0) {
        return (
            <>
                <BaseHeader />
                <section className="pt-5 pb-5 modern-qa-page" style={{ minHeight: "calc(100vh - 120px)" }}>
                    <div className="container" style={{ flex: 1 }}>
                        <Header />
                        <div className="row mt-0 md-4">
                            <Sidebar />
                            <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
                                <div className="text-center">
                                    <div className="spinner-border text-primary" role="status" style={{ width: "3rem", height: "3rem" }}>
                                        <span className="visually-hidden">Memuat...</span>
                                    </div>
                                    <p className="mt-3 text-muted">Memuat Forum Q&A...</p>
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

            <section className="pt-5 pb-5 modern-qa-page">
                <div className="container">
                    <Header />
                    <div className="row mt-0 md-4">
                        <Sidebar />
                        <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>
                            {/* Q&A Header */}
                            <div className="qa-header-card">
                                <div className="qa-header-content">
                                    <div className="row align-items-center">
                                        <div className="col-lg-8">
                                            <h1 className="mb-3 fw-bold d-flex align-items-center">
                                                <i className="fas fa-comments me-3 qa-page-icon"></i>
                                                Tanya & Jawab
                                            </h1>
                                            <p className="mb-0 opacity-90 lead">
                                                Ajukan pertanyaan, dapatkan jawaban, dan ikuti diskusi kursus dengan instruktur dan sesama siswa.
                                            </p>
                                        </div>
                                        <div className="col-lg-4">
                                            <div className="stats-grid mt-0">
                                                <div className="qa-stat-card">
                                                    <div className="qa-stat-number justify-content-end">
                                                        {enrolledCourses.length}
                                                    </div>
                                                    <div className="stat-label">Kursus Aktif</div>
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
                                        <h3 className="mb-2 fw-bold text-dark">Pilih Kursus</h3>
                                        <p className="mb-0 text-muted">Pilih kursus untuk melihat diskusi dan mengajukan pertanyaan</p>
                                    </div>
                                    
                                    <div className="p-4">
                                        {/* Search Bar */}
                                        <div className="search-card">
                                            <div className="position-relative">
                                                <input 
                                                    className="form-control form-control-modern" 
                                                    type="search" 
                                                    placeholder="Cari kursus berdasarkan judul, instruktur, atau kategori..." 
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
                                                        Bersihkan
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
                                                        ? `Tidak ada kursus yang cocok dengan "${courseSearchQuery}"`
                                                        : "Anda belum mendaftar di kursus apapun"
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
                                                {filteredCourses.map((enrollment, index) => (
                                                    <div key={enrollment.course?.id || `course-${index}`} className="col-lg-6 col-12">
                                                        <div 
                                                            className="student-qa-course-card"
                                                            onClick={() => handleCourseSelect(enrollment)}
                                                        >
                                                            {/* Course Image Header */}
                                                            <div className="course-image-container">
                                                                {enrollment.course?.image ? (
                                                                    <img 
                                                                        src={getImageUrl(enrollment.course.image)}
                                                                        alt={enrollment.course?.title || "Course"}
                                                                        className="course-image"
                                                                        onError={(e) => {
                                                                            e.target.style.display = "none";
                                                                            e.target.nextSibling.style.display = "flex";
                                                                        }}
                                                                    />
                                                                ) : null}
                                                                <div 
                                                                    className="course-placeholder course-image-placeholder"
                                                                    style={{ display: enrollment.course?.image ? "none" : "flex" }}
                                                                >
                                                                    <i className="fas fa-graduation-cap"></i>
                                                                </div>
                                                            </div>

                                                            {/* Course Info */}
                                                            <div className="course-info">
                                                                <h5 className="student-qa-course-title">
                                                                    {enrollment.course?.title || "Kursus Tanpa Judul"}
                                                                </h5>
                                                                <p className="course-instructor">
                                                                    <i className="fas fa-chalkboard-teacher me-2"></i>
                                                                    {enrollment.course?.teacher?.full_name || "Instruktur Tidak Diketahui"}
                                                                </p>
                                                                
                                                                {/* Course Meta Information */}
                                                                <div className="student-qa-course-meta">
                                                                    <span className="qa-stats-badge">
                                                                        <i className="fas fa-comments"></i>
                                                                        {enrollment.qa_count || 0} Pertanyaan
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
                                                                    Ikuti Diskusi
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
                                                    {selectedCourse.course?.title} Diskusi
                                                </h3>
                                                <p className="mb-0 text-muted">Ajukan pertanyaan dan ikuti diskusi kursus</p>
                                            </div>
                                            <div className="d-flex gap-2">
                                                <button 
                                                    className="btn btn-outline-secondary"
                                                    onClick={() => setSelectedCourse(null)}
                                                >
                                                    <i className="fas fa-arrow-left me-1"></i>
                                                    Kembali
                                                </button>
                                                <button 
                                                    className="btn btn-qa"
                                                    onClick={handleCreateQuestionShow}
                                                    disabled={loading}
                                                >
                                                    <i className="fas fa-plus me-1"></i>
                                                    Ajukan Pertanyaan
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
                                                    placeholder="Cari pertanyaan dan diskusi..." 
                                                    value={questionSearchQuery}
                                                    onChange={handleSearchQuestion}
                                                />
                                                <i className="fas fa-search search-icon"></i>
                                            </div>
                                        </div>

                                        {/* Questions List */}
                                        {!Array.isArray(questions) || questions.length === 0 ? (
                                            <div className="empty-state">
                                                <i className="fas fa-question-circle empty-icon"></i>
                                                <h4 className="mb-3">Belum Ada Pertanyaan</h4>
                                                <p className="mb-3">Jadilah yang pertama mengajukan pertanyaan tentang kursus ini!</p>
                                                <button 
                                                    className="btn btn-qa"
                                                    onClick={handleCreateQuestionShow}
                                                >
                                                    <i className="fas fa-plus me-1"></i>
                                                    Ajukan Pertanyaan Pertama
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
                                                                                : "getMediaUrl(q.profile.image)"
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
                                                                        {q.title || "Tidak Ada Judul"}
                                                                    </h5>
                                                                    
                                                                    <div className="question-meta">
                                                                        <div className="question-meta-item">
                                                                            <i className="fas fa-user question-meta-icon"></i>
                                                                            <span>{q.profile?.full_name || "Pengguna Anonim"}</span>
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
                                                                    Ikuti Percakapan
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
                                <h4 className="modal-title-modern">{selectedConversation?.title || "Diskusi"}</h4>
                                <div className="d-flex align-items-center gap-2">
                                    <p className="modal-subtitle">Ikuti percakapan dan bagikan pemikiran Anda</p>
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
                                    <div className={`d-flex ${isCurrentUser ? "flex-row-reverse" : ""}`}>
                                        <div className="flex-shrink-0">
                                            {m.profile?.image ? (
                                                <img
                                                    className="message-avatar-qa"
                                                    src={m.profile.image.startsWith("http") 
                                                        ? m.profile.image 
                                                        : "getMediaUrl(m.profile.image)"
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
                                                    <span>{m.profile?.full_name || "Pengguna Anonim"}</span>
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
                            className="message-send-btn-qa" 
                            type="submit"
                            disabled={messageLoading || !getCurrentMessage().trim()}
                        >
                            {messageLoading ? (
                                <span className="spinner-border spinner-border-sm"></span>
                            ) : (
                                <>
                                    <i className="fas fa-paper-plane"></i>
                                    Kirim
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
                                <div className="d-flex align-items-center gap-2">
                                    <h4 className="modal-title-modern">Ask a Question</h4>
                                    {/* Show draft indicator next to title */}
                                    {hasCreateQuestionDraft() && (
                                        <span className="badge-draft-qa">
                                            <i className="fas fa-edit me-1"></i>
                                            Draft
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <p className="modal-subtitle">Share your question with the course community and get expert answers</p>
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
                                    Judul Pertanyaan
                                    <span className="required-indicator">*</span>
                                </label>
                                <div className="input-wrapper-modern">
                                    <input
                                        type="text"
                                        className="form-input-modern"
                                        placeholder="Tulis judul yang jelas dan deskriptif untuk pertanyaan Anda..."
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
                                    Detail Pertanyaan
                                    <span className="required-indicator">*</span>
                                </label>
                                <div className="textarea-wrapper-modern">
                                    <textarea
                                        className="form-textarea-modern"
                                        rows="4"
                                        placeholder="Berikan informasi detail tentang pertanyaan Anda. Semakin banyak konteks yang Anda berikan, semakin baik jawaban yang Anda dapatkan..."
                                        value={newQuestion.message}
                                        onChange={(e) => setNewQuestion(prev => ({ ...prev, message: e.target.value }))}
                                        required
                                    />
                                    <div className="character-counter">
                                        {newQuestion.message?.length || 0}/2000 karakter
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
                                    <li><i className="fas fa-check"></i>Gunakan pemformatan yang tepat untuk potongan kode</li>
                                    <li><i className="fas fa-check"></i>Cari pertanyaan yang sudah ada sebelum memposting</li>
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
                                <span>Batal</span>
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
                                        Membuat...
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-paper-plane"></i>
                                        Ajukan Pertanyaan
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
