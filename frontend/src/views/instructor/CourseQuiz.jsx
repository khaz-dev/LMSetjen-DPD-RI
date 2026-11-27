import React, { useState, useEffect, useRef } from "react";
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
    currentQuiz,
    course,
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
        opacity: isDragging ? 0 : 1,
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
                                Ubah teks pertanyaan, pilih modul materi asal, dan tentukan bobot jawaban
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
                        <div className="row g-2 mb-3">
                            <div className="col-12 col-md-7">
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
                            <div className="col-12 col-md-5">
                                <label className="form-label">
                                    <i className="fas fa-layer-group me-1 text-teal"></i>Modul Materi Asal (Opsional)
                                </label>
                                <select
                                    className="form-select form-select-sm"
                                    value={questionForm.variant_id || ""}
                                    onChange={(e) => setQuestionForm({ ...questionForm, variant_id: e.target.value })}
                                >
                                    <option value="">-- Tanpa Modul Spesifik --</option>
                                    {course?.curriculum?.map((mod, mIdx) => (
                                        <option key={mod.variant_id || mod.id || mIdx} value={mod.variant_id || mod.id}>
                                            Modul {mIdx + 1}: {mod.title}
                                        </option>
                                    ))}
                                </select>
                                <small className="text-muted d-block mt-1" style={{ fontSize: "0.74rem" }}>
                                    Digunakan oleh Pre/Post-Test untuk mengundi soal per modul materi.
                                </small>
                            </div>
                        </div>

                        <div className="form-group mb-0">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <label className="form-label mb-0">Pilihan Jawaban *</label>
                                <span className="form-help mb-0">
                                    <i className="fas fa-info-circle me-1"></i>
                                    {currentQuiz?.scoring_mode === "weighted"
                                        ? "Isi bobot poin tiap pilihan jawaban dan tandai kunci utama"
                                        : "Pilih radio untuk menandai kunci jawaban yang benar"}
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
                                        {currentQuiz?.scoring_mode === "weighted" && (
                                            <div className="d-flex align-items-center gap-1 ms-2" onClick={(e) => e.stopPropagation()}>
                                                <span className="text-muted fw-semibold" style={{ fontSize: "0.72rem", whiteSpace: "nowrap" }}>Poin:</span>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    min="0"
                                                    className="form-control form-control-sm text-center"
                                                    style={{ width: "72px", fontWeight: "700" }}
                                                    value={choice.point_weight !== undefined ? choice.point_weight : 0}
                                                    onChange={(e) => handleChoiceChange(cIndex, "point_weight", parseFloat(e.target.value) || 0)}
                                                    placeholder="0"
                                                    title="Bobot poin jika peserta memilih jawaban ini"
                                                />
                                            </div>
                                        )}
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
                    <div className="d-flex align-items-center gap-2 mb-1">
                        {question.variant_title && (
                            <span className="badge bg-light text-dark border px-2 py-0" style={{ fontSize: "0.72rem" }}>
                                <i className="fas fa-layer-group me-1 text-teal"></i>{question.variant_title}
                            </span>
                        )}
                    </div>
                    <h5 className="mb-0">{question.question_text}</h5>
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
                        {currentQuiz?.scoring_mode === "weighted" && (
                            <span className="badge bg-primary-subtle text-primary ms-auto me-2 px-2 py-1" style={{ fontSize: "0.72rem" }}>
                                {choice.point_weight || 0} Poin
                            </span>
                        )}
                        {choice.is_correct && (
                            <span className={`badge bg-success-subtle text-success px-2 py-1 correct-pill ${currentQuiz?.scoring_mode === "weighted" ? "" : "ms-auto"}`}>
                                <i className="fas fa-check me-1"></i>Jawaban Benar
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Standard RFC 4180 compliant CSV parser with quote escaping support,
 * multi-line field support, and auto delimiter detection (comma, semicolon, tab).
 */
function parseCSV(text) {
    if (!text || typeof text !== "string") return [];

    // Strip UTF-8 BOM if present
    let cleanText = text.replace(/^\uFEFF/, "");

    // Detect delimiter from first line (common in Excel ID/EN: comma or semicolon)
    const firstLine = cleanText.split(/\r\n|\n|\r/)[0] || "";
    let delimiter = ",";
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;

    if (semicolonCount > commaCount && semicolonCount > tabCount) {
        delimiter = ";";
    } else if (tabCount > commaCount && tabCount > semicolonCount) {
        delimiter = "\t";
    }

    const rows = [];
    let currentRow = [];
    let currentCell = "";
    let inQuotes = false;

    for (let i = 0; i < cleanText.length; i++) {
        const char = cleanText[i];
        const nextChar = cleanText[i + 1];

        if (inQuotes) {
            if (char === '"' && nextChar === '"') {
                currentCell += '"';
                i++; // Skip escaped quote
            } else if (char === '"') {
                inQuotes = false;
            } else {
                currentCell += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === delimiter) {
                currentRow.push(currentCell.trim());
                currentCell = "";
            } else if (char === "\r" && nextChar === "\n") {
                currentRow.push(currentCell.trim());
                if (currentRow.some(c => c !== "")) {
                    rows.push(currentRow);
                }
                currentRow = [];
                currentCell = "";
                i++; // Skip \n
            } else if (char === "\n" || char === "\r") {
                currentRow.push(currentCell.trim());
                if (currentRow.some(c => c !== "")) {
                    rows.push(currentRow);
                }
                currentRow = [];
                currentCell = "";
            } else {
                currentCell += char;
            }
        }
    }

    if (currentCell !== "" || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c !== "")) {
            rows.push(currentRow);
        }
    }

    return rows;
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
        scoring_mode: "standard",
        passing_score: 70.0,
        duration_minutes: 15,
        blueprint_rules: [],
        presentation_mode: "ordered",
        is_active: true
    });

    const [questionForm, setQuestionForm] = useState({
        question_text: "",
        variant_id: "",
        choices: [
            { choice_text: "", is_correct: false, point_weight: 0 },
            { choice_text: "", is_correct: false, point_weight: 0 },
            { choice_text: "", is_correct: false, point_weight: 0 },
            { choice_text: "", is_correct: false, point_weight: 0 }
        ]
    });

    // Blueprint Rules Helpers for Pre-Test & Post-Test
    const addBlueprintRule = () => {
        const currentRules = quizForm.blueprint_rules || [];
        const nextStart = currentRules.length > 0
            ? Math.max(...currentRules.map(r => parseInt(r.end_num || 0) || 0)) + 1
            : 1;
        const nextEnd = nextStart + 1;
        const firstModule = course?.curriculum?.[0];
        const newRule = {
            rule_id: `rule_${Date.now()}`,
            variant_id: firstModule?.variant_id || firstModule?.id || "",
            variant_title: firstModule?.title || "",
            start_num: nextStart,
            end_num: nextEnd,
            question_count: (nextEnd - nextStart + 1)
        };
        setQuizForm({
            ...quizForm,
            blueprint_rules: [...currentRules, newRule]
        });
    };

    const updateBlueprintRule = (index, field, value) => {
        const updated = [...(quizForm.blueprint_rules || [])];
        updated[index] = { ...updated[index], [field]: value };
        if (field === 'start_num' || field === 'end_num') {
            const s = parseInt(field === 'start_num' ? value : updated[index].start_num) || 1;
            const e = parseInt(field === 'end_num' ? value : updated[index].end_num) || s;
            updated[index].question_count = Math.max(1, e - s + 1);
        }
        if (field === 'variant_id') {
            const selMod = course?.curriculum?.find(m => String(m.variant_id) === String(value) || String(m.id) === String(value));
            if (selMod) {
                updated[index].variant_title = selMod.title;
            }
        }
        setQuizForm({ ...quizForm, blueprint_rules: updated });
    };

    const removeBlueprintRule = (index) => {
        const updated = (quizForm.blueprint_rules || []).filter((_, i) => i !== index);
        setQuizForm({ ...quizForm, blueprint_rules: updated });
    };

    const autoGenerateBlueprint = () => {
        if (!course?.curriculum || course.curriculum.length === 0) {
            Toast().fire({
                icon: "warning",
                title: "Belum ada modul kurikulum pada kursus ini"
            });
            return;
        }
        let currentNum = 1;
        const generated = course.curriculum.map((mod, idx) => {
            const count = 2; // Default 2 questions per module
            const s = currentNum;
            const e = currentNum + count - 1;
            currentNum = e + 1;
            return {
                rule_id: `rule_auto_${idx}_${Date.now()}`,
                variant_id: mod.variant_id || mod.id,
                variant_title: mod.title,
                start_num: s,
                end_num: e,
                question_count: count
            };
        });
        setQuizForm({ ...quizForm, blueprint_rules: generated });
        Toast().fire({
            icon: "success",
            title: `Otomatis membuat ${generated.length} aturan modul!`
        });
    };

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

    // Import & Export States
    const [showImportModal, setShowImportModal] = useState(false);
    const [importTargetQuizId, setImportTargetQuizId] = useState("");
    const [importNewQuizTitle, setImportNewQuizTitle] = useState("");
    const [importNewQuizType, setImportNewQuizType] = useState("quiz");
    const [importFile, setImportFile] = useState(null);
    const [parsedQuestions, setParsedQuestions] = useState([]);
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState({ current: 0, total: 0, percent: 0 });
    const [importError, setImportError] = useState("");
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef(null);

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
                variant_id: questionForm.variant_id || null,
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
                    point_weight: parseFloat(choice.point_weight || 0),
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
            scoring_mode: "standard",
            passing_score: 70.0,
            duration_minutes: 15,
            blueprint_rules: [],
            presentation_mode: "ordered",
            is_active: true
        });
        setEditingQuiz(null);
    };

    const resetQuestionForm = () => {
        setQuestionForm({
            question_text: "",
            variant_id: "",
            choices: [
                { choice_text: "", is_correct: false, point_weight: 0 },
                { choice_text: "", is_correct: false, point_weight: 0 },
                { choice_text: "", is_correct: false, point_weight: 0 },
                { choice_text: "", is_correct: false, point_weight: 0 }
            ]
        });
        setEditingQuestion(null);
    };

    const handleEditQuiz = (quiz) => {
        setQuizForm({
            title: quiz.title,
            description: quiz.description || "",
            quiz_type: quiz.quiz_type || "quiz",
            scoring_mode: quiz.scoring_mode || "standard",
            passing_score: quiz.passing_score !== undefined ? parseFloat(quiz.passing_score) : 70.0,
            duration_minutes: quiz.duration_minutes !== undefined ? parseInt(quiz.duration_minutes) : 15,
            blueprint_rules: Array.isArray(quiz.blueprint_rules) ? quiz.blueprint_rules : [],
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
                is_correct: !!c.is_correct,
                point_weight: c.point_weight !== undefined ? parseFloat(c.point_weight) : 0
            }));
        } else {
            formChoices = [
                ...existingChoices.map(c => ({
                    choice_text: c.choice_text || "",
                    is_correct: !!c.is_correct,
                    point_weight: c.point_weight !== undefined ? parseFloat(c.point_weight) : 0
                })),
                ...Array(4 - existingChoices.length).fill(null).map(() => ({
                    choice_text: "",
                    is_correct: false,
                    point_weight: 0
                }))
            ];
        }

        setQuestionForm({
            question_text: question.question_text || "",
            variant_id: question.variant_id || question.variant?.variant_id || question.variant || "",
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

    // ==========================================
    // Import & Export Quiz / Questions Handlers
    // ==========================================
    const resetImportState = () => {
        setImportFile(null);
        setParsedQuestions([]);
        setImportProgress({ current: 0, total: 0, percent: 0 });
        setImportError("");
        setImportNewQuizTitle("");
        setImportNewQuizType("quiz");
        setIsDragOver(false);
    };

    const handleOpenImportModal = (preselectedQuizId = "") => {
        resetImportState();
        if (preselectedQuizId) {
            setImportTargetQuizId(preselectedQuizId);
        } else if (currentQuiz) {
            setImportTargetQuizId(currentQuiz.quiz_id);
        } else if (quizzes.length > 0) {
            setImportTargetQuizId(quizzes[0].quiz_id);
        } else {
            setImportTargetQuizId("new");
        }
        setShowImportModal(true);
    };

    const handleExportTemplate = () => {
        const csvContent =
            `No,Pertanyaan,Pilihan A,Pilihan B,Pilihan C,Pilihan D,Pilihan E,Kunci Jawaban
1,"Apa tugas dan wewenang utama dari Dewan Perwakilan Daerah (DPD) RI menurut UUD 1945?","Mengajukan RUU terkait otonomi daerah dan hubungan pusat dengan daerah","Menetapkan Anggaran Pendapatan dan Belanja Negara (APBN) secara mandiri","Mengangkat dan memberhentikan para menteri kabinet pemerintahan","Memeriksa pertanggungjawaban pengelolaan keuangan negara","Mengadili perkara perselisihan sengketa hasil pemilihan umum","A"
2,"Berapa jumlah anggota DPD RI dari setiap provinsi berdasarkan ketentuan konstitusi?","2 orang","3 orang","4 orang","5 orang","6 orang","C"
3,"Kapan Dewan Perwakilan Daerah (DPD) RI resmi dibentuk dalam sistem ketatanegaraan Indonesia?","17 Agustus 1945","1 Oktober 2004","21 Mei 1998","5 Juli 1959","10 November 2001","B"
4,"Manakah yang BUKAN merupakan wewenang DPD RI terkait fungsi pengawasan?","Pengawasan pelaksanaan undang-undang mengenai otonomi daerah","Pengawasan pembentukan dan pemekaran daerah","Pengawasan pelaksanaan anggaran pendapatan dan belanja negara","Pengawasan pelaksanaan pengelolaan sumber daya alam","Mengubah dan menetapkan Undang-Undang Dasar secara mandiri","E"
5,"Sidang paripurna DPD RI diselenggarakan sekurang-kurangnya berapa kali dalam kurun satu tahun?","1 kali","2 kali","3 kali","4 kali","Sesuai kesepakatan seluruh anggota fraksi","A"`;

        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "Template_Import_Kuis_LMSetjenDPDRI.csv";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        Toast().fire({
            icon: "success",
            title: "Template kuis berhasil diunduh (Format CSV/Excel)"
        });
    };

    const handleExportQuizQuestions = async (targetQuiz) => {
        if (!targetQuiz) return;
        try {
            let questionsToExport = [];
            if (currentQuiz?.quiz_id === targetQuiz.quiz_id && questions.length > 0) {
                questionsToExport = questions;
            } else {
                const res = await apiInstance.get(`quiz/question/list-create/?quiz_id=${targetQuiz.quiz_id}`);
                questionsToExport = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            }

            if (questionsToExport.length === 0) {
                Toast().fire({
                    icon: "warning",
                    title: "Kuis ini belum memiliki soal untuk diexport"
                });
                return;
            }

            const rows = [
                ["No", "Pertanyaan", "Pilihan A", "Pilihan B", "Pilihan C", "Pilihan D", "Pilihan E", "Kunci Jawaban"]
            ];

            questionsToExport.forEach((q, idx) => {
                const choices = q.choices || [];
                const choiceA = choices[0]?.choice_text || "";
                const choiceB = choices[1]?.choice_text || "";
                const choiceC = choices[2]?.choice_text || "";
                const choiceD = choices[3]?.choice_text || "";
                const choiceE = choices[4]?.choice_text || "";

                let keyLetter = "A";
                const correctIndex = choices.findIndex(c => c.is_correct);
                if (correctIndex !== -1) {
                    keyLetter = String.fromCharCode(65 + correctIndex);
                }

                rows.push([
                    idx + 1,
                    `"${(q.question_text || "").replace(/"/g, '""')}"`,
                    `"${choiceA.replace(/"/g, '""')}"`,
                    `"${choiceB.replace(/"/g, '""')}"`,
                    `"${choiceC.replace(/"/g, '""')}"`,
                    `"${choiceD.replace(/"/g, '""')}"`,
                    choiceE ? `"${choiceE.replace(/"/g, '""')}"` : '""',
                    `"${keyLetter}"`
                ]);
            });

            const csvContent = rows.map(r => r.join(",")).join("\r\n");
            const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            const cleanTitle = (targetQuiz.title || "Kuis").replace(/[^a-zA-Z0-9_-]/g, "_");
            link.href = url;
            link.download = `Export_Soal_${cleanTitle}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            Toast().fire({
                icon: "success",
                title: `Berhasil mengexport ${questionsToExport.length} soal kuis!`
            });
        } catch (err) {
            console.error("Export error:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal mengexport soal kuis"
            });
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        processSelectedFile(file);
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
        if (!isDragOver) {
            setIsDragOver(true);
        }
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget && !e.currentTarget.contains(e.relatedTarget)) {
            setIsDragOver(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const droppedFiles = e.dataTransfer?.files;
        if (droppedFiles && droppedFiles.length > 0) {
            processSelectedFile(droppedFiles[0]);
        } else if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
            const item = e.dataTransfer.items[0];
            if (item.kind === "file") {
                const file = item.getAsFile();
                if (file) {
                    processSelectedFile(file);
                }
            }
        }
    };

    const processSelectedFile = (file) => {
        if (!file) return;
        setImportFile(file);
        setImportError("");
        setParsedQuestions([]);

        if (file.size > 5 * 1024 * 1024) {
            setImportError("Ukuran file melebihi batas maksimal 5MB.");
            return;
        }

        const fileName = (file.name || "").toLowerCase();
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target.result;
                if (fileName.endsWith(".json")) {
                    parseJSONContent(content);
                } else {
                    parseCSVContent(content);
                }
            } catch (err) {
                console.error("Error reading file:", err);
                setImportError("Gagal membaca file: " + err.message);
            }
        };
        reader.onerror = () => {
            setImportError("Gagal membaca file dari sistem lokal Anda.");
        };
        reader.readAsText(file, "UTF-8");
    };

    const parseCSVContent = (content) => {
        const rows = parseCSV(content);
        if (!rows || rows.length < 2) {
            setImportError("File CSV kosong atau tidak memiliki baris data soal.");
            return;
        }

        const headers = rows[0].map(h => (h || "").toLowerCase().trim());
        let questionIdx = -1;
        let choiceAIdx = -1;
        let choiceBIdx = -1;
        let choiceCIdx = -1;
        let choiceDIdx = -1;
        let choiceEIdx = -1;
        let keyIdx = -1;

        headers.forEach((h, idx) => {
            if (h.includes("pertanyaan") || h.includes("soal") || h.includes("question") || h.includes("tanya")) {
                questionIdx = idx;
            } else if (h.includes("kunci") || h.includes("jawaban benar") || h.includes("key") || h.includes("correct") || h.includes("answer")) {
                keyIdx = idx;
            } else if (h.includes("pilihan a") || h.includes("opsi a") || h.includes("option a") || h === "a") {
                choiceAIdx = idx;
            } else if (h.includes("pilihan b") || h.includes("opsi b") || h.includes("option b") || h === "b") {
                choiceBIdx = idx;
            } else if (h.includes("pilihan c") || h.includes("opsi c") || h.includes("option c") || h === "c") {
                choiceCIdx = idx;
            } else if (h.includes("pilihan d") || h.includes("opsi d") || h.includes("option d") || h === "d") {
                choiceDIdx = idx;
            } else if (h.includes("pilihan e") || h.includes("opsi e") || h.includes("option e") || h === "e") {
                choiceEIdx = idx;
            }
        });

        // Fallback column indexing
        if (questionIdx === -1) {
            if (rows[0].length >= 8) {
                questionIdx = 1; choiceAIdx = 2; choiceBIdx = 3; choiceCIdx = 4; choiceDIdx = 5; choiceEIdx = 6; keyIdx = 7;
            } else if (rows[0].length === 7) {
                questionIdx = 1; choiceAIdx = 2; choiceBIdx = 3; choiceCIdx = 4; choiceDIdx = 5; keyIdx = 6;
            } else if (rows[0].length >= 6) {
                questionIdx = 0; choiceAIdx = 1; choiceBIdx = 2; choiceCIdx = 3; choiceDIdx = 4; keyIdx = 5;
            } else {
                setImportError("Format kolom CSV tidak dikenali. Pastikan terdapat kolom Pertanyaan, Pilihan A-D/E, dan Kunci Jawaban.");
                return;
            }
        }

        if (keyIdx === -1 && rows[0].length > 0) {
            keyIdx = rows[0].length - 1;
        }

        const dataRows = rows.slice(1);
        const parsed = [];

        dataRows.forEach((row, rowIdx) => {
            if (!row || row.length === 0 || row.every(cell => !cell.trim())) return;

            const qText = (row[questionIdx] || "").trim();
            const rawKey = (row[keyIdx] || "").trim().toUpperCase();

            let keyLetter = "";
            if (rawKey.includes("A") || rawKey === "1") keyLetter = "A";
            else if (rawKey.includes("B") || rawKey === "2") keyLetter = "B";
            else if (rawKey.includes("C") || rawKey === "3") keyLetter = "C";
            else if (rawKey.includes("D") || rawKey === "4") keyLetter = "D";
            else if (rawKey.includes("E") || rawKey === "5") keyLetter = "E";

            const rawChoices = [
                { letter: "A", text: (row[choiceAIdx] || "").trim() },
                { letter: "B", text: (row[choiceBIdx] || "").trim() },
                { letter: "C", text: (row[choiceCIdx] || "").trim() },
                { letter: "D", text: (row[choiceDIdx] || "").trim() },
                ...(choiceEIdx !== -1 && row[choiceEIdx] ? [{ letter: "E", text: (row[choiceEIdx] || "").trim() }] : [])
            ];

            const validChoices = rawChoices
                .filter(c => c.text !== "")
                .map(c => ({
                    choice_text: c.text,
                    letter: c.letter,
                    is_correct: c.letter === keyLetter
                }));

            let isValid = true;
            let errorMsg = "";

            if (!qText) {
                isValid = false;
                errorMsg = "Teks pertanyaan kosong";
            } else if (validChoices.length < 2) {
                isValid = false;
                errorMsg = "Pilihan jawaban kurang dari 2";
            } else if (!validChoices.some(c => c.is_correct)) {
                isValid = false;
                errorMsg = `Kunci jawaban '${rawKey || "-"}' tidak cocok dengan pilihan jawaban`;
            }

            parsed.push({
                rowNumber: rowIdx + 1,
                question_text: qText,
                choices: validChoices,
                rawKey: rawKey || "-",
                isValid,
                errorMsg
            });
        });

        if (parsed.length === 0) {
            setImportError("Tidak ada baris pertanyaan yang valid di dalam file CSV.");
        } else {
            setParsedQuestions(parsed);
        }
    };

    const parseJSONContent = (content) => {
        let data;
        try {
            data = JSON.parse(content);
        } catch {
            setImportError("File JSON tidak valid atau struktur sintaks salah.");
            return;
        }

        const items = Array.isArray(data) ? data : (data.questions || []);
        if (!items || items.length === 0) {
            setImportError("Tidak ada daftar soal di dalam file JSON.");
            return;
        }

        const parsed = items.map((item, idx) => {
            const qText = (item.question_text || item.pertanyaan || item.question || "").trim();
            let choices = [];

            if (Array.isArray(item.choices)) {
                choices = item.choices.map((c, cIdx) => ({
                    choice_text: (c.choice_text || c.text || "").trim(),
                    letter: String.fromCharCode(65 + cIdx),
                    is_correct: Boolean(c.is_correct)
                }));
            } else {
                const rawKey = (item.kunci || item.correct_answer || item.answer || item.key || "").trim().toUpperCase();
                ["A", "B", "C", "D", "E"].forEach((letter) => {
                    const text = (item[`pilihan_${letter.toLowerCase()}`] || item[`opsi_${letter.toLowerCase()}`] || item[`choice_${letter.toLowerCase()}`] || item[letter] || item[letter.toLowerCase()] || "").trim();
                    if (text) {
                        choices.push({
                            choice_text: text,
                            letter,
                            is_correct: rawKey.includes(letter)
                        });
                    }
                });
            }

            const validChoices = choices.filter(c => c.choice_text);
            let isValid = true;
            let errorMsg = "";

            if (!qText) {
                isValid = false;
                errorMsg = "Teks pertanyaan kosong";
            } else if (validChoices.length < 2) {
                isValid = false;
                errorMsg = "Pilihan jawaban kurang dari 2";
            } else if (!validChoices.some(c => c.is_correct)) {
                isValid = false;
                errorMsg = "Belum ada pilihan yang ditandai sebagai kunci jawaban";
            }

            return {
                rowNumber: idx + 1,
                question_text: qText,
                choices: validChoices,
                rawKey: validChoices.find(c => c.is_correct)?.letter || "-",
                isValid,
                errorMsg
            };
        });

        setParsedQuestions(parsed);
    };

    const handleExecuteImport = async () => {
        const validQuestions = parsedQuestions.filter(q => q.isValid);
        if (validQuestions.length === 0) {
            Toast().fire({
                icon: "error",
                title: "Tidak ada soal valid untuk diimpor"
            });
            return;
        }

        try {
            setIsImporting(true);
            setImportProgress({ current: 0, total: validQuestions.length, percent: 0 });

            let targetQuizId = importTargetQuizId;

            // If target is "new", create quiz first
            if (targetQuizId === "new") {
                const quizTitle = importNewQuizTitle.trim() || `Kuis Hasil Import (${new Date().toLocaleDateString("id-ID")})`;
                const newQuizData = {
                    title: quizTitle,
                    description: `Kuis diimpor dari file ${importFile?.name || "eksternal"}`,
                    quiz_type: importNewQuizType,
                    presentation_mode: "ordered",
                    is_active: true,
                    course_id: course_id
                };
                const quizRes = await apiInstance.post("quiz/list-create/", newQuizData);
                targetQuizId = quizRes.data.quiz_id;
            }

            // Create each valid question & choices
            for (let i = 0; i < validQuestions.length; i++) {
                const q = validQuestions[i];

                // 1. Create question
                const qRes = await apiInstance.post("quiz/question/list-create/", {
                    question_text: q.question_text,
                    quiz_id: targetQuizId
                });
                const createdQuestion = qRes.data;

                // 2. Create choices
                for (let cIdx = 0; cIdx < q.choices.length; cIdx++) {
                    const choice = q.choices[cIdx];
                    await apiInstance.post("quiz/choice/list-create/", {
                        question_id: createdQuestion.question_id,
                        choice_text: choice.choice_text,
                        is_correct: choice.is_correct,
                        order: cIdx + 1
                    });
                }

                // Update progress
                const current = i + 1;
                const percent = Math.round((current / validQuestions.length) * 100);
                setImportProgress({ current, total: validQuestions.length, percent });
            }

            Toast().fire({
                icon: "success",
                title: `Berhasil mengimpor ${validQuestions.length} soal kuis!`
            });

            // Refresh data
            await fetchQuizzes();
            await fetchCourseData();
            if (targetQuizId) {
                await fetchQuestions(targetQuizId);
                const updatedQuiz = quizzes.find(q => q.quiz_id === targetQuizId);
                if (updatedQuiz) setCurrentQuiz(updatedQuiz);
            }

            setShowImportModal(false);
            resetImportState();
        } catch (err) {
            console.error("Import execution failed:", err);
            Toast().fire({
                icon: "error",
                title: "Terjadi kesalahan saat mengimpor soal: " + (err.response?.data?.message || err.message)
            });
        } finally {
            setIsImporting(false);
        }
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

                            {/* Sleek Compact Quiz Header Card */}
                            <div className="quiz-header-card mb-3">
                                <div className="d-flex flex-column flex-md-row md-align-items-center justify-content-between gap-3">
                                    <div>
                                        <div className="d-flex align-items-center flex-wrap gap-2 mb-1">
                                            <span className="badge bg-teal-subtle text-teal border border-teal-subtle fw-semibold px-2 py-0" style={{ fontSize: "11px" }}>
                                                <i className="fas fa-question-circle me-1"></i> Manajemen Kuis
                                            </span>
                                            <span className="badge bg-light text-muted border px-2 py-0" style={{ fontSize: "11px" }}>
                                                ID: #{param?.course_id}
                                            </span>
                                            <span className={`badge px-2 py-0 ${course?.status === "Published" ? "bg-success text-white" : "bg-secondary text-white"}`} style={{ fontSize: "11px" }}>
                                                {course?.status === "Published" ? "Terbit" : "Draf"}
                                            </span>
                                        </div>
                                        <h4 className="quiz-header-title mb-1 text-dark fw-bold">
                                            {course?.title || "Manajemen Kuis Kursus"}
                                        </h4>
                                        <p className="quiz-header-desc text-muted mb-0 small">
                                            Kelola evaluasi materi, kuis kompetensi, dan instrumen asesmen pembelajaran.
                                        </p>
                                    </div>
                                    <div className="d-flex flex-column align-items-md-end gap-2 flex-shrink-0">
                                        {/* Baris Atas: Tombol Navigasi Kursus */}
                                        <div className="d-flex align-items-center gap-2 flex-wrap justify-content-md-end">
                                            <Link
                                                to={`/instructor/edit-course/${param?.course_id}/`}
                                                className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2"
                                                title="Kembali ke Pengaturan Dasar Kursus"
                                            >
                                                <i className="fas fa-arrow-left"></i>
                                                <span>Detail Kursus</span>
                                            </Link>
                                            <Link
                                                to={`/instructor/edit-course/${param?.course_id}/curriculum/`}
                                                className="btn btn-outline-teal btn-sm d-inline-flex align-items-center gap-2"
                                                title="Kelola Kurikulum Kursus"
                                            >
                                                <i className="fas fa-list"></i>
                                                <span>Kurikulum</span>
                                            </Link>
                                            <Link
                                                to={`/instructor/edit-course/${param?.course_id}/gamification/`}
                                                className="btn btn-outline-teal btn-sm d-inline-flex align-items-center gap-2"
                                                title="Kelola Gamifikasi Kursus"
                                            >
                                                <i className="fas fa-gamepad"></i>
                                                <span>Gamifikasi</span>
                                            </Link>
                                            <Link
                                                to={`/instructor/preview-course/${param?.course_id}/`}
                                                target="_blank"
                                                className="btn btn-outline-teal btn-sm d-inline-flex align-items-center gap-2"
                                                title="Pratinjau Kursus"
                                            >
                                                <i className="fas fa-eye"></i>
                                                <span>Pratinjau</span>
                                            </Link>
                                        </div>

                                        {/* Baris Bawah: Action Buttons Kuis (Stick di Kanan) */}
                                        <div className="d-flex align-items-center gap-2 flex-wrap justify-content-md-end">
                                            <button
                                                type="button"
                                                className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
                                                onClick={handleExportTemplate}
                                                title="Unduh format template CSV untuk pengisian kuis & soal"
                                            >
                                                <i className="fas fa-download"></i>
                                                <span>Template CSV</span>
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-outline-teal btn-sm d-inline-flex align-items-center gap-1"
                                                onClick={() => handleOpenImportModal()}
                                                title="Import Soal Kuis dari File CSV atau JSON"
                                            >
                                                <i className="fas fa-file-import"></i>
                                                <span>Import Kuis</span>
                                            </button>
                                            {activeTab === "overview" ? (
                                                <button
                                                    type="button"
                                                    className="btn btn-update-course btn-sm d-inline-flex align-items-center gap-2"
                                                    onClick={() => setShowQuizModal(true)}
                                                >
                                                    <i className="fas fa-plus"></i>
                                                    <span>Tambah Kuis Baru</span>
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="btn btn-update-course btn-sm d-inline-flex align-items-center gap-2"
                                                    onClick={handleOpenAddQuestion}
                                                >
                                                    <i className="fas fa-plus"></i>
                                                    <span>Tambah Soal</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Integrated KPI Strip */}
                                <div className="quiz-kpi-strip">
                                    <div className="quiz-kpi-pill">
                                        <div className="quiz-kpi-icon kpi-quizzes">
                                            <i className="fas fa-clipboard-list"></i>
                                        </div>
                                        <div>
                                            <div className="quiz-kpi-val">{quizzes.length}</div>
                                            <div className="quiz-kpi-lbl">Total Kuis</div>
                                        </div>
                                    </div>
                                    <div className="quiz-kpi-pill">
                                        <div className="quiz-kpi-icon kpi-questions">
                                            <i className="fas fa-question"></i>
                                        </div>
                                        <div>
                                            <div className="quiz-kpi-val">
                                                {quizzes.reduce((total, quiz) => total + (quiz.total_questions || 0), 0)}
                                            </div>
                                            <div className="quiz-kpi-lbl">Total Soal</div>
                                        </div>
                                    </div>
                                    <div className="quiz-kpi-pill">
                                        <div className="quiz-kpi-icon kpi-active">
                                            <i className="fas fa-check-circle"></i>
                                        </div>
                                        <div>
                                            <div className="quiz-kpi-val">
                                                {quizzes.filter(quiz => quiz.is_active).length}
                                            </div>
                                            <div className="quiz-kpi-lbl">Kuis Aktif</div>
                                        </div>
                                    </div>
                                    <div className="quiz-kpi-pill">
                                        <div className="quiz-kpi-icon kpi-inactive">
                                            <i className="fas fa-pause-circle"></i>
                                        </div>
                                        <div>
                                            <div className="quiz-kpi-val">
                                                {quizzes.filter(quiz => !quiz.is_active).length}
                                            </div>
                                            <div className="quiz-kpi-lbl">Tidak Aktif</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Unified Navigation & Filter Toolbar */}
                            <div className="quiz-toolbar-card mb-3">
                                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                                    {/* Navigation Tabs */}
                                    <div className="quiz-segmented-tabs">
                                        <button
                                            type="button"
                                            className={`segmented-tab-btn ${activeTab === "overview" ? "active" : ""}`}
                                            onClick={() => setActiveTab("overview")}
                                        >
                                            <i className="fas fa-th-large me-2"></i>
                                            Ringkasan Kuis ({quizzes.length})
                                        </button>
                                        <button
                                            type="button"
                                            className={`segmented-tab-btn ${activeTab === "questions" ? "active" : ""}`}
                                            onClick={() => setActiveTab("questions")}
                                            disabled={!currentQuiz}
                                            title={!currentQuiz ? "Pilih salah satu kuis terlebih dahulu untuk mengelola soal" : currentQuiz.title}
                                        >
                                            <i className="fas fa-list-ol me-2"></i>
                                            {currentQuiz ? `Soal: ${currentQuiz.title}` : "Kelola Pertanyaan"}
                                        </button>
                                    </div>

                                    {/* Toolbar Controls Right */}
                                    {activeTab === "overview" ? (
                                        <div className="d-flex align-items-center gap-2 flex-wrap">
                                            <span className="text-muted small fw-medium d-none d-sm-inline">
                                                <i className="fas fa-filter me-1"></i>Filter:
                                            </span>
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
                                                    Pre/Post-test ({quizzes.filter(q => q.quiz_type === "pre_post_test").length})
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="d-flex align-items-center gap-2 flex-wrap">
                                            <button
                                                type="button"
                                                className="btn btn-light btn-sm border text-secondary d-inline-flex align-items-center gap-1"
                                                onClick={() => setActiveTab("overview")}
                                            >
                                                <i className="fas fa-arrow-left"></i>
                                                <span>Kembali ke Daftar Kuis</span>
                                            </button>
                                            {questions.length > 0 && (
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
                                                    onClick={() => handleExportQuizQuestions(currentQuiz)}
                                                    title="Export seluruh soal kuis ini ke file CSV"
                                                >
                                                    <i className="fas fa-file-export text-teal"></i>
                                                    <span>Export Soal</span>
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                className="btn btn-outline-teal btn-sm d-inline-flex align-items-center gap-1"
                                                onClick={() => handleOpenImportModal(currentQuiz?.quiz_id)}
                                                title="Import soal langsung ke kuis ini"
                                            >
                                                <i className="fas fa-file-import"></i>
                                                <span>Import Soal</span>
                                            </button>
                                            <span className="badge bg-light text-dark border px-2 py-1 fw-semibold small">
                                                <i className="fas fa-question-circle text-teal me-1"></i>
                                                {questions.length} Soal
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Content Based on Active Tab */}
                            {activeTab === "overview" && (
                                <div className="quiz-overview-wrapper">
                                    {/* Quizzes List */}
                                    <div className="quizzes-grid">
                                        {quizzes.length === 0 ? (
                                            <div className="quiz-empty-card text-center py-5">
                                                <div className="empty-state">
                                                    <i className="fas fa-question-circle empty-icon"></i>
                                                    <h4>Belum Ada Kuis</h4>
                                                    <p className="text-muted">Buat kuis pertama Anda atau import langsung dari file soal</p>
                                                    <div className="d-flex justify-content-center gap-2 flex-wrap mt-3">
                                                        <button
                                                            className="btn btn-update-course"
                                                            onClick={() => setShowQuizModal(true)}
                                                        >
                                                            <i className="fas fa-plus me-2"></i>
                                                            Buat Kuis Baru
                                                        </button>
                                                        <button
                                                            className="btn btn-outline-teal btn-sm"
                                                            onClick={() => handleOpenImportModal()}
                                                        >
                                                            <i className="fas fa-file-import me-1"></i>
                                                            Import Kuis
                                                        </button>
                                                        <button
                                                            className="btn btn-outline-secondary btn-sm"
                                                            onClick={handleExportTemplate}
                                                        >
                                                            <i className="fas fa-download me-1"></i>
                                                            Unduh Template CSV
                                                        </button>
                                                    </div>
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
                                                            <div className="quiz-status">
                                                                <span className={`status-badge ${quiz.is_active ? "active" : "inactive"}`}>
                                                                    <i className={`fas ${quiz.is_active ? "fa-check-circle" : "fa-pause-circle"}`}></i>
                                                                    {quiz.is_active ? "Aktif" : "Tidak Aktif"}
                                                                </span>
                                                            </div>
                                                            <div className="quiz-actions mb-0 pb-0">
                                                                <button
                                                                    className="btn-icon"
                                                                    onClick={() => handleEditQuiz(quiz)}
                                                                    title="Edit Kuis"
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
                                                        </div>
                                                        <div className="quiz-card-body mb-0">
                                                            <div className="quiz-badges-row mb-2 d-flex align-items-center gap-1 flex-wrap">
                                                                <span className={`badge-quiz-type ${quiz.quiz_type === "pre_post_test" ? "type-prepost" : "type-quiz"}`}>
                                                                    <i className={`fas ${quiz.quiz_type === "pre_post_test" ? "fa-graduation-cap" : "fa-clipboard-check"} me-1`}></i>
                                                                    {quiz.quiz_type === "pre_post_test" ? "Pre & Post-test" : "Kuis"}
                                                                </span>
                                                                <span className={`badge-quiz-mode ${quiz.scoring_mode === "weighted" ? "mode-weighted" : "mode-ordered"}`} title="Mode penilaian kuis">
                                                                    <i className={`fas ${quiz.scoring_mode === "weighted" ? "fa-balance-scale" : "fa-check-double"} me-1`}></i>
                                                                    {quiz.scoring_mode === "weighted" ? "Bobot Poin" : "Standar"}
                                                                </span>
                                                                <span className="badge-quiz-score" title="Nilai minimum kelulusan">
                                                                    <i className="fas fa-award me-1"></i>Min {quiz.passing_score !== undefined ? quiz.passing_score : 70}%
                                                                </span>
                                                                <span className="badge-quiz-timer" title="Batas durasi waktu">
                                                                    <i className="fas fa-stopwatch me-1"></i>{quiz.duration_minutes ? `${quiz.duration_minutes} mnt` : "Tanpa Batas"}
                                                                </span>
                                                                <span
                                                                    className={`badge-quiz-mode ${quiz.presentation_mode === "random" ? "mode-random" : "mode-ordered"}`}
                                                                    title={quiz.presentation_mode === "random" ? "Pertanyaan disajikan secara acak untuk setiap peserta" : "Pertanyaan disajikan sesuai urutan"}
                                                                >
                                                                    <i className={`fas ${quiz.presentation_mode === "random" ? "fa-random" : "fa-sort-numeric-down"} me-1`}></i>
                                                                    {quiz.presentation_mode === "random" ? "Acak" : "Sesuai Urutan"}
                                                                </span>
                                                                {quiz.quiz_type === "pre_post_test" && quiz.blueprint_rules && quiz.blueprint_rules.length > 0 && (
                                                                    <span className="badge-quiz-blueprint" title="Distribusi soal acak per modul">
                                                                        <i className="fas fa-random me-1"></i>Blueprint ({quiz.blueprint_rules.length} Modul)
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <h4 className="quiz-title" title={quiz.title}>{quiz.title}</h4>
                                                            {quiz.description && (
                                                                <p className="quiz-description text-secondary" title={quiz.description}>{quiz.description}</p>
                                                            )}
                                                            <div className="quiz-stats d-flex flex-row align-items-center flex-wrap">
                                                                <div className="quiz-stat-pill stat-item d-inline-flex flex-row align-items-center">
                                                                    <i className="fas fa-question me-1" style={{ color: '#0f766e' }}></i>
                                                                    <span className="quiz-stat-text">{quiz.total_questions || 0} Pertanyaan</span>
                                                                </div>
                                                                <div className="quiz-stat-pill stat-item d-inline-flex flex-row align-items-center">
                                                                    <i className="fas fa-calendar text-success me-1"></i>
                                                                    <span className="quiz-stat-text">{new Date(quiz.date).toLocaleDateString()}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="quiz-card-footer d-flex align-items-center gap-1">
                                                            <button
                                                                className="btn btn-primary btn-sm flex-grow-1 d-inline-flex align-items-center justify-content-center gap-1"
                                                                onClick={() => selectQuiz(quiz)}
                                                            >
                                                                <i className="fas fa-cog"></i>
                                                                <span>Kelola Pertanyaan</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn-icon"
                                                                onClick={() => handleExportQuizQuestions(quiz)}
                                                                title="Export Soal Kuis (CSV)"
                                                            >
                                                                <i className="fas fa-file-export text-teal"></i>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn-icon"
                                                                onClick={() => handleOpenImportModal(quiz.quiz_id)}
                                                                title="Import Soal ke Kuis Ini"
                                                            >
                                                                <i className="fas fa-file-import"></i>
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
                                    <div className="quiz-questions-header mb-3">
                                        <div className="d-flex flex-column flex-md-row md-align-items-center justify-content-between gap-3">
                                            <div className="quiz-info">
                                                <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                                                    <h4 className="quiz-title mb-0 fw-bold text-dark">{currentQuiz.title}</h4>
                                                    <span className={`badge-quiz-type ${currentQuiz.quiz_type === "pre_post_test" ? "type-prepost" : "type-quiz"}`}>
                                                        <i className={`fas ${currentQuiz.quiz_type === "pre_post_test" ? "fa-graduation-cap" : "fa-clipboard-check"} me-1`}></i>
                                                        {currentQuiz.quiz_type === "pre_post_test" ? "Pre & Post-test" : "Kuis"}
                                                    </span>
                                                    <span className={`badge-quiz-mode ${currentQuiz.scoring_mode === "weighted" ? "mode-weighted" : "mode-ordered"}`} title="Mode penilaian kuis">
                                                        <i className={`fas ${currentQuiz.scoring_mode === "weighted" ? "fa-balance-scale" : "fa-check-double"} me-1`}></i>
                                                        {currentQuiz.scoring_mode === "weighted" ? "Bobot Poin" : "Standar"}
                                                    </span>
                                                    <span className="badge-quiz-score" title="Nilai minimum kelulusan">
                                                        <i className="fas fa-award me-1"></i>Min {currentQuiz.passing_score !== undefined ? currentQuiz.passing_score : 70}%
                                                    </span>
                                                    <span className="badge-quiz-timer" title="Batas durasi waktu">
                                                        <i className="fas fa-stopwatch me-1"></i>{currentQuiz.duration_minutes ? `${currentQuiz.duration_minutes} mnt` : "Tanpa Batas"}
                                                    </span>
                                                    <span
                                                        className={`badge-quiz-mode ${currentQuiz.presentation_mode === "random" ? "mode-random" : "mode-ordered"}`}
                                                        title={currentQuiz.presentation_mode === "random" ? "Pertanyaan disajikan secara acak untuk setiap peserta" : "Pertanyaan disajikan sesuai urutan"}
                                                    >
                                                        <i className={`fas ${currentQuiz.presentation_mode === "random" ? "fa-random" : "fa-sort-numeric-down"} me-1`}></i>
                                                        {currentQuiz.presentation_mode === "random" ? "Acak" : "Sesuai Urutan"}
                                                    </span>
                                                    {currentQuiz.quiz_type === "pre_post_test" && currentQuiz.blueprint_rules && currentQuiz.blueprint_rules.length > 0 && (
                                                        <span className="badge-quiz-blueprint" title="Distribusi soal acak per modul">
                                                            <i className="fas fa-random me-1"></i>Blueprint ({currentQuiz.blueprint_rules.length} Modul)
                                                        </span>
                                                    )}
                                                    <span className={`status-badge ${currentQuiz.is_active ? "active" : "inactive"}`}>
                                                        <i className={`fas ${currentQuiz.is_active ? "fa-check-circle" : "fa-pause-circle"} me-1`}></i>
                                                        {currentQuiz.is_active ? "Aktif" : "Tidak Aktif"}
                                                    </span>
                                                </div>
                                                <p className="quiz-description text-muted small mb-0">{currentQuiz.description || "Kelola pertanyaan kuis untuk kursus ini"}</p>
                                            </div>
                                            <div className="d-flex align-items-center gap-2 flex-shrink-0">
                                                <span className="badge bg-teal-subtle text-teal border border-teal-subtle px-2 py-1 fw-semibold small">
                                                    <i className="fas fa-list-ol me-1"></i>
                                                    Total {questions.length} Pertanyaan
                                                </span>
                                                {!isAddingQuestion && !editingQuestion && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-update-course btn-sm d-inline-flex align-items-center gap-2"
                                                        onClick={handleOpenAddQuestion}
                                                    >
                                                        <i className="fas fa-plus"></i>
                                                        <span>Tambah Pertanyaan</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Questions List */}
                                    <div className="questions-list">
                                        {questions.length === 0 && !isAddingQuestion ? (
                                            <div className="quiz-empty-card text-center py-5">
                                                <div className="empty-state">
                                                    <i className="fas fa-question empty-icon"></i>
                                                    <h4>Belum Ada Pertanyaan</h4>
                                                    <p className="text-muted">Tambahkan pertanyaan secara manual atau import dari file CSV/JSON</p>
                                                    <div className="d-flex justify-content-center gap-2 flex-wrap mt-3">
                                                        <button
                                                            className="btn btn-update-course"
                                                            onClick={handleOpenAddQuestion}
                                                        >
                                                            <i className="fas fa-plus me-2"></i>
                                                            Tambah Pertanyaan
                                                        </button>
                                                        <button
                                                            className="btn btn-outline-teal btn-sm"
                                                            onClick={() => handleOpenImportModal(currentQuiz?.quiz_id)}
                                                        >
                                                            <i className="fas fa-file-import me-1"></i>
                                                            Import Soal
                                                        </button>
                                                        <button
                                                            className="btn btn-outline-secondary btn-sm"
                                                            onClick={handleExportTemplate}
                                                        >
                                                            <i className="fas fa-download me-1"></i>
                                                            Unduh Template CSV
                                                        </button>
                                                    </div>
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
                                                                currentQuiz={currentQuiz}
                                                                course={course}
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
                                                                            Tuliskan teks pertanyaan, modul asal, dan tentukan jawaban
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
                                                                <div className="row g-2 mb-3">
                                                                    <div className="col-12 col-md-7">
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
                                                                    <div className="col-12 col-md-5">
                                                                        <label className="form-label">
                                                                            <i className="fas fa-layer-group me-1 text-teal"></i>Modul Materi Asal (Opsional)
                                                                        </label>
                                                                        <select
                                                                            className="form-select form-select-sm"
                                                                            value={questionForm.variant_id || ""}
                                                                            onChange={(e) => setQuestionForm({ ...questionForm, variant_id: e.target.value })}
                                                                        >
                                                                            <option value="">-- Tanpa Modul Spesifik --</option>
                                                                            {course?.curriculum?.map((mod, mIdx) => (
                                                                                <option key={mod.variant_id || mod.id || mIdx} value={mod.variant_id || mod.id}>
                                                                                    Modul {mIdx + 1}: {mod.title}
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                        <small className="text-muted d-block mt-1" style={{ fontSize: "0.74rem" }}>
                                                                            Digunakan oleh Pre/Post-Test untuk mengundi soal per modul materi.
                                                                        </small>
                                                                    </div>
                                                                </div>

                                                                <div className="form-group mb-0">
                                                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                                                        <label className="form-label mb-0">Pilihan Jawaban *</label>
                                                                        <span className="form-help mb-0">
                                                                            <i className="fas fa-info-circle me-1"></i>
                                                                            {currentQuiz?.scoring_mode === "weighted"
                                                                                ? "Isi bobot poin tiap pilihan jawaban dan tandai kunci utama"
                                                                                : "Pilih radio untuk menandai kunci jawaban yang benar"}
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
                                                                                {currentQuiz?.scoring_mode === "weighted" && (
                                                                                    <div className="d-flex align-items-center gap-1 ms-2" onClick={(e) => e.stopPropagation()}>
                                                                                        <span className="text-muted fw-semibold" style={{ fontSize: "0.72rem", whiteSpace: "nowrap" }}>Poin:</span>
                                                                                        <input
                                                                                            type="number"
                                                                                            step="0.1"
                                                                                            min="0"
                                                                                            className="form-control form-control-sm text-center"
                                                                                            style={{ width: "72px", fontWeight: "700" }}
                                                                                            value={choice.point_weight !== undefined ? choice.point_weight : 0}
                                                                                            onChange={(e) => handleChoiceChange(cIndex, "point_weight", parseFloat(e.target.value) || 0)}
                                                                                            placeholder="0"
                                                                                            title="Bobot poin jika peserta memilih jawaban ini"
                                                                                        />
                                                                                    </div>
                                                                                )}
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
                                    <div className={`quiz-modal ${quizForm.quiz_type === "pre_post_test" ? "quiz-modal-large" : ""}`}>
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

                                                {/* Mode Penilaian */}
                                                <div className="form-group mb-3">
                                                    <label className="form-label fw-bold">Mode Penilaian *</label>
                                                    <div className="quiz-option-grid">
                                                        <label className={`quiz-option-card ${quizForm.scoring_mode === "standard" ? "selected" : ""}`}>
                                                            <input
                                                                type="radio"
                                                                name="scoring_mode"
                                                                value="standard"
                                                                checked={quizForm.scoring_mode === "standard"}
                                                                onChange={(e) => setQuizForm({ ...quizForm, scoring_mode: e.target.value })}
                                                                className="visually-hidden"
                                                            />
                                                            <div className="option-icon-box ordered">
                                                                <i className="fas fa-check-double"></i>
                                                            </div>
                                                            <div className="option-text-box">
                                                                <div className="option-title">Standar (Jumlah Benar)</div>
                                                                <div className="option-desc">1 jawaban benar per soal, skor berdasarkan persentase jawaban benar</div>
                                                            </div>
                                                            <div className="option-check">
                                                                <i className="fas fa-check-circle"></i>
                                                            </div>
                                                        </label>
                                                        <label className={`quiz-option-card ${quizForm.scoring_mode === "weighted" ? "selected" : ""}`}>
                                                            <input
                                                                type="radio"
                                                                name="scoring_mode"
                                                                value="weighted"
                                                                checked={quizForm.scoring_mode === "weighted"}
                                                                onChange={(e) => setQuizForm({ ...quizForm, scoring_mode: e.target.value })}
                                                                className="visually-hidden"
                                                            />
                                                            <div className="option-icon-box quiz">
                                                                <i className="fas fa-balance-scale"></i>
                                                            </div>
                                                            <div className="option-text-box">
                                                                <div className="option-title">Bobot Poin Tiap Pilihan</div>
                                                                <div className="option-desc">Tiap pilihan jawaban memiliki bobot poin tersendiri untuk diakumulasi</div>
                                                            </div>
                                                            <div className="option-check">
                                                                <i className="fas fa-check-circle"></i>
                                                            </div>
                                                        </label>
                                                    </div>
                                                </div>

                                                {/* Pengaturan Kelulusan & Durasi Waktu */}
                                                <div className="row g-3 mb-3">
                                                    <div className="col-12 col-md-6">
                                                        <label className="form-label fw-bold">
                                                            <i className="fas fa-award text-warning me-1"></i>Skor Minimal Kelulusan (%) *
                                                        </label>
                                                        <div className="input-group">
                                                            <input
                                                                type="number"
                                                                step="0.1"
                                                                min="0"
                                                                max="100"
                                                                className="form-control"
                                                                value={quizForm.passing_score !== undefined ? quizForm.passing_score : 70}
                                                                onChange={(e) => setQuizForm({ ...quizForm, passing_score: parseFloat(e.target.value) || 0 })}
                                                                placeholder="Contoh: 75"
                                                                required
                                                            />
                                                            <span className="input-group-text">%</span>
                                                        </div>
                                                        <small className="text-muted" style={{ fontSize: "0.75rem" }}>
                                                            Nilai KKM untuk lulus kuis ini (mendukung desimal, misal 75).
                                                        </small>
                                                    </div>
                                                    <div className="col-12 col-md-6">
                                                        <label className="form-label fw-bold">
                                                            <i className="fas fa-stopwatch text-teal me-1"></i>Durasi Pengerjaan (Menit) *
                                                        </label>
                                                        <div className="input-group">
                                                            <input
                                                                type="number"
                                                                step="1"
                                                                min="0"
                                                                className="form-control"
                                                                value={quizForm.duration_minutes !== undefined ? quizForm.duration_minutes : 15}
                                                                onChange={(e) => setQuizForm({ ...quizForm, duration_minutes: parseInt(e.target.value) || 0 })}
                                                                placeholder="15"
                                                                required
                                                            />
                                                            <span className="input-group-text">Menit</span>
                                                        </div>
                                                        <small className="text-muted" style={{ fontSize: "0.75rem" }}>
                                                            Batas waktu pengerjaan. Masukkan 0 jika tanpa batas waktu.
                                                        </small>
                                                    </div>
                                                </div>

                                                {/* Blueprint Sebaran Soal Acak per Modul (Khusus Pre/Post-Test) */}
                                                {quizForm.quiz_type === "pre_post_test" && (
                                                    <div className="blueprint-config-box p-3 mb-3 border rounded">
                                                        <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                                                            <div>
                                                                <h6 className="fw-bold mb-0 text-dark">
                                                                    <i className="fas fa-random me-1 text-primary"></i>Blueprint Soal Acak per Modul
                                                                </h6>
                                                                <small className="text-muted" style={{ fontSize: "0.78rem" }}>
                                                                    Tentukan rentang nomor soal yang diambil acak dari masing-masing modul aktif.
                                                                </small>
                                                            </div>
                                                            <div className="d-flex gap-2">
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm btn-outline-teal"
                                                                    onClick={autoGenerateBlueprint}
                                                                    title="Buat aturan otomatis membagi rata ke seluruh modul kurikulum"
                                                                >
                                                                    <i className="fas fa-magic me-1"></i>Auto Blueprint
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm btn-primary"
                                                                    onClick={addBlueprintRule}
                                                                >
                                                                    <i className="fas fa-plus me-1"></i>Tambah Aturan
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {(!quizForm.blueprint_rules || quizForm.blueprint_rules.length === 0) ? (
                                                            <div className="text-center py-3 border border-dashed rounded bg-white">
                                                                <i className="fas fa-layer-group text-muted mb-1" style={{ fontSize: "1rem" }}></i>
                                                                <p className="text-muted mb-2" style={{ fontSize: "0.82rem" }}>
                                                                    Belum ada aturan sebaran modul. Klik <strong>Auto Blueprint</strong> atau <strong>Tambah Aturan</strong> untuk memetakan nomor soal acak per modul (Contoh: Soal 1-2 Modul 1, Soal 3-4 Modul 2, dst).
                                                                </p>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-xs btn-outline-primary"
                                                                    onClick={autoGenerateBlueprint}
                                                                >
                                                                    <i className="fas fa-magic me-1"></i>Generate Otomatis dari Modul Kursus
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="blueprint-rules-list d-flex flex-column gap-2 mt-2">
                                                                {quizForm.blueprint_rules.map((rule, rIdx) => (
                                                                    <div key={rule.rule_id || rIdx} className="blueprint-rule-row card p-2 border shadow-none bg-white">
                                                                        <div className="row g-2 align-items-center">
                                                                            <div className="col-auto">
                                                                                <span className="badge bg-secondary-subtle text-dark px-2 py-1">
                                                                                    Slot #{rIdx + 1}
                                                                                </span>
                                                                            </div>
                                                                            <div className="col-12 col-md-3">
                                                                                <div className="d-flex align-items-center gap-1">
                                                                                    <span className="text-muted" style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}>Soal No.</span>
                                                                                    <input
                                                                                        type="number"
                                                                                        min="1"
                                                                                        className="form-control form-control-sm text-center"
                                                                                        style={{ width: "60px" }}
                                                                                        value={rule.start_num || 1}
                                                                                        onChange={(e) => updateBlueprintRule(rIdx, "start_num", e.target.value)}
                                                                                        title="Nomor awal rentang soal"
                                                                                    />
                                                                                    <span className="text-muted">-</span>
                                                                                    <input
                                                                                        type="number"
                                                                                        min="1"
                                                                                        className="form-control form-control-sm text-center"
                                                                                        style={{ width: "60px" }}
                                                                                        value={rule.end_num || 2}
                                                                                        onChange={(e) => updateBlueprintRule(rIdx, "end_num", e.target.value)}
                                                                                        title="Nomor akhir rentang soal"
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                            <div className="col-12 col-md-5">
                                                                                <select
                                                                                    className="form-select form-select-sm"
                                                                                    value={rule.variant_id || ""}
                                                                                    onChange={(e) => updateBlueprintRule(rIdx, "variant_id", e.target.value)}
                                                                                >
                                                                                    <option value="">-- Pilih Modul Sumber Soal --</option>
                                                                                    {course?.curriculum?.map((mod, mIdx) => (
                                                                                        <option key={mod.variant_id || mod.id || mIdx} value={mod.variant_id || mod.id}>
                                                                                            Modul {mIdx + 1}: {mod.title}
                                                                                        </option>
                                                                                    ))}
                                                                                </select>
                                                                            </div>
                                                                            <div className="col-auto">
                                                                                <span className="badge bg-teal-subtle text-teal border px-2 py-1" style={{ fontSize: "0.75rem" }}>
                                                                                    <i className="fas fa-dice me-1"></i>{rule.question_count || (Math.max(1, (rule.end_num || 1) - (rule.start_num || 1) + 1))} Soal Acak
                                                                                </span>
                                                                            </div>
                                                                            <div className="col-auto ms-auto">
                                                                                <button
                                                                                    type="button"
                                                                                    className="btn btn-xs btn-outline-danger"
                                                                                    onClick={() => removeBlueprintRule(rIdx)}
                                                                                    title="Hapus Aturan Ini"
                                                                                >
                                                                                    <i className="fas fa-trash"></i>
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

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
                                                            Kuis Aktif (terlihat oleh peserta)
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

                            {/* Import Modal */}
                            {showImportModal && (
                                <div className="quiz-modal-overlay">
                                    <div className="quiz-modal quiz-modal-large">
                                        <div className="modal-header">
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="quiz-modal-icon-badge">
                                                    <i className="fas fa-file-import"></i>
                                                </div>
                                                <div>
                                                    <h4 className="quiz-modal-title mb-0">Import Soal Kuis</h4>
                                                    <span className="quiz-modal-subtitle">Unggah file CSV atau JSON untuk menambahkan soal sekaligus</span>
                                                </div>
                                            </div>
                                            <button
                                                className="btn-close"
                                                onClick={() => {
                                                    if (!isImporting) {
                                                        setShowImportModal(false);
                                                        resetImportState();
                                                    }
                                                }}
                                                disabled={isImporting}
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        </div>

                                        <div className="modal-body">
                                            {/* Quick Guide & Download Template Banner */}
                                            <div className="quiz-import-guide-banner mb-3">
                                                <div className="d-flex align-items-center justify-content-between gap-3">
                                                    <div className="d-flex align-items-center gap-2 flex-grow-1">
                                                        <i className="fas fa-lightbulb text-warning fs-5 flex-shrink-0"></i>
                                                        <span className="small text-secondary mb-0">
                                                            Format file: <strong>CSV (.csv)</strong> atau <strong>JSON (.json)</strong>. Kolom: Pertanyaan, Pilihan A-E, Kunci Jawaban.
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-teal d-inline-flex align-items-center gap-1 flex-shrink-0 text-nowrap ms-auto"
                                                        onClick={handleExportTemplate}
                                                        title="Download file contoh CSV yang siap diisi"
                                                    >
                                                        <i className="fas fa-download"></i>
                                                        <span>Unduh Template CSV</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Target Quiz Selection */}
                                            <div className="quiz-import-target-card mb-3 p-3 rounded">
                                                <label className="form-label quiz-compact-label fw-bold mb-1">
                                                    <i className="fas fa-bullseye text-teal me-1"></i> Target Kuis Tujuan:
                                                </label>
                                                <div className="row g-2 align-items-center">
                                                    <div className="col-12 col-md-5">
                                                        <select
                                                            className="form-select form-select-sm quiz-compact-select"
                                                            value={importTargetQuizId}
                                                            onChange={(e) => setImportTargetQuizId(e.target.value)}
                                                            disabled={isImporting}
                                                        >
                                                            <option value="new">+ Buat Kuis Baru dari File</option>
                                                            {quizzes.length > 0 && (
                                                                <optgroup label="Pilih Kuis yang Sudah Ada">
                                                                    {quizzes.map((q) => (
                                                                        <option key={q.quiz_id} value={q.quiz_id}>
                                                                            {q.title} ({q.total_questions || 0} Soal)
                                                                        </option>
                                                                    ))}
                                                                </optgroup>
                                                            )}
                                                        </select>
                                                    </div>
                                                    {importTargetQuizId === "new" && (
                                                        <>
                                                            <div className="col-12 col-md-4">
                                                                <input
                                                                    type="text"
                                                                    className="form-control form-control-sm quiz-compact-input-standalone"
                                                                    placeholder="Judul Kuis Baru..."
                                                                    value={importNewQuizTitle}
                                                                    onChange={(e) => setImportNewQuizTitle(e.target.value)}
                                                                    disabled={isImporting}
                                                                />
                                                            </div>
                                                            <div className="col-12 col-md-3">
                                                                <select
                                                                    className="form-select form-select-sm quiz-compact-select"
                                                                    value={importNewQuizType}
                                                                    onChange={(e) => setImportNewQuizType(e.target.value)}
                                                                    disabled={isImporting}
                                                                >
                                                                    <option value="quiz">Tipe: Kuis Biasa</option>
                                                                    <option value="pre_post_test">Tipe: Pre & Post Test</option>
                                                                </select>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* File Dropzone */}
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                className="d-none"
                                                accept=".csv,.json,text/csv,application/json"
                                                onChange={handleFileChange}
                                            />

                                            {!importFile ? (
                                                <div
                                                    className={`quiz-file-dropzone mb-3 text-center p-4 rounded ${isDragOver ? "drag-over" : ""}`}
                                                    onClick={() => fileInputRef.current?.click()}
                                                    onDragEnter={handleDragEnter}
                                                    onDragOver={handleDragOver}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={handleDrop}
                                                >
                                                    <div className="dropzone-icon mb-2">
                                                        <i className={`fas ${isDragOver ? "fa-file-download text-teal" : "fa-cloud-upload-alt text-teal"} fs-1`}></i>
                                                    </div>
                                                    <h6 className="mb-1 text-dark fw-bold">
                                                        {isDragOver ? "Lepaskan File di Sini" : "Klik atau Seret File ke Sini"}
                                                    </h6>
                                                    <p className="text-muted small mb-0">
                                                        Mendukung file <strong>.CSV</strong> (Excel/Google Sheets) dan <strong>.JSON</strong> (maks 5MB)
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="quiz-file-preview-card mb-3 p-3 rounded d-flex align-items-center justify-content-between">
                                                    <div className="d-flex align-items-center gap-3">
                                                        <div className="file-preview-icon">
                                                            <i className={`fas ${importFile.name.endsWith(".json") ? "fa-file-code text-warning" : "fa-file-csv text-success"} fs-2`}></i>
                                                        </div>
                                                        <div>
                                                            <div className="fw-bold text-dark file-preview-name">{importFile.name}</div>
                                                            <div className="text-muted small file-preview-size">
                                                                {(importFile.size / 1024).toFixed(1)} KB &bull; {parsedQuestions.length} pertanyaan terdeteksi
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {!isImporting && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-danger btn-sm btn-file-remove"
                                                            onClick={() => {
                                                                resetImportState();
                                                                if (fileInputRef.current) fileInputRef.current.value = "";
                                                            }}
                                                            title="Ganti File"
                                                        >
                                                            <i className="fas fa-trash me-1"></i> Ganti File
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {/* Error Alert */}
                                            {importError && (
                                                <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                                                    <i className="fas fa-exclamation-triangle"></i>
                                                    <span>{importError}</span>
                                                </div>
                                            )}

                                            {/* Questions Preview Section */}
                                            {parsedQuestions.length > 0 && (
                                                <div className="quiz-import-preview-section mb-3">
                                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                                        <span className="small fw-bold text-dark">
                                                            <i className="fas fa-eye me-1 text-teal"></i> Pratinjau Soal ({parsedQuestions.filter(q => q.isValid).length} Siap Diimpor
                                                            {parsedQuestions.some(q => !q.isValid) && (
                                                                <span className="text-danger ms-1">
                                                                    &bull; {parsedQuestions.filter(q => !q.isValid).length} bermasalah
                                                                </span>
                                                            )}
                                                            ):
                                                        </span>
                                                    </div>

                                                    <div className="quiz-import-preview-list">
                                                        {parsedQuestions.map((q, idx) => (
                                                            <div
                                                                key={idx}
                                                                className={`quiz-import-preview-item ${q.isValid ? "valid" : "invalid"}`}
                                                            >
                                                                <div className="d-flex align-items-start gap-2">
                                                                    <span className={`import-q-num ${q.isValid ? "badge-valid" : "badge-invalid"}`}>
                                                                        #{q.rowNumber}
                                                                    </span>
                                                                    <div className="flex-grow-1">
                                                                        <p className="mb-1 fw-semibold import-q-text">{q.question_text || <em>(Teks Pertanyaan Kosong)</em>}</p>
                                                                        {q.isValid ? (
                                                                            <div className="import-choices-preview d-flex flex-wrap gap-1 mt-1">
                                                                                {q.choices.map((c, cIdx) => (
                                                                                    <span
                                                                                        key={cIdx}
                                                                                        className={`import-choice-pill ${c.is_correct ? "correct" : ""}`}
                                                                                    >
                                                                                        <strong>{c.letter || String.fromCharCode(65 + cIdx)}.</strong> {c.choice_text}
                                                                                        {c.is_correct && <i className="fas fa-check-circle ms-1 text-success"></i>}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-danger small">
                                                                                <i className="fas fa-exclamation-circle me-1"></i> {q.errorMsg}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Progress Bar (during import) */}
                                            {isImporting && (
                                                <div className="quiz-import-progress-card p-3 rounded mb-2">
                                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                                        <span className="small fw-bold text-teal">
                                                            <i className="fas fa-spinner fa-spin me-1"></i> Sedang mengimpor soal...
                                                        </span>
                                                        <span className="small text-muted">
                                                            {importProgress.current} / {importProgress.total} ({importProgress.percent}%)
                                                        </span>
                                                    </div>
                                                    <div className="progress" style={{ height: "8px" }}>
                                                        <div
                                                            className="progress-bar bg-teal progress-bar-striped progress-bar-animated"
                                                            role="progressbar"
                                                            style={{ width: `${importProgress.percent}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="modal-footer">
                                            <button
                                                type="button"
                                                className="btn btn-secondary"
                                                onClick={() => {
                                                    setShowImportModal(false);
                                                    resetImportState();
                                                }}
                                                disabled={isImporting}
                                            >
                                                Tutup
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-update-course d-inline-flex align-items-center gap-1"
                                                onClick={handleExecuteImport}
                                                disabled={isImporting || parsedQuestions.filter(q => q.isValid).length === 0}
                                            >
                                                {isImporting ? (
                                                    <>
                                                        <span className="spinner-border spinner-border-sm me-1"></span>
                                                        Mengimpor ({importProgress.percent}%)...
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="fas fa-file-import"></i>
                                                        <span>Impor {parsedQuestions.filter(q => q.isValid).length > 0 ? `(${parsedQuestions.filter(q => q.isValid).length} Soal)` : ""}</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
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
