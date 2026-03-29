import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import HauptPromptPage from '@/pages/HauptPromptPage';
import NachbesserungPage from '@/pages/NachbesserungPage';

const PromptEntwicklungPage = lazy(() => import('@/pages/intents/PromptEntwicklungPage'));
const PromptPflegePage = lazy(() => import('@/pages/intents/PromptPflegePage'));

export default function App() {
  return (
    <HashRouter>
      <ActionsProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<DashboardOverview />} />
            <Route path="haupt-prompt" element={<HauptPromptPage />} />
            <Route path="nachbesserung" element={<NachbesserungPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="intents/prompt-entwicklung" element={<Suspense><PromptEntwicklungPage /></Suspense>} />
            <Route path="intents/prompt-pflege" element={<Suspense><PromptPflegePage /></Suspense>} />
          </Route>
        </Routes>
      </ActionsProvider>
    </HashRouter>
  );
}
