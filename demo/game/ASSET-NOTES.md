# Supply Yard asset provenance

The active scenery, workers, packaging, printer, forklift and van are original code-drawn artwork in `yard-art.mjs`. `town-view.mjs` renders this new artwork; it does not import the former Mint Town scenery or resident sprite module. The simple DOM layout and reserve-decision mechanics are retained.

Worker portraits and the playfield are rendered at fixed, shared anchors with smooth Canvas shapes. There are no external character packs or image-generation calls. Loading-lane routes are checked against the new work-area footprints.

The former Harbor Town files are preserved in `docs/archive/harbor-town-before-supply-yard/`. The original Mint Town checkout was not modified.

DM Sans files in `demo/assets/fonts/` retain their accompanying `OFL.txt`. Keep that license with the fonts.
