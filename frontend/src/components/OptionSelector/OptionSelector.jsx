import React, { useState, useEffect, useRef, useMemo } from "react";
import "./OptionSelector.css";

/**
 * Generic Option Selector Component with Search
 * Similar to CountrySelector but for any list of options
 * 
 * Props:
 * - value: selected value (string)
 * - onChange: handler for selection change
 * - options: array of {id/value, name/label} objects or simple strings
 * - name: field name
 * - id: field id
 * - label: field label
 * - icon: FontAwesome icon class
 * - placeholder: search placeholder text
 * - required: is field required
 * - disabled: is field disabled
 * - displayKey: which key to display from option object (default: 'name')
 * - valueKey: which key to use as value from option object (default: 'id')
 */
const OptionSelector = ({
    value = "",
    onChange = () => {},
    options = [],
    name = "",
    id = "",
    label = "",
    icon = "fas fa-list",
    placeholder = "Cari...",
    required = false,
    disabled = false,
    displayKey = "name",
    valueKey = "id",
    onBlur = () => {},
    isLoading = false  // ✨ PHASE 11.9: Add loading state to suppress warning while fetching
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedOption, setSelectedOption] = useState(null);
    const [filteredOptions, setFilteredOptions] = useState(options);
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);

    // Initialize selected option when value or options change
    useEffect(() => {
        console.log(`🔍 OptionSelector "${label}" value matching:`, {
            componentId: id,
            value,
            valueType: typeof value,
            valueLength: value?.length,
            optionsCount: options.length,
            optionsArray: options,
            valueKey,
            displayKey
        });
        
        if (value && options.length > 0) {
            const selected = options.find(opt => {
                const optionValue = typeof opt === 'string' ? opt : opt[valueKey];
                const match = optionValue === value;
                if (!match) {
                    console.log(`   Checking "${optionValue}" === "${value}": ${match}`);
                }
                return match;
            });
            console.log(`   ✅ Selected option found:`, selected);
            setSelectedOption(selected || null);
        } else {
            console.log(`   ⚠️ No match: value="${value}", optionsLength=${options.length}`);
            setSelectedOption(null);
        }
    }, [value, options, valueKey, label, id, displayKey]);

    // Filter options based on search term
    useMemo(() => {
        if (!searchTerm) {
            setFilteredOptions(options);
        } else {
            const lowerSearch = searchTerm.toLowerCase();
            setFilteredOptions(
                options.filter(opt => {
                    const displayValue = typeof opt === 'string' ? opt : opt[displayKey];
                    return displayValue.toLowerCase().includes(lowerSearch);
                })
            );
        }
    }, [searchTerm, options, displayKey]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Handle option selection
    const handleSelectOption = (option) => {
        setSelectedOption(option);
        const optionValue = typeof option === 'string' ? option : option[valueKey];
        
        console.log(`✅ Option selected in "${label}":`, {
            option,
            optionValue,
            valueKey,
            event: { name, value: optionValue }
        });
        
        // Create synthetic event for onChange handler
        const event = {
            target: {
                name: name,
                value: optionValue
            }
        };
        onChange(event);
        setIsOpen(false);
        setSearchTerm("");
        
        // Call onBlur if provided
        if (onBlur) {
            onBlur(event);
        }
    };

    // Get display value for selected option
    const getDisplayValue = () => {
        if (!selectedOption) return "";
        return typeof selectedOption === 'string' ? selectedOption : selectedOption[displayKey];
    };

    // Show loading state
    if (!options || options.length === 0) {
        const optionCount = options ? options.length : 0;
        // ✨ PHASE 11.9: Only warn if not loading (avoid false warnings while data is being fetched)
        if (!isLoading) {
            console.warn(`⚠️ OptionSelector "${label}" (id="${id}") has ${optionCount} options.`, {
                received: options,
                displayKey,
                valueKey,
                currentValue: value
            });
        }
        return (
            <div className="form-field-container">
                <label className="form-label modern-label" htmlFor={id}>
                    <i className={`${icon} form-label-icon`}></i>
                    {label} {required && <span className="required-asterisk">*</span>}
                </label>
                <div className="option-selector-container loading" style={{ opacity: 0.6 }}>
                    <input
                        type="text"
                        disabled={true}
                        placeholder="Memuat opsi..."
                        className="form-control modern-input"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="form-field-container">
            <label className="form-label modern-label" htmlFor={id}>
                <i className={`${icon} form-label-icon`}></i>
                {label} {required && <span className="required-asterisk">*</span>}
            </label>
            
            <div
                className="option-selector-container"
                ref={containerRef}
                style={{ position: "relative", width: "100%" }}
            >
                {/* Selector Input */}
                <div
                    className={`option-selector-input ${isOpen ? "active" : ""} ${disabled ? "disabled" : ""}`}
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    style={{
                        position: "relative",
                        cursor: disabled ? "not-allowed" : "pointer",
                        opacity: disabled ? 0.6 : 1
                    }}
                >
                    <input
                        ref={inputRef}
                        type="text"
                        id={id}
                        name={name}
                        value={isOpen ? searchTerm : getDisplayValue()}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            if (!isOpen) setIsOpen(true);
                        }}
                        placeholder={isOpen ? placeholder : "Pilih..."}
                        className="form-control modern-input"
                        disabled={disabled}
                        required={required}
                        autoComplete="off"
                        style={{
                            paddingRight: "35px"
                        }}
                    />
                    {/* Dropdown Arrow */}
                    <i
                        className={`fas fa-chevron-down option-selector-arrow ${isOpen ? "open" : ""}`}
                        style={{
                            position: "absolute",
                            right: "12px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            pointerEvents: "none",
                            color: "#667eea",
                            transition: "transform 0.2s"
                        }}
                    ></i>
                </div>

                {/* Dropdown Menu */}
                {isOpen && (
                    <div
                        ref={dropdownRef}
                        className="option-selector-dropdown"
                        style={{
                            position: "absolute",
                            top: "calc(100% + 5px)",
                            left: 0,
                            right: 0,
                            background: "white",
                            border: "1px solid #e0e0e0",
                            borderRadius: "10px",
                            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
                            zIndex: 1000,
                            maxHeight: "300px",
                            overflowY: "auto",
                            animation: "slideDown 0.2s ease-out"
                        }}
                    >
                        {filteredOptions.length === 0 ? (
                            <div
                                style={{
                                    padding: "20px",
                                    textAlign: "center",
                                    color: "#999",
                                    fontSize: "0.95rem"
                                }}
                            >
                                <i
                                    className="fas fa-search"
                                    style={{ marginRight: "8px" }}
                                ></i>
                                Tidak ada hasil
                            </div>
                        ) : (
                            filteredOptions.map((option, index) => {
                                const optionValue = typeof option === 'string' ? option : option[valueKey];
                                const displayValue = typeof option === 'string' ? option : option[displayKey];
                                const isSelected = selectedOption && (
                                    typeof selectedOption === 'string'
                                        ? selectedOption === optionValue
                                        : selectedOption[valueKey] === optionValue
                                );

                                return (
                                    <div
                                        key={index}
                                        className={`option-selector-item ${isSelected ? "selected" : ""}`}
                                        onClick={() => handleSelectOption(option)}
                                        style={{
                                            padding: "12px 16px",
                                            cursor: "pointer",
                                            background: isSelected ? "#f0f0f0" : "transparent",
                                            borderLeft: isSelected ? "4px solid #667eea" : "4px solid transparent",
                                            transition: "all 0.2s",
                                            fontSize: "0.95rem"
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = "#f9f9f9";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = isSelected ? "#f0f0f0" : "transparent";
                                        }}
                                    >
                                        {isSelected && (
                                            <i
                                                className="fas fa-check"
                                                style={{
                                                    color: "#667eea",
                                                    marginRight: "10px",
                                                    fontWeight: "bold"
                                                }}
                                            ></i>
                                        )}
                                        {displayValue}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(OptionSelector);
