import React, { useState, useEffect } from 'react';
import BaseHeader from '../partials/BaseHeader';
import Footer from '../partials/Footer';
import { Link } from 'react-router-dom';
import apiInstance from '../../utils/axios';
import Toast from '../plugin/Toast';
import logo from "../../assets/logo/logo-180.png";
import './ForgotPassword.css';

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);

  const validateForm = () => {
    const newErrors = {};

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (value) => {
    if (errors.email) {
      setErrors({
        ...errors,
        email: ""
      });
    }
    setEmail(value);
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      Toast().fire({
        icon: "error",
        title: "Please fix the errors in the form",
      });
      return;
    }

    setIsLoading(true);
    setSuccess(false);

    try {
      await apiInstance.get(`user/password-reset/${email}/`).then((res) => {
        setSuccess(true);
        Toast().fire({
          icon: "success",
          title: "Email untuk reset password telah dikirim. Silahkan cek email Anda.",
        });
      });
    } catch (error) {
      console.error("Error resetting password:", error);
      Toast().fire({
        icon: "error",
        title: "Terjadi kesalahan. Silahkan coba lagi.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <BaseHeader />

      <section className="forgot-password-section">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-5 col-md-7">
              <div className="card shadow border-0 forgot-password-card">
                <div className="card-body forgot-password-card-body">
                  <div className="text-center mb-4">
                    <div className="mb-3">
                      <div className="d-inline-flex align-items-center justify-content-center">
                        <div className="forgot-password-logo-container">
                          <img 
                            src={logo} 
                            alt="LMSetjen DPD RI Logo" 
                            className="forgot-password-logo"
                          />
                        </div>
                      </div>
                    </div>
                    <h3 className="forgot-password-title">Lupa Password?</h3>
                    <p className="forgot-password-subtitle">
                      Masukkan email Anda dan kami akan mengirimkan link untuk reset password.{' '}
                      <Link to="/login/" className="forgot-password-login-link">
                        Kembali ke Login
                      </Link>
                    </p>
                  </div>

                  {!success && (
                    <div className="forgot-password-info-box">
                      <div className="d-flex align-items-start">
                        <i className="fas fa-info-circle forgot-password-info-icon"></i>
                        <p className="forgot-password-info-text">
                          Masukkan alamat email yang terdaftar di akun Anda. Kami akan mengirimkan 
                          instruksi untuk mengatur ulang password ke email tersebut.
                        </p>
                      </div>
                    </div>
                  )}

                  {success && (
                    <div className="alert alert-success" role="alert">
                      <div className="d-flex align-items-start">
                        <i className="fas fa-check-circle me-2" style={{ color: '#198754', marginTop: '2px' }}></i>
                        <div>
                          <strong>Email berhasil dikirim!</strong>
                          <p className="mb-0 mt-1">
                            Silahkan cek email Anda dan ikuti instruksi untuk reset password.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleEmailSubmit} noValidate>
                    <div className="mb-4">
                      <label htmlFor="email" className="form-label forgot-password-form-label">
                        <i className="fas fa-envelope forgot-password-form-icon"></i>
                        Alamat Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        className={`form-control forgot-password-input ${errors.email ? 'is-invalid' : ''}`}
                        placeholder="contoh@email.com"
                        value={email}
                        onChange={(e) => handleInputChange(e.target.value)}
                        autoComplete="email"
                        disabled={success}
                      />
                      {errors.email && (
                        <div className="forgot-password-error-feedback">
                          <i className="fas fa-exclamation-triangle me-1"></i>
                          {errors.email}
                        </div>
                      )}
                      {!errors.email && email && !success && (
                        <div className="forgot-password-valid-feedback">
                          <i className="fas fa-check-circle me-1"></i>
                          Email valid
                        </div>
                      )}
                    </div>

                    <div className="d-grid mb-3">
                      <button 
                        type="submit" 
                        className="btn btn-lg forgot-password-submit-btn"
                        disabled={isLoading || success}
                      >
                        {isLoading ? (
                          <>
                            <span className="spinner-border forgot-password-spinner" role="status"></span>
                            Memproses...
                          </>
                        ) : success ? (
                          <>
                            <i className="fas fa-check me-2"></i>
                            Email Terkirim
                          </>
                        ) : (
                          <>
                            <i className="fas fa-paper-plane me-2"></i>
                            Kirim Link Reset
                          </>
                        )}
                      </button>
                    </div>

                    {success && (
                      <div className="d-grid">
                        <button 
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => {
                            setSuccess(false);
                            setEmail("");
                            setErrors({});
                          }}
                        >
                          <i className="fas fa-redo me-2"></i>
                          Kirim Ulang
                        </button>
                      </div>
                    )}

                    <div className="text-center mt-4">
                      <small className="text-muted" style={{ userSelect: 'none' }}>
                        Butuh bantuan?{' '}
                        <a href="#" className="forgot-password-help-link">
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

export default ForgotPassword