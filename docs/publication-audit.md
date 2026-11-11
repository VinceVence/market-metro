# Repository publication check

Prepared on **11 November 2026** for the owner's explicit request to make `VinceVence/market-metro` public.

## Scope

- Refreshed remote branches before inspection. The scan includes all reachable local/fetched branch and tag history.
- Ran Gitleaks **8.30.1** locally, downloaded from its official GitHub release and checked against the release checksum. Secret values were redacted in reports.
- The initial history scan inspected **89 commits** and approximately **978 MB** of changes. It returned three generic-key alerts, all reviewed below.
- A separate exact-value scan checked **6,423 reachable Git blobs** (approximately **2.23 GB**) against the configured credential values collected for the check. It found **zero matches**.
- The history path check found no committed `.env`, private-key file, ADC filename, private wallet-consent screenshot or billing artifact among the targeted patterns. The blank `.env.example` is intentional.
- The runtime deployment package excludes `.env`, `.local`, Git metadata and deployment credentials. No publication change places those local files in Git.

This is a targeted publication check, not a security certification. It does not establish that every image or historical artifact is free of all possible sensitive information.

## Reviewed false positives

The exact fingerprints in [`.gitleaksignore`](../.gitleaksignore) are limited to these historical entries; no rule is globally disabled.

| Artifact | Why it is not a credential |
| --- | --- |
| `docs/commerce-expanded/harness-v2/v221-20261104/evidence/recovery-replay.json` | `key` is the canonical SHA-256 hash of the evaluation context and schedule. It identifies a local trial cache/recovery event. See `scripts/commerce-expanded/harness-v2/trials.mjs` and `contracts.mjs`. |
| `docs/policy-lab/benchmarks/v5/protocol.json` | The value for `scripts/vertex-token.py` is a source-file SHA-256 digest in the benchmark's implementation fingerprint map. It is not an OAuth token. |
| `docs/benchmark-baseline-results.json` | `runKey` is a SHA-256 digest of the suite digest and configuration. The historical `benchmark/orchestrator.mjs` computes it; it is not authentication material. |

## Documentation and validation

- Updated the front page with the project gallery, live deployment links, architecture, scoped results, PayPal/AI tooling and a minimal local start path.
- Added a [judge testing guide](judging.md) and retained detailed setup and historical experiment links in the [developer guide](development.md).
- Checked all relative links and image paths in those documents.
- The code revision before these documentation changes passed [Submission checks](https://github.com/VinceVence/market-metro/actions/runs/43043105543). New pushes run the same workflow automatically.

Saved simulation outcomes remain distinct from native Sandbox payment evidence. The original-code MIT license and third-party notices remain in place.
