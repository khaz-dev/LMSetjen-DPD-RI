import React from "react";
import { Link, useLocation } from "react-router-dom";
import { logout } from "../../../utils/auth";
import Toast, { LogoutConfirmation } from "../../plugin/Toast";

function Sidebar() {
    const location = useLocation();
    
    // Check if current path is active
    const isActive = (path) => {
        return location.pathname === path || location.pathname.startsWith(path);
    };

    const handleLogout = () => {
        LogoutConfirmation().then((result) => {
            if (result.isConfirmed) {
                // Show enhanced success toast
                Toast().fire({
                    icon: "success",
                    title: "Logout Berhasil! Terima kasih telah menggunakan platform kami.",
                });
                
                // Small delay for better UX
                setTimeout(() => {
                    logout();
                }, 1500);
            }
        });
    };

    return (
        <>
            <style>
                {`
                    /* Modern Toast Styles */
                    .modern-toast {
                        border-radius: 15px !important;
                        box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15) !important;
                        border: 1px solid rgba(255, 255, 255, 0.2) !important;
                        backdrop-filter: blur(15px) !important;
                        font-family: 'Inter', sans-serif !important;
                    }
                    
                    .modern-progress-bar {
                        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%) !important;
                        border-radius: 0 0 15px 15px !important;
                        height: 4px !important;
                    }
                    
                    /* Modern Logout Dialog Styles */
                    .modern-logout-dialog {
                        border-radius: 20px !important;
                        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25) !important;
                        border: 1px solid rgba(255, 255, 255, 0.2) !important;
                        backdrop-filter: blur(15px) !important;
                        font-family: 'Inter', sans-serif !important;
                        padding: 2rem !important;
                    }
                    
                    .modern-confirm-btn {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
                        border: none !important;
                        border-radius: 12px !important;
                        padding: 12px 24px !important;
                        font-weight: 600 !important;
                        font-size: 0.95rem !important;
                        color: white !important;
                        transition: all 0.3s ease !important;
                        margin: 0 8px !important;
                        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3) !important;
                    }
                    
                    .modern-confirm-btn:hover {
                        transform: translateY(-2px) !important;
                        box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4) !important;
                        background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%) !important;
                    }
                    
                    .modern-cancel-btn {
                        background: transparent !important;
                        border: 2px solid #e53e3e !important;
                        border-radius: 12px !important;
                        padding: 10px 24px !important;
                        font-weight: 600 !important;
                        font-size: 0.95rem !important;
                        color: #e53e3e !important;
                        transition: all 0.3s ease !important;
                        margin: 0 8px !important;
                    }
                    
                    .modern-cancel-btn:hover {
                        background: #e53e3e !important;
                        color: white !important;
                        transform: translateY(-2px) !important;
                        box-shadow: 0 5px 15px rgba(229, 62, 62, 0.3) !important;
                    }
                    
                    .instructor-sidebar {
                        background: white;
                        border-radius: 16px;
                        box-shadow: 0 8px 30px rgba(52, 152, 219, 0.12);
                        border: 1px solid rgba(52, 152, 219, 0.08);
                        overflow: hidden;
                        position: sticky;
                        top: 90px;
                        z-index: 100;
                        transition: box-shadow 0.3s ease;
                        max-height: calc(100vh - 110px);
                        overflow-y: auto;
                    }
                    
                    .instructor-sidebar:hover {
                        box-shadow: 0 12px 40px rgba(52, 152, 219, 0.18);
                    }
                    
                    .instructor-sidebar-header {
                        background: linear-gradient(135deg, #3498db 0%, #2980b9 50%, #34495e 100%);
                        color: white;
                        padding: 1.5rem;
                        text-align: center;
                        position: relative;
                        overflow: hidden;
                    }
                    
                    .instructor-sidebar-header::before {
                        content: '';
                        position: absolute;
                        top: -50%;
                        right: -20%;
                        width: 60%;
                        height: 200%;
                        background: linear-gradient(45deg, rgba(255, 255, 255, 0.1), transparent);
                        transform: rotate(-15deg);
                    }
                    
                    .sidebar-content {
                        padding: 1.25rem;
                    }
                    
                    .nav-section-title {
                        font-size: 0.75rem;
                        font-weight: 600;
                        color: #34495e;
                        text-transform: uppercase;
                        letter-spacing: 0.8px;
                        margin-bottom: 0.75rem;
                        margin-top: 1.25rem;
                        padding-left: 0.5rem;
                    }
                    
                    .nav-section-title:first-child {
                        margin-top: 0;
                    }
                    
                    .instructor-nav-link {
                        display: flex;
                        align-items: center;
                        padding: 0.875rem 1rem;
                        color: #4a5568;
                        text-decoration: none;
                        border-radius: 10px;
                        margin-bottom: 0.25rem;
                        transition: all 0.3s ease;
                        font-weight: 500;
                        position: relative;
                        font-size: 0.9rem;
                        overflow: hidden;
                    }
                    
                    .instructor-nav-link::before {
                        content: '';
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 0;
                        height: 100%;
                        background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
                        transition: width 0.3s ease;
                        z-index: 0;
                    }
                    
                    .instructor-nav-link > * {
                        position: relative;
                        z-index: 1;
                    }
                    
                    .instructor-nav-link:hover {
                        color: white;
                        transform: translateX(4px);
                        box-shadow: 0 5px 15px rgba(52, 152, 219, 0.3);
                    }
                    
                    .instructor-nav-link:hover::before {
                        width: 100%;
                    }
                    
                    .instructor-nav-link.active {
                        background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
                        color: white;
                        transform: translateX(4px);
                        box-shadow: 0 8px 20px rgba(52, 152, 219, 0.4);
                    }
                    
                    .instructor-nav-link.active::before {
                        width: 100%;
                    }
                    
                    .instructor-nav-icon {
                        width: 18px;
                        height: 18px;
                        margin-right: 0.75rem;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 0.9rem;
                        transition: all 0.3s ease;
                    }
                    
                    .instructor-nav-link:hover .instructor-nav-icon,
                    .instructor-nav-link.active .instructor-nav-icon {
                        transform: scale(1.1);
                    }
                    
                    .instructor-logout-btn {
                        background: transparent;
                        border: 1.5px solid #e74c3c;
                        color: #e74c3c;
                        width: 100%;
                        margin-top: 1rem;
                        transition: all 0.3s ease;
                        border-radius: 10px;
                        padding: 0.875rem 1rem;
                        font-weight: 500;
                        font-size: 0.9rem;
                        display: flex;
                        align-items: center;
                        cursor: pointer;
                        position: relative;
                        overflow: hidden;
                    }
                    
                    .instructor-logout-btn::before {
                        content: '';
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 0;
                        height: 100%;
                        background: #e74c3c;
                        transition: width 0.3s ease;
                        z-index: 0;
                    }
                    
                    .instructor-logout-btn > * {
                        position: relative;
                        z-index: 1;
                    }
                    
                    .instructor-logout-btn:hover {
                        color: white;
                        transform: translateY(-2px);
                        box-shadow: 0 5px 15px rgba(231, 76, 60, 0.3);
                    }
                    
                    .instructor-logout-btn:hover::before {
                        width: 100%;
                    }
                    
                    .instructor-mobile-toggle {
                        background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
                        border: none;
                        color: white;
                        border-radius: 10px;
                        padding: 0.875rem;
                        margin: 1rem;
                        transition: all 0.25s ease;
                        font-weight: 500;
                    }
                    
                    .instructor-mobile-toggle:hover {
                        transform: translateY(-1px);
                        box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
                    }
                    
                    .instructor-divider {
                        height: 1px;
                        background: linear-gradient(90deg, transparent 0%, rgba(52, 152, 219, 0.15) 50%, transparent 100%);
                        margin: 1rem 0;
                    }
                    
                    @media (max-width: 768px) {
                        .instructor-sidebar {
                            border-radius: 12px;
                            margin-bottom: 1.5rem;
                        }
                        
                        .instructor-sidebar-header {
                            padding: 1.25rem;
                        }
                        
                        .sidebar-content {
                            padding: 1rem;
                        }
                        
                        .instructor-nav-link {
                            padding: 0.75rem 0.875rem;
                        }
                    }
                `}
            </style>
            
            <div className="col-lg-3 col-md-4 col-12">
                <nav className="instructor-sidebar">
                    {/* Mobile Header */}
                    <div className="d-md-none">
                        <div className="instructor-sidebar-header">
                            <h6 className="mb-0 fw-bold">Instructor Panel</h6>
                            <p className="mb-0 opacity-90 small">Manage your courses</p>
                        </div>
                        <button
                            className="instructor-mobile-toggle w-100"
                            type="button"
                            data-bs-toggle="collapse"
                            data-bs-target="#instructorSidenav"
                            aria-controls="instructorSidenav"
                            aria-expanded="false"
                            aria-label="Toggle navigation"
                        >
                            <i className="bi bi-grid me-2"></i>Menu
                        </button>
                    </div>

                    {/* Desktop Header */}
                    <div className="d-none d-md-block instructor-sidebar-header">
                        <h5 className="mb-1 fw-bold">Instructor Dashboard</h5>
                        <p className="mb-0 opacity-90 small">Manage courses & students</p>
                    </div>

                    <div className="collapse navbar-collapse show" id="instructorSidenav">
                        <div className="sidebar-content">
                            {/* Main Navigation */}
                            <div className="nav-section-title">Course Management</div>
                            <div className="d-flex flex-column">
                                <Link 
                                    className={`instructor-nav-link ${isActive('/instructor/dashboard') ? 'active' : ''}`} 
                                    to="/instructor/dashboard/"
                                >
                                    <div className="instructor-nav-icon">
                                        <i className="bi bi-grid-fill"></i>
                                    </div>
                                    <span>Dashboard</span>
                                </Link>
                                
                                <Link 
                                    className={`instructor-nav-link ${isActive('/instructor/courses') ? 'active' : ''}`} 
                                    to="/instructor/courses/"
                                >
                                    <div className="instructor-nav-icon">
                                        <i className="fas fa-book-open"></i>
                                    </div>
                                    <span>My Courses</span>
                                </Link>
                                
                                <Link 
                                    className={`instructor-nav-link ${isActive('/instructor/create-course') ? 'active' : ''}`} 
                                    to="/instructor/create-course/"
                                >
                                    <div className="instructor-nav-icon">
                                        <i className="fas fa-plus-circle"></i>
                                    </div>
                                    <span>Create Course</span>
                                </Link>
                                
                                <Link 
                                    className={`instructor-nav-link ${isActive('/instructor/students') ? 'active' : ''}`} 
                                    to="/instructor/students/"
                                >
                                    <div className="instructor-nav-icon">
                                        <i className="fas fa-user-graduate"></i>
                                    </div>
                                    <span>Students</span>
                                </Link>
                                
                                <Link 
                                    className={`instructor-nav-link ${isActive('/instructor/reviews') ? 'active' : ''}`} 
                                    to="/instructor/reviews/"
                                >
                                    <div className="instructor-nav-icon">
                                        <i className="fas fa-star"></i>
                                    </div>
                                    <span>Reviews</span>
                                </Link>
                                
                                <Link 
                                    className={`instructor-nav-link ${isActive('/instructor/question-answer') ? 'active' : ''}`} 
                                    to="/instructor/question-answer/"
                                >
                                    <div className="instructor-nav-icon">
                                        <i className="fas fa-comments"></i>
                                    </div>
                                    <span>Q&A Forum</span>
                                </Link>
                                
                                <Link 
                                    className={`instructor-nav-link ${isActive('/instructor/notifications') ? 'active' : ''}`} 
                                    to="/instructor/notifications/"
                                >
                                    <div className="instructor-nav-icon">
                                        <i className="fas fa-bell"></i>
                                    </div>
                                    <span>Notifications</span>
                                </Link>
                            </div>

                            <div className="instructor-divider"></div>

                            {/* Account Settings */}
                            <div className="nav-section-title">Account Settings</div>
                            <div className="d-flex flex-column">
                                <Link 
                                    className={`instructor-nav-link ${isActive('/instructor/profile') ? 'active' : ''}`} 
                                    to="/instructor/profile/"
                                >
                                    <div className="instructor-nav-icon">
                                        <i className="fas fa-user-edit"></i>
                                    </div>
                                    <span>Edit Profile</span>
                                </Link>
                                
                                <Link 
                                    className={`instructor-nav-link ${isActive('/instructor/change-password') ? 'active' : ''}`} 
                                    to="/instructor/change-password/"
                                >
                                    <div className="instructor-nav-icon">
                                        <i className="fas fa-shield-alt"></i>
                                    </div>
                                    <span>Change Password</span>
                                </Link>
                            </div>

                            {/* Logout Button */}
                            <button 
                                onClick={handleLogout}
                                className="instructor-logout-btn"
                            >
                                <div className="instructor-nav-icon" style={{ marginRight: '0.75rem' }}>
                                    <i className="fas fa-sign-out-alt"></i>
                                </div>
                                <span>Sign Out</span>
                            </button>
                        </div>
                    </div>
                </nav>
            </div>
        </>
    );
}

export default Sidebar;