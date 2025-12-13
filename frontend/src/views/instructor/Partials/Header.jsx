import React, { useContext, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import dayjs, { moment } from "../../../utils/dayjs";
import { ProfileContext } from "../../plugin/Context";
import UserData from "../../plugin/UserData";
import useAxios from "../../../utils/useAxios";
import { getSafeImageUrl, createImageErrorHandler, getFirstValidImageUrl } from "../../../utils/imageUtils";
import "./InstructorHeader.css";

function Header() {
  const profileContext = useContext(ProfileContext);
  const [profile, setProfile] = profileContext || [null, () => {}];
  const [teacher, setTeacher] = useState(null);
  const [teacherStats, setTeacherStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Initialize from localStorage - SEPARATE key for header
    const saved = localStorage.getItem('instructorHeaderCollapsed');
    return saved === 'true';
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
    localStorage.setItem('instructorHeaderCollapsed', newState.toString());
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
    if (lastFetchTime && location.pathname === '/instructor/profile/') {
      const timeSinceLastFetch = Date.now() - lastFetchTime;
      return timeSinceLastFetch > CACHE_DURATION;
    }
    
    // Don't fetch for other pages if we have cached data
    return false;
  };

  const fetchProfile = async () => {
    if (!userData?.user_id) {
      setError("No user ID available");
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
        setError("Invalid response from server");
      }
    } catch (error) {
      console.error("[Header] Error fetching profile:", error);
      setError(error.message || "Failed to fetch profile");
      
      // Set fallback profile data from userData if available
      if (userData) {
        const fallbackProfile = {
          full_name: userData.full_name || "",
          about: "Welcome to your instructor dashboard",
          image: "",
          country: "",
        };
        setProfile(fallbackProfile);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userData?.user_id) {
      // Only fetch if profile context is empty OR we're on profile page
      if (!profile || location.pathname === '/instructor/profile/') {
        fetchProfile();
      }
    } else {
      setError("User not authenticated");
    }
  }, [userData?.user_id, location.pathname]); // React to route changes

  // Calculate profile-related info
  const getMemberSince = () => {
    return profile?.date 
      ? moment(profile.date).format("MMMM YYYY") 
      : userData?.date_joined 
        ? moment(userData.date_joined).format("MMMM YYYY") 
        : "Recently";
  };

  const getJoinedDaysAgo = () => {
    const joinDate = profile?.date || userData?.date_joined;
    if (!joinDate) return "Recently joined";
    
    const days = moment().diff(moment(joinDate), 'days');
    if (days < 1) return "Teaching today";
    if (days < 30) return `${days} days teaching`;
    if (days < 365) return `${Math.floor(days/30)} months teaching`;
    return `${Math.floor(days/365)} years teaching`;
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
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      );
    }

    // Get first valid image URL from multiple sources using centralized utility
    const imageUrl = getFirstValidImageUrl(teacher?.image, profile?.image);

    if (imageUrl) {
      return (
        <div className="instructor-avatar-wrapper">
          <img
            src={imageUrl}
            className="instructor-profile-avatar"
            alt={`${profile?.full_name || teacher?.full_name || 'Instructor'} avatar`}
            onError={createImageErrorHandler('instructor')}
          />
          <div className="instructor-default-avatar instructor-fallback-icon">
            <i className="fas fa-chalkboard-teacher"></i>
          </div>
        </div>
      );
    }
    
    // No image URL available, show default avatar
    return (
      <div className="instructor-default-avatar mx-auto">
        <i className="fas fa-chalkboard-teacher" style={{ fontSize: "4rem", color: "white", opacity: 0.9 }}></i>
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
    <div className="row mt-3 pt-3" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
      <div className="col-md-12">
        <div className="row">
          <div className="col-md-4 mb-3">
            <div className="instructor-detail-item">
              <div className="instructor-meta">
                <i className="fas fa-check-circle"></i>
                <span>Status: {teacher ? 'Active Instructor' : 'Profile Setup Required'}</span>
              </div>
            </div>
          </div>
          
          <div className="col-md-4 mb-3">
            <div className="instructor-detail-item">
              <div className="instructor-meta">
                <i className="fas fa-clock"></i>
                <span>Last active: Today</span>
              </div>
            </div>
          </div>
          
          <div className="col-md-4 mb-3">
            <div className="instructor-detail-item">
              <div className="instructor-meta">
                <i className="fas fa-user-graduate"></i>
                <span>Instructor: {teacher && teacher.bio ? 'Profile Complete' : 'Profile Incomplete'}</span>
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
        <div className={`instructor-header-card ${isCollapsed ? 'collapsed' : ''} ${isAnimating ? 'animating' : ''}`}>
          {/* Collapse Toggle Button */}
          <button
            className="instructor-header-toggle-btn"
            onClick={toggleCollapse}
            title={isCollapsed ? "Expand Header" : "Collapse Header"}
            aria-label={isCollapsed ? "Expand Header" : "Collapse Header"}
          >
            <i className={`fas fa-chevron-${isCollapsed ? 'down' : 'up'}`}></i>
          </button>

          {/* Collapsed Mini Header */}
          {isCollapsed && (
            <div className="instructor-header-collapsed p-3">
              <div className="d-flex align-items-center justify-content-between">
                <div className="instructor-avatar-wrapper d-flex align-items-center gap-2">
                  {renderProfileAvatar()}
                  <div>
                    <h5 className="mb-0 text-white">
                      {teacher?.full_name || profile?.full_name || userData?.full_name || "Instructor Dashboard"}
                    </h5>
                    <small className="text-white-50">
                      <i className="fas fa-chalkboard-user me-1"></i>
                      Instructor
                    </small>
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <Link
                    to="/instructor/create-course/"
                    className="btn btn-sm btn-light"
                    title="Create Course"
                  >
                    <i className="fas fa-plus me-1"></i>
                    Create
                  </Link>
                  <Link
                    to="/instructor/profile/"
                    className="btn btn-sm btn-outline-light"
                    title="Profile"
                  >
                    <i className="fas fa-user-cog"></i>
                  </Link>
                  <button 
                    className="instructor-header-toggle-btn-inline"
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

          {/* Full Header Content */}
          <div className={`instructor-header-content p-3 p-md-4 ${isAnimating ? (isCollapsed ? 'collapsed-state' : 'expanded-state') : (isCollapsed ? 'collapsed-visual' : 'expanded-visual')}`}>
              <div className="row align-items-center">
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
                      {teacher?.full_name || profile?.full_name || userData?.full_name || "Welcome Instructor!"}
                    </h1>
                    <p className="instructor-bio">
                      {teacher?.bio || teacher?.about || profile?.about || "Welcome to your instructor dashboard! Create and manage your courses to educate students worldwide."}
                    </p>
                    
                    <div className="d-flex flex-wrap gap-3 mb-3">
                      <div className="badge-instructor">
                        <i className="fas fa-calendar-alt"></i>
                        Teaching since {getMemberSince()}
                      </div>
                      <div className="badge-instructor">
                        <i className="fas fa-clock"></i>
                        {getJoinedDaysAgo()}
                      </div>
                    </div>

                    {(teacher?.country || profile?.country) ? (
                      <div className="instructor-meta mb-3 d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center gap-2">
                          <i className="fas fa-map-marker-alt"></i>
                          <span>Based in {teacher?.country || profile?.country}</span>
                        </div>
                        {renderSocialLinks()}
                      </div>
                    ) : (
                      <div className="instructor-meta mb-3 d-flex justify-content-end">
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
                        className={`btn-instructor-primary ${isActivePage('/instructor/create-course/') ? 'active' : ''}`}
                        title="Create a new course"
                      >
                        <i className="fas fa-plus"></i>
                        Create Course
                      </Link>
                      
                      <Link
                        to="/instructor/profile/"
                        className={`btn-instructor-outline ${isActivePage('/instructor/profile/') ? 'active' : ''}`}
                        title="Manage your instructor profile"
                      >
                        <i className="fas fa-user-cog"></i>
                        Profile Settings
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