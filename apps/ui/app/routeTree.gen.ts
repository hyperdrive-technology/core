/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file was automatically generated by TanStack Router.
// You should NOT make any changes in this file as it will be overwritten.
// Additionally, you should also exclude this file from your linter and/or formatter to prevent it from being checked or modified.

// Import Routes

import { Route as rootRoute } from './routes/__root'
import { Route as AppRouteImport } from './routes/_app/route'
import { Route as IndexImport } from './routes/index'
import { Route as AppLogicImport } from './routes/_app/logic'
import { Route as AppControlImport } from './routes/_app/control'
import { Route as AppLogicProjectIdImport } from './routes/_app/logic/$projectId'

// Create/Update Routes

const AppRouteRoute = AppRouteImport.update({
  id: '/_app',
  getParentRoute: () => rootRoute,
} as any)

const IndexRoute = IndexImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRoute,
} as any)

const AppLogicRoute = AppLogicImport.update({
  id: '/logic',
  path: '/logic',
  getParentRoute: () => AppRouteRoute,
} as any)

const AppControlRoute = AppControlImport.update({
  id: '/control',
  path: '/control',
  getParentRoute: () => AppRouteRoute,
} as any)

const AppLogicProjectIdRoute = AppLogicProjectIdImport.update({
  id: '/$projectId',
  path: '/$projectId',
  getParentRoute: () => AppLogicRoute,
} as any)

// Populate the FileRoutesByPath interface

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexImport
      parentRoute: typeof rootRoute
    }
    '/_app': {
      id: '/_app'
      path: ''
      fullPath: ''
      preLoaderRoute: typeof AppRouteImport
      parentRoute: typeof rootRoute
    }
    '/_app/control': {
      id: '/_app/control'
      path: '/control'
      fullPath: '/control'
      preLoaderRoute: typeof AppControlImport
      parentRoute: typeof AppRouteImport
    }
    '/_app/logic': {
      id: '/_app/logic'
      path: '/logic'
      fullPath: '/logic'
      preLoaderRoute: typeof AppLogicImport
      parentRoute: typeof AppRouteImport
    }
    '/_app/logic/$projectId': {
      id: '/_app/logic/$projectId'
      path: '/$projectId'
      fullPath: '/logic/$projectId'
      preLoaderRoute: typeof AppLogicProjectIdImport
      parentRoute: typeof AppLogicImport
    }
  }
}

// Create and export the route tree

interface AppLogicRouteChildren {
  AppLogicProjectIdRoute: typeof AppLogicProjectIdRoute
}

const AppLogicRouteChildren: AppLogicRouteChildren = {
  AppLogicProjectIdRoute: AppLogicProjectIdRoute,
}

const AppLogicRouteWithChildren = AppLogicRoute._addFileChildren(
  AppLogicRouteChildren,
)

interface AppRouteRouteChildren {
  AppControlRoute: typeof AppControlRoute
  AppLogicRoute: typeof AppLogicRouteWithChildren
}

const AppRouteRouteChildren: AppRouteRouteChildren = {
  AppControlRoute: AppControlRoute,
  AppLogicRoute: AppLogicRouteWithChildren,
}

const AppRouteRouteWithChildren = AppRouteRoute._addFileChildren(
  AppRouteRouteChildren,
)

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '': typeof AppRouteRouteWithChildren
  '/control': typeof AppControlRoute
  '/logic': typeof AppLogicRouteWithChildren
  '/logic/$projectId': typeof AppLogicProjectIdRoute
}

export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '': typeof AppRouteRouteWithChildren
  '/control': typeof AppControlRoute
  '/logic': typeof AppLogicRouteWithChildren
  '/logic/$projectId': typeof AppLogicProjectIdRoute
}

export interface FileRoutesById {
  __root__: typeof rootRoute
  '/': typeof IndexRoute
  '/_app': typeof AppRouteRouteWithChildren
  '/_app/control': typeof AppControlRoute
  '/_app/logic': typeof AppLogicRouteWithChildren
  '/_app/logic/$projectId': typeof AppLogicProjectIdRoute
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths: '/' | '' | '/control' | '/logic' | '/logic/$projectId'
  fileRoutesByTo: FileRoutesByTo
  to: '/' | '' | '/control' | '/logic' | '/logic/$projectId'
  id:
    | '__root__'
    | '/'
    | '/_app'
    | '/_app/control'
    | '/_app/logic'
    | '/_app/logic/$projectId'
  fileRoutesById: FileRoutesById
}

export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  AppRouteRoute: typeof AppRouteRouteWithChildren
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  AppRouteRoute: AppRouteRouteWithChildren,
}

export const routeTree = rootRoute
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()

/* ROUTE_MANIFEST_START
{
  "routes": {
    "__root__": {
      "filePath": "__root.tsx",
      "children": [
        "/",
        "/_app"
      ]
    },
    "/": {
      "filePath": "index.tsx"
    },
    "/_app": {
      "filePath": "_app/route.tsx",
      "children": [
        "/_app/control",
        "/_app/logic"
      ]
    },
    "/_app/control": {
      "filePath": "_app/control.tsx",
      "parent": "/_app"
    },
    "/_app/logic": {
      "filePath": "_app/logic.tsx",
      "parent": "/_app",
      "children": [
        "/_app/logic/$projectId"
      ]
    },
    "/_app/logic/$projectId": {
      "filePath": "_app/logic/$projectId.tsx",
      "parent": "/_app/logic"
    }
  }
}
ROUTE_MANIFEST_END */
