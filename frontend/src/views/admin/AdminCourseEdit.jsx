import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, Link } from "react-router-dom";
import apiInstance from "../../utils/axios";
import Toast from "../plugin/Toast";
import Swal from "sweetalert2";
import Footer from "../partials/Footer";
import AdminHeader from "../partials/AdminHeader";
import { getImageUrl } from "../../utils/courseUtils";
import { getMediaUrl } from "../../utils/constants";
import TagSelector from "../instructor/components/TagSelector";
import LessonCompletionQuestionEditor from "../../components/CourseEdit/LessonCompletionQuestionEditor";
import "./AdminCourseEdit.css";

// Lazy load CKEditor component for rich course descriptions
const RichTextEditor = lazy(() => import("../instructor/components/RichTextEditor"));
const PdfRenderer = lazy(() => import("../../components/Common/PdfRenderer"));
const PptxRenderer = lazy(() => import("../../components/Common/PptxRenderer"));

/**
 * Dedicated Real PPT/PPTX and Google Slides Viewer
 */
const PresentationPreview = ({ fileUrl }) => {
    if (!fileUrl) return null;

    if (fileUrl.includes("docs.google.com/presentation")) {
        let embedUrl = fileUrl;
        if (embedUrl.includes("/edit") || embedUrl.includes("/view")) {
            embedUrl = embedUrl.replace(/\/(edit|view).*$/, "/embed?start=false&loop=false&delayms=3000");
        } else if (!embedUrl.endsWith("/embed")) {
            embedUrl = embedUrl.replace(/\/$/, "") + "/embed";
        }
        return (
            <div className="ratio ratio-16x9 w-100 rounded overflow-hidden" style={{ minHeight: "420px" }}>
                <iframe
                    src={embedUrl}
                    title="Google Slides Presentation"
                    allowFullScreen
                    style={{ border: 0, width: "100%", height: "100%" }}
                />
            </div>
        );
    }

    return (
        <Suspense fallback={
            <div className="p-4 text-center text-muted">
                <i className="fas fa-spinner fa-spin me-2 text-teal"></i>
                <span>Memuat Penampil Presentasi PPTX...</span>
            </div>
        }>
            <PptxRenderer
                fileUrl={fileUrl}
                height="460px"
                showThumbnails={true}
                showToolbar={true}
            />
        </Suspense>
    );
};

/**
 * Dedicated PDF and Google Docs Document Viewer
 */
const DocumentPreview = ({ fileUrl, title }) => {
    if (!fileUrl) return null;

    if (fileUrl.includes("drive.google.com") || fileUrl.includes("docs.google.com")) {
        const match = fileUrl.match(/\/d\/([a-zA-Z0-9-_]+)/) || fileUrl.match(/[?&]id=([a-zA-Z0-9-_]+)/);
        const fileId = match ? match[1] : null;
        const embedUrl = fileId ? `https://drive.google.com/file/d/${fileId}/preview` : fileUrl;
        return (
            <div className="w-100 rounded overflow-hidden" style={{ height: "480px" }}>
                <iframe
                    src={embedUrl}
                    title={title || "Google Drive Document"}
                    allowFullScreen
                    className="w-100 h-100 border-0"
                />
            </div>
        );
    }

    return (
        <Suspense fallback={
            <div className="p-4 text-center text-muted">
                <i className="fas fa-spinner fa-spin me-2 text-teal"></i>
                <span>Memuat Penampil Dokumen PDF...</span>
            </div>
        }>
            <PdfRenderer
                fileUrl={fileUrl}
                height="480px"
                title={title || "Dokumen PDF"}
            />
        </Suspense>
    );
};

function AdminCourseEdit() {
    const { course_id } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [uploadingVideo, setUploadingVideo] = useState(false);
    const [activeTab, setActiveTab] = useState("info"); // "info", "curriculum", "outcomes", "quizzes", "status"

    // Course state
    const [course, setCourse] = useState(null);
    const [categories, setCategories] = useState([]);
    const [availableTags, setAvailableTags] = useState([]);

    // Form fields
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [descriptionMode, setDescriptionMode] = useState("visual"); // "visual" | "raw"
    const [categoryId, setCategoryId] = useState("");
    const [level, setLevel] = useState("Beginner");
    const [language, setLanguage] = useState("Bahasa Indonesia");
    const [courseDuration, setCourseDuration] = useState("");
    const [targetAudience, setTargetAudience] = useState("internal");
    const [platformStatus, setPlatformStatus] = useState("Published");

    // Media states (Image & Video)
    const [image, setImage] = useState("");
    const [imageUploadMode, setImageUploadMode] = useState("file"); // "file" | "url"
    const [imageUrlInput, setImageUrlInput] = useState("");
    const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
    const [isDraggingImage, setIsDraggingImage] = useState(false);
    const [imageUploadProgress, setImageUploadProgress] = useState(0);

    const [file, setFile] = useState("");
    const [videoSourceMode, setVideoSourceMode] = useState("url"); // "url" | "upload"
    const [videoUrlInput, setVideoUrlInput] = useState("");
    const [videoUploadProgress, setVideoUploadProgress] = useState(0);
    const [isDraggingVideo, setIsDraggingVideo] = useState(false);

    const [features, setFeatures] = useState([]);
    const [requirements, setRequirements] = useState([]);
    const [learningOutcomes, setLearningOutcomes] = useState([]);
    const [selectedTags, setSelectedTags] = useState([]);
    const [curriculum, setCurriculum] = useState([]);

    // Curriculum enhanced state
    const [collapsedSections, setCollapsedSections] = useState({});
    const [previewingItems, setPreviewingItems] = useState({});
    const [lectureMediaModes, setLectureMediaModes] = useState({});
    const [lectureUploadProgress, setLectureUploadProgress] = useState({});
    const [uploadingLecture, setUploadingLecture] = useState({});

    // SCORM Interactive Player Modal State (Admin Preview & Verification)
    const [scormPreviewModal, setScormPreviewModal] = useState({
        isOpen: false,
        title: "",
        url: "",
        moduleType: "scorm_12",
        isFullscreen: false
    });
    const [scormPlayerStatus, setScormPlayerStatus] = useState("not attempted");
    const [scormPlayerScore, setScormPlayerScore] = useState(null);
    const scormIframeRef = useRef(null);

    // SCORM 1.2 RTE API Bridge for interactive preview testing by Administrator
    useEffect(() => {
        if (!scormPreviewModal.isOpen) return;

        const cmi = {
            "cmi.core.student_id": "admin_preview",
            "cmi.core.student_name": "Administrator Penguji",
            "cmi.core.lesson_status": scormPlayerStatus,
            "cmi.core.score.raw": scormPlayerScore !== null ? String(scormPlayerScore) : "0",
            "cmi.core.lesson_location": "",
            "cmi.core.session_time": "00:00:00",
            "cmi.suspend_data": "",
            "cmi.core.entry": "ab-initio",
            "cmi.core.exit": "",
            "cmi.core.total_time": "00:00:00",
            "cmi.core.lesson_mode": "normal"
        };

        window.API = {
            LMSInitialize: (param) => {
                console.log("[Admin SCORM RTE] LMSInitialize:", param);
                return "true";
            },
            LMSGetValue: (element) => {
                const val = cmi[element] !== undefined ? cmi[element] : "";
                console.log(`[Admin SCORM RTE] LMSGetValue(${element}) ->`, val);
                return val;
            },
            LMSSetValue: (element, value) => {
                console.log(`[Admin SCORM RTE] LMSSetValue(${element}, ${value})`);
                cmi[element] = String(value);
                if (element === "cmi.core.lesson_status") {
                    setScormPlayerStatus(String(value).toLowerCase());
                }
                if (element === "cmi.core.score.raw") {
                    setScormPlayerScore(Number(value) || 0);
                }
                return "true";
            },
            LMSCommit: (param) => {
                console.log("[Admin SCORM RTE] LMSCommit:", param);
                return "true";
            },
            LMSFinish: (param) => {
                console.log("[Admin SCORM RTE] LMSFinish:", param);
                return "true";
            },
            LMSGetLastError: () => "0",
            LMSGetErrorString: () => "No error",
            LMSGetDiagnostic: () => "No error"
        };

        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            delete window.API;
            document.body.style.overflow = prevOverflow;
        };
    }, [scormPreviewModal.isOpen]);

    const handleOpenScormPreview = (item) => {
        let lm = item?.learning_module_info || (item?.learning_module && typeof item.learning_module === 'object' ? item.learning_module : null) || course?.learning_module;
        if (!lm) {
            for (const v of curriculum || []) {
                for (const it of v.items || []) {
                    if (it.learning_module_info || (it.learning_module && typeof it.learning_module === 'object')) {
                        lm = it.learning_module_info || it.learning_module;
                        break;
                    }
                }
                if (lm) break;
            }
        }

        let url = "";
        if (lm?.player_url) {
            url = getMediaUrl(lm.player_url);
        } else if (lm?.id) {
            url = getMediaUrl(`/media/learning_modules/extracted_${lm.id}/${lm.entry_file || 'index.html'}`);
        } else if (course?.learning_module_id) {
            url = getMediaUrl(`/media/learning_modules/extracted_${course.learning_module_id}/index.html`);
        } else if (item?.file && (item.file.includes("/extracted_") || item.file.includes("index.html"))) {
            url = getMediaUrl(item.file);
        }

        if (!url) {
            Swal.fire({
                icon: "warning",
                title: "Modul SCORM Belum Siap",
                text: "URL pemutar konten SCORM tidak ditemukan. Pastikan modul SCORM telah berhasil diekstrak.",
                confirmButtonColor: "#0d9488"
            });
            return;
        }

        setScormPlayerStatus("not attempted");
        setScormPlayerScore(null);
        setScormPreviewModal({
            isOpen: true,
            title: item?.title || lm?.judul || course?.title || "Pratinjau Modul SCORM",
            url: url,
            moduleType: lm?.module_type || course?.course_type || "scorm_12",
            isFullscreen: false
        });
    };

    const imageInputRef = useRef(null);
    const videoInputRef = useRef(null);
    const quizFileInputRef = useRef(null);

    // Available SCORM modules from library
    const [availableScormModules, setAvailableScormModules] = useState([]);

    // Helper to accurately detect content type from item attributes & file URL
    const detectItemContentType = (itm) => {
        if (!itm) return "video";
        if (itm.item_type === "quiz" || itm.quiz_id || itm.quiz) {
            return "quiz";
        }
        if (
            itm.content_type === "scorm" ||
            itm.content_type === "h5p" ||
            itm.file_type === "scorm" ||
            itm.file_type === "h5p" ||
            Boolean(itm.learning_module_id) ||
            Boolean(itm.learning_module_info) ||
            Boolean(itm.learning_module)
        ) {
            return "scorm";
        }
        const fileLower = (itm.file || itm.uploadedFile || "").toLowerCase().split("?")[0];
        if (fileLower.endsWith(".zip") && (fileLower.includes("scorm") || fileLower.includes("extracted_") || !fileLower.includes("presentation"))) {
            return "scorm";
        }
        if (
            itm.content_type === "presentation" ||
            itm.file_type === "presentation" ||
            itm.file_type === "ppt" ||
            fileLower.endsWith(".pptx") ||
            fileLower.endsWith(".ppt")
        ) {
            return "presentation";
        }
        if (
            itm.content_type === "document" ||
            itm.file_type === "document" ||
            itm.file_type === "pdf" ||
            fileLower.endsWith(".pdf") ||
            fileLower.endsWith(".doc") ||
            fileLower.endsWith(".docx")
        ) {
            return "document";
        }
        if (
            itm.content_type === "audio" ||
            itm.file_type === "audio" ||
            fileLower.endsWith(".mp3") ||
            fileLower.endsWith(".wav") ||
            fileLower.endsWith(".ogg") ||
            fileLower.endsWith(".m4a") ||
            fileLower.endsWith(".flac")
        ) {
            return "audio";
        }
        if (
            itm.content_type === "video" ||
            itm.file_type === "video" ||
            fileLower.endsWith(".mp4") ||
            fileLower.endsWith(".webm") ||
            fileLower.endsWith(".avi") ||
            fileLower.endsWith(".mov") ||
            fileLower.endsWith(".mkv")
        ) {
            return "video";
        }
        if (itm.content_type && ["video", "document", "presentation", "audio", "scorm", "quiz"].includes(itm.content_type)) {
            return itm.content_type;
        }
        return "video";
    };

    // Quizzes & Questions state (for Tab 4: Kuis Terlampir Studio)
    const [quizzes, setQuizzes] = useState([]);
    const [quizSubTab, setQuizSubTab] = useState("overview"); // "overview" | "questions"
    const [quizTypeFilter, setQuizTypeFilter] = useState("all"); // "all" | "quiz" | "pre_post_test"
    const [currentQuiz, setCurrentQuiz] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [loadingQuestions, setLoadingQuestions] = useState(false);

    // Quiz Modal state
    const [showQuizModal, setShowQuizModal] = useState(false);
    const [editingQuiz, setEditingQuiz] = useState(null);
    const [quizForm, setQuizForm] = useState({
        title: "",
        description: "",
        quiz_type: "quiz",
        presentation_mode: "ordered",
        is_active: true
    });

    // Question Form state
    const [isAddingQuestion, setIsAddingQuestion] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState(null);
    const [questionForm, setQuestionForm] = useState({
        question_text: "",
        choices: [
            { choice_text: "", is_correct: true },
            { choice_text: "", is_correct: false },
            { choice_text: "", is_correct: false },
            { choice_text: "", is_correct: false }
        ]
    });

    // Import Modal state
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importTargetQuizId, setImportTargetQuizId] = useState("new");
    const [importNewQuizTitle, setImportNewQuizTitle] = useState("");
    const [importNewQuizType, setImportNewQuizType] = useState("quiz");
    const [parsedQuestions, setParsedQuestions] = useState([]);
    const [isImporting, setIsImporting] = useState(false);
    const [importError, setImportError] = useState("");
    const [isDragOver, setIsDragOver] = useState(false);

    // Ensure body has 0px top padding so the unified sticky header docks flush to the very top (0px gap above wrapper)
    useEffect(() => {
        document.body.classList.add("admin-course-edit-active");
        document.body.style.setProperty("padding-top", "0px", "important");
        document.body.style.setProperty("margin", "0px", "important");

        return () => {
            document.body.classList.remove("admin-course-edit-active");
            document.body.style.removeProperty("padding-top");
            document.body.style.removeProperty("margin");
        };
    }, []);

    // Fetch course details
    const fetchCourseData = async () => {
        try {
            setLoading(true);
            const response = await apiInstance.get(`/admin/course-direct-edit/${course_id}/`);
            const data = response.data;
            const c = data.course || {};

            setCourse(c);
            setTitle(c.title || "");
            setDescription(c.description || "");
            setCategoryId(c.category?.id || (typeof c.category === "object" ? c.category?.id : c.category) || "");
            setLevel(c.level || "Beginner");
            setLanguage(c.language || "Bahasa Indonesia");
            setCourseDuration(c.course_duration || "");
            setTargetAudience(c.target_audience || "internal");
            setPlatformStatus(c.platform_status || "Published");
            setImage(c.image || "");
            setImageUrlInput(c.image || "");
            setFile(c.file || "");
            setVideoUrlInput(c.file || "");

            // Auto-detect initial media modes
            if (c.image && (c.image.includes("drive.google.com") || c.image.startsWith("http"))) {
                setImageUploadMode("url");
            } else {
                setImageUploadMode("file");
            }

            if (c.file && (c.file.includes("youtube.com") || c.file.includes("youtu.be") || c.file.includes("drive.google.com") || c.file.startsWith("http"))) {
                setVideoSourceMode("url");
            } else if (c.file) {
                setVideoSourceMode("upload");
            }

            // Features, requirements, learning outcomes
            setFeatures(
                Array.isArray(c.features)
                    ? c.features.map(f => ({
                        id: f.id || Math.random(),
                        icon: f.icon || "fas fa-check",
                        text: f.text || f.title || (typeof f === "string" ? f : ""),
                        highlight: Boolean(f.highlight)
                    }))
                    : []
            );
            setRequirements(
                Array.isArray(c.requirements)
                    ? c.requirements.map(r => ({
                        id: r.id || Math.random(),
                        text: r.requirement || r.text || r.title || (typeof r === "string" ? r : "")
                    }))
                    : []
            );
            setLearningOutcomes(
                Array.isArray(c.learning_outcomes)
                    ? c.learning_outcomes.map(o => ({
                        id: o.id || Math.random(),
                        text: o.outcome || o.text || o.title || (typeof o === "string" ? o : "")
                    }))
                    : []
            );

            // Curriculum
            if (Array.isArray(c.curriculum)) {
                setCurriculum(c.curriculum.map((sec, sIdx) => ({
                    variant_id: sec.variant_id,
                    variant_title: sec.variant_title || sec.title || `Bagian ${sIdx + 1}`,
                    order: sec.order !== undefined ? sec.order : sIdx,
                    items: Array.isArray(sec.variant_items || sec.items)
                        ? (sec.variant_items || sec.items).map((itm, iIdx) => {
                            const detectedType = detectItemContentType(itm);
                            const lmInfo = itm.learning_module_info || (typeof itm.learning_module === "object" ? itm.learning_module : null) || (c.learning_module && (itm.learning_module_id === c.learning_module.id || itm.learning_module === c.learning_module.id) ? c.learning_module : null);
                            const lmId = itm.learning_module_id || (itm.learning_module?.id) || (lmInfo?.id) || (typeof itm.learning_module === "number" ? itm.learning_module : null) || null;

                            return {
                                variant_item_id: itm.variant_item_id,
                                title: itm.title || `Materi ${iIdx + 1}`,
                                description: itm.description || "",
                                file: itm.file || "",
                                duration: itm.duration || "",
                                content_type: detectedType,
                                file_type: itm.file_type || detectedType,
                                item_type: detectedType === "quiz" ? "quiz" : "lesson",
                                quiz_id: itm.quiz_id || (itm.quiz && typeof itm.quiz === "object" ? itm.quiz.quiz_id : (itm.quiz || "")),
                                learning_module_id: lmId,
                                learning_module_info: lmInfo,
                                learning_module: lmId,
                                preview: Boolean(itm.preview),
                                order: itm.order !== undefined ? itm.order : iIdx
                            };
                        })
                        : []
                })));
            }

            // Available SCORM Modules library
            try {
                const scormRes = await apiInstance.get(`/teacher/upload-elearning-module/?course_id=${course_id}/`);
                if (Array.isArray(scormRes.data?.modules)) {
                    setAvailableScormModules(scormRes.data.modules);
                }
            } catch (sErr) {
                console.warn("[AdminCourseEdit] Could not fetch SCORM modules:", sErr);
            }

            // Categories & tags
            const loadedAvailableTags = data.tags || [];
            if (data.categories) setCategories(data.categories);
            setAvailableTags(loadedAvailableTags);
            if (Array.isArray(c.tags)) {
                const mappedSelectedTags = c.tags.map(t => {
                    if (typeof t === "object" && t !== null && t.id) return t;
                    const found = loadedAvailableTags.find(at => at.id === t);
                    return found || { id: t, title: `Tag #${t}` };
                });
                setSelectedTags(mappedSelectedTags);
            }

            // Quizzes
            setQuizzes(Array.isArray(c.quizzes) ? c.quizzes : []);

        } catch (error) {
            console.error("Error loading course for direct edit:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat data kursus untuk direct-edit"
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCourseData();
    }, [course_id]);

    // Google Drive URL Converter for high-res thumbnail
    const convertGoogleDriveUrl = (url) => {
        if (!url) return "";
        if (url.includes("drive.google.com") || url.includes("drive.usercontent.google.com")) {
            const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/) || url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
            if (match && match[1]) {
                return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1200`;
            }
        }
        return url;
    };

    // YouTube ID Extractor
    const extractYoutubeId = (url) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    // Google Drive Video ID Extractor
    const extractGoogleDriveFileId = (url) => {
        if (!url) return null;
        const regexps = [
            /drive\.google\.com\/file\/d\/([a-zA-Z0-9-_]+)/,
            /drive\.google\.com\/open\?id=([a-zA-Z0-9-_]+)/,
            /drive\.google\.com\/file\/d\/([a-zA-Z0-9-_]+)\/preview/,
            /drive\.google\.com\/file\/d\/([a-zA-Z0-9-_]+)\/view/
        ];
        for (const r of regexps) {
            const match = url.match(r);
            if (match?.[1]) return match[1];
        }
        return null;
    };

    // Handle Image Natural Dimensions
    const handleImageLoad = (e) => {
        if (e.target) {
            setImageDimensions({
                width: e.target.naturalWidth || 0,
                height: e.target.naturalHeight || 0
            });
        }
    };

    // Apply URL image with Google Drive conversion
    const handleUrlImageApply = (inputVal) => {
        const targetVal = inputVal !== undefined ? inputVal : imageUrlInput;
        if (!targetVal || !targetVal.trim()) {
            setImage("");
            setImageUrlInput("");
            return;
        }
        const converted = convertGoogleDriveUrl(targetVal.trim());
        setImage(converted);
        setImageUrlInput(targetVal.trim());
        Toast().fire({
            icon: "success",
            title: "Tautan gambar thumbnail berhasil diterapkan"
        });
    };

    // Apply URL video
    const handleUrlVideoApply = (inputVal) => {
        const targetVal = inputVal !== undefined ? inputVal : videoUrlInput;
        if (!targetVal || !targetVal.trim()) {
            setFile("");
            setVideoUrlInput("");
            return;
        }
        setFile(targetVal.trim());
        setVideoUrlInput(targetVal.trim());
        Toast().fire({
            icon: "success",
            title: "Tautan video pengantar berhasil diterapkan"
        });
    };

    // Handle Direct File Upload (Image) - supports file input event or direct File object (drag-and-drop)
    const handleImageUpload = async (fileOrEvent) => {
        const selectedFile = fileOrEvent?.target?.files ? fileOrEvent.target.files[0] : fileOrEvent;
        if (!selectedFile) return;

        if (selectedFile.size > 5 * 1024 * 1024) {
            Toast().fire({
                icon: "warning",
                title: "Ukuran berkas melebihi batas maksimal 5 MB"
            });
            return;
        }

        try {
            setUploadingImage(true);
            setImageUploadProgress(20);
            const formData = new FormData();
            formData.append("file", selectedFile);

            const res = await apiInstance.post("/file-upload/", formData, {
                headers: { "Content-Type": "multipart/form-data" },
                onUploadProgress: (progressEvent) => {
                    const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
                    setImageUploadProgress(percent);
                }
            });

            const uploadedUrl = res.data?.url || res.data?.file_url;
            if (uploadedUrl) {
                setImage(uploadedUrl);
                setImageUrlInput(uploadedUrl);
                setImageUploadMode("file");
                Toast().fire({
                    icon: "success",
                    title: "Gambar sampul berhasil diunggah"
                });
            }
        } catch (err) {
            console.error("Image upload failed:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal mengunggah thumbnail gambar"
            });
        } finally {
            setUploadingImage(false);
            setImageUploadProgress(0);
        }
    };

    // Handle Direct File Upload (Intro Video)
    const handleVideoUpload = async (fileOrEvent) => {
        const selectedFile = fileOrEvent?.target?.files ? fileOrEvent.target.files[0] : fileOrEvent;
        if (!selectedFile) return;

        if (selectedFile.size > 500 * 1024 * 1024) {
            Toast().fire({
                icon: "warning",
                title: "Ukuran video melebihi batas maksimal 500 MB"
            });
            return;
        }

        try {
            setUploadingVideo(true);
            setVideoUploadProgress(20);
            const formData = new FormData();
            formData.append("file", selectedFile);

            const res = await apiInstance.post("/file-upload/", formData, {
                headers: { "Content-Type": "multipart/form-data" },
                onUploadProgress: (progressEvent) => {
                    const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
                    setVideoUploadProgress(percent);
                }
            });

            const uploadedUrl = res.data?.url || res.data?.file_url;
            if (uploadedUrl) {
                setFile(uploadedUrl);
                setVideoUrlInput(uploadedUrl);
                setVideoSourceMode("upload");
                Toast().fire({
                    icon: "success",
                    title: "Video pengantar berhasil diunggah"
                });
            }
        } catch (err) {
            console.error("Video upload failed:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal mengunggah file video"
            });
        } finally {
            setUploadingVideo(false);
            setVideoUploadProgress(0);
        }
    };

    // =========================================================================
    // ICONS & PRESETS FOR TAB 3: FITUR & CAPAIAN BELAJAR STUDIO
    // =========================================================================

    const FEATURE_ICON_OPTIONS = [
        { value: "fas fa-certificate", label: "Sertifikat", icon: "🎓" },
        { value: "fas fa-mobile-alt", label: "Multi-Device", icon: "📱" },
        { value: "fas fa-infinity", label: "Akses Selamanya", icon: "♾️" },
        { value: "fas fa-file-arrow-down", label: "Materi Unduhan", icon: "📥" },
        { value: "fas fa-award", label: "Lencana BerAKHLAK", icon: "🏅" },
        { value: "fas fa-comments", label: "Forum Diskusi", icon: "💬" },
        { value: "fas fa-clock", label: "Belajar Fleksibel", icon: "⏱️" },
        { value: "fas fa-video", label: "Video HD", icon: "🎥" },
        { value: "fas fa-check-double", label: "Kuis Evaluasi", icon: "✅" },
        { value: "fas fa-laptop-code", label: "Praktek Mandiri", icon: "💻" },
    ];

    const FEATURE_PRESETS = [
        { text: "Sertifikat Kelulusan Resmi Setjen DPD RI", icon: "fas fa-certificate", highlight: true },
        { text: "Akses Multi-Perangkat (Laptop, Tablet & Ponsel)", icon: "fas fa-mobile-alt", highlight: false },
        { text: "Bahan Tayang & Modul Panduan (PDF) Dapat Diunduh", icon: "fas fa-file-arrow-down", highlight: false },
        { text: "Akses Materi Selamanya & Pembaruan Konten Berkala", icon: "fas fa-infinity", highlight: false },
        { text: "Forum Diskusi & Konsultasi Interaktif", icon: "fas fa-comments", highlight: false },
        { text: "Lencana Prestasi Kompetensi ASN BerAKHLAK", icon: "fas fa-award", highlight: true },
    ];

    const REQUIREMENT_PRESETS = [
        "Memiliki perangkat PC/Laptop dengan koneksi internet yang stabil",
        "Memahami tugas dan fungsi dasar ASN di lingkungan Sekretariat Jenderal DPD RI",
        "Memiliki akun aktif di Portal Pembelajaran LMS Setjen DPD RI",
        "Komitmen menyelesaikan seluruh materi, evaluasi kuis, dan tugas akhir",
        "Kemauan aktif untuk mengembangkan kompetensi kerja mandiri"
    ];

    const OUTCOME_PRESETS = [
        "Memahami regulasi, tata kelola, dan kebijakan terkini di lingkungan Setjen DPD RI",
        "Mampu menerapkan standar operasional prosedur (SOP) secara mandiri dan efektif",
        "Meningkatkan efisiensi kerja operasional dan akurasi penyusunan dokumen dinas",
        "Mampu menganalisis dan memecahkan studi kasus teknis di unit kerja",
        "Menerapkan nilai-nilai BerAKHLAK dalam pelayanan publik dan birokrasi"
    ];

    // Helper functions for Features
    const addFeature = (text = "", icon = "fas fa-check", highlight = false) => {
        setFeatures(prev => [
            ...prev,
            { id: Math.random(), text, icon, highlight }
        ]);
    };

    const updateFeature = (index, field, value) => {
        setFeatures(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const removeFeature = (index) => {
        const item = features[index];
        Swal.fire({
            title: "Hapus Fitur Kursus?",
            text: `Yakin ingin menghapus fitur "${item.text || 'Fitur ini'}"?`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Ya, Hapus",
            cancelButtonText: "Batal"
        }).then(result => {
            if (result.isConfirmed) {
                setFeatures(prev => prev.filter((_, i) => i !== index));
                Toast().fire({ icon: "success", title: "Fitur berhasil dihapus" });
            }
        });
    };

    const moveFeatureUp = (index) => {
        if (index <= 0) return;
        setFeatures(prev => {
            const next = [...prev];
            const temp = next[index];
            next[index] = next[index - 1];
            next[index - 1] = temp;
            return next;
        });
    };

    const moveFeatureDown = (index) => {
        if (index >= features.length - 1) return;
        setFeatures(prev => {
            const next = [...prev];
            const temp = next[index];
            next[index] = next[index + 1];
            next[index + 1] = temp;
            return next;
        });
    };

    const toggleFeatureHighlight = (index) => {
        setFeatures(prev => {
            const next = [...prev];
            next[index] = { ...next[index], highlight: !next[index].highlight };
            return next;
        });
    };

    // Helper functions for Requirements
    const addRequirement = (text = "") => {
        setRequirements(prev => [...prev, { id: Math.random(), text }]);
    };

    const updateRequirement = (index, value) => {
        setRequirements(prev => {
            const next = [...prev];
            next[index] = { ...next[index], text: value };
            return next;
        });
    };

    const removeRequirement = (index) => {
        const item = requirements[index];
        Swal.fire({
            title: "Hapus Prasyarat?",
            text: `Yakin ingin menghapus prasyarat "${item.text || 'Prasyarat ini'}"?`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Ya, Hapus",
            cancelButtonText: "Batal"
        }).then(result => {
            if (result.isConfirmed) {
                setRequirements(prev => prev.filter((_, i) => i !== index));
                Toast().fire({ icon: "success", title: "Prasyarat berhasil dihapus" });
            }
        });
    };

    const moveRequirementUp = (index) => {
        if (index <= 0) return;
        setRequirements(prev => {
            const next = [...prev];
            const temp = next[index];
            next[index] = next[index - 1];
            next[index - 1] = temp;
            return next;
        });
    };

    const moveRequirementDown = (index) => {
        if (index >= requirements.length - 1) return;
        setRequirements(prev => {
            const next = [...prev];
            const temp = next[index];
            next[index] = next[index + 1];
            next[index + 1] = temp;
            return next;
        });
    };

    // Helper functions for Learning Outcomes
    const addOutcome = (text = "") => {
        setLearningOutcomes(prev => [...prev, { id: Math.random(), text }]);
    };

    const updateOutcome = (index, value) => {
        setLearningOutcomes(prev => {
            const next = [...prev];
            next[index] = { ...next[index], text: value };
            return next;
        });
    };

    const removeOutcome = (index) => {
        const item = learningOutcomes[index];
        Swal.fire({
            title: "Hapus Capaian Pembelajaran?",
            text: `Yakin ingin menghapus capaian "${item.text || 'Capaian ini'}"?`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Ya, Hapus",
            cancelButtonText: "Batal"
        }).then(result => {
            if (result.isConfirmed) {
                setLearningOutcomes(prev => prev.filter((_, i) => i !== index));
                Toast().fire({ icon: "success", title: "Capaian pembelajaran berhasil dihapus" });
            }
        });
    };

    const moveOutcomeUp = (index) => {
        if (index <= 0) return;
        setLearningOutcomes(prev => {
            const next = [...prev];
            const temp = next[index];
            next[index] = next[index - 1];
            next[index - 1] = temp;
            return next;
        });
    };

    const moveOutcomeDown = (index) => {
        if (index >= learningOutcomes.length - 1) return;
        setLearningOutcomes(prev => {
            const next = [...prev];
            const temp = next[index];
            next[index] = next[index + 1];
            next[index + 1] = temp;
            return next;
        });
    };

    // =========================================================================
    // QUIZZES & QUESTIONS HELPERS (QUIZ-TOOLBAR & QUIZ-OVERVIEW STUDIO)
    // =========================================================================

    const fetchQuizzes = async () => {
        try {
            const response = await apiInstance.get(`quiz/list-create/?course_id=${course_id}`);
            const data = Array.isArray(response.data) ? response.data : (response.data?.results || []);
            setQuizzes(data);
            if (currentQuiz) {
                const updatedCurrent = data.find(q => q.quiz_id === currentQuiz.quiz_id);
                if (updatedCurrent) setCurrentQuiz(updatedCurrent);
            }
        } catch (err) {
            console.error("Error fetching quizzes:", err);
        }
    };

    const fetchQuestions = async (quizId) => {
        if (!quizId) return;
        try {
            setLoadingQuestions(true);
            const response = await apiInstance.get(`quiz/question/list-create/?quiz_id=${quizId}`);
            const data = Array.isArray(response.data) ? response.data : (response.data?.results || []);
            setQuestions(data);
        } catch (err) {
            console.error("Error fetching questions:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat daftar soal"
            });
        } finally {
            setLoadingQuestions(false);
        }
    };

    const handleSelectQuiz = (quiz) => {
        setCurrentQuiz(quiz);
        setQuizSubTab("questions");
        setIsAddingQuestion(false);
        setEditingQuestion(null);
        fetchQuestions(quiz.quiz_id);
    };

    const handleOpenCreateQuiz = () => {
        setEditingQuiz(null);
        setQuizForm({
            title: "",
            description: "",
            quiz_type: "quiz",
            presentation_mode: "ordered",
            is_active: true
        });
        setShowQuizModal(true);
    };

    const handleEditQuiz = (quiz) => {
        setEditingQuiz(quiz);
        setQuizForm({
            title: quiz.title || "",
            description: quiz.description || "",
            quiz_type: quiz.quiz_type || "quiz",
            presentation_mode: quiz.presentation_mode || "ordered",
            is_active: quiz.is_active !== undefined ? quiz.is_active : true
        });
        setShowQuizModal(true);
    };

    const handleSaveQuiz = async (e) => {
        if (e) e.preventDefault();
        if (!quizForm.title.trim()) {
            Toast().fire({
                icon: "warning",
                title: "Judul kuis tidak boleh kosong"
            });
            return;
        }

        try {
            const payload = {
                ...quizForm,
                course_id: course_id
            };

            if (editingQuiz) {
                await apiInstance.put(`quiz/detail/${editingQuiz.quiz_id}/`, payload);
                Toast().fire({
                    icon: "success",
                    title: "Kuis berhasil diperbarui"
                });
            } else {
                await apiInstance.post("quiz/list-create/", payload);
                Toast().fire({
                    icon: "success",
                    title: "Kuis berhasil dibuat"
                });
            }

            setShowQuizModal(false);
            setEditingQuiz(null);
            await fetchQuizzes();
        } catch (err) {
            console.error("Error saving quiz:", err);
            Toast().fire({
                icon: "error",
                title: err.response?.data?.error || "Gagal menyimpan kuis"
            });
        }
    };

    const handleDeleteQuiz = (quizId, quizTitle) => {
        Swal.fire({
            title: "Hapus Kuis?",
            text: `Apakah Anda yakin ingin menghapus kuis "${quizTitle || 'ini'}"? Semua pertanyaan di dalamnya akan ikut terhapus secara permanen.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Ya, Hapus Kuis",
            cancelButtonText: "Batal"
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await apiInstance.delete(`quiz/detail/${quizId}/`);
                    Toast().fire({
                        icon: "success",
                        title: "Kuis berhasil dihapus"
                    });
                    if (currentQuiz?.quiz_id === quizId) {
                        setCurrentQuiz(null);
                        setQuestions([]);
                        setQuizSubTab("overview");
                    }
                    await fetchQuizzes();
                } catch (err) {
                    console.error("Error deleting quiz:", err);
                    Toast().fire({
                        icon: "error",
                        title: "Gagal menghapus kuis"
                    });
                }
            }
        });
    };

    const handleToggleQuizActive = async (quiz) => {
        try {
            const newStatus = !quiz.is_active;
            await apiInstance.put(`quiz/detail/${quiz.quiz_id}/`, {
                title: quiz.title,
                description: quiz.description,
                quiz_type: quiz.quiz_type,
                presentation_mode: quiz.presentation_mode,
                is_active: newStatus,
                course_id: course_id
            });
            Toast().fire({
                icon: "success",
                title: `Kuis berhasil ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}`
            });
            await fetchQuizzes();
        } catch (err) {
            console.error("Error toggling quiz status:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal mengubah status kuis"
            });
        }
    };

    const handleOpenAddQuestion = () => {
        setEditingQuestion(null);
        setQuestionForm({
            question_text: "",
            choices: [
                { choice_text: "", is_correct: true },
                { choice_text: "", is_correct: false },
                { choice_text: "", is_correct: false },
                { choice_text: "", is_correct: false }
            ]
        });
        setIsAddingQuestion(true);
    };

    const handleEditQuestion = (question) => {
        const existingChoices = Array.isArray(question.choices) ? question.choices : [];
        let formChoices = [];
        if (existingChoices.length >= 4) {
            formChoices = existingChoices.slice(0, 4).map(c => ({
                choice_text: c.choice_text || "",
                is_correct: Boolean(c.is_correct)
            }));
        } else {
            formChoices = [
                ...existingChoices.map(c => ({
                    choice_text: c.choice_text || "",
                    is_correct: Boolean(c.is_correct)
                })),
                ...Array(Math.max(0, 4 - existingChoices.length)).fill(null).map(() => ({
                    choice_text: "",
                    is_correct: false
                }))
            ];
        }

        setQuestionForm({
            question_text: question.question_text || "",
            choices: formChoices
        });
        setEditingQuestion(question);
        setIsAddingQuestion(false);

        setTimeout(() => {
            const el = document.getElementById(`question-edit-${question.question_id || question.id}`);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }, 80);
    };

    const handleSaveQuestion = async (e) => {
        if (e) e.preventDefault();
        if (!questionForm.question_text.trim()) {
            Toast().fire({
                icon: "warning",
                title: "Teks pertanyaan wajib diisi"
            });
            return;
        }

        const validChoices = questionForm.choices.filter(c => c.choice_text.trim());
        if (validChoices.length < 2) {
            Toast().fire({
                icon: "warning",
                title: "Berikan minimal 2 pilihan jawaban"
            });
            return;
        }

        const hasCorrect = validChoices.some(c => c.is_correct);
        if (!hasCorrect) {
            Toast().fire({
                icon: "warning",
                title: "Tandai minimal satu pilihan sebagai jawaban benar"
            });
            return;
        }

        try {
            const questionPayload = {
                question_text: questionForm.question_text.trim(),
                quiz_id: currentQuiz.quiz_id
            };

            let savedQuestion;
            if (editingQuestion) {
                const res = await apiInstance.put(`quiz/question/detail/${editingQuestion.question_id}/`, questionPayload);
                savedQuestion = res.data;

                // Delete old choices
                if (editingQuestion.choices && editingQuestion.choices.length > 0) {
                    for (const oldChoice of editingQuestion.choices) {
                        try {
                            await apiInstance.delete(`quiz/choice/detail/${oldChoice.choice_id}/`);
                        } catch (e) {
                            console.error(e);
                        }
                    }
                }
            } else {
                const res = await apiInstance.post("quiz/question/list-create/", questionPayload);
                savedQuestion = res.data;
            }

            // Create new choices
            for (const [index, choice] of validChoices.entries()) {
                await apiInstance.post("quiz/choice/list-create/", {
                    question_id: savedQuestion.question_id,
                    choice_text: choice.choice_text.trim(),
                    is_correct: Boolean(choice.is_correct),
                    order: index + 1
                });
            }

            Toast().fire({
                icon: "success",
                title: editingQuestion ? "Pertanyaan berhasil diperbarui" : "Pertanyaan berhasil ditambahkan"
            });

            setIsAddingQuestion(false);
            setEditingQuestion(null);
            setQuestionForm({
                question_text: "",
                choices: [
                    { choice_text: "", is_correct: true },
                    { choice_text: "", is_correct: false },
                    { choice_text: "", is_correct: false },
                    { choice_text: "", is_correct: false }
                ]
            });

            await fetchQuestions(currentQuiz.quiz_id);
            await fetchQuizzes();
        } catch (err) {
            console.error("Error saving question:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal menyimpan pertanyaan"
            });
        }
    };

    const handleDeleteQuestion = (questionId) => {
        Swal.fire({
            title: "Hapus Pertanyaan?",
            text: "Apakah Anda yakin ingin menghapus pertanyaan ini? Tindakan ini tidak dapat dibatalkan.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Ya, Hapus",
            cancelButtonText: "Batal"
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await apiInstance.delete(`quiz/question/detail/${questionId}/`);
                    Toast().fire({
                        icon: "success",
                        title: "Pertanyaan berhasil dihapus"
                    });
                    await fetchQuestions(currentQuiz.quiz_id);
                    await fetchQuizzes();
                } catch (err) {
                    console.error("Error deleting question:", err);
                    Toast().fire({
                        icon: "error",
                        title: "Gagal menghapus pertanyaan"
                    });
                }
            }
        });
    };

    const handleMoveQuestion = async (index, direction) => {
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= questions.length) return;

        const newQuestions = [...questions];
        const temp = newQuestions[index];
        newQuestions[index] = newQuestions[targetIndex];
        newQuestions[targetIndex] = temp;
        setQuestions(newQuestions);

        try {
            const orders = newQuestions.map((q, idx) => ({
                question_id: q.question_id,
                order: idx + 1
            }));
            await apiInstance.post("quiz/question/reorder/", { orders });
        } catch (err) {
            console.error("Error reordering questions:", err);
            await fetchQuestions(currentQuiz.quiz_id);
        }
    };

    const handleExportTemplate = () => {
        const csvContent =
            `No,Pertanyaan,Pilihan A,Pilihan B,Pilihan C,Pilihan D,Pilihan E,Kunci Jawaban
1,"Apa tugas dan wewenang utama dari Dewan Perwakilan Daerah (DPD) RI menurut UUD 1945?","Mengajukan RUU terkait otonomi daerah dan hubungan pusat dengan daerah","Menetapkan Anggaran Pendapatan dan Belanja Negara (APBN) secara mandiri","Mengangkat dan memberhentikan para menteri kabinet pemerintahan","Memeriksa pertanggungjawaban pengelolaan keuangan negara","Mengadili perkara perselisihan sengketa hasil pemilihan umum","A"
2,"Berapa jumlah anggota DPD RI dari setiap provinsi berdasarkan ketentuan konstitusi?","2 orang","3 orang","4 orang","5 orang","6 orang","C"
3,"Kapan Dewan Perwakilan Daerah (DPD) RI resmi dibentuk dalam sistem ketatanegaraan Indonesia?","17 Agustus 1945","1 Oktober 2004","21 Mei 1998","5 Juli 1959","10 November 2001","B"
4,"Manakah yang BUKAN merupakan wewenang DPD RI terkait fungsi pengawasan?","Pengawasan pelaksanaan undang-undang mengenai otonomi daerah","Pengawasan pembentukan dan pemekaran daerah","Pengawasan pelaksanaan anggaran pendapatan dan belanja negara","Pengawasan pelaksanaan pengelolaan sumber daya alam","Mengubah dan menetapkan Undang-Undang Dasar secara mandiri","E"
5,"Sidang paripurna DPD RI diselenggarakan sekurang-kurangnya berapa kali dalam kurun satu tahun?","1 kali","2 kali","3 kali","4 kali","Sesuai kesepakatan seluruh anggota fraksi","A"`;

        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "Template_Import_Kuis_LMSetjenDPDRI.csv";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        Toast().fire({
            icon: "success",
            title: "Template kuis berhasil diunduh"
        });
    };

    const handleExportQuizQuestions = async (targetQuiz) => {
        if (!targetQuiz) return;
        try {
            let questionsToExport = [];
            if (currentQuiz?.quiz_id === targetQuiz.quiz_id && questions.length > 0) {
                questionsToExport = questions;
            } else {
                const res = await apiInstance.get(`quiz/question/list-create/?quiz_id=${targetQuiz.quiz_id}`);
                questionsToExport = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            }

            if (questionsToExport.length === 0) {
                Toast().fire({
                    icon: "warning",
                    title: "Kuis ini belum memiliki soal untuk diexport"
                });
                return;
            }

            const rows = [
                ["No", "Pertanyaan", "Pilihan A", "Pilihan B", "Pilihan C", "Pilihan D", "Pilihan E", "Kunci Jawaban"]
            ];

            questionsToExport.forEach((q, idx) => {
                const choices = q.choices || [];
                const choiceA = choices[0]?.choice_text || "";
                const choiceB = choices[1]?.choice_text || "";
                const choiceC = choices[2]?.choice_text || "";
                const choiceD = choices[3]?.choice_text || "";
                const choiceE = choices[4]?.choice_text || "";

                let keyLetter = "A";
                const correctIndex = choices.findIndex(c => c.is_correct);
                if (correctIndex !== -1) {
                    keyLetter = String.fromCharCode(65 + correctIndex);
                }

                rows.push([
                    idx + 1,
                    `"${(q.question_text || "").replace(/"/g, '""')}"`,
                    `"${choiceA.replace(/"/g, '""')}"`,
                    `"${choiceB.replace(/"/g, '""')}"`,
                    `"${choiceC.replace(/"/g, '""')}"`,
                    `"${choiceD.replace(/"/g, '""')}"`,
                    choiceE ? `"${choiceE.replace(/"/g, '""')}"` : '""',
                    `"${keyLetter}"`
                ]);
            });

            const csvContent = rows.map(r => r.join(",")).join("\r\n");
            const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            const cleanTitle = (targetQuiz.title || "Kuis").replace(/[^a-zA-Z0-9_-]/g, "_");
            link.href = url;
            link.download = `Export_Soal_${cleanTitle}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            Toast().fire({
                icon: "success",
                title: `Berhasil mengekspor ${questionsToExport.length} soal kuis!`
            });
        } catch (err) {
            console.error("Export error:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal mengekspor soal kuis"
            });
        }
    };

    const parseCSVFile = (text) => {
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2) return [];

        const parsed = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            const cols = [];
            let cur = '';
            let inQuotes = false;
            for (let c = 0; c < line.length; c++) {
                const char = line[c];
                if (char === '"') {
                    if (inQuotes && line[c + 1] === '"') {
                        cur += '"';
                        c++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    cols.push(cur.trim());
                    cur = '';
                } else {
                    cur += char;
                }
            }
            cols.push(cur.trim());

            if (cols.length >= 4) {
                const questionText = cols[1] || cols[0];
                const choices = [];
                const choiceA = cols[2];
                const choiceB = cols[3];
                const choiceC = cols[4];
                const choiceD = cols[5];
                const choiceE = cols[6];
                const rawKey = (cols[cols.length - 1] || "A").trim().toUpperCase();

                if (choiceA) choices.push({ choice_text: choiceA, is_correct: rawKey === "A" });
                if (choiceB) choices.push({ choice_text: choiceB, is_correct: rawKey === "B" });
                if (choiceC) choices.push({ choice_text: choiceC, is_correct: rawKey === "C" });
                if (choiceD) choices.push({ choice_text: choiceD, is_correct: rawKey === "D" });
                if (choiceE) choices.push({ choice_text: choiceE, is_correct: rawKey === "E" });

                if (questionText && choices.length >= 2) {
                    parsed.push({
                        question_text: questionText,
                        choices,
                        isValid: choices.some(c => c.is_correct)
                    });
                }
            }
        }
        return parsed;
    };

    const handleFileChange = (e) => {
        const file = e.target.files ? e.target.files[0] : e;
        if (!file) return;

        setImportFile(file);
        setImportError("");

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target.result;
                if (file.name.endsWith(".json")) {
                    const json = JSON.parse(content);
                    const qList = Array.isArray(json) ? json : (json.questions || []);
                    const mapped = qList.map(q => ({
                        question_text: q.question_text || q.question || "",
                        choices: (q.choices || []).map(c => ({
                            choice_text: c.choice_text || c.text || "",
                            is_correct: Boolean(c.is_correct || c.correct)
                        })),
                        isValid: Boolean(q.question_text && (q.choices || []).some(c => c.is_correct || c.correct))
                    }));
                    setParsedQuestions(mapped);
                } else {
                    const parsed = parseCSVFile(content);
                    setParsedQuestions(parsed);
                }
            } catch (err) {
                console.error("Parse file error:", err);
                setImportError("Format file tidak valid atau rusak.");
                setParsedQuestions([]);
            }
        };
        reader.readAsText(file);
    };

    const handleExecuteImport = async () => {
        if (parsedQuestions.length === 0) {
            Toast().fire({
                icon: "warning",
                title: "Tidak ada soal valid untuk diimpor"
            });
            return;
        }

        try {
            setIsImporting(true);
            let targetQuizId = importTargetQuizId;

            // If creating a new quiz
            if (targetQuizId === "new") {
                const quizTitle = importNewQuizTitle.trim() || `Kuis Baru (Impor ${new Date().toLocaleDateString()})`;
                const newQuizRes = await apiInstance.post("quiz/list-create/", {
                    title: quizTitle,
                    description: `Kuis diimpor dari berkas ${importFile?.name || 'CSV'}`,
                    quiz_type: importNewQuizType,
                    presentation_mode: "ordered",
                    is_active: true,
                    course_id: course_id
                });
                targetQuizId = newQuizRes.data.quiz_id;
            }

            // Import questions
            let count = 0;
            for (const q of parsedQuestions) {
                if (!q.isValid) continue;
                const qRes = await apiInstance.post("quiz/question/list-create/", {
                    question_text: q.question_text,
                    quiz_id: targetQuizId
                });
                const qId = qRes.data.question_id;

                for (const [idx, choice] of q.choices.entries()) {
                    await apiInstance.post("quiz/choice/list-create/", {
                        question_id: qId,
                        choice_text: choice.choice_text,
                        is_correct: choice.is_correct,
                        order: idx + 1
                    });
                }
                count++;
            }

            Toast().fire({
                icon: "success",
                title: `Berhasil mengimpor ${count} soal ke kuis!`
            });

            setShowImportModal(false);
            setImportFile(null);
            setParsedQuestions([]);
            await fetchQuizzes();
            if (currentQuiz?.quiz_id === targetQuizId) {
                await fetchQuestions(targetQuizId);
            }
        } catch (err) {
            console.error("Error executing import:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal mengimpor soal"
            });
        } finally {
            setIsImporting(false);
        }
    };

    // =========================================================================
    // CURRICULUM HELPERS & ACTIONS (FORM-BODY-MODERN EQUIVALENT)
    // =========================================================================

    const parseDurationToSeconds = (dur) => {
        if (!dur) return 0;
        if (typeof dur === "number") return dur;
        const str = String(dur).trim();
        if (/^\d+$/.test(str)) return parseInt(str, 10);
        const parts = str.split(":").map(p => parseInt(p, 10) || 0);
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        const matchMin = str.match(/(\d+)\s*(m|menit|min)/i);
        if (matchMin) return parseInt(matchMin[1], 10) * 60;
        const matchJam = str.match(/(\d+)\s*(j|jam|hr|hour)/i);
        if (matchJam) return parseInt(matchJam[1], 10) * 3600;
        return 0;
    };

    const formatSecondsToDisplay = (totalSec) => {
        if (!totalSec || totalSec <= 0) return "0 Menit";
        const hrs = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        if (hrs > 0 && mins > 0) return `${hrs} Jam ${mins} Menit`;
        if (hrs > 0) return `${hrs} Jam`;
        return `${mins} Menit`;
    };

    const totalLecturesCount = curriculum.reduce((sum, sec) => sum + (sec.items?.length || 0), 0);
    const totalFreePreviewsCount = curriculum.reduce((sum, sec) => sum + (sec.items?.filter(itm => itm.preview)?.length || 0), 0);
    const totalCurriculumSeconds = curriculum.reduce((sum, sec) => {
        return sum + (sec.items || []).reduce((itemSum, itm) => itemSum + parseDurationToSeconds(itm.duration), 0);
    }, 0);

    const addSection = () => {
        setCurriculum(prev => [
            ...prev,
            {
                variant_id: null,
                variant_title: `Bagian Baru ${prev.length + 1}`,
                order: prev.length,
                items: []
            }
        ]);
        Toast().fire({
            icon: "success",
            title: "Bagian kurikulum baru berhasil ditambahkan"
        });
    };

    const updateSectionTitle = (secIndex, val) => {
        setCurriculum(prev => {
            const next = [...prev];
            next[secIndex].variant_title = val;
            return next;
        });
    };

    const removeSection = (secIndex) => {
        setCurriculum(prev => prev.filter((_, i) => i !== secIndex));
    };

    const confirmRemoveSection = (secIndex) => {
        Swal.fire({
            title: `Hapus Bagian ${secIndex + 1}?`,
            text: "Seluruh materi pembelajaran di dalam bagian ini akan ikut terhapus.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Ya, Hapus Bagian",
            cancelButtonText: "Batal"
        }).then((result) => {
            if (result.isConfirmed) {
                removeSection(secIndex);
                Toast().fire({
                    icon: "success",
                    title: "Bagian kurikulum berhasil dihapus"
                });
            }
        });
    };

    const moveSectionUp = (secIndex) => {
        if (secIndex <= 0) return;
        setCurriculum(prev => {
            const next = [...prev];
            const temp = next[secIndex];
            next[secIndex] = next[secIndex - 1];
            next[secIndex - 1] = temp;
            return next;
        });
    };

    const moveSectionDown = (secIndex) => {
        setCurriculum(prev => {
            if (secIndex >= prev.length - 1) return prev;
            const next = [...prev];
            const temp = next[secIndex];
            next[secIndex] = next[secIndex + 1];
            next[secIndex + 1] = temp;
            return next;
        });
    };

    const toggleSectionCollapse = (secIdx) => {
        setCollapsedSections(prev => ({
            ...prev,
            [secIdx]: !prev[secIdx]
        }));
    };

    const toggleAllSectionsCollapse = () => {
        const allCollapsed = curriculum.length > 0 && curriculum.every((_, idx) => collapsedSections[idx]);
        const newState = {};
        curriculum.forEach((_, idx) => {
            newState[idx] = !allCollapsed;
        });
        setCollapsedSections(newState);
    };

    const addLecture = (secIndex) => {
        setCurriculum(prev => {
            const next = [...prev];
            const sec = next[secIndex];
            sec.items = [
                ...sec.items,
                {
                    variant_item_id: null,
                    title: `Materi Baru ${sec.items.length + 1}`,
                    description: "",
                    file: "",
                    duration: "10:00",
                    content_type: "video",
                    item_type: "lesson",
                    quiz_id: "",
                    preview: false,
                    order: sec.items.length
                }
            ];
            return next;
        });
    };

    const addQuizItem = (secIndex) => {
        setCurriculum(prev => {
            const next = [...prev];
            const sec = next[secIndex];
            sec.items = [
                ...sec.items,
                {
                    variant_item_id: null,
                    title: `Kuis Bagian ${sec.items.length + 1}`,
                    description: "",
                    file: "",
                    duration: "15:00",
                    content_type: "quiz",
                    item_type: "quiz",
                    quiz_id: "",
                    preview: false,
                    order: sec.items.length
                }
            ];
            return next;
        });
    };

    const addScormItem = (secIndex) => {
        setCurriculum(prev => {
            const next = [...prev];
            const sec = next[secIndex];
            sec.items = [
                ...sec.items,
                {
                    variant_item_id: null,
                    title: `Modul SCORM ${sec.items.length + 1}`,
                    description: "",
                    file: "",
                    duration: "45:00",
                    content_type: "scorm",
                    file_type: "scorm",
                    item_type: "lesson",
                    learning_module_id: null,
                    learning_module_info: null,
                    quiz_id: "",
                    preview: false,
                    order: sec.items.length
                }
            ];
            return next;
        });
    };

    const updateLectureField = (secIndex, itemIndex, field, val) => {
        setCurriculum(prev => {
            const next = [...prev];
            const sec = next[secIndex];
            const itm = { ...sec.items[itemIndex], [field]: val };
            sec.items[itemIndex] = itm;
            return next;
        });
    };

    const removeLecture = (secIndex, itemIndex) => {
        setCurriculum(prev => {
            const next = [...prev];
            next[secIndex].items = next[secIndex].items.filter((_, i) => i !== itemIndex);
            return next;
        });
    };

    const confirmRemoveLecture = (secIndex, itmIndex) => {
        Swal.fire({
            title: `Hapus Materi ${itmIndex + 1}?`,
            text: "Materi ini akan dihapus dari daftar kurikulum.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Ya, Hapus",
            cancelButtonText: "Batal"
        }).then((result) => {
            if (result.isConfirmed) {
                removeLecture(secIndex, itmIndex);
                Toast().fire({
                    icon: "success",
                    title: "Materi berhasil dihapus"
                });
            }
        });
    };

    const moveLectureUp = (secIndex, itmIndex) => {
        if (itmIndex <= 0) return;
        setCurriculum(prev => {
            const next = [...prev];
            const items = [...next[secIndex].items];
            const temp = items[itmIndex];
            items[itmIndex] = items[itmIndex - 1];
            items[itmIndex - 1] = temp;
            next[secIndex] = { ...next[secIndex], items };
            return next;
        });
    };

    const moveLectureDown = (secIndex, itmIndex) => {
        setCurriculum(prev => {
            const next = [...prev];
            const items = [...next[secIndex].items];
            if (itmIndex >= items.length - 1) return prev;
            const temp = items[itmIndex];
            items[itmIndex] = items[itmIndex + 1];
            items[itmIndex + 1] = temp;
            next[secIndex] = { ...next[secIndex], items };
            return next;
        });
    };

    const duplicateLecture = (secIndex, itmIndex) => {
        setCurriculum(prev => {
            const next = [...prev];
            const items = [...next[secIndex].items];
            const target = items[itmIndex];
            const copy = {
                ...target,
                variant_item_id: null,
                title: `${target.title} (Salinan)`
            };
            items.splice(itmIndex + 1, 0, copy);
            next[secIndex] = { ...next[secIndex], items };
            return next;
        });
        Toast().fire({
            icon: "success",
            title: "Materi berhasil diduplikasi"
        });
    };

    const toggleItemPreview = (secIdx, itmIdx) => {
        const key = `${secIdx}-${itmIdx}`;
        setPreviewingItems(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const handleLectureFileUpload = async (secIdx, itmIdx, fileOrEvent) => {
        const selectedFile = fileOrEvent?.target?.files ? fileOrEvent.target.files[0] : fileOrEvent;
        if (!selectedFile) return;

        const itemKey = `${secIdx}-${itmIdx}`;
        const fileNameLower = (selectedFile.name || "").toLowerCase();
        const isZip = fileNameLower.endsWith(".zip") || selectedFile.type === "application/zip" || selectedFile.type === "application/x-zip-compressed";

        try {
            setUploadingLecture(prev => ({ ...prev, [itemKey]: true }));
            setLectureUploadProgress(prev => ({ ...prev, [itemKey]: 20 }));

            if (isZip) {
                // Upload E-Learning SCORM / H5P package (.zip)
                const formData = new FormData();
                formData.append("file", selectedFile);
                formData.append("course_id", course?.course_id || course?.id || course_id);
                const currentItem = curriculum[secIdx]?.items[itmIdx];
                if (currentItem?.title) {
                    formData.append("title", currentItem.title);
                }

                const res = await apiInstance.post("/teacher/upload-elearning-module/", formData, {
                    headers: { "Content-Type": "multipart/form-data" },
                    onUploadProgress: (progressEvent) => {
                        const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
                        setLectureUploadProgress(prev => ({ ...prev, [itemKey]: percent }));
                    }
                });

                if (res.data?.module_id) {
                    const moduleObj = res.data.module;
                    updateLectureField(secIdx, itmIdx, "learning_module_id", res.data.module_id);
                    updateLectureField(secIdx, itmIdx, "learning_module_info", moduleObj);
                    updateLectureField(secIdx, itmIdx, "learning_module", res.data.module_id);
                    updateLectureField(secIdx, itmIdx, "file", moduleObj?.entry_file || "index.html");
                    updateLectureField(secIdx, itmIdx, "content_type", "scorm");
                    updateLectureField(secIdx, itmIdx, "file_type", "scorm");
                    updateLectureField(secIdx, itmIdx, "item_type", "lesson");

                    if (moduleObj) {
                        setAvailableScormModules(prev => [moduleObj, ...(prev || []).filter(m => m.id !== res.data.module_id)]);
                    }

                    Toast().fire({
                        icon: "success",
                        title: "Paket SCORM Berhasil Diunggah!",
                        text: `Modul "${moduleObj?.judul || 'SCORM'}" telah diekstrak dan siap diuji coba.`
                    });
                } else {
                    throw new Error(res.data?.message || "Gagal mengunggah paket SCORM");
                }
            } else {
                // Regular multi-media upload (Video, Presentation PPTX, Document PDF, Audio MP3)
                const formData = new FormData();
                formData.append("file", selectedFile);
                formData.append("upload_type", "curriculum");

                const res = await apiInstance.post("/file-upload/", formData, {
                    headers: { "Content-Type": "multipart/form-data" },
                    onUploadProgress: (progressEvent) => {
                        const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
                        setLectureUploadProgress(prev => ({ ...prev, [itemKey]: percent }));
                    }
                });

                const uploadedUrl = res.data?.url || res.data?.file_url;
                if (uploadedUrl) {
                    let detectedType = "video";
                    let typeLabel = "Video Pembelajaran";

                    if (fileNameLower.endsWith(".pdf") || res.data?.file_type === "document") {
                        detectedType = "document";
                        typeLabel = "Dokumen PDF";
                    } else if (fileNameLower.endsWith(".pptx") || fileNameLower.endsWith(".ppt") || res.data?.file_type === "presentation") {
                        detectedType = "presentation";
                        typeLabel = "Slide Presentasi (PPT/PPTX)";
                    } else if (fileNameLower.endsWith(".mp3") || fileNameLower.endsWith(".wav") || fileNameLower.endsWith(".ogg") || fileNameLower.endsWith(".m4a") || res.data?.file_type === "audio") {
                        detectedType = "audio";
                        typeLabel = "Audio / Podcast";
                    } else if (fileNameLower.endsWith(".mp4") || fileNameLower.endsWith(".webm") || fileNameLower.endsWith(".avi") || fileNameLower.endsWith(".mov") || res.data?.file_type === "video") {
                        detectedType = "video";
                        typeLabel = "Video Pembelajaran";
                    }

                    updateLectureField(secIdx, itmIdx, "file", uploadedUrl);
                    updateLectureField(secIdx, itmIdx, "content_type", detectedType);
                    updateLectureField(secIdx, itmIdx, "file_type", detectedType);
                    updateLectureField(secIdx, itmIdx, "item_type", "lesson");

                    if (res.data?.video_duration || res.data?.audio_duration) {
                        updateLectureField(secIdx, itmIdx, "duration", res.data.video_duration || res.data.audio_duration);
                    }

                    Toast().fire({
                        icon: "success",
                        title: "Berkas Berhasil Diunggah!",
                        text: `Materi otomatis terdeteksi sebagai ${typeLabel}.`
                    });
                }
            }
        } catch (err) {
            console.error("Lecture file upload failed:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal mengunggah berkas materi",
                text: err.response?.data?.error || err.response?.data?.message || err.message
            });
        } finally {
            setUploadingLecture(prev => ({ ...prev, [itemKey]: false }));
            setLectureUploadProgress(prev => ({ ...prev, [itemKey]: 0 }));
        }
    };

    // Save Changes Directly to Live
    const handleDirectSave = async () => {
        if (!title.trim()) {
            Toast().fire({
                icon: "warning",
                title: "Judul kursus tidak boleh kosong"
            });
            return;
        }

        const confirmResult = await Swal.fire({
            title: "Terapkan Perubahan Langsung?",
            html: `Perubahan akan <b>langsung tersimpan dan tayang secara live</b> pada katalog kursus tanpa melewati siklus review.`,
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#0d9488",
            cancelButtonColor: "#64748b",
            confirmButtonText: '<i class="fas fa-bolt me-1"></i> Simpan & Terbitkan Langsung',
            cancelButtonText: "Batal"
        });

        if (!confirmResult.isConfirmed) return;

        try {
            setSaving(true);

            const payload = {
                title: title.trim(),
                description,
                category: categoryId,
                level,
                language,
                course_duration: courseDuration,
                target_audience: targetAudience,
                platform_status: platformStatus,
                image,
                file,
                tags: selectedTags,
                features: features
                    .filter(f => (typeof f === "string" ? f.trim() : f?.text?.trim()))
                    .map((f, idx) => ({
                        icon: f.icon || "fas fa-check",
                        text: (typeof f === "string" ? f : f.text).trim(),
                        highlight: Boolean(f.highlight),
                        order: idx
                    })),
                requirements: requirements
                    .filter(r => (typeof r === "string" ? r.trim() : r?.text?.trim()))
                    .map((r, idx) => ({
                        requirement: (typeof r === "string" ? r : r.text).trim(),
                        order: idx
                    })),
                learning_outcomes: learningOutcomes
                    .filter(o => (typeof o === "string" ? o.trim() : o?.text?.trim()))
                    .map((o, idx) => ({
                        outcome: (typeof o === "string" ? o : o.text).trim(),
                        order: idx
                    })),
                curriculum: curriculum.map(sec => ({
                    ...sec,
                    items: (sec.items || []).map(itm => {
                        const detectedType = itm.content_type || detectItemContentType(itm);
                        return {
                            ...itm,
                            content_type: detectedType,
                            file_type: itm.file_type || detectedType,
                            learning_module_id: itm.learning_module_id || null,
                            learning_module: itm.learning_module_id || null
                        };
                    })
                }))
            };

            const response = await apiInstance.put(`/admin/course-direct-edit/${course_id}/`, payload);

            if (response.data?.success) {
                Swal.fire({
                    title: "Berhasil Diperbarui!",
                    text: response.data.message || "Perubahan kursus berhasil disimpan langsung ke versi publik.",
                    icon: "success",
                    confirmButtonColor: "#0d9488"
                });

                if (response.data.course) {
                    setCourse(response.data.course);
                    if (Array.isArray(response.data.course.curriculum)) {
                        setCurriculum(response.data.course.curriculum.map((sec, sIdx) => ({
                            variant_id: sec.variant_id,
                            variant_title: sec.variant_title || sec.title || `Bagian ${sIdx + 1}`,
                            order: sec.order !== undefined ? sec.order : sIdx,
                            items: Array.isArray(sec.variant_items || sec.items)
                                ? (sec.variant_items || sec.items).map((itm, iIdx) => {
                                    const detectedType = detectItemContentType(itm);
                                    const lmInfo = itm.learning_module_info || (typeof itm.learning_module === "object" ? itm.learning_module : null);
                                    const lmId = itm.learning_module_id || (itm.learning_module?.id) || (lmInfo?.id) || null;
                                    return {
                                        variant_item_id: itm.variant_item_id,
                                        title: itm.title || `Materi ${iIdx + 1}`,
                                        description: itm.description || "",
                                        file: itm.file || "",
                                        duration: itm.duration || "",
                                        content_type: detectedType,
                                        file_type: itm.file_type || detectedType,
                                        item_type: detectedType === "quiz" ? "quiz" : "lesson",
                                        quiz_id: itm.quiz_id || (itm.quiz && typeof itm.quiz === "object" ? itm.quiz.quiz_id : (itm.quiz || "")),
                                        learning_module_id: lmId,
                                        learning_module_info: lmInfo,
                                        learning_module: lmId,
                                        preview: Boolean(itm.preview),
                                        order: itm.order !== undefined ? itm.order : iIdx
                                    };
                                })
                                : []
                        })));
                    }
                }
            }
        } catch (err) {
            console.error("Direct save failed:", err);
            Swal.fire({
                title: "Gagal Menyimpan",
                text: err.response?.data?.error || err.message || "Terjadi kesalahan saat menyimpan perubahan",
                icon: "error"
            });
        } finally {
            setSaving(false);
        }
    };

    const renderQuestionFormCard = (isInline = false, qIndex = null) => {
        const isEditing = Boolean(editingQuestion);
        const questionNumber = isInline && qIndex !== null ? qIndex + 1 : (isEditing ? questions.findIndex(x => (x.question_id || x.id) === (editingQuestion.question_id || editingQuestion.id)) + 1 : null);

        return (
            <div className="ace-question-form-card mb-2.5">
                <div className="ace-card-header is-teal-subtle d-flex justify-content-between align-items-center py-2 px-3">
                    <div className="d-flex align-items-center gap-2">
                        <span className="badge bg-teal text-white fw-bold px-2 py-0.5" style={{ fontSize: "0.72rem", borderRadius: "5px" }}>
                            {questionNumber ? `Soal Q${questionNumber}` : "Soal Baru"}
                        </span>
                        <h6 className="ace-card-title mb-0" style={{ color: "#0f766e", fontWeight: 700, fontSize: "0.85rem" }}>
                            <i className={`fas ${isEditing ? "fa-pen-to-square" : "fa-plus-circle"} me-1`} style={{ color: "#0d9488" }}></i>
                            <span>{isEditing ? `Edit Pertanyaan ${questionNumber ? `Q${questionNumber}` : ""}` : "Tambah Pertanyaan Baru"}</span>
                        </h6>
                    </div>
                    <button
                        type="button"
                        className="btn-close btn-sm"
                        style={{ fontSize: "0.68rem" }}
                        onClick={() => {
                            setIsAddingQuestion(false);
                            setEditingQuestion(null);
                        }}
                        title="Batal / Tutup Editor"
                    ></button>
                </div>
                <div className="ace-card-body p-2.5 px-3">
                    <form onSubmit={handleSaveQuestion}>
                        <div className="mb-2">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                                <label className="ace-form-label fw-bold mb-0" style={{ fontSize: "0.75rem" }}>
                                    <span>Teks Pertanyaan <strong className="text-danger">*</strong></span>
                                </label>
                                <span className="text-muted small" style={{ fontSize: "0.7rem" }}>
                                    {questionForm.question_text.length} karakter
                                </span>
                            </div>
                            <textarea
                                className="ace-input"
                                rows={2}
                                style={{ fontSize: "0.82rem", resize: "vertical", minHeight: "52px" }}
                                value={questionForm.question_text}
                                onChange={(e) => setQuestionForm(prev => ({ ...prev, question_text: e.target.value }))}
                                placeholder="Tuliskan teks pertanyaan / soal ujian di sini..."
                                required
                            />
                        </div>

                        <div className="d-flex align-items-center justify-content-between mb-1.5 pt-1 border-top">
                            <label className="ace-form-label fw-bold mb-0" style={{ fontSize: "0.74rem" }}>
                                <i className="fas fa-list-check text-teal me-1"></i>
                                <span>Pilihan Jawaban & Kunci Benar <strong className="text-danger">*</strong></span>
                            </label>
                            <span className="text-muted small" style={{ fontSize: "0.7rem" }}>
                                <i className="fas fa-circle-dot text-teal me-1"></i>Pilih bulatan opsi untuk kunci benar
                            </span>
                        </div>

                        <div className="row g-2 mb-2">
                            {questionForm.choices.map((choice, cIdx) => {
                                const isChoiceCorrect = Boolean(choice.is_correct);
                                return (
                                    <div key={cIdx} className="col-md-6">
                                        <div
                                            className={`p-1.5 px-2 rounded-2 border d-flex align-items-center gap-2 transition-all ${
                                                isChoiceCorrect
                                                    ? "bg-teal-subtle border-teal text-teal shadow-xs"
                                                    : "bg-white"
                                            }`}
                                            style={{
                                                borderColor: isChoiceCorrect ? "#0d9488" : "#e2e8f0",
                                                backgroundColor: isChoiceCorrect ? "rgba(13, 148, 136, 0.08)" : "#ffffff"
                                            }}
                                        >
                                            <input
                                                type="radio"
                                                name={isInline ? `correctChoice-${qIndex}` : "correctChoice-new"}
                                                className="form-check-input mt-0 cursor-pointer"
                                                checked={isChoiceCorrect}
                                                onChange={() => {
                                                    setQuestionForm(prev => ({
                                                        ...prev,
                                                        choices: prev.choices.map((c, idx) => ({
                                                            ...c,
                                                            is_correct: idx === cIdx
                                                        }))
                                                    }));
                                                }}
                                                style={{ cursor: "pointer", width: "1rem", height: "1rem", accentColor: "#0d9488" }}
                                                title="Tandai sebagai jawaban benar"
                                            />
                                            <span
                                                className={`badge fw-bold ${
                                                    isChoiceCorrect ? "bg-teal text-white" : "bg-light text-secondary border"
                                                }`}
                                                style={{
                                                    width: "22px",
                                                    height: "22px",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    borderRadius: "50%",
                                                    fontSize: "0.72rem"
                                                }}
                                            >
                                                {String.fromCharCode(65 + cIdx)}
                                            </span>
                                            <input
                                                type="text"
                                                className="ace-input flex-grow-1 py-1 px-2"
                                                style={{ fontSize: "0.8rem", height: "30px" }}
                                                value={choice.choice_text}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setQuestionForm(prev => ({
                                                        ...prev,
                                                        choices: prev.choices.map((c, idx) =>
                                                            idx === cIdx ? { ...c, choice_text: val } : c
                                                        )
                                                    }));
                                                }}
                                                placeholder={`Pilihan ${String.fromCharCode(65 + cIdx)}...`}
                                                required={cIdx < 2}
                                            />
                                            {isChoiceCorrect && (
                                                <span
                                                    className="badge bg-teal bg-opacity-15 text-teal border border-teal border-opacity-25 py-1 px-1.5 d-none d-sm-inline-flex align-items-center gap-1"
                                                    style={{ fontSize: "0.68rem" }}
                                                >
                                                    <i className="fas fa-check-circle"></i> Kunci
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="d-flex justify-content-between align-items-center pt-2 mt-1 border-top">
                            <span className="small text-muted d-none d-md-inline-block" style={{ fontSize: "0.72rem" }}>
                                <i className="fas fa-shield-halved text-teal me-1"></i>
                                Kunci jawaban akan divalidasi otomatis saat ujian peserta
                            </span>
                            <div className="d-flex align-items-center gap-2 ms-auto">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary py-1 px-2.5"
                                    style={{ fontSize: "0.78rem" }}
                                    onClick={() => {
                                        setIsAddingQuestion(false);
                                        setEditingQuestion(null);
                                    }}
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-sm btn-teal text-white py-1 px-3 fw-semibold shadow-sm"
                                    style={{ fontSize: "0.78rem" }}
                                >
                                    <i className="fas fa-check me-1"></i>
                                    <span>{isEditing ? "Simpan Perubahan" : "Tambahkan Pertanyaan"}</span>
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="admin-page-wrapper admin-course-edit-wrapper">
                <div className="admin-course-edit-top-dock">
                    <AdminHeader />
                </div>
                <div className="ace-page-bg d-flex justify-content-center align-items-center" style={{ minHeight: "80vh" }}>
                    <div className="text-center">
                        <div className="spinner-border text-teal mb-3" style={{ color: "#0d9488", width: "3rem", height: "3rem" }} role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                        <h6 className="text-muted">Memuat Editor Kursus Administrator...</h6>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    const publicSlug = course?.slug;
    const isLive = course?.platform_status === "Published";

    return (
        <div className="admin-page-wrapper admin-course-edit-wrapper">
            {/* Unified Zero-Gap Header Dock: Stacks AdminHeader and ace-topbar-sticky seamlessly with strict 0px gap */}
            <div className="admin-course-edit-top-dock">
                <AdminHeader />

                <div className="ace-topbar-sticky">
                    <div className="ace-topbar-inner container-fluid px-3 px-xl-4 footer-container">
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                            <button
                                type="button"
                                className="ace-btn-secondary"
                                onClick={() => navigate("/admin/content-management/?tab=courses")}
                                title="Kembali ke Daftar Review Kursus"
                            >
                                <i className="fas fa-arrow-left"></i>
                                <span className="d-none d-sm-inline">Kembali</span>
                            </button>

                            <nav aria-label="breadcrumb">
                                <ol className="ace-breadcrumb">
                                    <li className="breadcrumb-item">
                                        <Link to="/admin/content-management/?tab=courses">Content Management</Link>
                                    </li>
                                    <li className="breadcrumb-item">
                                        <Link to="/admin/content-management/?tab=courses">Review Kursus</Link>
                                    </li>
                                    <li className="breadcrumb-item active" aria-current="page">
                                        <span className="ace-breadcrumb-title" title={course?.title}>
                                            Edit: {course?.title}
                                        </span>
                                    </li>
                                </ol>
                            </nav>

                            <span className="ace-badge-live" title="Perubahan disimpan langsung tanpa siklus pengajuan review ulang">
                                <i className="fas fa-bolt text-warning"></i>
                                <span>Admin Live Editor</span>
                            </span>

                            <span
                                className="ace-badge-status"
                                style={{
                                    backgroundColor: isLive ? "#dcfce7" : "#fef3c7",
                                    color: isLive ? "#15803d" : "#b45309",
                                    border: `1px solid ${isLive ? "#86efac" : "#fde68a"}`
                                }}
                            >
                                <i className={`fas ${isLive ? "fa-check-circle" : "fa-clock"}`}></i>
                                <span>{course?.platform_status || "Draft"}</span>
                            </span>
                        </div>

                        <div className="d-flex align-items-center gap-2">
                            {isLive && publicSlug && (
                                <a
                                    href={`/course-detail/${publicSlug}/`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ace-btn-secondary"
                                    title="Buka Halaman Publik Kursus (Tab Baru)"
                                >
                                    <i className="fas fa-external-link-alt text-teal"></i>
                                    <span className="d-none d-md-inline">Lihat Publik</span>
                                </a>
                            )}

                            <button
                                type="button"
                                className="ace-btn-save"
                                onClick={handleDirectSave}
                                disabled={saving}
                            >
                                {saving ? (
                                    <>
                                        <i className="fas fa-spinner fa-spin"></i>
                                        <span>Menyimpan...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-save"></i>
                                        <span>Simpan & Terapkan Langsung</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="ace-page-bg">
                {/* Main Container */}
                <div className="ace-container container-fluid px-3 px-xl-4 footer-container">
                    {/* Navigation Tabs */}
                    <div className="ace-tabs-nav">
                        <button
                            type="button"
                            className={`ace-tab-btn ${activeTab === "info" ? "active" : ""}`}
                            onClick={() => setActiveTab("info")}
                        >
                            <i className="fas fa-info-circle"></i>
                            <span>Informasi & Media</span>
                        </button>
                        <button
                            type="button"
                            className={`ace-tab-btn ${activeTab === "curriculum" ? "active" : ""}`}
                            onClick={() => setActiveTab("curriculum")}
                        >
                            <i className="fas fa-layer-group"></i>
                            <span>Kurikulum & Materi ({curriculum.length})</span>
                        </button>
                        <button
                            type="button"
                            className={`ace-tab-btn ${activeTab === "outcomes" ? "active" : ""}`}
                            onClick={() => setActiveTab("outcomes")}
                        >
                            <i className="fas fa-list-check"></i>
                            <span>Fitur & Capaian Belajar</span>
                        </button>
                        <button
                            type="button"
                            className={`ace-tab-btn ${activeTab === "quizzes" ? "active" : ""}`}
                            onClick={() => setActiveTab("quizzes")}
                        >
                            <i className="fas fa-clipboard-question"></i>
                            <span>Kuis Terlampir ({course?.quizzes?.length || 0})</span>
                        </button>
                        <button
                            type="button"
                            className={`ace-tab-btn ${activeTab === "status" ? "active" : ""}`}
                            onClick={() => setActiveTab("status")}
                        >
                            <i className="fas fa-sliders"></i>
                            <span>Status & Kontrol</span>
                        </button>
                    </div>

                    {/* TAB 1: INFORMASI & MEDIA */}
                    {/* TAB 1: INFORMASI & MEDIA */}
                    {activeTab === "info" && (
                        <div className="row g-3">
                            {/* LEFT COLUMN: INFORMASI DASAR & RICH DESCRIPTION */}
                            <div className="col-lg-7">
                                {/* Card 1: Informasi Dasar Kursus */}
                                <div className="ace-card mb-3">
                                    <div className="ace-card-header">
                                        <h6 className="ace-card-title">
                                            <i className="fas fa-book-open text-teal"></i>
                                            <span>Informasi Dasar Kursus</span>
                                        </h6>
                                        <span className="badge bg-light text-muted border">
                                            Metadata Utama
                                        </span>
                                    </div>
                                    <div className="ace-card-body">
                                        {/* Judul Kursus */}
                                        <div className="mb-2">
                                            <div className="d-flex align-items-center justify-content-between mb-1">
                                                <label className="ace-form-label mb-0">
                                                    <span>Judul Kursus <strong className="text-danger">*</strong></span>
                                                </label>
                                                <span className={`ace-char-counter ${(title || "").length > 100 ? ((title || "").length >= 120 ? "limit-full" : "limit-near") : ""}`}>
                                                    {(title || "").length} / 120 karakter
                                                </span>
                                            </div>
                                            <input
                                                type="text"
                                                className="ace-input"
                                                value={title}
                                                maxLength={120}
                                                onChange={(e) => setTitle(e.target.value)}
                                                placeholder="Contoh: Tata Naskah Dinas dan Administrasi Perkantoran Modern..."
                                            />
                                        </div>

                                        {/* Baris 1: Kategori, Level & Status Platform (3 Kolom Kompak) */}
                                        <div className="row g-2 mb-2">
                                            <div className="col-md-4">
                                                <label className="ace-form-label">
                                                    <span>Kategori Kursus <strong className="text-danger">*</strong></span>
                                                </label>
                                                <select
                                                    className="ace-select"
                                                    value={categoryId}
                                                    onChange={(e) => setCategoryId(e.target.value)}
                                                >
                                                    <option value="">-- Pilih Kategori --</option>
                                                    {categories.map(c => (
                                                        <option key={c.id} value={c.id}>{c.title}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-md-4">
                                                <label className="ace-form-label">Tingkat Kesulitan</label>
                                                <select
                                                    className="ace-select"
                                                    value={level}
                                                    onChange={(e) => setLevel(e.target.value)}
                                                >
                                                    <option value="Beginner">Pemula (Beginner)</option>
                                                    <option value="Intermediate">Menengah (Intermediate)</option>
                                                    <option value="Advanced">Lanjutan (Advanced)</option>
                                                    <option value="All Levels">Semua Tingkat (All Levels)</option>
                                                </select>
                                            </div>
                                            <div className="col-md-4">
                                                <label className="ace-form-label">Status Platform</label>
                                                <select
                                                    className="ace-select"
                                                    value={platformStatus}
                                                    onChange={(e) => setPlatformStatus(e.target.value)}
                                                >
                                                    <option value="Published">Published (Tayang)</option>
                                                    <option value="Draft">Draft (Konsep)</option>
                                                    <option value="Review">Review (Peninjauan)</option>
                                                    <option value="Disabled">Disabled (Nonaktif)</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Baris 2: Bahasa, Estimasi Durasi & Sasaran Akses (3 Kolom Kompak) */}
                                        <div className="row g-2 mb-2">
                                            <div className="col-md-4">
                                                <label className="ace-form-label">Bahasa Pengantar</label>
                                                <input
                                                    type="text"
                                                    className="ace-input"
                                                    value={language}
                                                    onChange={(e) => setLanguage(e.target.value)}
                                                    placeholder="Contoh: Bahasa Indonesia"
                                                />
                                            </div>
                                            <div className="col-md-4">
                                                <label className="ace-form-label">Estimasi Durasi Belajar</label>
                                                <input
                                                    type="text"
                                                    className="ace-input"
                                                    value={courseDuration}
                                                    onChange={(e) => setCourseDuration(e.target.value)}
                                                    placeholder="Contoh: 4 Jam / 8 JP"
                                                />
                                            </div>
                                            <div className="col-md-4">
                                                <label className="ace-form-label">Sasaran Akses Peserta</label>
                                                <select
                                                    className="ace-select"
                                                    value={targetAudience}
                                                    onChange={(e) => setTargetAudience(e.target.value)}
                                                >
                                                    <option value="internal">Pegawai Internal DPD RI</option>
                                                    <option value="public">Publik / Umum</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Tag & Kata Kunci Selector */}
                                        <div className="mb-0">
                                            <label className="ace-form-label">
                                                <span>Tag & Kata Kunci Kursus</span>
                                            </label>
                                            <TagSelector
                                                tags={availableTags}
                                                selectedTags={selectedTags}
                                                onChange={setSelectedTags}
                                                placeholder="Cari atau pilih tag kursus..."
                                                helpText="Pilih topik relevan untuk mempermudah pencarian kursus."
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Card 2: Deskripsi Lengkap Kursus (Visual / Raw Editor) */}
                                <div className="ace-card">
                                    <div className="ace-card-header">
                                        <h6 className="ace-card-title">
                                            <i className="fas fa-align-left text-teal"></i>
                                            <span>Deskripsi Lengkap Kursus</span>
                                        </h6>
                                        <div className="ace-pill-group">
                                            <button
                                                type="button"
                                                className={`ace-pill-btn ${descriptionMode === "visual" ? "active" : ""}`}
                                                onClick={() => setDescriptionMode("visual")}
                                                title="Editor Teks Kaya (WYSIWYG)"
                                            >
                                                <i className="fas fa-eye"></i>
                                                <span>Editor Visual</span>
                                            </button>
                                            <button
                                                type="button"
                                                className={`ace-pill-btn ${descriptionMode === "raw" ? "active" : ""}`}
                                                onClick={() => setDescriptionMode("raw")}
                                                title="Editor Kode HTML Mentah"
                                            >
                                                <i className="fas fa-code"></i>
                                                <span>HTML / Teks Mentah</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="ace-card-body">
                                        {descriptionMode === "visual" ? (
                                            <div className="ace-rich-editor-wrapper">
                                                <Suspense fallback={
                                                    <div className="p-4 text-center text-muted">
                                                        <i className="fas fa-spinner fa-spin me-2 text-teal"></i>
                                                        <span>Memuat Editor Teks Kaya...</span>
                                                    </div>
                                                }>
                                                    <RichTextEditor
                                                        value={description || ""}
                                                        onChange={(data) => setDescription(data)}
                                                        placeholder="Tuliskan gambaran umum, latar belakang, tujuan instruksional umum, dan sasaran kursus..."
                                                    />
                                                </Suspense>
                                            </div>
                                        ) : (
                                            <textarea
                                                className="ace-textarea"
                                                rows="10"
                                                value={description || ""}
                                                onChange={(e) => setDescription(e.target.value)}
                                                placeholder="Tuliskan kode HTML atau teks deskripsi..."
                                                style={{ fontFamily: "monospace", fontSize: "0.85rem" }}
                                            />
                                        )}

                                        {/* Editor Stats Bar */}
                                        <div className="ace-editor-stats-bar">
                                            <div className="d-flex align-items-center gap-3">
                                                <span>
                                                    <i className="fas fa-file-lines me-1 text-muted"></i>
                                                    <strong>{((description || "").replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean).length)}</strong> Kata
                                                </span>
                                                <span>
                                                    <i className="fas fa-font me-1 text-muted"></i>
                                                    <strong>{(description || "").length}</strong> Karakter
                                                </span>
                                            </div>
                                            <div className="text-muted">
                                                <i className="fas fa-info-circle me-1"></i>
                                                Tersinkronisasi langsung saat disimpan
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT COLUMN: MEDIA STUDIO (THUMBNAIL & VIDEO INTRO) */}
                            <div className="col-lg-5">
                                {/* Card 3: Studio Thumbnail Sampul */}
                                <div className="ace-card">
                                    <div className="ace-card-header">
                                        <h6 className="ace-card-title">
                                            <i className="fas fa-image text-teal"></i>
                                            <span>Studio Thumbnail Sampul</span>
                                        </h6>
                                        <span className="badge bg-light text-secondary border">Rasio 16:9</span>
                                    </div>
                                    <div className="ace-card-body">
                                        {/* 16:9 Image Preview Box */}
                                        <div className="ace-media-box-16-9 mb-2">
                                            {image ? (
                                                <>
                                                    <img
                                                        src={getImageUrl(image)}
                                                        alt="Thumbnail Kursus"
                                                        onLoad={handleImageLoad}
                                                        onError={(e) => {
                                                            e.target.src = "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";
                                                        }}
                                                    />
                                                    {imageDimensions.width > 0 && (
                                                        <div className="ace-media-overlay-badge">
                                                            <i className="fas fa-expand me-1"></i>
                                                            <span>{imageDimensions.width} × {imageDimensions.height} px</span>
                                                        </div>
                                                    )}
                                                    <div className="ace-media-overlay-actions">
                                                        <a
                                                            href={getImageUrl(image)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="ace-media-overlay-btn"
                                                            title="Buka Gambar Penuh"
                                                        >
                                                            <i className="fas fa-external-link-alt"></i>
                                                        </a>
                                                        <button
                                                            type="button"
                                                            className="ace-media-overlay-btn danger"
                                                            onClick={() => { setImage(""); setImageUrlInput(""); }}
                                                            title="Hapus Thumbnail"
                                                        >
                                                            <i className="fas fa-trash-alt"></i>
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-center p-2 text-muted">
                                                    <div className="ace-dropzone-icon" style={{ margin: "0 auto 4px" }}>
                                                        <i className="fas fa-image"></i>
                                                    </div>
                                                    <div className="fw-semibold text-secondary mb-0" style={{ fontSize: "0.8rem" }}>Belum Ada Thumbnail</div>
                                                    <div className="small text-muted" style={{ fontSize: "0.72rem" }}>
                                                        Rekomendasi 1280×720 (16:9), PNG/JPG/WebP maks 5 MB
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Input Mode Selector */}
                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                            <span className="small fw-bold text-secondary">Metode Input:</span>
                                            <div className="ace-pill-group">
                                                <button
                                                    type="button"
                                                    className={`ace-pill-btn ${imageUploadMode === "file" ? "active" : ""}`}
                                                    onClick={() => setImageUploadMode("file")}
                                                >
                                                    <i className="fas fa-cloud-upload-alt"></i>
                                                    <span>Unggah Berkas</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`ace-pill-btn ${imageUploadMode === "url" ? "active" : ""}`}
                                                    onClick={() => setImageUploadMode("url")}
                                                >
                                                    <i className="fas fa-link"></i>
                                                    <span>Tautan URL</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* File Mode: Drag and Drop */}
                                        {imageUploadMode === "file" ? (
                                            <div>
                                                <input
                                                    type="file"
                                                    ref={imageInputRef}
                                                    style={{ display: "none" }}
                                                    accept="image/png, image/jpeg, image/jpg, image/webp"
                                                    onChange={handleImageUpload}
                                                />
                                                <div
                                                    className={`ace-dropzone ${isDraggingImage ? "dragging" : ""}`}
                                                    onDragOver={(e) => { e.preventDefault(); setIsDraggingImage(true); }}
                                                    onDragLeave={() => setIsDraggingImage(false)}
                                                    onDrop={(e) => {
                                                        e.preventDefault();
                                                        setIsDraggingImage(false);
                                                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                                            handleImageUpload(e.dataTransfer.files[0]);
                                                        }
                                                    }}
                                                    onClick={() => imageInputRef.current?.click()}
                                                >
                                                    <div className="ace-dropzone-icon">
                                                        <i className="fas fa-cloud-arrow-up"></i>
                                                    </div>
                                                    <div className="fw-bold text-dark mb-1" style={{ fontSize: "0.85rem" }}>
                                                        {uploadingImage ? "Sedang Mengunggah Berkas..." : "Klik atau seret gambar ke sini"}
                                                    </div>
                                                    <div className="ace-field-help">
                                                        PNG, JPG, atau WebP (Maks. 5 MB)
                                                    </div>
                                                    {uploadingImage && (
                                                        <div className="progress mt-3" style={{ height: "6px" }}>
                                                            <div
                                                                className="progress-bar progress-bar-striped progress-bar-animated bg-teal"
                                                                style={{ width: `${imageUploadProgress}%` }}
                                                            ></div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            /* URL Mode */
                                            <div>
                                                <div className="input-group">
                                                    <span className="input-group-text bg-light text-muted border-end-0">
                                                        <i className="fas fa-globe"></i>
                                                    </span>
                                                    <input
                                                        type="url"
                                                        className="form-control ace-input"
                                                        placeholder="URL gambar atau link share Google Drive..."
                                                        value={imageUrlInput}
                                                        onChange={(e) => setImageUrlInput(e.target.value)}
                                                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleUrlImageApply(); } }}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="ace-btn-save"
                                                        onClick={() => handleUrlImageApply()}
                                                        style={{ borderRadius: "0 6px 6px 0", padding: "0.45rem 0.85rem" }}
                                                    >
                                                        <i className="fas fa-check"></i>
                                                        <span>Terapkan</span>
                                                    </button>
                                                </div>
                                                <div className="ace-field-help mt-1">
                                                    <i className="fab fa-google-drive text-primary me-1"></i>
                                                    Link Google Drive otomatis dikonversi ke gambar resolusi tinggi (1200px).
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Card 4: Studio Video Pengantar */}
                                <div className="ace-card">
                                    <div className="ace-card-header">
                                        <h6 className="ace-card-title">
                                            <i className="fas fa-video text-teal"></i>
                                            <span>Studio Video Pengantar</span>
                                        </h6>
                                        <span className="badge bg-light text-secondary border">Trailer Kursus</span>
                                    </div>
                                    <div className="ace-card-body">
                                        {/* 16:9 Video Player Preview */}
                                        <div className="ace-media-box-16-9 mb-2">
                                            {file ? (
                                                <>
                                                    {extractYoutubeId(file) ? (
                                                        <iframe
                                                            src={`https://www.youtube-nocookie.com/embed/${extractYoutubeId(file)}?rel=0`}
                                                            title="Pratinjau YouTube Video Pengantar"
                                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                            allowFullScreen
                                                        />
                                                    ) : extractGoogleDriveFileId(file) ? (
                                                        <iframe
                                                            src={`https://drive.google.com/file/d/${extractGoogleDriveFileId(file)}/preview`}
                                                            title="Pratinjau Google Drive Video Pengantar"
                                                            allow="autoplay"
                                                            allowFullScreen
                                                        />
                                                    ) : (
                                                        <video
                                                            controls
                                                            src={file}
                                                            preload="metadata"
                                                        />
                                                    )}
                                                    <div className="ace-media-overlay-badge">
                                                        {extractYoutubeId(file) ? (
                                                            <>
                                                                <i className="fab fa-youtube text-danger me-1"></i>
                                                                <span>YouTube Video</span>
                                                            </>
                                                        ) : extractGoogleDriveFileId(file) ? (
                                                            <>
                                                                <i className="fab fa-google-drive text-info me-1"></i>
                                                                <span>Google Drive Video</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <i className="fas fa-file-video text-teal me-1"></i>
                                                                <span>Video Berkas Langsung</span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className="ace-media-overlay-actions">
                                                        <button
                                                            type="button"
                                                            className="ace-media-overlay-btn danger"
                                                            onClick={() => { setFile(""); setVideoUrlInput(""); }}
                                                            title="Hapus Video Pengantar"
                                                        >
                                                            <i className="fas fa-trash-alt"></i>
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-center p-2 text-muted">
                                                    <div className="ace-dropzone-icon" style={{ margin: "0 auto 4px", background: "#fef3c7", color: "#d97706" }}>
                                                        <i className="fas fa-play"></i>
                                                    </div>
                                                    <div className="fw-semibold text-secondary mb-0" style={{ fontSize: "0.8rem" }}>Belum Ada Video Pengantar</div>
                                                    <div className="small text-muted" style={{ fontSize: "0.72rem" }}>
                                                        Dukung YouTube, Google Drive Video, atau berkas MP4 langsung
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Video Source Selector */}
                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                            <span className="small fw-bold text-secondary">Sumber Video:</span>
                                            <div className="ace-pill-group">
                                                <button
                                                    type="button"
                                                    className={`ace-pill-btn ${videoSourceMode === "url" ? "active" : ""}`}
                                                    onClick={() => setVideoSourceMode("url")}
                                                >
                                                    <i className="fas fa-link"></i>
                                                    <span>Tautan URL</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`ace-pill-btn ${videoSourceMode === "upload" ? "active" : ""}`}
                                                    onClick={() => setVideoSourceMode("upload")}
                                                >
                                                    <i className="fas fa-cloud-upload-alt"></i>
                                                    <span>Unggah MP4</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Video URL Mode */}
                                        {videoSourceMode === "url" ? (
                                            <div>
                                                <div className="input-group">
                                                    <span className="input-group-text bg-light text-muted border-end-0">
                                                        <i className="fas fa-link"></i>
                                                    </span>
                                                    <input
                                                        type="url"
                                                        className="form-control ace-input"
                                                        placeholder="Tautan YouTube, Google Drive, atau URL MP4..."
                                                        value={videoUrlInput}
                                                        onChange={(e) => setVideoUrlInput(e.target.value)}
                                                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleUrlVideoApply(); } }}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="ace-btn-save"
                                                        onClick={() => handleUrlVideoApply()}
                                                        style={{ borderRadius: "0 6px 6px 0", padding: "0.45rem 0.85rem" }}
                                                    >
                                                        <i className="fas fa-check"></i>
                                                        <span>Terapkan</span>
                                                    </button>
                                                </div>
                                                <div className="ace-field-help mt-1">
                                                    Mendukung video YouTube (publik/unlisted) atau file video Google Drive.
                                                </div>
                                            </div>
                                        ) : (
                                            /* Video Upload Mode */
                                            <div>
                                                <input
                                                    type="file"
                                                    ref={videoInputRef}
                                                    style={{ display: "none" }}
                                                    accept="video/mp4, video/webm, video/ogg"
                                                    onChange={handleVideoUpload}
                                                />
                                                <div
                                                    className={`ace-dropzone ${isDraggingVideo ? "dragging" : ""}`}
                                                    onDragOver={(e) => { e.preventDefault(); setIsDraggingVideo(true); }}
                                                    onDragLeave={() => setIsDraggingVideo(false)}
                                                    onDrop={(e) => {
                                                        e.preventDefault();
                                                        setIsDraggingVideo(false);
                                                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                                            handleVideoUpload(e.dataTransfer.files[0]);
                                                        }
                                                    }}
                                                    onClick={() => videoInputRef.current?.click()}
                                                >
                                                    <div className="ace-dropzone-icon" style={{ background: "#e0f2fe", color: "#0284c7" }}>
                                                        <i className="fas fa-video"></i>
                                                    </div>
                                                    <div className="fw-bold text-dark mb-1" style={{ fontSize: "0.85rem" }}>
                                                        {uploadingVideo ? "Sedang Mengunggah Berkas Video..." : "Klik atau seret video MP4 ke sini"}
                                                    </div>
                                                    <div className="ace-field-help">
                                                        Mendukung MP4, WebM (Maks. 500 MB)
                                                    </div>
                                                    {uploadingVideo && (
                                                        <div className="progress mt-3" style={{ height: "6px" }}>
                                                            <div
                                                                className="progress-bar progress-bar-striped progress-bar-animated bg-info"
                                                                style={{ width: `${videoUploadProgress}%` }}
                                                            ></div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: KURIKULUM & MATERI */}
                    {activeTab === "curriculum" && (
                        <div>
                            {/* 1. CURRICULUM STATISTICS RIBBON */}
                            <div className="ace-curriculum-ribbon d-flex align-items-center justify-content-between flex-wrap gap-3">
                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                    <div className="ace-curriculum-stat-chip">
                                        <i className="fas fa-layer-group text-teal"></i>
                                        <span>Total Bagian: <strong>{curriculum.length}</strong></span>
                                    </div>
                                    <div className="ace-curriculum-stat-chip">
                                        <i className="fas fa-play-circle text-primary"></i>
                                        <span>Total Materi: <strong>{totalLecturesCount}</strong></span>
                                    </div>
                                    <div className="ace-curriculum-stat-chip">
                                        <i className="fas fa-clock text-warning"></i>
                                        <span>Estimasi Durasi: <strong>{formatSecondsToDisplay(totalCurriculumSeconds)}</strong></span>
                                    </div>
                                    <div className="ace-curriculum-stat-chip">
                                        <i className="fas fa-unlock-alt text-success"></i>
                                        <span>Pratinjau Gratis: <strong>{totalFreePreviewsCount}</strong></span>
                                    </div>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                    {curriculum.length > 0 && (
                                        <button
                                            type="button"
                                            className="ace-btn-secondary"
                                            onClick={toggleAllSectionsCollapse}
                                            title="Buka atau tutup seluruh bagian"
                                        >
                                            <i className={`fas ${curriculum.every((_, idx) => collapsedSections[idx]) ? "fa-angles-down" : "fa-angles-up"}`}></i>
                                            <span>{curriculum.every((_, idx) => collapsedSections[idx]) ? "Buka Semua" : "Tutup Semua"}</span>
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className="ace-btn-save"
                                        onClick={addSection}
                                    >
                                        <i className="fas fa-plus"></i>
                                        <span>Tambah Bagian Baru</span>
                                    </button>
                                </div>
                            </div>

                            {/* 2. CURRICULUM SECTIONS & LECTURES LIST */}
                            {curriculum.length === 0 ? (
                                <div className="ace-card">
                                    <div className="ace-card-body text-center py-5">
                                        <div className="ace-dropzone-icon" style={{ margin: "0 auto 12px", background: "#f0fdfa", color: "#0d9488" }}>
                                            <i className="fas fa-folder-open"></i>
                                        </div>
                                        <h5 className="fw-bold text-dark mb-1">Belum Ada Struktur Kurikulum</h5>
                                        <p className="text-muted small mb-3">
                                            Susun bab dan materi pembelajaran agar peserta kursus dapat belajar secara terstruktur dan terarah.
                                        </p>
                                        <button
                                            type="button"
                                            className="ace-btn-save"
                                            onClick={addSection}
                                        >
                                            <i className="fas fa-plus"></i>
                                            <span>Buat Bagian Pertama Sekarang</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                curriculum.map((sec, secIdx) => {
                                    const isCollapsed = Boolean(collapsedSections[secIdx]);
                                    return (
                                        <div
                                            key={sec.variant_id || `sec-${secIdx}`}
                                            className={`ace-curriculum-section ${isCollapsed ? "is-collapsed" : ""}`}
                                        >
                                            {/* SECTION HEADER */}
                                            <div className="ace-curriculum-section-header">
                                                <div className="d-flex align-items-center gap-2 flex-grow-1 me-2">
                                                    {/* Reorder Buttons for Section */}
                                                    <div className="btn-group btn-group-sm" role="group">
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-light btn-micro"
                                                            onClick={() => moveSectionUp(secIdx)}
                                                            disabled={secIdx === 0}
                                                            title="Pindahkan bagian ke atas"
                                                        >
                                                            <i className="fas fa-arrow-up"></i>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-light btn-micro"
                                                            onClick={() => moveSectionDown(secIdx)}
                                                            disabled={secIdx === curriculum.length - 1}
                                                            title="Pindahkan bagian ke bawah"
                                                        >
                                                            <i className="fas fa-arrow-down"></i>
                                                        </button>
                                                    </div>

                                                    {/* Section Badge */}
                                                    <span className="ace-section-badge">
                                                        <i className="fas fa-folder-open"></i>
                                                        <span>Bagian {secIdx + 1}</span>
                                                    </span>

                                                    {/* Section Title Input */}
                                                    <input
                                                        type="text"
                                                        className="ace-section-title-input flex-grow-1"
                                                        value={sec.variant_title}
                                                        onChange={(e) => updateSectionTitle(secIdx, e.target.value)}
                                                        placeholder={`Judul Bagian ${secIdx + 1}...`}
                                                    />

                                                    {/* Lesson count badge */}
                                                    <span className="badge bg-light text-dark border d-none d-md-inline-block">
                                                        {sec.items?.length || 0} Materi
                                                    </span>
                                                </div>

                                                {/* Section Action Buttons */}
                                                <div className="d-flex align-items-center gap-1">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-light text-teal fw-semibold d-inline-flex align-items-center gap-1"
                                                        onClick={() => addLecture(secIdx)}
                                                        title="Tambah Materi Pelajaran ke bagian ini"
                                                    >
                                                        <i className="fas fa-plus"></i>
                                                        <span>Materi</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-light text-white fw-semibold d-inline-flex align-items-center gap-1"
                                                        onClick={() => addScormItem(secIdx)}
                                                        title="Tambah Modul SCORM 1.2 ke bagian ini"
                                                        style={{ borderColor: "rgba(255,255,255,0.4)" }}
                                                    >
                                                        <i className="fas fa-boxes-stacked"></i>
                                                        <span>SCORM</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-warning text-dark fw-semibold d-inline-flex align-items-center gap-1"
                                                        onClick={() => addQuizItem(secIdx)}
                                                        title="Tautkan Kuis ke bagian ini"
                                                    >
                                                        <i className="fas fa-clipboard-question"></i>
                                                        <span>Kuis</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-light"
                                                        onClick={() => confirmRemoveSection(secIdx)}
                                                        title="Hapus Bagian ini"
                                                    >
                                                        <i className="fas fa-trash-alt"></i>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-light"
                                                        onClick={() => toggleSectionCollapse(secIdx)}
                                                        title={isCollapsed ? "Buka Bagian" : "Tutup Bagian"}
                                                    >
                                                        <i className={`fas ${isCollapsed ? "fa-chevron-down" : "fa-chevron-up"}`}></i>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* SECTION BODY */}
                                            {!isCollapsed && (
                                                <div className="ace-curriculum-section-body">
                                                    {sec.items.length === 0 ? (
                                                        <div className="text-muted small text-center py-3 bg-white rounded border border-dashed">
                                                            <i className="fas fa-circle-info text-teal me-1"></i>
                                                            Belum ada materi atau kuis di bagian ini. Klik <strong>+ Materi</strong> atau <strong>+ Kuis</strong> di atas untuk menambahkan.
                                                        </div>
                                                    ) : (
                                                        sec.items.map((itm, itmIdx) => {
                                                            const itemKey = `${secIdx}-${itmIdx}`;
                                                            const fileLower = (itm.file || "").toLowerCase();
                                                            const resolvedType = itm.content_type || detectItemContentType(itm);
                                                            const isItemQuiz = resolvedType === "quiz" || itm.item_type === "quiz" || Boolean(itm.quiz_id);
                                                            const isItemScorm = !isItemQuiz && (
                                                                resolvedType === "scorm" ||
                                                                resolvedType === "h5p" ||
                                                                itm.file_type === "scorm" ||
                                                                itm.file_type === "h5p" ||
                                                                Boolean(itm.learning_module_id) ||
                                                                Boolean(itm.learning_module_info) ||
                                                                Boolean(itm.learning_module) ||
                                                                (fileLower.endsWith(".zip") && !fileLower.includes("presentation") && !fileLower.includes("pdf"))
                                                            );
                                                            const isItemDoc = !isItemQuiz && !isItemScorm && (resolvedType === "document" || itm.file_type === "document" || itm.file_type === "pdf" || fileLower.endsWith(".pdf") || fileLower.endsWith(".doc") || fileLower.endsWith(".docx"));
                                                            const isItemPpt = !isItemQuiz && !isItemScorm && (resolvedType === "presentation" || itm.file_type === "presentation" || itm.file_type === "ppt" || fileLower.includes("presentation") || fileLower.endsWith(".pptx") || fileLower.endsWith(".ppt"));
                                                            const isItemAudio = !isItemQuiz && !isItemScorm && (resolvedType === "audio" || itm.file_type === "audio" || fileLower.endsWith(".mp3") || fileLower.endsWith(".wav") || fileLower.endsWith(".ogg") || fileLower.endsWith(".m4a"));
                                                            const isItemVideo = !isItemQuiz && !isItemDoc && !isItemPpt && !isItemAudio && !isItemScorm;
                                                            const effectiveBadgeType = isItemQuiz ? "quiz" : isItemScorm ? "scorm" : isItemDoc ? "document" : isItemPpt ? "presentation" : isItemAudio ? "audio" : "video";
                                                            const isPreviewOpen = Boolean(previewingItems[itemKey]);
                                                            const isUploading = Boolean(uploadingLecture[itemKey]);
                                                            const uploadProg = lectureUploadProgress[itemKey] || 0;
                                                            const mediaMode = lectureMediaModes[itemKey] || (itm.file && (itm.file.startsWith("http") || itm.file.includes("drive.google.com") || itm.file.includes("youtube.com")) ? "url" : "upload");

                                                            const ytId = extractYoutubeId(itm.file);
                                                            const gDriveId = extractGoogleDriveFileId(itm.file);

                                                            return (
                                                                <div
                                                                    key={itm.variant_item_id || `itm-${secIdx}-${itmIdx}`}
                                                                    className={`ace-curriculum-item-card is-${effectiveBadgeType}`}
                                                                >
                                                                    {/* ITEM HEADER */}
                                                                    <div className="ace-curriculum-item-header">
                                                                        <div className="d-flex align-items-center gap-2 flex-wrap">
                                                                            {/* Micro Reorder Buttons */}
                                                                            <div className="btn-group btn-group-sm" role="group">
                                                                                <button
                                                                                    type="button"
                                                                                    className="btn btn-outline-secondary btn-micro"
                                                                                    onClick={() => moveLectureUp(secIdx, itmIdx)}
                                                                                    disabled={itmIdx === 0}
                                                                                    title="Pindahkan materi ke atas"
                                                                                >
                                                                                    <i className="fas fa-arrow-up"></i>
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    className="btn btn-outline-secondary btn-micro"
                                                                                    onClick={() => moveLectureDown(secIdx, itmIdx)}
                                                                                    disabled={itmIdx === sec.items.length - 1}
                                                                                    title="Pindahkan materi ke bawah"
                                                                                >
                                                                                    <i className="fas fa-arrow-down"></i>
                                                                                </button>
                                                                            </div>

                                                                            {/* Item Badge */}
                                                                            <span className="ace-item-badge">
                                                                                {isItemQuiz ? (
                                                                                    <>
                                                                                        <i className="fas fa-clipboard-check text-warning"></i>
                                                                                        <span>Kuis {secIdx + 1}.{itmIdx + 1}</span>
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        <i className="fas fa-play-circle text-teal"></i>
                                                                                        <span>Materi {secIdx + 1}.{itmIdx + 1}</span>
                                                                                    </>
                                                                                )}
                                                                            </span>

                                                                            {/* Type Badge */}
                                                                            <span className={`ace-type-badge ${effectiveBadgeType}`}>
                                                                                {isItemVideo && <><i className="fas fa-video"></i> Video</>}
                                                                                {isItemDoc && <><i className="fas fa-file-pdf"></i> Dokumen PDF</>}
                                                                                {isItemPpt && <><i className="fas fa-file-powerpoint"></i> Slide Presentasi</>}
                                                                                {isItemAudio && <><i className="fas fa-headphones"></i> Audio Podcast</>}
                                                                                {isItemScorm && <><i className="fas fa-boxes-stacked text-teal"></i> Modul SCORM</>}
                                                                                {isItemQuiz && <><i className="fas fa-clipboard-question"></i> Kuis Terlampir</>}
                                                                            </span>

                                                                            {/* Free Preview Switch */}
                                                                            <label className="form-check form-switch mb-0 d-inline-flex align-items-center gap-1 cursor-pointer" title="Izinkan peserta mengakses materi ini secara gratis sebelum mendaftar">
                                                                                <input
                                                                                    className="form-check-input"
                                                                                    type="checkbox"
                                                                                    checked={Boolean(itm.preview)}
                                                                                    onChange={(e) => updateLectureField(secIdx, itmIdx, "preview", e.target.checked)}
                                                                                />
                                                                                <span className="small text-muted" style={{ fontSize: "0.75rem" }}>
                                                                                    {itm.preview ? <strong className="text-success">Pratinjau Gratis</strong> : "Terkunci"}
                                                                                </span>
                                                                            </label>
                                                                        </div>

                                                                        {/* Item Quick Actions */}
                                                                        <div className="d-flex align-items-center gap-1">
                                                                            {isItemScorm && (
                                                                                <button
                                                                                    type="button"
                                                                                    className="btn btn-sm btn-teal text-white shadow-sm"
                                                                                    onClick={() => handleOpenScormPreview(itm)}
                                                                                    title="Uji Coba Interaksi SCORM Langsung"
                                                                                    style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                                                                                >
                                                                                    <i className="fas fa-gamepad me-1"></i>
                                                                                    <span>Uji Coba SCORM</span>
                                                                                </button>
                                                                            )}
                                                                            {itm.file && !isItemScorm && (
                                                                                <button
                                                                                    type="button"
                                                                                    className={`btn btn-sm ${isPreviewOpen ? "btn-teal text-white" : "btn-outline-secondary"}`}
                                                                                    onClick={() => toggleItemPreview(secIdx, itmIdx)}
                                                                                    title="Lihat Pratinjau Player Media"
                                                                                    style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                                                                                >
                                                                                    <i className={`fas ${isPreviewOpen ? "fa-eye-slash" : "fa-eye"}`}></i>
                                                                                    <span className="ms-1">{isPreviewOpen ? "Tutup Player" : "Pratinjau"}</span>
                                                                                </button>
                                                                            )}
                                                                            <button
                                                                                type="button"
                                                                                className="btn btn-sm btn-outline-secondary"
                                                                                onClick={() => duplicateLecture(secIdx, itmIdx)}
                                                                                title="Duplikasi Materi ini"
                                                                                style={{ fontSize: "0.75rem", padding: "2px 7px" }}
                                                                            >
                                                                                <i className="fas fa-copy"></i>
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                className="btn btn-sm btn-outline-danger"
                                                                                onClick={() => confirmRemoveLecture(secIdx, itmIdx)}
                                                                                title="Hapus Materi ini"
                                                                                style={{ fontSize: "0.75rem", padding: "2px 7px" }}
                                                                            >
                                                                                <i className="fas fa-trash-alt"></i>
                                                                            </button>
                                                                        </div>
                                                                    </div>

                                                                    {/* ITEM BODY */}
                                                                    <div className="ace-curriculum-item-body">
                                                                        {/* BARIS 1: JUDUL, TIPE KONTEN, DURASI */}
                                                                        <div className="row g-2 mb-2">
                                                                            {/* Judul Materi */}
                                                                            <div className="col-md-5">
                                                                                <label className="ace-form-label mb-1" style={{ fontSize: "0.74rem" }}>
                                                                                    <span>Judul Materi / Topik <strong className="text-danger">*</strong></span>
                                                                                </label>
                                                                                <input
                                                                                    type="text"
                                                                                    className="ace-input"
                                                                                    value={itm.title}
                                                                                    onChange={(e) => updateLectureField(secIdx, itmIdx, "title", e.target.value)}
                                                                                    placeholder="Contoh: Pengantar dan Dasar Teori..."
                                                                                />
                                                                            </div>

                                                                            {/* Tipe Konten */}
                                                                            <div className="col-md-3">
                                                                                <label className="ace-form-label mb-1" style={{ fontSize: "0.74rem" }}>
                                                                                    <span>Tipe Konten</span>
                                                                                </label>
                                                                                <select
                                                                                    className="ace-select"
                                                                                    value={effectiveBadgeType}
                                                                                    onChange={(e) => {
                                                                                        const val = e.target.value;
                                                                                        updateLectureField(secIdx, itmIdx, "content_type", val);
                                                                                        updateLectureField(secIdx, itmIdx, "file_type", val);
                                                                                        if (val === "quiz") {
                                                                                            updateLectureField(secIdx, itmIdx, "item_type", "quiz");
                                                                                        } else {
                                                                                            updateLectureField(secIdx, itmIdx, "item_type", "lesson");
                                                                                            if (val !== "scorm") {
                                                                                                updateLectureField(secIdx, itmIdx, "learning_module_id", null);
                                                                                                updateLectureField(secIdx, itmIdx, "learning_module_info", null);
                                                                                                updateLectureField(secIdx, itmIdx, "learning_module", null);
                                                                                            }
                                                                                        }
                                                                                    }}
                                                                                >
                                                                                    <option value="video">🎬 Video Pembelajaran</option>
                                                                                    <option value="document">📄 Dokumen (PDF / Modul)</option>
                                                                                    <option value="presentation">📊 Presentasi (PPT / PPTX)</option>
                                                                                    <option value="audio">🎧 Audio Podcast</option>
                                                                                    <option value="scorm">📦 Modul SCORM 1.2 / Interaktif</option>
                                                                                    <option value="quiz">📝 Kuis Interaktif</option>
                                                                                </select>
                                                                            </div>

                                                                            {/* Durasi Belajar & Quick Presets */}
                                                                            <div className="col-md-4">
                                                                                <div className="d-flex align-items-center justify-content-between mb-1">
                                                                                    <label className="ace-form-label mb-0" style={{ fontSize: "0.74rem" }}>
                                                                                        <span>Estimasi Durasi</span>
                                                                                    </label>
                                                                                    <div className="ace-duration-pill-group">
                                                                                        {["05:00", "10:00", "15:00", "30:00", "45:00"].map(preset => (
                                                                                            <span
                                                                                                key={preset}
                                                                                                className="ace-duration-pill"
                                                                                                onClick={() => updateLectureField(secIdx, itmIdx, "duration", preset)}
                                                                                                title={`Set durasi ke ${preset}`}
                                                                                            >
                                                                                                +{preset.replace(":00", "m")}
                                                                                            </span>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                                <input
                                                                                    type="text"
                                                                                    className="ace-input"
                                                                                    value={itm.duration}
                                                                                    onChange={(e) => updateLectureField(secIdx, itmIdx, "duration", e.target.value)}
                                                                                    placeholder="Contoh: 10:00 atau 15 Menit"
                                                                                />
                                                                            </div>
                                                                        </div>

                                                                        {/* BARIS 2: SUMBER MEDIA (KIRI) & CATATAN/PETUNJUK (KANAN) */}
                                                                        <div className="row g-2 mb-2 align-items-center">
                                                                            {isItemQuiz ? (
                                                                                <div className="col-12">
                                                                                    <div className="d-flex align-items-center gap-2 p-2 bg-light rounded border">
                                                                                        <span className="small fw-bold text-dark text-nowrap">
                                                                                            <i className="fas fa-clipboard-question text-warning me-1"></i> Tautkan Kuis:
                                                                                        </span>
                                                                                        <select
                                                                                            className="ace-select flex-grow-1"
                                                                                            value={itm.quiz_id || ""}
                                                                                            onChange={(e) => updateLectureField(secIdx, itmIdx, "quiz_id", e.target.value)}
                                                                                        >
                                                                                            <option value="">-- Pilih Kuis Terlampir --</option>
                                                                                            {(course?.quizzes || []).map((q, qIdx) => (
                                                                                                <option key={q.quiz_id || q.id || qIdx} value={q.quiz_id || q.id}>
                                                                                                    {q.title || `Kuis #${q.quiz_id || q.id}`} ({q.questions?.length || q.questions_count || 0} Pertanyaan)
                                                                                                </option>
                                                                                            ))}
                                                                                        </select>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => setActiveTab("quizzes")}
                                                                                            className="btn btn-sm btn-outline-teal text-nowrap"
                                                                                            title="Buka Bank Kuis"
                                                                                        >
                                                                                            <i className="fas fa-external-link-alt me-1"></i> Bank Kuis
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            ) : isItemScorm ? (
                                                                                <div className="col-12">
                                                                                    <div className="p-2.5 bg-light rounded border mb-2" style={{ borderLeft: "4px solid #8b5cf6" }}>
                                                                                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                                                                                            <div className="d-flex align-items-center gap-3">
                                                                                                <div className="rounded-circle d-flex align-items-center justify-content-center text-white flex-shrink-0" style={{ width: "36px", height: "36px", backgroundColor: "#8b5cf6" }}>
                                                                                                    <i className="fas fa-boxes-stacked"></i>
                                                                                                </div>
                                                                                                <div>
                                                                                                    <div className="fw-bold text-dark small">
                                                                                                        {itm.learning_module_info?.judul || itm.title || "Paket Pembelajaran SCORM 1.2"}
                                                                                                    </div>
                                                                                                    <div className="small text-muted" style={{ fontSize: "0.74rem" }}>
                                                                                                        Entry File: <code>{itm.learning_module_info?.entry_file || itm.file || "index.html"}</code> &bull; Tipe: <code>{(itm.learning_module_info?.module_type || "SCORM 1.2").toUpperCase()}</code> &bull; Pelacakan RTE: <code>cmi.core.lesson_status</code>, <code>cmi.core.score.raw</code>
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="d-flex align-items-center gap-2">
                                                                                                <button
                                                                                                    type="button"
                                                                                                    className="btn btn-sm btn-teal d-inline-flex align-items-center gap-1 shadow-sm text-white"
                                                                                                    onClick={() => handleOpenScormPreview(itm)}
                                                                                                    style={{ fontSize: "0.78rem" }}
                                                                                                >
                                                                                                    <i className="fas fa-play-circle"></i>
                                                                                                    <span>Uji Coba SCORM</span>
                                                                                                </button>
                                                                                            </div>
                                                                                        </div>

                                                                                        {/* SCORM Selection & Upload Controls */}
                                                                                        <div className="row g-2 align-items-center pt-2 border-top">
                                                                                            {availableScormModules.length > 0 && (
                                                                                                <div className="col-md-7">
                                                                                                    <div className="d-flex align-items-center gap-2">
                                                                                                        <span className="small text-muted text-nowrap" style={{ fontSize: "0.72rem" }}>
                                                                                                            <i className="fas fa-folder-open text-purple me-1"></i>Pustaka Modul:
                                                                                                        </span>
                                                                                                        <select
                                                                                                            className="ace-select flex-grow-1"
                                                                                                            style={{ fontSize: "0.75rem", padding: "3px 8px" }}
                                                                                                            value={itm.learning_module_id || ""}
                                                                                                            onChange={(e) => {
                                                                                                                const modId = e.target.value;
                                                                                                                const found = availableScormModules.find(m => String(m.id) === String(modId));
                                                                                                                if (found) {
                                                                                                                    updateLectureField(secIdx, itmIdx, "learning_module_id", found.id);
                                                                                                                    updateLectureField(secIdx, itmIdx, "learning_module_info", found);
                                                                                                                    updateLectureField(secIdx, itmIdx, "learning_module", found.id);
                                                                                                                    updateLectureField(secIdx, itmIdx, "file", found.entry_file || "index.html");
                                                                                                                    updateLectureField(secIdx, itmIdx, "content_type", "scorm");
                                                                                                                    updateLectureField(secIdx, itmIdx, "file_type", "scorm");
                                                                                                                }
                                                                                                            }}
                                                                                                        >
                                                                                                            <option value="">-- Pilih dari Pustaka SCORM Tersedia --</option>
                                                                                                            {availableScormModules.map(m => (
                                                                                                                <option key={m.id} value={m.id}>
                                                                                                                    {m.judul} ({m.module_type === "scorm_12" ? "SCORM 1.2" : m.module_type.toUpperCase()})
                                                                                                                </option>
                                                                                                            ))}
                                                                                                        </select>
                                                                                                    </div>
                                                                                                </div>
                                                                                            )}
                                                                                            <div className={availableScormModules.length > 0 ? "col-md-5" : "col-12"}>
                                                                                                <div className="d-flex align-items-center gap-2">
                                                                                                    <label className="ace-btn-secondary cursor-pointer mb-0 text-nowrap py-1 px-2" style={{ fontSize: "0.75rem" }}>
                                                                                                        <input
                                                                                                            type="file"
                                                                                                            style={{ display: "none" }}
                                                                                                            accept=".zip, application/zip, application/x-zip-compressed"
                                                                                                            onChange={(e) => handleLectureFileUpload(secIdx, itmIdx, e)}
                                                                                                            disabled={isUploading}
                                                                                                        />
                                                                                                        {isUploading ? (
                                                                                                            <i className="fas fa-spinner fa-spin text-purple"></i>
                                                                                                        ) : (
                                                                                                            <i className="fas fa-cloud-upload-alt text-purple"></i>
                                                                                                        )}
                                                                                                        <span className="ms-1">{isUploading ? `Mengunggah (${uploadProg}%)...` : "Unggah Paket SCORM Baru (.zip)"}</span>
                                                                                                    </label>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            ) : (
                                                                                <>
                                                                                    {/* Kolom Kiri: Sumber Media Pembelajaran */}
                                                                                    <div className="col-md-7">
                                                                                        <div className="d-flex align-items-center justify-content-between mb-1">
                                                                                            <label className="ace-form-label mb-0" style={{ fontSize: "0.74rem" }}>
                                                                                                <span>Sumber Media Pembelajaran <strong className="text-danger">*</strong></span>
                                                                                            </label>
                                                                                            <div className="ace-pill-group">
                                                                                                <button
                                                                                                    type="button"
                                                                                                    className={`ace-pill-btn ${mediaMode === "url" ? "active" : ""}`}
                                                                                                    onClick={() => setLectureMediaModes(prev => ({ ...prev, [itemKey]: "url" }))}
                                                                                                    title="Tautan URL / Cloud"
                                                                                                >
                                                                                                    <i className="fas fa-globe"></i>
                                                                                                    <span>URL</span>
                                                                                                </button>
                                                                                                <button
                                                                                                    type="button"
                                                                                                    className={`ace-pill-btn ${mediaMode === "upload" ? "active" : ""}`}
                                                                                                    onClick={() => setLectureMediaModes(prev => ({ ...prev, [itemKey]: "upload" }))}
                                                                                                    title="Unggah dari Komputer"
                                                                                                >
                                                                                                    <i className="fas fa-cloud-upload-alt"></i>
                                                                                                    <span>Unggah</span>
                                                                                                </button>
                                                                                            </div>
                                                                                        </div>

                                                                                        {mediaMode === "url" ? (
                                                                                            <div className="input-group input-group-sm">
                                                                                                <span className="input-group-text bg-white text-muted border-end-0">
                                                                                                    {ytId ? (
                                                                                                        <i className="fab fa-youtube text-danger"></i>
                                                                                                    ) : gDriveId ? (
                                                                                                        <i className="fab fa-google-drive text-primary"></i>
                                                                                                    ) : (
                                                                                                        <i className="fas fa-link text-secondary"></i>
                                                                                                    )}
                                                                                                </span>
                                                                                                <input
                                                                                                    type="url"
                                                                                                    className="form-control ace-input"
                                                                                                    value={itm.file || ""}
                                                                                                    onChange={(e) => updateLectureField(secIdx, itmIdx, "file", e.target.value)}
                                                                                                    placeholder="URL YouTube, Google Drive, atau link dokumen publik..."
                                                                                                />
                                                                                                {itm.file && (
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        className="btn btn-outline-danger"
                                                                                                        onClick={() => updateLectureField(secIdx, itmIdx, "file", "")}
                                                                                                        title="Kosongkan Tautan"
                                                                                                    >
                                                                                                        <i className="fas fa-times"></i>
                                                                                                    </button>
                                                                                                )}
                                                                                            </div>
                                                                                        ) : (
                                                                                            <div>
                                                                                                <div className="d-flex align-items-center gap-2">
                                                                                                    <label className="ace-btn-secondary cursor-pointer mb-0 text-nowrap py-1 px-2" style={{ fontSize: "0.75rem" }}>
                                                                                                        <input
                                                                                                            type="file"
                                                                                                            style={{ display: "none" }}
                                                                                                            accept={
                                                                                                                isItemVideo ? "video/mp4, video/webm" :
                                                                                                                    isItemDoc ? "application/pdf" :
                                                                                                                        isItemPpt ? ".ppt, .pptx, application/vnd.ms-powerpoint, application/vnd.openxmlformats-officedocument.presentationml.presentation" :
                                                                                                                            isItemAudio ? "audio/mp3, audio/mpeg, audio/wav" : "*/*"
                                                                                                            }
                                                                                                            onChange={(e) => handleLectureFileUpload(secIdx, itmIdx, e)}
                                                                                                            disabled={isUploading}
                                                                                                        />
                                                                                                        {isUploading ? (
                                                                                                            <i className="fas fa-spinner fa-spin text-teal"></i>
                                                                                                        ) : (
                                                                                                            <i className="fas fa-upload text-teal"></i>
                                                                                                        )}
                                                                                                        <span>{isUploading ? "Mengunggah..." : "Pilih Berkas"}</span>
                                                                                                    </label>

                                                                                                    {itm.file ? (
                                                                                                        <div className="small text-truncate flex-grow-1 p-1 px-2 bg-white rounded border d-flex align-items-center justify-content-between">
                                                                                                            <span className="text-truncate" style={{ fontSize: "0.75rem" }}>
                                                                                                                <i className="fas fa-check-circle text-success me-1"></i> {itm.file}
                                                                                                            </span>
                                                                                                            <button
                                                                                                                type="button"
                                                                                                                className="btn btn-link text-danger p-0 ms-1"
                                                                                                                onClick={() => updateLectureField(secIdx, itmIdx, "file", "")}
                                                                                                                title="Hapus berkas"
                                                                                                            >
                                                                                                                <i className="fas fa-times"></i>
                                                                                                            </button>
                                                                                                        </div>
                                                                                                    ) : (
                                                                                                        <span className="small text-muted fst-italic" style={{ fontSize: "0.72rem" }}>
                                                                                                            Belum ada berkas terunggah
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>

                                                                                                {isUploading && (
                                                                                                    <div className="progress mt-1" style={{ height: "4px" }}>
                                                                                                        <div
                                                                                                            className="progress-bar progress-bar-striped progress-bar-animated bg-teal"
                                                                                                            style={{ width: `${uploadProg}%` }}
                                                                                                        ></div>
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>

                                                                                    {/* Kolom Kanan: Catatan / Petunjuk Peserta */}
                                                                                    <div className="col-md-5">
                                                                                        <label className="ace-form-label mb-1" style={{ fontSize: "0.74rem" }}>
                                                                                            <span>Catatan / Petunjuk Belajar</span>
                                                                                            <span className="text-muted fw-normal">(Opsional)</span>
                                                                                        </label>
                                                                                        <input
                                                                                            type="text"
                                                                                            className="ace-input"
                                                                                            value={itm.description || ""}
                                                                                            onChange={(e) => updateLectureField(secIdx, itmIdx, "description", e.target.value)}
                                                                                            placeholder="Instruksi khusus untuk peserta..."
                                                                                        />
                                                                                    </div>
                                                                                </>
                                                                            )}
                                                                        </div>

                                                                        {/* LIVE PREVIEW PLAYER PANEL */}
                                                                        {isPreviewOpen && itm.file && !isItemQuiz && (
                                                                            <div className="ace-preview-wrapper my-2 d-flex justify-content-center w-100">
                                                                                <div className={`ace-preview-player-box w-100 ${isItemDoc ? "is-document-mode" : isItemPpt ? "is-presentation-mode" : isItemAudio ? "is-audio-mode" : "is-video-mode"}`}>
                                                                                    {/* Preview Header Bar (Bright Mode) */}
                                                                                    <div className="ace-preview-header d-flex align-items-center justify-content-between px-3 py-1">
                                                                                        <div className="d-flex align-items-center gap-2 text-truncate me-2">
                                                                                            {isItemVideo && <i className="fas fa-play-circle text-teal"></i>}
                                                                                            {isItemDoc && <i className="fas fa-file-pdf text-danger"></i>}
                                                                                            {isItemPpt && <i className="fas fa-file-powerpoint text-warning"></i>}
                                                                                            {isItemAudio && <i className="fas fa-headphones text-info"></i>}
                                                                                            <span className="fw-semibold small text-dark text-truncate">{itm.title || "Pratinjau Media Pembelajaran"}</span>
                                                                                        </div>
                                                                                        <div className="d-flex align-items-center gap-2 flex-shrink-0">
                                                                                            <a
                                                                                                href={itm.file}
                                                                                                target="_blank"
                                                                                                rel="noopener noreferrer"
                                                                                                className="btn btn-sm btn-outline-secondary py-0 px-2"
                                                                                                style={{ fontSize: "0.72rem" }}
                                                                                                title="Buka berkas asli di tab baru"
                                                                                            >
                                                                                                <i className="fas fa-external-link-alt me-1"></i> Buka Asli
                                                                                            </a>
                                                                                            <button
                                                                                                type="button"
                                                                                                className="btn btn-sm btn-light border py-0 px-2 text-secondary"
                                                                                                style={{ fontSize: "0.72rem" }}
                                                                                                onClick={() => toggleItemPreview(secIdx, itmIdx)}
                                                                                                title="Tutup Pratinjau"
                                                                                            >
                                                                                                <i className="fas fa-times"></i>
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* Media Content Review */}
                                                                                    <div className="ace-preview-content">
                                                                                        {isItemAudio ? (
                                                                                            <div className="p-3 bg-white text-center">
                                                                                                <div className="d-flex align-items-center justify-content-center gap-3 mb-2">
                                                                                                    <div className="ace-audio-avatar">
                                                                                                        <i className="fas fa-headphones"></i>
                                                                                                    </div>
                                                                                                    <div className="text-start">
                                                                                                        <h6 className="fw-bold text-dark mb-0" style={{ fontSize: "0.85rem" }}>{itm.title || "Audio Pembelajaran"}</h6>
                                                                                                        <span className="small text-muted" style={{ fontSize: "0.75rem" }}>{itm.duration ? `Durasi: ${itm.duration}` : "Media Pembelajaran Audio"}</span>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <audio controls className="w-100 mx-auto d-block" style={{ maxWidth: "500px" }} src={itm.file} preload="metadata" />
                                                                                            </div>
                                                                                        ) : isItemDoc ? (
                                                                                            <DocumentPreview fileUrl={itm.file} title={itm.title} />
                                                                                        ) : isItemPpt ? (
                                                                                            <PresentationPreview fileUrl={itm.file} />
                                                                                        ) : (
                                                                                            /* VIDEO (Default or isItemVideo) */
                                                                                            <div className="ace-preview-video-container">
                                                                                                {ytId ? (
                                                                                                    <iframe
                                                                                                        src={`https://www.youtube-nocookie.com/embed/${ytId}?rel=0`}
                                                                                                        title={`Pratinjau YouTube ${itm.title}`}
                                                                                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                                                                        allowFullScreen
                                                                                                    />
                                                                                                ) : gDriveId ? (
                                                                                                    <iframe
                                                                                                        src={`https://drive.google.com/file/d/${gDriveId}/preview`}
                                                                                                        title={`Pratinjau Google Drive ${itm.title}`}
                                                                                                        allow="autoplay"
                                                                                                        allowFullScreen
                                                                                                    />
                                                                                                ) : (
                                                                                                    <video controls src={itm.file} preload="metadata" />
                                                                                                )}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {/* PERTANYAAN PENYELESAIAN PELAJARAN (LESSON COMPLETION QUESTION) */}
                                                                        {!isItemQuiz && !isItemScorm && (
                                                                            <div className="mt-2 pt-2 border-top">
                                                                                {itm.variant_item_id ? (
                                                                                    <LessonCompletionQuestionEditor
                                                                                        variantItemId={itm.variant_item_id}
                                                                                        onQuestionSaved={(question) => {
                                                                                            console.log("[AdminCourseEdit] Completion question saved:", question);
                                                                                        }}
                                                                                    />
                                                                                ) : (
                                                                                    <div className="small text-muted fst-italic py-1 px-2 bg-light rounded border d-flex align-items-center gap-2" style={{ fontSize: "0.73rem" }}>
                                                                                        <i className="fas fa-info-circle text-teal"></i>
                                                                                        <span>Simpan kursus terlebih dahulu (<strong>Simpan & Terapkan Langsung</strong>) untuk menambahkan Pertanyaan Penyelesaian pada materi baru ini.</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                        {isItemScorm && (
                                                                            <div className="mt-2 py-1 px-2 rounded border d-flex align-items-center gap-2 small text-muted bg-light" style={{ fontSize: "0.74rem", borderLeft: "3px solid #0f766e" }}>
                                                                                <i className="fas fa-shield-alt text-teal"></i>
                                                                                <div>
                                                                                    <strong>Pelacakan SCORM 1.2 Aktif:</strong> Nilai evaluasi (<code>cmi.core.score.raw</code>) dan status kelulusan (<code>cmi.core.lesson_status</code>) disinkronkan secara otomatis melalui SCORM RTE saat peserta berinteraksi.
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    )}

                                                    {/* SECTION FOOTER ACTIONS */}
                                                    <div className="d-flex justify-content-end align-items-center gap-2 mt-2 pt-2 border-top">
                                                        <button
                                                            type="button"
                                                            className="ace-btn-add"
                                                            onClick={() => addLecture(secIdx)}
                                                        >
                                                            <i className="fas fa-plus"></i>
                                                            <span>Tambah Materi</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-teal text-teal fw-semibold d-inline-flex align-items-center gap-1 shadow-sm"
                                                            onClick={() => addScormItem(secIdx)}
                                                            style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", borderRadius: "6px" }}
                                                        >
                                                            <i className="fas fa-boxes-stacked"></i>
                                                            <span>Tambah SCORM</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-warning text-dark d-inline-flex align-items-center gap-1"
                                                            onClick={() => addQuizItem(secIdx)}
                                                            style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", borderRadius: "6px" }}
                                                        >
                                                            <i className="fas fa-clipboard-question"></i>
                                                            <span>Tautkan Kuis</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}

                            {/* BOTTOM ACTION BAR */}
                            {curriculum.length > 0 && (
                                <div className="d-flex justify-content-between align-items-center p-3 bg-white border rounded mt-3">
                                    <div className="text-muted small">
                                        <i className="fas fa-info-circle text-teal me-1"></i>
                                        Perubahan kurikulum dan materi pembelajaran akan langsung aktif pada kursus setelah disimpan.
                                    </div>
                                    <button
                                        type="button"
                                        className="ace-btn-save"
                                        onClick={addSection}
                                    >
                                        <i className="fas fa-plus"></i>
                                        <span>Tambah Bagian Baru</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 3: FITUR & CAPAIAN BELAJAR STUDIO */}
                    {activeTab === "outcomes" && (
                        <div className="ace-outcomes-studio">
                            {/* TOP STATS & GUIDANCE RIBBON */}
                            <div className="ace-outcomes-ribbon">
                                <div className="row g-3 align-items-center mb-3">
                                    <div className="col-md-4">
                                        <div className="ace-stat-mini-box">
                                            <div className="ace-stat-mini-icon bg-warning bg-opacity-10 text-warning">
                                                <i className="fas fa-star"></i>
                                            </div>
                                            <div>
                                                <div className="small text-muted fw-semibold">Fitur Kursus</div>
                                                <div className="fs-5 fw-bold text-dark">
                                                    {features.length}{" "}
                                                    <span className="small fs-6 fw-normal text-muted">
                                                        terpasang ({features.filter(f => f.highlight).length} disorot)
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-md-4">
                                        <div className="ace-stat-mini-box">
                                            <div className="ace-stat-mini-icon bg-info bg-opacity-10 text-info">
                                                <i className="fas fa-clipboard-check"></i>
                                            </div>
                                            <div>
                                                <div className="small text-muted fw-semibold">Prasyarat Pembelajaran</div>
                                                <div className="fs-5 fw-bold text-dark">
                                                    {requirements.length}{" "}
                                                    <span className="small fs-6 fw-normal text-muted">ketentuan</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-md-4">
                                        <div className="ace-stat-mini-box">
                                            <div className="ace-stat-mini-icon" style={{ background: "#f0fdfa", color: "#0d9488" }}>
                                                <i className="fas fa-bullseye"></i>
                                            </div>
                                            <div>
                                                <div className="small text-muted fw-semibold">Capaian Pembelajaran</div>
                                                <div className="fs-5 fw-bold text-dark">
                                                    {learningOutcomes.length}{" "}
                                                    <span className="small fs-6 fw-normal text-muted">kompetensi</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="d-flex align-items-start gap-2 p-2 px-3 bg-white border border-slate-200 rounded-3">
                                    <i className="fas fa-lightbulb text-warning mt-1"></i>
                                    <span className="small text-muted" style={{ lineHeight: 1 }}>
                                        <strong>Panduan Informasi Landing Page:</strong> Fitur kursus, prasyarat, dan capaian pembelajaran ini tampil langsung pada kartu ringkasan dan halaman detail kursus peserta. Data ini membantu ASN Setjen DPD RI memahami materi yang didapat, persiapan yang harus dipenuhi, serta kompetensi yang dicapai setelah lulus.
                                    </span>
                                </div>
                            </div>

                            {/* 3-COLUMN STUDIO LAYOUT */}
                            <div className="row g-3">
                                {/* 1. FITUR KURSUS */}
                                <div className="col-lg-4 col-md-12">
                                    <div className="ace-card h-100 d-flex flex-column">
                                        <div className="ace-card-header d-flex justify-content-between align-items-center">
                                            <div className="d-flex align-items-center gap-2">
                                                <h6 className="ace-card-title mb-0">
                                                    <i className="fas fa-star text-warning"></i>
                                                    Fitur Kursus
                                                </h6>
                                                <span className="badge bg-slate-100 text-slate-700 border" style={{ fontSize: "0.72rem" }}>
                                                    {features.length}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-teal text-white py-1 px-2 d-inline-flex align-items-center gap-1"
                                                style={{ fontSize: "0.78rem", borderRadius: "6px" }}
                                                onClick={() => addFeature()}
                                            >
                                                <i className="fas fa-plus"></i>
                                                <span>Tambah</span>
                                            </button>
                                        </div>

                                        <div className="ace-card-body flex-grow-1">
                                            {/* Quick Recommendation Presets */}
                                            <div className="ace-preset-pills-container">
                                                <div className="ace-preset-label">
                                                    <i className="fas fa-magic text-teal"></i>
                                                    Rekomendasi Cepat:
                                                </div>
                                                <div className="d-flex flex-wrap gap-1">
                                                    {FEATURE_PRESETS.map((pst, pIdx) => (
                                                        <button
                                                            key={pIdx}
                                                            type="button"
                                                            className="ace-preset-pill"
                                                            onClick={() => addFeature(pst.text, pst.icon, pst.highlight)}
                                                            title="Klik untuk menambahkan fitur rekomendasi ini"
                                                        >
                                                            <span>+</span>
                                                            <span>{pst.text.length > 28 ? pst.text.substring(0, 28) + "..." : pst.text}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Features List */}
                                            {features.map((feat, fIdx) => (
                                                <div
                                                    key={feat.id || fIdx}
                                                    className={`ace-feature-item-card ${feat.highlight ? "is-highlighted" : ""}`}
                                                >
                                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                                        <div className="d-flex align-items-center gap-2">
                                                            {/* Icon Picker / Dropdown */}
                                                            <div className="dropdown">
                                                                <button
                                                                    type="button"
                                                                    className="ace-feature-icon-badge dropdown-toggle p-0"
                                                                    data-bs-toggle="dropdown"
                                                                    aria-expanded="false"
                                                                    title="Pilih Ikon Fitur"
                                                                >
                                                                    <i className={feat.icon || "fas fa-check"}></i>
                                                                </button>
                                                                <ul className="dropdown-menu shadow-sm" style={{ maxHeight: "240px", overflowY: "auto", fontSize: "0.82rem" }}>
                                                                    <li>
                                                                        <h6 className="dropdown-header py-1" style={{ fontSize: "0.72rem" }}>PILIH IKON FITUR</h6>
                                                                    </li>
                                                                    {FEATURE_ICON_OPTIONS.map((opt, oIdx) => (
                                                                        <li key={oIdx}>
                                                                            <button
                                                                                type="button"
                                                                                className={`dropdown-item d-flex align-items-center gap-2 py-1 ${feat.icon === opt.value ? "active" : ""}`}
                                                                                onClick={() => updateFeature(fIdx, "icon", opt.value)}
                                                                            >
                                                                                <span style={{ width: "20px", textAlign: "center" }}>{opt.icon}</span>
                                                                                <span>{opt.label}</span>
                                                                            </button>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>

                                                            {/* Highlight Toggle Pill */}
                                                            <button
                                                                type="button"
                                                                className={`ace-highlight-toggle ${feat.highlight ? "active" : ""}`}
                                                                onClick={() => toggleFeatureHighlight(fIdx)}
                                                                title="Sorot fitur ini di halaman depan"
                                                            >
                                                                <i className={`fas ${feat.highlight ? "fa-star text-warning" : "fa-star text-muted"}`}></i>
                                                                <span>{feat.highlight ? "Disorot" : "Biasa"}</span>
                                                            </button>
                                                        </div>

                                                        {/* Micro Action Buttons */}
                                                        <div className="d-flex align-items-center gap-1">
                                                            <button
                                                                type="button"
                                                                className="ace-micro-action-btn"
                                                                disabled={fIdx === 0}
                                                                onClick={() => moveFeatureUp(fIdx)}
                                                                title="Geser ke atas"
                                                            >
                                                                <i className="fas fa-chevron-up"></i>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="ace-micro-action-btn"
                                                                disabled={fIdx === features.length - 1}
                                                                onClick={() => moveFeatureDown(fIdx)}
                                                                title="Geser ke bawah"
                                                            >
                                                                <i className="fas fa-chevron-down"></i>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="ace-micro-action-btn delete"
                                                                onClick={() => removeFeature(fIdx)}
                                                                title="Hapus fitur"
                                                            >
                                                                <i className="fas fa-trash-alt"></i>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <input
                                                        type="text"
                                                        className="ace-input"
                                                        value={feat.text || ""}
                                                        onChange={(e) => updateFeature(fIdx, "text", e.target.value)}
                                                        placeholder="Contoh: Sertifikat Kelulusan Resmi Setjen DPD RI"
                                                    />
                                                </div>
                                            ))}

                                            {features.length === 0 && (
                                                <div className="text-center py-4 px-2 border rounded-3 bg-light">
                                                    <i className="fas fa-box-open fa-2x text-muted mb-2"></i>
                                                    <p className="small text-muted mb-2">Belum ada fitur kursus yang ditambahkan.</p>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-teal"
                                                        onClick={() => addFeature()}
                                                    >
                                                        <i className="fas fa-plus me-1"></i> Tambah Fitur Pertama
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* 2. PRASYARAT KURSUS */}
                                <div className="col-lg-4 col-md-12">
                                    <div className="ace-card h-100 d-flex flex-column">
                                        <div className="ace-card-header d-flex justify-content-between align-items-center">
                                            <div className="d-flex align-items-center gap-2">
                                                <h6 className="ace-card-title mb-0">
                                                    <i className="fas fa-clipboard-check text-info"></i>
                                                    Prasyarat Kursus
                                                </h6>
                                                <span className="badge bg-slate-100 text-slate-700 border" style={{ fontSize: "0.72rem" }}>
                                                    {requirements.length}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-teal text-white py-1 px-2 d-inline-flex align-items-center gap-1"
                                                style={{ fontSize: "0.78rem", borderRadius: "6px" }}
                                                onClick={() => addRequirement()}
                                            >
                                                <i className="fas fa-plus"></i>
                                                <span>Tambah</span>
                                            </button>
                                        </div>

                                        <div className="ace-card-body flex-grow-1">
                                            {/* Quick Recommendation Presets */}
                                            <div className="ace-preset-pills-container">
                                                <div className="ace-preset-label">
                                                    <i className="fas fa-magic text-info"></i>
                                                    Rekomendasi Cepat:
                                                </div>
                                                <div className="d-flex flex-wrap gap-1">
                                                    {REQUIREMENT_PRESETS.map((pst, pIdx) => (
                                                        <button
                                                            key={pIdx}
                                                            type="button"
                                                            className="ace-preset-pill"
                                                            onClick={() => addRequirement(pst)}
                                                            title="Klik untuk menambahkan prasyarat rekomendasi ini"
                                                        >
                                                            <span>+</span>
                                                            <span>{pst.length > 28 ? pst.substring(0, 28) + "..." : pst}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Requirements List */}
                                            {requirements.map((req, rIdx) => (
                                                <div
                                                    key={req.id || rIdx}
                                                    className="ace-feature-item-card"
                                                    style={{ borderLeftColor: "#0284c7" }}
                                                >
                                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                                        <div className="d-flex align-items-center gap-2">
                                                            <span className="ace-step-number-badge">
                                                                {rIdx + 1}
                                                            </span>
                                                            <span className="small fw-semibold text-secondary">
                                                                Ketentuan #{rIdx + 1}
                                                            </span>
                                                        </div>

                                                        {/* Micro Action Buttons */}
                                                        <div className="d-flex align-items-center gap-1">
                                                            <button
                                                                type="button"
                                                                className="ace-micro-action-btn"
                                                                disabled={rIdx === 0}
                                                                onClick={() => moveRequirementUp(rIdx)}
                                                                title="Geser ke atas"
                                                            >
                                                                <i className="fas fa-chevron-up"></i>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="ace-micro-action-btn"
                                                                disabled={rIdx === requirements.length - 1}
                                                                onClick={() => moveRequirementDown(rIdx)}
                                                                title="Geser ke bawah"
                                                            >
                                                                <i className="fas fa-chevron-down"></i>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="ace-micro-action-btn delete"
                                                                onClick={() => removeRequirement(rIdx)}
                                                                title="Hapus prasyarat"
                                                            >
                                                                <i className="fas fa-trash-alt"></i>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <textarea
                                                        className="ace-input"
                                                        rows={2}
                                                        value={req.text || ""}
                                                        onChange={(e) => updateRequirement(rIdx, e.target.value)}
                                                        placeholder="Contoh: Memiliki pemahaman dasar ASN dan akses internet yang stabil"
                                                        style={{ resize: "vertical", minHeight: "56px" }}
                                                    />
                                                </div>
                                            ))}

                                            {requirements.length === 0 && (
                                                <div className="text-center py-4 px-2 border rounded-3 bg-light">
                                                    <i className="fas fa-clipboard-check fa-2x text-muted mb-2"></i>
                                                    <p className="small text-muted mb-2">Belum ada prasyarat kursus yang ditentukan.</p>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-teal"
                                                        onClick={() => addRequirement()}
                                                    >
                                                        <i className="fas fa-plus me-1"></i> Tambah Prasyarat Pertama
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* 3. CAPAIAN PEMBELAJARAN */}
                                <div className="col-lg-4 col-md-12">
                                    <div className="ace-card h-100 d-flex flex-column">
                                        <div className="ace-card-header d-flex justify-content-between align-items-center">
                                            <div className="d-flex align-items-center gap-2">
                                                <h6 className="ace-card-title mb-0">
                                                    <i className="fas fa-bullseye text-teal"></i>
                                                    Capaian Pembelajaran
                                                </h6>
                                                <span className="badge bg-slate-100 text-slate-700 border" style={{ fontSize: "0.72rem" }}>
                                                    {learningOutcomes.length}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-teal text-white py-1 px-2 d-inline-flex align-items-center gap-1"
                                                style={{ fontSize: "0.78rem", borderRadius: "6px" }}
                                                onClick={() => addOutcome()}
                                            >
                                                <i className="fas fa-plus"></i>
                                                <span>Tambah</span>
                                            </button>
                                        </div>

                                        <div className="ace-card-body flex-grow-1">
                                            {/* Quick Recommendation Presets */}
                                            <div className="ace-preset-pills-container">
                                                <div className="ace-preset-label">
                                                    <i className="fas fa-magic text-teal"></i>
                                                    Rekomendasi Cepat:
                                                </div>
                                                <div className="d-flex flex-wrap gap-1">
                                                    {OUTCOME_PRESETS.map((pst, pIdx) => (
                                                        <button
                                                            key={pIdx}
                                                            type="button"
                                                            className="ace-preset-pill"
                                                            onClick={() => addOutcome(pst)}
                                                            title="Klik untuk menambahkan capaian rekomendasi ini"
                                                        >
                                                            <span>+</span>
                                                            <span>{pst.length > 28 ? pst.substring(0, 28) + "..." : pst}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Learning Outcomes List */}
                                            {learningOutcomes.map((out, oIdx) => (
                                                <div
                                                    key={out.id || oIdx}
                                                    className="ace-feature-item-card"
                                                    style={{ borderLeftColor: "#0d9488" }}
                                                >
                                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                                        <div className="d-flex align-items-center gap-2">
                                                            <span className="ace-outcome-check-badge">
                                                                <i className="fas fa-check"></i>
                                                            </span>
                                                            <span className="small fw-semibold text-secondary">
                                                                Kompetensi #{oIdx + 1}
                                                            </span>
                                                        </div>

                                                        {/* Micro Action Buttons */}
                                                        <div className="d-flex align-items-center gap-1">
                                                            <button
                                                                type="button"
                                                                className="ace-micro-action-btn"
                                                                disabled={oIdx === 0}
                                                                onClick={() => moveOutcomeUp(oIdx)}
                                                                title="Geser ke atas"
                                                            >
                                                                <i className="fas fa-chevron-up"></i>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="ace-micro-action-btn"
                                                                disabled={oIdx === learningOutcomes.length - 1}
                                                                onClick={() => moveOutcomeDown(oIdx)}
                                                                title="Geser ke bawah"
                                                            >
                                                                <i className="fas fa-chevron-down"></i>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="ace-micro-action-btn delete"
                                                                onClick={() => removeOutcome(oIdx)}
                                                                title="Hapus capaian"
                                                            >
                                                                <i className="fas fa-trash-alt"></i>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <textarea
                                                        className="ace-input"
                                                        rows={2}
                                                        value={out.text || ""}
                                                        onChange={(e) => updateOutcome(oIdx, e.target.value)}
                                                        placeholder="Contoh: Mampu mengimplementasikan protokol tata naskah dinas secara mandiri"
                                                        style={{ resize: "vertical", minHeight: "56px" }}
                                                    />
                                                </div>
                                            ))}

                                            {learningOutcomes.length === 0 && (
                                                <div className="text-center py-4 px-2 border rounded-3 bg-light">
                                                    <i className="fas fa-bullseye fa-2x text-muted mb-2"></i>
                                                    <p className="small text-muted mb-2">Belum ada capaian pembelajaran yang ditambahkan.</p>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-teal"
                                                        onClick={() => addOutcome()}
                                                    >
                                                        <i className="fas fa-plus me-1"></i> Tambah Capaian Pertama
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* 4. TAG & LABEL KURSUS */}
                                <div className="col-12">
                                    <div className="ace-card">
                                        <div className="ace-card-header d-flex justify-content-between align-items-center">
                                            <div>
                                                <h6 className="ace-card-title mb-1">
                                                    <i className="fas fa-tags text-teal"></i>
                                                    Tag & Label Kursus
                                                </h6>
                                                <span className="small text-muted">Pilih label yang relevan untuk mempermudah pencarian peserta di katalog</span>
                                            </div>
                                            <span className="badge border" style={{ fontSize: "0.75rem", background: "#f0fdfa", color: "#0f766e", borderColor: "#ccfbf1" }}>
                                                {selectedTags.length} Tag Terpilih
                                            </span>
                                        </div>
                                        <div className="ace-card-body">
                                            <div className="d-flex flex-wrap gap-2">
                                                {availableTags.map(tag => {
                                                    const isSelected = selectedTags.some(t => (typeof t === "object" ? t.id === tag.id : t === tag.id));
                                                    return (
                                                        <button
                                                            key={tag.id}
                                                            type="button"
                                                            className={`btn btn-sm ${isSelected ? 'btn-teal text-white shadow-sm' : 'btn-outline-secondary'}`}
                                                            style={{
                                                                borderRadius: "20px",
                                                                fontSize: "0.8rem",
                                                                padding: "5px 14px",
                                                                backgroundColor: isSelected ? "#0d9488" : "#f8fafc",
                                                                borderColor: isSelected ? "#0d9488" : "#cbd5e1",
                                                                color: isSelected ? "#ffffff" : "#475569",
                                                                transition: "all 0.15s ease"
                                                            }}
                                                            onClick={() => {
                                                                setSelectedTags(prev => {
                                                                    const exists = prev.some(t => (typeof t === "object" ? t.id === tag.id : t === tag.id));
                                                                    if (exists) {
                                                                        return prev.filter(t => (typeof t === "object" ? t.id !== tag.id : t !== tag.id));
                                                                    } else {
                                                                        return [...prev, tag];
                                                                    }
                                                                });
                                                            }}
                                                        >
                                                            <i className={`fas ${isSelected ? 'fa-check' : 'fa-tag'} me-1`}></i>
                                                            {tag.title}
                                                        </button>
                                                    );
                                                })}
                                                {availableTags.length === 0 && (
                                                    <span className="text-muted small">Belum ada master tag di sistem.</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 4: KUIS TERLAMPIR STUDIO (FORM-BODY-MODERN EQUIVALENT) */}
                    {activeTab === "quizzes" && (
                        <div className="ace-quiz-studio">
                            {/* UNIFIED NAVIGATION & FILTER TOOLBAR (QUIZ-TOOLBAR-CARD) */}
                            <div className="quiz-toolbar-card mb-3">
                                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                                    {/* Left: Navigation Segmented Tabs */}
                                    <div className="quiz-segmented-tabs">
                                        <button
                                            type="button"
                                            className={`segmented-tab-btn ${quizSubTab === "overview" ? "active" : ""}`}
                                            onClick={() => setQuizSubTab("overview")}
                                        >
                                            <i className="fas fa-th-large me-2"></i>
                                            Ringkasan Kuis ({quizzes.length})
                                        </button>
                                        <button
                                            type="button"
                                            className={`segmented-tab-btn ${quizSubTab === "questions" ? "active" : ""}`}
                                            onClick={() => setQuizSubTab("questions")}
                                            disabled={!currentQuiz}
                                            title={!currentQuiz ? "Pilih salah satu kuis terlebih dahulu untuk mengelola soal" : currentQuiz.title}
                                        >
                                            <i className="fas fa-list-ol me-2"></i>
                                            {currentQuiz ? `Soal: ${currentQuiz.title.length > 25 ? currentQuiz.title.substring(0, 25) + '...' : currentQuiz.title}` : "Kelola Pertanyaan"}
                                        </button>
                                    </div>

                                    {/* Right: Controls based on sub-tab */}
                                    {quizSubTab === "overview" ? (
                                        <div className="d-flex align-items-center gap-2 flex-wrap">
                                            <div className="quiz-type-filter-group">
                                                <button
                                                    type="button"
                                                    className={`quiz-filter-pill ${quizTypeFilter === "all" ? "active" : ""}`}
                                                    onClick={() => setQuizTypeFilter("all")}
                                                >
                                                    Semua ({quizzes.length})
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`quiz-filter-pill ${quizTypeFilter === "quiz" ? "active" : ""}`}
                                                    onClick={() => setQuizTypeFilter("quiz")}
                                                >
                                                    <i className="fas fa-clipboard-check me-1"></i>
                                                    Kuis ({quizzes.filter(q => (q.quiz_type || "quiz") === "quiz").length})
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`quiz-filter-pill ${quizTypeFilter === "pre_post_test" ? "active" : ""}`}
                                                    onClick={() => setQuizTypeFilter("pre_post_test")}
                                                >
                                                    <i className="fas fa-graduation-cap me-1"></i>
                                                    Pre/Post ({quizzes.filter(q => q.quiz_type === "pre_post_test").length})
                                                </button>
                                            </div>

                                            <div className="d-flex align-items-center gap-1">
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-teal text-white d-inline-flex align-items-center gap-1"
                                                    onClick={handleOpenCreateQuiz}
                                                >
                                                    <i className="fas fa-plus"></i>
                                                    <span>Buat Kuis Baru</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-teal d-inline-flex align-items-center gap-1"
                                                    onClick={() => {
                                                        setImportTargetQuizId(quizzes.length > 0 ? quizzes[0].quiz_id : "new");
                                                        setShowImportModal(true);
                                                    }}
                                                    title="Import soal kuis dari file CSV / JSON"
                                                >
                                                    <i className="fas fa-file-import"></i>
                                                    <span>Import</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                                                    onClick={handleExportTemplate}
                                                    title="Download format CSV untuk import soal"
                                                >
                                                    <i className="fas fa-download"></i>
                                                    <span>Template CSV</span>
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="d-flex align-items-center gap-2 flex-wrap">
                                            <button
                                                type="button"
                                                className="btn btn-light btn-sm border text-secondary d-inline-flex align-items-center gap-1"
                                                onClick={() => setQuizSubTab("overview")}
                                            >
                                                <i className="fas fa-arrow-left"></i>
                                                <span>Kembali ke Daftar Kuis</span>
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-teal btn-sm text-white d-inline-flex align-items-center gap-1"
                                                onClick={handleOpenAddQuestion}
                                            >
                                                <i className="fas fa-plus"></i>
                                                <span>Tambah Pertanyaan</span>
                                            </button>
                                            {questions.length > 0 && (
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
                                                    onClick={() => handleExportQuizQuestions(currentQuiz)}
                                                    title="Ekspor seluruh soal kuis ini ke CSV"
                                                >
                                                    <i className="fas fa-file-export text-teal"></i>
                                                    <span>Export Soal</span>
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                className="btn btn-outline-teal btn-sm d-inline-flex align-items-center gap-1"
                                                onClick={() => {
                                                    setImportTargetQuizId(currentQuiz.quiz_id);
                                                    setShowImportModal(true);
                                                }}
                                                title="Import soal langsung ke kuis ini"
                                            >
                                                <i className="fas fa-file-import"></i>
                                                <span>Import Soal</span>
                                            </button>
                                            <span className="badge bg-light text-dark border px-2 py-1 fw-semibold small">
                                                <i className="fas fa-question-circle text-teal me-1"></i>
                                                {questions.length} Soal
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* SUBTAB 1: QUIZ OVERVIEW WRAPPER */}
                            {quizSubTab === "overview" && (
                                <div className="quiz-overview-wrapper">
                                    {/* Top Mini Stats Ribbon */}
                                    <div className="row g-3 mb-3">
                                        <div className="col-md-3 col-6">
                                            <div className="ace-stat-mini-box">
                                                <div className="ace-stat-mini-icon" style={{ background: "#f0fdfa", color: "#0d9488" }}>
                                                    <i className="fas fa-clipboard-question"></i>
                                                </div>
                                                <div>
                                                    <div className="small text-muted fw-semibold">Total Kuis</div>
                                                    <div className="fs-5 fw-bold text-dark">{quizzes.length} Kuis</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-md-3 col-6">
                                            <div className="ace-stat-mini-box">
                                                <div className="ace-stat-mini-icon bg-info bg-opacity-10 text-info">
                                                    <i className="fas fa-list-check"></i>
                                                </div>
                                                <div>
                                                    <div className="small text-muted fw-semibold">Total Soal Terpasang</div>
                                                    <div className="fs-5 fw-bold text-dark">
                                                        {quizzes.reduce((acc, q) => acc + (q.questions?.length || q.total_questions || 0), 0)} Soal
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-md-3 col-6">
                                            <div className="ace-stat-mini-box">
                                                <div className="ace-stat-mini-icon bg-success bg-opacity-10 text-success">
                                                    <i className="fas fa-check-circle"></i>
                                                </div>
                                                <div>
                                                    <div className="small text-muted fw-semibold">Kuis Aktif</div>
                                                    <div className="fs-5 fw-bold text-dark">
                                                        {quizzes.filter(q => q.is_active).length} Aktif
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-md-3 col-6">
                                            <div className="ace-stat-mini-box">
                                                <div className="ace-stat-mini-icon bg-warning bg-opacity-10 text-warning">
                                                    <i className="fas fa-graduation-cap"></i>
                                                </div>
                                                <div>
                                                    <div className="small text-muted fw-semibold">Pre / Post Test</div>
                                                    <div className="fs-5 fw-bold text-dark">
                                                        {quizzes.filter(q => q.quiz_type === "pre_post_test").length} Modul
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quizzes Grid */}
                                    <div className="quizzes-grid">
                                        {quizzes.length === 0 ? (
                                            <div className="quiz-empty-card text-center">
                                                <i className="fas fa-question-circle fa-3x text-muted mb-3 opacity-50"></i>
                                                <h5 className="fw-bold text-dark mb-1">Belum Ada Kuis Terlampir</h5>
                                                <p className="text-muted small mb-4">
                                                    Buat kuis evaluasi materi atau import bank soal CSV untuk melengkapi kursus ini.
                                                </p>
                                                <div className="d-flex justify-content-center gap-2 flex-wrap">
                                                    <button
                                                        type="button"
                                                        className="btn btn-teal text-white btn-sm"
                                                        onClick={handleOpenCreateQuiz}
                                                    >
                                                        <i className="fas fa-plus me-1"></i> Buat Kuis Pertama
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-teal btn-sm"
                                                        onClick={() => {
                                                            setImportTargetQuizId("new");
                                                            setShowImportModal(true);
                                                        }}
                                                    >
                                                        <i className="fas fa-file-import me-1"></i> Import dari CSV
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-secondary btn-sm"
                                                        onClick={handleExportTemplate}
                                                    >
                                                        <i className="fas fa-download me-1"></i> Unduh Format CSV
                                                    </button>
                                                </div>
                                            </div>
                                        ) : quizzes.filter(q => quizTypeFilter === "all" || (q.quiz_type || "quiz") === quizTypeFilter).length === 0 ? (
                                            <div className="quiz-empty-card text-center">
                                                <i className="fas fa-filter fa-3x text-muted mb-3 opacity-50"></i>
                                                <h5 className="fw-bold text-dark mb-1">Tidak Ada Kuis untuk Filter Ini</h5>
                                                <p className="text-muted small mb-3">
                                                    Tidak ditemukan kuis dengan kriteria kategori yang Anda pilih.
                                                </p>
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-secondary btn-sm"
                                                    onClick={() => setQuizTypeFilter("all")}
                                                >
                                                    Tampilkan Semua Kuis
                                                </button>
                                            </div>
                                        ) : (
                                            quizzes
                                                .filter(q => quizTypeFilter === "all" || (q.quiz_type || "quiz") === quizTypeFilter)
                                                .map((quiz) => (
                                                    <div key={quiz.quiz_id} className="quiz-card">
                                                        <div className="quiz-card-header">
                                                            <button
                                                                type="button"
                                                                className={`status-badge ${quiz.is_active ? "active" : "inactive"}`}
                                                                onClick={() => handleToggleQuizActive(quiz)}
                                                                title="Klik untuk mengubah status aktif"
                                                            >
                                                                <i className={`fas ${quiz.is_active ? "fa-check-circle" : "fa-pause-circle"}`}></i>
                                                                <span>{quiz.is_active ? "Aktif" : "Nonaktif"}</span>
                                                            </button>

                                                            <div className="d-flex align-items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    className="ace-micro-action-btn"
                                                                    onClick={() => handleEditQuiz(quiz)}
                                                                    title="Edit Pengaturan Kuis"
                                                                >
                                                                    <i className="fas fa-edit"></i>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="ace-micro-action-btn delete"
                                                                    onClick={() => handleDeleteQuiz(quiz.quiz_id, quiz.title)}
                                                                    title="Hapus Kuis"
                                                                >
                                                                    <i className="fas fa-trash-alt"></i>
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="quiz-card-body">
                                                            <div className="d-flex align-items-center gap-1 mb-2 flex-wrap">
                                                                <span className={`badge-quiz-type ${quiz.quiz_type === "pre_post_test" ? "type-prepost" : "type-quiz"}`}>
                                                                    <i className={`fas ${quiz.quiz_type === "pre_post_test" ? "fa-graduation-cap" : "fa-clipboard-check"} me-1`}></i>
                                                                    {quiz.quiz_type === "pre_post_test" ? "Pre & Post-test" : "Kuis Materi"}
                                                                </span>
                                                                <span className="badge-quiz-mode">
                                                                    <i className={`fas ${quiz.presentation_mode === "random" ? "fa-random" : "fa-sort-numeric-down"} me-1`}></i>
                                                                    {quiz.presentation_mode === "random" ? "Acak" : "Urut"}
                                                                </span>
                                                            </div>

                                                            <h5 className="quiz-title" title={quiz.title}>{quiz.title}</h5>
                                                            {quiz.description && (
                                                                <p className="quiz-description" title={quiz.description}>{quiz.description}</p>
                                                            )}

                                                            <div className="quiz-stats">
                                                                <span className="quiz-stat-pill">
                                                                    <i className="fas fa-question text-teal"></i>
                                                                    <span>{quiz.questions?.length || quiz.total_questions || 0} Pertanyaan</span>
                                                                </span>
                                                                <span className="quiz-stat-pill">
                                                                    <i className="fas fa-calendar-alt text-muted"></i>
                                                                    <span>{quiz.date ? new Date(quiz.date).toLocaleDateString() : 'Baru'}</span>
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="quiz-card-footer">
                                                            <button
                                                                type="button"
                                                                className="btn btn-primary"
                                                                onClick={() => handleSelectQuiz(quiz)}
                                                            >
                                                                <i className="fas fa-cog"></i>
                                                                <span>Kelola Soal</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="ace-micro-action-btn"
                                                                onClick={() => handleExportQuizQuestions(quiz)}
                                                                title="Export Soal (CSV)"
                                                            >
                                                                <i className="fas fa-file-export text-teal"></i>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="ace-micro-action-btn"
                                                                onClick={() => {
                                                                    setImportTargetQuizId(quiz.quiz_id);
                                                                    setShowImportModal(true);
                                                                }}
                                                                title="Import Soal ke Kuis Ini"
                                                            >
                                                                <i className="fas fa-file-import text-info"></i>
                                                            </button>
                                                            <Link
                                                                to={`/admin/courses/${course?.course_id || course_id}/evaluation/`}
                                                                className="ace-micro-action-btn"
                                                                title="Lihat Evaluasi Ujian & Hasil Peserta"
                                                            >
                                                                <i className="fas fa-chart-line text-warning"></i>
                                                            </Link>
                                                        </div>
                                                    </div>
                                                ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* SUBTAB 2: QUIZ QUESTIONS MANAGEMENT SECTION */}
                            {quizSubTab === "questions" && currentQuiz && (
                                <div className="quiz-questions-section">
                                    {/* Current Quiz Header Card */}
                                    <div className="quiz-questions-header">
                                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                                            <div>
                                                <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                                                    <h5 className="fw-bold text-dark mb-0">{currentQuiz.title}</h5>
                                                    <span className={`badge-quiz-type ${currentQuiz.quiz_type === "pre_post_test" ? "type-prepost" : "type-quiz"}`}>
                                                        <i className={`fas ${currentQuiz.quiz_type === "pre_post_test" ? "fa-graduation-cap" : "fa-clipboard-check"} me-1`}></i>
                                                        {currentQuiz.quiz_type === "pre_post_test" ? "Pre & Post-test" : "Kuis"}
                                                    </span>
                                                    <span className="badge-quiz-mode">
                                                        <i className={`fas ${currentQuiz.presentation_mode === "random" ? "fa-random" : "fa-sort-numeric-down"} me-1`}></i>
                                                        {currentQuiz.presentation_mode === "random" ? "Acak" : "Sesuai Urutan"}
                                                    </span>
                                                    <span className={`status-badge ${currentQuiz.is_active ? "active" : "inactive"}`}>
                                                        <i className={`fas ${currentQuiz.is_active ? "fa-check-circle" : "fa-pause-circle"} me-1`}></i>
                                                        {currentQuiz.is_active ? "Aktif" : "Nonaktif"}
                                                    </span>
                                                </div>
                                                <p className="small text-muted mb-0">{currentQuiz.description || "Kelola bank pertanyaan dan kunci jawaban kuis ini."}</p>
                                            </div>

                                            <button
                                                type="button"
                                                className="btn btn-teal text-white btn-sm d-inline-flex align-items-center gap-1"
                                                onClick={handleOpenAddQuestion}
                                            >
                                                <i className="fas fa-plus"></i>
                                                <span>Tambah Pertanyaan Baru</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Inline Add / Edit Question Form (Top: Only for adding new question) */}
                                    {isAddingQuestion && !editingQuestion && (
                                        <div className="mb-3">
                                            {renderQuestionFormCard(false, null)}
                                        </div>
                                    )}

                                    {/* Questions List */}
                                    {loadingQuestions ? (
                                        <div className="text-center py-5">
                                            <div className="spinner-border text-teal spinner-border-sm me-2" role="status"></div>
                                            <span className="text-muted small">Memuat daftar soal...</span>
                                        </div>
                                    ) : questions.length === 0 ? (
                                        <div className="text-center py-5 border rounded-3 bg-white">
                                            <i className="fas fa-clipboard-question fa-3x text-muted mb-3 opacity-50"></i>
                                            <h5 className="fw-bold text-dark mb-1">Belum Ada Soal di Kuis Ini</h5>
                                            <p className="text-muted small mb-3">Mulai tambahkan soal pilihan ganda atau import dari template CSV.</p>
                                            <div className="d-flex justify-content-center gap-2">
                                                <button
                                                    type="button"
                                                    className="btn btn-teal text-white btn-sm"
                                                    onClick={handleOpenAddQuestion}
                                                >
                                                    <i className="fas fa-plus me-1"></i> Tambah Soal Pertama
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-teal btn-sm"
                                                    onClick={() => {
                                                        setImportTargetQuizId(currentQuiz.quiz_id);
                                                        setShowImportModal(true);
                                                    }}
                                                >
                                                    <i className="fas fa-file-import me-1"></i> Import Soal CSV
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="questions-container">
                                            {questions.map((q, qIdx) => {
                                                const isThisEditing = Boolean(
                                                    editingQuestion && (
                                                        (editingQuestion.question_id && (editingQuestion.question_id === q.question_id || editingQuestion.question_id === q.id)) ||
                                                        (editingQuestion.id && (editingQuestion.id === q.question_id || editingQuestion.id === q.id)) ||
                                                        (editingQuestion === q)
                                                    )
                                                );

                                                if (isThisEditing) {
                                                    return (
                                                        <div
                                                            key={q.question_id || q.id || qIdx}
                                                            id={`question-edit-${q.question_id || q.id || qIdx}`}
                                                            className="question-inline-edit-wrapper mb-3"
                                                        >
                                                            {renderQuestionFormCard(true, qIdx)}
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div key={q.question_id || q.id || qIdx} className="question-card">
                                                        <div className="question-header">
                                                            <div className="d-flex align-items-center gap-2 flex-grow-1">
                                                                <span className="question-number">Q{qIdx + 1}</span>
                                                                <div className="question-order-controls">
                                                                    <button
                                                                        type="button"
                                                                        className="question-order-btn"
                                                                        disabled={qIdx === 0}
                                                                        onClick={() => handleMoveQuestion(qIdx, "up")}
                                                                        title="Pindahkan ke atas"
                                                                    >
                                                                        <i className="fas fa-arrow-up"></i>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="question-order-btn"
                                                                        disabled={qIdx === questions.length - 1}
                                                                        onClick={() => handleMoveQuestion(qIdx, "down")}
                                                                        title="Pindahkan ke bawah"
                                                                    >
                                                                        <i className="fas fa-arrow-down"></i>
                                                                    </button>
                                                                </div>
                                                                <div className="fw-semibold text-dark fs-6 ms-1">
                                                                    {q.question_text}
                                                                </div>
                                                            </div>

                                                            <div className="d-flex align-items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    className="ace-micro-action-btn"
                                                                    onClick={() => handleEditQuestion(q)}
                                                                    title="Edit Pertanyaan"
                                                                >
                                                                    <i className="fas fa-edit"></i>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="ace-micro-action-btn delete"
                                                                    onClick={() => handleDeleteQuestion(q.question_id || q.id)}
                                                                    title="Hapus Pertanyaan"
                                                                >
                                                                    <i className="fas fa-trash-alt"></i>
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="question-choices">
                                                            {(q.choices || []).map((choice, cIdx) => (
                                                                <div
                                                                    key={choice.choice_id || cIdx}
                                                                    className={`choice-item ${choice.is_correct ? "correct" : ""}`}
                                                                >
                                                                    <span className="choice-indicator">
                                                                        <i className={`fas ${choice.is_correct ? "fa-check-circle text-success" : "fa-circle text-muted"}`}></i>
                                                                    </span>
                                                                    <span className="choice-label">
                                                                        {String.fromCharCode(65 + cIdx)}.
                                                                    </span>
                                                                    <span className="choice-text flex-grow-1">
                                                                        {choice.choice_text}
                                                                    </span>
                                                                    {choice.is_correct && (
                                                                        <span className="correct-pill">
                                                                            <i className="fas fa-check me-1"></i>Kunci Benar
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* MODAL: BUAT / EDIT KUIS */}
                            {showQuizModal && (
                                <div className="quiz-modal-backdrop" onClick={() => setShowQuizModal(false)}>
                                    <div className="quiz-modal-content" onClick={(e) => e.stopPropagation()}>
                                        <div className="quiz-modal-header">
                                            <h6 className="fw-bold text-dark mb-0">
                                                <i className="fas fa-clipboard-question text-teal me-2"></i>
                                                {editingQuiz ? "Edit Pengaturan Kuis" : "Buat Kuis Baru"}
                                            </h6>
                                            <button
                                                type="button"
                                                className="btn-close"
                                                onClick={() => setShowQuizModal(false)}
                                            ></button>
                                        </div>
                                        <form onSubmit={handleSaveQuiz}>
                                            <div className="quiz-modal-body">
                                                <div className="mb-3">
                                                    <label className="ace-form-label fw-bold">
                                                        Judul Kuis <span className="text-danger">*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        className="ace-input"
                                                        value={quizForm.title}
                                                        onChange={(e) => setQuizForm(prev => ({ ...prev, title: e.target.value }))}
                                                        placeholder="Contoh: Kuis Evaluasi Modul 1 Tata Kelola ASN"
                                                        required
                                                    />
                                                </div>

                                                <div className="mb-3">
                                                    <label className="ace-form-label fw-bold">Deskripsi / Petunjuk Pengerjaan</label>
                                                    <textarea
                                                        className="ace-input"
                                                        rows={3}
                                                        value={quizForm.description}
                                                        onChange={(e) => setQuizForm(prev => ({ ...prev, description: e.target.value }))}
                                                        placeholder="Petunjuk teknis pengerjaan kuis bagi peserta..."
                                                    />
                                                </div>

                                                <div className="row g-3 mb-3">
                                                    <div className="col-md-6">
                                                        <label className="ace-form-label fw-bold">Tipe Kuis</label>
                                                        <select
                                                            className="ace-select"
                                                            value={quizForm.quiz_type}
                                                            onChange={(e) => setQuizForm(prev => ({ ...prev, quiz_type: e.target.value }))}
                                                        >
                                                            <option value="quiz">Kuis Pembelajaran Biasa</option>
                                                            <option value="pre_post_test">Pre-Test & Post-Test Modul</option>
                                                        </select>
                                                    </div>
                                                    <div className="col-md-6">
                                                        <label className="ace-form-label fw-bold">Urutan Penyajian Soal</label>
                                                        <select
                                                            className="ace-select"
                                                            value={quizForm.presentation_mode}
                                                            onChange={(e) => setQuizForm(prev => ({ ...prev, presentation_mode: e.target.value }))}
                                                        >
                                                            <option value="ordered">Sesuai Urutan Dibuat</option>
                                                            <option value="random">Acak untuk Setiap Peserta</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="form-check form-switch mt-2">
                                                    <input
                                                        className="form-check-input"
                                                        type="checkbox"
                                                        id="quizActiveSwitch"
                                                        checked={quizForm.is_active}
                                                        onChange={(e) => setQuizForm(prev => ({ ...prev, is_active: e.target.checked }))}
                                                    />
                                                    <label className="form-check-label fw-semibold" htmlFor="quizActiveSwitch">
                                                        Aktifkan kuis ini langsung untuk peserta kursus
                                                    </label>
                                                </div>
                                            </div>
                                            <div className="quiz-modal-footer">
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary"
                                                    onClick={() => setShowQuizModal(false)}
                                                >
                                                    Batal
                                                </button>
                                                <button
                                                    type="submit"
                                                    className="btn btn-sm btn-teal text-white"
                                                >
                                                    <i className="fas fa-save me-1"></i>
                                                    <span>{editingQuiz ? "Simpan Perubahan" : "Buat Kuis"}</span>
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            )}

                            {/* MODAL: IMPORT KUIS / SOAL */}
                            {showImportModal && (
                                <div className="quiz-modal-backdrop" onClick={() => setShowImportModal(false)}>
                                    <div className="quiz-modal-content large" onClick={(e) => e.stopPropagation()}>
                                        <div className="quiz-modal-header">
                                            <h6 className="fw-bold text-dark mb-0">
                                                <i className="fas fa-file-import text-teal me-2"></i>
                                                Import Bank Soal Kuis (CSV / JSON)
                                            </h6>
                                            <button
                                                type="button"
                                                className="btn-close"
                                                onClick={() => setShowImportModal(false)}
                                            ></button>
                                        </div>
                                        <div className="quiz-modal-body">
                                            {/* Target Quiz Selection */}
                                            <div className="p-3 bg-light border rounded-3 mb-3">
                                                <label className="ace-form-label fw-bold mb-1">
                                                    <i className="fas fa-bullseye text-teal me-1"></i> Target Kuis Tujuan:
                                                </label>
                                                <div className="row g-2 align-items-center">
                                                    <div className="col-md-6">
                                                        <select
                                                            className="ace-select"
                                                            value={importTargetQuizId}
                                                            onChange={(e) => setImportTargetQuizId(e.target.value)}
                                                        >
                                                            <option value="new">+ Buat Kuis Baru dari File Ini</option>
                                                            {quizzes.length > 0 && (
                                                                <optgroup label="Kuis yang Sudah Ada">
                                                                    {quizzes.map((q) => (
                                                                        <option key={q.quiz_id} value={q.quiz_id}>
                                                                            {q.title} ({q.questions?.length || q.total_questions || 0} Soal)
                                                                        </option>
                                                                    ))}
                                                                </optgroup>
                                                            )}
                                                        </select>
                                                    </div>
                                                    {importTargetQuizId === "new" && (
                                                        <div className="col-md-6">
                                                            <input
                                                                type="text"
                                                                className="ace-input"
                                                                placeholder="Judul Kuis Baru..."
                                                                value={importNewQuizTitle}
                                                                onChange={(e) => setImportNewQuizTitle(e.target.value)}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* File Dropzone */}
                                            <input
                                                type="file"
                                                ref={quizFileInputRef}
                                                className="d-none"
                                                accept=".csv,.json,text/csv,application/json"
                                                onChange={handleFileChange}
                                            />

                                            {!importFile ? (
                                                <div
                                                    className={`quiz-file-dropzone p-4 text-center mb-3 ${isDragOver ? "drag-over" : ""}`}
                                                    onClick={() => quizFileInputRef.current?.click()}
                                                    onDragEnter={() => setIsDragOver(true)}
                                                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                                                    onDragLeave={() => setIsDragOver(false)}
                                                    onDrop={(e) => {
                                                        e.preventDefault();
                                                        setIsDragOver(false);
                                                        if (e.dataTransfer.files?.length) {
                                                            handleFileChange(e.dataTransfer.files[0]);
                                                        }
                                                    }}
                                                >
                                                    <i className="fas fa-cloud-upload-alt fa-3x text-teal mb-2"></i>
                                                    <h6 className="fw-bold text-dark mb-1">
                                                        {isDragOver ? "Lepaskan Berkas di Sini" : "Klik atau Tarik Berkas Soal ke Sini"}
                                                    </h6>
                                                    <p className="text-muted small mb-2">
                                                        Mendukung format file <strong>.CSV</strong> (Excel/Google Sheets) dan <strong>.JSON</strong>
                                                    </p>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-secondary"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleExportTemplate();
                                                        }}
                                                    >
                                                        <i className="fas fa-download me-1"></i> Unduh Contoh Template CSV
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="d-flex align-items-center justify-content-between p-3 border rounded-3 bg-light mb-3">
                                                    <div className="d-flex align-items-center gap-3">
                                                        <i className="fas fa-file-csv fa-2x text-teal"></i>
                                                        <div>
                                                            <div className="fw-bold text-dark">{importFile.name}</div>
                                                            <div className="small text-muted">
                                                                {(importFile.size / 1024).toFixed(1)} KB &bull; {parsedQuestions.length} pertanyaan terdeteksi
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-danger"
                                                        onClick={() => {
                                                            setImportFile(null);
                                                            setParsedQuestions([]);
                                                            if (quizFileInputRef.current) quizFileInputRef.current.value = "";
                                                        }}
                                                    >
                                                        <i className="fas fa-trash me-1"></i> Ganti
                                                    </button>
                                                </div>
                                            )}

                                            {importError && (
                                                <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                                                    <i className="fas fa-exclamation-triangle"></i>
                                                    <span>{importError}</span>
                                                </div>
                                            )}

                                            {/* Parsed Preview Table */}
                                            {parsedQuestions.length > 0 && (
                                                <div className="border rounded-3 p-3 bg-white mb-2" style={{ maxHeight: "280px", overflowY: "auto" }}>
                                                    <h6 className="small fw-bold text-dark mb-2">
                                                        <i className="fas fa-eye text-teal me-1"></i>
                                                        Pratinjau {parsedQuestions.filter(q => q.isValid).length} Soal Siap Diimpor:
                                                    </h6>
                                                    <div className="table-responsive">
                                                        <table className="table table-sm table-bordered align-middle small mb-0">
                                                            <thead className="table-light">
                                                                <tr>
                                                                    <th style={{ width: "40px" }}>No</th>
                                                                    <th>Pertanyaan</th>
                                                                    <th>Pilihan Jawaban</th>
                                                                    <th style={{ width: "90px" }}>Kunci</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {parsedQuestions.map((q, idx) => {
                                                                    const correctChoice = q.choices?.find(c => c.is_correct);
                                                                    return (
                                                                        <tr key={idx} className={q.isValid ? "" : "table-danger"}>
                                                                            <td>{idx + 1}</td>
                                                                            <td className="fw-medium">{q.question_text}</td>
                                                                            <td>
                                                                                <ul className="mb-0 ps-3">
                                                                                    {q.choices?.map((c, cIdx) => (
                                                                                        <li key={cIdx} className={c.is_correct ? "fw-bold text-success" : ""}>
                                                                                            {String.fromCharCode(65 + cIdx)}. {c.choice_text}
                                                                                        </li>
                                                                                    ))}
                                                                                </ul>
                                                                            </td>
                                                                            <td>
                                                                                {correctChoice ? (
                                                                                    <span className="badge bg-success">
                                                                                        {String.fromCharCode(65 + q.choices.indexOf(correctChoice))}
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="badge bg-danger">Tanpa Kunci</span>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="quiz-modal-footer">
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-secondary"
                                                onClick={() => setShowImportModal(false)}
                                                disabled={isImporting}
                                            >
                                                Tutup
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-teal text-white"
                                                onClick={handleExecuteImport}
                                                disabled={isImporting || parsedQuestions.length === 0}
                                            >
                                                {isImporting && <span className="spinner-border spinner-border-sm me-1"></span>}
                                                <i className="fas fa-file-import me-1"></i>
                                                <span>Mulai Impor {parsedQuestions.filter(q => q.isValid).length} Soal</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 5: STATUS & KONTROL */}
                    {activeTab === "status" && (
                        <div className="row g-3">
                            <div className="col-md-6">
                                <div className="ace-card">
                                    <div className="ace-card-header">
                                        <h6 className="ace-card-title">
                                            <i className="fas fa-sliders text-teal"></i>
                                            Kontrol Status Publikasi Kursus
                                        </h6>
                                    </div>
                                    <div className="ace-card-body">
                                        <div className="mb-3">
                                            <label className="ace-form-label">Status Platform</label>
                                            <select
                                                className="ace-select"
                                                value={platformStatus}
                                                onChange={(e) => setPlatformStatus(e.target.value)}
                                            >
                                                <option value="Published">Published (Tayang & Aktif untuk Siswa)</option>
                                                <option value="Disabled">Disabled (Nonaktif / Diarsipkan)</option>
                                                <option value="Review">Review (Kembalikan ke Status Peninjauan)</option>
                                                <option value="Draft">Draft (Arsip Instruktur)</option>
                                            </select>
                                            <span className="small text-muted mt-1 d-block">
                                                Status yang dipilih akan langsung diterapkan ke versi publik setelah Anda menekan tombol <strong>Simpan & Terapkan Langsung</strong>.
                                            </span>
                                        </div>

                                        <div className="p-3 bg-light border rounded mb-3">
                                            <h6 className="small fw-bold text-dark mb-1">
                                                <i className="fas fa-info-circle text-teal me-1"></i>
                                                Prinsip Direct-to-Live Admin:
                                            </h6>
                                            <ul className="small text-muted mb-0 ps-3">
                                                <li>Admin tidak memerlukan siklus review atau persetujuan pihak lain.</li>
                                                <li>Semua pembaruan pada materi, teks, dan status langsung disinkronkan ke katalog dan siswa terdaftar.</li>
                                                <li>Progres belajar siswa pada materi yang sudah diselesaikan tetap terlindungi (smart-sync).</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="col-md-6">
                                <div className="ace-card">
                                    <div className="ace-card-header d-flex justify-content-between align-items-center">
                                        <h6 className="ace-card-title mb-0">
                                            <i className="fas fa-shield-alt text-teal me-2"></i>
                                            Metadata & Riwayat Persetujuan
                                        </h6>
                                        <span className={`badge ${course?.platform_status === 'Published' ? 'bg-success' : course?.platform_status === 'Review' ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                                            {course?.platform_status || 'Draft'}
                                        </span>
                                    </div>
                                    <div className="ace-card-body">
                                        {/* Admin Approval Audit Box */}
                                        <div className="p-3 mb-3 rounded border" style={{ backgroundColor: "#f8fafc" }}>
                                            <div className="d-flex align-items-start justify-content-between mb-2">
                                                <span className="small fw-bold text-uppercase text-muted" style={{ letterSpacing: "0.5px" }}>
                                                    <i className="fas fa-check-circle text-teal me-1"></i> Status Persetujuan Admin
                                                </span>
                                                {course?.approved_by_detail || course?.approved_by_name ? (
                                                    <span className="badge bg-teal bg-opacity-10 text-teal border border-teal-subtle px-2 py-1">
                                                        <i className="fas fa-user-check me-1"></i> Disetujui
                                                    </span>
                                                ) : (
                                                    <span className="badge bg-warning bg-opacity-10 text-warning border border-warning px-2 py-1">
                                                        <i className="fas fa-clock me-1"></i> Belum Disetujui
                                                    </span>
                                                )}
                                            </div>

                                            {course?.approved_by_detail || course?.approved_by_name ? (
                                                <div className="d-flex align-items-center gap-3">
                                                    <div 
                                                        className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-sm flex-shrink-0"
                                                        style={{ 
                                                            width: "44px", 
                                                            height: "44px", 
                                                            backgroundColor: "#0d9488",
                                                            overflow: "hidden" 
                                                        }}
                                                    >
                                                        {course?.approved_by_detail?.image ? (
                                                            <img 
                                                                src={getImageUrl(course.approved_by_detail.image)} 
                                                                alt={course.approved_by_detail.full_name} 
                                                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                                                onError={(e) => { e.target.style.display = 'none'; }}
                                                            />
                                                        ) : (
                                                            (course?.approved_by_detail?.full_name || course?.approved_by_name || "A").substring(0, 2).toUpperCase()
                                                        )}
                                                    </div>
                                                    <div className="flex-grow-1 min-w-0">
                                                        <div className="d-flex align-items-center gap-2 flex-wrap">
                                                            <strong className="text-dark" style={{ fontSize: "0.92rem" }}>
                                                                {course?.approved_by_detail?.full_name || course?.approved_by_name}
                                                            </strong>
                                                            <span className="badge bg-dark bg-opacity-10 text-dark" style={{ fontSize: "0.72rem" }}>
                                                                {course?.approved_by_detail?.role || "Administrator"}
                                                            </span>
                                                        </div>
                                                        <div className="small text-muted text-truncate">
                                                            <i className="far fa-envelope me-1"></i>
                                                            {course?.approved_by_detail?.email || course?.approved_by_detail?.username || "-"}
                                                        </div>
                                                        {(course?.approved_by_detail?.approval_date || course?.approval_date) && (
                                                            <div className="small text-teal mt-0.5" style={{ fontSize: "0.78rem" }}>
                                                                <i className="far fa-calendar-check me-1"></i>
                                                                Disetujui pada: {new Date(course?.approved_by_detail?.approval_date || course?.approval_date).toLocaleString("id-ID", {
                                                                    day: "numeric",
                                                                    month: "long",
                                                                    year: "numeric",
                                                                    hour: "2-digit",
                                                                    minute: "2-digit"
                                                                })} WIB
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="small text-muted py-1">
                                                    Kursus ini belum diverifikasi/disetujui oleh Administrator, atau statusnya masih dalam peninjauan.
                                                </div>
                                            )}
                                        </div>

                                        <table className="table table-sm table-borderless mb-0">
                                            <tbody>
                                                <tr>
                                                    <td className="text-muted" style={{ width: "150px" }}>Instruktur Pengampu:</td>
                                                    <td><strong>{course?.teacher?.full_name || "Instruktur"}</strong></td>
                                                </tr>
                                                <tr>
                                                    <td className="text-muted">ID Kursus:</td>
                                                    <td><code>{course?.course_id}</code></td>
                                                </tr>
                                                <tr>
                                                    <td className="text-muted">Slug URL:</td>
                                                    <td>
                                                        <code>{course?.slug || "-"}</code>
                                                        {course?.slug && (
                                                            <a 
                                                                href={`/course-detail/${course.slug}/`} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="ms-2 text-teal small text-decoration-none"
                                                                title="Buka halaman publik kursus di tab baru"
                                                            >
                                                                <i className="fas fa-external-link-alt"></i>
                                                            </a>
                                                        )}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="text-muted">Tanggal Dibuat:</td>
                                                    <td>{course?.date ? new Date(course.date).toLocaleString("id-ID") : "-"}</td>
                                                </tr>
                                                <tr>
                                                    <td className="text-muted">Terakhir Diajukan:</td>
                                                    <td>{course?.review_submitted_date ? new Date(course.review_submitted_date).toLocaleString("id-ID") : "-"}</td>
                                                </tr>
                                                <tr>
                                                    <td className="text-muted">Tipe Versi:</td>
                                                    <td>
                                                        {course?.is_published_version ? (
                                                            <span className="badge bg-success bg-opacity-10 text-success border border-success-subtle">
                                                                <i className="fas fa-globe me-1"></i> Versi Publik (Live untuk Siswa)
                                                            </span>
                                                        ) : (
                                                            <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary-subtle">
                                                                <i className="fas fa-file-signature me-1"></i> Versi Master / Draft
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

            </div>

            {/* Interactive SCORM Player Modal for Administrator Preview */}
            {scormPreviewModal.isOpen && typeof document !== "undefined" && createPortal(
                <div
                    className="modal fade show d-flex scorm-modal-overlay align-items-center justify-content-center"
                    tabIndex="-1"
                    role="dialog"
                    aria-modal="true"
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        width: "100vw",
                        height: "100vh",
                        backgroundColor: "rgba(15, 23, 42, 0.75)",
                        backdropFilter: "blur(4px)",
                        WebkitBackdropFilter: "blur(4px)",
                        zIndex: 2147483647,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        margin: 0,
                        padding: scormPreviewModal.isFullscreen ? 0 : "1.25rem",
                        boxSizing: "border-box"
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setScormPreviewModal(prev => ({ ...prev, isOpen: false }));
                        }
                    }}
                >
                    <div
                        className={`scorm-modal-dialog ${scormPreviewModal.isFullscreen ? "modal-fullscreen m-0" : "modal-xl"}`}
                        style={{
                            maxWidth: scormPreviewModal.isFullscreen ? "100vw" : "1100px",
                            width: scormPreviewModal.isFullscreen ? "100vw" : "96vw",
                            maxHeight: scormPreviewModal.isFullscreen ? "100vh" : "92vh",
                            height: scormPreviewModal.isFullscreen ? "100vh" : "auto",
                            margin: "auto",
                            minHeight: 0,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                            pointerEvents: "auto",
                            transform: "none"
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            className="modal-content border-0 shadow-lg rounded-3 overflow-hidden bg-white text-dark"
                            style={{
                                backgroundColor: "#ffffff",
                                color: "#1e293b",
                                width: "100%",
                                maxHeight: scormPreviewModal.isFullscreen ? "100vh" : "92vh",
                                height: scormPreviewModal.isFullscreen ? "100vh" : "auto",
                                display: "flex",
                                flexDirection: "column",
                                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                                margin: "auto"
                            }}
                        >
                            <div
                                className="modal-header bg-white text-dark py-3 px-4 d-flex align-items-center justify-content-between border-bottom"
                                style={{ backgroundColor: "#ffffff", borderBottom: "1px solid #e2e8f0" }}
                            >
                                <div className="d-flex align-items-center gap-2">
                                    <span className="badge bg-teal-subtle text-teal border border-teal-subtle px-2 py-1 fw-semibold">
                                        <i className="fas fa-cube me-1"></i>
                                        {(scormPreviewModal.moduleType || "SCORM 1.2").toUpperCase()}
                                    </span>
                                    <h6 className="modal-title mb-0 fw-bold text-dark">
                                        {scormPreviewModal.title}
                                    </h6>
                                </div>
                                <div className="d-flex align-items-center gap-3">
                                    <div
                                        className="d-none d-sm-flex align-items-center gap-2 bg-light border px-2 py-1 rounded small"
                                        style={{ backgroundColor: "#f8fafc", borderColor: "#e2e8f0" }}
                                    >
                                        <span className="text-secondary fw-medium">Status RTE:</span>
                                        <span className={`badge ${scormPlayerStatus === 'completed' || scormPlayerStatus === 'passed' ? 'bg-success text-white' :
                                            scormPlayerStatus === 'failed' ? 'bg-danger text-white' : 'bg-warning text-dark'
                                            }`}>
                                            {scormPlayerStatus}
                                        </span>
                                        {scormPlayerScore !== null && (
                                            <span className="badge bg-info text-white">
                                                Skor: {scormPlayerScore}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary border-0"
                                        onClick={() => setScormPreviewModal(prev => ({ ...prev, isFullscreen: !prev.isFullscreen }))}
                                        title={scormPreviewModal.isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
                                        style={{ color: "#64748b" }}
                                    >
                                        <i className={`fas fa-${scormPreviewModal.isFullscreen ? 'compress' : 'expand'}`}></i>
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-close"
                                        onClick={() => setScormPreviewModal(prev => ({ ...prev, isOpen: false }))}
                                        aria-label="Tutup"
                                    ></button>
                                </div>
                            </div>
                            <div
                                className="modal-body p-0 bg-light position-relative"
                                style={{
                                    flex: "1 1 auto",
                                    minHeight: scormPreviewModal.isFullscreen ? "calc(100vh - 120px)" : "600px",
                                    height: scormPreviewModal.isFullscreen ? "calc(100vh - 120px)" : "65vh",
                                    backgroundColor: "#f8fafc",
                                    overflow: "hidden"
                                }}
                            >
                                {scormPreviewModal.url ? (
                                    <iframe
                                        ref={scormIframeRef}
                                        src={scormPreviewModal.url}
                                        title="SCORM Player Simulation"
                                        className="w-100 h-100 border-0 flex-grow-1"
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            minHeight: scormPreviewModal.isFullscreen ? "calc(100vh - 120px)" : "600px",
                                            display: "block",
                                            backgroundColor: "#ffffff"
                                        }}
                                        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                ) : (
                                    <div className="text-center p-5 text-muted d-flex flex-column align-items-center justify-content-center h-100">
                                        <i className="fas fa-exclamation-triangle fa-2x mb-3 text-warning"></i>
                                        <p className="mb-0 text-muted">URL konten SCORM tidak dapat dimuat.</p>
                                    </div>
                                )}
                            </div>
                            <div
                                className="modal-footer bg-white py-2 px-4 d-flex justify-content-between border-top"
                                style={{ backgroundColor: "#ffffff", borderTop: "1px solid #e2e8f0" }}
                            >
                                <small className="text-muted">
                                    <i className="fas fa-info-circle me-1 text-primary"></i>
                                    Uji coba simulasi SCORM 1.2 RTE API Bridge bawaan LMS Setjen DPD RI untuk Administrator.
                                </small>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => setScormPreviewModal(prev => ({ ...prev, isOpen: false }))}
                                >
                                    Tutup Pratinjau
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <Footer />
        </div>
    );
}

export default AdminCourseEdit;

