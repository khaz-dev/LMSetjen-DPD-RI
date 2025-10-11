import { useState, useEffect } from "react";
import { Route, Routes, BrowserRouter } from "react-router-dom";

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

import Register from "../src/views/auth/Register";
import Login from "../src/views/auth/Login";
import ForgotPassword from "./views/auth/ForgotPassword";
import CreateNewPassword from "./views/auth/CreateNewPassword";

import Index from "./views/base/Index";
import CourseDetail from "./views/base/CourseDetail";
import Search from "./views/base/Search";
import NotFound from "./views/base/NotFound";

import StudentDashboard from "./views/student/Dashboard";
import StudentCourses from "./views/student/Courses";
import StudentCourseDetail from "./views/student/CourseDetail";
import Wishlist from "./views/student/Wishlist";
import StudentQA from "./views/student/QA";
import StudentProfile from "./views/student/Profile";
import StudentChangePassword from "./views/student/ChangePassword";
import Dashboard from "./views/instructor/Dashboard";
import Courses from "./views/instructor/Courses";
import Review from "./views/instructor/Review";
import Students from "./views/instructor/Students";
import TeacherNotification from "./views/instructor/TeacherNotification";
import QA from "./views/instructor/QA";
import ChangePassword from "./views/instructor/ChangePassword";
import Profile from "./views/instructor/Profile";
import CourseCreate from "./views/instructor/CourseCreate";
import CourseEdit from "./views/instructor/CourseEdit";
import CourseEditCurriculum from "./views/instructor/CourseEditCurriculum";
import CourseQuiz from "./views/instructor/CourseQuiz";

import DashboardAdmin from "./views/admin/DashboardAdmin";
import UsersAdmin from "./views/admin/UsersAdmin";

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
                    console.error("App.jsx: Error fetching profile:", error);
                    setProfile(null);
                });
            } else {
                // Clear data for non-logged-in users
                setWishlistCount(0);
                setProfile(null);
            }
        } catch (error) {
            console.error("App.jsx: Error in useEffect:", error);
            setWishlistCount(0);
            setProfile(null);
        }
    }, []);

    return (
        <WishlistContext.Provider value={[wishlistCount, setWishlistCount, refreshWishlistCount]}>
            <ProfileContext.Provider value={[profile, setProfile]}>
            <BrowserRouter>
                <ThemeProvider>
                    <MainWrapper>
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

                            {/* 404 Not Found - Must be last */}
                            <Route path="*" element={<NotFound />} />
                        </Routes>
                    </MainWrapper>
                </ThemeProvider>
                </BrowserRouter>
            </ProfileContext.Provider>
        </WishlistContext.Provider>
    );
}

export default App;
