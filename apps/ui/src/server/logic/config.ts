export const DEFAULT_WINDOW_CONFIG = {
  defaultTheme: "dark",
  windowOptions: {
    fullscreen: false,
    maximized: true,
  },
};

export const THEIA_CONFIG = {
  applicationName: "Inrush Logic Editor",
  preferences: {
    "editor.fontSize": 14,
    "editor.fontFamily":
      "'Fira Code', 'Source Code Pro', Consolas, 'Courier New', monospace",
    "editor.tabSize": 2,
    "editor.rulers": [80, 100],
    "editor.minimap.enabled": true,
    "editor.formatOnSave": true,
    "files.autoSave": "afterDelay",
    "files.autoSaveDelay": 1000,
    "workbench.colorTheme": "Dark+",
    "workbench.iconTheme": "vs-seti",
  },
};
