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
        <div className="card border-0 shadow-xs rounded-3 mb-3 bg-white overflow-hidden">
            <div className="card-body p-3 p-md-4">
                <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                    <div className="d-flex align-items-center gap-2">
                        <div
                            className="rounded-2 d-flex align-items-center justify-content-center text-white flex-shrink-0"
                            style={{ width: "28px", height: "28px", background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)" }}
                        >
                            <i className="fas fa-chart-pie" style={{ fontSize: "0.8rem" }}></i>
                        </div>
                        <h5 className="mb-0 fw-bold text-dark" style={{ fontSize: "0.98rem" }}>
                            Analitik & Statistik Kursus
                        </h5>
                    </div>
                    <span className="badge bg-light text-secondary border py-1 px-2 rounded-pill small">
                        Pembaruan Real-Time
                    </span>
                </div>

                {/* Key Metrics - 4 Tiles */}
                <div className="row g-2 g-md-3 mb-3">
                    <div className="col-6 col-md-3">
                        <div className="p-3 rounded-3 border bg-white d-flex align-items-center gap-2 h-100">
                            <div
                                className="rounded-2 d-flex align-items-center justify-content-center text-teal flex-shrink-0"
                                style={{ width: "36px", height: "36px", background: "rgba(13, 148, 136, 0.1)" }}
                            >
                                <i className="fas fa-users" style={{ fontSize: "0.95rem", color: "#0d9488" }}></i>
                            </div>
                            <div className="overflow-hidden">
                                <div className="text-muted text-uppercase" style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0px" }}>Total Peserta</div>
                                <div className="h6 mb-0 fw-bold text-dark" style={{ fontSize: "0.95rem" }}>{course?.students?.length || 0}</div>
                            </div>
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="p-3 rounded-3 border bg-white d-flex align-items-center gap-2 h-100">
                            <div
                                className="rounded-2 d-flex align-items-center justify-content-center text-success flex-shrink-0"
                                style={{ width: "36px", height: "36px", background: "rgba(16, 185, 129, 0.1)" }}
                            >
                                <i className="fas fa-graduation-cap" style={{ fontSize: "0.95rem", color: "#10b981" }}></i>
                            </div>
                            <div className="overflow-hidden">
                                <div className="text-muted text-uppercase" style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0px" }}>Penyelesaian</div>
                                <div className="h6 mb-0 fw-bold text-dark" style={{ fontSize: "0.95rem" }}>{completionRate}%</div>
                            </div>
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="p-3 rounded-3 border bg-white d-flex align-items-center gap-2 h-100">
                            <div
                                className="rounded-2 d-flex align-items-center justify-content-center text-warning flex-shrink-0"
                                style={{ width: "36px", height: "36px", background: "rgba(245, 158, 11, 0.1)" }}
                            >
                                <i className="fas fa-star" style={{ fontSize: "0.95rem", color: "#f59e0b" }}></i>
                            </div>
                            <div className="overflow-hidden">
                                <div className="text-muted text-uppercase" style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0px" }}>Rating Rata-rata</div>
                                <div className="h6 mb-0 fw-bold text-dark" style={{ fontSize: "0.95rem" }}>{avgRating.toFixed(1)} <span className="small text-muted font-normal" style={{ fontSize: "0.72rem" }}>/5.0</span></div>
                            </div>
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="p-3 rounded-3 border bg-white d-flex align-items-center gap-2 h-100">
                            <div
                                className="rounded-2 d-flex align-items-center justify-content-center text-primary flex-shrink-0"
                                style={{ width: "36px", height: "36px", background: "rgba(2, 132, 199, 0.1)" }}
                            >
                                <i className="fas fa-clock" style={{ fontSize: "0.95rem", color: "#0284c7" }}></i>
                            </div>
                            <div className="overflow-hidden">
                                <div className="text-muted text-uppercase" style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0px" }}>Total Durasi</div>
                                <div className="h6 mb-0 fw-bold text-dark" style={{ fontSize: "0.95rem" }}>{durationStats.total || "135m"}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Charts Row */}
                <div className="row g-3 mb-3">
                    {/* Completion Status Chart */}
                    <div className="col-md-6">
                        <div className="bg-light rounded-3 p-3 border h-100">
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.86rem' }}>Distribusi Kemajuan</h6>
                                <span className="badge bg-white text-muted border py-1 px-2" style={{ fontSize: '0.68rem' }}>Peserta</span>
                            </div>
                            <div style={{ width: '100%', height: '140px', minWidth: '0' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={completionData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={35}
                                            outerRadius={55}
                                            dataKey="value"
                                            paddingAngle={2}
                                        >
                                            {completionData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="d-flex align-items-center justify-content-center gap-3 mt-2 flex-wrap">
                                {completionData.map((item, index) => (
                                    <div key={index} className="d-flex align-items-center gap-1">
                                        <div
                                            className="rounded-circle"
                                            style={{ width: '8px', height: '8px', backgroundColor: item.color }}
                                        ></div>
                                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.name}: <strong className="text-dark">{item.value}%</strong></span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Enrollment Trend Chart */}
                    <div className="col-md-6">
                        <div className="bg-light rounded-3 p-3 border h-100">
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.86rem' }}>Tren Pendaftaran</h6>
                                <span className="badge bg-white text-muted border py-1 px-2" style={{ fontSize: '0.68rem' }}>Bulanan</span>
                            </div>
                            {enrollmentData.length > 0 ? (
                                <div style={{ width: '100%', height: '160px', minWidth: '0' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={enrollmentData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                            <YAxis tick={{ fontSize: 10 }} />
                                            <Tooltip />
                                            <Bar dataKey="students" fill="#0d9488" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="d-flex flex-column align-items-center justify-content-center text-center p-3" style={{ height: '150px' }}>
                                    <i className="fas fa-chart-simple text-muted mb-2 opacity-50" style={{ fontSize: "1.75rem" }}></i>
                                    <p className="text-muted small mb-0" style={{ fontSize: '0.8rem', lineHeight: "1" }}>
                                        Data tren pendaftaran akan muncul seiring bertambahnya peserta kursus.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Duration & Outcomes Row */}
                <div className="row g-3">
                    <div className="col-md-6">
                        <div className="p-3 rounded-3 bg-light border h-100">
                            <h6 className="fw-bold mb-2 text-dark d-flex align-items-center gap-2" style={{ fontSize: '0.86rem' }}>
                                <i className="fas fa-clock text-teal"></i>
                                Analisis Konten Pelajaran
                            </h6>
                            <div className="row g-2 text-center">
                                <div className="col-6">
                                    <div className="p-2 rounded-2 bg-white border">
                                        <div className="fw-bold text-dark" style={{ fontSize: "0.92rem" }}>{durationStats.count || course?.lectures?.length || 1}</div>
                                        <div className="text-muted" style={{ fontSize: "0.72rem" }}>Total Pelajaran</div>
                                    </div>
                                </div>
                                <div className="col-6">
                                    <div className="p-2 rounded-2 bg-white border">
                                        <div className="fw-bold text-dark" style={{ fontSize: "0.92rem" }}>{durationStats.average || "135m"}</div>
                                        <div className="text-muted" style={{ fontSize: "0.72rem" }}>Rata-rata Durasi</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="col-md-6">
                        <div className="p-3 rounded-3 bg-light border h-100">
                            <h6 className="fw-bold mb-2 text-dark d-flex align-items-center gap-2" style={{ fontSize: '0.86rem' }}>
                                <i className="fas fa-circle-check text-success"></i>
                                Metrik Kelulusan & Ulasan
                            </h6>
                            <div className="d-flex flex-column gap-2">
                                <div className="d-flex justify-content-between align-items-center py-2 px-3 rounded-2 bg-white border">
                                    <span style={{ fontSize: '0.82rem' }}>Tingkat Kepuasan Peserta</span>
                                    <strong className="text-warning" style={{ fontSize: '0.82rem' }}>{avgRating.toFixed(1)} / 5.0</strong>
                                </div>
                                <div className="d-flex justify-content-between align-items-center py-2 px-3 rounded-2 bg-white border">
                                    <span style={{ fontSize: '0.82rem' }}>Ulasan Terverifikasi</span>
                                    <strong className="text-teal" style={{ fontSize: '0.82rem' }}>{course?.rating_count || 0} Ulasan</strong>
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