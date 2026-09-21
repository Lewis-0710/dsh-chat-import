    // 「导入会话」内容（tab 栏 + 导入/历史两个子视图）：不含遮罩/header/关闭按钮，
    // 供原生右侧栏 tab 复用同一份内容（embedded 模式）。
    function ImportTabContent() {
      const t = useTranslate();
      const colors = themeColors();
      const [tab, setTab] = useState("import");
      const tabBtn = (id, label) => React.createElement("button", {
        type: "button",
        onClick: () => setTab(id),
        style: {
          flex: "1", padding: "8px 0", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 600,
          background: tab === id ? colors.field : "transparent",
          color: tab === id ? colors.text : colors.dim,
          borderBottom: tab === id ? "2px solid " + colors.accent : "2px solid transparent",
        },
      }, label);
      return React.createElement(React.Fragment, null,
        React.createElement("div", { style: { display: "flex", flexShrink: 0, borderBottom: "1px solid " + colors.border } },
          tabBtn("import", t("tab.import")),
          tabBtn("history", t("tab.history"))),
        tab === "import"
          ? React.createElement(DiscoveryPanel, null)
          : React.createElement(HistoryPanel, null));
    }

    /** 原生右侧栏「导入会话」tab 面板主体（sidebar.right.pane.tab 槽，session 作用域、
     *  keyed by 类型 id）：全高容器内嵌 ImportTabContent（embedded 内容自带滚动与配色）。
     *  面板的标题与关闭由右侧栏 tab 条自己呈现（注册表 title 文本 + strip ✕），组件
     *  不需要再画一个头。 */
    function SidebarImportTab() {
      return React.createElement("div", {
        style: { display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box" },
      },
        React.createElement(ImportTabContent, null));
    }

    /** 导入历史面板：读取 imports.json 展平列表，支持单条/全部删除 */
    function HistoryPanel() {
      const t = useTranslate();
      const colors = themeColors();
      const style = makeStyles(colors);
      const [entries, setEntries] = useState([]);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
      const [busy, setBusy] = useState(false);
      const [note, setNote] = useState(null);
      const [confirm, setConfirm] = useState(null); // { kind:'all'|'one', sessionId?, count? }

      const load = () => {
        setLoading(true);
        setError(null);
        fetch("/api-import/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
          .then((r) => readJson(r))
          .then((data) => {
            if (data && data.ok === true) {
              setEntries(Array.isArray(data.entries) ? data.entries : []);
              setError(null);
            } else {
              setError((data && data.error) || t("error.load"));
            }
          })
          .catch((err) => setError(String((err && err.message) || err)))
          .finally(() => setLoading(false));
      };
      useEffect(() => { load(); }, []);

      const runPurge = async (body) => {
        setBusy(true);
        setNote(null);
        try {
          const resp = await fetch("/api-import/purge", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ confirm: true, ...body }),
          });
          const data = await readJson(resp);
          if (data && data.ok === true) {
            const r = data.result || {};
            setNote(t("history.purge.done", { deleted: r.deleted || 0, failed: r.failed || 0 }));
            load();
          } else {
            setError((data && data.error) || t("error.route"));
          }
        } catch (err) {
          setError(String((err && err.message) || err));
        } finally {
          setBusy(false);
          setConfirm(null);
        }
      };

      const confirmDialog = confirm && React.createElement("div", {
        style: {
          position: "absolute", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 2,
          display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
        },
      },
        React.createElement("div", {
          style: {
            background: colors.bg, border: "1px solid " + colors.border, borderRadius: "12px",
            padding: "16px", maxWidth: "360px", width: "100%",
          },
        },
          React.createElement("div", { style: { fontWeight: 600, marginBottom: "8px" } }, t("history.confirm.title")),
          React.createElement("div", { style: { fontSize: "13px", color: colors.dim, marginBottom: "14px", lineHeight: 1.5 } },
            confirm.kind === "all"
              ? t("history.confirm.all", { n: confirm.count || 0 })
              : t("history.confirm.one", { id: confirm.sessionId || "" })),
          React.createElement("div", { style: { display: "flex", gap: "8px", justifyContent: "flex-end" } },
            React.createElement("button", {
              style: style.toolBtn, disabled: busy,
              onClick: () => setConfirm(null),
            }, t("history.confirm.cancel")),
            React.createElement("button", {
              style: { ...style.primaryBtn, flex: "none", width: "auto", padding: "6px 14px" },
              disabled: busy,
              onClick: () => runPurge(confirm.kind === "all" ? { all: true } : { sessionId: confirm.sessionId }),
            }, t("history.confirm.ok")))));

      const body = React.createElement(React.Fragment, null,
        React.createElement("div", { style: { ...style.toolbar, justifyContent: "space-between" } },
          React.createElement("span", { style: { fontWeight: 600, color: colors.text } }, t("history.title")),
          React.createElement("div", { style: { display: "flex", gap: "6px" } },
            React.createElement("button", { style: style.toolBtn, onClick: load, disabled: busy || loading }, t("refresh")),
            React.createElement("button", {
              style: { ...style.toolBtn, color: colors.error, borderColor: colors.error },
              disabled: busy || loading || entries.length === 0,
              title: t("history.purgeAll.title"),
              onClick: () => setConfirm({ kind: "all", count: entries.length }),
            }, t("history.purgeAll")))),
        note && React.createElement("div", { style: style.result }, note),
        error && React.createElement("div", { style: style.error }, error),
        loading && React.createElement("div", { style: style.status }, t("history.loading")),
        !loading && !error && entries.length === 0 && React.createElement("div", { style: style.status }, t("history.empty")),
        !loading && entries.length > 0 && React.createElement("div", { style: { ...style.list, paddingTop: "8px" } },
          entries.map((e) => React.createElement("div", {
            key: e.sessionId + "\u0000" + e.sourcePath,
            style: { ...style.item, flexDirection: "column", alignItems: "stretch", gap: "4px" },
          },
            React.createElement("div", { style: { fontSize: "13px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
              e.title || t("noTitle")),
            React.createElement("div", { style: { fontSize: "11px", color: colors.dimmer, wordBreak: "break-all" } }, e.sourcePath),
            React.createElement("div", { style: style.itemMeta },
              React.createElement("span", null, e.sessionId),
              React.createElement("span", { title: fmtTime(e.importedAt) }, relTime(e.importedAt, t) || t("timeUnknown")),
              React.createElement("span", null, (typeof e.turns === "number" ? e.turns : "—") + " / " + (typeof e.events === "number" ? e.events : "—"))),
            React.createElement("button", {
              style: { ...style.toolBtn, alignSelf: "flex-end", color: colors.error, borderColor: colors.error, marginTop: "4px" },
              disabled: busy,
              title: t("history.purgeOne.title"),
              onClick: () => setConfirm({ kind: "one", sessionId: e.sessionId }),
            }, t("history.purgeOne"))))));

      return React.createElement("div", { style: { display: "flex", flexDirection: "column", minHeight: 0, flex: 1, position: "relative" } },
        body, confirmDialog);
    }

    /** 可搜索下拉（combobox）：替代原生 <select>——原生 option 列表在来源/工作区
     * 选项多时既不好看也没法检索。样式跟随面板明暗主题（colors），弹出层带搜索框
     *（自动聚焦）、当前项高亮 ✓、点击外部/Esc 关闭。受控组件：value + onChange。 */
    function SearchableSelect({ value, options, onChange, disabled, title, colors, searchPlaceholder, noMatchLabel }) {
      const [open, setOpen] = useState(false);
      const [filter, setFilter] = useState("");
      const [hover, setHover] = useState(null);
      const rootRef = useRef(null);
      const inputRef = useRef(null);
      useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) { setOpen(false); setFilter(""); } };
        // Esc 在此截断冒泡：面板级 Esc 关闭监听挂在 window 上，不 stopPropagation
        // 会连面板一起关掉（原生 select 弹层吞按键，本组件需自行隔离）。
        const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); setFilter(""); } };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        if (inputRef.current) inputRef.current.focus();
        return () => {
          document.removeEventListener("mousedown", onDown);
          document.removeEventListener("keydown", onKey);
        };
      }, [open]);
      const current = options.find((o) => o.value === value);
      const needle = filter.trim().toLowerCase();
      const shown = !needle ? options : options.filter((o) =>
        String(o.label).toLowerCase().includes(needle) || String(o.value).toLowerCase().includes(needle));
      const pick = (v) => { onChange(v); setOpen(false); setFilter(""); };
      return React.createElement("div", { ref: rootRef, style: { position: "relative", flex: 1, minWidth: 0 }, title },
        React.createElement("button", {
          type: "button", disabled,
          style: {
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px",
            background: colors.field, border: "1px solid " + (open ? colors.accent : colors.border),
            color: colors.text, borderRadius: "8px", padding: "6px 8px", fontSize: "13px",
            cursor: disabled ? "default" : "pointer", outline: "none", opacity: disabled ? 0.55 : 1,
          },
          onClick: () => { setOpen(!open); setFilter(""); setHover(null); },
        },
          React.createElement("span", {
            style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" },
          }, current ? current.label : ""),
          React.createElement("span", { style: { color: colors.dim, fontSize: "11px", flex: "none" } }, open ? "▲" : "▼")),
        open && React.createElement("div", {
          style: {
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 30,
            background: colors.bg, border: "1px solid " + colors.border, borderRadius: "8px",
            boxShadow: "0 8px 24px rgba(0,0,0,.25)", overflow: "hidden",
          },
        },
          React.createElement("input", {
            ref: inputRef, value: filter, placeholder: searchPlaceholder,
            onChange: (e) => { setFilter(e.target.value); setHover(null); },
            onKeyDown: (e) => {
              if (e.key === "Enter") {
                const idx = hover !== null && shown.some((o) => o.value === hover) ? shown.findIndex((o) => o.value === hover) : 0;
                const target = shown[idx >= 0 ? idx : 0];
                if (target) pick(target.value);
              } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                if (shown.length === 0) return;
                const idx = hover !== null ? shown.findIndex((o) => o.value === hover) : -1;
                const next = e.key === "ArrowDown"
                  ? Math.min(shown.length - 1, idx + 1)
                  : Math.max(0, idx <= 0 ? 0 : idx - 1);
                setHover(shown[next].value);
              }
            },
            style: {
              width: "100%", boxSizing: "border-box", background: colors.field, border: "none",
              borderBottom: "1px solid " + colors.border, color: colors.text,
              padding: "7px 10px", fontSize: "13px", outline: "none",
            },
          }),
          React.createElement("div", { style: { maxHeight: "240px", overflowY: "auto" } },
            shown.length === 0 && React.createElement("div", {
              style: { padding: "10px", color: colors.dimmer, fontSize: "12px", textAlign: "center" },
            }, noMatchLabel),
            shown.map((o) => React.createElement("div", {
              key: o.value,
              onClick: () => pick(o.value),
              onMouseEnter: () => setHover(o.value),
              onMouseLeave: () => setHover((h) => (h === o.value ? null : h)),
              style: {
                padding: "7px 10px", fontSize: "13px", cursor: "pointer", color: colors.text,
                display: "flex", alignItems: "center", gap: "6px",
                background: o.value === value ? colors.hover : (hover === o.value ? colors.hover : "transparent"),
                fontWeight: o.value === value ? 600 : 400,
              },
            },
              React.createElement("span", { style: { color: colors.accent, flex: "none", width: "12px" } }, o.value === value ? "✓" : ""),
              React.createElement("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, o.label))))));
    }
