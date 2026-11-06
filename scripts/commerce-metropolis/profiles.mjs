export const LIVE_SIZES=Object.freeze([96,192,384]);
export const isMetropolis=value=>/^metropolis-(96|192|384)$/.test(value??'');
export function liveSize(profile){
  if(!isMetropolis(profile))throw Error('UNSUPPORTED_LIVE_SIZE');
  const merchants=Number(profile.split('-')[1]);
  return {merchants,shoppers:merchants*50,profile};
}
