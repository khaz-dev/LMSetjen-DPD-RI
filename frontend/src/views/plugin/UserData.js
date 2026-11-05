import Cookie from "js-cookie";
import jwtDecode from "jwt-decode";
import { useAuthStore } from "../../store/auth";

function UserData() {
  let access_token = Cookie.get("access_token");
  let refresh_token = Cookie.get("refresh_token");

  if (access_token || refresh_token) {
    try {
      // Decode access_token first as it represents the active session claims and updated role
      if (access_token) {
        const decoded = jwtDecode(access_token);
        if (decoded && (decoded.role || decoded.current_role || decoded.user_id || decoded.id)) {
          return decoded;
        }
      }

      // Fallback to refresh_token if access_token doesn't have role
      if (refresh_token) {
        const decoded = jwtDecode(refresh_token);
        if (decoded && (decoded.role || decoded.current_role)) {
          return decoded;
        }
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

export default UserData;
