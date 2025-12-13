import React, { useContext, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import dayjs, { moment } from "../../../utils/dayjs";
import { ProfileContext } from "../../plugin/Context";
import UserData from "../../plugin/UserData";
import useAxios from "../../../utils/useAxios";
import { isValidImageUrl } from "../../../utils/imageUtils";
import "./Header.css";

function Header() {
  const profileContext = useContext(ProfileContext);
  const [profile, setProfile] = profileContext || [null, () => {}];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [imageError, setImageError] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Initialize from localStorage - SEPARATE key for header
    const saved = localStorage.getItem("studentHeaderCollapsed");
    return saved === "true";
  });
  const [isAnimating, setIsAnimating] = useState(false); // ✨ PHASE 4.19: Only animate on user interaction, not on re-render
  const userData = UserData();
  const location = useLocation();
  const navigate = useNavigate();

  // Cache duration in milliseconds (5 minutes)
  const CACHE_DURATION = 5 * 60 * 1000;

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

  // Function to check if current page is active
  const isActivePage = (path) => {
    return location.pathname === path;
  };

  const fetchProfile = async () => {
    if (!userData?.user_id) {
      setError("No user ID available");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await useAxios.get(`user/profile/${userData.user_id}/`);
      
      if (response.status === 200 && response.data) {
        setProfile(response.data);
        setLastFetchTime(Date.now()); // Update cache timestamp
        setError(null);
      } else {
        setError("Invalid response from server");
      }
    } catch (error) {
      setError(error.message || "Failed to fetch profile");
      
      // Set fallback profile data from userData if available
      if (userData) {
        const fallbackProfile = {
          full_name: userData.full_name || "",
          about: "Welcome to your dashboard",
          image: "",
          country: "",
        };
        setProfile(fallbackProfile);
      }
    } finally {
      setLoading(false);
    }
  };

  // ✨ PHASE 4.16 FIX: Only fetch profile on initial mount or when user_id changes
  // This prevents unnecessary re-fetches when navigating between pages
  useEffect(() => {
    if (userData?.user_id && !profile) {
      // Only fetch if we don't have profile data yet
      fetchProfile();
    } else if (userData?.user_id && !userData) {
      setError("User not authenticated");
    }
  }, [userData?.user_id]); // Only depend on user_id, NOT location.pathname or profile

  // Separate effect to handle profile page cache expiry and image error reset
  useEffect(() => {
    if (location.pathname === "/student/profile/" && userData?.user_id) {
      // On profile page, check if cache expired and refetch if needed
      if (lastFetchTime) {
        const timeSinceLastFetch = Date.now() - lastFetchTime;
        if (timeSinceLastFetch > CACHE_DURATION) {
          fetchProfile();
        }
      }
    }
    
    // Reset image error when navigating to new page
    setImageError(false);
  }, [location.pathname, userData?.user_id]); // Only depend on pathname and user_id

  // Separate effect to reset image error when profile image URL changes
  useEffect(() => {
    if (profile?.image) {
      setImageError(false); // Reset image error when new image is available
    }
  }, [profile?.image]); // React specifically to image URL changes

  // Calculate profile-related info
  const getMemberSince = () => {
    return profile?.date ? moment(profile.date).format("MMMM YYYY") : userData?.date_joined ? moment(userData.date_joined).format("MMMM YYYY") : "Recently";
  };

  const getJoinedDaysAgo = () => {
    const joinDate = profile?.date || userData?.date_joined;
    if (!joinDate) return "Recently joined";
    const days = moment().diff(moment(joinDate), "days");
    if (days < 1) return "Joined today";
    if (days < 30) return `${days} days ago`;
    if (days < 365) return `${Math.floor(days/30)} months ago`;
    return `${Math.floor(days/365)} years ago`;
  };

  // Render profile avatar with proper error handling
  const renderProfileAvatar = () => {
    if (loading) {
      return (
        <div className="student-default-avatar loading-shimmer mx-auto">
          <div 
            className="spinner-border text-white" 
            role="status" 
            style={{ 
              width: "2.5rem", 
              height: "2.5rem",
              flexShrink: 0 
            }}
          >
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      );
    }

    if (profile?.image && !imageError) {
      return (
        <img
          key={profile.image}
          src={profile.image}
          className="profile-avatar"
          alt={`${profile?.full_name || "User"} avatar`}
          onError={() => {
            setImageError(true);
          }}
        />
      );
    }
    
    // No image URL available, show default avatar
    return (
      <div className="student-default-avatar mx-auto">
        <svg width="120" height="120" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="userBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{stopColor:"#4f46e5", stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:"#7c3aed", stopOpacity:1}} />
            </linearGradient>
          </defs>
          <circle cx="100" cy="100" r="100" fill="url(#userBg)"/>
          <g fill="white" fillOpacity="0.9">
            <circle cx="100" cy="75" r="25"/>
            <path d="M100,115 C85,115 70,125 70,135 L70,160 Q70,170 80,170 L120,170 Q130,170 130,160 L130,135 C130,125 115,115 100,115 Z"/>
          </g>
        </svg>
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
            title={isCollapsed ? "Expand Header" : "Collapse Header"}
            aria-label={isCollapsed ? "Expand Header" : "Collapse Header"}
          >
            <i className={`fas fa-chevron-${isCollapsed ? "down" : "up"}`}></i>
          </button>

          {/* Collapsed Mini Header */}
          {isCollapsed && (
            <div className="student-header-collapsed p-3">
              <div className="d-flex align-items-center justify-content-between">
                <div className="student-avatar-wrapper d-flex align-items-center gap-2">
                  <div style={{ width: "50px", height: "50px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {loading ? (
                      <div className="student-default-avatar loading-shimmer">
                        <div className="spinner-border text-white" role="status" style={{ width: "1.5rem", height: "1.5rem" }}>
                          <span className="visually-hidden">Loading...</span>
                        </div>
                      </div>
                    ) : profile?.image && !imageError ? (
                      <img
                        src={profile.image}
                        className="profile-avatar-mini"
                        alt={`${profile?.full_name || "User"} avatar`}
                        onError={() => setImageError(true)}
                      />
                    ) : (
                      <div className="student-default-avatar">
                        <i className="fas fa-user" style={{ fontSize: "1.2rem", color: "white", opacity: 0.9 }}></i>
                      </div>
                    )}
                  </div>
                  <div>
                    <h5 className="mb-0 text-white">
                      {profile?.full_name || userData?.full_name || "Student Dashboard"}
                    </h5>
                    <small className="text-white-50">
                      <i className="fas fa-graduation-cap me-1"></i>
                      Student
                    </small>
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <Link
                    to="/student/courses/"
                    className="btn btn-sm btn-light"
                    title="My Courses"
                  >
                    <i className="fas fa-book-open me-1"></i>
                    Courses
                  </Link>
                  <Link
                    to="/student/profile/"
                    className="btn btn-sm btn-outline-light"
                    title="Profile"
                  >
                    <i className="fas fa-user-edit"></i>
                  </Link>
                  <button 
                    className="student-header-toggle-btn-inline"
                    onClick={toggleCollapse}
                    title="Expand Header"
                    aria-label="Expand Header"
                  >
                    <i className="fas fa-chevron-down"></i>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Full Header Content - Always rendered for animation */}
          <div className={`student-header-content p-3 p-md-4 ${isAnimating ? (isCollapsed ? "collapsed-state" : "expanded-state") : (isCollapsed ? "collapsed-visual" : "expanded-visual")}`}>
              <div className="row align-items-center">
                {/* Profile Avatar Section */}
                <div className="col-lg-3 col-md-4 mb-4 mb-lg-0">
                  <div className="text-center position-relative">
                    {renderProfileAvatar()}
                    
                    {/* Student Identity Badge */}
                    <div className="student-badge">
                      <i className="fas fa-graduation-cap"></i>
                    </div>
                  </div>
                </div>

                {/* Profile Information Section */}
                <div className="col-lg-6 col-md-5 mb-4 mb-lg-0">
                  <div>
                    <h1 className="profile-name">
                      {profile?.full_name || userData?.full_name || "Welcome!"}
                    </h1>
                    <p className="profile-description">
                      {profile?.about || "Welcome to your learning journey! Explore courses and expand your knowledge."}
                    </p>
                    
                    <div className="d-flex flex-wrap gap-3 mb-3">
                      <div className="badge-modern">
                        <i className="fas fa-calendar-alt"></i>
                        Member since {getMemberSince()}
                      </div>
                      <div className="badge-modern">
                        <i className="fas fa-clock"></i>
                        {getJoinedDaysAgo()}
                      </div>
                    </div>

                    {profile?.country && (
                      <div className="profile-meta mb-3">
                        <i className="fas fa-map-marker-alt"></i>
                        <span>Located in {profile.country}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons Section */}
                <div className="col-lg-3 col-md-12">
                  <div className="text-center text-lg-end">
                    <div className="d-flex flex-column flex-md-row flex-lg-column gap-3 justify-content-center justify-content-lg-end">
                      <Link
                        to="/student/profile/"
                        className={`btn-modern-white ${isActivePage("/student/profile/") ? "active" : ""}`}
                        title="Edit your profile settings"
                        style={{ position: "relative" }}
                      >
                        <i className="fas fa-user-edit"></i>
                        Edit Profile
                        {isActivePage("/student/profile/") && (
                          <div className="active-indicator"></div>
                        )}
                      </Link>
                      
                      <Link
                        to="/student/courses/"
                        className={`btn-outline-white ${isActivePage("/student/courses/") ? "active" : ""}`}
                        title="View your courses"
                        style={{ position: "relative" }}
                      >
                        <i className="fas fa-book-open"></i>
                        My Courses
                        {isActivePage("/student/courses/") && (
                          <div className="active-indicator"></div>
                        )}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Profile Details Row */}
              <div className="row mt-3 pt-3" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.2)" }}>
                <div className="col-md-12">
                  <div className="row">
                    {/* Profile Status */}
                    <div className="col-md-4 mb-3">
                      <div className="profile-detail-item">
                        <div className="profile-meta">
                          <i className="fas fa-user-check"></i>
                          <span>Account Status: Active</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Last Login */}
                    <div className="col-md-4 mb-3">
                      <div className="profile-detail-item">
                        <div className="profile-meta">
                          <i className="fas fa-sign-in-alt"></i>
                          <span>Last active: Today</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Profile Completion */}
                    <div className="col-md-4 mb-3">
                      <div className="profile-detail-item">
                        <div className="profile-meta">
                          <i className="fas fa-check-circle"></i>
                          <span>Profile: {profile?.about && profile?.country ? "Complete" : "Incomplete"}</span>
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
