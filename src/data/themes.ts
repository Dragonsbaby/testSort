import type { ThemePreset } from "@/types/theme";

/**
 * 精心设计的预设主题库
 */
export const THEME_PRESETS: ThemePreset = {
  default: "dark",
  themes: [
    // ========== 深色主题 (默认) ==========
    {
      id: "dark",
      name: "深色经典",
      description: "专业的深色主题，适合长时间观看",
      colors: {
        background: "#080d18",
        backgroundSecondary: "#0d1424",
        grid: "rgba(79, 195, 247, 0.055)",
        baseline: "rgba(78, 205, 196, 0.45)",
        divider: "rgba(255, 255, 255, 0.1)",
        text: "#ffffff",
        textSecondary: "#4ecdc4",
        textMuted: "rgba(255, 255, 255, 0.5)",
        primary: "#4a9eff",
      },
      stateStyles: {
        comparing: {
          fill: "#ffcc00",
          stroke: "rgba(255, 230, 102, 0.9)",
          text: "#ffd43b",
          glow: 0.72
        },
        swapping: {
          fill: "#ff5c5c",
          stroke: "rgba(255, 132, 132, 0.95)",
          text: "#ffd43b",
          glow: 0.82
        },
        sorted: {
          fill: "#33d17a",
          stroke: "rgba(103, 226, 151, 0.86)",
          text: "#ffd43b",
          glow: 0.42
        },
        pivot: {
          fill: "#b979ff",
          stroke: "rgba(210, 164, 255, 0.8)",
          text: "#ffd43b",
          glow: 0.58
        },
        pending: {
          fill: "#00c8d4",
          stroke: "rgba(160, 190, 255, 0.78)",
          text: "#ffd43b",
          glow: 0.48
        },
        "heap-pending": {
          fill: "#2e5490",
          stroke: "rgba(90, 140, 210, 0.7)",
          text: "#b8d0f0",
          glow: 0.15
        },
        latest: {
          fill: "#4ecdc4",
          stroke: "rgba(124, 241, 232, 0.78)",
          text: "#ffd43b",
          glow: 0.48
        }
      },
      effects: {
        gridSpacing: 40,
        gridOpacity: 0.055,
        baselineGlow: true,
        baselineOpacity: 0.45,
        shadowBlur: 18,
        particleEffect: false
      },
      typography: {
        labelFont: "600 11px system-ui, -apple-system, sans-serif",
        valueFont: "bold 14px system-ui, -apple-system, sans-serif",
        monospaceFont: "12px 'Consolas', 'Monaco', monospace"
      },
      animation: {
        easing: "easeOutCubic",
        transitionSpeed: 1.0
      }
    },

    // ========== 浅色主题 ==========
    {
      id: "light",
      name: "明亮清新",
      description: "清新的浅色主题，适合明亮环境",
      colors: {
        background: "#f8f9fa",
        backgroundSecondary: "#e9ecef",
        grid: "rgba(0, 0, 0, 0.05)",
        baseline: "rgba(0, 123, 255, 0.3)",
        divider: "rgba(0, 0, 0, 0.1)",
        text: "#212529",
        textSecondary: "#007bff",
        textMuted: "rgba(0, 0, 0, 0.5)",
        primary: "#007bff",
      },
      stateStyles: {
        comparing: {
          fill: "#ffc107",
          stroke: "rgba(255, 193, 7, 0.8)",
          text: "#212529",
          glow: 0.6
        },
        swapping: {
          fill: "#dc3545",
          stroke: "rgba(220, 53, 69, 0.8)",
          text: "#ffffff",
          glow: 0.7
        },
        sorted: {
          fill: "#28a745",
          stroke: "rgba(40, 167, 69, 0.8)",
          text: "#ffffff",
          glow: 0.5
        },
        pivot: {
          fill: "#6f42c1",
          stroke: "rgba(111, 66, 193, 0.8)",
          text: "#ffffff",
          glow: 0.6
        },
        pending: {
          fill: "#17a2b8",
          stroke: "rgba(23, 162, 184, 0.8)",
          text: "#ffffff",
          glow: 0.5
        },
        "heap-pending": {
          fill: "#5a9fd4",
          stroke: "rgba(90, 159, 212, 0.7)",
          text: "#ffffff",
          glow: 0.3
        },
        latest: {
          fill: "#20c997",
          stroke: "rgba(32, 201, 151, 0.8)",
          text: "#ffffff",
          glow: 0.5
        }
      },
      effects: {
        gridSpacing: 40,
        gridOpacity: 0.05,
        baselineGlow: false,
        baselineOpacity: 0.3,
        shadowBlur: 12,
        particleEffect: false
      },
      typography: {
        labelFont: "600 11px system-ui, -apple-system, sans-serif",
        valueFont: "bold 14px system-ui, -apple-system, sans-serif",
        monospaceFont: "12px 'Consolas', 'Monaco', monospace"
      },
      animation: {
        easing: "easeOutCubic",
        transitionSpeed: 1.0
      }
    },

    // ========== 赛博朋克主题 ==========
    {
      id: "cyberpunk",
      name: "赛博朋克",
      description: "霓虹灯光效果，未来科技感",
      colors: {
        background: "#0a0a0f",
        backgroundSecondary: "#1a1a2e",
        grid: "rgba(255, 0, 255, 0.1)",
        baseline: "rgba(0, 255, 255, 0.6)",
        divider: "rgba(255, 0, 255, 0.3)",
        text: "#ffffff",
        textSecondary: "#00ffff",
        textMuted: "rgba(255, 255, 255, 0.5)",
        primary: "#ff00ff",
      },
      stateStyles: {
        comparing: {
          fill: "#ffff00",
          stroke: "rgba(255, 255, 0, 1)",
          text: "#000000",
          glow: 1.0,
          dashed: true
        },
        swapping: {
          fill: "#ff0080",
          stroke: "rgba(255, 0, 128, 1)",
          text: "#ffffff",
          glow: 1.2
        },
        sorted: {
          fill: "#00ff80",
          stroke: "rgba(0, 255, 128, 1)",
          text: "#000000",
          glow: 0.9
        },
        pivot: {
          fill: "#8000ff",
          stroke: "rgba(128, 0, 255, 1)",
          text: "#ffffff",
          glow: 1.0
        },
        pending: {
          fill: "#00ffff",
          stroke: "rgba(0, 255, 255, 1)",
          text: "#000000",
          glow: 0.8
        },
        "heap-pending": {
          fill: "#8040ff",
          stroke: "rgba(128, 64, 255, 0.9)",
          text: "#ffffff",
          glow: 0.6
        },
        latest: {
          fill: "#ff8000",
          stroke: "rgba(255, 128, 0, 1)",
          text: "#000000",
          glow: 1.0
        }
      },
      effects: {
        gridSpacing: 30,
        gridOpacity: 0.1,
        baselineGlow: true,
        baselineOpacity: 0.6,
        shadowBlur: 25,
        particleEffect: true
      },
      typography: {
        labelFont: "600 12px 'Orbitron', monospace",
        valueFont: "bold 14px 'Orbitron', monospace",
        monospaceFont: "12px 'Fira Code', monospace"
      },
      animation: {
        easing: "easeInOutCubic",
        transitionSpeed: 1.2
      }
    },

    // ========== 海洋主题 ==========
    {
      id: "ocean",
      name: "深海探险",
      description: "深蓝色调，宁静海底世界",
      colors: {
        background: "#0a1628",
        backgroundSecondary: "#152238",
        grid: "rgba(100, 200, 255, 0.05)",
        baseline: "rgba(0, 150, 200, 0.5)",
        divider: "rgba(0, 150, 200, 0.2)",
        text: "#e0f0ff",
        textSecondary: "#64d2ff",
        textMuted: "rgba(100, 200, 255, 0.5)",
        primary: "#2196f3",
      },
      stateStyles: {
        comparing: {
          fill: "#64b5f6",
          stroke: "rgba(100, 181, 246, 0.9)",
          text: "#ffffff",
          glow: 0.6
        },
        swapping: {
          fill: "#42a5f5",
          stroke: "rgba(66, 165, 245, 0.9)",
          text: "#ffffff",
          glow: 0.7
        },
        sorted: {
          fill: "#26a69a",
          stroke: "rgba(38, 166, 154, 0.9)",
          text: "#ffffff",
          glow: 0.5
        },
        pivot: {
          fill: "#7e57c2",
          stroke: "rgba(126, 87, 194, 0.9)",
          text: "#ffffff",
          glow: 0.6
        },
        pending: {
          fill: "#29b6f6",
          stroke: "rgba(41, 182, 246, 0.9)",
          text: "#ffffff",
          glow: 0.5
        },
        "heap-pending": {
          fill: "#1e88e5",
          stroke: "rgba(30, 136, 229, 0.8)",
          text: "#e3f2fd",
          glow: 0.3
        },
        latest: {
          fill: "#00bcd4",
          stroke: "rgba(0, 188, 212, 0.9)",
          text: "#ffffff",
          glow: 0.6
        }
      },
      effects: {
        gridSpacing: 40,
        gridOpacity: 0.05,
        baselineGlow: true,
        baselineOpacity: 0.5,
        shadowBlur: 20,
        particleEffect: false
      },
      typography: {
        labelFont: "600 11px system-ui, -apple-system, sans-serif",
        valueFont: "bold 14px system-ui, -apple-system, sans-serif",
        monospaceFont: "12px 'Consolas', 'Monaco', monospace"
      },
      animation: {
        easing: "easeOutCubic",
        transitionSpeed: 0.9
      }
    },

    // ========== 日落主题 ==========
    {
      id: "sunset",
      name: "日落余晖",
      description: "温暖的橙红色调，浪漫黄昏",
      colors: {
        background: "#1a0f0a",
        backgroundSecondary: "#2d1810",
        grid: "rgba(255, 150, 100, 0.08)",
        baseline: "rgba(255, 200, 150, 0.5)",
        divider: "rgba(255, 150, 100, 0.3)",
        text: "#fff5e6",
        textSecondary: "#ffb366",
        textMuted: "rgba(255, 200, 150, 0.5)",
        primary: "#ff6b35",
      },
      stateStyles: {
        comparing: {
          fill: "#ffd89b",
          stroke: "rgba(255, 216, 155, 0.9)",
          text: "#1a0f0a",
          glow: 0.7
        },
        swapping: {
          fill: "#ff8c42",
          stroke: "rgba(255, 140, 66, 0.9)",
          text: "#ffffff",
          glow: 0.8
        },
        sorted: {
          fill: "#f7931e",
          stroke: "rgba(247, 147, 30, 0.9)",
          text: "#ffffff",
          glow: 0.6
        },
        pivot: {
          fill: "#cc5500",
          stroke: "rgba(204, 85, 0, 0.9)",
          text: "#ffffff",
          glow: 0.7
        },
        pending: {
          fill: "#ffa07a",
          stroke: "rgba(255, 160, 122, 0.9)",
          text: "#1a0f0a",
          glow: 0.5
        },
        "heap-pending": {
          fill: "#e67e22",
          stroke: "rgba(230, 126, 34, 0.8)",
          text: "#fff5e6",
          glow: 0.4
        },
        latest: {
          fill: "#ff7f50",
          stroke: "rgba(255, 127, 80, 0.9)",
          text: "#ffffff",
          glow: 0.6
        }
      },
      effects: {
        gridSpacing: 40,
        gridOpacity: 0.08,
        baselineGlow: true,
        baselineOpacity: 0.5,
        shadowBlur: 22,
        particleEffect: false
      },
      typography: {
        labelFont: "600 11px system-ui, -apple-system, sans-serif",
        valueFont: "bold 14px system-ui, -apple-system, sans-serif",
        monospaceFont: "12px 'Consolas', 'Monaco', monospace"
      },
      animation: {
        easing: "easeOutCubic",
        transitionSpeed: 1.0
      }
    },

    // ========== 森林主题 ==========
    {
      id: "forest",
      name: "森林秘境",
      description: "绿色自然风格，清新护眼",
      colors: {
        background: "#0d1f0d",
        backgroundSecondary: "#1a2f1a",
        grid: "rgba(100, 200, 100, 0.08)",
        baseline: "rgba(100, 200, 100, 0.5)",
        divider: "rgba(100, 200, 100, 0.2)",
        text: "#e8f5e8",
        textSecondary: "#90ee90",
        textMuted: "rgba(150, 200, 150, 0.5)",
        primary: "#4caf50",
      },
      stateStyles: {
        comparing: {
          fill: "#81c784",
          stroke: "rgba(129, 199, 132, 0.9)",
          text: "#1a331a",
          glow: 0.6
        },
        swapping: {
          fill: "#66bb6a",
          stroke: "rgba(102, 187, 106, 0.9)",
          text: "#ffffff",
          glow: 0.7
        },
        sorted: {
          fill: "#43a047",
          stroke: "rgba(67, 160, 71, 0.9)",
          text: "#ffffff",
          glow: 0.5
        },
        pivot: {
          fill: "#8bc34a",
          stroke: "rgba(139, 195, 74, 0.9)",
          text: "#1a331a",
          glow: 0.6
        },
        pending: {
          fill: "#aed581",
          stroke: "rgba(174, 213, 129, 0.9)",
          text: "#1a331a",
          glow: 0.5
        },
        "heap-pending": {
          fill: "#558b2f",
          stroke: "rgba(85, 139, 47, 0.8)",
          text: "#e8f5e8",
          glow: 0.3
        },
        latest: {
          fill: "#7cb342",
          stroke: "rgba(124, 179, 66, 0.9)",
          text: "#ffffff",
          glow: 0.6
        }
      },
      effects: {
        gridSpacing: 40,
        gridOpacity: 0.08,
        baselineGlow: true,
        baselineOpacity: 0.5,
        shadowBlur: 18,
        particleEffect: false
      },
      typography: {
        labelFont: "600 11px system-ui, -apple-system, sans-serif",
        valueFont: "bold 14px system-ui, -apple-system, sans-serif",
        monospaceFont: "12px 'Consolas', 'Monaco', monospace"
      },
      animation: {
        easing: "easeOutCubic",
        transitionSpeed: 1.0
      }
    }
  ]
};