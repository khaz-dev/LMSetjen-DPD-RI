import React from 'react';
import './SkeletonComponents.css';

/**
 * Reusable Skeleton Loader Components
 * Modern, professional loading states using shimmer animations
 * Usage: Replace all spinner-border instances with appropriate skeleton components
 */

// ==========================================
// BASE SKELETON ELEMENTS
// ==========================================

/**
 * Basic shimmer placeholder element
 * @param {string} width - Width (%, px, rem, etc.)
 * @param {string} height - Height (%, px, rem, etc.)
 * @param {string} borderRadius - Border radius (default: '8px')
 * @param {string} className - Additional CSS classes
 */
export const SkeletonBox = ({ 
    width = '100%', 
    height = '20px', 
    borderRadius = '8px',
    className = '',
    style = {}
}) => (
    <div 
        className={`skeleton-box ${className}`}
        style={{
            width,
            height,
            borderRadius,
            ...style
        }}
    />
);

/**
 * Circle skeleton (for avatars, icons)
 */
export const SkeletonCircle = ({ 
    size = '50px',
    className = '',
    style = {}
}) => (
    <div 
        className={`skeleton-circle ${className}`}
        style={{
            width: size,
            height: size,
            ...style
        }}
    />
);

/**
 * Text line skeleton with natural width variation
 */
export const SkeletonText = ({ 
    width = '100%',
    lines = 1,
    className = '',
    gap = '8px'
}) => (
    <div className={`skeleton-text ${className}`}>
        {[...Array(lines)].map((_, index) => (
            <SkeletonBox 
                key={index}
                width={index === lines - 1 && lines > 1 ? `${70 + Math.random() * 20}%` : width}
                height="16px"
                style={{ marginBottom: index < lines - 1 ? gap : '0' }}
            />
        ))}
    </div>
);

// ==========================================
// CARD SKELETONS
// ==========================================

/**
 * Generic card skeleton with image and content
 */
export const SkeletonCard = ({ 
    imageHeight = '200px',
    showImage = true,
    contentLines = 3,
    className = ''
}) => (
    <div className={`skeleton-card ${className}`}>
        {showImage && (
            <SkeletonBox height={imageHeight} borderRadius="16px 16px 0 0" />
        )}
        <div className="skeleton-card-body">
            <SkeletonBox width="60%" height="14px" style={{ marginBottom: '12px' }} />
            <SkeletonBox width="90%" height="20px" style={{ marginBottom: '8px' }} />
            <SkeletonText lines={contentLines} width="100%" />
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between' }}>
                <SkeletonBox width="45%" height="14px" />
                <SkeletonBox width="45%" height="14px" />
            </div>
        </div>
    </div>
);

/**
 * Course card skeleton (for course listings)
 */
export const SkeletonCourseCard = ({ className = '' }) => (
    <div className={`card border-0 skeleton-course-card ${className}`}>
        <SkeletonBox height="200px" borderRadius="16px 16px 0 0" />
        <div className="card-body p-3">
            {/* Category badge */}
            <SkeletonBox width="40%" height="12px" borderRadius="6px" style={{ marginBottom: '12px' }} />
            
            {/* Title */}
            <SkeletonBox width="90%" height="18px" style={{ marginBottom: '8px' }} />
            <SkeletonBox width="70%" height="18px" style={{ marginBottom: '12px' }} />
            
            {/* Instructor */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                <SkeletonCircle size="32px" style={{ marginRight: '8px' }} />
                <SkeletonBox width="120px" height="14px" />
            </div>
            
            {/* Rating */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <SkeletonBox width="45%" height="14px" />
                <SkeletonBox width="45%" height="14px" />
            </div>
            
            {/* Button */}
            <SkeletonBox height="40px" borderRadius="10px" />
        </div>
    </div>
);

/**
 * Category card skeleton
 */
export const SkeletonCategoryCard = ({ className = '' }) => (
    <div className={`card border-0 skeleton-category-card ${className}`} style={{ height: '160px' }}>
        <div className="card-body p-3 text-center d-flex flex-column justify-content-center">
            <SkeletonCircle size="50px" style={{ margin: '0 auto 12px' }} />
            <SkeletonBox width="70%" height="16px" style={{ margin: '0 auto 8px' }} />
            <SkeletonBox width="50%" height="12px" style={{ margin: '0 auto' }} />
        </div>
    </div>
);

// ==========================================
// LIST SKELETONS
// ==========================================

/**
 * List item skeleton (for tables, lists)
 */
export const SkeletonListItem = ({ 
    showAvatar = false,
    columns = 3,
    className = ''
}) => (
    <div className={`skeleton-list-item ${className}`}>
        {showAvatar && <SkeletonCircle size="40px" style={{ marginRight: '16px' }} />}
        <div style={{ flex: 1, display: 'flex', gap: '16px', alignItems: 'center' }}>
            {[...Array(columns)].map((_, index) => (
                <SkeletonBox 
                    key={index}
                    width={`${100 / columns - 2}%`}
                    height="16px"
                />
            ))}
        </div>
    </div>
);

/**
 * Table skeleton
 */
export const SkeletonTable = ({ 
    rows = 5,
    columns = 4,
    className = ''
}) => (
    <div className={`skeleton-table ${className}`}>
        {/* Table header */}
        <div className="skeleton-table-header">
            {[...Array(columns)].map((_, index) => (
                <SkeletonBox key={index} width="100%" height="20px" />
            ))}
        </div>
        
        {/* Table rows */}
        {[...Array(rows)].map((_, rowIndex) => (
            <div key={rowIndex} className="skeleton-table-row">
                {[...Array(columns)].map((_, colIndex) => (
                    <SkeletonBox key={colIndex} width="100%" height="16px" />
                ))}
            </div>
        ))}
    </div>
);

// ==========================================
// DASHBOARD SKELETONS
// ==========================================

/**
 * Dashboard stat card skeleton
 */
export const SkeletonStatCard = ({ className = '' }) => (
    <div className={`card border-0 skeleton-stat-card ${className}`}>
        <div className="card-body p-4">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                    <SkeletonBox width="60%" height="14px" style={{ marginBottom: '12px' }} />
                    <SkeletonBox width="40%" height="32px" style={{ marginBottom: '8px' }} />
                    <SkeletonBox width="50%" height="12px" />
                </div>
                <SkeletonCircle size="48px" />
            </div>
        </div>
    </div>
);

/**
 * Dashboard chart skeleton
 */
export const SkeletonChart = ({ 
    height = '300px',
    className = ''
}) => (
    <div className={`card border-0 skeleton-chart ${className}`}>
        <div className="card-body">
            <SkeletonBox width="40%" height="20px" style={{ marginBottom: '20px' }} />
            <SkeletonBox height={height} borderRadius="12px" />
        </div>
    </div>
);

// ==========================================
// FULL PAGE SKELETONS
// ==========================================

/**
 * Full page skeleton with header and content
 */
export const SkeletonPage = ({ 
    hasHeader = true,
    contentType = 'cards', // 'cards', 'list', 'table'
    items = 6,
    className = ''
}) => (
    <div className={`skeleton-page ${className}`}>
        {hasHeader && (
            <div className="skeleton-page-header">
                <SkeletonBox width="30%" height="32px" style={{ marginBottom: '12px' }} />
                <SkeletonBox width="50%" height="16px" />
            </div>
        )}
        
        <div className="skeleton-page-content">
            {contentType === 'cards' && (
                <div className="row g-4">
                    {[...Array(items)].map((_, index) => (
                        <div key={index} className="col-lg-4 col-md-6">
                            <SkeletonCourseCard />
                        </div>
                    ))}
                </div>
            )}
            
            {contentType === 'list' && (
                <div className="skeleton-list">
                    {[...Array(items)].map((_, index) => (
                        <SkeletonListItem key={index} showAvatar columns={3} />
                    ))}
                </div>
            )}
            
            {contentType === 'table' && (
                <SkeletonTable rows={items} columns={5} />
            )}
        </div>
    </div>
);

/**
 * Route loading skeleton (replaces App.jsx LoadingFallback)
 */
export const SkeletonRouteLoader = () => (
    <div className="skeleton-route-loader">
        <div className="skeleton-route-loader-content">
            {/* Simple shimmer bars */}
            <div className="skeleton-route-bars">
                <SkeletonBox width="60%" height="40px" style={{ marginBottom: '16px' }} />
                <SkeletonBox width="80%" height="20px" style={{ marginBottom: '12px' }} />
                <SkeletonBox width="70%" height="20px" style={{ marginBottom: '32px' }} />
                
                <div className="row g-3">
                    {[...Array(3)].map((_, index) => (
                        <div key={index} className="col-md-4">
                            <SkeletonStatCard />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
);

// ==========================================
// BUTTON LOADING STATE
// ==========================================

/**
 * Button loading indicator (replaces spinner-border-sm in buttons)
 */
export const ButtonLoader = ({ 
    text = 'Loading...',
    className = ''
}) => (
    <span className={`button-loader ${className}`}>
        <span className="button-loader-dots">
            <span></span>
            <span></span>
            <span></span>
        </span>
        {text && <span style={{ marginLeft: '8px' }}>{text}</span>}
    </span>
);

// ==========================================
// PROFILE SKELETON
// ==========================================

/**
 * Profile page skeleton
 */
export const SkeletonProfile = ({ className = '' }) => (
    <div className={`skeleton-profile ${className}`}>
        <div className="card border-0">
            <div className="card-body p-4">
                <div style={{ display: 'flex', gap: '24px', marginBottom: '32px' }}>
                    <SkeletonCircle size="120px" />
                    <div style={{ flex: 1 }}>
                        <SkeletonBox width="40%" height="28px" style={{ marginBottom: '12px' }} />
                        <SkeletonBox width="30%" height="16px" style={{ marginBottom: '8px' }} />
                        <SkeletonBox width="50%" height="16px" style={{ marginBottom: '20px' }} />
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <SkeletonBox width="120px" height="40px" borderRadius="8px" />
                            <SkeletonBox width="120px" height="40px" borderRadius="8px" />
                        </div>
                    </div>
                </div>
                
                <div className="row g-3">
                    {[...Array(4)].map((_, index) => (
                        <div key={index} className="col-md-6">
                            <SkeletonBox width="100%" height="80px" borderRadius="12px" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
);

export default {
    SkeletonBox,
    SkeletonCircle,
    SkeletonText,
    SkeletonCard,
    SkeletonCourseCard,
    SkeletonCategoryCard,
    SkeletonListItem,
    SkeletonTable,
    SkeletonStatCard,
    SkeletonChart,
    SkeletonPage,
    SkeletonRouteLoader,
    ButtonLoader,
    SkeletonProfile
};
