import React, { useState, useRef, useEffect } from 'react';
import './TagSelector.css';

/**
 * ✨ PHASE X.2: Searchable Tag Selector Component
 * 
 * Features:
 * - Displays selected tags as removable badges
 * - Dropdown with searchable tag list
 * - Checkbox indicators for selected tags
 * - Clean Bootstrap styling
 * - No external dependencies (pure React + CSS)
 * 
 * Props:
 * - tags: Array of all available tags [{id, title, ...}]
 * - selectedTags: Array of currently selected tags [{id, title, ...}]
 * - onChange: Callback function called with updated tags array
 * - placeholder: Placeholder text for search input
 * - helpText: Optional help text to display below component
 */
const TagSelector = ({ 
    tags = [], 
    selectedTags = [], 
    onChange, 
    placeholder = "Cari atau pilih tag...", 
    helpText = "" 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, flipAbove: false });
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const positionLockedRef = useRef(false); // Prevent recalculation on hover/pointer events
    const resizeTimeoutRef = useRef(null);

    // ✨ PHASE X.2.1: Calculate dropdown position - ALWAYS below container
    const calculateDropdownPosition = () => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const gap = 4; // 4px gap between container and dropdown
        
        // Position dropdown ALWAYS directly below the container
        const top = rect.bottom + gap;
        
        // Ensure dropdown doesn't go off-screen horizontally
        // ⚠️ CRITICAL: Use exact width to prevent left/right shifts
        let left = rect.left;
        const dropdownWidth = rect.width;
        const rightEdge = left + dropdownWidth;
        
        if (rightEdge > window.innerWidth) {
            left = window.innerWidth - dropdownWidth - 10;
        }
        if (left < 0) {
            left = 10;
        }

        return {
            top,
            left,
            width: dropdownWidth, // Use exact width - don't recalculate on viewport
            flipAbove: false  // Never flip - always show below
        };
    };

    // ✨ PHASE 7.2 FIX: Lock position immediately on open - prevent recalculation on pointer events
    // ✨ PHASE 7.5 FIX: ADD SCROLL LISTENER to keep dropdown stuck below container when scrolling
    useEffect(() => {
        if (isOpen) {
            // Calculate position ONCE when opening
            const newPosition = calculateDropdownPosition();
            setDropdownPosition(newPosition);
            positionLockedRef.current = true;
            
            // ✨ CRITICAL: Clear any pending resize handler
            if (resizeTimeoutRef.current) {
                clearTimeout(resizeTimeoutRef.current);
            }
            
            // ✨ PHASE 7.5 FIX: CRITICAL - Handle scroll events to keep dropdown anchored
            // When user scrolls, container moves through viewport, so getBoundingClientRect() changes
            // We MUST recalculate position on scroll to keep dropdown below it
            const handleScroll = () => {
                if (positionLockedRef.current && containerRef.current) {
                    const updatedPosition = calculateDropdownPosition();
                    setDropdownPosition(updatedPosition);
                }
            };
            
            // Handle window resize
            const handleResize = () => {
                if (resizeTimeoutRef.current) {
                    clearTimeout(resizeTimeoutRef.current);
                }
                
                resizeTimeoutRef.current = setTimeout(() => {
                    if (positionLockedRef.current && containerRef.current) {
                        const updatedPosition = calculateDropdownPosition();
                        setDropdownPosition(updatedPosition);
                    }
                }, 150);
            };
            
            // Add BOTH scroll AND resize listeners
            window.addEventListener('scroll', handleScroll, { passive: true });
            window.addEventListener('resize', handleResize);
            
            return () => {
                window.removeEventListener('scroll', handleScroll);
                window.removeEventListener('resize', handleResize);
                if (resizeTimeoutRef.current) {
                    clearTimeout(resizeTimeoutRef.current);
                }
            };
        } else {
            // When dropdown closes, unlock position for next open
            positionLockedRef.current = false;
        }
    }, [isOpen]);

    // Filter tags based on search term and exclude already selected tags
    const filteredTags = tags.filter(tag => {
        const isAlreadySelected = selectedTags.some(st => st.id === tag.id);
        const matchesSearch = tag.title.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch && !isAlreadySelected;
    });

    // Handle tag selection
    const handleSelectTag = (tag) => {
        const updatedTags = [...selectedTags, tag];
        onChange(updatedTags);
        setSearchTerm('');
        inputRef.current?.focus();
    };

    // Handle tag removal
    const handleRemoveTag = (tagId) => {
        const updatedTags = selectedTags.filter(tag => tag.id !== tagId);
        onChange(updatedTags);
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

    // Check if a tag is selected
    const isTagSelected = (tagId) => selectedTags.some(tag => tag.id === tagId);

    return (
        <div className="tag-selector-container" ref={containerRef}>
            <div className="tag-selector-wrapper">
                {/* Selected Tags Display */}
                {selectedTags.length > 0 && (
                    <div className="tag-selector-badges">
                        {selectedTags.map(tag => (
                            <span key={tag.id} className="tag-badge">
                                <span className="tag-title">{tag.title}</span>
                                <button
                                    type="button"
                                    className="tag-remove-btn"
                                    onClick={() => handleRemoveTag(tag.id)}
                                    aria-label={`Remove ${tag.title}`}
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                {/* Search Input and Dropdown Trigger */}
                <div className="tag-selector-input-wrapper">
                    <input
                        ref={inputRef}
                        type="text"
                        className="tag-selector-input"
                        placeholder={placeholder}
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setIsOpen(true);
                        }}
                        onFocus={() => setIsOpen(true)}
                        aria-haspopup="listbox"
                        aria-expanded={isOpen}
                    />
                    <button
                        type="button"
                        className={`tag-selector-toggle ${isOpen ? 'open' : ''}`}
                        onClick={() => setIsOpen(!isOpen)}
                        aria-label="Toggle tag dropdown"
                    >
                        <i className="fas fa-chevron-down"></i>
                    </button>
                </div>

                {/* Dropdown Menu */}
                {isOpen && (
                    <div 
                        className="tag-selector-dropdown"
                        style={{
                            top: `${dropdownPosition.top}px`,
                            left: `${dropdownPosition.left}px`,
                            width: `${dropdownPosition.width}px`
                        }}
                    >
                        {filteredTags.length > 0 ? (
                            <ul className="tag-selector-list">
                                {filteredTags.map(tag => (
                                    <li
                                        key={tag.id}
                                        className={`tag-selector-item ${isTagSelected(tag.id) ? 'selected' : ''}`}
                                        onClick={() => handleSelectTag(tag)}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isTagSelected(tag.id)}
                                            onChange={() => handleSelectTag(tag)}
                                            className="tag-selector-checkbox"
                                        />
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
