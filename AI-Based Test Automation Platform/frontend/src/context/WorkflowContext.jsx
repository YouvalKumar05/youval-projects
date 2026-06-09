
import React, { createContext, useContext, useState } from 'react';

const WorkflowContext = createContext();

export const WorkflowProvider = ({ children }) => {
  const [activeWorkflow, setActiveWorkflow] = useState({
    projectName: '',
    requirementText: '',
    analysisId: null,
    testCaseId: null,
    status: 'idle' // idle, analyzing, reviewing, executing
  });

  const updateWorkflow = (updates) => {
    setActiveWorkflow(prev => ({ ...prev, ...updates }));
  };

  const resetWorkflow = () => {
    setActiveWorkflow({
      projectName: '',
      requirementText: '',
      analysisId: null,
      testCaseId: null,
      status: 'idle'
    });
  };

  return (
    <WorkflowContext.Provider value={{ activeWorkflow, updateWorkflow, resetWorkflow }}>
      {children}
    </WorkflowContext.Provider>
  );
};

export const useWorkflow = () => {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error('useWorkflow must be used within a WorkflowProvider');
  }
  return context;
};
