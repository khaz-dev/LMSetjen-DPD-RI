/**
 * Reference data and validator for LMS Setjen DPD RI User Onboarding
 * Standardized according to BKN and Kemendagri regulations.
 */

// 1. Validasi NIP Standar BKN Republik Indonesia
export function validateNIP(nip) {
  const cleanNip = String(nip || "").replace(/\s+/g, "").trim();

  if (!cleanNip) {
    return {
      isValid: false,
      isTouched: false,
      message: "NIP wajib diisi 18 digit angka.",
    };
  }

  if (!/^\d+$/.test(cleanNip)) {
    return {
      isValid: false,
      isTouched: true,
      cleanNip,
      message: "NIP hanya boleh terdiri dari angka.",
    };
  }

  if (cleanNip.length !== 18) {
    return {
      isValid: false,
      isTouched: true,
      cleanNip,
      length: cleanNip.length,
      message: `Panjang NIP ${cleanNip.length}/18 digit.`,
    };
  }

  // 1. Ekstrak Tanggal Lahir (YYYYMMDD)
  const birthYear = parseInt(cleanNip.substring(0, 4), 10);
  const birthMonth = parseInt(cleanNip.substring(4, 6), 10);
  const birthDay = parseInt(cleanNip.substring(6, 8), 10);

  const currentYear = new Date().getFullYear();

  if (birthYear < 1940 || birthYear > currentYear - 17) {
    return {
      isValid: false,
      isTouched: true,
      cleanNip,
      message: `Tahun lahir pada NIP (${birthYear}) tidak valid.`,
    };
  }

  if (birthMonth < 1 || birthMonth > 12) {
    return {
      isValid: false,
      isTouched: true,
      cleanNip,
      message: `Bulan lahir pada NIP (${birthMonth}) tidak valid (harus 01-12).`,
    };
  }

  const daysInMonth = new Date(birthYear, birthMonth, 0).getDate();
  if (birthDay < 1 || birthDay > daysInMonth) {
    return {
      isValid: false,
      isTouched: true,
      cleanNip,
      message: `Tanggal lahir pada NIP (${birthDay}) tidak valid untuk bulan ${birthMonth}.`,
    };
  }

  // 2. Ekstrak Pengangkatan CPNS (YYYYMM)
  const cpnsYear = parseInt(cleanNip.substring(8, 12), 10);
  const cpnsMonth = parseInt(cleanNip.substring(12, 14), 10);

  if (cpnsYear < birthYear + 17 || cpnsYear > currentYear) {
    return {
      isValid: false,
      isTouched: true,
      cleanNip,
      message: `Tahun pengangkatan CPNS (${cpnsYear}) tidak valid (minimal 17 tahun setelah lahir).`,
    };
  }

  if (cpnsMonth < 1 || cpnsMonth > 12) {
    return {
      isValid: false,
      isTouched: true,
      cleanNip,
      message: `Bulan pengangkatan CPNS (${cpnsMonth}) tidak valid (harus 01-12).`,
    };
  }

  // 3. Ekstrak Jenis Kelamin (1 = Pria, 2 = Wanita)
  const genderDigit = cleanNip.substring(14, 15);
  if (genderDigit !== "1" && genderDigit !== "2") {
    return {
      isValid: false,
      isTouched: true,
      cleanNip,
      message: "Digit ke-15 (jenis kelamin) harus angka 1 (Pria) atau 2 (Wanita).",
    };
  }

  // 4. Nomor Urut (3 digit)
  const seqNumber = cleanNip.substring(15, 18);
  if (seqNumber === "000") {
    return {
      isValid: false,
      isTouched: true,
      cleanNip,
      message: "Tiga digit terakhir (nomor urut) tidak boleh 000.",
    };
  }

  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  return {
    isValid: true,
    isTouched: true,
    cleanNip,
    formattedNip: `${cleanNip.slice(0, 8)} ${cleanNip.slice(8, 14)} ${cleanNip.slice(14, 15)} ${cleanNip.slice(15, 18)}`,
    birthDateStr: `${birthDay} ${monthNames[birthMonth - 1]} ${birthYear}`,
    cpnsDateStr: `${monthNames[cpnsMonth - 1]} ${cpnsYear}`,
    genderStr: genderDigit === "1" ? "Laki-laki" : "Perempuan",
    message: "NIP valid terverifikasi standar BKN RI.",
  };
}

// 2. Daftar Jabatan ASN Terstandar (UU ASN No. 20/2023 & Perka BKN)
export const ASN_POSITIONS = [
  "Jabatan Pimpinan Tinggi (JPT) Utama",
  "Jabatan Pimpinan Tinggi (JPT) Madya (Dirjen / Sekjen / Deputi / Staf Ahli)",
  "Jabatan Pimpinan Tinggi (JPT) Pratama (Direktur / Kepala Biro / Kakanwil / Kadis)",
  "Jabatan Administrator (Kepala Bagian / Kepala Bidang / Camat)",
  "Jabatan Pengawas (Kepala Subbagian / Kepala Seksi / Lurah)",
  "Jabatan Pelaksana (Staf / Analis / Pengolah / Pengadministrasi)",
  "Jabatan Fungsional Keahlian - Ahli Utama",
  "Jabatan Fungsional Keahlian - Ahli Madya",
  "Jabatan Fungsional Keahlian - Ahli Muda",
  "Jabatan Fungsional Keahlian - Ahli Pertama",
  "Jabatan Fungsional Keterampilan - Penyelia",
  "Jabatan Fungsional Keterampilan - Mahir",
  "Jabatan Fungsional Keterampilan - Terampil",
  "Jabatan Fungsional Keterampilan - Pemula",
  "Pegawai Pemerintah dengan Perjanjian Kerja (PPPK) - Ahli",
  "Pegawai Pemerintah dengan Perjanjian Kerja (PPPK) - Terampil",
  "Lainnya (Tulis Spesifik)",
];

// 3. Daftar Instansi Pemerintah Terstandar
export const ASN_INSTITUTIONS_GROUPS = [
  {
    category: "Lembaga Tinggi Negara & Parlemen",
    items: [
      "Sekretariat Jenderal DPD RI",
      "Sekretariat Jenderal DPR RI",
      "Sekretariat Jenderal MPR RI",
      "Mahkamah Agung RI",
      "Mahkamah Konstitusi RI",
      "Komisi Yudisial RI",
      "Badan Pemeriksa Keuangan (BPK) RI",
      "Kementerian Sekretariat Negara RI / Sekretariat Kabinet",
    ],
  },
  {
    category: "Kementerian Negara",
    items: [
      "Kementerian Koordinator Bidang Politik dan Keamanan",
      "Kementerian Koordinator Bidang Perekonomian",
      "Kementerian Koordinator Bidang Pembangunan Manusia dan Kebudayaan",
      "Kementerian Koordinator Bidang Infrastruktur dan Pembangunan Kewilayahan",
      "Kementerian Koordinator Bidang Pangan",
      "Kementerian Koordinator Bidang Pemberdayaan Masyarakat",
      "Kementerian Dalam Negeri",
      "Kementerian Luar Negeri",
      "Kementerian Pertahanan",
      "Kementerian Agama",
      "Kementerian Hukum",
      "Kementerian Hak Asasi Manusia",
      "Kementerian Imigrasi dan Pemasyarakatan",
      "Kementerian Keuangan",
      "Kementerian Pendidikan Dasar dan Menengah",
      "Kementerian Pendidikan Tinggi, Sains, dan Teknologi",
      "Kementerian Kebudayaan",
      "Kementerian Kesehatan",
      "Kementerian Sosial",
      "Kementerian Ketenagakerjaan",
      "Kementerian Pelindungan Pekerja Migran Indonesia",
      "Kementerian Perindustrian",
      "Kementerian Perdagangan",
      "Kementerian Energi dan Sumber Daya Mineral",
      "Kementerian Pekerjaan Umum",
      "Kementerian Perumahan dan Kawasan Permukiman",
      "Kementerian Desa dan Pembangunan Daerah Tertinggal",
      "Kementerian Transmigrasi",
      "Kementerian Perhubungan",
      "Kementerian Komunikasi dan Digital",
      "Kementerian Pertanian",
      "Kementerian Kehutanan",
      "Kementerian Kelautan dan Perikanan",
      "Kementerian Agraria dan Tata Ruang / BPN",
      "Kementerian Perencanaan Pembangunan Nasional / Bappenas",
      "Kementerian Pendayagunaan Aparatur Negara dan Reformasi Birokrasi (PAN-RB)",
      "Kementerian Badan Usaha Milik Negara (BUMN)",
      "Kementerian Kependudukan dan Pembangunan Keluarga / BKKBN",
      "Kementerian Lingkungan Hidup / Badan Pengendalian Lingkungan Hidup",
      "Kementerian Investasi dan Hilirisasi / BKPM",
      "Kementerian Koperasi",
      "Kementerian Usaha Mikro, Kecil, dan Menengah",
      "Kementerian Pariwisata",
      "Kementerian Ekonomi Kreatif / Badan Ekonomi Kreatif",
      "Kementerian Pemberdayaan Perempuan dan Perlindungan Anak",
      "Kementerian Pemuda dan Olahraga",
    ],
  },
  {
    category: "Lembaga Pemerintah Non-Kementerian & Komisi Negara",
    items: [
      "Badan Kepegawaian Negara (BKN)",
      "Lembaga Administrasi Negara (LAN)",
      "Badan Pusat Statistik (BPS)",
      "Badan Riset dan Inovasi Nasional (BRIN)",
      "Badan Siber dan Sandi Negara (BSSN)",
      "Badan Pengawasan Keuangan dan Pembangunan (BPKP)",
      "Badan Meteorologi, Klimatologi, dan Geofisika (BMKG)",
      "Badan Nasional Penanggulangan Bencana (BNPB)",
      "Badan Nasional Penanggulangan Terorisme (BNPT)",
      "Badan Narkotika Nasional (BNN)",
      "Badan Pengawas Obat dan Makanan (BPOM)",
      "Komisi Pemberantasan Korupsi (KPK)",
      "Komisi Pemilihan Umum (KPU)",
      "Badan Pengawas Pemilihan Umum (BAWASLU)",
      "Kejaksaan Agung RI",
      "Kepolisian Negara Republik Indonesia (POLRI)",
      "Ombudsman Republik Indonesia",
      "Komisi Nasional Hak Asasi Manusia (Komnas HAM)",
      "Lembaga Ketahanan Nasional (Lemhannas)",
    ],
  },
  {
    category: "Pemerintah Daerah Provinsi (Pemerintah Provinsi)",
    items: [
      "Pemerintah Provinsi Aceh",
      "Pemerintah Provinsi Sumatera Utara",
      "Pemerintah Provinsi Sumatera Barat",
      "Pemerintah Provinsi Riau",
      "Pemerintah Provinsi Kepulauan Riau",
      "Pemerintah Provinsi Jambi",
      "Pemerintah Provinsi Sumatera Selatan",
      "Pemerintah Provinsi Kepulauan Bangka Belitung",
      "Pemerintah Provinsi Bengkulu",
      "Pemerintah Provinsi Lampung",
      "Pemerintah Provinsi DKI Jakarta",
      "Pemerintah Provinsi Jawa Barat",
      "Pemerintah Provinsi Banten",
      "Pemerintah Provinsi Jawa Tengah",
      "Pemerintah Daerah Istimewa Yogyakarta",
      "Pemerintah Provinsi Jawa Timur",
      "Pemerintah Provinsi Bali",
      "Pemerintah Provinsi Nusa Tenggara Barat",
      "Pemerintah Provinsi Nusa Tenggara Timur",
      "Pemerintah Provinsi Kalimantan Barat",
      "Pemerintah Provinsi Kalimantan Tengah",
      "Pemerintah Provinsi Kalimantan Selatan",
      "Pemerintah Provinsi Kalimantan Timur",
      "Pemerintah Provinsi Kalimantan Utara",
      "Pemerintah Provinsi Sulawesi Utara",
      "Pemerintah Provinsi Gorontalo",
      "Pemerintah Provinsi Sulawesi Tengah",
      "Pemerintah Provinsi Sulawesi Barat",
      "Pemerintah Provinsi Sulawesi Selatan",
      "Pemerintah Provinsi Sulawesi Tenggara",
      "Pemerintah Provinsi Maluku",
      "Pemerintah Provinsi Maluku Utara",
      "Pemerintah Provinsi Papua",
      "Pemerintah Provinsi Papua Barat",
      "Pemerintah Provinsi Papua Selatan",
      "Pemerintah Provinsi Papua Tengah",
      "Pemerintah Provinsi Papua Pegunungan",
      "Pemerintah Provinsi Papua Barat Daya",
    ],
  },
  {
    category: "Pemerintah Kabupaten / Kota / Instansi Lain",
    items: [
      "Pemerintah Kabupaten / Kota (Sebutkan Nama Daerah)",
      "Instansi / Satuan Kerja Lainnya",
    ],
  },
];

// 4. Daftar Pekerjaan / Profesi Terstandar untuk Masyarakat Umum
export const PROFESSIONS_LIST = [
  "Mahasiswa / Pelajar",
  "Dosen / Akademisi Perguruan Tinggi",
  "Guru / Tenaga Pendidik",
  "Peneliti / Ilmuwan / Perekayasa",
  "Pegawai Swasta / Karyawan Perusahaan",
  "Profesional / Konsultan / Tenaga Ahli",
  "Wirausaha / Pemilik Usaha / Pengusaha",
  "Pegawai BUMN / BUMD",
  "Tenaga Medis / Dokter / Perawat / Kesehatan",
  "Praktisi Hukum / Advokat / Notaris",
  "Jurnalis / Media / Kreator Konten",
  "Pegawai / Anggota Lembaga Swadaya Masyarakat (LSM) / NGO",
  "Pegawai Honorer / Tenaga Kontrak Non-ASN",
  "Pensiunan / Purnabakti",
  "Ibu Rumah Tangga",
  "Belum / Tidak Bekerja",
  "Lainnya (Tulis Spesifik)",
];

// 5. Daftar Negara Prioritas & Internasional
export const COUNTRIES_LIST = [
  "Indonesia",
  "Malaysia",
  "Singapura",
  "Brunei Darussalam",
  "Thailand",
  "Filipina",
  "Vietnam",
  "Timor Leste",
  "Australia",
  "Selandia Baru",
  "Jepang",
  "Korea Selatan",
  "Tiongkok",
  "Taiwan",
  "Hong Kong",
  "India",
  "Arab Saudi",
  "Uni Emirat Arab",
  "Qatar",
  "Turki",
  "Mesir",
  "Inggris Raya (UK)",
  "Jerman",
  "Belanda",
  "Prancis",
  "Swiss",
  "Rusia",
  "Amerika Serikat (USA)",
  "Kanada",
  "Negara Lainnya",
];

// 6. 38 Provinsi di Indonesia beserta Daftar Lengkap Kota & Kabupaten
export const INDONESIA_PROVINCES_AND_CITIES = {
  "Aceh": [
    "Kota Banda Aceh", "Kota Sabang", "Kota Lhokseumawe", "Kota Langsa", "Kota Subulussalam",
    "Kab. Aceh Besar", "Kab. Aceh Barat", "Kab. Aceh Barat Daya", "Kab. Aceh Jaya", "Kab. Aceh Selatan",
    "Kab. Aceh Singkil", "Kab. Aceh Tamiang", "Kab. Aceh Tengah", "Kab. Aceh Tenggara", "Kab. Aceh Timur",
    "Kab. Aceh Utara", "Kab. Bener Meriah", "Kab. Bireuen", "Kab. Gayo Lues", "Kab. Nagan Raya",
    "Kab. Pidie", "Kab. Pidie Jaya", "Kab. Simeulue"
  ],
  "Sumatera Utara": [
    "Kota Medan", "Kota Binjai", "Kota Pematangsiantar", "Kota Sibolga", "Kota Tanjungbalai",
    "Kota Tebing Tinggi", "Kota Padangsidimpuan", "Kota Gunungsitoli", "Kab. Asahan", "Kab. Batu Bara",
    "Kab. Dairi", "Kab. Deli Serdang", "Kab. Humbang Hasundutan", "Kab. Karo", "Kab. Labuhanbatu",
    "Kab. Labuhanbatu Selatan", "Kab. Labuhanbatu Utara", "Kab. Langkat", "Kab. Mandailing Natal",
    "Kab. Nias", "Kab. Nias Barat", "Kab. Nias Selatan", "Kab. Nias Utara", "Kab. Padang Lawas",
    "Kab. Padang Lawas Utara", "Kab. Pakpak Bharat", "Kab. Samosir", "Kab. Serdang Bedagai",
    "Kab. Simalungun", "Kab. Tapanuli Selatan", "Kab. Tapanuli Tengah", "Kab. Tapanuli Utara", "Kab. Toba"
  ],
  "Sumatera Barat": [
    "Kota Padang", "Kota Bukittinggi", "Kota Padang Panjang", "Kota Pariaman", "Kota Payakumbuh",
    "Kota Sawahlunto", "Kota Solok", "Kab. Agam", "Kab. Dharmasraya", "Kab. Kepulauan Mentawai",
    "Kab. Lima Puluh Kota", "Kab. Padang Pariaman", "Kab. Pasaman", "Kab. Pasaman Barat",
    "Kab. Pesisir Selatan", "Kab. Sijunjung", "Kab. Solok", "Kab. Solok Selatan", "Kab. Tanah Datar"
  ],
  "Riau": [
    "Kota Pekanbaru", "Kota Dumai", "Kab. Bengkalis", "Kab. Indragiri Hilir", "Kab. Indragiri Hulu",
    "Kab. Kampar", "Kab. Kepulauan Meranti", "Kab. Kuantan Singingi", "Kab. Pelalawan",
    "Kab. Rokan Hilir", "Kab. Rokan Hulu", "Kab. Siak"
  ],
  "Kepulauan Riau": [
    "Kota Tanjungpinang", "Kota Batam", "Kab. Bintan", "Kab. Karimun", "Kab. Kepulauan Anambas",
    "Kab. Lingga", "Kab. Natuna"
  ],
  "Jambi": [
    "Kota Jambi", "Kota Sungai Penuh", "Kab. Batanghari", "Kab. Bungo", "Kab. Kerinci",
    "Kab. Merangin", "Kab. Muaro Jambi", "Kab. Sarolangun", "Kab. Tanjung Jabung Barat",
    "Kab. Tanjung Jabung Timur", "Kab. Tebo"
  ],
  "Sumatera Selatan": [
    "Kota Palembang", "Kota Pagar Alam", "Kota Lubuklinggau", "Kota Prabumulih", "Kab. Banyuasin",
    "Kab. Empat Lawang", "Kab. Lahat", "Kab. Muara Enim", "Kab. Musi Banyuasin", "Kab. Musi Rawas",
    "Kab. Musi Rawas Utara", "Kab. Ogan Ilir", "Kab. Ogan Komering Ilir", "Kab. Ogan Komering Ulu",
    "Kab. Ogan Komering Ulu Selatan", "Kab. Ogan Komering Ulu Timur", "Kab. Penukal Abab Lematang Ilir"
  ],
  "Kepulauan Bangka Belitung": [
    "Kota Pangkalpinang", "Kab. Bangka", "Kab. Bangka Barat", "Kab. Bangka Selatan",
    "Kab. Bangka Tengah", "Kab. Belitung", "Kab. Belitung Timur"
  ],
  "Bengkulu": [
    "Kota Bengkulu", "Kab. Bengkulu Selatan", "Kab. Bengkulu Tengah", "Kab. Bengkulu Utara",
    "Kab. Kaur", "Kab. Kepahiang", "Kab. Lebong", "Kab. Mukomuko", "Kab. Rejang Lebong", "Kab. Seluma"
  ],
  "Lampung": [
    "Kota Bandar Lampung", "Kota Metro", "Kab. Lampung Barat", "Kab. Lampung Selatan",
    "Kab. Lampung Tengah", "Kab. Lampung Timur", "Kab. Lampung Utara", "Kab. Mesuji",
    "Kab. Pesawaran", "Kab. Pesisir Barat", "Kab. Pringsewu", "Kab. Tanggamus",
    "Kab. Tulang Bawang", "Kab. Tulang Bawang Barat", "Kab. Way Kanan"
  ],
  "DKI Jakarta": [
    "Kota Administrasi Jakarta Pusat", "Kota Administrasi Jakarta Utara",
    "Kota Administrasi Jakarta Barat", "Kota Administrasi Jakarta Selatan",
    "Kota Administrasi Jakarta Timur", "Kabupaten Administrasi Kepulauan Seribu"
  ],
  "Jawa Barat": [
    "Kota Bandung", "Kota Bekasi", "Kota Bogor", "Kota Cimahi", "Kota Cirebon",
    "Kota Depok", "Kota Sukabumi", "Kota Tasikmalaya", "Kota Banjar", "Kab. Bandung",
    "Kab. Bandung Barat", "Kab. Bekasi", "Kab. Bogor", "Kab. Ciamis", "Kab. Cianjur",
    "Kab. Cirebon", "Kab. Garut", "Kab. Indramayu", "Kab. Karawang", "Kab. Kuningan",
    "Kab. Majalengka", "Kab. Pangandaran", "Kab. Purwakarta", "Kab. Subang",
    "Kab. Sukabumi", "Kab. Sumedang", "Kab. Tasikmalaya"
  ],
  "Banten": [
    "Kota Serang", "Kota Cilegon", "Kota Tangerang", "Kota Tangerang Selatan",
    "Kab. Lebak", "Kab. Pandeglang", "Kab. Serang", "Kab. Tangerang"
  ],
  "Jawa Tengah": [
    "Kota Semarang", "Kota Magelang", "Kota Pekalongan", "Kota Salatiga", "Kota Surakarta",
    "Kota Tegal", "Kab. Banjarnegara", "Kab. Banyumas", "Kab. Batang", "Kab. Blora",
    "Kab. Boyolali", "Kab. Brebes", "Kab. Cilacap", "Kab. Demak", "Kab. Grobogan",
    "Kab. Jepara", "Kab. Karanganyar", "Kab. Kebumen", "Kab. Kendal", "Kab. Klaten",
    "Kab. Kudus", "Kab. Magelang", "Kab. Pati", "Kab. Pekalongan", "Kab. Pemalang",
    "Kab. Purbalingga", "Kab. Purworejo", "Kab. Rembang", "Kab. Semarang", "Kab. Sragen",
    "Kab. Sukoharjo", "Kab. Tegal", "Kab. Temanggung", "Kab. Wonogiri", "Kab. Wonosobo"
  ],
  "DI Yogyakarta": [
    "Kota Yogyakarta", "Kab. Bantul", "Kab. Gunungkidul", "Kab. Kulon Progo", "Kab. Sleman"
  ],
  "Jawa Timur": [
    "Kota Surabaya", "Kota Batu", "Kota Blitar", "Kota Kediri", "Kota Madiun",
    "Kota Malang", "Kota Mojokerto", "Kota Pasuruan", "Kota Probolinggo", "Kab. Bangkalan",
    "Kab. Banyuwangi", "Kab. Blitar", "Kab. Bojonegoro", "Kab. Bondowoso", "Kab. Gresik",
    "Kab. Jember", "Kab. Jombang", "Kab. Kediri", "Kab. Lamongan", "Kab. Lumajang",
    "Kab. Madiun", "Kab. Magetan", "Kab. Malang", "Kab. Mojokerto", "Kab. Nganjuk",
    "Kab. Ngawi", "Kab. Pacitan", "Kab. Pamekasan", "Kab. Pasuruan", "Kab. Ponorogo",
    "Kab. Probolinggo", "Kab. Sampang", "Kab. Sidoarjo", "Kab. Situbondo", "Kab. Sumenep",
    "Kab. Trenggalek", "Kab. Tuban", "Kab. Tulungagung"
  ],
  "Bali": [
    "Kota Denpasar", "Kab. Badung", "Kab. Bangli", "Kab. Buleleng", "Kab. Gianyar",
    "Kab. Jembrana", "Kab. Karangasem", "Kab. Klungkung", "Kab. Tabanan"
  ],
  "Nusa Tenggara Barat": [
    "Kota Mataram", "Kota Bima", "Kab. Bima", "Kab. Dompu", "Kab. Lombok Barat",
    "Kab. Lombok Tengah", "Kab. Lombok Timur", "Kab. Lombok Utara", "Kab. Sumbawa", "Kab. Sumbawa Barat"
  ],
  "Nusa Tenggara Timur": [
    "Kota Kupang", "Kab. Alor", "Kab. Belu", "Kab. Ende", "Kab. Flores Timur",
    "Kab. Kupang", "Kab. Lembata", "Kab. Malaka", "Kab. Manggarai", "Kab. Manggarai Barat",
    "Kab. Manggarai Timur", "Kab. Nagekeo", "Kab. Ngada", "Kab. Rote Ndao", "Kab. Sabu Raijua",
    "Kab. Sikka", "Kab. Sumba Barat", "Kab. Sumba Barat Daya", "Kab. Sumba Tengah",
    "Kab. Sumba Timur", "Kab. Timor Tengah Selatan", "Kab. Timor Tengah Utara"
  ],
  "Kalimantan Barat": [
    "Kota Pontianak", "Kota Singkawang", "Kab. Bengkayang", "Kab. Kapuas Hulu",
    "Kab. Kayong Utara", "Kab. Ketapang", "Kab. Kubu Raya", "Kab. Landak", "Kab. Melawi",
    "Kab. Mempawah", "Kab. Sambas", "Kab. Sanggau", "Kab. Sekadau", "Kab. Sintang"
  ],
  "Kalimantan Tengah": [
    "Kota Palangka Raya", "Kab. Barito Selatan", "Kab. Barito Timur", "Kab. Barito Utara",
    "Kab. Gunung Mas", "Kab. Kapuas", "Kab. Katingan", "Kab. Kotawaringin Barat",
    "Kab. Kotawaringin Timur", "Kab. Lamandau", "Kab. Murung Raya", "Kab. Pulang Pisau",
    "Kab. Sukamara", "Kab. Seruyan"
  ],
  "Kalimantan Selatan": [
    "Kota Banjarmasin", "Kota Banjarbaru", "Kab. Balangan", "Kab. Banjar", "Kab. Barito Kuala",
    "Kab. Hulu Sungai Selatan", "Kab. Hulu Sungai Tengah", "Kab. Hulu Sungai Utara",
    "Kab. Kotabaru", "Kab. Tabalong", "Kab. Tanah Bumbu", "Kab. Tanah Laut", "Kab. Tapin"
  ],
  "Kalimantan Timur": [
    "Kota Samarinda", "Kota Balikpapan", "Kota Bontang", "Kab. Berau", "Kab. Kutai Barat",
    "Kab. Kutai Kartanegara", "Kab. Kutai Timur", "Kab. Mahakam Ulu", "Kab. Paser",
    "Kab. Penajam Paser Utara"
  ],
  "Kalimantan Utara": [
    "Kota Tarakan", "Kab. Bulungan", "Kab. Malinau", "Kab. Nunukan", "Kab. Tana Tidung"
  ],
  "Sulawesi Utara": [
    "Kota Manado", "Kota Bitung", "Kota Kotamobagu", "Kota Tomohon", "Kab. Bolaang Mongondow",
    "Kab. Bolaang Mongondow Selatan", "Kab. Bolaang Mongondow Timur", "Kab. Bolaang Mongondow Utara",
    "Kab. Kepulauan Sangihe", "Kab. Kepulauan Siau Tagulandang Biaro", "Kab. Kepulauan Talaud",
    "Kab. Minahasa", "Kab. Minahasa Selatan", "Kab. Minahasa Tenggara", "Kab. Minahasa Utara"
  ],
  "Gorontalo": [
    "Kota Gorontalo", "Kab. Boalemo", "Kab. Bone Bolango", "Kab. Gorontalo",
    "Kab. Gorontalo Utara", "Kab. Pohuwato"
  ],
  "Sulawesi Tengah": [
    "Kota Palu", "Kab. Banggai", "Kab. Banggai Kepulauan", "Kab. Banggai Laut", "Kab. Buol",
    "Kab. Donggala", "Kab. Morowali", "Kab. Morowali Utara", "Kab. Parigi Moutong",
    "Kab. Poso", "Kab. Sigi", "Kab. Tojo Una-Una", "Kab. Tolitoli"
  ],
  "Sulawesi Barat": [
    "Kab. Majene", "Kab. Mamasa", "Kab. Mamuju", "Kab. Mamuju Tengah", "Kab. Pasangkayu",
    "Kab. Polewali Mandar"
  ],
  "Sulawesi Selatan": [
    "Kota Makassar", "Kota Palopo", "Kota Parepare", "Kab. Bantaeng", "Kab. Barru",
    "Kab. Bone", "Kab. Bulukumba", "Kab. Enrekang", "Kab. Gowa", "Kab. Jeneponto",
    "Kab. Kepulauan Selayar", "Kab. Luwu", "Kab. Luwu Timur", "Kab. Luwu Utara",
    "Kab. Maros", "Kab. Pangkajene dan Kepulauan", "Kab. Pinrang", "Kab. Sidenreng Rappang",
    "Kab. Sinjai", "Kab. Soppeng", "Kab. Takalar", "Kab. Tana Toraja", "Kab. Toraja Utara", "Kab. Wajo"
  ],
  "Sulawesi Tenggara": [
    "Kota Kendari", "Kota Baubau", "Kab. Bombana", "Kab. Buton", "Kab. Buton Selatan",
    "Kab. Buton Tengah", "Kab. Buton Utara", "Kab. Kolaka", "Kab. Kolaka Timur",
    "Kab. Kolaka Utara", "Kab. Konawe", "Kab. Konawe Kepulauan", "Kab. Konawe Selatan",
    "Kab. Konawe Utara", "Kab. Muna", "Kab. Muna Barat", "Kab. Wakatobi"
  ],
  "Maluku": [
    "Kota Ambon", "Kota Tual", "Kab. Buru", "Kab. Buru Selatan", "Kab. Kepulauan Aru",
    "Kab. Kepulauan Tanimbar", "Kab. Maluku Barat Daya", "Kab. Maluku Tengah",
    "Kab. Maluku Tenggara", "Kab. Seram Bagian Barat", "Kab. Seram Bagian Timur"
  ],
  "Maluku Utara": [
    "Kota Ternate", "Kota Tidore Kepulauan", "Kab. Halmahera Barat", "Kab. Halmahera Tengah",
    "Kab. Halmahera Timur", "Kab. Halmahera Selatan", "Kab. Halmahera Utara",
    "Kab. Kepulauan Sula", "Kab. Pulau Morotai", "Kab. Pulau Taliabu"
  ],
  "Papua": [
    "Kota Jayapura", "Kab. Biak Numfor", "Kab. Jayapura", "Kab. Keerom",
    "Kab. Kepulauan Yapen", "Kab. Mamberamo Raya", "Kab. Sarmi", "Kab. Supiori", "Kab. Waropen"
  ],
  "Papua Barat": [
    "Kab. Fakfak", "Kab. Kaimana", "Kab. Manokwari", "Kab. Manokwari Selatan",
    "Kab. Pegunungan Arfak", "Kab. Teluk Bintuni", "Kab. Teluk Wondama"
  ],
  "Papua Selatan": [
    "Kab. Asmat", "Kab. Boven Digoel", "Kab. Mappi", "Kab. Merauke"
  ],
  "Papua Tengah": [
    "Kab. Deiyai", "Kab. Dogiyai", "Kab. Intan Jaya", "Kab. Mimika",
    "Kab. Nabire", "Kab. Paniai", "Kab. Puncak", "Kab. Puncak Jaya"
  ],
  "Papua Pegunungan": [
    "Kab. Jayawijaya", "Kab. Lanny Jaya", "Kab. Mamberamo Tengah", "Kab. Nduga",
    "Kab. Pegunungan Bintang", "Kab. Tolikara", "Kab. Yahukimo", "Kab. Yalimo"
  ],
  "Papua Barat Daya": [
    "Kota Sorong", "Kab. Maybrat", "Kab. Raja Ampat", "Kab. Sorong",
    "Kab. Sorong Selatan", "Kab. Tambrauw"
  ],
};

