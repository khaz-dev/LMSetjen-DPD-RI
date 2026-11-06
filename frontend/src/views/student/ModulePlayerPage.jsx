import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useAxios from "../../utils/useAxios";
import Toast from "../plugin/Toast";
import { getMediaUrl } from "../../utils/constants";

const ModulePlayerPage = () => {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const [module, setModule] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lessonStatus, setLessonStatus] = useState("incomplete");
  const [score, setScore] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);
  const iframeRef = useRef(null);
  const initialStatusRef = useRef(null);

  // Fetch module detail & current progress from backend
  const fetchModuleData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await useAxios.get(`api/v1/modules/${moduleId}/detail/`);
      if (res?.data?.module) {
        setModule(res.data.module);
        setProgress(res.data.progress);
        const status = res.data.progress?.lesson_status || "incomplete";
        setLessonStatus(status);
        setScore(res.data.progress?.score_raw || 0);
        if (initialStatusRef.current === null) {
          initialStatusRef.current = String(status).toLowerCase();
        }
      }
    } catch (err) {
      console.error("[ModulePlayerPage] Error fetching module:", err);
      Toast().fire({
        icon: "error",
        title: "Gagal Memuat Modul",
        text: err.response?.data?.error || "Modul tidak ditemukan atau sesi telah berakhir."
      });
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  // Remove global 60px navbar padding from index.html inside the module player window
  useEffect(() => {
    document.body.classList.add("module-player-active");
    document.body.style.setProperty("padding-top", "0px", "important");
    document.body.style.setProperty("margin", "0px", "important");

    return () => {
      document.body.classList.remove("module-player-active");
      document.body.style.removeProperty("padding-top");
      document.body.style.removeProperty("margin");
    };
  }, []);

  useEffect(() => {
    fetchModuleData();
  }, [fetchModuleData]);

  // Sync SCORM tracking data to backend
  const syncTracking = useCallback(async (cmiData, isBeacon = false) => {
    if (!moduleId) return;
    setSyncing(true);

    const payload = {
      lesson_status: cmiData["cmi.core.lesson_status"],
      score_raw: cmiData["cmi.core.score.raw"],
      lesson_location: cmiData["cmi.core.lesson_location"],
      session_time: cmiData["cmi.core.session_time"],
      suspend_data: cmiData["cmi.suspend_data"],
    };

    try {
      const res = await useAxios.post(`api/v1/modules/${moduleId}/tracking/`, payload);
      if (res?.data?.lesson_status) {
        const updatedStatus = res.data.lesson_status.toLowerCase();
        setLessonStatus(updatedStatus);
        if (cmiData["cmi.core.score.raw"] !== undefined) {
          setScore(Number(cmiData["cmi.core.score.raw"]) || 0);
        }

        const wasAlreadyCompleted = 
          initialStatusRef.current === "passed" || 
          initialStatusRef.current === "completed" ||
          res?.data?.is_newly_completed === false;

        // Notify parent iframe container (e.g. CourseDetail / ScormPlayer)
        if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: 'SCORM_MODULE_STATUS',
            status: updatedStatus,
            score: cmiData["cmi.core.score.raw"],
            moduleId: moduleId,
            wasAlreadyCompleted: wasAlreadyCompleted
          }, '*');
        }

        // Only show celebratory toast if newly completed during this session
        if ((updatedStatus === "passed" || updatedStatus === "completed") && !wasAlreadyCompleted) {
          initialStatusRef.current = updatedStatus;
          Toast().fire({
            icon: "success",
            title: "Selamat!",
            text: `Modul telah selesai dengan status: ${updatedStatus.toUpperCase()}`,
            timer: 3500
          });
        }
      }
    } catch (err) {
      console.error("[ModulePlayerPage] Tracking sync error:", err);
    } finally {
      setSyncing(false);
    }
  }, [moduleId]);

  // Setup SCORM 1.2 window.API
  useEffect(() => {
    const cmi = {
      "cmi.core.student_id": "asn_student",
      "cmi.core.lesson_status": lessonStatus,
      "cmi.core.score.raw": String(score || 0),
      "cmi.core.lesson_location": progress?.lesson_location || "",
      "cmi.core.session_time": "00:00:00",
      "cmi.suspend_data": progress?.suspend_data || "",
      "cmi.core.entry": progress?.lesson_location ? "resume" : "ab-initio",
      "cmi.core.exit": "",
      "cmi.core.total_time": "00:00:00",
      "cmi.core.lesson_mode": "normal"
    };

    window.API = {
      LMSInitialize: (param) => {
        console.log("[ModulePlayerPage SCORM] LMSInitialize:", param);
        return "true";
      },
      LMSGetValue: (element) => {
        const val = cmi[element] !== undefined ? cmi[element] : "";
        console.log(`[ModulePlayerPage SCORM] LMSGetValue(${element}) ->`, val);
        return val;
      },
      LMSSetValue: (element, value) => {
        console.log(`[ModulePlayerPage SCORM] LMSSetValue(${element}, ${value})`);
        cmi[element] = String(value);

        if (element === "cmi.core.lesson_status") {
          setLessonStatus(String(value).toLowerCase());
        }
        if (element === "cmi.core.score.raw") {
          setScore(Number(value) || 0);
        }
        return "true";
      },
      LMSCommit: (param) => {
        console.log("[ModulePlayerPage SCORM] LMSCommit triggered");
        syncTracking(cmi);
        return "true";
      },
      LMSFinish: (param) => {
        console.log("[ModulePlayerPage SCORM] LMSFinish triggered");
        syncTracking(cmi);
        return "true";
      },
      LMSGetLastError: () => "0",
      LMSGetErrorString: () => "No error",
      LMSGetDiagnostic: () => "No error"
    };

    const handleBeforeUnload = () => {
      syncTracking(cmi, true);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      delete window.API;
    };
  }, [lessonStatus, score, progress, syncTracking]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  const handleRefresh = () => {
    if (iframeRef.current && module?.player_url) {
      iframeRef.current.src = getMediaUrl(module.player_url);
    }
  };

  const isEmbedded = typeof window !== 'undefined' && window.self !== window.top;

  const getStatusBadgeClass = () => {
    switch (lessonStatus) {
      case "passed":
      case "completed":
        return "bg-success text-white";
      case "failed":
        return "bg-danger text-white";
      case "incomplete":
        return "bg-warning text-dark";
      default:
        return "bg-secondary text-white";
    }
  };

  const rawUrl = module?.player_url ? getMediaUrl(module.player_url) : "";

  return (
    <div 
      ref={containerRef}
      className="module-player-page-container d-flex flex-column vh-100 bg-white text-dark overflow-hidden"
    >
      {/* Top Navbar */}
      <header 
        className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom border-secondary"
        style={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", minHeight: "52px", zIndex: 100 }}
      >
        <div className="d-flex align-items-center gap-2 overflow-hidden">
          {!isEmbedded && (
            <button
              type="button"
              className="btn btn-sm btn-light border text-slate-700 d-flex align-items-center gap-1 py-1 px-2.5 me-1"
              style={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1", color: "#334155" }}
              onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate("/student/courses/");
                }
              }}
              title="Kembali"
            >
              <i className="fas fa-arrow-left"></i>
              <span className="d-none d-sm-inline">Kembali</span>
            </button>
          )}

          <span 
            className="badge px-2 py-1 text-uppercase text-white"
            style={{ backgroundColor: "#0f766e", fontSize: "11px", letterSpacing: "0.5px" }}
          >
            <i className="fas fa-cubes me-1"></i>
            {module?.module_type === "h5p" ? "H5P Interactive" : "SCORM 1.2"}
          </span>

          <h6 className="mb-0 text-truncate fw-semibold" style={{ maxWidth: "450px", color: "#1e293b" }}>
            {module?.judul || "Memuat Modul E-Learning..."}
          </h6>

          <span className={`badge ms-2 text-capitalize ${getStatusBadgeClass()}`}>
            {lessonStatus}
          </span>

          {score > 0 && (
            <span 
              className="badge ms-1 d-flex align-items-center gap-1 border"
              style={{ backgroundColor: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" }}
            >
              <i className="fas fa-star text-warning"></i>
              <span>Nilai: {score}</span>
            </span>
          )}
        </div>

        <div className="d-flex align-items-center gap-2">
          {syncing && (
            <span className="small d-flex align-items-center gap-1.5 me-2" style={{ color: "#0f766e" }}>
              <span className="spinner-border spinner-border-sm" role="status"></span>
              Menyimpan...
            </span>
          )}

          <button
            type="button"
            className="btn btn-sm btn-light border py-1 px-2.5"
            style={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1", color: "#334155" }}
            onClick={handleRefresh}
            title="Muat Ulang Modul"
          >
            <i className="fas fa-redo me-1"></i>
            <span className="d-none d-md-inline">Muat Ulang</span>
          </button>

          <button
            type="button"
            className="btn btn-sm btn-light border py-1 px-2.5"
            style={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1", color: "#334155" }}
            onClick={toggleFullscreen}
            title={isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
          >
            <i className={isFullscreen ? "fas fa-compress me-1" : "fas fa-expand me-1"}></i>
            <span className="d-none d-md-inline">{isFullscreen ? "Keluar Fullscreen" : "Fullscreen"}</span>
          </button>
        </div>
      </header>

      {/* Main Player Iframe Area */}
      <main className="flex-grow-1 position-relative bg-white">
        {loading ? (
          <div className="d-flex flex-column align-items-center justify-content-center h-100 bg-light text-dark">
            <div className="spinner-border text-teal mb-3" style={{ color: "#0f766e" }} role="status"></div>
            <h5 className="fw-semibold mb-1">Memuat Modul E-Learning...</h5>
            <p className="text-muted small">Menginisialisasi SCORM 1.2 Run-Time Environment</p>
          </div>
        ) : rawUrl ? (
          <iframe
            ref={iframeRef}
            src={rawUrl}
            title={module?.judul || "E-Learning Player"}
            className="w-100 h-100 border-0"
            allow="fullscreen; autoplay"
            allowFullScreen
          />
        ) : (
          <div className="d-flex flex-column align-items-center justify-content-center h-100 p-4 text-center text-dark">
            <i className="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
            <h5 className="fw-bold">Paket Modul Tidak Tersedia</h5>
            <p className="text-muted small mb-3">
              Paket modul belum berhasil diekstrak atau file entry tidak ditemukan di server.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate(-1)}
            >
              Kembali ke Halaman Sebelumnya
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default ModulePlayerPage;
