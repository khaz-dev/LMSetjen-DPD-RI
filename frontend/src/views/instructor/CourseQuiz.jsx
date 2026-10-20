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

// Modern drag-and-drop library (@dnd-kit)
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/**
 * Sortable Question Card Component for @dnd-kit
 * Allows drag-and-drop reordering as well as direct Up/Down step navigation
 */
function SortableQuestionCard({
    question,
    index,
    totalQuestions,
    isThisEditing,
    isReordering,
    moveQuestionUp,
    moveQuestionDown,
    handleEditQuestion,
    handleDeleteQuestion,
    handleCancelQuestionForm,
    handleCreateQuestion,
    questionForm,
    setQuestionForm,
    handleChoiceChange,
    isSubmitting,
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: question.question_id,
        disabled: isThisEditing || isReordering,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: "relative",
        zIndex: isDragging ? 999 : "auto",
    };

    if (isThisEditing) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                id={`edit-question-${question.question_id}`}
                className="question-card question-form-card editing mb-0"
            >
                <div className="question-form-header">
                    <div className="d-flex align-items-center gap-3">
                        <div className="question-number">
                            <span>Q{index + 1}</span>
                        </div>
                        <div>
                            <h5 className="mb-0 fw-bold text-dark">
                                Edit Pertanyaan Q{index + 1}
                            </h5>
                            <small className="text-muted">
                                Ubah teks pertanyaan dan pilih jawaban yang benar
                            </small>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="btn-icon"
                        onClick={handleCancelQuestionForm}
                        title="Batalkan Edit"
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <form onSubmit={handleCreateQuestion}>
                    <div className="question-form-body">
                        <div className="form-group">
                            <label className="form-label">Teks Pertanyaan *</label>
                            <textarea
                                className="form-control"
                                rows="3"
                                value={questionForm.question_text}
                                onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })}
                                placeholder="Masukkan pertanyaan kuis Anda di sini..."
                                required
                            />
                        </div>

                        <div className="form-group mb-0">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <label className="form-label mb-0">Pilihan Jawaban *</label>
                                <span className="form-help mb-0">
                                    <i className="fas fa-info-circle me-1"></i>Pilih radio untuk menandai kunci jawaban yang benar
                                </span>
                            </div>

                            <div className="choices-form-list">
                                {questionForm.choices.map((choice, cIndex) => (
                                    <div
                                        key={cIndex}
                                        className={`choice-input-group ${choice.is_correct ? "is-selected-correct" : ""}`}
                                        onClick={(e) => {
                                            if (e.target.tagName !== 'INPUT' || e.target.type === 'radio') {
                                                handleChoiceChange(cIndex, "is_correct", true);
                                            }
                                        }}
                                    >
                                        <div className="choice-selector">
                                            <input
                                                type="radio"
                                                id={`edit-choice-${question.question_id}-${cIndex}`}
                                                name={`correct_answer_edit_${question.question_id}`}
                                                checked={choice.is_correct}
                                                onChange={(e) => handleChoiceChange(cIndex, "is_correct", e.target.checked)}
                                            />
                                            <label
                                                htmlFor={`edit-choice-${question.question_id}-${cIndex}`}
                                                className="choice-letter"
                                            >
                                                {String.fromCharCode(65 + cIndex)}.
                                            </label>
                                        </div>
                                        <input
                                            type="text"
                                            className="form-control choice-input"
                                            value={choice.choice_text}
                                            onChange={(e) => handleChoiceChange(cIndex, "choice_text", e.target.value)}
                                            placeholder={`Pilihan ${String.fromCharCode(65 + cIndex)}`}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        {choice.is_correct && (
                                            <span className="badge bg-success-subtle text-success ms-2 px-2 py-1 correct-pill">
                                                <i className="fas fa-check me-1"></i>Kunci Jawaban
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="question-form-footer">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={handleCancelQuestionForm}
                            disabled={isSubmitting}
                        >
                            Batalkan
                        </button>
                        <button
                            type="submit"
                            className="btn btn-update-course"
                            disabled={isSubmitting}
                        >
                            {isSubmitting && <span className="spinner-border spinner-border-sm me-2"></span>}
                            <i className="fas fa-save me-2"></i>
                            Perbarui Pertanyaan
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`question-card mb-0 ${isDragging ? "is-dragging" : ""}`}
        >
            <div className="question-header">
                <div className="question-left-meta d-flex align-items-center gap-2">
                    {/* Drag Handle */}
                    <div
                        {...listeners}
                        {...attributes}
                        className="drag-handle-question"
                        title="Seret untuk mengubah urutan pertanyaan"
                        style={{ cursor: isDragging ? "grabbing" : "grab" }}
                    >
                        <i className="fas fa-grip-vertical"></i>
                    </div>

                    {/* Question Number */}
                    <div className="question-number">
                        <span>Q{index + 1}</span>
                    </div>

                    {/* Order Controls (Up / Down buttons) */}
                    <div className="question-order-controls" role="group">
                        <button
                            type="button"
                            className="question-order-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                moveQuestionUp(index);
                            }}
                            disabled={index === 0 || isReordering}
                            title="Pindahkan pertanyaan ke atas (Naik 1 soal)"
                        >
                            <i className="fas fa-arrow-up"></i>
                        </button>
                        <button
                            type="button"
                            className="question-order-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                moveQuestionDown(index);
                            }}
                            disabled={index === totalQuestions - 1 || isReordering}
                            title="Pindahkan pertanyaan ke bawah (Turun 1 soal)"
                        >
                            <i className="fas fa-arrow-down"></i>
                        </button>
                    </div>
                </div>

                <div className="question-text">
                    <h5>{question.question_text}</h5>
                </div>

                <div className="question-actions">
                    <button
                        className="btn-icon"
                        onClick={() => handleEditQuestion(question)}
                        title="Edit Pertanyaan"
                        disabled={isReordering}
                    >
                        <i className="fas fa-edit"></i>
                    </button>
                    <button
                        className="btn-icon btn-danger"
                        onClick={() => handleDeleteQuestion(question.question_id)}
                        title="Hapus Pertanyaan"
                        disabled={isReordering}
                    >
                        <i className="fas fa-trash"></i>
                    </button>
                </div>
            </div>

            <div className="question-choices">
                {question.choices?.map((choice, choiceIndex) => (
                    <div
                        key={choice.choice_id || choiceIndex}
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
                        {choice.is_correct && (
                            <span className="badge bg-success-subtle text-success ms-auto px-2 py-1 correct-pill">
                                <i className="fas fa-check me-1"></i>Jawaban Benar
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

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
        quiz_type: "quiz",
        presentation_mode: "ordered",
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
    const [isAddingQuestion, setIsAddingQuestion] = useState(false);
    const [editingQuiz, setEditingQuiz] = useState(null);
    const [editingQuestion, setEditingQuestion] = useState(null);
    const [activeTab, setActiveTab] = useState("overview");
    const [quizTypeFilter, setQuizTypeFilter] = useState("all"); // Filter for quizzes in overview: 'all' | 'quiz' | 'pre_post_test'
    const [questionsAdded, setQuestionsAdded] = useState(0); // Track questions added in current session
    const [isContinuousAdd, setIsContinuousAdd] = useState(false); // Track if user wants to keep adding
    const [isReordering, setIsReordering] = useState(false); // Track if drag/reordering is in progress

    // Configure drag sensors for @dnd-kit
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 6, // 6px movement required before drag starts (prevents accidental drags when clicking)
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );


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
                const response = await apiInstance.put(`quiz/detail/${editingQuiz.quiz_id}/`, quizData);
                Toast().fire({
                    icon: "success",
                    title: "Kuis berhasil diperbarui"
                });
                if (currentQuiz?.quiz_id === editingQuiz.quiz_id) {
                    setCurrentQuiz(response.data);
                }
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

            // If editing, close edit form. If adding and continuous mode, reset form but keep add form open
            if (editingQuestion) {
                setEditingQuestion(null);
                resetQuestionForm();
                setQuestionsAdded(0);
            } else if (isContinuousAdd) {
                // Reset form for next question but keep add form open
                resetQuestionForm();
                setTimeout(() => {
                    const textarea = document.getElementById("new-question-textarea");
                    if (textarea) textarea.focus();
                }, 100);
            } else {
                // Close add form if not in continuous mode
                setIsAddingQuestion(false);
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
            // If editing, delete existing choices first (✨ PHASE 4.77 FIX: Use existing backend DELETE endpoint)
            if (editingQuestion && editingQuestion.choices && editingQuestion.choices.length > 0) {
                console.log(`[Quiz Choice] Deleting ${editingQuestion.choices.length} old choice(s)...`);
                for (const oldChoice of editingQuestion.choices) {
                    try {
                        await apiInstance.delete(`quiz/choice/detail/${oldChoice.choice_id}/`);
                    } catch (error) {
                        console.error(`Failed to delete choice ${oldChoice.choice_id}:`, error);
                        // Continue deleting other choices even if one fails
                    }
                }
                console.log(`[Quiz Choice] [OK] Old choice(s) deleted successfully`);
            }

            // Create new choices
            console.log(`[Quiz Choice] Creating ${choices.length} new choice(s)...`);
            for (const [index, choice] of choices.entries()) {
                await apiInstance.post("quiz/choice/list-create/", {
                    question_id: questionId,
                    choice_text: choice.choice_text,
                    is_correct: choice.is_correct,
                    order: index + 1
                });
            }
            console.log(`[Quiz Choice] [OK] New choice(s) created successfully`);
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
            if (editingQuestion?.question_id === questionId) {
                setEditingQuestion(null);
                resetQuestionForm();
            }
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

    /**
     * Persist updated question orders to backend
     */
    const saveQuestionsOrder = async (updatedQuestions) => {
        setIsReordering(true);
        try {
            const ordersPayload = updatedQuestions.map((q, idx) => ({
                question_id: q.question_id,
                order: idx + 1,
            }));
            await apiInstance.post("quiz/question/reorder/", { orders: ordersPayload });
            Toast().fire({
                icon: "success",
                title: "Urutan pertanyaan berhasil disimpan",
                timer: 1500,
            });
        } catch (error) {
            console.error("Failed to reorder questions:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal menyimpan urutan pertanyaan",
            });
            // Re-fetch to restore database order on error
            if (currentQuiz?.quiz_id) {
                fetchQuestions(currentQuiz.quiz_id);
            }
        } finally {
            setIsReordering(false);
        }
    };

    /**
     * Move question up 1 step
     */
    const moveQuestionUp = (index) => {
        if (index <= 0 || isReordering) return;
        const newQuestions = arrayMove(questions, index, index - 1);
        setQuestions(newQuestions);
        saveQuestionsOrder(newQuestions);
    };

    /**
     * Move question down 1 step
     */
    const moveQuestionDown = (index) => {
        if (index >= questions.length - 1 || isReordering) return;
        const newQuestions = arrayMove(questions, index, index + 1);
        setQuestions(newQuestions);
        saveQuestionsOrder(newQuestions);
    };

    /**
     * Handle drag and drop reordering end
     */
    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = questions.findIndex((q) => q.question_id === active.id);
        const newIndex = questions.findIndex((q) => q.question_id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
            const newQuestions = arrayMove(questions, oldIndex, newIndex);
            setQuestions(newQuestions);
            saveQuestionsOrder(newQuestions);
        }
    };

    // Form Helpers
    const resetQuizForm = () => {
        setQuizForm({
            title: "",
            description: "",
            quiz_type: "quiz",
            presentation_mode: "ordered",
            is_active: true
        });
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
    };

    const handleEditQuiz = (quiz) => {
        setQuizForm({
            title: quiz.title,
            description: quiz.description || "",
            quiz_type: quiz.quiz_type || "quiz",
            presentation_mode: quiz.presentation_mode || "ordered",
            is_active: quiz.is_active
        });
        setEditingQuiz(quiz);
        setShowQuizModal(true);
    };

    const handleEditQuestion = (question) => {
        setIsAddingQuestion(false);
        const existingChoices = question.choices && Array.isArray(question.choices) ? question.choices : [];
        let formChoices = [];
        if (existingChoices.length >= 4) {
            formChoices = existingChoices.slice(0, 4).map(c => ({
                choice_text: c.choice_text || "",
                is_correct: !!c.is_correct
            }));
        } else {
            formChoices = [
                ...existingChoices.map(c => ({
                    choice_text: c.choice_text || "",
                    is_correct: !!c.is_correct
                })),
                ...Array(4 - existingChoices.length).fill(null).map(() => ({
                    choice_text: "",
                    is_correct: false
                }))
            ];
        }

        setQuestionForm({
            question_text: question.question_text || "",
            choices: formChoices
        });
        setEditingQuestion(question);
        setIsContinuousAdd(false);
        setTimeout(() => {
            const formElem = document.getElementById(`edit-question-${question.question_id}`);
            if (formElem) {
                formElem.scrollIntoView({ behavior: "smooth", block: "center" });
                const textarea = formElem.querySelector("textarea");
                if (textarea) textarea.focus();
            }
        }, 100);
    };

    const handleChoiceChange = (index, field, value) => {
        const newChoices = [...questionForm.choices];
        if (field === "is_correct") {
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
        setIsAddingQuestion(false);
        setEditingQuestion(null);
        resetQuestionForm();
        fetchQuestions(quiz.quiz_id);
    };

    const handleOpenAddQuestion = () => {
        setEditingQuestion(null);
        resetQuestionForm();
        setIsAddingQuestion(true);
        setIsContinuousAdd(false);
        setQuestionsAdded(0);
        setTimeout(() => {
            const formElem = document.getElementById("new-question-inline-form");
            if (formElem) {
                formElem.scrollIntoView({ behavior: "smooth", block: "center" });
                const textarea = formElem.querySelector("textarea");
                if (textarea) textarea.focus();
            }
        }, 100);
    };

    const handleCancelQuestionForm = () => {
        setIsAddingQuestion(false);
        setEditingQuestion(null);
        resetQuestionForm();
        setIsContinuousAdd(false);
        setQuestionsAdded(0);
    };

    // Show full-page loading spinner on initial load
    if (loading && !course) {
        return (
            <>
                <BaseHeader />
                <section className="course-quiz-container course-quiz-page course-quiz-loading-section">
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

            <section className="course-quiz-container course-quiz-page">
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
                            <div className="quiz-stats-overview mb-4">
                                <div className="quiz-stat-card stat-total-quizzes">
                                    <div className="stat-icon">
                                        <i className="fas fa-list-alt"></i>
                                    </div>
                                    <div className="stat-content">
                                        <div className="stat-number">{quizzes.length}</div>
                                        <div className="stat-label">Total Kuis</div>
                                    </div>
                                </div>
                                <div className="quiz-stat-card stat-total-questions">
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
                                <div className="quiz-stat-card stat-active-quizzes">
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
                                <div className="quiz-stat-card stat-inactive-quizzes">
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
                                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                                            <div className="d-flex align-items-center gap-3 flex-wrap">
                                                <h3 className="quiz-section-title mb-0">
                                                    <i className="fas fa-list me-2"></i>
                                                    Semua Kuis
                                                </h3>
                                                <div className="quiz-type-filter-group">
                                                    <button
                                                        type="button"
                                                        className={`quiz-filter-pill ${quizTypeFilter === "all" ? "active" : ""}`}
                                                        onClick={() => setQuizTypeFilter("all")}
                                                    >
                                                        Semua ({quizzes.length})
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`quiz-filter-pill ${quizTypeFilter === "quiz" ? "active" : ""}`}
                                                        onClick={() => setQuizTypeFilter("quiz")}
                                                    >
                                                        <i className="fas fa-clipboard-check me-1"></i>
                                                        Kuis ({quizzes.filter(q => (q.quiz_type || "quiz") === "quiz").length})
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`quiz-filter-pill ${quizTypeFilter === "pre_post_test" ? "active" : ""}`}
                                                        onClick={() => setQuizTypeFilter("pre_post_test")}
                                                    >
                                                        <i className="fas fa-graduation-cap me-1"></i>
                                                        Pre & Post-test ({quizzes.filter(q => q.quiz_type === "pre_post_test").length})
                                                    </button>
                                                </div>
                                            </div>
                                            <button
                                                className="btn btn-update-course"
                                                onClick={() => setShowQuizModal(true)}
                                            >
                                                <i className="fas fa-plus me-2"></i>
                                                Tambah Kuis
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
                                        ) : quizzes.filter(quiz => quizTypeFilter === "all" || (quiz.quiz_type || "quiz") === quizTypeFilter).length === 0 ? (
                                            <div className="quiz-empty-card text-center py-5">
                                                <div className="empty-state">
                                                    <i className="fas fa-filter empty-icon"></i>
                                                    <h4>Tidak Ada Kuis</h4>
                                                    <p className="text-muted">Tidak ditemukan kuis untuk kategori filter ini</p>
                                                    <button
                                                        className="btn btn-outline-secondary btn-sm mt-2"
                                                        onClick={() => setQuizTypeFilter("all")}
                                                    >
                                                        Tampilkan Semua Kuis
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            quizzes
                                                .filter(quiz => quizTypeFilter === "all" || (quiz.quiz_type || "quiz") === quizTypeFilter)
                                                .map((quiz) => (
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
                                                        <div className="quiz-badges-row mb-2 d-flex align-items-center gap-1 flex-wrap">
                                                            <span className={`badge-quiz-type ${quiz.quiz_type === "pre_post_test" ? "type-prepost" : "type-quiz"}`}>
                                                                <i className={`fas ${quiz.quiz_type === "pre_post_test" ? "fa-graduation-cap" : "fa-clipboard-check"} me-1`}></i>
                                                                {quiz.quiz_type === "pre_post_test" ? "Pre & Post-test" : "Kuis"}
                                                            </span>
                                                            <span
                                                                className={`badge-quiz-mode ${quiz.presentation_mode === "random" ? "mode-random" : "mode-ordered"}`}
                                                                title={quiz.presentation_mode === "random" ? "Pertanyaan disajikan secara acak untuk setiap peserta" : "Pertanyaan disajikan sesuai urutan"}
                                                            >
                                                                <i className={`fas ${quiz.presentation_mode === "random" ? "fa-random" : "fa-sort-numeric-down"} me-1`}></i>
                                                                {quiz.presentation_mode === "random" ? "Acak" : "Sesuai Urutan"}
                                                            </span>
                                                        </div>
                                                        <h4 className="quiz-title" title={quiz.title}>{quiz.title}</h4>
                                                        {quiz.description && (
                                                            <p className="quiz-description text-secondary" title={quiz.description}>{quiz.description}</p>
                                                        )}
                                                        <div className="quiz-stats d-flex flex-row align-items-center flex-wrap">
                                                            <div className="stat-item d-inline-flex flex-row align-items-center">
                                                                <i className="fas fa-question me-1" style={{ color: '#0f766e' }}></i>
                                                                <span>{quiz.total_questions || 0} Pertanyaan</span>
                                                            </div>
                                                            <div className="stat-item d-inline-flex flex-row align-items-center">
                                                                <i className="fas fa-calendar text-success me-1"></i>
                                                                <span>{new Date(quiz.date).toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="quiz-card-footer">
                                                        <button
                                                            className="btn btn-primary btn-sm w-100"
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
                                                <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                                                    <h3 className="quiz-title mb-0">{currentQuiz.title}</h3>
                                                    <span className={`badge-quiz-type ${currentQuiz.quiz_type === "pre_post_test" ? "type-prepost" : "type-quiz"}`}>
                                                        <i className={`fas ${currentQuiz.quiz_type === "pre_post_test" ? "fa-graduation-cap" : "fa-clipboard-check"} me-1`}></i>
                                                        {currentQuiz.quiz_type === "pre_post_test" ? "Pre & Post-test" : "Kuis"}
                                                    </span>
                                                    <span
                                                        className={`badge-quiz-mode ${currentQuiz.presentation_mode === "random" ? "mode-random" : "mode-ordered"}`}
                                                        title={currentQuiz.presentation_mode === "random" ? "Pertanyaan disajikan secara acak untuk setiap peserta" : "Pertanyaan disajikan sesuai urutan"}
                                                    >
                                                        <i className={`fas ${currentQuiz.presentation_mode === "random" ? "fa-random" : "fa-sort-numeric-down"} me-1`}></i>
                                                        {currentQuiz.presentation_mode === "random" ? "Acak" : "Sesuai Urutan"}
                                                    </span>
                                                </div>
                                                <p className="quiz-description">{currentQuiz.description || "Kelola pertanyaan kuis untuk kursus ini"}</p>
                                                <span className="text-muted small mt-1">
                                                    <i className="fas fa-list-ol me-1"></i>
                                                    Total <strong>{questions.length}</strong> pertanyaan dalam kuis ini
                                                </span>
                                            </div>
                                            {!isAddingQuestion && !editingQuestion && (
                                                <button
                                                    className="btn btn-update-course"
                                                    onClick={handleOpenAddQuestion}
                                                >
                                                    <i className="fas fa-plus me-2"></i>
                                                    Tambah Pertanyaan
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Questions List */}
                                    <div className="questions-list">
                                        {questions.length === 0 && !isAddingQuestion ? (
                                            <div className="quiz-empty-card text-center py-5">
                                                <div className="empty-state">
                                                    <i className="fas fa-question empty-icon"></i>
                                                    <h4>Belum Ada Pertanyaan</h4>
                                                    <p className="text-muted">Tambahkan pertanyaan pertama Anda ke kuis ini secara langsung</p>
                                                    <button
                                                        className="btn btn-update-course"
                                                        onClick={handleOpenAddQuestion}
                                                    >
                                                        <i className="fas fa-plus me-2"></i>
                                                        Tambah Pertanyaan Pertama
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <DndContext
                                                    sensors={sensors}
                                                    collisionDetection={closestCenter}
                                                    onDragEnd={handleDragEnd}
                                                >
                                                    <SortableContext
                                                        items={questions.map((q) => q.question_id)}
                                                        strategy={verticalListSortingStrategy}
                                                    >
                                                        {questions.map((question, index) => (
                                                            <SortableQuestionCard
                                                                key={question.question_id}
                                                                question={question}
                                                                index={index}
                                                                totalQuestions={questions.length}
                                                                isThisEditing={editingQuestion?.question_id === question.question_id}
                                                                isReordering={isReordering}
                                                                moveQuestionUp={moveQuestionUp}
                                                                moveQuestionDown={moveQuestionDown}
                                                                handleEditQuestion={handleEditQuestion}
                                                                handleDeleteQuestion={handleDeleteQuestion}
                                                                handleCancelQuestionForm={handleCancelQuestionForm}
                                                                handleCreateQuestion={handleCreateQuestion}
                                                                questionForm={questionForm}
                                                                setQuestionForm={setQuestionForm}
                                                                handleChoiceChange={handleChoiceChange}
                                                                isSubmitting={isSubmitting}
                                                            />
                                                        ))}
                                                    </SortableContext>
                                                </DndContext>

                                                {/* Inline Add Question Form */}
                                                {isAddingQuestion && (
                                                    <div id="new-question-inline-form" className="question-card question-form-card adding mb-0">
                                                        <div className="question-form-header">
                                                            <div className="d-flex align-items-center gap-3">
                                                                <div className="question-number">
                                                                    <span>Q{questions.length + 1}</span>
                                                                </div>
                                                                <div>
                                                                    <h5 className="mb-0 fw-bold text-dark">
                                                                        Tambah Pertanyaan #{questions.length + 1}
                                                                    </h5>
                                                                    {questionsAdded > 0 ? (
                                                                        <small className="text-success fw-medium">
                                                                            <i className="fas fa-check-circle me-1"></i>
                                                                            {questionsAdded} pertanyaan berhasil ditambahkan dalam sesi ini
                                                                        </small>
                                                                    ) : (
                                                                        <small className="text-muted">
                                                                            Tuliskan teks pertanyaan dan tentukan satu jawaban yang benar
                                                                        </small>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                className="btn-icon"
                                                                onClick={handleCancelQuestionForm}
                                                                title="Batalkan Tambah"
                                                            >
                                                                <i className="fas fa-times"></i>
                                                            </button>
                                                        </div>

                                                        <form onSubmit={handleCreateQuestion}>
                                                            <div className="question-form-body">
                                                                <div className="form-group">
                                                                    <label className="form-label">Teks Pertanyaan *</label>
                                                                    <textarea
                                                                        id="new-question-textarea"
                                                                        className="form-control"
                                                                        rows="3"
                                                                        value={questionForm.question_text}
                                                                        onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })}
                                                                        placeholder="Masukkan pertanyaan kuis Anda di sini..."
                                                                        required
                                                                    />
                                                                </div>

                                                                <div className="form-group mb-0">
                                                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                                                        <label className="form-label mb-0">Pilihan Jawaban *</label>
                                                                        <span className="form-help mb-0">
                                                                            <i className="fas fa-info-circle me-1"></i>Pilih radio untuk menandai kunci jawaban yang benar
                                                                        </span>
                                                                    </div>

                                                                    <div className="choices-form-list">
                                                                        {questionForm.choices.map((choice, cIndex) => (
                                                                            <div
                                                                                key={cIndex}
                                                                                className={`choice-input-group ${choice.is_correct ? "is-selected-correct" : ""}`}
                                                                                onClick={(e) => {
                                                                                    if (e.target.tagName !== 'INPUT' || e.target.type === 'radio') {
                                                                                        handleChoiceChange(cIndex, "is_correct", true);
                                                                                    }
                                                                                }}
                                                                            >
                                                                                <div className="choice-selector">
                                                                                    <input
                                                                                        type="radio"
                                                                                        id={`new-choice-${cIndex}`}
                                                                                        name="correct_answer_new"
                                                                                        checked={choice.is_correct}
                                                                                        onChange={(e) => handleChoiceChange(cIndex, "is_correct", e.target.checked)}
                                                                                    />
                                                                                    <label
                                                                                        htmlFor={`new-choice-${cIndex}`}
                                                                                        className="choice-letter"
                                                                                    >
                                                                                        {String.fromCharCode(65 + cIndex)}.
                                                                                    </label>
                                                                                </div>
                                                                                <input
                                                                                    type="text"
                                                                                    className="form-control choice-input"
                                                                                    value={choice.choice_text}
                                                                                    onChange={(e) => handleChoiceChange(cIndex, "choice_text", e.target.value)}
                                                                                    placeholder={`Pilihan ${String.fromCharCode(65 + cIndex)}`}
                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                />
                                                                                {choice.is_correct && (
                                                                                    <span className="badge bg-success-subtle text-success ms-2 px-2 py-1 correct-pill">
                                                                                        <i className="fas fa-check me-1"></i>Kunci Jawaban
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="question-form-footer">
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-secondary"
                                                                    onClick={handleCancelQuestionForm}
                                                                    disabled={isSubmitting}
                                                                >
                                                                    Batalkan
                                                                </button>
                                                                <div className="d-flex gap-2">
                                                                    <button
                                                                        type="submit"
                                                                        className="btn btn-success"
                                                                        disabled={isSubmitting}
                                                                        onClick={() => setIsContinuousAdd(true)}
                                                                    >
                                                                        {isSubmitting && isContinuousAdd && <span className="spinner-border spinner-border-sm me-2"></span>}
                                                                        <i className="fas fa-plus me-2"></i>
                                                                        Simpan & Tambah Lagi
                                                                    </button>
                                                                    <button
                                                                        type="submit"
                                                                        className="btn btn-update-course"
                                                                        disabled={isSubmitting}
                                                                        onClick={() => setIsContinuousAdd(false)}
                                                                    >
                                                                        {isSubmitting && !isContinuousAdd && <span className="spinner-border spinner-border-sm me-2"></span>}
                                                                        <i className="fas fa-check me-2"></i>
                                                                        Simpan Pertanyaan
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </form>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {/* Action Bar at Bottom of Questions */}
                                    {!isAddingQuestion && !editingQuestion && questions.length > 0 && (
                                        <div className="d-flex justify-content-end align-items-center mt-4 pt-2">
                                            <button
                                                className="btn btn-update-course"
                                                onClick={handleOpenAddQuestion}
                                            >
                                                <i className="fas fa-plus me-2"></i>
                                                Tambah Pertanyaan
                                            </button>
                                        </div>
                                    )}
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
                                                        onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })}
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
                                                        onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })}
                                                        placeholder="Masukkan deskripsi kuis (opsional)"
                                                    />
                                                </div>

                                                {/* Tipe Kuis */}
                                                <div className="form-group mb-3">
                                                    <label className="form-label fw-bold">Tipe Kuis *</label>
                                                    <div className="quiz-option-grid">
                                                        <label className={`quiz-option-card ${quizForm.quiz_type === "quiz" ? "selected" : ""}`}>
                                                            <input
                                                                type="radio"
                                                                name="quiz_type"
                                                                value="quiz"
                                                                checked={quizForm.quiz_type === "quiz"}
                                                                onChange={(e) => setQuizForm({ ...quizForm, quiz_type: e.target.value })}
                                                                className="visually-hidden"
                                                            />
                                                            <div className="option-icon-box quiz">
                                                                <i className="fas fa-clipboard-check"></i>
                                                            </div>
                                                            <div className="option-text-box">
                                                                <div className="option-title">Kuis</div>
                                                                <div className="option-desc">Kuis evaluasi materi reguler atau latihan per modul</div>
                                                            </div>
                                                            <div className="option-check">
                                                                <i className="fas fa-check-circle"></i>
                                                            </div>
                                                        </label>
                                                        <label className={`quiz-option-card ${quizForm.quiz_type === "pre_post_test" ? "selected" : ""}`}>
                                                            <input
                                                                type="radio"
                                                                name="quiz_type"
                                                                value="pre_post_test"
                                                                checked={quizForm.quiz_type === "pre_post_test"}
                                                                onChange={(e) => setQuizForm({ ...quizForm, quiz_type: e.target.value })}
                                                                className="visually-hidden"
                                                            />
                                                            <div className="option-icon-box prepost">
                                                                <i className="fas fa-graduation-cap"></i>
                                                            </div>
                                                            <div className="option-text-box">
                                                                <div className="option-title">Pre & Post-test</div>
                                                                <div className="option-desc">Tes awal dan evaluasi akhir capaian kursus</div>
                                                            </div>
                                                            <div className="option-check">
                                                                <i className="fas fa-check-circle"></i>
                                                            </div>
                                                        </label>
                                                    </div>
                                                </div>

                                                {/* Penyajian Pertanyaan */}
                                                <div className="form-group mb-3">
                                                    <label className="form-label fw-bold">Penyajian Pertanyaan *</label>
                                                    <div className="quiz-option-grid">
                                                        <label className={`quiz-option-card ${quizForm.presentation_mode === "ordered" ? "selected" : ""}`}>
                                                            <input
                                                                type="radio"
                                                                name="presentation_mode"
                                                                value="ordered"
                                                                checked={quizForm.presentation_mode === "ordered"}
                                                                onChange={(e) => setQuizForm({ ...quizForm, presentation_mode: e.target.value })}
                                                                className="visually-hidden"
                                                            />
                                                            <div className="option-icon-box ordered">
                                                                <i className="fas fa-sort-numeric-down"></i>
                                                            </div>
                                                            <div className="option-text-box">
                                                                <div className="option-title">Sesuai Urutan</div>
                                                                <div className="option-desc">Disajikan berurutan nomor 1, 2, 3...</div>
                                                            </div>
                                                            <div className="option-check">
                                                                <i className="fas fa-check-circle"></i>
                                                            </div>
                                                        </label>
                                                        <label className={`quiz-option-card ${quizForm.presentation_mode === "random" ? "selected" : ""}`}>
                                                            <input
                                                                type="radio"
                                                                name="presentation_mode"
                                                                value="random"
                                                                checked={quizForm.presentation_mode === "random"}
                                                                onChange={(e) => setQuizForm({ ...quizForm, presentation_mode: e.target.value })}
                                                                className="visually-hidden"
                                                            />
                                                            <div className="option-icon-box random">
                                                                <i className="fas fa-random"></i>
                                                            </div>
                                                            <div className="option-text-box">
                                                                <div className="option-title">Acak (Diacak)</div>
                                                                <div className="option-desc">Urutan pertanyaan diacak untuk setiap peserta</div>
                                                            </div>
                                                            <div className="option-check">
                                                                <i className="fas fa-check-circle"></i>
                                                            </div>
                                                        </label>
                                                    </div>
                                                </div>

                                                <div className="form-group">
                                                    <div className="form-check">
                                                        <input
                                                            type="checkbox"
                                                            className="form-check-input"
                                                            id="isActive"
                                                            checked={quizForm.is_active}
                                                            onChange={(e) => setQuizForm({ ...quizForm, is_active: e.target.checked })}
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
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </>

    );
}

export default React.memo(CourseQuiz);
