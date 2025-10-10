import React from "react";

const COURSE_TABS = [
    { key: "overview", label: "Overview", shortLabel: "Info", icon: "fas fa-info-circle" },
    { key: "curriculum", label: "Curriculum", shortLabel: "Lessons", icon: "fas fa-list" },
    { key: "instructor", label: "Instructor", shortLabel: "Teacher", icon: "fas fa-chalkboard-teacher" },
    { key: "reviews", label: "Reviews", shortLabel: "Reviews", icon: "fas fa-star" },
    { key: "faq", label: "FAQ", shortLabel: "FAQ", icon: "fas fa-question-circle" },
];

const CourseTabNavigation = ({ activeTab, setActiveTab }) => {
    const handleTabClick = (tabKey) => {
        setActiveTab(tabKey);
    };

    return (
        <div className="card border-0 shadow-sm">
            <div className="card-header bg-light border-0">
                <nav>
                    <div className="nav nav-pills nav-justified" role="tablist">
                        {COURSE_TABS.map((tab) => (
                            <button
                                key={tab.key}
                                className={`nav-link fw-semibold px-2 px-md-3 ${activeTab === tab.key ? 'active' : ''}`}
                                onClick={() => handleTabClick(tab.key)}
                                type="button"
                                role="tab"
                            >
                                <i className={`${tab.icon} me-2`}></i>
                                <span className="d-none d-md-inline">{tab.label}</span>
                                <span className="d-md-none">{tab.shortLabel}</span>
                            </button>
                        ))}
                    </div>
                </nav>
            </div>
        </div>
    );
};

export default CourseTabNavigation;