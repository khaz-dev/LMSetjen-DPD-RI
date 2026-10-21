import React, { useContext, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { moment } from "../../../utils/dayjs";
import { ProfileContext } from "../../plugin/Context";
import UserData from "../../plugin/UserData";
import RoleIndicator from "../../../components/RoleIndicator";
import useAxios from "../../../utils/useAxios";
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
      return `${diffDays} hari lalu`;
    }
    return loginMoment.format("DD MMM YYYY");
  };

  // Calculate real profile completeness based on filled system fields
  const getProfileCompleteness = () => {
    const fullName = teacher?.full_name || profile?.full_name || userData?.full_name;
    const hasImage = Boolean(teacher?.image || profile?.image);
    const hasBio = Boolean((teacher?.bio && teacher?.bio.trim()) || (profile?.bio && profile?.bio.trim()) || (teacher?.about && teacher?.about.trim()) || (profile?.about && profile?.about.trim()));
    const hasCountry = Boolean((teacher?.country && teacher?.country.trim()) || (profile?.country && profile?.country.trim()));
    const hasSocial = Boolean(teacher?.facebook || teacher?.twitter || teacher?.linkedin || profile?.facebook || profile?.twitter || profile?.linkedin);

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

  // Render social links
  const renderSocialLinks = () => {
    const fb = profile?.facebook || teacher?.facebook;
    const tw = profile?.twitter || teacher?.twitter;
    const li = profile?.linkedin || teacher?.linkedin;
    if (!fb && !tw && !li) return null;

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
      </div>
    );
  };

  // Render instructor details
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
      <div className="row mt-3 pt-3 instructor-header-details-row">
        <div className="col-md-12">
          <div className="row instructor-header-details-items-row">
            <div className="col-md-4">
              <div className="instructor-detail-item">
                <div className="instructor-meta">
                  <i className={`fas ${isInstructorActive ? "fa-check-circle text-success" : "fa-exclamation-circle text-warning"}`}></i>
                  <span>Status: {isInstructorActive ? "Instruktur Aktif" : "Pengaturan Profil Diperlukan"}</span>
                </div>
              </div>
            </div>
            
            <div className="col-md-4">
              <div className="instructor-detail-item">
                <div className="instructor-meta">
                  <i className="fas fa-clock text-info"></i>
                  <span>Aktif terakhir: {lastActiveText}</span>
                </div>
              </div>
            </div>
            
            <div className="col-md-4">
              <div className="instructor-detail-item">
                <div className="instructor-meta">
                  <i className={`fas ${profileCompleteness.isComplete ? "fa-user-check text-success" : "fa-user-edit text-warning"}`}></i>
                  <span>Status Profil: {profileCompleteness.label}</span>
                </div>
              </div>
            </div>
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
                <div className="col-lg-9 col-md-8 mb-4 mb-lg-0 d-flex align-items-center">
                  <div>
                    <h1 className="instructor-name">
                      {teacher?.full_name || profile?.full_name || userData?.full_name || "Selamat Datang Instruktur!"}
                    </h1>
                    <p className="instructor-bio">
                      {teacher?.bio || teacher?.about || profile?.about || "Selamat datang di dasbor instruktur Anda! Buat dan kelola kursus Anda untuk mendidik siswa di seluruh dunia."}
                    </p>

                    {(teacher?.country || profile?.country) ? (
                      <div className="instructor-meta instructor-location-meta d-flex align-items-center gap-2 mt-3">
                        <div>
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