import { useState, useEffect, useCallback } from "react";
import apiInstance from "../utils/axios";
import { APP_VERSION, APP_NAME } from "../utils/version";

// Module-level cache to prevent unnecessary roundtrips
let cachedVersionData = null;
let cachedReleasesData = null;

export const dispatchVersionUpdate = (newVersionInfo) => {
    cachedVersionData = newVersionInfo;
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("lms-version-updated", { detail: newVersionInfo }));
    }
};

export const openUpdateLogModal = () => {
    if (typeof window !== "undefined") {
        window.dispatchEvent(
            new CustomEvent("lms-open-feedback-modal", {
                detail: { initialTab: "updates" }
            })
        );
    }
};

export default function useSystemVersion(options = { fetchReleases: false }) {
    const [version, setVersion] = useState(() => cachedVersionData?.version || APP_VERSION);
    const [versionInfo, setVersionInfo] = useState(() => cachedVersionData || {
        version: APP_VERSION,
        version_label: `${APP_NAME} v${APP_VERSION}`,
        app_name: APP_NAME,
        release_title: "Rilis Stabil LMSetjen DPD RI",
        release_date: new Date().toISOString(),
        release_type: "patch",
        summary: ""
    });
    const [releases, setReleases] = useState(() => cachedReleasesData?.results || []);
    const [stats, setStats] = useState(() => cachedReleasesData?.stats || null);
    const [currentRelease, setCurrentRelease] = useState(() => cachedReleasesData?.current_release || null);
    const [suggestedNext, setSuggestedNext] = useState(() => cachedReleasesData?.suggested_next || null);
    const [serverTelemetry, setServerTelemetry] = useState(() => cachedReleasesData?.server_telemetry || null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchVersion = useCallback(async () => {
        try {
            const res = await apiInstance.get("/system/version/");
            if (res.data?.success) {
                setVersion(res.data.version);
                setVersionInfo(res.data);
                cachedVersionData = res.data;
            }
        } catch (err) {
            // Keep fallback
            console.debug("useSystemVersion fetch notice:", err?.message || err);
        }
    }, []);

    const fetchReleases = useCallback(async (searchQuery = "", typeFilter = "") => {
        setLoading(true);
        setError(null);
        try {
            let url = "/system/releases/";
            const params = [];
            if (searchQuery) params.push(`search=${encodeURIComponent(searchQuery)}`);
            if (typeFilter) params.push(`type=${encodeURIComponent(typeFilter)}`);
            if (params.length > 0) url += `?${params.join("&")}`;

            const res = await apiInstance.get(url);
            if (res.data?.success) {
                setVersion(res.data.current_version);
                setCurrentRelease(res.data.current_release);
                setReleases(res.data.results || []);
                setStats(res.data.stats || null);
                setSuggestedNext(res.data.suggested_next || null);
                setServerTelemetry(res.data.server_telemetry || null);
                cachedReleasesData = res.data;
            }
        } catch (err) {
            console.warn("Error fetching system releases:", err);
            setError(err?.response?.data?.error || "Gagal memuat catatan rilis.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchVersion();
        if (options.fetchReleases) {
            fetchReleases();
        }

        const handleVersionUpdated = (e) => {
            if (e.detail?.version) {
                setVersion(e.detail.version);
            }
            fetchVersion();
            if (options.fetchReleases) {
                fetchReleases();
            }
        };

        window.addEventListener("lms-version-updated", handleVersionUpdated);
        return () => window.removeEventListener("lms-version-updated", handleVersionUpdated);
    }, [fetchVersion, fetchReleases, options.fetchReleases]);

    return {
        version,
        versionLabel: `${APP_NAME} v${version}`,
        versionInfo,
        releases,
        stats,
        currentRelease,
        suggestedNext,
        serverTelemetry,
        loading,
        error,
        fetchVersion,
        fetchReleases,
        refreshVersion: fetchVersion
    };
}

