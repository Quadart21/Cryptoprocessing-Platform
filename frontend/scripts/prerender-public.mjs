import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const serverEntry = path.join(root, "dist/server/entry-server.js");
const outRoot = path.join(root, "dist/ssr-public");

const LOCALES = ["ru", "en", "ar"];
const DOCS_PATHS = [
  "/",
  "/quickstart",
  "/checkout",
  "/webhooks",
  "/integrations",
  "/integrations/wordpress",
  "/integrations/dle",
  "/integrations/tilda",
  "/integrations/oneC",
  "/commissions",
  "/reference",
  "/faq",
];

function outputFile(surface, locale, urlPath) {
  const base = path.join(outRoot, surface, locale);
  if (urlPath === "/") {
    return path.join(base, "index.json");
  }
  return path.join(base, `${urlPath.replace(/^\//, "")}.json`);
}

const { render } = await import(pathToFileURL(serverEntry).href);

fs.rmSync(outRoot, { recursive: true, force: true });

const jobs = [
  ...LOCALES.flatMap((locale) => DOCS_PATHS.map((url) => ({ surface: "docs", locale, url }))),
  ...LOCALES.map((locale) => ({ surface: "landing", locale, url: "/" })),
];

for (const job of jobs) {
  const rendered = render({
    surface: job.surface,
    locale: job.locale,
    url: job.url,
    mainOrigin: "__SSR_MAIN_ORIGIN__",
    apiBaseUrl: "__SSR_API_BASE__",
  });
  if (!rendered.html || !rendered.html.includes("<h1")) {
    throw new Error(`SSR HTML has no heading for ${job.surface} ${job.locale} ${job.url}`);
  }
  const target = outputFile(job.surface, job.locale, job.url);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(
    target,
    JSON.stringify({
      title: rendered.title,
      description: rendered.description,
      html: rendered.html,
    }),
  );
}

console.log(`Prerendered ${jobs.length} public pages into ${outRoot}`);
