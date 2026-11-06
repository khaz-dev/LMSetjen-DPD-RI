import React, { useState, useEffect, useRef } from 'react';
import dayjs, { moment } from '../../utils/dayjs';
import apiInstance from '../../utils/axios';
import UserData from '../../views/plugin/UserData';
import Toast from '../../views/plugin/Toast';
import QRCode from 'qrcode.react';
import certificateBackgroundWebP from '../../assets/certificate-bg.webp';
import certificateBackgroundPNG from '../../assets/certificate-bg.png';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import ModernCertificateDocument from './ModernCertificateDocument';
import './CertificateTab.css';

function CertificateTab({
    course,
    enrollmentId,
    completionPercentage,
    onCertificateGenerated,
    isInline = false,
    onStartPosttest = null,
    regenerateTrigger = 0
}) {
    const [certificate, setCertificate] = useState(null);
    const [isEligible, setIsEligible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [quizResults, setQuizResults] = useState([]);
    const [eligibilityData, setEligibilityData] = useState(null);
    const [templateConfig, setTemplateConfig] = useState(null);
    const certificateRef = useRef();

    // Fetch active certificate template config
    useEffect(() => {
        const fetchTemplateConfig = async () => {
            try {
                const res = await apiInstance.get('/certificate/template-config/');
                if (res.data) {
                    setTemplateConfig(res.data);
                }
            } catch (e) {
                console.error('Failed to load certificate template config:', e);
            }
        };
        fetchTemplateConfig();
    }, []);

    // Use WebP with PNG fallback for better performance
    const certificateBackground = certificateBackgroundWebP || certificateBackgroundPNG;

    // Check eligibility for certificate
    const checkEligibility = async () => {
        try {
            const response = await apiInstance.get(`student/certificate-eligibility/${UserData()?.user_id}/${course?.course?.course_id}/`);
            setIsEligible(response.data.is_eligible);
            setQuizResults(response.data.quiz_results || []);
            setEligibilityData(response.data);

            if (response.data.certificate) {
                setCertificate(response.data.certificate);
                // ✨ PHASE 4.146: Notify parent that existing certificate was found
                if (onCertificateGenerated) {
                    onCertificateGenerated(response.data.certificate);
                }
            }
        } catch (error) {
        }
    };

    // ✨ PHASE 4.146: Generate certificate (PDF auto-generated on backend, but frontend uploads it)
    const generateCertificate = async () => {
        setGenerating(true);
        try {
            const response = await apiInstance.post('student/certificate-generate/', {
                user_id: UserData()?.user_id,
                course_id: course?.course?.course_id,
                enrollment_id: enrollmentId
            });

            if (response.data.certificate) {
                setCertificate(response.data.certificate);

                // ✨ PHASE 4.225: Generate and upload image (PNG) to server, then notify parent with complete data
                setTimeout(() => {
                    if (certificateRef.current) {
                        generateAndSaveImage(response.data.certificate, onCertificateGenerated);
                    }
                }, 500);

                Toast().fire({
                    icon: 'success',
                    title: 'Sertifikat Berhasil Dibuat!',
                    text: 'Sertifikat Anda telah berhasil dibuat dan disimpan.'
                });

                // ✨ PHASE 50: Scroll to course progress card after successful creation
                setTimeout(() => {
                    const progressCard = document.querySelector('.course-progress-card-loaded');
                    if (progressCard) {
                        progressCard.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }
                }, 1000);  // Wait for image generation to complete before scrolling
            }
        } catch (error) {
            Toast().fire({
                icon: 'error',
                title: 'Gagal Membuat Sertifikat',
                text: error.response?.data?.detail || 'Gagal membuat sertifikat.'
            });
        } finally {
            setGenerating(false);
        }
    };

    // ✨ PHASE 4.222: Generate Ultra-HD certificate image (PNG) via offscreen staging
    // ✨ PHASE 4.225: Updated to notify parent component with complete certificate data after image is saved
    const generateAndSaveImage = async (certificateData, onCertificateGenerated) => {
        try {
            if (!certificateRef.current) return;
            setGenerating(true);

            // Wait a brief tick for fonts/logos to fully render in staging container
            await new Promise(resolve => setTimeout(resolve, 300));

            const certificateElement = certificateRef.current;
            const userId = UserData()?.user_id;
            const courseId = course?.course?.course_id;

            // Render at 1x of 1414x1000 = 2121 x 1500 px Ultra-HD razor sharp output
            const canvas = await html2canvas(certificateElement, {
                scale: 1,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            // Convert canvas to PNG image blob
            canvas.toBlob(async (blob) => {
                try {
                    // Send PNG image to server for storage with filename: course_id_user_id.png
                    const formData = new FormData();
                    formData.append('file', blob, `${courseId}_${userId}.png`);
                    formData.append('user_id', userId);
                    formData.append('course_id', courseId);

                    await apiInstance.post('student/certificate-save-image/', formData, {
                        headers: {
                            'Content-Type': 'multipart/form-data'
                        }
                    });

                    // Refresh certificate data to show the image
                    const certResponse = await apiInstance.get(
                        `student/certificate-eligibility/${userId}/${courseId}/`
                    );
                    if (certResponse.data.certificate) {
                        const updatedCertificate = certResponse.data.certificate;
                        setCertificate(updatedCertificate);

                        // Notify parent component with COMPLETE certificate data (includes image_file_url)
                        if (onCertificateGenerated) {
                            onCertificateGenerated(updatedCertificate);
                        }
                    }

                    Toast().fire({
                        icon: 'success',
                        title: 'Sertifikat HD Berhasil Diperbarui!',
                        text: 'Tampilan sertifikat Anda kini telah diperbarui ke resolusi tinggi.'
                    });

                } catch (error) {
                    console.error('Error saving certificate image:', error);
                    Toast().fire({
                        icon: 'error',
                        title: 'Gagal Menyimpan Gambar',
                        text: 'Gagal memperbarui file sertifikat pada server.'
                    });
                } finally {
                    setGenerating(false);
                }
            }, 'image/png');

        } catch (error) {
            console.error('Error generating certificate image:', error);
            setGenerating(false);
        }
    };

    // Auto-listen to parent regeneration trigger
    useEffect(() => {
        if (regenerateTrigger > 0 && certificate) {
            generateAndSaveImage(certificate, onCertificateGenerated);
        }
    }, [regenerateTrigger]);

    // ✨ PHASE 4.222: Download certificate image from server (PNG format)
    const downloadCertificateFromServer = async () => {
        if (!certificate || !course?.course?.course_id) {
            Toast().fire({
                icon: 'warning',
                title: 'Tidak ada sertifikat',
                text: 'Tidak ada sertifikat untuk diunduh.'
            });
            return;
        }

        try {
            Toast().fire({
                icon: 'info',
                title: 'Mengunduh...',
                text: 'Mengunduh sertifikat Anda...'
            });

            // ✨ PHASE 4.222: Download certificate image (course_id_user_id.png)
            const courseId = course?.course?.course_id;
            const userId = UserData()?.user_id;

            // ✨ PHASE 51: Use apiInstance to fetch the file with correct API base URL
            const response = await apiInstance.get(
                `student/certificate-download/${courseId}/${userId}/`,
                {
                    responseType: 'blob'  // Important: Get response as blob for binary file
                }
            );

            // Create blob URL and download
            const blob = new Blob([response.data], { type: 'image/png' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${courseId}_${userId}.png`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);

            Toast().fire({
                icon: 'success',
                title: 'Berhasil!',
                text: 'Sertifikat berhasil diunduh.'
            });
        } catch (error) {
            console.error('Error downloading certificate:', error);
            Toast().fire({
                icon: 'error',
                title: 'Unduhan Gagal',
                text: 'Gagal mengunduh sertifikat. Silakan coba lagi.'
            });
        }
    };

    useEffect(() => {
        if (course?.course?.course_id) {
            checkEligibility();
        }
    }, [course]);

    const formatDate = (date) => {
        // ✨ PHASE 51: Indonesian locale is now set globally in dayjs.js, no need to set again
        return moment(date).format('DD MMMM YYYY');
    };

    const getCompletionStatus = () => {
        const allLessonsCompleted = completionPercentage === 100;
        // Filter regular quizzes from quizResults
        const regularQuizzes = quizResults.filter(q => q.quiz_type !== 'pre_post_test');
        const allQuizzesPassed = regularQuizzes.length === 0 || regularQuizzes.every(quiz => quiz.passed);

        const hasPrePostTest = Boolean(eligibilityData?.has_pre_post_test);
        const postTestCompleted = Boolean(eligibilityData?.post_test_completed);

        const isFullyComplete = isEligible || (allLessonsCompleted && allQuizzesPassed && (!hasPrePostTest || postTestCompleted));

        return {
            allLessonsCompleted,
            allQuizzesPassed,
            hasPrePostTest,
            postTestCompleted,
            isFullyComplete
        };
    };

    const { allLessonsCompleted, allQuizzesPassed, hasPrePostTest, postTestCompleted, isFullyComplete } = getCompletionStatus();

    return (
        <div className={isInline ? "certificate-inline-wrapper" : "tab-pane fade"} id={isInline ? undefined : "certificate"} role={isInline ? undefined : "tabpanel"}>
            <div className="certificate-container">
                {!isInline && (
                    <div className="certificate-header d-flex justify-content-between align-items-center mb-2">
                        <h4 className="mb-0">
                            <i className="fas fa-certificate me-2 text-amber"></i>
                            Sertifikat Kursus
                        </h4>
                        {certificate && certificate.image_file_url && (
                            <button
                                className="btn btn-sm btn-teal"
                                onClick={downloadCertificateFromServer}
                            >
                                <i className="fas fa-download me-1"></i>
                                Unduh Sertifikat
                            </button>
                        )}
                    </div>
                )}

                {/* ✨ Ultra-HD Certificate Staging Container (Always in DOM for html2canvas) */}
                {certificate && (
                    <div
                        className="cert-render-staging-box"
                        style={{
                            position: 'fixed',
                            left: '-9999px',
                            top: 0,
                            width: '1414px',
                            height: '1000px',
                            zIndex: -9999,
                            overflow: 'hidden',
                            pointerEvents: 'none',
                            background: '#ffffff'
                        }}
                        aria-hidden="true"
                    >
                        <ModernCertificateDocument
                            ref={certificateRef}
                            certificate={certificate}
                            course={course}
                            userData={UserData()}
                            templateConfig={templateConfig}
                        />
                    </div>
                )}

                {/* Notice if certificate image is being generated */}
                {certificate && !certificate.image_file_url && (
                    <div className="card border-teal-subtle bg-teal-subtle p-3 rounded-3 text-center mb-3">
                        <div className="spinner-border spinner-border-sm text-teal mb-2" role="status"></div>
                        <h6 className="fw-bold mb-1 text-teal">Menyiapkan Berkas Sertifikat Digital...</h6>
                        <p className="small text-muted mb-0">Sertifikat Anda sedang diproses dalam resolusi Ultra-HD. Silakan tunggu beberapa saat.</p>
                    </div>
                )}

                {/* Eligibility Status - Dynamic 2 or 3 Column Grid */}
                <div className="eligibility-section mb-2">
                    <div className="row g-2">
                        <div className={isInline ? "col-12" : (hasPrePostTest ? "col-12 col-md-4" : "col-12 col-md-6")}>
                            <div className={`status-card ${allLessonsCompleted ? 'completed' : 'incomplete'}`}>
                                <div className="status-icon">
                                    <i className={`fas ${allLessonsCompleted ? 'fa-check-circle' : 'fa-clock'}`}></i>
                                </div>
                                <div className="status-content">
                                    <h6>Penyelesaian Materi</h6>
                                    <p>{completionPercentage}% Selesai</p>
                                    <small>
                                        {allLessonsCompleted ? 'Materi tuntas 100%' : `${100 - completionPercentage}% tersisa`}
                                    </small>
                                </div>
                            </div>
                        </div>
                        <div className={isInline ? "col-12" : (hasPrePostTest ? "col-12 col-md-4" : "col-12 col-md-6")}>
                            <div className={`status-card ${allQuizzesPassed ? 'completed' : 'incomplete'}`}>
                                <div className="status-icon">
                                    <i className={`fas ${allQuizzesPassed ? 'fa-check-circle' : 'fa-hourglass-half'}`}></i>
                                </div>
                                <div className="status-content">
                                    <h6>Kelulusan Kuis</h6>
                                    <p>
                                        {quizResults.filter(q => q.quiz_type !== 'pre_post_test' && q.passed).length}/{Math.max(1, quizResults.filter(q => q.quiz_type !== 'pre_post_test').length)} Lulus
                                    </p>
                                    <small>
                                        {allQuizzesPassed ? 'Semua kuis lulus' : 'Nilai min. 70%'}
                                    </small>
                                </div>
                            </div>
                        </div>
                        {hasPrePostTest && (
                            <div className={isInline ? "col-12" : "col-12 col-md-4"}>
                                <div className={`status-card ${postTestCompleted ? 'completed' : 'incomplete'}`}>
                                    <div className="status-icon">
                                        <i className={`fas ${postTestCompleted ? 'fa-check-circle' : 'fa-clipboard-check'}`}></i>
                                    </div>
                                    <div className="status-content">
                                        <h6>Post-test Akhir</h6>
                                        <p>{postTestCompleted ? `Selesai (${Math.round(eligibilityData?.post_test_score || 0)}%)` : 'Wajib Dikerjakan'}</p>
                                        <small>
                                            {postTestCompleted
                                                ? `Gain: ${eligibilityData?.learning_gain >= 0 ? '+' : ''}${eligibilityData?.learning_gain || 0}%`
                                                : allLessonsCompleted && allQuizzesPassed
                                                    ? 'Siap dikerjakan'
                                                    : 'Terkunci'}
                                        </small>
                                        {!postTestCompleted && allLessonsCompleted && allQuizzesPassed && onStartPosttest && (
                                            <button
                                                type="button"
                                                className="btn btn-xs btn-amber mt-1 py-0 px-2 fw-bold w-100"
                                                onClick={onStartPosttest}
                                            >
                                                <i className="fas fa-play me-1"></i>Kerjakan
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Certificate Actions / Status */}
                {isFullyComplete ? (
                    <div className="certificate-actions mb-2">
                        {!certificate ? (
                            eligibilityData?.integrity && !eligibilityData.integrity.is_valid ? (
                                <div className="generate-section">
                                    <div className="card border-warning-subtle bg-warning-subtle text-dark p-3 rounded-3 shadow-xs">
                                        <div className="d-flex align-items-start gap-3">
                                            <div className="p-2 rounded-circle bg-warning text-dark flex-shrink-0 d-flex align-items-center justify-content-center" style={{ width: '44px', height: '44px', fontSize: '1.25rem' }}>
                                                <i className="fas fa-shield-halved"></i>
                                            </div>
                                            <div className="flex-grow-1">
                                                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-1">
                                                    <h6 className="fw-bold mb-0 text-warning-emphasis">
                                                        <i className="fas fa-clock-rotate-left me-1"></i> Peninjauan Integritas Ujian Sedang Berlangsung
                                                    </h6>
                                                    <span className="badge bg-warning text-dark border border-warning px-2 py-1">
                                                        <i className="fas fa-hourglass-half me-1"></i> Menunggu Verifikasi Instruktur
                                                    </span>
                                                </div>
                                                <p className="small mb-2 text-secondary" style={{ lineHeight: '1' }}>
                                                    Hasil kuis dan modul Anda telah tuntas, namun sistem anti-cheat mencatat anomali pada durasi pengerjaan. Demi menjaga standar kompetensi dan keabsahan sertifikat ASN Setjen DPD RI, penerbitan sertifikat digital memerlukan pengesahan manual oleh Instruktur kursus.
                                                </p>
                                                {eligibilityData.integrity.reasons && eligibilityData.integrity.reasons.length > 0 && (
                                                    <div className="p-2 rounded bg-white border border-warning-subtle small font-monospace text-muted mb-2">
                                                        <i className="fas fa-circle-info text-warning me-1"></i>
                                                        {eligibilityData.integrity.reasons.join(", ")}
                                                    </div>
                                                )}
                                                <div className="d-flex align-items-center gap-2">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-dark fw-semibold"
                                                        onClick={checkEligibility}
                                                        title="Periksa kembali status verifikasi"
                                                    >
                                                        <i className="fas fa-sync-alt me-1"></i> Periksa Ulang Status
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="generate-section">
                                    <div className="congratulations-card">
                                        <div className="congratulations-content">
                                            <div className="d-flex align-items-center justify-content-center gap-2 mb-1">
                                                <i className="fas fa-award congratulations-icon"></i>
                                                <h6 className="mb-0 fw-bold">Selamat! Kursus Telah Tuntas 🎉</h6>
                                            </div>
                                            <p className="congratulations-desc mb-2">
                                                Semua materi dan penilaian telah berhasil diselesaikan secara berintegritas. Silakan terbitkan sertifikat resmi Anda sekarang.
                                            </p>
                                            <button
                                                className="btn btn-sm generate-btn"
                                                onClick={generateCertificate}
                                                disabled={generating}
                                            >
                                                {generating ? (
                                                    <>
                                                        <div className="spinner-border spinner-border-sm me-2"></div>
                                                        Memproses Sertifikat...
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="fas fa-award me-1"></i>
                                                        Terbitkan Sertifikat Resmi
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        ) : (!certificate.is_valid || certificate.integrity_status === 'rejected') ? (
                            <div className="alert alert-danger border-danger-subtle d-flex align-items-center gap-3 p-3 rounded-3">
                                <i className="fas fa-ban fa-2x text-danger flex-shrink-0"></i>
                                <div>
                                    <h6 className="fw-bold mb-1">Sertifikat Ditangguhkan / Dibatalkan</h6>
                                    <p className="small mb-0">Sertifikat digital untuk kursus ini telah dibatalkan atau ditangguhkan oleh instruktur kursus karena pelanggaran integritas ujian. Silakan hubungi instruktur Anda.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="certificate-issued-card">
                                <div className="cert-issued-header d-flex justify-content-between align-items-center">
                                    <div className="d-flex align-items-center gap-2">
                                        <div className="cert-issued-icon">
                                            <i className="fas fa-shield-alt"></i>
                                        </div>
                                        <div>
                                            <h6 className="cert-issued-title mb-0">Sertifikat Resmi Diterbitkan</h6>
                                            <small className="cert-issued-date text-muted">
                                                Tanggal Terbit: {formatDate(certificate.date)}
                                            </small>
                                        </div>
                                    </div>
                                    <span className="badge-cert-status">
                                        <i className="fas fa-check-circle me-1"></i>Terverifikasi Sah
                                    </span>
                                </div>
                                <div className="cert-issued-body mt-2 pt-2 border-top">
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <span className="cert-number-label">Nomor Sertifikat:</span>
                                        <span className="cert-number-val font-monospace">{certificate.formatted_certificate_id || certificate.certificate_id}</span>
                                    </div>
                                    <div className="d-flex gap-2 justify-content-end align-items-center flex-wrap">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-secondary cert-action-btn d-inline-flex align-items-center justify-content-center"
                                            onClick={() => generateAndSaveImage(certificate, onCertificateGenerated)}
                                            disabled={generating}
                                            title="Perbarui tampilan sertifikat ke versi Ultra-HD terbaru"
                                        >
                                            <i className={`fas fa-arrows-rotate me-1 ${generating ? 'fa-spin' : ''}`}></i>
                                            <span>{generating ? 'Merender...' : 'Perbarui Desain'}</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-teal cert-action-btn d-inline-flex align-items-center justify-content-center"
                                            onClick={downloadCertificateFromServer}
                                        >
                                            <i className="fas fa-download me-1"></i>
                                            <span>Unduh File</span>
                                        </button>
                                        {certificate.qr_code_url && (
                                            <a
                                                href={certificate.qr_code_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="btn btn-sm btn-outline-teal cert-action-btn d-inline-flex align-items-center justify-content-center"
                                            >
                                                <i className="fas fa-qrcode me-1"></i>
                                                <span>Cek QR</span>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="requirements-section mb-2">
                        <div className="requirements-card">
                            <h6 className="requirements-title">
                                <i className="fas fa-info-circle me-1 text-teal-accent"></i>
                                Syarat Penerbitan Sertifikat
                            </h6>
                            <ul className="requirements-list">
                                <li className={allLessonsCompleted ? 'completed' : 'pending'}>
                                    <i className={`fas ${allLessonsCompleted ? 'fa-check-circle text-success' : 'fa-times-circle text-danger'} me-2`}></i>
                                    <span>Tuntaskan 100% materi pelajaran</span>
                                </li>
                                <li className={allQuizzesPassed ? 'completed' : 'pending'}>
                                    <i className={`fas ${allQuizzesPassed ? 'fa-check-circle text-success' : 'fa-times-circle text-danger'} me-2`}></i>
                                    <span>Lulus seluruh evaluasi kuis kursus</span>
                                </li>
                                {hasPrePostTest && (
                                    <li className={postTestCompleted ? 'completed' : 'pending'}>
                                        <i className={`fas ${postTestCompleted ? 'fa-check-circle text-success' : 'fa-times-circle text-danger'} me-2`}></i>
                                        <span>Kerjakan Post-test evaluasi akhir</span>
                                        {!postTestCompleted && allLessonsCompleted && allQuizzesPassed && onStartPosttest && (
                                            <button
                                                type="button"
                                                className="btn btn-xs btn-amber ms-2 py-0 px-2 fw-bold"
                                                onClick={onStartPosttest}
                                            >
                                                <i className="fas fa-play me-1"></i>Kerjakan Post-test
                                            </button>
                                        )}
                                    </li>
                                )}
                            </ul>
                            <div className="requirements-note">
                                <i className="fas fa-shield-alt me-1 text-amber"></i>
                                Sertifikat diterbitkan resmi oleh Setjen DPD RI setelah seluruh syarat terpenuhi.
                            </div>
                        </div>
                    </div>
                )}

                {/* Quiz Results Summary (Compact) */}
                {quizResults.length > 0 && (
                    <div className="quiz-results-summary mt-2">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                            <h6 className="quiz-summary-title mb-0">
                                <i className="fas fa-brain text-teal-accent me-1"></i>Ringkasan Evaluasi Kuis
                            </h6>
                            <span className="quiz-summary-counter">
                                {quizResults.filter(q => q.passed).length}/{quizResults.length} Lulus
                            </span>
                        </div>
                        <div className="quiz-results-list">
                            {quizResults.map((quiz, index) => (
                                <div key={index} className={`quiz-result-item ${quiz.passed ? 'passed' : 'failed'}`}>
                                    <div className="quiz-result-info">
                                        <span className="quiz-result-name" title={quiz.title}>{quiz.title}</span>
                                    </div>
                                    <div className="quiz-result-meta">
                                        <span className="quiz-score-badge">
                                            {quiz.percentage}%
                                        </span>
                                        <span className={`quiz-status-pill ${quiz.passed ? 'pill-success' : 'pill-fail'}`}>
                                            <i className={`fas ${quiz.passed ? 'fa-check' : 'fa-times'} me-1`}></i>
                                            {quiz.passed ? 'Lulus' : 'Gagal'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}


            </div>
        </div>
    );
}

export default CertificateTab;
