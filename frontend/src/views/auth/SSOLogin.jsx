import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import Toast from '../plugin/Toast';
import UserData from '../plugin/UserData';
import apiInstance from '../../utils/axios';
import BaseHeader from '../partials/BaseHeader';
import Footer from '../partials/Footer';
import { setAuthUser, redirectUserByRole } from '../../utils/auth';
import RoleSelectionModal from '../../components/RoleSelectionModal';
import Cookie from 'js-cookie';
import './SSOLogin.css';

/**
 * SSO Login Handler Component
 * 
 * This component handles the SSO login flow from Nusa DPD
 * 
 * URL: /sso/{sso_token}/
 * 
 * Flow:
 * 1. User is redirected from nusadpd.duckdns.org with JWT token
 * 2. Component receives token from URL parameter
 * 3. Sends token to backend /api/v1/sso/verify/ endpoint
 * 4. Backend verifies token and returns LMS JWT tokens
 * 5. Frontend stores tokens in cookies and redirects user
 */

function SSOLogin() {
  const { sso_token } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Multi-role support
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // If already logged in, redirect to dashboard
    if (isLoggedIn()) {
      Toast().fire({
        icon: "info",
        title: "You are already logged in",
      });
      navigate("/student/dashboard/");
      return;
    }

    // If no token in URL, redirect to login
    if (!sso_token) {
      setError("No SSO token provided");
      setLoading(false);
      Toast().fire({
        icon: "error",
        title: "Invalid SSO token",
      });
      setTimeout(() => {
        navigate("/login/");
      }, 2000);
      return;
    }

    // Verify SSO token with backend
    handleSSOLogin();
  }, [sso_token, navigate, isLoggedIn]);

  const handleSSOLogin = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("🔐 SSO Login Started");
      console.log("SSO Token:", sso_token ? `${sso_token.substring(0, 20)}...` : "MISSING");
      console.log("API Base URL:", apiInstance.defaults.baseURL);
      console.log("Full endpoint URL:", `${apiInstance.defaults.baseURL}sso/verify/`);

      // Call backend SSO verify endpoint
      console.log("📤 Sending SSO token to backend...");
      const response = await apiInstance.post('sso/verify/', {
        sso_token: sso_token,
      });

      console.log("✅ Backend response received:", response.status);
      console.log("Response data:", response.data);

      const { access, refresh, user, created, message } = response.data;

      // Validate response
      if (!access || !refresh) {
        throw new Error("Invalid response from backend: missing tokens");
      }

      console.log("💾 Storing tokens in cookies...");

      // Store tokens in cookies immediately
      Cookie.set('access_token', access, {
        expires: 7,
        secure: false,
        sameSite: 'Lax',
      });
      Cookie.set('refresh_token', refresh, {
        expires: 7,
        secure: false,
        sameSite: 'Lax',
      });

      console.log("🍪 Tokens stored successfully");
      console.log("Access token cookie:", Cookie.get('access_token') ? `${Cookie.get('access_token').substring(0, 20)}...` : "NOT FOUND");
      console.log("Refresh token cookie:", Cookie.get('refresh_token') ? `${Cookie.get('refresh_token').substring(0, 20)}...` : "NOT FOUND");

      // CRITICAL: Update auth store with user data
      console.log("📝 Updating auth store with user data...");
      useAuthStore.getState().setUser({
        user_id: user?.id,
        username: user?.email,
        email: user?.email,
        full_name: user?.full_name,
        role: user?.role,
        nip: user?.nip,
        is_active: user?.is_active,
      });
      console.log("✅ Auth store updated successfully");

      // CRITICAL: Also call setAuthUser to decode and store tokens properly
      setAuthUser(access, refresh);

      // Show success message
      const statusMessage = created 
        ? "Welcome! Your account has been created via SSO."
        : "Welcome back! Logged in via SSO.";

      // Check if user has multiple roles
      if (user?.available_roles && user.available_roles.length > 1) {
        console.log("👥 Multi-role user detected:", user.available_roles);
        
        // Store user data and roles for role selection modal
        setCurrentUser({
          full_name: user.full_name,
          email: user.email,
          nip: user.nip
        });
        setAvailableRoles(user.available_roles);
        setShowRoleModal(true);
        
        Toast().fire({
          icon: "info",
          title: "Pilih Peran Anda",
          text: "Anda memiliki akses dengan beberapa peran.",
        });
      } else {
        // Single role user - redirect directly
        console.log("👤 Single-role user:", user?.role);
        
        Toast().fire({
          icon: "success",
          title: statusMessage,
        });

        // Redirect based on user role
        console.log("👤 User data:", user);
        console.log("User role:", user?.role);
        console.log("User NIP:", user?.nip);

        // Determine redirect path immediately
        let redirectPath = '/student/dashboard/';
        const userRole = user?.role;
        
        console.log("Final user role for redirect:", userRole);
        
        if (userRole === 'admin') {
          redirectPath = '/admin/dashboard/';
        } else if (userRole === 'teacher') {
          redirectPath = '/instructor/dashboard/';
        }

        console.log("Redirecting to:", redirectPath);
        
        // Perform redirect with minimal delay
        setTimeout(() => {
          navigate(redirectPath);
        }, 500);
      }

    } catch (err) {
      console.error("❌ SSO login error:", err);
      console.error("Error response:", err.response?.data);
      console.error("Error status:", err.response?.status);
      console.error("Error config:", err.config);
      
      let errorMessage = "SSO login failed. Please try again.";

      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.response?.data?.details) {
        errorMessage = Object.values(err.response.data.details).join(', ');
      } else if (err.response?.status === 401) {
        errorMessage = "Invalid or expired SSO token. Please log in again.";
      } else if (err.response?.status === 400) {
        errorMessage = "Invalid SSO data. Please contact support.";
      } else if (err.message === 'Network Error') {
        errorMessage = "Network error. Please check your connection.";
      }

      setError(errorMessage);
      Toast().fire({
        icon: "error",
        title: errorMessage,
      });

      console.error("Error message displayed:", errorMessage);

      // Redirect to login after showing error
      setTimeout(() => {
        navigate("/login/");
      }, 5174);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle role selection from modal
   */
  const handleRoleSelected = (selectedRole) => {
    console.log("✅ Role selected:", selectedRole);
    setShowRoleModal(false);
    
    // Redirect based on selected role
    redirectUserByRole(selectedRole);
  };

  /**
   * Handle role selection modal cancel
   */
  const handleRoleModalCancel = () => {
    console.log("❌ Role selection cancelled");
    setShowRoleModal(false);
    
    // Logout user since they cancelled role selection
    Toast().fire({
      icon: "warning",
      title: "Login Dibatalkan",
      text: "Anda perlu memilih peran untuk melanjutkan.",
    });
    
    // Clear auth data
    useAuthStore.getState().logout();
    
    // Redirect to login
    setTimeout(() => {
      navigate("/login/");
    }, 1000);
  };

  return (
    <>
      <BaseHeader />

      {/* Role Selection Modal */}
      <RoleSelectionModal
        show={showRoleModal}
        roles={availableRoles}
        currentRole={currentUser ? availableRoles[0] : null}
        user={currentUser}
        onRoleSelected={handleRoleSelected}
        onCancel={handleRoleModalCancel}
      />

      <section className="sso-login-section">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-6 col-md-8">
              <div className="card shadow border-0 sso-login-card">
                <div className="card-body sso-login-body">
                  <div className="text-center">
                    {loading ? (
                      <>
                        <div className="sso-loading-spinner">
                          <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading...</span>
                          </div>
                        </div>
                        <h4 className="mt-4 sso-status-title">
                          Memproses Login SSO...
                        </h4>
                        <p className="text-muted sso-status-subtitle">
                          Harap tunggu sementara kami memverifikasi identitas Anda
                        </p>
                      </>
                    ) : error ? (
                      <>
                        <div className="sso-error-icon">
                          <i className="fas fa-times-circle"></i>
                        </div>
                        <h4 className="mt-4 sso-error-title">
                          Login Gagal
                        </h4>
                        <p className="text-danger sso-error-message">
                          {error}
                        </p>
                        <p className="text-muted sso-error-subtitle">
                          Anda akan dialihkan ke halaman login dalam beberapa detik...
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="sso-success-icon">
                          <i className="fas fa-check-circle"></i>
                        </div>
                        <h4 className="mt-4 sso-success-title">
                          Login Berhasil!
                        </h4>
                        <p className="text-success sso-success-message">
                          Anda sedang diarahkan ke dashboard...
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Additional info */}
              <div className="sso-info-box mt-4">
                <p className="text-center text-muted small">
                  <i className="fas fa-info-circle me-2"></i>
                  Login menggunakan akun Nusa DPD Anda
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}

export default SSOLogin;
