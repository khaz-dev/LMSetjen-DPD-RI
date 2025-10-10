import React from "react";

const CurriculumTab = ({ curriculum }) => {
    if (!curriculum || curriculum.length === 0) {
        return (
            <div className="tab-pane fade" id="course-pills-2" role="tabpanel" aria-labelledby="course-pills-tab-2">
                <p className="text-muted">No curriculum available for this course.</p>
            </div>
        );
    }

    return (
        <div className="tab-pane fade" id="course-pills-2" role="tabpanel" aria-labelledby="course-pills-tab-2">
            <div className="accordion accordion-icon accordion-bg-light" id="accordionExample2">
                {curriculum.map((section, index) => (
                    <div key={section.variant_id || index} className="accordion-item mb-3">
                        <h6 className="accordion-header font-base" id={`heading-${index}`}>
                            <button
                                className="accordion-button fw-bold rounded d-sm-flex d-inline-block collapsed"
                                type="button"
                                data-bs-toggle="collapse"
                                data-bs-target={`#collapse-${section.variant_id}`}
                                aria-expanded="true"
                                aria-controls={`collapse-${section.variant_id}`}
                            >
                                {section.title}
                            </button>
                        </h6>
                        <div
                            id={`collapse-${section.variant_id}`}
                            className="accordion-collapse collapse show"
                            aria-labelledby={`heading-${index}`}
                            data-bs-parent="#accordionExample2"
                        >
                            <div className="accordion-body mt-3">
                                {section.variant_items?.map((lesson, lessonIndex) => (
                                    <React.Fragment key={lessonIndex}>
                                        <div className="d-flex justify-content-between align-items-center">
                                            <div className="position-relative d-flex align-items-center">
                                                <a 
                                                    href="#" 
                                                    className="btn btn-danger-soft btn-round btn-sm mb-0 stretched-link position-static"
                                                >
                                                    <i className={`fas ${lesson.preview ? 'fa-play' : 'fa-lock'} me-0`} />
                                                </a>
                                                <span className="d-inline-block text-truncate ms-2 mb-0 h6 fw-light w-100px w-sm-200px w-md-400px">
                                                    {lesson.title}
                                                </span>
                                            </div>
                                            <p className="mb-0">{lesson.content_duration || "N/A"}</p>
                                        </div>
                                        {lessonIndex < section.variant_items.length - 1 && <hr />}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CurriculumTab;