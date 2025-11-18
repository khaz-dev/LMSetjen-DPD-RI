import Cookie from "js-cookie";
import jwtDecode from "jwt-decode";
import { useAuthStore } from "../../store/auth";

function UserData() {
  let access_token = Cookie.get("access_token");
  let refresh_token = Cookie.get("refresh_token");

  if (access_token && refresh_token) {
    const token = refresh_token;
    const decoded = jwtDecode(token);
    return decoded;
  } else {
    // Fallback to Zustand store if cookies not available (e.g., SSO flow, different tabs, etc)
    const allUserData = useAuthStore.getState().allUserData;
    if (allUserData) {
      console.log("UserData: Using Zustand store (cookies not found)");
      return allUserData;
    }
    // No user data available
    console.log("UserData: No user data found in cookies or store");
    return null;
  }
}

export default UserData