/**
 * AdvancedSearchForm.jsx
 * Advanced search form with multiple filter options
 * Phase 4.7 - Frontend UI
 */

import React, { useState, useCallback } from 'react';
import { useDebouncedCallback } from '../utils/useOptimization';
import './AdvancedSearchForm.css';

const AdvancedSearchForm = ({
    onSearch,
    loading = false,
    categories = [],
    teachers = [],
    onFilterChange
}) => {
    // Form state
    const [query, setQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        category_id: '',
        level: '',
        min_rating: '',
        teacher_id: ''
    });
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Handle query change
    const handleQueryChange = useCallback((e) => {
        const value = e.target.value;
        setQuery(value);
        // Suggestions will be debounced below
        debouncedFetchSuggestions(value);
    }, []);

    // ✨ Debounced suggestions fetcher (300ms delay to reduce API calls)
    const debouncedFetchSuggestions = useDebouncedCallback(async (value) => {
        if (value.length >= 2) {
            try {
                const response = await fetch(
                    `/api/v1/search/suggestions/?q=${encodeURIComponent(value)}`
                );
                const data = await response.json();
                setSuggestions(data.suggestions || []);
                setShowSuggestions(true);
            } catch (error) {
                console.error('Error fetching suggestions:', error);
            }
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    }, 300);

    // Handle suggestion click
    const handleSuggestionClick = useCallback((suggestion) => {
        setQuery(suggestion);
        setShowSuggestions(false);
        setSuggestions([]);
    }, []);

    // Handle filter change
    const handleFilterChange = useCallback((filterName, value) => {
        const newFilters = {
            ...filters,
            [filterName]: value === '' ? '' : value
        };
        setFilters(newFilters);
        
        if (onFilterChange) {
            onFilterChange(newFilters);
        }
    }, [filters, onFilterChange]);

    // Handle search submit
    const handleSubmit = useCallback((e) => {
        e.preventDefault();
        
        if (query.trim() === '') {
            alert('Please enter a search query');
            return;
        }

        const searchData = {
            query: query.trim(),
            filters: {
                ...(filters.category_id && { category_id: parseInt(filters.category_id) }),
                ...(filters.level && { level: filters.level }),
                ...(filters.min_rating && { min_rating: parseFloat(filters.min_rating) }),
                ...(filters.teacher_id && { teacher_id: parseInt(filters.teacher_id) })
            },
            page: 1,
            per_page: 20
        };

        if (onSearch) {
            onSearch(searchData);
        }
    }, [query, filters, onSearch]);

    // Handle clear filters
    const handleClearFilters = useCallback(() => {
        setFilters({
            category_id: '',
            level: '',
            min_rating: '',
            teacher_id: ''
        });
        
        if (onFilterChange) {
            onFilterChange({});
        }
    }, [onFilterChange]);

    // Check if any filters are applied
    const hasFilters = Object.values(filters).some(val => val !== '');

    return (
        <div className="advanced-search-container">
            {/* Search Bar */}
            <form onSubmit={handleSubmit} className="search-form-wrapper">
                <div className="search-input-group">
                    <div className="search-input-wrapper">
                        <i className="fas fa-search search-icon"></i>
                        <input
                            type="text"
                            className="form-control search-input"
                            placeholder="Search courses by title, topic, or skill..."
                            value={query}
                            onChange={handleQueryChange}
                            onFocus={() => query.length >= 2 && setShowSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                            disabled={loading}
                        />
                        {query && (
                            <button
                                type="button"
                                className="clear-input-btn"
                                onClick={() => {
                                    setQuery('');
                                    setSuggestions([]);
                                    setShowSuggestions(false);
                                }}
                                aria-label="Clear search"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        )}
                    </div>

                    {/* Suggestions Dropdown */}
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="suggestions-dropdown">
                            {suggestions.map((suggestion, index) => (
                                <div
                                    key={index}
                                    className="suggestion-item"
                                    onClick={() => handleSuggestionClick(suggestion)}
                                    role="option"
                                    aria-selected="false"
                                >
                                    <i className="fas fa-history suggestion-icon"></i>
                                    <span>{suggestion}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="search-actions">
                        <button
                            type="button"
                            className={`filter-toggle-btn ${showFilters ? 'active' : ''}`}
                            onClick={() => setShowFilters(!showFilters)}
                            title="Toggle advanced filters"
                            aria-label="Toggle filters"
                        >
                            <i className="fas fa-sliders-h"></i>
                            <span className="filter-label">Filters</span>
                            {hasFilters && <span className="filter-badge">{Object.values(filters).filter(v => v).length}</span>}
                        </button>

                        <button
                            type="submit"
                            className="search-submit-btn"
                            disabled={loading || query.trim() === ''}
                            title="Search courses"
                        >
                            {loading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2"></span>
                                    Searching...
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-search me-2"></i>
                                    Search
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </form>

            {/* Advanced Filters */}
            {showFilters && (
                <div className="advanced-filters-panel">
                    <div className="filters-header">
                        <h5 className="filters-title">Advanced Filters</h5>
                        {hasFilters && (
                            <button
                                type="button"
                                className="clear-filters-btn"
                                onClick={handleClearFilters}
                                title="Clear all filters"
                            >
                                <i className="fas fa-redo"></i>
                                Clear All
                            </button>
                        )}
                    </div>

                    <div className="filters-grid">
                        {/* Category Filter */}
                        <div className="filter-group">
                            <label htmlFor="category-filter" className="filter-label">
                                <i className="fas fa-list"></i>
                                Category
                            </label>
                            <select
                                id="category-filter"
                                className="form-select filter-select"
                                value={filters.category_id}
                                onChange={(e) => handleFilterChange('category_id', e.target.value)}
                                disabled={loading}
                            >
                                <option value="">All Categories</option>
                                {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.title}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Level Filter */}
                        <div className="filter-group">
                            <label htmlFor="level-filter" className="filter-label">
                                <i className="fas fa-graduation-cap"></i>
                                Level
                            </label>
                            <select
                                id="level-filter"
                                className="form-select filter-select"
                                value={filters.level}
                                onChange={(e) => handleFilterChange('level', e.target.value)}
                                disabled={loading}
                            >
                                <option value=\"\">Semua Level</option>
                                <option value=\"Beginner\">🟢 Pemula</option>
                                <option value=\"Intermediate\">🟡 Menengah</option>
                                <option value=\"Advanced\">🔴 Lanjutan</option>
                            </select>
                        </div>

                        {/* Rating Filter */}
                        <div className="filter-group">
                            <label htmlFor="rating-filter" className="filter-label">
                                <i className="fas fa-star"></i>
                                Minimum Rating
                            </label>
                            <select
                                id="rating-filter"
                                className="form-select filter-select"
                                value={filters.min_rating}
                                onChange={(e) => handleFilterChange('min_rating', e.target.value)}
                                disabled={loading}
                            >
                                <option value="">Any Rating</option>
                                <option value="3.0">3.0 ★ and up</option>
                                <option value="3.5">3.5 ★ and up</option>
                                <option value="4.0">4.0 ★ and up</option>
                                <option value="4.5">4.5 ★ and up</option>
                            </select>
                        </div>

                        {/* Teacher Filter */}
                        <div className="filter-group">
                            <label htmlFor="teacher-filter" className="filter-label">
                                <i className="fas fa-user-tie"></i>
                                Instructor
                            </label>
                            <select
                                id="teacher-filter"
                                className="form-select filter-select"
                                value={filters.teacher_id}
                                onChange={(e) => handleFilterChange('teacher_id', e.target.value)}
                                disabled={loading}
                            >
                                <option value="">All Instructors</option>
                                {teachers.map((teacher) => (
                                    <option key={teacher.id} value={teacher.id}>
                                        {teacher.full_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Active Filters Display */}
                    {hasFilters && (
                        <div className="active-filters">
                            <div className="active-filters-label">Active Filters:</div>
                            <div className="active-filters-list">
                                {filters.category_id && (
                                    <span className="filter-chip">
                                        Category: {categories.find(c => c.id == filters.category_id)?.title}
                                        <button
                                            type="button"
                                            onClick={() => handleFilterChange('category_id', '')}
                                            aria-label="Remove category filter"
                                        >
                                            ×
                                        </button>
                                    </span>
                                )}
                                {filters.level && (
                                    <span className="filter-chip">
                                        Level: {filters.level}
                                        <button
                                            type="button"
                                            onClick={() => handleFilterChange('level', '')}
                                            aria-label="Remove level filter"
                                        >
                                            ×
                                        </button>
                                    </span>
                                )}
                                {filters.min_rating && (
                                    <span className="filter-chip">
                                        Rating: {filters.min_rating}★+
                                        <button
                                            type="button"
                                            onClick={() => handleFilterChange('min_rating', '')}
                                            aria-label="Remove rating filter"
                                        >
                                            ×
                                        </button>
                                    </span>
                                )}
                                {filters.teacher_id && (
                                    <span className="filter-chip">
                                        Instructor: {teachers.find(t => t.id == filters.teacher_id)?.full_name}
                                        <button
                                            type="button"
                                            onClick={() => handleFilterChange('teacher_id', '')}
                                            aria-label="Remove instructor filter"
                                        >
                                            ×
                                        </button>
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdvancedSearchForm;
