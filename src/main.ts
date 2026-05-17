import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import * as ElementPlusIconsVue from "@element-plus/icons-vue";
import "./style.css";
import "./styles/theme-transitions.css";
import App from "@/App.vue";
import { useThemeStore } from "@/stores/themeStore";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(ElementPlus);

// 初始化主题系统（必须在app.mount之前）
const themeStore = useThemeStore();
themeStore.initialize();

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.mount("#app");
