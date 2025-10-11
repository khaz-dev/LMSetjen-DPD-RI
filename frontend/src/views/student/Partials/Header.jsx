import React, { useContext, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import moment from "moment";
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
  const userData = UserData();
  const location = useLocation();

  // Cache duration in milliseconds (5 minutes)
  const CACHE_DURATION = 5 * 60 * 1000;

  // Function to check if current page is active
  const isActivePage = (path) => {
    return location.pathname === path;
  };

  // Check if we need to fetch profile (cache expired or no data)
  const shouldFetchProfile = () => {
    // Don't fetch if already loading
    if (loading) return false;
    
    // Fetch if no profile data at all
    if (!profile) return true;
    
    // Fetch if cache expired (only for profile page)
    if (lastFetchTime && location.pathname === '/student/profile/') {
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

  useEffect(() => {
    if (userData?.user_id) {
      setImageError(false); // Reset image error state when profile changes
      
      // Force refresh if profile context has been updated (e.g., from Profile page)
      // This happens when user updates their profile
      if (profile && profile.image) {
        // Profile context was updated, clear cache and use new data
        setLastFetchTime(Date.now());
        return;
      }
      
      // Only fetch if profile context is empty OR we're on profile page
      if (!profile || location.pathname === '/student/profile/') {
        fetchProfile();
      }
    } else {
      setError("User not authenticated");
    }
  }, [userData?.user_id, location.pathname, profile]); // Added profile to dependencies

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
    const days = moment().diff(moment(joinDate), 'days');
    if (days < 1) return "Joined today";
    if (days < 30) return `${days} days ago`;
    if (days < 365) return `${Math.floor(days/30)} months ago`;
    return `${Math.floor(days/365)} years ago`;
  };

  return (
    <div className="row align-items-center">
      <div className="col-xl-12 col-lg-12 col-md-12 col-12">
        <div className="student-header-card">
          <div className="student-header-content p-3 p-md-4">
            <div className="row align-items-center">
              {/* Profile Avatar Section */}
              <div className="col-lg-3 col-md-4 mb-4 mb-lg-0">
                <div className="text-center position-relative">
                  {loading ? (
                    <div className="default-avatar loading-shimmer mx-auto">
                      <div className="spinner-border text-white" role="status" style={{ width: "2.5rem", height: "2.5rem" }}>
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </div>
                  ) : (isValidImageUrl(profile?.image) && !imageError) ? (
                    <img
                      key={profile.image} // Force re-render when image URL changes
                      src={profile.image}
                      className="profile-avatar"
                      alt={`${profile.full_name || 'User'} avatar`}
                      onError={() => {
                        console.warn('[Header] Profile image failed to load:', profile.image);
                        setImageError(true);
                      }}
                      onLoad={() => {
                        console.log('[Header] Profile image loaded successfully:', profile.image);
                      }}
                    />
                  ) : (
                    <div className="default-avatar mx-auto">
                      <svg width="120" height="120" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <linearGradient id="userBg" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style={{stopColor:'#4f46e5', stopOpacity:1}} />
                            <stop offset="100%" style={{stopColor:'#7c3aed', stopOpacity:1}} />
                          </linearGradient>
                        </defs>
                        <circle cx="100" cy="100" r="100" fill="url(#userBg)"/>
                        <g fill="white" fillOpacity="0.9">
                          <circle cx="100" cy="75" r="25"/>
                          <path d="M100,115 C85,115 70,125 70,135 L70,160 Q70,170 80,170 L120,170 Q130,170 130,160 L130,135 C130,125 115,115 100,115 Z"/>
                        </g>
                      </svg>
                    </div>
                  )}
                  
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
                      className={`btn-modern-white ${isActivePage('/student/profile/') ? 'active' : ''}`}
                      title="Edit your profile settings"
                      style={{ position: 'relative' }}
                    >
                      <i className="fas fa-user-edit"></i>
                      Edit Profile
                      {isActivePage('/student/profile/') && (
                        <div className="active-indicator"></div>
                      )}
                    </Link>
                    
                    <Link
                      to="/student/courses/"
                      className={`btn-outline-white ${isActivePage('/student/courses/') ? 'active' : ''}`}
                      title="View your courses"
                      style={{ position: 'relative' }}
                    >
                      <i className="fas fa-book-open"></i>
                      My Courses
                      {isActivePage('/student/courses/') && (
                        <div className="active-indicator"></div>
                      )}
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Profile Details Row */}
            <div className="row mt-3 pt-3" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
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
                        <span>Profile: {profile?.about && profile?.country ? 'Complete' : 'Incomplete'}</span>
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

export default Header;