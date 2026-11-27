import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import useAxios from "../../utils/useAxios";
import Toast from "../plugin/Toast";
import Swal from "sweetalert2";
import { getMediaUrl } from "../../utils/constants";

const ModulePlayerPage = () => {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const courseIdParam = searchParams.get("course_id") || "";
  const variantItemIdParam = searchParams.get("variant_item_id") || "";
  const [module, setModule] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lessonStatus, setLessonStatus] = useState("incomplete");
  const [score, setScore] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [resetCount, setResetCount] = useState(0);
  const [resetLimitReached, setResetLimitReached] = useState(false);
  const MAX_RESETS_PER_DAY = 3;
  const containerRef = useRef(null);
  const iframeRef = useRef(null);
  const initialStatusRef = useRef(null);

  // Fetch module detail & current progress from backend
  const fetchModuleData = useCallback(async () => {
    try {
      setLoading(true);
      const queryStr = window.location.search || "";
      const res = await useAxios.get(`api/v1/modules/${moduleId}/detail/${queryStr}`);
      if (res?.data?.module) {
        setModule(res.data.module);
        setProgress(res.data.progress);
        const status = res.data.progress?.lesson_status || "incomplete";
        setLessonStatus(status);
        setScore(res.data.progress?.score_raw || 0);
        if (initialStatusRef.current === null) {
          initialStatusRef.current = String(status).toLowerCase();
        }
        // Baca info reset harian dari backend
        if (res.data.reset_info) {
          setResetCount(res.data.reset_info.reset_count || 0);
          setResetLimitReached(res.data.reset_info.reset_limit_reached || false);
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
      course_id: courseIdParam || undefined,
      variant_item_id: variantItemIdParam || undefined,
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
            courseId: courseIdParam,
            variantItemId: variantItemIdParam,
            wasAlreadyCompleted: wasAlreadyCompleted
          }, '*');
        }

        // Only show celebratory toast if newly completed during this session
        if ((updatedStatus === "passed" || updatedStatus === "completed") && !wasAlreadyCompleted) {
          initialStatusRef.current = updatedStatus;
          const targetEl = document.fullscreenElement || containerRef.current || 'body';
          Toast().fire({
            target: targetEl,
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

  // Setup SCORM 1.2 & SCORM 2004 window.API and window.API_1484_11
  useEffect(() => {
    const cmi = {
      // SCORM 1.2
      "cmi.core.student_id": "asn_student",
      "cmi.core.student_name": "Siswa ASN",
      "cmi.core.lesson_status": lessonStatus,
      "cmi.core.score.raw": String(score || 0),
      "cmi.core.score.min": "0",
      "cmi.core.score.max": "100",
      "cmi.core.lesson_location": progress?.lesson_location || "",
      "cmi.core.session_time": "00:00:00",
      "cmi.suspend_data": progress?.suspend_data || "",
      "cmi.core.entry": progress?.lesson_location ? "resume" : "ab-initio",
      "cmi.core.exit": "",
      "cmi.core.total_time": "00:00:00",
      "cmi.core.lesson_mode": "normal",
      "cmi.core.credit": "credit",

      // SCORM 2004
      "cmi.learner_id": "asn_student",
      "cmi.learner_name": "Siswa ASN",
      "cmi.completion_status": lessonStatus === 'completed' || lessonStatus === 'passed' ? 'completed' : 'incomplete',
      "cmi.success_status": lessonStatus === 'passed' ? 'passed' : lessonStatus === 'failed' ? 'failed' : 'unknown',
      "cmi.score.raw": String(score || 0),
      "cmi.score.scaled": String((score || 0) / 100),
      "cmi.score.min": "0",
      "cmi.score.max": "100",
      "cmi.location": progress?.lesson_location || "",
      "cmi.session_time": "PT0H0M0S",
      "cmi.entry": progress?.lesson_location ? "resume" : "ab-initio",
      "cmi.exit": "",
      "cmi.total_time": "PT0H0M0S",
      "cmi.mode": "normal",
      "cmi.credit": "credit"
    };

    const broadcastStatus = (status, scr) => {
      if (typeof window !== "undefined" && window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: "SCORM_MODULE_STATUS",
          status: status,
          score: scr,
          moduleId: moduleId,
          courseId: courseIdParam,
          variantItemId: variantItemIdParam
        }, "*");
      }
    };

    window.API = {
      LMSInitialize: (param) => {
        console.log("[ModulePlayerPage SCORM 1.2] LMSInitialize:", param);
        return "true";
      },
      LMSGetValue: (element) => {
        const val = cmi[element] !== undefined ? cmi[element] : "";
        console.log(`[ModulePlayerPage SCORM 1.2] LMSGetValue(${element}) ->`, val);
        return val;
      },
      LMSSetValue: (element, value) => {
        console.log(`[ModulePlayerPage SCORM 1.2] LMSSetValue(${element}, ${value})`);
        cmi[element] = String(value);

        if (element === "cmi.core.lesson_status") {
          const newStatus = String(value).toLowerCase();
          setLessonStatus(newStatus);
          broadcastStatus(newStatus, cmi["cmi.core.score.raw"]);
        }
        if (element === "cmi.core.score.raw") {
          const newScore = Number(value) || 0;
          setScore(newScore);
          broadcastStatus(cmi["cmi.core.lesson_status"]?.toLowerCase(), newScore);
        }
        return "true";
      },
      LMSCommit: (param) => {
        console.log("[ModulePlayerPage SCORM 1.2] LMSCommit triggered");
        syncTracking(cmi);
        return "true";
      },
      LMSFinish: (param) => {
        console.log("[ModulePlayerPage SCORM 1.2] LMSFinish triggered");
        syncTracking(cmi);
        return "true";
      },
      LMSGetLastError: () => "0",
      LMSGetErrorString: () => "No error",
      LMSGetDiagnostic: () => "No error"
    };

    window.API_1484_11 = {
      Initialize: (param) => {
        console.log("[ModulePlayerPage SCORM 2004] Initialize:", param);
        return "true";
      },
      GetValue: (element) => {
        const val = cmi[element] !== undefined ? cmi[element] : "";
        console.log(`[ModulePlayerPage SCORM 2004] GetValue(${element}) ->`, val);
        return val;
      },
      SetValue: (element, value) => {
        console.log(`[ModulePlayerPage SCORM 2004] SetValue(${element}, ${value})`);
        cmi[element] = String(value);

        if (element === "cmi.completion_status" || element === "cmi.success_status") {
          const newStatus = String(value).toLowerCase();
          setLessonStatus(newStatus);
          broadcastStatus(newStatus, cmi["cmi.score.raw"]);
        }
        if (element === "cmi.score.raw") {
          const newScore = Number(value) || 0;
          setScore(newScore);
          broadcastStatus(lessonStatus, newScore);
        } else if (element === "cmi.score.scaled") {
          const newScore = Math.round((Number(value) || 0) * 100);
          setScore(newScore);
          broadcastStatus(lessonStatus, newScore);
        }
        return "true";
      },
      Commit: (param) => {
        console.log("[ModulePlayerPage SCORM 2004] Commit triggered");
        syncTracking(cmi);
        return "true";
      },
      Terminate: (param) => {
        console.log("[ModulePlayerPage SCORM 2004] Terminate triggered");
        syncTracking(cmi);
        return "true";
      },
      GetLastError: () => "0",
      GetErrorString: () => "No error",
      GetDiagnostic: () => "No error"
    };

    const handleBeforeUnload = () => {
      syncTracking(cmi, true);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      delete window.API;
      delete window.API_1484_11;
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

  // Reset module tracking to start over from the beginning
  const handleResetModule = async () => {
    // Cek batas reset di sisi client sebelum lanjut
    if (resetLimitReached) {
      const targetElement = document.fullscreenElement || containerRef.current || 'body';
      await Swal.fire({
        target: targetElement,
        title: "Batas Reset Tercapai",
        text: `Anda telah mencapai batas maksimum 3 kali reset per hari untuk materi ini. Coba lagi besok.`,
        icon: "warning",
        confirmButtonColor: "#0f766e",
        confirmButtonText: "Mengerti"
      });
      return;
    }

    // When in fullscreen mode, target must be inside the fullscreen element (containerRef.current)
    // so that SweetAlert2 renders within the browser's top-layer fullscreen container.
    const targetElement = document.fullscreenElement || containerRef.current || 'body';

    const result = await Swal.fire({
      target: targetElement,
      title: "Mulai Ulang Materi?",
      text: `Progress dan status materi SCORM ini akan direset dari awal sehingga Anda dapat mempelajarinya kembali. (Reset ke-${resetCount + 1} dari ${MAX_RESETS_PER_DAY} hari ini)`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#0f766e",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Ya, Mulai Ulang",
      cancelButtonText: "Batal",
      reverseButtons: true
    });

    if (!result.isConfirmed) return;

    try {
      setSyncing(true);
      let resetResponse = null;

      try {
        const res = await useAxios.post(`api/v1/modules/${moduleId}/reset/`, {
          course_id: courseIdParam,
          variant_item_id: variantItemIdParam
        });
        resetResponse = res.data;
      } catch (e) {
        // Tangani 429 Too Many Requests (batas reset harian)
        if (e.response?.status === 429) {
          const errData = e.response.data;
          setResetCount(errData?.reset_count || MAX_RESETS_PER_DAY);
          setResetLimitReached(true);
          await Swal.fire({
            target: targetElement,
            title: "Batas Reset Tercapai",
            text: errData?.error || "Anda telah mencapai batas maksimum 3 kali reset per hari untuk materi ini.",
            icon: "warning",
            confirmButtonColor: "#0f766e",
            confirmButtonText: "Mengerti"
          });
          return;
        }
        // Fallback ke tracking endpoint jika endpoint reset belum ada respon lain
        await useAxios.post(`api/v1/modules/${moduleId}/tracking/`, {
          lesson_status: "incomplete",
          score_raw: 0,
          lesson_location: "",
          session_time: "00:00:00",
          suspend_data: "",
          course_id: courseIdParam || undefined,
          variant_item_id: variantItemIdParam || undefined
        });
      }

      // Update info reset count dari response backend
      if (resetResponse?.reset_count !== undefined) {
        setResetCount(resetResponse.reset_count);
        setResetLimitReached(resetResponse.resets_remaining <= 0);
      }

      // Update state lokal — JANGAN reset score agar badge di sidebar tidak berubah ke 0
      setLessonStatus("incomplete");
      // Sengaja TIDAK setScore(0) agar badge skor di sidebar tetap menampilkan skor terakhir
      initialStatusRef.current = "incomplete";
      setProgress(prev => ({
        ...(prev || {}),
        lesson_status: "incomplete",
        lesson_location: "",
        session_time: "00:00:00",
        suspend_data: ""
        // score_raw TIDAK diubah — tetap mempertahankan nilai terakhir
      }));

      // Beritahu parent iframe dengan tipe KHUSUS SCORM_MODULE_RESET
      // agar parent TIDAK memperbarui badge skor (hanya refresh data course)
      if (typeof window !== "undefined" && window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: "SCORM_MODULE_RESET",
          moduleId: moduleId,
          courseId: courseIdParam,
          variantItemId: variantItemIdParam,
          action: "reset"
        }, "*");
      }

      // Muat ulang iframe konten SCORM dari awal dengan parameter penangkal cache
      if (iframeRef.current && module?.player_url) {
        const baseUrl = getMediaUrl(module.player_url);
        const sep = baseUrl.includes("?") ? "&" : "?";
        iframeRef.current.src = `${baseUrl}${sep}_reset=${Date.now()}`;
      }

      const resetsLeft = resetResponse?.resets_remaining ?? (MAX_RESETS_PER_DAY - (resetResponse?.reset_count || resetCount + 1));
      Toast().fire({
        target: targetElement,
        icon: "success",
        title: "Modul Direset",
        text: resetsLeft > 0
          ? `Materi SCORM telah dimulai kembali dari awal. Sisa reset hari ini: ${resetsLeft} kali.`
          : "Materi SCORM telah dimulai kembali dari awal. Anda telah mencapai batas reset harian.",
        timer: 4000
      });
    } catch (err) {
      console.error("[ModulePlayerPage] Error resetting module:", err);
      Toast().fire({
        target: targetElement,
        icon: "error",
        title: "Gagal Mereset Modul",
        text: "Terjadi kesalahan saat memulai ulang materi."
      });
    } finally {
      setSyncing(false);
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
      className="module-player-page-container position-relative d-flex flex-column vh-100 bg-white text-dark overflow-hidden"
    >
      {/* Top Navbar */}
      <header 
        className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom border-secondary"
        style={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", minHeight: "52px", zIndex: 100 }}
      >
        <div className="d-flex align-items-center gap-2 overflow-hidden">
          <button
            type="button"
            className="btn btn-sm btn-light border text-slate-700 d-flex align-items-center gap-1 py-1 px-2.5 me-1"
            style={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1", color: "#334155" }}
            onClick={() => {
              if (isEmbedded) {
                if (typeof window !== "undefined" && window.parent && window.parent !== window) {
                  window.parent.postMessage({ type: "SCORM_CLOSE_PLAYER" }, "*");
                }
              } else if (window.history.length > 1) {
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

          {/* Tombol Reset Modul */}
          <button
            type="button"
            className={`btn btn-sm ${
              resetLimitReached
                ? "btn-secondary"
                : lessonStatus === "failed" 
                  ? "btn-danger text-white shadow-sm" 
                  : "btn-light border"
            } py-1 px-2.5 d-flex align-items-center gap-1`}
            style={
              resetLimitReached
                ? { backgroundColor: "#94a3b8", borderColor: "#64748b", color: "#ffffff", cursor: "not-allowed", opacity: 0.65 }
                : lessonStatus === "failed"
                  ? { backgroundColor: "#dc2626", borderColor: "#b91c1c", fontWeight: 600 }
                  : { backgroundColor: "#ffffff", borderColor: "#cbd5e1", color: "#334155" }
            }
            onClick={handleResetModule}
            disabled={resetLimitReached || syncing}
            title={
              resetLimitReached
                ? `Batas reset harian tercapai (${MAX_RESETS_PER_DAY}/${MAX_RESETS_PER_DAY}). Coba lagi besok.`
                : `Reset & Mulai Kembali Materi SCORM dari Awal (${resetCount}/${MAX_RESETS_PER_DAY} reset hari ini)`
            }
          >
            <i className="fas fa-undo"></i>
            <span>Reset</span>
            {!resetLimitReached && (
              <span
                className="badge rounded-pill ms-1"
                style={{ 
                  backgroundColor: resetCount >= 2 ? "#fef2f2" : "#f0fdf4",
                  color: resetCount >= 2 ? "#dc2626" : "#15803d",
                  border: `1px solid ${resetCount >= 2 ? "#fecaca" : "#bbf7d0"}`,
                  fontSize: "10px",
                  fontWeight: 600,
                  padding: "2px 6px"
                }}
              >
                {MAX_RESETS_PER_DAY - resetCount}x
              </span>
            )}
          </button>

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
