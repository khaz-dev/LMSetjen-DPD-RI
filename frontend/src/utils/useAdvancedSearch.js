/**
 * useAdvancedSearch.js
 * Custom React hook for advanced search API integration
 * Phase 4.7 - Frontend UI
 */

import { useState, useCallback, useEffect } from 'react';
import useAxios from './useAxios';

const useAdvancedSearch = () => {
    const api = useAxios();
    
    // State management
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({
        page: 1,
        per_page: 20,
        total_results: 0,
        total_pages: 0
    });
    const [metadata, setMetadata] = useState({
        execution_time_ms: 0,
        search_quality_score: 0,
        query: '',
        filters_applied: {}
    });
    const [categories, setCategories] = useState([]);
    const [teachers, setTeachers] = useState([]);

    // Fetch categories
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await api.get('category-filter/');
                setCategories(response.data.categories || []);
            } catch (err) {
                console.error('Error fetching categories:', err);
            }
        };

        fetchCategories();
    }, [api]);

    // Fetch teachers
    useEffect(() => {
        const fetchTeachers = async () => {
            try {
                const response = await api.get('teacher-filter/');
                setTeachers(response.data.teachers || []);
            } catch (err) {
                console.error('Error fetching teachers:', err);
            }
        };

        fetchTeachers();
    }, [api]);

    // Perform advanced search
    const performSearch = useCallback(async (searchData) => {
        if (!searchData.query || searchData.query.trim() === '') {
            setError('Please enter a search query');
            setResults([]);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await api.post('search/advanced/', {
                query: searchData.query,
                filters: searchData.filters || {},
                page: searchData.page || 1,
                per_page: searchData.per_page || 20
            });

            const data = response.data;

            // Update results
            setResults(data.results || []);

            // Update pagination
            setPagination({
                page: data.page,
                per_page: data.per_page,
                total_results: data.total_results,
                total_pages: data.total_pages
            });

            // Update metadata
            setMetadata({
                execution_time_ms: data.execution_time_ms || 0,
                search_quality_score: data.search_quality_score || 0,
                query: data.query || '',
                filters_applied: data.filters_applied || {}
            });

            return data;
        } catch (err) {
            const errorMessage =
                err.response?.data?.detail ||
                err.response?.data?.error ||
                err.message ||
                'Failed to search courses';
            
            setError(errorMessage);
            setResults([]);
            console.error('Search error:', err);
        } finally {
            setLoading(false);
        }
    }, [api]);

    // Change page
    const changePage = useCallback(async (newPage, currentSearchData) => {
        if (currentSearchData) {
            await performSearch({
                ...currentSearchData,
                page: newPage
            });
        }
    }, [performSearch]);

    // Clear search
    const clearSearch = useCallback(() => {
        setResults([]);
        setError(null);
        setPagination({
            page: 1,
            per_page: 20,
            total_results: 0,
            total_pages: 0
        });
        setMetadata({
            execution_time_ms: 0,
            search_quality_score: 0,
            query: '',
            filters_applied: {}
        });
    }, []);

    // Get suggestions
    const getSuggestions = useCallback(async (query) => {
        if (!query || query.length < 2) {
            return [];
        }

        try {
            const response = await api.get(`search/suggestions/?q=${encodeURIComponent(query)}`);
            return response.data.suggestions || [];
        } catch (err) {
            console.error('Error fetching suggestions:', err);
            return [];
        }
    }, [api]);

    return {
        // State
        results,
        loading,
        error,
        pagination,
        metadata,
        categories,
        teachers,

        // Methods
        performSearch,
        changePage,
        clearSearch,
        getSuggestions
    };
};

export default useAdvancedSearch;
