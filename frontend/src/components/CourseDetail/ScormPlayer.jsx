import React, { useState, useEffect, useRef, useCallback } from "react";
import useAxios from "../../utils/useAxios";
import Toast from "../../views/plugin/Toast";

const ScormPlayer = ({
  variantItem,
  variantContext,
  onClose,
  handleMarkLessonAsCompleted,
  courseId,
  course,
}) => {
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [lessonStatus, setLessonStatus] = useState(variantItem?.is_completed ? "completed" : "incomplete");
  const [score, setScore] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const containerRef = useRef(null);
  const iframeRef = useRef(null);

  const moduleId = variantItem?.learning_module_info?.id || 
                   variantItem?.learning_module?.id || 
                   variantItem?.learning_module ||
                   course?.course?.learning_module?.id ||
                   course?.learning_module?.id;

  const playerSrc = moduleId 
    ? `/modules/${moduleId}/player/`
    : (variantItem?.learning_module_info?.player_url || variantItem?.file);

  // Check if current lesson is already completed
  const isLessonAlreadyCompleted = useCallback(() => {
    if (variantItem?.is_completed) return true;
    if (!course || !course.completed_lesson) return false;
    const targetVId = String(variantItem?.variant_item_id || variantItem?.id || "");
    const targetId = String(variantItem?.id || "");
    return course.completed_lesson.some(cl => {
      const clVId = String(cl.variant_item?.variant_item_id || cl.variant_item?.id || "");
      const clId = String(cl.variant_item?.id || "");
      return (targetVId && (clVId === targetVId || clId === targetVId)) ||
             (targetId && (clId === targetId || clVId === targetId));
    });
  }, [variantItem, course]);

  // Callback to sync SCORM status to backend
  const handleTrackingSync = useCallback(async (cmiPayload) => {
    if (!moduleId) return;
    setSyncing(true);

    try {
      const response = await useAxios.post(`api/v1/modules/${moduleId}/tracking/`, {
        ...cmiPayload,
        course_id: courseId || course?.course?.id,
        variant_item_id: variantItem?.variant_item_id || variantItem?.id,
      });

      if (response?.data?.lesson_status) {
        const status = response.data.lesson_status.toLowerCase();
        setLessonStatus(status);

        const alreadyDone = isLessonAlreadyCompleted();
        if ((status === "completed" || status === "passed") && !alreadyDone && handleMarkLessonAsCompleted) {
          handleMarkLessonAsCompleted(variantItem?.variant_item_id || variantItem?.id, true);
          Toast().fire({
            icon: "success",
            title: "Modul Berhasil Diselesaikan!",
            text: "Progress belajar dan sertifikat Anda telah diperbarui secara otomatis.",
            timer: 3500
          });
        }
      }
    } catch (err) {
      console.error("[ScormPlayer] Tracking error:", err);
    } finally {
      setSyncing(false);
    }
  }, [moduleId, courseId, course, variantItem, handleMarkLessonAsCompleted, isLessonAlreadyCompleted]);

  // Setup window.API for SCORM 1.2 on window object so any iframe finding window.parent.API works directly
  useEffect(() => {
    const cmiStore = {
      "cmi.core.student_id": "current_asn",
      "cmi.core.lesson_status": lessonStatus,
      "cmi.core.score.raw": "0",
      "cmi.core.lesson_location": "",
      "cmi.core.session_time": "00:00:00",
      "cmi.suspend_data": "",
    };

    window.API = {
      LMSInitialize: (param) => {
        console.log("[Parent ScormPlayer] LMSInitialize:", param);
        return "true";
      },
      LMSGetValue: (element) => {
        return cmiStore[element] !== undefined ? cmiStore[element] : "";
      },
      LMSSetValue: (element, value) => {
        console.log(`[Parent ScormPlayer] LMSSetValue(${element}, ${value})`);
        cmiStore[element] = String(value);

        if (element === "cmi.core.lesson_status") {
          setLessonStatus(String(value).toLowerCase());
        }
        if (element === "cmi.core.score.raw") {
          setScore(Number(value) || 0);
        }
        return "true";
      },
      LMSCommit: (param) => {
        console.log("[Parent ScormPlayer] LMSCommit triggered");
        handleTrackingSync({
          lesson_status: cmiStore["cmi.core.lesson_status"],
          score_raw: cmiStore["cmi.core.score.raw"],
          lesson_location: cmiStore["cmi.core.lesson_location"],
          session_time: cmiStore["cmi.core.session_time"],
          suspend_data: cmiStore["cmi.suspend_data"],
        });
        return "true";
      },
      LMSFinish: (param) => {
        console.log("[Parent ScormPlayer] LMSFinish triggered");
        handleTrackingSync({
          lesson_status: cmiStore["cmi.core.lesson_status"],
          score_raw: cmiStore["cmi.core.score.raw"],
          lesson_location: cmiStore["cmi.core.lesson_location"],
          session_time: cmiStore["cmi.core.session_time"],
          suspend_data: cmiStore["cmi.suspend_data"],
        });
        return "true";
      },
      LMSGetLastError: () => "0",
      LMSGetErrorString: () => "No error",
      LMSGetDiagnostic: () => "No error",
    };

    return () => {
      // Clean up API
      delete window.API;
    };
  }, [lessonStatus, handleTrackingSync]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setFullscreen(true);
      }).catch(err => {
        console.error("Failed to enter fullscreen:", err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setFullscreen(false);
      });
    }
  };

  const handleRefresh = () => {
    if (iframeRef.current) {
      setLoading(true);
      iframeRef.current.src = playerSrc;
    }
  };

  // Listen for SCORM status updates posted from inner ModulePlayerPage iframe
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'SCORM_MODULE_STATUS') {
        const status = event.data.status?.toLowerCase();
        if (status) setLessonStatus(status);
        const wasAlreadyCompleted = event.data?.wasAlreadyCompleted || isLessonAlreadyCompleted();
        if ((status === 'completed' || status === 'passed') && !wasAlreadyCompleted && handleMarkLessonAsCompleted) {
          handleMarkLessonAsCompleted(variantItem?.variant_item_id || variantItem?.id, true);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [variantItem, course, handleMarkLessonAsCompleted, isLessonAlreadyCompleted]);

  return (
    <div 
      ref={containerRef}
      className={`scorm-player-wrapper rounded-3 overflow-hidden shadow-sm mb-4 border ${fullscreen ? "p-0" : ""}`}
      style={{
        width: "100%",
        height: fullscreen ? "100vh" : "680px",
        display: "flex",
        flexDirection: "column",
        position: fullscreen ? "fixed" : "relative",
        top: 0,
        left: 0,
        zIndex: fullscreen ? 99999 : 1,
        backgroundColor: "#ffffff",
        borderColor: "#e2e8f0",
        padding: 0,
        margin: 0
      }}
    >
      {/* iFrame Container */}
      <div 
        className="iframe-viewport position-relative flex-grow-1 w-100 h-100 bg-white"
        style={{ display: "flex", flexDirection: "column", padding: 0, margin: 0, overflow: "hidden" }}
      >
        {loading && (
          <div 
            className="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-white"
            style={{ zIndex: 5 }}
          >
            <div className="spinner-border text-teal mb-3" style={{ color: "#0f766e" }} role="status"></div>
            <h6 className="fw-semibold text-dark mb-1">Memuat Modul E-Learning...</h6>
            <p className="text-muted small">Menginisialisasi SCORM 1.2 Run-Time Environment</p>
          </div>
        )}

        {playerSrc ? (
          <iframe
            ref={iframeRef}
            src={playerSrc}
            title={variantItem?.title || "E-Learning Player"}
            className="w-100 h-100 border-0"
            style={{ display: "block", width: "100%", height: "100%", border: 0, margin: 0, padding: 0 }}
            allow="fullscreen; autoplay"
            allowFullScreen
            onLoad={() => setLoading(false)}
          />
        ) : (
          <div className="w-100 h-100 d-flex flex-column align-items-center justify-content-center p-4 text-center">
            <i className="fas fa-exclamation-circle fa-3x text-warning mb-3"></i>
            <h6 className="fw-bold">Paket Modul Tidak Ditemukan</h6>
            <p className="text-muted small">
              File paket modul belum diekstrak atau tautan entry file tidak tersedia.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScormPlayer;
