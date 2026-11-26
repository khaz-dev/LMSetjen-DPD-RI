import React, { useState, useRef, useEffect, useCallback } from 'react';
import './TagSelector.css';

/**
 * ✨ Searchable Tag Selector Component
 * 
 * Features:
 * - Displays selected tags as removable badges
 * - Dropdown with searchable tag list
 * - Wrapper click-to-focus and open dropdown
 * - Clean Bootstrap & LMS Teal styling
 * - Reliable CSS absolute positioning (no jumping or scroll-lag)
 * 
 * Props:
 * - id: Optional id for input field (default: "tags-field")
 * - tags: Array of all available tags [{id, title, ...}]
 * - selectedTags: Array of currently selected tags [{id, title, ...}]
 * - onChange: Callback function called with updated tags array
 * - placeholder: Placeholder text for search input
 * - helpText: Optional help text to display below component
 */
const TagSelector = ({ 
    id = "tags-field",
    tags = [], 
    selectedTags = [], 
    onChange, 
    placeholder = "Cari atau pilih tag...", 
    helpText = "" 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    // Check if a tag is selected (handles both tag object and raw ID)
    const isTagSelected = useCallback((tagId) => {
        return (Array.isArray(selectedTags) ? selectedTags : []).some(tag => {
            const currentId = tag?.id !== undefined ? tag.id : tag;
            return currentId === tagId;
        });
    }, [selectedTags]);

    // Filter tags based on search term and exclude already selected tags
    const filteredTags = (Array.isArray(tags) ? tags : []).filter(tag => {
        if (!tag || tag.id === undefined) return false;
        const isAlreadySelected = isTagSelected(tag.id);
        const titleStr = String(tag.title || tag.name || '').toLowerCase();
        const matchesSearch = titleStr.includes((searchTerm || '').toLowerCase());
        return matchesSearch && !isAlreadySelected;
    });

    // Handle tag selection
    const handleSelectTag = (tag) => {
        const currentList = Array.isArray(selectedTags) ? selectedTags : [];
        const updatedTags = [...currentList, tag];
        if (typeof onChange === 'function') {
            onChange(updatedTags);
        }
        setSearchTerm('');
        inputRef.current?.focus();
    };

    // Handle tag removal
    const handleRemoveTag = (tagId) => {
        const currentList = Array.isArray(selectedTags) ? selectedTags : [];
        const updatedTags = currentList.filter(tag => {
            const currentId = tag?.id !== undefined ? tag.id : tag;
            return currentId !== tagId;
        });
        if (typeof onChange === 'function') {
            onChange(updatedTags);
        }
    };

    // Handle click on wrapper to focus input and open dropdown
    const handleWrapperClick = (e) => {
        // Prevent action if clicking on remove button or toggle button
        if (e.target.closest('.tag-remove-btn') || e.target.closest('.tag-selector-toggle')) {
            return;
        }
        inputRef.current?.focus();
        setIsOpen(true);
    };

    // Handle keyboard events (Escape to close, Backspace to remove last tag)
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            setIsOpen(false);
        } else if (e.key === 'Backspace' && !searchTerm && selectedTags.length > 0) {
            const lastTag = selectedTags[selectedTags.length - 1];
            const lastTagId = lastTag?.id !== undefined ? lastTag.id : lastTag;
            handleRemoveTag(lastTagId);
        }
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="tag-selector-container" ref={containerRef}>
            <div className="tag-selector-box-wrapper">
                <div 
                    className="tag-selector-wrapper"
                    onClick={handleWrapperClick}
                    role="combobox"
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                >
                    {/* Selected Tags Display */}
                    {Array.isArray(selectedTags) && selectedTags.length > 0 && (
                        <div className="tag-selector-badges">
                            {selectedTags.map(tag => {
                                const tagId = tag?.id !== undefined ? tag.id : tag;
                                const tagTitle = tag?.title || tag?.name || String(tagId);
                                return (
                                    <span key={tagId} className="tag-badge">
                                        <span className="tag-title">{tagTitle}</span>
                                        <button
                                            type="button"
                                            className="tag-remove-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveTag(tagId);
                                            }}
                                            aria-label={`Remove ${tagTitle}`}
                                        >
                                            <i className="fas fa-times"></i>
                                        </button>
                                    </span>
                                );
                            })}
                        </div>
                    )}

                    {/* Search Input and Dropdown Trigger */}
                    <div className="tag-selector-input-wrapper">
                        <input
                            ref={inputRef}
                            id={id}
                            type="text"
                            className="tag-selector-input"
                            placeholder={selectedTags.length === 0 ? placeholder : "Tambah tag lagi..."}
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setIsOpen(true);
                            }}
                            onFocus={() => setIsOpen(true)}
                            onClick={() => setIsOpen(true)}
                            onKeyDown={handleKeyDown}
                            autoComplete="off"
                        />
                        <button
                            type="button"
                            className={`tag-selector-toggle ${isOpen ? 'open' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsOpen(prev => {
                                    if (!prev) {
                                        inputRef.current?.focus();
                                    }
                                    return !prev;
                                });
                            }}
                            aria-label="Toggle tag dropdown"
                        >
                            <i className="fas fa-chevron-down"></i>
                        </button>
                    </div>
                </div>

                {/* Dropdown Menu */}
                {isOpen && (
                    <div className="tag-selector-dropdown" role="listbox">
                        {filteredTags.length > 0 ? (
                            <ul className="tag-selector-list">
                                {filteredTags.map(tag => (
                                    <li
                                        key={tag.id}
                                        className="tag-selector-item"
                                        onClick={() => handleSelectTag(tag)}
                                        role="option"
                                        aria-selected={false}
                                    >
                                        <i className="fas fa-tag me-2 text-muted" style={{ fontSize: "12px" }}></i>
                                        <span className="tag-selector-label">{tag.title}</span>
                                        {tag.course_count !== undefined && (
                                            <span className="tag-course-count">
                                                {tag.course_count} kursus
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        ) : searchTerm ? (
                            <div className="tag-selector-empty">
                                Tidak ada tag yang cocok dengan "{searchTerm}"
                            </div>
                        ) : tags.length === 0 ? (
                            <div className="tag-selector-empty">
                                Belum ada tag yang tersedia
                            </div>
                        ) : (
                            <div className="tag-selector-empty">
                                Semua tag telah dipilih
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Help Text */}
            {helpText && (
                <small className="form-text text-muted d-block mt-2">
                    {helpText}
                </small>
            )}
        </div>
    );
};

export default React.memo(TagSelector);
