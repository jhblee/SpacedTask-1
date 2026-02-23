import React from 'react';
import type { Task } from '@spacedtask/shared';
import { isDueToday } from '@spacedtask/shared';
import { TaskItem } from './TaskItem';

interface TodayListProps {
  tasks: Task[];
  todayLocal: string;
}

export function TodayList({ tasks, todayLocal }: TodayListProps) {
  const dueTasks = tasks.filter((t) => isDueToday(t, todayLocal));
  const completedToday = tasks.filter(
    (t) => t.lastCompletedDate === todayLocal && !isDueToday(t, todayLocal),
  );

  return (
    <section className="today-list" aria-labelledby="today-heading">
      <h2 id="today-heading" className="section-heading">
        Today&apos;s Review Tasks
        {dueTasks.length > 0 && (
          <span className="badge" aria-label={`${dueTasks.length} tasks due`}>
            {dueTasks.length}
          </span>
        )}
      </h2>

      {dueTasks.length === 0 && completedToday.length === 0 && (
        <p className="empty-state">No tasks due today. Add a task or check back tomorrow.</p>
      )}

      {dueTasks.length > 0 && (
        <ul className="task-list" aria-label="Due tasks">
          {dueTasks.map((task) => (
            <li key={task.id}>
              <TaskItem task={task} todayLocal={todayLocal} />
            </li>
          ))}
        </ul>
      )}

      {completedToday.length > 0 && (
        <details className="completed-today">
          <summary className="completed-today__summary">
            Completed today ({completedToday.length})
          </summary>
          <ul className="task-list" aria-label="Completed today">
            {completedToday.map((task) => (
              <li key={task.id}>
                <TaskItem task={task} todayLocal={todayLocal} showCompleted />
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
