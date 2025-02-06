import { createRouter, createWebHistory } from 'vue-router'
import KVListView from '../views/KVListView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: KVListView
    }
  ]
})

export default router
