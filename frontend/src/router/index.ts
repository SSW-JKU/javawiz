import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import Home from '../views/Home.vue'

const routes: Array<RouteRecordRaw> = [
  // needed to redirect loading sources and files of examples
  // this is not case-sensitive
  {
    path: '/examples/:subDir',
    name: 'ExampleLookup',
    redirect: '/examples'
  },
  // needed to redirect loading examples
  // this is not case-sensitive
  {
    path: '/:dirName',
    name: 'Example',
    component: Home
  },
  {
    path: '/extensionMode:vscExtensionPort(\\d+);:debuggerPort(\\d+)',
    name: 'Extension',
    component: Home
  },
  {
    path: '/',
    name: 'Home',
    component: Home
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
