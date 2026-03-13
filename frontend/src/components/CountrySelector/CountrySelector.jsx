import React, { useState, useEffect, useRef, useMemo } from "react";
import "./CountrySelector.css";

// Comprehensive list of countries with their codes
const COUNTRIES = [
    { code: "AF", name: "Afghanistan", flag: "🇦🇫" },
    { code: "AL", name: "Albania", flag: "🇦🇱" },
    { code: "DZ", name: "Algeria", flag: "🇩🇿" },
    { code: "AD", name: "Andorra", flag: "🇦🇩" },
    { code: "AO", name: "Angola", flag: "🇦🇴" },
    { code: "AR", name: "Argentina", flag: "🇦🇷" },
    { code: "AM", name: "Armenia", flag: "🇦🇲" },
    { code: "AU", name: "Australia", flag: "🇦🇺" },
    { code: "AT", name: "Austria", flag: "🇦🇹" },
    { code: "AZ", name: "Azerbaijan", flag: "🇦🇿" },
    { code: "BH", name: "Bahrain", flag: "🇧🇭" },
    { code: "BD", name: "Bangladesh", flag: "🇧🇩" },
    { code: "BY", name: "Belarus", flag: "🇧🇾" },
    { code: "BE", name: "Belgium", flag: "🇧🇪" },
    { code: "BZ", name: "Belize", flag: "🇧🇿" },
    { code: "BJ", name: "Benin", flag: "🇧🇯" },
    { code: "BT", name: "Bhutan", flag: "🇧🇹" },
    { code: "BO", name: "Bolivia", flag: "🇧🇴" },
    { code: "BA", name: "Bosnia and Herzegovina", flag: "🇧🇦" },
    { code: "BW", name: "Botswana", flag: "🇧🇼" },
    { code: "BR", name: "Brazil", flag: "🇧🇷" },
    { code: "BN", name: "Brunei", flag: "🇧🇳" },
    { code: "BG", name: "Bulgaria", flag: "🇧🇬" },
    { code: "BF", name: "Burkina Faso", flag: "🇧🇫" },
    { code: "BI", name: "Burundi", flag: "🇧🇮" },
    { code: "KH", name: "Cambodia", flag: "🇰🇭" },
    { code: "CM", name: "Cameroon", flag: "🇨🇲" },
    { code: "CA", name: "Canada", flag: "🇨🇦" },
    { code: "CV", name: "Cape Verde", flag: "🇨🇻" },
    { code: "CF", name: "Central African Republic", flag: "🇨🇫" },
    { code: "TD", name: "Chad", flag: "🇹🇩" },
    { code: "CL", name: "Chile", flag: "🇨🇱" },
    { code: "CN", name: "China", flag: "🇨🇳" },
    { code: "CO", name: "Colombia", flag: "🇨🇴" },
    { code: "KM", name: "Comoros", flag: "🇰🇲" },
    { code: "CG", name: "Congo", flag: "🇨🇬" },
    { code: "CR", name: "Costa Rica", flag: "🇨🇷" },
    { code: "HR", name: "Croatia", flag: "🇭🇷" },
    { code: "CU", name: "Cuba", flag: "🇨🇺" },
    { code: "CY", name: "Cyprus", flag: "🇨🇾" },
    { code: "CZ", name: "Czech Republic", flag: "🇨🇿" },
    { code: "DK", name: "Denmark", flag: "🇩🇰" },
    { code: "DJ", name: "Djibouti", flag: "🇩🇯" },
    { code: "DO", name: "Dominican Republic", flag: "🇩🇴" },
    { code: "EC", name: "Ecuador", flag: "🇪🇨" },
    { code: "EG", name: "Egypt", flag: "🇪🇬" },
    { code: "SV", name: "El Salvador", flag: "🇸🇻" },
    { code: "GQ", name: "Equatorial Guinea", flag: "🇬🇶" },
    { code: "ER", name: "Eritrea", flag: "🇪🇷" },
    { code: "EE", name: "Estonia", flag: "🇪🇪" },
    { code: "ET", name: "Ethiopia", flag: "🇪🇹" },
    { code: "FJ", name: "Fiji", flag: "🇫🇯" },
    { code: "FI", name: "Finland", flag: "🇫🇮" },
    { code: "FR", name: "France", flag: "🇫🇷" },
    { code: "GA", name: "Gabon", flag: "🇬🇦" },
    { code: "GM", name: "Gambia", flag: "🇬🇲" },
    { code: "GE", name: "Georgia", flag: "🇬🇪" },
    { code: "DE", name: "Germany", flag: "🇩🇪" },
    { code: "GH", name: "Ghana", flag: "🇬🇭" },
    { code: "GR", name: "Greece", flag: "🇬🇷" },
    { code: "GT", name: "Guatemala", flag: "🇬🇹" },
    { code: "GN", name: "Guinea", flag: "🇬🇳" },
    { code: "GW", name: "Guinea-Bissau", flag: "🇬🇼" },
    { code: "GY", name: "Guyana", flag: "🇬🇾" },
    { code: "HT", name: "Haiti", flag: "🇭🇹" },
    { code: "HN", name: "Honduras", flag: "🇭🇳" },
    { code: "HU", name: "Hungary", flag: "🇭🇺" },
    { code: "IS", name: "Iceland", flag: "🇮🇸" },
    { code: "IN", name: "India", flag: "🇮🇳" },
    { code: "ID", name: "Indonesia", flag: "🇮🇩" },
    { code: "IR", name: "Iran", flag: "🇮🇷" },
    { code: "IQ", name: "Iraq", flag: "🇮🇶" },
    { code: "IE", name: "Ireland", flag: "🇮🇪" },
    { code: "IL", name: "Israel", flag: "🇮🇱" },
    { code: "IT", name: "Italy", flag: "🇮🇹" },
    { code: "CI", name: "Ivory Coast", flag: "🇨🇮" },
    { code: "JM", name: "Jamaica", flag: "🇯🇲" },
    { code: "JP", name: "Japan", flag: "🇯🇵" },
    { code: "JO", name: "Jordan", flag: "🇯🇴" },
    { code: "KZ", name: "Kazakhstan", flag: "🇰🇿" },
    { code: "KE", name: "Kenya", flag: "🇰🇪" },
    { code: "KI", name: "Kiribati", flag: "🇰🇮" },
    { code: "KW", name: "Kuwait", flag: "🇰🇼" },
    { code: "KG", name: "Kyrgyzstan", flag: "🇰🇬" },
    { code: "LA", name: "Laos", flag: "🇱🇦" },
    { code: "LV", name: "Latvia", flag: "🇱🇻" },
    { code: "LB", name: "Lebanon", flag: "🇱🇧" },
    { code: "LS", name: "Lesotho", flag: "🇱🇸" },
    { code: "LR", name: "Liberia", flag: "🇱🇷" },
    { code: "LY", name: "Libya", flag: "🇱🇾" },
    { code: "LI", name: "Liechtenstein", flag: "🇱🇮" },
    { code: "LT", name: "Lithuania", flag: "🇱🇹" },
    { code: "LU", name: "Luxembourg", flag: "🇱🇺" },
    { code: "MG", name: "Madagascar", flag: "🇲🇬" },
    { code: "MW", name: "Malawi", flag: "🇲🇼" },
    { code: "MY", name: "Malaysia", flag: "🇲🇾" },
    { code: "MV", name: "Maldives", flag: "🇲🇻" },
    { code: "ML", name: "Mali", flag: "🇲🇱" },
    { code: "MT", name: "Malta", flag: "🇲🇹" },
    { code: "MH", name: "Marshall Islands", flag: "🇲🇭" },
    { code: "MR", name: "Mauritania", flag: "🇲🇷" },
    { code: "MU", name: "Mauritius", flag: "🇲🇺" },
    { code: "MX", name: "Mexico", flag: "🇲🇽" },
    { code: "FM", name: "Micronesia", flag: "🇫🇲" },
    { code: "MD", name: "Moldova", flag: "🇲🇩" },
    { code: "MC", name: "Monaco", flag: "🇲🇨" },
    { code: "MN", name: "Mongolia", flag: "🇲🇳" },
    { code: "ME", name: "Montenegro", flag: "🇲🇪" },
    { code: "MA", name: "Morocco", flag: "🇲🇦" },
    { code: "MZ", name: "Mozambique", flag: "🇲🇿" },
    { code: "MM", name: "Myanmar", flag: "🇲🇲" },
    { code: "NA", name: "Namibia", flag: "🇳🇦" },
    { code: "NR", name: "Nauru", flag: "🇳🇷" },
    { code: "NP", name: "Nepal", flag: "🇳🇵" },
    { code: "NL", name: "Netherlands", flag: "🇳🇱" },
    { code: "NZ", name: "New Zealand", flag: "🇳🇿" },
    { code: "NI", name: "Nicaragua", flag: "🇳🇮" },
    { code: "NE", name: "Niger", flag: "🇳🇪" },
    { code: "NG", name: "Nigeria", flag: "🇳🇬" },
    { code: "KP", name: "North Korea", flag: "🇰🇵" },
    { code: "MK", name: "North Macedonia", flag: "🇲🇰" },
    { code: "NO", name: "Norway", flag: "🇳🇴" },
    { code: "OM", name: "Oman", flag: "🇴🇲" },
    { code: "PK", name: "Pakistan", flag: "🇵🇰" },
    { code: "PW", name: "Palau", flag: "🇵🇼" },
    { code: "PS", name: "Palestine", flag: "🇵🇸" },
    { code: "PA", name: "Panama", flag: "🇵🇦" },
    { code: "PG", name: "Papua New Guinea", flag: "🇵🇬" },
    { code: "PY", name: "Paraguay", flag: "🇵🇾" },
    { code: "PE", name: "Peru", flag: "🇵🇪" },
    { code: "PH", name: "Philippines", flag: "🇵🇭" },
    { code: "PL", name: "Poland", flag: "🇵🇱" },
    { code: "PT", name: "Portugal", flag: "🇵🇹" },
    { code: "QA", name: "Qatar", flag: "🇶🇦" },
    { code: "RO", name: "Romania", flag: "🇷🇴" },
    { code: "RU", name: "Russia", flag: "🇷🇺" },
    { code: "RW", name: "Rwanda", flag: "🇷🇼" },
    { code: "KN", name: "Saint Kitts and Nevis", flag: "🇰🇳" },
    { code: "LC", name: "Saint Lucia", flag: "🇱🇨" },
    { code: "VC", name: "Saint Vincent and the Grenadines", flag: "🇻🇨" },
    { code: "WS", name: "Samoa", flag: "🇼🇸" },
    { code: "SM", name: "San Marino", flag: "🇸🇲" },
    { code: "ST", name: "Sao Tome and Principe", flag: "🇸🇹" },
    { code: "SA", name: "Saudi Arabia", flag: "🇸🇦" },
    { code: "SN", name: "Senegal", flag: "🇸🇳" },
    { code: "RS", name: "Serbia", flag: "🇷🇸" },
    { code: "SC", name: "Seychelles", flag: "🇸🇨" },
    { code: "SL", name: "Sierra Leone", flag: "🇸🇱" },
    { code: "SG", name: "Singapore", flag: "🇸🇬" },
    { code: "SK", name: "Slovakia", flag: "🇸🇰" },
    { code: "SI", name: "Slovenia", flag: "🇸🇮" },
    { code: "SB", name: "Solomon Islands", flag: "🇸🇧" },
    { code: "SO", name: "Somalia", flag: "🇸🇴" },
    { code: "ZA", name: "South Africa", flag: "🇿🇦" },
    { code: "KR", name: "South Korea", flag: "🇰🇷" },
    { code: "SS", name: "South Sudan", flag: "🇸🇸" },
    { code: "ES", name: "Spain", flag: "🇪🇸" },
    { code: "LK", name: "Sri Lanka", flag: "🇱🇰" },
    { code: "SD", name: "Sudan", flag: "🇸🇩" },
    { code: "SR", name: "Suriname", flag: "🇸🇷" },
    { code: "SE", name: "Sweden", flag: "🇸🇪" },
    { code: "CH", name: "Switzerland", flag: "🇨🇭" },
    { code: "SY", name: "Syria", flag: "🇸🇾" },
    { code: "TW", name: "Taiwan", flag: "🇹🇼" },
    { code: "TJ", name: "Tajikistan", flag: "🇹🇯" },
    { code: "TZ", name: "Tanzania", flag: "🇹🇿" },
    { code: "TH", name: "Thailand", flag: "🇹🇭" },
    { code: "TL", name: "Timor-Leste", flag: "🇹🇱" },
    { code: "TG", name: "Togo", flag: "🇹🇬" },
    { code: "TO", name: "Tonga", flag: "🇹🇴" },
    { code: "TT", name: "Trinidad and Tobago", flag: "🇹🇹" },
    { code: "TN", name: "Tunisia", flag: "🇹🇳" },
    { code: "TR", name: "Turkey", flag: "🇹🇷" },
    { code: "TM", name: "Turkmenistan", flag: "🇹🇲" },
    { code: "TV", name: "Tuvalu", flag: "🇹🇻" },
    { code: "UG", name: "Uganda", flag: "🇺🇬" },
    { code: "UA", name: "Ukraine", flag: "🇺🇦" },
    { code: "AE", name: "United Arab Emirates", flag: "🇦🇪" },
    { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
    { code: "US", name: "United States", flag: "🇺🇸" },
    { code: "UY", name: "Uruguay", flag: "🇺🇾" },
    { code: "UZ", name: "Uzbekistan", flag: "🇺🇿" },
    { code: "VU", name: "Vanuatu", flag: "🇻🇺" },
    { code: "VA", name: "Vatican City", flag: "🇻🇦" },
    { code: "VE", name: "Venezuela", flag: "🇻🇪" },
    { code: "VN", name: "Vietnam", flag: "🇻🇳" },
    { code: "YE", name: "Yemen", flag: "🇾🇪" },
    { code: "ZM", name: "Zambia", flag: "🇿🇲" },
    { code: "ZW", name: "Zimbabwe", flag: "🇿🇼" },
];

const CountrySelector = ({ 
    value = "", 
    onChange, 
    onBlur,
    name = "country",
    id = "country",
    required = true,
    disabled = false,
    placeholder = "Search for your country...",
    className = "",
    label = "Country",
    icon = "fas fa-globe"
}) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const dropdownRef = useRef(null);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    // Filter countries based on search term
    const filteredCountries = useMemo(() => {
        if (!searchTerm.trim()) return COUNTRIES;
        
        const search = searchTerm.toLowerCase();
        return COUNTRIES.filter(country => 
            country.name.toLowerCase().includes(search) ||
            country.code.toLowerCase().includes(search)
        );
    }, [searchTerm]);

    // Get selected country object
    const selectedCountry = useMemo(() => {
        return COUNTRIES.find(c => c.name === value);
    }, [value]);

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchTerm("");
                setHighlightedIndex(-1);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Handle keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            // Skip keyboard shortcuts when specific form fields are focused (like country search input)
            const activeElement = document.activeElement;
            const isCountrySelectorInput = activeElement?.className?.includes('country-selector-input');
            
            // Allow arrow keys and escape in the selector, but still check if it's the input field
            if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Escape") {
                // These are OK to handle globally for the selector
            } else if (isCountrySelectorInput) {
                // For other keys, skip if in the search input (let the input handle them)
                return;
            }
            
            switch (e.key) {
                case "ArrowDown":
                    e.preventDefault();
                    setHighlightedIndex(prev => 
                        prev < filteredCountries.length - 1 ? prev + 1 : 0
                    );
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    setHighlightedIndex(prev => 
                        prev > 0 ? prev - 1 : filteredCountries.length - 1
                    );
                    break;
                case "Enter":
                    e.preventDefault();
                    if (highlightedIndex >= 0 && filteredCountries[highlightedIndex]) {
                        handleSelect(filteredCountries[highlightedIndex]);
                    }
                    break;
                case "Escape":
                    setIsOpen(false);
                    setSearchTerm("");
                    setHighlightedIndex(-1);
                    break;
                default:
                    break;
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, highlightedIndex, filteredCountries]);

    // Scroll highlighted item into view
    useEffect(() => {
        if (highlightedIndex >= 0 && listRef.current) {
            const highlightedElement = listRef.current.children[highlightedIndex];
            if (highlightedElement) {
                highlightedElement.scrollIntoView({
                    block: "nearest",
                    behavior: "smooth"
                });
            }
        }
    }, [highlightedIndex]);

    const handleSelect = (country) => {
        onChange({
            target: {
                name,
                value: country.name
            }
        });
        setIsOpen(false);
        setSearchTerm("");
        setHighlightedIndex(-1);
        
        // Trigger blur event if provided
        if (onBlur) {
            onBlur({ target: { name, value: country.name } });
        }
    };

    const handleInputClick = () => {
        if (!disabled) {
            setIsOpen(!isOpen);
            if (!isOpen) {
                setSearchTerm("");
            }
        }
    };

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
        setHighlightedIndex(-1);
        if (!isOpen) {
            setIsOpen(true);
        }
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onChange({
            target: {
                name,
                value: ""
            }
        });
        setSearchTerm("");
        setIsOpen(false);
        if (onBlur) {
            onBlur({ target: { name, value: "" } });
        }
    };

    return (
        <div className={`country-selector-wrapper ${className}`} ref={dropdownRef}>
            {label && (
                <label className="form-label modern-label" htmlFor={id}>
                    <i className={`${icon} form-label-icon`}></i>
                    {label} {required && <span className="required-asterisk">*</span>}
                </label>
            )}
            
            <div className={`country-selector ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}>
                <div 
                    className="country-selector-input-wrapper"
                    onClick={handleInputClick}
                >
                    {selectedCountry && !isOpen ? (
                        <div className="country-selector-selected">
                            <span className="country-flag">{selectedCountry.flag}</span>
                            <span className="country-name">{selectedCountry.name}</span>
                        </div>
                    ) : (
                        <input
                            ref={inputRef}
                            type="text"
                            className="form-control modern-input country-selector-search"
                            placeholder={placeholder}
                            value={searchTerm}
                            onChange={handleSearchChange}
                            disabled={disabled}
                            autoComplete="off"
                        />
                    )}
                    
                    <div className="country-selector-icons">
                        {value && !disabled && (
                            <button
                                type="button"
                                className="country-selector-clear"
                                onClick={handleClear}
                                tabIndex={-1}
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        )}
                        <span className={`country-selector-arrow ${isOpen ? 'open' : ''}`}>
                            <i className="fas fa-chevron-down"></i>
                        </span>
                    </div>
                </div>

                {isOpen && (
                    <div className="country-selector-dropdown">
                        {filteredCountries.length > 0 ? (
                            <ul className="country-selector-list" ref={listRef}>
                                {filteredCountries.map((country, index) => (
                                    <li
                                        key={country.code}
                                        className={`country-selector-item ${
                                            index === highlightedIndex ? 'highlighted' : ''
                                        } ${value === country.name ? 'selected' : ''}`}
                                        onClick={() => handleSelect(country)}
                                        onMouseEnter={() => setHighlightedIndex(index)}
                                    >
                                        <span className="country-flag">{country.flag}</span>
                                        <span className="country-name">{country.name}</span>
                                        {value === country.name && (
                                            <span className="country-checkmark">
                                                <i className="fas fa-check"></i>
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="country-selector-no-results">
                                <i className="fas fa-search"></i>
                                <p>No countries found</p>
                                <small>Try a different search term</small>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Hidden input for form validation */}
            <input
                type="hidden"
                name={name}
                id={id}
                value={value}
                required={required}
            />
        </div>
    );
};

export default React.memo(CountrySelector);
