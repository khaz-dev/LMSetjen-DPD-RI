import { useState, useEffect } from "react";
import moment from "moment";

import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";

import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";

import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";

function TeacherNotification() {
    const [noti, setNoti] = useState([]);

    const fetchNoti = () => {
        useAxios.get(`teacher/noti-list/${UserData()?.teacher_id}/`).then((res) => {
            setNoti(res.data);
        });
    };

    useEffect(() => {
        fetchNoti();
    }, []);

    const handleMarkAsSeen = (notiId) => {
        const formdata = new FormData();

        formdata.append("teacher", UserData()?.teacher_id);
        formdata.append("pk", notiId);
        formdata.append("seen", true);

        useAxios.patch(`teacher/noti-detail/${UserData()?.teacher_id}/${notiId}`, formdata).then((res) => {
            fetchNoti();
            Toast().fire({
                icon: "success",
                title: "Notication Seen",
            });
        });
    };

    return (
        <>
            <BaseHeader />

            <section className="pt-5 pb-5" style={{ background: 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 50%, #ebebeb 100%)', minHeight: '100vh' }}>
                <div className="container">
                    {/* Header Here */}
                    <Header />
                    <div className="row mt-0 mt-md-4">
                        {/* Sidebar Here */}
                        <Sidebar />
                        <div className="col-lg-9 col-md-8 col-12">
                            {/* Modern Header Section */}
                            <div className="modern-header-section mb-4" style={{
                                background: 'rgba(255, 255, 255, 0.95)',
                                backdropFilter: 'blur(10px)',
                                borderRadius: '20px',
                                padding: '30px',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    top: '-50%',
                                    right: '-20%',
                                    width: '300px',
                                    height: '300px',
                                    background: 'linear-gradient(45deg, #3498db20, #2980b920)',
                                    borderRadius: '50%',
                                    zIndex: 1
                                }}></div>
                                <div className="d-flex align-items-center justify-content-between position-relative" style={{ zIndex: 2 }}>
                                    <div>
                                        <h1 className="mb-2" style={{
                                            background: 'linear-gradient(135deg, #3498db, #2980b9)',
                                            WebkitBackgroundClip: 'text',
                                            WebkitTextFillColor: 'transparent',
                                            fontSize: '2.5rem',
                                            fontWeight: 'bold'
                                        }}>
                                            <i className="fas fa-bell me-3"></i>Notifications
                                        </h1>
                                        <p className="mb-0 text-muted" style={{ fontSize: '1.1rem' }}>
                                            Stay updated with all your important alerts
                                        </p>
                                    </div>
                                    <div className="text-end">
                                        <div className="d-flex align-items-center gap-3">
                                            <div className="stat-badge" style={{
                                                background: 'linear-gradient(135deg, #dc3545, #fd7e14)',
                                                color: 'white',
                                                padding: '12px 20px',
                                                borderRadius: '15px',
                                                fontSize: '0.9rem',
                                                fontWeight: '600'
                                            }}>
                                                <i className="fas fa-exclamation-circle me-2"></i>
                                                {noti?.filter(n => !n.seen)?.length || 0} Unread
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Modern Notifications Container */}
                            <div className="modern-notifications-container">
                                {noti?.length > 0 ? (
                                    <div className="row g-4">
                                        {noti.map((n, index) => (
                                            <div key={n.id || index} className="col-12">
                                                <div className="modern-notification-card" style={{
                                                    background: 'rgba(255, 255, 255, 0.95)',
                                                    backdropFilter: 'blur(10px)',
                                                    borderRadius: '20px',
                                                    padding: '25px',
                                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                                                    transition: 'all 0.3s ease',
                                                    position: 'relative',
                                                    overflow: 'hidden',
                                                    borderLeft: n.seen ? '5px solid #28a745' : '5px solid #dc3545'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(-3px)';
                                                    e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.15)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                    e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
                                                }}
                                                >
                                                    <div className="d-flex align-items-start justify-content-between">
                                                        <div className="d-flex align-items-start">
                                                            <div className="notification-icon" style={{
                                                                width: '60px',
                                                                height: '60px',
                                                                borderRadius: '15px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                background: n.seen 
                                                                    ? 'linear-gradient(135deg, #28a745, #20c997)'
                                                                    : 'linear-gradient(135deg, #dc3545, #fd7e14)',
                                                                color: 'white',
                                                                fontSize: '1.5rem',
                                                                marginRight: '20px'
                                                            }}>
                                                                <i className={n.seen ? "fas fa-check-circle" : "fas fa-exclamation-triangle"}></i>
                                                            </div>
                                                            <div>
                                                                <div className="d-flex align-items-center mb-2">
                                                                    <h4 className="mb-0 me-3" style={{ 
                                                                        color: '#2c3e50',
                                                                        fontWeight: '600'
                                                                    }}>
                                                                        {n.type}
                                                                    </h4>
                                                                    {!n.seen && (
                                                                        <span className="badge" style={{
                                                                            background: 'linear-gradient(135deg, #dc3545, #fd7e14)',
                                                                            color: 'white',
                                                                            padding: '6px 12px',
                                                                            borderRadius: '10px',
                                                                            fontSize: '0.7rem',
                                                                            fontWeight: '600'
                                                                        }}>
                                                                            NEW
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="notification-content">
                                                                    <p className="mb-3 text-muted" style={{ fontSize: '0.95rem' }}>
                                                                        <i className="fas fa-calendar-alt me-2"></i>
                                                                        {moment(n.date).format("DD MMM, YYYY [at] HH:mm")}
                                                                    </p>
                                                                    {n.message && (
                                                                        <p className="mb-3" style={{ 
                                                                            color: '#2c3e50',
                                                                            lineHeight: '1.6'
                                                                        }}>
                                                                            {n.message}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="notification-actions">
                                                            {!n.seen && (
                                                                <button 
                                                                    className="btn modern-mark-btn" 
                                                                    onClick={() => handleMarkAsSeen(n.id)}
                                                                    style={{
                                                                        background: 'linear-gradient(135deg, #28a745, #20c997)',
                                                                        border: 'none',
                                                                        color: 'white',
                                                                        borderRadius: '12px',
                                                                        padding: '12px 20px',
                                                                        fontSize: '0.9rem',
                                                                        fontWeight: '600',
                                                                        transition: 'all 0.3s ease'
                                                                    }}
                                                                    onMouseEnter={(e) => {
                                                                        e.target.style.transform = 'translateY(-2px)';
                                                                        e.target.style.boxShadow = '0 8px 25px rgba(40, 167, 69, 0.3)';
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        e.target.style.transform = 'translateY(0)';
                                                                        e.target.style.boxShadow = 'none';
                                                                    }}
                                                                >
                                                                    <i className="fas fa-check me-2"></i>
                                                                    Mark as Read
                                                                </button>
                                                            )}
                                                            {n.seen && (
                                                                <div className="seen-indicator" style={{
                                                                    color: '#28a745',
                                                                    fontSize: '0.9rem',
                                                                    fontWeight: '600',
                                                                    display: 'flex',
                                                                    alignItems: 'center'
                                                                }}>
                                                                    <i className="fas fa-check-double me-2"></i>
                                                                    Read
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="modern-empty-state" style={{
                                        background: 'rgba(255, 255, 255, 0.95)',
                                        backdropFilter: 'blur(10px)',
                                        borderRadius: '20px',
                                        padding: '60px 40px',
                                        textAlign: 'center',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                                    }}>
                                        <div className="empty-state-icon mb-4" style={{
                                            width: '100px',
                                            height: '100px',
                                            background: 'linear-gradient(135deg, #3498db20, #2980b920)',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto'
                                        }}>
                                            <i className="fas fa-bell-slash" style={{ 
                                                fontSize: '2.5rem', 
                                                color: '#3498db' 
                                            }}></i>
                                        </div>
                                        <h4 className="mb-3" style={{ color: '#2c3e50' }}>No Notifications</h4>
                                        <p className="text-muted mb-0" style={{ fontSize: '1.1rem' }}>
                                            You're all caught up! New notifications will appear here when they arrive.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </>
    );
}

export default TeacherNotification;
