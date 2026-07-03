import express from 'express'
import type { Router } from 'express'

const mountPaths = new WeakMap<object, string>()
let patched = false

function patchRouterProto(): void {
  if (patched) return
  patched = true

  const proto = (express.Router as any).prototype as any
  const originalUse = proto.use

  proto.use = function (this: any, ...args: any[]) {
    const subRouter = Array.from(args).find(a => a?.stack !== undefined)
    if (subRouter) {
      const maybePath = typeof args[0] === 'string' ? args[0] : '/'
      mountPaths.set(subRouter, maybePath)
    }
    return originalUse.apply(this, args)
  }
}

function collectRoutes(router: any, basePath: string): { path: string; method: string }[] {
  const routes: { path: string; method: string }[] = []
  const stack = router.stack as any[] | undefined
  if (!stack) return routes

  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods)
        .filter(m => m !== '__proto__')
        .map(m => m.toUpperCase())
      const fullPath = (basePath + layer.route.path).replace(/\/+/g, '/').replace(/\/$/, '')
      for (const method of methods) {
        routes.push({ path: fullPath, method })
      }
    }
    if (layer.name === 'router' && layer.handle?.stack) {
      const subPath = mountPaths.get(layer.handle) || ''
      const childBase = (basePath + '/' + subPath).replace(/\/+/g, '/').replace(/\/$/, '')
      routes.push(...collectRoutes(layer.handle, childBase))
    }
  }
  return routes
}

export function logModuleRoutes(router: Router, mountPath: string): void {
  patchRouterProto()
  const routes = collectRoutes(router, mountPath)
  for (const r of routes) {
    console.log(`  [RouterExplorer] Mapped {${r.path}, ${r.method}} route`)
  }
}
