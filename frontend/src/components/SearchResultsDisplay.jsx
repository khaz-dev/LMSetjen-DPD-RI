/**
 * SearchResultsDisplay.jsx
 * Display advanced search results with pagination and metadata
 * Phase 4.7 - Frontend UI
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { VirtualGrid } from './VirtualList/VirtualList';
import { LazyImage } from '../utils/useLazyLoad';
import './SearchResultsDisplay.css';

const SearchResultsDisplay = ({
    results = [],
    loading = false,
    error = null,
    pagination = {
        page: 1,
        per_page: 20,
        total_results: 0,
        total_pages: 0
    },
    onPageChange = null,
    metadata = {
        execution_time_ms: 0,
        search_quality_score: 0,
        query: ''
    }
}) => {
    const [currentPage, setCurrentPage] = useState(pagination.page);

    // Handle page change
    const handlePageChange = useCallback((newPage) => {
        if (newPage >= 1 && newPage <= pagination.total_pages) {
            setCurrentPage(newPage);
            if (onPageChange) {
                onPageChange(newPage);
            }
            // Scroll to top of results
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [pagination.total_pages, onPageChange]);

    // Generate page numbers for pagination
    const pageNumbers = useMemo(() => {
        const pages = [];
        const maxPagesToShow = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(pagination.total_pages, startPage + maxPagesToShow - 1);

        if (endPage - startPage + 1 < maxPagesToShow) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }

        return pages;
    }, [currentPage, pagination.total_pages]);

    // Get quality score color
    const getQualityScoreColor = (score) => {
        if (score >= 80) return '#4caf50'; // Green
        if (score >= 60) return '#ff9800'; // Orange
        if (score >= 40) return '#ff9800'; // Orange
        return '#f44336'; // Red
    };

    // Get rating color
    const getRatingColor = (rating) => {
        if (rating >= 4.5) return '#4caf50';
        if (rating >= 4) return '#8bc34a';
        if (rating >= 3) return '#ff9800';
        return '#f44336';
    };

    // Format execution time
    const formatExecutionTime = (ms) => {
        if (ms < 1000) return `${Math.round(ms)}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    // Loading state
    if (loading) {
        return (
            <div className="search-results-container">
                <div className="search-results-loading">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <p>Searching for courses...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="search-results-container">
                <div className="search-error-message">
                    <i className="fas fa-exclamation-circle"></i>
                    <h4>Search Error</h4>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    // Empty results state
    if (!results || results.length === 0) {
        return (
            <div className="search-results-container">
                <div className="search-empty-state">
                    <div className="empty-icon">
                        <i className="fas fa-search"></i>
                    </div>
                    <h4>No Courses Found</h4>
                    <p>
                        {metadata.query
                            ? `No courses match your search for "${metadata.query}". Try adjusting your filters or search terms.`
                            : 'No courses available. Try searching for something.'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="search-results-container">
            {/* Results Header */}
            <div className="results-header">
                <div className="results-info">
                    <h4 className="results-count">
                        Found <strong>{pagination.total_results}</strong> Course{pagination.total_results !== 1 ? 's' : ''}
                    </h4>
                    {metadata.query && (
                        <p className="results-query">
                            for "<strong>{metadata.query}</strong>"
                        </p>
                    )}
                </div>

                {/* Performance Metrics */}
                <div className="results-metrics">
                    <div className="metric-item">
                        <span className="metric-label">Quality:</span>
                        <div className="quality-score-badge">
                            <div
                                className="quality-score-fill"
                                style={{
                                    width: `${metadata.search_quality_score}%`,
                                    backgroundColor: getQualityScoreColor(metadata.search_quality_score)
                                }}
                            ></div>
                            <span className="quality-score-text">
                                {Math.round(metadata.search_quality_score)}%
                            </span>
                        </div>
                    </div>

                    <div className="metric-item">
                        <i className="fas fa-clock"></i>
                        <span>{formatExecutionTime(metadata.execution_time_ms)}</span>
                    </div>
                </div>
            </div>

            {/* Results Grid with Virtual Scrolling */}
            <div className="results-grid-container">
                <VirtualGrid
                    items={results}
                    columns={4}
                    itemHeight={320}
                    containerHeight={600}
                    gap={16}
                    overscan={2}
                    loading={loading}
                    renderItem={(course) => (
                        <div key={course.id} className="result-card">
                            <div className="result-image-wrapper">
                                <LazyImage
                                    src={course.image || '/placeholder-course.jpg'}
                                    alt={course.title}
                                    className="result-image"
                                    placeholder="/placeholder-course.jpg"
                                    width="100%"
                                    height="200px"
                                />
                                <div className="result-badges">
                                    {course.level && (
                                        <span className={`badge badge-level badge-${course.level.toLowerCase()}`}>
                                            {course.level}
                                        </span>
                                    )}
                                    {course.featured && (
                                        <span className="badge badge-featured">
                                            <i className="fas fa-star"></i> Featured
                                        </span>
                                    )}
                                </div>
                                {course.rank && (
                                    <div className="result-relevance">
                                        <div className="relevance-bar">
                                            <div
                                                className="relevance-fill"
                                                style={{ width: `${Math.min(course.rank * 100, 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="result-content">
                                <div className="result-meta">
                                    {course.teacher_name && (
                                        <span className="result-teacher">
                                            <i className="fas fa-user"></i>
                                            {course.teacher_name}
                                        </span>
                                    )}
                                    {course.category_name && (
                                        <span className="result-category">
                                            <i className="fas fa-list"></i>
                                            {course.category_name}
                                        </span>
                                    )}
                                </div>

                                <Link
                                    to={`/course/${course.slug}/`}
                                    className="result-title"
                                    title={course.title}
                                >
                                    {course.title}
                                </Link>

                                {course.description && (
                                    <p className="result-description">
                                        {course.description.length > 100
                                            ? `${course.description.substring(0, 100)}...`
                                            : course.description}
                                    </p>
                                )}

                                <div className="result-footer">
                                    <div className="result-rating">
                                        {course.rating !== null && course.rating !== undefined ? (
                                            <>
                                                <div className="rating-stars">
                                                    {[...Array(5)].map((_, i) => (
                                                        <i
                                                            key={i}
                                                            className={`fas fa-star ${
                                                                i < Math.round(course.rating) ? 'filled' : ''
                                                            }`}
                                                            style={{
                                                                color:
                                                                    i < Math.round(course.rating)
                                                                        ? getRatingColor(course.rating)
                                                                        : '#ddd'
                                                            }}
                                                        ></i>
                                                    ))}
                                                </div>
                                                <span className="rating-value" style={{ color: getRatingColor(course.rating) }}>
                                                    {course.rating.toFixed(1)}
                                                </span>
                                                {course.rating_count > 0 && (
                                                    <span className="rating-count">
                                                        ({course.rating_count})
                                                    </span>
                                                )}
                                            </>
                                        ) : (
                                            <span className="no-rating">No ratings yet</span>
                                        )}
                                    </div>

                                    <Link
                                        to={`/course/${course.slug}/`}
                                        className="result-action-btn"
                                        title="View course details"
                                    >
                                        <i className="fas fa-arrow-right"></i>
                                    </Link>
                                </div>

                                {/* Matched Filters Display */}
                                {course.matched_filters && course.matched_filters.length > 0 && (
                                    <div className="matched-filters">
                                        <span className="matched-label">Matched:</span>
                                        {course.matched_filters.map((filter, idx) => (
                                            <span key={idx} className="matched-filter-tag">
                                                {filter}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                />
            </div>

            {/* Pagination */}
            {pagination.total_pages > 1 && (
                <nav className="results-pagination" aria-label="Search results pagination">
                    <ul className="pagination">
                        {/* Previous Button */}
                        <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                            <button
                                className="page-link"
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                aria-label="Previous page"
                            >
                                <i className="fas fa-chevron-left"></i>
                                Previous
                            </button>
                        </li>

                        {/* Page Numbers */}
                        {pageNumbers.map((pageNum) => (
                            <li key={pageNum} className={`page-item ${pageNum === currentPage ? 'active' : ''}`}>
                                <button
                                    className="page-link"
                                    onClick={() => handlePageChange(pageNum)}
                                    aria-label={`Page ${pageNum}`}
                                    aria-current={pageNum === currentPage ? 'page' : undefined}
                                >
                                    {pageNum}
                                </button>
                            </li>
                        ))}

                        {/* Next Button */}
                        <li className={`page-item ${currentPage === pagination.total_pages ? 'disabled' : ''}`}>
                            <button
                                className="page-link"
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === pagination.total_pages}
                                aria-label="Next page"
                            >
                                Next
                                <i className="fas fa-chevron-right"></i>
                            </button>
                        </li>
                    </ul>

                    <div className="pagination-info">
                        Showing page <strong>{currentPage}</strong> of <strong>{pagination.total_pages}</strong>
                    </div>
                </nav>
            )}

            {/* Results Summary Footer */}
            <div className="results-footer">
                <div className="results-summary">
                    {results.length > 0 && (
                        <p>
                            Displaying <strong>{results.length}</strong> of{' '}
                            <strong>{pagination.total_results}</strong> results
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SearchResultsDisplay;
