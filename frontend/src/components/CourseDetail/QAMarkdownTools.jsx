import React from "react";

/**
 * Format total seconds to MM:SS or HH:MM:SS
 */
export const formatTimestamp = (totalSeconds) => {
    if (isNaN(totalSeconds) || totalSeconds === null || totalSeconds === undefined) return "00:00";
    const sec = Math.max(0, Math.floor(Number(totalSeconds)));
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = sec % 60;
    if (hours > 0) {
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

/**
 * Parse MM:SS or HH:MM:SS string to seconds
 */
export const parseTimeToSeconds = (timeStr) => {
    if (!timeStr) return 0;
    const clean = String(timeStr).trim().replace(/[\[\]]/g, "");
    const parts = clean.split(":").map(Number);
    if (parts.some(isNaN)) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 1) return parts[0];
    return 0;
};

/**
 * Formatting Toolbar for Question and Reply form with live preview toggle
 */
export const QAFormattingToolbar = ({
    textareaRef,
    value,
    onChange,
    isPreview = false,
    onTogglePreview,
    getCurrentVideoTime,
    showTimestampBtn = true,
    compact = false,
}) => {
    const handleInsert = (formatType) => {
        // If in preview mode, switch to edit mode first
        if (isPreview && onTogglePreview) {
            onTogglePreview(false);
        }

        const textarea = textareaRef?.current;
        if (!textarea) return;

        const start = textarea.selectionStart || 0;
        const end = textarea.selectionEnd || 0;
        const currentText = value || "";
        const selected = currentText.substring(start, end);

        let before = currentText.substring(0, start);
        let after = currentText.substring(end);
        let replacement = "";
        let cursorOffset = 0;

        switch (formatType) {
            case "bold":
                replacement = `**${selected || "teks tebal"}**`;
                cursorOffset = selected ? replacement.length : 2;
                break;
            case "italic":
                replacement = `*${selected || "teks miring"}*`;
                cursorOffset = selected ? replacement.length : 1;
                break;
            case "code":
                replacement = `\`${selected || "kode"}\``;
                cursorOffset = selected ? replacement.length : 1;
                break;
            case "codeblock":
                replacement = `\n\`\`\`\n${selected || "// tulis kode di sini"}\n\`\`\`\n`;
                cursorOffset = selected ? replacement.length : 5;
                break;
            case "quote":
                replacement = `\n> ${selected || "Kutipan teks"}\n`;
                cursorOffset = selected ? replacement.length : 3;
                break;
            case "ul":
                replacement = `\n- ${selected || "Poin daftar"}\n`;
                cursorOffset = selected ? replacement.length : 3;
                break;
            case "ol":
                replacement = `\n1. ${selected || "Poin berurutan"}\n`;
                cursorOffset = selected ? replacement.length : 4;
                break;
            case "timestamp": {
                const curSeconds = getCurrentVideoTime ? getCurrentVideoTime() : 0;
                const formatted = formatTimestamp(curSeconds);
                replacement = ` [${formatted}] `;
                cursorOffset = replacement.length;
                break;
            }
            default:
                return;
        }

        const newText = before + replacement + after;
        if (onChange) {
            onChange(newText);
        }

        setTimeout(() => {
            if (textarea) {
                textarea.focus();
                textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
            }
        }, 30);
    };

    const currentVideoTimeFormatted = getCurrentVideoTime
        ? formatTimestamp(getCurrentVideoTime())
        : null;

    return (
        <div className={`qa-formatting-toolbar ${compact ? "qa-toolbar-compact" : ""}`}>
            {/* Action Buttons */}
            <div className="qa-toolbar-actions">
                <button
                    type="button"
                    className="qa-toolbar-btn"
                    title="Tebal (**teks**)"
                    onClick={() => handleInsert("bold")}
                >
                    <i className="fas fa-bold"></i>
                </button>
                <button
                    type="button"
                    className="qa-toolbar-btn"
                    title="Miring (*teks*)"
                    onClick={() => handleInsert("italic")}
                >
                    <i className="fas fa-italic"></i>
                </button>
                <span className="qa-toolbar-separator"></span>
                <button
                    type="button"
                    className="qa-toolbar-btn"
                    title="Daftar Poin (- Poin)"
                    onClick={() => handleInsert("ul")}
                >
                    <i className="fas fa-list-ul"></i>
                </button>
                <button
                    type="button"
                    className="qa-toolbar-btn"
                    title="Daftar Angka (1. Poin)"
                    onClick={() => handleInsert("ol")}
                >
                    <i className="fas fa-list-ol"></i>
                </button>
                <button
                    type="button"
                    className="qa-toolbar-btn"
                    title="Kutipan (> Kutipan)"
                    onClick={() => handleInsert("quote")}
                >
                    <i className="fas fa-quote-left"></i>
                </button>
                <span className="qa-toolbar-separator"></span>
                <button
                    type="button"
                    className="qa-toolbar-btn"
                    title="Kode Sebaris (`kode`)"
                    onClick={() => handleInsert("code")}
                >
                    <i className="fas fa-code"></i>
                </button>
                <button
                    type="button"
                    className="qa-toolbar-btn"
                    title="Blok Kode (```)"
                    onClick={() => handleInsert("codeblock")}
                >
                    <i className="fas fa-file-code"></i>
                </button>

                {showTimestampBtn && (
                    <>
                        <span className="qa-toolbar-separator"></span>
                        <button
                            type="button"
                            className="qa-toolbar-btn qa-toolbar-btn-timestamp"
                            title={`Sisipkan Waktu Video Saat Ini (${currentVideoTimeFormatted || "00:00"})`}
                            onClick={() => handleInsert("timestamp")}
                        >
                            <i className="fas fa-stopwatch me-1 text-teal"></i>
                            <span className="qa-timestamp-time-text">
                                {currentVideoTimeFormatted || "00:00"}
                            </span>
                        </button>
                    </>
                )}
            </div>

            {/* Mode Switch (Tulis / Pratinjau) */}
            <div className="qa-toolbar-modes">
                <button
                    type="button"
                    className={`qa-mode-tab-btn ${!isPreview ? "active" : ""}`}
                    onClick={() => onTogglePreview && onTogglePreview(false)}
                >
                    <i className="fas fa-pen-to-square me-1"></i>Tulis
                </button>
                <button
                    type="button"
                    className={`qa-mode-tab-btn ${isPreview ? "active" : ""}`}
                    onClick={() => onTogglePreview && onTogglePreview(true)}
                >
                    <i className="fas fa-eye me-1"></i>Pratinjau
                    {value && value.trim().length > 0 && (
                        <span className="qa-preview-dot"></span>
                    )}
                </button>
            </div>
        </div>
    );
};

/**
 * Clickable video timestamp badge for question cards or thread headers
 */
export const QAVideoTimestampBadge = ({
    timestamp,
    onClick,
    label,
    size = "sm",
}) => {
    if (timestamp === null || timestamp === undefined || isNaN(timestamp)) return null;

    const formatted = formatTimestamp(timestamp);
    const sizeClass = size === "lg" ? "qa-time-badge-lg" : size === "md" ? "qa-time-badge-md" : "qa-time-badge-sm";

    return (
        <button
            type="button"
            className={`qa-video-time-badge ${sizeClass}`}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onClick) onClick(Number(timestamp), formatted);
            }}
            title={`Lompat ke video menit ${formatted}`}
        >
            <i className="fas fa-play-circle me-1"></i>
            {label ? `${label} ${formatted}` : formatted}
        </button>
    );
};

/**
 * Safe markdown renderer with interactive video timestamps
 */
export const QAMarkdownRenderer = ({
    content,
    onTimestampClick,
    emptyPlaceholder = "Belum ada tulisan untuk dipratinjau.",
    className = "",
}) => {
    if (!content || !content.trim()) {
        return (
            <div className={`qa-markdown-empty ${className}`}>
                <i className="fas fa-pen-nib me-2 text-muted"></i>
                <span>{emptyPlaceholder}</span>
            </div>
        );
    }

    // Split content by code blocks: ```lang\ncode\n```
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
            parts.push({
                type: "text",
                content: content.substring(lastIndex, match.index),
            });
        }
        parts.push({
            type: "codeblock",
            lang: match[1],
            code: match[2],
        });
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
        parts.push({
            type: "text",
            content: content.substring(lastIndex),
        });
    }

    // Helper to render inline tokens: timestamps, bold, italic, inline code
    const renderInline = (text, keyPrefix) => {
        // Regex matches:
        // 1. Timestamps: [MM:SS] or MM:SS or [HH:MM:SS] or HH:MM:SS
        // 2. Bold: **...**
        // 3. Italic: *...*
        // 4. Inline code: `...`
        const tokenRegex = /((?:\[)?\b\d{1,2}:[0-5]\d(?::[0-5]\d)?\b(?:\])?)|(\*\*[^*]+\*\*)|(\*(?!\*)[^*]+\*)|(`[^`]+`)/g;

        const elements = [];
        let curIdx = 0;
        let m;

        while ((m = tokenRegex.exec(text)) !== null) {
            if (m.index > curIdx) {
                elements.push(text.substring(curIdx, m.index));
            }

            const token = m[0];
            const elemKey = `${keyPrefix}-${m.index}`;

            if (token.startsWith("**") && token.endsWith("**")) {
                elements.push(
                    <strong key={elemKey} className="qa-md-bold">
                        {token.slice(2, -2)}
                    </strong>
                );
            } else if (token.startsWith("*") && token.endsWith("*")) {
                elements.push(
                    <em key={elemKey} className="qa-md-italic">
                        {token.slice(1, -1)}
                    </em>
                );
            } else if (token.startsWith("`") && token.endsWith("`")) {
                elements.push(
                    <code key={elemKey} className="qa-md-inline-code">
                        {token.slice(1, -1)}
                    </code>
                );
            } else {
                // Timestamp token
                const cleanTime = token.replace(/[\[\]]/g, "");
                const seconds = parseTimeToSeconds(cleanTime);
                elements.push(
                    <button
                        key={elemKey}
                        type="button"
                        className="qa-timestamp-inline-btn"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (onTimestampClick) {
                                onTimestampClick(seconds, cleanTime);
                            }
                        }}
                        title={`Lompat ke video menit ${cleanTime}`}
                    >
                        <i className="fas fa-play-circle me-1"></i>
                        {cleanTime}
                    </button>
                );
            }

            curIdx = m.index + token.length;
        }

        if (curIdx < text.length) {
            elements.push(text.substring(curIdx));
        }

        return elements;
    };

    // Render regular text blocks (paragraphs, lists, blockquotes)
    const renderTextBlock = (textBlock, blockIdx) => {
        const lines = textBlock.split(/\r?\n/);
        const renderedNodes = [];
        let currentList = null;

        lines.forEach((line, lineIdx) => {
            const trimmed = line.trim();
            const nodeKey = `b${blockIdx}-l${lineIdx}`;

            if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                const itemContent = trimmed.substring(2);
                if (!currentList || currentList.type !== "ul") {
                    if (currentList) {
                        renderedNodes.push(
                            <ul key={currentList.key} className="qa-md-list">
                                {currentList.items}
                            </ul>
                        );
                    }
                    currentList = { type: "ul", items: [], key: nodeKey };
                }
                currentList.items.push(
                    <li key={`${nodeKey}-item`}>
                        {renderInline(itemContent, `${nodeKey}-i`)}
                    </li>
                );
            } else if (/^\d+\.\s/.test(trimmed)) {
                const itemContent = trimmed.replace(/^\d+\.\s/, "");
                if (!currentList || currentList.type !== "ol") {
                    if (currentList) {
                        renderedNodes.push(
                            <ol key={currentList.key} className="qa-md-list">
                                {currentList.items}
                            </ol>
                        );
                    }
                    currentList = { type: "ol", items: [], key: nodeKey };
                }
                currentList.items.push(
                    <li key={`${nodeKey}-item`}>
                        {renderInline(itemContent, `${nodeKey}-i`)}
                    </li>
                );
            } else {
                if (currentList) {
                    if (currentList.type === "ul") {
                        renderedNodes.push(
                            <ul key={currentList.key} className="qa-md-list">
                                {currentList.items}
                            </ul>
                        );
                    } else {
                        renderedNodes.push(
                            <ol key={currentList.key} className="qa-md-list">
                                {currentList.items}
                            </ol>
                        );
                    }
                    currentList = null;
                }

                if (trimmed.startsWith(">")) {
                    const quoteContent = trimmed.replace(/^>\s*/, "");
                    renderedNodes.push(
                        <blockquote key={nodeKey} className="qa-md-blockquote">
                            {renderInline(quoteContent, `${nodeKey}-q`)}
                        </blockquote>
                    );
                } else if (trimmed === "") {
                    // Empty line
                    renderedNodes.push(<div key={nodeKey} className="qa-md-line-break"></div>);
                } else {
                    renderedNodes.push(
                        <p key={nodeKey} className="qa-md-paragraph">
                            {renderInline(line, `${nodeKey}-p`)}
                        </p>
                    );
                }
            }
        });

        if (currentList) {
            if (currentList.type === "ul") {
                renderedNodes.push(
                    <ul key={currentList.key} className="qa-md-list">
                        {currentList.items}
                    </ul>
                );
            } else {
                renderedNodes.push(
                    <ol key={currentList.key} className="qa-md-list">
                        {currentList.items}
                    </ol>
                );
            }
        }

        return renderedNodes;
    };

    return (
        <div className={`qa-markdown-content ${className}`}>
            {parts.map((part, idx) => {
                if (part.type === "codeblock") {
                    return (
                        <div key={`cb-${idx}`} className="qa-md-codeblock-wrapper">
                            {part.lang && <div className="qa-md-code-lang">{part.lang}</div>}
                            <pre className="qa-md-pre">
                                <code>{part.code.trim()}</code>
                            </pre>
                        </div>
                    );
                }
                return renderTextBlock(part.content, idx);
            })}
        </div>
    );
};

export default {
    formatTimestamp,
    parseTimeToSeconds,
    QAFormattingToolbar,
    QAMarkdownRenderer,
    QAVideoTimestampBadge,
};

