import React, { useState, useEffect } from 'react';
import useAxios from '../../utils/useAxios';
import Toast from '../../views/plugin/Toast';
import './LessonCompletionQuestionEditor.css';

// ✨ PHASE 4.143: Lesson Completion Question Editor (Compact & Modern LMSetjen DPD RI Design)
// Allows instructors to create/edit lightweight questions for lesson completion verification
const LessonCompletionQuestionEditor = ({ variantItemId, onQuestionSaved }) => {
    const API = useAxios;
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [existingQuestion, setExistingQuestion] = useState(null);

    // Form states
    const [questionType, setQuestionType] = useState('multiple_choice');
    const [questionText, setQuestionText] = useState('');
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [correctAnswerText, setCorrectAnswerText] = useState('');
    const [shortAnswerList, setShortAnswerList] = useState(['']);
    const [choices, setChoices] = useState([
        { choice_text: '', is_correct: false },
        { choice_text: '', is_correct: false }
    ]);

    // Load existing question on mount or when opened
    useEffect(() => {
        if (variantItemId) {
            loadExistingQuestion();
        }
    }, [variantItemId]);

    const loadExistingQuestion = async () => {
        try {
            setIsLoading(true);
            const response = await API.get(`/lesson-completion-question/?variant_item_id=${variantItemId}`);
            if (response.data.results && response.data.results.length > 0) {
                const question = response.data.results[0];
                setExistingQuestion(question);
                setQuestionType(question.question_type || 'multiple_choice');
                setQuestionText(question.question_text || '');
                setCaseSensitive(Boolean(question.case_sensitive));
                setCorrectAnswerText(question.correct_answer_text || '');
                if (question.correct_answer_text) {
                    const parsedList = question.correct_answer_text
                        .split(/[;\n\r]+/)
                        .map(item => item.trim())
                        .filter(Boolean);
                    setShortAnswerList(parsedList.length > 0 ? parsedList : ['']);
                } else {
                    setShortAnswerList(['']);
                }
                if (question.choices && question.choices.length > 0) {
                    setChoices(question.choices);
                }
            } else {
                setExistingQuestion(null);
            }
            setIsLoading(false);
        } catch (error) {
            console.error('Error loading lesson completion question:', error);
            setIsLoading(false);
        }
    };

    const handleQuestionTypeChange = (newType) => {
        setQuestionType(newType);
        if (newType === 'multiple_choice' || newType === 'multi_select') {
            if (choices.length < 2) {
                setChoices([
                    { choice_text: '', is_correct: false },
                    { choice_text: '', is_correct: false }
                ]);
            }
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
                title: 'Teks Pertanyaan Diperlukan',
                text: 'Silakan masukkan teks pertanyaan untuk peserta'
            });
            return;
        }

        if (['multiple_choice', 'multi_select'].includes(questionType)) {
            const filledChoices = choices.filter(c => c.choice_text.trim());
            if (filledChoices.length < 2) {
                Toast().fire({
                    icon: 'error',
                    title: 'Pilihan Jawaban Kurang',
                    text: 'Minimal 2 opsi pilihan jawaban harus diisi'
                });
                return;
            }
            const hasCorrect = filledChoices.some(c => c.is_correct);
            if (!hasCorrect) {
                Toast().fire({
                    icon: 'error',
                    title: 'Kunci Jawaban Diperlukan',
                    text: 'Tandai minimal satu opsi pilihan sebagai jawaban benar'
                });
                return;
            }
        } else {
            const validAnswers = shortAnswerList.map(a => a.trim()).filter(Boolean);
            if (validAnswers.length === 0 && !correctAnswerText.trim()) {
                Toast().fire({
                    icon: 'error',
                    title: 'Kunci Jawaban Diperlukan',
                    text: 'Silakan masukkan minimal satu jawaban benar yang valid'
                });
                return;
            }
        }

        try {
            setIsLoading(true);
            const compiledAnswers = ['short_answer', 'fill_in_blank'].includes(questionType)
                ? (shortAnswerList.map(a => a.trim()).filter(Boolean).length > 0
                    ? shortAnswerList.map(a => a.trim()).filter(Boolean).join('; ')
                    : correctAnswerText.trim())
                : correctAnswerText;

            const payload = {
                question_text: questionText,
                question_type: questionType,
                case_sensitive: caseSensitive,
                correct_answer_text: compiledAnswers,
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

            const savedData = response.data.question || response.data;
            setExistingQuestion(savedData);

            Toast().fire({
                icon: 'success',
                title: 'Berhasil',
                text: existingQuestion ? 'Pertanyaan penyelesaian berhasil diperbarui' : 'Pertanyaan penyelesaian berhasil dibuat'
            });

            if (onQuestionSaved) {
                onQuestionSaved(savedData);
            }

            setIsOpen(false);
            setIsLoading(false);
        } catch (error) {
            console.error('Error saving question:', error);
            Toast().fire({
                icon: 'error',
                title: 'Gagal Menyimpan',
                text: error.response?.data?.error || error.response?.data?.message || 'Terjadi kesalahan saat menyimpan pertanyaan'
            });
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!existingQuestion) return;

        if (!window.confirm('Yakin ingin menghapus pertanyaan penyelesaian pelajaran ini? Peserta nantinya dapat menyelesaikan pelajaran tanpa harus menjawab pertanyaan.')) return;

        try {
            setIsLoading(true);
            await API.delete(`/lesson-completion-question/${existingQuestion.question_id}/`);

            Toast().fire({
                icon: 'success',
                title: 'Dihapus',
                text: 'Pertanyaan penyelesaian berhasil dihapus'
            });

            setExistingQuestion(null);
            setQuestionText('');
            setCorrectAnswerText('');
            setChoices([
                { choice_text: '', is_correct: false },
                { choice_text: '', is_correct: false }
            ]);
            setIsOpen(false);
            if (onQuestionSaved) {
                onQuestionSaved(null);
            }
            setIsLoading(false);
        } catch (error) {
            console.error('Error deleting question:', error);
            Toast().fire({
                icon: 'error',
                title: 'Gagal Menghapus',
                text: error.response?.data?.error || 'Terjadi kesalahan saat menghapus pertanyaan'
            });
            setIsLoading(false);
        }
    };

    return (
        <div className="lesson-completion-question-editor">
            {/* Compact Header Bar */}
            <div className="lcq-header-strip">
                <div className="lcq-header-info">
                    <div className={`lcq-icon-box ${existingQuestion ? 'has-question' : ''}`}>
                        <i className={`fas ${existingQuestion ? 'fa-shield-halved' : 'fa-clipboard-question'}`}></i>
                    </div>
                    <div className="lcq-titles">
                        <div className="d-flex align-items-center gap-2">
                            <span className="lcq-main-title">
                                Pertanyaan Penyelesaian Pelajaran
                            </span>
                            {existingQuestion ? (
                                <span className="badge lcq-badge-active">
                                    <i className="fas fa-check-circle me-1"></i>
                                    {existingQuestion.question_type_display || (
                                        existingQuestion.question_type === 'multiple_choice' ? 'Pilihan Ganda' :
                                            existingQuestion.question_type === 'multi_select' ? 'Multi-Pilihan' :
                                                existingQuestion.question_type === 'short_answer' ? 'Jawaban Singkat' : 'Isi Titik-Titik'
                                    )}
                                </span>
                            ) : (
                                <span className="badge lcq-badge-optional">Opsional</span>
                            )}
                        </div>
                        <span className="lcq-sub-title">
                            {existingQuestion
                                ? 'Peserta wajib menjawab pertanyaan ini dengan benar agar materi tercatat selesai.'
                                : 'Tambahkan 1 pertanyaan cepat penguji pemahaman sebelum materi ditandai selesai.'}
                        </span>
                    </div>
                </div>

                <div className="lcq-header-actions">
                    <button
                        type="button"
                        className={`btn btn-sm ${isOpen ? 'lcq-btn-active' : existingQuestion ? 'lcq-btn-edit' : 'lcq-btn-add'}`}
                        onClick={() => setIsOpen(!isOpen)}
                        disabled={isLoading}
                    >
                        <i className={`fas fa-${isOpen ? 'chevron-up' : existingQuestion ? 'pen-to-square' : 'plus'} me-1`}></i>
                        {isOpen ? 'Tutup Editor' : existingQuestion ? 'Edit Pertanyaan' : 'Tambah Pertanyaan'}
                    </button>
                </div>
            </div>

            {/* Compact Redesigned Form Container */}
            {isOpen && (
                <div className="question-editor-form p-3 bg-white rounded-2 border shadow-xs mt-2">
                    {/* Row 1: Teks Pertanyaan */}
                    <div className="mb-2">
                        <div className="d-flex align-items-center justify-content-between mb-1">
                            <label className="form-label fw-bold small text-dark mb-0 d-flex align-items-center gap-1">
                                <i className="fas fa-pen-nib text-teal"></i>
                                <span></span>
                                <span className="text-danger">*</span>
                            </label>
                            <span className="text-muted" style={{ fontSize: "0.72rem" }}>
                                Ringkas & langsung menguji materi
                            </span>
                        </div>
                        <textarea
                            className="form-control form-control-sm lcq-input"
                            rows="2"
                            value={questionText}
                            onChange={(e) => setQuestionText(e.target.value)}
                            placeholder="Tuliskan pertanyaan penguji pemahaman peserta terhadap pelajaran ini..."
                            disabled={isLoading}
                        />
                    </div>

                    {/* Row 2: Tipe Pertanyaan Segmented Buttons */}
                    <div className="mb-2">
                        <label className="form-label fw-bold small text-dark mb-1 d-flex align-items-center gap-1">
                            <i className="fas fa-sliders text-teal"></i>
                            <span>Tipe Pertanyaan</span>
                        </label>
                        <div className="lcq-segmented-control" role="group">
                            {[
                                { value: 'multiple_choice', label: 'Pilihan Ganda', icon: 'dot-circle' },
                                { value: 'multi_select', label: 'Multi-Pilihan', icon: 'check-square' },
                                { value: 'short_answer', label: 'Jawaban Singkat', icon: 'font' },
                                { value: 'fill_in_blank', label: 'Isi Titik-Titik', icon: 'i-cursor' }
                            ].map(type => (
                                <button
                                    key={type.value}
                                    type="button"
                                    className={`lcq-segment-btn ${questionType === type.value ? 'is-active' : ''}`}
                                    onClick={() => handleQuestionTypeChange(type.value)}
                                    disabled={isLoading}
                                >
                                    <i className={`fas fa-${type.icon} me-1`}></i>
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Row 3: Pilihan Jawaban (Multiple Choice / Multi-Select) */}
                    {['multiple_choice', 'multi_select'].includes(questionType) && (
                        <div className="mb-2">
                            <div className="d-flex align-items-center justify-content-between mb-1">
                                <label className="form-label fw-bold small text-dark mb-0 d-flex align-items-center gap-1">
                                    <i className="fas fa-list-check text-teal"></i>
                                    <span>Opsi Pilihan & Kunci Jawaban</span>
                                </label>
                                <span className="text-muted" style={{ fontSize: "0.72rem" }}>
                                    Pilih radio / centang untuk menetapkan jawaban yang benar
                                </span>
                            </div>

                            <div className="lcq-choices-container d-flex flex-column gap-1">
                                {choices.map((choice, index) => {
                                    const isCorrect = Boolean(choice.is_correct);
                                    return (
                                        <div
                                            key={index}
                                            className={`lcq-choice-item d-flex align-items-center gap-2 p-1 px-2 rounded border ${isCorrect ? 'is-correct' : ''}`}
                                        >
                                            {/* Selector (Radio / Checkbox) */}
                                            <div className="lcq-choice-check-wrapper" title="Tandai sebagai kunci jawaban benar">
                                                <input
                                                    type={questionType === 'multiple_choice' ? 'radio' : 'checkbox'}
                                                    name={`lcq_correct_${variantItemId || 'item'}`}
                                                    checked={isCorrect}
                                                    onChange={(e) => handleChoiceChange(index, 'is_correct', e.target.checked)}
                                                    disabled={isLoading}
                                                    className="form-check-input lcq-radio-check"
                                                />
                                            </div>

                                            {/* Option Label Letter */}
                                            <span className={`badge lcq-letter-badge ${isCorrect ? 'badge-teal' : 'badge-light'}`}>
                                                {String.fromCharCode(65 + index)}
                                            </span>

                                            {/* Choice Input */}
                                            <input
                                                type="text"
                                                className="form-control form-control-sm border-0 bg-transparent flex-grow-1 p-0 px-1 lcq-choice-input"
                                                value={choice.choice_text || ''}
                                                onChange={(e) => handleChoiceChange(index, 'choice_text', e.target.value)}
                                                placeholder={`Teks pilihan opsi ${String.fromCharCode(65 + index)}...`}
                                                disabled={isLoading}
                                            />

                                            {/* Correct Indicator Badge */}
                                            {isCorrect && (
                                                <span className="badge bg-teal-subtle text-teal fw-semibold py-0 px-2 flex-shrink-0" style={{ fontSize: "0.68rem" }}>
                                                    <i className="fas fa-check me-1"></i>Kunci
                                                </span>
                                            )}

                                            {/* Delete Button */}
                                            {choices.length > 2 && (
                                                <button
                                                    type="button"
                                                    className="btn btn-link text-muted hover-danger p-0 ms-1 flex-shrink-0"
                                                    onClick={() => removeChoice(index)}
                                                    disabled={isLoading}
                                                    title="Hapus opsi ini"
                                                    style={{ fontSize: "0.82rem" }}
                                                >
                                                    <i className="fas fa-trash-can"></i>
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-1">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-teal py-0 px-2 d-inline-flex align-items-center gap-1"
                                    onClick={addChoice}
                                    disabled={isLoading}
                                    style={{ fontSize: "0.75rem", borderRadius: "5px" }}
                                >
                                    <i className="fas fa-plus"></i>
                                    <span>Tambah Pilihan</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Row 4: Short Answer / Fill in Blank */}
                    {['short_answer', 'fill_in_blank'].includes(questionType) && (
                        <div className="mb-2">
                            <div className="d-flex align-items-center justify-content-between mb-1">
                                <label className="form-label fw-bold small text-dark mb-0 d-flex align-items-center gap-1">
                                    <i className="fas fa-key text-success"></i>
                                    <span>Kunci Jawaban yang Benar (Bisa Lebih Dari 1)</span>
                                </label>
                                <span className="text-muted" style={{ fontSize: "0.72rem" }}>
                                    Peserta dianggap benar jika menjawab salah satu dari kunci ini
                                </span>
                            </div>

                            <div className="d-flex flex-column gap-1 mb-1">
                                {shortAnswerList.map((ans, idx) => (
                                    <div key={idx} className="d-flex align-items-center gap-1">
                                        <span className="badge bg-light text-muted border py-1 px-2 flex-shrink-0" style={{ fontSize: "0.72rem" }}>
                                            Kunci #{idx + 1}
                                        </span>
                                        <input
                                            type="text"
                                            className="form-control form-control-sm lcq-input flex-grow-1"
                                            value={ans}
                                            onChange={(e) => {
                                                const updated = [...shortAnswerList];
                                                updated[idx] = e.target.value;
                                                setShortAnswerList(updated);
                                                setCorrectAnswerText(updated.map(a => a.trim()).filter(Boolean).join('; '));
                                            }}
                                            placeholder={idx === 0 ? "Contoh: Jakarta" : "Variasi jawaban lain (contoh: DKI Jakarta)"}
                                            disabled={isLoading}
                                        />
                                        {shortAnswerList.length > 1 && (
                                            <button
                                                type="button"
                                                className="btn btn-outline-danger btn-sm py-0 px-2 flex-shrink-0"
                                                style={{ height: '31px' }}
                                                onClick={() => {
                                                    const updated = shortAnswerList.filter((_, i) => i !== idx);
                                                    setShortAnswerList(updated.length > 0 ? updated : ['']);
                                                    setCorrectAnswerText(updated.map(a => a.trim()).filter(Boolean).join('; '));
                                                }}
                                                disabled={isLoading}
                                                title="Hapus variasi jawaban ini"
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="d-flex align-items-center justify-content-between mt-1">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-success py-0 px-2 d-inline-flex align-items-center gap-1"
                                    onClick={() => setShortAnswerList([...shortAnswerList, ''])}
                                    disabled={isLoading}
                                    style={{ fontSize: "0.75rem", borderRadius: "5px" }}
                                >
                                    <i className="fas fa-plus"></i>
                                    <span>Tambah Alternatif Jawaban</span>
                                </button>
                                <span className="text-muted" style={{ fontSize: "0.7rem" }}>
                                    <i className="fas fa-info-circle me-1"></i>Otomatis dipisah titik koma (;)
                                </span>
                            </div>

                            <div className="form-check mt-2 d-flex align-items-center gap-2">
                                <input
                                    type="checkbox"
                                    id={`caseSensitive_${variantItemId}`}
                                    checked={caseSensitive}
                                    onChange={(e) => setCaseSensitive(e.target.checked)}
                                    disabled={isLoading}
                                    className="form-check-input"
                                    style={{ cursor: 'pointer' }}
                                />
                                <label className="form-check-label small text-muted mb-0" htmlFor={`caseSensitive_${variantItemId}`} style={{ fontSize: "0.75rem", cursor: 'pointer' }}>
                                    Peka terhadap huruf besar / kecil (Case Sensitive)
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Bottom Action Buttons: Compact & Clean */}
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2">
                        <div>
                            {existingQuestion && (
                                <button
                                    type="button"
                                    className="btn btn-outline-danger btn-sm py-1 px-2"
                                    onClick={handleDelete}
                                    disabled={isLoading}
                                    style={{ fontSize: "0.75rem", borderRadius: "5px" }}
                                >
                                    <i className="fas fa-trash-alt me-1"></i>
                                    Hapus
                                </button>
                            )}
                        </div>
                        <div className="d-flex gap-1 align-items-center">
                            <button
                                type="button"
                                className="btn btn-light border btn-sm py-1 px-2 text-secondary"
                                onClick={() => setIsOpen(false)}
                                disabled={isLoading}
                                style={{ fontSize: "0.75rem", borderRadius: "5px" }}
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                className="btn btn-teal btn-sm py-1 px-3 text-white fw-semibold"
                                onClick={handleSave}
                                disabled={isLoading}
                                style={{ fontSize: "0.75rem", borderRadius: "5px" }}
                            >
                                {isLoading ? (
                                    <>
                                        <i className="fas fa-spinner fa-spin me-1"></i>
                                        Menyimpan...
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-save me-1"></i>
                                        Simpan Pertanyaan
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Display existing question summary when closed */}
            {!isOpen && existingQuestion && (
                <div className="lcq-summary-card mt-1 p-2 px-2 rounded border d-flex align-items-center justify-content-between bg-white shadow-xs">
                    <div className="d-flex align-items-center gap-2 overflow-hidden me-2">
                        <span className="badge bg-teal-subtle text-teal border border-teal-subtle flex-shrink-0 fw-semibold" style={{ fontSize: "0.7rem", padding: "2px 7px" }}>
                            {existingQuestion.question_type_display || (
                                existingQuestion.question_type === 'multiple_choice' ? 'Pilihan Ganda' :
                                    existingQuestion.question_type === 'multi_select' ? 'Multi-Pilihan' :
                                        existingQuestion.question_type === 'short_answer' ? 'Jawaban Singkat' : 'Isi Titik-Titik'
                            )}
                        </span>
                        <div className="text-dark small text-truncate" style={{ fontSize: "0.78rem" }}>
                            <span className="fw-semibold text-teal me-1">Q:</span>
                            {existingQuestion.question_text}
                        </div>
                    </div>
                    <button
                        type="button"
                        className="btn btn-link text-teal p-0 flex-shrink-0 fw-semibold d-flex align-items-center gap-1"
                        style={{ fontSize: "0.74rem", textDecoration: "none" }}
                        onClick={() => setIsOpen(true)}
                    >
                        <i className="fas fa-pen-to-square"></i>
                        <span>Ubah</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default React.memo(LessonCompletionQuestionEditor);
