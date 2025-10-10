import React, { useState, useEffect } from 'react';
import BaseHeader from '../partials/BaseHeader';
import Footer from '../partials/Footer';
import apiInstance from '../../utils/axios';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import Toast from '../plugin/Toast';
import logo from "../../assets/logo/logo-180.png";
import './CreateNewPassword.css';

function CreateNewPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [passwordStrength, setPasswordStrength] = useState("");

  const navigate = useNavigate();
  const [searchParam] = useSearchParams();

  const otp = searchParam.get("otp");
  const uuidb64 = searchParam.get("uuidb64");
  const refresh_token = searchParam.get("refresh_token");

  const validatePassword = (password) => {
    const requirements = {
      minLength: password.length >= 8,
      hasUpper: /[A-Z]/.test(password),
      hasLower: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };

    const metCount = Object.values(requirements).filter(Boolean).length;
    
    let strength = "";
    if (metCount < 2) strength = "weak";
    else if (metCount < 3) strength = "fair";
    else if (metCount < 4) strength = "good";
    else strength = "strong";

    return { requirements, strength };
  };

  const validateForm = () => {
    const newErrors = {};

    if (!password.trim()) {
      newErrors.password = "Password is required";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters long";
    }

    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
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

    if (field === 'password') {
      setPassword(value);
      if (value) {
        const { strength } = validatePassword(value);
        setPasswordStrength(strength);
      } else {
        setPasswordStrength("");
      }
    } else if (field === 'confirmPassword') {
      setConfirmPassword(value);
    }
  };

  const handleCreatePassword = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      Toast().fire({
        icon: "error",
        title: "Please fix the errors in the form",
      });
      return;
    }

    setIsLoading(true);

    const formdata = new FormData();
    formdata.append("password", password);
    formdata.append("otp", otp);
    formdata.append("uuidb64", uuidb64);
    formdata.append("refresh_token", refresh_token);

    try {
      await apiInstance
        .post(`user/password-change/`, formdata)
        .then((res) => {
          Toast().fire({
            icon: "success",
            title: res.data.message || "Password berhasil diubah! Silakan login dengan password baru Anda.",
          });
          
          // Clear form
          setPassword("");
          setConfirmPassword("");
          setErrors({});
          setPasswordStrength("");
          
          // Redirect to login
          setTimeout(() => {
            navigate("/login/");
          }, 1500);
        });
    } catch (error) {
      console.error("Error changing password:", error);
      Toast().fire({
        icon: "error",
        title: error.response?.data?.message || "Terjadi kesalahan. Silakan coba lagi.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const { requirements } = password ? validatePassword(password) : { requirements: {} };

  return (
    <>
      <BaseHeader />

      <section className="create-password-section">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-5 col-md-7">
              <div className="card shadow border-0 create-password-card">
                <div className="card-body create-password-card-body">
                  <div className="text-center mb-4">
                    <div className="mb-3">
                      <div className="d-inline-flex align-items-center justify-content-center">
                        <div className="create-password-logo-container">
                          <img 
                            src={logo} 
                            alt="LMSetjen DPD RI Logo" 
                            className="create-password-logo"
                          />
                        </div>
                      </div>
                    </div>
                    <h3 className="create-password-title">Buat Password Baru</h3>
                    <p className="create-password-subtitle">
                      Buat password yang kuat dan aman untuk akun Anda.{' '}
                      <Link to="/login/" className="create-password-login-link">
                        Kembali ke Login
                      </Link>
                    </p>
                  </div>

                  <div className="create-password-info-box">
                    <div className="d-flex align-items-start">
                      <i className="fas fa-shield-alt create-password-info-icon"></i>
                      <p className="create-password-info-text">
                        <strong>Keamanan Password:</strong> Gunakan kombinasi huruf besar, huruf kecil, 
                        angka, dan simbol untuk password yang lebih aman.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleCreatePassword} noValidate>
                    <div className="mb-4">
                      <label htmlFor="password" className="form-label create-password-form-label">
                        <i className="fas fa-lock create-password-form-icon"></i>
                        Password Baru
                      </label>
                      <div className="position-relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          id="password"
                          name="password"
                          className={`form-control create-password-password-input ${errors.password ? 'is-invalid' : ''}`}
                          placeholder="Masukkan password baru"
                          value={password}
                          onChange={(e) => handleInputChange('password', e.target.value)}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          className="btn position-absolute end-0 top-50 translate-middle-y me-2 create-password-password-toggle"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label="Toggle password visibility"
                        >
                          <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                      </div>
                      
                      {errors.password && (
                        <div className="create-password-error-feedback mt-2">
                          <i className="fas fa-exclamation-triangle me-1"></i>
                          {errors.password}
                        </div>
                      )}

                      {password && !errors.password && (
                        <div className={`create-password-strength-indicator strength-${passwordStrength}`}>
                          <div className="create-password-strength-bar">
                            <div className="create-password-strength-fill"></div>
                          </div>
                          <p className="create-password-strength-text">
                            Password strength: {passwordStrength === 'weak' ? 'Lemah' : 
                                             passwordStrength === 'fair' ? 'Cukup' : 
                                             passwordStrength === 'good' ? 'Baik' : 'Kuat'}
                          </p>
                        </div>
                      )}

                      {password && (
                        <div className="create-password-requirements">
                          <h6>Persyaratan Password:</h6>
                          <div className={`create-password-requirement ${requirements.minLength ? 'met' : 'unmet'}`}>
                            <i className={`fas ${requirements.minLength ? 'fa-check' : 'fa-times'}`}></i>
                            Minimal 8 karakter
                          </div>
                          <div className={`create-password-requirement ${requirements.hasUpper ? 'met' : 'unmet'}`}>
                            <i className={`fas ${requirements.hasUpper ? 'fa-check' : 'fa-times'}`}></i>
                            Huruf besar (A-Z)
                          </div>
                          <div className={`create-password-requirement ${requirements.hasLower ? 'met' : 'unmet'}`}>
                            <i className={`fas ${requirements.hasLower ? 'fa-check' : 'fa-times'}`}></i>
                            Huruf kecil (a-z)
                          </div>
                          <div className={`create-password-requirement ${requirements.hasNumber ? 'met' : 'unmet'}`}>
                            <i className={`fas ${requirements.hasNumber ? 'fa-check' : 'fa-times'}`}></i>
                            Angka (0-9)
                          </div>
                          <div className={`create-password-requirement ${requirements.hasSpecial ? 'met' : 'unmet'}`}>
                            <i className={`fas ${requirements.hasSpecial ? 'fa-check' : 'fa-times'}`}></i>
                            Karakter khusus (!@#$%^&*)
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mb-4">
                      <label htmlFor="confirmPassword" className="form-label create-password-form-label">
                        <i className="fas fa-lock create-password-form-icon"></i>
                        Konfirmasi Password
                      </label>
                      <div className="position-relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          id="confirmPassword"
                          name="confirmPassword"
                          className={`form-control create-password-password-input ${errors.confirmPassword ? 'is-invalid' : ''}`}
                          placeholder="Masukkan ulang password baru"
                          value={confirmPassword}
                          onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          className="btn position-absolute end-0 top-50 translate-middle-y me-2 create-password-password-toggle"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          aria-label="Toggle confirm password visibility"
                        >
                          <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                      </div>
                      
                      {errors.confirmPassword && (
                        <div className="create-password-error-feedback mt-2">
                          <i className="fas fa-exclamation-triangle me-1"></i>
                          {errors.confirmPassword}
                        </div>
                      )}

                      {!errors.confirmPassword && confirmPassword && password === confirmPassword && (
                        <div className="create-password-valid-feedback mt-2">
                          <i className="fas fa-check-circle me-1"></i>
                          Password cocok
                        </div>
                      )}
                    </div>

                    <div className="d-grid mb-3">
                      <button 
                        type="submit" 
                        className="btn btn-lg create-password-submit-btn"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <span className="spinner-border create-password-spinner" role="status"></span>
                            Memproses...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-save me-2"></i>
                            Simpan Password Baru
                          </>
                        )}
                      </button>
                    </div>

                    <div className="text-center">
                      <small className="text-muted" style={{ userSelect: 'none' }}>
                        Butuh bantuan?{' '}
                        <a href="#" className="create-password-help-link">
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
  )
}

export default CreateNewPassword