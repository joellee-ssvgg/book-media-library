/** @type {import('eslint').Rule.RuleModule} */
export const noArbitraryColor = {
  meta: { type: "suggestion", messages: { found: "禁止使用任意颜色值 ({{value}})，请使用 design token。" } },
  create(context) {
    const pattern = /(?:text|bg|border|ring|fill|stroke)-\[#[0-9a-fA-F]+\]/;
    return {
      Literal(node) {
        if (typeof node.value === "string" && pattern.test(node.value)) {
          context.report({ node, messageId: "found", data: { value: node.value.match(pattern)[0] } });
        }
      },
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          if (pattern.test(quasi.value.raw)) {
            context.report({ node, messageId: "found", data: { value: quasi.value.raw.match(pattern)[0] } });
          }
        }
      },
    };
  },
};

/** @type {import('eslint').Rule.RuleModule} */
export const noForbiddenMotion = {
  meta: { type: "suggestion", messages: { found: "禁止使用 {{keyword}} 动效。" } },
  create(context) {
    const forbidden = ["shimmer", "parallax", "bounce", "elastic", "stagger"];
    const pattern = new RegExp(forbidden.join("|"), "i");
    return {
      Literal(node) {
        if (typeof node.value === "string" && pattern.test(node.value)) {
          const match = node.value.match(pattern)[0];
          context.report({ node, messageId: "found", data: { keyword: match } });
        }
      },
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          if (pattern.test(quasi.value.raw)) {
            const match = quasi.value.raw.match(pattern)[0];
            context.report({ node, messageId: "found", data: { keyword: match } });
          }
        }
      },
    };
  },
};
