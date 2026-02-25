import React, { useState, useEffect } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getDurationStats } from '../../../utils/durationUtils';
import useAxios from '../../../utils/useAxios';

const CourseStatistics = ({ course }) => {
    const [analyticsData, setAnalyticsData] = useState(null);
    const [loading, setLoading] = useState(true);

    // Calculate duration statistics from course lectures
    const durationStats = getDurationStats(course?.lectures || []);
    
    // Fetch real analytics data
    useEffect(() => {
        if (course?.id) {
            fetchCourseAnalytics();
        }
    }, [course?.id]);

    const fetchCourseAnalytics = async () => {
        try {
            const response = await useAxios.get(`teacher/course-analytics/${course.id}/`);
            setAnalyticsData(response.data);
        } catch (error) {
            console.error('Error fetching course analytics:', error);
            // Set default data if API fails
            setAnalyticsData({
                total_enrollments: course?.students?.length || 0,
                avg_completion_rate: 0,
                avg_rating: course?.average_rating || 0
            });
        } finally {
            setLoading(false);
        }
    };

    // Calculate completion distribution from enrolled students
    const completionData = course?.students && course.students.length > 0
        ? [
            { name: 'Selesai', value: Math.round((course.students.filter(s => s.completion_percentage >= 100).length / course.students.length) * 100), color: '#28a745' },
            { name: 'Sedang Berlangsung', value: Math.round((course.students.filter(s => s.completion_percentage >= 50 && s.completion_percentage < 100).length / course.students.length) * 100), color: '#ffc107' },
            { name: 'Belum Dimulai', value: Math.round((course.students.filter(s => s.completion_percentage < 50).length / course.students.length) * 100), color: '#6c757d' }
        ]
        : [
            { name: 'Selesai', value: 0, color: '#28a745' },
            { name: 'Sedang Berlangsung', value: 0, color: '#ffc107' },
            { name: 'Belum Dimulai', value: 100, color: '#6c757d' }
        ];

    // Get enrollment trends from enrolled students
    const enrollmentData = course?.students ? course.students
        .reduce((acc, student) => {
            if (student.date) {
                const date = new Date(student.date);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                const monthName = date.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
                const existing = acc.find(item => item.monthKey === monthKey);
                if (existing) {
                    existing.students += 1;
                } else {
                    acc.push({ monthKey, month: monthName, students: 1 });
                }
            }
            return acc;
        }, [])
        .slice(-6)
        : [];

    if (loading) {
        return (
            <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '20px' }}>
                <div className="card-body p-3 p-md-4">
                    <div className="text-center py-5">
                        <i className="fas fa-spinner fa-spin text-primary mb-3" style={{ fontSize: '2rem' }}></i>
                        <p className="text-muted">Memuat data analitik...</p>
                    </div>
                </div>
            </div>
        );
    }

    const completionRate = analyticsData?.avg_completion_rate || 
        (course?.students && course.students.length > 0 
            ? Math.round(course.students.reduce((sum, s) => sum + (s.completion_percentage || 0), 0) / course.students.length)
            : 0);
    
    const avgRating = analyticsData?.avg_rating || course?.average_rating || 0;

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
                            <div className="h5 h3-md fw-bold mb-1">{course?.students?.length || 0}</div>
                            <small style={{ fontSize: '0.8rem' }}>Total Peserta</small>
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="bg-success bg-gradient rounded-3 p-2 p-md-3 text-white text-center">
                            <i className="fas fa-graduation-cap fa-lg fa-md-2x mb-1 mb-md-2"></i>
                            <div className="h5 h3-md fw-bold mb-1">{completionRate}%</div>
                            <small style={{ fontSize: '0.8rem' }}>Tingkat Penyelesaian</small>
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="bg-warning bg-gradient rounded-3 p-2 p-md-3 text-white text-center">
                            <i className="fas fa-star fa-lg fa-md-2x mb-1 mb-md-2"></i>
                            <div className="h5 h3-md fw-bold mb-1">{avgRating.toFixed(1)}</div>
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
                            <div style={{ width: '100%', height: '250px', minHeight: '250px', minWidth: '0' }}>
                                <ResponsiveContainer width="100%" height="100%">
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
                            <div style={{ width: '100%', height: '250px', minHeight: '250px', minWidth: '0' }}>
                                <ResponsiveContainer width="100%" height="100%">
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
                                    <span className="fw-bold text-success" style={{ fontSize: '0.9rem' }}>{completionRate}%</span>
                                </div>
                                <div className="d-flex justify-content-between align-items-center py-2 border-bottom">
                                    <span className="d-flex align-items-center" style={{ fontSize: '0.9rem' }}>
                                        <i className="fas fa-star text-warning me-2"></i>
                                        Kepuasan Peserta (Rating)
                                    </span>
                                    <span className="fw-bold text-warning" style={{ fontSize: '0.9rem' }}>{avgRating.toFixed(1)}/5.0</span>
                                </div>
                                <div className="d-flex justify-content-between align-items-center py-2 border-bottom">
                                    <span className="d-flex align-items-center" style={{ fontSize: '0.9rem' }}>
                                        <i className="fas fa-comment-dots text-info me-2"></i>
                                        Total Ulasan
                                    </span>
                                    <span className="fw-bold text-info" style={{ fontSize: '0.9rem' }}>{course?.rating_count || 0}</span>
                                </div>
                                <div className="d-flex justify-content-between align-items-center py-2">
                                    <span className="d-flex align-items-center" style={{ fontSize: '0.9rem' }}>
                                        <i className="fas fa-video text-primary me-2"></i>
                                        Total Video Pembelajaran
                                    </span>
                                    <span className="fw-bold text-primary" style={{ fontSize: '0.9rem' }}>{course?.lectures?.length || 0}</span>
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