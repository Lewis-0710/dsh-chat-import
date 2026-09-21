    // 窄宽降级用内联 SVG 图标（stroke 风格，继承 currentColor 随按钮文字色走明暗主题）。
    function Icon({ name, size = 14 }) {
      const common = {
        width: size, height: size, viewBox: "0 0 24 24", fill: "none",
        stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round",
        xmlns: "http://www.w3.org/2000/svg", "aria-hidden": true, style: { flex: "none", display: "block" },
      };
      const shapes = {
        checkSquare: React.createElement(React.Fragment, null,
          React.createElement("rect", { x: 3, y: 3, width: 18, height: 18, rx: 3 }),
          React.createElement("path", { d: "m9 12 2 2 4-4" })),
        x: React.createElement(React.Fragment, null,
          React.createElement("path", { d: "M18 6 6 18M6 6l12 12" })),
        refresh: React.createElement(React.Fragment, null,
          React.createElement("path", { d: "M21 12a9 9 0 1 1-2.64-6.36" }),
          React.createElement("path", { d: "M21 3v6h-6" })),
        circle: React.createElement("circle", { cx: 12, cy: 12, r: 9 }),
        checkCircle: React.createElement(React.Fragment, null,
          React.createElement("circle", { cx: 12, cy: 12, r: 9 }),
          React.createElement("path", { d: "m9 12 2 2 4-4" })),
        chevronLeft: React.createElement("path", { d: "m15 18-6-6 6-6" }),
        chevronRight: React.createElement("path", { d: "m9 18 6-6-6-6" }),
        search: React.createElement(React.Fragment, null,
          React.createElement("circle", { cx: 11, cy: 11, r: 7 }),
          React.createElement("path", { d: "m21 21-4.3-4.3" })),
      };
      return React.createElement("svg", common, shapes[name]);
    }

    // 选中态遮罩：强调色亮（HSV V > 40）用固定黑遮罩，暗用固定白遮罩，保证勾选图标的
    // 对比。V 按 0-100 计（max(R,G,B)/255*100）。palette.accent 是 CSS 变量，借一个临时
    // 元素让浏览器解析成 rgb() 再算；结果按 accent 值缓存，主题切换时才重算。
    let accentOverlayCache = { accent: null, color: "#000" };
    function overlayColorForAccent(accent) {
      if (accentOverlayCache.accent === accent) return accentOverlayCache.color;
      let color = "#000";
      try {
        if (typeof document !== "undefined") {
          const probe = document.createElement("span");
          probe.style.color = accent;
          document.body.appendChild(probe);
          const resolved = getComputedStyle(probe).color;
          probe.remove();
          const m = resolved.match(/rgba?\(([^)]+)\)/i);
          if (m) {
            const [r, g, b] = m[1].split(",").map((s) => parseFloat(s));
            const v = (Math.max(r || 0, g || 0, b || 0) / 255) * 100;
            color = v > 40 ? "#000" : "#fff";
          }
        }
      } catch {
        // 解析失败按亮色处理（黑遮罩），与默认主题一致
      }
      accentOverlayCache = { accent, color };
      return color;
    }
    // 多选徽标（替换原生 checkbox）：白色圆角卡 + 品牌标/缩写。未选中只显徽标；选中时
    // 叠一层半透明固定黑/白遮罩（按强调色明度选择）+ 带环 tick（环/勾用强调色）。path
    // 条目套同一白卡渲染为单色 brand 标（simple-icons）。role=checkbox + aria-checked +
    // 键盘切换保留可访问性。
    function SourceBadge({ format, checked, size = 26, onClick, title, ariaLabel, disabled, palette }) {
      const badge = SOURCE_BADGES[format] || { color: "#64748B", text: (format || "?").slice(0, 2).toUpperCase() };
      const card = {
        width: size, height: size, borderRadius: "6px", background: "#ffffff", flex: "none", alignSelf: "center",
        cursor: disabled ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden",
        padding: 0, opacity: disabled ? 0.5 : 1,
      };
      const logo = badge.svg
        ? React.createElement("div", { style: { width: "100%", height: "100%" }, dangerouslySetInnerHTML: { __html: badge.svg } })
        : badge.path
          ? React.createElement("svg", {
            viewBox: "-4 -4 32 32", width: size, height: size, "aria-hidden": true, style: { display: "block" },
          }, React.createElement("rect", { x: -4, y: -4, width: 32, height: 32, rx: 6, fill: "#fff" }),
            React.createElement("path", { d: badge.path, fill: badge.color }))
          : React.createElement("span", {
            style: {
              color: badge.color, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em",
              fontSize: size * (badge.text.length <= 1 ? 0.46 : badge.text.length === 2 ? 0.4 : 0.34),
            },
            "aria-hidden": true,
          }, badge.text);
      const overlay = checked
        ? React.createElement("div", { style: { position: "absolute", inset: 0, background: palette.overlay || overlayColorForAccent(palette.accent), opacity: 0.6 } })
        : null;
      const check = checked
        ? React.createElement("svg", {
          viewBox: "0 0 24 24", width: size, height: size, fill: "none",
          stroke: palette.accent, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round",
          style: { position: "absolute", inset: 0 }, "aria-hidden": true,
        }, React.createElement("circle", { cx: 12, cy: 12, r: 10 }), React.createElement("path", { d: "M7.5 12.5l3 3 6-7" }))
        : null;
      return React.createElement("div", {
        style: card, title, "aria-label": ariaLabel, role: "checkbox", "aria-checked": checked,
        tabIndex: disabled ? -1 : 0,
        onClick: disabled ? undefined : onClick,
        onKeyDown: disabled ? undefined : (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } },
      }, logo, overlay, check);
    }

    // 面板容器宽度跟踪：侧边栏可拖宽，面板随之变窄；ResizeObserver 不可用时回退
    // window resize（宽窄降级仍可用，只是不跟踪拖拽的每一帧）。初始 0 = 未知 → 按
    // 宽态渲染，测量后若低于阈值再降级（避免窄面板首帧先闪文字再跳图标）。
    function useContainerWidth() {
      const ref = useRef(null);
      const [width, setWidth] = useState(0);
      useEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const update = () => setWidth(el.getBoundingClientRect().width);
        update();
        if (typeof ResizeObserver === "function") {
          const ro = new ResizeObserver(update);
          ro.observe(el);
          return () => ro.disconnect();
        }
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
      }, []);
      return [ref, width];
    }
