import React, { useRef, forwardRef, useImperativeHandle, useState, useEffect } from "react";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import ClassicEditor from "@ckeditor/ckeditor5-build-classic";

const RichTextEditor = forwardRef(({ 
    label, 
    value, 
    onChange, 
    errors = [], 
    warnings = [], 
    required = false,
    helpText,
    placeholder = ""
}, ref) => {
    const editorRef = useRef(null);
    const [isEditorReady, setIsEditorReady] = useState(false);
    const [editorInstance, setEditorInstance] = useState(null);
    const mountedRef = useRef(true);
    // Ensure initial value is always a string
    const initialValueRef = useRef(typeof value === 'string' ? value : (value || ''));
    const isInternalChangeRef = useRef(false);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Only update editor when value changes externally AND significantly
    useEffect(() => {
        if (!editorInstance || !isEditorReady || isInternalChangeRef.current) {
            return;
        }

        try {
            const currentData = editorInstance.getData();
            
            // Ensure value is a string
            const newValue = typeof value === 'string' ? value : (value || '');
            
            // Ensure currentData is a string (guard against undefined)
            const currentDataStr = typeof currentData === 'string' ? currentData : '';
            
            // Only update if it's a significant external change
            // (not just from typing - e.g., form reset, loading saved data)
            const isSignificantChange = newValue !== currentDataStr && (
                currentDataStr === '' ||  // Editor is empty
                newValue === '' ||        // Value is being cleared
                Math.abs(newValue.length - currentDataStr.length) > 50  // Large difference
            );

            if (isSignificantChange) {
                editorInstance.setData(newValue);
            }
        } catch (error) {
            console.error('[RichTextEditor] Error in useEffect:', error);
        }
    }, [value, editorInstance, isEditorReady]);

    // Expose focus method to parent component
    useImperativeHandle(ref, () => ({
        focus: () => {
            if (editorInstance && isEditorReady) {
                try {
                    editorInstance.editing.view.focus();
                } catch (e) {
                    console.warn('Could not focus editor:', e);
                }
            }
        },
        scrollIntoView: (options) => {
            if (editorRef.current) {
                editorRef.current.scrollIntoView(options);
            }
        }
    }));

    const getEditorClass = () => {
        if (errors && errors.length > 0) return "border border-danger rounded";
        if (warnings && warnings.length > 0) return "border border-warning rounded";
        if (value && typeof value === 'string' && value.trim()) return "border border-success rounded";
        return "";
    };

    const getCharacterCount = () => {
        // Ensure value is a string before calling replace
        if (typeof value === 'string') {
            return value.replace(/<[^>]*>/g, '').length;
        }
        return 0;
    };

    const handleEditorReady = (editor) => {
        editorRef.current = editor;
        setEditorInstance(editor);
        setIsEditorReady(true);
        
        // Set initial value - ensure it's a string
        const initialData = typeof initialValueRef.current === 'string' ? initialValueRef.current : '';
        if (initialData) {
            try {
                editor.setData(initialData);
            } catch (error) {
                console.error('[RichTextEditor] Error setting initial data:', error);
            }
        }
    };

    const handleEditorChange = (event, editor) => {
        if (!editor || typeof editor.getData !== 'function') {
            console.warn('[RichTextEditor] Invalid editor in handleEditorChange');
            return;
        }

        try {
            // Mark as internal change to prevent useEffect from interfering
            isInternalChangeRef.current = true;
            
            // Get the data from editor as a string
            const editorData = editor.getData();
            
            // Validate that we have string data
            if (typeof editorData !== 'string') {
                console.error('[RichTextEditor] Editor data is not a string:', typeof editorData);
                return;
            }
            
            // Call parent onChange with just the string data
            // This makes the API simpler and prevents type errors in validation
            onChange(editorData);
            
            // Reset flag after a delay
            setTimeout(() => {
                if (mountedRef.current) {
                    isInternalChangeRef.current = false;
                }
            }, 100);
        } catch (error) {
            console.error('[RichTextEditor] Error in handleEditorChange:', error);
            // Reset flag even on error to prevent getting stuck
            isInternalChangeRef.current = false;
        }
    };

    return (
        <div className="mb-3" ref={editorRef}>
            <label className="form-label">
                <i className="fas fa-pen me-2"></i>
                {label}
                {required && <span className="text-danger ms-1">*</span>}
                {warnings.length > 0 && <span className="text-warning ms-1">*</span>}
            </label>
            
            <div className={`ckeditor-container ${getEditorClass()}`}>
                <CKEditor
                    editor={ClassicEditor}
                    data={typeof initialValueRef.current === 'string' ? initialValueRef.current : ''}
                    onChange={handleEditorChange}
                    onReady={handleEditorReady}
                    config={{
                        toolbar: [
                            "heading",
                            "|",
                            "bold", "italic",
                            "|",
                            "bulletedList", "numberedList",
                            "|",
                            "undo", "redo",
                            "|",
                            "link"
                        ],
                        // ✨ PHASE 4.70: Ensure placeholder is always a valid string
                        placeholder: (typeof placeholder === 'string' ? placeholder : "").trim() || "Masukkan konten...",
                        // Additional config for better performance
                        autosave: {
                            save(editor) {
                                // Prevent autosave interference
                                return Promise.resolve();
                            }
                        }
                    }}
                />
            </div>
            
            {/* Character count and Help text */}
            <div className="d-flex justify-content-between align-items-center mt-2">
                <div>
                    {helpText && (
                        <small className="text-muted d-flex align-items-center">
                            <i className="fas fa-info-circle me-1"></i>
                            {helpText}
                        </small>
                    )}
                </div>
                <small className="text-muted">
                    <i className="fas fa-keyboard me-1"></i>
                    {getCharacterCount()} karakter
                </small>
            </div>
            
            {/* Error Messages */}
            {errors?.map((error, index) => (
                <div key={index} className="invalid-feedback d-block">
                    <i className="fas fa-exclamation-circle me-1"></i>
                    {error}
                </div>
            ))}
            
            {/* Warning Messages */}
            {warnings?.map((warning, index) => (
                <div key={index} className="warning-feedback d-block">
                    <i className="fas fa-exclamation-triangle me-1"></i>
                    {warning}
                </div>
            ))}
        </div>
    );
});

// Add display name for better debugging
RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;