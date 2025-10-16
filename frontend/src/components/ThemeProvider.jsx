import { memo } from "react";
import { useTheme } from "../utils/themeUtils";

// Theme provider component that applies themes based on current route
const ThemeProvider = ({ children }) => {
    useTheme(); // This hook handles theme switching automatically
    return children;
};

export default memo(ThemeProvider);