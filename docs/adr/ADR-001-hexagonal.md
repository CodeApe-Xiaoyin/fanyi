# ADR-001: 采用三层 Hexagonal 架构

## 状态

Accepted

## 背景

项目需要同时兼顾：

- 浏览器扩展多入口
- 多家 LLM 协议接入
- 自用 MVP 到商业化形态的平滑演进

## 决策

采用 `interface -> domain <- infrastructure` 的依赖方向。

## 结果

- 页面 DOM 逻辑不会侵入业务逻辑
- 商业化切换优先通过 `composition/container.ts` 完成
- 核心算法更容易单元测试
