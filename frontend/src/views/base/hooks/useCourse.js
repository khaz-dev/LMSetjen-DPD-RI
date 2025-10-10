import { useState, useEffect } from "react";
import useAxios from "../../../utils/useAxios";

export const useCourse = (slug) => {
    const [course, setCourse] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    const fetchCourse = async () => {
        try {
            const response = await useAxios.get(`course/course-detail/${slug}/`);
            setCourse(response.data);
        } catch (error) {
            console.error("Error fetching course:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (slug) {
            fetchCourse();
        }
    }, [slug]);

    return { course, isLoading, refetchCourse: fetchCourse };
};