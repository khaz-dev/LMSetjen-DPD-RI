import React from "react";

const CourseTabNavigation = ({ activeTab, setActiveTab, course }) => {
    // Calculate dynamic badges for tabs
    const curriculumCount = course?.curriculum?.length || course?.lectures?.length || (course?.file_type === 'scorm' ? 1 : 0);
    const reviewCount = course?.rating_count || 0;
    const reviewRating = course?.average_rating ? Number(course.average_rating).toFixed(1) : null;

    const tabs = [
        {
            key: "overview",
            label: "Gambaran Umum",
            shortLabel: "Info",
            icon: "fas fa-circle-info",
            badge: null
        },
        {
            key: "curriculum",
            label: "Kurikulum",
            shortLabel: "Materi",
            icon: "fas fa-book-bookmark",
            badge: curriculumCount > 0 ? `${curriculumCount}` : null,
            badgeClass: "bg-teal-subtle text-teal"
        },
        {
            key: "instructor",
            label: "Instruktur",
            shortLabel: "Pengajar",
            icon: "fas fa-chalkboard-user",
            badge: null
        },
        {
            key: "reviews",
            label: "Ulasan",
            shortLabel: "Ulasan",
            icon: "fas fa-star",
            badge: reviewRating && reviewRating > 0 ? `★ ${reviewRating}` : (reviewCount > 0 ? `${reviewCount}` : null),
            badgeClass: "bg-warning-subtle text-warning-emphasis"
        },
        {
            key: "faq",
            label: "FAQ",
            shortLabel: "FAQ",
            icon: "fas fa-circle-question",
            badge: "9",
            badgeClass: "bg-secondary-subtle text-secondary"
        },
    ];

    return (
        <div className="course-tab-bar mb-3">
            <div className="course-tab-scroll d-flex align-items-center gap-2">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            className={`course-tab-btn btn btn-sm border-0 fw-semibold rounded-2 px-3 py-2 d-flex align-items-center gap-2 transition-all text-nowrap position-relative ${isActive
                                ? 'active text-white'
                                : 'text-secondary hover-bg-light'
                                }`}
                            onClick={() => setActiveTab(tab.key)}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                        >
                            <i className={`${tab.icon} ${isActive ? 'text-white' : 'text-teal'}`} style={{ fontSize: '0.85rem' }}></i>
                            <span className="d-none d-sm-inline" style={{ fontSize: '0.84rem' }}>{tab.label}</span>
                            <span className="d-inline d-sm-none" style={{ fontSize: '0.8rem' }}>{tab.shortLabel}</span>

                            {tab.badge && (
                                <span
                                    className={`badge rounded-pill ms-1 fw-bold d-inline-flex align-items-center justify-content-center ${isActive
                                        ? 'bg-white text-dark shadow-xs'
                                        : (tab.badgeClass || 'bg-light text-muted border')
                                        }`}
                                    style={{
                                        fontSize: '0.68rem',
                                        minWidth: '20px',
                                        height: '20px',
                                        padding: String(tab.badge).length > 2 ? '0 6px' : '0 4px',
                                        lineHeight: 1
                                    }}
                                >
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default CourseTabNavigation;
