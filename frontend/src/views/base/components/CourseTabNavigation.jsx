import React from "react";

const COURSE_TABS = [
    { key: "overview", label: "Overview", shortLabel: "Info", icon: "fas fa-info-circle" },
    { key: "curriculum", label: "Curriculum", shortLabel: "Lessons", icon: "fas fa-list" },
    { key: "instructor", label: "Instructor", shortLabel: "Teacher", icon: "fas fa-chalkboard-teacher" },
    { key: "reviews", label: "Reviews", shortLabel: "Reviews", icon: "fas fa-star" },
    { key: "faq", label: "FAQ", shortLabel: "FAQ", icon: "fas fa-question-circle" },
];

const CourseTabNavigation = ({ activeTab, setActiveTab }) => {
    const [isScrolled, setIsScrolled] = React.useState(false);

    React.useEffect(() => {
        const handleScroll = () => {
            // Check if user has scrolled past the hero section
            const scrollPosition = window.scrollY;
            setIsScrolled(scrollPosition > 100);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleTabClick = (tabKey) => {
        setActiveTab(tabKey);
    };

    return (
        <div className={`course-tab-navigation ${isScrolled ? 'scrolled' : ''}`}>
            <nav>
                <div className="nav nav-pills nav-justified" role="tablist">{COURSE_TABS.map((tab) => (
                        <button
                            key={tab.key}
                            className={`nav-link fw-semibold px-2 px-md-3 ${activeTab === tab.key ? 'active' : ''}`}
                            onClick={() => handleTabClick(tab.key)}
                            type="button"
                            role="tab"
                            style={{ 
                                borderRadius: '12px',
                                padding: '0.75rem 1rem',
                                fontSize: '0.95rem'
                            }}
                        >
                            <i className={`${tab.icon} me-2`}></i>
                            <span className="d-none d-md-inline">{tab.label}</span>
                            <span className="d-md-none">{tab.shortLabel}</span>
                        </button>
                    ))}
                </div>
            </nav>
        </div>
    );
};

export default CourseTabNavigation;