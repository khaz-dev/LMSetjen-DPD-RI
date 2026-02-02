import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

import { redirectUserByRole, setAuthUser } from "../../utils/auth";
import { useAuthStore } from "../../store/auth";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import Toast from "../plugin/Toast";
import UserData from "../plugin/UserData";
import apiInstance from "../../utils/useAxios";
import logoPNG from "../../assets/logo/logo-192.png";
import "./Login.css";

function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [googleButtonReady, setGoogleButtonReady] = useState(false);

  const navigate = useNavigate();
  const { isLoggedIn } = useAuthStore();

  useEffect(() => {
    if (isLoggedIn()) {
      Toast().fire({
        icon: "info",
        title: "You are already logged in",
      });
      navigate("/");
    }
  }, [isLoggedIn, navigate]);

  // Initialize Google Sign-In
  useEffect(() => {
    const initGoogleSignIn = () => {
      if (!window.google || !window.google.accounts) {
        console.log("🔍 Google API not ready yet, scheduling retry...");
        setTimeout(initGoogleSignIn, 1000);
        return;
      }

      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId) {
        console.error("❌ VITE_GOOGLE_CLIENT_ID tidak dikonfigurasi");
        setError("Google Client ID tidak dikonfigurasi");
        return;
      }

      try {
        console.log("✅ Initializing Google Sign-In API...");
        
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredentialResponse,
          ux_mode: "popup",
          auto_select: false,
        });

        console.log("✅ Google Sign-In initialization complete");
        setGoogleButtonReady(true);

      } catch (err) {
        console.error("❌ Kesalahan inisialisasi Google:", err);
        setError("Gagal menginisialisasi Google Sign-In");
      }
    };

    initGoogleSignIn();
  }, []);

  const handleGoogleCredentialResponse = async (response) => {
    console.log("📨 Google credential received");
    console.log("Token preview:", response.credential.substring(0, 50) + "...");

    try {
      setIsLoading(true);
      
      if (!response.credential) {
        throw new Error("No credential received from Google");
      }

      // Decode the JWT to see what we have (for debugging)
      const parts = response.credential.split(".");
      if (parts.length === 3) {
        try {
          const decoded = JSON.parse(atob(parts[1]));
          console.log("📋 Decoded token claims:", {
            iss: decoded.iss,
            aud: decoded.aud,
            sub: decoded.sub,
            email: decoded.email,
            name: decoded.name,
          });
        } catch (e) {
          console.log("Could not decode token for inspection");
        }
      }

      console.log("🔄 Sending credential to backend...");
      console.log("Backend URL:", import.meta.env.VITE_API_URL || "http://localhost:8001");

      // Send to backend for verification
      const response_data = await apiInstance.post("/auth/google/", {
        token: response.credential,
        token_type: "id_token"
      });

      console.log("✅ Backend authentication successful");
      console.log("Response:", response_data.data);

      if (response_data.data && response_data.data.access) {
        // Store the tokens
        setAuthUser(response_data.data.access, response_data.data.refresh);

        Toast().fire({
          icon: "success",
          title: "Login Berhasil!",
          text: `Selamat datang, ${response_data.data.user.full_name}!`,
        });

        // Redirect by role
        redirectUserByRole(response_data.data.user.role);
      } else {
        throw new Error("Invalid response from backend");
      }

    } catch (err) {
      console.error("❌ Authentication error:", err);
      const errorMsg = err.response?.data?.error || err.message || "Autentikasi gagal";
      setError(errorMsg);
      setIsLoading(false);

      Toast().fire({
        icon: "error",
        title: "Login Gagal",
        text: errorMsg,
      });
    }
  };

  const handleGoogleLogin = async () => {
    console.log("🔍 Google login button clicked");
    setIsLoading(true);
    setError(null);

    try {
      if (!window.google || !window.google.accounts) {
        throw new Error("Google Sign-In API tidak dimuat. Silakan refresh halaman.");
      }

      console.log("🎯 Triggering Google One Tap UI...");
      
      // Trigger the One Tap UI
      window.google.accounts.id.prompt((notification) => {
        console.log("📢 One Tap UI notification:");
        console.log("  - Not displayed:", notification.isNotDisplayed());
        console.log("  - Skipped:", notification.isSkippedMoment());
        console.log("  - Dismissed:", notification.isDismissedMoment());
        console.log("  - Displayed:", notification.isDisplayed());

        // If One Tap didn't show, we're now waiting for the callback
        if (notification.isNotDisplayed() || notification.isDismissedMoment()) {
          console.log("ℹ️ One Tap UI did not display - waiting for manual sign-in");
          // Keep loading state visible for user
        }
      });

    } catch (err) {
      console.error("❌ Error triggering Google login:", err);
      setError(err.message || "Gagal memulai login Google");
      setIsLoading(false);

      Toast().fire({
        icon: "error",
        title: "Kesalahan",
        text: err.message || "Gagal memulai login Google",
      });
    }
  };

  return (
    <>
      <BaseHeader />

      <section className="container my-5">
        <div className="row">
          <div className="col-lg-5 mx-auto">
            <div className="card shadow">
              <div className="card-body p-5">
                <div className="text-center mb-4">
                  <img src={logoPNG} alt="LMSetjen DPD RI" style={{ maxHeight: "80px" }} />
                  <h3 className="mt-3 fw-bold">Masuk</h3>
                  <p className="text-muted">Sistem Pembelajaran LMSetjen DPD RI</p>
                </div>

                {error && (
                  <div className="alert alert-danger alert-dismissible fade show" role="alert">
                    <strong>Kesalahan!</strong> {error}
                    <button type="button" className="btn-close" onClick={() => setError(null)}></button>
                  </div>
                )}

                <div className="d-grid">
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isLoading || !googleButtonReady}
                    className="btn btn-lg mb-3"
                    style={{
                      backgroundColor: "#FFFFFF",
                      color: "#425A7A",
                      border: "2px solid #4285F4",
                      fontWeight: "600",
                      fontSize: "16px",
                      opacity: isLoading ? 0.7 : 1,
                      cursor: isLoading ? "wait" : "pointer",
                      transition: "all 0.3s ease"
                    }}
                    onMouseOver={(e) => {
                      if (!isLoading && googleButtonReady) {
                        e.target.style.backgroundColor = "#F8F9FA";
                        e.target.style.boxShadow = "0 2px 8px rgba(66, 133, 244, 0.2)";
                      }
                    }}
                    onMouseOut={(e) => {
                      e.target.style.backgroundColor = "#FFFFFF";
                      e.target.style.boxShadow = "none";
                    }}
                  >
                    {!isLoading ? (
                      <>
                        <svg 
                          className="me-2" 
                          style={{ width: "24px", height: "24px", display: "inline-block", verticalAlign: "middle" }} 
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Masuk dengan Google
                      </>
                    ) : (
                      <>
                        <span 
                          className="spinner-border spinner-border-sm me-2" 
                          role="status" 
                          aria-hidden="true"
                        ></span>
                        Memproses...
                      </>
                    )}
                  </button>
                </div>

                {!googleButtonReady && !error && (
                  <div className="alert alert-info mt-3">
                    <small>🔄 Memuat Google Sign-In...</small>
                  </div>
                )}

                <hr />

                <p className="text-center text-muted small">
                  Gunakan akun Google Anda untuk masuk ke sistem
                </p>

                <div id="g_id_onload"
                  data-client_id={import.meta.env.VITE_GOOGLE_CLIENT_ID}
                  data-callback="handleGoogleCredentialResponse"
                  style={{ display: "none" }}>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}

export default Login;
