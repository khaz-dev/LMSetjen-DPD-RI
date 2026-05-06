import React from 'react';
import BaseHeader from '../../partials/BaseHeader';
import Footer from '../../partials/Footer';
import Header from './Header';
import Sidebar from './Sidebar';

/**
 * InstructorPageLoader Component
 * 
 * Provides a consistent, non-blocking loading state for all instructor pages.
 * Ensures perfect centering and consistent spacing across all screen sizes.
 * 
 * @param {string} message - Loading message to display (default: "Loading...")
 * @param {string} className - Optional additional class name for the section
 * 
 * @example
 * if (loading) {
 *     return <InstructorPageLoader message="Loading Dashboard..." />;
 * }
 */
function InstructorPageLoader({ message = "Loading...", className = "" }) {
    return (
        <>
            <BaseHeader />
            <section 
                className={className} 
                style={{ 
                    minHeight: 'calc(100vh - 120px)', 
                    display: 'flex', 
                    alignItems: 'center' 
                }}
            >
                <div className="container" style={{ flex: 1 }}>
                    <Header />
                    <div className="row mt-0">
                        <Sidebar />
                        <div 
                            className="col-lg-9 col-md-8 col-12" 
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                minHeight: '60vh' 
                            }}
                        >
                            <div className="text-center">
                                <div 
                                    className="spinner-border text-primary" 
                                    role="status" 
                                    style={{ 
                                        width: '3rem', 
                                        height: '3rem' 
                                    }}
                                >
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                                <p className="mt-3 text-muted">{message}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            <Footer />
        </>
    );
}

export default InstructorPageLoader;
