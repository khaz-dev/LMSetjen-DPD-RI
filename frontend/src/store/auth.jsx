import { create } from "zustand";
import { mountStoreDevtool } from "simple-zustand-devtools";

const useAuthStore = create((set, get) => ({
    allUserData: null,
    loading:false,

    user: () => ({
        user_id: get().allUserData?.user_id || null,
        username: get().allUserData?.username || null,
        email: get().allUserData?.email || null,
        full_name: get().allUserData?.full_name || null,  // Added full_name field
        nip: get().allUserData?.nip || null,
        role: get().allUserData?.role || null,
    }),

    setUser: (user) => 
        set({
            allUserData: user,
        }),
    
    setLoading: (loading) => set({loading}),

    isLoggedIn: () => get().allUserData !== null,
}));    

if (import.meta.env.DEV) {
  mountStoreDevtool("Store", useAuthStore);
}

export { useAuthStore };