# Testing Market Metro

**No account, login, credit card, API key or PayPal credentials are needed for the hosted walkthrough.**

Start at [Market Metro](https://market-metro-fifm2aalgq-uc.a.run.app/landing.html), then select **Try the demo**. You can also [open the walkthrough directly](https://market-metro-fifm2aalgq-uc.a.run.app/judge.html).

## Recommended judge path

1. **Market:** begin at day 1. Use **Play walkthrough**, or **Next** and **Back**, to follow the recorded campaign.
2. **Agent decisions:** inspect the day-31 evidence, training choices and financial verifier's model change. **More evidence** includes the ambiguous-mapping hold example and training comparison.
3. **Impact:** compare the planner with fixed rules under the same seed and starting conditions. The final stop shows the matching $96 PayPal Sandbox receipt, fee and merchant proceeds.
4. **Agent Studio:** open [the agent workspace](https://market-metro-fifm2aalgq-uc.a.run.app/agent-studio.html) and select **Replay a verified investigation**. It reuses the recorded Gemini choices while executing Studio's native query, source verification and publication again. Inspect **Tool calls & checkpoints**, **Framework conversation**, and the five published views.
5. **Intelligence:** inspect [models](https://market-metro-fifm2aalgq-uc.a.run.app/analytics.html?run=judge-demo&view=models), [agent decisions](https://market-metro-fifm2aalgq-uc.a.run.app/analytics.html?run=judge-demo&view=decisions), [financial comparisons](https://market-metro-fifm2aalgq-uc.a.run.app/analytics.html?run=judge-demo&view=profits), and [ontology associations](https://market-metro-fifm2aalgq-uc.a.run.app/analytics.html?run=judge-demo&view=ontology). Select a graph node to inspect its definitions and counts. Use **Arrange** to edit the dashboard layout.

## Optional fresh interactions

- **Investigate & build views** in Agent Studio runs a fresh Gemini investigation while the shared model allowance remains available. It does not alter the economy or execute payments. If unavailable, use the saved replay.
- [Try a free simulation](https://market-metro-fifm2aalgq-uc.a.run.app/studio.html?view=market&judge=1&setup=1&execution=saved) opens settings for a new seeded 12-merchant, 600-shopper run. It reuses the saved model and policy; it does not make fresh LLM or payment calls. Outcomes can differ by seed.

## What is real, recorded and simulated

- **Real integrations:** recorded Gemini responses, native AG Studio tool execution, local fitted model artifacts, and previously completed PayPal Sandbox operations.
- **Recorded replay:** the guided campaign and saved investigation preserve their original evidence and decisions. Replaying them does not charge a buyer again.
- **Simulated:** shoppers, inventory, demand, delivery behavior and reported campaign economics. Modeled PayPal net is not actual PayPal profit; merchant contribution includes inventory value.
- **Sandbox:** the native receipt uses fictitious funds. Public payment creation is disabled, so no buyer approval is required to review it.

The Cloud Run demo is shared and has bounded model/run allowances. Saved evidence remains available when an allowance is exhausted. New-run sessions are temporary and may disappear after an instance restart. If the shared service is busy, retry later or use the [local setup](../README.md#run-locally); saved local playback needs no provider credentials.
