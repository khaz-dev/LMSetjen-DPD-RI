import Cookie from "js-cookie";
import jwtDecode from "jwt-decode";
import { useAuthStore } from "../../store/auth";

function UserData() {
  let access_token = Cookie.get("access_token");
  let refresh_token = Cookie.get("refresh_token");
  

  if (access_token || refresh_token) {
    try {
      // Try to decode refresh_token first (it should have role)
      if (refresh_token) {
        const decoded = jwtDecode(refresh_token);
        
        // If refresh token has role, return it
        if (decoded.role) {
          return decoded;
        }
        
      }
      
      // Fallback to access_token if refresh_token doesn't have role
      if (access_token) {
        const decoded = jwtDecode(access_token);
        return decoded;
      }
    } catch (error) {
      // Fall through to store fallback
    }
  }
  
  // Fallback to Zustand store if cookies not available (e.g., SSO flow, different tabs, etc)
  const allUserData = useAuthStore.getState().allUserData;
  if (allUserData) {
    return allUserData;
  }
  
  // No user data available
  return null;
}

export default UserData