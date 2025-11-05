import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

import { login, redirectUserByRole } from "../../utils/auth";
import { useAuthStore } from "../../store/auth";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import Toast from "../plugin/Toast";
import UserData from "../plugin/UserData";
import logoPNG from "../../assets/logo/logo-192.png";
import './Login.css';

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

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

  const validateForm = () => {
    const newErrors = {};

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!password.trim()) {
      newErrors.password = "Password is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    if (errors[field]) {
      setErrors({
        ...errors,
        [field]: ""
      });
    }

    if (field === 'email') {
      setEmail(value);
    } else if (field === 'password') {
      setPassword(value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      Toast().fire({
        icon: "error",
        title: "Please fix the errors in the form",
      });
      return;
    }

    // Check network connectivity
    if (!navigator.onLine) {
      Toast().fire({
        icon: "error",
        title: "Tidak ada koneksi internet. Periksa koneksi Anda.",
      });
      return;
    }

    setIsLoading(true);
    
    // Set a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setIsLoading(false);
      Toast().fire({
        icon: "error",
        title: "Request timeout. Silakan coba lagi.",
      });
    }, 30000); // 30 seconds timeout
    
    try {
      const { data, error, errorDetails } = await login(email, password);
      clearTimeout(timeoutId); // Clear timeout if request completes
      
      if (error) {
        console.error("Login failed:", error, errorDetails);
        
        let errorMessage = "Login failed. Please try again.";
        
        if (error.includes("Invalid") || error.includes("credentials") || 
            error.includes("No active account") || error.includes("detail")) {
          errorMessage = "Email atau password salah. Silakan periksa kembali.";
        } else if (error.includes("User account is disabled")) {
          errorMessage = "Akun Anda telah dinonaktifkan. Silakan hubungi support.";
        } else if (error.includes("Email not verified")) {
          errorMessage = "Silakan verifikasi email Anda terlebih dahulu.";
        } else if (error.includes("Network error")) {
          errorMessage = "Koneksi bermasalah. Periksa koneksi internet Anda.";
        } else if (error.includes("Server error")) {
          errorMessage = "Server bermasalah. Silakan coba lagi nanti.";
        } else {
          errorMessage = error;
        }

        Toast().fire({
          icon: "error",
          title: errorMessage,
        });
      } else if (data) {
        Toast().fire({
          icon: "success",
          title: "Login berhasil! Selamat datang kembali.",
        });

        // Clear form
        setEmail("");
        setPassword("");
        setErrors({});
        setShowPassword(false);

        // Get user data and redirect based on role
        setTimeout(() => {
          try {
            const userData = UserData();
            if (userData && userData.role) {
              redirectUserByRole(userData);
            } else {
              navigate("/student/dashboard/");
            }
          } catch (redirectError) {
            console.error("Redirect error:", redirectError);
            navigate("/student/dashboard/");
          }
        }, 1500);
      }
    } catch (unexpectedError) {
      console.error("Unexpected login error:", unexpectedError);
      clearTimeout(timeoutId);
      Toast().fire({
        icon: "error",
        title: "Terjadi kesalahan yang tidak terduga. Silakan coba lagi.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <>
      <BaseHeader />

      <section className="login-section">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-5 col-md-7">
              <div className="card shadow border-0 login-card">
                <div className="card-body login-card-body">
                  <div className="text-center mb-4">
                    <div className="mb-3">
                      <div className="d-inline-flex align-items-center justify-content-center">
                        <div className="login-logo-container">
                          <img 
                            src={logoPNG} 
                            alt="LMSetjen DPD RI Logo" 
                            className="login-logo"
                          />
                        </div>
                      </div>
                    </div>
                    <h3 className="login-title">Selamat Datang Kembali</h3>
                    <p className="login-subtitle">
                      Belum memiliki akun?{' '}
                      <Link to="/register/" className="login-register-link">
                        Daftar di sini
                      </Link>
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} noValidate>
                    <div className="mb-3">
                      <label htmlFor="email" className="form-label login-form-label">
                        <i className="fas fa-envelope login-form-icon"></i>
                        Alamat Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        className={`form-control login-input ${errors.email ? 'is-invalid' : ''}`}
                        placeholder="contoh@email.com"
                        value={email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        autoComplete="off"
                      />
                      {errors.email && (
                        <div className="login-error-feedback">
                          <i className="fas fa-exclamation-triangle me-1"></i>
                          {errors.email}
                        </div>
                      )}
                      {!errors.email && email && (
                        <div className="login-valid-feedback">
                          <i className="fas fa-check-circle me-1"></i>
                          Email valid
                        </div>
                      )}
                    </div>

                    <div className="mb-3">
                      <label htmlFor="password" className="form-label login-form-label">
                        <i className="fas fa-lock login-form-icon"></i>
                        Password
                      </label>
                      <div className="password-input-wrapper">
                        <input
                          type={showPassword ? "text" : "password"}
                          id="password"
                          name="password"
                          className={`form-control login-password-input ${errors.password ? 'is-invalid' : ''}`}
                          placeholder="Masukkan password Anda"
                          value={password}
                          onChange={(e) => handleInputChange('password', e.target.value)}
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          className="password-visibility-toggle"
                          onClick={togglePasswordVisibility}
                          aria-label="Toggle password visibility"
                        >
                          <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                      </div>
                      {errors.password && (
                        <div className="login-error-feedback mt-2">
                          <i className="fas fa-exclamation-triangle me-1"></i>
                          {errors.password}
                        </div>
                      )}
                      {!errors.password && password && (
                        <div className="login-valid-feedback mt-2">
                          <i className="fas fa-check-circle me-1"></i>
                          Password valid
                        </div>
                      )}
                    </div>

                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input login-checkbox"
                          id="rememberme"
                        />
                        <label className="form-check-label text-muted" htmlFor="rememberme">
                          Ingat saya
                        </label>
                      </div>
                      <Link to="/forgot-password/" className="login-forgot-link">
                        Lupa password?
                      </Link>
                    </div>

                    <div className="d-grid mb-3">
                      <button 
                        type="submit" 
                        className="btn btn-lg login-submit-btn"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <span className="spinner-border login-spinner" role="status" aria-hidden="true"></span>
                            <strong>Memproses Login...</strong>
                          </>
                        ) : (
                          <>
                            <i className="fas fa-sign-in-alt me-2"></i>
                            Masuk Sekarang
                          </>
                        )}
                      </button>
                    </div>

                    <div className="text-center">
                      <small className="text-muted" style={{ userSelect: 'none' }}>
                        Butuh bantuan?{' '}
                        <a href="#" className="login-help-link">
                          Hubungi Support
                        </a>
                      </small>
                    </div>
                  </form>
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