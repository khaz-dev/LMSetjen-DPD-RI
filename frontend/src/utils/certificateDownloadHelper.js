import jsPDF from 'jspdf';
import Swal from 'sweetalert2';
import Toast from '../views/plugin/Toast';
import apiInstance from './axios';

/**
 * Download certificate as a standard A4 Landscape PDF (297mm x 210mm)
 * @param {string} imageSrc - URL, blob URL, or data URI of the certificate image
 * @param {string} fileName - Destination file name (.pdf)
 */
export const downloadCertificateAsPDF = async (imageSrc, fileName = 'Sertifikat.pdf') => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            try {
                // A4 in landscape orientation: width 297mm, height 210mm
                const pdf = new jsPDF({
                    orientation: 'landscape',
                    unit: 'mm',
                    format: 'a4',
                    compress: true
                });

                // Add image to fill the entire A4 Landscape page precisely
                pdf.addImage(img, 'PNG', 0, 0, 297, 210, undefined, 'FAST');
                const cleanFileName = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
                pdf.save(cleanFileName);
                resolve(true);
            } catch (err) {
                console.error('[CertificateDownloadHelper] Error creating PDF:', err);
                reject(err);
            }
        };

        img.onerror = (err) => {
            console.error('[CertificateDownloadHelper] Failed to load image for PDF generation:', err);
            reject(err);
        };

        // Cache-buster if external URL to avoid tainted canvas on CORS
        if (imageSrc.startsWith('http') && !imageSrc.includes('?')) {
            img.src = `${imageSrc}?v=${Date.now()}`;
        } else {
            img.src = imageSrc;
        }
    });
};

/**
 * Download certificate as PNG image
 * @param {Blob|string} blobOrUrl - Image blob or URL
 * @param {string} fileName - Destination file name (.png)
 */
export const downloadCertificateAsPNG = (blobOrUrl, fileName = 'Sertifikat.png') => {
    const cleanFileName = fileName.toLowerCase().endsWith('.png') ? fileName : `${fileName}.png`;
    
    if (typeof blobOrUrl === 'string') {
        const link = document.createElement('a');
        link.href = blobOrUrl;
        link.setAttribute('download', cleanFileName);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
    } else if (blobOrUrl instanceof Blob) {
        const blobUrl = window.URL.createObjectURL(blobOrUrl);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', cleanFileName);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
    }
};

/**
 * Interactive prompt modal giving user choice to download as PDF (A4 Landscape) or PNG (Ultra-HD)
 * @param {Object} options
 * @param {string} options.imageUrl - Direct URL to certificate image
 * @param {string} options.courseId - Course ID
 * @param {string} options.userId - User ID
 * @param {string} options.certificateId - Certificate ID
 * @param {string} options.courseTitle - Course title for nice filename
 * @param {HTMLElement} options.targetElement - Target element for fullscreen support
 */
export const promptCertificateDownload = async ({
    imageUrl = null,
    courseId = null,
    userId = null,
    certificateId = '',
    courseTitle = 'Kursus',
    targetElement = null
}) => {
    const safeTitle = (courseTitle || 'Kursus')
        .replace(/[^\w\s-]/gi, '')
        .trim()
        .replace(/\s+/g, '_');
    const baseName = `Sertifikat_${safeTitle}_${certificateId || courseId || 'DPDRI'}`;

    const portalTarget = targetElement || document.fullscreenElement || document.body;

    const result = await Swal.fire({
        title: 'Unduh Sertifikat Kelulusan',
        html: `
            <div class="cert-download-choice-box" style="text-align: left; padding: 4px 0;">
                <p class="text-muted mb-3" style="font-size: 0.88rem; line-height: 1.5;">
                    Silakan pilih format berkas sertifikat yang ingin Anda simpan ke perangkat:
                </p>
                <div class="d-flex flex-column gap-2.5">
                    <button type="button" id="cert-opt-pdf" class="btn btn-outline-teal d-flex align-items-center justify-content-between p-3 rounded-3 text-start w-100" style="border: 2px solid #0f766e; background: #f0fdfa; transition: all 0.2s ease;">
                        <div class="d-flex align-items-center gap-3">
                            <div style="width: 44px; height: 44px; border-radius: 10px; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <i class="fas fa-file-pdf fs-4"></i>
                            </div>
                            <div>
                                <div class="fw-bold text-dark" style="font-size: 0.95rem;">Dokumen PDF (A4 Landscape)</div>
                                <div class="text-muted small" style="font-size: 0.78rem;">Standar ukuran cetak resmi & verifikasi (297 &times; 210 mm)</div>
                            </div>
                        </div>
                        <i class="fas fa-download text-teal ms-2 fs-5"></i>
                    </button>

                    <button type="button" id="cert-opt-png" class="btn btn-outline-secondary d-flex align-items-center justify-content-between p-3 rounded-3 text-start w-100" style="border: 1px solid #cbd5e1; background: #ffffff; transition: all 0.2s ease;">
                        <div class="d-flex align-items-center gap-3">
                            <div style="width: 44px; height: 44px; border-radius: 10px; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <i class="fas fa-file-image fs-4"></i>
                            </div>
                            <div>
                                <div class="fw-bold text-dark" style="font-size: 0.95rem;">Gambar PNG (Ultra-HD)</div>
                                <div class="text-muted small" style="font-size: 0.78rem;">Format gambar beresolusi tinggi (asli 1414 &times; 1000 px)</div>
                            </div>
                        </div>
                        <i class="fas fa-download text-secondary ms-2 fs-5"></i>
                    </button>
                </div>
            </div>
        `,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Batal',
        cancelButtonColor: '#64748b',
        target: portalTarget,
        customClass: {
            popup: 'cert-download-choice-popup rounded-4 shadow-lg border-0',
            cancelButton: 'btn btn-secondary px-4 py-2 mt-2'
        },
        didOpen: (popup) => {
            const btnPdf = popup.querySelector('#cert-opt-pdf');
            const btnPng = popup.querySelector('#cert-opt-png');

            if (btnPdf) {
                btnPdf.onclick = () => Swal.close({ isConfirmed: true, value: 'pdf' });
                btnPdf.onmouseenter = () => { btnPdf.style.transform = 'translateY(-2px)'; btnPdf.style.boxShadow = '0 4px 12px rgba(15, 118, 110, 0.2)'; };
                btnPdf.onmouseleave = () => { btnPdf.style.transform = 'none'; btnPdf.style.boxShadow = 'none'; };
            }
            if (btnPng) {
                btnPng.onclick = () => Swal.close({ isConfirmed: true, value: 'png' });
                btnPng.onmouseenter = () => { btnPng.style.transform = 'translateY(-2px)'; btnPng.style.boxShadow = '0 4px 12px rgba(2, 132, 199, 0.2)'; };
                btnPng.onmouseleave = () => { btnPng.style.transform = 'none'; btnPng.style.boxShadow = 'none'; };
            }
        }
    });

    if (!result.isConfirmed || !result.value) {
        return;
    }

    const selectedFormat = result.value; // 'pdf' | 'png'

    Toast().fire({
        icon: 'info',
        title: selectedFormat === 'pdf' ? 'Menyiapkan PDF...' : 'Menyiapkan PNG...',
        text: selectedFormat === 'pdf' ? 'Membuat dokumen PDF A4 Landscape...' : 'Mengunduh berkas gambar...'
    });

    try {
        // Resolve valid image source
        let validImageSrc = imageUrl;

        // If direct image URL not provided, fetch from backend API
        if (!validImageSrc && courseId && userId) {
            const endpoint = `student/certificate-download/${courseId}/${userId}/?format=${selectedFormat}`;
            const response = await apiInstance.get(endpoint, { responseType: 'blob' });
            
            if (selectedFormat === 'pdf') {
                downloadCertificateAsPNG(response.data, `${baseName}.pdf`);
            } else {
                downloadCertificateAsPNG(response.data, `${baseName}.png`);
            }

            Toast().fire({
                icon: 'success',
                title: 'Unduhan Berhasil!',
                text: `Sertifikat ${selectedFormat.toUpperCase()} berhasil disimpan.`
            });
            return;
        }

        // If we have an image URL:
        if (selectedFormat === 'pdf') {
            await downloadCertificateAsPDF(validImageSrc, `${baseName}.pdf`);
        } else {
            // Download as PNG blob
            const res = await fetch(validImageSrc);
            const blob = await res.blob();
            downloadCertificateAsPNG(blob, `${baseName}.png`);
        }

        Toast().fire({
            icon: 'success',
            title: 'Unduhan Berhasil!',
            text: `Sertifikat ${selectedFormat.toUpperCase()} berhasil disimpan.`
        });
    } catch (err) {
        console.error('[CertificateDownloadHelper] Download failed:', err);
        // Fallback: try direct backend download
        if (courseId && userId) {
            try {
                const endpoint = `student/certificate-download/${courseId}/${userId}/?format=${selectedFormat}`;
                const response = await apiInstance.get(endpoint, { responseType: 'blob' });
                const ext = selectedFormat === 'pdf' ? 'pdf' : 'png';
                downloadCertificateAsPNG(response.data, `${baseName}.${ext}`);
                Toast().fire({
                    icon: 'success',
                    title: 'Unduhan Berhasil!',
                    text: `Sertifikat ${selectedFormat.toUpperCase()} berhasil disimpan.`
                });
                return;
            } catch (fallbackErr) {
                console.error('[CertificateDownloadHelper] Fallback download failed:', fallbackErr);
            }
        }

        Toast().fire({
            icon: 'error',
            title: 'Gagal Mengunduh',
            text: 'Terjadi kesalahan saat memproses unduhan sertifikat.'
        });
    }
};

