import React from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { getImageUrl } from "../../../utils/courseUtils";
import "./CourseInstructor.css";

const CourseInstructor = ({ teacher, courseCount = 0 }) => {
    const navigate = useNavigate();
    if (!teacher) return null;

    const handleContactClick = () => {
        Swal.fire({
            icon: "info",
            title: "Fitur Mengirim Pesan",
            text: "Fitur pengiriman pesan masih dalam pengembangan. Hubungi instruktur melalui halaman profil mereka.",
            confirmButtonColor: "#0d9488"
        });
    };

    const handleViewProfile = () => {
        if (teacher.id) {
            navigate(`/instructor-profile/${teacher.id}/`);
        } else {
            Swal.fire({
                icon: "warning",
                title: "Informasi Tidak Tersedia",
                text: "ID instruktur tidak ditemukan.",
                confirmButtonColor: "#0d9488"
            });
        }
    };

    return (
        <div className="card border-0 shadow-xs rounded-3 bg-white overflow-hidden mb-3">
            <div className="card-body p-3 p-md-4">
                {/* Header */}
                <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                    <div className="d-flex align-items-center gap-2">
                        <div
                            className="rounded-2 d-flex align-items-center justify-content-center text-white flex-shrink-0"
                            style={{ width: "28px", height: "28px", background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)" }}
                        >
                            <i className="fas fa-chalkboard-user" style={{ fontSize: "0.8rem" }}></i>
                        </div>
                        <h5 className="mb-0 fw-bold text-dark" style={{ fontSize: "0.98rem" }}>
                            Profil & Informasi Instruktur
                        </h5>
                    </div>
                    <span className="badge bg-teal-subtle text-teal border border-teal-subtle py-1 px-2 rounded-pill small">
                        <i className="fas fa-certificate me-1"></i>Instruktur Terverifikasi
                    </span>
                </div>

                {/* Profile Top Row: Avatar, Info, Actions & Stats */}
                <div className="p-3 p-md-3 rounded-3 bg-light border mb-3">
                    <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-3">
                        {/* Avatar & Name Info */}
                        <div className="d-flex align-items-center gap-3 min-w-0 flex-grow-1">
                            <div className="position-relative flex-shrink-0">
                                <img
                                    src={getImageUrl(teacher.image) || '/images/placeholders/default-instructor.svg'}
                                    alt={teacher.full_name}
                                    className="rounded-circle border shadow-xs"
                                    style={{ width: "56px", height: "56px", objectFit: "cover" }}
                                    onError={(e) => { e.target.src = '/images/placeholders/default-instructor.svg'; }}
                                />
                                <div
                                    className="position-absolute bottom-0 end-0 rounded-circle text-white d-flex align-items-center justify-content-center"
                                    style={{
                                        width: "18px",
                                        height: "18px",
                                        background: "#10b981",
                                        border: "2px solid #fff",
                                        fontSize: "0.55rem"
                                    }}
                                    title="Terverifikasi"
                                >
                                    <i className="fas fa-check"></i>
                                </div>
                            </div>

                            <div className="min-w-0 flex-grow-1">
                                <h6 className="mb-1 fw-bold text-dark text-truncate" style={{ fontSize: "0.95rem" }}>
                                    {teacher.full_name}
                                </h6>
                                <p className="text-muted small mb-0 text-truncate" style={{ fontSize: "0.82rem" }}>
                                    {teacher.about || teacher.bio || "Instruktur Profesional di Lingkungan Setjen DPD RI"}
                                </p>
                            </div>
                        </div>

                        {/* Action Buttons - Always visible without overflowing */}
                        <div className="d-flex align-items-center gap-2 flex-shrink-0 w-100 w-sm-auto justify-content-sm-end">
                            <button
                                className="btn btn-sm btn-outline-teal d-flex align-items-center justify-content-center gap-1.5 rounded-2 py-1.5 px-3 fw-semibold flex-fill flex-sm-grow-0"
                                onClick={handleContactClick}
                                type="button"
                                style={{ fontSize: "0.8rem", borderColor: "#0d9488", color: "#0d9488" }}
                            >
                                <i className="fas fa-envelope"></i>
                                <span>Kirim Pesan</span>
                            </button>
                            <button
                                className="btn btn-sm text-white d-flex align-items-center justify-content-center gap-1.5 rounded-2 py-1.5 px-3 fw-semibold border-0 flex-fill flex-sm-grow-0"
                                onClick={handleViewProfile}
                                type="button"
                                style={{
                                    fontSize: "0.8rem",
                                    background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                                    boxShadow: "0 2px 6px rgba(13, 148, 136, 0.25)"
                                }}
                            >
                                <i className="fas fa-user"></i>
                                <span>Lihat Profil</span>
                            </button>
                        </div>
                    </div>

                    {/* Stats Chips Row */}
                    <div className="d-flex align-items-center gap-2 flex-wrap mt-3 pt-2.5 border-top">
                        <span className="badge bg-white text-secondary border px-2.5 py-1" style={{ fontSize: "0.74rem" }}>
                            <i className="fas fa-book text-teal me-1"></i>{courseCount || teacher?.total_courses || 1} Kursus
                        </span>
                        <span className="badge bg-white text-secondary border px-2.5 py-1" style={{ fontSize: "0.74rem" }}>
                            <i className="fas fa-star text-warning me-1"></i>{(teacher?.average_rating || 5.0).toFixed(1)} Rating
                        </span>
                        <span className="badge bg-white text-secondary border px-2.5 py-1" style={{ fontSize: "0.74rem" }}>
                            <i className="fas fa-users text-primary me-1"></i>{teacher?.total_students || 0} Siswa
                        </span>
                    </div>
                </div>

                {/* Professional Background & Bio */}
                <div className="row g-3 g-md-3">
                    <div className="col-lg-7">
                        <div className="p-3 rounded-3 bg-white border h-100">
                            <h6 className="fw-bold mb-2 text-dark d-flex align-items-center gap-2" style={{ fontSize: "0.88rem" }}>
                                <i className="fas fa-briefcase text-teal"></i>
                                Latar Belakang Profesional
                            </h6>
                            <p className="text-secondary small mb-0" style={{ fontSize: "0.84rem", lineHeight: "1.65" }}>
                                {teacher.bio || teacher.about ||
                                    `${teacher.full_name} adalah instruktur berpengalaman dengan dedikasi tinggi dalam peningkatan mutu kompetensi aparatur di lingkungan Setjen DPD RI.`}
                            </p>
                        </div>
                    </div>

                    <div className="col-lg-5">
                        <div className="p-3 rounded-3 bg-white border h-100">
                            <h6 className="fw-bold mb-2 text-dark d-flex align-items-center gap-2" style={{ fontSize: "0.88rem" }}>
                                <i className="fas fa-lightbulb text-warning"></i>
                                Bidang Keahlian
                            </h6>
                            {teacher?.expertise && teacher.expertise.length > 0 ? (
                                <div className="d-flex flex-wrap gap-1">
                                    {teacher.expertise.map((item, index) => (
                                        <span
                                            key={item.id || index}
                                            className="badge bg-teal-subtle text-teal border border-teal-subtle py-1 px-2 rounded-pill"
                                            style={{ fontSize: "0.74rem" }}
                                        >
                                            {item.skill}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <div className="d-flex flex-wrap gap-1">
                                    <span className="badge bg-light text-secondary border py-1 px-2 rounded-pill" style={{ fontSize: "0.74rem" }}>
                                        Tata Kelola Administrasi
                                    </span>
                                    <span className="badge bg-light text-secondary border py-1 px-2 rounded-pill" style={{ fontSize: "0.74rem" }}>
                                        E-Learning & SCORM
                                    </span>
                                    <span className="badge bg-light text-secondary border py-1 px-2 rounded-pill" style={{ fontSize: "0.74rem" }}>
                                        Pemberdayaan Aparatur
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CourseInstructor;
