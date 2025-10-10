import { useState, useEffect } from "react";

function GetCurrentAddress() {
  const [add, setAdd] = useState({ country: "United States"}); // Default fallback to full name

  useEffect(() => {
    const fetchLocation = async () => {
      try {
        // Use ipapi.co which supports CORS
        const response = await fetch('https://ipapi.co/json/');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setAdd({
          country: data.country_name || "United States", // Use country_name instead of country_code
          city: data.city,
          region: data.region
        });
      } catch (error) {
        console.warn("Gagal memeroleh lokasi, pakai lokasi default:", error.message);
        setAdd({ country: "United States" }); // Fallback to full name
      }
    };

    fetchLocation();
  }, []);

  return add;
}

export default GetCurrentAddress;