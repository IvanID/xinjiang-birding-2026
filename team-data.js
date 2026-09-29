export function createTeam(snapshot){
  const records=snapshot.records;
  const seen=new Map(records.map(r=>[r.speciesId,r]));
  const latest=[...records].sort((a,b)=>b.date.localeCompare(a.date)||a.speciesId-b.speciesId);
  return {records,seen,latest,rank:snapshot.rank,cityCount:snapshot.cities.length,count:seen.size,
    monthCount:records.filter(r=>r.date.startsWith(snapshot.latestObservation.slice(0,7))).length};
}

export const displayBirdName=bird=>bird.scientific==='Anthus rufulus'?'田鹨（东方田鹨）':bird.name;

export function filterBirds(birds,seen,{query='',status='all',family='all',sort='catalog'}={}){
  const term=query.trim().toLocaleLowerCase();
  let result=birds.filter(bird=>(!term||`${displayBirdName(bird)} ${bird.scientific} ${bird.english} ${(bird.aliases??[]).join(' ')}`.toLocaleLowerCase().includes(term))
    &&(family==='all'||bird.family===family)
    &&(status==='all'||(status==='seen'?seen.has(bird.id):!seen.has(bird.id))));
  if(sort==='latest')result.sort((a,b)=>(seen.get(b.id)?.date??'').localeCompare(seen.get(a.id)?.date??'')||a.id-b.id);
  return result;
}
