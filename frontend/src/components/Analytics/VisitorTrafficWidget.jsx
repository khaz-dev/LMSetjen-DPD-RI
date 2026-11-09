import React, { useState, useEffect, useMemo, useCallback } from "react";
import apiInstance from "../../utils/axios";
import { Line } from "react-chartjs-2";
import "./VisitorTrafficWidget.css";

/**
 * 📊 VisitorTrafficWidget
 * Komponen Grafik & Analisis Tren Pengguna Mengunjungi LMSetjen DPD RI
 * 
 * Memungkinkan Administrator memantau fluktuasi pengunjung berdasarkan:
 * - Jam (00:00 - 23:00)
 * - Hari (Senin - Minggu)
 * - Tanggal (30 Hari Terakhir)
 * - Bulan (12 Bulan Terakhir)
 * - Tahun (Multi-Tahun)
 * 
 * Lengkap dengan indikator Peningkatan (↗️), Penurunan (↘️), atau Stagnan (➡️).
 */
function VisitorTrafficWidget({ mode = "compact", defaultGranularity = "hourly" }) {
    const [granularity, setGranularity] = useState(defaultGranularity);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showBreakdown, setShowBreakdown] = useState(mode === "full");

    const fetchAnalytics = useCallback(async () => {
        try {
            setLoading(true);
            const res = await apiInstance.get("admin/visitor-traffic-analytics/");
            if (res.data) {
                setData(res.data);
            }
        } catch (err) {
            console.debug("Visitor traffic fetch:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

    // Data array sesuai granularitas yang aktif
    const activeSeries = useMemo(() => {
        if (!data) return [];
        switch (granularity) {
            case "hourly":
                return data.hourly || [];
            case "daily":
                return data.daily || [];
            case "date":
                return data.date || [];
            case "monthly":
                return data.monthly || [];
            case "yearly":
                return data.yearly || [];
            default:
                return data.hourly || [];
        }
    }, [data, granularity]);

    // Format nama granularitas dalam bahasa Indonesia
    const granularityLabels = {
        hourly: { title: "Jam (24 Jam)", subtitle: "Distribusi Kunjungan Tiap Jam Hari Ini", icon: "fas fa-clock" },
        daily: { title: "Hari (Mingguan)", subtitle: "Pola Kunjungan Hari Kerja vs Akhir Pekan", icon: "fas fa-calendar-week" },
        date: { title: "Tanggal (30 Hari)", subtitle: "Fluktuasi Kunjungan Harian 30 Hari Terakhir", icon: "fas fa-calendar-day" },
        monthly: { title: "Bulan (12 Bulan)", subtitle: "Tren Pertumbuhan Bulanan Sepanjang Tahun", icon: "fas fa-chart-line" },
        yearly: { title: "Tahun (Multi-Tahun)", subtitle: "Perbandingan Volume Kunjungan Tahunan", icon: "fas fa-calendar-alt" },
    };

    // Hitung total kunjungan pada series aktif
    const totalVisitsActive = useMemo(() => {
        return activeSeries.reduce((acc, item) => acc + (item.visits || 0), 0);
    }, [activeSeries]);

    // Rata-rata kunjungan pada series aktif
    const avgVisitsActive = useMemo(() => {
        if (!activeSeries.length) return 0;
        return Math.round(totalVisitsActive / activeSeries.length);
    }, [activeSeries, totalVisitsActive]);

    // Status tren terbaru pada series aktif
    const currentTrendInfo = useMemo(() => {
        if (!activeSeries.length) {
            return { status: "Stagnan", pct: 0, diff: 0, badgeClass: "trend-steady", icon: "fas fa-arrow-right" };
        }
        const last = activeSeries[activeSeries.length - 1];
        const status = last.status || "Stagnan";
        const pct = last.change_pct || 0;
        const diff = last.diff || 0;

        let badgeClass = "trend-steady";
        let icon = "fas fa-arrow-right";

        if (status === "Peningkatan") {
            badgeClass = "trend-up";
            icon = "fas fa-arrow-trend-up";
        } else if (status === "Penurunan") {
            badgeClass = "trend-down";
            icon = "fas fa-arrow-trend-down";
        }

        return { status, pct, diff, badgeClass, icon };
    }, [activeSeries]);

    // Chart.js Data Configuration
    const chartData = useMemo(() => {
        if (!activeSeries.length) return null;

        const labels = activeSeries.map(item => item.label);
        const values = activeSeries.map(item => item.visits);

        return {
            labels,
            datasets: [
                {
                    label: "Jumlah Pengunjung",
                    data: values,
                    borderColor: "#0f766e",
                    borderWidth: 2.5,
                    backgroundColor: (context) => {
                        const ctx = context.chart.ctx;
                        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                        gradient.addColorStop(0, "rgba(15, 118, 110, 0.28)");
                        gradient.addColorStop(1, "rgba(15, 118, 110, 0.0)");
                        return gradient;
                    },
                    fill: true,
                    tension: 0.35,
                    pointRadius: activeSeries.length > 20 ? 2 : 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: "#0f766e",
                    pointBorderColor: "#ffffff",
                    pointBorderWidth: 2,
                }
            ]
        };
    }, [activeSeries]);

    // Chart.js Options
    const chartOptions = useMemo(() => {
        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false,
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: "#002B49",
                    titleFont: { size: 12, weight: "bold" },
                    bodyFont: { size: 12 },
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        title: (tooltipItems) => {
                            const idx = tooltipItems[0].dataIndex;
                            const item = activeSeries[idx];
                            if (granularity === "hourly") return `Pukul ${item?.label || ""}:00 WIB`;
                            if (granularity === "daily") return `Hari ${item?.label || ""}`;
                            if (granularity === "date") return `Tanggal ${item?.date || item?.label || ""}`;
                            if (granularity === "monthly") return item?.full_label || `Bulan ${item?.label || ""}`;
                            if (granularity === "yearly") return `Tahun ${item?.label || ""}`;
                            return tooltipItems[0].label;
                        },
                        label: (context) => {
                            const idx = context.dataIndex;
                            const item = activeSeries[idx];
                            const visits = context.parsed.y || 0;
                            return ` Pengunjung: ${visits.toLocaleString("id-ID")}`;
                        },
                        afterLabel: (context) => {
                            const idx = context.dataIndex;
                            const item = activeSeries[idx];
                            if (!item) return "";
                            const st = item.status || "Stagnan";
                            const pct = item.change_pct || 0;
                            const sign = pct > 0 ? "+" : "";
                            const emoji = st === "Peningkatan" ? "📈" : st === "Penurunan" ? "📉" : "➡️";
                            return ` ${emoji} Status Tren: ${st} (${sign}${pct}%)`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 11 },
                        color: "#64748b",
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: granularity === "date" ? 10 : (granularity === "hourly" ? 12 : 7)
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: "#f1f5f9" },
                    ticks: {
                        font: { size: 11 },
                        color: "#64748b",
                        precision: 0
                    }
                }
            }
        };
    }, [activeSeries, granularity]);

    return (
        <div className={`visitor-traffic-widget ${mode === "full" ? "mode-full" : "mode-compact"}`}>
            {/* Header: Title & Time Controls */}
            <div className="visitor-traffic-header d-flex flex-wrap align-items-center justify-content-between gap-2">
                <div className="visitor-traffic-title">
                    <i className="fas fa-chart-line me-2"></i>
                    <div>
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                            <span className="fw-bold">Tren Pengguna Mengunjungi LMSetjen DPD RI</span>
                            <span className="badge bg-success-subtle text-success border border-success-subtle d-inline-flex align-items-center gap-1 py-1 px-2" style={{ fontSize: "0.7rem", borderRadius: "20px" }}>
                                <span className="visitor-live-dot"></span>
                                Live Database
                            </span>
                        </div>
                        <small className="text-muted fw-normal" style={{ fontSize: "0.76rem" }}>
                            {granularityLabels[granularity]?.subtitle || "Pantau fluktuasi peningkatan, penurunan, atau stagnan"}
                            {data?.summary?.last_updated && ` • Diperbarui: ${data.summary.last_updated}`}
                        </small>
                    </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                    {/* Tombol Refresh Live Data */}
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 py-1 px-2"
                        style={{ fontSize: "0.75rem", borderRadius: "8px" }}
                        onClick={fetchAnalytics}
                        disabled={loading}
                        title="Perbarui data tren live dari database saat ini"
                    >
                        <i className={`fas fa-sync-alt ${loading ? "fa-spin" : ""}`}></i>
                        <span className="d-none d-sm-inline">Segarkan</span>
                    </button>

                    {/* Granularity Selector Pills */}
                    <div className="granularity-pill-group" role="group" aria-label="Granularitas Waktu Pengunjung">
                        <button
                            type="button"
                            className={`granularity-btn ${granularity === "hourly" ? "active" : ""}`}
                            onClick={() => setGranularity("hourly")}
                            title="Lihat tren kunjungan per jam (24 Jam WIB)"
                        >
                            <i className="fas fa-clock"></i>
                            <span>Jam</span>
                        </button>
                        <button
                            type="button"
                            className={`granularity-btn ${granularity === "daily" ? "active" : ""}`}
                            onClick={() => setGranularity("daily")}
                            title="Lihat tren kunjungan per hari dalam seminggu"
                        >
                            <i className="fas fa-calendar-week"></i>
                            <span>Hari</span>
                        </button>
                        <button
                            type="button"
                            className={`granularity-btn ${granularity === "date" ? "active" : ""}`}
                            onClick={() => setGranularity("date")}
                            title="Lihat tren kunjungan harian 30 hari terakhir"
                        >
                            <i className="fas fa-calendar-day"></i>
                            <span>Tanggal</span>
                        </button>
                        <button
                            type="button"
                            className={`granularity-btn ${granularity === "monthly" ? "active" : ""}`}
                            onClick={() => setGranularity("monthly")}
                            title="Lihat tren kunjungan bulanan 12 bulan terakhir"
                        >
                            <i className="fas fa-calendar-alt"></i>
                            <span>Bulan</span>
                        </button>
                        <button
                            type="button"
                            className={`granularity-btn ${granularity === "yearly" ? "active" : ""}`}
                            onClick={() => setGranularity("yearly")}
                            title="Lihat tren kunjungan tahunan"
                        >
                            <i className="fas fa-calendar"></i>
                            <span>Tahun</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="visitor-metrics-row">
                <div className="row g-2">
                    {/* Status Tren Terkini */}
                    <div className="col-6 col-md-3">
                        <div className="visitor-metric-card">
                            <div className={`visitor-metric-icon ${currentTrendInfo.badgeClass === "trend-up" ? "icon-teal" : currentTrendInfo.badgeClass === "trend-down" ? "icon-amber" : "icon-blue"}`}>
                                <i className={currentTrendInfo.icon}></i>
                            </div>
                            <div className="flex-grow-1 overflow-hidden">
                                <div className="visitor-metric-label">Status Tren</div>
                                <div className="d-flex align-items-center flex-wrap">
                                    <span className="visitor-metric-value" style={{ fontSize: "0.95rem" }}>
                                        {currentTrendInfo.status}
                                    </span>
                                    <span className={`visitor-metric-badge ${currentTrendInfo.badgeClass}`}>
                                        {currentTrendInfo.pct > 0 ? `+${currentTrendInfo.pct}%` : `${currentTrendInfo.pct}%`}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Jam Tersibuk (Peak Hour) */}
                    <div className="col-6 col-md-3">
                        <div className="visitor-metric-card">
                            <div className="visitor-metric-icon icon-teal">
                                <i className="fas fa-stopwatch"></i>
                            </div>
                            <div>
                                <div className="visitor-metric-label">Jam Tersibuk</div>
                                <div className="visitor-metric-value" style={{ fontSize: "0.95rem" }}>
                                    {data?.summary?.peak_hour || "10:00 WIB"}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Hari Teramai (Peak Day) */}
                    <div className="col-6 col-md-3">
                        <div className="visitor-metric-card">
                            <div className="visitor-metric-icon icon-blue">
                                <i className="fas fa-calendar-check"></i>
                            </div>
                            <div>
                                <div className="visitor-metric-label">Hari Teramai</div>
                                <div className="visitor-metric-value" style={{ fontSize: "0.95rem" }}>
                                    {data?.summary?.peak_day || "Rabu"}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Total Kunjungan Periode */}
                    <div className="col-6 col-md-3">
                        <div className="visitor-metric-card">
                            <div className="visitor-metric-icon icon-purple">
                                <i className="fas fa-users"></i>
                            </div>
                            <div>
                                <div className="visitor-metric-label">Total Pengunjung</div>
                                <div className="visitor-metric-value" style={{ fontSize: "0.95rem" }}>
                                    {totalVisitsActive.toLocaleString("id-ID")}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Chart Body */}
            <div className="visitor-chart-canvas-wrap">
                <div style={{ height: mode === "full" ? "320px" : "240px", position: "relative" }}>
                    {loading ? (
                        <div className="d-flex align-items-center justify-content-center h-100 text-muted small">
                            <div className="spinner-border spinner-border-sm text-teal me-2" role="status"></div>
                            Memuat data tren kunjungan...
                        </div>
                    ) : chartData ? (
                        <Line data={chartData} options={chartOptions} />
                    ) : (
                        <div className="d-flex align-items-center justify-content-center h-100 text-muted small">
                            Data tren pengunjung belum tersedia
                        </div>
                    )}
                </div>

                {/* Subtext info & toggle breakdown */}
                <div className="d-flex align-items-center justify-content-between mt-2 pt-2 border-top">
                    <small className="text-muted" style={{ fontSize: "0.74rem" }}>
                        <i className="fas fa-circle text-teal me-1" style={{ fontSize: "7px" }}></i>
                        Menampilkan tren fluktuasi per {granularityLabels[granularity]?.title}. Rata-rata: <strong>{avgVisitsActive.toLocaleString("id-ID")}</strong> pengunjung.
                    </small>

                    <button
                        type="button"
                        className="btn btn-link btn-sm p-0 text-decoration-none fw-semibold"
                        style={{ fontSize: "0.76rem", color: "#0f766e" }}
                        onClick={() => setShowBreakdown(!showBreakdown)}
                    >
                        {showBreakdown ? (
                            <span><i className="fas fa-chevron-up me-1"></i> Sembunyikan Rincian</span>
                        ) : (
                            <span><i className="fas fa-table me-1"></i> Lihat Rincian Fluktuasi Waktu</span>
                        )}
                    </button>
                </div>

                {/* Data Breakdown Table (Jam, Hari, Tanggal, Bulan, Tahun) */}
                {showBreakdown && activeSeries.length > 0 && (
                    <div className="mt-3 table-responsive" style={{ maxHeight: "220px", overflowY: "auto" }}>
                        <table className="table table-sm table-hover align-middle visitor-breakdown-table">
                            <thead>
                                <tr>
                                    <th>Waktu ({granularityLabels[granularity]?.title})</th>
                                    <th>Pengunjung</th>
                                    <th>Status Tren</th>
                                    <th>Fluktuasi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activeSeries.map((item, idx) => {
                                    const st = item.status || "Stagnan";
                                    const pct = item.change_pct || 0;
                                    const diff = item.diff || 0;
                                    const badgeClass = st === "Peningkatan" ? "trend-up" : st === "Penurunan" ? "trend-down" : "trend-steady";
                                    const icon = st === "Peningkatan" ? "fas fa-arrow-trend-up" : st === "Penurunan" ? "fas fa-arrow-trend-down" : "fas fa-arrow-right";
                                    const diffSign = diff > 0 ? `+${diff}` : `${diff}`;

                                    return (
                                        <tr key={idx}>
                                            <td className="fw-semibold">
                                                {granularity === "hourly" ? `Pukul ${item.label}:00 WIB` : item.full_label || item.label}
                                            </td>
                                            <td className="fw-bold text-dark">
                                                {(item.visits || 0).toLocaleString("id-ID")}
                                            </td>
                                            <td>
                                                <span className={`trend-tag-badge ${badgeClass}`}>
                                                    <i className={icon}></i>
                                                    {st}
                                                </span>
                                            </td>
                                            <td>
                                                <small className={st === "Peningkatan" ? "text-success fw-bold" : st === "Penurunan" ? "text-danger fw-bold" : "text-muted"}>
                                                    {diff !== 0 ? `${diffSign} (${pct > 0 ? `+${pct}%` : `${pct}%`})` : "0 (0.0%)"}
                                                </small>
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
    );
}

export default React.memo(VisitorTrafficWidget);

