import Cookie from "js-cookie";
import jwtDecode from "jwt-decode";
import { useAuthStore } from "../../store/auth";

function UserData() {
  let access_token = Cookie.get("access_token");
  let refresh_token = Cookie.get("refresh_token");
  
  console.log("🔍 UserData() called - checking for tokens...");
  console.log("Access token exists:", !!access_token);
  console.log("Refresh token exists:", !!refresh_token);

  if (access_token || refresh_token) {
    try {
      // Try to decode refresh_token first (it should have role)
      if (refresh_token) {
        const decoded = jwtDecode(refresh_token);
        console.log("✅ UserData: Decoded from refresh_token");
        console.log("   Fields in refresh_token:", Object.keys(decoded).join(", "));
        console.log("   role =", decoded.role);
        
        // If refresh token has role, return it
        if (decoded.role) {
          return decoded;
        }
        
        console.warn("⚠️  Refresh token decoded but role is undefined, trying access_token...");
      }
      
      // Fallback to access_token if refresh_token doesn't have role
      if (access_token) {
        const decoded = jwtDecode(access_token);
        console.log("✅ UserData: Decoded from access_token");
        console.log("   Fields in access_token:", Object.keys(decoded).join(", "));
        console.log("   role =", decoded.role);
        return decoded;
      }
    } catch (error) {
      console.error("❌ UserData: Error decoding tokens:", error);
      // Fall through to store fallback
    }
  }
  
  // Fallback to Zustand store if cookies not available (e.g., SSO flow, different tabs, etc)
  const allUserData = useAuthStore.getState().allUserData;
  console.log("📦 Zustand allUserData exists:", !!allUserData);
  if (allUserData) {
    console.log("✅ UserData: Using Zustand store, role =", allUserData.role);
    return allUserData;
  }
  
  // No user data available
  console.log("❌ UserData: No user data found in cookies or store");
  return null;
}

export default UserData