import React, { useState } from 'react';
import type { Task } from '@spacedtask/shared';
import { isDueToday, daysSinceStart, stepLabel } from '@spacedtask/shared';
import { useCompleteTask, useResetTask, useDeleteTask } from '../hooks/useTasks';
import { useToast } from './Toast';

interface TaskItemProps {
  task: Task;
  todayLocal: string;
  showCompleted?: boolean;
}

export function TaskItem({ task, todayLocal, showCompleted = false }: TaskItemProps) {
  const completeTask = useCompleteTask();
  const resetTask = useResetTask();
  const deleteTask = useDeleteTask();
  const { showToast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const completedToday = task.lastCompletedDate === todayLocal;
  const due = isDueToday(task, todayLocal);
  const days = daysSinceStart(task.startDate, todayLocal);
  const step = stepLabel(task.repetitionIndex);

  const handleComplete = () => {
    if (completedToday) return;
    completeTask.mutate(task.id, {
      onError: (err) => showToast(`Error: ${String(err)}`, 'error'),
    });
  };

  const handleReset = () => {
    resetTask.mutate(task.id, {
      onSuccess: () => showToast(`"${task.title}" reset.`, 'info'),
      onError: (err) => showToast(`Error: ${String(err)}`, 'error'),
    });
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteTask.mutate(task.id, {
      onSuccess: () => showToast(`"${task.title}" deleted.`, 'info'),
      onError: (err) => showToast(`Error: ${String(err)}`, 'error'),
    });
  };

  const isBusy =
    completeTask.isPending || resetTask.isPending || deleteTask.isPending;

  return (
    <article
      className={`task-item ${completedToday ? 'task-item--completed' : ''} ${!due && !showCompleted ? 'task-item--future' : ''}`}
      aria-label={`Task: ${task.title}`}
    >
      <div className="task-item__header">
        {(due || showCompleted) && (
          <input
            type="checkbox"
            className="task-item__checkbox"
            id={`task-${task.id}`}
            checked={completedToday}
            onChange={handleComplete}
            disabled={completedToday || isBusy}
            aria-label={
              completedToday
                ? `${task.title} — completed today`
                : `Mark ${task.title} as complete`
            }
          />
        )}
        <label
          htmlFor={`task-${task.id}`}
          className="task-item__title"
        >
          {task.title}
        </label>
      </div>

      <dl className="task-item__meta">
        <div className="task-item__meta-row">
          <dt>Start date</dt>
          <dd>{task.startDate}</dd>
        </div>
        <div className="task-item__meta-row">
          <dt>Days since start</dt>
          <dd>{days}</dd>
        </div>
        <div className="task-item__meta-row">
          <dt>Next due</dt>
          <dd>{completedToday ? task.nextDueDate : task.nextDueDate}</dd>
        </div>
        <div className="task-item__meta-row">
          <dt>Step</dt>
          <dd>
            <span className="task-item__step-badge">{step}</span>
          </dd>
        </div>
      </dl>

      <div className="task-item__actions">
        <button
          className="btn btn--secondary btn--small"
          onClick={handleReset}
          disabled={isBusy}
          aria-label={`Reset ${task.title}`}
          title="Reset to step 1 starting today"
        >
          Reset
        </button>

        {confirmDelete ? (
          <>
            <button
              className="btn btn--danger btn--small"
              onClick={handleDelete}
              disabled={isBusy}
              aria-label={`Confirm delete ${task.title}`}
            >
              Confirm delete
            </button>
            <button
              className="btn btn--secondary btn--small"
              onClick={() => setConfirmDelete(false)}
              aria-label="Cancel delete"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            className="btn btn--ghost btn--small"
            onClick={handleDelete}
            disabled={isBusy}
            aria-label={`Delete ${task.title}`}
            title="Delete task permanently"
          >
            Delete
          </button>
        )}
      </div>
    </article>
  );
}
