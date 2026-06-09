import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, Filter, Search, MoreHorizontal, CheckCircle, Clock, AlertCircle, XCircle, X, Activity, Shield } from 'lucide-react';
import { api } from '../../services/api';

const COLUMNS = ['To Do', 'In Progress', 'Testing', 'Done'];

const PRIORITIES = { 
  High: { color: '#FF5630', bg: '#FFEBE6' }, 
  Medium: { color: '#FFAB00', bg: '#FFFAE6' }, 
  Low: { color: '#36B37E', bg: '#E3FCEF' } 
};

const ICONS = { 
  'To Do': Clock, 
  'In Progress': Activity, 
  'Testing': Shield, 
  'Done': CheckCircle 
};

const ICON_COLORS = { 
  'To Do': '#97A0AF', 
  'In Progress': '#FFAB00', 
  'Testing': '#2684FF', 
  'Done': '#36B37E' 
};

const KanbanBoard = () => {
  const [tasks, setTasks] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // UI State
  const [newCardCol, setNewCardCol] = useState(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  
  // Modal Task State
  const [selectedTask, setSelectedTask] = useState(null);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/tasks');
      if (res.status === 'success') {
        const grouped = { 'To Do': [], 'In Progress': [], 'Testing': [], 'Done': [] };
        res.data.forEach(task => {
          if (grouped[task.status]) {
            grouped[task.status].push(task);
          } else {
            grouped['To Do'].push(task); // fallback
          }
        });
        setTasks(grouped);
      }
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const sourceCol = source.droppableId;
    const destCol = destination.droppableId;

    const sourceTasks = Array.from(tasks[sourceCol]);
    const destTasks = sourceCol === destCol ? sourceTasks : Array.from(tasks[destCol]);

    const [movedTask] = sourceTasks.splice(source.index, 1);
    movedTask.status = destCol; // Optimistic update
    destTasks.splice(destination.index, 0, movedTask);

    setTasks(prev => ({
      ...prev,
      [sourceCol]: sourceTasks,
      [destCol]: destTasks
    }));

    // Perform API call
    try {
      await api.patch(`/api/tasks/${draggableId}/status`, { status: destCol });
    } catch (err) {
      console.error('Failed to update task status:', err);
      // Rollback on failure
      loadTasks();
    }
  };

  const addTask = async (col) => {
    if (!newCardTitle.trim()) return;
    
    try {
      const res = await api.post('/api/tasks', {
        title: newCardTitle,
        status: col
      });
      if (res.status === 'success') {
        loadTasks();
      }
    } catch (err) {
      console.error('Failed to add task:', err);
    }
    
    setNewCardTitle('');
    setNewCardCol(null);
  };

  // Filter tasks based on Search text
  const getFilteredTasks = (colTasks) => {
    return colTasks.filter(t => 
      !search || 
      (t.title && t.title.toLowerCase().includes(search.toLowerCase())) || 
      `TASK-${t.id}`.toLowerCase().includes(search.toLowerCase())
    );
  };

  return (
    <div className="page-container animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-title">Task Board</h1>
          <p className="page-subtitle">Manage testing workflows, bugs, and assignments</p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: 12 }}>
          <div className="search-wrapper">
            <Search size={14} className="search-icon" />
            <input 
              className="search-input" 
              placeholder="Search tasks by ID or Title..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
          <button className="btn btn--secondary"><Filter size={14} /> Filter</button>
          <button className="btn btn--primary" onClick={() => setNewCardCol('To Do')}><Plus size={15} /> Create Task</button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>Loading board...</div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div style={{ 
            display: 'flex', 
            gap: 20, 
            overflowX: 'auto', 
            paddingBottom: 20,
            flex: 1,
            alignItems: 'flex-start'
          }}>
            {COLUMNS.map(col => {
              const Icon = ICONS[col];
              const colTasks = getFilteredTasks(tasks[col] || []);

              return (
                <div key={col} style={{ minWidth: 320, width: 320, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon size={15} color={ICON_COLORS[col]} />
                      <span style={{ fontWeight: 600, fontSize: 13, color: '#344563' }}>{col}</span>
                      <span style={{
                        background: '#DFE1E6', borderRadius: 99, fontSize: 11, fontWeight: 700, color: '#42526E',
                        padding: '2px 8px',
                      }}>
                        {colTasks.length}
                      </span>
                    </div>
                    <button onClick={() => setNewCardCol(col)} className="icon-btn" title="Add task">
                      <Plus size={14} />
                    </button>
                  </div>

                  <Droppable droppableId={col}>
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        style={{
                          background: snapshot.isDraggingOver ? '#DEEBFF' : '#F4F5F7',
                          borderRadius: 8,
                          padding: 8,
                          minHeight: 150,
                          transition: 'background-color 0.2s ease',
                        }}
                      >
                        {colTasks.map((task, index) => (
                          <Draggable key={String(task.id)} draggableId={String(task.id)} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() => setSelectedTask(task)}
                                style={{
                                  userSelect: 'none',
                                  padding: 12,
                                  margin: '0 0 8px 0',
                                  minHeight: '80px',
                                  backgroundColor: 'white',
                                  color: '#172B4D',
                                  borderRadius: 8,
                                  boxShadow: snapshot.isDragging ? '0 5px 10px rgba(0,0,0,0.15)' : '0 1px 2px rgba(9,30,66,0.1)',
                                  border: '1px solid #DFE1E6',
                                  ...provided.draggableProps.style,
                                }}
                              >
                                
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                   <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#0052CC', background: '#DEEBFF', padding: '2px 6px', borderRadius: 3 }}>
                                        TASK-{task.id}
                                      </span>
                                      {task.reference_type && (
                                        <span style={{ fontSize: 10, background: task.reference_type === 'bug' ? '#FFEBE6' : '#E3FCEF', color: task.reference_type === 'bug' ? '#FF5630' : '#36B37E', padding: '2px 6px', borderRadius: 3, fontWeight: 600 }}>
                                          {task.reference_type.toUpperCase()}
                                        </span>
                                      )}
                                   </div>
                                   <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#97A0AF', padding: 0 }}>
                                     <MoreHorizontal size={14} />
                                   </button>
                                </div>
                                
                                <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, marginBottom: 12 }}>
                                  {task.title || 'Untitled Task'}
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                   <span style={{
                                     fontSize: 10, fontWeight: 700,
                                     background: PRIORITIES[task.priority]?.bg || '#DFE1E6',
                                     color: PRIORITIES[task.priority]?.color || '#42526E',
                                     padding: '2px 7px', borderRadius: 12
                                   }}>
                                     {task.priority || 'Medium'}
                                   </span>
                                   
                                   <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                     {task.due_date && <span style={{ fontSize: 11, color: '#6B778C' }}>{new Date(task.due_date).toLocaleDateString()}</span>}
                                     {task.assignee ? (
                                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#6554C0', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                                          {task.assignee.email.substring(0, 2).toUpperCase()}
                                        </div>
                                     ) : (
                                        <div style={{ width: 24, height: 24, borderRadius: '50%', border: '1px dashed #97A0AF', color: '#97A0AF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                                          ?
                                        </div>
                                     )}
                                   </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}

                        {/* Add task input */}
                        {newCardCol === col && (
                          <div style={{ background: 'white', borderRadius: 8, padding: 8, marginTop: 8, border: '1px solid #2684FF' }}>
                            <textarea
                              autoFocus
                              placeholder="What needs to be done?"
                              value={newCardTitle}
                              onChange={e => setNewCardTitle(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addTask(col); } if (e.key === 'Escape') setNewCardCol(null); }}
                              style={{ width: '100%', border: 'none', outline: 'none', fontSize: 13, resize: 'none', minHeight: 40, fontFamily: 'inherit' }}
                            />
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                              <button className="btn btn--primary btn--sm" onClick={() => addTask(col)}>Confirm</button>
                              <button className="btn btn--secondary btn--sm" onClick={() => setNewCardCol(null)}>Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(9,30,66,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSelectedTask(null)}>
          <div className="card animate-fade-in-up" onClick={e => e.stopPropagation()} style={{ width: 600, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="card-header-title" style={{ fontSize: 18 }}>TASK-{selectedTask.id}</span>
              </div>
              <button className="icon-btn" onClick={() => setSelectedTask(null)}><X size={20} /></button>
            </div>
            <div className="card-body" style={{ padding: 24 }}>
              <h2 style={{ margin: '0 0 16px 0', fontSize: 20, color: '#172B4D' }}>{selectedTask.title || 'Untitled Task'}</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 24 }}>
                 {/* Left Col */}
                 <div>
                    <h3 style={{ fontSize: 12, fontWeight: 700, color: '#6B778C', textTransform: 'uppercase', marginBottom: 8 }}>Description</h3>
                    <div style={{ background: '#F4F5F7', padding: 12, borderRadius: 6, fontSize: 14, color: '#172B4D', minHeight: 100, marginBottom: 20 }}>
                       {selectedTask.description || <span style={{ color: '#97A0AF', fontStyle: 'italic' }}>No description provided.</span>}
                    </div>

                    {selectedTask.reference_type && (
                      <>
                        <h3 style={{ fontSize: 12, fontWeight: 700, color: '#6B778C', textTransform: 'uppercase', marginBottom: 8 }}>Linked Entity</h3>
                        <div style={{ padding: 12, border: '1px solid #DFE1E6', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                           <span style={{ fontWeight: 600 }}>{selectedTask.reference_type.toUpperCase()}</span>
                           <span style={{ color: '#0052CC', fontFamily: 'monospace' }}>#{selectedTask.reference_id}</span>
                        </div>
                      </>
                    )}
                 </div>

                 {/* Right Col */}
                 <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#6B778C', marginBottom: 4 }}>STATUS</div>
                      <span style={{ background: '#DFE1E6', color: '#42526E', padding: '4px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{selectedTask.status}</span>
                    </div>

                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#6B778C', marginBottom: 4 }}>PRIORITY</div>
                      <span style={{ background: PRIORITIES[selectedTask.priority]?.bg, color: PRIORITIES[selectedTask.priority]?.color, padding: '4px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{selectedTask.priority || 'Medium'}</span>
                    </div>

                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#6B778C', marginBottom: 4 }}>ASSIGNEE</div>
                      {selectedTask.assignee ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                           <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#6554C0', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                              {selectedTask.assignee.email.substring(0, 2).toUpperCase()}
                           </div>
                           <span style={{ fontSize: 13, color: '#172B4D' }}>{selectedTask.assignee.email}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 13, color: '#97A0AF' }}>Unassigned</span>
                      )}
                    </div>
                 </div>
              </div>
            </div>
            
            <div style={{ padding: '16px 24px', borderTop: '1px solid #DFE1E6', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
               <button className="btn btn--secondary" onClick={() => setSelectedTask(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default KanbanBoard;
