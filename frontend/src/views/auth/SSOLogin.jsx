import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import Toast from '../plugin/Toast';
import UserData from '../plugin/UserData';
import apiInstance from '../../utils/axios';
import BaseHeader from '../partials/BaseHeader';
import Footer from '../partials/Footer';
import { setAuthUser } from '../../utils/auth';
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

      // Store tokens in cookies AND update auth store
      import('js-cookie').then(Cookie => {
        Cookie.default.set('access_token', access, {
          expires: 7,
          secure: false, // Allow localhost (change to true for HTTPS)
          sameSite: 'Lax', // Changed from Strict for localhost compatibility
        });
        Cookie.default.set('refresh_token', refresh, {
          expires: 7,
          secure: false, // Allow localhost
          sameSite: 'Lax', // Changed from Strict for localhost
        });

        console.log("🍪 Tokens stored successfully");
        console.log("Access token cookie:", Cookie.default.get('access_token') ? `${Cookie.default.get('access_token').substring(0, 20)}...` : "NOT FOUND");
        console.log("Refresh token cookie:", Cookie.default.get('refresh_token') ? `${Cookie.default.get('refresh_token').substring(0, 20)}...` : "NOT FOUND");

        // CRITICAL: Update auth store with user data
        console.log("📝 Updating auth store with user data...");
        useAuthStore.getState().setUser({
          user_id: user?.id,
          username: user?.email, // Use email as username for display
          email: user?.email,
          full_name: user?.full_name,
          role: user?.role,
          nip: user?.nip,  // Include NIP for identity
          is_active: user?.is_active,
        });
        console.log("✅ Auth store updated successfully");

        // CRITICAL: Also call setAuthUser to decode and store tokens properly
        // This ensures all interceptors and auth utilities recognize the login
        setAuthUser(access, refresh);

        // Show success message
        const statusMessage = created 
          ? "Welcome! Your account has been created via SSO."
          : "Welcome back! Logged in via SSO.";

        Toast().fire({
          icon: "success",
          title: statusMessage,
        });

        // Redirect based on user role
        console.log("👤 User data:", user);
        console.log("User role:", user?.role);
        console.log("User NIP:", user?.nip);

        setTimeout(() => {
          try {
            const userData = UserData();
            console.log("UserData from store:", userData);
            const authStoreData = useAuthStore.getState().allUserData;
            console.log("Auth store data:", authStoreData);
            
            // Use role from either source (userData or authStore)
            const userRole = user?.role || authStoreData?.role || 'student';
            console.log("Final user role for redirect:", userRole);
            
            switch (userRole) {
              case 'admin':
                navigate('/admin/dashboard/');
                break;
              case 'teacher':
                navigate('/instructor/dashboard/');
                break;
              case 'student':
              default:
                navigate('/student/dashboard/');
                break;
            }
          } catch (redirectError) {
            console.error("⚠️ Redirect error:", redirectError);
            navigate('/student/dashboard/');
          }
        }, 1500);
      });

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
      }, 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <BaseHeader />

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
