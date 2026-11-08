/**
 * QA File Compression & Attachment Helper
 * Efficient client-side image compression and file validation for Q&A Discussions.
 * Reduces bandwidth and storage usage by up to 90-95% while keeping high visual clarity.
 */

export const MAX_QA_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_QA_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.pdf'];

/**
 * Format bytes to readable string (e.g., 240 KB, 1.2 MB)
 */
export const formatFileSize = (bytes) => {
    if (!bytes || typeof bytes !== 'number' || isNaN(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

/**
 * Extract clean extension from file name or URL
 */
export const getFileExtension = (filenameOrUrl = '') => {
    if (!filenameOrUrl) return '';
    const clean = String(filenameOrUrl).split('?')[0].split('#')[0];
    const parts = clean.split('.');
    return parts.length > 1 ? `.${parts.pop().toLowerCase()}` : '';
};

/**
 * Check if the given file or URL is an image
 */
export const isImageFile = (filenameOrUrl = '') => {
    const ext = getFileExtension(filenameOrUrl);
    return ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'].includes(ext);
};

/**
 * Check if the given file or URL is a PDF document
 */
export const isPdfFile = (filenameOrUrl = '') => {
    return getFileExtension(filenameOrUrl) === '.pdf';
};

/**
 * Validate file before uploading
 */
export const validateQAFile = (file) => {
    if (!file) {
        return { valid: false, error: 'File tidak ditemukan.' };
    }

    const ext = getFileExtension(file.name);
    if (!ALLOWED_QA_EXTENSIONS.includes(ext)) {
        return {
            valid: false,
            error: `Format file "${ext}" tidak didukung. Harap unggah gambar (PNG, JPG, WEBP) atau dokumen PDF.`
        };
    }

    if (file.size > MAX_QA_FILE_SIZE) {
        return {
            valid: false,
            error: `Ukuran file (${formatFileSize(file.size)}) melebihi batas maksimal 5 MB.`
        };
    }

    return { valid: true };
};

/**
 * Compress an image file using browser Canvas API.
 * Scales down images larger than max dimensions and converts to modern WebP format.
 * Non-image files (like PDFs) or already tiny images are returned untouched.
 * 
 * @param {File} file - Original file
 * @param {Object} options - Compression options
 * @returns {Promise<File>} Compressed File object
 */
export const compressImageFile = async (file, options = {}) => {
    const {
        maxWidth = 1600,
        maxHeight = 1600,
        quality = 0.85,
        targetMime = 'image/webp'
    } = options;

    // Only process standard raster images (skip PDF, SVG, animated GIF)
    if (!file || !file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
        return file;
    }

    return new Promise((resolve) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);

            let { width, height } = img;

            // Calculate scaling ratio
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                // Canvas 2D unsupported fallback
                return resolve(file);
            }

            // High-quality downsampling smoothing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        return resolve(file);
                    }

                    // If compression actually resulted in larger size, keep original
                    if (blob.size >= file.size) {
                        return resolve(file);
                    }

                    // Replace original extension with .webp
                    const originalName = file.name.replace(/\.[^/.]+$/, '');
                    const newFileName = `${originalName}.webp`;

                    const compressedFile = new File([blob], newFileName, {
                        type: targetMime,
                        lastModified: Date.now()
                    });

                    // Log savings for developer/debugging observation
                    const savedPct = (((file.size - compressedFile.size) / file.size) * 100).toFixed(1);
                    console.log(
                        `[QA Compression] ${file.name} (${formatFileSize(file.size)}) -> ${compressedFile.name} (${formatFileSize(compressedFile.size)}) [Saved ${savedPct}%]`
                    );

                    resolve(compressedFile);
                },
                targetMime,
                quality
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(file); // Fail-safe fallback to original
        };

        img.src = objectUrl;
    });
};

