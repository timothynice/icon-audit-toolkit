# Fixture ground truth (do not show to test agents)

## Planted findings (12)
P1  duplicate   Delete drawn 2 ways: lib IconTrash (FileRow.vue) vs inline trash SVG (ListItem.vue)
P2  duplicate   Close/remove drawn 3 ways: inline X SVG (Modal.vue), unicode × text (Banner.vue), lib IconX (Chip.vue)
P3  a11y        Banner.vue × dismiss button has no accessible name (no aria-label/title)
P4  contradiction IconEye = Theme toggle (SideNav.vue) while eye family elsewhere = visibility/content (IconEyeOff hide-columns in Toolbar.vue, IconEye as 'img' file-kind in FileRow.vue map)
P5  broken      'IconGhost' (FileRow.vue kindIcon map) does not exist in the registry
P6  dead        public/icons/old-gear.svg referenced nowhere
P7  zombie      public/icons/trash-old.svg only referenced from Dead.vue, which no file imports (dead component; its IconPlus usage is dead too)
P8  broken      index.html favicon href="/missing.svg" — file does not exist
P9  theming/frag public/icons/save.svg has baked fill #333333 AND is consumed via two mechanisms (img in Toolbar template + CSS mask in Toolbar styles)
P10 glyph       HTML entity &#x25BC; (▼) used as caret button glyph (Toolbar.vue)
P11 glyph       Emoji ⚙️ used as running-status icon (Toolbar.vue)
P12 css-icon    Hand-written data-URI select caret with hardcoded #888888 stroke (Form.vue)

## Negative controls (must NOT be reported as usages/issues)
N1  'IconExample' appears only inside a doc comment (SettingsPage.vue)
N2  computed<IconKind> in Toolbar.vue is a TypeScript generic, not an icon component usage

## Soft checks
S1  Import-graph attribution: FileRow/ListItem/Banner → Home view; Toolbar/Form/Modal/Chip → Settings view; Dead.vue → unreachable
S2  Output is ONE standalone self-contained HTML file that renders the actual glyphs
