// icon-audit project config — copy next to your repo (e.g. docs/audits/generator/audit.config.mjs),
// fill in from Phase-1 recon, and pass to both scripts via --config.
// Everything project-specific lives HERE; the scripts stay untouched.
export default {
  project: {
    name: 'my-app',                 // header + <title>
    branch: 'main',                 // shown in the page meta line (optional)
    baseCommit: 'abc1234',          // (optional)
  },

  // --- what to scan (paths relative to --root, which defaults to CWD) ---
  srcRoots: ['src'],
  indexHtml: 'index.html',          // scanned for favicon / asset refs; '' to skip
  exts: ['.vue', '.ts', '.tsx', '.jsx', '.js'],
  excludeDirPattern: '__tests__|__mocks__|node_modules|dist|coverage|_screenshots',
  excludeFilePattern: '\\.spec\\.|\\.test\\.|\\.d\\.ts$|\\.stories\\.',
  aliases: { '@/': 'src/' },        // import-alias → path prefix (for the import graph)

  // --- how icons appear in code ---
  icons: {
    componentTag: 'Icon[A-Z]\\w*',  // regex for icon COMPONENT names (<IconTrash />)
    nameString: 'Icon[A-Z]\\w*',    // regex for icon NAME string literals ('IconTrash')
    dynamicHost: 'AnyIcon',         // component that renders by name via :icon="..."; '' if none
    dynamicProp: 'icon',
  },

  // --- where icon artwork is defined (for rendering glyphs in the page) ---
  registry: {
    sources: [
      // strategy 'indexAsyncExports': parse index.ts files for
      //   (export)? const IconX = defineAsyncComponent(() => import("./IconX.vue"))
      //   and `export { default as IconX } from "./IconX.vue"` re-exports.
      // strategy 'componentFiles': every .vue/.tsx in the dir tree IS an icon (name = basename).
      // dir may be absolute (e.g. into node_modules or a sibling checkout of a UI lib).
      { dir: 'src/lib/icons', strategy: 'indexAsyncExports' },
    ],
  },

  // --- static image icons served from public/ ---
  publicAssets: {
    dirs: ['public/icons'],         // each dir's basename becomes the URL prefix (/icons/...)
  },

  // --- optional: scan an external UI library's components for the icons THEY render ---
  libScan: {
    importPrefix: '',               // e.g. '@acme/ui-lib/' ('' disables)
    srcRoot: '',                    // path to that lib's component sources
  },

  // --- feature/view attribution via import graph ---
  views: {
    // Entry component(s) per surface. Read your App shell's view switch to fill this.
    // Files reachable from NO root are marked UNREACHED (dead/quarantined) — that signal
    // is load-bearing for zombie-asset detection, so fill this in properly.
    roots: {
      'home': ['src/pages/HomePage.vue'],
      'settings': ['src/pages/SettingsPage.vue'],
      'chrome-nav': ['src/components/SideNav.vue'],
      'app-shell': ['src/App.vue'],
    },
    shellView: 'app-shell',         // root that imports all others; deduped from multi-view files
    sharedThreshold: 6,             // file in > N views ⇒ shown as "Shared data"
    order: ['chrome-nav', 'home', 'settings', 'app-shell'],   // section-04 card order
    meta: {
      'home':      { label: 'Home', nav: 'Nav → Home', hash: '' },
      'settings':  { label: 'Settings', nav: 'Nav → Settings', hash: '#settings' },
      'chrome-nav':{ label: 'Navigation (global)', nav: 'left nav, all views', hash: '', chrome: true },
      'app-shell': { label: 'App shell', nav: 'App.vue', hash: '' },
      // 'shared' and 'UNREACHED' get sensible defaults; override here if wanted.
    },
  },

  // --- links rendered in the page ---
  links: {
    sourceUrl: 'https://github.com/org/repo/blob/main/',  // '' disables source links
    bases: [                                              // app-link base switcher ([] disables)
      { id: 'prod', label: 'Production', url: 'https://app.example.com/' },
      { id: 'local', label: 'localhost:5173', url: 'http://localhost:5173/' },
    ],
  },
}
