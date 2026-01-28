import React from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getDurationStats, calculateTotalDuration } from '../../../utils/durationUtils';

const CourseStatistics = ({ course, enrolledStudents = [] }) => {
    // Calculate duration statistics from course lectures
    const durationStats = getDurationStats(course?.lectures || []);
    // Sample data for demonstration
    const completionData = [
        { name: 'Selesai', value: 65, color: '#28a745' },
        { name: 'Sedang Berlangsung', value: 25, color: '#ffc107' },
        { name: 'Belum Dimulai', value: 10, color: '#6c757d' }
    ];

    const enrollmentData = [
        { month: 'Jan', students: 120 },
        { month: 'Feb', students: 180 },
        { month: 'Mar', students: 250 },
        { month: 'Apr', students: 320 },
        { month: 'May', students: 420 },
        { month: 'Jun', students: 500 }
    ];

    return (
        <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '20px' }}>
            <div className="card-body p-3 p-md-4">
                <h3 className="h5 mb-3 d-flex align-items-center">
                    <div 
                        className="me-3"
                        style={{
                            width: '40px',
                            height: '40px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <i className="fas fa-chart-bar text-white"></i>
                    </div>
                    <span style={{ color: '#2c3e50' }}>Analitik & Statistik Kursus</span>
                </h3>

                {/* Key Metrics */}
                <div className="row g-2 g-md-3 mb-3">
                    <div className="col-6 col-md-3">
                        <div className="bg-primary bg-gradient rounded-3 p-2 p-md-3 text-white text-center">
                            <i className="fas fa-users fa-lg fa-md-2x mb-1 mb-md-2"></i>
                            <div className="h5 h3-md fw-bold mb-1">{Array.isArray(course?.students) ? course.students.length : (course?.students_count || 1250)}</div>
                            <small style={{ fontSize: '0.8rem' }}>Total Peserta</small>
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="bg-success bg-gradient rounded-3 p-2 p-md-3 text-white text-center">
                            <i className="fas fa-graduation-cap fa-lg fa-md-2x mb-1 mb-md-2"></i>
                            <div className="h5 h3-md fw-bold mb-1">89%</div>
                            <small style={{ fontSize: '0.8rem' }}>Tingkat Penyelesaian</small>
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="bg-warning bg-gradient rounded-3 p-2 p-md-3 text-white text-center">
                            <i className="fas fa-star fa-lg fa-md-2x mb-1 mb-md-2"></i>
                            <div className="h5 h3-md fw-bold mb-1">{course?.average_rating || 4.8}</div>
                            <small style={{ fontSize: '0.8rem' }}>Rata-Rata Rating</small>
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="bg-info bg-gradient rounded-3 p-2 p-md-3 text-white text-center">
                            <i className="fas fa-clock fa-lg fa-md-2x mb-1 mb-md-2"></i>
                            <div className="h5 h3-md fw-bold mb-1">{durationStats.total || "0m"}</div>
                            <small style={{ fontSize: '0.8rem' }}>Total Durasi Konten</small>
                        </div>
                    </div>
                </div>

                <div className="row g-3 g-md-4">
                    {/* Completion Status Chart */}
                    <div className="col-lg-6">
                        <div className="bg-light rounded-3 p-3">
                            <h6 className="fw-semibold mb-3" style={{ fontSize: '0.95rem' }}>Distribusi Kemajuan Peserta</h6>
                            <div style={{ width: '100%', height: '200px' }}>
                                <ResponsiveContainer>
                                    <PieChart>
                                        <Pie
                                            data={completionData}
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={70}
                                            dataKey="value"
                                            label={({ name, value }) => `${name}: ${value}%`}
                                        >
                                            {completionData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-2">
                                {completionData.map((item, index) => (
                                    <div key={index} className="d-flex align-items-center mb-1">
                                        <div 
                                            className="rounded-circle me-2"
                                            style={{ 
                                                width: '10px', 
                                                height: '10px', 
                                                backgroundColor: item.color 
                                            }}
                                        ></div>
                                        <span style={{ fontSize: '0.85rem' }}>{item.name}: {item.value}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Enrollment Trend Chart */}
                    <div className="col-lg-6">
                        <div className="bg-light rounded-3 p-3">
                            <h6 className="fw-semibold mb-3" style={{ fontSize: '0.95rem' }}>Tren Pendaftaran Bulanan</h6>
                            <div style={{ width: '100%', height: '200px' }}>
                                <ResponsiveContainer>
                                    <BarChart data={enrollmentData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="month" />
                                        <YAxis />
                                        <Tooltip />
                                        <Bar dataKey="students" fill="#007bff" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Duration Analytics */}
                <div className="row mt-3">
                    <div className="col-12">
                        <div className="bg-light rounded-3 p-3">
                            <h6 className="fw-semibold mb-3" style={{ fontSize: '0.95rem' }}>
                                <i className="fas fa-clock text-info me-2"></i>
                                Analitik Durasi Konten
                            </h6>
                            <div className="row g-2 mb-2">
                                <div className="col-6 col-md-3">
                                    <div className="text-center p-2 border rounded">
                                        <i className="fas fa-film text-primary mb-1" style={{ fontSize: '0.9rem' }}></i>
                                        <div className="h6 fw-bold mb-1">{durationStats.count || 0}</div>
                                        <small className="text-muted" style={{ fontSize: '0.75rem' }}>Total Pelajaran</small>
                                    </div>
                                </div>
                                <div className="col-6 col-md-3">
                                    <div className="text-center p-2 border rounded">
                                        <i className="fas fa-hourglass-half text-info mb-1" style={{ fontSize: '0.9rem' }}></i>
                                        <div className="h6 fw-bold mb-1">{durationStats.average || "0m"}</div>
                                        <small className="text-muted" style={{ fontSize: '0.75rem' }}>Rata-Rata Durasi</small>
                                    </div>
                                </div>
                                <div className="col-6 col-md-3">
                                    <div className="text-center p-2 border rounded">
                                        <i className="fas fa-bolt text-warning mb-1" style={{ fontSize: '0.9rem' }}></i>
                                        <div className="h6 fw-bold mb-1">{durationStats.min || "0m"}</div>
                                        <small className="text-muted" style={{ fontSize: '0.75rem' }}>Pelajaran Terpendek</small>
                                    </div>
                                </div>
                                <div className="col-6 col-md-3">
                                    <div className="text-center p-2 border rounded">
                                        <i className="fas fa-fire text-danger mb-1" style={{ fontSize: '0.9rem' }}></i>
                                        <div className="h6 fw-bold mb-1">{durationStats.max || "0m"}</div>
                                        <small className="text-muted" style={{ fontSize: '0.75rem' }}>Pelajaran Terpanjang</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Learning Outcomes */}
                <div className="row mt-3">
                    <div className="col-12">
                        <div className="bg-light rounded-3 p-3">
                            <h6 className="fw-semibold mb-3" style={{ fontSize: '0.95rem' }}>Hasil Pembelajaran & Metrik Kesuksesan</h6>
                            <div className="mb-2">
                                <div className="d-flex justify-content-between align-items-center py-2 border-bottom">
                                    <span className="d-flex align-items-center" style={{ fontSize: '0.9rem' }}>
                                        <i className="fas fa-check-circle text-success me-2"></i>
                                        Penyelesaian Kursus
                                    </span>
                                    <span className="fw-bold text-success" style={{ fontSize: '0.9rem' }}>89%</span>
                                </div>
                                <div className="d-flex justify-content-between align-items-center py-2 border-bottom">
                                    <span className="d-flex align-items-center" style={{ fontSize: '0.9rem' }}>
                                        <i className="fas fa-trophy text-warning me-2"></i>
                                        Penguasaan Keterampilan
                                    </span>
                                    <span className="fw-bold text-warning" style={{ fontSize: '0.9rem' }}>94%</span>
                                </div>
                                <div className="d-flex justify-content-between align-items-center py-2 border-bottom">
                                    <span className="d-flex align-items-center" style={{ fontSize: '0.9rem' }}>
                                        <i className="fas fa-briefcase text-info me-2"></i>
                                        Pengembangan Karir
                                    </span>
                                    <span className="fw-bold text-info" style={{ fontSize: '0.9rem' }}>76%</span>
                                </div>
                                <div className="d-flex justify-content-between align-items-center py-2">
                                    <span className="d-flex align-items-center" style={{ fontSize: '0.9rem' }}>
                                        <i className="fas fa-thumbs-up text-primary me-2"></i>
                                        Kepuasan Peserta
                                    </span>
                                    <span className="fw-bold text-primary" style={{ fontSize: '0.9rem' }}>96%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CourseStatistics;