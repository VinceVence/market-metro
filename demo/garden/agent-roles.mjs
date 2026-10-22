// These describe implemented local responsibilities, not autonomous LLM agents.
export const AGENT_ROLES = [
  {role:'Business lead',station:'hq',place:'Operations HQ',number:'01',color:'#254e66',job:'Turns your chosen objective and budget into the experiment brief; flags market changes.',output:'Goal → budget → experiment brief'},
  {role:'Data engineer',station:'data',place:'Data Exchange',number:'02',color:'#3d7882',job:'Builds features from completed visits, offers and purchases. Keeps future outcomes and hidden traits out.',output:'Observed events → training rows'},
  {role:'Data scientist',station:'models',place:'Model Lab',number:'03',color:'#665a91',job:'Fits logistic regression and a decision tree locally; scores purchase response to 0%, 5% and 10% offers.',output:'Training rows → candidate models'},
  {role:'Experiment analyst',station:'models',place:'Model Lab · evaluation desk',number:'04',color:'#665a91',job:'Checks later-day model performance and randomized holdout outcomes. A redemption alone is not saved churn.',output:'Candidate → validation; campaign → measured lift'},
  {role:'Coordinator',station:'hq',place:'Operations HQ · control room',number:'05',color:'#254e66',job:'Triggers reviews and promotes a candidate only when it beats the current model or baseline. Otherwise keeps the existing policy.',output:'Evidence → promote, keep or fall back'},
  {role:'Campaign manager',station:'campaigns',place:'Campaign Studio',number:'06',color:'#b97c3b',job:'Chooses eligible audiences and offers under budget, stock, margin and contact limits. Tracks delivered and redeemed coupons.',output:'Approved policy → offers → customer outcomes'}
];
