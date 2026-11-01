import React, { useContext, useEffect, useState, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { moment } from "../../../utils/dayjs";
import { ProfileContext } from "../../plugin/Context";
import UserData from "../../plugin/UserData";
import RoleIndicator from "../../../components/RoleIndicator";
import { getValidProfileImageUrl } from "../../../utils/imageUtils";
import "./Header.css";

function Header({ defaultCollapsed = false }) {
  const profileContext = useContext(ProfileContext);
  const [contextProfile] = profileContext || [null, () => {}];
  const [localProfile, setLocalProfile] = useState(null);
  const profile = localProfile || contextProfile;

  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem("studentHeaderCollapsed");
    if (saved !== null) {
      return saved === "true";
    }
    return defaultCollapsed;
  });
  const [isAnimating, setIsAnimating] = useState(false);
  const userData = UserData();
  const location = useLocation();

  // Listen for custom events when user updates profile
  useEffect(() => {
    let isMounted = true;
    const handleProfileUpdate = (e) => {
      if (e?.detail && isMounted) {
        setLocalProfile((prev) => ({ ...(prev || contextProfile || {}), ...e.detail }));
      }
    };
    window.addEventListener("studentProfileUpdated", handleProfileUpdate);
    window.addEventListener("userProfileUpdated", handleProfileUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener("studentProfileUpdated", handleProfileUpdate);
      window.removeEventListener("userProfileUpdated", handleProfileUpdate);
    };
  }, [contextProfile]);

  // Function to check if current page is active
  const isActivePage = (path) => {
    return location.pathname === path;
  };

  // Toggle collapse state and save to localStorage
  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    setIsAnimating(true);
    localStorage.setItem("studentHeaderCollapsed", newState.toString());

    setTimeout(() => {
      setIsAnimating(false);
    }, 400);
  };

  // Calculate member since info
  const getMemberSince = () => {
    const joinDate = profile?.date || userData?.date_joined;
    return joinDate ? moment(joinDate).format("MMMM YYYY") : "Baru-baru ini";
  };

  // Format real last active time
  const getLastActiveText = () => {
    const lastLoginTime = profile?.last_login || userData?.last_login;
    if (!lastLoginTime) {
      return "Hari ini";
    }

    const now = moment();
    const loginMoment = moment(lastLoginTime);
    if (!loginMoment.isValid()) {
      return "Hari ini";
    }

    const diffMinutes = now.diff(loginMoment, "minutes");
    const diffHours = now.diff(loginMoment, "hours");
    const diffDays = now.diff(loginMoment, "days");

    if (diffMinutes < 5) return "Baru saja";
    if (diffMinutes < 60) return `${diffMinutes} mnt lalu`;
    if (diffHours < 24 && now.isSame(loginMoment, "day")) {
      return `Hari ini (${loginMoment.format("HH:mm")})`;
    }
    if (diffDays === 1 || (diffHours < 48 && now.clone().subtract(1, "day").isSame(loginMoment, "day"))) {
      return `Kemarin (${loginMoment.format("HH:mm")})`;
    }
    if (diffDays < 7) {
      return `${diffDays} hr lalu`;
    }
    return loginMoment.format("DD MMM YYYY");
  };

  // Calculate real profile completeness
  const getProfileCompleteness = () => {
    const name = profile?.full_name || userData?.full_name;
    const hasName = Boolean(name && name.trim() && name !== "Peserta Didik");
    const hasImage = Boolean(profile?.image || userData?.image);
    const hasBio = Boolean((profile?.bio && profile?.bio.trim()) || (profile?.about && profile?.about.trim()));
    const hasOrgOrCountry = Boolean(
      (profile?.organization_unit_name && profile?.organization_unit_name.trim()) ||
      (profile?.position_name && profile?.position_name.trim()) ||
      (profile?.country && profile?.country.trim())
    );
    const hasSocial = Boolean(profile?.facebook || profile?.twitter || profile?.linkedin || profile?.instagram || profile?.youtube || profile?.tiktok);

    let completed = 0;
    const total = 5;
    if (hasName) completed++;
    if (hasImage) completed++;
    if (hasBio) completed++;
    if (hasOrgOrCountry) completed++;
    if (hasSocial) completed++;

    const percentage = Math.round((completed / total) * 100);
    return {
      percentage,
      isComplete: percentage >= 80,
      label: percentage === 100 ? "Profil Lengkap" : percentage >= 80 ? `Lengkap (${percentage}%)` : `Belum Lengkap (${percentage}%)`
    };
  };

  // Initials generator for fallback avatar
  const getInitials = (name) => {
    if (!name) return "SD";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const fullName = profile?.full_name || userData?.full_name || "Peserta Didik";
  const bio =
    (profile?.bio && profile?.bio.trim()) ||
    (profile?.about && profile?.about.trim()) ||
    "Tingkatkan kompetensi dan perluas pengetahuan melalui pelatihan di LMSetjen DPD RI.";
  const unitOrLocation =
    profile?.organization_unit_name ||
    profile?.position_name ||
    profile?.country;
  const avatarUrl = getValidProfileImageUrl(profile?.image || userData?.image);
  const profileCompleteness = getProfileCompleteness();
  const lastActiveText = getLastActiveText();

  // Render social links
  const renderSocialLinks = () => {
    const fb = profile?.facebook;
    const tw = profile?.twitter;
    const li = profile?.linkedin;
    const ig = profile?.instagram;
    const yt = profile?.youtube;
    const tt = profile?.tiktok;
    if (!fb && !tw && !li && !ig && !yt && !tt) return null;

    return (
      <div className="student-social-links social-links">
        {fb && (
          <a href={fb} target="_blank" rel="noopener noreferrer" className="student-social-link social-link facebook" title="Facebook">
            <i className="fab fa-facebook-f"></i>
          </a>
        )}
        {tw && (
          <a href={tw} target="_blank" rel="noopener noreferrer" className="student-social-link social-link twitter" title="Twitter">
            <i className="fab fa-twitter"></i>
          </a>
        )}
        {li && (
          <a href={li} target="_blank" rel="noopener noreferrer" className="student-social-link social-link linkedin" title="LinkedIn">
            <i className="fab fa-linkedin-in"></i>
          </a>
        )}
        {ig && (
          <a href={ig} target="_blank" rel="noopener noreferrer" className="student-social-link social-link instagram" title="Instagram">
            <i className="fab fa-instagram"></i>
          </a>
        )}
        {yt && (
          <a href={yt} target="_blank" rel="noopener noreferrer" className="student-social-link social-link youtube" title="YouTube">
            <i className="fab fa-youtube"></i>
          </a>
        )}
        {tt && (
          <a href={tt} target="_blank" rel="noopener noreferrer" className="student-social-link social-link tiktok" title="TikTok">
            <i className="fab fa-tiktok"></i>
          </a>
        )}
      </div>
    );
  };

  // Render student bottom details strip
  const renderStudentDetails = () => {
    return (
      <div className="row student-header-details-row">
        <div className="col-12">
          <div className="student-header-details-items-row d-flex flex-wrap align-items-center justify-content-between gap-2">
            {/* Left side: Compact Informative Status Chips */}
            <div className="d-flex flex-wrap align-items-center gap-2 student-chips-group">
              {/* Active Status Chip */}
              <div className="student-chip" title="Status Akun Peserta">
                <i className="fas fa-circle-check text-success-bright"></i>
                <span>Peserta Aktif</span>
              </div>

              {/* Profile Completeness Chip */}
              <div className="student-chip" title="Kelengkapan Profil">
                <i className={`fas ${profileCompleteness.isComplete ? "fa-user-check text-success-bright" : "fa-user-edit text-warning-bright"}`}></i>
                <span>{profileCompleteness.label}</span>
              </div>

              {/* Last Active Chip */}
              <div className="student-chip" title="Waktu Aktif Terakhir">
                <i className="fas fa-clock text-info-bright"></i>
                <span>Aktif: {lastActiveText}</span>
              </div>

              {/* Member Since Chip */}
              <div className="student-chip" title="Terdaftar Sejak">
                <i className="fas fa-calendar-alt text-teal-bright"></i>
                <span>Sejak {getMemberSince()}</span>
              </div>

              {/* Unit Kerja / Jabatan / Lokasi Chip */}
              {unitOrLocation && (
                <div className="student-chip" title={`Instansi / Unit Kerja: ${unitOrLocation}`}>
                  <i className="fas fa-landmark text-amber-bright"></i>
                  <span>{unitOrLocation}</span>
                </div>
              )}
            </div>

            {/* Right side: Social Links if any */}
            {renderSocialLinks()}
          </div>
        </div>
      </div>
    );
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
              <div className="d-flex align-items-center justify-content-between gap-3">
                <div className="d-flex align-items-center gap-2 min-w-0">
                  <div className="student-avatar-mini flex-shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={fullName} />
                    ) : (
                      <span className="student-avatar-mini-initials">{getInitials(fullName)}</span>
                    )}
                  </div>
                  <div className="d-flex align-items-center gap-2 flex-wrap min-w-0">
                    <span className="student-portal-badge d-none d-sm-inline-flex">
                      <i className="fas fa-graduation-cap me-1"></i>
                      Siswa
                    </span>
                    <h5 className="mb-0 text-white student-collapsed-name text-truncate">
                      {fullName}
                    </h5>
                    <RoleIndicator compact={true} />
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2 flex-shrink-0">
                  <Link
                    to="/student/courses/"
                    className={`btn btn-sm btn-student-cta ${isActivePage("/student/courses/") ? "active" : ""}`}
                    title="Kursus Saya"
                  >
                    <i className="fas fa-book-open me-1"></i>
                    <span className="d-none d-sm-inline">Kursus</span>
                  </Link>
                  <Link
                    to="/student/profile/"
                    className={`btn btn-sm btn-student-ghost ${isActivePage("/student/profile/") ? "active" : ""}`}
                    title="Pengaturan Profil"
                  >
                    <i className="fas fa-user-gear"></i>
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

          {/* Full Header Content */}
          {(!isCollapsed || isAnimating) && (
            <div className={`student-header-content ${isAnimating ? (isCollapsed ? "collapsed-state" : "expanded-state") : (isCollapsed ? "collapsed-visual" : "expanded-visual")}`}>
              {/* Primary Top Row: Identity & CTA buttons */}
              <div className="row align-items-center student-header-main-row">
                {/* Left: Avatar + Identity */}
                <div className="col-lg-8 col-md-7 mb-3 mb-md-0">
                  <div className="d-flex align-items-center gap-3">
                    {/* Avatar with status indicator */}
                    <div className="student-header-avatar-wrap flex-shrink-0">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={fullName} className="student-header-avatar-img" />
                      ) : (
                        <div className="student-header-avatar-placeholder">
                          <span>{getInitials(fullName)}</span>
                        </div>
                      )}
                      <span className="student-online-badge" title="Status Aktif"></span>
                    </div>

                    {/* Name, Tag, and Bio */}
                    <div className="student-header-info min-w-0">
                      <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                        <span className="student-portal-badge">
                          <i className="fas fa-graduation-cap me-1"></i>
                          Portal Pembelajar
                        </span>
                        <RoleIndicator compact={true} />
                      </div>

                      <h1 className="student-name mb-1">
                        {fullName}
                      </h1>

                      <p className="student-bio mb-0" title={bio}>
                        {bio}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right: Quick Action CTAs */}
                <div className="col-lg-4 col-md-5">
                  <div className="d-flex align-items-center justify-content-md-end gap-2 flex-wrap student-actions-wrap">
                    <Link
                      to="/student/courses/"
                      className={`btn-student-primary ${isActivePage("/student/courses/") ? "active" : ""}`}
                      title="Lihat daftar kursus Anda"
                    >
                      <i className="fas fa-book-open"></i>
                      <span>Kursus Saya</span>
                    </Link>

                    <Link
                      to="/student/profile/"
                      className={`btn-student-outline ${isActivePage("/student/profile/") ? "active" : ""}`}
                      title="Kelola pengaturan profil Anda"
                    >
                      <i className="fas fa-user-gear"></i>
                      <span>Pengaturan Profil</span>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Bottom Meta & Details Strip */}
              {renderStudentDetails()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(Header);
