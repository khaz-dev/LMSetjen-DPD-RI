import React, { useState } from 'react';
import AdminHeader from '../partials/AdminHeader';
import Footer from '../partials/Footer';
import Toast, { LogoutConfirmation, DeleteConfirmation } from '../plugin/Toast';
import UserData from '../plugin/UserData';
import Swal from 'sweetalert2';
import useAxios from '../../utils/useAxios';
import { API_BASE_URL } from '../../utils/constants';
import './SystemTestAdmin.css';

function SystemTestAdmin({ isEmbedded = false }) {
    const userData = UserData();
    const [activeTab, setActiveTab] = useState('toasts'); // 'toasts' | 'dialogs' | 'playground' | 'diagnostics'
    
    // Playground Form State
    const [playType, setPlayType] = useState('toast'); // 'toast' | 'dialog'
    const [playTitle, setPlayTitle] = useState('Pengujian Berhasil');
    const [playText, setPlayText] = useState('Tindakan sistem berhasil disimulasikan tanpa kendala.');
    const [playIcon, setPlayIcon] = useState('success');
    const [playPosition, setPlayPosition] = useState('top-end');
    const [playTimer, setPlayTimer] = useState(3000);
    const [playShowConfirm, setPlayShowConfirm] = useState(false);
    const [playShowCancel, setPlayShowCancel] = useState(false);
    const [copiedCode, setCopiedCode] = useState(false);

    // Diagnostics State
    const [pingLoading, setPingLoading] = useState(false);
    const [pingResult, setPingResult] = useState(null);
    const [browserNotifStatus, setBrowserNotifStatus] = useState(
        typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
    );

    // Toast Duration Control (in Seconds)
    const [toastDurationSec, setToastDurationSec] = useState(2.5);

    // Toast Presets
    const triggerPresetToast = (type, title, text) => {
        Toast().fire({
            icon: type,
            title: title || (type === 'success' ? 'Berhasil Disimpan' : 'Pemberitahuan Sistem'),
            text: text || undefined,
            timer: toastDurationSec > 0 ? Math.round(toastDurationSec * 1000) : false,
            timerProgressBar: toastDurationSec > 0
        });
    };

    const triggerPositionToast = (pos) => {
        Swal.mixin({
            toast: true,
            position: pos,
            showConfirmButton: false,
            timer: toastDurationSec > 0 ? Math.round(toastDurationSec * 1000) : false,
            timerProgressBar: toastDurationSec > 0,
            backdrop: false,
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', Swal.stopTimer);
                toast.addEventListener('mouseleave', Swal.resumeTimer);
            }
        }).fire({
            icon: 'info',
            title: `Posisi Notifikasi: ${pos}`,
            text: toastDurationSec > 0 ? `Durasi aktif: ${toastDurationSec} detik` : 'Mode: Sticky (Manual Close)'
        });
    };

    const triggerLongToast = () => {
        Toast().fire({
            icon: 'warning',
            title: 'Validasi Kurikulum Diperlukan',
            text: 'Terdapat 3 video materi pembelajaran yang belum memiliki kuis evaluasi. Harap lengkapi sebelum mempublikasikan kursus.',
            timer: toastDurationSec > 0 ? Math.round(toastDurationSec * 1000) : false,
            timerProgressBar: toastDurationSec > 0
        });
    };

    const triggerStickyToast = () => {
        Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            showCloseButton: true,
            timer: false, // Tidak auto-close
            backdrop: false,
            customClass: {
                popup: 'modern-toast'
            }
        }).fire({
            icon: 'info',
            title: 'Sinkronisasi Berlangsung',
            text: 'Proses impor data sedang berjalan di background. Anda dapat menutup notifikasi ini secara manual.'
        });
    };

    // Dialog Presets
    const triggerApprovalDialog = () => {
        Swal.fire({
            title: 'Setujui Penerbitan Kursus?',
            html: `
                <div class="swal-custom-content">
                    <p>Kursus <strong>"Etika Protokoler & Tata Kelola Persidangan"</strong> akan langsung dapat diakses oleh seluruh pegawai Setjen DPD RI.</p>
                    <div class="alert alert-info py-2 px-3 small text-start mb-0">
                        <i class="fas fa-info-circle me-1"></i> Notifikasi otomatis akan dikirimkan kepada instruktur terkait.
                    </div>
                </div>
            `,
            icon: 'question',
            iconColor: '#0d9488',
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-check me-1"></i> Ya, Setujui',
            cancelButtonText: '<i class="fas fa-times me-1"></i> Batal',
            confirmButtonColor: '#0d9488',
            cancelButtonColor: '#64748b',
            reverseButtons: true,
            focusCancel: true
        }).then((result) => {
            if (result.isConfirmed) {
                Toast().fire({
                    icon: 'success',
                    title: 'Kursus Berhasil Disetujui'
                });
            }
        });
    };

    const triggerRejectDialog = () => {
        Swal.fire({
            title: 'Tolak Verifikasi Materi',
            input: 'textarea',
            inputLabel: 'Alasan Penolakan (Wajib Diisi)',
            inputPlaceholder: 'Tuliskan alasan spesifik dan saran perbaikan untuk instruktur...',
            inputValidator: (value) => {
                if (!value || !value.trim()) {
                    return 'Alasan penolakan tidak boleh kosong!';
                }
            },
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-paper-plane me-1"></i> Kirim Penolakan',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#f43f5e',
            cancelButtonColor: '#64748b',
            reverseButtons: true
        }).then((result) => {
            if (result.isConfirmed && result.value) {
                Toast().fire({
                    icon: 'info',
                    title: 'Catatan Penolakan Terkirim',
                    text: `Catatan: "${result.value.substring(0, 35)}..."`
                });
            }
        });
    };

    const triggerAsyncProcessDialog = () => {
        let timerInterval;
        Swal.fire({
            title: 'Memproses Backup Sistem...',
            html: 'Menyiapkan arsip basis data & berkas materi: <b>0%</b>',
            timer: 2500,
            timerProgressBar: true,
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
                const timer = Swal.getHtmlContainer().querySelector('b');
                let progress = 0;
                timerInterval = setInterval(() => {
                    progress = Math.min(progress + 20, 100);
                    if (timer) timer.textContent = `${progress}%`;
                }, 400);
            },
            willClose: () => {
                clearInterval(timerInterval);
            }
        }).then((result) => {
            if (result.dismiss === Swal.DismissReason.timer) {
                Toast().fire({
                    icon: 'success',
                    title: 'Arsip Backup Berhasil Dibuat'
                });
            }
        });
    };

    const triggerMultiChoiceDialog = () => {
        Swal.fire({
            title: 'Tindakan Evaluasi Pengguna',
            text: 'Pilih status tindak lanjut untuk akun yang ditandai melanggar integritas belajar:',
            icon: 'warning',
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-ban me-1"></i> Bekukan Akun',
            denyButtonText: '<i class="fas fa-envelope me-1"></i> Kirim Peringatan',
            cancelButtonText: 'Tutup',
            confirmButtonColor: '#dc2626',
            denyButtonColor: '#f59e0b',
            cancelButtonColor: '#64748b'
        }).then((result) => {
            if (result.isConfirmed) {
                Toast().fire({ icon: 'error', title: 'Akun Ditangguhkan Sementara' });
            } else if (result.isDenied) {
                Toast().fire({ icon: 'info', title: 'Peringatan Resmi Dikirim via Email' });
            }
        });
    };

    // Live Playground Execution
    const executePlayground = () => {
        if (playType === 'toast') {
            Swal.mixin({
                toast: true,
                position: playPosition,
                showConfirmButton: playShowConfirm,
                showCancelButton: playShowCancel,
                backdrop: false,
                timer: playTimer > 0 ? playTimer : undefined,
                timerProgressBar: playTimer > 0,
                didOpen: (toast) => {
                    toast.addEventListener('mouseenter', Swal.stopTimer);
                    toast.addEventListener('mouseleave', Swal.resumeTimer);
                }
            }).fire({
                icon: playIcon,
                title: playTitle || 'Notifikasi Uji Coba',
                text: playText || undefined
            });
        } else {
            Swal.fire({
                title: playTitle || 'Kotak Dialog Uji Coba',
                text: playText || undefined,
                icon: playIcon,
                showConfirmButton: playShowConfirm,
                showCancelButton: playShowCancel,
                confirmButtonColor: '#0d9488',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Konfirmasi',
                cancelButtonText: 'Batal'
            });
        }
    };

    // Generate Code Snippet
    const getCodeSnippet = () => {
        if (playType === 'toast') {
            return `import Toast from '../plugin/Toast';\n\n// Trigger Toast Notifikasi\nToast().fire({\n    icon: '${playIcon}',\n    title: '${playTitle}',\n    text: '${playText}'${playTimer !== 2500 ? `,\n    timer: ${playTimer}` : ''}\n});`;
        } else {
            return `import Swal from 'sweetalert2';\n\n// Trigger Kotak Dialog\nSwal.fire({\n    title: '${playTitle}',\n    text: '${playText}',\n    icon: '${playIcon}',\n    showCancelButton: ${playShowCancel},\n    confirmButtonColor: '#0d9488',\n    cancelButtonColor: '#64748b',\n    confirmButtonText: 'Konfirmasi',\n    cancelButtonText: 'Batal'\n});`;
        }
    };

    const handleCopyCode = () => {
        navigator.clipboard.writeText(getCodeSnippet());
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
        Toast().fire({ icon: 'success', title: 'Kode berhasil disalin!' });
    };

    // Diagnostic Ping
    const handlePingApi = async () => {
        setPingLoading(true);
        const startTime = performance.now();
        try {
            // Ping simple endpoint
            const res = await useAxios.get('/user/profile/');
            const duration = Math.round(performance.now() - startTime);
            setPingResult({
                status: 'success',
                duration,
                statusCode: res.status,
                endpoint: `${API_BASE_URL}user/profile/`
            });
            Toast().fire({ icon: 'success', title: `Backend Merespon dalam ${duration}ms` });
        } catch (err) {
            const duration = Math.round(performance.now() - startTime);
            setPingResult({
                status: 'error',
                duration,
                statusCode: err.response?.status || 'Network Error',
                message: err.message || 'Gagal tersambung ke backend API',
                endpoint: `${API_BASE_URL}user/profile/`
            });
            Toast().fire({ icon: 'error', title: 'Gagal terhubung ke Backend API' });
        } finally {
            setPingLoading(false);
        }
    };

    // Native Browser Notification Test
    const handleRequestBrowserNotif = async () => {
        if (!('Notification' in window)) {
            Toast().fire({ icon: 'error', title: 'Browser tidak mendukung Web Notifications API' });
            return;
        }
        try {
            const perm = await Notification.requestPermission();
            setBrowserNotifStatus(perm);
            if (perm === 'granted') {
                new Notification('LMSetjen DPD RI - Uji Sistem', {
                    body: 'Notifikasi browser tingkat sistem berhasil diaktifkan dan dikirim.',
                    icon: '/favicon.ico'
                });
                Toast().fire({ icon: 'success', title: 'Izin Notifikasi Diterima' });
            } else {
                Toast().fire({ icon: 'warning', title: `Izin Notifikasi: ${perm}` });
            }
        } catch (e) {
            console.error('Error requesting notification permission:', e);
        }
    };

    const contentNode = (
        <div className="system-test-page" style={{ flex: "1 0 auto" }}>
            <div className={isEmbedded ? "py-2" : "container py-4"}>
                {/* Page Header */}
                <div className="system-test-header">
                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                            <div>
                                <h1 className="h3 mb-1 text-dark fw-bold">
                                    <i className="fas fa-vial text-primary me-2"></i> Pengujian Sistem & UI Showcase
                                </h1>
                                <p className="text-muted mb-0">
                                    Laboratorium pengujian dialog box, notifikasi toast, dan respon antarmuka LMSetjen DPD RI.
                                </p>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                                <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-2 rounded-pill">
                                    <i className="fas fa-shield-alt me-1"></i> Admin Privilege
                                </span>
                                <span className="badge bg-light text-secondary border px-3 py-2 rounded-pill">
                                    <i className="fas fa-user-circle me-1"></i> {userData?.full_name || userData?.username || 'Admin'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="system-test-tabs mb-4">
                        <button 
                            className={`test-tab-btn ${activeTab === 'toasts' ? 'active' : ''}`}
                            onClick={() => setActiveTab('toasts')}
                        >
                            <i className="fas fa-bell me-2"></i> Toast & Notifikasi
                        </button>
                        <button 
                            className={`test-tab-btn ${activeTab === 'dialogs' ? 'active' : ''}`}
                            onClick={() => setActiveTab('dialogs')}
                        >
                            <i className="fas fa-window-restore me-2"></i> Kotak Dialog & Konfirmasi
                        </button>
                        <button 
                            className={`test-tab-btn ${activeTab === 'playground' ? 'active' : ''}`}
                            onClick={() => setActiveTab('playground')}
                        >
                            <i className="fas fa-sliders-h me-2"></i> Live Generator & Playground
                        </button>
                        <button 
                            className={`test-tab-btn ${activeTab === 'diagnostics' ? 'active' : ''}`}
                            onClick={() => setActiveTab('diagnostics')}
                        >
                            <i className="fas fa-heartbeat me-2"></i> Diagnostik & API Ping
                        </button>
                    </div>

                    {/* TAB 1: TOAST NOTIFICATIONS */}
                    {activeTab === 'toasts' && (
                        <div>
                            {/* Setting Durasi Notifikasi */}
                            <div className="card test-card shadow-sm border-0 mb-4">
                                <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                                    <h6 className="mb-0 fw-bold text-dark">
                                        <i className="fas fa-stopwatch me-2 text-teal"></i> Pengaturan Durasi Tampil Notifikasi (Timer)
                                    </h6>
                                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-1 rounded-pill">
                                        <i className="fas fa-clock me-1"></i> {toastDurationSec === 0 ? 'Mode Sticky (Manual Close)' : `${toastDurationSec} Detik (${Math.round(toastDurationSec * 1000)} ms)`}
                                    </span>
                                </div>
                                <div className="card-body">
                                    <div className="row align-items-center g-3">
                                        <div className="col-lg-6">
                                            <div className="d-flex justify-content-between align-items-center mb-1">
                                                <label className="form-label small fw-semibold text-secondary mb-0">
                                                    Atur Lama Muncul Notifikasi:
                                                </label>
                                                <span className="badge bg-light text-dark border px-2 py-1 fw-bold font-monospace">
                                                    {toastDurationSec === 0 ? 'Sticky' : `${toastDurationSec}s`}
                                                </span>
                                            </div>
                                            <input 
                                                type="range" 
                                                className="form-range" 
                                                min="1" 
                                                max="10" 
                                                step="0.5"
                                                value={toastDurationSec === 0 ? 1 : toastDurationSec} 
                                                onChange={(e) => setToastDurationSec(parseFloat(e.target.value))}
                                            />
                                            <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.75rem' }}>
                                                <span>1 Detik (Cepat)</span>
                                                <span>2.5s (Default)</span>
                                                <span>5 Detik</span>
                                                <span>10 Detik (Lama)</span>
                                            </div>
                                        </div>
                                        <div className="col-lg-6">
                                            <label className="form-label small fw-semibold text-secondary mb-1">Pilihan Cepat (Preset Detik):</label>
                                            <div className="d-flex flex-wrap gap-2">
                                                {[1.5, 2.5, 3.5, 5, 8].map((sec) => (
                                                    <button
                                                        key={sec}
                                                        type="button"
                                                        className={`btn btn-sm ${toastDurationSec === sec ? 'btn-primary' : 'btn-outline-secondary'}`}
                                                        onClick={() => setToastDurationSec(sec)}
                                                    >
                                                        {sec}s {sec === 2.5 ? '(Default)' : ''}
                                                    </button>
                                                ))}
                                                <button
                                                    type="button"
                                                    className={`btn btn-sm ${toastDurationSec === 0 ? 'btn-dark' : 'btn-outline-dark'}`}
                                                    onClick={() => setToastDurationSec(0)}
                                                    title="Notifikasi tidak otomatis tertutup"
                                                >
                                                    <i className="fas fa-thumbtack me-1"></i> Sticky
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="alert alert-light border small text-muted mb-0 mt-3 py-2 d-flex align-items-center justify-content-between flex-wrap gap-2">
                                        <div>
                                            <i className="fas fa-info-circle text-primary me-2"></i>
                                            Semua tombol pengujian notifikasi di bawah ini akan menggunakan durasi <strong>{toastDurationSec === 0 ? 'Sticky (Manual Close)' : `${toastDurationSec} detik`}</strong>.
                                        </div>
                                        <button 
                                            type="button" 
                                            className="btn btn-sm btn-outline-primary"
                                            onClick={() => triggerPresetToast('success', 'Uji Durasi Notifikasi', `Notifikasi ini akan tertutup dalam ${toastDurationSec} detik.`)}
                                        >
                                            <i className="fas fa-play me-1"></i> Uji Durasi Sekarang
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="row g-4">
                            {/* Standard Presets */}
                            <div className="col-lg-6">
                                <div className="card test-card h-100 shadow-sm border-0">
                                    <div className="card-header bg-white py-3">
                                        <h6 className="mb-0 fw-bold text-dark">
                                            <i className="fas fa-palette me-2 text-primary"></i> Preset Tipe Notifikasi Standar
                                        </h6>
                                    </div>
                                    <div className="card-body">
                                        <p className="text-muted small">
                                            Notifikasi melayang (Toasts) menggunakan konfigurasi <code>Toast.js</code> dengan backdrop blur, icon animatif, dan progress bar.
                                        </p>
                                        <div className="d-grid gap-2">
                                            <button 
                                                className="btn btn-outline-success text-start d-flex justify-content-between align-items-center p-2"
                                                onClick={() => triggerPresetToast('success', 'Operasi Berhasil', 'Data berhasil diperbarui ke dalam sistem')}
                                            >
                                                <span><i className="fas fa-check-circle me-2 text-success"></i> Toast Sukses (Success)</span>
                                                <i className="fas fa-play text-muted small"></i>
                                            </button>
                                            <button 
                                                className="btn btn-outline-danger text-start d-flex justify-content-between align-items-center p-2"
                                                onClick={() => triggerPresetToast('error', 'Terjadi Kesalahan', 'Gagal memproses data. Periksa koneksi atau input Anda.')}
                                            >
                                                <span><i className="fas fa-times-circle me-2 text-danger"></i> Toast Gagal (Error)</span>
                                                <i className="fas fa-play text-muted small"></i>
                                            </button>
                                            <button 
                                                className="btn btn-outline-warning text-start d-flex justify-content-between align-items-center p-2"
                                                onClick={() => triggerPresetToast('warning', 'Peringatan Sistem', 'Format berkas video tidak sesuai rekomendasi.')}
                                            >
                                                <span><i className="fas fa-exclamation-triangle me-2 text-warning"></i> Toast Peringatan (Warning)</span>
                                                <i className="fas fa-play text-muted small"></i>
                                            </button>
                                            <button 
                                                className="btn btn-outline-info text-start d-flex justify-content-between align-items-center p-2"
                                                onClick={() => triggerPresetToast('info', 'Informasi Sistem', 'Terdapat pembaruan data modul pembelajaran.')}
                                            >
                                                <span><i className="fas fa-info-circle me-2 text-info"></i> Toast Informasi (Info)</span>
                                                <i className="fas fa-play text-muted small"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Position & Special Toasts */}
                            <div className="col-lg-6">
                                <div className="card test-card h-100 shadow-sm border-0">
                                    <div className="card-header bg-white py-3">
                                        <h6 className="mb-0 fw-bold text-dark">
                                            <i className="fas fa-crosshairs me-2 text-warning"></i> Posisi & Kasus Khusus
                                        </h6>
                                    </div>
                                    <div className="card-body">
                                        <p className="text-muted small">
                                            Uji penempatan notifikasi di berbagai sudut layar untuk memastikan responsivitas mobile & desktop:
                                        </p>
                                        <div className="row g-2 mb-3">
                                            <div className="col-6">
                                                <button className="btn btn-light border w-100 text-start small" onClick={() => triggerPositionToast('top-start')}>
                                                    <i className="fas fa-arrow-up-left me-1"></i> Top Start (Kiri Atas)
                                                </button>
                                            </div>
                                            <div className="col-6">
                                                <button className="btn btn-light border w-100 text-start small" onClick={() => triggerPositionToast('top-end')}>
                                                    <i className="fas fa-arrow-up-right me-1"></i> Top End (Default)
                                                </button>
                                            </div>
                                            <div className="col-6">
                                                <button className="btn btn-light border w-100 text-start small" onClick={() => triggerPositionToast('bottom-start')}>
                                                    <i className="fas fa-arrow-down-left me-1"></i> Bottom Start
                                                </button>
                                            </div>
                                            <div className="col-6">
                                                <button className="btn btn-light border w-100 text-start small" onClick={() => triggerPositionToast('bottom-end')}>
                                                    <i className="fas fa-arrow-down-right me-1"></i> Bottom End
                                                </button>
                                            </div>
                                        </div>
                                        <div className="d-grid gap-2">
                                            <button className="btn btn-outline-secondary text-start p-2" onClick={triggerLongToast}>
                                                <i className="fas fa-align-left me-2"></i> Toast Pesan Panjang (Multibaris)
                                            </button>
                                            <button className="btn btn-outline-secondary text-start p-2" onClick={triggerStickyToast}>
                                                <i className="fas fa-thumbtack me-2"></i> Toast Tetap (Sticky / Manual Close)
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    )}

                    {/* TAB 2: DIALOG BOXES & CONFIRMATION */}
                    {activeTab === 'dialogs' && (
                        <div className="row g-4">
                            <div className="col-lg-6">
                                <div className="card test-card h-100 shadow-sm border-0">
                                    <div className="card-header bg-white py-3">
                                        <h6 className="mb-0 fw-bold text-dark">
                                            <i className="fas fa-exclamation-circle me-2 text-danger"></i> Dialog Konfirmasi Kritis
                                        </h6>
                                    </div>
                                    <div className="card-body">
                                        <p className="text-muted small">
                                            Kotak dialog konfirmasi aksi destruktif dengan proteksi penekanan tidak sengaja dan tombol kontras tinggi:
                                        </p>
                                        <div className="d-grid gap-3">
                                            <button 
                                                className="btn btn-outline-danger text-start p-3 rounded-3"
                                                onClick={() => DeleteConfirmation({
                                                    title: 'Hapus Kursus Ini?',
                                                    text: 'Kursus "Teknik Penyusunan Naskah Kebijakan DPD RI" akan dihapus secara permanen beserta seluruh rekaman nilai siswa.'
                                                })}
                                            >
                                                <div className="fw-bold"><i className="fas fa-trash-alt me-2"></i> Delete Confirmation Dialog</div>
                                                <div className="small text-muted">Aksi destruktif permanen dengan tombol Ya, Hapus merah.</div>
                                            </button>

                                            <button 
                                                className="btn btn-outline-secondary text-start p-3 rounded-3"
                                                onClick={() => LogoutConfirmation()}
                                            >
                                                <div className="fw-bold"><i className="fas fa-sign-out-alt me-2 text-teal"></i> Logout Confirmation Dialog</div>
                                                <div className="small text-muted">Konfirmasi keluar sesi akun dengan opsi Batal dan Keluar.</div>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="col-lg-6">
                                <div className="card test-card h-100 shadow-sm border-0">
                                    <div className="card-header bg-white py-3">
                                        <h6 className="mb-0 fw-bold text-dark">
                                            <i className="fas fa-tasks me-2 text-primary"></i> Dialog Interaktif & Alur Kerja
                                        </h6>
                                    </div>
                                    <div className="card-body">
                                        <p className="text-muted small">
                                            Simulasi kotak dialog dengan konten HTML kustom, input formulir langsung, dan proses asynchronous:
                                        </p>
                                        <div className="d-grid gap-2">
                                            <button className="btn btn-outline-primary text-start p-2" onClick={triggerApprovalDialog}>
                                                <i className="fas fa-check-double me-2 text-teal"></i> Dialog Persetujuan (Rich HTML Content)
                                            </button>
                                            <button className="btn btn-outline-danger text-start p-2" onClick={triggerRejectDialog}>
                                                <i className="fas fa-comment-dots me-2 text-danger"></i> Dialog Form Prompt (Input Alasan Penolakan)
                                            </button>
                                            <button className="btn btn-outline-secondary text-start p-2" onClick={triggerAsyncProcessDialog}>
                                                <i className="fas fa-spinner fa-spin me-2 text-primary"></i> Dialog Proses Asinkron (Loading & Progress)
                                            </button>
                                            <button className="btn btn-outline-warning text-start p-2" onClick={triggerMultiChoiceDialog}>
                                                <i className="fas fa-list-ol me-2 text-warning"></i> Dialog Multi-Opsi (3 Tindakan Berbeda)
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: LIVE GENERATOR & PLAYGROUND */}
                    {activeTab === 'playground' && (
                        <div className="card test-card shadow-sm border-0">
                            <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                                <h6 className="mb-0 fw-bold text-dark">
                                    <i className="fas fa-magic me-2 text-success"></i> Generator Notifikasi & Dialog Interaktif
                                </h6>
                                <span className="badge bg-success-subtle text-success border border-success-subtle">
                                    Live Preview & Code Export
                                </span>
                            </div>
                            <div className="card-body">
                                <div className="row g-4">
                                    {/* Left Controls */}
                                    <div className="col-lg-6 border-end">
                                        <h6 className="fw-bold mb-3 text-secondary">Parameter Pengujian</h6>
                                        <div className="mb-3">
                                            <label className="form-label small fw-semibold">Format Komponen</label>
                                            <div className="btn-group w-100" role="group">
                                                <button 
                                                    type="button" 
                                                    className={`btn btn-sm ${playType === 'toast' ? 'btn-primary' : 'btn-outline-primary'}`}
                                                    onClick={() => setPlayType('toast')}
                                                >
                                                    <i className="fas fa-bell me-1"></i> Toast Notification
                                                </button>
                                                <button 
                                                    type="button" 
                                                    className={`btn btn-sm ${playType === 'dialog' ? 'btn-primary' : 'btn-outline-primary'}`}
                                                    onClick={() => {
                                                        setPlayType('dialog');
                                                        setPlayShowConfirm(true);
                                                        setPlayShowCancel(true);
                                                    }}
                                                >
                                                    <i className="fas fa-window-maximize me-1"></i> Modal / Dialog Box
                                                </button>
                                            </div>
                                        </div>

                                        <div className="mb-3">
                                            <label className="form-label small fw-semibold">Judul Pesan</label>
                                            <input 
                                                type="text" 
                                                className="form-control form-control-sm"
                                                value={playTitle} 
                                                onChange={(e) => setPlayTitle(e.target.value)} 
                                                placeholder="Masukkan judul notifikasi..."
                                            />
                                        </div>

                                        <div className="mb-3">
                                            <label className="form-label small fw-semibold">Isi Teks / Keterangan</label>
                                            <textarea 
                                                className="form-control form-control-sm"
                                                rows="2"
                                                value={playText} 
                                                onChange={(e) => setPlayText(e.target.value)}
                                                placeholder="Tuliskan isi keterangan..."
                                            />
                                        </div>

                                        <div className="row g-2 mb-3">
                                            <div className="col-sm-6">
                                                <label className="form-label small fw-semibold">Icon</label>
                                                <select 
                                                    className="form-select form-select-sm"
                                                    value={playIcon} 
                                                    onChange={(e) => setPlayIcon(e.target.value)}
                                                >
                                                    <option value="success">Success (Hijau)</option>
                                                    <option value="error">Error (Merah)</option>
                                                    <option value="warning">Warning (Kuning)</option>
                                                    <option value="info">Info (Biru)</option>
                                                    <option value="question">Question (Tanya)</option>
                                                </select>
                                            </div>
                                            {playType === 'toast' ? (
                                                <div className="col-sm-6">
                                                    <label className="form-label small fw-semibold">Posisi Layar</label>
                                                    <select 
                                                        className="form-select form-select-sm"
                                                        value={playPosition} 
                                                        onChange={(e) => setPlayPosition(e.target.value)}
                                                    >
                                                        <option value="top-end">Top End (Kanan Atas)</option>
                                                        <option value="top-start">Top Start (Kiri Atas)</option>
                                                        <option value="top-center">Top Center (Tengah Atas)</option>
                                                        <option value="bottom-end">Bottom End (Kanan Bawah)</option>
                                                        <option value="bottom-start">Bottom Start (Kiri Bawah)</option>
                                                        <option value="bottom-center">Bottom Center (Tengah Bawah)</option>
                                                    </select>
                                                </div>
                                            ) : (
                                                <div className="col-sm-6">
                                                    <label className="form-label small fw-semibold">Tombol Batal</label>
                                                    <div className="form-check form-switch mt-1">
                                                        <input 
                                                            className="form-check-input" 
                                                            type="checkbox" 
                                                            checked={playShowCancel}
                                                            onChange={(e) => setPlayShowCancel(e.target.checked)}
                                                            id="toggleCancelBtn"
                                                        />
                                                        <label className="form-check-label small" htmlFor="toggleCancelBtn">Tampilkan Tombol Batal</label>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {playType === 'toast' && (
                                            <div className="mb-4">
                                                <label className="form-label small fw-semibold d-flex justify-content-between">
                                                    <span>Durasi Timer Otomatis</span>
                                                    <span className="text-teal fw-bold">{playTimer === 0 ? 'Manual (Sticky)' : `${(playTimer / 1000).toFixed(1)} Detik (${playTimer} ms)`}</span>
                                                </label>
                                                <input 
                                                    type="range" 
                                                    className="form-range" 
                                                    min="0" 
                                                    max="8000" 
                                                    step="500"
                                                    value={playTimer} 
                                                    onChange={(e) => setPlayTimer(Number(e.target.value))}
                                                />
                                            </div>
                                        )}

                                        <button 
                                            className="btn btn-primary w-100 py-2 fw-semibold"
                                            onClick={executePlayground}
                                        >
                                            <i className="fas fa-play me-2"></i> Tampilkan & Uji Sekarang
                                        </button>
                                    </div>

                                    {/* Right Code Snippet */}
                                    <div className="col-lg-6">
                                        <div className="d-flex justify-content-between align-items-center mb-3">
                                            <h6 className="fw-bold mb-0 text-secondary">Potongan Kode Siap Pakai (Snippet)</h6>
                                            <button 
                                                className="btn btn-sm btn-outline-secondary"
                                                onClick={handleCopyCode}
                                            >
                                                <i className={`fas ${copiedCode ? 'fa-check text-success' : 'fa-copy'} me-1`}></i>
                                                {copiedCode ? 'Tersalin!' : 'Salin Kode'}
                                            </button>
                                        </div>
                                        <div className="code-snippet-box p-3 bg-dark text-light rounded-3 font-monospace small">
                                            <pre className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                                                {getCodeSnippet()}
                                            </pre>
                                        </div>
                                        <div className="mt-3 p-3 bg-light rounded-3 border">
                                            <h6 className="small fw-bold text-dark mb-1">
                                                <i className="fas fa-lightbulb text-warning me-1"></i> Tips Implementasi
                                            </h6>
                                            <p className="text-muted small mb-0">
                                                Untuk memicu notifikasi toast dari komponen lain, cukup import <code>Toast</code> dari <code>@/views/plugin/Toast</code> dan panggil <code>Toast().fire(...)</code> setelah respon API berhasil diterima.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 4: DIAGNOSTICS & API PING */}
                    {activeTab === 'diagnostics' && (
                        <div className="row g-4">
                            <div className="col-lg-6">
                                <div className="card test-card h-100 shadow-sm border-0">
                                    <div className="card-header bg-white py-3">
                                        <h6 className="mb-0 fw-bold text-dark">
                                            <i className="fas fa-wifi me-2 text-primary"></i> Uji Respon & Latensi Backend
                                        </h6>
                                    </div>
                                    <div className="card-body">
                                        <p className="text-muted small">
                                            Periksa kecepatan respon server backend dan pastikan header Authorization Bearer Token berfungsi secara optimal:
                                        </p>
                                        <button 
                                            className="btn btn-outline-primary mb-3"
                                            onClick={handlePingApi}
                                            disabled={pingLoading}
                                        >
                                            {pingLoading ? (
                                                <span><i className="fas fa-spinner fa-spin me-2"></i> Mengukur Latensi...</span>
                                            ) : (
                                                <span><i className="fas fa-tachometer-alt me-2"></i> Jalankan Ping API Backend</span>
                                            )}
                                        </button>

                                        {pingResult && (
                                            <div className={`p-3 rounded-3 border ${pingResult.status === 'success' ? 'bg-success-subtle border-success-subtle' : 'bg-danger-subtle border-danger-subtle'}`}>
                                                <div className="d-flex justify-content-between align-items-center mb-1">
                                                    <span className="fw-bold small">Status Endpoint:</span>
                                                    <span className={`badge ${pingResult.status === 'success' ? 'bg-success' : 'bg-danger'}`}>
                                                        HTTP {pingResult.statusCode}
                                                    </span>
                                                </div>
                                                <div className="small mb-1">
                                                    <strong>Latensi:</strong> <span className="badge bg-dark">{pingResult.duration} ms</span>
                                                </div>
                                                <div className="small text-muted text-break">
                                                    <strong>Target:</strong> {pingResult.endpoint}
                                                </div>
                                                {pingResult.message && (
                                                    <div className="small text-danger mt-1">
                                                        <strong>Error:</strong> {pingResult.message}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="col-lg-6">
                                <div className="card test-card h-100 shadow-sm border-0">
                                    <div className="card-header bg-white py-3">
                                        <h6 className="mb-0 fw-bold text-dark">
                                            <i className="fas fa-bell-slash me-2 text-warning"></i> Browser Web Notifications API
                                        </h6>
                                    </div>
                                    <div className="card-body">
                                        <p className="text-muted small">
                                            Uji dukungan notifikasi native browser (OS-level notifications) untuk pemberitahuan saat tab sedang tidak aktif:
                                        </p>
                                        <div className="mb-3">
                                            <span className="small text-muted me-2">Status Izin Browser:</span>
                                            <span className={`badge ${browserNotifStatus === 'granted' ? 'bg-success' : browserNotifStatus === 'denied' ? 'bg-danger' : 'bg-warning'}`}>
                                                {browserNotifStatus.toUpperCase()}
                                            </span>
                                        </div>
                                        <button 
                                            className="btn btn-outline-warning"
                                            onClick={handleRequestBrowserNotif}
                                        >
                                            <i className="fas fa-paper-plane me-2"></i> Minta Izin & Kirim Notifikasi Native
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
    );

    if (isEmbedded) {
        return contentNode;
    }

    return (
        <div className="admin-page-wrapper">
            <AdminHeader />
            <main className="admin-dashboard-container">
                <div className="container-fluid px-3 px-xl-4 footer-container">
                    {contentNode}
                </div>
            </main>
            <Footer />
        </div>
    );
}

export default SystemTestAdmin;

