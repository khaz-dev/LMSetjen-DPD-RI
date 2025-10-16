import React, { memo } from 'react';

const SearchSection = ({ onSearch }) => {
    return (
        <div className="modern-search-section mb-4">
            <div className="modern-search-container">
                <i className="fas fa-search search-icon"></i>
                <input 
                    type="search" 
                    className="form-control modern-search-input" 
                    placeholder="Search your courses by title..." 
                    onChange={onSearch}
                />
            </div>
        </div>
    );
};

export default memo(SearchSection);