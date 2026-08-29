import { createApp } from "vue";
import { createPinia } from "pinia";
import "./style.css";
import "./styles/theme.scss";
import App from "@/App.vue";
import { useThemeStore } from "@/stores/themeStore";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);

// 初始化主题系统（必须在app.mount之前）
const themeStore = useThemeStore();
themeStore.initialize();

app.mount("#app");
