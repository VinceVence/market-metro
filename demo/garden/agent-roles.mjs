// These are team responsibilities. One Gemini planner selects actions; local workers execute and verify them.
export const AGENT_ROLES = [
  {role:'Business lead',station:'hq',place:'Operations HQ',number:'01',color:'#254e66',job:'Turns your chosen objective and budget into the experiment brief; flags market changes.',output:'Goal → budget → experiment brief'},
  {role:'Data engineer',station:'data',place:'Data Exchange',number:'02',color:'#3d7882',job:'Builds features from completed visits, offers and purchases. Keeps future outcomes and hidden traits out.',output:'Observed events → training rows'},
  {role:'Data scientist',station:'models',place:'Model Lab',number:'03',color:'#665a91',job:'Fits offer-response models or a lightweight product ranker. Tests personalization against popularity on later purchases.',output:'Training rows → candidate models'},
  {role:'Experiment analyst',station:'models',place:'Model Lab · evaluation desk',number:'04',color:'#665a91',job:'Checks later-day model performance and randomized holdout outcomes. A redemption alone is not saved churn.',output:'Candidate → validation; campaign → measured lift'},
  {role:'Coordinator',station:'hq',place:'Operations HQ · control room',number:'05',color:'#254e66',job:'Chooses marketing and bounded PayPal actions from dated evidence; saves proposals before workers verify the outcome.',output:'Evidence → choose, checkpoint, review'},
  {role:'Campaign manager',station:'campaigns',place:'Campaign Studio',number:'06',color:'#b97c3b',job:'Deploys full-price recommendations, reactivation offers or trend promotions. Records exposure, click and purchase under contact and budget limits.',output:'Approved action → campaign or PayPal checkpoint'}
];
