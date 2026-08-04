export default {
  project: {
    name: 'icon-audit fixture',
    branch: 'main',
  },
  srcRoots: ['src'],
  indexHtml: 'index.html',
  exts: ['.vue', '.ts', '.tsx', '.jsx', '.js'],
  excludeDirPattern: '__tests__|__mocks__|node_modules|dist|coverage|_screenshots',
  excludeFilePattern: '\\.spec\\.|\\.test\\.|\\.d\\.ts$|\\.stories\\.',
  aliases: { '@/': 'src/' },
  icons: {
    componentTag: 'Icon[A-Z]\\w*',
    nameString: 'Icon[A-Z]\\w*',
    dynamicHost: 'AnyIcon',
    dynamicProp: 'icon',
  },
  registry: {
    sources: [{ dir: 'src/lib/icons', strategy: 'indexAsyncExports' }],
  },
  publicAssets: {
    dirs: ['public/icons'],
  },
  libScan: {
    importPrefix: '',
    srcRoot: '',
  },
  views: {
    roots: {
      home: ['src/pages/HomePage.vue'],
      settings: ['src/pages/SettingsPage.vue'],
      'chrome-nav': ['src/components/SideNav.vue'],
      'app-shell': ['src/App.vue'],
    },
    shellView: 'app-shell',
    sharedThreshold: 6,
    order: ['chrome-nav', 'home', 'settings', 'app-shell'],
    meta: {
      home: { label: 'Home', nav: 'Nav → Home', hash: '' },
      settings: { label: 'Settings', nav: 'Nav → Settings', hash: '#settings' },
      'chrome-nav': { label: 'Navigation (global)', nav: 'left nav, all views', hash: '', chrome: true },
      'app-shell': { label: 'App shell', nav: 'App.vue', hash: '' },
    },
  },
  links: {
    sourceUrl: '',
    bases: [],
  },
}
