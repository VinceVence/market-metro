# Cloud Run judge deployment

**[Public judge demo](https://market-metro-fifm2aalgq-uc.a.run.app/)** · [Intelligence workspace](https://market-metro-fifm2aalgq-uc.a.run.app/analytics.html?run=judge-demo)

The hosted service runs the guided campaign, AG Studio dashboards, ontology tools and bounded new-seed simulations. It is a public hackathon demonstration, not a production payment service.

## Runtime boundary

- Project: `supply-yard-pilot-261021`; region: `us-central1`; service: `market-metro`. Deployment code rejects another project. APAC configuration is not changed.
- Dedicated runtime identity: `market-metro-demo`, with no downloaded service-account key. Agent Studio adds a custom role containing only model prediction and quota-use permissions, plus object access to its dedicated private bucket.
- No PayPal credentials, saved buyer tokens, ADC, `.env`, research cache, private database, video directory or Git history enters the build context.
- Payment mutations and arbitrary campaign-workflow endpoints are denied at the HTTP boundary. The only hosted model route is the separately capped Agent Studio investigation. `PUBLIC_DEMO=true` also rejects startup with provider configuration.
- New simulations use the recorded model and campaign: 12 merchants, 600 shoppers, no new LLM calls or native payments. The reference Gemini review remains inspectable and labeled.
- Explicit same-origin tick requests advance the economy while the page is open. There is no background simulation timer to depend on idle Cloud Run CPU allocation.
- One active simulation, four successful runs per instance, 600 requests/minute per instance, one maximum Cloud Run instance with 32 concurrent HTTP requests, zero minimum instances, request-based CPU billing. These limits reduce cost; they are not a guaranteed dollar billing cap. A $40 project-wide all-services budget sends 25%, 50%, 75%, 90% and 100% alerts through December 16, alongside the existing $10 Vertex-only budget.
- Sessions use temporary, shared instance storage. Results may disappear when the instance restarts; export them or run the local repository for durable, unrestricted experiments. The bundled walkthrough remains available after restarts.
- Container runs as an unprivileged user, handles SIGTERM, uses `/healthz` for the internal startup probe and `/api/runtime` for external readiness, and sends CSP, frame, MIME and permissions headers.

The public deployment preserves archived Sandbox capture `2M324038C71499318`: $96.00 gross, $3.56 fee, $92.44 merchant proceeds. It never issues another payment for replay.

## Reproduce a deployment

The operator's existing ADC stays outside Git. This repository's deployment helper expects the isolated `.local/gcp/config.json` already used by the local provider adapter. It requires Python with `google-auth` and `requests`; these operator dependencies are not runtime container dependencies.

```sh
npm ci --ignore-scripts
npm test
python3 scripts/deployment/package.py
# Use a Python environment with google-auth and requests installed:
python3 scripts/deployment/cloud-run.py prepare
python3 scripts/deployment/cloud-run.py build
python3 scripts/deployment/cloud-run.py status
# Only after status is SUCCESS:
python3 scripts/deployment/cloud-run.py deploy
# Only after the revision is ready:
python3 scripts/deployment/cloud-run.py publish
```

`package.py` packages only tracked runtime paths. Inspect `.local/release-audit/source-manifest.json` and scan the archive before uploading. `publish` makes only this service invokable by judges; the source bucket retains public-access prevention. The image is deployed by immutable digest.

The build identity can read its private source bucket, write its dedicated image repository and write build logs. The runtime identity receives no build or source-bucket privileges. Its separate Studio investigator permissions are documented in [Agent Studio](ag-studio/agent-workspace.md). Build source objects expire after seven days. Do not grant broad model-management, Secret Manager or PayPal access to enable an unbounded public planner. The Studio allowance survives restarts and is never reset on deployment.

To keep a deployment private instead, omit `publish` and use authenticated Cloud Run access. To remove the demo, delete only the `market-metro` Cloud Run service in the isolated project; leave APAC resources alone.

## Licensing and production scope

AG Studio states that every deployment requires a licence. Its free 45-day trial explicitly covers production evaluation. Obtain that trial or equivalent sponsor coverage for this hosted demo; a visible watermark does not establish permission. The user currently chose to retain evaluation notices, and no trial key is configured. A commercial production service would also need authentication, durable per-user storage, abuse controls tied to identity and explicit payment authorization. None is implied by this sandbox demonstration.

Sources: [Cloud Run container contract](https://docs.cloud.google.com/run/docs/container-contract) and [AG Grid hackathon brief](https://paypalaihackathon.devpost.com/details/aggrid) and [AG Studio licensing](https://www.ag-grid.com/studio/react/enterprise-licence/), checked November 10, 2026.
