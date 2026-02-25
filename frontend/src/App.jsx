import { useState, useEffect, lazy, Suspense, useMemo, useRef } from "react";
import { Route, Routes, BrowserRouter, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

import { ProfileContext, WishlistContext, RolesContext } from "./views/plugin/Context";
import apiInstance from "./utils/axios";
import useAxios from "./utils/useAxios";
import UserData from "./views/plugin/UserData";

// Import theme provider
import ThemeProvider from "./components/ThemeProvider";

// Import mobile-optimized Toast styles
import "./views/plugin/toast-mobile.css";

// ✨ PHASE 4.9: Import performance optimization styles
// NOTE: Instructor sidebar CSS is embedded in performance.css to ensure global bundling
import "./styles/performance.css";

import MainWrapper from "./layouts/MainWrapper";
import PrivateRoute from "./layouts/PrivateRoute";
import RoleRoute from "./layouts/RoleRoute";

// Lazy load all route components for better performance
// Auth Routes
const Login = lazy(() => import("./views/auth/Login"));
const SSOLogin = lazy(() => import("./views/auth/SSOLogin"));
const ForgotPassword = lazy(() => import("./views/auth/ForgotPassword"));
const CreateNewPassword = lazy(() => import("./views/auth/CreateNewPassword"));

// Base Routes
const Index = lazy(() => import("./views/base/Index"));
const CourseDetail = lazy(() => import("./views/base/CourseDetail"));
const InstructorProfilePage = lazy(() => import("./views/base/InstructorProfilePage"));
const Search = lazy(() => import("./views/base/Search"));
const UserGuide = lazy(() => import("./views/base/UserGuide"));
const Contact = lazy(() => import("./views/base/Contact"));
const Tentang = lazy(() => import("./views/base/Tentang"));
const Capaian = lazy(() => import("./views/base/Capaian"));
const CertificateValidation = lazy(() => import("./views/base/CertificateValidation"));
const PrivacyPolicy = lazy(() => import("./views/base/PrivacyPolicy"));
const TermsAndConditions = lazy(() => import("./views/base/TermsAndConditions"));
const CookiePolicy = lazy(() => import("./views/base/CookiePolicy"));
const NotFound = lazy(() => import("./views/base/NotFound"));

// Student Routes
const StudentDashboard = lazy(() => import("./views/student/Dashboard"));
const StudentCourses = lazy(() => import("./views/student/Courses"));
const StudentCourseDetail = lazy(() => import("./views/student/CourseDetail"));
const StudentTestimonials = lazy(() => import("./views/student/Testimonials"));
const Wishlist = lazy(() => import("./views/student/Wishlist"));
const StudentQA = lazy(() => import("./views/student/QA"));
const StudentProfile = lazy(() => import("./views/student/Profile"));

// Instructor Routes
const Dashboard = lazy(() => import("./views/instructor/Dashboard"));
const Courses = lazy(() => import("./views/instructor/Courses"));
const InstructorTestimonials = lazy(() => import("./views/instructor/Testimonials"));
const Review = lazy(() => import("./views/instructor/Review"));
const Students = lazy(() => import("./views/instructor/Students"));
const TeacherNotification = lazy(() => import("./views/instructor/TeacherNotification"));
const QA = lazy(() => import("./views/instructor/QA"));
const Profile = lazy(() => import("./views/instructor/Profile"));
const CourseCreate = lazy(() => import("./views/instructor/CourseCreate"));
const CourseEdit = lazy(() => import("./views/instructor/CourseEdit"));
const CourseEditCurriculum = lazy(() => import("./views/instructor/CourseEditCurriculum"));
const CourseQuiz = lazy(() => import("./views/instructor/CourseQuiz"));

// Admin Routes
const DashboardAdmin = lazy(() => import("./views/admin/DashboardAdmin"));
const UsersAdmin = lazy(() => import("./views/admin/UsersAdmin"));
const SystemDocumentation = lazy(() => import("./views/admin/SystemDocumentation"));
// ✨ PHASE 4: Merged content management page (replaces CourseReviewAdmin, TestimonialsAdmin, KelolaMaterialAdmin)
const ContentManagementAdmin = lazy(() => import("./views/admin/ContentManagementAdmin"));
// ✨ PHASE 4.37+: Dedicated admin course review detail page
const AdminCourseReviewDetail = lazy(() => import("./views/admin/AdminCourseReviewDetail"));

// Loading component for Suspense fallback - Centered spinner
const LoadingFallback = () => (
    <div 
        className="d-flex justify-content-center align-items-center" 
        style={{ 
            minHeight: "100vh",
            background: "rgba(255, 255, 255, 0.98)",
            paddingTop: "85px"
        }}
    >
        <div className="text-center">
            <div 
                className="spinner-border text-primary" 
                role="status"
                style={{
                    width: "2.5rem",
                    height: "2.5rem",
                    borderWidth: "0.25rem"
                }}
            >
                <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3 text-muted" style={{ fontSize: "0.95rem" }}>Loading page...</p>
        </div>
    </div>
);

function App() {
    const [wishlistCount, setWishlistCount] = useState(0);
    const [profile, setProfile] = useState(null);
    // PHASE 4: State for multi-role support
    const [availableRoles, setAvailableRoles] = useState([]);
    const [currentRole, setCurrentRole] = useState(null);
    const [rolesLoading, setRolesLoading] = useState(false);
    
    // ✨ PHASE 4.177: Fetch guards to prevent duplicate API calls in React Strict Mode
    const hasFetchedRef = useRef(false);

    // PHASE 4: Fetch available roles for multi-role users
    const fetchAvailableRoles = () => {
        try {
            const userData = UserData();
            if (userData?.user_id) {
                setRolesLoading(true);
                useAxios.get(`auth/available-roles/`).then((res) => {
                    setAvailableRoles(res.data.available_roles || []);
                    setCurrentRole(res.data.current_role || null);
                    setRolesLoading(false);
                }).catch((error) => {
                    // Fallback: try to get roles from user data
                    if (userData?.roles) {
                        const roles = userData.roles.split(',').map(r => r.trim());
                        setAvailableRoles(roles);
                        setCurrentRole(userData.current_role || userData.role || roles[0]);
                    }
                    setRolesLoading(false);
                });
            }
        } catch (error) {
            setRolesLoading(false);
        }
    };

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
        // ✨ PHASE 4.177: Skip if data is already loaded (prevents duplicates in React Strict Mode)
        if (profile?.id || profile?.full_name) return;
        
        // Guard against duplicate API calls in React Strict Mode
        if (hasFetchedRef.current) return;
        hasFetchedRef.current = true;
        
        try {
            const userData = UserData();
            
            // Only fetch user data if user is logged in
            if (userData?.user_id) {
                refreshWishlistCount();
                // PHASE 4: Fetch available roles for multi-role support
                fetchAvailableRoles();
                
                useAxios.get(`user/profile/${userData.user_id}/`).then((res) => {
                    setProfile(res.data);
                }).catch((error) => {
                    if (process.env.NODE_ENV === "development") {
                    }
                    setProfile(null);
                });
            } else {
                // Clear data for non-logged-in users
                setWishlistCount(0);
                setProfile(null);
            }
        } catch (error) {
            if (process.env.NODE_ENV === "development") {
            }
            setWishlistCount(0);
            setProfile(null);
        }
    }, [profile?.id, profile?.full_name]);

    // Memoize context values to prevent unnecessary re-renders
    const wishlistContextValue = useMemo(
        () => [wishlistCount, setWishlistCount, refreshWishlistCount],
        [wishlistCount]
    );

    const profileContextValue = useMemo(
        () => [profile, setProfile],
        [profile]
    );

    // PHASE 4: Memoize roles context value
    const rolesContextValue = useMemo(
        () => ({ availableRoles, currentRole, rolesLoading, fetchAvailableRoles }),
        [availableRoles, currentRole, rolesLoading]
    );

    return (
        <HelmetProvider>
            <WishlistContext.Provider value={wishlistContextValue}>
                <ProfileContext.Provider value={profileContextValue}>
                    <RolesContext.Provider value={rolesContextValue}>
                    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                        <ThemeProvider>
                        <MainWrapper>
                            <Suspense fallback={<LoadingFallback />}>
                                <Routes>
                                    <Route path="/login/" element={<Login />} />
                                    <Route path="/sso/:sso_token/" element={<SSOLogin />} />
                                    <Route path="/sso/login/:sso_token/" element={<SSOLogin />} />
                                    <Route path="/forgot-password/" element={<ForgotPassword />} />
                                    <Route path="/create-new-password/" element={<CreateNewPassword />} />

                                {/* Base Routes */}
                                <Route path="/" element={<Index />} />
                                <Route path="/course-detail/:slug/" element={<CourseDetail />} />
                                <Route path="/instructor-profile/:teacher_id/" element={<InstructorProfilePage />} />
                                <Route path="/search/" element={<Search />} />
                                <Route path="/user-guide/" element={<UserGuide />} />
                                <Route path="/contact/" element={<Contact />} />
                                <Route path="/tentang/" element={<Tentang />} />
                                <Route path="/capaian/" element={<Capaian />} />
                                <Route path="/certificate/validate/:validation_token/" element={<CertificateValidation />} />
                                <Route path="/privacy-policy/" element={<PrivacyPolicy />} />
                                <Route path="/terms-and-conditions/" element={<TermsAndConditions />} />
                                <Route path="/cookie-policy/" element={<CookiePolicy />} />

                                {/* Student Routes */}
                                <Route
                                    path="/student/dashboard/"
                                    element={
                                        <PrivateRoute>
                                            <RoleRoute allowedRoles={["student"]}>
                                                <StudentDashboard />
                                            </RoleRoute>
                                        </PrivateRoute>
                                    }
                                />
                                <Route
                                    path="/student/courses/"
                                    element={
                                        <PrivateRoute>
                                            <RoleRoute allowedRoles={["student"]}>
                                                <StudentCourses />
                                            </RoleRoute>
                                        </PrivateRoute>
                                    }
                                />
                                <Route
                                    path="/student/courses/:enrollment_id/"
                                    element={
                                        <PrivateRoute>
                                            <RoleRoute allowedRoles={["student"]}>
                                                <StudentCourseDetail />
                                            </RoleRoute>
                                        </PrivateRoute>
                                    }
                                />
                            <Route
                                path="/student/wishlist/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={["student"]}>
                                            <Wishlist />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/student/question-answer/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={["student"]}>
                                            <StudentQA />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/student/profile/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={["student"]}>
                                            <StudentProfile />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/student/testimonials/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={["student"]}>
                                            <StudentTestimonials />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            
                            {/* Instructor Routes */}

                            <Route
                                path="/instructor/dashboard/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={["teacher", "instructor"]}>
                                            <Dashboard />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            
                            <Route
                                path="/instructor/courses/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={["teacher", "instructor"]}>
                                            <Courses />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/instructor/reviews/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={["teacher", "instructor"]}>
                                            <Review />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/instructor/students/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={["teacher", "instructor"]}>
                                            <Students />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/instructor/notifications/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={["teacher", "instructor"]}>
                                            <TeacherNotification />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/instructor/question-answer/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={["teacher", "instructor"]}>
                                            <QA />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/instructor/profile/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={["teacher", "instructor"]}>
                                            <Profile />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/instructor/testimonials/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={["teacher", "instructor"]}>
                                            <InstructorTestimonials />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/instructor/create-course/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={["teacher", "instructor"]}>
                                            <CourseCreate />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/instructor/edit-course/:course_id/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={["teacher", "instructor"]}>
                                            <CourseEdit />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/instructor/edit-course/:course_id/curriculum/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={["teacher", "instructor"]}>
                                            <CourseEditCurriculum />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/instructor/edit-course/:course_id/quiz/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={["teacher", "instructor"]}>
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
                                        <RoleRoute allowedRoles={["admin"]}>
                                            <DashboardAdmin />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/admin/users/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={["admin"]}>
                                            <UsersAdmin />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/admin/documentation/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={["admin"]}>
                                            <SystemDocumentation />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            {/* ✨ PHASE 4: Unified content management page */}
                            <Route
                                path="/admin/content-management/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={["admin"]}>
                                            <ContentManagementAdmin />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            {/* ✨ PHASE 4.37+: Dedicated admin course review detail page */}
                            <Route
                                path="/admin/review-course/:course_id/"
                                element={
                                    <PrivateRoute>
                                        <RoleRoute allowedRoles={["admin"]}>
                                            <AdminCourseReviewDetail />
                                        </RoleRoute>
                                    </PrivateRoute>
                                }
                            />
                            {/* Backward compatibility redirects */}
                            <Route
                                path="/admin/review-courses/"
                                element={<Navigate to="/admin/content-management/?tab=courses" replace />}
                            />
                            <Route
                                path="/admin/testimonials/"
                                element={<Navigate to="/admin/content-management/?tab=testimonials" replace />}
                            />
                            <Route
                                path="/admin/kelola-materi/"
                                element={<Navigate to="/admin/content-management/?tab=materials" replace />}
                            />

                            {/* 404 Not Found - Must be last */}
                            <Route path="*" element={<NotFound />} />
                        </Routes>
                        </Suspense>
                    </MainWrapper>
                </ThemeProvider>
                    </BrowserRouter>
                    </RolesContext.Provider>
            </ProfileContext.Provider>
        </WishlistContext.Provider>
        </HelmetProvider>
    );
}

export default App;
