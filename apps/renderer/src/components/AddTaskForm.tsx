import React, { useState, useRef } from 'react';
import { useCreateTask } from '../hooks/useTasks';
import { useToast } from './Toast';

export function AddTaskForm() {
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const createTask = useCreateTask();
  const { showToast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      showToast('Task title cannot be empty.', 'error');
      inputRef.current?.focus();
      return;
    }

    createTask.mutate(trimmed, {
      onSuccess: () => {
        setTitle('');
        inputRef.current?.focus();
        showToast('Task added.', 'success');
      },
      onError: (err) => {
        showToast(`Failed to add task: ${String(err)}`, 'error');
      },
    });
  };

  return (
    <form className="add-task-form" onSubmit={handleSubmit} aria-label="Add new task">
      <label htmlFor="new-task-input" className="add-task-form__label">
        New task
      </label>
      <div className="add-task-form__row">
        <input
          id="new-task-input"
          ref={inputRef}
          className="add-task-form__input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter task title…"
          maxLength={500}
          autoFocus
          disabled={createTask.isPending}
          aria-describedby="new-task-hint"
        />
        <button
          type="submit"
          className="btn btn--primary"
          disabled={createTask.isPending}
          aria-label="Add task"
        >
          {createTask.isPending ? 'Adding…' : 'Add'}
        </button>
      </div>
      <p id="new-task-hint" className="add-task-form__hint">
        Press Enter or click Add to schedule a new spaced-repetition task.
      </p>
    </form>
  );
}
