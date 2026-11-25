import React, { useState, useEffect, useCallback, useMemo } from "react";
import apiInstance from "../../../utils/axios";
import Toast from "../../plugin/Toast";
import logoSetjenDPD from "../../../assets/logo/logo-setjen-dpd.png";
import "./ASNCompetencyAuditTab.css";

const ASNCompetencyAuditTab = ({ refreshTrigger }) => {
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState(null);

    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [availableYears, setAvailableYears] = useState([new Date().getFullYear()]);
    const [legalFramework, setLegalFramework] = useState(null);
    const [kpi, setKpi] = useState({
        total_asn: 0,
        total_jp_earned: 0,
        total_certificates_issued: 0,
        compliant_count: 0,
        in_progress_count: 0,
        non_compliant_count: 0,
        compliance_rate: 0,
        avg_jp_per_asn: 0,
        annual_target_jp: 20
    });
    const [byUnitKerja, setByUnitKerja] = useState([]);
    const [unitNames, setUnitNames] = useState([]);
    const [records, setRecords] = useState([]);

    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [unitFilter, setUnitFilter] = useState("all");
    const [activeSubTab, setActiveSubTab] = useState("transcripts"); // 'transcripts' | 'units' | 'minute'

    // Fetch audit data from backend
    const fetchAuditData = useCallback(async (year) => {
        setLoading(true);
        setError(null);
        try {
            const yr = year || selectedYear;
            const res = await apiInstance.get(`admin/asn-competency-audit/?year=${yr}`);
            const data = res.data;

            if (data) {
                setLegalFramework(data.legal_framework);
                if (data.available_years && data.available_years.length > 0) {
                    setAvailableYears(data.available_years);
                }
                if (data.kpi) {
                    setKpi(data.kpi);
                }
                setByUnitKerja(data.by_unit_kerja || []);
                setUnitNames(data.unit_names || []);
                setRecords(data.records || []);
            }
        } catch (err) {
            console.error("Error fetching ASN competency audit data:", err);
            setError(err?.response?.data?.error || "Gagal memuat data audit kompetensi ASN.");
            Toast("error", "Gagal memuat data audit kompetensi.");
        } finally {
            setLoading(false);
        }
    }, [selectedYear]);

    useEffect(() => {
        fetchAuditData(selectedYear);
    }, [fetchAuditData, selectedYear, refreshTrigger]);

    // Handle Year Change
    const handleYearChange = (e) => {
        const yr = parseInt(e.target.value, 10);
        setSelectedYear(yr);
        fetchAuditData(yr);
    };

    // Client-side filtering
    const filteredRecords = useMemo(() => {
        return records.filter((rec) => {
            if (statusFilter !== "all" && rec.status.toLowerCase() !== statusFilter.toLowerCase()) {
                return false;
            }
            if (unitFilter !== "all" && rec.unit_kerja.toLowerCase() !== unitFilter.toLowerCase()) {
                return false;
            }
            if (searchQuery.trim()) {
                const sq = searchQuery.toLowerCase().trim();
                const matchName = (rec.full_name || "").toLowerCase().includes(sq);
                const matchNip = (rec.nip || "").toLowerCase().includes(sq);
                const matchUnit = (rec.unit_kerja || "").toLowerCase().includes(sq);
                const matchPos = (rec.jabatan || "").toLowerCase().includes(sq);
                if (!matchName && !matchNip && !matchUnit && !matchPos) {
                    return false;
                }
            }
            return true;
        });
    }, [records, statusFilter, unitFilter, searchQuery]);

    // Handle Excel Export
    const handleExportExcel = async () => {
        setExporting(true);
        try {
            const res = await apiInstance.get(`admin/asn-competency-audit/export-excel/?year=${selectedYear}`, {
                responseType: "blob"
            });
            const blob = new Blob([res.data], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `Laporan_Audit_Kompetensi_ASN_Setjen_DPD_RI_${selectedYear}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            Toast("success", "Laporan audit kompetensi berhasil diunduh.");
        } catch (err) {
            console.error("Export Excel Error:", err);
            Toast("error", "Gagal mengunduh file Excel audit kompetensi.");
        } finally {
            setExporting(false);
        }
    };

    // Handle Print
    const handlePrint = () => {
        setActiveSubTab("minute");
        setTimeout(() => {
            window.print();
        }, 200);
    };

    // Helper: User Initials
    const getInitials = (name) => {
        if (!name) return "AS";
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    };

    // Distribution percentages for mini bar
    const totalCount = kpi.total_asn || 1;
    const compliantPct = Math.round(((kpi.compliant_count || 0) / totalCount) * 100);
    const inProgressPct = Math.round(((kpi.in_progress_count || 0) / totalCount) * 100);
    const nonCompliantPct = Math.max(0, 100 - compliantPct - inProgressPct);

    return (
        <div className="asn-audit-compact-wrapper">
            {/* 1. Sleek Executive Command Bar */}
            <div className="asn-compact-hero no-print">
                <div className="asn-hero-flex">
                    <div className="asn-hero-brand">
                        <div className="asn-hero-emblem">
                            <i className="fas fa-balance-scale"></i>
                        </div>
                        <div className="asn-hero-text">
                            <div className="asn-hero-title-row">
                                <h4 className="asn-hero-title">Audit Capaian Kompetensi Tahunan ASN</h4>
                                <span className="asn-law-chip">
                                    <i className="fas fa-gavel me-1"></i>UU 20/2023 Pasal 49
                                </span>
                                <span className="asn-lan-chip">
                                    <i className="fas fa-certificate me-1"></i>Perka LAN 10/2018
                                </span>
                            </div>
                            <p className="asn-hero-sub">
                                Standar Wajib Min. <strong>20 JP/Pegawai/Tahun</strong> (1 JP = 45 Menit / 2.700 Detik) &bull; Biro OKK Setjen DPD RI
                            </p>
                        </div>
                    </div>

                    <div className="asn-hero-actions">
                        <div className="asn-year-box">
                            <i className="fas fa-calendar-alt"></i>
                            <select
                                className="asn-year-select-compact"
                                value={selectedYear}
                                onChange={handleYearChange}
                                disabled={loading}
                                title="Pilih Tahun Anggaran Audit"
                            >
                                {availableYears.map((yr) => (
                                    <option key={yr} value={yr}>
                                        Tahun {yr}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            type="button"
                            className="btn-hero-action btn-hero-excel"
                            onClick={handleExportExcel}
                            disabled={exporting || loading}
                            title="Unduh rekapitulasi lengkap Excel (.xlsx) resmi"
                        >
                            <i className={exporting ? "fas fa-spinner fa-spin" : "fas fa-file-excel"}></i>
                            <span>{exporting ? "Unduh..." : "Ekspor (.xlsx)"}</span>
                        </button>

                        <button
                            type="button"
                            className="btn-hero-action btn-hero-print"
                            onClick={handlePrint}
                            disabled={loading}
                            title="Format cetak dokumen resmi Berita Acara"
                        >
                            <i className="fas fa-print"></i>
                            <span>Berita Acara</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Compact Integrated Metric Ribbon */}
            <div className="asn-metric-ribbon no-print">
                <div className="asn-ribbon-grid">
                    {/* Metrik 1: Total JP */}
                    <div className="asn-ribbon-item">
                        <div className="asn-ribbon-icon bg-teal-subtle">
                            <i className="fas fa-graduation-cap"></i>
                        </div>
                        <div className="asn-ribbon-data">
                            <span className="asn-ribbon-label">Total JP Disalurkan</span>
                            <div className="asn-ribbon-val-row">
                                <span className="asn-ribbon-val text-teal">
                                    {Number(kpi.total_jp_earned || 0).toLocaleString("id-ID")}
                                </span>
                                <span className="badge bg-light text-teal border border-teal-subtle asn-ribbon-badge">
                                    Rata-rata {kpi.avg_jp_per_asn || 0} JP
                                </span>
                            </div>
                            <span className="asn-ribbon-subtext">
                                Dari {kpi.total_certificates_issued || 0} sertifikat sah terverifikasi
                            </span>
                        </div>
                    </div>

                    {/* Metrik 2: Memenuhi Target 20 JP */}
                    <div className="asn-ribbon-item">
                        <div className="asn-ribbon-icon bg-green-subtle">
                            <i className="fas fa-check-double"></i>
                        </div>
                        <div className="asn-ribbon-data">
                            <span className="asn-ribbon-label">Memenuhi Syarat (≥ 20 JP)</span>
                            <div className="asn-ribbon-val-row">
                                <span className="asn-ribbon-val text-success">
                                    {kpi.compliant_count || 0}
                                </span>
                                <span className="badge bg-success-subtle text-success asn-ribbon-badge">
                                    {kpi.compliance_rate || 0}% Kepatuhan
                                </span>
                            </div>
                            <span className="asn-ribbon-subtext">
                                Target 20 JP tahunan terpenuhi penuh
                            </span>
                        </div>
                    </div>

                    {/* Metrik 3: Sedang Berjalan */}
                    <div className="asn-ribbon-item">
                        <div className="asn-ribbon-icon bg-amber-subtle">
                            <i className="fas fa-hourglass-half"></i>
                        </div>
                        <div className="asn-ribbon-data">
                            <span className="asn-ribbon-label">Sedang Berjalan (1-19 JP)</span>
                            <div className="asn-ribbon-val-row">
                                <span className="asn-ribbon-val text-warning">
                                    {kpi.in_progress_count || 0}
                                </span>
                                <span className="badge bg-warning-subtle text-warning asn-ribbon-badge">
                                    {inProgressPct}% Pegawai
                                </span>
                            </div>
                            <span className="asn-ribbon-subtext">
                                Telah mulai mengumpulkan jam pelatihan
                            </span>
                        </div>
                    </div>

                    {/* Metrik 4: Belum Memulai */}
                    <div className="asn-ribbon-item">
                        <div className="asn-ribbon-icon bg-red-subtle">
                            <i className="fas fa-exclamation-triangle"></i>
                        </div>
                        <div className="asn-ribbon-data">
                            <span className="asn-ribbon-label">Belum Memulai (0 JP)</span>
                            <div className="asn-ribbon-val-row">
                                <span className="asn-ribbon-val text-danger">
                                    {kpi.non_compliant_count || 0}
                                </span>
                                <span className="badge bg-danger-subtle text-danger asn-ribbon-badge">
                                    {nonCompliantPct}% At-Risk
                                </span>
                            </div>
                            <span className="asn-ribbon-subtext">
                                Perlu intervensi & pendorongan diklat
                            </span>
                        </div>
                    </div>
                </div>

                {/* Multi-segment Distribution Bar */}
                <div className="asn-distribution-strip">
                    <div className="asn-strip-header">
                        <span>Distribusi Kepatuhan Kompetensi ASN {selectedYear} ({kpi.total_asn} Pegawai)</span>
                        <span>
                            <strong className="text-success">{compliantPct}% Memenuhi</strong> &bull;{" "}
                            <strong className="text-warning">{inProgressPct}% Proses</strong> &bull;{" "}
                            <strong className="text-danger">{nonCompliantPct}% Belum</strong>
                        </span>
                    </div>
                    <div className="asn-strip-bar">
                        <div className="asn-segment-compliant" style={{ width: `${compliantPct}%` }} title={`Memenuhi Syarat: ${kpi.compliant_count} Pegawai (${compliantPct}%)`}></div>
                        <div className="asn-segment-progress" style={{ width: `${inProgressPct}%` }} title={`Sedang Berjalan: ${kpi.in_progress_count} Pegawai (${inProgressPct}%)`}></div>
                        <div className="asn-segment-risk" style={{ width: `${nonCompliantPct}%` }} title={`Belum Memulai: ${kpi.non_compliant_count} Pegawai (${nonCompliantPct}%)`}></div>
                    </div>
                </div>
            </div>

            {/* 3. Main Data Card with Integrated Header Bar & Filter Cluster */}
            <div className="asn-main-card no-print">
                {/* Card Header Bar (Subnav + Filters in One Row) */}
                <div className="asn-card-header-bar">
                    <div className="asn-subnav-group">
                        <button
                            type="button"
                            className={`asn-subnav-btn ${activeSubTab === "transcripts" ? "active" : ""}`}
                            onClick={() => setActiveSubTab("transcripts")}
                        >
                            <i className="fas fa-users-viewfinder"></i>
                            <span>Transkrip Pegawai</span>
                            <span className="asn-subnav-badge">{filteredRecords.length}</span>
                        </button>
                        <button
                            type="button"
                            className={`asn-subnav-btn ${activeSubTab === "units" ? "active" : ""}`}
                            onClick={() => setActiveSubTab("units")}
                        >
                            <i className="fas fa-sitemap"></i>
                            <span>Rekapitulasi Unit</span>
                            <span className="asn-subnav-badge">{byUnitKerja.length}</span>
                        </button>
                        <button
                            type="button"
                            className={`asn-subnav-btn ${activeSubTab === "minute" ? "active" : ""}`}
                            onClick={() => setActiveSubTab("minute")}
                        >
                            <i className="fas fa-file-contract"></i>
                            <span>Berita Acara Resmi</span>
                        </button>
                    </div>

                    {/* Integrated Search and Filter cluster (Active on Transcripts & Units) */}
                    {activeSubTab === "transcripts" && (
                        <div className="asn-filter-cluster">
                            <div className="asn-search-pill">
                                <i className="fas fa-search"></i>
                                <input
                                    type="text"
                                    className="asn-search-input-compact"
                                    placeholder="Cari nama, NIP, jabatan..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        className="btn btn-sm text-muted p-0 border-0 bg-transparent"
                                        onClick={() => setSearchQuery("")}
                                    >
                                        <i className="fas fa-times"></i>
                                    </button>
                                )}
                            </div>

                            <select
                                className="asn-select-compact"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="all">Semua Status</option>
                                <option value="memenuhi_syarat">Memenuhi (≥ 20 JP)</option>
                                <option value="sedang_berjalan">Berjalan (1-19 JP)</option>
                                <option value="belum_memulai">Belum Memulai (0 JP)</option>
                            </select>

                            <select
                                className="asn-select-compact"
                                value={unitFilter}
                                onChange={(e) => setUnitFilter(e.target.value)}
                            >
                                <option value="all">Semua Unit Kerja</option>
                                {unitNames.map((u) => (
                                    <option key={u} value={u}>
                                        {u}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Horizontal Scroll Hint Indicator */}
                    {activeSubTab !== "minute" && (
                        <div className="d-none d-lg-flex align-items-center ms-auto">
                            <span className="badge bg-light text-muted border py-1 px-2 d-inline-flex align-items-center gap-1" style={{ fontSize: "0.68rem" }}>
                                <i className="fas fa-arrows-left-right text-teal"></i> Geser horizontal untuk melihat kolom lengkap
                            </span>
                        </div>
                    )}
                </div>

                {/* Sub-Tab 1: Transkrip Audit Pegawai Table */}
                {activeSubTab === "transcripts" && (
                    <>
                        {loading ? (
                            <div className="text-center py-4">
                                <div className="spinner-border spinner-border-sm text-teal mb-2" role="status">
                                    <span className="visually-hidden">Memuat...</span>
                                </div>
                                <div className="text-muted small">Memuat transkrip audit kompetensi ASN...</div>
                            </div>
                        ) : filteredRecords.length === 0 ? (
                            <div className="text-center py-5">
                                <i className="fas fa-user-slash text-muted fa-2x mb-2"></i>
                                <div className="fw-semibold text-dark small">Tidak ada data pegawai yang sesuai filter</div>
                                <div className="text-muted" style={{ fontSize: "0.72rem" }}>
                                    Coba ubah kata kunci pencarian atau sesuaikan filter status/unit kerja.
                                </div>
                            </div>
                        ) : (
                            <div className="table-responsive asn-table-scroll-wrapper">
                                <table className="asn-table-compact">
                                    <thead>
                                        <tr>
                                            <th style={{ width: "38px" }} className="text-center">No</th>
                                            <th>Pegawai ASN</th>
                                            <th>Unit Kerja & Jabatan</th>
                                            <th className="text-center" style={{ width: "90px" }}>Sertifikat</th>
                                            <th className="text-center" style={{ width: "95px" }}>Capaian</th>
                                            <th style={{ width: "120px" }}>Target 20 JP</th>
                                            <th className="text-center" style={{ width: "145px" }}>Status Kepatuhan</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRecords.map((r, idx) => {
                                            const isCompliant = r.status === "MEMENUHI_SYARAT";
                                            const isInProgress = r.status === "SEDANG_BERJALAN";
                                            return (
                                                <tr key={r.user_id || idx}>
                                                    <td className="text-center text-muted fw-semibold" style={{ fontSize: "0.74rem" }}>
                                                        {idx + 1}
                                                    </td>
                                                    <td>
                                                        <div className="asn-user-cell">
                                                            <div className="asn-avatar-circle">
                                                                {getInitials(r.full_name)}
                                                            </div>
                                                            <div className="asn-user-meta">
                                                                <span className="asn-user-name" title={r.full_name}>
                                                                    {r.full_name}
                                                                </span>
                                                                <span className="asn-user-sub">
                                                                    NIP: {r.nip}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="asn-unit-cell">
                                                            <span className="asn-unit-name" title={r.unit_kerja}>
                                                                {r.unit_kerja}
                                                            </span>
                                                            <span className="asn-unit-pos" title={r.jabatan}>
                                                                {r.jabatan} {r.golongan !== "-" ? `(${r.golongan})` : ""}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="text-center">
                                                        <span className="badge bg-light text-dark border" style={{ fontSize: "0.72rem" }}>
                                                            {r.certificates_count} Lembar
                                                        </span>
                                                    </td>
                                                    <td className="text-center">
                                                        <span className="fw-bold text-teal" style={{ fontSize: "0.86rem" }}>
                                                            {r.total_jp} JP
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="asn-mini-progress" title={`Capaian ${r.total_jp} dari target 20 JP (${r.fulfillment_pct}%)`}>
                                                            <div className="asn-mini-bar-bg">
                                                                <div
                                                                    className={`asn-mini-bar-fill ${isCompliant ? "bg-success" : isInProgress ? "bg-warning" : "bg-danger"}`}
                                                                    style={{ width: `${Math.min(100, r.fulfillment_pct)}%` }}
                                                                ></div>
                                                            </div>
                                                            <span className="asn-mini-pct">
                                                                {r.fulfillment_pct}%
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="text-center">
                                                        <span className={`asn-pill ${isCompliant ? "pill-compliant" : isInProgress ? "pill-progress" : "pill-risk"}`}>
                                                            <span className="asn-pill-dot"></span>
                                                            <span>{isCompliant ? "Memenuhi Syarat" : isInProgress ? "Sedang Berjalan" : "Belum Memulai"}</span>
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <div className="asn-table-footer">
                            <span>
                                Menampilkan <strong>{filteredRecords.length}</strong> dari <strong>{records.length}</strong> pegawai ASN terdaftar
                            </span>
                            <span>
                                Standar Audit: Min. 20 JP / Tahun Anggaran {selectedYear}
                            </span>
                        </div>
                    </>
                )}

                {/* Sub-Tab 2: Rekapitulasi per Unit Kerja */}
                {activeSubTab === "units" && (
                    <>
                        <div className="table-responsive asn-table-scroll-wrapper">
                            <table className="asn-table-compact">
                                <thead>
                                    <tr>
                                        <th style={{ width: "38px" }} className="text-center">No</th>
                                        <th>Unit Kerja / Satuan Organisasi</th>
                                        <th className="text-center" style={{ width: "100px" }}>Pegawai</th>
                                        <th className="text-center" style={{ width: "110px" }}>JP Tersalurkan</th>
                                        <th className="text-center" style={{ width: "95px" }}>Rata-rata</th>
                                        <th className="text-center" style={{ width: "135px" }}>Lulus Target (≥20 JP)</th>
                                        <th style={{ width: "130px" }}>Tingkat Kepatuhan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {byUnitKerja.map((u, idx) => (
                                        <tr key={u.unit_kerja || idx}>
                                            <td className="text-center fw-bold text-muted" style={{ fontSize: "0.74rem" }}>
                                                {idx + 1}
                                            </td>
                                            <td>
                                                <div className="fw-bold text-dark" style={{ fontSize: "0.82rem" }}>
                                                    {u.unit_kerja}
                                                </div>
                                            </td>
                                            <td className="text-center">
                                                <span className="badge bg-light text-dark border" style={{ fontSize: "0.72rem" }}>
                                                    {u.total_pegawai} ASN
                                                </span>
                                            </td>
                                            <td className="text-center fw-bold text-teal" style={{ fontSize: "0.84rem" }}>
                                                {u.total_jp} JP
                                            </td>
                                            <td className="text-center fw-semibold text-dark" style={{ fontSize: "0.82rem" }}>
                                                {u.avg_jp} JP
                                            </td>
                                            <td className="text-center">
                                                <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: "0.72rem" }}>
                                                    {u.compliant_count} Pegawai
                                                </span>
                                            </td>
                                            <td>
                                                <div className="asn-mini-progress">
                                                    <div className="asn-mini-bar-bg">
                                                        <div
                                                            className={`asn-mini-bar-fill ${u.compliance_rate >= 70 ? "bg-success" : u.compliance_rate >= 35 ? "bg-warning" : "bg-danger"}`}
                                                            style={{ width: `${Math.min(100, u.compliance_rate)}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="asn-mini-pct fw-bold">
                                                        {u.compliance_rate}%
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="asn-table-footer">
                            <span>
                                Total <strong>{byUnitKerja.length}</strong> unit kerja / satuan organisasi
                            </span>
                            <span>
                                Diurutkan berdasarkan persentase kepatuhan target 20 JP
                            </span>
                        </div>
                    </>
                )}
            </div>

            {/* TAB CONTENT 3: BERITA ACARA RESMI (Format Cetak Formal A4) */}
            {activeSubTab === "minute" && (
                <div className="asn-print-sheet">
                    {/* Kop Surat Resmi */}
                    <div className="asn-print-kop">
                        <img src={logoSetjenDPD} alt="Logo Setjen DPD RI" className="asn-print-logo" />
                        <div className="asn-print-kop-text">
                            <h4 className="asn-print-kop-institution">
                                SEKRETARIAT JENDERAL DEWAN PERWAKILAN DAERAH REPUBLIK INDONESIA
                            </h4>
                            <h5 className="asn-print-kop-bureau">
                                BIRO ORGANISASI, KEANGGOTAAN, DAN KEPEGAWAIAN
                            </h5>
                            <p className="asn-print-kop-address">
                                Gedung B DPD RI, Kompleks Parlemen Senayan, Jl. Jenderal Gatot Subroto No. 6, Jakarta Pusat 10270
                            </p>
                        </div>
                    </div>

                    {/* Judul Berita Acara */}
                    <div className="asn-print-doc-title">
                        <h5>
                            BERITA ACARA AUDIT KEPATUHAN PENGEMBANGAN KOMPETENSI PEGAWAI ASN
                        </h5>
                        <p>
                            Nomor: BA.AUDIT/LMS-DPD/{selectedYear}/01 &bull; Tahun Anggaran {selectedYear}
                        </p>
                    </div>

                    <p style={{ fontSize: "0.82rem", lineHeight: "1.55", textAlign: "justify" }}>
                        Berdasarkan ketentuan <strong>Undang-Undang Nomor 20 Tahun 2023 tentang Aparatur Sipil Negara Pasal 49</strong> serta <strong>Peraturan Lembaga Administrasi Negara (LAN RI) Nomor 10 Tahun 2018 tentang Pengembangan Kompetensi Pegawai Negeri Sipil</strong>, setiap Pegawai ASN berhak dan wajib melaksanakan pengembangan kompetensi minimal <strong>20 (dua puluh) Jam Pelajaran (JP)</strong> per tahun (1 JP = 45 menit / 2.700 detik).
                    </p>

                    <h6 className="fw-bold mt-3 mb-2" style={{ fontSize: "0.84rem" }}>
                        I. RINGKASAN REKAPITULASI CAPAIAN KOMPETENSI SISTEM E-LEARNING
                    </h6>
                    <table className="table table-bordered table-sm" style={{ fontSize: "0.78rem" }}>
                        <tbody>
                            <tr>
                                <td style={{ width: "40%", fontWeight: "600" }}>Tahun Anggaran Audit</td>
                                <td>Tahun {selectedYear}</td>
                            </tr>
                            <tr>
                                <td style={{ fontWeight: "600" }}>Standar Minimum Kompetensi ASN</td>
                                <td>20 Jam Pelajaran (JP) per Pegawai / Tahun</td>
                            </tr>
                            <tr>
                                <td style={{ fontWeight: "600" }}>Total Pegawai ASN Terdaftar</td>
                                <td>{kpi.total_asn} Pegawai</td>
                            </tr>
                            <tr>
                                <td style={{ fontWeight: "600" }}>Total Jam Pelatihan (JP) Disalurkan</td>
                                <td>{kpi.total_jp_earned} JP ASN</td>
                            </tr>
                            <tr>
                                <td style={{ fontWeight: "600" }}>Total Sertifikat Sah Diterbitkan</td>
                                <td>{kpi.total_certificates_issued} Lembar</td>
                            </tr>
                            <tr>
                                <td style={{ fontWeight: "600" }}>Pegawai Memenuhi Syarat (≥ 20 JP)</td>
                                <td className="fw-bold text-success">{kpi.compliant_count} Pegawai ({kpi.compliance_rate}%)</td>
                            </tr>
                            <tr>
                                <td style={{ fontWeight: "600" }}>Pegawai Sedang Berjalan (1 - 19 JP)</td>
                                <td className="fw-bold text-warning">{kpi.in_progress_count} Pegawai</td>
                            </tr>
                            <tr>
                                <td style={{ fontWeight: "600" }}>Pegawai Belum Memulai (0 JP)</td>
                                <td className="fw-bold text-danger">{kpi.non_compliant_count} Pegawai</td>
                            </tr>
                            <tr>
                                <td style={{ fontWeight: "600" }}>Rata-rata Capaian per Pegawai</td>
                                <td className="fw-bold text-teal">{kpi.avg_jp_per_asn} JP</td>
                            </tr>
                        </tbody>
                    </table>

                    <h6 className="fw-bold mt-3 mb-2" style={{ fontSize: "0.84rem" }}>
                        II. PENGESAHAN HASIL AUDIT KOMPETENSI
                    </h6>
                    <p style={{ fontSize: "0.78rem", lineHeight: "1.5" }}>
                        Demikian Berita Acara Audit ini diterbitkan secara sah melalui platform pembelajaran resmi Corporate University Sekretariat Jenderal DPD RI untuk digunakan sebagai laporan resmi pertanggungjawaban pengembangan kompetensi pegawai kepada pimpinan dan instansi pembina (LAN RI & BKN).
                    </p>

                    <div className="asn-print-signatures">
                        <div className="asn-print-sig-col">
                            <div className="asn-print-sig-title">
                                Mengetahui,<br />
                                Administrator Sistem E-Learning
                            </div>
                            <p className="asn-print-sig-name">Tim Administrator LMS</p>
                            <p className="asn-print-sig-nip">Pusat Teknologi Informasi & Pembelajaran</p>
                        </div>

                        <div className="asn-print-sig-col">
                            <div className="asn-print-sig-title">
                                Disahkan di Jakarta, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}<br />
                                Kepala Biro Organisasi Keanggotaan dan Kepegawaian
                            </div>
                            <p className="asn-print-sig-name">Dr. Fitriani, A.P., M.Si.</p>
                            <p className="asn-print-sig-nip">NIP. 19741017 199311 2 001</p>
                        </div>
                    </div>

                    <div className="text-center mt-3 no-print">
                        <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => window.print()}
                        >
                            <i className="fas fa-print me-2"></i>
                            Cetak Dokumen Berita Acara Ini
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ASNCompetencyAuditTab;
