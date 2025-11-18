import { create } from "zustand";
import { mountStoreDevtool } from "simple-zustand-devtools";

const useAuthStore = create((set, get) => ({
    allUserData: null,
    loading:false,

    user: () => ({
        user_id: get().allUserData?.user_id || null,
        username: get().allUserData?.username || null,
        email: get().allUserData?.email || null,
        nip: get().allUserData?.nip || null,  // Added NIP field
        role: get().allUserData?.role || null,  // Added role field
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