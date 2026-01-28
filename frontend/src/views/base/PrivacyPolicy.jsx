import React, { memo } from "react";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import "./PrivacyPolicy.css";

function PrivacyPolicy() {
  return (
    <>
      <BaseHeader />
      <div className="policy-container">
        <div className="container py-5">
          <div className="policy-content">
            <h1 className="policy-title">Kebijakan Privasi</h1>
            <p className="policy-last-updated">
              Terakhir Diperbarui: Januari 2026
            </p>

            <section className="policy-section">
              <h2>1. Pendahuluan</h2>
              <p>
                LMSetjen DPD RI (selanjutnya disebut "Sistem" atau "Kami") berkomitmen untuk melindungi privasi dan data pribadi Anda. 
                Kebijakan Privasi ini menjelaskan bagaimana Kami mengumpulkan, menggunakan, dan melindungi informasi Anda.
              </p>
            </section>

            <section className="policy-section">
              <h2>2. Informasi yang Kami Kumpulkan</h2>
              <p>Kami mengumpulkan informasi berikut:</p>
              <ul>
                <li>
                  <strong>Data Autentikasi:</strong> Nomor Induk Pegawai (NIP), nama lengkap, email dari Google dan Nusa DPD
                </li>
                <li>
                  <strong>Data Profil:</strong> Foto profil, biografi, dan informasi pekerjaan
                </li>
                <li>
                  <strong>Data Pembelajaran:</strong> Kursus yang terdaftar, progress belajar, nilai, dan sertifikat
                </li>
                <li>
                  <strong>Data Aktivitas:</strong> Riwayat login, pencarian, dan interaksi dengan platform
                </li>
                <li>
                  <strong>Data Teknis:</strong> Alamat IP, jenis browser, dan informasi perangkat
                </li>
              </ul>
            </section>

            <section className="policy-section">
              <h2>3. Penggunaan Informasi</h2>
              <p>Kami menggunakan informasi Anda untuk:</p>
              <ul>
                <li>Menyediakan dan meningkatkan layanan pembelajaran</li>
                <li>Memproses autentikasi melalui Google dan Nusa DPD</li>
                <li>Mengelola pendaftaran kursus dan penerbitan sertifikat</li>
                <li>Mengirimkan pemberitahuan dan pembaruan penting</li>
                <li>Menganalisis penggunaan platform untuk peningkatan</li>
                <li>Mematuhi persyaratan hukum dan regulasi pemerintah</li>
              </ul>
            </section>

            <section className="policy-section">
              <h2>4. Keamanan Data</h2>
              <p>
                Kami mengimplementasikan langkah-langkah keamanan teknis dan administratif yang sesuai untuk melindungi 
                data pribadi Anda dari akses tidak sah, perubahan, pengungkapan, atau penghapusan.
              </p>
              <p>
                Data Anda disimpan di server yang aman dengan enkripsi dan dilindungi dengan autentikasi multi-faktor 
                saat diperlukan.
              </p>
            </section>

            <section className="policy-section">
              <h2>5. Pembagian Informasi</h2>
              <p>
                Kami tidak menjual, menukar, atau menyewakan data pribadi Anda kepada pihak ketiga. 
                Kami hanya membagikan informasi dengan:
              </p>
              <ul>
                <li>Penyedia layanan autentikasi (Google, Nusa DPD) untuk verifikasi login</li>
                <li>Pihak pemerintah jika diperlukan oleh hukum</li>
                <li>Tim internal kami yang membutuhkan data untuk memberikan layanan</li>
              </ul>
            </section>

            <section className="policy-section">
              <h2>6. Retensi Data</h2>
              <p>
                Kami menyimpan data pribadi Anda selama diperlukan untuk menyediakan layanan pembelajaran. 
                Data dapat disimpan lebih lama jika diperlukan untuk kepatuhan hukum atau keperluan administratif pemerintah.
              </p>
            </section>

            <section className="policy-section">
              <h2>7. Hak Pengguna</h2>
              <p>Anda memiliki hak untuk:</p>
              <ul>
                <li>Mengakses data pribadi Anda</li>
                <li>Memperbaiki data yang tidak akurat</li>
                <li>Menghapus akun Anda dan data terkait (sesuai peraturan)</li>
                <li>Menolak penggunaan data tertentu (dengan pengecualian kebutuhan operasional)</li>
              </ul>
            </section>

            <section className="policy-section">
              <h2>8. Kontak Kami</h2>
              <p>
                Jika Anda memiliki pertanyaan tentang kebijakan privasi ini atau ingin melaksanakan hak Anda, 
                silakan hubungi kami di:
              </p>
              <ul>
                <li>Email: <a href="mailto:sdm@dpd.go.id">sdm@dpd.go.id</a></li>
                <li>Bagian Pengembangan Sumber Daya Manusia (BPSDM) <br/>
                Biro OKK | Deputi Administrasi | Setjen DPD RI</li>
              </ul>
            </section>

            <section className="policy-section">
              <h2>9. Perubahan Kebijakan</h2>
              <p>
                Kami dapat mengubah kebijakan privasi ini kapan saja. Perubahan akan diumumkan melalui platform, 
                dan penggunaan berkelanjutan berarti penerimaan Anda terhadap perubahan tersebut.
              </p>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

export default memo(PrivacyPolicy);
