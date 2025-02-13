import { createBrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { Dashboard } from './routes/Dashboard';
import { Programs } from './routes/Programs';
import { Tags } from './routes/Tags';
import { Trends } from './routes/Trends';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'tags',
        element: <Tags />,
      },
      {
        path: 'trends',
        element: <Trends />,
      },
      {
        path: 'programs',
        element: <Programs />,
      },
    ],
  },
]);
