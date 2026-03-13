/**
 * ✨ PHASE 11.13: Variant Context / Bagian Utilities
 * 
 * Handles calculation and retrieval of variant context for lessons
 * A variant (bagian) is the section/unit that contains variant_items (lessons)
 */

/**
 * Find the variant (bagian) that contains a specific variant_item
 * @param {Object} variantItem - The lesson/variant_item object
 * @param {Array} curriculum - The curriculum array containing variants
 * @returns {Object|null} - The variant (bagian) object or null
 */
export const findVariantContext = (variantItem, curriculum) => {
    if (!variantItem || !curriculum) {
        return null;
    }

    // Search through curriculum variants
    for (const variant of curriculum) {
        if (variant.variant_items?.some(item => item.variant_item_id === variantItem.variant_item_id)) {
            return variant;
        }
    }

    return null;
};

/**
 * Get variant context data safely
 * Returns both variant (bagian) and the variant_item
 * @param {Object} variantItem - The currently selected lesson
 * @param {Object} course - The full course object containing curriculum
 * @returns {Object} - { variant, variantItem } or empty object
 */
export const getVariantContextData = (variantItem, course) => {
    if (!variantItem || !course?.curriculum) {
        return {};
    }

    const variant = findVariantContext(variantItem, course.curriculum);

    return {
        variant,
        variantItem
    };
};

/**
 * Get bagian (variant) list from curriculum
 * Useful for filtering discussions, notes by bagian
 * @param {Array} curriculum - The curriculum array
 * @returns {Array} - Array of bagian items with id and title
 */
export const getBagianList = (curriculum) => {
    if (!curriculum) return [];

    return curriculum.map(variant => ({
        id: variant.id || variant.variant_id,
        title: variant.title || variant.name || 'Unnamed Section',
        variant_id: variant.variant_id,
        variant_items: variant.variant_items || []
    }));
};

/**
 * Get pelajaran (variant_item) list from a specific bagian
 * Useful for filtering discussions, notes by pelajaran
 * @param {Object} variant - The variant (bagian) object
 * @returns {Array} - Array of pelajaran items with id and title
 */
export const getPelajaranList = (variant) => {
    if (!variant?.variant_items) return [];

    return variant.variant_items.map(item => ({
        id: item.variant_item_id,
        variant_item_id: item.variant_item_id,
        title: item.title || 'Unnamed Lesson',
        item
    }));
};

/**
 * Format variant context for display (used in VideoPlayer)
 * Returns formatted string like "Bagian 1: Pelajaran 1 - Lesson Title"
 * @param {Object} variantContext - The variant (bagian) object
 * @param {Object} variantItem - The lesson item
 * @returns {string} - Formatted display string
 */
export const formatVariantContextDisplay = (variantContext, variantItem) => {
    if (!variantContext || !variantItem) {
        return variantItem?.title || 'Lesson';
    }

    const bagianTitle = variantContext.title || 'Section';
    const pelajaranTitle = variantItem.title || 'Lesson';

    return `${bagianTitle} - ${pelajaranTitle}`;
};
