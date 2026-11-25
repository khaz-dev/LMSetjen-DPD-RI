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
            // Status match
            if (statusFilter !== "all" && rec.status.toLowerCase() !== statusFilter.toLowerCase()) {
                return false;
            }
            // Unit match
            if (unitFilter !== "all" && rec.unit_kerja.toLowerCase() !== unitFilter.toLowerCase()) {
                return false;
            }
            // Search query match
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

    return (
        <div className="asn-audit-container">
            {/* 1. Official Hero Banner & Regulation Context */}
            <div className="asn-audit-hero-card no-print">
                <div className="asn-audit-hero-header">
                    <div>
                        <div className="asn-audit-badge-group mb-2">
                            <span className="asn-badge-law">
                                <i className="fas fa-balance-scale me-1"></i>
                                UU NO. 20 TAHUN 2023 PASAL 49
                            </span>
                            <span className="asn-badge-lan">
                                <i className="fas fa-certificate me-1"></i>
                                PERATURAN LAN RI NO. 10 TAHUN 2018
                            </span>
                            <span className="asn-badge-bureau">
                                <i className="fas fa-landmark me-1"></i>
                                BIRO OKK SETJEN DPD RI
                            </span>
                        </div>
                        <h4 className="asn-audit-hero-title">
                            Audit Capaian Pengembangan Kompetensi Tahunan Pegawai ASN
                        </h4>
                        <p className="asn-audit-hero-subtitle">
                            Monev kepatuhan kewajiban dan hak pengembangan diri minimal <strong>20 Jam Pelajaran (JP)</strong> per tahun (1 JP = 45 menit / 2.700 detik).
                        </p>
                    </div>

                    <div className="asn-audit-hero-controls">
                        <div className="asn-year-select-wrapper">
                            <span className="asn-year-label">
                                <i className="fas fa-calendar-alt me-1 text-teal"></i>
                                Tahun Anggaran:
                            </span>
                            <select
                                className="asn-year-select"
                                value={selectedYear}
                                onChange={handleYearChange}
                                disabled={loading}
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
                            className="btn-asn-audit-excel"
                            onClick={handleExportExcel}
                            disabled={exporting || loading}
                            title="Unduh file Excel multi-sheet resmi"
                        >
                            <i className={exporting ? "fas fa-spinner fa-spin" : "fas fa-file-excel"}></i>
                            <span>{exporting ? "Mengunduh..." : "Ekspor Excel (.xlsx)"}</span>
                        </button>

                        <button
                            type="button"
                            className="btn-asn-audit-print"
                            onClick={handlePrint}
                            disabled={loading}
                            title="Cetak Berita Acara & Rekapitulasi Audit Resmi"
                        >
                            <i className="fas fa-print"></i>
                            <span>Cetak Berita Acara</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Executive KPI Cards */}
            <div className="asn-kpi-grid no-print">
                <div className="asn-kpi-card">
                    <div className="asn-kpi-icon icon-teal">
                        <i className="fas fa-award"></i>
                    </div>
                    <div className="asn-kpi-info">
                        <div className="asn-kpi-title">Akumulasi JP Disalurkan</div>
                        <div className="asn-kpi-num">
                            {Number(kpi.total_jp_earned || 0).toLocaleString("id-ID")} <span style={{ fontSize: "0.95rem", color: "#0d9488" }}>JP</span>
                        </div>
                        <div className="asn-kpi-sub">
                            Rata-rata <strong>{kpi.avg_jp_per_asn || 0} JP</strong> per ASN terdaftar
                        </div>
                    </div>
                </div>

                <div className="asn-kpi-card">
                    <div className="asn-kpi-icon icon-green">
                        <i className="fas fa-check-circle"></i>
                    </div>
                    <div className="asn-kpi-info">
                        <div className="asn-kpi-title">Memenuhi Syarat (≥ 20 JP)</div>
                        <div className="asn-kpi-num text-success">
                            {Number(kpi.compliant_count || 0).toLocaleString("id-ID")}{" "}
                            <span style={{ fontSize: "0.9rem", color: "#10b981" }}>({kpi.compliance_rate || 0}%)</span>
                        </div>
                        <div className="asn-kpi-sub">
                            Telah mencapai target tahunan ASN
                        </div>
                    </div>
                </div>

                <div className="asn-kpi-card">
                    <div className="asn-kpi-icon icon-amber">
                        <i className="fas fa-hourglass-half"></i>
                    </div>
                    <div className="asn-kpi-info">
                        <div className="asn-kpi-title">Sedang Berjalan (1 - 19 JP)</div>
                        <div className="asn-kpi-num text-warning">
                            {Number(kpi.in_progress_count || 0).toLocaleString("id-ID")}{" "}
                            <span style={{ fontSize: "0.9rem", color: "#64748b" }}>Pegawai</span>
                        </div>
                        <div className="asn-kpi-sub">
                            Dalam proses penambahan jam pelatihan
                        </div>
                    </div>
                </div>

                <div className="asn-kpi-card">
                    <div className="asn-kpi-icon icon-red">
                        <i className="fas fa-exclamation-triangle"></i>
                    </div>
                    <div className="asn-kpi-info">
                        <div className="asn-kpi-title">Belum Memulai (0 JP)</div>
                        <div className="asn-kpi-num text-danger">
                            {Number(kpi.non_compliant_count || 0).toLocaleString("id-ID")}{" "}
                            <span style={{ fontSize: "0.9rem", color: "#64748b" }}>Pegawai</span>
                        </div>
                        <div className="asn-kpi-sub">
                            Perlu pendorongan kepatuhan (At-Risk)
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Sub-Navigation Tabs */}
            <div className="asn-audit-nav-tabs no-print">
                <button
                    type="button"
                    className={`asn-audit-tab-btn ${activeSubTab === "transcripts" ? "active" : ""}`}
                    onClick={() => setActiveSubTab("transcripts")}
                >
                    <i className="fas fa-users-viewfinder"></i>
                    <span>Transkrip Audit Pegawai ({filteredRecords.length})</span>
                </button>
                <button
                    type="button"
                    className={`asn-audit-tab-btn ${activeSubTab === "units" ? "active" : ""}`}
                    onClick={() => setActiveSubTab("units")}
                >
                    <i className="fas fa-sitemap"></i>
                    <span>Rekapitulasi per Unit Kerja ({byUnitKerja.length})</span>
                </button>
                <button
                    type="button"
                    className={`asn-audit-tab-btn ${activeSubTab === "minute" ? "active" : ""}`}
                    onClick={() => setActiveSubTab("minute")}
                >
                    <i className="fas fa-file-contract"></i>
                    <span>Berita Acara & Dokumen Cetak</span>
                </button>
            </div>

            {/* TAB CONTENT 1: TRANSKRIP AUDIT PEGAWAI */}
            {activeSubTab === "transcripts" && (
                <div className="d-flex flex-column gap-3 no-print">
                    {/* Toolbar & Filters */}
                    <div className="asn-audit-toolbar">
                        <div className="asn-audit-search-box">
                            <i className="fas fa-search text-muted"></i>
                            <input
                                type="text"
                                className="asn-audit-search-input"
                                placeholder="Cari nama, NIP, atau jabatan..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    className="btn btn-sm text-muted p-0 ms-1 border-0 bg-transparent"
                                    onClick={() => setSearchQuery("")}
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            )}
                        </div>

                        <div className="asn-audit-filter-group">
                            <select
                                className="asn-audit-filter-select"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="all">Semua Status Kepatuhan</option>
                                <option value="memenuhi_syarat">Memenuhi Syarat (≥ 20 JP)</option>
                                <option value="sedang_berjalan">Sedang Berjalan (1 - 19 JP)</option>
                                <option value="belum_memulai">Belum Memulai (0 JP)</option>
                            </select>

                            <select
                                className="asn-audit-filter-select"
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
                    </div>

                    {/* Table */}
                    <div className="asn-audit-table-card">
                        {loading ? (
                            <div className="text-center py-5">
                                <div className="spinner-border text-teal mb-3" role="status">
                                    <span className="visually-hidden">Memuat data audit...</span>
                                </div>
                                <div className="fw-semibold text-dark">Memuat transkrip audit kompetensi ASN...</div>
                            </div>
                        ) : filteredRecords.length === 0 ? (
                            <div className="text-center py-5">
                                <i className="fas fa-user-slash text-muted fa-3x mb-3"></i>
                                <div className="fw-semibold text-dark">Tidak ada data pegawai yang sesuai filter</div>
                                <div className="text-muted small">Coba ubah kata kunci pencarian atau filter status.</div>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="asn-audit-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: "45px" }} className="text-center">No</th>
                                            <th>Pegawai ASN</th>
                                            <th>Unit Kerja & Jabatan</th>
                                            <th className="text-center" style={{ width: "95px" }}>Sertifikat</th>
                                            <th className="text-center" style={{ width: "110px" }}>Capaian JP</th>
                                            <th style={{ width: "140px" }}>Progress Target</th>
                                            <th className="text-center" style={{ width: "160px" }}>Status Audit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRecords.map((r, idx) => {
                                            const isCompliant = r.status === "MEMENUHI_SYARAT";
                                            const isInProgress = r.status === "SEDANG_BERJALAN";
                                            return (
                                                <tr key={r.user_id || idx}>
                                                    <td className="text-center text-muted fw-semibold">{idx + 1}</td>
                                                    <td>
                                                        <div className="fw-bold text-dark">{r.full_name}</div>
                                                        <div className="text-muted" style={{ fontSize: "0.74rem" }}>
                                                            NIP: {r.nip} &bull; {r.email}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="fw-semibold text-dark" style={{ fontSize: "0.82rem" }}>
                                                            {r.unit_kerja}
                                                        </div>
                                                        <div className="text-muted" style={{ fontSize: "0.74rem" }}>
                                                            {r.jabatan} {r.golongan !== "-" ? `(${r.golongan})` : ""}
                                                        </div>
                                                    </td>
                                                    <td className="text-center">
                                                        <span className="badge bg-light text-dark border">
                                                            {r.certificates_count} Lembar
                                                        </span>
                                                    </td>
                                                    <td className="text-center">
                                                        <span className="fw-bold text-teal" style={{ fontSize: "0.95rem" }}>
                                                            {r.total_jp} JP
                                                        </span>
                                                        <div className="text-muted" style={{ fontSize: "0.68rem" }}>
                                                            Target 20 JP
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="asn-progress-wrap">
                                                            <div className="d-flex justify-content-between align-items-center" style={{ fontSize: "0.68rem" }}>
                                                                <span className="fw-semibold">{r.fulfillment_pct}%</span>
                                                                {r.gap_jp > 0 ? (
                                                                    <span className="text-muted">Kurang {r.gap_jp} JP</span>
                                                                ) : (
                                                                    <span className="text-success fw-bold">Tercapai</span>
                                                                )}
                                                            </div>
                                                            <div className="asn-progress-bar-bg">
                                                                <div
                                                                    className={`asn-progress-bar-fill ${isCompliant ? "fill-green" : isInProgress ? "fill-amber" : "fill-red"}`}
                                                                    style={{ width: `${Math.min(100, r.fulfillment_pct)}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="text-center">
                                                        <span className={`asn-status-tag ${isCompliant ? "tag-compliant" : isInProgress ? "tag-inprogress" : "tag-noncompliant"}`}>
                                                            <i className={`fas ${isCompliant ? "fa-check-circle" : isInProgress ? "fa-clock" : "fa-times-circle"}`}></i>
                                                            {isCompliant ? "Memenuhi Syarat" : isInProgress ? "Sedang Berjalan" : "Belum Memulai"}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB CONTENT 2: REKAPITULASI UNIT KERJA */}
            {activeSubTab === "units" && (
                <div className="asn-audit-table-card no-print">
                    <div className="p-3 border-bottom d-flex align-items-center justify-content-between">
                        <div>
                            <h6 className="fw-bold text-dark mb-0">
                                <i className="fas fa-sitemap me-2 text-teal"></i>
                                Pemeringkatan Kepatuhan Pengembangan Kompetensi per Unit Kerja
                            </h6>
                            <span className="text-muted small">
                                Berdasarkan persentase pegawai yang telah memenuhi standar 20 JP pada Tahun Anggaran {selectedYear}.
                            </span>
                        </div>
                    </div>

                    <div className="table-responsive">
                        <table className="asn-audit-table">
                            <thead>
                                <tr>
                                    <th style={{ width: "45px" }} className="text-center">Peringkat</th>
                                    <th>Unit Kerja / Satuan Organisasi</th>
                                    <th className="text-center" style={{ width: "120px" }}>Total Pegawai</th>
                                    <th className="text-center" style={{ width: "130px" }}>JP Tersalurkan</th>
                                    <th className="text-center" style={{ width: "120px" }}>Rata-rata JP</th>
                                    <th className="text-center" style={{ width: "140px" }}>Lulus Target (≥ 20 JP)</th>
                                    <th style={{ width: "160px" }}>Tingkat Kepatuhan</th>
                                </tr>
                            </thead>
                            <tbody>
                                {byUnitKerja.map((u, idx) => (
                                    <tr key={u.unit_kerja || idx}>
                                        <td className="text-center fw-bold text-dark">{idx + 1}</td>
                                        <td>
                                            <div className="fw-bold text-dark">{u.unit_kerja}</div>
                                        </td>
                                        <td className="text-center">
                                            <span className="badge bg-light text-dark border">
                                                {u.total_pegawai} Pegawai
                                            </span>
                                        </td>
                                        <td className="text-center fw-bold text-teal">
                                            {u.total_jp} JP
                                        </td>
                                        <td className="text-center fw-semibold">
                                            {u.avg_jp} JP
                                        </td>
                                        <td className="text-center">
                                            <span className="badge bg-success-subtle text-success border border-success-subtle">
                                                {u.compliant_count} Pegawai
                                            </span>
                                        </td>
                                        <td>
                                            <div className="asn-progress-wrap">
                                                <div className="d-flex justify-content-between align-items-center" style={{ fontSize: "0.72rem" }}>
                                                    <span className="fw-bold text-dark">{u.compliance_rate}%</span>
                                                    <span className="text-muted">{u.compliant_count}/{u.total_pegawai}</span>
                                                </div>
                                                <div className="asn-progress-bar-bg">
                                                    <div
                                                        className={`asn-progress-bar-fill ${u.compliance_rate >= 70 ? "fill-green" : u.compliance_rate >= 35 ? "fill-amber" : "fill-red"}`}
                                                        style={{ width: `${Math.min(100, u.compliance_rate)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB CONTENT 3: BERITA ACARA & FORMAT CETAK RESMI */}
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

                    <p style={{ fontSize: "0.85rem", lineHeight: "1.6", textAlign: "justify" }}>
                        Berdasarkan ketentuan <strong>Undang-Undang Nomor 20 Tahun 2023 tentang Aparatur Sipil Negara Pasal 49</strong> serta <strong>Peraturan Lembaga Administrasi Negara (LAN RI) Nomor 10 Tahun 2018 tentang Pengembangan Kompetensi Pegawai Negeri Sipil</strong>, setiap Pegawai ASN berhak dan wajib melaksanakan pengembangan kompetensi minimal <strong>20 (dua puluh) Jam Pelajaran (JP)</strong> per tahun (1 JP = 45 menit / 2.700 detik).
                    </p>

                    <h6 className="fw-bold mt-4 mb-2" style={{ fontSize: "0.88rem" }}>
                        I. RINGKASAN REKAPITULASI CAPAIAN KOMPETENSI SISTEM E-LEARNING
                    </h6>
                    <table className="table table-bordered table-sm" style={{ fontSize: "0.82rem" }}>
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

                    <h6 className="fw-bold mt-4 mb-2" style={{ fontSize: "0.88rem" }}>
                        II. PENGESAHAN HASIL AUDIT KOMPETENSI
                    </h6>
                    <p style={{ fontSize: "0.82rem", lineHeight: "1.5" }}>
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

                    <div className="text-center mt-4 no-print">
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => window.print()}
                        >
                            <i className="fas fa-print me-2"></i>
                            Cetak Halaman Ini
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ASNCompetencyAuditTab;
