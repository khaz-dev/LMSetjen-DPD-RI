import React, { useState } from "react";
import { useComingSoon } from "../../../components/ComingSoonModal";

const CourseFAQ = () => {
    const [activeIndex, setActiveIndex] = useState(null);
    const handleComingSoon = useComingSoon("Bonus Materials");

    const toggleFAQ = (index) => {
        setActiveIndex(activeIndex === index ? null : index);
    };

    const faqs = [
        {
            question: "What are the prerequisites for this course?",
            answer: "This course is designed for beginners and requires no prior programming experience. Basic computer literacy and familiarity with web browsers is helpful but not required. We'll guide you through everything step by step."
        },
        {
            question: "How long do I have access to the course?",
            answer: "You get lifetime access to this course! Once enrolled, you can access all course materials, including future updates, anytime and anywhere. There are no time restrictions or deadlines."
        },
        {
            question: "Can I download the course videos?",
            answer: "Yes, all course videos are available for download so you can learn offline. You'll also get access to downloadable resources including source code, project files, and additional reading materials."
        },
        {
            question: "Is there a certificate of completion?",
            answer: "Absolutely! Upon successful completion of the course, you'll receive a certificate of completion that you can add to your LinkedIn profile, resume, or portfolio to showcase your new skills."
        },
        {
            question: "What if I'm not satisfied with the course?",
            answer: "We offer a 30-day money-back guarantee. If you're not completely satisfied with the course within the first 30 days, you can request a full refund with no questions asked."
        },
        {
            question: "How much time should I dedicate to this course?",
            answer: "The course is self-paced, but we recommend dedicating 3-5 hours per week. Most students complete the course within 4-6 weeks. You can learn faster or slower based on your schedule and learning pace."
        },
        {
            question: "Do I need any special software or tools?",
            answer: "All you need is a computer with an internet connection and a web browser. We'll guide you through installing any free tools and software during the course. No expensive software licenses required."
        },
        {
            question: "Is there instructor support available?",
            answer: "Yes! You'll have access to instructor support through the course discussion forum. We typically respond to questions within 24 hours. You'll also have access to a community of fellow students."
        },
        {
            question: "Can I access this course on mobile devices?",
            answer: "Absolutely! The course is fully mobile-friendly. You can watch videos, read materials, and participate in discussions from your smartphone, tablet, or any device with internet access."
        }
    ];

    return (
        <div className="card border-0 shadow-sm mb-4">
            <div className="card-body p-4">
                <div className="text-center mb-5">
                    <h3 className="h4 fw-bold text-primary mb-3">
                        <i className="fas fa-question-circle me-3"></i>
                        Frequently Asked Questions
                    </h3>
                    <p className="text-muted">
                        Get answers to the most common questions about this course
                    </p>
                </div>

                <div className="row">
                    <div className="col-lg-8 mx-auto">
                        <div className="accordion" id="courseAccordion">
                            {faqs.map((faq, index) => (
                                <div key={index} className="accordion-item border border-light rounded-3 mb-3 shadow-sm">
                                    <h2 className="accordion-header">
                                        <button
                                            className={`accordion-button ${activeIndex !== index ? "collapsed" : ""} bg-light fw-semibold`}
                                            type="button"
                                            onClick={() => toggleFAQ(index)}
                                            style={{ borderRadius: "0.375rem" }}
                                        >
                                            <span className="me-3 text-primary">
                                                <i className={`fas fa-${activeIndex === index ? "minus" : "plus"}-circle`}></i>
                                            </span>
                                            {faq.question}
                                        </button>
                                    </h2>
                                    <div className={`accordion-collapse collapse ${activeIndex === index ? "show" : ""}`}>
                                        <div className="accordion-body p-4 pt-0">
                                            <div className="text-muted" style={{ lineHeight: "1.7" }}>
                                                {faq.answer}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CourseFAQ;
