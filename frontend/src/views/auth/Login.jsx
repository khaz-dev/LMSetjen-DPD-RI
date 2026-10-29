import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

import { redirectUserByRole, setAuthUser, logout } from "../../utils/auth";
import { useAuthStore } from "../../store/auth";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import Toast from "../plugin/Toast";
import UserData from "../plugin/UserData";
import apiInstance from "../../utils/useAxios";
import RoleSelectionModal from "../../components/RoleSelectionModal";
import logoWebP from "../../assets/logo/logo-192.webp";
import logoPNG from "../../assets/logo/logo-192.png";
import logoNusaWebP from "../../assets/logo_nusa.webp";
import logoNusa from "../../assets/logo_nusa.png";
import "./Login.css";

function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Multi-role support
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const navigate = useNavigate();
  const { isLoggedIn, setAuthToken } = useAuthStore();

  // Clear any stale logout flag when user visits login page
  useEffect(() => {
    sessionStorage.removeItem("logging_out");
  }, []);

  // Lock body/html scroll on login page to ensure strict single-viewport fit
  useEffect(() => {
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyHeight = document.body.style.height;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.height = "100vh";

    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.height = originalBodyHeight;
    };
  }, []);

  useEffect(() => {
    if (isLoggedIn()) {
      Toast().fire({
        icon: "info",
        title: "You are already logged in",
      });
      navigate("/");
    }
  }, [isLoggedIn, navigate]);

  // Handle Google OAuth callback on page load
  useEffect(() => {
    // Check if user is already logged in
    if (isLoggedIn()) {
      return;
    }

    // Check if we're returning from Google OAuth with a callback token
    const urlParams = new URLSearchParams(window.location.search);
    const googleToken = urlParams.get("google_token");

    if (googleToken) {
      // Handle callback token if provided
      handleGoogleCallbackToken(googleToken);
    }
  }, [isLoggedIn]);

  // Listen for messages from OAuth popup
  useEffect(() => {
    const handlePopupMessage = async (event) => {
      // Verify message is from same origin
      if (event.origin !== window.location.origin) {
        console.warn(
          "⚠️ Ignoring message from untrusted origin:",
          event.origin,
        );
        return;
      }

      console.log("📨 Message received from popup:", event.data.type);

      if (event.data.type === "OAUTH_LOGIN_SUCCESS") {
        console.log("✅ OAuth login successful!");
        const result = event.data.data;

        try {
          // Explicitly clear logging_out flag and store tokens
          sessionStorage.removeItem("logging_out");
          setAuthUser(result.access, result.refresh);

          // Check if user has multiple roles
          if (
            result.user.available_roles &&
            result.user.available_roles.length > 1
          ) {
            console.log(
              "👥 Multi-role user detected:",
              result.user.available_roles,
            );

            // Store user data and roles for role selection modal
            setCurrentUser({
              full_name: result.user.full_name,
              email: result.user.email,
              nip: result.user.nip,
            });
            setAvailableRoles(result.user.available_roles);
            setShowRoleModal(true);

            Toast().fire({
              icon: "info",
              title: "Pilih Peran Anda",
              text: "Anda memiliki akses dengan beberapa peran.",
            });
          } else {
            // Single role user - redirect directly
            console.log("👤 Single-role user:", result.user.role);

            Toast().fire({
              icon: "success",
              title: "Login Berhasil!",
              text: `Selamat datang, ${result.user.full_name}!`,
            });

            redirectUserByRole(result.user.role);
          }
        } catch (err) {
          console.error("❌ Error handling login success:", err);
        }
      } else if (event.data.type === "OAUTH_LOGIN_ERROR") {
        console.error("❌ OAuth login error from popup:", event.data.error);
        Toast().fire({
          icon: "error",
          title: "Login Gagal",
          text: event.data.error,
        });
      }
    };

    window.addEventListener("message", handlePopupMessage);

    return () => {
      window.removeEventListener("message", handlePopupMessage);
    };
  }, []);

  // Initialize Google Sign-In once on component mount
  useEffect(() => {
    const initGoogleSignIn = () => {
      if (!window.google || !window.google.accounts) {
        console.warn("🔍 Google Sign-In API not loaded yet, retrying...");
        setTimeout(initGoogleSignIn, 500);
        return;
      }

      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId) {
        console.error("❌ Client ID not configured");
        return;
      }

      try {
        console.log("🧰 Initializing Google Sign-In OAuth...");

        // Initialize with stable, working configuration
        // Note: FedCM requires additional backend credential endpoint setup
        // Using standard OAuth popup flow for now
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleResponse,
          ux_mode: "popup",
          auto_select: false,
          use_fedcm_for_prompt: false, // Disabled for now - use standard popup
          itp_support: true, // Better support for ITP (Intelligent Tracking Prevention)
        });

        console.log("✅ Google Sign-In initialized successfully");
      } catch (err) {
        console.error("❌ Failed to initialize Google Sign-In:", err);
      }
    };

    initGoogleSignIn();
  }, []);

  // Handle OAuth callback from Google redirect (in the popup)
  useEffect(() => {
    const handleOAuthCallback = async () => {
      // Check if this is a popup window (has an opener)
      const isPopup = window.opener !== null;

      if (!isPopup) {
        // This is the parent window, not the popup - skip
        return;
      }

      console.log("🪟 This is a popup window - checking for OAuth token...");

      // Get token from URL hash
      const urlParams = new URLSearchParams(window.location.hash.substring(1));
      const idToken = urlParams.get("id_token");
      const accessToken = urlParams.get("access_token");

      if (idToken || accessToken) {
        console.log("📨 OAuth callback received in popup from Google");
        const token = idToken || accessToken;

        try {
          console.log("✅ Token received, length:", token.length);

          // Send token to backend
          console.log("📤 Sending token to backend at /auth/google/");
          const result = await apiInstance.post("/auth/google/", {
            token: token,
            token_type: idToken ? "id_token" : "access_token",
          });

          if (result.data && result.data.access) {
            console.log("✅ Backend authentication successful");
            console.log("📊 User data:", result.data.user.email);

            // Send result back to parent window via postMessage
            console.log("📤 Sending login result to parent window...");
            window.opener.postMessage(
              {
                type: "OAUTH_LOGIN_SUCCESS",
                data: result.data,
              },
              window.location.origin,
            );

            // Close popup after a short delay to ensure message is received
            setTimeout(() => {
              console.log("🪟 Closing popup window...");
              window.close();
            }, 500);
          } else {
            throw new Error("Invalid response from backend");
          }
        } catch (err) {
          console.error("❌ OAuth Callback Error in popup:", err);

          // Send error back to parent window
          window.opener.postMessage(
            {
              type: "OAUTH_LOGIN_ERROR",
              error: err.response?.data?.error || err.message || "Login failed",
            },
            window.location.origin,
          );

          // Close popup after a short delay
          setTimeout(() => {
            window.close();
          }, 2000);
        }
      } else {
        console.log("ℹ️ No token in URL hash - not an OAuth callback");
      }
    };

    handleOAuthCallback();
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("🔍 Google login button clicked - opening OAuth popup...");

      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId) {
        throw new Error("Google Client ID not configured");
      }

      console.log(
        "📱 Opening Google OAuth flow with client ID:",
        clientId.substring(0, 20) + "...",
      );

      // Build the Google OAuth authorization URL for popup flow
      // This uses the implicit flow which is designed for browser-based apps
      const redirectUri = window.location.origin + "/login";
      const scope = ["openid", "profile", "email"].join(" ");

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "id_token token");
      authUrl.searchParams.set("scope", scope);
      authUrl.searchParams.set(
        "nonce",
        Math.random().toString(36).substring(7),
      );
      authUrl.searchParams.set("prompt", "consent");

      console.log("🔗 Opening OAuth URL...");

      // Open in popup window for better UX
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl.toString(),
        "google-oauth-popup",
        `width=${width},height=${height},left=${left},top=${top}`,
      );

      if (!popup) {
        throw new Error("Popup blocked - please allow popups and try again");
      }

      console.log("✅ OAuth popup opened");
      setIsLoading(false);
    } catch (err) {
      console.error("❌ Google Login Error:", err);
      const errorMsg = err.message || "Failed to initiate Google login";
      setError(errorMsg);
      setIsLoading(false);
      Toast().fire({
        icon: "error",
        title: "Google Login Error",
        text: errorMsg,
      });
    }
  };

  const handleGoogleResponse = async (response) => {
    console.log("📨 handleGoogleResponse called with response:", response);

    if (!response.credential) {
      console.error("❌ No credential in response:", response);
      Toast().fire({
        icon: "error",
        title: "Login Failed",
        text: "No credentials received from Google",
      });
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      console.log(
        "✅ Google credential received, token length:",
        response.credential.length,
      );

      // Send the ID token to backend
      console.log("📤 Sending token to backend at /auth/google/");
      const result = await apiInstance.post("/auth/google/", {
        token: response.credential,
        token_type: "id_token",
      });

      if (result.data && result.data.access) {
        console.log("✅ Backend authentication successful");
        console.log("📊 User data received:", result.data.user);

        // Store tokens using setAuthUser
        setAuthUser(result.data.access, result.data.refresh);

        // Check if user has multiple roles
        if (
          result.data.user.available_roles &&
          result.data.user.available_roles.length > 1
        ) {
          console.log(
            "👥 Multi-role user detected:",
            result.data.user.available_roles,
          );

          // Store user data and roles for role selection modal
          setCurrentUser({
            full_name: result.data.user.full_name,
            email: result.data.user.email,
            nip: result.data.user.nip,
          });
          setAvailableRoles(result.data.user.available_roles);
          setShowRoleModal(true);

          Toast().fire({
            icon: "info",
            title: "Pilih Peran Anda",
            text: "Anda memiliki akses dengan beberapa peran.",
          });
        } else {
          // Single role user - redirect directly
          console.log("👤 Single-role user:", result.data.user.role);

          Toast().fire({
            icon: "success",
            title: "Login Berhasil!",
            text: `Selamat datang, ${result.data.user.full_name}!`,
          });

          redirectUserByRole(result.data.user.role);
        }
      } else {
        console.error("❌ Invalid backend response:", result.data);
        throw new Error("Invalid response from backend");
      }
    } catch (err) {
      console.error("❌ Google Login Backend Error:", err);
      console.error("Error response:", err.response?.data);
      console.error("Error status:", err.response?.status);
      const errorMessage =
        err.response?.data?.error || err.message || "Login failed";
      setError(errorMessage);
      Toast().fire({
        icon: "error",
        title: "Login Gagal",
        text: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleCallbackToken = async (token) => {
    try {
      setIsLoading(true);

      // Send access token to backend
      const result = await apiInstance.post("/auth/google/", {
        access_token: token,
        token_type: "access_token",
      });

      if (result.data && result.data.access) {
        // Store tokens using setAuthUser
        setAuthUser(result.data.access, result.data.refresh);

        // Check if user has multiple roles
        if (
          result.data.user.available_roles &&
          result.data.user.available_roles.length > 1
        ) {
          console.log(
            "👥 Multi-role user detected:",
            result.data.user.available_roles,
          );

          // Store user data and roles for role selection modal
          setCurrentUser({
            full_name: result.data.user.full_name,
            email: result.data.user.email,
            nip: result.data.user.nip,
          });
          setAvailableRoles(result.data.user.available_roles);
          setShowRoleModal(true);

          Toast().fire({
            icon: "info",
            title: "Pilih Peran Anda",
            text: "Anda memiliki akses dengan beberapa peran.",
          });
        } else {
          // Single role user - redirect directly
          console.log("👤 Single-role user:", result.data.user.role);

          Toast().fire({
            icon: "success",
            title: "Login Berhasil!",
            text: `Selamat datang, ${result.data.user.full_name}!`,
          });

          // Redirect based on user role
          redirectUserByRole(result.data.user.role);
        }
      }
    } catch (err) {
      console.error("❌ Google Callback Error:", err);
      const errorMessage =
        err.response?.data?.error || err.message || "Login failed";
      setError(errorMessage);
      Toast().fire({
        icon: "error",
        title: "Login Gagal",
        text: errorMessage,
      });
    } finally {
      setIsLoading(false);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
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

    // Clear auth data properly using logout()
    logout();
  };

  return (
    <div className="login-page-wrapper">
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

      <main className="login-main-content">
        <section className="login-section">
        <div className="login-container">
          <div className="login-card-container">
            {/* Left Brand Panel */}
            <div className="login-brand-panel">
              <div className="login-brand-decor-circle circle-1"></div>
              <div className="login-brand-decor-circle circle-2"></div>

              <div className="login-brand-content">
                <div className="login-brand-top">
                  <div className="login-brand-badge">
                    <i className="fas fa-shield-alt"></i> Portal Resmi
                  </div>

                  <div className="login-brand-header">
                    <div className="login-brand-logo-wrap">
                      <picture>
                        <source srcSet={logoWebP} type="image/webp" />
                        <img
                          src={logoPNG}
                          alt="LMSetjen DPD RI Logo"
                          className="login-brand-logo"
                          width="52"
                          height="52"
                          loading="eager"
                          decoding="async"
                        />
                      </picture>
                    </div>
                    <div>
                      <h2 className="login-brand-title">LMSetjen DPD RI</h2>
                      <p className="login-brand-subtitle">
                        Sistem Manajemen Pembelajaran Digital
                      </p>
                    </div>
                  </div>
                </div>

                <div className="login-features-list">
                  <div className="login-feature-item">
                    <div className="login-feature-icon">
                      <i className="fas fa-graduation-cap"></i>
                    </div>
                    <div className="login-feature-text">
                      <strong>Modul & Pelatihan Digital</strong>
                      <span>Akses materi terstruktur kapan saja & di mana saja.</span>
                    </div>
                  </div>

                  <div className="login-feature-item">
                    <div className="login-feature-icon">
                      <i className="fas fa-key"></i>
                    </div>
                    <div className="login-feature-text">
                      <strong>Single Sign-On Nusa</strong>
                      <span>Autentikasi terpusat & aman via portal Nusa DPD.</span>
                    </div>
                  </div>

                  <div className="login-feature-item">
                    <div className="login-feature-icon">
                      <i className="fas fa-award"></i>
                    </div>
                    <div className="login-feature-text">
                      <strong>Sertifikasi Resmi</strong>
                      <span>Peroleh sertifikat digital atas capaian kompetensi.</span>
                    </div>
                  </div>
                </div>

                <div className="login-brand-footer">
                  <div className="login-trust-pill">
                    <i className="fas fa-lock"></i>
                    <span>Terenkripsi & Terlindungi</span>
                  </div>
                  <span className="login-brand-copyright">Sekretariat Jenderal DPD RI</span>
                </div>
              </div>
            </div>

            {/* Right Authentication Panel */}
            <div className="login-auth-panel">
              <div className="login-auth-header">
                <span className="login-auth-tag">Selamat Datang</span>
                <h1 className="login-auth-title">Masuk ke Akun Anda</h1>
                <p className="login-auth-subtitle">
                  Pilih metode masuk resmi untuk mengakses sistem pembelajaran
                </p>
              </div>

              {error && (
                <div
                  className="alert alert-danger alert-dismissible fade show login-alert"
                  role="alert"
                >
                  <i className="fas fa-exclamation-circle me-2"></i>
                  <span>{error}</span>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setError(null)}
                    aria-label="Close"
                  ></button>
                </div>
              )}

              <div className="login-methods-wrap">
                {/* Primary Method: SSO Nusa DPD */}
                <div className="login-method-group">
                  <a
                    href="https://nusa.dpd.go.id?app=LMS"
                    className="login-method-card sso-card"
                    title="Login menggunakan akun SSO Nusa DPD"
                  >
                    <div className="login-method-icon-box nusa-icon-box">
                      <picture>
                        <source srcSet={logoNusaWebP} type="image/webp" />
                        <img
                          src={logoNusa}
                          alt="Nusa Logo"
                          width="28"
                          height="28"
                          loading="eager"
                          decoding="async"
                          className="nusa-logo-img"
                        />
                      </picture>
                    </div>
                    <div className="login-method-details">
                      <div className="login-method-title-row">
                        <span className="login-method-name">Login dengan SSO Nusa DPD</span>
                        <span className="login-badge-recommended">Pegawai DPD</span>
                      </div>
                      <span className="login-method-desc">
                        Otentikasi cepat untuk Pegawai Setjen DPD RI
                      </span>
                    </div>
                    <div className="login-method-arrow">
                      <i className="fas fa-arrow-right"></i>
                    </div>
                  </a>
                </div>

                {/* Divider */}
                <div className="login-card-divider">
                  <span>atau masuk dengan</span>
                </div>

                {/* Secondary Method: Google Login */}
                <div className="login-method-group">
                  <button
                    type="button"
                    id="google-login-btn"
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="login-method-card google-card"
                    title="Login menggunakan akun Google"
                  >
                    <div className="login-method-icon-box google-icon-box">
                      {!isLoading ? (
                        <svg
                          className="google-svg-icon"
                          viewBox="0 0 24 24"
                          width="24"
                          height="24"
                        >
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                      ) : (
                        <span
                          className="spinner-border spinner-border-sm"
                          role="status"
                          aria-hidden="true"
                          style={{ width: "1.25rem", height: "1.25rem", color: "#0f766e" }}
                        ></span>
                      )}
                    </div>
                    <div className="login-method-details">
                      <div className="login-method-title-row">
                        <span className="login-method-name">
                          {isLoading ? "Menghubungkan ke Google..." : "Akun Google"}
                        </span>
                      </div>
                      <span className="login-method-desc">
                        Masuk menggunakan email Google terdaftar
                      </span>
                    </div>
                    <div className="login-method-arrow">
                      <i className="fas fa-arrow-right"></i>
                    </div>
                  </button>
                </div>
              </div>

              {/* Security note & Help */}
              <div className="login-auth-footer">
                <div className="login-security-notice">
                  <i className="fas fa-shield-halved"></i>
                  <span>Otentikasi aman terenkripsi institusi DPD RI</span>
                </div>

                <div className="login-help-text">
                  <span>Butuh bantuan?</span>{" "}
                  <a href="mailto:pusdiklat@dpd.go.id" className="login-help-link">
                    Hubungi Administrator
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default Login;
