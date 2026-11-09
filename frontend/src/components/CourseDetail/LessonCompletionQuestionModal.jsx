import React, { useState } from 'react';
import useAxios from '../../utils/useAxios';
import Toast from '../../views/plugin/Toast';
import Swal from 'sweetalert2';
import './LessonCompletionQuestionModal.css';

// ✨ PHASE 4.143: Lesson Completion Question Modal
// ✨ PHASE 11.158: Bright mode, positioned in video player, no skip button
// ✨ PHASE 11.170: When answer is wrong, unlock video access to let user rewatch
// ✨ PHASE 11.171: Add "Pelajaran Kembali" button to close modal and access video
// Displayed when student finishes watching a lesson (100%)
// Student MUST answer correctly to mark lesson as complete - NO SKIP OPTION
const LessonCompletionQuestionModal = ({ 
    question, 
    variantItemId,
    onAnswerCorrect,
    onAnswerWrong,  // ✨ PHASE 11.170: Callback when answer is wrong - unlocks video blocker
    onCloseModal,    // ✨ PHASE 11.171: Callback to close modal and access video
    studentId 
}) => {
    const API = useAxios; // ✨ PHASE 4.143: FIX - useAxios is an axios instance, not a hook function
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [selectedMultiAnswers, setSelectedMultiAnswers] = useState([]);
    const [shortAnswer, setShortAnswer] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasAnsweredWrong, setHasAnsweredWrong] = useState(false); // ✨ PHASE 11.171: Track if user answered wrong to show back button

    if (!question) return null;

    // ✨ PHASE 11.158: Remove onCancel from accepting as prop - user can only answer or rewatch video
    // Note: onCancel and onSkip are no longer called

    const handleSubmitAnswer = async () => {
        if (!question) return;

        let answer = null;
        let answerChoiceId = null;
        let answerChoiceIds = null;

        // Validate answer based on question type
        if (question.question_type === 'multiple_choice') {
            if (!selectedAnswer) {
                Toast().fire({
                    icon: 'warning',
                    title: 'Pilihan diperlukan',
                    text: 'Silakan pilih salah satu jawaban'
                });
                return;
            }
            answerChoiceId = selectedAnswer;
        } else if (question.question_type === 'multi_select') {
            if (selectedMultiAnswers.length === 0) {
                Toast().fire({
                    icon: 'warning',
                    title: 'Pilihan diperlukan',
                    text: 'Silakan pilih minimal satu jawaban'
                });
                return;
            }
            answerChoiceIds = selectedMultiAnswers;
        } else if (['short_answer', 'fill_in_blank'].includes(question.question_type)) {
            if (!shortAnswer.trim()) {
                Toast().fire({
                    icon: 'warning',
                    title: 'Jawaban diperlukan',
                    text: 'Silakan masukkan jawaban Anda'
                });
                return;
            }
            answer = shortAnswer;
        }

        try {
            setIsSubmitting(true);

            // Submit answer to backend
            const payload = {
                question_id: question.question_id,
                ...(answerChoiceId && { answer_choice_id: answerChoiceId }),
                ...(answerChoiceIds && { answer_choice_ids: answerChoiceIds }),
                ...(answer && { answer: answer })
            };

            const response = await API.post('/lesson-completion-question/answer/', payload);

            if (response.data.is_correct) {
                // Answer is correct - show success and call callback
                // ✨ PHASE 42.1: Fixed SweetAlert2 parameter - use customClass instead of confirmButtonClass
                Swal.fire({
                    icon: 'success',
                    title: 'Jawaban Benar!',
                    text: 'Selamat! Anda berhasil menjawab pertanyaan. Pelajaran telah ditandai sebagai selesai.',
                    allowOutsideClick: false,
                    customClass: {
                        confirmButton: 'btn btn-success'
                    },
                    buttonsStyling: false,
                    confirmButtonText: 'Terima Kasih'
                }).then(() => {
                    // ✨ PHASE 11.202: Dispatch event to trigger course data refresh
                    // This ensures the lesson completion status is updated in the UI
                    window.dispatchEvent(new CustomEvent('lessonAnsweredCorrectly', { 
                        detail: { variantItemId: variantItemId } 
                    }));
                    
                    if (onAnswerCorrect) {
                        onAnswerCorrect();
                    }
                });
            } else {
                // Answer is incorrect - allow retry AND unlock video access
                // ✨ PHASE 11.170: Call onAnswerWrong callback to disable overlay blocker
                // ✨ PHASE 11.171: Mark that user answered wrong so "Pelajaran Kembali" button appears
                setHasAnsweredWrong(true);
                
                if (onAnswerWrong) {
                    onAnswerWrong();
                }
                
                // ✨ PHASE 42.1: Fixed SweetAlert2 parameter - use customClass instead of confirmButtonClass
                Swal.fire({
                    icon: 'error',
                    title: 'Jawaban Salah',
                    text: 'Silakan coba lagi. Anda sekarang dapat mengakses video kembali untuk mempelajari ulang sebelum menjawab.',
                    customClass: {
                        confirmButton: 'btn btn-primary'
                    },
                    buttonsStyling: false,
                    confirmButtonText: 'Coba Lagi'
                });
                
                // Reset form for retry
                setSelectedAnswer(null);
                setSelectedMultiAnswers([]);
                setShortAnswer('');
            }

            setIsSubmitting(false);
        } catch (error) {
            console.error('Error submitting answer:', error);
            Toast().fire({
                icon: 'error',
                title: 'Gagal',
                text: error.response?.data?.error || 'Terjadi kesalahan saat mengirim jawaban'
            });
            setIsSubmitting(false);
        }
    };

    const isAnswered = () => {
        if (question.question_type === 'multiple_choice') return selectedAnswer !== null;
        if (question.question_type === 'multi_select') return selectedMultiAnswers.length > 0;
        if (['short_answer', 'fill_in_blank'].includes(question.question_type)) return shortAnswer.trim() !== '';
        return false;
    };

    return (
        <div className="lesson-completion-modal-overlay">
            <div className="lesson-completion-modal lesson-completion-modal-card">
                {/* Header */}
                <div className="lcm-header">
                    <div className="d-flex align-items-center gap-2">
                        <div className="lcm-header-icon">
                            <i className="fas fa-clipboard-check"></i>
                        </div>
                        <div className="flex-grow-1 min-w-0">
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                <span className="lcm-badge-tag">
                                    <i className="fas fa-shield-alt me-1"></i>Verifikasi Materi
                                </span>
                                <h6 className="lcm-title mb-0">Verifikasi Penyelesaian Pelajaran</h6>
                            </div>
                            <small className="lcm-subtitle">
                                Jawab pertanyaan berikut untuk memverifikasi pemahaman dan menyelesaikan materi ini.
                            </small>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="lcm-body">
                    <div className="lcm-body-container">
                        {/* Question Card */}
                        <div className="lcm-question-box">
                            <div className="lcm-question-label">
                                <i className="fas fa-question-circle text-teal me-1"></i>
                                Pertanyaan
                            </div>
                            <div className="lcm-question-text">
                                {question.question_text}
                            </div>
                        </div>

                        {/* Instruction hint */}
                        <div className="lcm-instruction-bar">
                            <span className="lcm-instruction-text">
                                {question.question_type === 'multiple_choice' && (
                                    <><i className="fas fa-dot-circle me-1 text-teal"></i>Pilih salah satu jawaban yang paling tepat:</>
                                )}
                                {question.question_type === 'multi_select' && (
                                    <><i className="fas fa-check-square me-1 text-teal"></i>Pilih semua jawaban yang benar (dapat lebih dari satu):</>
                                )}
                                {['short_answer', 'fill_in_blank'].includes(question.question_type) && (
                                    <><i className="fas fa-pen me-1 text-teal"></i>Ketikkan jawaban Anda pada kolom di bawah:</>
                                )}
                            </span>
                        </div>

                        {/* Multiple Choice Options */}
                        {question.question_type === 'multiple_choice' && (
                            <div className="lcm-choices-list">
                                {question.choices.map((choice, index) => {
                                    const isSelected = selectedAnswer === choice.choice_id;
                                    const letter = String.fromCharCode(65 + index); // A, B, C, D...
                                    return (
                                        <label
                                            key={choice.choice_id}
                                            className={`lcm-choice-item ${isSelected ? 'selected' : ''}`}
                                        >
                                            <input
                                                type="radio"
                                                name="lcm-multiple-choice"
                                                value={choice.choice_id}
                                                checked={isSelected}
                                                onChange={(e) => setSelectedAnswer(e.target.value)}
                                                disabled={isSubmitting}
                                                className="lcm-hidden-input"
                                            />
                                            <span className="lcm-choice-letter">{letter}</span>
                                            <span className="lcm-choice-content">{choice.choice_text}</span>
                                            <span className="lcm-choice-radio-indicator">
                                                <i className={`fas ${isSelected ? 'fa-check-circle text-teal' : 'fa-circle-notch text-muted opacity-50'}`}></i>
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}

                        {/* Multi-Select Options */}
                        {question.question_type === 'multi_select' && (
                            <div className="lcm-choices-list">
                                {question.choices.map((choice, index) => {
                                    const isSelected = selectedMultiAnswers.includes(choice.choice_id);
                                    const letter = String.fromCharCode(65 + index);
                                    return (
                                        <label
                                            key={choice.choice_id}
                                            className={`lcm-choice-item ${isSelected ? 'selected' : ''}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedMultiAnswers([...selectedMultiAnswers, choice.choice_id]);
                                                    } else {
                                                        setSelectedMultiAnswers(
                                                            selectedMultiAnswers.filter(id => id !== choice.choice_id)
                                                        );
                                                    }
                                                }}
                                                disabled={isSubmitting}
                                                className="lcm-hidden-input"
                                            />
                                            <span className="lcm-choice-letter">{letter}</span>
                                            <span className="lcm-choice-content">{choice.choice_text}</span>
                                            <span className="lcm-choice-radio-indicator">
                                                <i className={`fas ${isSelected ? 'fa-check-square text-teal' : 'fa-square text-muted opacity-50'}`}></i>
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}

                        {/* Short Answer / Fill in Blank */}
                        {['short_answer', 'fill_in_blank'].includes(question.question_type) && (
                            <div className="lcm-text-answer-box">
                                <textarea
                                    className="form-control lcm-textarea"
                                    rows="2"
                                    value={shortAnswer}
                                    onChange={(e) => setShortAnswer(e.target.value)}
                                    placeholder="Ketikkan jawaban Anda di sini..."
                                    disabled={isSubmitting}
                                />
                                {question.question_type === 'fill_in_blank' && (
                                    <small className="text-muted d-block mt-1" style={{ fontSize: '0.72rem' }}>
                                        <i className="fas fa-info-circle me-1 text-teal"></i>
                                        Pemeriksaan {question.case_sensitive ? 'memperhatikan' : 'tidak memperhatikan'} huruf besar/kecil.
                                    </small>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="lcm-footer">
                    <div className="lcm-footer-hint">
                        <i className="fas fa-info-circle text-teal me-1"></i>
                        <span>Wajib dijawab dengan benar untuk menyelesaikan pelajaran</span>
                    </div>

                    <div className="lcm-footer-actions">
                        {/* "Pelajari Kembali" button appears when user answered wrong */}
                        {hasAnsweredWrong && (
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary lcm-btn-secondary"
                                onClick={() => {
                                    if (onCloseModal) {
                                        onCloseModal();
                                    }
                                }}
                                disabled={isSubmitting}
                            >
                                <i className="fas fa-undo me-1"></i>
                                Pelajari Kembali
                            </button>
                        )}
                        <button
                            type="button"
                            className="btn btn-sm lcm-btn-primary"
                            onClick={handleSubmitAnswer}
                            disabled={!isAnswered() || isSubmitting}
                        >
                            <i className={`fas ${isSubmitting ? 'fa-spinner fa-spin' : 'fa-check'} me-1`}></i>
                            {isSubmitting ? 'Memproses...' : 'Kirim Jawaban'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(LessonCompletionQuestionModal);
