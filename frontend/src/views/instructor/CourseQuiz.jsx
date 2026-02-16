import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Toast, { DeleteConfirmation } from "../plugin/Toast";
import apiInstance from "../../utils/axios";
import "./CourseQuiz.css";

import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import LoadingSpinner from "./Partials/LoadingSpinner";
import MinimalLoader from "./Partials/MinimalLoader";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import WorkflowStepper from "../../components/WorkflowStepper";
import { useInstructorSidebarCollapse } from "./Partials/useInstructorSidebarCollapse";

function CourseQuiz() {
    const { course_id } = useParams();
    const navigate = useNavigate()
    const param = useParams();
    const isCollapsed = useInstructorSidebarCollapse();
    
    // State Management
    const [course, setCourse] = useState(null);
    const [quizzes, setQuizzes] = useState([]);
    const [currentQuiz, setCurrentQuiz] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Form States
    const [quizForm, setQuizForm] = useState({
        title: "",
        description: "",
        is_active: true
    });
    
    const [questionForm, setQuestionForm] = useState({
        question_text: "",
        choices: [
            { choice_text: "", is_correct: false },
            { choice_text: "", is_correct: false },
            { choice_text: "", is_correct: false },
            { choice_text: "", is_correct: false }
        ]
    });
    
    // UI States
    const [showQuizModal, setShowQuizModal] = useState(false);
    const [showQuestionModal, setShowQuestionModal] = useState(false);
    const [editingQuiz, setEditingQuiz] = useState(null);
    const [editingQuestion, setEditingQuestion] = useState(null);
    const [activeTab, setActiveTab] = useState("overview");
    const [questionsAdded, setQuestionsAdded] = useState(0); // Track questions added in current session
    const [isContinuousAdd, setIsContinuousAdd] = useState(false); // Track if user wants to keep adding
    

    // Load Course and Quizzes
    useEffect(() => {
        fetchCourseData();
        fetchQuizzes();
    }, [course_id]);

    const fetchCourseData = async () => {
        try {
            const response = await apiInstance.get(`teacher/course-detail/${course_id}/`);
            setCourse(response.data);
        } catch (error) {
            Toast().fire({
                icon: "error",
                title: "Gagal memuat data kursus"
            });
            console.error(error);
        }
    };

    const fetchQuizzes = async () => {
        try {
            setLoading(true);
            const response = await apiInstance.get(`quiz/list-create/?course_id=${course_id}`);
            // Handle both array and paginated responses
            const data = Array.isArray(response.data) 
                ? response.data 
                : (response.data?.results || []);
            setQuizzes(Array.isArray(data) ? data : []);
        } catch (error) {
            Toast().fire({
                icon: "error",
                title: "Gagal memuat kuis"
            });
            console.error(error);
            setQuizzes([]); // Set empty array on error
        } finally {
            setLoading(false);
        }
    };

    const fetchQuestions = async (quizId) => {
        try {
            const response = await apiInstance.get(`quiz/question/list-create/?quiz_id=${quizId}`);
            // Handle both array and paginated responses
            const data = Array.isArray(response.data) 
                ? response.data 
                : (response.data?.results || []);
            setQuestions(Array.isArray(data) ? data : []);
        } catch (error) {
            Toast().fire({
                icon: "error",
                title: "Failed to load questions"
            });
            console.error(error);
            setQuestions([]); // Set empty array on error
        }
    };

    // Quiz Management
    const handleCreateQuiz = async (e) => {
        e.preventDefault();
        if (!quizForm.title.trim()) {
            Toast().fire({
                icon: "error",
                title: "Quiz title is required"
            });
            return;
        }

        try {
            setIsSubmitting(true);
            const quizData = {
                ...quizForm,
                course_id: course_id
            };

            if (editingQuiz) {
                await apiInstance.put(`quiz/detail/${editingQuiz.quiz_id}/`, quizData);
                Toast().fire({
                    icon: "success",
                    title: "Kuis berhasil diperbarui"
                });
            } else {
                await apiInstance.post("quiz/list-create/", quizData);
                Toast().fire({
                    icon: "success",
                    title: "Kuis berhasil dibuat"
                });
            }

            resetQuizForm();
            setShowQuizModal(false);
            await fetchQuizzes();
            await fetchCourseData(); // Refresh course data for workflow stepper
        } catch (error) {
            Toast().fire({
                icon: "error",
                title: "Gagal menyimpan kuis"
            });
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteQuiz = async (quizId) => {
        const confirm = await DeleteConfirmation({
            title: "Hapus Kuis",
            text: "Apakah Anda yakin ingin menghapus kuis ini? Tindakan ini tidak dapat dibatalkan."
        });
        if (!confirm.isConfirmed) return;

        try {
            await apiInstance.delete(`quiz/detail/${quizId}/`);
            Toast().fire({
                icon: "success",
                title: "Kuis berhasil dihapus"
            });
            await fetchQuizzes();
            await fetchCourseData(); // Refresh course data for workflow stepper
            if (currentQuiz?.quiz_id === quizId) {
                setCurrentQuiz(null);
                setQuestions([]);
            }
        } catch (error) {
            Toast().fire({
                icon: "error",
                title: "Gagal menghapus kuis"
            });
            console.error(error);
        }
    };

    // Question Management
    const handleCreateQuestion = async (e) => {
        e.preventDefault();
        if (!questionForm.question_text.trim()) {
            Toast().fire({
                icon: "error",
                title: "Teks pertanyaan wajib diisi"
            });
            return;
        }

        // Validate that at least one choice is marked as correct
        const hasCorrectAnswer = questionForm.choices.some(choice => choice.is_correct && choice.choice_text.trim());
        if (!hasCorrectAnswer) {
            Toast().fire({
                icon: "error",
                title: "Tandai setidaknya satu pilihan sebagai jawaban benar"
            });
            return;
        }

        // Validate that all choices have text
        const validChoices = questionForm.choices.filter(choice => choice.choice_text.trim());
        if (validChoices.length < 2) {
            Toast().fire({
                icon: "error",
                title: "Berikan setidaknya 2 pilihan jawaban"
            });
            return;
        }

        try {
            setIsSubmitting(true);
            const questionData = {
                question_text: questionForm.question_text,
                quiz_id: currentQuiz.quiz_id
            };

            let savedQuestion;
            if (editingQuestion) {
                const response = await apiInstance.put(`quiz/question/detail/${editingQuestion.question_id}/`, questionData);
                savedQuestion = response.data;
            } else {
                const response = await apiInstance.post("quiz/question/list-create/", questionData);
                savedQuestion = response.data;
            }

            // Save choices
            await saveQuestionChoices(savedQuestion.question_id, validChoices);

            // Increment counter for continuous add
            if (!editingQuestion && isContinuousAdd) {
                setQuestionsAdded(prev => prev + 1);
            }

            // Refresh questions list
            await fetchQuestions(currentQuiz.quiz_id);
            await fetchQuizzes();

            Toast().fire({
                icon: "success", 
                title: editingQuestion ? "Pertanyaan diperbarui dengan sukses" : "Pertanyaan ditambahkan dengan sukses"
            });

            // If editing, close modal. If adding and continuous mode, reset form but keep modal open
            if (editingQuestion) {
                setShowQuestionModal(false);
                resetQuestionForm();
                setQuestionsAdded(0);
            } else if (isContinuousAdd) {
                // Reset form for next question but keep modal open
                resetQuestionForm();
                // Focus on question text area for convenience
                setTimeout(() => {
                    const textarea = document.querySelector(".modal-body textarea");
                    if (textarea) textarea.focus();
                }, 100);
            } else {
                // Close modal if not in continuous mode
                setShowQuestionModal(false);
                resetQuestionForm();
                setQuestionsAdded(0);
            }
        } catch (error) {
            Toast().fire({
                icon: "error",
                title: "Gagal menyimpan pertanyaan"
            });
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const saveQuestionChoices = async (questionId, choices) => {
        try {
            // If editing, delete existing choices first
            if (editingQuestion) {
                // This would require additional API endpoint to delete all choices for a question
                // For now, we'll create new ones (you may want to implement choice updating)
            }

            // Create new choices
            for (const [index, choice] of choices.entries()) {
                await apiInstance.post("quiz/choice/list-create/", {
                    question_id: questionId,
                    choice_text: choice.choice_text,
                    is_correct: choice.is_correct,
                    order: index + 1
                });
            }
        } catch (error) {
            throw error;
        }
    };

    const handleDeleteQuestion = async (questionId) => {
        const confirm = await DeleteConfirmation({
            title: "Hapus Pertanyaan",
            text: "Apakah Anda yakin ingin menghapus pertanyaan ini? Tindakan ini tidak dapat dibatalkan."
        });
        if (!confirm.isConfirmed) return;

        try {
            await apiInstance.delete(`quiz/question/detail/${questionId}/`);
            Toast().fire({
                icon: "success",
                title: "Pertanyaan berhasil dihapus"
            });
            fetchQuestions(currentQuiz.quiz_id);
            fetchQuizzes();
        } catch (error) {
            Toast().fire({
                icon: "error",
                title: "Gagal menghapus pertanyaan"
            });
            console.error(error);
        }
    };

    // Form Helpers
    const resetQuizForm = () => {
        setQuizForm({ title: "", description: "", is_active: true });
        setEditingQuiz(null);
    };

    const resetQuestionForm = () => {
        setQuestionForm({
            question_text: "",
            choices: [
                { choice_text: "", is_correct: false },
                { choice_text: "", is_correct: false },
                { choice_text: "", is_correct: false },
                { choice_text: "", is_correct: false }
            ]
        });
        setEditingQuestion(null);
        // Don't reset questionsAdded and isContinuousAdd here - handle in close modal
    };

    const handleEditQuiz = (quiz) => {
        setQuizForm({
            title: quiz.title,
            description: quiz.description || "",
            is_active: quiz.is_active
        });
        setEditingQuiz(quiz);
        setShowQuizModal(true);
    };

    const handleEditQuestion = (question) => {
        setQuestionForm({
            question_text: question.question_text,
            choices: question.choices.length >= 4 
                ? question.choices.slice(0, 4)
                : [
                    ...question.choices,
                    ...Array(4 - question.choices.length).fill({ choice_text: "", is_correct: false })
                ]
        });
        setEditingQuestion(question);
        setIsContinuousAdd(false); // Disable continuous mode when editing
        setShowQuestionModal(true);
    };

    const handleChoiceChange = (index, field, value) => {
        const newChoices = [...questionForm.choices];
        if (field === "is_correct" && value) {
            // Only one correct answer allowed
            newChoices.forEach((choice, i) => {
                choice.is_correct = i === index;
            });
        } else {
            newChoices[index] = { ...newChoices[index], [field]: value };
        }
        setQuestionForm({ ...questionForm, choices: newChoices });
    };

    const selectQuiz = (quiz) => {
        setCurrentQuiz(quiz);
        setActiveTab("questions");
        fetchQuestions(quiz.quiz_id);
    };

    const handleOpenQuestionModal = () => {
        setShowQuestionModal(true);
        setIsContinuousAdd(true);
        setQuestionsAdded(0);
    };

    const handleCloseQuestionModal = () => {
        setShowQuestionModal(false);
        resetQuestionForm();
        setIsContinuousAdd(false);
        setQuestionsAdded(0);
    };

    // Show full-page loading spinner on initial load
    if (loading && !course) {
        return (
            <>
                <BaseHeader />
                <section className="pt-5 pb-5 course-quiz-container course-quiz-loading-section">
                    <div className="container course-quiz-loading-container">
                        <Header />
                        <div className="row">
                            <Sidebar />
                            <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""} course-quiz-content-column`}>
                                <div className="text-center">
                                    <div className="spinner-border text-primary" role="status" style={{ width: "3rem", height: "3rem" }}>
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                    <p className="mt-3 text-muted course-quiz-loading-text">Loading Quiz...</p>
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

            <section className="pt-5 pb-5 course-quiz-container">
                <div className="container">
                    <Header />
                    <div className="row">
                        <Sidebar />
                        <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>
                            {/* Workflow Stepper */}
                            <WorkflowStepper 
                                currentStep={3} 
                                courseId={param?.course_id}
                                courseData={course}
                            />
                            
                            {/* Header Section */}
                            <div className="quiz-header-modern">
                                <div className="d-lg-flex align-items-center justify-content-between">
                                    <div className="mb-4 mb-lg-0">
                                        <h3 className="text-white mb-2">
                                            <i className="fas fa-question-circle me-3"></i>
                                            Manajemen Kuis
                                        </h3>
                                        
                                        <h3 className="text-white mb-2 fw-bold">
                                            {course?.title || "Course Quiz Management"}
                                        </h3>

                                        <p className="mb-0 text-white opacity-90">
                                            Buat dan kelola kuis untuk kursus Anda
                                        </p>
                                    </div>
                                    <div className="d-flex flex-column gap-3">
                                        <Link 
                                            to={`/instructor/edit-course/${param?.course_id}/`} 
                                            className="btn btn-outline-light border border-2 border-light"
                                        >
                                            <i className="fas fa-arrow-left me-2"></i>
                                            Perbarui Kursus
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* Stats Overview */}
                            <div className="quiz-stats-overview row g-3 mb-4">
                                <div className="col-md-3">
                                    <div className="quiz-stat-card">
                                        <div className="stat-icon">
                                            <i className="fas fa-list-alt"></i>
                                        </div>
                                        <div className="stat-content">
                                            <div className="stat-number">{quizzes.length}</div>
                                            <div className="stat-label">Total Kuis</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-3">
                                    <div className="quiz-stat-card">
                                        <div className="stat-icon">
                                            <i className="fas fa-question"></i>
                                        </div>
                                        <div className="stat-content">
                                            <div className="stat-number">
                                                {quizzes.reduce((total, quiz) => total + (quiz.total_questions || 0), 0)}
                                            </div>
                                            <div className="stat-label">Total Pertanyaan</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-3">
                                    <div className="quiz-stat-card">
                                        <div className="stat-icon">
                                            <i className="fas fa-check-circle"></i>
                                        </div>
                                        <div className="stat-content">
                                            <div className="stat-number">
                                                {quizzes.filter(quiz => quiz.is_active).length}
                                            </div>
                                            <div className="stat-label">Kuis Aktif</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-3">
                                    <div className="quiz-stat-card">
                                        <div className="stat-icon">
                                            <i className="fas fa-pause-circle"></i>
                                        </div>
                                        <div className="stat-content">
                                            <div className="stat-number">
                                                {quizzes.filter(quiz => !quiz.is_active).length}
                                            </div>
                                            <div className="stat-label">Kuis Tidak Aktif</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Navigation Tabs */}
                            <div className="quiz-nav-card mb-4">
                                <div className="quiz-nav-tabs">
                                    <button 
                                        className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
                                        onClick={() => setActiveTab("overview")}
                                    >
                                        <i className="fas fa-chart-pie me-2"></i>
                                        Ringkasan Kuis
                                    </button>
                                    <button 
                                        className={`tab-btn ${activeTab === "questions" ? "active" : ""}`}
                                        onClick={() => setActiveTab("questions")}
                                        disabled={!currentQuiz}
                                    >
                                        <i className="fas fa-question me-2"></i>
                                        Pertanyaan {currentQuiz && `(${currentQuiz.title})`}
                                    </button>
                                </div>
                            </div>

                            {/* Content Based on Active Tab */}
                            {activeTab === "overview" && (
                                <div className="quiz-overview-wrapper">
                                    {/* Action Bar */}
                                    <div className="mb-4">
                                        <div className="d-flex justify-content-between align-items-center">
                                            <h3 className="quiz-section-title">
                                                <i className="fas fa-list me-2"></i>
                                                All Quizzes
                                            </h3>
                                            <button 
                                                className="btn btn-update-course"
                                                onClick={() => setShowQuizModal(true)}
                                            >
                                                <i className="fas fa-plus me-2"></i>
                                                Create New Quiz
                                            </button>
                                        </div>
                                    </div>

                                    {/* Quizzes List */}
                                    <div className="quizzes-grid">
                                        {quizzes.length === 0 ? (
                                            <div className="quiz-empty-card text-center py-5">
                                                <div className="empty-state">
                                                    <i className="fas fa-question-circle empty-icon"></i>
                                                    <h4>No Quizzes Yet</h4>
                                                    <p className="text-muted">Create your first quiz to get started</p>
                                                    <button 
                                                        className="btn btn-update-course"
                                                        onClick={() => setShowQuizModal(true)}
                                                    >
                                                        <i className="fas fa-plus me-2"></i>
                                                        Create Your First Quiz
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            quizzes.map((quiz) => (
                                                <div key={quiz.quiz_id} className="quiz-card">
                                                    <div className="quiz-card-header">
                                                        <div className="quiz-actions mb-0 pb-0">
                                                            <button 
                                                                className="btn-icon"
                                                                onClick={() => handleEditQuiz(quiz)}
                                                                title="Edit Quiz"
                                                            >
                                                                <i className="fas fa-edit"></i>
                                                            </button>
                                                            <button 
                                                                className="btn-icon btn-danger"
                                                                onClick={() => handleDeleteQuiz(quiz.quiz_id)}
                                                                title="Hapus Kuis"
                                                            >
                                                                <i className="fas fa-trash"></i>
                                                            </button>
                                                        </div>
                                                        <div className="quiz-status">
                                                            <span className={`status-badge ${quiz.is_active ? "active" : "inactive"}`}>
                                                                <i className={`fas ${quiz.is_active ? "fa-check-circle" : "fa-pause-circle"}`}></i>
                                                                {quiz.is_active ? "Aktif" : "Tidak Aktif"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="quiz-card-body mb-0">
                                                        <h4 className="quiz-title text-primary">{quiz.title}</h4>
                                                        {quiz.description && (
                                                            <p className="quiz-description text-secondary">{quiz.description}</p>
                                                        )}
                                                        <div className="quiz-stats">
                                                            <div className="stat-item">
                                                                <i className="fas fa-question text-primary"></i>
                                                                <span>{quiz.total_questions || 0} Pertanyaan</span>
                                                            </div>
                                                            <div className="stat-item">
                                                                <i className="fas fa-calendar text-success"></i>
                                                                <span>{new Date(quiz.date).toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="quiz-card-footer">
                                                        <button 
                                                            className="btn btn-outline-primary btn-sm"
                                                            onClick={() => selectQuiz(quiz)}
                                                        >
                                                            <i className="fas fa-cog me-2"></i>
                                                            Kelola Pertanyaan
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === "questions" && currentQuiz && (
                                <div className="quiz-questions-section">
                                    {/* Questions Header */}
                                    <div className="quiz-questions-header mb-4">
                                        <div className="quiz-header">
                                            <div className="quiz-info">
                                                <h3 className="quiz-title">{currentQuiz.title}</h3>
                                                <p className="quiz-description">{currentQuiz.description}</p>
                                            </div>

                                        </div>
                                    </div>

                                    {/* Questions List */}
                                    <div className="questions-list">
                                        {questions.length === 0 ? (
                                            <div className="quiz-empty-card text-center py-5">
                                                <div className="empty-state">
                                                    <i className="fas fa-question empty-icon"></i>
                                                    <h4>Belum Ada Pertanyaan</h4>
                                                    <p className="text-muted">Tambahkan pertanyaan pertama Anda ke kuis ini</p>
                                                    <button 
                                                        className="btn btn-update-course"
                                                        onClick={handleOpenQuestionModal}
                                                    >
                                                        <i className="fas fa-plus me-2"></i>
                                                        Tambah Pertanyaan
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            questions.map((question, index) => (
                                                <div key={question.question_id} className="question-card mb-0">
                                                    <div className="question-header">
                                                        <div className="question-number">
                                                            <span>Q{index + 1}</span>
                                                        </div>
                                                        <div className="question-text">
                                                            <h5>{question.question_text}</h5>
                                                        </div>
                                                        <div className="question-actions">
                                                            <button 
                                                                className="btn-icon"
                                                                onClick={() => handleEditQuestion(question)}
                                                                title="Edit Pertanyaan"
                                                            >
                                                                <i className="fas fa-edit"></i>
                                                            </button>
                                                            <button 
                                                                className="btn-icon btn-danger"
                                                                onClick={() => handleDeleteQuestion(question.question_id)}
                                                                title="Hapus Pertanyaan"
                                                            >
                                                                <i className="fas fa-trash"></i>
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="question-choices">
                                                        {question.choices?.map((choice, choiceIndex) => (
                                                            <div 
                                                                key={choice.choice_id} 
                                                                className={`choice-item ${choice.is_correct ? "correct" : ""}`}
                                                            >
                                                                <div className="choice-indicator">
                                                                    {choice.is_correct ? (
                                                                        <i className="fas fa-check-circle text-success"></i>
                                                                    ) : (
                                                                        <i className="fas fa-circle text-muted"></i>
                                                                    )}
                                                                </div>
                                                                <div className="choice-text">
                                                                    <span className="choice-label">
                                                                        {String.fromCharCode(65 + choiceIndex)}.
                                                                    </span>
                                                                    {choice.choice_text}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    <div className="d-flex justify-content-end mt-4">
                                        <button 
                                            className="btn btn-update-course"
                                            onClick={handleOpenQuestionModal}
                                        >
                                            <i className="fas fa-plus me-2"></i>
                                            Add Question
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Quiz Modal */}
                            {showQuizModal && (
                                <div className="quiz-modal-overlay">
                                    <div className="quiz-modal">
                                        <div className="modal-header">
                                            <h4>{editingQuiz ? "Edit Kuis" : "Buat Kuis Baru"}</h4>
                                            <button 
                                                className="btn-close"
                                                onClick={() => {
                                                    setShowQuizModal(false);
                                                    resetQuizForm();
                                                }}
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        </div>
                                        <form onSubmit={handleCreateQuiz}>
                                            <div className="modal-body">
                                                <div className="form-group">
                                                    <label className="form-label">Judul Kuis *</label>
                                                    <input
                                                        type="text"
                                                        className="form-control"
                                                        value={quizForm.title}
                                                        onChange={(e) => setQuizForm({...quizForm, title: e.target.value})}
                                                        placeholder="Masukkan judul kuis"
                                                        required
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">Deskripsi</label>
                                                    <textarea
                                                        className="form-control"
                                                        rows="3"
                                                        value={quizForm.description}
                                                        onChange={(e) => setQuizForm({...quizForm, description: e.target.value})}
                                                        placeholder="Masukkan deskripsi kuis (opsional)"
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <div className="form-check">
                                                        <input
                                                            type="checkbox"
                                                            className="form-check-input"
                                                            id="isActive"
                                                            checked={quizForm.is_active}
                                                            onChange={(e) => setQuizForm({...quizForm, is_active: e.target.checked})}
                                                        />
                                                        <label className="form-check-label" htmlFor="isActive">
                                                            Kuis Aktif (terlihat oleh siswa)
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="modal-footer">
                                                <button 
                                                    type="button" 
                                                    className="btn btn-secondary"
                                                    onClick={() => {
                                                        setShowQuizModal(false);
                                                        resetQuizForm();
                                                    }}
                                                >
                                                    Batalkan
                                                </button>
                                                <button 
                                                    type="submit" 
                                                    className="btn btn-update-course"
                                                    disabled={isSubmitting}
                                                >
                                                    {isSubmitting && <span className="spinner-border spinner-border-sm me-2"></span>}
                                                    {editingQuiz ? "Perbarui Kuis" : "Buat Kuis"}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            )}

                            {/* Question Modal */}
                            {showQuestionModal && (
                                <div className="quiz-modal-overlay">
                                    <div className="quiz-modal quiz-modal-large">
                                        <div className="modal-header">
                                            <div>
                                                <h4>
                                                    {editingQuestion ? "Edit Pertanyaan" : `Tambah Pertanyaan #${questions.length + 1}`}
                                                </h4>
                                                {!editingQuestion && isContinuousAdd && questionsAdded > 0 && (
                                                    <p className="text-muted mb-0 mt-1" style={{ fontSize: "0.9rem" }}>
                                                        <i className="fas fa-check-circle text-success me-2"></i>
                                                        {questionsAdded} pertanyaan{questionsAdded > 1 ? "" : ""} berhasil ditambahkan dalam sesi ini
                                                    </p>
                                                )}
                                            </div>
                                            <button 
                                                className="btn-close"
                                                onClick={handleCloseQuestionModal}
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        </div>
                                        <form onSubmit={handleCreateQuestion}>
                                            <div className="modal-body">
                                                <div className="form-group">
                                                    <label className="form-label">Teks Pertanyaan *</label>
                                                    <textarea
                                                        className="form-control"
                                                        rows="3"
                                                        value={questionForm.question_text}
                                                        onChange={(e) => setQuestionForm({...questionForm, question_text: e.target.value})}
                                                        placeholder="Masukkan pertanyaan Anda"
                                                        required
                                                    />
                                                </div>
                                                
                                                <div className="form-group">
                                                    <label className="form-label">Pilihan Jawaban *</label>
                                                    <p className="form-help">Tandai jawaban yang benar dengan mengklik tombol radio</p>
                                                    
                                                    {questionForm.choices.map((choice, index) => (
                                                        <div key={index} className="choice-input-group">
                                                            <div className="choice-selector">
                                                                <input
                                                                    type="radio"
                                                                    name="correct_answer"
                                                                    checked={choice.is_correct}
                                                                    onChange={(e) => handleChoiceChange(index, "is_correct", e.target.checked)}
                                                                />
                                                                <label className="choice-letter">
                                                                    {String.fromCharCode(65 + index)}.
                                                                </label>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                className="form-control choice-input"
                                                                value={choice.choice_text}
                                                                onChange={(e) => handleChoiceChange(index, "choice_text", e.target.value)}
                                                                placeholder={`Pilihan ${String.fromCharCode(65 + index)}`}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="modal-footer">
                                                <button 
                                                    type="button" 
                                                    className="btn btn-secondary"
                                                    onClick={handleCloseQuestionModal}
                                                    disabled={isSubmitting}
                                                >
                                                    {editingQuestion ? "Batalkan" : "Tutup & Selesai"}
                                                </button>
                                                
                                                {!editingQuestion && (
                                                    <div className="d-flex gap-2">
                                                        <button 
                                                            type="submit" 
                                                            className="btn btn-success"
                                                            disabled={isSubmitting}
                                                            onClick={() => setIsContinuousAdd(true)}
                                                        >
                                                            {isSubmitting && <span className="spinner-border spinner-border-sm me-2"></span>}
                                                            <i className="fas fa-plus me-2"></i>
                                                            Tambah & Lanjutkan
                                                        </button>
                                                        <button 
                                                            type="submit" 
                                                            className="btn btn-update-course"
                                                            disabled={isSubmitting}
                                                            onClick={() => setIsContinuousAdd(false)}
                                                        >
                                                            {isSubmitting && <span className="spinner-border spinner-border-sm me-2"></span>}
                                                            <i className="fas fa-check me-2"></i>
                                                            Tambah & Tutup
                                                        </button>
                                                    </div>
                                                )}
                                                
                                                {editingQuestion && (
                                                    <button 
                                                        type="submit" 
                                                        className="btn btn-update-course"
                                                        disabled={isSubmitting}
                                                    >
                                                        {isSubmitting && <span className="spinner-border spinner-border-sm me-2"></span>}
                                                        <i className="fas fa-save me-2"></i>
                                                        Perbarui Pertanyaan
                                                    </button>
                                                )}
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>  

            <Footer />   
        </>

    );
}

export default React.memo(CourseQuiz);
