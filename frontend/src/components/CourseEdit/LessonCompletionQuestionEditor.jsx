import React, { useState, useEffect } from 'react';
import useAxios from '../../utils/useAxios';
import Toast from '../../views/plugin/Toast';
import './LessonCompletionQuestionEditor.css';

// ✨ PHASE 4.143: Lesson Completion Question Editor
// Allows instructors to create/edit questions for lesson completion verification
const LessonCompletionQuestionEditor = ({ variantItemId, onQuestionSaved }) => {
    const API = useAxios; // ✨ PHASE 4.143: FIX - useAxios is an axios instance, not a hook function
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [existingQuestion, setExistingQuestion] = useState(null);

    // Form states
    const [questionType, setQuestionType] = useState('multiple_choice');
    const [questionText, setQuestionText] = useState('');
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [correctAnswerText, setCorrectAnswerText] = useState('');
    const [choices, setChoices] = useState([
        { choice_text: '', is_correct: false },
        { choice_text: '', is_correct: false }
    ]);

    // Load existing question on mount
    useEffect(() => {
        if (isOpen && variantItemId) {
            loadExistingQuestion();
        }
    }, [isOpen, variantItemId]);

    const loadExistingQuestion = async () => {
        try {
            setIsLoading(true);
            const response = await API.get(`/lesson-completion-question/?variant_item_id=${variantItemId}`);
            if (response.data.results && response.data.results.length > 0) {
                const question = response.data.results[0];
                setExistingQuestion(question);
                setQuestionType(question.question_type);
                setQuestionText(question.question_text);
                setCaseSensitive(question.case_sensitive);
                setCorrectAnswerText(question.correct_answer_text || '');
                if (question.choices && question.choices.length > 0) {
                    setChoices(question.choices);
                }
            }
            setIsLoading(false);
        } catch (error) {
            console.error('Error loading question:', error);
            setIsLoading(false);
        }
    };

    const handleQuestionTypeChange = (newType) => {
        setQuestionType(newType);
        // Reset choices when changing type
        if (newType === 'multiple_choice') {
            setChoices([
                { choice_text: '', is_correct: false },
                { choice_text: '', is_correct: false }
            ]);
        }
        setCorrectAnswerText('');
    };

    const handleChoiceChange = (index, field, value) => {
        const newChoices = [...choices];
        newChoices[index] = { ...newChoices[index], [field]: value };
        
        // Ensure only one correct answer for multiple_choice
        if (field === 'is_correct' && value && questionType === 'multiple_choice') {
            newChoices.forEach((choice, i) => {
                if (i !== index) choice.is_correct = false;
            });
        }
        
        setChoices(newChoices);
    };

    const addChoice = () => {
        setChoices([...choices, { choice_text: '', is_correct: false }]);
    };

    const removeChoice = (index) => {
        if (choices.length > 2) {
            setChoices(choices.filter((_, i) => i !== index));
        }
    };

    const handleSave = async () => {
        // Validation
        if (!questionText.trim()) {
            Toast().fire({
                icon: 'error',
                title: 'Pertanyaan diperlukan',
                text: 'Silakan masukkan teks pertanyaan'
            });
            return;
        }

        if (['multiple_choice', 'multi_select'].includes(questionType)) {
            const filledChoices = choices.filter(c => c.choice_text.trim());
            if (filledChoices.length < 2) {
                Toast().fire({
                    icon: 'error',
                    title: 'Pilihan diperlukan',
                    text: 'Minimal 2 pilihan harus diisi'
                });
                return;
            }
            const hasCorrect = filledChoices.some(c => c.is_correct);
            if (!hasCorrect) {
                Toast().fire({
                    icon: 'error',
                    title: 'Jawaban benar diperlukan',
                    text: 'Tandai minimal satu jawaban sebagai benar'
                });
                return;
            }
        } else {
            if (!correctAnswerText.trim()) {
                Toast().fire({
                    icon: 'error',
                    title: 'Jawaban benar diperlukan',
                    text: 'Silakan masukkan jawaban yang benar'
                });
                return;
            }
        }

        try {
            setIsLoading(true);
            const payload = {
                question_text: questionText,
                question_type: questionType,
                case_sensitive: caseSensitive,
                correct_answer_text: correctAnswerText,
                choices: questionType !== 'multiple_choice' && questionType !== 'multi_select' 
                    ? [] 
                    : choices.filter(c => c.choice_text.trim())
            };

            let response;
            if (existingQuestion) {
                response = await API.patch(
                    `/lesson-completion-question/${existingQuestion.question_id}/`,
                    payload
                );
            } else {
                payload.variant_item_id = variantItemId;
                response = await API.post('/lesson-completion-question/', payload);
            }

            Toast().fire({
                icon: 'success',
                title: 'Berhasil',
                text: existingQuestion ? 'Pertanyaan berhasil diperbarui' : 'Pertanyaan berhasil dibuat'
            });

            if (onQuestionSaved) {
                onQuestionSaved(response.data.question || response.data);
            }

            setIsOpen(false);
            setIsLoading(false);
        } catch (error) {
            console.error('Error saving question:', error);
            Toast().fire({
                icon: 'error',
                title: 'Gagal',
                text: error.response?.data?.error || 'Terjadi kesalahan saat menyimpan pertanyaan'
            });
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!existingQuestion) return;

        if (!window.confirm('Yakin ingin menghapus pertanyaan ini?')) return;

        try {
            setIsLoading(true);
            await API.delete(`/lesson-completion-question/${existingQuestion.question_id}/`);
            
            Toast().fire({
                icon: 'success',
                title: 'Berhasil',
                text: 'Pertanyaan berhasil dihapus'
            });

            setExistingQuestion(null);
            setIsOpen(false);
            if (onQuestionSaved) {
                onQuestionSaved(null);
            }
            setIsLoading(false);
        } catch (error) {
            console.error('Error deleting question:', error);
            setIsLoading(false);
        }
    };

    return (
        <div className="lesson-completion-question-editor">
            <div className="d-flex justify-content-between align-items-center mb-3 mt-3">
                <div>
                    <h5 className="mb-2">
                        <i className="fas fa-question-circle me-2 text-primary"></i>
                        Pertanyaan Penyelesaian Pelajaran
                    </h5>
                    <small className="text-muted">
                        Siswa harus menjawab pertanyaan dengan benar sebelum pelajaran ditandai sebagai selesai
                    </small>
                </div>
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setIsOpen(!isOpen)}
                    disabled={isLoading}
                >
                    <i className={`fas fa-${isOpen ? 'chevron-up' : 'chevron-down'} me-2`}></i>
                    {existingQuestion ? 'Edit Pertanyaan' : 'Tambah Pertanyaan'}
                </button>
            </div>

            {isOpen && (
                <div className="question-editor-form p-4 bg-light rounded border-start border-primary">
                    {/* Question Text */}
                    <div className="mb-3">
                        <label className="form-label fw-bold">
                            <i className="fas fa-pen-fancy me-2"></i>
                            Teks Pertanyaan
                        </label>
                        <textarea
                            className="form-control"
                            rows="3"
                            value={questionText}
                            onChange={(e) => setQuestionText(e.target.value)}
                            placeholder="Masukkan pertanyaan untuk siswa..."
                            disabled={isLoading}
                        />
                    </div>

                    {/* Question Type Selection */}
                    <div className="mb-3">
                        <label className="form-label fw-bold">Tipe Pertanyaan</label>
                        <div className="btn-group w-100" role="group">
                            {[
                                { value: 'multiple_choice', label: 'Pilihan Ganda', icon: 'circle' },
                                { value: 'multi_select', label: 'Multi-Pilih', icon: 'check-square' },
                                { value: 'short_answer', label: 'Jawaban Singkat', icon: 'text-width' },
                                { value: 'fill_in_blank', label: 'Isi Kosong', icon: 'edit' }
                            ].map(type => (
                                <button
                                    key={type.value}
                                    type="button"
                                    className={`btn btn-secondary btn-sm`}
                                    style={{
                                        backgroundColor: questionType === type.value ? '#0f766e' : '#86c7da',
                                        color: questionType === type.value ? 'white' : 'inherit',
                                        flex: 1
                                    }}
                                    onClick={() => handleQuestionTypeChange(type.value)}
                                    disabled={isLoading}
                                >
                                    <i className={`fas fa-${type.icon} me-1`}></i>
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Multiple Choice / Multi-Select Options */}
                    {['multiple_choice', 'multi_select'].includes(questionType) && (
                        <div className="mb-3">
                            <label className="form-label fw-bold">
                                <i className="fas fa-th-list me-2"></i>
                                Pilihan Jawaban
                            </label>
                            <div className="choices-list">
                                {choices.map((choice, index) => (
                                    <div key={index} className="choice-item mb-2 p-2 bg-white rounded border">
                                        <div className="d-flex gap-2 align-items-center">
                                            {/* Radio/Checkbox - Centered container */}
                                            <div className="d-flex align-items-center justify-content-center" style={{ width: '24px', height: '24px', flexShrink: 0 }}>
                                                <input
                                                    type={questionType === 'multiple_choice' ? 'radio' : 'checkbox'}
                                                    checked={choice.is_correct || false}
                                                    onChange={(e) => handleChoiceChange(index, 'is_correct', e.target.checked)}
                                                    disabled={isLoading}
                                                    style={{ display: 'block', width: '18px', height: '18px', margin: 0, cursor: 'pointer' }}
                                                />
                                            </div>
                                            {/* Text Input */}
                                            <textarea
                                                className="form-control form-control-sm flex-grow-1"
                                                rows="1"
                                                value={choice.choice_text || ''}
                                                onChange={(e) => handleChoiceChange(index, 'choice_text', e.target.value)}
                                                placeholder={`Pilihan ${index + 1}`}
                                                disabled={isLoading}
                                                style={{ resize: 'vertical' }}
                                            />
                                            {/* Delete Button */}
                                            {choices.length > 2 && (
                                                <button
                                                    type="button"
                                                    className="btn btn-danger btn-sm"
                                                    onClick={() => removeChoice(index)}
                                                    disabled={isLoading}
                                                    title="Hapus pilihan ini"
                                                >
                                                    <i className="fas fa-trash"></i>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm mt-2"
                                onClick={addChoice}
                                disabled={isLoading}
                            >
                                <i className="fas fa-plus me-1"></i>
                                Tambah Pilihan
                            </button>
                        </div>
                    )}

                    {/* Short Answer / Fill in Blank */}
                    {['short_answer', 'fill_in_blank'].includes(questionType) && (
                        <div className="mb-3">
                            <label className="form-label fw-bold">
                                <i className="fas fa-check-circle me-2 text-success"></i>
                                Jawaban yang Benar
                            </label>
                            <textarea
                                className="form-control"
                                rows="2"
                                value={correctAnswerText}
                                onChange={(e) => setCorrectAnswerText(e.target.value)}
                                placeholder="Masukkan jawaban yang benar..."
                                disabled={isLoading}
                            />
                            <div className="form-check mt-2 d-flex align-items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="caseSensitive"
                                    checked={caseSensitive}
                                    onChange={(e) => setCaseSensitive(e.target.checked)}
                                    disabled={isLoading}
                                    style={{ width: '18px', height: '18px', margin: 0, cursor: 'pointer' }}
                                />
                                <label className="form-check-label mb-0" htmlFor="caseSensitive">
                                    Huruf besar/kecil penting
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="d-flex gap-2 justify-content-end">
                        {existingQuestion && (
                            <button
                                type="button"
                                className="btn btn-danger"
                                onClick={handleDelete}
                                disabled={isLoading}
                            >
                                <i className="fas fa-trash me-1"></i>
                                Hapus
                            </button>
                        )}
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setIsOpen(false)}
                            disabled={isLoading}
                        >
                            Batal
                        </button>
                        <button
                            type="button"
                            className="btn btn-success"
                            onClick={handleSave}
                            disabled={isLoading}
                        >
                            <i className="fas fa-save me-1"></i>
                            {isLoading ? 'Menyimpan...' : 'Simpan'}
                        </button>
                    </div>
                </div>
            )}

            {/* Display existing question summary when closed */}
            {!isOpen && existingQuestion && (
                <div className="question-summary p-3 bg-light rounded border-start border-success">
                    <div className="d-flex justify-content-between align-items-start">
                        <div>
                            <span className="badge bg-success mb-2">{existingQuestion.question_type_display}</span>
                            <p className="mb-0"><strong>Q:</strong> {existingQuestion.question_text}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(LessonCompletionQuestionEditor);
