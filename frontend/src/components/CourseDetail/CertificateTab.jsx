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

function CertificateTab({ course, enrollmentId, completionPercentage, onCertificateGenerated }) {
    const [certificate, setCertificate] = useState(null);
    const [isEligible, setIsEligible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [quizResults, setQuizResults] = useState([]);
    const certificateRef = useRef();

    // Use WebP with PNG fallback for better performance
    const certificateBackground = certificateBackgroundWebP || certificateBackgroundPNG;

    // Check eligibility for certificate
    const checkEligibility = async () => {
        try {
            const response = await apiInstance.get(`student/certificate-eligibility/${UserData()?.user_id}/${course?.course?.course_id}/`);
            setIsEligible(response.data.is_eligible);
            setQuizResults(response.data.quiz_results || []);
            
            if (response.data.certificate) {
                console.log('✨ Certificate from API:', response.data.certificate); // DEBUG
                console.log('✨ PDF File URL:', response.data.certificate.pdf_file_url); // DEBUG
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

                    console.log('✨ Certificate image saved successfully:', response.data);
                    console.log(`✨ Certificate filename: ${courseId}_${userId}.png`);
                    
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
        const allQuizzesPassed = quizResults.every(quiz => quiz.passed);
        
        return {
            allLessonsCompleted,
            allQuizzesPassed,
            isFullyComplete: allLessonsCompleted && allQuizzesPassed
        };
    };

    const { allLessonsCompleted, allQuizzesPassed, isFullyComplete } = getCompletionStatus();

    return (
        <div className="tab-pane fade" id="certificate" role="tabpanel">
            <div className="certificate-container">
                <div className="certificate-header d-flex justify-content-between align-items-center mb-4">
                    <h4 className="mb-0">
                        <i className="fas fa-certificate me-3 text-warning"></i>
                        Sertifikat Kursus
                    </h4>
                    {certificate && certificate.image_file_url && (
                        <button 
                            className="btn btn-primary"
                            onClick={downloadCertificateFromServer}
                        >
                            <i className="fas fa-download me-2"></i>
                            Unduh Sertifikat
                        </button>
                    )}
                </div>

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

                {/* Eligibility Status */}
                <div className="eligibility-section mb-0">
                    <div className="row">
                        <div className="col-md-6">
                            <div className={`status-card ${allLessonsCompleted ? 'completed' : 'incomplete'}`}>
                                <div className="status-icon">
                                    <i className={`fas ${allLessonsCompleted ? 'fa-check-circle' : 'fa-clock'}`}></i>
                                </div>
                                <div className="status-content">
                                    <h6>Penyelesaian Pelajaran</h6>
                                    <p>{completionPercentage}% Selesai</p>
                                    <small>
                                        {allLessonsCompleted ? 'Semua pelajaran selesai!' : `${100 - completionPercentage}% tersisa`}
                                    </small>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className={`status-card ${allQuizzesPassed ? 'completed' : 'incomplete'}`}>
                                <div className="status-icon">
                                    <i className={`fas ${allQuizzesPassed ? 'fa-check-circle' : 'fa-hourglass-half'}`}></i>
                                </div>
                                <div className="status-content">
                                    <h6>Persyaratan Kuis</h6>
                                    <p>
                                        {quizResults.filter(q => q.passed).length} dari {quizResults.length} Lulus
                                    </p>
                                    <small>
                                        {allQuizzesPassed ? 'Semua kuis lulus!' : 'Selesaikan kuis yang tersisa dengan skor 70% atau lebih'}
                                    </small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quiz Results Summary (if available) - Moved before certificate actions */}
                {quizResults.length > 0 && (
                    <div className="quiz-results-summary mt-4">
                        <h6>Ringkasan Kinerja Kuis</h6>
                        <div className="quiz-results-list">
                            {quizResults.map((quiz, index) => (
                                <div key={index} className={`quiz-result-item ${quiz.passed ? 'passed' : 'failed'}`}>
                                    <div className="quiz-result-info">
                                        <strong>{quiz.title}</strong>
                                        <span className="quiz-score">
                                            {quiz.percentage}% ({quiz.score}/{quiz.total_questions})
                                        </span>
                                    </div>
                                    <div className="quiz-result-status">
                                        <i className={`fas ${quiz.passed ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                                        <span>{quiz.passed ? 'Lulus' : 'Gagal'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Certificate Actions */}
                {isFullyComplete ? (
                    <div className="certificate-actions mb-0">
                        {!certificate ? (
                            <div className="generate-section">
                                <div className="congratulations-card">
                                    <div className="congratulations-content">
                                        <i className="fas fa-trophy congratulations-icon"></i>
                                        <h5>Selamat! 🎉</h5>
                                        <p>Anda telah berhasil menyelesaikan semua persyaratan. Buatlah sertifikat penyelesaian kursus Anda sekarang!</p>
                                        <button 
                                            className="btn btn-primary btn-lg generate-btn"
                                            onClick={generateCertificate}
                                            disabled={generating}
                                        >
                                            {generating ? (
                                                <>
                                                    <div className="spinner-border spinner-border-sm me-2"></div>
                                                    Membuat...
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fas fa-award me-2"></i>
                                                    Buat Sertifikat
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <div className="requirements-section">
                        <div className="requirements-card">
                            <h6>
                                <i className="fas fa-info-circle me-2 text-info"></i>
                                Persyaratan Sertifikat
                            </h6>
                            <ul className="requirements-list">
                                <li className={allLessonsCompleted ? 'completed' : ''}>
                                    <i className={`fas ${allLessonsCompleted ? 'fa-check' : 'fa-times'} me-2`}></i>
                                    Selesaikan semua pelajaran kursus (100%)
                                </li>
                                <li className={allQuizzesPassed ? 'completed' : ''}>
                                    <i className={`fas ${allQuizzesPassed ? 'fa-check' : 'fa-times'} me-2`}></i>
                                    Lulus semua kuis dengan skor 70% atau lebih
                                </li>
                            </ul>
                            <p className="requirements-note">
                                <i className="fas fa-lightbulb me-2 text-warning"></i>
                                Setelah Anda memenuhi semua persyaratan, Anda dapat membuat dan mengunduh sertifikat profesional Anda.
                            </p>
                        </div>
                    </div>
                )}


            </div>
        </div>
    );
}

export default CertificateTab;
