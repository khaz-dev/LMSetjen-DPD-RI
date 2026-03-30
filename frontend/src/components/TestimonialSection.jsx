import React, { useState, useEffect, memo } from 'react';
import apiInstance from '../utils/axios';
import Toast from '../views/plugin/Toast';
import BaseFooter from '../views/partials/BaseFooter';

/**
 * Testimonial Section Component
 * Fetches and displays top 3 testimonials by user's golongan (government rank)
 * Sorted from highest (IV/e) to lowest (II/a)
 */
function TestimonialSection() {
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTestimonials();
  }, []);

  const fetchTestimonials = async () => {
    try {
      setLoading(true);
      // ✨ PHASE 4.11: Fetch BOTH student and instructor testimonials for homepage
      const [studentRes, instructorRes] = await Promise.all([
        apiInstance.get('statistics/testimonials/?role=student'),
        apiInstance.get('statistics/testimonials/?role=instructor'),
      ]);
      
      // Combine results from both roles
      const studentTestimonials = (studentRes.data?.results || []).map(t => ({ ...t, role: 'student' }));
      const instructorTestimonials = (instructorRes.data?.results || []).map(t => ({ ...t, role: 'instructor' }));
      
      // Combine and sort by date (newest first)
      const allTestimonials = [...studentTestimonials, ...instructorTestimonials]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 6); // Get top 6 (3 per role or mixed)
      
      setTestimonials(allTestimonials);
    } catch (error) {
      console.error('Error fetching testimonials:', error);
      Toast().fire({
        icon: 'error',
        title: 'Gagal memuat testimoni',
        timer: 2000,
      });
      setTestimonials([]);
    } finally {
      setLoading(false);
    }
  };

  // Get avatar initial from full name
  const getAvatarInitial = (fullName) => {
    if (!fullName) return '?';
    return fullName.split(' ')[0].charAt(0).toUpperCase();
  };

  // Get random gradient color
  const getGradientColor = (index) => {
    const gradients = [
      'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
      'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
      'linear-gradient(135deg, #dc3545 0%, #e83e8c 100%)',
    ];
    return gradients[index % gradients.length];
  };

  // Render loading skeleton
  if (loading) {
    return (
      <section className="py-5 snap-section" style={{ background: 'rgba(255,255,255,0.2)', display: 'flex', flexDirection: 'column', minHeight: 'auto', paddingBottom: '0' }}>
        <div className="container" style={{ flex: '1' }}>
          <div className="text-center mb-5">
            <div 
              className="badge mb-3"
              style={{
                background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '50px',
                fontSize: '0.9rem'
              }}
            >
              <i className="fas fa-quote-left me-2"></i>
              Testimoni
            </div>
            
            <h2 className="display-6 fw-bold mb-3" style={{ color: '#2c3e50', fontSize: '2.2rem' }}>
              Apa Kata Mereka?
            </h2>
            
            <p className="lead text-muted mb-0" style={{ fontSize: '1.1rem' }}>
              Pengalaman nyata dari para peserta yang telah merasakan manfaat LMSetjen DPD RI
            </p>
          </div>

          <div className="row g-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="col-lg-4">
                <div 
                  className="card border-0 h-100"
                  style={{
                    borderRadius: '20px',
                    background: 'white',
                    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.1)',
                    border: '1px solid #e9ecef'
                  }}
                >
                  <div className="card-body text-center p-4">
                    <div 
                      className="mx-auto mb-3"
                      style={{
                        width: '70px',
                        height: '70px',
                        borderRadius: '50%',
                        background: '#e9ecef',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#6c757d',
                        fontSize: '24px'
                      }}
                    >
                      <i className="fas fa-spinner fa-spin"></i>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ✨ PHASE 4.9: Footer moved INSIDE snap-section for smooth scrolling without snap-back */}
        <div style={{ marginTop: '5rem', paddingBottom: '2rem' }}>
          <BaseFooter />
        </div>
      </section>
    );
  }

  // Render testimonials
  return (
    <section className="py-5 snap-section" style={{ background: 'rgba(255,255,255,0.2)', display: 'flex', flexDirection: 'column', minHeight: 'auto', paddingBottom: '0' }}>
      <div className="container" style={{ flex: '1' }}>
        <div className="text-center mb-5">
          <div 
            className="badge mb-3"
            style={{
              background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '50px',
              fontSize: '0.9rem'
            }}
          >
            <i className="fas fa-quote-left me-2"></i>
            Testimoni
          </div>
          
          <h2 className="display-6 fw-bold mb-3" style={{ color: '#2c3e50', fontSize: '2.2rem' }}>
            Apa Kata Mereka?
          </h2>
          
          <p className="lead text-muted mb-0" style={{ fontSize: '1.1rem' }}>
            Pengalaman nyata dari para peserta yang telah merasakan manfaat LMSetjen DPD RI
          </p>
        </div>

        <div 
          className={`row g-3 ${testimonials.length < 3 ? 'justify-content-center' : ''}`}
          style={testimonials.length < 3 ? { display: 'flex', justifyContent: 'center', flexWrap: 'wrap' } : {}}
        >
          {testimonials.map((testimonial, index) => (
            <div 
              key={testimonial.id} 
              className="col-lg-4"
              style={testimonials.length < 3 ? { maxWidth: '400px' } : {}}
            >
              <div 
                className="card border-0 h-100"
                style={{
                  borderRadius: '20px',
                  background: 'white',
                  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #e9ecef'
                }}
              >
                <div className="card-body text-center p-4">
                  {/* Avatar */}
                  <div 
                    className="mx-auto mb-3"
                    style={{
                      width: '70px',
                      height: '70px',
                      borderRadius: '50%',
                      background: getGradientColor(index),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '24px',
                      fontWeight: 'bold',
                      overflow: 'hidden'
                    }}
                  >
                    {testimonial.image ? (
                      <img 
                        src={testimonial.image} 
                        alt={testimonial.full_name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      getAvatarInitial(testimonial.full_name)
                    )}
                  </div>
                  
                  {/* Quote */}
                  <p className="mb-3 fst-italic" style={{ lineHeight: '1.7', color: '#6c757d', fontSize: '0.95rem', minHeight: '80px' }}>
                    "{testimonial.review}"
                  </p>
                  
                  {/* Rating */}
                  <div className="mb-3">
                    {[...Array(5)].map((_, i) => (
                      <i 
                        key={i}
                        className={`fas fa-star ${i < testimonial.rating ? 'text-warning' : 'text-secondary'}`}
                        style={{ fontSize: '0.9rem' }}
                      ></i>
                    ))}
                    <span className="text-warning fw-medium ms-2" style={{ fontSize: '0.95rem' }}>
                      {testimonial.rating}.0
                    </span>
                  </div>
                  
                  {/* Role Badge - ✨ PHASE 4.11 */}
                  <div className="mb-3">
                    <span 
                      className="badge"
                      style={{
                        background: testimonial.role === 'instructor' 
                          ? 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)'
                          : 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                        color: 'white',
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.8rem',
                        borderRadius: '20px',
                        marginRight: '0.5rem'
                      }}
                    >
                      <i className={`fas ${testimonial.role === 'instructor' ? 'fa-chalkboard-user' : 'fa-graduation-cap'} me-1`}></i>
                      {testimonial.role === 'instructor' ? 'Sebagai Instruktur' : 'Sebagai Siswa'}
                    </span>
                    
                    {/* ✨ PHASE 4.12.2: Public User Indicator - if NIP is missing, user is from public */}
                    {testimonial.is_public_user && (
                      <span 
                        className="badge"
                        style={{
                          background: 'linear-gradient(135deg, #17a2b8 0%, #20c997 100%)',
                          color: 'white',
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.8rem',
                          borderRadius: '20px'
                        }}
                        title="Pengguna dari luar Setjen DPD RI (tidak terdaftar di data Pegawai AWS)"
                      >
                        <i className="fas fa-globe me-1"></i>
                        Pengguna Publik
                      </span>
                    )}
                  </div>
                  
                  {/* User Info */}
                  <h3 className="fw-bold mb-1" style={{ color: '#343a40', fontSize: '1rem' }}>
                    {testimonial.full_name}
                  </h3>
                  <small className="text-muted" style={{ fontSize: '0.85rem' }}>
                    {testimonial.position && testimonial.golongan
                      ? `${testimonial.position} (${testimonial.golongan})`
                      : testimonial.position || testimonial.golongan || 'Karyawan Setjen DPD RI'}
                  </small>
                  
                  {/* ✨ PHASE 4.12.1: Display Unit Organisasi and Posisi if available */}
                  {/* ✨ PHASE 4.12.2: Also display NIP for government employees */}
                  {(testimonial.unit_organisasi || testimonial.position || (!testimonial.is_public_user && testimonial.nip)) && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#6c757d', lineHeight: '1.4' }}>
                      {testimonial.unit_organisasi && (
                        <div>
                          <i className="fas fa-building me-1" style={{ color: '#0d9488' }}></i>
                          <span>{testimonial.unit_organisasi}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ✨ PHASE 4.9: Footer moved INSIDE snap-section for smooth scrolling without snap-back */}
      <div style={{ marginTop: '5rem'}}>
        <BaseFooter />
      </div>
    </section>
  );
}

export default memo(TestimonialSection);
