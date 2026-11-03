# Data provenance and training-rights review

Checked against public documentation on2026-10-26. This records published terms and unresolved permission questions; it is not a definitive legal conclusion about any separate agreement.

## PayPal Sandbox

Sandbox creates mock transactions from our test-account/API activity and allows those transactions to be reviewed. It is not a distribution of real PayPal customers' historical purchases. Our local warehouse currently stores10 completed native Sandbox receipts and one partially refunded receipt, each with a capture ID and fee fields. These counts are local recorded statuses, not a new live-provider reconciliation.

Sources: https://developer.paypal.com/sandbox-testing/overview/ and https://developer.paypal.com/api/rest/current-resources/

## Channel3

The documented public offering supplies product search/lookup results: titles, prices, images, variants, availability and merchant offers/buy links. I did not find a general historical shopper-transaction dataset. The hackathon sponsor page supports meaningful API/MCP use for search, enrichment or recommendations.

Sources: https://connect.trychannel3.com/developers and https://paypalaihackathon.devpost.com/details/channel3

The public Terms of Service, effective September1,2026, prohibit using Customer Output or Channel3 IP to train, fine-tune or improve ML/language models, including creating synthetic training data for that purpose. The sponsor page does not expressly provide an exception to that training restriction. A separate applicable agreement or written sponsor clarification may change the assessment; none has been verified here.

Source: https://connect.trychannel3.com/terms, section7.

V3 creates simulated interactions from Channel3-derived catalog attributes and fits local recommendation models on those interactions. That training use needs explicit permission clarification or architectural separation before treating it as cleared. A conservative alternative is wholly authored training products/events independent of Channel3 output, while using Channel3 only for runtime product lookup/display under its applicable terms. Merely removing product IDs would not establish independence of derived training data.

## Hillstrom

The V3 runtime, viewer and benchmark do not depend on Hillstrom. It was a separate optional historical marketing-method experiment. Reuse/redistribution rights have not been verified in this review; it need not be included in the submission's active data pipeline. Existing analysis remains historical evidence, not a claimed validation win.

No model training, catalog API calls or native payments were performed during this review. No sponsor message was sent.

Suggested clarification for the sponsor: Does PayPal hackathon access expressly permit training local recommendation models on synthetic shopper interactions generated from Channel3 product responses, and including the resulting model artifacts and relevant catalog fixtures in the submitted project?
