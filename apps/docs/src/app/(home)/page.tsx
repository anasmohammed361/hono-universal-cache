import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col justify-center text-center flex-1 px-4">
      <h1 className="text-4xl font-bold mb-4">hono-universal-cache</h1>
      <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
        Universal cache middleware for Hono powered by unstorage. Cache API
        responses across any runtime - Cloudflare Workers, Vercel Edge, Node.js,
        Bun, Deno, and more.
      </p>
      <div className="flex gap-4 justify-center">
        <Link
          href="/docs"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Get Started
        </Link>
        <Link
          href="https://github.com/anasmohammed361/hono-universal-cache"
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          GitHub
        </Link>
      </div>
    </div>
  );
}
