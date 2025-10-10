import { useState, useEffect } from "react";
import apiInstance from "../../../utils/axios";
import Toast from "../../plugin/Toast";

export const useEnrollment = (courseId, userId) => {
    const [isEnrolled, setIsEnrolled] = useState(false);
    const [enrollmentId, setEnrollmentId] = useState(null);
    const [isEnrolling, setIsEnrolling] = useState(false);

    // Check enrollment status
    const checkEnrollmentStatus = async () => {
        if (!userId || !courseId) return;
        
        try {
            const response = await apiInstance.get(`course/check-enrollment/${courseId}/${userId}/`);
            setIsEnrolled(response.data.is_enrolled);
            if (response.data.is_enrolled) {
                setEnrollmentId(response.data.enrollment_id);
            }
        } catch (error) {
            console.error("Error checking enrollment status:", error);
        }
    };

    // Handle course enrollment
    const handleEnrollment = async () => {
        if (!userId) {
            Toast().fire({
                icon: "warning",
                title: "Please login to enroll in this course",
            });
            return;
        }

        if (isEnrolled) {
            // Navigate to student course detail page
            window.location.href = `/student/courses/${enrollmentId}/`;
            return;
        }

        setIsEnrolling(true);
        try {
            const response = await apiInstance.post('course/enroll/', {
                course_id: courseId,
                user_id: userId
            });

            setIsEnrolled(true);
            setEnrollmentId(response.data.enrollment_id);
            
            Toast().fire({
                icon: "success",
                title: "Successfully enrolled in course!",
            });

            // Navigate to student course detail page after successful enrollment
            setTimeout(() => {
                window.location.href = `/student/courses/${response.data.enrollment_id}/`;
            }, 1500);

        } catch (error) {
            console.error("Error enrolling in course:", error);
            Toast().fire({
                icon: "error",
                title: error.response?.data?.error || "Failed to enroll in course",
            });
        } finally {
            setIsEnrolling(false);
        }
    };

    useEffect(() => {
        if (courseId && userId) {
            checkEnrollmentStatus();
        }
    }, [courseId, userId]);

    return {
        isEnrolled,
        enrollmentId,
        isEnrolling,
        handleEnrollment,
        checkEnrollmentStatus
    };
};