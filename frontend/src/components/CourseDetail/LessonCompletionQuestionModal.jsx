import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useAxios from '../../utils/useAxios';
import Toast from '../../views/plugin/Toast';
import Swal from 'sweetalert2';
import './LessonCompletionQuestionModal.css';

// ✨ PHASE 4.143: Lesson Completion Question Modal
// ✨ PHASE 11.158: Bright mode, positioned in video player, no skip button
// ✨ PHASE 11.170: When answer is wrong, unlock video access to let user rewatch
// ✨ PHASE 11.171: Add "Pelajaran Kembali" button to close modal and access video
// ✨ Fullscreen Support: Render seamlessly inside document.fullscreenElement via React Portal
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

    // ✨ Deteksi dan pantau elemen fullscreen aktif (video / audio / pptx / pdf / content container)
    const [fullscreenTarget, setFullscreenTarget] = useState(
        () => document.fullscreenElement || document.webkitFullscreenElement || null
    );

    useEffect(() => {
        const handleFullscreenChange = () => {
            const fsEl = document.fullscreenElement || document.webkitFullscreenElement || null;
            setFullscreenTarget(fsEl);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
        };
    }, []);

    if (!question) return null;

    // ✨ PHASE 11.158: Remove onCancel from accepting as prop - user can only answer or rewatch video
    // Note: onCancel and onSkip are no longer called

    const handleSubmitAnswer = async () => {
        if (!question) return;

        const targetElement = document.fullscreenElement || document.webkitFullscreenElement || document.querySelector('.video-player-container') || 'body';

        let answer = null;
        let answerChoiceId = null;
        let answerChoiceIds = null;

        // Validate answer based on question type
        if (question.question_type === 'multiple_choice') {
            if (!selectedAnswer) {
                Toast().fire({
                    target: targetElement,
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
                    target: targetElement,
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
                    target: targetElement,
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
                // ✨ URUTAN BARU SESUAI PERMINTAAN:
                // Langkah 1: Terlebih dahulu munculkan dialog bahwa jawaban peserta BENAR
                Swal.fire({
                    target: targetElement,
                    icon: 'success',
                    title: 'Jawaban Benar!',
                    text: 'Selamat! Jawaban Anda pada pertanyaan penyelesaian sudah tepat.',
                    allowOutsideClick: false,
                    customClass: {
                        confirmButton: 'btn btn-success px-4 py-2 fw-semibold'
                    },
                    buttonsStyling: false,
                    confirmButtonText: '<i class="fas fa-check me-1"></i> Lanjutkan'
                }).then(() => {
                    // Tutup modal pertanyaan
                    if (onAnswerCorrect) {
                        onAnswerCorrect();
                    }

                    // Langkah 2: Munculkan notifikasi bahwa pembelajaran tersebut selesai
                    Toast().fire({
                        icon: 'success',
                        title: 'Materi Pembelajaran Selesai!',
                        text: 'Progres belajar Anda telah tercatat 100%.',
                        timer: 3000
                    });

                    // Langkah 3: Setelah notifikasi selesai, barulah picu dialog konfirmasi otomatis lanjut ke materi berikutnya
                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('lessonAnsweredCorrectly', { 
                            detail: { variantItemId: variantItemId } 
                        }));
                    }, 1200);
                });
            } else {
                // ✨ Jawaban salah: Berikan feedback belum tepat dan minta peserta mengulang kembali jawaban yang benar
                setHasAnsweredWrong(true);
                
                if (onAnswerWrong) {
                    onAnswerWrong();
                }
                
                // Target fullscreenElement agar popup terlihat dalam mode fullscreen
                Swal.fire({
                    target: targetElement,
                    icon: 'error',
                    title: 'Jawaban Belum Tepat',
                    text: 'Jawaban Anda belum tepat. Silakan beri jawaban yang benar untuk menyelesaikan materi ini, atau Anda dapat meninjau materi kembali.',
                    customClass: {
                        confirmButton: 'btn btn-primary px-4 py-2 fw-semibold'
                    },
                    buttonsStyling: false,
                    confirmButtonText: '<i class="fas fa-redo me-1"></i> Coba Lagi'
                });
                
                // Reset form untuk pengisian ulang
                setSelectedAnswer(null);
                setSelectedMultiAnswers([]);
                setShortAnswer('');
            }

            setIsSubmitting(false);
        } catch (error) {
            console.error('Error submitting answer:', error);
            Toast().fire({
                target: targetElement,
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

    const modalContent = (
        <div className={`lesson-completion-modal-overlay ${fullscreenTarget ? 'is-fullscreen' : ''}`}>
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

    if (fullscreenTarget) {
        return createPortal(modalContent, fullscreenTarget);
    }

    return modalContent;
};

export default React.memo(LessonCompletionQuestionModal);
