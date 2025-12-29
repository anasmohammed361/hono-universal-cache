import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "hono-universal-cache",
    },
    links: [
      {
        text: "GitHub",
        url: "https://github.com/anasmohammed361/hono-universal-cache",
        external: true,
      },
    ],
  };
}
