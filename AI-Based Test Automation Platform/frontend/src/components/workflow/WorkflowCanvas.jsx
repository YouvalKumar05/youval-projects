import React, { useMemo } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import NodeCard from './NodeCard';

const nodeTypes = {
  workflowNode: NodeCard,
};

const WorkflowCanvas = ({ steps, onNodeClick }) => {
  // Convert steps to React Flow nodes and edges
  const { nodes, edges } = useMemo(() => {
    const nodes = steps.map((step, idx) => ({
      id: step.id,
      type: 'workflowNode',
      position: { x: idx * 250 + 50, y: 150 },
      data: { 
        ...step,
        // Match icons to steps
        icon: getIconForStep(step.id)
      },
    }));

    const edges = [];
    for (let i = 0; i < steps.length - 1; i++) {
      edges.push({
        id: `e-${steps[i].id}-${steps[i+1].id}`,
        source: steps[i].id,
        target: steps[i+1].id,
        animated: steps[i].status === 'Running' || steps[i+1].status === 'Running',
        style: { stroke: steps[i].status === 'Completed' ? '#10b981' : '#555', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: steps[i].status === 'Completed' ? '#10b981' : '#555',
        },
      });
    }

    return { nodes, edges };
  }, [steps]);

  return (
    <div style={{ width: '100%', height: '100%', background: '#0f0f12' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(event, node) => onNodeClick(node)}
        fitView
      >
        <Background color="#222" gap={20} />
        <Controls />
        <MiniMap 
          style={{ background: '#1a1a1f' }} 
          maskColor="rgba(0,0,0,0.5)"
          nodeColor={(n) => n.data.status === 'Completed' ? '#10b981' : '#1e1e24'}
        />
      </ReactFlow>
    </div>
  );
};

// Helper for icons (standard lucide icons matching existing services)
import { FileText, Search, FlaskConical, ClipboardCheck, PlayCircle, FileBarChart } from 'lucide-react';
function getIconForStep(id) {
  switch (id) {
    case 'input': return FileText;
    case 'analysis': return Search;
    case 'test_gen': return FlaskConical;
    case 'approval': return ClipboardCheck;
    case 'execution': return PlayCircle;
    case 'report': return FileBarChart;
    default: return Search;
  }
}

export default WorkflowCanvas;
