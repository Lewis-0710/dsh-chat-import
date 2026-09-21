    // 设置页「会话导入」分区（settings.section 槽 = 设置页左侧导航的「每功能一页」；
    // 宿主留给插件设置页的正确 Hook；settings.plugins.tab 只是「插件」分区内的子页，
    // 非插件设置入口）。开关值经面板 fenced 路由 /api-import/prefs 读写——DSH 配置
    // 客户端（settingsScope）只能访问 api-proxy 暴露白名单内的命名空间，插件自有
    // chat-import 不在其列（对齐 dsh-better-sidebar 的 settingsGet/settingsUpdate
    // 模式）；settings 服务缺席或路由失败时回退默认并显示错误行，分区照常渲染。
    // injectTools 是三档（off/minimal/full）：服务端与客户端各做一次归一（客户端兜
    // 历史持久化 boolean：true→full / false→off），两端语义一致。
    const normalizeMode = (v) => {
      if (v === "off" || v === "minimal" || v === "full") return v;
      if (v === true) return "full";
      if (v === false) return "off";
      return "minimal";
    };
    function ImportSettingsSection() {
      const t = useTranslate();
      const colors = themeColors();
      const [state, setState] = useState({ sidebarButton: cachedSidebarButton, importSystemPrompt: false, injectTools: "minimal", saving: false, error: null });
      const readPrefs = (data) => ({
        sidebarButton: data && data.value && typeof data.value.sidebarButton === "boolean" ? data.value.sidebarButton : true,
        importSystemPrompt: !!(data && data.value && data.value.importSystemPrompt),
        injectTools: normalizeMode(data && data.value && data.value.injectTools),
      });
      const load = () => {
        fetch("/api-import/prefs", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
        })
          .then((resp) => readJson(resp))
          .then((data) => {
            if (data && data.ok === true) {
              const prefs = readPrefs(data);
              setSidebarButton(prefs.sidebarButton);
              setState((s) => ({ ...s, ...prefs, error: null }));
            } else {
              setState((s) => ({ ...s, error: (data && data.error) || t("error.load") }));
            }
          })
          .catch((err) => setState((s) => ({ ...s, error: "导入偏好读取失败：" + String((err && err.message) || err) })));
      };
      useEffect(() => { load(); }, []);
      const applyPref = (patch) => {
        setState((s) => ({ ...s, saving: true, error: null }));
        fetch("/api-import/prefs", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        })
          .then((resp) => readJson(resp))
          .then((data) => {
            if (data && data.ok === true) {
              const prefs = readPrefs(data);
              setSidebarButton(prefs.sidebarButton);
              setState((s) => ({ ...s, ...prefs, saving: false }));
            } else {
              // 写失败（含 settings-conflict）：显示错误并重读服务端权威值
              setState((s) => ({ ...s, saving: false, error: (data && data.error) || t("error.route") }));
              load();
            }
          })
          .catch(() => { setState((s) => ({ ...s, saving: false, error: t("error.route") })); });
      };
      const toggleCard = (title, description, on, patchKey) => React.createElement("div", {
        style: {
          display: "flex", alignItems: "flex-start", gap: "12px",
          padding: "12px 14px", border: "1px solid " + colors.border, borderRadius: "12px",
        },
      },
        React.createElement("div", { style: { flex: "1", minWidth: "0" } },
          React.createElement("div", { style: { fontSize: "13px", color: colors.text, lineHeight: "1.5", fontWeight: 600 } }, title),
          React.createElement("div", { style: { fontSize: "12px", color: colors.dimmer, marginTop: "4px", lineHeight: "1.5" } }, description)),
        React.createElement(Toggle, { on, colors, onChange: (next) => { if (!state.saving) applyPref({ [patchKey]: next }); } }));
      // 三档选择卡片（injectTools）：横向 segmented 按钮，选中项 accent 底色；
      // 点击即应用（与 toggleCard 同一保存通路），saving 期间禁点。
      const choiceCard = (title, description, value, options, patchKey) => React.createElement("div", {
        style: {
          display: "flex", alignItems: "flex-start", gap: "12px",
          padding: "12px 14px", border: "1px solid " + colors.border, borderRadius: "12px",
        },
      },
        React.createElement("div", { style: { flex: "1", minWidth: "0" } },
          React.createElement("div", { style: { fontSize: "13px", color: colors.text, lineHeight: "1.5", fontWeight: 600 } }, title),
          React.createElement("div", { style: { fontSize: "12px", color: colors.dimmer, marginTop: "4px", lineHeight: "1.5" } }, description)),
        React.createElement("div", { style: { display: "flex", flex: "none", gap: "0", borderRadius: "10px", border: "1px solid " + colors.border, overflow: "hidden" } },
          options.map((opt) => React.createElement("button", {
            key: opt.value, type: "button", disabled: !!state.saving,
            onClick: () => { if (!state.saving && opt.value !== value) applyPref({ [patchKey]: opt.value }); },
            style: {
              padding: "6px 12px", fontSize: "12px", cursor: state.saving ? "default" : "pointer",
              border: "none", fontWeight: opt.value === value ? 600 : 400,
              background: opt.value === value ? colors.accent : "transparent",
              color: opt.value === value ? colors.accentForeground : colors.dimmer,
            },
          }, opt.label))));
      return React.createElement("div", { style: { padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px", maxWidth: "640px" } },
        React.createElement("div", { style: { fontSize: "15px", fontWeight: 600, color: colors.text } }, t("settings.tab")),
        toggleCard(t("settings.sidebarButton.title"), t("settings.sidebarButton.description"), state.sidebarButton, "sidebarButton"),
        toggleCard(t("settings.systemPrompt.title"), t("settings.systemPrompt.description"), state.importSystemPrompt, "importSystemPrompt"),
        choiceCard(t("settings.injectTools.title"), t("settings.injectTools.description"), state.injectTools,
          [{ value: "off", label: t("settings.injectTools.off") }, { value: "minimal", label: t("settings.injectTools.minimal") }, { value: "full", label: t("settings.injectTools.full") }],
          "injectTools"),
        state.error && React.createElement("div", { style: { fontSize: "12px", color: colors.error } }, state.error),
        // 双向同步内容并入「会话导入」设置页：横线分隔，控件风格同设置页
        React.createElement("div", { style: { height: "1px", background: colors.border, marginTop: "8px" } }),
        React.createElement("div", { style: { fontSize: "14px", fontWeight: 600, color: colors.text } }, t("sync.panel.title")),
        React.createElement(SyncSettingsContent, null));
    }

    // 同步来源/目标格式复选框（设置页控件风格：卡片内 checkbox 组）。
    function FormatChecks({ value, onChange, colors }) {
      const set = new Set(value || []);
      return React.createElement("div", { style: { display: "flex", gap: "16px", flexWrap: "wrap" } },
        ["claude", "codex", "grokbuild"].map((f) => React.createElement("label", {
          key: f, style: { display: "flex", gap: "6px", alignItems: "center", cursor: "pointer", color: colors.text, fontSize: "13px" },
        },
          React.createElement("input", {
            type: "checkbox", checked: set.has(f),
            style: { accentColor: colors.accent, cursor: "pointer" },
            onChange: () => {
              const next = new Set(set);
              if (next.has(f)) next.delete(f); else next.add(f);
              onChange([...next]);
            },
          }),
          f)));
    }

    // 排除目录行（设置页控件风格：卡片内标签 + 输入，失焦保存）。
    function DirsRow({ label, hint, dirs, colors, onSave }) {
      return React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "6px" } },
        React.createElement("span", { style: { fontSize: "13px", fontWeight: 600, color: colors.text } }, label),
        React.createElement("input", {
          style: {
            width: "100%", boxSizing: "border-box", background: colors.field,
            border: "1px solid " + colors.border, color: colors.text, borderRadius: "8px",
            padding: "6px 8px", fontSize: "13px", outline: "none",
          },
          placeholder: hint,
          defaultValue: (dirs || []).join(", "),
          onBlur: (e) => onSave(parseDirs(e.target.value)),
        }));
    }

    // 双向同步内容（嵌入「会话导入」设置分区，横线分隔）：入站/出站开关 + 来源/目标
    // 格式 + 排除目录 + 间隔 + 立即同步。配置经面板 fenced 路由 /api-import/sync
    // 读写（与设置命名空间无关，无白名单问题）；控件风格对齐设置页（卡片化分组 +
    // 统一按钮/输入/开关），不重复外层分区容器与页标题。
    function SyncSettingsContent() {
      const t = useTranslate();
      const colors = themeColors();
      const [config, setConfig] = useState(null);
      const [status, setStatus] = useState(null);
      const [error, setError] = useState(null);
      const [busy, setBusy] = useState(false);
      const [note, setNote] = useState(null);

      const load = () => {
        fetch("/api-import/sync").then((r) => readJson(r)).then((data) => {
          if (data && data.ok) { setConfig(data.config); setStatus(data.status); setError(null); }
          else setError((data && data.error) || t("error.load"));
        }).catch((err) => setError(String((err && err.message) || err)));
      };
      useEffect(() => { load(); }, []);

      const save = async (patch) => {
        setBusy(true);
        try {
          const resp = await fetch("/api-import/sync", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
          });
          const data = await readJson(resp);
          if (data && data.ok) { setConfig(data.config); setStatus(data.status); setNote(null); }
          else setError((data && data.error) || t("error.route"));
        } catch (err) {
          setError(String((err && err.message) || err));
        } finally { setBusy(false); }
      };

      const runNow = async () => {
        setBusy(true);
        setNote(null);
        try {
          const resp = await fetch("/api-import/sync", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runNow: true }),
          });
          const data = await readJson(resp);
          if (data && data.ok) {
            setConfig(data.config);
            setStatus(data.status);
            const inn = (data.result && data.result.inbound) || {};
            const out = (data.result && data.result.outbound) || {};
            setNote(t("sync.result", {
              scanned: inn.scanned || 0, imported: inn.imported || 0, appended: inn.appended || 0,
              skipped: inn.skipped || 0, failed: inn.failed || 0,
              synced: out.synced || 0, outSkipped: out.skipped || 0, outFailed: out.failed || 0,
            }));
          } else setError((data && data.error) || t("error.route"));
        } catch (err) {
          setError(String((err && err.message) || err));
        } finally { setBusy(false); }
      };

      if (!config) {
        return React.createElement("div", { style: { padding: "12px 0", color: colors.dimmer, fontSize: "13px" } }, error || t("loading"));
      }
      const last = config.lastRun && config.lastRun.at ? fmtTime(config.lastRun.at) : "";
      // 卡片化分组（对齐设置页 ImportSettingsSection 的控件风格）：标题 + 提示 + 控件
      const card = (title, hint, control) => React.createElement("div", {
        style: {
          display: "flex", alignItems: "flex-start", gap: "12px",
          padding: "12px 14px", border: "1px solid " + colors.border, borderRadius: "12px",
        },
      },
        React.createElement("div", { style: { flex: "1", minWidth: "0" } },
          React.createElement("div", { style: { fontSize: "13px", color: colors.text, lineHeight: "1.5", fontWeight: 600 } }, title),
          React.createElement("div", { style: { fontSize: "12px", color: colors.dimmer, marginTop: "4px", lineHeight: "1.5" } }, hint)),
        control);
      const groupCard = (children) => React.createElement("div", {
        style: {
          display: "flex", flexDirection: "column", gap: "10px",
          padding: "12px 14px", border: "1px solid " + colors.border, borderRadius: "12px",
        },
      }, children);
      const numInput = {
        width: "90px", background: colors.field, border: "1px solid " + colors.border, color: colors.text,
        borderRadius: "8px", padding: "5px 8px", fontSize: "13px", outline: "none",
      };
      return React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "16px" } },
        card(t("sync.inbound"), t("sync.inbound.hint"),
          React.createElement(Toggle, { on: !!config.inbound.enabled, colors, onChange: (on) => save({ inbound: { ...config.inbound, enabled: on } }) })),
        groupCard(
          React.createElement(FormatChecks, { value: config.inbound.formats, colors, onChange: (formats) => save({ inbound: { ...config.inbound, formats } }) }),
          React.createElement(DirsRow, {
            label: t("sync.excludeDirs"), hint: t("sync.excludeDirs.hint"),
            dirs: config.inbound.excludeDirs, colors,
            onSave: (dirs) => save({ inbound: { ...config.inbound, excludeDirs: dirs } }),
          })),
        card(t("sync.outbound"), t("sync.outbound.hint"),
          React.createElement(Toggle, { on: !!config.outbound.enabled, colors, onChange: (on) => save({ outbound: { ...config.outbound, enabled: on } }) })),
        groupCard(
          React.createElement(FormatChecks, { value: config.outbound.targets, colors, onChange: (targets) => save({ outbound: { ...config.outbound, targets } }) }),
          React.createElement(DirsRow, {
            label: t("sync.excludeDirs"), hint: t("sync.excludeDirs.hint"),
            dirs: config.outbound.excludeDirs, colors,
            onSave: (dirs) => save({ outbound: { ...config.outbound, excludeDirs: dirs } }),
          })),
        card(t("sync.interval"), status && status.timerActive ? t("sync.timer.on") : t("sync.timer.off"),
          React.createElement("input", {
            type: "number", min: 15, max: 3600, value: Math.round((config.intervalMs || 60000) / 1000),
            style: numInput,
            onChange: (e) => setConfig({ ...config, intervalMs: Math.max(15, Number(e.target.value) || 60) * 1000 }),
            onBlur: () => save({ intervalMs: config.intervalMs }),
          })),
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "12px" } },
          React.createElement("button", {
            style: {
              background: colors.accent, color: colors.accentForeground, border: "none", borderRadius: "8px",
              padding: "7px 18px", fontSize: "13px", fontWeight: 600, cursor: "pointer",
              opacity: busy ? 0.55 : 1,
            },
            disabled: busy, onClick: runNow,
          }, busy ? t("sync.running") : t("sync.run")),
          React.createElement("span", { style: { fontSize: "12px", color: colors.dimmer } }, last ? t("sync.last", { when: last }) : t("sync.never"))),
        note && React.createElement("div", { style: { fontSize: "12px", color: colors.dim } }, note),
        error && React.createElement("div", { style: { fontSize: "12px", color: colors.error } }, error));
    }
