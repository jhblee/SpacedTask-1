import React from 'react';
import { AddTaskForm } from './components/AddTaskForm';
import { TodayList } from './components/TodayList';
import { AllTasks } from './components/AllTasks';
import { useTasks, useTodayLocal } from './hooks/useTasks';
import { useToast } from './components/Toast';

export function App() {
  const { data: tasks, isLoading: tasksLoading, error: tasksError } = useTasks();
  const { data: todayLocal, isLoading: todayLoading } = useTodayLocal();
  const { showToast } = useToast();

  // Surface persistent errors as toasts
  React.useEffect(() => {
    if (tasksError) {
      showToast(`Failed to load tasks: ${String(tasksError)}`, 'error');
    }
  }, [tasksError, showToast]);

  const isLoading = tasksLoading || todayLoading;

  if (isLoading) {
    return (
      <div className="app-loading" role="status" aria-label="Loading">
        <p>Loading…</p>
      </div>
    );
  }

  // Fallback: if IPC fails to provide todayLocal use client-side date
  const today =
    todayLocal ??
    new Date().toLocaleDateString('en-CA'); // en-CA gives YYYY-MM-DD

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">SpacedTask</h1>
        <p className="app-date">
          <time dateTime={today}>{today}</time>
        </p>
      </header>

      <main className="app-main">
        <AddTaskForm />

        <TodayList tasks={tasks ?? []} todayLocal={today} />

        <AllTasks tasks={tasks ?? []} todayLocal={today} />
      </main>
    </div>
  );
}
