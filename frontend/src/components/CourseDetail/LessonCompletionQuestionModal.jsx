import React, { useState } from 'react';
import useAxios from '../../utils/useAxios';
import Toast from '../../views/plugin/Toast';
import Swal from 'sweetalert2';
import './LessonCompletionQuestionModal.css';

// ✨ PHASE 4.143: Lesson Completion Question Modal
// Displayed when student finishes watching a lesson (100%)
// Student must answer correctly to mark lesson as complete
const LessonCompletionQuestionModal = ({ 
    question, 
    variantItemId,
    onAnswerCorrect,
    onCancel,
    studentId 
}) => {
    const API = useAxios; // ✨ PHASE 4.143: FIX - useAxios is an axios instance, not a hook function
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [selectedMultiAnswers, setSelectedMultiAnswers] = useState([]);
    const [shortAnswer, setShortAnswer] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!question) return null;

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
                Swal.fire({
                    icon: 'success',
                    title: 'Jawaban Benar!',
                    text: 'Selamat! Anda berhasil menjawab pertanyaan. Pelajaran telah ditandai sebagai selesai.',
                    allowOutsideClick: false,
                    confirmButtonClass: 'btn btn-success',
                    confirmButtonText: 'Terima Kasih'
                }).then(() => {
                    if (onAnswerCorrect) {
                        onAnswerCorrect();
                    }
                });
            } else {
                // Answer is incorrect - allow retry
                Swal.fire({
                    icon: 'error',
                    title: 'Jawaban Salah',
                    text: 'Silakan coba lagi. Pikirkan dengan baik sebelum menjawab.',
                    confirmButtonClass: 'btn btn-primary',
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
            <div className="lesson-completion-modal">
                <div className="modal-header bg-primary text-white">
                    <div>
                        <h5 className="mb-1">
                            <i className="fas fa-question-circle me-2"></i>
                            Verifikasi Penyelesaian Pelajaran
                        </h5>
                        <small className="text-white-50">
                            Jawab pertanyaan di bawah untuk menyelesaikan pelajaran ini
                        </small>
                    </div>
                    <button
                        type="button"
                        className="btn-close btn-close-white"
                        onClick={onCancel}
                        disabled={isSubmitting}
                    ></button>
                </div>

                <div className="modal-body">
                    {/* Question */}
                    <div className="question-section mb-4">
                        <h6 className="fw-bold text-dark mb-3">
                            <span className="badge bg-info me-2">Pertanyaan</span>
                        </h6>
                        <p className="lead text-dark">{question.question_text}</p>
                    </div>

                    {/* Multiple Choice */}
                    {question.question_type === 'multiple_choice' && (
                        <div className="choices-section">
                            <h6 className="fw-bold text-dark mb-3">
                                <span className="badge bg-secondary me-2">
                                    Pilih satu jawaban
                                </span>
                            </h6>
                            <div className="choice-options">
                                {question.choices.map((choice, index) => (
                                    <label
                                        key={choice.choice_id}
                                        className={`choice-radio p-3 rounded mb-2 cursor-pointer ${
                                            selectedAnswer === choice.choice_id ? 'selected' : ''
                                        }`}
                                        style={{
                                            backgroundColor: selectedAnswer === choice.choice_id ? '#e7f3ff' : 'white',
                                            border: selectedAnswer === choice.choice_id ? '2px solid #0d6efd' : '1px solid #dee2e6',
                                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                            opacity: isSubmitting ? 0.6 : 1,
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <input
                                            type="radio"
                                            name="multiple-choice"
                                            value={choice.choice_id}
                                            checked={selectedAnswer === choice.choice_id}
                                            onChange={(e) => setSelectedAnswer(e.target.value)}
                                            disabled={isSubmitting}
                                            style={{ marginRight: '0.75rem' }}
                                        />
                                        <span className="choice-text">{choice.choice_text}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Multi-Select */}
                    {question.question_type === 'multi_select' && (
                        <div className="choices-section">
                            <h6 className="fw-bold text-dark mb-3">
                                <span className="badge bg-secondary me-2">
                                    Pilih semua jawaban yang benar
                                </span>
                            </h6>
                            <div className="choice-options">
                                {question.choices.map((choice, index) => (
                                    <label
                                        key={choice.choice_id}
                                        className={`choice-checkbox p-3 rounded mb-2 cursor-pointer ${
                                            selectedMultiAnswers.includes(choice.choice_id) ? 'selected' : ''
                                        }`}
                                        style={{
                                            backgroundColor: selectedMultiAnswers.includes(choice.choice_id) ? '#f0f8f4' : 'white',
                                            border: selectedMultiAnswers.includes(choice.choice_id) ? '2px solid #28a745' : '1px solid #dee2e6',
                                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                            opacity: isSubmitting ? 0.6 : 1,
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedMultiAnswers.includes(choice.choice_id)}
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
                                            style={{ marginRight: '0.75rem' }}
                                        />
                                        <span className="choice-text">{choice.choice_text}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Short Answer / Fill in Blank */}
                    {['short_answer', 'fill_in_blank'].includes(question.question_type) && (
                        <div className="text-answer-section">
                            <h6 className="fw-bold text-dark mb-3">
                                <span className="badge bg-secondary me-2">
                                    Masukkan jawaban
                                </span>
                            </h6>
                            <textarea
                                className="form-control form-control-lg"
                                rows="3"
                                value={shortAnswer}
                                onChange={(e) => setShortAnswer(e.target.value)}
                                placeholder="Ketikkan jawaban Anda di sini..."
                                disabled={isSubmitting}
                                style={{ fontSize: '1rem' }}
                            />
                            {question.question_type === 'fill_in_blank' && (
                                <small className="text-muted d-block mt-2">
                                    <i className="fas fa-info-circle me-1"></i>
                                    Pemeriksaan {question.case_sensitive ? 'sangat' : 'tidak'} memperhatikan huruf besar/kecil
                                </small>
                            )}
                        </div>
                    )}
                </div>

                <div className="modal-footer border-top">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={onCancel}
                        disabled={isSubmitting}
                    >
                        <i className="fas fa-times me-1"></i>
                        Lewati untuk Sekarang
                    </button>
                    <button
                        type="button"
                        className="btn btn-success btn-lg"
                        onClick={handleSubmitAnswer}
                        disabled={!isAnswered() || isSubmitting}
                    >
                        <i className={`fas ${isSubmitting ? 'fa-spinner fa-spin' : 'fa-check'} me-1`}></i>
                        {isSubmitting ? 'Memproses...' : 'Kirim Jawaban'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default React.memo(LessonCompletionQuestionModal);
