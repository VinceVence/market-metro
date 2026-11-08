import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';
await Promise.all([
  loadFont({family:'DM Sans',url:staticFile('fonts/dm-sans-400.ttf'),weight:'400'}),
  loadFont({family:'DM Sans',url:staticFile('fonts/dm-sans-600.ttf'),weight:'600'}),
  loadFont({family:'DM Sans',url:staticFile('fonts/dm-sans-700.ttf'),weight:'700'}),
]);
