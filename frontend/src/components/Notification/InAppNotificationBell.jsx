import React, { useState, useEffect, useRef, useCallback, useContext, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAxios from '../../utils/useAxios';
import UserData from '../../views/plugin/UserData';
import { RolesContext } from '../../views/plugin/Context';
import { moment } from '../../utils/dayjs';
import './InAppNotificationBell.css';

/**
 * 🔔 InAppNotificationBell Component (Pusat Notifikasi LMSetjen DPD RI)
 * - Tampilan Bersih & Terang (Clean Light Theme) selaras dengan tema portal.
 * - Pemisahan Total Berdasarkan Peran Aktif:
 *   - Jika sedang dalam peran Siswa: HANYA menampilkan notifikasi Siswa (ujian, materi, kelulusan).
 *   - Jika sedang dalam peran Pengajar: HANYA menampilkan notifikasi Pengajar (verifikasi integritas, pendaftaran peserta).
 *   - Tidak mencampur notifikasi antar-peran agar tidak membingungkan pengguna.
 * - Deep Linking langsung ke halaman aksi/evaluasi.
 */
function InAppNotificationBell() {
    const { currentRole } = useContext(RolesContext) || {};
    const location = useLocation();
    const navigate = useNavigate();
    const userData = UserData();
    const dropdownRef = useRef(null);

    const userId = userData?.user_id;
    const teacherId = userData?.teacher_id;

    // Tentukan secara tegas peran aktif saat ini tanpa pencampuran
    const activeRole = useMemo(() => {
        if (location.pathname.startsWith('/instructor')) return 'instructor';
        if (location.pathname.startsWith('/student')) return 'student';
        const norm = currentRole?.toLowerCase()?.trim();
        if ((norm === 'instructor' || norm === 'teacher') && teacherId) return 'instructor';
        return 'student';
    }, [location.pathname, currentRole, teacherId]);

    const isInstructorMode = activeRole === 'instructor';

    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'unread'
    const [isOpen, setIsOpen] = useState(false);
    const [markingAll, setMarkingAll] = useState(false);

    // Ambil data notifikasi murni sesuai peran aktif
    const fetchNotifications = useCallback(async () => {
        if (!userId) return;

        try {
            let res;
            if (isInstructorMode && teacherId) {
                // Notifikasi murni Pengajar
                res = await useAxios.get(`teacher/noti-list/${teacherId}/`);
            } else {
                // Notifikasi murni Siswa
                res = await useAxios.get(`student/noti-list/${userId}/`);
            }

            const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.seen).length);
        } catch (err) {
            console.debug('Failed to fetch notifications for active role:', err);
        }
    }, [userId, teacherId, isInstructorMode]);

    // Fetch ulang saat peran aktif berubah atau ada sinyal refresh
    useEffect(() => {
        fetchNotifications();

        const handleUpdate = () => {
            fetchNotifications();
        };

        window.addEventListener('notificationUpdated', handleUpdate);
        window.addEventListener('refreshNotifications', handleUpdate);
        window.addEventListener('focus', handleUpdate);

        const interval = setInterval(fetchNotifications, 40000);

        return () => {
            window.removeEventListener('notificationUpdated', handleUpdate);
            window.removeEventListener('refreshNotifications', handleUpdate);
            window.removeEventListener('focus', handleUpdate);
            clearInterval(interval);
        };
    }, [fetchNotifications]);

    // Tutup dropdown saat klik di luar
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Saring notifikasi berdasarkan filter 'all' vs 'unread'
    const displayedNotifs = useMemo(() => {
        if (filterStatus === 'unread') {
            return notifications.filter(n => !n.seen);
        }
        return notifications;
    }, [notifications, filterStatus]);

    // Klik notifikasi: tandai dibaca & arahkan langsung ke halaman terkait
    const handleNotificationClick = async (noti) => {
        if (!noti.seen) {
            try {
                if (isInstructorMode && teacherId) {
                    await useAxios.patch(`teacher/noti-detail/${teacherId}/${noti.id}`, { seen: true });
                } else {
                    await useAxios.patch(`student/noti-detail/${userId}/${noti.id}/`, { seen: true });
                }
                setNotifications(prev =>
                    prev.map(item => item.id === noti.id ? { ...item, seen: true } : item)
                );
                setUnreadCount(prev => Math.max(0, prev - 1));
            } catch (err) {
                console.debug('Error updating notification read status:', err);
            }
        }

        setIsOpen(false);

        const courseId = noti.course_data?.course_id || noti.course_data?.id || noti.course;
        const enrollmentId = noti.course_data?.enrollment_id;

        if (isInstructorMode) {
            // Navigasi Pengajar
            // Notifikasi ujian (peninjauan, pengesahan, penolakan, reset) atau pendaftaran siswa baru diarahkan ke halaman evaluasi kursus
            if (['Exam Review Needed', 'Course Enrollment Completed', 'Exam Verified', 'Exam Rejected', 'Exam Reset'].includes(noti.type) && courseId) {
                navigate(`/instructor/courses/${courseId}/evaluation/`);
            } else if (courseId) {
                navigate(`/instructor/courses/`);
            } else {
                navigate('/instructor/dashboard/');
            }
        } else {
            // Navigasi Siswa
            const studentTarget = enrollmentId || noti.course_data?.slug || courseId;
            if (studentTarget) {
                navigate(`/student/courses/${studentTarget}/`);
            } else {
                navigate('/student/courses/');
            }
        }
    };

    // Tandai semua notifikasi peran aktif sebagai telah dibaca
    const handleMarkAllRead = async (e) => {
        e.stopPropagation();
        if (unreadCount === 0 || markingAll) return;

        try {
            setMarkingAll(true);
            if (isInstructorMode && teacherId) {
                await useAxios.post(`teacher/noti-mark-all-read/${teacherId}/`);
            } else {
                await useAxios.post(`student/noti-mark-all-read/${userId}/`);
            }

            setNotifications(prev => prev.map(item => ({ ...item, seen: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Failed to mark all as read:', err);
        } finally {
            setMarkingAll(false);
        }
    };

    // Helper ikon dan label metadata
    const getNotificationMeta = (type) => {
        switch (type) {
            case 'Exam Verified':
                return {
                    icon: 'fas fa-check-circle',
                    badgeClass: 'badge-emerald',
                    label: 'Ujian Disahkan'
                };
            case 'Exam Reset':
                return {
                    icon: 'fas fa-rotate-left',
                    badgeClass: 'badge-amber',
                    label: 'Ujian Di-reset'
                };
            case 'Exam Rejected':
                return {
                    icon: 'fas fa-circle-xmark',
                    badgeClass: 'badge-rose',
                    label: 'Ujian Ditolak'
                };
            case 'Exam Review Needed':
                return {
                    icon: 'fas fa-shield-halved',
                    badgeClass: 'badge-sky',
                    label: 'Perlu Verifikasi'
                };
            case 'Exam Pending Review':
                return {
                    icon: 'fas fa-hourglass-half',
                    badgeClass: 'badge-purple',
                    label: 'Dalam Peninjauan'
                };
            case 'Course Published':
                return {
                    icon: 'fas fa-rocket',
                    badgeClass: 'badge-indigo',
                    label: 'Kursus Terbit'
                };
            case 'Course Enrollment Completed':
                return {
                    icon: 'fas fa-user-check',
                    badgeClass: 'badge-teal',
                    label: 'Pendaftaran Kursus'
                };
            case 'New Review':
                return {
                    icon: 'fas fa-star',
                    badgeClass: 'badge-amber',
                    label: 'Ulasan Baru'
                };
            case 'New Course Question':
                return {
                    icon: 'fas fa-circle-question',
                    badgeClass: 'badge-sky',
                    label: 'Pertanyaan Diskusi'
                };
            default:
                return {
                    icon: 'fas fa-bell',
                    badgeClass: 'badge-slate',
                    label: 'Pemberitahuan'
                };
        }
    };

    // Format waktu humanis
    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const d = moment(dateStr);
        if (!d.isValid()) return '';
        const now = moment();
        const diffMinutes = now.diff(d, 'minutes');
        if (diffMinutes < 1) return 'Baru saja';
        if (diffMinutes < 60) return `${diffMinutes} mnt lalu`;
        const diffHours = now.diff(d, 'hours');
        if (diffHours < 24) return `${diffHours} jam lalu`;
        if (diffHours < 48) return `Kemarin, ${d.format('HH:mm')}`;
        return d.format('DD MMM YYYY');
    };

    if (!userId) return null;

    return (
        <div className="in-app-noti-wrapper" ref={dropdownRef}>
            {/* Tombol Lonceng Navbar */}
            <button
                type="button"
                className={`in-app-noti-btn ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                aria-label={`Notifikasi ${isInstructorMode ? 'Pengajar' : 'Siswa'}`}
                title={`Notifikasi ${isInstructorMode ? 'Pengajar' : 'Siswa'}`}
            >
                <i className="fas fa-bell in-app-noti-icon"></i>
                {unreadCount > 0 && (
                    <span
                        className="in-app-noti-badge animate-pulse"
                        title={`${unreadCount} notifikasi ${isInstructorMode ? 'pengajar' : 'siswa'} belum dibaca`}
                    >
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Card (Clean Light Theme) */}
            {isOpen && (
                <div className="in-app-noti-dropdown shadow-lg">
                    {/* Header Panel */}
                    <div className="in-app-noti-header">
                        <div className="d-flex align-items-center justify-content-between w-100 mb-2">
                            <div className="d-flex align-items-center gap-2">
                                <h6 className="in-app-noti-title mb-0">
                                    {isInstructorMode ? 'Notifikasi Pengajar' : 'Notifikasi Siswa'}
                                </h6>
                                {unreadCount > 0 && (
                                    <span className="in-app-noti-unread-count">
                                        {unreadCount} baru
                                    </span>
                                )}
                            </div>

                            {unreadCount > 0 && (
                                <button
                                    type="button"
                                    className="in-app-noti-mark-all"
                                    onClick={handleMarkAllRead}
                                    disabled={markingAll}
                                >
                                    <i className="fas fa-check-double me-1"></i>
                                    {markingAll ? 'Memproses...' : 'Tandai Semua Dibaca'}
                                </button>
                            )}
                        </div>

                        {/* Filter Bar (Semua / Belum Dibaca) */}
                        <div className="in-app-noti-filter-bar">
                            <div className="filter-pill-group">
                                <button
                                    type="button"
                                    className={`filter-pill-btn ${filterStatus === 'all' ? 'active' : ''}`}
                                    onClick={() => setFilterStatus('all')}
                                >
                                    Semua ({notifications.length})
                                </button>
                                <button
                                    type="button"
                                    className={`filter-pill-btn ${filterStatus === 'unread' ? 'active' : ''}`}
                                    onClick={() => setFilterStatus('unread')}
                                >
                                    Belum Dibaca ({unreadCount})
                                </button>
                            </div>
                            <span className="noti-role-context-hint">
                                {isInstructorMode ? 'Fokus: Pengajaran' : 'Fokus: Pembelajaran'}
                            </span>
                        </div>
                    </div>

                    {/* Notification List Body */}
                    <div className="in-app-noti-list">
                        {displayedNotifs.length === 0 ? (
                            <div className="in-app-noti-empty">
                                <div className="in-app-noti-empty-icon">
                                    <i className={filterStatus === 'unread' ? 'fas fa-envelope-open-text' : 'fas fa-bell-slash'}></i>
                                </div>
                                <div className="in-app-noti-empty-text">
                                    {filterStatus === 'unread'
                                        ? 'Semua notifikasi sudah Anda baca'
                                        : `Belum ada notifikasi baru sebagai ${isInstructorMode ? 'Pengajar' : 'Siswa'}`}
                                </div>
                                <div className="in-app-noti-empty-sub">
                                    {isInstructorMode
                                        ? 'Pemberitahuan verifikasi integritas ujian siswa, pendaftaran kursus, dan ulasan akan tampil di sini.'
                                        : 'Pemberitahuan kelulusan ujian, reset kuis, dan penerbitan sertifikat akan tampil di sini.'}
                                </div>
                            </div>
                        ) : (
                            displayedNotifs.slice(0, 10).map((noti) => {
                                const meta = getNotificationMeta(noti.type);
                                return (
                                    <div
                                        key={noti.id}
                                        className={`in-app-noti-item ${!noti.seen ? 'unread' : 'read'}`}
                                        onClick={() => handleNotificationClick(noti)}
                                    >
                                        <div className={`in-app-noti-item-icon ${meta.badgeClass}`}>
                                            <i className={meta.icon}></i>
                                        </div>

                                        <div className="in-app-noti-item-content">
                                            <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                                                <span className={`in-app-noti-type-tag ${meta.badgeClass}`}>
                                                    {meta.label}
                                                </span>
                                                <span className="in-app-noti-time">{formatTime(noti.date)}</span>
                                            </div>

                                            <div className="in-app-noti-heading" title={noti.title || noti.type}>
                                                {noti.title || noti.type}
                                            </div>

                                            {noti.message && (
                                                <div className="in-app-noti-msg" title={noti.message}>
                                                    {noti.message}
                                                </div>
                                            )}

                                            {noti.course_data?.title && (
                                                <div className="in-app-noti-course-pill" title={noti.course_data.title}>
                                                    <i className="fas fa-book-open me-1"></i>
                                                    <span>{noti.course_data.title}</span>
                                                </div>
                                            )}
                                        </div>

                                        {!noti.seen && (
                                            <div className="in-app-noti-dot" title="Belum dibaca"></div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer Section */}
                    <div className="in-app-noti-footer">
                        <div className="d-flex align-items-center justify-content-between w-100">
                            <span className="in-app-noti-footer-tip">
                                <i className="fas fa-info-circle me-1 text-teal"></i>
                                Klik untuk melihat materi
                            </span>

                            <button
                                type="button"
                                className="in-app-noti-view-activities-btn"
                                onClick={() => {
                                    setIsOpen(false);
                                    if (isInstructorMode) {
                                        navigate('/instructor/notifications/');
                                    } else {
                                        navigate('/student/activities/');
                                    }
                                }}
                            >
                                <span>{isInstructorMode ? 'Log Pengajaran' : 'Log Belajar'}</span>
                                <i className="fas fa-arrow-right ms-1"></i>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default InAppNotificationBell;
