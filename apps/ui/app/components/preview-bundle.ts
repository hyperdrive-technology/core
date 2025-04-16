// Re-export required dependencies for the preview
import React from 'react';
import ReactDOM from 'react-dom/client';

// Bundle Tailwind utilities
const tailwindUtilities = `
.bg-gray-800 { background-color: rgb(31, 41, 55); }
.bg-red-600 { background-color: rgb(220, 38, 38); }
.bg-red-900 { background-color: rgb(127, 29, 29); }
.bg-yellow-400 { background-color: rgb(250, 204, 21); }
.bg-yellow-900 { background-color: rgb(113, 63, 18); }
.bg-green-500 { background-color: rgb(34, 197, 94); }
.bg-green-900 { background-color: rgb(20, 83, 45); }
.dark\\:bg-gray-800 { background-color: rgb(31, 41, 55); }
.p-4 { padding: 1rem; }
.mb-4 { margin-bottom: 1rem; }
.mb-6 { margin-bottom: 1.5rem; }
.mb-3 { margin-bottom: 0.75rem; }
.w-16 { width: 4rem; }
.h-16 { height: 4rem; }
.text-2xl { font-size: 1.5rem; line-height: 2rem; }
.text-lg { font-size: 1.125rem; line-height: 1.75rem; }
.font-bold { font-weight: 700; }
.font-medium { font-weight: 500; }
.rounded-lg { border-radius: 0.5rem; }
.rounded-full { border-radius: 9999px; }
.rounded { border-radius: 0.25rem; }
.flex { display: flex; }
.flex-col { flex-direction: column; }
.items-center { align-items: center; }
.space-y-2 > * + * { margin-top: 0.5rem; }
.shadow-\\[0_0_20px_rgba\\(220\\,38\\,38\\,0\\.7\\)\\] { box-shadow: 0 0 20px rgba(220,38,38,0.7); }
.shadow-\\[0_0_20px_rgba\\(250\\,204\\,21\\,0\\.7\\)\\] { box-shadow: 0 0 20px rgba(250,204,21,0.7); }
.shadow-\\[0_0_20px_rgba\\(34\\,197\\,94\\,0\\.7\\)\\] { box-shadow: 0 0 20px rgba(34,197,94,0.7); }

@media (prefers-color-scheme: dark) {
  .dark\\:bg-gray-800 { background-color: rgb(31, 41, 55); }
}
`;

// Module registry for HMR
const moduleRegistry = `
const moduleCache = new Map();
let currentModuleId = 0;

const hmr = {
  accept(callback) {
    module.hot = {
      accept: callback
    };
  }
};

function defineModule(id, code) {
  const moduleExports = {};
  const module = {
    id,
    exports: moduleExports,
    hot: null
  };

  try {
    const fn = new Function('React', 'ReactDOM', 'module', 'exports', code);
    fn(window.React, window.ReactDOM, module, moduleExports);
    moduleCache.set(id, module);
  } catch (err) {
    console.error('Error defining module:', err);
    throw err;
  }

  return module.exports;
}

function requireModule(id) {
  const cached = moduleCache.get(id);
  if (cached) {
    return cached.exports;
  }
  throw new Error(\`Module not found: \${id}\`);
}

function updateModule(id, code) {
  const oldModule = moduleCache.get(id);
  if (oldModule?.hot?.accept) {
    defineModule(id, code);
    oldModule.hot.accept();
  } else {
    defineModule(id, code);
  }
}
`;

// Virtual file system for in-memory modules
const virtualFS = `
const virtualFiles = new Map();

function writeFile(path, content) {
  virtualFiles.set(path, content);
}

function readFile(path) {
  return virtualFiles.get(path);
}
`;

// Preview iframe message handler
const iframeMessageHandler = `
window.addEventListener('message', async (event) => {
  if (event.data.type === 'update') {
    const { id, code } = event.data.data;
    writeFile(id, code);
    updateModule(id, code);
  }
});
`;

// Export serialized React and ReactDOM
const serializedReact = `(${React.toString()})`;
const serializedReactDOM = `
const createRoot = (${ReactDOM.createRoot.toString()});
const root = createRoot(document.getElementById('root'));
const render = (element) => root.render(element);
`;

// Export everything needed by the preview iframe
export {
  iframeMessageHandler,
  moduleRegistry,
  serializedReact as React,
  serializedReactDOM as ReactDOM,
  tailwindUtilities,
  virtualFS,
};
