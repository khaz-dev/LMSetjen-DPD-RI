import { useState, useEffect, lazy, Suspense, useMemo } from "react";
import { Route, Routes, BrowserRouter } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';

import { ProfileContext, WishlistContext } from "./views/plugin/Context";
import apiInstance from "./utils/axios";
import useAxios from "./utils/useAxios";
import UserData from "./views/plugin/UserData";

// Import theme provider
import ThemeProvider from "./components/ThemeProvider";

// Import mobile-optimized Toast styles
import "./views/plugin/toast-mobile.css";

import MainWrapper from "./layouts/MainWrapper";
import PrivateRoute from "./layouts/PrivateRoute";
import RoleRoute from "./layouts/RoleRoute";

// Lazy load all route components for better performance
// Auth Routes
const Register = lazy(() => import("./views/auth/Register"));
const Login = lazy(() => import("./views/auth/Login"));
const ForgotPassword = lazy(() => import("./views/auth/ForgotPassword"));
const CreateNewPassword = lazy(() => import("./views/auth/CreateNewPassword"));

// Base Routes
const Index = lazy(() => import("./views/base/Index"));
const CourseDetail = lazy(() => import("./views/base/CourseDetail"));
const Search = lazy(() => import("./views/base/Search"));
const NotFound = lazy(() => import("./views/base/NotFound"));

// Student Routes
const StudentDashboard = lazy(() => import("./views/student/Dashboard"));
const StudentCourses = lazy(() => import("./views/student/Courses"));
const StudentCourseDetail = lazy(() => import("./views/student/CourseDetail"));
const Wishlist = lazy(() => import("./views/student/Wishlist"));
const StudentQA = lazy(() => import("./views/student/QA"));
const StudentProfile = lazy(() => import("./views/student/Profile"));
const StudentChangePassword = lazy(() => import("./views/student/ChangePassword"));

// Instructor Routes
const Dashboard = lazy(() => import("./views/instructor/Dashboard"));
const Courses = lazy(() => import("./views/instructor/Courses"));
const Review = lazy(() => import("./views/instructor/Review"));
const Students = lazy(() => import("./views/instructor/Students"));
const TeacherNotification = lazy(() => import("./views/instructor/TeacherNotification"));
const QA = lazy(() => import("./views/instructor/QA"));
const ChangePassword = lazy(() => import("./views/instructor/ChangePassword"));
const Profile = lazy(() => import("./views/instructor/Profile"));
const CourseCreate = lazy(() => import("./views/instructor/CourseCreate"));
const CourseEdit = lazy(() => import("./views/instructor/CourseEdit"));
const CourseEditCurriculum = lazy(() => import("./views/instructor/CourseEditCurriculum"));
const CourseQuiz = lazy(() => import("./views/instructor/CourseQuiz"));

// Admin Routes
const DashboardAdmin = lazy(() => import("./views/admin/DashboardAdmin"));
const UsersAdmin = lazy(() => import("./views/admin/UsersAdmin"));
const SystemDocumentation = lazy(() => import("./views/admin/SystemDocumentation"));

// Loading component for Suspense fallback - Centered spinner
const LoadingFallback = () => (
    <div 
        className="d-flex justify-content-center align-items-center" 
        style={{ 
            minHeight: '100vh',
            background: 'rgba(255, 255, 255, 0.98)',
            paddingTop: '85px'
        }}
    >
        <div className="text-center">
            <div 
                className="spinner-border text-primary" 
                role="status"
                style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    borderWidth: '0.25rem'
                }}
            >
                <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3 text-muted" style={{ fontSize: '0.95rem' }}>Loading page...</p>
        </div>
    </div>
);

function App() {
    const [wishlistCount, setWishlistCount] = useState(0);
    const [profile, setProfile] = useState(null);

    const refreshWishlistCount = () => {
        try {
            const userData = UserData();
            if (userData?.user_id) {
                apiInstance.get(`student/wishlist/${userData.user_id}/`).then((res) => {
                    setWishlistCount(res.data?.length || 0);
                }).catch(() => {
                    setWishlistCount(0);
                });
            }
        } catch (error) {
            setWishlistCount(0);
        }
    };

    useEffect(() => {
        try {
            const userData = UserData();
            
            // Only fetch user data if user is logged in
            if (userData?.user_id) {
                refreshWishlistCount();
                
                useAxios.get(`user/profile/${userData.user_id}/`).then((res) => {
                    setProfile(res.data);
                }).catch((error) => {
                    if (process.env.NODE_ENV === 'development') {
                        console.error("App.jsx: Error fetching profile:", error);
                    }
                    setProfile(null);
                });
            } else {
                // Clear data for non-logged-in users
                setWishlistCount(0);
                setProfile(null);
            }
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.error("App.jsx: Error in useEffect:", error);
            }
            setWishlistCount(0);
            setProfile(null);
        }
    }, []);

    // Memoize context values to prevent unnecessary re-renders
    const wishlistContextValue = useMemo(
        () => [wishlistCount, setWishlistCount, refreshWishlistCount],
        [wishlistCount]
    );

    const profileContextValue = useMemo(
        () => [profile, setProfile],
        [profile]
    );

    return (
        <HelmetProvider>
            <WishlistContext.Provider value={wishlistContextValue}>
                <ProfileContext.Provider value={profileContextValue}>
                <BrowserRouter>
                    <ThemeProvider>
                        <MainWrapper>
                            <Suspense fallback={<LoadingFallback />}>
                                <Routes>
                                    <Route path="/register/" element={<Register />} />
                                    <Route path="/login/" element={<Login />} />
                                    <Route path="/forgot-password/" element={<ForgotPassword />} />
                                    <Route path="/create-new-password/" element={<CreateNewPassword />} />

                                {/* Base Routes */}
                                <Route path="/" element={<Index />} />
                                <Route path="/course-detail/:slug/" element={<CourseDetail />} />
                                <Route path="/search/" element={<Search />} />

                                {/* Student Routes */}
                                <Route
                                    path="/student/dashboard/"
                                    element={
                                        <PrivateRoute>
                                            <RoleRoute allowedRoles={['student']}>
                                                <StudentDashboard />
                                            </RoleRoute>
                                        </PrivateRoute>
                                    }
                                />
                                <Route
                                    path="/student/courses/"
                                    element={
                                        <PrivateRoute>
                                            <RoleRoute allowedRoles={['student']}>
                                                <StudentCourses />
                                            </RoleRoute>
                                        </PrivateRoute>
                                    }
                                />
                                <Route
                                    path="/student/courses/:enrollment_id/"
                                    element={
                                        <PrivateRoute>
                                            <RoleRoute allowedRoles={['student']}>
                                                <StudentCourseDetail />
                                            </RoleRoute>
                                        </PrivateRoute>
                                    }
                                />
                            <Route
                                path="/student/wishlist/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={['student']}>
                                            <Wishlist />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/student/question-answer/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={['student']}>
                                            <StudentQA />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/student/profile/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={['student']}>
                                            <StudentProfile />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/student/change-password/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={['student']}>
                                            <StudentChangePassword />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />

                            {/* Instructor Routes */}

                            <Route
                                path="/instructor/dashboard/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={['teacher', 'instructor']}>
                                            <Dashboard />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            
                            <Route
                                path="/instructor/courses/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={['teacher', 'instructor']}>
                                            <Courses />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/instructor/reviews/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={['teacher', 'instructor']}>
                                            <Review />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/instructor/students/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={['teacher', 'instructor']}>
                                            <Students />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/instructor/notifications/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={['teacher', 'instructor']}>
                                            <TeacherNotification />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/instructor/question-answer/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={['teacher', 'instructor']}>
                                            <QA />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/instructor/change-password/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={['teacher', 'instructor']}>
                                            <ChangePassword />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/instructor/profile/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={['teacher', 'instructor']}>
                                            <Profile />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/instructor/create-course/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={['teacher', 'instructor']}>
                                            <CourseCreate />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/instructor/edit-course/:course_id/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={['teacher', 'instructor']}>
                                            <CourseEdit />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/instructor/edit-course/:course_id/curriculum/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={['teacher', 'instructor']}>
                                            <CourseEditCurriculum />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/instructor/edit-course/:course_id/quiz/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={['teacher', 'instructor']}>
                                            <CourseQuiz />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />

                            {/* Admin Routes */}
                            <Route
                                path="/admin/dashboard/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={['admin']}>
                                            <DashboardAdmin />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/admin/users/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={['admin']}>
                                            <UsersAdmin />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/admin/documentation/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={['admin']}>
                                            <SystemDocumentation />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />

                            {/* 404 Not Found - Must be last */}
                            <Route path="*" element={<NotFound />} />
                        </Routes>
                        </Suspense>
                    </MainWrapper>
                </ThemeProvider>
                </BrowserRouter>
            </ProfileContext.Provider>
        </WishlistContext.Provider>
        </HelmetProvider>
    );
}

export default App;
