import React, { useContext, useEffect, useState, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import dayjs, { moment } from "../../../utils/dayjs";
import { ProfileContext } from "../../plugin/Context";
import UserData from "../../plugin/UserData";
import useAxios from "../../../utils/useAxios";
import { getSafeImageUrl, createImageErrorHandler, getFirstValidImageUrl } from "../../../utils/imageUtils";
import RoleIndicator from "../../../components/RoleIndicator";
import "./Header.css";

function Header() {
  const profileContext = useContext(ProfileContext);
  const [profile, setProfile] = profileContext || [null, () => {}];
  const [teacher, setTeacher] = useState(null);
  const [teacherStats, setTeacherStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  // ✨ PHASE 4.177: Fetch guard to prevent duplicate profile/teacher/stats API calls
  const hasFetchedRef = useRef(false);
  const [imageError, setImageError] = useState(false); // ✨ PHASE 4.21: Image error state for graceful fallback
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Initialize from localStorage - SEPARATE key for header
    const saved = localStorage.getItem("instructorHeaderCollapsed");
    return saved === "true";
  });
  const [isAnimating, setIsAnimating] = useState(false); // ✨ Only animate on user interaction, not on re-render
  const userData = UserData();
  const location = useLocation();

  // Cache duration in milliseconds (5 minutes)
  const CACHE_DURATION = 5 * 60 * 1000;

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

  // Check if we need to fetch profile (cache expired or no data)
  const shouldFetchProfile = () => {
    // Don't fetch if already loading
    if (loading) return false;
    
    // Fetch if no profile data at all
    if (!profile) return true;
    
    // Fetch if cache expired (only for profile page)
    if (lastFetchTime && location.pathname === "/instructor/profile/") {
      const timeSinceLastFetch = Date.now() - lastFetchTime;
      return timeSinceLastFetch > CACHE_DURATION;
    }
    
    // Don't fetch for other pages if we have cached data
    return false;
  };

  const fetchProfile = async () => {
    if (!userData?.user_id) {
      setError("ID pengguna tidak tersedia");
      return;
    }
    
    // Skip if cache is still valid
    if (!shouldFetchProfile()) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch profile data
      const profileRes = await useAxios.get(`user/profile/${userData.user_id}/`);
      
      if (profileRes.status === 200 && profileRes.data) {
        setProfile(profileRes.data);
        setLastFetchTime(Date.now()); // Update cache timestamp
        
        // Try to fetch teacher data
        try {
          const teacherRes = await useAxios.get(`teacher/profile/${userData.user_id}/`);
          if (teacherRes.data) {
            setTeacher(teacherRes.data);
            
            // Fetch teacher statistics
            try {
              const statsRes = await useAxios.get(`teacher/summary/${teacherRes.data.id}/`);
              if (statsRes.data && statsRes.data.length > 0) {
                setTeacherStats(statsRes.data[0]);
              }
            } catch (statsError) {
              // Stats not available
            }
          }
        } catch (teacherError) {
          // Teacher profile not found
        }
        
        setError(null);
      } else {
        setError("Respons tidak valid dari server");
      }
    } catch (error) {
      console.error("[Header] Error fetching profile:", error);
      setError(error.message || "Gagal memuat profil");
      
      // Set fallback profile data from userData if available
      if (userData) {
        const fallbackProfile = {
          full_name: userData.full_name || "",
          about: "Selamat datang di dasbor instruktur Anda",
          image: "",
          country: "",
        };
        setProfile(fallbackProfile);
      }
    } finally {
      setLoading(false);
    }
  };

  // ✨ PHASE 4.21: useEffect Hook 1 - Fetch profile on mount
  // Only depends on userData and initial profile fetch
  // ✨ PHASE 4.177: Added fetch guard + data check to prevent duplicate calls in React Strict Mode
  useEffect(() => {
    // Skip if profile data is already loaded
    if (profile?.full_name || profile?.id) return;
    
    // Guard against multiple fetches in React Strict Mode
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    
    if (userData?.user_id && !profile) {
      fetchProfile();
    } else if (!userData?.user_id) {
      setError("Pengguna tidak terautentikasi");
    }
  }, [userData?.user_id, profile?.full_name]);

  // ✨ PHASE 4.21: useEffect Hook 2 - Cache expiry check on profile page + reset image error on navigation
  // Separates route-based cache management from mount logic
  useEffect(() => {
    // Check cache expiry on profile page navigation
    if (location.pathname === "/instructor/profile/" && lastFetchTime) {
      const timeSinceLastFetch = Date.now() - lastFetchTime;
      if (timeSinceLastFetch > CACHE_DURATION) {
        fetchProfile();
      }
    }
    // Reset image error on page navigation
    setImageError(false);
  }, [location.pathname, userData?.user_id]);

  // ✨ PHASE 4.21: useEffect Hook 3 - Reset image error when image URL changes
  // Ensures fallback displays fresh attempt when new image loads
  useEffect(() => {
    if (teacher?.image || profile?.image) {
      setImageError(false);
    }
  }, [teacher?.image, profile?.image]);

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

  // Render profile avatar with proper error handling
  const renderProfileAvatar = () => {
    if (loading) {
      return (
        <div className="instructor-default-avatar loading-shimmer-instructor mx-auto">
          <div 
            className="spinner-border text-white" 
            role="status" 
            style={{ 
              width: "2.5rem", 
              height: "2.5rem",
              flexShrink: 0 
            }}
          >
            <span className="visually-hidden">Memuat...</span>
          </div>
        </div>
      );
    }

    // ✨ PHASE 4.21: Enhanced image error handling
    // Get first valid image URL from multiple sources using centralized utility
    const imageUrl = getFirstValidImageUrl(teacher?.image, profile?.image);

    if (imageUrl && !imageError) {
      return (
        <div className="instructor-avatar-wrapper">
          <img
            src={imageUrl}
            className="instructor-profile-avatar"
            alt={`Avatar ${profile?.full_name || teacher?.full_name || "Instruktur"}`}
            onError={() => setImageError(true)} // ✨ PHASE 4.21: Enhanced error handling with state
          />
          <div className="instructor-default-avatar instructor-fallback-icon">
            <i className="fas fa-chalkboard-teacher"></i>
          </div>
        </div>
      );
    }
    
    // ✨ PHASE 4.21: SVG fallback with gradient (like student Header)
    // Shows when image has error or no image URL available
    return (
      <div className="instructor-default-avatar mx-auto">
        <svg width="160" height="160" viewBox="0 0 200 200" style={{ flex: "0 0 auto" }}>
          <defs>
            <linearGradient id="instructorBg">
              <stop offset="0%" style={{stopColor:"#3498db"}}/>
              <stop offset="100%" style={{stopColor:"#2980b9"}}/>
            </linearGradient>
          </defs>
          <circle cx="100" cy="100" r="100" fill="url(#instructorBg)" />
          {/* Head */}
          <circle cx="100" cy="70" r="25" fill="#ffffff" opacity="0.9" />
          {/* Body/Shoulders */}
          <ellipse cx="100" cy="130" rx="35" ry="40" fill="#ffffff" opacity="0.9" />
          {/* Briefcase icon */}
          <rect x="85" y="155" width="30" height="25" fill="#ffffff" opacity="0.7" rx="2" />
          <line x1="85" y1="165" x2="115" y2="165" stroke="#3498db" strokeWidth="2" />
        </svg>
      </div>
    );
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
    <div className="row mt-3 pt-3 instructor-header-details-row" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.2)" }}>
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
            <div className="instructor-header-collapsed p-3">
              <div className="d-flex align-items-center justify-content-between">
                <div className="instructor-avatar-wrapper d-flex align-items-center gap-2">
                  {renderProfileAvatar()}
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
          <div className={`instructor-header-content p-3 p-md-4 ${isAnimating ? (isCollapsed ? "collapsed-state" : "expanded-state") : (isCollapsed ? "collapsed-visual" : "expanded-visual")}`}>
              <div className="row align-items-center instructor-header-main-row">
                {/* Profile Avatar Section */}
                <div className="col-lg-3 col-md-4 mb-4 mb-lg-0">
                  <div className="text-center position-relative">
                    {renderProfileAvatar()}
                    
                    {/* Instructor Identity Badge */}
                    <div className="instructor-badge">
                      <i className="fas fa-chalkboard-user"></i>
                    </div>
                  </div>
                </div>

                {/* Profile Information Section */}
                <div className="col-lg-6 col-md-5 mb-4 mb-lg-0">
                  <div>
                    <h1 className="instructor-name">
                      {teacher?.full_name || profile?.full_name || userData?.full_name || "Selamat Datang Instruktur!"}
                    </h1>
                    <p className="instructor-bio">
                      {teacher?.bio || teacher?.about || profile?.about || "Selamat datang di dasbor instruktur Anda! Buat dan kelola kursus Anda untuk mendidik siswa di seluruh dunia."}
                    </p>
                    
                    <div className="d-flex flex-wrap gap-3 mb-1">
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

                    {(teacher?.country || profile?.country) ? (
                      <div className="instructor-meta d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center gap-2">
                          <i className="fas fa-map-marker-alt"></i>
                          <span>Berbasis di {teacher?.country || profile?.country}</span>
                        </div>
                        {renderSocialLinks()}
                      </div>
                    ) : (
                      <div className="instructor-meta d-flex justify-content-end">
                        {renderSocialLinks()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons Section */}
                <div className="col-lg-3 col-md-12">
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