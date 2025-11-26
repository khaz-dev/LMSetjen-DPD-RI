import React from "react";
import { Link } from "react-router-dom";

import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import BaseHeader from "../partials/BaseHeader";
import BaseFooter from "../partials/BaseFooter";

function QADetail() {
    return (
        <>
            <BaseHeader />

            <style>
                {`
                    .modern-qa-detail-page {
                        background: linear-gradient(135deg, #fafafa 0%, #f5f5f5 50%, #ebebeb 100%);
                        min-height: 100vh;
                        padding-top: 2rem;
                    }
                    
                    .qa-detail-header {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        border-radius: 20px;
                        color: white;
                        padding: 2rem;
                        margin-bottom: 2rem;
                        position: relative;
                        overflow: hidden;
                        box-shadow: 0 15px 35px rgba(102, 126, 234, 0.3);
                    }
                    
                    .qa-detail-header::before {
                        content: '';
                        position: absolute;
                        top: -50%;
                        right: -20%;
                        width: 40%;
                        height: 200%;
                        background: rgba(255, 255, 255, 0.1);
                        transform: rotate(15deg);
                        z-index: 1;
                    }
                    
                    .qa-detail-content {
                        position: relative;
                        z-index: 2;
                    }
                    
                    .qa-discussion-container {
                        background: white;
                        border-radius: 20px;
                        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
                        border: 1px solid #e9ecef;
                        overflow: hidden;
                    }
                    
                    .qa-discussion-header {
                        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                        padding: 1.5rem 2rem;
                        border-bottom: 1px solid #e9ecef;
                    }
                    
                    .course-info-badge {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 0.5rem 1rem;
                        border-radius: 20px;
                        font-size: 0.85rem;
                        font-weight: 600;
                        display: inline-flex;
                        align-items: center;
                        gap: 0.5rem;
                        margin-bottom: 0.75rem;
                        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
                    }
                    
                    .questions-count-badge {
                        background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
                        color: white;
                        padding: 0.5rem 1rem;
                        border-radius: 20px;
                        font-size: 0.85rem;
                        font-weight: 600;
                        display: inline-flex;
                        align-items: center;
                        gap: 0.5rem;
                        box-shadow: 0 2px 8px rgba(231, 76, 60, 0.3);
                    }
                    
                    .messages-container {
                        padding: 2rem;
                        max-height: 500px;
                        overflow-y: auto;
                        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
                    }
                    
                    .messages-container::-webkit-scrollbar {
                        width: 8px;
                    }
                    
                    .messages-container::-webkit-scrollbar-track {
                        background: #f1f1f1;
                        border-radius: 10px;
                    }
                    
                    .messages-container::-webkit-scrollbar-thumb {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        border-radius: 10px;
                    }
                    
                    .message-item {
                        margin-bottom: 1.5rem;
                        animation: fadeInUp 0.6s ease-out;
                    }
                    
                    @keyframes fadeInUp {
                        from {
                            opacity: 0;
                            transform: translateY(20px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                    
                    .message-avatar {
                        width: 50px;
                        height: 50px;
                        border-radius: 50%;
                        object-fit: cover;
                        border: 3px solid white;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                        transition: transform 0.3s ease;
                    }
                    
                    .message-item:hover .message-avatar {
                        transform: scale(1.1);
                    }
                    
                    .message-content {
                        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
                        border: 2px solid #e9ecef;
                        border-radius: 15px;
                        padding: 1.25rem;
                        margin-left: 1rem;
                        position: relative;
                        transition: all 0.3s ease;
                        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
                    }
                    
                    .message-content::before {
                        content: '';
                        position: absolute;
                        left: -8px;
                        top: 20px;
                        width: 0;
                        height: 0;
                        border-top: 8px solid transparent;
                        border-bottom: 8px solid transparent;
                        border-right: 8px solid #e9ecef;
                    }
                    
                    .message-content::after {
                        content: '';
                        position: absolute;
                        left: -6px;
                        top: 21px;
                        width: 0;
                        height: 0;
                        border-top: 7px solid transparent;
                        border-bottom: 7px solid transparent;
                        border-right: 7px solid #ffffff;
                    }
                    
                    .message-item:hover .message-content {
                        border-color: #667eea;
                        box-shadow: 0 8px 25px rgba(102, 126, 234, 0.15);
                        transform: translateY(-2px);
                    }
                    
                    .message-author {
                        font-size: 1rem;
                        font-weight: 700;
                        color: #2c3e50;
                        margin-bottom: 0.25rem;
                        text-decoration: none;
                        transition: color 0.3s ease;
                    }
                    
                    .message-author:hover {
                        color: #667eea;
                    }
                    
                    .message-time {
                        font-size: 0.8rem;
                        color: #6c757d;
                        font-weight: 500;
                        display: flex;
                        align-items: center;
                        gap: 0.25rem;
                        margin-bottom: 0.75rem;
                    }
                    
                    .message-text {
                        color: #495057;
                        line-height: 1.6;
                        margin: 0;
                        font-size: 0.95rem;
                    }
                    
                    .reply-form-container {
                        background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
                        border-top: 1px solid #e9ecef;
                        padding: 2rem;
                    }
                    
                    .reply-form {
                        display: flex;
                        gap: 1rem;
                        align-items: flex-end;
                    }
                    
                    .reply-textarea {
                        flex: 1;
                        border: 2px solid #e9ecef;
                        border-radius: 15px;
                        padding: 1rem 1.25rem;
                        font-size: 0.95rem;
                        transition: all 0.3s ease;
                        background: #f8f9fa;
                        resize: vertical;
                        min-height: 60px;
                    }
                    
                    .reply-textarea:focus {
                        border-color: #667eea;
                        box-shadow: 0 0 0 0.2rem rgba(102, 126, 234, 0.25);
                        background: white;
                        outline: none;
                    }
                    
                    .reply-submit-btn {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        border: none;
                        border-radius: 15px;
                        padding: 1rem 2rem;
                        color: white;
                        font-weight: 600;
                        font-size: 0.9rem;
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                        transition: all 0.3s ease;
                        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
                        min-width: 120px;
                        justify-content: center;
                    }
                    
                    .reply-submit-btn:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
                        color: white;
                    }
                    
                    .empty-state {
                        text-align: center;
                        padding: 3rem;
                        color: #6c757d;
                    }
                    
                    .empty-icon {
                        font-size: 4rem;
                        margin-bottom: 1rem;
                        color: #667eea;
                        opacity: 0.7;
                    }
                    
                    @media (max-width: 768px) {
                        .qa-detail-header {
                            padding: 1.5rem;
                        }
                        
                        .messages-container {
                            padding: 1.5rem;
                        }
                        
                        .reply-form-container {
                            padding: 1.5rem;
                        }
                        
                        .reply-form {
                            flex-direction: column;
                            gap: 1rem;
                        }
                        
                        .reply-submit-btn {
                            width: 100%;
                        }
                        
                        .message-avatar {
                            width: 40px;
                            height: 40px;
                        }
                        
                        .message-content {
                            margin-left: 0.75rem;
                            padding: 1rem;
                        }
                    }
                `}
            </style>

            <section className="modern-qa-detail-page">
                <div className="container">
                    {/* Header Here */}
                    <Header />
                    <div className="row mt-0 mt-md-4">
                        {/* Sidebar Here */}
                        <Sidebar />
                        <div className="col-lg-9 col-md-8 col-12">
                            <h4 className="mb-0 mb-4">
                                {" "}
                                <i className="fas fa-envelope"></i> Q/A - Angular Masterclass Course
                            </h4>

                            <div className="card mb-4">
                                <div className="card-header">
                                    <span>
                                        Course: <b>Angular Masterclass Course</b>
                                    </span>{" "}
                                    <br />
                                    <span>
                                        Questions: <b>16</b>
                                    </span>
                                </div>
                                <div className="p-2 p-sm-4">
                                    <ul className="list-unstyled mb-0" style={{ overflowY: "scroll", height: "500px" }}>
                                        <li className="comment-item mb-3">
                                            <div className="d-flex">
                                                <div className="avatar avatar-sm flex-shrink-0">
                                                    <a href="#">
                                                        <img className="avatar-img rounded-circle" src="https://desphixs.com/geeks/assets/images/avatar/avatar-2.jpg" style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }} alt="womans image" />
                                                    </a>
                                                </div>
                                                <div className="ms-2">
                                                    {/* Comment by */}
                                                    <div className="bg-light p-3 rounded w-100">
                                                        <div className="d-flex w-100 justify-content-center">
                                                            <div className="me-2 ">
                                                                <h6 className="mb-1 lead fw-bold">
                                                                    <a href="#!" className="text-decoration-none text-dark">
                                                                        {" "}
                                                                        Jenny Adga{" "}
                                                                    </a>
                                                                    <br />
                                                                    <span style={{ fontSize: "12px", color: "gray" }}>5hrs Ago</span>
                                                                </h6>
                                                                <p className="mb-0 mt-3  ">Removed demands expense account</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>

                                        <li className="comment-item mb-3">
                                            <div className="d-flex">
                                                <div className="avatar avatar-sm flex-shrink-0">
                                                    <a href="#">
                                                        <img className="avatar-img rounded-circle" src="https://desphixs.com/geeks/assets/images/avatar/avatar-1.jpg" style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }} alt="womans image" />
                                                    </a>
                                                </div>
                                                <div className="ms-2">
                                                    {/* Comment by */}
                                                    <div className="bg-light p-3 rounded w-100">
                                                        <div className="d-flex w-100 justify-content-center">
                                                            <div className="me-2 ">
                                                                <h6 className="mb-1 lead fw-bold">
                                                                    <a href="#!" className="text-decoration-none text-dark">
                                                                        {" "}
                                                                        Sam Freddy{" "}
                                                                    </a>
                                                                    <br />
                                                                    <span style={{ fontSize: "12px", color: "gray" }}>5hrs Ago</span>
                                                                </h6>
                                                                <p className="mb-0 mt-3  ">Removed demands expense account from the debby building in a hall town tak with</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>

                                        <li className="comment-item mb-3">
                                            <div className="d-flex">
                                                <div className="avatar avatar-sm flex-shrink-0">
                                                    <a href="#">
                                                        <img className="avatar-img rounded-circle" src="https://desphixs.com/geeks/assets/images/avatar/avatar-3.jpg" style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }} alt="womans image" />
                                                    </a>
                                                </div>
                                                <div className="ms-2">
                                                    {/* Comment by */}
                                                    <div className="bg-light p-3 rounded w-100">
                                                        <div className="d-flex w-100 justify-content-center">
                                                            <div className="me-2 ">
                                                                <h6 className="mb-1 lead fw-bold">
                                                                    <a href="#!" className="text-decoration-none text-dark">
                                                                        {" "}
                                                                        Louis Ferguson{" "}
                                                                    </a>
                                                                    <br />
                                                                    <span style={{ fontSize: "12px", color: "gray" }}>5hrs Ago</span>
                                                                </h6>
                                                                <p className="mb-0 mt-3  ">Removed demands expense account</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>

                                        <li className="comment-item mb-3">
                                            <div className="d-flex">
                                                <div className="avatar avatar-sm flex-shrink-0">
                                                    <a href="#">
                                                        <img className="avatar-img rounded-circle" src="https://desphixs.com/geeks/assets/images/avatar/avatar-3.jpg" style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }} alt="womans image" />
                                                    </a>
                                                </div>
                                                <div className="ms-2">
                                                    {/* Comment by */}
                                                    <div className="bg-light p-3 rounded w-100">
                                                        <div className="d-flex w-100 justify-content-center">
                                                            <div className="me-2 ">
                                                                <h6 className="mb-1 lead fw-bold">
                                                                    <a href="#!" className="text-decoration-none text-dark">
                                                                        {" "}
                                                                        Louis Ferguson{" "}
                                                                    </a>
                                                                    <br />
                                                                    <span style={{ fontSize: "12px", color: "gray" }}>5hrs Ago</span>
                                                                </h6>
                                                                <p className="mb-0 mt-3  ">Removed demands expense account</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    </ul>

                                    <form class="w-100 row">
                                        <div className="col-lg-10">
                                            <textarea class="one form-control pe-4 bg-light w-100" id="autoheighttextarea" rows="2" placeholder="Write a message..."></textarea>
                                        </div>
                                        <div className="col-lg-2">
                                            <button class="btn btn-primary ms-2 mb-0 w-100" type="button">
                                                Post <i className="fas fa-paper-plane"></i>
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <BaseFooter />
        </>
    );
}

export default QADetail;
