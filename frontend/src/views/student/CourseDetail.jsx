import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import Modal from "react-bootstrap/Modal";
import dayjs, { moment } from "../../utils/dayjs";
import Swal from "sweetalert2";

import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import LecturesTab from "../../components/CourseDetail/LecturesTab";
import CertificateTab from "../../components/CourseDetail/CertificateTab";
import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import { getMediaUrl, DEFAULT_IMAGE_URL } from "../../utils/constants";
import "./CourseDetail.css";
import apiInstance from "../../utils/axios";

function CourseDetail() {
    // Course data and progress
    const [course, setCourse] = useState([]);
    const [isUpdatingCourse, setIsUpdatingCourse] = useState(false);
    const [isProgressCardLoading, setIsProgressCardLoading] = useState(true); // Track progress card loading state
    const [completionPercentage, setCompletionPercentage] = useState(0);
    const [completionStats, setCompletionStats] = useState({
        totalLessons: 0,
        completedLessons: 0,
        totalQuizzes: 0,
        passedQuizzes: 0
    });
    
    // Video player modal (shared with LecturesTab)
    const [show, setShow] = useState(false);
    const [variantItem, setVariantItem] = useState(null);
    
    // Notes management
    const [noteShow, setNoteShow] = useState(false);
    const [createNote, setCreateNote] = useState({ title: "", note: "", color: "#f39c12" });
    const [selectedNote, setSelectedNote] = useState(null);
    const [selectedNoteColor, setSelectedNoteColor] = useState("#f39c12");
    
    // Q&A management
    const [questions, setQuestions] = useState([]);
    const [addQuestionShow, setAddQuestionShow] = useState(false);
    const [ConversationShow, setConversationShow] = useState(false);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [createMessage, setCreateMessage] = useState({ title: "", message: "" });
    
    // Review management
    const [createReview, setCreateReview] = useState({ rating: 1, review: "" });
    const [studentReview, setStudentReview] = useState([]);
    const [isEditingReview, setIsEditingReview] = useState(false);

    // Quiz management
    const [quizzes, setQuizzes] = useState([]);
    const [selectedQuiz, setSelectedQuiz] = useState(null);
    const [quizShow, setQuizShow] = useState(false);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [quizAnswers, setQuizAnswers] = useState({});
    const [timeRemaining, setTimeRemaining] = useState(60);
    const [isQuizActive, setIsQuizActive] = useState(false);
    const [quizStartTime, setQuizStartTime] = useState(null);
    const [quizResult, setQuizResult] = useState(null);
    const [showQuizResult, setShowQuizResult] = useState(false);
    const [courseId, setCourseId] = useState(null);
    const [isTimeExpired, setIsTimeExpired] = useState(false);
    const [quizResumeData, setQuizResumeData] = useState(null);

    const param = useParams();
    const lastElementRef = useRef();
    const quizTimerRef = useRef(null);
    const saveCounterRef = useRef(0);
    const currentQuizStateRef = useRef({
        answers: {},
        questionIndex: 0,
        startTime: null
    });

    const handleNoteChange = (event) => {
        setCreateNote({
            ...createNote,
            [event.target.name]: event.target.value,
        });
    };

    const handleNoteClose = () => {
        setNoteShow(false);
        setSelectedNote(null);
        setCreateNote({ title: "", note: "", color: "#f39c12" });
        setSelectedNoteColor("#f39c12");
    };
    
    const handleNoteShow = (note) => {
        setNoteShow(true);
        setSelectedNote(note);
        if (note) {
            // Load existing note data for editing
            setCreateNote({
                title: note.title || "",
                note: note.note || "",
                color: note.color || "#f39c12"
            });
            setSelectedNoteColor(note.color || "#f39c12");
        } else {
            // Reset for new note
            setCreateNote({ title: "", note: "", color: "#f39c12" });
            setSelectedNoteColor("#f39c12");
        }
    };

    const handleConversationClose = () => setConversationShow(false);
    const handleConversationShow = (conversation) => {
        setConversationShow(true);
        setSelectedConversation(conversation);
    };

    const handleQuestionClose = () => setAddQuestionShow(false);
    const handleQuestionShow = () => setAddQuestionShow(true);

    // Quiz handlers
    const handleQuizClose = () => {
        setQuizShow(false);
        setSelectedQuiz(null);
        setCurrentQuestionIndex(0);
        setQuizAnswers({});
        setTimeRemaining(60);
        setIsQuizActive(false);
        setQuizStartTime(null);
        setShowQuizResult(false);
        setQuizResult(null);
        setIsTimeExpired(false);
        
        // Clear timer if active
        if (quizTimerRef.current) {
            clearInterval(quizTimerRef.current);
            quizTimerRef.current = null;
        }
    };

    const handleQuizShow = async (quiz) => {
        try {
            // Fetch full quiz details with questions and choices
            const response = await apiInstance.get(`student/quiz-detail/${UserData()?.user_id}/${quiz.quiz_id}/`);
            const fullQuizData = response.data;
            
            // Preserve attempt info from the quiz list
            const quizWithAttemptInfo = {
                ...fullQuizData,
                can_attempt: quiz.can_attempt,
                today_attempts: quiz.today_attempts,
                best_score: quiz.best_score,
                is_passed: quiz.is_passed
            };
            
            setSelectedQuiz(quizWithAttemptInfo);
            setQuizShow(true);
            setCurrentQuestionIndex(0);
            setQuizAnswers({});
            setTimeRemaining(60);
            setShowQuizResult(false);
            setQuizResult(null);
            setIsQuizActive(false);
        } catch (error) {
            Toast().fire({
                icon: "error",
                title: "Gagal memuat detail kuis"
            });
        }
    };

    const startQuiz = () => {
        // Check if there's resume data for this quiz (in case auto-resume didn't trigger)
        const resumeData = loadQuizProgress(selectedQuiz);
        
        if (resumeData && resumeData.timeRemaining > 0) {
            // Show resume dialog for manual quiz start
            showResumeDialog(selectedQuiz, resumeData);
        } else {
            // Start new quiz
            startNewQuiz(selectedQuiz);
        }
    };

    // Start a new quiz
    const startNewQuiz = (quiz) => {
        // Double check attempt limit on frontend (backend will also validate)
        if (!quiz?.can_attempt) {
            Toast().fire({
                icon: "error",
                title: "Batas percobaan harian tercapai (3/3). Silakan coba lagi besok."
            });
            return;
        }
        
        if (quiz && quiz.questions && quiz.questions.length > 0) {
            // Clear any existing timer
            if (quizTimerRef.current) {
                clearInterval(quizTimerRef.current);
                quizTimerRef.current = null;
            }
            
            setIsQuizActive(true);
            setQuizStartTime(Date.now());
            setCurrentQuestionIndex(0);
            setQuizAnswers({});
            setTimeRemaining(quiz.questions.length * 60); // 1 minute per question
            setShowQuizResult(false);
            setIsTimeExpired(false);
            
            // Update ref for timer access
            currentQuizStateRef.current = {
                answers: {},
                questionIndex: 0,
                startTime: Date.now()
            };
            
            // Start timer after a brief delay
            setTimeout(() => {
                saveCounterRef.current = 0;
                quizTimerRef.current = setInterval(() => {
                    setTimeRemaining(prev => {
                        saveCounterRef.current++;
                        
                        // Save progress every 10 seconds
                        if (saveCounterRef.current >= 10) {
                            const currentState = currentQuizStateRef.current;
                            saveQuizProgress(quiz, currentState.answers, currentState.questionIndex, prev - 1, currentState.startTime);
                            saveCounterRef.current = 0;
                        }
                        
                        if (prev <= 1) {
                            clearInterval(quizTimerRef.current);
                            quizTimerRef.current = null;
                            setIsTimeExpired(true);
                            
                            // Show time's up notification
                            Toast().fire({
                                icon: "warning",
                                title: "Waktu Habis!",
                                text: "Waktu kuis telah habis. Jawaban Anda akan dikirim secara otomatis.",
                                timer: 3000
                            });
                            
                            // Auto-submit after a short delay to show the notification
                            setTimeout(() => {
                                autoSubmitQuiz();
                            }, 1500);
                            
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            }, 500);
        } else {
            Toast().fire({
                icon: "error",
                title: "Pertanyaan kuis tidak tersedia. Silakan coba lagi."
            });
        }
    };

    // Resume an existing quiz
    const resumeQuiz = (quiz, resumeData) => {
        if (quiz && quiz.questions && quiz.questions.length > 0) {
            // Clear any existing timer
            if (quizTimerRef.current) {
                clearInterval(quizTimerRef.current);
                quizTimerRef.current = null;
            }
            
            setIsQuizActive(true);
            setQuizShow(true); // Fixed: was setShowQuizModal(true)
            setQuizStartTime(resumeData.startTime);
            setCurrentQuestionIndex(resumeData.currentQuestionIndex);
            setQuizAnswers(resumeData.answers);
            setTimeRemaining(resumeData.timeRemaining);
            setShowQuizResult(false);
            setIsTimeExpired(false);
            
            // Update ref for timer access
            currentQuizStateRef.current = {
                answers: resumeData.answers,
                questionIndex: resumeData.currentQuestionIndex,
                startTime: resumeData.startTime
            };

            // Start timer with remaining time
            setTimeout(() => {
                let saveCounter = 0;
                quizTimerRef.current = setInterval(() => {
                    setTimeRemaining(prev => {
                        saveCounter++;
                        
                        // Save progress every 10 seconds
                        if (saveCounter >= 10) {
                            const currentAnswers = quizAnswers;
                            const currentIndex = currentQuestionIndex;
                            const startTime = resumeData.startTime;
                            saveQuizProgress(quiz, currentAnswers, currentIndex, prev - 1, startTime);
                            saveCounter = 0;
                        }
                        
                        if (prev <= 1) {
                            clearInterval(quizTimerRef.current);
                            quizTimerRef.current = null;
                            setIsTimeExpired(true);
                            
                            // Show time's up notification
                            Toast().fire({
                                icon: "warning",
                                title: "Waktu Habis!",
                                text: "Waktu kuis telah habis. Jawaban Anda akan dikirim secara otomatis.",
                                timer: 3000
                            });
                            
                            // Auto-submit after a short delay to show the notification
                            setTimeout(() => {
                                autoSubmitQuiz();
                            }, 1500);
                            
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            }, 500);
            
            Toast().fire({
                icon: "success",
                title: "Kuis Dilanjutkan dengan Berhasil! 🎯",
                text: "Melanjutkan dari tempat Anda berhenti. Semoga beruntung!"
            });
        } else {
            Toast().fire({
                icon: "error",
                title: "Lanjutkan Gagal",
                text: "Tidak dapat melanjutkan kuis. Silakan coba mulai kuis baru."
            });
        }
    };

    const submitQuiz = async () => {
        if (!selectedQuiz || !isQuizActive) return;
        
        try {
            // Clear timer first
            if (quizTimerRef.current) {
                clearInterval(quizTimerRef.current);
                quizTimerRef.current = null;
            }
            
            setIsQuizActive(false);
            const endTime = Date.now();
            const timeTaken = quizStartTime ? Math.floor((endTime - quizStartTime) / 1000) : 0;
            
            // Convert quizAnswers object to the format expected by backend
            const formattedAnswers = Object.entries(quizAnswers).map(([questionId, choiceId]) => ({
                question_id: questionId,
                choice_id: choiceId.toString()
            }));
            
            const submissionData = {
                quiz_id: selectedQuiz.quiz_id,
                answers: formattedAnswers,
                time_taken: timeTaken
            };
            
            const response = await useAxios.post(`student/quiz-submit/${UserData()?.user_id}/`, submissionData);
            
            if (response.data) {
                setQuizResult(response.data);
                setShowQuizResult(true);
                
                // Clear quiz progress since quiz is completed
                clearQuizProgress(selectedQuiz);
                
                // Update the selected quiz with new attempt information
                if (selectedQuiz) {
                    setSelectedQuiz({
                        ...selectedQuiz,
                        today_attempts: response.data.today_attempts,
                        can_attempt: response.data.can_attempt,
                        best_score: Math.max(selectedQuiz.best_score || 0, response.data.score),
                        is_passed: response.data.passed || selectedQuiz.is_passed
                    });
                }
                
                // Refresh course data which will recalculate completion percentage including quizzes
                await fetchCourseDetail(true); // true = prevent loading state
            }
        } catch (error) {
            Toast().fire({
                icon: "error",
                title: "Gagal mengirim kuis. Silakan coba lagi."
            });
            setIsQuizActive(false);
        }
    };

    // Auto-submit function for when time expires (less restrictive)
    const autoSubmitQuiz = async () => {
        if (!selectedQuiz) {
            return;
        }
        
        try {
            // Clear timer first
            if (quizTimerRef.current) {
                clearInterval(quizTimerRef.current);
                quizTimerRef.current = null;
            }
            
            // Set quiz as inactive
            setIsQuizActive(false);
            const endTime = Date.now();
            const timeTaken = quizStartTime ? Math.floor((endTime - quizStartTime) / 1000) : 0;
            
            // Convert quizAnswers object to the format expected by backend
            const currentAnswers = currentQuizStateRef.current?.answers || quizAnswers;
            const formattedAnswers = Object.entries(currentAnswers).map(([questionId, choiceId]) => ({
                question_id: questionId,
                choice_id: choiceId.toString()
            }));
            
            const submissionData = {
                quiz_id: selectedQuiz.quiz_id,
                answers: formattedAnswers,
                time_taken: timeTaken
            };
            
            const response = await useAxios.post(`student/quiz-submit/${UserData()?.user_id}/`, submissionData);
            
            if (response.data) {
                setQuizResult(response.data);
                setShowQuizResult(true);
                
                // Clear quiz progress since quiz is completed
                clearQuizProgress(selectedQuiz);
                
                // Update the selected quiz with new attempt information
                if (selectedQuiz) {
                    setSelectedQuiz({
                        ...selectedQuiz,
                        today_attempts: response.data.today_attempts,
                        can_attempt: response.data.can_attempt,
                        best_score: Math.max(selectedQuiz.best_score || 0, response.data.score),
                        is_passed: response.data.passed || selectedQuiz.is_passed
                    });
                }
                
                // Refresh course data which will recalculate completion percentage including quizzes
                await fetchCourseDetail(true); // true = prevent loading state
                
                // Tampilkan pesan sukses untuk pengiriman otomatis
                Toast().fire({
                    icon: "info",
                    title: "Kuis Dikirim Secara Otomatis dengan Berhasil!",
                    text: "Jawaban Anda telah dikirim karena waktu telah habis.",
                    timer: 4000
                });
            }
        } catch (error) {
            Toast().fire({
                icon: "error",
                title: "Pengiriman otomatis gagal",
                text: "Gagal mengirim kuis secara otomatis. Silakan coba lagi secara manual."
            });
            setIsQuizActive(false);
        }
    };

    // Helper function to calculate overall completion percentage including lessons and quizzes
    const calculateCompletionPercentage = (totalLessons, completedLessons, totalQuizzes = 0, passedQuizzes = 0) => {
        // Calculate total items (lessons + quizzes)
        const totalItems = totalLessons + totalQuizzes;
        const completedItems = completedLessons + passedQuizzes;
        
        // Calculate percentage with safety checks
        let percentageCompleted = 0;
        if (totalItems > 0) {
            percentageCompleted = Math.min(100, Math.max(0, (completedItems / totalItems) * 100));
        }
        
        setCompletionPercentage(Math.round(percentageCompleted));
        setCompletionStats({
            totalLessons,
            completedLessons,
            totalQuizzes,
            passedQuizzes
        });
        
        // Mark progress card as loaded
        setIsProgressCardLoading(false);
        
        return Math.round(percentageCompleted);
    };

    const fetchCourseDetail = async (preventLoadingState = false) => {
        if (!preventLoadingState) {
            setIsUpdatingCourse(true);
        }
        
        useAxios.get(`student/course-detail/${UserData()?.user_id}/${param.enrollment_id}/`).then((res) => {
            setCourse(res.data);
            setQuestions(res.data.question_answer);
            setStudentReview(res.data.review);
            
            // Calculate total lessons from curriculum more accurately
            const totalLessons = res.data.curriculum?.reduce((total, section) => {
                const sectionItems = section.variant_items || section.items || [];
                return total + sectionItems.length;
            }, 0) || 0;
            
            // Count unique completed lessons (avoid duplicates)
            const completedLessonsSet = new Set();
            res.data.completed_lesson?.forEach(cl => {
                const itemId = cl.variant_item?.variant_item_id; // Use consistent variant_item_id
                if (itemId) {
                    completedLessonsSet.add(itemId.toString());
                }
            });
            const completedLessons = completedLessonsSet.size;
            
            // Store course ID for quiz operations
            const currentCourseId = res.data.course?.course_id;
            setCourseId(currentCourseId);
            
            // Fetch quizzes and calculate completion percentage after quizzes are loaded
            if (currentCourseId) {
                fetchQuizzes(currentCourseId, totalLessons, completedLessons);
            } else {
                // No quizzes, just calculate based on lessons
                calculateCompletionPercentage(totalLessons, completedLessons, 0, 0);
            }
        }).catch((error) => {
            console.error("Error fetching course detail:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat detail kursus",
                text: "Silakan segarkan halaman untuk mencoba lagi.",
                timer: 4000
            });
        }).finally(() => {
            setIsUpdatingCourse(false);
        });
    };

    // Quiz Resume Functions
    const saveQuizProgress = (quizData, answers, currentIndex, timeLeft, startTime) => {
        // Validate inputs
        if (!quizData || !quizData.quiz_id || !UserData()?.user_id) {
            return;
        }
        
        if (timeLeft <= 0) {
            return;
        }
        
        const progressData = {
            quiz: quizData,
            answers: answers || {},
            currentQuestionIndex: currentIndex || 0,
            timeRemaining: timeLeft,
            startTime: startTime || Date.now(),
            courseId: courseId,
            userId: UserData().user_id,
            timestamp: Date.now(),
            version: "1.0" // For future compatibility
        };
        
        const progressKey = `quiz_progress_${UserData().user_id}_${quizData.quiz_id}`;
        
        try {
            localStorage.setItem(progressKey, JSON.stringify(progressData));
        } catch (error) {
            console.error("Failed to save quiz progress:", error);
            
            // If storage is full, try to clean up old quiz progress
            if (error.name === "QuotaExceededError") {
                cleanupOldQuizProgress();
                try {
                    localStorage.setItem(progressKey, JSON.stringify(progressData));
                } catch (retryError) {
                    console.error("Still failed to save quiz progress after cleanup:", retryError);
                }
            }
        }
    };

    // Cleanup function for old quiz progress
    const cleanupOldQuizProgress = () => {
        const maxAge = 2 * 60 * 60 * 1000; // 2 hours
        const keys = Object.keys(localStorage);
        let cleanedCount = 0;
        
        keys.forEach(key => {
            if (key.startsWith("quiz_progress_")) {
                try {
                    const data = localStorage.getItem(key);
                    if (data) {
                        const parsed = JSON.parse(data);
                        if (Date.now() - parsed.timestamp > maxAge) {
                            localStorage.removeItem(key);
                            cleanedCount++;
                        }
                    }
                } catch (error) {
                    // Remove corrupted data
                    localStorage.removeItem(key);
                    cleanedCount++;
                }
            }
        });
    };

    const loadQuizProgress = (quizData) => {
        // Handle both quiz objects and quiz IDs
        const quizId = typeof quizData === "string" ? quizData : quizData?.quiz_id;
        if (!quizId) {
            return null;
        }
        
        const progressKey = `quiz_progress_${UserData()?.user_id}_${quizId}`;
        const savedProgress = localStorage.getItem(progressKey);
        
        if (savedProgress) {
            try {
                const progressData = JSON.parse(savedProgress);
                
                // Validate progress data structure
                const isValidData = progressData && 
                                   typeof progressData.timeRemaining === "number" &&
                                   typeof progressData.currentQuestionIndex === "number" &&
                                   progressData.answers &&
                                   progressData.quiz &&
                                   progressData.startTime;
                
                if (!isValidData) {
                    localStorage.removeItem(progressKey);
                    return null;
                }
                
                // Check if progress is from the last 2 hours (quiz session timeout)
                const maxAge = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
                
                if (Date.now() - progressData.timestamp <= maxAge && progressData.timeRemaining > 0) {
                    return progressData;
                } else {
                    localStorage.removeItem(progressKey);
                }
            } catch (error) {
                console.error("Error parsing saved quiz progress:", error);
                localStorage.removeItem(progressKey); // Clean up corrupted data
            }
        }
        
        return null;
    };

    // Helper function to check if a quiz has saved progress (for resume functionality)
    const hasQuizProgress = (quizData) => {
        const quizId = typeof quizData === "string" ? quizData : quizData?.quiz_id;
        if (!quizId) return false;
        
        const progressKey = `quiz_progress_${UserData()?.user_id}_${quizId}`;
        const savedProgress = localStorage.getItem(progressKey);
        
        // console.log(`[Resume Check] Quiz ID: ${quizId}, Progress Key: ${progressKey}, Has Data: ${!!savedProgress}`);
        
        if (savedProgress) {
            try {
                const progressData = JSON.parse(savedProgress);
                
                // Check if progress is valid and not expired (2 hours)
                const maxAge = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
                const isValidData = progressData && 
                                   typeof progressData.timeRemaining === "number" &&
                                   typeof progressData.currentQuestionIndex === "number" &&
                                   progressData.answers &&
                                   progressData.quiz &&
                                   progressData.startTime;
                
                const isNotExpired = Date.now() - progressData.timestamp <= maxAge;
                const hasTimeLeft = progressData.timeRemaining > 0;
                
                if (isValidData && isNotExpired && hasTimeLeft) {
                    return true;
                }
            } catch (error) {
                console.error("Error checking quiz progress:", error);
            }
        } else {
            // console.log(`[Resume Check] ❌ No saved progress for quiz ${quizId}`);
        }
        
        return false;
    };

    const clearQuizProgress = (quizData) => {
        // Handle both quiz objects and quiz IDs
        const quizId = typeof quizData === "string" ? quizData : quizData?.quiz_id;
        if (!quizId) return;
        
        const progressKey = `quiz_progress_${UserData()?.user_id}_${quizId}`;
        localStorage.removeItem(progressKey);
    };

    const checkForResumeableQuiz = (availableQuizzes = null) => {
        // Check if there's a resumeable quiz when component mounts
        if (!UserData()?.user_id) {
            return;
        }
        
        const quizzesToCheck = availableQuizzes || quizzes;
        
        if (!quizzesToCheck || quizzesToCheck.length === 0) {
            return;
        }
        
        // Check all stored quiz progress for this user
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(`quiz_progress_${UserData().user_id}_`)) {
                const savedProgress = localStorage.getItem(key);
                if (savedProgress) {
                    try {
                        const progressData = JSON.parse(savedProgress);
                        const maxAge = 2 * 60 * 60 * 1000; // 2 hours
                        
                        if (Date.now() - progressData.timestamp <= maxAge) {
                            const matchingQuiz = quizzesToCheck.find(q => q.quiz_id === progressData.quiz.quiz_id);
                            if (matchingQuiz) {
                                progressData.quiz = matchingQuiz;
                                setQuizResumeData(progressData);
                                
                                showResumeDialog(matchingQuiz, progressData);
                                return;
                            }
                        } else {
                            localStorage.removeItem(key);
                        }
                    } catch (error) {
                        console.error("Error parsing progress data:", error);
                        localStorage.removeItem(key); // Clean up corrupted data
                    }
                }
            }
        });
    };

    const showResumeDialog = (quiz, resumeData) => {
        Swal.fire({
            title: "Lanjutkan Kuis?",
            html: `
                <div style="text-align: left; margin: 20px 0;">
                    <p style="margin-bottom: 15px;"><strong>Anda memiliki percobaan kuis yang belum selesai:</strong></p>
                    <div style="padding: 20px; background: #f8f9fa; border-radius: 10px; border-left: 4px solid #007bff;">
                        <p style="margin: 5px 0;"><strong>📝 Kuis:</strong> ${quiz.title}</p>
                        <p style="margin: 5px 0;"><strong>⏰ Waktu Tersisa:</strong> ${Math.floor(resumeData.timeRemaining / 60)}:${(resumeData.timeRemaining % 60).toString().padStart(2, "0")}</p>
                        <p style="margin: 5px 0;"><strong>📊 Kemajuan:</strong> Pertanyaan ${resumeData.currentQuestionIndex + 1} dari ${quiz.questions.length}</p>
                        <p style="margin: 5px 0;"><strong>📅 Dimulai:</strong> ${new Date(resumeData.startTime).toLocaleString()}</p>
                        <p style="margin: 5px 0; color: #6c757d; font-size: 0.9em;">💡 Kemajuan Anda telah disimpan secara otomatis</p>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: "🔄 Lanjutkan Kuis",
            cancelButtonText: "🆕 Mulai Kuis Baru",
            confirmButtonColor: "#28a745",
            cancelButtonColor: "#dc3545",
            width: "500px",
            customClass: {
                popup: "quiz-resume-dialog",
                title: "quiz-resume-title",
                htmlContainer: "quiz-resume-content"
            }
        }).then((result) => {
            if (result.isConfirmed) {
                // Resume the quiz
                setSelectedQuiz(quiz);
                resumeQuiz(quiz, resumeData);
            } else if (result.isDismissed) {
                // Clear old data and allow starting fresh
                clearQuizProgress(quiz);
                setSelectedQuiz(quiz);
                Toast().fire({
                    icon: "info",
                    title: "Kemajuan sebelumnya dihapus",
                    text: "Anda sekarang dapat memulai percobaan kuis yang baru."
                });
            }
        });
    };

    const fetchQuizzes = async (courseId, totalLessons = 0, completedLessons = 0) => {
        if (!courseId) {
            return;
        }

        const apiUrl = `student/quiz-list/${UserData()?.user_id}/${courseId}/`;
        
        useAxios.get(apiUrl).then((res) => {
            setQuizzes(res.data);
            
            // Count total quizzes and passed quizzes
            const totalQuizzes = res.data?.length || 0;
            const passedQuizzes = res.data?.filter(quiz => quiz.is_passed)?.length || 0;
            
            // Recalculate completion percentage including quizzes
            if (totalLessons > 0 || totalQuizzes > 0) {
                calculateCompletionPercentage(totalLessons, completedLessons, totalQuizzes, passedQuizzes);
            }
            
        }).catch((error) => {
            console.error("Error fetching quizzes:", error);
            // Still calculate completion with lessons only if quiz fetch fails
            if (totalLessons > 0) {
                calculateCompletionPercentage(totalLessons, completedLessons, 0, 0);
            }
        });
    };    useEffect(() => {
        fetchCourseDetail();
        
        // Debug helper - add a test function to window for testing resume functionality
        window.testQuizResume = (quizId) => {
            const testProgress = {
                quiz: { quiz_id: quizId, title: "Test Quiz", questions: [{ question_id: "123" }] },
                answers: { "123": "456" },
                currentQuestionIndex: 0,
                timeRemaining: 300,
                startTime: Date.now() - 60000,
                courseId: courseId,
                userId: UserData()?.user_id,
                timestamp: Date.now(),
                version: "1.0"
            };
            const key = `quiz_progress_${UserData()?.user_id}_${quizId}`;
            localStorage.setItem(key, JSON.stringify(testProgress));
            checkForResumeableQuiz(quizzes);
        };
        
        window.debugQuizResume = () => {
            quizzes.forEach(quiz => {
                const hasProgress = hasQuizProgress(quiz);
            });
            
            checkForResumeableQuiz(quizzes);
        };
        
        window.clearAllQuizProgress = () => {
            const keys = Object.keys(localStorage).filter(k => k.startsWith("quiz_progress_"));
            keys.forEach(key => localStorage.removeItem(key));
        };
        
        // checkForResumeableQuiz will be called after quizzes are loaded
    }, []);

    // Cleanup timer on component unmount
    useEffect(() => {
        return () => {
            if (quizTimerRef.current) {
                clearInterval(quizTimerRef.current);
                quizTimerRef.current = null;
            }
        };
    }, []);

    const handleColorChange = (color) => {
        // Validate color format
        const isValidColor = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
        const validColor = isValidColor ? color : "#f39c12";
        
        setCreateNote({
            ...createNote,
            color: validColor
        });
        setSelectedNoteColor(validColor);
    };

    // Helper function to generate color variations
    const getColorVariations = (color) => {
        // Fallback to default orange if color is invalid
        if (!color || typeof color !== "string") {
            color = "#f39c12";
        }
        
        const hexToRgb = (hex) => {
            // Clean the hex value
            hex = hex.replace("#", "");
            if (hex.length === 3) {
                hex = hex.split("").map(char => char + char).join("");
            }
            
            const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        };

        const rgb = hexToRgb(color);
        if (!rgb) {
            // Fallback color variations if parsing fails
            return { 
                light: "rgba(243, 156, 18, 0.2)", 
                hover: "rgba(243, 156, 18, 0.13)", 
                shadow: "rgba(243, 156, 18, 0.3)" 
            };
        }

        return {
            light: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`,
            hover: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.13)`,
            shadow: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`
        };
    };

    const handleSubmitCreateNote = async (e) => {
        e.preventDefault();

        // Validate required fields
        if (!createNote.title?.trim()) {
            Toast().fire({
                icon: "error",
                title: "Silakan masukkan judul catatan",
            });
            return;
        }
        
        if (!createNote.note?.trim()) {
            Toast().fire({
                icon: "error",
                title: "Silakan masukkan konten catatan",
            });
            return;
        }

        const formdata = new FormData();
        formdata.append("user_id", UserData()?.user_id);
        formdata.append("enrollment_id", param.enrollment_id);
        formdata.append("title", createNote.title.trim());
        formdata.append("note", createNote.note.trim());
        formdata.append("color", createNote.color || "#f39c12");

        try {
            await useAxios.post(`student/course-note/${UserData()?.user_id}/${param.enrollment_id}/`, formdata).then((res) => {
                fetchCourseDetail();
                setCreateNote({ title: "", note: "", color: "#f39c12" });
                setSelectedNoteColor("#f39c12");
                handleNoteClose(); // Close modal after successful creation
                Toast().fire({
                    icon: "success",
                    title: "Catatan berhasil dibuat",
                });
            });
        } catch (error) {
            Toast().fire({
                icon: "error",
                title: "Gagal membuat catatan. Silakan coba lagi.",
            });
        }
    };

    const handleSubmitEditNote = (e, noteId) => {
        e.preventDefault();
        
        // Validate required fields
        if (!createNote.title?.trim()) {
            Toast().fire({
                icon: "error",
                title: "Silakan masukkan judul catatan",
            });
            return;
        }
        
        if (!createNote.note?.trim()) {
            Toast().fire({
                icon: "error",
                title: "Silakan masukkan konten catatan",
            });
            return;
        }

        const formdata = new FormData();
        formdata.append("user_id", UserData()?.user_id);
        formdata.append("enrollment_id", param.enrollment_id);
        formdata.append("title", createNote.title.trim());
        formdata.append("note", createNote.note.trim());
        formdata.append("color", createNote.color || "#f39c12");

        useAxios.patch(`student/course-note-detail/${UserData()?.user_id}/${param.enrollment_id}/${noteId}/`, formdata).then((res) => {
            fetchCourseDetail();
            handleNoteClose();
            Toast().fire({
                icon: "success",
                title: "Catatan berhasil diperbarui",
            });
        }).catch((error) => {
            Toast().fire({
                icon: "error",
                title: "Gagal memperbarui catatan. Silakan coba lagi.",
            });
        });
    };

    const handleDeleteNote = (noteId) => {
        useAxios.delete(`student/course-note-detail/${UserData()?.user_id}/${param.enrollment_id}/${noteId}/`).then((res) => {
            fetchCourseDetail();
            Toast().fire({
                icon: "success",
                title: "Catatan berhasil dihapus",
            });
        });
    };

    const handleMessageChange = (event) => {
        setCreateMessage({
            ...createMessage,
            [event.target.name]: event.target.value,
        });
    };

    const handleSaveQuestion = async (e) => {
        e.preventDefault();
        const formdata = new FormData();

        formdata.append("course_id", course.course?.id);
        formdata.append("user_id", UserData()?.user_id);
        formdata.append("title", createMessage.title);
        formdata.append("message", createMessage.message);

        await useAxios.post(`student/question-answer-list-create/${course.course?.id}/`, formdata).then((res) => {
            fetchCourseDetail();
            setCreateMessage({
                title: "",
                message: "",
            });
            handleQuestionClose();
            Toast().fire({
                icon: "success",
                title: "Pertanyaan berhasil dibuat",
            });
        });
    };

    const sendNewMessage = async (e) => {
        e.preventDefault();
        
        if (!selectedConversation) {
            Toast().fire({
                icon: "error",
                title: "Silakan pilih percakapan terlebih dahulu",
            });
            return;
        }

        if (!createMessage.message.trim()) {
            Toast().fire({
                icon: "error",
                title: "Silakan masukkan pesan"
            });
            return;
        }

        const formdata = new FormData();
        formdata.append("course_id", course.course?.id);
        formdata.append("user_id", UserData()?.user_id);
        formdata.append("message", createMessage.message);
        formdata.append("qa_id", selectedConversation?.qa_id);

        try {
            const response = await useAxios.post("student/question-answer-message-create/", formdata);
            
            // Update the selected conversation with new message data
            if (response.data.question) {
                setSelectedConversation(response.data.question);
                fetchCourseDetail();
                // Also update the conversations list to reflect the new message
                setCourse(prev => ({
                    ...prev,
                    questions: prev.questions?.map(q => 
                        q.qa_id === selectedConversation.qa_id ? response.data.question : q
                    ) || []
                }));
            }
            
            // Clear the message input
            setCreateMessage({
                title: "",
                message: "",
            });
            
        } catch (error) {
            Toast().fire({
                icon: "error",
                title: "Gagal mengirim pesan"
            });
        }
    };

    useEffect(() => {
      if (lastElementRef.current) {
        lastElementRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }, [selectedConversation]);

    const handleSearchQuestion = (event) => {
        const query = event.target.value.toLowerCase();
    };

    const handleReviewChange = (event) => {
        setCreateReview({
            ...createReview,
            [event.target.name]: event.target.value,
        });
    };

    const handleEditReview = () => {
        // Populate the form with existing review data
        setCreateReview({
            rating: studentReview.rating,
            review: studentReview.review
        });
        setIsEditingReview(true);
    };

    const handleCancelEditReview = () => {
        // Reset form and exit edit mode
        setCreateReview({ rating: 1, review: "" });
        setIsEditingReview(false);
    };

    const handleCreateReviewSubmit = (e) => {
        e.preventDefault();

        // Validation
        if (!createReview.review.trim()) {
            Toast().fire({
                icon: "error",
                title: "Silakan tulis ulasan",
            });
            return;
        }

        if (!createReview.rating || createReview.rating < 1 || createReview.rating > 5) {
            Toast().fire({
                icon: "error",
                title: "Silakan pilih rating",
            });
            return;
        }

        const formdata = new FormData();
        formdata.append("course", course.course?.id);
        formdata.append("user", UserData()?.user_id);
        formdata.append("rating", createReview.rating);
        formdata.append("review", createReview.review);

        useAxios.post("student/rate-course/", formdata).then((res) => {
            fetchCourseDetail();
            // Reset form and edit state after successful submission
            setCreateReview({ rating: 1, review: "" });
            setIsEditingReview(false);
            Toast().fire({
                icon: "success",
                title: "Ulasan berhasil dibuat",
            });
        }).catch((error) => {
            // Check if it's a duplicate review error
            if (error.response?.data?.error?.includes("already reviewed")) {
                Toast().fire({
                    icon: "warning",
                    title: "Anda telah meninjau kursus ini",
                });
            } else {
                Toast().fire({
                    icon: "error",
                    title: "Gagal mengirim ulasan. Silakan coba lagi.",
                });
            }
        });
    };

    const handleUpdateReviewSubmit = (e) => {
        e.preventDefault();

        // Validation
        if (!createReview.review.trim()) {
            Toast().fire({
                icon: "error",
                title: "Silakan tulis ulasan",
            });
            return;
        }

        if (!createReview.rating || createReview.rating < 1 || createReview.rating > 5) {
            Toast().fire({
                icon: "error",
                title: "Silakan pilih rating",
            });
            return;
        }

        const formdata = new FormData();
        formdata.append("course", course.course?.id);
        formdata.append("user", UserData()?.user_id);
        formdata.append("rating", createReview.rating);
        formdata.append("review", createReview.review);

        useAxios.patch(`student/review-detail/${UserData()?.user_id}/${studentReview?.id}/`, formdata).then((res) => {
            fetchCourseDetail();
            // Reset form and exit edit mode
            setCreateReview({ rating: 1, review: "" });
            setIsEditingReview(false);
            Toast().fire({
                icon: "success",
                title: "Ulasan berhasil diperbarui",
            });
        }).catch((error) => {
            Toast().fire({
                icon: "error",
                title: "Gagal memperbarui ulasan. Silakan coba lagi.",
            });
        });
    };

    return (
        <>
            <style>{`
                @keyframes pulse {
                    0% {
                        transform: scale(1);
                        box-shadow: 0 3px 10px rgba(23, 162, 184, 0.3);
                    }
                    50% {
                        transform: scale(1.05);
                        box-shadow: 0 5px 15px rgba(23, 162, 184, 0.5);
                    }
                    100% {
                        transform: scale(1);
                        box-shadow: 0 3px 10px rgba(23, 162, 184, 0.3);
                    }
                }
                .resume-quiz-badge {
                    animation: pulse 2s infinite;
                }
            `}</style>
            
            <BaseHeader />

            {/* Simple loading overlay */}
            {isUpdatingCourse && (
                <div 
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "transparent",
                        zIndex: 9999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                    }}
                >
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Memuat...</span>
                    </div>
                </div>
            )}

            <section className="pt-5 pb-5 modern-student-course">
                <div className="container">
                    {/* Header Here */}
                    <Header />
                        
                        <div className="row mt-0 md-4">
                            {/* Sidebar Here */}
                            <Sidebar />
                            
                            <div className="col-lg-9 col-md-8 col-12">
                                {/* Course Progress Card */}
                                {isProgressCardLoading ? (
                                    // Skeleton Loading State
                                    <div className="course-progress-card-skeleton">
                                        <div className="progress-content">
                                            <div className="row align-items-center">
                                                <div className="col-md-9 pe-2">
                                                    <div className="skeleton-item skeleton-title mb-3"></div>
                                                    <div className="skeleton-item skeleton-text mb-3"></div>
                                                    <div className="d-flex align-items-center gap-3 flex-wrap">
                                                        <div className="skeleton-item skeleton-badge"></div>
                                                        <div className="skeleton-item skeleton-badge"></div>
                                                        <div className="skeleton-item skeleton-badge"></div>
                                                    </div>
                                                </div>
                                                <div className="col-md-3 text-center d-flex align-items-center justify-content-end ps-0">
                                                    <div className="skeleton-item skeleton-circle"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    // Actual Progress Card with Fade-In Animation
                                    <div className="course-progress-card course-progress-card-loaded">
                                        <div className="progress-content">
                                            <div className="row align-items-center">
                                                <div className="col-md-9 pe-2">
                                                    <h2 className="fw-bold mb-3 course-title-animated">{course?.course?.title}</h2>
                                                    <p className="opacity-90 mb-3 course-subtitle-animated">
                                                        Lanjutkan perjalanan pembelajaran Anda dan lacak kemajuan Anda
                                                    </p>
                                                    <div className="d-flex align-items-center gap-3 flex-wrap">
                                                        <span className="badge bg-white text-primary px-3 py-2 rounded-pill badge-animated" style={{ animationDelay: "0.1s" }}>
                                                            <i className="fas fa-book me-1"></i>
                                                            {completionStats.completedLessons}/{completionStats.totalLessons} Pelajaran
                                                        </span>
                                                        {completionStats.totalQuizzes > 0 && (
                                                            <span className="badge bg-white text-success px-3 py-2 rounded-pill badge-animated" style={{ animationDelay: "0.2s" }}>
                                                                <i className="fas fa-brain me-1"></i>
                                                                {completionStats.passedQuizzes}/{completionStats.totalQuizzes} Kuis
                                                            </span>
                                                        )}
                                                        <span className="badge bg-white text-primary px-3 py-2 rounded-pill badge-animated" style={{ animationDelay: "0.3s" }}>
                                                            <i className="fas fa-tag me-1"></i>
                                                            {course?.course?.category?.title}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="col-md-3 text-center text-primary d-flex align-items-center justify-content-end ps-0">
                                                    <div 
                                                        className="progress-circle progress-circle-animated"
                                                        style={{"--progress": completionPercentage || 0}}
                                                    >
                                                        <div className="progress-inner">
                                                            <div className="text-center">
                                                                <div className="h3 fw-bold mb-0">{completionPercentage || 0}%</div>
                                                                <small>Selesai</small>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="modern-tabs">
                                    {/* Tab Navigation */}
                                    <ul className="nav nav-tabs nav-tabs-modern" id="courseTab" role="tablist">
                                        <li className="nav-item" role="presentation">
                                            <button className="nav-link active" id="lectures-tab" data-bs-toggle="tab" data-bs-target="#lectures" type="button" role="tab">
                                                <i className="fas fa-play-circle me-2"></i>Pelajaran
                                            </button>
                                        </li>
                                        <li className="nav-item" role="presentation">
                                            <button className="nav-link" id="notes-tab" data-bs-toggle="tab" data-bs-target="#notes" type="button" role="tab">
                                                <i className="fas fa-sticky-note me-2"></i>Catatan
                                            </button>
                                        </li>
                                        <li className="nav-item" role="presentation">
                                            <button className="nav-link" id="discussions-tab" data-bs-toggle="tab" data-bs-target="#discussions" type="button" role="tab">
                                                <i className="fas fa-comments me-2"></i>Diskusi
                                            </button>
                                        </li>
                                        <li className="nav-item" role="presentation">
                                            <button className="nav-link" id="quiz-tab" data-bs-toggle="tab" data-bs-target="#quiz" type="button" role="tab">
                                                <i className="fas fa-brain me-2"></i>Kuis
                                            </button>
                                        </li>
                                        <li className="nav-item" role="presentation">
                                            <button className="nav-link" id="certificate-tab" data-bs-toggle="tab" data-bs-target="#certificate" type="button" role="tab">
                                                <i className="fas fa-certificate me-2"></i>Sertifikat
                                            </button>
                                        </li>
                                        <li className="nav-item" role="presentation">
                                            <button className="nav-link" id="review-tab" data-bs-toggle="tab" data-bs-target="#review" type="button" role="tab">
                                                <i className="fas fa-star me-2"></i>Ulasan
                                            </button>
                                        </li>
                                    </ul>

                                    {/* Tab Content */}
                                    <div className="tab-content tab-content-modern" id="courseTabContent">
                                        {/* Lectures Tab */}
                                        <LecturesTab
                                            course={course}
                                            enrollmentId={param.enrollment_id}
                                            fetchCourseDetail={fetchCourseDetail}
                                            completionPercentage={completionPercentage}
                                            show={show}
                                            setShow={setShow}
                                            variantItem={variantItem}
                                            setVariantItem={setVariantItem}
                                        />

                                        {/* Notes Tab */}
                                        <div className="tab-pane fade" id="notes" role="tabpanel">
                                            <div className="d-flex justify-content-between align-items-center mb-4">
                                                <h4 className="mb-0">Catatan Saya</h4>
                                                <button 
                                                    className="add-btn-modern" 
                                                    onClick={() => handleNoteShow(null)}
                                                >
                                                    <i className="fas fa-plus"></i>
                                                    Tambah Catatan
                                                </button>
                                            </div>
                                            
                                            {course?.note?.length > 0 ? (
                                                course.note.map((n, index) => {
                                                    const noteColor = n.color || "#f39c12";
                                                    const colorVariations = getColorVariations(noteColor);
                                                    
                                                    return (
                                                        <div 
                                                            key={n.id || index} 
                                                            className="note-card"
                                                            style={{
                                                                "--note-color": noteColor,
                                                                "--note-color-light": colorVariations.light,
                                                                "--note-color-hover": colorVariations.hover,
                                                                borderColor: colorVariations.light
                                                            }}
                                                        >
                                                            <div className="note-header">
                                                                <div className="note-header-content">
                                                                    <div 
                                                                        className="note-icon-wrapper"
                                                                        style={{ 
                                                                            background: `linear-gradient(135deg, ${noteColor} 0%, ${noteColor}dd 100%)`,
                                                                            boxShadow: `0 4px 12px ${colorVariations.shadow}`
                                                                        }}
                                                                    >
                                                                        <i className="fas fa-sticky-note"></i>
                                                                    </div>
                                                                    <div className="note-content-info">
                                                                        <h5 className="note-title">{n.title}</h5>
                                                                        <div className="note-date">
                                                                            <i 
                                                                                className="fas fa-calendar-alt"
                                                                                style={{ color: noteColor }}
                                                                            ></i>
                                                                            {moment(n.date).format("MMM DD, YYYY")}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="note-actions">
                                                                    <button 
                                                                        className="btn-note-action edit" 
                                                                        onClick={() => handleNoteShow(n)}
                                                                        title="Edit catatan"
                                                                    >
                                                                        <i className="fas fa-edit"></i>
                                                                    </button>
                                                                    <button 
                                                                        className="btn-note-action delete" 
                                                                        onClick={() => handleDeleteNote(n.id)}
                                                                        title="Hapus catatan"
                                                                    >
                                                                        <i className="fas fa-trash"></i>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <p 
                                                                className="note-content-text"
                                                                style={{
                                                                    background: `linear-gradient(135deg, ${colorVariations.hover} 0%, ${colorVariations.light} 100%)`,
                                                                    borderColor: colorVariations.light
                                                                }}
                                                            >
                                                                {n.note}
                                                            </p>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <div className="empty-state">
                                                    <i className="fas fa-sticky-note empty-icon"></i>
                                                    <h5>Belum ada catatan</h5>
                                                    <p>Mulai membuat catatan untuk mengingat poin penting</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Discussions Tab */}
                                        <div className="tab-pane fade" id="discussions" role="tabpanel">
                                            <div className="d-flex justify-content-between align-items-center mb-4">
                                                <h4 className="mb-0">Diskusi Kursus</h4>
                                                <button 
                                                    className="add-btn-modern" 
                                                    onClick={handleQuestionShow}
                                                >
                                                    <i className="fas fa-plus"></i>
                                                    Ajukan Pertanyaan
                                                </button>
                                            </div>
                                            
                                            {questions?.length > 0 ? (
                                                questions.map((q, index) => (
                                                    <div 
                                                        key={q.qa_id || index} 
                                                        className="question-card"
                                                        onClick={() => handleConversationShow(q)}
                                                    >
                                                        <div className="question-header">
                                                            <div className="question-avatar">
                                                                {q.profile?.image ? (
                                                                    <img
                                                                        src={q.profile.image.startsWith("http") 
                                                                            ? q.profile.image 
                                                                            : getMediaUrl(q.profile.image)
                                                                        }
                                                                        className="avatar-modern"
                                                                        alt={`${q.profile?.full_name || "User"} avatar`}
                                                                        onError={(e) => {
                                                                            e.target.style.display = "none";
                                                                            e.target.nextSibling.style.display = "flex";
                                                                        }}
                                                                    />
                                                                ) : null}
                                                                <div 
                                                                    className="avatar-placeholder"
                                                                    style={{ display: q.profile?.image ? "none" : "flex" }}
                                                                >
                                                                    <i className="fas fa-user"></i>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="question-content">
                                                                <h5 className="question-title">
                                                                    {q.title || "Tidak Ada Judul"}
                                                                </h5>
                                                                
                                                                <div className="question-meta">
                                                                    <div className="question-meta-item">
                                                                        <i className="fas fa-user question-meta-icon"></i>
                                                                        <span>{q.profile?.full_name || "Pengguna Anonim"}</span>
                                                                    </div>
                                                                    <div className="question-meta-item">
                                                                        <i className="fas fa-calendar-alt question-meta-icon"></i>
                                                                        <span>{moment(q.date).format("DD MMM, YYYY")}</span>
                                                                    </div>
                                                                    <div className="question-meta-item">
                                                                        <i className="fas fa-clock question-meta-icon"></i>
                                                                        <span>{moment(q.date).fromNow()}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <p className="mb-0">{q.message}</p>
                                                        
                                                        <div className="question-actions">
                                                            <div className="question-stats">
                                                                <span className="replies-badge">
                                                                    <i className="fas fa-comments"></i>
                                                                    {q.messages?.length || 0} Balasan
                                                                </span>
                                                            </div>
                                                            
                                                            <button 
                                                                className="join-discussion-primary" 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleConversationShow(q);
                                                                }}
                                                            >
                                                                <i className="fas fa-comment-dots"></i>
                                                                Bergabung dengan Percakapan
                                                                <i className="fas fa-arrow-right discussion-arrow"></i>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="empty-state">
                                                    <i className="fas fa-comments empty-icon"></i>
                                                    <h5>Belum ada diskusi</h5>
                                                    <p>Jadilah yang pertama mengajukan pertanyaan atau memulai diskusi</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Quiz Tab */}
                                        <div className="tab-pane fade" id="quiz" role="tabpanel">
                                            <div className="d-flex justify-content-between align-items-center mb-4">
                                                <h4 className="mb-0">Kuis Kursus</h4>
                                                {quizzes.length > 0 && (
                                                    <div className="quiz-summary">
                                                        <span className="badge bg-primary px-3 py-2 rounded-pill">
                                                            <i className="fas fa-brain me-1"></i>
                                                            {quizzes.length} Kuis Tersedia
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {quizzes.length > 0 ? (
                                                <div className="row">
                                                    {quizzes.map((quiz, index) => (
                                                        <div key={quiz.quiz_id} className="col-lg-6 col-md-6 mb-4">
                                                            <div className="student-quiz-card" style={{position: "relative"}}>
                                                                {hasQuizProgress(quiz) && (
                                                                    <div className="resume-quiz-badge" style={{
                                                                        position: "absolute",
                                                                        top: "1px",
                                                                        right: "2px",
                                                                        background: "linear-gradient(135deg, #17a2b8, #138496)",
                                                                        color: "white",
                                                                        padding: "8px 12px",
                                                                        borderRadius: "20px",
                                                                        fontSize: "12px",
                                                                        fontWeight: "bold",
                                                                        boxShadow: "0 3px 10px rgba(23, 162, 184, 0.3)",
                                                                        zIndex: 10,
                                                                        border: "2px solid white",
                                                                        animation: "pulse 2s infinite"
                                                                    }}>
                                                                        <i className="fas fa-play-circle me-1"></i>
                                                                        Resume
                                                                    </div>
                                                                )}
                                                                <div className="student-quiz-card-header">
                                                                    <div className="student-quiz-icon-wrapper">
                                                                        <i className="fas fa-brain text-white"></i>
                                                                    </div>
                                                                    <div className="quiz-header-content">
                                                                        <h1 className="student-quiz-title">{quiz.title}</h1>
                                                                        <p className="student-quiz-description">{quiz.description || "Uji pemahaman Anda tentang materi kursus ini"}</p>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="student-quiz-stats">
                                                                    <div className="row text-center">
                                                                        <div className="col-4">
                                                                            <div className="student-stat-item">
                                                                                <i className="fas fa-question-circle text-primary"></i>
                                                                                <span className="student-stat-number">{quiz.total_questions}</span>
                                                                                <span className="student-stat-label">Pertanyaan</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="col-4">
                                                                            <div className="student-stat-item">
                                                                                <i className="fas fa-clock text-warning"></i>
                                                                                <span className="student-stat-number">{quiz.total_questions}</span>
                                                                                <span className="student-stat-label">Menit</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="col-4">
                                                                            <div className="student-stat-item">
                                                                                <i className="fas fa-trophy text-success"></i>
                                                                                <span className="student-stat-number">{Math.round(quiz.best_score || 0)}%</span>
                                                                                <span className="student-stat-label">Terbaik</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="quiz-progress">
                                                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                                                        <span className="progress-label">
                                                                            {hasQuizProgress(quiz) ? (
                                                                                <span className="text-info">
                                                                                    <i className="fas fa-play-circle me-1"></i>
                                                                                    Siap Dilanjutkan
                                                                                </span>
                                                                            ) : quiz.is_passed ? (
                                                                                <span className="text-success">
                                                                                    <i className="fas fa-check-circle me-1"></i>
                                                                                    Lulus
                                                                                </span>
                                                                            ) : quiz.best_score > 0 ? (
                                                                                <span className="text-warning">
                                                                                    <i className="fas fa-exclamation-triangle me-1"></i>
                                                                                    Perlu Ditingkatkan
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-muted">
                                                                                    <i className="fas fa-clock me-1"></i>
                                                                                    Belum Dicoba
                                                                                </span>
                                                                            )}
                                                                        </span>
                                                                        <span className="attempts-counter">
                                                                            <i className="fas fa-redo me-1"></i>
                                                                            {quiz.today_attempts}/3 percobaan hari ini
                                                                        </span>
                                                                    </div>
                                                                    <div className="progress quiz-progress-bar">
                                                                        <div 
                                                                            className={`progress-bar ${quiz.is_passed ? "bg-info" : "bg-warning"}`}
                                                                            style={{width: `${quiz.best_score || 0}%`}}
                                                                        ></div>
                                                                    </div>
                                                                    <small className="text-muted">Skor minimum untuk lulus: 80%</small>
                                                                </div>

                                                                <div className="student-quiz-actions">
                                                                    {quiz.can_attempt ? (
                                                                        <button 
                                                                            className="btn btn-primary w-100"
                                                                            onClick={() => handleQuizShow(quiz)}
                                                                        >
                                                                            {(() => {
                                                                                if (hasQuizProgress(quiz)) {
                                                                                    return (
                                                                                        <>
                                                                                            <i className="fas fa-play-circle me-2"></i>
                                                                                            Lanjutkan Kuis
                                                                                        </>
                                                                                    );
                                                                                } else if (quiz.best_score > 0) {
                                                                                    return (
                                                                                        <>
                                                                                            <i className="fas fa-redo me-2"></i>
                                                                                            Coba Lagi
                                                                                        </>
                                                                                    );
                                                                                } else {
                                                                                    return (
                                                                                        <>
                                                                                            <i className="fas fa-play me-2"></i>
                                                                                            Mulai Kuis
                                                                                        </>
                                                                                    );
                                                                                }
                                                                            })()}
                                                                        </button>
                                                                    ) : (
                                                                        <button className="btn btn-secondary w-100" disabled>
                                                                            <i className="fas fa-ban me-2"></i>
                                                                            Batas Harian Tercapai (3/3)
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="empty-state">
                                                    <i className="fas fa-brain empty-icon"></i>
                                                    <h5>Tidak ada kuis yang tersedia</h5>
                                                    <p>Kuis akan muncul di sini setelah ditambahkan ke kursus</p>
                                                </div>
                                            )}
                                        </div>

                                        
                                        {/* Certificate Tab */}
                                        <CertificateTab 
                                            course={course}
                                            enrollmentId={param.enrollment_id}
                                            completionPercentage={completionPercentage}
                                        />

                                        {/* Review Tab */}
                                        <div className="tab-pane fade" id="review" role="tabpanel">
                                            <h4 className="mb-4">Ulasan Kursus</h4>
                                            
                                            {studentReview ? (
                                                !isEditingReview ? (
                                                    <div className="review-card-modern" style={{ position: "relative" }}>
                                                        <div className="d-flex justify-content-between align-items-start mb-3">
                                                            <h5 className="mb-0">Ulasan Anda</h5>
                                                            <div className="d-flex gap-2">
                                                                <button 
                                                                    className="btn btn-outline-primary btn-sm"
                                                                    onClick={handleEditReview}
                                                                    title="Edit ulasan Anda"
                                                                >
                                                                    <i className="fas fa-edit me-1"></i>
                                                                    Edit
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="star-rating mb-3 d-flex align-items-center justify-content-between">
                                                            <div className="d-flex align-items-center">
                                                                {[...Array(5)].map((_, i) => (
                                                                    <i key={i} className={`fas fa-star ${i < studentReview.rating ? "text-warning" : "text-muted"}`}></i>
                                                                ))}
                                                                <span className="ms-2">({studentReview.rating}/5)</span>
                                                            </div>
                                                            <small className="text-muted">
                                                                Diulas pada {moment(studentReview.date).format("DD MMM YYYY")}
                                                            </small>
                                                        </div>
                                                        <p className="mb-3">{studentReview.review}</p>
                                                        
                                                        {/* Teacher/Instructor Reply Section */}
                                                        {studentReview.reply ? (
                                                            <div className="instructor-reply-section mt-4">
                                                                <div className="instructor-reply-header mb-2">
                                                                    <div className="d-flex align-items-center gap-2">
                                                                        <div className="instructor-avatar me-2">
                                                                            <i className="fas fa-chalkboard-teacher"></i>
                                                                        </div>
                                                                        <div className="flex-grow-1">
                                                                            <h4 className="mb-0 instructor-name text-primary">
                                                                                {course.course?.teacher?.full_name || "Instruktur Kursus"}
                                                                            </h4>
                                                                            <small className="text-muted">Balasan dari Instruktur</small>
                                                                        </div>
                                                                        <div className="reply-badge">
                                                                            <i className="fas fa-reply me-1"></i>
                                                                            <small>Balasan</small>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="instructor-reply-content">
                                                                    <p className="mb-0">{studentReview.reply}</p>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="no-reply-section mt-4">
                                                                <div className="d-flex align-items-center justify-content-center text-muted">
                                                                    <i className="fas fa-hourglass-half me-2"></i>
                                                                    <small>Menunggu balasan dari instruktur...</small>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="review-card-modern">
                                                        <h5 className="mb-3">Edit Ulasan Anda</h5>
                                                        <form onSubmit={handleUpdateReviewSubmit}>
                                                            <div className="mb-3">
                                                                <label className="form-label">Rating</label>
                                                                <div className="star-rating">
                                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                                        <i 
                                                                            key={star}
                                                                            className={`fas fa-star cursor-pointer ${star <= createReview.rating ? "text-warning" : "text-muted"}`}
                                                                            onClick={() => setCreateReview({...createReview, rating: star})}
                                                                        ></i>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <div className="mb-3">
                                                                <label className="form-label">Ulasan Anda</label>
                                                                <textarea
                                                                    name="review"
                                                                    value={createReview.review}
                                                                    onChange={handleReviewChange}
                                                                    className="form-control form-control-modern"
                                                                    rows="4"
                                                                    placeholder="Bagikan pemikiran Anda tentang kursus ini..."
                                                                ></textarea>
                                                            </div>
                                                            <div className="review-edit-actions d-flex gap-2">
                                                                <button 
                                                                    type="submit" 
                                                                    className="add-btn-modern"
                                                                    disabled={!createReview.review.trim() || !createReview.rating}
                                                                >
                                                                    <i className="fas fa-save me-2"></i>
                                                                    Perbarui Ulasan
                                                                </button>
                                                                <button 
                                                                    type="button" 
                                                                    className="btn btn-secondary"
                                                                    onClick={handleCancelEditReview}
                                                                >
                                                                    <i className="fas fa-times me-2"></i>
                                                                    Batal
                                                                </button>
                                                            </div>
                                                        </form>
                                                    </div>
                                                )
                                            ) : (
                                                <div className="review-card-modern">
                                                    <h5 className="mb-3">Beri Rating Kursus Ini</h5>
                                                    <form onSubmit={handleCreateReviewSubmit}>
                                                        <div className="mb-3">
                                                            <label className="form-label">Rating</label>
                                                            <div className="star-rating">
                                                                {[1, 2, 3, 4, 5].map((star) => (
                                                                    <i 
                                                                        key={star}
                                                                        className={`fas fa-star cursor-pointer ${star <= createReview.rating ? "text-warning" : "text-muted"}`}
                                                                        onClick={() => setCreateReview({...createReview, rating: star})}
                                                                    ></i>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div className="mb-3">
                                                            <label className="form-label">Ulasan Anda</label>
                                                            <textarea
                                                                name="review"
                                                                value={createReview.review}
                                                                onChange={handleReviewChange}
                                                                className="form-control form-control-modern"
                                                                rows="4"
                                                                placeholder="Bagikan pemikiran Anda tentang kursus ini..."
                                                            ></textarea>
                                                        </div>
                                                        <button 
                                                            type="submit" 
                                                            className="add-btn-modern"
                                                            disabled={!createReview.review.trim() || !createReview.rating}
                                                        >
                                                            <i className="fas fa-star me-2"></i>
                                                            Kirim Ulasan
                                                        </button>
                                                    </form>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

            {/* Add Note Modal */}
            <Modal show={noteShow} onHide={handleNoteClose} size="lg" centered className="add-note-modal">
              <form onSubmit={(e) => {
                  if (selectedNote) {
                      handleSubmitEditNote(e, selectedNote.id);
                  } else {
                      handleSubmitCreateNote(e);
                  }
              }}>
                {/* Modal Header */}
                <div  
                    className="modal-header-note modal-header-dynamic"
                    style={{ 
                        background: `linear-gradient(135deg, ${selectedNoteColor} 0%, ${selectedNoteColor}dd 100%)` 
                    }}
                >
                    <div className="modal-header-content">
                        <div className="modal-header-info">
                            <div 
                                className="modal-icon-wrapper note-icon-wrapper-dynamic"
                                style={{ 
                                    background: "rgba(255, 255, 255, 0.2)",
                                    border: "2px solid rgba(255, 255, 255, 0.3)" 
                                }}
                            >
                                <i className="fas fa-sticky-note"></i>
                            </div>
                            <div className="modal-title-section">
                                <h4 className="modal-title-modern">
                                    {selectedNote ? "Edit Catatan Kursus" : "Tambah Catatan Kursus"}
                                </h4>
                                <p className="modal-subtitle">
                                    {selectedNote ? "Perbarui catatan Anda dengan wawasan baru" : "Tangkap wawasan penting dan poin utama dari kursus ini"}
                                </p>
                            </div>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        className="btn-close-modern" 
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleNoteClose();
                        }}
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                {/* Modal Body */}
                <div className="modal-body-modern">
                    <div className="note-form">
                        {/* Note Title */}
                        <div className="form-group-modern">
                            <label className="form-label-modern">
                                <i className="fas fa-heading form-label-icon-note"></i>
                                Judul Catatan
                                <span className="required-indicator">*</span>
                            </label>
                            <div className="input-wrapper-modern">
                                <input
                                    type="text"
                                    name="title"
                                    className="form-input-modern form-input-note"
                                    placeholder="Berikan judul yang deskriptif untuk catatan Anda..."
                                    value={createNote.title}
                                    onChange={handleNoteChange}
                                    required
                                />
                            </div>
                        </div>

                        {/* Note Content */}
                        <div className="form-group-modern">
                            <label className="form-label-modern">
                                <i className="fas fa-edit form-label-icon-note"></i>
                                Konten Catatan
                                <span className="required-indicator">*</span>
                            </label>
                            <div className="textarea-wrapper-modern">
                                <textarea
                                    name="note"
                                    className="form-textarea-modern form-textarea-note"
                                    rows="5"
                                    placeholder="Tulis isi catatan Anda di sini. Sertakan konsep kunci, wawasan, atau poin penting dari kursus..."
                                    value={createNote.note}
                                    onChange={handleNoteChange}
                                    required
                                />
                                <div className="character-counter">
                                    {(createNote.note || "").length}/2000 karakter
                                </div>
                            </div>
                        </div>

                        {/* Color Picker */}
                        <div className="form-group-modern">
                            <label className="color-picker-label">
                                <i className="fas fa-palette form-label-icon-note"></i>
                                Pilih Warna Catatan
                            </label>
                            
                            {/* Color Preview */}
                            <div className="color-preview-section" style={{ marginBottom: "1rem" }}>
                                <div className="color-preview-label" style={{ fontSize: "0.9rem", color: "#6c757d", marginBottom: "0.5rem" }}>
                                    Pratinjau Warna Terpilih:
                                </div>
                                <div 
                                    className="color-preview-demo"
                                    style={{
                                        background: `linear-gradient(135deg, ${selectedNoteColor} 0%, ${selectedNoteColor}dd 100%)`,
                                        padding: "1rem",
                                        borderRadius: "12px",
                                        color: "white",
                                        textAlign: "center",
                                        fontWeight: "600",
                                        boxShadow: `0 4px 15px ${getColorVariations(selectedNoteColor).shadow}`
                                    }}
                                >
                                    <i className="fas fa-sticky-note me-2"></i>
                                    Inilah cara catatan Anda akan terlihat
                                </div>
                            </div>
                            
                            <div className="color-picker-grid">
                                {[
                                    { color: "#f39c12", name: "Orange" },
                                    { color: "#e74c3c", name: "Red" },
                                    { color: "#3498db", name: "Blue" },
                                    { color: "#2ecc71", name: "Green" },
                                    { color: "#9b59b6", name: "Purple" },
                                    { color: "#f1c40f", name: "Yellow" },
                                    { color: "#e67e22", name: "Dark Orange" },
                                    { color: "#95a5a6", name: "Gray" },
                                    { color: "#1abc9c", name: "Teal" },
                                    { color: "#34495e", name: "Dark Blue" },
                                    { color: "#e91e63", name: "Pink" },
                                    { color: "#8e44ad", name: "Violet" }
                                ].map((colorOption) => (
                                    <div
                                        key={colorOption.color}
                                        className={`color-option ${selectedNoteColor === colorOption.color ? "selected" : ""}`}
                                        style={{ backgroundColor: colorOption.color }}
                                        onClick={() => {
                                            handleColorChange(colorOption.color);
                                            // Trigger handleNoteChange to update the color in createNote state
                                            handleNoteChange({
                                                target: {
                                                    name: "color",
                                                    value: colorOption.color
                                                }
                                            });
                                        }}
                                        title={colorOption.name}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Tips Section */}
                        <div className="tips-section">
                            <div className="tips-header">
                                <i className="fas fa-lightbulb tips-icon"></i>
                                <span>Tips untuk pembuatan catatan yang efektif</span>
                            </div>
                            <ul className="tips-list">
                                <li><i className="fas fa-check"></i>Sertakan cap waktu spesifik untuk referensi video</li>
                                <li><i className="fas fa-check"></i>Ringkas konsep kunci dengan kata-kata Anda sendiri</li>
                                <li><i className="fas fa-check"></i>Catat aplikasi praktis dan contoh</li>
                                <li><i className="fas fa-check"></i>Tambahkan wawasan pribadi dan refleksi</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="modal-footer-modern">
                    <div className="footer-actions">
                        <button 
                            type="button" 
                            className="btn-cancel-modern" 
                            onClick={handleNoteClose}
                        >
                            <i className="fas fa-times"></i>
                            <span>Cancel</span>
                        </button>
                        <button 
                            type="submit"
                            className="btn-submit-note"
                            disabled={!createNote.title?.trim() || !createNote.note?.trim()}
                            style={{
                                background: `linear-gradient(135deg, ${selectedNoteColor} 0%, ${selectedNoteColor}dd 100%)`,
                                boxShadow: `0 4px 15px ${getColorVariations(selectedNoteColor).shadow}`,
                                transition: "all 0.3s ease"
                            }}
                            onMouseEnter={(e) => {
                                if (!e.target.disabled) {
                                    const variations = getColorVariations(selectedNoteColor);
                                    e.target.style.boxShadow = `0 8px 25px ${variations.shadow}`;
                                    e.target.style.transform = "translateY(-2px)";
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!e.target.disabled) {
                                    const variations = getColorVariations(selectedNoteColor);
                                    e.target.style.boxShadow = `0 4px 15px ${variations.shadow}`;
                                    e.target.style.transform = "translateY(0)";
                                }
                            }}
                            // onClick={
                            //   (selectedNote ? (e) => handleSubmitEditNote(e, selectedNote.id) : handleSubmitCreateNote)
                            // } // Call appropriate handler
                        >
                            <i className="fas fa-save"></i>
                            {selectedNote ? "Update Note" : "Save Note"}
                        </button>
                    </div>
                </div>
                </form>
            </Modal>

            {/* Create Question Modal */}
            <Modal show={addQuestionShow} onHide={handleQuestionClose} size="lg" centered className="create-question-modal">
                {/* Modal Header */}
                <form onSubmit={handleSaveQuestion}>
                <div className="modal-header-modern">
                    <div className="modal-header-content">
                        <div className="modal-header-info">
                            <div className="modal-icon-wrapper">
                                <i className="fas fa-question-circle"></i>
                            </div>
                            <div className="modal-title-section">
                                <h4 className="modal-title-modern">Ajukan Pertanyaan</h4>
                                <p className="modal-subtitle">Bagikan pertanyaan Anda dengan komunitas kursus dan dapatkan jawaban ahli</p>
                            </div>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        className="btn-close-modern" 
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleQuestionClose();
                        }}
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                {/* Modal Body */}
                <div className="modal-body-modern">
                    <div className="question-form">
                        {/* Question Title */}
                        <div className="form-group-modern">
                            <label className="form-label-modern">
                                <i className="fas fa-heading form-label-icon"></i>
                                Judul Pertanyaan
                                <span className="required-indicator">*</span>
                            </label>
                            <div className="input-wrapper-modern">
                                <input
                                    type="text"
                                    name="title"
                                    className="form-input-modern"
                                    placeholder="Tulis judul yang jelas dan deskriptif untuk pertanyaan Anda..."
                                    value={createMessage.title}
                                    onChange={handleMessageChange}
                                    required
                                />
                            </div>
                        </div>

                        {/* Question Message */}
                        <div className="form-group-modern">
                            <label className="form-label-modern">
                                <i className="fas fa-edit form-label-icon"></i>
                                Detail Pertanyaan
                                <span className="required-indicator">*</span>
                            </label>
                            <div className="textarea-wrapper-modern">
                                <textarea
                                    name="message"
                                    className="form-textarea-modern"
                                    rows="4"
                                    placeholder="Berikan informasi detail tentang pertanyaan Anda. Semakin banyak konteks yang Anda berikan, semakin baik jawaban yang akan Anda terima..."
                                    value={createMessage.message}
                                    onChange={handleMessageChange}
                                    required
                                />
                                <div className="character-counter">
                                    {createMessage.message?.length || 0}/2000 karakter
                                </div>
                            </div>
                        </div>

                        {/* Tips Section */}
                        <div className="tips-section">
                            <div className="tips-header">
                                <i className="fas fa-lightbulb tips-icon"></i>
                                <span>Tips untuk mendapatkan jawaban yang lebih baik</span>
                            </div>
                            <ul className="tips-list">
                                <li><i className="fas fa-check"></i>Jadilah spesifik dan jelas dalam pertanyaan Anda</li>
                                <li><i className="fas fa-check"></i>Sertakan konteks dan contoh yang relevan</li>
                                <li><i className="fas fa-check"></i>Rujuk konten kursus spesifik atau cap waktu</li>
                                <li><i className="fas fa-check"></i>Cari pertanyaan yang ada sebelum memposting</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="modal-footer-modern">
                    <div className="footer-actions">
                        <button 
                            type="button" 
                            className="btn-cancel-modern" 
                            onClick={handleQuestionClose}
                        >
                            <i className="fas fa-times"></i>
                            <span>Batal</span>
                        </button>
                        <button 
                            type="submit"
                            className="btn-submit-modern"
                            disabled={!createMessage.title?.trim() || !createMessage.message?.trim()}
                        >
                            <i className="fas fa-paper-plane"></i>
                            Ajukan Pertanyaan
                        </button>
                    </div>
                </div>
                </form>
            </Modal>

            {/* Conversation Modal */}
            <Modal show={ConversationShow} onHide={handleConversationClose} size="lg" className="conversation-modal-qa">
                {/* Modal Header */}
                <div className="modal-header-modern" style={{ background: "linear-gradient(135deg, #3498db 0%, #2980b9 100%)" }}>
                    <div className="modal-header-content">
                        <div className="modal-header-info">
                            <div className="modal-icon-wrapper">
                                <i className="fas fa-comments"></i>
                            </div>
                            <div className="modal-title-section">
                                <h4 className="modal-title-modern">{selectedConversation?.title || "Diskusi"}</h4>
                                <p className="modal-subtitle">Bergabunglah dalam percakapan dan bagikan pemikiran Anda</p>
                            </div>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        className="btn-close-modern" 
                        onClick={(e) => {
                            e.stopPropagation();
                            handleConversationClose();
                        }}
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                {/* Modal Body */}
                <div className="modal-body-modern">
                    <div className="messages-container-qa">
                        
                        {/* Replies */}
                        {selectedConversation?.messages?.map((msg, index) => {
                            const currentUser = UserData();
                            const isCurrentUser = msg.profile?.user_id === currentUser?.user_id || msg.profile?.id === currentUser?.user_id;
                            return (
                                <div key={msg.id || `message-${index}`} className={`message-item-qa ${isCurrentUser ? "message-item-qa-current-user" : ""}`}>
                                    <div className={`d-flex ${isCurrentUser ? "flex-row-reverse" : ""}`}>
                                        <div className="flex-shrink-0">
                                            {msg.profile?.image ? (
                                                <img
                                                    className="message-avatar-qa"
                                                    src={msg.profile.image.startsWith("http") 
                                                        ? msg.profile.image 
                                                        : getMediaUrl(msg.profile.image)
                                                    }
                                                    alt={`${msg.profile?.full_name || "User"} avatar`}
                                                    onError={(e) => {
                                                        e.target.style.display = "none";
                                                        e.target.nextSibling.style.display = "flex";
                                                    }}
                                                />
                                            ) : (
                                                <div 
                                                    className="message-avatar-qa d-flex align-items-center justify-content-center"
                                                    style={{ 
                                                        background: isCurrentUser 
                                                            ? "linear-gradient(135deg, #28a745 0%, #20c997 100%)"
                                                            : "linear-gradient(135deg, #3498db 0%, #2980b9 100%)",
                                                        color: "white",
                                                        fontSize: "1.2rem"
                                                    }}
                                                >
                                                    <i className="fas fa-user"></i>
                                                </div>
                                            )}
                                        </div>
                                        <div className={`${isCurrentUser ? "me-3" : "ms-3"} flex-grow-1`}>
                                            <div className={`message-content-qa ${isCurrentUser ? "message-content-qa-current-user" : ""}`}>
                                                <div className="message-author-qa">
                                                    <div className="message-time-qa">
                                                        <i className="fas fa-clock me-1"></i>
                                                        {moment(msg.date).format("DD MMM, YYYY - HH:mm")}
                                                    </div>
                                                    <span>{msg.profile?.full_name || "Pengguna Anonim"}</span>
                                                </div>
                                                <div className="message-text-qa">{msg.message}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {selectedConversation && (!selectedConversation.messages || selectedConversation.messages.length === 0) && (
                            <div className="empty-conversation-qa">
                                <i className="fas fa-comment"></i>
                                <h5>Belum ada balasan</h5>
                                <p>Jadilah yang pertama membalas pertanyaan ini!</p>
                            </div>
                        )}

                        <div ref={lastElementRef}></div>
                    </div>

                    <form className="message-form-qa" onSubmit={sendNewMessage}>
                        <textarea 
                            name="message" 
                            className="message-textarea-qa" 
                            placeholder="Share your thoughts or reply..." 
                            rows="3"
                            onChange={handleMessageChange}
                            value={createMessage.message}
                            required
                        />
                        <button 
                            className="message-send-btn-qa" 
                            type="submit"
                        >
                            <i className="fas fa-paper-plane"></i>
                            Kirim Balasan
                        </button>
                    </form>
                </div>
            </Modal>

            {/* Quiz Modal */}
            <Modal 
                show={quizShow} 
                onHide={isQuizActive ? null : handleQuizClose} 
                size="lg" 
                centered 
                backdrop={isQuizActive ? "static" : true}
                keyboard={isQuizActive ? false : true}
            >
                {/* Debug section - remove in production */}
                {process.env.NODE_ENV === "development" && (
                    <div style={{ position: "absolute", top: 0, right: 0, background: "red", color: "white", padding: "5px", fontSize: "10px", zIndex: 9999 }}>
                        Quiz Debug: Active={isQuizActive ? "Yes" : "No"} | 
                        Questions={selectedQuiz?.questions?.length || 0} | 
                        CurrentQ={currentQuestionIndex} |
                        ShowResult={showQuizResult ? "Yes" : "No"}
                    </div>
                )}
                
                <div className="quiz-modal-header">
                    <div className="quiz-modal-title">
                        <i className="fas fa-brain me-3"></i>
                        {selectedQuiz?.title}
                    </div>
                    {!isQuizActive && (
                        <button type="button" className="quiz-modal-close" onClick={handleQuizClose}>
                            <i className="fas fa-times"></i>
                        </button>
                    )}
                    {isQuizActive && (
                        <div className="quiz-modal-close disabled" style={{opacity: 0.5, cursor: "not-allowed"}} title="Cannot close during active quiz">
                            <i className="fas fa-lock"></i>
                        </div>
                    )}
                </div>
                
                {!isQuizActive && !showQuizResult && selectedQuiz && (
                    <div className="quiz-start-screen">
                        <div className="quiz-intro">
                            <div className="quiz-intro-icon">
                                <i className="fas fa-brain"></i>
                            </div>
                            <h4>{selectedQuiz.title}</h4>
                            <p className="quiz-intro-description">
                                {selectedQuiz.description || "Uji pemahaman Anda tentang materi kursus"}
                            </p>
                            
                            <div className="quiz-info-cards">
                                <div className="quiz-info-card">
                                    <i className="fas fa-question-circle"></i>
                                    <span className="info-number">{selectedQuiz.total_questions}</span>
                                    <span className="info-label">Pertanyaan</span>
                                </div>
                                <div className="quiz-info-card">
                                    <i className="fas fa-clock"></i>
                                    <span className="info-number">{selectedQuiz.total_questions}</span>
                                    <span className="info-label">Menit</span>
                                </div>
                                <div className="quiz-info-card">
                                    <i className="fas fa-trophy"></i>
                                    <span className="info-number">80%</span>
                                    <span className="info-label">Skor Lulus</span>
                                </div>
                                <div className="quiz-info-card">
                                    <i className="fas fa-redo"></i>
                                    <span className={`info-number ${selectedQuiz.today_attempts >= 3 ? "text-danger" : "text-warning"}`}>
                                        {selectedQuiz.today_attempts || 0}/3
                                    </span>
                                    <span className="info-label">Percobaan Hari Ini</span>
                                </div>
                            </div>

                            {/* Attempt Status Warning */}
                            {selectedQuiz.today_attempts > 0 && (
                                <div className={`quiz-attempt-warning ${selectedQuiz.can_attempt ? "warning" : "danger"}`}>
                                    <i className={`fas ${selectedQuiz.can_attempt ? "fa-exclamation-triangle" : "fa-ban"} me-2`}></i>
                                    {selectedQuiz.can_attempt 
                                        ? `Anda telah menggunakan ${selectedQuiz.today_attempts} dari 3 percobaan harian. ${3 - selectedQuiz.today_attempts} percobaan${3 - selectedQuiz.today_attempts !== 1 ? "" : ""} tersisa.`
                                        : "Anda telah mencapai batas harian 3 percobaan. Silakan coba lagi besok."
                                    }
                                </div>
                            )}

                            <div className="quiz-rules">
                                <h6>Aturan Kuis:</h6>
                                <ul>
                                    <li>Anda memiliki 1 menit per pertanyaan</li>
                                    <li>Anda perlu 80% untuk lulus kuis ini</li>
                                    <li>Anda dapat mencoba kuis ini maksimal 3 kali per hari</li>
                                    <li>Setelah dimulai, Anda tidak dapat menjeda kuis</li>
                                </ul>
                            </div>

                            <div className="quiz-start-actions">
                                <button className="btn btn-secondary" onClick={handleQuizClose}>
                                    <i className="fas fa-arrow-left me-2"></i>
                                    Kembali ke Kursus
                                </button>
                                {selectedQuiz.can_attempt ? (
                                    <button className="btn btn-primary" onClick={startQuiz}>
                                        <i className="fas fa-play me-2"></i>
                                        Mulai Kuis
                                    </button>
                                ) : (
                                    <button className="btn btn-secondary" disabled>
                                        <i className="fas fa-ban me-2"></i>
                                        Batas Harian Tercapai
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {isQuizActive && selectedQuiz && (
                    <div className="quiz-active-screen">
                        <div className="quiz-question-progress-bar">
                                <div 
                                    className="quiz-question-progress-fill"
                                    style={{ width: `${((currentQuestionIndex + 1) / (selectedQuiz.questions?.length || 1)) * 100}%` }}
                                ></div>
                        </div>
                        <div className="quiz-question-header">
                            
                            <div className="quiz-progress-info">
                                <div className="question-counter">
                                    Pertanyaan {currentQuestionIndex + 1} dari {selectedQuiz.questions?.length || 0}
                                </div>
                                <div className="quiz-timer">
                                    <i className="fas fa-clock me-2"></i>
                                    {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, "0")}
                                </div>
                            </div>
                        </div>

                        {selectedQuiz.questions && selectedQuiz.questions[currentQuestionIndex] && (
                            <div className="quiz-question-section">
                                <div className="question-text">
                                    {selectedQuiz.questions[currentQuestionIndex].question_text}
                                </div>
                                
                                <div className="quiz-choices">
                                    {selectedQuiz.questions[currentQuestionIndex].choices?.map((choice) => (
                                        <div key={choice.choice_id} className="quiz-choice">
                                            <label className="quiz-choice-label">
                                                <input
                                                    type="radio"
                                                    name={`question_${selectedQuiz.questions[currentQuestionIndex].question_id}`}
                                                    value={choice.choice_id}
                                                    checked={quizAnswers[selectedQuiz.questions[currentQuestionIndex].question_id] == choice.choice_id}
                                                    onChange={(e) => {
                                                        // Update quiz answers
                                                        const newAnswers = {
                                                            ...quizAnswers,
                                                            [selectedQuiz.questions[currentQuestionIndex].question_id]: choice.choice_id
                                                        };
                                                        setQuizAnswers(newAnswers);
                                                        
                                                        // Update ref for timer access
                                                        currentQuizStateRef.current.answers = newAnswers;
                                                        
                                                        // Save progress immediately when answer changes
                                                        if (isQuizActive && selectedQuiz) {
                                                            saveQuizProgress(selectedQuiz, newAnswers, currentQuestionIndex, timeRemaining, quizStartTime);
                                                        }
                                                    }}
                                                />
                                                <span className="quiz-choice-text">{choice.choice_text}</span>
                                                <span className="quiz-choice-indicator"></span>
                                            </label>
                                        </div>
                                    ))}
                                </div>

                                <div className="quiz-navigation">
                                    <button 
                                        className="btn btn-outline-primary"
                                        onClick={() => {
                                            const newIndex = Math.max(0, currentQuestionIndex - 1);
                                            setCurrentQuestionIndex(newIndex);
                                            
                                            // Update ref
                                            currentQuizStateRef.current.questionIndex = newIndex;
                                            
                                            // Save progress when navigating
                                            if (isQuizActive && selectedQuiz) {
                                                saveQuizProgress(selectedQuiz, quizAnswers, newIndex, timeRemaining, quizStartTime);
                                            }
                                        }}
                                        disabled={currentQuestionIndex === 0}
                                    >
                                        <i className="fas fa-arrow-left me-2"></i>
                                        Sebelumnya
                                    </button>
                                    
                                    {currentQuestionIndex < (selectedQuiz.questions?.length || 0) - 1 ? (
                                        <button 
                                            className="btn btn-primary"
                                            onClick={() => {
                                                const newIndex = currentQuestionIndex + 1;
                                                setCurrentQuestionIndex(newIndex);
                                                
                                                // Update ref
                                                currentQuizStateRef.current.questionIndex = newIndex;
                                                
                                                // Save progress when navigating
                                                if (isQuizActive && selectedQuiz) {
                                                    saveQuizProgress(selectedQuiz, quizAnswers, newIndex, timeRemaining, quizStartTime);
                                                }
                                            }}
                                        >
                                            Berikutnya
                                            <i className="fas fa-arrow-right ms-2"></i>
                                        </button>
                                    ) : (
                                        <button 
                                            className="btn btn-success"
                                            onClick={submitQuiz}
                                        >
                                            <i className="fas fa-check me-2"></i>
                                            Kirim Kuis
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {showQuizResult && quizResult && (
                    <div className="quiz-result-screen">
                        <div className="quiz-result-header">
                            <div className={`quiz-result-icon ${quizResult.passed ? "success" : "failure"}`}>
                                <i className={`fas ${quizResult.passed ? "fa-trophy" : "fa-times-circle"}`}></i>
                            </div>
                            <h4 className={`quiz-result-title ${quizResult.passed ? "text-success" : "text-danger"}`}>
                                {quizResult.passed ? "Selamat!" : "Kuis Gagal"}
                            </h4>
                            <p className="quiz-result-message">
                                {quizResult.passed 
                                    ? "Anda telah berhasil lulus kuis!" 
                                    : "Anda membutuhkan 80% atau lebih untuk lulus. Coba lagi!"}
                            </p>
                        </div>

                        <div className="quiz-result-stats">
                            <div className="result-stat">
                                <span className="student-stat-label">Skor Anda</span>
                                <span className={`stat-value ${quizResult.passed ? "text-success" : "text-danger"}`}>
                                    {Math.round(quizResult.score)}%
                                </span>
                            </div>
                            <div className="result-stat">
                                <span className="student-stat-label">Jawaban Benar</span>
                                <span className="stat-value">
                                    {quizResult.correct_answers}/{quizResult.total_questions}
                                </span>
                            </div>
                            <div className="result-stat">
                                <span className="student-stat-label">Waktu yang Digunakan</span>
                                <span className="stat-value">
                                    {(() => {
                                        const timeTaken = quizResult.time_taken || 0;
                                        const minutes = Math.floor(timeTaken / 60);
                                        const seconds = timeTaken % 60;
                                        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
                                    })()}
                                </span>
                            </div>
                            <div className="result-stat">
                                <span className="student-stat-label">Percobaan Hari Ini</span>
                                <span className={`stat-value ${quizResult.attempts_left === 0 ? "text-danger" : "text-warning"}`}>
                                    {quizResult.today_attempts || 0}/{quizResult.max_daily_attempts || 3}
                                </span>
                            </div>
                            {(quizResult.attempts_left !== undefined && quizResult.attempts_left > 0) && (
                                <div className="result-stat">
                                    <span className="student-stat-label">Percobaan Tersisa</span>
                                    <span className="stat-value text-info">
                                        {quizResult.attempts_left}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Attempt Status Alert */}
                        {!quizResult.passed && (
                            <div className={`attempt-status-alert ${quizResult.can_attempt ? "alert-warning" : "alert-danger"}`}>
                                <i className={`fas ${quizResult.can_attempt ? "fa-exclamation-triangle" : "fa-ban"} me-2`}></i>
                                {quizResult.can_attempt 
                                    ? `Anda memiliki ${quizResult.attempts_left} percobaan${quizResult.attempts_left !== 1 ? "" : ""} tersisa hari ini. Anda perlu 80% untuk lulus.`
                                    : "Batas harian tercapai! Anda dapat mencoba lagi besok. (3 percobaan per hari)"
                                }
                            </div>
                        )}

                        <div className="quiz-result-actions">
                            <button className="btn btn-secondary" onClick={handleQuizClose}>
                                <i className="fas fa-arrow-left me-2"></i>
                                Kembali ke Kursus
                            </button>
                            {!quizResult.passed && quizResult.can_attempt && (
                                <button className="btn btn-primary" onClick={startQuiz}>
                                    <i className="fas fa-redo me-2"></i>
                                    Coba Lagi ({quizResult.attempts_left} tersisa)
                                </button>
                            )}
                            {!quizResult.passed && !quizResult.can_attempt && (
                                <button className="btn btn-secondary" disabled>
                                    <i className="fas fa-ban me-2"></i>
                                    Batas Harian Tercapai
                                </button>
                            )}
                            {quizResult.passed && (
                                <button className="btn btn-success" onClick={handleQuizClose}>
                                    <i className="fas fa-check me-2"></i>
                                    Kuis Lulus!
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            {/* Video Resume Dialog */}
            <Footer />
        </>
    );
}

export default CourseDetail;

