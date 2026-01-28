import React, { useState, useEffect, useRef } from 'react';
import dayjs, { moment } from '../../utils/dayjs';
import apiInstance from '../../utils/axios';
import UserData from '../../views/plugin/UserData';
import Toast from '../../views/plugin/Toast';
import QRCode from 'qrcode.react';
import certificateBackgroundWebP from '../../assets/certificate-bg.webp';
import certificateBackgroundPNG from '../../assets/certificate-bg.png';
import './CertificateTab.css';

function CertificateTab({ course, enrollmentId, completionPercentage }) {
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
                setCertificate(response.data.certificate);
            }
        } catch (error) {
            console.error("Error checking certificate eligibility:", error);
        }
    };

    // Generate certificate
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
                Toast().fire({
                    icon: 'success',
                    title: 'Sertifikat Berhasil Dibuat!',
                    text: 'Sertifikat Anda telah berhasil dibuat.'
                });
            }
        } catch (error) {
            console.error("Error generating certificate:", error);
            Toast().fire({
                icon: 'error',
                title: 'Gagal Membuat Sertifikat',
                text: error.response?.data?.detail || 'Gagal membuat sertifikat.'
            });
        } finally {
            setGenerating(false);
        }
    };

    // Download certificate as PDF
    const downloadCertificate = async () => {
        if (!certificate) return;

        try {
            // For now, use the browser's print functionality to "download" as PDF
            printCertificate();
            
            Toast().fire({
                icon: 'info',
                title: 'Cetak ke PDF',
                text: 'Gunakan dialog cetak browser Anda untuk menyimpan sebagai PDF.'
            });
        } catch (error) {
            console.error("Error downloading certificate:", error);
            Toast().fire({
                icon: 'error',
                title: 'Unduhan Gagal',
                text: 'Gagal mengunduh sertifikat.'
            });
        }
    };

    // Print certificate
    const printCertificate = () => {
        if (certificateRef.current) {
            const printContent = certificateRef.current.innerHTML;
            const originalContent = document.body.innerHTML;
            
            document.body.innerHTML = printContent;
            window.print();
            document.body.innerHTML = originalContent;
            window.location.reload(); // Reload to restore the page
        }
    };

    useEffect(() => {
        if (course?.course?.course_id) {
            checkEligibility();
        }
    }, [course]);

    const formatDate = (date) => {
        return moment(date).format('MMMM D, YYYY');
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
                <div className="certificate-header">
                    <h4 className="mb-4">
                        <i className="fas fa-certificate me-3 text-warning"></i>
                        Sertifikat Kursus
                    </h4>
                </div>

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

                {/* Certificate Actions */}
                {isFullyComplete ? (
                    <div className="certificate-actions mb-0">
                        {!certificate ? (
                            <div className="generate-section">
                                <div className="congratulations-card">
                                    <div className="congratulations-content">
                                        <i className="fas fa-trophy congratulations-icon"></i>
                                        <h5>Selamat! 🎉</h5>
                                        <p>Anda telah berhasil menyelesaikan semua persyaratan kursus ini. Buatlah sertifikat profesional Anda sekarang!</p>
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
                        ) : (
                            <div className="certificate-ready">
                                <div className="certificate-actions-buttons">
                                    <button 
                                        className="btn btn-success btn-lg me-3"
                                        onClick={downloadCertificate}
                                    >
                                        <i className="fas fa-download me-2"></i>
                                        Simpan sebagai PDF
                                    </button>
                                    <button 
                                        className="btn btn-outline-primary btn-lg"
                                        onClick={printCertificate}
                                    >
                                        <i className="fas fa-print me-2"></i>
                                        Cetak
                                    </button>
                                </div>
                            </div>
                        )}
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

                {/* Certificate Preview */}
                {certificate && (
                    <div className="certificate-preview mt-0">
                        <h5 className="mb-4">Pratinjau Sertifikat</h5>
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
                                <div className="certificate-id">
                                    <span>Certificate ID: {certificate.certificate_id}</span>
                                </div>
                                <h5 className="show-student">Ini adalah untuk memastikan bahwa:</h5>
                                <h2 className="student-name">{UserData()?.full_name}</h2>
                                <div className="certificate-body">
                                    <h6 className="show-course-title">telah berhasil menyelesaikan kursus</h6>
                                    <h3 className="course-title">{course?.course?.title}</h3>
                                </div>
                                <div className="course-instructor">
                                    <h6 className="show-instructor">dengan prestasi cemerlang, menunjukkan penguasaan dalam semua</h6>
                                    <h6 className="show-instructor">materi kursus dan penilaian oleh</h6>
                                    <span>{course?.course?.teacher?.full_name}</span>
                                </div>
                                <div className="certificate-date">
                                    <strong>Tanggal Penyelesaian:</strong>
                                    <span>{formatDate(certificate.date)}</span>
                                </div>
                                
                                {/* QR Code for Certificate Validation */}
                                {certificate.qr_code_url && (
                                    <div className="certificate-qr-code">
                                        <QRCode 
                                            value={certificate.qr_code_url}
                                            size={100}
                                            level="H"
                                            includeMargin={false}
                                            renderAs="svg"
                                        />
                                        <p className="qr-label">Pindai untuk Verifikasi</p>
                                    </div>
                                )}
                            </div>
                            
                        </div>
                    </div>
                )}

                {/* Quiz Results Summary (if available) */}
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
            </div>
        </div>
    );
}

export default CertificateTab;
