'use client';
import React from 'react';

const SubtleLoadingSpinner = () => {
    return (
        <div className="flex items-center justify-center h-screen">
            <div className="relative">
                <div className="w-12 h-12 rounded-full absolute
                        border-4 border-solid border-gray-200"></div>
                <div className="w-12 h-12 rounded-full animate-spin absolute
                        border-4 border-solid border-blue-500 border-t-transparent"></div>
                <div className="absolute top-14 w-full text-center">
                    <span className="text-gray-500 text-sm font-semibold">Loading...</span>
                </div>
            </div>
        </div>
    );
};

export default SubtleLoadingSpinner;