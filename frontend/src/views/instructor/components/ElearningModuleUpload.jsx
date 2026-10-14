import React, { useState, useRef, useEffect } from "react";
import Toast from "../../plugin/Toast";
import useAxios from "../../../utils/useAxios";
import { getMediaUrl } from "../../../utils/constants";

const ElearningModuleUpload = ({ courseData, setCourseData, onModuleUploaded, onModuleDeleted }) => {
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [validationError, setValidationError] = useState("");
  const fileInputRef = useRef(null);

  // State untuk Pemutar Interaktif Inline
  const [showPlayer, setShowPlayer] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playerStatus, setPlayerStatus] = useState("not attempted");
  const [playerScore, setPlayerScore] = useState(null);
  const playerContainerRef = useRef(null);
  const iframeRef = useRef(null);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const CONFIG = {
    MAX_SIZE: 500 * 1024 * 1024, // 500MB
    ALLOWED_EXTENSIONS: [".zip", ".h5p"],
  };

  const currentModule = courseData?.learning_module_info || (courseData?.learning_module_id ? {
    id: courseData.learning_module_id,
    judul: courseData.learning_module_title || "Paket Modul E-Learning",
    module_type: courseData.course_type || "scorm_12",
    player_url: courseData.learning_module_url,
    entry_file: courseData.learning_module_entry || "index.html"
  } : null);

  const playerUrl = currentModule?.player_url 
    ? getMediaUrl(currentModule.player_url)
    : (currentModule?.id ? getMediaUrl(`/media/learning_modules/extracted_${currentModule.id}/${currentModule.entry_file || 'index.html'}`) : "");

  // SCORM 1.2 RTE API bridge untuk pengujian langsung oleh instruktur
  useEffect(() => {
    if (!showPlayer) return;

    const cmi = {
      "cmi.core.student_id": "instructor_preview",
      "cmi.core.student_name": "Instruktur Penguji",
      "cmi.core.lesson_status": playerStatus,
      "cmi.core.score.raw": playerScore !== null ? String(playerScore) : "0",
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
        console.log("[Inline SCORM RTE] LMSInitialize:", param);
        return "true";
      },
      LMSGetValue: (element) => {
        const val = cmi[element] !== undefined ? cmi[element] : "";
        console.log(`[Inline SCORM RTE] LMSGetValue(${element}) ->`, val);
        return val;
      },
      LMSSetValue: (element, value) => {
        console.log(`[Inline SCORM RTE] LMSSetValue(${element}, ${value})`);
        cmi[element] = String(value);
        if (element === "cmi.core.lesson_status") {
          setPlayerStatus(String(value).toLowerCase());
        }
        if (element === "cmi.core.score.raw") {
          setPlayerScore(Number(value) || 0);
        }
        return "true";
      },
      LMSCommit: (param) => {
        console.log("[Inline SCORM RTE] LMSCommit:", param);
        return "true";
      },
      LMSFinish: (param) => {
        console.log("[Inline SCORM RTE] LMSFinish:", param);
        return "true";
      },
      LMSGetLastError: () => "0",
      LMSGetErrorString: () => "No error",
      LMSGetDiagnostic: () => "No error"
    };

    return () => {
      delete window.API;
    };
  }, [showPlayer, playerStatus, playerScore]);

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleReloadPlayer = () => {
    if (iframeRef.current && playerUrl) {
      const currentSrc = iframeRef.current.src;
      iframeRef.current.src = "about:blank";
      setTimeout(() => {
        if (iframeRef.current) iframeRef.current.src = currentSrc;
      }, 50);
    }
  };

  const validateFile = (file) => {
    if (!file) return { isValid: false, error: "File modul diperlukan." };

    if (file.size > CONFIG.MAX_SIZE) {
      return { isValid: false, error: "Ukuran paket melebihi batas maksimal 500MB." };
    }

    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!CONFIG.ALLOWED_EXTENSIONS.includes(ext)) {
      return {
        isValid: false,
        error: `Format file tidak didukung (${ext}). Harap gunakan paket SCORM (.zip) atau H5P (.h5p).`
      };
    }

    return { isValid: true, ext };
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateFile(file);
    if (!validation.isValid) {
      setValidationError(validation.error);
      if (fileInputRef.current) fileInputRef.current.value = "";
      Toast().fire({
        icon: "error",
        title: validation.error,
      });
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    setStatusMessage("Mengunggah paket modul...");
    setValidationError("");

    // Jika sebelumnya sudah ada modul yang diupload pada draf ini, hapus dulu agar tidak menjadi file yatim (orphan)
    if (currentModule?.id) {
      try {
        await useAxios.delete(`api/v1/modules/${currentModule.id}/detail/`);
      } catch (err) {
        console.warn("[ElearningModuleUpload] Cleanup previous module:", err);
      }
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const moduleType = validation.ext === ".h5p" ? "h5p" : "scorm_12";
      formData.append("module_type", moduleType);

      if (courseData?.title) {
        formData.append("title", courseData.title);
      }
      if (courseData?.course_id) {
        formData.append("course_id", courseData.course_id);
      }

      const response = await useAxios.post("teacher/upload-elearning-module/", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
          if (percent === 100) {
            setStatusMessage("Mengekstrak paket & memvalidasi manifest di server...");
          }
        },
      });

      if (response?.data?.module_id) {
        const mod = response.data.module;
        setCourseData(prev => ({
          ...prev,
          learning_module_id: mod.id,
          learning_module_title: mod.judul,
          course_type: mod.module_type,
          learning_module_url: response.data.player_url,
          learning_module_entry: response.data.entry_file,
          learning_module_info: mod,
          title: prev.title || mod.judul,
        }));

        Toast().fire({
          icon: "success",
          title: "Modul Berhasil Diunggah!",
          text: `Paket ${mod.module_type === 'h5p' ? 'H5P' : 'SCORM 1.2'} telah berhasil diekstrak dan siap dipelajari.`,
          timer: 3500
        });

        if (onModuleUploaded) {
          onModuleUploaded(mod);
        }
      }
    } catch (error) {
      console.error("[ElearningModuleUpload] Error uploading:", error);
      const errMsg = error.response?.data?.error || "Gagal mengunggah dan memproses paket modul.";
      setValidationError(errMsg);
      Toast().fire({
        icon: "error",
        title: "Gagal Mengunggah Modul",
        text: errMsg
      });
    } finally {
      setLoading(false);
      setUploadProgress(0);
      setStatusMessage("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveModule = async () => {
    const prevId = currentModule?.id;
    if (prevId) {
      try {
        await useAxios.delete(`api/v1/modules/${prevId}/detail/`);
      } catch (err) {
        console.warn("[ElearningModuleUpload] Cleanup module error:", err);
      }
    }

    setCourseData(prev => ({
      ...prev,
      learning_module_id: null,
      learning_module_title: "",
      learning_module_url: "",
      learning_module_entry: "",
      learning_module_info: null,
      course_type: "standard"
    }));

    if (onModuleDeleted) {
      onModuleDeleted();
    }

    Toast().fire({
      icon: "info",
      title: "Modul Dihapus & Berkas Dibersihkan",
      text: "Berkas modul telah dihapus dari server penyimpanan.",
      timer: 2500
    });
  };


  return (
    <div className="elearning-module-upload-container p-3 rounded-3 border bg-light mb-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h6 className="mb-1 fw-bold text-dark d-flex align-items-center gap-2">
            <i className="fas fa-cubes text-teal" style={{ color: "#0f766e" }}></i>
            Paket Modul E-Learning (SCORM 1.2 / H5P)
          </h6>
          <p className="text-muted small mb-0">
            Dukung modul interaktif terstandar SCORM 1.2 atau paket H5P (maksimal 500MB).
          </p>
        </div>
        <span className="badge" style={{ backgroundColor: "#0f766e", color: "#fff" }}>
          Seamless Tracking RTE
        </span>
      </div>

      {currentModule ? (
        <>
          <div className="card border-success shadow-sm">
          <div className="card-body p-3">
            <div className="d-flex align-items-start justify-content-between gap-3">
              <div className="d-flex align-items-center gap-3">
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center"
                  style={{
                    width: "52px",
                    height: "52px",
                    backgroundColor: currentModule.module_type === "h5p" ? "#fef3c7" : "#e0f2fe",
                    color: currentModule.module_type === "h5p" ? "#d97706" : "#0284c7",
                    fontSize: "24px"
                  }}
                >
                  <i className={currentModule.module_type === "h5p" ? "fas fa-puzzle-piece" : "fas fa-cubes"}></i>
                </div>
                <div>
                  <h6 className="mb-1 fw-bold text-dark">
                    {currentModule.judul || "Modul E-Learning Terunggah"}
                  </h6>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <span className="badge bg-primary text-uppercase">
                      {currentModule.module_type === "h5p" ? "H5P Interactive" : "SCORM 1.2"}
                    </span>
                    <span className="badge bg-secondary">
                      Entry: {currentModule.entry_file || "index.html"}
                    </span>
                    <span className="text-success small fw-semibold">
                      <i className="fas fa-check-circle me-1"></i>
                      Siap Diputar & Terlacak
                    </span>
                  </div>
                </div>
              </div>

              <div className="d-flex align-items-center gap-2">
                {currentModule.id && (
                  <button
                    type="button"
                    className="btn btn-sm text-white fw-semibold d-inline-flex align-items-center gap-1.5 shadow-sm px-3 py-1.5"
                    style={{
                      backgroundColor: showPlayer ? "#334155" : "#0284c7",
                      borderColor: showPlayer ? "#334155" : "#0284c7",
                      color: "#ffffff",
                      gap: "6px"
                    }}
                    onClick={() => setShowPlayer(prev => !prev)}
                    title={showPlayer ? "Tutup Pemutar Pratinjau" : "Uji Putar Langsung di Halaman Ini"}
                  >
                    <i className={showPlayer ? "fas fa-chevron-up" : "fas fa-play"} style={{ color: "#ffffff", fontSize: "12px" }}></i>
                    <span style={{ color: "#ffffff", fontWeight: 600 }}>{showPlayer ? "Tutup Pemutar" : "Uji Putar"}</span>
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-sm text-white fw-semibold d-inline-flex align-items-center gap-1.5 shadow-sm px-3 py-1.5"
                  style={{
                    backgroundColor: "#dc2626",
                    borderColor: "#dc2626",
                    color: "#ffffff",
                    gap: "5px"
                  }}
                  onClick={handleRemoveModule}
                  title="Hapus modul dari kursus ini"
                >
                  <i className="fas fa-trash-alt" style={{ color: "#ffffff", fontSize: "12px" }}></i>
                  <span style={{ color: "#ffffff" }}>Ganti</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Pratinjau Interaktif Player Inline */}
        {showPlayer && currentModule && (
          <div 
            ref={playerContainerRef} 
            className="mt-3 rounded-3 overflow-hidden shadow-sm border bg-white"
            style={{ borderColor: "#cbd5e1" }}
          >
            {/* Topbar Kontrol Player */}
            <div 
              className="px-3 py-2.5 d-flex flex-wrap align-items-center justify-content-between gap-2 border-bottom"
              style={{ backgroundColor: "#0f172a", color: "#f8fafc" }}
            >
              <div className="d-flex align-items-center gap-2">
                <span 
                  className="badge d-inline-flex align-items-center gap-1.5 px-2.5 py-1"
                  style={{ backgroundColor: "#0f766e", color: "#ffffff", fontSize: "11px" }}
                >
                  <i className="fas fa-play-circle"></i>
                  <span>Uji Putar Langsung</span>
                </span>
                <span className="fw-semibold text-truncate small text-white" style={{ maxWidth: "340px" }} title={currentModule.judul}>
                  {currentModule.judul}
                </span>
              </div>

              <div className="d-flex align-items-center gap-2">
                {/* Status Tracking Real-time */}
                <span 
                  className="badge px-2.5 py-1 text-uppercase"
                  style={{ 
                    backgroundColor: playerStatus === "passed" || playerStatus === "completed" 
                      ? "#16a34a" 
                      : playerStatus === "failed" 
                      ? "#dc2626" 
                      : "#ca8a04",
                    color: "#ffffff",
                    fontSize: "11px"
                  }}
                >
                  Status: {playerStatus} {playerScore !== null ? `• Skor: ${playerScore}` : ""}
                </span>

                {/* Muat Ulang */}
                <button
                  type="button"
                  className="btn btn-sm text-light p-1"
                  onClick={handleReloadPlayer}
                  title="Muat Ulang Modul (Restart)"
                  style={{ background: "transparent", border: "none" }}
                >
                  <i className="fas fa-redo"></i>
                </button>

                {/* Layar Penuh */}
                <button
                  type="button"
                  className="btn btn-sm text-light p-1"
                  onClick={toggleFullscreen}
                  title={isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
                  style={{ background: "transparent", border: "none" }}
                >
                  <i className={isFullscreen ? "fas fa-compress" : "fas fa-expand"}></i>
                </button>

                {/* Buka Tab Baru (Opsi Tambahan) */}
                <a
                  href={`/modules/${currentModule.id}/player/`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-sm text-light p-1"
                  title="Buka di Tab Baru"
                  style={{ textDecoration: "none" }}
                >
                  <i className="fas fa-external-link-alt"></i>
                </a>

                {/* Tutup Pemutar */}
                <button
                  type="button"
                  className="btn btn-sm text-danger p-1 ms-1"
                  onClick={() => setShowPlayer(false)}
                  title="Tutup Pemutar"
                  style={{ background: "transparent", border: "none" }}
                >
                  <i className="fas fa-times-circle fs-5"></i>
                </button>
              </div>
            </div>

            {/* Iframe SCORM Player */}
            <div className="position-relative" style={{ height: isFullscreen ? "calc(100vh - 46px)" : "580px", minHeight: "450px", backgroundColor: "#ffffff" }}>
              <iframe
                ref={iframeRef}
                src={playerUrl}
                title={`Pratinjau Modul ${currentModule.judul}`}
                className="w-100 h-100 border-0"
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              />
            </div>
          </div>
        )}
        </>
      ) : (
        <div className="upload-dropzone p-4 text-center border border-2 border-dashed rounded-3 bg-white d-flex flex-column align-items-center justify-content-center">
          <input
            ref={fileInputRef}
            type="file"
            className="d-none"
            accept=".zip,.h5p"
            onChange={handleFileUpload}
            disabled={loading}
          />

          <div className="mb-3">
            <i
              className="fas fa-cloud-upload-alt fa-3x"
              style={{ color: loading ? "#0f766e" : "#94a3b8" }}
            ></i>
          </div>

          <h6 className="fw-semibold mb-1 text-center">
            {loading ? statusMessage : "Pilih atau Tarik File Paket (.zip / .h5p)"}
          </h6>
          <p className="text-muted small mb-3 text-center">
            Ekstraksi otomatis dilakukan di server untuk paket standar SCORM 1.2 (imsmanifest.xml) atau H5P.
          </p>

          {loading ? (
            <div className="w-75 mx-auto">
              <div className="progress mb-2" style={{ height: "10px" }}>
                <div
                  className="progress-bar progress-bar-striped progress-bar-animated bg-teal"
                  role="progressbar"
                  style={{ width: `${uploadProgress}%`, backgroundColor: "#0f766e" }}
                ></div>
              </div>
              <small className="text-muted fw-semibold">
                {uploadProgress < 100 ? `Mengunggah: ${uploadProgress}%` : "Mengekstrak paket..."}
              </small>
            </div>
          ) : (
            <div className="d-flex justify-content-center align-items-center w-100 mt-2">
              <button
                type="button"
                className="btn btn-teal text-white px-4 py-2 fw-semibold shadow-sm d-inline-flex align-items-center justify-content-center mx-auto"
                style={{ backgroundColor: "#0f766e", borderColor: "#0f766e", color: "#ffffff" }}
                onClick={() => fileInputRef.current?.click()}
              >
                <i className="fas fa-folder-open me-2" style={{ color: "#ffffff" }}></i>
                <span style={{ color: "#ffffff" }}>Pilih File Paket (Max 500MB)</span>
              </button>
            </div>
          )}

          {validationError && (
            <div className="alert alert-danger mt-3 mb-0 small text-start">
              <i className="fas fa-exclamation-triangle me-2"></i>
              {validationError}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ElearningModuleUpload;
