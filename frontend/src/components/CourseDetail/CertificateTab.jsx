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
import './CertificateTab.css';

function CertificateTab({ course, enrollmentId, completionPercentage, onCertificateGenerated, isInline = false, onStartPosttest = null }) {
    const [certificate, setCertificate] = useState(null);
    const [isEligible, setIsEligible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [quizResults, setQuizResults] = useState([]);
    const [eligibilityData, setEligibilityData] = useState(null);
    const certificateRef = useRef();

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

    // ✨ PHASE 4.222: Generate certificate image (PNG) with filename format: {course_id}_{user_id}.png
    // ✨ PHASE 4.225: Updated to notify parent component with complete certificate data after image is saved
    const generateAndSaveImage = async (certificateData, onCertificateGenerated) => {
        try {
            if (!certificateRef.current) return;

            // Get the certificate element
            const certificateElement = certificateRef.current;
            const userId = UserData()?.user_id;
            const courseId = course?.course?.course_id;
            
            // ✨ PHASE 4.222: Convert HTML to canvas (as PNG for display)
            const canvas = await html2canvas(certificateElement, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            // ✨ PHASE 4.222: Convert canvas to PNG image blob
            canvas.toBlob(async (blob) => {
                try {
                    // Send PNG image to server for storage with filename: course_id_user_id.png
                    const formData = new FormData();
                    formData.append('file', blob, `${courseId}_${userId}.png`);
                    formData.append('user_id', userId);
                    formData.append('course_id', courseId);

                    const response = await apiInstance.post('student/certificate-save-image/', formData, {
                        headers: {
                            'Content-Type': 'multipart/form-data'
                        }
                    });

                    
                    // ✨ PHASE 4.225: Refresh certificate data to show the image
                    const certResponse = await apiInstance.get(
                        `student/certificate-eligibility/${userId}/${courseId}/`
                    );
                    if (certResponse.data.certificate) {
                        const updatedCertificate = certResponse.data.certificate;
                        setCertificate(updatedCertificate);
                        
                        // ✨ PHASE 4.225: NOW notify parent component with COMPLETE certificate data (includes image_file_url)
                        if (onCertificateGenerated) {
                            onCertificateGenerated(updatedCertificate);
                        }
                    }
                    
                } catch (error) {
                    console.error('Error saving certificate image:', error);
                }
            }, 'image/png');

        } catch (error) {
            console.error('Error generating certificate image:', error);
        }
    };

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

                {/* ✨ PHASE 4.224: Certificate display moved to main course view, only show fallback if pending */}
                {/* ✨ PHASE 49: Added ref to scroll to certificate display area after creation */}
                {certificate && !certificate.image_file_url ? (
                    // ✨ PHASE 4.222: Fallback to manual certificate if image not yet generated
                    <div className="certificate-display" style={{ border: '2px solid #f39c12', borderRadius: '8px' }}>
                        <p className="text-center text-muted mb-3">
                            {certificate.image_file_url === undefined 
                                ? '❌ Gambar sertifikat tidak tersedia. Mohon tunggu atau segarkan halaman.'
                                : 'Sertifikat Anda sedang diproses. Silakan unduh atau segarkan halaman.'
                            }
                        </p>
                        <div 
                            className="certificate-document" 
                            ref={certificateRef}
                        >
                            <img 
                                src={certificateBackground}
                                alt="Certificate Background" 
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                    zIndex: 0
                                }}
                            />
                            <div className="certificate-content">
                                {/* Certificate Number Section - Professional Format */}
                                <div className="certificate-number-section">
                                    <span className="certificate-number">
                                        <strong>Nomor:</strong> {certificate.formatted_certificate_id}
                                    </span>
                                </div>
                                
                                {/* Certificate Statement */}
                                <div className="certificate-statement">
                                    <p className="statement-intro">Diberikan kepada:</p>
                                </div>

                                {/* Student Name - Highlighted Section */}
                                <div className="student-section">
                                    <h2 className="student-name">{UserData()?.full_name}</h2>
                                </div>

                                {/* Course Completion Statement */}
                                <div className="completion-statement">
                                    <p>telah berhasil menyelesaikan program pembelajaran</p>
                                    <h3 className="course-title">{course?.course?.title}</h3>
                                    <p className="statement-middle">
                                        dengan sangat baik serta menunjukkan pemahaman penuh atas semua materi pembelajaran 
                                        dan telah memenuhi semua penilaian yang dipersyaratkan setara dengan {course?.course?.total_jam_pelatihan || 0}JP di LMSetjen DPD RI
                                    </p>
                                </div>

                                {/* Instructor Information Section */}
                                <div className="instructor-section">
                                    <p className="certification-by">Disertifikasi oleh:</p>
                                    <p className="instructor-name">{course?.course?.teacher?.full_name}</p>
                                </div>

                                {/* Date Section */}
                                <div className="date-section">
                                    <p className="date-label">Tanggal Penyelesaian:</p>
                                    <p className="date-value">{formatDate(certificate.date)}</p>
                                </div>
                                
                                {/* QR Code for Certificate Validation */}
                                {certificate.qr_code_url && (
                                    <div className="certificate-qr-code">
                                        <QRCode 
                                            value={certificate.qr_code_url}
                                            size={100}
                                            level="H"
                                            includeMargin={false}
                                            renderAs="canvas"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : null}

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
                            <div className="generate-section">
                                <div className="congratulations-card">
                                    <div className="congratulations-content">
                                        <div className="d-flex align-items-center justify-content-center gap-2 mb-1">
                                            <i className="fas fa-award congratulations-icon"></i>
                                            <h6 className="mb-0 fw-bold">Selamat! Kursus Telah Tuntas 🎉</h6>
                                        </div>
                                        <p className="congratulations-desc mb-2">
                                            Semua materi dan penilaian telah berhasil diselesaikan. Silakan buat sertifikat resmi Anda sekarang.
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
                                        <i className="fas fa-check-circle me-1"></i>Terverifikasi
                                    </span>
                                </div>
                                <div className="cert-issued-body mt-2 pt-2 border-top">
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <span className="cert-number-label">Nomor Sertifikat:</span>
                                        <span className="cert-number-val font-monospace">{certificate.formatted_certificate_id || certificate.certificate_id}</span>
                                    </div>
                                    <div className="d-flex gap-2 justify-content-end">
                                        <button 
                                            className="btn btn-sm btn-teal"
                                            onClick={downloadCertificateFromServer}
                                        >
                                            <i className="fas fa-download me-1"></i>
                                            Unduh File
                                        </button>
                                        {certificate.qr_code_url && (
                                            <a
                                                href={certificate.qr_code_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="btn btn-sm btn-outline-teal"
                                            >
                                                <i className="fas fa-qrcode me-1"></i>
                                                Cek QR
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
