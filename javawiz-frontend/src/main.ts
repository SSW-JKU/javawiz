import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'

const app = createApp(App)
const pinia = createPinia()

const _rootComponent =
    app
      .use(router)
      .use(pinia)
      .mount('#app')
// app.config.performance = true
