import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

import apiInstance from "../../utils/axios";
import { register } from "../../utils/auth";
import { useAuthStore } from "../../store/auth";

import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import Toast from '../plugin/Toast';
import logo from "../../assets/logo/logo-180.png";

function Register() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    password2: ""
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);

  const navigate = useNavigate();
  const { isLoggedIn } = useAuthStore();

  // Check if user is already logged in
  useEffect(() => {
    if (isLoggedIn()) {
      Toast().fire({
        icon: "info",
        title: "You are already logged in",
      });
      navigate("/");
    }
  }, [isLoggedIn, navigate]);

  // Validation rules
  const validateField = (name, value) => {
    switch (name) {
      case 'fullName':
        if (!value.trim()) return "Nama lengkap harus diisi";
        if (value.trim().length < 2) return "Nama lengkap minimal 2 karakter";
        if (!/^[a-zA-Z\s]+$/.test(value.trim())) return "Nama hanya boleh berisi huruf dan spasi";
        return "";
        
      case 'email':
        if (!value) return "Email harus diisi";
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) return "Format email tidak valid";
        return "";
        
      case 'password':
        if (!value) return "Password harus diisi";
        if (value.length < 8) return "Password minimal 8 karakter";
        if (!/(?=.*[a-z])/.test(value)) return "Password harus mengandung huruf kecil";
        if (!/(?=.*[A-Z])/.test(value)) return "Password harus mengandung huruf besar";
        if (!/(?=.*\d)/.test(value)) return "Password harus mengandung angka";
        return "";
        
      case 'password2':
        if (!value) return "Konfirmasi password harus diisi";
        if (value !== formData.password) return "Password tidak sama";
        return "";
        
      default:
        return "";
    }
  };

  // Handle input changes with real-time validation
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Real-time validation for touched fields
    if (touched[name]) {
      const error = validateField(name, value);
      setErrors(prev => ({
        ...prev,
        [name]: error
      }));
    }
  };

  // Handle field blur (when user leaves the field)
  const handleBlur = (e) => {
    const { name, value } = e.target;
    
    setTouched(prev => ({
      ...prev,
      [name]: true
    }));

    const error = validateField(name, value);
    setErrors(prev => ({
      ...prev,
      [name]: error
    }));
  };

  // Validate all fields
  const validateAllFields = () => {
    const newErrors = {};
    Object.keys(formData).forEach(field => {
      const error = validateField(field, formData[field]);
      if (error) newErrors[field] = error;
    });
    
    setErrors(newErrors);
    setTouched({
      fullName: true,
      email: true,
      password: true,
      password2: true
    });
    
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateAllFields()) {
      Toast().fire({
        icon: "error",
        title: "Mohon perbaiki error pada form",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await register(formData.fullName, formData.email, formData.password, formData.password2);
      
      if (error) {
        Toast().fire({
          icon: "error",
          title: error,
        });
      } else {
        Toast().fire({
          icon: "success",
          title: "Registrasi berhasil! Selamat datang!",
        });
        navigate("/");
      }
    } catch (error) {
      console.error("Registration error:", error);
      if (error.response) {
        console.error("Error response data:", error.response.data);
        console.error("Error response status:", error.response.status);
      }
      Toast().fire({
        icon: "error",
        title: "Terjadi kesalahan sistem. Silakan coba lagi.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Get input class based on validation state
  const getInputClass = (fieldName) => {
    const baseClass = "form-control";
    if (!touched[fieldName]) return baseClass;
    return errors[fieldName] ? `${baseClass} is-invalid` : `${baseClass} is-valid`;
  };


  return (
    <>
      <BaseHeader />

      <section className="min-vh-100 d-flex align-items-center" 
               style={{ 
                 background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                 paddingTop: '30px',
                 paddingBottom: '120px'
               }}>
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-5 col-md-7">
              <div className="card shadow border-0" 
                   style={{ 
                     borderRadius: '20px',
                     background: 'white',
                     border: '1px solid #e9ecef',
                     boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)'
                   }}>
                <div className="card-body p-5">
                  {/* Header */}
                  <div className="text-center mb-4">
                    <div className="mb-3">
                      <div className="d-inline-flex align-items-center justify-content-center">
                        <div style={{
                          width: '100%',
                          height: '100%',
                          background: 'white',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <img 
                            src={logo} 
                            alt="LMSetjen DPD RI Logo" 
                            style={{
                              width: '180px',
                              height: '180px',
                              objectFit: 'contain'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <h3 className="fw-bold text-dark mb-2">Bergabung dengan Kami</h3>
                    <p className="text-muted mb-0">
                      Sudah memiliki akun?{' '}
                      <Link to="/login/" 
                            className="text-decoration-none fw-bold"
                            style={{ color: '#667eea' }}>
                        Masuk di sini
                      </Link>
                    </p>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} noValidate>
                    {/* Full Name Field */}
                    <div className="mb-4">
                      <label htmlFor="fullName" className="form-label fw-medium text-dark">
                        <i className="fas fa-user me-2" style={{ color: '#667eea' }}></i>
                        Nama Lengkap
                      </label>
                      <input
                        type="text"
                        id="fullName"
                        name="fullName"
                        className={getInputClass('fullName')}
                        placeholder="Masukkan nama lengkap Anda"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        style={{ 
                          borderRadius: '12px',
                          border: '2px solid #e9ecef',
                          padding: '12px 16px',
                          fontSize: '15px',
                          transition: 'all 0.3s ease'
                        }}
                      />
                      {touched.fullName && errors.fullName && (
                        <div className="invalid-feedback d-block">
                          <i className="fas fa-exclamation-triangle me-1"></i>
                          {errors.fullName}
                        </div>
                      )}
                      {touched.fullName && !errors.fullName && formData.fullName && (
                        <div className="valid-feedback d-block">
                          <i className="fas fa-check-circle me-1"></i>
                          Nama lengkap valid
                        </div>
                      )}
                    </div>

                    {/* Email Field */}
                    <div className="mb-4">
                      <label htmlFor="email" className="form-label fw-medium text-dark">
                        <i className="fas fa-envelope me-2" style={{ color: '#667eea' }}></i>
                        Alamat Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        className={getInputClass('email')}
                        placeholder="contoh@email.com"
                        value={formData.email}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        autoComplete="off"
                        style={{ 
                          borderRadius: '12px',
                          border: '2px solid #e9ecef',
                          padding: '12px 16px',
                          fontSize: '15px',
                          transition: 'all 0.3s ease'
                        }}
                      />
                      {touched.email && errors.email && (
                        <div className="invalid-feedback d-block">
                          <i className="fas fa-exclamation-triangle me-1"></i>
                          {errors.email}
                        </div>
                      )}
                      {touched.email && !errors.email && formData.email && (
                        <div className="valid-feedback d-block">
                          <i className="fas fa-check-circle me-1"></i>
                          Email valid
                        </div>
                      )}
                    </div>

                    {/* Password Field */}
                    <div className="mb-4">
                      <label htmlFor="password" className="form-label fw-medium text-dark">
                        <i className="fas fa-lock me-2" style={{ color: '#667eea' }}></i>
                        Password
                      </label>
                      <div className="position-relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          id="password"
                          name="password"
                          className={getInputClass('password')}
                          placeholder="Buat password yang kuat"
                          value={formData.password}
                          onChange={handleInputChange}
                          onBlur={handleBlur}
                          autoComplete="new-password"
                          style={{ 
                            borderRadius: '12px',
                            border: '2px solid #e9ecef',
                            padding: '12px 50px 12px 16px',
                            fontSize: '15px',
                            transition: 'all 0.3s ease'
                          }}
                        />
                        <button
                          type="button"
                          className="btn position-absolute end-0 top-50 translate-middle-y me-2"
                          style={{ border: 'none', background: 'transparent', color: '#6c757d', paddingRight: '30px' }}
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                      </div>
                      {touched.password && errors.password && (
                        <div className="invalid-feedback d-block">
                          <i className="fas fa-exclamation-triangle me-1"></i>
                          {errors.password}
                        </div>
                      )}
                      {touched.password && !errors.password && formData.password && (
                        <div className="valid-feedback d-block">
                          <i className="fas fa-check-circle me-1"></i>
                          Password kuat
                        </div>
                      )}
                      {/* Password Requirements */}
                      {formData.password && (
                        <div className="mt-2">
                          <small className="text-muted">
                            <div className="d-flex flex-wrap gap-2">
                              <span className={formData.password.length >= 8 ? 'text-success' : 'text-danger'}>
                                <i className={`fas ${formData.password.length >= 8 ? 'fa-check' : 'fa-times'} me-1`}></i>
                                8+ karakter
                              </span>
                              <span className={/(?=.*[a-z])/.test(formData.password) ? 'text-success' : 'text-danger'}>
                                <i className={`fas ${/(?=.*[a-z])/.test(formData.password) ? 'fa-check' : 'fa-times'} me-1`}></i>
                                Huruf kecil
                              </span>
                              <span className={/(?=.*[A-Z])/.test(formData.password) ? 'text-success' : 'text-danger'}>
                                <i className={`fas ${/(?=.*[A-Z])/.test(formData.password) ? 'fa-check' : 'fa-times'} me-1`}></i>
                                Huruf besar
                              </span>
                              <span className={/(?=.*\d)/.test(formData.password) ? 'text-success' : 'text-danger'}>
                                <i className={`fas ${/(?=.*\d)/.test(formData.password) ? 'fa-check' : 'fa-times'} me-1`}></i>
                                Angka
                              </span>
                            </div>
                          </small>
                        </div>
                      )}
                    </div>

                    {/* Confirm Password Field */}
                    <div className="mb-4">
                      <label htmlFor="password2" className="form-label fw-medium text-dark">
                        <i className="fas fa-lock me-2" style={{ color: '#667eea' }}></i>
                        Konfirmasi Password
                      </label>
                      <div className="position-relative">
                        <input
                          type={showPassword2 ? "text" : "password"}
                          id="password2"
                          name="password2"
                          className={getInputClass('password2')}
                          placeholder="Ulangi password Anda"
                          value={formData.password2}
                          onChange={handleInputChange}
                          onBlur={handleBlur}
                          autoComplete="new-password"
                          style={{ 
                            borderRadius: '12px',
                            border: '2px solid #e9ecef',
                            padding: '12px 50px 12px 16px',
                            fontSize: '15px',
                            transition: 'all 0.3s ease'
                          }}
                        />
                        <button
                          type="button"
                          className="btn position-absolute end-0 top-50 translate-middle-y me-2"
                          style={{ border: 'none', background: 'transparent', color: '#6c757d', paddingRight: '30px' }}
                          onClick={() => setShowPassword2(!showPassword2)}
                        >
                          <i className={`fas ${showPassword2 ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                      </div>
                      {touched.password2 && errors.password2 && (
                        <div className="invalid-feedback d-block">
                          <i className="fas fa-exclamation-triangle me-1"></i>
                          {errors.password2}
                        </div>
                      )}
                      {touched.password2 && !errors.password2 && formData.password2 && (
                        <div className="valid-feedback d-block">
                          <i className="fas fa-check-circle me-1"></i>
                          Password cocok
                        </div>
                      )}
                    </div>

                    {/* Submit Button */}
                    <div className="d-grid mb-3">
                      <button 
                        type="submit" 
                        className="btn btn-lg fw-bold"
                        disabled={isLoading || Object.keys(errors).some(key => errors[key])}
                        style={{
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          border: 'none',
                          borderRadius: '12px',
                          color: 'white',
                          padding: '14px',
                          fontSize: '16px',
                          transition: 'all 0.3s ease',
                          transform: isLoading ? 'scale(0.98)' : 'scale(1)'
                        }}
                      >
                        {isLoading ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                            Memproses Registrasi...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-user-plus me-2"></i>
                            Daftar Sekarang
                          </>
                        )}
                      </button>
                    </div>

                    {/* Terms */}
                    <div className="text-center">
                      <small className="text-muted">
                        Dengan mendaftar, Anda menyetujui{' '}
                        <a href="#" className="text-decoration-none" style={{ color: '#667eea' }}>
                          Syarat & Ketentuan
                        </a>{' '}
                        dan{' '}
                        <a href="#" className="text-decoration-none" style={{ color: '#667eea' }}>
                          Kebijakan Privasi
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

export default Register