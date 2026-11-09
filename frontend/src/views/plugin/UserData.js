import Cookie from "js-cookie";
import jwtDecode from "jwt-decode";
import { useAuthStore } from "../../store/auth";

// Safely check if a JWT token string is expired
function isTokenExpired(token) {
  if (!token || typeof token !== "string" || token.trim() === "") {
    return true;
  }
  try {
    const decoded = jwtDecode(token);
    if (!decoded || !decoded.exp) {
      return false;
    }
    return decoded.exp < Date.now() / 1000;
  } catch (error) {
    return true;
  }
}

function UserData() {
  let access_token = Cookie.get("access_token");
  let refresh_token = Cookie.get("refresh_token");

  if (access_token || refresh_token) {
    const accessExpired = isTokenExpired(access_token);
    const refreshExpired = isTokenExpired(refresh_token);

    // If both tokens are expired/invalid, the session is completely dead.
    // Clean up stale cookies immediately to prevent 401 requests on guest page visits.
    if (accessExpired && refreshExpired) {
      try {
        Cookie.remove("access_token");
        Cookie.remove("access_token", { path: "/" });
        Cookie.remove("refresh_token");
        Cookie.remove("refresh_token", { path: "/" });
        if (useAuthStore.getState().allUserData) {
          useAuthStore.getState().setUser(null);
        }
      } catch (e) {
        // Silent fail
      }
      return null;
    }

    try {
      // Decode access_token first if valid as it represents the active session claims and updated role
      if (access_token && !accessExpired) {
        const decoded = jwtDecode(access_token);
        if (decoded && (decoded.role || decoded.current_role || decoded.user_id || decoded.id)) {
          return decoded;
        }
      }

      // If access_token is expired but refresh_token is still valid, return decoded claims
      // so UI can render without flicker while useAxios refreshes the token in the background
      if (!refreshExpired) {
        if (access_token) {
          try {
            const decoded = jwtDecode(access_token);
            if (decoded && (decoded.role || decoded.current_role || decoded.user_id || decoded.id)) {
              return decoded;
            }
          } catch (e) {}
        }
        if (refresh_token) {
          const decoded = jwtDecode(refresh_token);
          if (decoded && (decoded.role || decoded.current_role || decoded.user_id || decoded.id)) {
            return decoded;
          }
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

