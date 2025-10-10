import React, { useState, useEffect, useRef } from 'react';
import moment from 'moment';
import apiInstance from '../../utils/axios';
import UserData from '../../views/plugin/UserData';
import Toast from '../../views/plugin/Toast';
import certificateBackground from '../../assets/certificate-bg.png';
import './CertificateTab.css';

function CertificateTab({ course, enrollmentId, completionPercentage }) {
    const [certificate, setCertificate] = useState(null);
    const [isEligible, setIsEligible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [quizResults, setQuizResults] = useState([]);
    const certificateRef = useRef();

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
                    title: 'Certificate Generated!',
                    text: 'Your certificate has been successfully generated.'
                });
            }
        } catch (error) {
            console.error("Error generating certificate:", error);
            Toast().fire({
                icon: 'error',
                title: 'Generation Failed',
                text: error.response?.data?.detail || 'Failed to generate certificate.'
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
                title: 'Print to PDF',
                text: 'Use your browser\'s print dialog to save as PDF.'
            });
        } catch (error) {
            console.error("Error downloading certificate:", error);
            Toast().fire({
                icon: 'error',
                title: 'Download Failed',
                text: 'Failed to download certificate.'
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
        return moment(date).format('MMMM Do, YYYY');
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
                        Course Certificate
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
                                    <h6>Lesson Completion</h6>
                                    <p>{completionPercentage}% Complete</p>
                                    <small>
                                        {allLessonsCompleted ? 'All lessons completed!' : `${100 - completionPercentage}% remaining`}
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
                                    <h6>Quiz Requirements</h6>
                                    <p>
                                        {quizResults.filter(q => q.passed).length} of {quizResults.length} Passed
                                    </p>
                                    <small>
                                        {allQuizzesPassed ? 'All quizzes passed!' : 'Complete remaining quizzes with 70% or higher'}
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
                                        <h5>Congratulations! 🎉</h5>
                                        <p>You've successfully completed all requirements for this course. Generate your professional certificate now!</p>
                                        <button 
                                            className="btn btn-primary btn-lg generate-btn"
                                            onClick={generateCertificate}
                                            disabled={generating}
                                        >
                                            {generating ? (
                                                <>
                                                    <div className="spinner-border spinner-border-sm me-2"></div>
                                                    Generating...
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fas fa-award me-2"></i>
                                                    Generate Certificate
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
                                        Save as PDF
                                    </button>
                                    <button 
                                        className="btn btn-outline-primary btn-lg"
                                        onClick={printCertificate}
                                    >
                                        <i className="fas fa-print me-2"></i>
                                        Print
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
                                Certificate Requirements
                            </h6>
                            <ul className="requirements-list">
                                <li className={allLessonsCompleted ? 'completed' : ''}>
                                    <i className={`fas ${allLessonsCompleted ? 'fa-check' : 'fa-times'} me-2`}></i>
                                    Complete all course lessons (100%)
                                </li>
                                <li className={allQuizzesPassed ? 'completed' : ''}>
                                    <i className={`fas ${allQuizzesPassed ? 'fa-check' : 'fa-times'} me-2`}></i>
                                    Pass all quizzes with 70% or higher score
                                </li>
                            </ul>
                            <p className="requirements-note">
                                <i className="fas fa-lightbulb me-2 text-warning"></i>
                                Once you meet all requirements, you can generate and download your professional certificate.
                            </p>
                        </div>
                    </div>
                )}

                {/* Certificate Preview */}
                {certificate && (
                    <div className="certificate-preview mt-0">
                        <h5 className="mb-4">Certificate Preview</h5>
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
                                    <span>{certificate.certificate_id}</span>
                                </div>
                                <h2 className="student-name">{UserData()?.full_name}</h2>
                                <div className="certificate-body">
                                    <h3 className="course-title">{course?.course?.title}</h3>
                                </div>
                                <div className="course-instructor">
                                    <span>{course?.course?.teacher?.full_name}</span>
                                </div>
                                <div className="certificate-date">
                                    <strong>Date of Completion:</strong>
                                    <span>{formatDate(certificate.date)}</span>
                                </div>
                            </div>
                            
                        </div>
                    </div>
                )}

                {/* Quiz Results Summary (if available) */}
                {quizResults.length > 0 && (
                    <div className="quiz-results-summary mt-4">
                        <h6>Quiz Performance Summary</h6>
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
                                        <span>{quiz.passed ? 'Passed' : 'Failed'}</span>
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
