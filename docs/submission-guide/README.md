# Technical submission guide

[Download the 28-page PDF](../../output/pdf/market-metro-technical-guide.pdf).

The guide has a cover, clickable contents and outline, four architecture figures, actual app imagery, the judge walkthrough, implementation details, scoped results, setup and deployment instructions, and links to recorded evidence. It describes application/evidence snapshot `eb93bac` from November 11, 2026; the PDF edition is dated November 12.

## Edit and rebuild

Edit [guide.md](guide.md), then run [build.py](build.py) with Python and `reportlab`, `Pillow`, and `pypdf` installed:

```sh
python3 docs/submission-guide/build.py
```

The generator uses the existing DM Sans fonts and approved gallery assets. It makes no network, model or payment calls. It checks evidence paths, page count, chapter placement and page orientation. Final output is `output/pdf/market-metro-technical-guide.pdf`.

Render the PDF to page images with Poppler and inspect all pages before publishing a layout change. Keep the guided campaign, fresh ontology campaign, feature-selection study, six-seed replication, scale runs and Studio investigation distinct when updating results.
