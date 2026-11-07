import React from "react";

/**
 * QAReportModal Component
 * Modal for reporting inappropriate questions or answers with admin review feedback
 */
const QAReportModal = ({
    show,
    onClose,
    reportingQA,
    reportingQAType,
    currentReportData,
    editingReportId,
    closedReports = new Set(),
    qaReportReason,
    setQaReportReason,
    qaReportDescription,
    setQaReportDescription,
    handleSubmitQAReport,
    handleEditQAReport,
}) => {
    if (!show) return null;

    return (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0)' }}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content abuse-report-modal">
                    <div className="modal-header abuse-modal-header">
                        <h5 className="modal-title">
                            {currentReportData ? (
                                <>
                                    <i className="fas fa-file-check me-2"></i>
                                    Status Laporan {reportingQAType === 'message' ? 'Balasan' : 'Pertanyaan'}
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-exclamation-triangle me-2"></i>
                                    Laporkan {reportingQAType === 'message' ? 'Balasan' : 'Pertanyaan'}
                                </>
                            )}
                        </h5>
                        <button
                            type="button"
                            className="btn-close"
                            onClick={onClose}
                            disabled={reportingQA}
                        ></button>
                    </div>
                    <div className="modal-body">
                        {currentReportData && !editingReportId ? (
                            <>
                                {/* Report Status Section */}
                                <div className="mb-0">
                                    <div className="d-flex align-items-center gap-2 mb-0">
                                        <span className="fw-semibold">Status Laporan:</span>
                                        {currentReportData.status === 'pending' && (
                                            <span className="badge bg-warning">
                                                <i className="fas fa-hourglass-half me-1"></i>
                                                Menunggu Tinjauan
                                            </span>
                                        )}
                                        {currentReportData.status === 'reviewed' && (
                                            <span className="badge bg-info">
                                                <i className="fas fa-eye me-1"></i>
                                                Sudah Ditinjau
                                            </span>
                                        )}
                                        {currentReportData.status === 'action_taken' && (
                                            <span className="badge bg-success">
                                                <i className="fas fa-check-circle me-1"></i>
                                                Tindakan Diambil
                                            </span>
                                        )}
                                        {currentReportData.status === 'dismissed' && (
                                            <span className="badge bg-secondary">
                                                <i className="fas fa-times-circle me-1"></i>
                                                Ditolak
                                            </span>
                                        )}
                                    </div>

                                    <div>
                                        {/* Report Details */}
                                        <div className="card bg-light mb-3">
                                            <div className="card-body">
                                                <div className="d-flex justify-content-between align-items-start mb-3">
                                                    <label className="form-label fw-semibold text-muted mb-0">Alasan yang Dilaporkan:</label>
                                                    <p className="mb-0 text-end">
                                                        {currentReportData.reason === 'spam' && '🚫 Spam'}
                                                        {currentReportData.reason === 'inappropriate' && '⚠️ Konten Tidak Pantas'}
                                                        {currentReportData.reason === 'offensive' && '😠 Konten Menyinggung'}
                                                        {currentReportData.reason === 'misinformation' && '❌ Informasi Salah'}
                                                        {currentReportData.reason === 'other' && '❓ Lainnya'}
                                                    </p>
                                                </div>

                                                {currentReportData.description && (
                                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                                        <label className="form-label fw-semibold text-muted mb-0">Deskripsi Laporan:</label>
                                                        <p className="mb-0 text-break text-end ps-2">{currentReportData.description}</p>
                                                    </div>
                                                )}

                                                <div className="d-flex justify-content-between align-items-start">
                                                    <label className="form-label fw-semibold text-muted mb-0">Tanggal Lapor:</label>
                                                    <p className="mb-0 text-end">{currentReportData.reported_at ? new Date(currentReportData.reported_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Admin Feedback Section */}
                                        {currentReportData.reviewed_at && (
                                            <div className="card border-success mb-0">
                                                <div className="card-body border-success">
                                                    <h6 className="card-title text-success mb-3">
                                                        <i className="fas fa-shield-alt me-2"></i>
                                                        Umpan Balik Admin
                                                    </h6>

                                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                                        <label className="form-label fw-semibold text-muted mb-0">Ditinjau Pada:</label>
                                                        <p className="mb-0 text-end">{new Date(currentReportData.reviewed_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                                    </div>

                                                    {currentReportData.reviewed_by__first_name || currentReportData.reviewed_by__username ? (
                                                        <div className="d-flex justify-content-between align-items-start mb-3">
                                                            <label className="form-label fw-semibold text-muted mb-0">Ditinjau Oleh:</label>
                                                            <p className="mb-0 text-end">{currentReportData.reviewed_by__first_name || currentReportData.reviewed_by__username || 'Admin'}</p>
                                                        </div>
                                                    ) : null}

                                                    {currentReportData.review_notes && (
                                                        <div className="mb-0">
                                                            <label className="form-label fw-semibold text-muted mb-2">Catatan Admin:</label>
                                                            <div className="alert alert-info mb-0">
                                                                <p className="mb-0 text-break">{currentReportData.review_notes}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Pending Status Message */}
                                    {currentReportData.status === 'pending' && !currentReportData.reviewed_at && (
                                        <div className="alert alert-warning mb-2">
                                            <i className="fas fa-info-circle me-2"></i>
                                            Laporan ini sedang dalam proses tinjauan. Tim Admin kami akan memberikan umpan balik dalam waktu singkat.
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                {editingReportId && (
                                    <div className="alert alert-info mb-3">
                                        <i className="fas fa-pencil-alt me-2"></i>
                                        Anda sedang mengedit laporan Anda. Laporan akan dikirim ke Admin untuk tinjauan ulang.
                                    </div>
                                )}
                                {!editingReportId && (
                                    <p className="abuse-modal-text">
                                        Bantu kami menjaga kualitas komunitas dengan melaporkan konten yang tidak sesuai.
                                    </p>
                                )}

                                <div className="mb-3">
                                    <label className="form-label fw-semibold">Alasan Laporan <span className="text-danger">*</span></label>
                                    <select
                                        className="form-select form-select-modern"
                                        value={qaReportReason}
                                        onChange={(e) => setQaReportReason(e.target.value)}
                                        disabled={reportingQA}
                                    >
                                        <option value="">-- Pilih Alasan --</option>
                                        <option value="spam">Spam</option>
                                        <option value="inappropriate">Konten Tidak Pantas</option>
                                        <option value="offensive">Konten Menyinggung</option>
                                        <option value="misinformation">Informasi Salah</option>
                                        <option value="other">Lainnya</option>
                                    </select>
                                </div>

                                <div className="mb-3">
                                    <label className="form-label fw-semibold">Penjelasan Tambahan (Opsional)</label>
                                    <textarea
                                        className="form-control"
                                        rows="3"
                                        placeholder="Berikan rincian untuk membantu Admin memahami masalah ini..."
                                        value={qaReportDescription}
                                        onChange={(e) => setQaReportDescription(e.target.value)}
                                        disabled={reportingQA}
                                    ></textarea>
                                    <small className="text-muted">Maksimal 500 karakter</small>
                                </div>

                                <div className="alert alert-info">
                                    <i className="fas fa-info-circle me-2"></i>
                                    {editingReportId
                                        ? 'Perubahan laporan Anda akan ditinjau ulang oleh Admin.'
                                        : 'Tim Admin kami akan meninjau laporan ini dan mengambil tindakan yang sesuai.'
                                    }
                                </div>
                            </>
                        )}
                    </div>
                    <div className="modal-footer abuse-modal-footer">
                        {!editingReportId && (!currentReportData || (currentReportData?.status !== 'pending' && !closedReports.has(currentReportData?.id))) && (
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={onClose}
                                disabled={reportingQA}
                            >
                                {currentReportData ? 'Selesai' : 'Batal'}
                            </button>
                        )}

                        {currentReportData && !editingReportId && currentReportData?.status !== 'pending' && !closedReports.has(currentReportData?.id) && (
                            <button
                                type="button"
                                className="btn btn-warning"
                                onClick={handleEditQAReport}
                                disabled={reportingQA}
                            >
                                <i className="fas fa-edit me-2"></i>
                                Edit Laporan
                            </button>
                        )}

                        {(!currentReportData || editingReportId) && (
                            <button
                                type="button"
                                className="btn btn-danger"
                                onClick={handleSubmitQAReport}
                                disabled={reportingQA || !qaReportReason.trim()}
                            >
                                {reportingQA ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                        {editingReportId ? 'Mengirim ulang...' : 'Mengirim...'}
                                    </>
                                ) : (
                                    <>
                                        <i className={`fas ${editingReportId ? 'fa-redo' : 'fa-paper-plane'} me-2`}></i>
                                        {editingReportId ? 'Laporkan Ulang' : 'Laporkan'}
                                    </>
                                )}
                            </button>
                        )}

                        {currentReportData && !editingReportId && currentReportData?.status === 'pending' && (
                            <div className="flex-grow-1">
                                <p className="text-center text-muted mb-0 small">
                                    <i className="fas fa-clock me-2"></i>
                                    Laporan sedang ditinjau oleh Admin
                                </p>
                            </div>
                        )}

                        {currentReportData && !editingReportId && currentReportData?.status !== 'pending' && closedReports.has(currentReportData?.id) && (
                            <div className="flex-grow-1">
                                <p className="text-center text-success mb-0 small fw-semibold">
                                    <i className="fas fa-check-circle me-2"></i>
                                    Kasus Ditutup - Laporan Selesai
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(QAReportModal);

