import React, { useContext, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { moment } from "../../../utils/dayjs";
import { ProfileContext } from "../../plugin/Context";
import UserData from "../../plugin/UserData";
import RoleIndicator from "../../../components/RoleIndicator";
import "./Header.css";

function Header() {
  const profileContext = useContext(ProfileContext);
  const [profile] = profileContext || [null, () => {}];
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Initialize from localStorage - SEPARATE key for header
    const saved = localStorage.getItem("studentHeaderCollapsed");
    return saved === "true";
  });
  const [isAnimating, setIsAnimating] = useState(false); // ✨ PHASE 4.19: Only animate on user interaction, not on re-render
  const userData = UserData();
  const location = useLocation();

  // Function to check if current page is active
  const isActivePage = (path) => {
    return location.pathname === path;
  };

  // Toggle collapse state and save to localStorage
  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    setIsAnimating(true); // ✨ PHASE 4.19: Enable animation only when user clicks toggle
    localStorage.setItem("studentHeaderCollapsed", newState.toString());
    
    // Reset animation state after it completes (600ms to match CSS animation duration)
    setTimeout(() => {
      setIsAnimating(false);
    }, 600);
  };

  // Calculate profile-related info
  const getMemberSince = () => {
    return profile?.date ? moment(profile.date).format("MMMM YYYY") : userData?.date_joined ? moment(userData.date_joined).format("MMMM YYYY") : "Baru-baru ini";
  };

  const getJoinedDaysAgo = () => {
    const joinDate = profile?.date || userData?.date_joined;
    if (!joinDate) return "Baru-baru ini bergabung";
    const days = moment().diff(moment(joinDate), "days");
    if (days < 1) return "Bergabung hari ini";
    if (days < 30) return `${days} hari yang lalu`;
    if (days < 365) return `${Math.floor(days/30)} bulan yang lalu`;
    return `${Math.floor(days/365)} tahun yang lalu`;
  };

  return (
    <div className="row align-items-center student-header-row">
      <div className="col-xl-12 col-lg-12 col-md-12 col-12">
        <div className={`student-header-card ${isCollapsed ? "collapsed" : ""} ${isAnimating ? "animating" : ""}`}>
          {/* Collapse Toggle Button */}
          <button
            className="student-header-toggle-btn"
            onClick={toggleCollapse}
            title={isCollapsed ? "Perluas Header" : "Ciutkan Header"}
            aria-label={isCollapsed ? "Perluas Header" : "Ciutkan Header"}
          >
            <i className={`fas fa-chevron-${isCollapsed ? "down" : "up"}`}></i>
          </button>

          {/* Collapsed Mini Header */}
          {isCollapsed && (
            <div className="student-header-collapsed">
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <div className="d-flex align-items-center justify-content-between w-100 gap-2">
                    <h5 className="mb-0 text-white">
                      {profile?.full_name || userData?.full_name || "Dasbor Siswa"}
                    </h5>
                    <div style={{marginTop: '-2px', flexShrink: 0}}>
                      <RoleIndicator compact={true} />
                    </div>
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <Link
                    to="/student/courses/"
                    className={`btn-collapsed-header ${isActivePage("/student/courses/") ? "active" : ""}`}
                    title="Kursus Saya"
                  >
                    <i className="fas fa-book-open me-1"></i>
                    Kursus
                  </Link>
                  <Link
                    to="/student/profile/"
                    className={`btn-collapsed-header ${isActivePage("/student/profile/") ? "active" : ""}`}
                    title="Profil"
                  >
                    <i className="fas fa-user-edit"></i>
                  </Link>
                  <button 
                    className="student-header-toggle-btn-inline"
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

          {/* Full Header Content - Always rendered for animation */}
          <div className={`student-header-content p-4 ${isAnimating ? (isCollapsed ? "collapsed-state" : "expanded-state") : (isCollapsed ? "collapsed-visual" : "expanded-visual")}`}>
              <div className="row align-items-center">
                {/* Profile Information Section */}
                <div className="col-lg-9 col-md-8 mb-4 mb-lg-0 d-flex align-items-center">
                  <div className="profile-info-container">
                    <h1 className="profile-name">
                      {profile?.full_name || userData?.full_name || "Selamat Datang!"}
                    </h1>
                    <p className="profile-description">
                      {profile?.about || "Selamat datang di perjalanan belajar Anda! Jelajahi kursus dan perluas pengetahuan Anda."}
                    </p>

                    {profile?.country && (
                      <div className="profile-meta profile-location-meta">
                        <i className="fas fa-map-marker-alt"></i>
                        <span>Berlokasi di {profile.country}</span>
                      </div>
                    )}
                    
                    <div className="d-flex flex-wrap gap-3 badges-container">
                      <div className="badge-modern">
                        <i className="fas fa-calendar-alt"></i>
                        Anggota sejak {getMemberSince()}
                      </div>
                      <div className="badge-modern">
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
                        to="/student/profile/"
                        className={`btn-modern-white btn-with-indicator ${isActivePage("/student/profile/") ? "active" : ""}`}
                        title="Edit pengaturan profil Anda"
                      >
                        <i className="fas fa-user-edit"></i>
                        Edit Profil
                        {isActivePage("/student/profile/") && (
                          <div className="active-indicator"></div>
                        )}
                      </Link>
                      
                      <Link
                        to="/student/courses/"
                        className={`btn-outline-white btn-with-indicator ${isActivePage("/student/courses/") ? "active" : ""}`}
                        title="Lihat kursus Anda"
                      >
                        <i className="fas fa-book-open"></i>
                        Kursus Saya
                        {isActivePage("/student/courses/") && (
                          <div className="active-indicator"></div>
                        )}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Profile Details Row */}
              <div className="row mt-3 pt-3 student-details-separator">
                <div className="col-md-12">
                  <div className="row">
                    {/* Status Profil */}
                    <div className="col-md-4">
                      <div className="profile-detail-item">
                        <div className="profile-meta">
                          <i className="fas fa-user-check"></i>
                          <span>Status Akun: Aktif</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Login Terakhir */}
                    <div className="col-md-4">
                      <div className="profile-detail-item">
                        <div className="profile-meta">
                          <i className="fas fa-sign-in-alt"></i>
                          <span>Aktif terakhir: Hari ini</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Kelengkapan Profil */}
                    <div className="col-md-4">
                      <div className="profile-detail-item">
                        <div className="profile-meta">
                          <i className="fas fa-check-circle"></i>
                          <span>Profil: {profile?.about && profile?.country ? "Lengkap" : "Belum Lengkap"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}

export default React.memo(Header);
