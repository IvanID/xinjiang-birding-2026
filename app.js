import {createTeam,filterBirds,displayBirdName} from './team-data.js?v=20260930b';
let provinces=[];

const recorderLabel=record=>record.recorderName??(record.recorderStatus==='private'?'原站未公开':'暂未获取');
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>value.toLocaleString('zh-CN');
const check='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7"/></svg>';
const state={birds:[],byId:new Map(),team:null,snapshot:null,page:1,pageSize:10,status:'all',query:'',family:'all',sort:'catalog',geo:{},reportUrl:null};

async function json(path){const response=await fetch(path,{cache:'no-store'});if(!response.ok)throw new Error(`无法加载 ${path}`);return response.json();}

async function init(){
  try{
    const [catalog,snapshot]=await Promise.all([json('./data/catalog.json'),json('./data/team-records.json')]);
    state.snapshot=snapshot;provinces=snapshot.provinceCounts??[];state.birds=catalog.birds.map(b=>({...b,aliases:snapshot.aliases[b.id]??b.aliases}));state.byId=new Map(state.birds.map(b=>[b.id,b]));state.team=createTeam(snapshot);
    renderOverview();renderRecent();renderProvinceSummary();renderMonthly();
    $('#download-checklist').href=`./data/team-checklist.xlsx?v=${encodeURIComponent(snapshot.fetchedAt)}-format2`;
    renderFamilies();
    renderCatalog();bindEvents();registerAgentTools();
    const mapResults=await Promise.allSettled(['china'].map(async name=>{state.geo[name]=await json(`./data/${name}.json`);}));
    if(mapResults.some(r=>r.status==='rejected'))$('#map-wrap').innerHTML='<p class="map-error">地图暂未载入，仍可在下方查看地区记录。</p>';
    else renderMap();
  }catch(error){console.error(error);$('#load-error').hidden=false;$('#retry').onclick=()=>location.reload();$('#recent-list').innerHTML='<p class="loading">记录暂未载入</p>';$('#export-data').disabled=true;}
}
function renderOverview(){
  $('#species-count').textContent=number(state.team.count);$('#catalog-total').textContent=number(state.birds.length);
  $('#new-this-month').textContent=`${Number(state.snapshot.latestObservation.slice(5,7))} 月新增 ${state.team.monthCount} 种${state.snapshot.sourceCount>state.team.count?` · 名录合并 ${state.snapshot.sourceCount-state.team.count} 种（官方 ${state.snapshot.sourceCount} 种）`:""}`;
  $('#data-cutoff').textContent=state.snapshot.sourceUpdatedAt??state.snapshot.latestObservation;
  $('#rank-overview').hidden=state.team.rank==null;
  renderRanking();
  $('#total-tab').textContent=number(state.birds.length);$('#seen-tab').textContent=state.team.count;$('#unseen-tab').textContent=number(state.birds.length-state.team.count);
}
function renderRanking(){
  const rows=state.snapshot.rankingHighlights??[];
  $('#ranking-list').hidden=!rows.length;
  $('#ranking-rows').innerHTML=rows.map((r,i)=>`<tr class="${r.teamId===1849?'our-team ':''}${i>0&&r.rank>rows[i-1].rank+1?'rank-gap':''}" ${r.teamId===1849?'aria-current="true"':''}><td>${r.rank}</td><th scope="row">${escape(r.teamId===1849?'新疆鸟会队':r.name)}</th><td>${number(r.count)}</td></tr>`).join('');
}
function renderMonthly(){
  const months=state.snapshot.monthlyCounts;
  $('#monthly-panel').hidden=!Array.isArray(months);
  if(!Array.isArray(months))return;
  const max=Math.ceil(Math.max(1,...months.map(m=>m.count??0))/100)*100;
  $('#monthly-max').textContent=max;
  $('#monthly-bars').innerHTML=months.map(({month,count})=>`<div class="month-column ${count===null?'future':''}" role="listitem" aria-label="${month}月：${count===null?'尚未开始':count+'种'}"><span class="month-value">${count??'—'}</span><div class="month-bar-space"><span class="month-bar" style="height:${count===null?0:count/max*100}%"></span></div><span class="month-label">${month}<span class="month-unit">月</span></span></div>`).join('');
  $('#monthly-checked').textContent=`更新于 ${state.snapshot.statisticsFetchedAt.slice(0,10)}`;
}
function renderRecent(){
  $('#recent-list').innerHTML=state.team.latest.slice(0,6).map(record=>{
    const b=state.byId.get(record.speciesId);
    return `<button class="recent-row" data-bird="${b.id}"><span><span class="bird-name">${escape(displayBirdName(b))}</span><span class="bird-scientific">${escape(b.scientific)}</span><span class="recent-recorder">记录人：${escape(recorderLabel(record))}</span></span><time class="recent-date" datetime="${record.date}">${record.date.slice(5).replace('-','.')}</time></button>`;
  }).join('');
}
function results(){return filterBirds(state.birds,state.team.seen,state);}
function renderFamilies(){
  const families=['all',...new Set(state.birds.map(b=>b.family))];
  $('#family-nav').innerHTML=families.map(f=>`<button class="family-option" data-family="${escape(f)}" aria-pressed="${f===state.family}">${f==='all'?'全部科':escape(f)}</button>`).join('');
}
function renderCatalog(){
  const birds=results();
  $('#catalog-body').innerHTML=birds.map(b=>{
    const record=state.team.seen.get(b.id);
    const tag=record?'button':'div';
    return `<${tag} class="species-row ${record?'seen':'unseen'}" ${record?`data-bird="${b.id}" aria-label="查看${escape(displayBirdName(b))}的记录详情"`:''}><span class="species-identity"><span class="bird-name">${escape(displayBirdName(b))}</span><span class="bird-scientific">${escape(b.scientific)}</span></span><span class="bird-status ${record?'seen':'unseen'}">${record?check:''}<span class="status-text">${record?'已记录':'未记录'}</span></span></${tag}>`;
  }).join('');
  $('#empty-state').hidden=birds.length>0;$('#catalog-body').hidden=birds.length===0;
  $('#result-count').textContent=`共 ${number(birds.length)} 种鸟`;
  $('#clear-search').hidden=!state.query;
  $$('[data-status]').forEach(button=>{const selected=button.dataset.status===state.status;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',selected);});
  $$('[data-family]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.family===state.family));
}
function setFilters(patch){Object.assign(state,patch,{page:1});$('#search').value=state.query;renderCatalog();$('.species-pane').scrollTop=0;}
function bindEvents(){
  document.addEventListener('click',event=>{
    const bird=event.target.closest('[data-bird]');if(bird)openBird(Number(bird.dataset.bird));
    const province=event.target.closest('[data-province]');if(province)openProvince(Number(province.dataset.province));
  });
  $$('[data-status]').forEach(b=>b.addEventListener('click',()=>setFilters({status:b.dataset.status})));
  $('#search').addEventListener('input',event=>setFilters({query:event.target.value}));
  $('#clear-search').addEventListener('click',()=>{setFilters({query:''});$('#search').focus();});
  $('#family-nav').addEventListener('click',event=>{const button=event.target.closest('[data-family]');if(button){setFilters({family:button.dataset.family,sort:'catalog'});$('.catalog-browser').scrollIntoView({block:'start',behavior:'smooth'});}});
  $('#reset-filters').addEventListener('click',()=>setFilters({query:'',status:'all',family:'all',sort:'catalog'}));

  $('#all-recent').addEventListener('click',()=>{setFilters({status:'seen',sort:'latest',query:'',family:'all'});$('#catalog').scrollIntoView({behavior:'smooth'});});
  $('#all-provinces').addEventListener('click',openProvinces);
  $('#source-info').addEventListener('click',openSources);
  $$('.close-dialog').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
  $$('dialog').forEach(d=>d.addEventListener('click',event=>{if(event.target===d){const r=d.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)d.close();}}));
  $('#export-data').addEventListener('click',openReport);
  $('#map-wrap').addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.dataset.province){event.preventDefault();openProvince(Number(event.target.dataset.province));}});
  let resizeFrame;window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(renderMap);});
}
function openDetails(label,html){$('#dialog-label').textContent=label;$('#details-content').innerHTML=html;const d=$('#details-dialog');if(!d.open)d.showModal();d.scrollTop=0;}
function openBird(id){
  const b=state.byId.get(id),record=state.team.seen.get(id);if(!b||!record)return;
  openDetails('鸟种详情',`<div class="detail-badges"><span>${record?'队伍已记录':'队伍未记录'}</span><span>${escape(b.family)}</span></div><h2 class="detail-title">${escape(displayBirdName(b))}</h2><p class="detail-subtitle">${escape(b.scientific)}<br>${escape(b.english)}</p>${record?`<dl class="detail-grid"><div><dt>首次记录日期</dt><dd>${record.date}</dd></div><div><dt>名录编号</dt><dd>${b.id}</dd></div><div class="recorder-detail"><dt>记录人（网名）</dt><dd>${escape(recorderLabel(record))}</dd></div></dl>`:'<p class="detail-notice">当前队伍清单中还没有这个鸟种的记录。</p>'}<p class="detail-notice">鸟名按当前中国鸟类名录归一；日期来自记录中心。${record.recorderStatus==='private'?'原站将这条首次记录的记录用户隐藏，当前账号无法查看。':record.recorderStatus==='verified'?'记录人已从记录中心队伍明细核对，鸟种与首次记录日期一致。':record.recorderName?'记录人来自队长导入表，已核对物种编号与首次记录日期。':'当前公开接口未提供记录人，导入表也未覆盖这条首次记录。'}</p>`);
}
function renderProvinceSummary(){
  $('#footprint').hidden=!provinces.length;
  $('nav a[href="#footprint"]').hidden=!provinces.length;
  $('#province-summary').innerHTML=provinces.slice(0,4).map(p=>`<button data-province="${p.code}"><span>${escape(p.short)}</span><strong>${p.count} <small>种</small></strong></button>`).join('');
}
function openProvinces(){openDetails('省级观鸟分布',`<h2 class="detail-title">队伍的省级记录</h2><p class="detail-notice">全年在各省级地区记录的全部鸟种，同一鸟种可在多个省份分别计数，不能相加作为队伍总鸟种数。</p><div class="all-city-list">${provinces.map(p=>`<button data-province="${p.code}"><span>${escape(p.name)}</span><small>${p.count} 种 ›</small></button>`).join('')}</div>`);}
function openProvince(code){const p=provinces.find(p=>p.code===code);if(!p)return;openDetails('省级观鸟分布',`<h2 class="detail-title">${escape(p.name)}</h2><p class="detail-subtitle" style="font-style:normal">2026 年全队累计记录 ${p.count} 种鸟</p><p class="detail-notice">来自记录中心的队伍全年地区统计，包含在其他省份也记录过的鸟种。当前地图按省级地区展示。</p><p><a href="${escape(state.snapshot.sourceUrl)}" target="_blank" rel="noopener noreferrer">查看记录中心队伍统计 ↗</a></p>`);}
function openSources(){openDetails('名录与数据说明',`<div class="source-content"><h2 class="detail-title">真实记录，每日核对</h2><p><strong>鸟种记录：</strong>中国观鸟记录中心 2026 年新疆鸟会队（队伍 1849），原站 ${state.snapshot.sourceCount} 条，按当前名录归一后 ${state.team.count} 种。原站统计时间：${escape(state.snapshot.sourceUpdatedAt??'未提供')}；最近成功读取：${escape(state.snapshot.fetchedAt.replace('T',' ').replace('+08:00',''))}（北京时间）。最新观测日期为 ${state.snapshot.latestObservation}，不等同于更新时间。</p><p><strong>名录：</strong>《中国鸟类名录 12.0（2024）》加队长补充白尾石䳭及独立列出的斑腰燕，共 ${number(state.birds.length)} 种。金腰燕与斑腰燕按队长最新要求分开计数，各自保留首次记录日期。黄喉穗鹛仍归入红额穗鹛。同一鸟种保留最早记录日期；学名优先匹配，避免“田鹨”等同名异种误合并。总鸟种数可能与原站不同。</p><p><strong>记录人：</strong>显示队长导入表中的账号网名，按物种编号和首次记录日期核对后关联。手机号形式的网名已打码；未获得对应网名时不推测。网名不是数字账号 ID，公开队伍接口暂未提供数字账号 ID。</p><p><strong>观鸟分布：</strong>来自记录中心的全队年度省级统计。有记录的省份点亮，颜色深浅对应该省全年记录鸟种数；同一鸟种可在多个省份重复计数。当前没有接入完整市级数据，市级足迹留待后续版本。省级数据读取时间：${escape(state.snapshot.geographyFetchedAt??"未提供")}。</p><p><strong>全国排名：</strong>直接采用记录中心官网首页的 2026 年队伍榜单顺序，当前第 ${state.team.rank} 名，官方榜单鸟种数 ${state.snapshot.rankSourceCount} 种，保留官方口径。榜单读取时间：${escape(state.snapshot.rankingFetchedAt??state.snapshot.statisticsFetchedAt??"未提供")}。</p><p><strong>月度记录：</strong>来自记录中心的队伍月度统计，统计每个月记录的全部鸟种，同一鸟种在不同月份可以重复出现，不是每月新增鸟种数。排名与月度数据读取时间：${escape(state.snapshot.statisticsFetchedAt?.replace("T"," ").replace("+08:00","")??"未提供")}（北京时间）。</p><p><strong>更新：</strong>北京时间每天 00:00 尝试同步，依赖队长电脑开机且 Codex 运行。原站可能延后生成统计，以页面标注的实际时间为准。失败时保留上一次成功数据，不将失败记为零。Excel 导入继续作为备用方式。</p><p><strong>地图边界：</strong>阿里云 DataV 行政区划数据。</p><p><a href="${escape(state.snapshot.sourceUrl)}" target="_blank" rel="noopener noreferrer">查看记录中心队伍页面 ↗</a></p></div>`);}

// Official all-team annual province totals; first-record locations are not used.
function coordinates(geometry){return geometry.type==='Polygon'?geometry.coordinates:geometry.type==='MultiPolygon'?geometry.coordinates.flat():[];}
function projected(point){const [lon,lat]=point;const p=lat*Math.PI/180;return [lon,-Math.log(Math.tan(Math.PI/4+p/2))*180/Math.PI];}
function mapMarkup(scope='china',output='ui'){
  if(!state.geo.china||!provinces.length)return ''; 
  const features=state.geo.china.features;
  const points=features.flatMap(f=>coordinates(f.geometry).flat());
  const projectedPoints=points.map(projected);
  const xs=projectedPoints.map(p=>p[0]),ys=projectedPoints.map(p=>p[1]);
  const bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
  const width=600,height=350,padding=12;
  const scale=Math.min((width-padding*2)/(bounds[2]-bounds[0]),(height-padding*2)/(bounds[3]-bounds[1]));
  const dx=(width-(bounds[2]-bounds[0])*scale)/2,dy=(height-(bounds[3]-bounds[1])*scale)/2;
  const point=p=>{const [x,y]=projected(p);return [(x-bounds[0])*scale+dx,(y-bounds[1])*scale+dy];};
  const path=f=>coordinates(f.geometry).map(ring=>ring.map((p,i)=>{const [x,y]=point(p);return `${i?'L':'M'}${x.toFixed(2)},${y.toFixed(2)}`;}).join('')+'Z').join('');
  const byCode=new Map(provinces.map(p=>[p.code,p]));
  const fill=count=>count>=300?'#548365':count>=150?'#7da17d':count>=60?'#a1bc91':'#c4d3b4';
  let paths=features.map(f=>{const p=byCode.get(Number(f.properties.adcode));const active=p&&p.count>0;return `<path class="${active?'map-city':'map-base'}" fill="${active?fill(p.count):'#ecefe4'}" stroke="#fffefa" stroke-width="1.1" d="${path(f)}" ${active?`data-province="${p.code}" role="button" tabindex="0" aria-label="${escape(p.name)}，全年记录${p.count}种"`:''}><title>${escape(f.properties.name)}${active?' · '+p.count+' 种':''}</title></path>`;}).join('');
  const labels=features.filter(f=>[650000,540000,530000,310000].includes(Number(f.properties.adcode))&&byCode.has(Number(f.properties.adcode)));
  paths+=labels.map(f=>{const p=byCode.get(Number(f.properties.adcode));const [x,y]=point(f.properties.centroid??f.properties.center);return `<text x="${x}" y="${y}" text-anchor="middle" font-size="16" font-family="sans-serif" fill="#203e34" paint-order="stroke" stroke="#fffefa" stroke-width="3" pointer-events="none">${escape(p.short)}</text>`;}).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" aria-label="全国省级观鸟分布，绿色代表有记录的省级地区，颜色越深鸟种越多" role="group">${paths}</svg>`;
}
function renderMap(){const markup=mapMarkup();if(markup)$('#map-wrap').innerHTML=markup;}
async function imageFromSvg(svg){const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await image.decode();return image;}
const reportRankingHeight=rows=>rows.length?270+rows.length*100:0;
const reportHeight=()=>3300+reportRankingHeight(state.snapshot.rankingHighlights??[]);
async function buildReport(){
  await document.fonts.ready;
  const rankingRows=state.snapshot.rankingHighlights??[],rankingHeight=reportRankingHeight(rankingRows);
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=reportHeight();const ctx=canvas.getContext('2d');
  const ink='#203e34',muted='#66716b',paper='#f5f5ef',green='#214b3e',white='#fffefa';
  ctx.fillStyle=paper;ctx.fillRect(0,0,1080,canvas.height);
  const text=(s,x,y,size=42,color=ink,weight=400)=>{ctx.font=`${weight} ${size}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;ctx.fillStyle=color;ctx.fillText(String(s),x,y);};
  const line=y=>{ctx.beginPath();ctx.strokeStyle='#dbe2d4';ctx.lineWidth=2;ctx.moveTo(72,y);ctx.lineTo(1008,y);ctx.stroke();};
  const card=(y,h)=>{ctx.fillStyle=white;ctx.beginPath();ctx.roundRect(32,y,1016,h,28);ctx.fill();ctx.strokeStyle='#dfe4da';ctx.lineWidth=2;ctx.stroke();};
  text('新疆鸟会队观鸟记录',48,80,52,ink,650);text('2026 中国观鸟记录中心观鸟大年活动',48,136,34,muted);
  card(180,400+rankingHeight);
  ctx.save();ctx.beginPath();ctx.roundRect(32,180,1016,400+rankingHeight,28);ctx.clip();ctx.fillStyle=green;ctx.fillRect(32,180,1016,400);ctx.restore();
  text('累计记录鸟种',80,258,44,white,550);text(state.team.count,78,424,146,white,650);
  ctx.font='650 146px sans-serif';const unitX=80+ctx.measureText(String(state.team.count)).width+20;
  text('种',unitX,423,48,white);text(`/ ${number(state.birds.length)}`,unitX+65,423,38,'#d4e3c9');
  const month=Number(state.snapshot.latestObservation.slice(5,7)),added=state.team.latest.filter(r=>Number(r.date.slice(5,7))===month).length;
  text(`${month} 月新增 ${added} 种`,80,517,42,'#d4e3c9');
  if(rankingRows.length){
    text('全国队伍排名',72,665,50,ink,650);
    text('名次',80,748,38,muted);text('队伍',196,748,38,muted);ctx.textAlign='right';text('鸟种数',1000,748,38,muted);ctx.textAlign='left';
    rankingRows.forEach((r,i)=>{
      const top=780+i*100,y=top+65,own=r.teamId===1849;
      if(own){ctx.fillStyle='#eaf2e2';ctx.fillRect(72,top,936,100);}
      if(i>0&&r.rank>rankingRows[i-1].rank+1){ctx.setLineDash([7,7]);line(top);ctx.setLineDash([]);}
      text(r.rank,80,y,42,ink,own?650:400);
      let name=own?'新疆鸟会队':r.name;ctx.font='44px sans-serif';while(ctx.measureText(name).width>590&&name.length>2)name=name.slice(0,-2)+'…';
      text(name,196,y,44,ink,own?650:400);ctx.textAlign='right';text(number(r.count),1000,y,44,ink,own?650:400);ctx.textAlign='left';
    });
    text('记录中心官方计分口径',80,580+rankingHeight-32,36,muted);
  }
  const recentY=620+rankingHeight;card(recentY,1380);
  text('最近新发现',72,recentY+88,52,ink,650);
  text('每一种新相遇，都让队伍向前一步。',72,recentY+150,36,muted);
  text('队伍新增鸟种',72,recentY+233,36,muted);ctx.textAlign='right';text('首次记录',1008,recentY+233,36,muted);ctx.textAlign='left';line(recentY+267);
  state.team.latest.slice(0,6).forEach((r,i)=>{
    const y=recentY+267+i*175,b=state.byId.get(r.speciesId);
    text(displayBirdName(b),72,y+48,44,ink,650);text(b.scientific,72,y+94,34,muted);
    text(`记录人：${recorderLabel(r)}`,72,y+143,36,muted);
    ctx.textAlign='right';text(r.date.slice(5).replace('-','.'),1008,y+48,40,muted);ctx.textAlign='left';if(i<5)line(y+175);
  });
  const mapY=recentY+1420;card(mapY,750);text('队伍观鸟分布 · 省级',72,mapY+85,50,ink,650);
  const map=mapMarkup('china','report');if(map)ctx.drawImage(await imageFromSvg(map),2.4,mapY+110,1075.2,600);else text('地图暂未载入，请在网页查看',72,mapY+220,38,muted);
  const footerY=mapY+805;text(`更新时间 ${state.snapshot.sourceUpdatedAt??state.snapshot.latestObservation}`,48,footerY,34,muted);
  const qr=new Image();qr.src='./assets/dashboard-qr.png';await qr.decode();ctx.imageSmoothingEnabled=false;ctx.drawImage(qr,60,footerY+56,280,280);
  text('长按二维码，扫一扫查看详情',384,footerY+160,40,ink,550);text('查看最新记录与完整鸟种名录',384,footerY+220,36,muted);
  return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('长图生成失败')),'image/png'));
}
async function openReport(){
  const dialog=$('#report-dialog');$('#report-content').innerHTML='<p class="loading">正在生成战报长图…</p>';$('#download-report').hidden=true;dialog.showModal();
  try{const blob=await buildReport();if(state.reportUrl)URL.revokeObjectURL(state.reportUrl);state.reportUrl=URL.createObjectURL(blob);$('#report-content').innerHTML=`<img src="${state.reportUrl}" alt="新疆鸟会队观鸟数据：${state.team.count}种鸟、全国队伍榜、最近新增、省级观鸟分布和访问二维码" width="1080" height="${reportHeight()}">`;$('#download-report').href=state.reportUrl;$('#download-report').hidden=false;}
  catch(error){console.error(error);$('#report-content').innerHTML='<p class="loading">长图生成失败，请关闭后重试。</p>';}
}
function registerAgentTools(){
  if(!document.modelContext?.registerTool)return;
  const abort=new AbortController();
  document.modelContext.registerTool({name:'search_bird_catalog',title:'查询鸟种名录',description:'筛选鸟种名录并同步页面。队伍已记录状态来自最近成功同步的数据。',inputSchema:{type:'object',properties:{query:{type:'string'},status:{type:'string',enum:['all','seen','unseen']}},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute(input){if(!input||typeof input!=='object'||(input.query!==undefined&&typeof input.query!=='string')||(input.status!==undefined&&!['all','seen','unseen'].includes(input.status)))throw new Error('query 必须是字符串，status 必须为 all、seen 或 unseen');setFilters({query:input.query??'',status:input.status??'all',family:'all'});$('#catalog').scrollIntoView();return {demo:false,total:results().length,birds:results().slice(0,10).map(b=>({id:b.id,name:displayBirdName(b),seen:state.team.seen.has(b.id)}))};}},{signal:abort.signal});
  window.addEventListener('pagehide',()=>abort.abort(),{once:true});
}
init();
