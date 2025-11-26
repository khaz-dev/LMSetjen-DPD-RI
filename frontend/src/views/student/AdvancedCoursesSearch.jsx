/**
 * AdvancedCoursesSearch.jsx
 * Advanced course search page integrating search form and results
 * Phase 4.7 - Frontend UI
 * ✨ Phase 4.9: Added URL persistence and debouncing
 */

import React, { useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import BaseHeader from '../partials/BaseHeader';
import Footer from '../partials/Footer';
import AdvancedSearchForm from '../../components/AdvancedSearchForm';
import SearchResultsDisplay from '../../components/SearchResultsDisplay';
import useAdvancedSearch from '../../utils/useAdvancedSearch';
// ✨ PHASE 4.9: Import optimization hooks
import { useSearchURLPersistence } from '../../utils/useURLState';
import { useOptimizedSearch } from '../../utils/useOptimization';
import './AdvancedCoursesSearch.css';

function AdvancedCoursesSearch() {
    const location = useLocation();
    const {
        results,
        loading,
        error,
        pagination,
        metadata,
        categories,
        teachers,
        performSearch,
        changePage,
        clearSearch
    } = useAdvancedSearch();

    // ✨ PHASE 4.9: URL Persistence for search state
    const { query, filters, page, setQuery, setFilters, setPage, clearAll } = useSearchURLPersistence();

    const [currentSearchData, setCurrentSearchData] = useState(null);

    // Handle search submission
    const handleSearch = useCallback(async (searchData) => {
        // ✨ PHASE 4.9: Update URL with search params
        setQuery(searchData.query);
        if (searchData.filters) {
            setFilters(searchData.filters);
        }
        setPage(1); // Reset to page 1 on new search
        
        setCurrentSearchData(searchData);
        await performSearch(searchData);
    }, [performSearch, setQuery, setFilters, setPage]);

    // Handle page change
    const handlePageChange = useCallback((newPage) => {
        // ✨ PHASE 4.9: Update URL with new page
        setPage(newPage);
        
        if (currentSearchData) {
            changePage(newPage, currentSearchData);
        }
    }, [currentSearchData, changePage, setPage]);

    // Handle filter change (optional - for live filtering if needed)
    const handleFilterChange = useCallback((filters) => {
        // ✨ PHASE 4.9: Update URL with new filters
        setFilters(filters);
        console.log('Filters changed:', filters);
    }, [setFilters]);

    // Check if initial search from URL params
    React.useEffect(() => {
        // ✨ PHASE 4.9: Use URL persistence hook data
        if (query) {
            const searchData = {
                query: query,
                filters: filters || {},
                page: page || 1,
                per_page: 20
            };
            setCurrentSearchData(searchData);
            performSearch(searchData);
        }
    }, [query, page]); // Only re-run when URL params change

    return (
        <>
            <BaseHeader />
            <section className="advanced-search-page">
                <div className="container">
                    {/* Page Header */}
                    <div className="search-page-header">
                        <div className="header-content">
                            <h1>Find Your Next Course</h1>
                            <p>Search and discover thousands of courses tailored to your learning goals</p>
                        </div>
                    </div>

                    {/* Search Form */}
                    <div className="search-section">
                        <AdvancedSearchForm
                            onSearch={handleSearch}
                            loading={loading}
                            categories={categories}
                            teachers={teachers}
                            onFilterChange={handleFilterChange}
                        />
                    </div>

                    {/* Results Section */}
                    <div className="results-section">
                        {error && (
                            <div className="alert alert-danger alert-dismissible fade show" role="alert">
                                <i className="fas fa-exclamation-circle me-2"></i>
                                {error}
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => clearSearch()}
                                    aria-label="Close"
                                ></button>
                            </div>
                        )}

                        <SearchResultsDisplay
                            results={results}
                            loading={loading}
                            error={error}
                            pagination={pagination}
                            onPageChange={handlePageChange}
                            metadata={metadata}
                        />
                    </div>

                    {/* Empty State Help */}
                    {!loading && results.length === 0 && !currentSearchData && (
                        <div className="search-help-section">
                            <div className="help-container">
                                <h3>Get Started with Your Search</h3>
                                <div className="help-grid">
                                    <div className="help-item">
                                        <i className="fas fa-search"></i>
                                        <h5>Search by Topic</h5>
                                        <p>Enter a course topic or skill you want to learn</p>
                                    </div>
                                    <div className="help-item">
                                        <i className="fas fa-sliders-h"></i>
                                        <h5>Filter Results</h5>
                                        <p>Use filters to narrow down to your level and preferences</p>
                                    </div>
                                    <div className="help-item">
                                        <i className="fas fa-star"></i>
                                        <h5>Find Quality</h5>
                                        <p>Browse highly-rated courses from expert instructors</p>
                                    </div>
                                    <div className="help-item">
                                        <i className="fas fa-graduation-cap"></i>
                                        <h5>Choose Level</h5>
                                        <p>Select courses matching your skill level</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Popular Searches */}
                    {!currentSearchData && !loading && results.length === 0 && (
                        <div className="popular-searches-section">
                            <h4>Popular Searches</h4>
                            <div className="search-tags">
                                {[
                                    'Python',
                                    'Web Development',
                                    'Machine Learning',
                                    'Data Science',
                                    'React',
                                    'Django',
                                    'JavaScript',
                                    'UI Design'
                                ].map((tag) => (
                                    <button
                                        key={tag}
                                        className="search-tag"
                                        onClick={() => handleSearch({ query: tag, filters: {} })}
                                        type="button"
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </section>
            <Footer />
        </>
    );
}

export default AdvancedCoursesSearch;
