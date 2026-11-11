import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import BaseHeader from '../partials/BaseHeader';
import Footer from '../partials/Footer';
import { userGuideContent } from './userGuideData';
import useStickyHero from '../../hooks/useStickyHero';
import useSystemVersion from '../../hooks/useSystemVersion';
import './UserGuide.css';

function UserGuide() {
    const [language, setLanguage] = useState('id'); // Default to Indonesian
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [openTrouble, setOpenTrouble] = useState({ 0: true, 1: true });
    const [openFaq, setOpenFaq] = useState({ 0: true });
    const [activeSection, setActiveSection] = useState('getting-started');
    const { isScrolled, headerHeight } = useStickyHero(55);
    const { version: liveVersion } = useSystemVersion();

    // Ensure body background is properly tinted for silhouette layer
    useEffect(() => {
        const originalBg = document.body.style.backgroundColor;
        document.body.style.backgroundColor = "#f1f5f9";
        return () => {
            document.body.style.backgroundColor = originalBg;
        };
    }, []);

    // Track coordinator slot height to prevent any layout shift during sticky transition
    const slotRef = useRef(null);
    const [slotHeight, setSlotHeight] = useState(215);

    useEffect(() => {
        const updateSlotHeight = () => {
            if (slotRef.current && !isScrolled) {
                setSlotHeight(slotRef.current.offsetHeight);
            }
        };
        updateSlotHeight();
        window.addEventListener('resize', updateSlotHeight);
        return () => window.removeEventListener('resize', updateSlotHeight);
    }, [isScrolled, language]);

    const handlePrint = () => {
        window.print();
    };

    const scrollToSection = (sectionId) => {
        setActiveSection(sectionId);
        const element = document.getElementById(sectionId);
        if (element) {
            // Offset for: BaseHeader (headerHeight) + stuck hero (56px) + stuck filter strip (58px) + margin clearance (16px)
            const headerOffset = (headerHeight || 60) + 56 + 58 + 16;
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    };

    // Scroll spy for sidebar active indicator
    useEffect(() => {
        const handleScroll = () => {
            const sections = ['getting-started', 'for-students', 'for-instructors', 'manta-ai', 'features', 'troubleshooting', 'faq'];
            const scrollPos = window.scrollY + (headerHeight || 60) + 56 + 58 + 30;

            for (let i = sections.length - 1; i >= 0; i--) {
                const el = document.getElementById(sections[i]);
                if (el && el.offsetTop <= scrollPos) {
                    setActiveSection(sections[i]);
                    break;
                }
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [headerHeight]);

    const t = userGuideContent[language] || userGuideContent.id;

    // Toggle Accordion helpers
    const toggleTrouble = (index) => {
        setOpenTrouble(prev => ({ ...prev, [index]: !prev[index] }));
    };

    const toggleAllTrouble = (expand) => {
        const newState = {};
        t.sections.troubleshooting.issues.forEach((_, idx) => {
            newState[idx] = expand;
        });
        setOpenTrouble(newState);
    };

    const toggleFaq = (index) => {
        setOpenFaq(prev => ({ ...prev, [index]: !prev[index] }));
    };

    const toggleAllFaq = (expand) => {
        const newState = {};
        t.sections.faq.questions.forEach((_, idx) => {
            newState[idx] = expand;
        });
        setOpenFaq(newState);
    };

    // Filtered FAQ & Troubleshooting based on search
    const query = searchQuery.trim().toLowerCase();

    const filteredFaq = useMemo(() => {
        if (!query) return t.sections.faq.questions;
        return t.sections.faq.questions.filter(item =>
            item.q.toLowerCase().includes(query) || item.a.toLowerCase().includes(query)
        );
    }, [t, query]);

    const filteredTrouble = useMemo(() => {
        if (!query) return t.sections.troubleshooting.issues;
        return t.sections.troubleshooting.issues.filter(item =>
            item.problem.toLowerCase().includes(query) ||
            item.solutions.some(s => s.toLowerCase().includes(query))
        );
    }, [t, query]);

    // Check if section should be displayed according to activeTab or search
    const shouldShowSection = (sectionId) => {
        if (activeTab !== 'all' && activeTab !== sectionId) {
            return false;
        }
        if (!query) return true;

        if (sectionId === 'faq') return filteredFaq.length > 0;
        if (sectionId === 'troubleshooting') return filteredTrouble.length > 0;

        // Search check for text in other sections
        const secText = JSON.stringify(t.sections).toLowerCase();
        return secText.includes(query);
    };

    const tabList = [
        { id: 'all', title: language === 'en' ? 'All Topics' : 'Semua Topik', icon: 'fa-layer-group' },
        { id: 'getting-started', title: t.sections.gettingStarted.title, icon: 'fa-rocket' },
        { id: 'for-students', title: t.sections.forStudents.title, icon: 'fa-graduation-cap' },
        { id: 'for-instructors', title: t.sections.forInstructors.title, icon: 'fa-chalkboard-teacher' },
        { id: 'manta-ai', title: 'Manta AI', icon: 'fa-robot' },
        { id: 'features', title: t.sections.features.title, icon: 'fa-star' },
        { id: 'troubleshooting', title: t.sections.troubleshooting.title, icon: 'fa-tools' },
        { id: 'faq', title: 'FAQ', icon: 'fa-question-circle' }
    ];

    return (
        <>
            <BaseHeader />

            <div 
                className="user-guide-page user-guide-compact-wrapper"
                style={{ '--header-height': `${headerHeight}px` }}
            >
                {/* Hero & Subnav Filter Coordinator Slot prevents layout shift and eliminates gap */}
                <div 
                    ref={slotRef}
                    className="guide-hero-slot"
                    style={{ 
                        '--header-height': `${headerHeight}px`,
                        minHeight: isScrolled ? `${slotHeight}px` : 'auto'
                    }}
                >
                    {/* Compact Hero Header with Sticky Scroll Behavior */}
                    <div className={`guide-hero no-print ${isScrolled ? 'is-stuck' : ''}`}>
                        <div className="container">
                            <div className="guide-hero-inner">
                                <div className="hero-top-row">
                                    <div className="hero-branding">
                                        <div className="hero-badge">
                                            <i className="fas fa-shield-alt text-teal me-1"></i>
                                            <span>LMSetjen DPD RI • Dokumentasi Resmi</span>
                                            <span className="badge-dot"></span>
                                            <span className="badge-version">{liveVersion ? `v${liveVersion}` : t.version}</span>
                                        </div>
                                        <h1 className="hero-title">
                                            <i className="fas fa-book-reader me-2"></i>
                                            {t.pageTitle}
                                        </h1>
                                        <p className="hero-subtitle">{t.pageSubtitle}</p>
                                    </div>

                                    <div className="hero-actions">
                                        <div className="language-selector-wrap">
                                            <select
                                                className="form-select form-select-sm language-selector-compact"
                                                value={language}
                                                onChange={(e) => setLanguage(e.target.value)}
                                                aria-label={t.language}
                                            >
                                                <option value="id">🇮🇩 Bahasa Indonesia</option>
                                                <option value="en">🇬🇧 English</option>
                                            </select>
                                        </div>
                                        <button onClick={handlePrint} className="btn-export-compact" title={t.exportPdf}>
                                            <i className="fas fa-print me-1"></i>
                                            <span>{t.exportPdf}</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Integrated Compact Search Bar */}
                                <div className="hero-search-wrapper">
                                    <div className="hero-search-box">
                                        <i className="fas fa-search search-icon"></i>
                                        <input
                                            type="text"
                                            className="search-input"
                                            placeholder={language === 'en' ? 'Search topics, features, steps, or questions...' : 'Cari topik panduan, fitur, langkah, atau pertanyaan...'}
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                        {searchQuery && (
                                            <button
                                                type="button"
                                                className="clear-search-btn"
                                                onClick={() => setSearchQuery('')}
                                                title="Clear search"
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        )}
                                    </div>
                                    <div className="hero-quick-meta">
                                        <span className="quick-meta-pill">
                                            <i className="fas fa-book-open me-1"></i> 7 {language === 'en' ? 'Guide Topics' : 'Topik Panduan'}
                                        </span>
                                        <span className="quick-meta-pill">
                                            <i className="fas fa-user-check me-1"></i> {language === 'en' ? 'Students, Instructors & Admins' : 'Peserta, Instruktur & Admin'}
                                        </span>
                                        <span className="quick-meta-pill">
                                            <i className="fas fa-calendar-check me-1"></i> {t.lastUpdated}: {liveVersion ? `v${liveVersion}` : 'v1.1.0'} (Nov 2026)
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sticky Subnav Filter Bar (Compact Tabs) locked directly under guide-hero without gap */}
                    <div className={`guide-filter-strip no-print ${isScrolled ? 'is-stuck' : ''}`}>
                        <div className="container">
                            <div className="filter-pills-scroll">
                                {tabList.map(tab => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        className={`filter-pill-btn ${activeTab === tab.id ? 'active' : ''}`}
                                        onClick={() => {
                                            setActiveTab(tab.id);
                                            if (tab.id !== 'all') {
                                                scrollToSection(tab.id);
                                            }
                                        }}
                                    >
                                        <i className={`fas ${tab.icon} me-1`}></i>
                                        <span>{tab.title}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Area with Frosted Veil Overlay */}
                <div className="guide-content-section">
                    <div className="guide-background-pattern" aria-hidden="true"></div>
                    <div className="container guide-main-container">
                    <div className="guide-layout-row">
                        {/* Desktop Sticky Left Sidebar (Navigation TOC) */}
                        <aside className="guide-sidebar-col no-print">
                            <div className="sticky-guide-sidebar">
                                <div className="sidebar-toc-card">
                                    <div className="sidebar-toc-header">
                                        <i className="fas fa-compass me-2"></i>
                                        <span>{t.tableOfContents.title}</span>
                                    </div>
                                    <nav className="sidebar-nav-list">
                                        {t.tableOfContents.items.map(item => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                className={`sidebar-nav-link ${activeSection === item.id ? 'active' : ''}`}
                                                onClick={() => {
                                                    setActiveTab('all');
                                                    scrollToSection(item.id);
                                                }}
                                            >
                                                <i className={`fas ${item.icon} nav-icon`}></i>
                                                <span className="nav-text">{item.title}</span>
                                                <i className="fas fa-chevron-right nav-arrow"></i>
                                            </button>
                                        ))}
                                    </nav>
                                </div>

                                {/* Compact Help Card */}
                                <div className="sidebar-help-card">
                                    <div className="help-icon-circle">
                                        <i className="fas fa-headset"></i>
                                    </div>
                                    <div className="help-content">
                                        <h6>{language === 'en' ? 'Need More Help?' : 'Butuh Bantuan Lain?'}</h6>
                                        <p>{language === 'en' ? 'Contact our technical support team for assistance.' : 'Hubungi tim dukungan teknis Sekretariat Jenderal DPD RI.'}</p>
                                        <Link to="/contact/" className="btn-help-link">
                                            <i className="fas fa-envelope me-1"></i>
                                            <span>{language === 'en' ? 'Contact Support' : 'Hubungi Kami'}</span>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </aside>

                        {/* Guide Content Column */}
                        <main className="guide-content-col">
                            {searchQuery && (
                                <div className="search-status-banner mb-3">
                                    <div className="d-flex align-items-center justify-content-between">
                                        <div>
                                            <i className="fas fa-filter text-teal me-2"></i>
                                            <span>{language === 'en' ? 'Showing search results for:' : 'Menampilkan hasil pencarian untuk:'} <strong>"{searchQuery}"</strong></span>
                                        </div>
                                        <button className="btn btn-sm btn-link text-decoration-none text-teal" onClick={() => setSearchQuery('')}>
                                            {language === 'en' ? 'Reset search' : 'Reset pencarian'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="guide-sections-wrapper">
                                {/* SECTION 1: Getting Started */}
                                {shouldShowSection('getting-started') && (
                                    <section id="getting-started" className="guide-card-section">
                                        <div className="section-header-compact">
                                            <div className="section-header-left">
                                                <div className="section-icon-badge">
                                                    <i className="fas fa-rocket"></i>
                                                </div>
                                                <div>
                                                    <h2 className="section-title-compact">{t.sections.gettingStarted.title}</h2>
                                                    <p className="section-desc-compact">{t.sections.gettingStarted.intro}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Side by side Registration & Login */}
                                        <div className="row g-3 mb-3">
                                            <div className="col-md-6">
                                                <div className="subcard-compact h-100">
                                                    <div className="subcard-header">
                                                        <i className="fas fa-user-plus subcard-icon text-teal"></i>
                                                        <h3>{t.sections.gettingStarted.registration.title}</h3>
                                                    </div>
                                                    <ul className="compact-stepper">
                                                        {t.sections.gettingStarted.registration.steps.map((step, idx) => (
                                                            <li key={idx} className="stepper-item">
                                                                <span className="step-num">{idx + 1}</span>
                                                                <span className="step-text">{step}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>

                                            <div className="col-md-6">
                                                <div className="subcard-compact h-100">
                                                    <div className="subcard-header">
                                                        <i className="fas fa-sign-in-alt subcard-icon text-teal"></i>
                                                        <h3>{t.sections.gettingStarted.login.title}</h3>
                                                    </div>
                                                    <ul className="compact-stepper">
                                                        {t.sections.gettingStarted.login.steps.map((step, idx) => (
                                                            <li key={idx} className="stepper-item">
                                                                <span className="step-num">{idx + 1}</span>
                                                                <span className="step-text">{step}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Dashboard Navigation Cards */}
                                        <div className="subcard-compact">
                                            <div className="subcard-header">
                                                <i className="fas fa-compass subcard-icon text-teal"></i>
                                                <div>
                                                    <h3 className="mb-0">{t.sections.gettingStarted.navigation.title}</h3>
                                                    <p className="subcard-subtext mb-0">{t.sections.gettingStarted.navigation.description}</p>
                                                </div>
                                            </div>
                                            <div className="row g-2 mt-1">
                                                {t.sections.gettingStarted.navigation.dashboards.map((dash, idx) => (
                                                    <div key={idx} className="col-md-4">
                                                        <div className="dashboard-role-card">
                                                            <div className="role-top">
                                                                <span className="role-tag">{dash.role}</span>
                                                                <span className="role-icon-mini">
                                                                    <i className={dash.role.includes('Peserta') || dash.role.includes('Student') ? 'fas fa-graduation-cap' : dash.role.includes('Instruktur') || dash.role.includes('Instructor') ? 'fas fa-chalkboard-teacher' : 'fas fa-user-shield'}></i>
                                                                </span>
                                                            </div>
                                                            <code className="compact-path-code">{dash.path}</code>
                                                            <p className="role-desc">{dash.description}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </section>
                                )}

                                {/* SECTION 2: For Students */}
                                {shouldShowSection('for-students') && (
                                    <section id="for-students" className="guide-card-section">
                                        <div className="section-header-compact">
                                            <div className="section-header-left">
                                                <div className="section-icon-badge">
                                                    <i className="fas fa-graduation-cap"></i>
                                                </div>
                                                <div>
                                                    <h2 className="section-title-compact">{t.sections.forStudents.title}</h2>
                                                    <p className="section-desc-compact">{t.sections.forStudents.subtitle}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Browsing & Enrolling in 2-col */}
                                        <div className="row g-3 mb-3">
                                            <div className="col-md-6">
                                                <div className="subcard-compact h-100">
                                                    <div className="subcard-header">
                                                        <i className="fas fa-search subcard-icon text-teal"></i>
                                                        <div>
                                                            <h3>{t.sections.forStudents.browsing.title}</h3>
                                                            <p className="subcard-subtext">{t.sections.forStudents.browsing.description}</p>
                                                        </div>
                                                    </div>
                                                    <ul className="compact-check-list">
                                                        {t.sections.forStudents.browsing.steps.map((step, idx) => (
                                                            <li key={idx}>
                                                                <i className="fas fa-check-circle text-teal me-2"></i>
                                                                <span>{step}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>

                                            <div className="col-md-6">
                                                <div className="subcard-compact h-100">
                                                    <div className="subcard-header">
                                                        <i className="fas fa-pen-fancy subcard-icon text-teal"></i>
                                                        <h3>{t.sections.forStudents.enrolling.title}</h3>
                                                    </div>
                                                    <ul className="compact-stepper">
                                                        {t.sections.forStudents.enrolling.steps.map((step, idx) => (
                                                            <li key={idx} className="stepper-item">
                                                                <span className="step-num">{idx + 1}</span>
                                                                <span className="step-text">{step}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Taking a Course Feature Grid */}
                                        <div className="subcard-compact mb-3">
                                            <div className="subcard-header">
                                                <i className="fas fa-book-open subcard-icon text-teal"></i>
                                                <h3>{t.sections.forStudents.learning.title}</h3>
                                            </div>
                                            <div className="row g-2">
                                                {t.sections.forStudents.learning.features.map((feature, idx) => (
                                                    <div key={idx} className="col-md-4 col-sm-6">
                                                        <div className="mini-feature-card">
                                                            <div className="mini-feature-title">
                                                                <i className="fas fa-check text-teal me-1"></i>
                                                                <strong>{feature.name}</strong>
                                                            </div>
                                                            <p className="mini-feature-desc">{feature.description}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Interaction & Certificates Side by Side */}
                                        <div className="row g-3">
                                            <div className="col-md-6">
                                                <div className="subcard-compact h-100">
                                                    <div className="subcard-header">
                                                        <i className="fas fa-comments subcard-icon text-teal"></i>
                                                        <h3>{t.sections.forStudents.interaction.title}</h3>
                                                    </div>
                                                    <ul className="compact-check-list">
                                                        {t.sections.forStudents.interaction.features.map((feat, idx) => (
                                                            <li key={idx}>
                                                                <i className="fas fa-arrow-right text-teal me-2"></i>
                                                                <span>{feat}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>

                                            <div className="col-md-6">
                                                <div className="subcard-compact h-100 highlight-box-teal">
                                                    <div className="subcard-header">
                                                        <i className="fas fa-certificate subcard-icon text-teal"></i>
                                                        <div>
                                                            <h3>{t.sections.forStudents.certificates.title}</h3>
                                                            <span className="badge bg-teal-subtle text-teal">{language === 'en' ? 'Certificate Criteria' : 'Syarat Sertifikat'}</span>
                                                        </div>
                                                    </div>
                                                    <ul className="compact-stepper stepper-teal">
                                                        {t.sections.forStudents.certificates.requirements.map((req, idx) => (
                                                            <li key={idx} className="stepper-item">
                                                                <span className="step-num"><i className="fas fa-award"></i></span>
                                                                <span className="step-text">{req}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                )}

                                {/* SECTION 3: For Instructors */}
                                {shouldShowSection('for-instructors') && (
                                    <section id="for-instructors" className="guide-card-section">
                                        <div className="section-header-compact">
                                            <div className="section-header-left">
                                                <div className="section-icon-badge">
                                                    <i className="fas fa-chalkboard-teacher"></i>
                                                </div>
                                                <div>
                                                    <h2 className="section-title-compact">{t.sections.forInstructors.title}</h2>
                                                    <p className="section-desc-compact">{t.sections.forInstructors.subtitle}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Course Creation & Curriculum Workflow */}
                                        <div className="row g-3 mb-3">
                                            <div className="col-md-6">
                                                <div className="subcard-compact h-100">
                                                    <div className="subcard-header">
                                                        <i className="fas fa-plus-circle subcard-icon text-teal"></i>
                                                        <h3>{t.sections.forInstructors.creatingCourse.title}</h3>
                                                    </div>
                                                    <ul className="compact-stepper">
                                                        {t.sections.forInstructors.creatingCourse.steps.map((step, idx) => (
                                                            <li key={idx} className="stepper-item">
                                                                <span className="step-num">{idx + 1}</span>
                                                                <span className="step-text">{step}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>

                                            <div className="col-md-6">
                                                <div className="subcard-compact h-100">
                                                    <div className="subcard-header">
                                                        <i className="fas fa-layer-group subcard-icon text-teal"></i>
                                                        <div>
                                                            <h3>{t.sections.forInstructors.curriculum.title}</h3>
                                                            <p className="subcard-subtext">{t.sections.forInstructors.curriculum.description}</p>
                                                        </div>
                                                    </div>
                                                    <ul className="compact-stepper">
                                                        {t.sections.forInstructors.curriculum.steps.map((step, idx) => (
                                                            <li key={idx} className="stepper-item">
                                                                <span className="step-num">{idx + 1}</span>
                                                                <span className="step-text">{step}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Quizzes & Publishing Requirements */}
                                        <div className="row g-3 mb-3">
                                            <div className="col-md-6">
                                                <div className="subcard-compact h-100">
                                                    <div className="subcard-header">
                                                        <i className="fas fa-question-circle subcard-icon text-teal"></i>
                                                        <h3>{t.sections.forInstructors.quizzes.title}</h3>
                                                    </div>
                                                    <ul className="compact-stepper">
                                                        {t.sections.forInstructors.quizzes.steps.map((step, idx) => (
                                                            <li key={idx} className="stepper-item">
                                                                <span className="step-num">{idx + 1}</span>
                                                                <span className="step-text">{step}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>

                                            <div className="col-md-6">
                                                <div className="subcard-compact h-100 highlight-box-amber">
                                                    <div className="subcard-header">
                                                        <i className="fas fa-globe subcard-icon text-amber"></i>
                                                        <div>
                                                            <h3>{t.sections.forInstructors.publishing.title}</h3>
                                                            <span className="badge bg-warning-subtle text-dark">{language === 'en' ? 'Checklist' : 'Kriteria Rilis'}</span>
                                                        </div>
                                                    </div>
                                                    <ul className="compact-check-list">
                                                        {t.sections.forInstructors.publishing.requirements.map((req, idx) => (
                                                            <li key={idx}>
                                                                <i className="fas fa-check text-amber me-2"></i>
                                                                <span>{req}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Management Features */}
                                        <div className="subcard-compact">
                                            <div className="subcard-header">
                                                <i className="fas fa-users-cog subcard-icon text-teal"></i>
                                                <h3>{t.sections.forInstructors.management.title}</h3>
                                            </div>
                                            <div className="row g-2">
                                                {t.sections.forInstructors.management.features.map((feat, idx) => (
                                                    <div key={idx} className="col-md-6">
                                                        <div className="mini-badge-row">
                                                            <i className="fas fa-check-circle text-teal me-2"></i>
                                                            <span>{feat}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </section>
                                )}

                                {/* SECTION: Manta AI (Flagship Assistant) */}
                                {shouldShowSection('manta-ai') && t.sections.mantaAi && (
                                    <section id="manta-ai" className="guide-card-section">
                                        <div className="section-header-compact">
                                            <div className="section-header-left">
                                                <div className="section-icon-badge" style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0284c7 100%)', color: '#fff' }}>
                                                    <i className="fas fa-robot"></i>
                                                </div>
                                                <div>
                                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                                        <h2 className="section-title-compact mb-0">{t.sections.mantaAi.title}</h2>
                                                        <span className="badge bg-teal-subtle text-teal">
                                                            <i className="fas fa-sparkles me-1"></i> {language === 'en' ? 'Flagship AI Feature v1.1.0' : 'Fitur Unggulan v1.1.0'}
                                                        </span>
                                                    </div>
                                                    <p className="section-desc-compact">{t.sections.mantaAi.subtitle}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Intro description */}
                                        <div className="subcard-compact mb-3" style={{ background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.06) 0%, rgba(2, 132, 199, 0.06) 100%)', border: '1px solid rgba(13, 148, 136, 0.2)' }}>
                                            <p className="mb-0 text-secondary" style={{ lineHeight: '1.65' }}>
                                                {t.sections.mantaAi.description}
                                            </p>
                                        </div>

                                        {/* Capabilities Grid */}
                                        <div className="row g-3 mb-3">
                                            {t.sections.mantaAi.capabilities.map((cap, idx) => (
                                                <div key={idx} className="col-md-4 col-sm-6">
                                                    <div className="subcard-compact h-100">
                                                        <div className="subcard-header">
                                                            <i className={`fas ${cap.icon} subcard-icon text-teal`}></i>
                                                            <h3 style={{ fontSize: '0.98rem' }}>{cap.title}</h3>
                                                        </div>
                                                        <p className="subcard-subtext mb-0" style={{ fontSize: '0.85rem', lineHeight: '1.55' }}>
                                                            {cap.description}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* How to Use Manta AI */}
                                        <div className="subcard-compact highlight-box-teal">
                                            <div className="subcard-header">
                                                <i className="fas fa-lightbulb subcard-icon text-teal"></i>
                                                <div>
                                                    <h3>{language === 'en' ? 'How to Interact with Manta AI' : 'Cara Menggunakan Manta AI'}</h3>
                                                    <p className="subcard-subtext mb-0">{language === 'en' ? 'Easy steps to communicate with your AI learning tutor' : 'Langkah praktis berinteraksi dengan asisten belajar cerdas Anda'}</p>
                                                </div>
                                            </div>
                                            <ul className="compact-stepper stepper-teal mt-2">
                                                {t.sections.mantaAi.howToUse.map((step, idx) => (
                                                    <li key={idx} className="stepper-item">
                                                        <span className="step-num">{idx + 1}</span>
                                                        <span className="step-text">{step}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </section>
                                )}

                                {/* SECTION 4: Platform Features */}
                                {shouldShowSection('features') && (
                                    <section id="features" className="guide-card-section">
                                        <div className="section-header-compact">
                                            <div className="section-header-left">
                                                <div className="section-icon-badge">
                                                    <i className="fas fa-star"></i>
                                                </div>
                                                <div>
                                                    <h2 className="section-title-compact">{t.sections.features.title}</h2>
                                                    <p className="section-desc-compact">{t.sections.features.subtitle}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="row g-3">
                                            {/* Feature 1: Dashboard */}
                                            <div className="col-md-6 col-lg-4">
                                                <div className="feature-grid-item h-100">
                                                    <div className="feature-icon-bubble">
                                                        <i className="fas fa-tachometer-alt"></i>
                                                    </div>
                                                    <h4>{t.sections.features.dashboard.title}</h4>
                                                    <p className="feature-item-desc">{t.sections.features.dashboard.description}</p>
                                                    <ul className="feature-compact-list">
                                                        {t.sections.features.dashboard.items.map((item, idx) => (
                                                            <li key={idx}><i className="fas fa-angle-right me-1 text-teal"></i>{item}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>

                                            {/* Feature 2: Search */}
                                            <div className="col-md-6 col-lg-4">
                                                <div className="feature-grid-item h-100">
                                                    <div className="feature-icon-bubble">
                                                        <i className="fas fa-search-plus"></i>
                                                    </div>
                                                    <h4>{t.sections.features.search.title}</h4>
                                                    <p className="feature-item-desc">{t.sections.features.search.description}</p>
                                                    <ul className="feature-compact-list">
                                                        {t.sections.features.search.items.map((item, idx) => (
                                                            <li key={idx}><i className="fas fa-angle-right me-1 text-teal"></i>{item}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>

                                            {/* Feature 3: Video Player */}
                                            <div className="col-md-6 col-lg-4">
                                                <div className="feature-grid-item h-100">
                                                    <div className="feature-icon-bubble">
                                                        <i className="fas fa-play-circle"></i>
                                                    </div>
                                                    <h4>{t.sections.features.videoPlayer.title}</h4>
                                                    <p className="feature-item-desc">{t.sections.features.videoPlayer.description}</p>
                                                    <ul className="feature-compact-list">
                                                        {t.sections.features.videoPlayer.features.map((item, idx) => (
                                                            <li key={idx}><i className="fas fa-angle-right me-1 text-teal"></i>{item}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>

                                            {/* Feature 4: QA */}
                                            <div className="col-md-6 col-lg-6">
                                                <div className="feature-grid-item h-100">
                                                    <div className="feature-icon-bubble">
                                                        <i className="fas fa-question-circle"></i>
                                                    </div>
                                                    <h4>{t.sections.features.qa.title}</h4>
                                                    <p className="feature-item-desc">{t.sections.features.qa.description}</p>
                                                    <ul className="feature-compact-list">
                                                        {t.sections.features.qa.features.map((item, idx) => (
                                                            <li key={idx}><i className="fas fa-angle-right me-1 text-teal"></i>{item}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>

                                            {/* Feature 5: Profile */}
                                            <div className="col-md-12 col-lg-6">
                                                <div className="feature-grid-item h-100">
                                                    <div className="feature-icon-bubble">
                                                        <i className="fas fa-user-circle"></i>
                                                    </div>
                                                    <h4>{t.sections.features.profile.title}</h4>
                                                    <p className="feature-item-desc">{t.sections.features.profile.description}</p>
                                                    <ul className="feature-compact-list">
                                                        {t.sections.features.profile.options.map((item, idx) => (
                                                            <li key={idx}><i className="fas fa-angle-right me-1 text-teal"></i>{item}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                )}

                                {/* SECTION 5: Troubleshooting (Accordion) */}
                                {shouldShowSection('troubleshooting') && (
                                    <section id="troubleshooting" className="guide-card-section">
                                        <div className="section-header-compact">
                                            <div className="section-header-left">
                                                <div className="section-icon-badge text-amber bg-amber-subtle">
                                                    <i className="fas fa-tools"></i>
                                                </div>
                                                <div>
                                                    <h2 className="section-title-compact">{t.sections.troubleshooting.title}</h2>
                                                    <p className="section-desc-compact">{t.sections.troubleshooting.subtitle}</p>
                                                </div>
                                            </div>
                                            <div className="section-header-right">
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary"
                                                    onClick={() => toggleAllTrouble(true)}
                                                >
                                                    <i className="fas fa-expand-alt me-1"></i>
                                                    {language === 'en' ? 'Expand All' : 'Buka Semua'}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary ms-1"
                                                    onClick={() => toggleAllTrouble(false)}
                                                >
                                                    <i className="fas fa-compress-alt me-1"></i>
                                                    {language === 'en' ? 'Collapse All' : 'Tutup Semua'}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="trouble-accordion">
                                            {filteredTrouble.map((issue, idx) => {
                                                const isOpen = Boolean(openTrouble[idx]);
                                                return (
                                                    <div key={idx} className={`trouble-accordion-item ${isOpen ? 'open' : ''}`}>
                                                        <button
                                                            type="button"
                                                            className="trouble-accordion-header"
                                                            onClick={() => toggleTrouble(idx)}
                                                            aria-expanded={isOpen}
                                                        >
                                                            <div className="header-left">
                                                                <span className="trouble-badge-icon">
                                                                    <i className="fas fa-exclamation-triangle"></i>
                                                                </span>
                                                                <span className="trouble-title-text">{issue.problem}</span>
                                                            </div>
                                                            <span className="accordion-arrow">
                                                                <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`}></i>
                                                            </span>
                                                        </button>
                                                        {isOpen && (
                                                            <div className="trouble-accordion-body">
                                                                <div className="trouble-solutions-title">
                                                                    <i className="fas fa-wrench me-1 text-teal"></i>
                                                                    {language === 'en' ? 'Recommended Solutions:' : 'Langkah Solusi Disarankan:'}
                                                                </div>
                                                                <ul className="trouble-solutions-list">
                                                                    {issue.solutions.map((sol, sIdx) => (
                                                                        <li key={sIdx}>
                                                                            <i className="fas fa-check text-success me-2"></i>
                                                                            <span>{sol}</span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                )}

                                {/* SECTION 6: FAQ (Accordion) */}
                                {shouldShowSection('faq') && (
                                    <section id="faq" className="guide-card-section">
                                        <div className="section-header-compact">
                                            <div className="section-header-left">
                                                <div className="section-icon-badge">
                                                    <i className="fas fa-question-circle"></i>
                                                </div>
                                                <div>
                                                    <h2 className="section-title-compact">{t.sections.faq.title}</h2>
                                                    <p className="section-desc-compact">
                                                        {language === 'en'
                                                            ? 'Find quick answers to common questions about the platform.'
                                                            : 'Temukan jawaban cepat untuk pertanyaan yang sering diajukan seputar platform.'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="section-header-right">
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary"
                                                    onClick={() => toggleAllFaq(true)}
                                                >
                                                    <i className="fas fa-expand-alt me-1"></i>
                                                    {language === 'en' ? 'Expand All' : 'Buka Semua'}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary ms-1"
                                                    onClick={() => toggleAllFaq(false)}
                                                >
                                                    <i className="fas fa-compress-alt me-1"></i>
                                                    {language === 'en' ? 'Collapse All' : 'Tutup Semua'}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="faq-accordion-list">
                                            {filteredFaq.map((item, idx) => {
                                                const isOpen = Boolean(openFaq[idx]);
                                                return (
                                                    <div key={idx} className={`faq-accordion-item ${isOpen ? 'open' : ''}`}>
                                                        <button
                                                            type="button"
                                                            className="faq-accordion-header"
                                                            onClick={() => toggleFaq(idx)}
                                                            aria-expanded={isOpen}
                                                        >
                                                            <div className="faq-q-left">
                                                                <span className="faq-q-badge">Q</span>
                                                                <span className="faq-q-text">{item.q}</span>
                                                            </div>
                                                            <span className="accordion-arrow">
                                                                <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`}></i>
                                                            </span>
                                                        </button>
                                                        {isOpen && (
                                                            <div className="faq-accordion-body">
                                                                <div className="faq-a-badge">A</div>
                                                                <p className="faq-a-text mb-0">{item.a}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                )}
                            </div>
                        </main>
                    </div>
                </div>
                </div>
            </div>

            <Footer />
        </>
    );
}

export default UserGuide;
