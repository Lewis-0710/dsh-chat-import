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
      // position: relative —— 下拉弹层对着这一行定位（触发器根节点不定位），弹层宽度 = 行宽，
      // 面板再窄也不会把弹层挤出左/右边界
      // alignItems: baseline —— 触发器与「从 / 导入到 / 工作区」这些 label 按文字基线对齐，
      // 三者的字形底边在同一条线上（居中会因为各自盒高不同而错开）
      rowPlain: { position: "relative", display: "flex", gap: "8px", alignItems: "baseline", padding: "8px 12px" },
      // 来源与落点之间的连接词（「导入到」），把两个下拉读成一句话
      rowJoin: { color: C.dim, flex: "none", fontSize: "13px", lineHeight: "20px", whiteSpace: "nowrap" },
      targetHint: { padding: "0 16px 10px", fontSize: "12px", color: C.dimmer, lineHeight: 1.5 },
      select: {
        flex: "1", background: C.field, border: "1px solid " + C.border, color: C.text,
        borderRadius: "8px", padding: "6px 8px", fontSize: "13px", outline: "none",
      },
      // 下拉触发器：无边框、无输入框外观（claude-style 模型选择器同款）——hover / 展开时
      // 由调用方补一层背景矩形（颜色走 colors.hover，即 --dsw-alias-interactive-bg-hover，
      // 皮肤里被重定向到它自己的 hover 色）。矩形的宽度贴着内容，所以这里不 flex-grow。
      // 触发器根节点：只做尺寸约束，不定位（弹层挂在行上），也不占满行——芯片贴着内容，
      // 同一行可以并排两个下拉
      selectRoot: { display: "flex", minWidth: 0, flex: "0 1 auto" },
      selectTrigger: {
        display: "inline-flex", alignItems: "center", gap: "6px", flex: "0 1 auto",
        maxWidth: "100%", minWidth: 0, height: "28px", padding: "0 6px",
        // 边框 / 圆角 / 文字色与工具栏（筛选）按钮同款：1px border-l2 + 8px 圆角 + label-primary
        background: "transparent", border: "1px solid " + C.border, borderRadius: "8px",
        color: C.text, font: "inherit", fontSize: "13px", fontWeight: 400, lineHeight: "20px",
        textAlign: "left", boxSizing: "border-box",
      },
      // 行首品牌标槽位：定宽 16px——没有品牌标的行（全部来源 / 工作区）也占住这一格，
      // 文字与有标行左对齐
      selectMarkSlot: {
        flex: "none", display: "flex", alignItems: "center", justifyContent: "center",
        width: "16px", height: "16px", borderRadius: "4px", overflow: "hidden",
      },
      selectValue: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
      // 弹层容器：12px 圆角 + 6px 内边距，行距 2px（二级弹层的尺寸口径）
      selectPopover: {
        position: "absolute", top: "calc(100% + 2px)", left: "12px", right: "12px", minWidth: "200px", zIndex: 30,
        display: "flex", flexDirection: "column", gap: "4px", boxSizing: "border-box",
        padding: "6px", background: C.bg, border: "1px solid " + C.border, borderRadius: "12px",
        boxShadow: "0 8px 30px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.08)",
      },
      selectSearchRow: { display: "flex", alignItems: "center", gap: "6px", padding: "2px 8px 4px" },
      // 搜索框与列表之间的横线：独立元素、撑满弹层（负外边距抵消容器 6px 内边距）。
      // 颜色用 border-l2——宿主自己的菜单分隔线（Menu.module.css .footer）就是这条，
      // l1 在菜单底色上几乎不可见。
      selectDivider: { height: "1px", flex: "none", background: C.border, margin: "0 -6px" },
      selectSearchIcon: { display: "inline-flex", alignItems: "center", flex: "none", color: C.dimmer },
      selectSearchInput: {
        flex: "1", minWidth: 0, background: "transparent", border: "none", outline: "none",
        color: C.text, fontSize: "13px", lineHeight: "20px", padding: "2px 0",
      },
      // maxHeight 由组件按可用窗口高度写内联（自适应，见 tabs.js），这里只管排版
      selectList: { display: "flex", flexDirection: "column", gap: "2px", overflowY: "auto", overflowX: "hidden" },
      selectRow: {
        display: "flex", alignItems: "center", gap: "8px", width: "100%", minHeight: "30px",
        padding: "3px 8px", background: "transparent", border: "none", borderRadius: "6px",
        color: C.text, font: "inherit", fontSize: "13px", textAlign: "left", cursor: "pointer",
        boxSizing: "border-box",
      },
      // 主标签（文件夹名 / 来源名）不参与收缩：flex 分摊哪怕只压掉 0.0x px，Chromium 也会
      // 立刻画省略号。空间不够时先由副标题（shrink 1000）吃干净；只有标签自己就超过行宽时，
      // max-width 才把它压到行宽并截断。
      selectRowText: {
        flex: "0 0 auto", maxWidth: "100%", minWidth: 0,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      },
      // 副标题（工作区的绝对路径）：更淡更小，过长截断（全文留在 title 里）
      selectRowSub: {
        // shrink 取极大值：空间不够时先把副标题（路径）压到 0，再轮到主标签（文件夹名）——
        // flex 的收缩量按「shrink × 基准宽度」分摊，1000 对 1 等于路径先被吃干净
        flex: "0 1000 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        color: C.dimmer, fontSize: "12px",
      },
      selectCheck: { display: "inline-flex", alignItems: "center", flex: "none", marginLeft: "auto", color: C.accent },
      selectEmpty: { padding: "8px", color: C.dimmer, fontSize: "12px", textAlign: "center" },
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
      // position: relative —— 末位的工作区筛选在这里，弹层对着工具栏定位（触发器根节点不定位）
      toolbar: { position: "relative", display: "flex", gap: "6px", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid " + C.border },
      toolBtn: {
        background: "transparent", border: "1px solid " + C.border, color: C.text,
        borderRadius: "8px", padding: "4px 10px", fontSize: "13px", cursor: "pointer",
      },
      // 工具栏末位的工作区筛选：与左侧动作按钮用 auto 外边距分开；限宽保护按钮，
      // 且它不经 toolBtn（窄面板下也保持文字，不降级成图标）
      toolbarFilter: { marginLeft: "auto", display: "flex", minWidth: 0, maxWidth: "52%" },
      // 窄宽降级的方形图标按钮（工具栏/分页/清除共用，26×26 居中图标）
      iconBtn: {
        background: "transparent", border: "1px solid " + C.border, color: C.text,
        borderRadius: "8px", width: "26px", height: "26px", padding: "0", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", flex: "none",
      },
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
