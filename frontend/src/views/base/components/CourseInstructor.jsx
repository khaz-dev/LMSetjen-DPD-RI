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
        // Navigate to instructor profile if teacher_id exists
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
        <div className="instructor-card">
            <div className="instructor-card-body">
                {/* Header Section */}
                <div className="instructor-header">
                    <div className="instructor-header__icon">
                        <i className="fas fa-chalkboard-teacher"></i>
                    </div>
                    <h3 className="instructor-header__title">
                        Tentang Instruktur
                    </h3>
                </div>

                <div className="row align-items-center">
                    {/* Left Column: Avatar and Stats */}
                    <div className="col-lg-4 text-center mb-4 mb-lg-0">
                        {/* Avatar */}
                        <div className="instructor-avatar-wrapper">
                            <div className="instructor-avatar-frame">
                                <img 
                                    src={getImageUrl(teacher.image) || '/images/placeholders/default-instructor.svg'}
                                    alt={teacher.full_name}
                                    className="instructor-avatar-img"
                                    onError={(e) => {
                                        e.target.src = '/images/placeholders/default-instructor.svg';
                                    }}
                                    onLoad={(e) => {
                                        // Clear onerror to prevent fallback on valid images
                                        e.target.onerror = null;
                                    }}
                                />
                            </div>
                            <div className="instructor-avatar-badge">
                                <i className="fas fa-check"></i>
                            </div>
                        </div>

                        {/* Name and Bio */}
                        <h4 className="instructor-name">
                            {teacher.full_name}
                        </h4>
                        <p className="instructor-bio-short">
                            {teacher.about?.slice(0, 80) || 'Instruktur Profesional'}
                            {teacher.about?.length > 80 ? '...' : ''}
                        </p>

                        {/* Quick Stats */}
                        <div className="instructor-stats">
                            <div className="instructor-stat-item instructor-stat-item--courses">
                                <div className="instructor-stat-value">{courseCount}</div>
                                <small className="instructor-stat-label">Kursus</small>
                            </div>
                            <div className="instructor-stat-item instructor-stat-item--rating">
                                <div className="instructor-stat-value">
                                    {teacher?.average_rating?.toFixed(1) || 0}
                                </div>
                                <small className="instructor-stat-label">Rating</small>
                            </div>
                            <div className="instructor-stat-item instructor-stat-item--students">
                                <div className="instructor-stat-value">
                                    {teacher?.total_students || 0}
                                </div>
                                <small className="instructor-stat-label">Siswa</small>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Details */}
                    <div className="col-lg-8">
                        {/* Professional Background */}
                        <div className="instructor-detail-section">
                            <h5 className="instructor-detail-title">
                                Latar Belakang Profesional
                            </h5>
                            <p className="instructor-bio-text">
                                {teacher.bio || teacher.about ||
                                `${teacher.full_name} adalah seorang profesional berpengalaman dengan keahlian luas dalam bidang pendidikan dan pelatihan. 
                                Dengan pengalaman bertahun-tahun di bidangnya, beliau menghadirkan pengetahuan praktis dan wawasan dunia nyata dalam setiap kursus.`}
                            </p>
                        </div>

                        {/* Expertise Areas */}
                        <div className="instructor-detail-section">
                            <h5 className="instructor-detail-title">
                                Bidang Keahlian
                            </h5>
                            {teacher?.expertise && teacher.expertise.length > 0 ? (
                                <div className="instructor-expertise-container">
                                    {teacher.expertise.map((item, index) => (
                                        <span 
                                            key={item.id || index}
                                            className="instructor-expertise__badge"
                                        >
                                            {item.skill}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-muted">Belum ada bidang keahlian yang ditampilkan</p>
                            )}
                        </div>

                        {/* Contact Section */}
                        <div className="instructor-detail-section">
                            <h5 className="instructor-detail-title">
                                Hubungi Instruktur
                            </h5>
                            <div className="instructor-contact-buttons">
                                <button 
                                    className="instructor-contact-btn instructor-contact-btn--primary"
                                    onClick={handleContactClick}
                                    type="button"
                                >
                                    <i className="fas fa-envelope"></i>
                                    Kirim Pesan
                                </button>
                                <button 
                                    className="instructor-contact-btn instructor-contact-btn--secondary"
                                    onClick={handleViewProfile}
                                    type="button"
                                >
                                    <i className="fas fa-user"></i>
                                    Lihat Profil
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CourseInstructor;