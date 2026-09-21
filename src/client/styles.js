    // 颜色一律走 DSH 标准设计令牌（--dsw-alias-* / --dsw-specific-*）：这些 CSS 变量
    // 由 ui-theme 挂在 body 上，随 data-ds-dark-theme 自动切换，插件不再自建明暗色板。
    // 文本用 label-primary/secondary/tertiary 语义色板；按钮/强调用 brand-primary 强调色
    //（即 DSH 主按钮 button-primary-fill 的预设），按钮文字用 label-primary-foreground 反色。
    const themeColors = () => ({
      bg: "var(--dsw-specific-menu)",
      border: "var(--dsw-alias-border-l2)",
      field: "var(--dsw-alias-bg-layer-1)",
      text: "var(--dsw-alias-label-primary)",
      dim: "var(--dsw-alias-label-secondary)",
      dimmer: "var(--dsw-alias-label-tertiary)",
      accent: "var(--dsw-alias-brand-primary)",
      accentForeground: "var(--dsw-alias-label-primary-foreground)",
      hover: "var(--dsw-alias-interactive-bg-hover)",
      success: "var(--dsw-alias-state-success-primary)",
      warn: "var(--dsw-alias-state-warn-primary)",
      error: "var(--dsw-alias-state-error-primary)",
    });

    const makeStyles = (C) => ({
      row: { display: "flex", gap: "8px", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid " + C.border },
      // 无分隔线的选择行：来源 / 导入到 / 工作区三行同属一组，行间不画横线
      //（组与下方搜索区的分界由 searchRow 的 borderTop 一条线承担）
      rowPlain: { display: "flex", gap: "8px", alignItems: "center", padding: "10px 16px" },
      label: { color: C.dim, flex: "none" },
      targetHint: { padding: "0 16px 10px", fontSize: "12px", color: C.dimmer, lineHeight: 1.5 },
      select: {
        flex: "1", background: C.field, border: "1px solid " + C.border, color: C.text,
        borderRadius: "8px", padding: "6px 8px", fontSize: "13px", outline: "none",
      },
      // 搜索行：输入 + 搜索/清除（query 服务端过滤标题/项目/路径）
      searchRow: { display: "flex", gap: "6px", alignItems: "center", padding: "8px 12px", borderTop: "1px solid " + C.border, borderBottom: "1px solid " + C.border },
      searchInput: {
        flex: "1", minWidth: "0", background: C.field, border: "1px solid " + C.border, color: C.text,
        borderRadius: "8px", padding: "5px 8px", fontSize: "13px", outline: "none",
      },
      searchBtn: {
        flex: "none", background: C.accent, color: C.accentForeground, border: "none", borderRadius: "8px",
        padding: "5px 12px", fontSize: "13px", cursor: "pointer",
      },
      // 窄宽降级：搜索按钮只留放大镜图标（accent 底、26×26 居中）
      searchIconBtn: {
        flex: "none", background: C.accent, color: C.accentForeground, border: "none", borderRadius: "8px",
        width: "26px", height: "26px", padding: "0", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
      },
      // 工具栏：全选 / 清空 / 刷新 + 已选计数
      toolbar: { display: "flex", gap: "6px", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid " + C.border },
      toolBtn: {
        background: "transparent", border: "1px solid " + C.border, color: C.text,
        borderRadius: "8px", padding: "4px 10px", fontSize: "13px", cursor: "pointer",
      },
      // 窄宽降级的方形图标按钮（工具栏/分页/清除共用，26×26 居中图标）
      iconBtn: {
        background: "transparent", border: "1px solid " + C.border, color: C.text,
        borderRadius: "8px", width: "26px", height: "26px", padding: "0", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", flex: "none",
      },
      count: { marginLeft: "auto", color: C.dimmer, fontSize: "12px", flex: "none" },
      // 导入操作条：面板底部的主操作区（列表/分页之下，贴面板底缘），
      // 与列表的分界走上边框；结果摘要紧贴其上方（见 resultBar）
      importBar: { display: "flex", gap: "8px", alignItems: "center", padding: "8px 12px", borderTop: "1px solid " + C.border, flexWrap: "wrap" },
      // 底部导入结果条：紧贴主按钮上方，导入反馈与触发它的按钮相邻
      resultBar: { padding: "7px 12px", fontSize: "12px", color: C.dim, borderTop: "1px solid " + C.border, background: C.field },
      primaryBtn: {
        flex: "1", background: C.accent, color: C.accentForeground, border: "none", borderRadius: "8px",
        padding: "7px 10px", fontSize: "13px", fontWeight: 600, cursor: "pointer",
      },
      result: { padding: "7px 12px", fontSize: "12px", color: C.dim, borderBottom: "1px solid " + C.border, background: C.field },
      // 顶部不留 padding：工作区分组头 sticky 到 top:0 后与列表顶缘齐平，背景
      // 完整盖住背后滚过的行，不再在顶部露出 8px 缝隙泄漏列表背后的内容。
      list: { flex: "1", minHeight: "0", overflowY: "auto", padding: "0 8px 8px" },
      // 工作区文件夹分组头
      group: {
        display: "flex", alignItems: "center", gap: "6px", padding: "8px 10px 4px",
        fontSize: "12px", fontWeight: 600, color: C.dim, position: "sticky", top: 0,
        background: C.bg, zIndex: 1,
      },
      groupCount: { marginLeft: "auto", fontSize: "11px", fontWeight: 400, color: C.dimmer },
      item: { display: "flex", gap: "8px", alignItems: "flex-start", padding: "8px 10px", borderRadius: "8px", marginBottom: "2px" },
      itemMain: { flex: "1", minWidth: "0" },
      itemTitle: { fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
      itemMeta: { color: C.dimmer, fontSize: "12px", marginTop: "2px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" },
      badge: { marginLeft: "auto", fontSize: "11px", padding: "1px 6px", borderRadius: "8px", border: "1px solid " + C.border, color: C.dim, flex: "none" },
      git: { fontSize: "11px", padding: "0 6px", borderRadius: "8px", border: "1px dashed " + C.border, color: C.dim, flex: "none" },
      importBtn: {
        flex: "none", background: C.accent, color: C.accentForeground, border: "none", borderRadius: "8px",
        padding: "3px 10px", fontSize: "12px", cursor: "pointer", marginTop: "2px",
      },
      syncBtn: {
        flex: "none", background: "transparent", color: C.dim, border: "1px solid " + C.border,
        borderRadius: "8px", padding: "2px 8px", fontSize: "12px", cursor: "pointer", marginTop: "2px",
      },
      status: { padding: "40px 16px", textAlign: "center", color: C.dimmer },
      scanning: { padding: "8px 12px", color: C.dimmer, fontSize: "12px" },
      error: { padding: "16px", textAlign: "center", color: C.error },
      // 分页条：上一页 / 页码 / 下一页
      pageBar: { display: "flex", gap: "8px", alignItems: "center", justifyContent: "center", padding: "8px 12px", borderTop: "1px solid " + C.border },
      pageBtn: {
        background: "transparent", border: "1px solid " + C.border, color: C.text,
        borderRadius: "8px", padding: "4px 12px", fontSize: "13px", cursor: "pointer",
      },
      pageInfo: { color: C.dimmer, fontSize: "12px" },
    });
