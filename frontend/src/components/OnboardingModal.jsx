import React, { useState, useMemo } from "react";
import {
  FaBuilding,
  FaGlobe,
  FaUserCheck,
  FaSpinner,
  FaIdCard,
  FaBriefcase,
  FaMapMarkerAlt,
  FaCheckCircle,
  FaExclamationTriangle,
  FaChevronDown,
  FaInfoCircle,
} from "react-icons/fa";
import apiInstance from "../utils/axios";
import { setAuthUser } from "../utils/auth";
import Toast from "../views/plugin/Toast";
import {
  validateNIP,
  ASN_POSITIONS,
  ASN_INSTITUTIONS_GROUPS,
  PROFESSIONS_LIST,
  COUNTRIES_LIST,
  INDONESIA_PROVINCES_AND_CITIES,
} from "../data/onboardingData";
import "./OnboardingModal.css";

function OnboardingModal({ isOpen, user, token, onSuccess }) {
  const [selectedType, setSelectedType] = useState("ASN"); // "ASN" or "UMUM"
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Form states for ASN
  const [asnForm, setAsnForm] = useState({
    nip: "",
    jabatan: "",
    jabatanCustom: "",
    instansi_asal: "",
    instansiCustom: "",
  });

  // Form states for UMUM
  const [umumForm, setUmumForm] = useState({
    pekerjaan: "",
    pekerjaanCustom: "",
    negara: "Indonesia",
    negaraCustom: "",
    provinsi: "",
    kota_kabupaten: "",
  });

  // NIP validation result memoized
  const nipValidation = useMemo(() => {
    return validateNIP(asnForm.nip);
  }, [asnForm.nip]);

  // Cities for selected province
  const availableCities = useMemo(() => {
    if (!umumForm.provinsi || !INDONESIA_PROVINCES_AND_CITIES[umumForm.provinsi]) {
      return [];
    }
    return INDONESIA_PROVINCES_AND_CITIES[umumForm.provinsi];
  }, [umumForm.provinsi]);

  if (!isOpen) return null;

  // Handle NIP input change (only allow digits, max 18 digits)
  const handleNipChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, "").slice(0, 18);
    setAsnForm((prev) => ({ ...prev, nip: rawVal }));
    setErrorMsg("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    let payload = {
      user_type: selectedType,
    };

    if (selectedType === "ASN") {
      // 1. Validasi NIP
      if (!nipValidation.isValid) {
        setErrorMsg(nipValidation.message || "Mohon masukkan NIP 18 digit yang valid.");
        return;
      }

      // 2. Validasi Jabatan
      const finalJabatan =
        asnForm.jabatan === "Lainnya (Tulis Spesifik)"
          ? asnForm.jabatanCustom.trim()
          : asnForm.jabatan;

      if (!finalJabatan) {
        setErrorMsg("Mohon pilih atau tuliskan Jabatan Anda saat ini.");
        return;
      }

      // 3. Validasi Instansi
      const isCustomInstansi =
        asnForm.instansi_asal === "Pemerintah Kabupaten / Kota (Sebutkan Nama Daerah)" ||
        asnForm.instansi_asal === "Instansi / Satuan Kerja Lainnya";

      const finalInstansi = isCustomInstansi
        ? asnForm.instansiCustom.trim()
        : asnForm.instansi_asal;

      if (!finalInstansi) {
        setErrorMsg("Mohon pilih atau tuliskan Asal Instansi pemerintah Anda.");
        return;
      }

      payload = {
        ...payload,
        nip: nipValidation.cleanNip,
        jabatan: finalJabatan,
        instansi_asal: finalInstansi,
      };
    } else {
      // Validasi UMUM
      // 1. Pekerjaan
      const finalPekerjaan =
        umumForm.pekerjaan === "Lainnya (Tulis Spesifik)"
          ? umumForm.pekerjaanCustom.trim()
          : umumForm.pekerjaan;

      if (!finalPekerjaan) {
        setErrorMsg("Mohon pilih atau tuliskan Pekerjaan / Profesi Anda.");
        return;
      }

      // 2. Negara
      const finalNegara =
        umumForm.negara === "Negara Lainnya"
          ? umumForm.negaraCustom.trim() || "Lainnya"
          : umumForm.negara || "Indonesia";

      // 3. Wilayah (Provinsi & Kota)
      if (finalNegara === "Indonesia") {
        if (!umumForm.provinsi) {
          setErrorMsg("Mohon pilih Provinsi Asal Anda di Indonesia.");
          return;
        }
        if (!umumForm.kota_kabupaten) {
          setErrorMsg("Mohon pilih Kota / Kabupaten Asal Anda.");
          return;
        }
      }

      payload = {
        ...payload,
        pekerjaan: finalPekerjaan,
        negara: finalNegara,
        provinsi: umumForm.provinsi.trim(),
        kota_kabupaten: umumForm.kota_kabupaten.trim(),
      };
    }

    setIsSubmitting(true);

    try {
      // Submit to backend using the Bearer token
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await apiInstance.post("/auth/complete-onboarding/", payload, { headers });

      if (res.data && res.data.access) {
        // Update local session
        setAuthUser(res.data.access, res.data.refresh);

        Toast().fire({
          icon: "success",
          title: "Profil Terverifikasi!",
          text: `Selamat datang di LMS Setjen DPD RI, ${res.data.user?.full_name || user?.full_name}!`,
        });

        if (onSuccess) {
          onSuccess(res.data);
        }
      } else {
        throw new Error(res.data?.error || "Gagal memperbarui profil.");
      }
    } catch (err) {
      console.error("Onboarding error:", err);
      const msg = err.response?.data?.error || err.message || "Terjadi kesalahan saat melengkapi profil.";
      setErrorMsg(msg);
      Toast().fire({
        icon: "error",
        title: "Gagal Menyimpan",
        text: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal-card">
        {/* Header */}
        <div className="onboarding-header">
          <div className="onboarding-badge-top">
            <span className="dpd-pill">LMS SETJEN DPD RI</span>
            <span className="onboard-step">Langkah Awal Kepesertaan</span>
          </div>
          <h2 className="onboarding-title">Lengkapi Kategori Profil Anda</h2>
          <p className="onboarding-subtitle">
            Selamat datang <strong>{user?.full_name || user?.email}</strong>! Untuk memastikan Anda mendapatkan hak akses kursus dan materi pelatihan yang sesuai, silakan pilih kategori dan data kepesertaan Anda.
          </p>
        </div>

        {/* Choice Selector Cards */}
        <div className="onboarding-type-selector">
          <button
            type="button"
            className={`type-choice-card ${selectedType === "ASN" ? "selected" : ""}`}
            onClick={() => {
              setSelectedType("ASN");
              setErrorMsg("");
            }}
          >
            <div className="choice-indicator">
              <span className="indicator-dot"></span>
            </div>
            <div className="choice-icon-wrap asn">
              <FaBuilding />
            </div>
            <div className="choice-content">
              <div className="choice-title-row">
                <span className="choice-title">Saya adalah ASN</span>
                <span className="choice-badge asn">Aparatur Sipil Negara</span>
              </div>
              <p className="choice-desc">
                PNS atau PPPK instansi pusat / daerah yang memiliki NIP aktif 18 digit resmi BKN.
              </p>
            </div>
            {selectedType === "ASN" && <FaCheckCircle className="choice-check-icon" />}
          </button>

          <button
            type="button"
            className={`type-choice-card ${selectedType === "UMUM" ? "selected" : ""}`}
            onClick={() => {
              setSelectedType("UMUM");
              setErrorMsg("");
            }}
          >
            <div className="choice-indicator">
              <span className="indicator-dot"></span>
            </div>
            <div className="choice-icon-wrap umum">
              <FaGlobe />
            </div>
            <div className="choice-content">
              <div className="choice-title-row">
                <span className="choice-title">Masyarakat Umum</span>
                <span className="choice-badge umum">Publik & Terbuka</span>
              </div>
              <p className="choice-desc">
                Akademisi, mahasiswa, peneliti, profesional swasta, wirausaha, atau masyarakat umum.
              </p>
            </div>
            {selectedType === "UMUM" && <FaCheckCircle className="choice-check-icon" />}
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="onboarding-alert-error" role="alert">
            <FaExclamationTriangle className="me-2 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Dynamic Form */}
        <form onSubmit={handleSubmit} className="onboarding-form">
          {selectedType === "ASN" ? (
            <div className="form-fields-group">
              {/* NIP Field with Live Verification */}
              <div className="field-group">
                <div className="field-label-row">
                  <label className="field-label" htmlFor="onboard-nip">
                    <FaIdCard className="field-icon" /> Nomor Induk Pegawai (NIP) <span className="req">*</span>
                  </label>
                  <span className={`nip-counter-badge ${nipValidation.isValid ? "valid" : asnForm.nip.length === 18 ? "invalid" : ""}`}>
                    {asnForm.nip.length} / 18 Digit
                  </span>
                </div>

                <div className="input-with-validation">
                  <input
                    id="onboard-nip"
                    type="text"
                    inputMode="numeric"
                    className={`onboard-input ${nipValidation.isValid ? "input-valid" : asnForm.nip.length > 0 && !nipValidation.isValid ? "input-invalid" : ""}`}
                    placeholder="Contoh: 198501012010011001"
                    value={asnForm.nip}
                    onChange={handleNipChange}
                    maxLength={18}
                    required
                  />
                  {nipValidation.isValid && (
                    <FaCheckCircle className="input-status-icon success" title="NIP Terverifikasi" />
                  )}
                </div>

                {/* Live NIP Feedback Banner */}
                {asnForm.nip.length > 0 && (
                  <div className={`nip-verification-card ${nipValidation.isValid ? "verified" : "unverified"}`}>
                    {nipValidation.isValid ? (
                      <div className="nip-card-content">
                        <div className="nip-card-header">
                          <FaCheckCircle className="nip-badge-icon" />
                          <span className="nip-badge-title">NIP Terverifikasi Standar BKN:</span>
                          <strong className="nip-formatted-text">{nipValidation.formattedNip}</strong>
                        </div>
                        <div className="nip-meta-grid">
                          <div className="nip-meta-item">
                            <span className="meta-label">Tanggal Lahir:</span>
                            <span className="meta-value">{nipValidation.birthDateStr}</span>
                          </div>
                          <div className="nip-meta-item">
                            <span className="meta-label">Pengangkatan CPNS:</span>
                            <span className="meta-value">{nipValidation.cpnsDateStr}</span>
                          </div>
                          <div className="nip-meta-item">
                            <span className="meta-label">Jenis Kelamin:</span>
                            <span className="meta-value">{nipValidation.genderStr}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="nip-card-content invalid-preview">
                        <div className="nip-card-header">
                          <FaInfoCircle className="nip-badge-icon-warn" />
                          <span className="nip-warn-message">{nipValidation.message}</span>
                        </div>
                        <div className="nip-hint-structure">
                          Format resmi 18 digit: <code>YYYYMMDD</code> (Tgl Lahir) + <code>YYYYMM</code> (CPNS) + <code>1/2</code> (JK) + <code>NNN</code> (No Urut)
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Jabatan Saat Ini */}
              <div className="field-group">
                <label className="field-label" htmlFor="onboard-jabatan">
                  <FaBriefcase className="field-icon" /> Jabatan Saat Ini <span className="req">*</span>
                </label>
                <div className="select-wrapper">
                  <select
                    id="onboard-jabatan"
                    className="onboard-select"
                    value={asnForm.jabatan}
                    onChange={(e) => setAsnForm({ ...asnForm, jabatan: e.target.value })}
                    required
                  >
                    <option value="" disabled>-- Pilih Jabatan / Jenjang ASN Anda --</option>
                    {ASN_POSITIONS.map((pos) => (
                      <option key={pos} value={pos}>
                        {pos}
                      </option>
                    ))}
                  </select>
                  <FaChevronDown className="select-arrow" />
                </div>

                {asnForm.jabatan === "Lainnya (Tulis Spesifik)" && (
                  <div className="nested-input-wrap">
                    <input
                      type="text"
                      className="onboard-input nested"
                      placeholder="Tuliskan nama jabatan spesifik Anda..."
                      value={asnForm.jabatanCustom}
                      onChange={(e) => setAsnForm({ ...asnForm, jabatanCustom: e.target.value })}
                      required
                      autoFocus
                    />
                  </div>
                )}
              </div>

              {/* Asal Instansi */}
              <div className="field-group">
                <label className="field-label" htmlFor="onboard-instansi">
                  <FaBuilding className="field-icon" /> Asal Instansi Pemerintah <span className="req">*</span>
                </label>
                <div className="select-wrapper">
                  <select
                    id="onboard-instansi"
                    className="onboard-select"
                    value={asnForm.instansi_asal}
                    onChange={(e) => setAsnForm({ ...asnForm, instansi_asal: e.target.value })}
                    required
                  >
                    <option value="" disabled>-- Pilih Instansi / Kementerian / Lembaga / Pemda --</option>
                    {ASN_INSTITUTIONS_GROUPS.map((group) => (
                      <optgroup key={group.category} label={`── ${group.category} ──`}>
                        {group.items.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <FaChevronDown className="select-arrow" />
                </div>

                {(asnForm.instansi_asal === "Pemerintah Kabupaten / Kota (Sebutkan Nama Daerah)" ||
                  asnForm.instansi_asal === "Instansi / Satuan Kerja Lainnya") && (
                  <div className="nested-input-wrap">
                    <input
                      type="text"
                      className="onboard-input nested"
                      placeholder="Tuliskan nama lengkap Kabupaten / Kota / Satuan Kerja instansi Anda..."
                      value={asnForm.instansiCustom}
                      onChange={(e) => setAsnForm({ ...asnForm, instansiCustom: e.target.value })}
                      required
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="form-fields-group">
              {/* Pekerjaan / Profesi */}
              <div className="field-group">
                <label className="field-label" htmlFor="onboard-pekerjaan">
                  <FaBriefcase className="field-icon" /> Pekerjaan / Profesi Saat Ini <span className="req">*</span>
                </label>
                <div className="select-wrapper">
                  <select
                    id="onboard-pekerjaan"
                    className="onboard-select"
                    value={umumForm.pekerjaan}
                    onChange={(e) => setUmumForm({ ...umumForm, pekerjaan: e.target.value })}
                    required
                  >
                    <option value="" disabled>-- Pilih Bidang Pekerjaan / Profesi --</option>
                    {PROFESSIONS_LIST.map((prof) => (
                      <option key={prof} value={prof}>
                        {prof}
                      </option>
                    ))}
                  </select>
                  <FaChevronDown className="select-arrow" />
                </div>

                {umumForm.pekerjaan === "Lainnya (Tulis Spesifik)" && (
                  <div className="nested-input-wrap">
                    <input
                      type="text"
                      className="onboard-input nested"
                      placeholder="Tuliskan profesi / pekerjaan spesifik Anda..."
                      value={umumForm.pekerjaanCustom}
                      onChange={(e) => setUmumForm({ ...umumForm, pekerjaanCustom: e.target.value })}
                      required
                      autoFocus
                    />
                  </div>
                )}
              </div>

              {/* Negara */}
              <div className="field-group">
                <label className="field-label" htmlFor="onboard-negara">
                  <FaGlobe className="field-icon" /> Negara Domisili <span className="req">*</span>
                </label>
                <div className="select-wrapper">
                  <select
                    id="onboard-negara"
                    className="onboard-select"
                    value={umumForm.negara}
                    onChange={(e) => {
                      const newCountry = e.target.value;
                      setUmumForm((prev) => ({
                        ...prev,
                        negara: newCountry,
                        provinsi: newCountry === "Indonesia" ? "" : "Luar Negeri",
                        kota_kabupaten: newCountry === "Indonesia" ? "" : "Luar Negeri",
                      }));
                    }}
                    required
                  >
                    {COUNTRIES_LIST.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                  <FaChevronDown className="select-arrow" />
                </div>

                {umumForm.negara === "Negara Lainnya" && (
                  <div className="nested-input-wrap">
                    <input
                      type="text"
                      className="onboard-input nested"
                      placeholder="Tuliskan nama negara Anda..."
                      value={umumForm.negaraCustom}
                      onChange={(e) => setUmumForm({ ...umumForm, negaraCustom: e.target.value })}
                      required
                      autoFocus
                    />
                  </div>
                )}
              </div>

              {/* Provinsi & Kota Cascading Selectors */}
              <div className="field-row">
                {/* Provinsi Asal */}
                <div className="field-group">
                  <label className="field-label" htmlFor="onboard-provinsi">
                    <FaMapMarkerAlt className="field-icon" /> Provinsi Asal <span className="req">*</span>
                  </label>
                  {umumForm.negara === "Indonesia" ? (
                    <div className="select-wrapper">
                      <select
                        id="onboard-provinsi"
                        className="onboard-select"
                        value={umumForm.provinsi}
                        onChange={(e) =>
                          setUmumForm((prev) => ({
                            ...prev,
                            provinsi: e.target.value,
                            kota_kabupaten: "", // Reset city when province changes
                          }))
                        }
                        required
                      >
                        <option value="" disabled>-- Pilih 38 Provinsi di Indonesia --</option>
                        {Object.keys(INDONESIA_PROVINCES_AND_CITIES).map((prov) => (
                          <option key={prov} value={prov}>
                            {prov}
                          </option>
                        ))}
                      </select>
                      <FaChevronDown className="select-arrow" />
                    </div>
                  ) : (
                    <input
                      type="text"
                      className="onboard-input"
                      placeholder="Provinsi / State / Wilayah"
                      value={umumForm.provinsi}
                      onChange={(e) => setUmumForm({ ...umumForm, provinsi: e.target.value })}
                    />
                  )}
                </div>

                {/* Kota / Kabupaten */}
                <div className="field-group">
                  <label className="field-label" htmlFor="onboard-kota">
                    <FaMapMarkerAlt className="field-icon" /> Kota / Kabupaten <span className="req">*</span>
                  </label>
                  {umumForm.negara === "Indonesia" ? (
                    <div className="select-wrapper">
                      <select
                        id="onboard-kota"
                        className="onboard-select"
                        value={umumForm.kota_kabupaten}
                        onChange={(e) =>
                          setUmumForm((prev) => ({
                            ...prev,
                            kota_kabupaten: e.target.value,
                          }))
                        }
                        disabled={!umumForm.provinsi}
                        required
                      >
                        <option value="" disabled>
                          {umumForm.provinsi
                            ? `-- Pilih Kota / Kabupaten di ${umumForm.provinsi} --`
                            : "-- Pilih Provinsi Terlebih Dahulu --"}
                        </option>
                        {availableCities.map((city) => (
                          <option key={city} value={city}>
                            {city}
                          </option>
                        ))}
                      </select>
                      <FaChevronDown className="select-arrow" />
                    </div>
                  ) : (
                    <input
                      type="text"
                      className="onboard-input"
                      placeholder="Kota / Distrik Luar Negeri"
                      value={umumForm.kota_kabupaten}
                      onChange={(e) => setUmumForm({ ...umumForm, kota_kabupaten: e.target.value })}
                      required
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Submit Action */}
          <div className="onboarding-actions">
            <button
              type="submit"
              className="btn-onboard-submit"
              disabled={isSubmitting || (selectedType === "ASN" && !nipValidation.isValid)}
            >
              {isSubmitting ? (
                <>
                  <FaSpinner className="spinner-icon me-2" />
                  Memverifikasi & Menyimpan Profil...
                </>
              ) : (
                <>
                  <FaUserCheck className="me-2" />
                  Simpan & Masuk ke LMS Setjen DPD RI
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default OnboardingModal;
