import { useState, useEffect, useContext } from "react";
import { WishlistContext } from "../../plugin/Context";
import apiInstance from "../../../utils/axios";
import Toast from "../../plugin/Toast";

export const useWishlist = (userId) => {
    const [wishlistCount, setWishlistCount, refreshWishlistCount] = useContext(WishlistContext);
    const [wishlistItems, setWishlistItems] = useState([]);

    // Fetch wishlist items
    const fetchWishlistItems = async () => {
        if (!userId) return;
        
        try {
            const response = await apiInstance.get(`student/wishlist/${userId}/`);
            setWishlistItems(response.data || []);
        } catch (error) {
            console.error("Error fetching wishlist items:", error);
        }
    };

    // Add or remove course from wishlist
    const addToWishlist = async (courseId) => {
        if (!userId) {
            Toast().fire({
                icon: "warning",
                title: "Please login to manage wishlist",
            });
            return;
        }

        const formData = new FormData();
        formData.append("course_id", courseId);
        formData.append("user_id", userId);

        try {
            const response = await apiInstance.post(`student/wishlist/${userId}/`, formData);
            Toast().fire({
                icon: "success",
                title: response.data.message,
            });
            fetchWishlistItems();
            refreshWishlistCount();
        } catch (error) {
            console.error("Error managing wishlist:", error);
            Toast().fire({
                icon: "error",
                title: "Error updating wishlist",
            });
        }
    };

    // Check if course is already in wishlist
    const isCourseInWishlist = (courseId) => {
        return wishlistItems.some(item => item.course?.id === courseId);
    };

    useEffect(() => {
        if (userId) {
            fetchWishlistItems();
        }
    }, [userId]);

    return {
        wishlistItems,
        addToWishlist,
        isCourseInWishlist,
        fetchWishlistItems
    };
};