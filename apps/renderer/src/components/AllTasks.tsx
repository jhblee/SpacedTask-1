import React, { useState, useMemo } from 'react';
import type { Task } from '@spacedtask/shared';
import { TaskItem } from './TaskItem';

type SortField = 'title' | 'startDate' | 'nextDueDate' | 'repetitionIndex';
type SortDir = 'asc' | 'desc';

interface AllTasksProps {
  tasks: Task[];
  todayLocal: string;
}

export function AllTasks({ tasks, todayLocal }: AllTasksProps) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('nextDueDate');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => !q || t.title.toLowerCase().includes(q));
  }, [tasks, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'startDate':
          cmp = a.startDate.localeCompare(b.startDate);
          break;
        case 'nextDueDate':
          cmp = a.nextDueDate.localeCompare(b.nextDueDate);
          break;
        case 'repetitionIndex':
          cmp = a.repetitionIndex - b.repetitionIndex;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return <span aria-hidden="true">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>;
  };

  return (
    <section className="all-tasks" aria-labelledby="all-tasks-heading">
      <h2 id="all-tasks-heading" className="section-heading">
        All Tasks
        <span className="badge" aria-label={`${tasks.length} total tasks`}>
          {tasks.length}
        </span>
      </h2>

      <div className="all-tasks__toolbar">
        <label htmlFor="task-search" className="sr-only">
          Search tasks
        </label>
        <input
          id="task-search"
          className="all-tasks__search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks…"
          aria-label="Search tasks"
        />

        <div className="all-tasks__sort" role="group" aria-label="Sort by">
          {(['title', 'startDate', 'nextDueDate', 'repetitionIndex'] as SortField[]).map(
            (field) => (
              <button
                key={field}
                className={`btn btn--ghost btn--small ${sortField === field ? 'btn--active' : ''}`}
                onClick={() => toggleSort(field)}
                aria-pressed={sortField === field}
                aria-label={`Sort by ${field}`}
              >
                {field === 'repetitionIndex'
                  ? 'Step'
                  : field === 'nextDueDate'
                    ? 'Due'
                    : field === 'startDate'
                      ? 'Started'
                      : 'Title'}
                {sortIndicator(field)}
              </button>
            ),
          )}
        </div>
      </div>

      {sorted.length === 0 && (
        <p className="empty-state">
          {search ? 'No tasks match your search.' : 'No tasks yet. Add one above.'}
        </p>
      )}

      <ul className="task-list" aria-label="All tasks">
        {sorted.map((task) => (
          <li key={task.id}>
            <TaskItem task={task} todayLocal={todayLocal} />
          </li>
        ))}
      </ul>
    </section>
  );
}
