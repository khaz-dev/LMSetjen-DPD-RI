import React, { forwardRef } from "react";

const FormField = forwardRef(({ 
    label, 
    name, 
    type = "text", 
    value, 
    onChange, 
    placeholder,
    required = false, 
    errors = [], 
    warnings = [], 
    helpText,
    options = [],
    getValidationClass,
    min,
    max,
    step,
    disabled = false,
    icon,
    className,
    children,
    ...props
}, ref) => {
    const inputClass = getValidationClass 
        ? getValidationClass(name, type === "select" ? "form-select" : "form-control")
        : (type === "select" ? "form-select" : "form-control");

    // Filter out props that shouldn't be passed to DOM elements
    const {
        // Remove custom props that aren't valid DOM attributes
        ...domProps
    } = props;

    const renderInput = () => {
        if (type === "select") {
            return (
                <select
                    ref={ref}
                    className={inputClass}
                    name={name}
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                    {...domProps}
                >
                    {options.map((option, index) => (
                        <option key={index} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            );
        }

        return (
            <input
                ref={ref}
                className={inputClass}
                type={type}
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                disabled={disabled}
                min={min}
                max={max}
                step={step}
                {...domProps}
            />
        );
    };

    return (
        <div className="mb-3">
            <label className="form-label">
                {icon && <i className={`${icon} me-2`}></i>}
                {label}
                {required && <span className="text-danger">*</span>}
                {warnings.length > 0 && <span className="text-warning">*</span>}
            </label>
            
            {children || renderInput()}
            
            {helpText && (
                <small className="text-muted">{helpText}</small>
            )}
            
            {/* Error Messages */}
            {errors?.map((error, index) => (
                <div key={index} className="invalid-feedback d-block">
                    <i className="fas fa-exclamation-circle me-1"></i>
                    {error}
                </div>
            ))}
            
            {/* Warning Messages */}
            {warnings?.map((warning, index) => (
                <div key={index} className="text-warning d-block">
                    <i className="fas fa-exclamation-triangle me-1"></i>
                    {warning}
                </div>
            ))}
        </div>
    );
});

FormField.displayName = "FormField";

export default FormField;