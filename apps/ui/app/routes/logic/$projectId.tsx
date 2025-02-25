import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { Navbar } from '../../components/navbar';

// Temporarily disabling TypeScript errors to allow the route to work
// @ts-ignore
export const Route = createFileRoute('/logic/$projectId')({
  component: LogicEditor
});

function LogicEditor() {
  // @ts-ignore
  const { projectId } = Route.useParams();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Once the iframe is loaded, initialize the Theia application
    const handleIframeLoad = () => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        // Post message to Theia to open the project
        iframeRef.current.contentWindow.postMessage({
          type: 'openProject',
          projectId
        }, '*');
      }
    };

    if (iframeRef.current) {
      iframeRef.current.addEventListener('load', handleIframeLoad);
    }

    return () => {
      if (iframeRef.current) {
        iframeRef.current.removeEventListener('load', handleIframeLoad);
      }
    };
  }, [projectId]);

  return (
    <div className="flex flex-col h-screen">
      <Navbar version="0.1.0" isConnected={true} />
      <div className="flex-grow">
        <iframe
          ref={iframeRef}
          src="/theia/"
          className="w-full h-full border-none"
          title="Theia Editor"
        />
      </div>
    </div>
  );
}
