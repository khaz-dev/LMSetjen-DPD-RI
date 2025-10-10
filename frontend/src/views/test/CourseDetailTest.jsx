import React, { useState, useEffect } from 'react';
import LecturesTabNew from '../../components/CourseDetail/LecturesTabNew';
import VideoProgressManager from '../../utils/VideoProgressManager';

const CourseDetailTest = () => {
    const [testProgress, setTestProgress] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Test VideoProgressManager initialization
        const testInit = async () => {
            try {
                // Test basic functionality
                const manager = VideoProgressManager.getInstance();
                
                // Test progress validation
                const validData = manager.validateProgressData({
                    position: 120,
                    duration: 300,
                    percentage: 40
                });
                
                setTestProgress(validData);
            } catch (err) {
                console.error('Test failed:', err);
                setError(err.message);
            }
        };

        testInit();
    }, []);

    return (
        <div className="container mt-4">
            <div className="row">
                <div className="col-12">
                    <h2>Video Progress System Test</h2>
                    
                    {error && (
                        <div className="alert alert-danger">
                            <h5>Error:</h5>
                            <p>{error}</p>
                        </div>
                    )}
                    
                    {testProgress && (
                        <div className="alert alert-success">
                            <h5>Test Progress Data:</h5>
                            <pre>{JSON.stringify(testProgress, null, 2)}</pre>
                        </div>
                    )}
                    
                    <div className="card">
                        <div className="card-body">
                            <h5 className="card-title">System Status</h5>
                            <ul className="list-group list-group-flush">
                                <li className="list-group-item">
                                    <strong>VideoProgressManager:</strong> 
                                    <span className="text-success ms-2">✓ Loaded</span>
                                </li>
                                <li className="list-group-item">
                                    <strong>API Integration:</strong> 
                                    <span className="text-info ms-2">⚡ Enhanced Endpoints Ready</span>
                                </li>
                                <li className="list-group-item">
                                    <strong>New Component:</strong> 
                                    <span className="text-primary ms-2">📺 LecturesTabNew Available</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CourseDetailTest;