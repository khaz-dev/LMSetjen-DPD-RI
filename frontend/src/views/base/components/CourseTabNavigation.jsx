import React from "react";

const COURSE_TABS = [
    { key: "overview", label: "Gambaran Umum", shortLabel: "Info", icon: "fas fa-info-circle" },
    { key: "curriculum", label: "Kurikulum", shortLabel: "Pelajaran", icon: "fas fa-list" },
    { key: "instructor", label: "Instruktur", shortLabel: "Pengajar", icon: "fas fa-chalkboard-teacher" },
    { key: "reviews", label: "Ulasan", shortLabel: "Ulasan", icon: "fas fa-star" },
    { key: "faq", label: "Tanya Jawab", shortLabel: "Tanya Jawab", icon: "fas fa-question-circle" },
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
                <div className="nav nav-pills" role="tablist">{COURSE_TABS.map((tab) => (
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
    );
};

export default CourseTabNavigation;