import React, { useContext, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { moment } from "../../../utils/dayjs";
import { ProfileContext } from "../../plugin/Context";
import UserData from "../../plugin/UserData";
import RoleIndicator from "../../../components/RoleIndicator";
import "./Header.css";

function Header() {
  const profileContext = useContext(ProfileContext);
  const [profile] = profileContext || [null, () => {}];
  const [teacher, setTeacher] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Initialize from localStorage - SEPARATE key for header
    const saved = localStorage.getItem("instructorHeaderCollapsed");
    return saved === "true";
  });
  const [isAnimating, setIsAnimating] = useState(false); // ✨ Only animate on user interaction, not on re-render
  const userData = UserData();
  const location = useLocation();

  // Toggle collapse state and save to localStorage - INDEPENDENT from sidebar
  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    setIsAnimating(true); // ✨ Enable animation only when user clicks toggle
    localStorage.setItem("instructorHeaderCollapsed", newState.toString());
    // Reset animation state after it completes (600ms to match CSS animation duration)
    setTimeout(() => {
      setIsAnimating(false);
    }, 600);
  };

  // Function to check if current page is active
  const isActivePage = (path) => location.pathname === path;

  // Calculate profile-related info
  const getMemberSince = () => {
    return profile?.date 
      ? moment(profile.date).format("MMMM YYYY") 
      : userData?.date_joined 
        ? moment(userData.date_joined).format("MMMM YYYY") 
        : "Baru-baru ini";
  };

  const getJoinedDaysAgo = () => {
    const joinDate = profile?.date || userData?.date_joined;
    if (!joinDate) return "Baru saja bergabung";
    
    const days = moment().diff(moment(joinDate), "days");
    if (days < 1) return "Mengajar hari ini";
    if (days < 30) return `Mengajar ${days} hari`;
    if (days < 365) return `Mengajar ${Math.floor(days/30)} bulan`;
    return `Mengajar ${Math.floor(days/365)} tahun`;
  };

  // Render social links
  const renderSocialLinks = () => {
    if (!teacher?.facebook && !teacher?.twitter && !teacher?.linkedin) return null;

    return (
      <div className="social-links">
        {teacher?.facebook && (
          <a href={teacher.facebook} target="_blank" rel="noopener noreferrer" className="social-link" title="Facebook">
            <i className="fab fa-facebook-f"></i>
          </a>
        )}
        {teacher?.twitter && (
          <a href={teacher.twitter} target="_blank" rel="noopener noreferrer" className="social-link" title="Twitter">
            <i className="fab fa-twitter"></i>
          </a>
        )}
        {teacher?.linkedin && (
          <a href={teacher.linkedin} target="_blank" rel="noopener noreferrer" className="social-link" title="LinkedIn">
            <i className="fab fa-linkedin-in"></i>
          </a>
        )}
      </div>
    );
  };

  // Render instructor details
  const renderInstructorDetails = () => (
    <div className="row mt-3 pt-3 instructor-header-details-row">
      <div className="col-md-12">
        <div className="row instructor-header-details-items-row">
          <div className="col-md-4">
            <div className="instructor-detail-item">
              <div className="instructor-meta">
                <i className="fas fa-check-circle"></i>
                <span>Status: {teacher ? "Instruktur Aktif" : "Pengaturan Profil Diperlukan"}</span>
              </div>
            </div>
          </div>
          
          <div className="col-md-4">
            <div className="instructor-detail-item">
              <div className="instructor-meta">
                <i className="fas fa-clock"></i>
                <span>Aktif terakhir: Hari ini</span>
              </div>
            </div>
          </div>
          
          <div className="col-md-4">
            <div className="instructor-detail-item">
              <div className="instructor-meta">
                <i className="fas fa-user-graduate"></i>
                <span>Status Profil: {teacher && teacher.bio ? "Profil Lengkap" : "Profil Belum Lengkap"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="row align-items-center instructor-header-row">
      <div className="col-xl-12 col-lg-12 col-md-12 col-12">
        <div className={`instructor-header-card ${isCollapsed ? "collapsed" : ""} ${isAnimating ? "animating" : ""}`}>
          {/* Collapse Toggle Button */}
          <button
            className="instructor-header-toggle-btn"
            onClick={toggleCollapse}
            title={isCollapsed ? "Perluas Header" : "Tutup Header"}
            aria-label={isCollapsed ? "Perluas Header" : "Tutup Header"}
          >
            <i className={`fas fa-chevron-${isCollapsed ? "down" : "up"}`}></i>
          </button>

          {/* Collapsed Mini Header */}
          {isCollapsed && (
            <div className="instructor-header-collapsed">
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <div className="d-flex align-items-center justify-content-between w-100 gap-2">
                    <h5 className="mb-0 text-white">
                      {teacher?.full_name || profile?.full_name || userData?.full_name || "Dasbor Instruktur"}
                    </h5>
                    <div style={{marginTop: '-2px', flexShrink: 0}}>
                      <RoleIndicator compact={true} />
                    </div>
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <Link
                    to="/instructor/create-course/"
                    className={`btn btn-sm btn-outline-light ${isActivePage("/instructor/create-course/") ? "active" : ""}`}
                    title="Buat Kursus"
                  >
                    <i className="fas fa-plus me-1"></i>
                    Buat
                  </Link>
                  <Link
                    to="/instructor/profile/"
                    className={`btn btn-sm btn-outline-light ${isActivePage("/instructor/profile/") ? "active" : ""}`}
                    title="Profil"
                  >
                    <i className="fas fa-user-cog"></i>
                  </Link>
                  <button 
                    className="instructor-header-toggle-btn-inline"
                    onClick={toggleCollapse}
                    title="Perluas Header"
                    aria-label="Perluas Header"
                  >
                    <i className="fas fa-chevron-down"></i>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Full Header Content */}
          <div className={`instructor-header-content p-4 ${isAnimating ? (isCollapsed ? "collapsed-state" : "expanded-state") : (isCollapsed ? "collapsed-visual" : "expanded-visual")}`}>
              <div className="row align-items-center instructor-header-main-row">
                {/* Profile Information Section */}
                <div className="col-lg-8 col-md-7 mb-4 mb-lg-0 d-flex align-items-center">
                  <div>
                    <h1 className="instructor-name">
                      {teacher?.full_name || profile?.full_name || userData?.full_name || "Selamat Datang Instruktur!"}
                    </h1>
                    <p className="instructor-bio">
                      {teacher?.bio || teacher?.about || profile?.about || "Selamat datang di dasbor instruktur Anda! Buat dan kelola kursus Anda untuk mendidik siswa di seluruh dunia."}
                    </p>

                    {(teacher?.country || profile?.country) ? (
                      <div className="instructor-meta instructor-location-meta d-flex justify-content-between align-items-center mt-3">
                        <div className="d-flex align-items-center gap-2">
                          <i className="fas fa-map-marker-alt"></i>
                          <span>Berbasis di {teacher?.country || profile?.country}</span>
                        </div>
                        {renderSocialLinks()}
                      </div>
                    ) : (
                      <div className="instructor-meta d-flex justify-content-end mt-3">
                        {renderSocialLinks()}
                      </div>
                    )}
                    
                    <div className="d-flex flex-wrap gap-3 badges-container">
                      <div className="badge-instructor">
                        <i className="fas fa-calendar-alt"></i>
                        Mengajar sejak {getMemberSince()}
                      </div>
                      <div className="badge-instructor">
                        <i className="fas fa-clock"></i>
                        {getJoinedDaysAgo()}
                      </div>
                      <RoleIndicator compact={true} />
                    </div>
                  </div>
                </div>

                {/* Action Buttons Section */}
                <div className="col-lg-3 col-md-4">
                  <div className="text-center text-lg-end">
                    <div className="d-flex flex-column flex-md-row flex-lg-column gap-3 justify-content-center justify-content-lg-end">
                      <Link
                        to="/instructor/create-course/"
                        className={`btn-instructor-primary ${isActivePage("/instructor/create-course/") ? "active" : ""}`}
                        title="Buat kursus baru"
                      >
                        <i className="fas fa-plus"></i>
                        Buat Kursus
                      </Link>
                      
                      <Link
                        to="/instructor/profile/"
                        className={`btn-instructor-outline ${isActivePage("/instructor/profile/") ? "active" : ""}`}
                        title="Kelola profil instruktur Anda"
                      >
                        <i className="fas fa-user-cog"></i>
                        Pengaturan Profil
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Instructor Details */}
              {renderInstructorDetails()}
            </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(Header);