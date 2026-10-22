import React, { useContext, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { moment } from "../../../utils/dayjs";
import { ProfileContext } from "../../plugin/Context";
import UserData from "../../plugin/UserData";
import RoleIndicator from "../../../components/RoleIndicator";
import useAxios from "../../../utils/useAxios";
import { getValidProfileImageUrl } from "../../../utils/imageUtils";
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
  const [isAnimating, setIsAnimating] = useState(false); // ✨ Only animate on user interaction
  const userData = UserData();
  const location = useLocation();

  // ✨ Real data sync: Fetch teacher profile from backend to ensure all instructor details are up-to-date
  useEffect(() => {
    let isMounted = true;
    const fetchTeacherProfile = async () => {
      const userId = userData?.user_id;
      if (!userId) return;
      try {
        const res = await useAxios.get(`teacher/profile/${userId}/`);
        if (isMounted && res.data) {
          setTeacher(res.data);
        }
      } catch (err) {
        // Ignored if teacher profile not yet created or loading
      }
    };
    fetchTeacherProfile();
    return () => {
      isMounted = false;
    };
  }, [userData?.user_id]);

  // Toggle collapse state and save to localStorage
  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    setIsAnimating(true);
    localStorage.setItem("instructorHeaderCollapsed", newState.toString());
    setTimeout(() => {
      setIsAnimating(false);
    }, 500);
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
    if (!joinDate) return "Baru bergabung";
    
    const days = moment().diff(moment(joinDate), "days");
    if (days < 1) return "Hari ini";
    if (days < 30) return `${days} hari`;
    if (days < 365) return `${Math.floor(days/30)} bulan`;
    return `${Math.floor(days/365)} tahun`;
  };

  // Format real last active time based on user's actual last login / session
  const getLastActiveText = () => {
    const lastLoginTime = profile?.last_login || teacher?.last_login || userData?.last_login;
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

  // Calculate real profile completeness based on filled system fields
  const getProfileCompleteness = () => {
    const fullName = teacher?.full_name || profile?.full_name || userData?.full_name;
    const hasImage = Boolean(teacher?.image || profile?.image);
    const hasBio = Boolean((teacher?.bio && teacher?.bio.trim()) || (profile?.bio && profile?.bio.trim()) || (teacher?.about && teacher?.about.trim()) || (profile?.about && profile?.about.trim()));
    const hasCountry = Boolean((teacher?.country && teacher?.country.trim()) || (profile?.country && profile?.country.trim()));
    const hasSocial = Boolean(teacher?.facebook || teacher?.twitter || teacher?.linkedin || profile?.facebook || profile?.twitter || profile?.linkedin || teacher?.instagram || teacher?.youtube);

    let completed = 0;
    const total = 5;
    if (fullName && fullName.trim()) completed++;
    if (hasImage) completed++;
    if (hasBio) completed++;
    if (hasCountry) completed++;
    if (hasSocial) completed++;

    const percentage = Math.round((completed / total) * 100);
    return {
      percentage,
      isComplete: percentage >= 80,
      label: percentage === 100 ? "Profil Lengkap" : percentage >= 80 ? `Lengkap (${percentage}%)` : `Belum Lengkap (${percentage}%)`
    };
  };

  // Get Initials for Avatar Fallback
  const getInitials = (name) => {
    if (!name) return "IN";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const fullName = teacher?.full_name || profile?.full_name || userData?.full_name || "Instruktur";
  const bio = teacher?.bio || teacher?.about || profile?.about || "Kelola materi pelatihan, pantau partisipasi peserta, dan evaluasi hasil belajar di platform LMSetjen DPD RI.";
  const country = teacher?.country || profile?.country;
  const avatarUrl = getValidProfileImageUrl(teacher?.image || profile?.image || userData?.image);

  // Render social links
  const renderSocialLinks = () => {
    const fb = profile?.facebook || teacher?.facebook;
    const tw = profile?.twitter || teacher?.twitter;
    const li = profile?.linkedin || teacher?.linkedin;
    const ig = profile?.instagram || teacher?.instagram;
    const yt = profile?.youtube || teacher?.youtube;
    if (!fb && !tw && !li && !ig && !yt) return null;

    return (
      <div className="instructor-social-links social-links">
        {fb && (
          <a href={fb} target="_blank" rel="noopener noreferrer" className="instructor-social-link social-link facebook" title="Facebook">
            <i className="fab fa-facebook-f"></i>
          </a>
        )}
        {tw && (
          <a href={tw} target="_blank" rel="noopener noreferrer" className="instructor-social-link social-link twitter" title="Twitter">
            <i className="fab fa-twitter"></i>
          </a>
        )}
        {li && (
          <a href={li} target="_blank" rel="noopener noreferrer" className="instructor-social-link social-link linkedin" title="LinkedIn">
            <i className="fab fa-linkedin-in"></i>
          </a>
        )}
        {ig && (
          <a href={ig} target="_blank" rel="noopener noreferrer" className="instructor-social-link social-link instagram" title="Instagram">
            <i className="fab fa-instagram"></i>
          </a>
        )}
        {yt && (
          <a href={yt} target="_blank" rel="noopener noreferrer" className="instructor-social-link social-link youtube" title="YouTube">
            <i className="fab fa-youtube"></i>
          </a>
        )}
      </div>
    );
  };

  // Render instructor details & chips
  const renderInstructorDetails = () => {
    const isInstructorActive = Boolean(
      userData?.teacher_id || 
      teacher?.id || 
      userData?.is_instructor || 
      profile?.is_instructor ||
      userData?.current_role === 'teacher' ||
      userData?.role === 'teacher'
    );
    const lastActiveText = getLastActiveText();
    const profileCompleteness = getProfileCompleteness();

    return (
      <div className="row instructor-header-details-row">
        <div className="col-12">
          <div className="instructor-header-details-items-row d-flex flex-wrap align-items-center justify-content-between gap-2">
            
            {/* Left side: Interactive / Informative Status Chips */}
            <div className="d-flex flex-wrap align-items-center gap-2 instructor-chips-group">
              
              {/* Active Status Chip */}
              <div className="instructor-chip" title="Status Akun Instruktur">
                <i className={`fas ${isInstructorActive ? "fa-circle-check text-success-bright" : "fa-circle-exclamation text-warning-bright"}`}></i>
                <span>{isInstructorActive ? "Instruktur Aktif" : "Perlu Pengaturan"}</span>
              </div>

              {/* Profile Completeness Chip */}
              <div className="instructor-chip" title="Kelengkapan Profil Instruktur">
                <i className={`fas ${profileCompleteness.isComplete ? "fa-user-check text-success-bright" : "fa-user-edit text-warning-bright"}`}></i>
                <span>{profileCompleteness.label}</span>
              </div>

              {/* Last Active Chip */}
              <div className="instructor-chip" title="Waktu Aktif Terakhir">
                <i className="fas fa-clock text-info-bright"></i>
                <span>Aktif: {lastActiveText}</span>
              </div>

              {/* Member Since Chip */}
              <div className="instructor-chip" title="Terdaftar Mengajar Sejak">
                <i className="fas fa-calendar-alt text-teal-bright"></i>
                <span>Sejak {getMemberSince()}</span>
              </div>

              {/* Country / Location Chip if exists */}
              {country && (
                <div className="instructor-chip" title={`Lokasi: ${country}`}>
                  <i className="fas fa-map-marker-alt text-amber-bright"></i>
                  <span>{country}</span>
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
    <div className="row instructor-header-row">
      <div className="col-xl-12 col-lg-12 col-md-12 col-12">
        <div className={`instructor-header-card ${isCollapsed ? "collapsed" : ""} ${isAnimating ? "animating" : ""}`}>
          
          {/* Collapse Toggle Button */}
          <button
            className="instructor-header-toggle-btn"
            onClick={toggleCollapse}
            title={isCollapsed ? "Perluas Header" : "Ciutkan Header"}
            aria-label={isCollapsed ? "Perluas Header" : "Ciutkan Header"}
          >
            <i className={`fas fa-chevron-${isCollapsed ? "down" : "up"}`}></i>
          </button>

          {/* Collapsed Mini Header */}
          {isCollapsed && (
            <div className="instructor-header-collapsed">
              <div className="d-flex align-items-center justify-content-between gap-3">
                <div className="d-flex align-items-center gap-2 min-w-0">
                  <div className="instructor-avatar-mini">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={fullName} />
                    ) : (
                      <span className="instructor-avatar-mini-initials">{getInitials(fullName)}</span>
                    )}
                  </div>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <h5 className="mb-0 text-white instructor-collapsed-name">
                      {fullName}
                    </h5>
                    <RoleIndicator compact={true} />
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2 flex-shrink-0">
                  <Link
                    to="/instructor/create-course/"
                    className={`btn btn-sm btn-instructor-cta ${isActivePage("/instructor/create-course/") ? "active" : ""}`}
                    title="Buat Kursus"
                  >
                    <i className="fas fa-plus me-1"></i>
                    <span>Buat Kursus</span>
                  </Link>
                  <Link
                    to="/instructor/profile/"
                    className={`btn btn-sm btn-instructor-ghost ${isActivePage("/instructor/profile/") ? "active" : ""}`}
                    title="Pengaturan Profil"
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
          <div className={`instructor-header-content ${isAnimating ? (isCollapsed ? "collapsed-state" : "expanded-state") : (isCollapsed ? "collapsed-visual" : "expanded-visual")}`}>
            
            {/* Primary Top Row: Identity & CTA buttons */}
            <div className="row align-items-center instructor-header-main-row">
              
              {/* Left: Avatar + Identity */}
              <div className="col-lg-8 col-md-7 mb-3 mb-md-0">
                <div className="d-flex align-items-center gap-3">
                  
                  {/* Avatar with status indicator */}
                  <div className="instructor-header-avatar-wrap flex-shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={fullName} className="instructor-header-avatar-img" />
                    ) : (
                      <div className="instructor-header-avatar-placeholder">
                        <span>{getInitials(fullName)}</span>
                      </div>
                    )}
                    <span className="instructor-online-badge" title="Status Aktif"></span>
                  </div>

                  {/* Name, Tag, and Bio */}
                  <div className="instructor-header-info min-w-0">
                    <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                      <span className="instructor-portal-badge">
                        <i className="fas fa-graduation-cap me-1"></i>
                        Portal Instruktur
                      </span>
                      <RoleIndicator compact={true} />
                    </div>

                    <h1 className="instructor-name mb-1">
                      {fullName}
                    </h1>

                    <p className="instructor-bio mb-0" title={bio}>
                      {bio}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: Quick Action CTAs */}
              <div className="col-lg-4 col-md-5">
                <div className="d-flex align-items-center justify-content-md-end gap-2 flex-wrap instructor-actions-wrap">
                  <Link
                    to="/instructor/create-course/"
                    className={`btn-instructor-primary ${isActivePage("/instructor/create-course/") ? "active" : ""}`}
                    title="Buat kursus baru"
                  >
                    <i className="fas fa-plus"></i>
                    <span>Buat Kursus</span>
                  </Link>
                  
                  <Link
                    to="/instructor/profile/"
                    className={`btn-instructor-outline ${isActivePage("/instructor/profile/") ? "active" : ""}`}
                    title="Kelola profil instruktur Anda"
                  >
                    <i className="fas fa-user-cog"></i>
                    <span>Pengaturan Profil</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Bottom Meta & Details Strip */}
            {renderInstructorDetails()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(Header);