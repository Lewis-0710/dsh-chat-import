    /** 发现 + 导入面板：来源过滤 + 按工作区文件夹分组 + 单选/多选导入 */
    function DiscoveryPanel() {
      const t = useTranslate();
      const colors = themeColors();
      const badgeOverlay = overlayColorForAccent(colors.accent);
      const style = makeStyles(colors);
      // 容器宽度（侧边栏可拖宽）：低于阈值时按钮/分页降级为图标、页码压缩为 1/N。
      const [rootRef, panelWidth] = useContainerWidth();
      const narrow = panelWidth !== 0 && panelWidth < NARROW_MAX_WIDTH;
      const [source, setSource] = useState(SOURCES[0]);
      // 「导入到」：默认 DSH 会话环境（既有行为不变）；非 dsh → 转投到目标工具格式
      const [target, setTarget] = useState(IMPORT_TARGETS[0]);
      const [workspaceFilter, setWorkspaceFilter] = useState("");
      const [items, setItems] = useState([]); // 流式累计缓冲（scan 逐条按发现顺序插入）
      const [stream, setStream] = useState({ done: false, cursor: 0, total: 0, started: false });
      const [error, setError] = useState(null);
      const [selected, setSelected] = useState(new Map()); // key → 会话条目
      const [importing, setImporting] = useState(false);
      const [result, setResult] = useState(null);
      const [epoch, setEpoch] = useState(0); // 刷新 / 导入后自增 → 服务端新扫描键
      const [queryInput, setQueryInput] = useState(""); // 搜索框输入（未提交）
      const [query, setQuery] = useState(""); // 已提交的搜索词（请求用）
      const [page, setPage] = useState(0); // 当前页（0 基）
      const [pageSize, setPageSize] = useState(50); // 每页条数（50/100/500）
      const [collapsed, setCollapsed] = useState(new Set()); // 已折叠的工作区分组名

      // 流式加载：后台扫描 + after 游标轮询——会话按发现顺序逐条 append 到缓冲，
      // 首屏不被全量扫描阻塞；每次请求只取 cursor 之后的增量（服务端 seq 去重）。
      useEffect(() => {
        let cancelled = false;
        (async () => {
          setItems([]);
          setStream({ done: false, cursor: 0, total: 0, started: false });
          setError(null);
          setResult(null);
          setPage(0);
          let after = 0;
          let done = false;
          let failed = null;
          let seen = { done: false, total: 0, started: false }; // 已渲染的流状态（防空轮询重渲染）
          while (!cancelled && !done && !failed) {
            let data = null;
            try {
              const resp = await fetch("/api-import/sessions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ source, query, epoch, after }),
              });
              data = await parsePanelResponse(resp);
            } catch (err) {
              failed = "导入面板请求失败：" + String((err && err.message) || err);
              break;
            }
            if (cancelled) return;
            if (!data || data.ok !== true) {
              failed = (data && data.error) || t("error.load");
              break;
            }
            after = typeof data.cursor === "number" ? data.cursor : after;
            done = data.done === true;
            const batch = Array.isArray(data.sessions) ? data.sessions : [];
            if (batch.length > 0) {
              // 流式期间纯追加（发现顺序，行不跳动、页面稳定）；扫描完成时一次性
              // 重排回时间倒序（单次排序事件，之后恒定）——不做每块全量重排
              setItems((prev) => (done ? prev.concat(batch).sort(byTimeDesc) : prev.concat(batch)));
            }
            // 只在状态变化时更新流元信息（首帧 / done 翻转 / total 更新）——
            // 扫描中每 250ms 的空轮询不触发重渲染，面板保持稳定
            const nextStream = { done, cursor: after, total: typeof data.total === "number" ? data.total : 0, started: true };
            if (!seen.started || seen.done !== done || seen.total !== nextStream.total) {
              seen = nextStream;
              setStream(nextStream);
            }
            if (done && typeof data.error === "string" && data.error) {
              failed = data.error;
              break;
            }
            if (!done) {
              // 每块处理完显式让出一个宏任务：浏览器在块间绘制 / 响应输入——
              // 若不让出，连续大块的主线程同步处理会让滚轮与其余 UI 长时间无响应
              await sleep(0);
              // 扫描已完成但条目未排干（total 为数值）→ 排干节奏；扫描中常规频率。
              // 节奏不能比块处理耗时更密（否则主线程被持续占用，块间无响应窗口）。
              await sleep(typeof data.total === "number" ? 120 : 250);
            }
          }
          if (!cancelled && failed) setError(failed);
        })();
        return () => { cancelled = true; };
      }, [source, query, epoch]);

      // 来源/搜索词/工作区变化 → 清空跨页选择（换页/刷新保留选择，支持跨页多选）
      useEffect(() => { setSelected(new Map()); }, [source, query, workspaceFilter]);

      // 执行导入（单选/多选共用）：POST /api-import/import → 摘要 → 重取列表刷新状态
      const doImport = async (items, { replace = false } = {}) => {
        if (!items || items.length === 0 || importing) return;
        setImporting(true);
        setResult(null);
        try {
          const resp = await fetch("/api-import/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items, replace: replace === true, target }),
          });
          const data = await readJson(resp);
          if (data && data.ok === true) {
            setResult(data.target && data.target !== "dsh"
              ? fmtTransferResult(data.results, data.target, t)
              : fmtImportResult(data.results, t));
            setSelected(new Map());
            setEpoch((n) => n + 1);
          } else if (data && data.error) {
            setResult(data.error);
          } else {
            setResult(t("error.route"));
          }
        } catch (err) {
          setResult(t("error.import", { msg: String((err && err.message) || err) }));
        } finally {
          setImporting(false);
        }
      };

      const toggle = (s) => {
        const key = itemKey(s);
        setSelected((prev) => {
          const next = new Map(prev);
          if (next.has(key)) next.delete(key);
          else next.set(key, s);
          return next;
        });
      };

      const toggleAll = () => {
        if (!sessions || sessions.length === 0) return;
        const allKeys = sessions.map(itemKey);
        const allSelected = allKeys.every((k) => selected.has(k));
        setSelected(allSelected ? new Map() : new Map(allKeys.map((k, i) => [k, sessions[i]])));
      };

      // 搜索：提交词 + 回到第一页；来源/搜索词变化由上方 effect 清空跨页选择
      const applySearch = () => {
        setQuery(queryInput.trim());
        setPage(0);
        setEpoch((n) => n + 1);
      };
      const clearSearch = () => {
        setQueryInput("");
        setQuery("");
        setPage(0);
        setEpoch((n) => n + 1);
      };
      const filteredItems = filterByWorkspace(items, workspaceFilter);
      const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
      // 当前页窗口 = 工作区筛选后的缓冲切片（服务端不再分页；翻页零重扫）
      const sessions = filteredItems.slice(page * pageSize, (page + 1) * pageSize);
      // 未导入/已导入条目（跨页全量，供「仅选未导入 / 仅选已导入」批量勾选）
      const importableFiltered = stream.done
        ? importableSessions(items, workspaceFilter)
        : [];
      const refreshableFiltered = stream.done
        ? refreshableSessions(items, workspaceFilter)
        : [];
      const workspaceOptions = buildWorkspaceOptions(items);
      // 分页文案总数：扫描完成后用服务端 total（过滤后总数）；扫描中显示已发现数
      const displayTotal = filteredItems.length;
      const scanHint = !error && !stream.started
        ? t("scan.hint.start")
        : (!error && stream.started && !stream.done
          ? t("scan.hint.progress", { n: items.length })
          : (!error && stream.done ? t("scan.hint.done", { n: stream.total || items.length }) : null));

      // 组内最新会话的最后编辑时间（组排序键：最近活跃的工作区置顶）
      const groupLatest = (list) => list.reduce((m, s) => Math.max(m, s.lastActiveAt ?? s.createdAt ?? 0), 0);
      // 按工作区文件夹（project）分组：组按组内最新会话的最后编辑时间降序（最近活跃
      // 的工作区置顶，时间并列按工作区名升序稳定），组内按最后编辑时间降序；未分组钉最后
      const groups = [];
      if (sessions && sessions.length > 0) {
        const byProject = new Map();
        for (const s of sessions) {
          const key = workspaceKey(s);
          if (!byProject.has(key)) byProject.set(key, []);
          byProject.get(key).push(s);
        }
        const names = [...byProject.keys()].sort((a, b) => {
          if (a === NO_WORKSPACE_KEY) return 1;
          if (b === NO_WORKSPACE_KEY) return -1;
          return (groupLatest(byProject.get(b)) - groupLatest(byProject.get(a))) || a.localeCompare(b);
        });
        for (const name of names) groups.push({ name, list: [...byProject.get(name)].sort(byTimeDesc) });
      }

      const allSelected = sessions && sessions.length > 0 && sessions.every((s) => selected.has(itemKey(s)));

      const renderGroup = (group) => {
        const isCollapsed = collapsed.has(group.name);
        const toggleGroup = () => {
          setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(group.name)) next.delete(group.name);
            else next.add(group.name);
            return next;
          });
        };
        const rows = isCollapsed ? [] : group.list.map((s) => {
          const key = itemKey(s);
          const checked = selected.has(key);
          const ts = s.lastActiveAt || s.createdAt;
          const badgeColor = statusColor(s.importStatus, colors);
          const imported = s.importStatus === "imported";
          const ctxTok = fmtTokenCount(s.contextTokens);
          return React.createElement("div", {
            key,
            style: style.item,
            onMouseEnter: (e) => { e.currentTarget.style.background = colors.hover; },
            onMouseLeave: (e) => { e.currentTarget.style.background = "transparent"; },
          },
            React.createElement(SourceBadge, {
              format: s.format, checked, disabled: importing,
              onClick: () => toggle(s),
              title: sourceLabel(s.format),
              ariaLabel: sourceLabel(s.format) + " · " + t("multiSelect.title"),
              palette: { border: colors.border, accent: colors.accent, text: colors.text, overlay: badgeOverlay },
            }),
            React.createElement("div", { style: style.itemMain },
              React.createElement("div", { style: style.itemTitle }, s.title || t("noTitle")),
              React.createElement("div", { style: style.itemMeta },
                ctxTok
                  ? React.createElement("span", { title: String(s.contextTokens) }, t("count.contextTokens", { n: ctxTok }))
                  : React.createElement("span", null, t("count.messages", { n: typeof s.messageCount === "number" ? s.messageCount : "—" })),
                ...(s.gitBranch ? [React.createElement("span", { style: style.git }, s.gitBranch + (s.gitDirty ? " ✗" : ""))] : []),
                React.createElement("span", { title: fmtTime(ts) }, relTime(ts, t) || t("timeUnknown")),
                React.createElement("span", { style: { ...style.badge, color: badgeColor, borderColor: badgeColor } }, statusLabel(s.importStatus, t)))),
            imported
              ? React.createElement("button", {
                style: style.syncBtn, disabled: importing,
                onClick: () => doImport([toItem(s)]),
                title: t("sync.title"),
              }, t("sync"))
              : React.createElement("button", {
                style: style.importBtn, disabled: importing,
                onClick: () => doImport([toItem(s)]),
                title: t("import.one.title"),
              }, t("import.one")));
        });
        return React.createElement(React.Fragment, { key: group.name },
          React.createElement("div", {
            style: style.group, onClick: toggleGroup, title: isCollapsed ? t("group.expand") : t("group.collapse"),
          },
            React.createElement("span", { style: { flex: "none" } }, isCollapsed ? "▸" : "▾"),
            React.createElement("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, workspaceLabel(group.name, t)),
            React.createElement("span", { style: style.groupCount }, t("count.sessions", { n: group.list.length }))),
          rows);
      };

      // 工具栏/分页按钮：宽态文字、窄态图标（title 保留说明，aria-label 保留可访问名；
      // extra.title 可覆盖默认的「文字即标题」，如刷新的详细提示）。
      const toolBtn = (label, icon, extra) => React.createElement("button", {
        style: narrow ? style.iconBtn : style.toolBtn,
        title: label,
        "aria-label": label,
        ...(extra || {}),
      }, narrow ? React.createElement(Icon, { name: icon }) : label);

      const body = React.createElement(React.Fragment, null,
          // 来源与落点读成一行：「从 全部来源 导入到 DSH 会话环境」——「从」与「导入到」都是
          // 连接词，两个下拉只显文本（品牌标只在下拉弹层里出现）
          React.createElement("div", { style: style.rowPlain },
            React.createElement("span", { style: style.rowJoin }, t("from")),
            React.createElement(SearchableSelect, {
              value: source, title: t("source.title"), colors,
              disabled: importing,
              searchPlaceholder: t("combobox.search.source"),
              noMatchLabel: t("combobox.noMatch"),
              options: SOURCES.map((s) => ({ value: s, label: s ? (SOURCE_LABELS[s] || s) : t("allSources"), mark: s || null })),
              onChange: (v) => {
                setSource(v);
                setWorkspaceFilter("");
                setPage(0);
                setQuery("");
                setQueryInput("");
              },
            }),
            React.createElement("span", { style: style.rowJoin }, t("importTo")),
            React.createElement(SearchableSelect, {
              value: target, title: t("importTo.title"), colors,
              disabled: importing,
              searchPlaceholder: t("combobox.search.target"),
              noMatchLabel: t("combobox.noMatch"),
              options: IMPORT_TARGETS.map((v) => ({ value: v, label: t("target." + v), mark: v })),
              onChange: (v) => setTarget(v),
            })),
          target === "dsh"
            ? null
            : React.createElement("div", { style: style.targetHint }, t("target.hint." + target)),
          // 筛选层：搜索词（搜索按钮 / Enter 提交）
          React.createElement("div", { style: style.searchRow },
            React.createElement("input", {
              style: style.searchInput, value: queryInput, placeholder: t("search.placeholder"),
              onChange: (e) => setQueryInput(e.target.value),
              onKeyDown: (e) => { if (e.key === "Enter") applySearch(); },
            }),
            React.createElement("button", {
              style: narrow ? style.searchIconBtn : style.searchBtn,
              onClick: applySearch, title: t("search"), "aria-label": t("search"),
            }, narrow ? React.createElement(Icon, { name: "search" }) : t("search")),
            React.createElement("button", {
              style: narrow ? style.iconBtn : style.toolBtn,
              onClick: clearSearch, disabled: (!queryInput && !query) || importing,
              title: t("clearSearch"), "aria-label": t("clearSearch"),
            }, narrow ? React.createElement(Icon, { name: "x" }) : t("clearSearch"))),
          React.createElement("div", { style: style.toolbar },
            toolBtn(allSelected ? t("deselectAll") : t("selectAll"), "checkSquare", { onClick: toggleAll, disabled: filteredItems.length === 0 || importing }),
            toolBtn(t("clearSelection"), "x", { onClick: () => setSelected(new Map()), disabled: selected.size === 0 || importing }),
            toolBtn(t("refresh"), "refresh", { onClick: () => setEpoch((n) => n + 1), disabled: importing, title: t("refresh.title") }),
            toolBtn(t("selectImportable"), "circle", {
              disabled: importableFiltered.length === 0 || importing || !stream.done,
              onClick: () => setSelected(new Map(importableFiltered.map((s) => [itemKey(s), s]))),
            }),
            toolBtn(t("selectImported"), "checkCircle", {
              disabled: refreshableFiltered.length === 0 || importing || !stream.done,
              onClick: () => setSelected(new Map(refreshableFiltered.map((s) => [itemKey(s), s]))),
            }),
            // 工作区筛选挂在工具栏末位：与动作按钮分组，且不走 toolBtn——窄面板下工具按钮
            // 降级成图标时它仍保持文字
            React.createElement("span", { style: style.toolbarFilter },
              React.createElement(SearchableSelect, {
                value: workspaceFilter, title: t("workspace.title"), colors,
                disabled: items.length === 0 || importing,
                searchPlaceholder: t("combobox.search.workspace"),
                noMatchLabel: t("combobox.noMatch"),
                options: [{ value: "", label: t("allWorkspaces") }].concat(
                  workspaceOptions.map((o) => {
                    const label = workspaceLabel(o.key, t);
                    // 路径与显示名不同才当副标题（同名时画一遍就够）
                    return { value: o.key, label, sub: o.path && o.path !== label ? o.path : null };
                  })),
                onChange: (v) => { setWorkspaceFilter(v); setPage(0); },
              }))),
          scanHint && React.createElement("div", { style: style.scanning }, scanHint),
          !stream.started && !error && !scanHint && React.createElement("div", { style: style.status }, t("loading")),
          error && React.createElement("div", { style: style.error }, error),
          stream.started && !stream.done && !error && items.length > 0
            && React.createElement("div", { style: style.scanning }, t("scanning", { n: items.length })),
          stream.done && !error && filteredItems.length === 0 && React.createElement("div", { style: style.status }, query || workspaceFilter ? t("noMatch") : t("noSessions")),
          !error && items.length > 0
            && React.createElement("div", { style: style.list }, groups.map(renderGroup)),
          items.length > 0 && React.createElement("div", { style: style.pageBar },
            React.createElement("button", {
              style: narrow ? style.iconBtn : style.pageBtn,
              disabled: page === 0 || importing,
              onClick: () => setPage((p) => Math.max(0, p - 1)),
              title: t("previous"), "aria-label": t("previous"),
            }, narrow ? React.createElement(Icon, { name: "chevronLeft" }) : t("previous")),
            React.createElement("span", { style: style.pageInfo },
              narrow ? (page + 1) + "/" + totalPages : t("pagination", { page: page + 1, pages: totalPages, total: displayTotal })),
            React.createElement("button", {
              style: narrow ? style.iconBtn : style.pageBtn,
              disabled: page >= totalPages - 1 || importing,
              onClick: () => setPage((p) => Math.min(totalPages - 1, p + 1)),
              title: t("next"), "aria-label": t("next"),
            }, narrow ? React.createElement(Icon, { name: "chevronRight" }) : t("next")),
            React.createElement("span", { style: { color: colors.dimmer, fontSize: "12px", marginLeft: "4px" } }, t("pageSize")),
            React.createElement("select", {
              style: { ...style.select, flex: "none", width: "72px", padding: "4px 6px", fontSize: "12px" },
              value: pageSize,
              disabled: importing,
              onChange: (e) => { setPageSize(Number(e.target.value)); setPage(0); },
            }, PAGE_SIZES.map((n) => React.createElement("option", { key: n, value: n }, String(n))))),
          // 底部主操作区：导入结果 + 导入所选（列表与分页之外的固定区，滚动时始终可见）
          result && React.createElement("div", { style: style.resultBar }, result),
          React.createElement("div", { style: style.importBar },
            React.createElement("button", {
              style: { ...style.primaryBtn, opacity: selected.size === 0 || importing ? 0.55 : 1 },
              disabled: selected.size === 0 || importing,
              onClick: () => doImport([...selected.values()].map(toItem)),
            }, importing ? t("importing") : t("import.selected", { n: selected.size }))));
      return React.createElement("div", { ref: rootRef, style: { display: "flex", flexDirection: "column", minHeight: 0, flex: 1, position: "relative" } },
        body);
    }
