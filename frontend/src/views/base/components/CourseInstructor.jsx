import React from "react";
import { Rating } from "react-simple-star-rating";
import { getMediaUrl } from "../../../utils/constants";

const CourseInstructor = ({ teacher, courseCount = 0 }) => {
    if (!teacher) return null;

    // Helper function to get proper image URL
    const getImageUrl = (imageUrl) => {
        if (!imageUrl) {
            return "https://via.placeholder.com/150";
        }
        
        // If it's already a complete URL, return as is
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            return imageUrl;
        }
        
        // Use the centralized helper function
        return getMediaUrl(imageUrl);
    };

    return (
        <div 
            className="card border-0 shadow-sm mb-4"
            style={{ borderRadius: '20px' }}
        >
            <div className="card-body p-4">
                {/* Modern Header */}
                <div className="d-flex align-items-center mb-4">
                    <div 
                        className="me-3"
                        style={{
                            width: '50px',
                            height: '50px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            borderRadius: '15px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <i className="fas fa-chalkboard-teacher text-white" style={{ fontSize: '1.2rem' }}></i>
                    </div>
                    <h3 className="h4 mb-0" style={{ color: '#2c3e50' }}>
                        Tentang Instruktur
                    </h3>
                </div>

                <div className="row align-items-center">
                    <div className="col-lg-4 text-center mb-4 mb-lg-0">
                        {/* Modern Instructor Avatar */}
                        <div className="position-relative d-inline-block mb-3">
                            <div 
                                className="position-relative"
                                style={{
                                    width: '120px',
                                    height: '120px',
                                    borderRadius: '25px',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    padding: '3px',
                                    margin: '0 auto'
                                }}
                            >
                                <img 
                                    src={getImageUrl(teacher.image)}
                                    alt={teacher.full_name}
                                    className="w-100 h-100"
                                    style={{ 
                                        objectFit: 'cover',
                                        borderRadius: '22px'
                                    }}
                                    onError={(e) => {
                                        e.target.src = 'https://via.placeholder.com/150';
                                    }}
                                />
                            </div>
                            <div 
                                className="position-absolute"
                                style={{
                                    bottom: '5px',
                                    right: '5px',
                                    width: '24px',
                                    height: '24px',
                                    background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '2px solid white'
                                }}
                            >
                                <i className="fas fa-check text-white" style={{ fontSize: '0.7rem' }}></i>
                            </div>
                        </div>

                        {/* Instructor Name */}
                        <h4 className="fw-bold mb-1" style={{ color: '#2c3e50' }}>
                            {teacher.full_name}
                        </h4>
                        <p className="text-muted mb-3">
                            {teacher.about?.slice(0, 80) || 'Instruktur Profesional'}{teacher.about?.length > 80 ? '...' : ''}
                        </p>

                        {/* Modern Quick Stats */}
                        <div className="row g-2 text-center">
                            <div className="col-4">
                                <div 
                                    className="p-3"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                                        borderRadius: '12px'
                                    }}
                                >
                                    <div className="fw-bold" style={{ color: '#667eea' }}>{courseCount}</div>
                                    <small className="text-muted">Kursus</small>
                                </div>
                            </div>
                            <div className="col-4">
                                <div 
                                    className="p-3"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(40, 167, 69, 0.1) 0%, rgba(32, 201, 151, 0.1) 100%)',
                                        borderRadius: '12px'
                                    }}
                                >
                                    <div className="fw-bold" style={{ color: '#28a745' }}>{teacher?.average_rating?.toFixed(1) || 0}</div>
                                    <small className="text-muted">Rating</small>
                                </div>
                            </div>
                            <div className="col-4">
                                <div 
                                    className="p-3"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 140, 0, 0.1) 100%)',
                                        borderRadius: '12px'
                                    }}
                                >
                                    <div className="fw-bold" style={{ color: '#ffc107' }}>{teacher?.total_students || 0}</div>
                                    <small className="text-muted">Siswa</small>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="col-lg-8">
                        {/* Modern Instructor Details */}
                        <div className="mb-4">
                            <h5 className="fw-bold mb-3" style={{ color: '#2c3e50' }}>
                                Latar Belakang Profesional
                            </h5>
                            <p className="text-muted mb-3" style={{ lineHeight: '1.7' }}>
                                {teacher.bio || teacher.about ||
                                `${teacher.full_name} adalah seorang profesional berpengalaman dengan keahlian luas dalam bidang pendidikan dan pelatihan. 
                                Dengan pengalaman bertahun-tahun di bidangnya, beliau menghadirkan pengetahuan praktis dan wawasan dunia nyata dalam setiap kursus.`}
                            </p>
                        </div>

                        {/* Modern Expertise Areas */}
                        <div className="mb-4">
                            <h5 className="fw-bold mb-3" style={{ color: '#2c3e50' }}>
                                Bidang Keahlian
                            </h5>
                            {teacher?.expertise && teacher.expertise.length > 0 ? (
                                <div className="d-flex flex-wrap gap-2">
                                    {teacher.expertise.map((item, index) => (
                                        <span 
                                            key={item.id || index}
                                            className="badge px-3 py-2"
                                            style={{
                                                background: item.color_gradient || 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                                                color: item.text_color || '#667eea',
                                                border: `1px solid ${item.border_color || 'rgba(102, 126, 234, 0.2)'}`,
                                                borderRadius: '20px',
                                                fontWeight: '500'
                                            }}
                                        >
                                            {item.skill}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-muted">Belum ada bidang keahlian yang ditampilkan</p>
                            )}
                        </div>

                        {/* Modern Contact/Social Links */}
                        <div>
                            <h5 className="fw-bold mb-3" style={{ color: '#2c3e50' }}>
                                Hubungi Instruktur
                            </h5>
                            <div className="d-flex flex-wrap gap-2">
                                <button 
                                    className="btn btn-sm"
                                    style={{
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '10px',
                                        fontWeight: '500'
                                    }}
                                >
                                    <i className="fas fa-envelope me-2"></i>
                                    Kirim Pesan
                                </button>
                                <button 
                                    className="btn btn-sm"
                                    style={{
                                        background: 'transparent',
                                        color: '#667eea',
                                        border: '1px solid #667eea',
                                        borderRadius: '10px',
                                        fontWeight: '500'
                                    }}
                                >
                                    <i className="fas fa-user me-2"></i>
                                    Lihat Profil
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CourseInstructor;