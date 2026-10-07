import React from 'react';
import { ERPPanel, ERPPanelHeader, ERPProgress, C } from '../components/ERPui';

const MILESTONES = [
  {icon:'🏆',title:'500+ Happy Clients',desc:'Reached 500 satisfied clients across Sri Lanka.',done:true,val:500,target:500},
  {icon:'📁',title:'250 Projects Delivered',desc:'Successfully delivered 250+ software & accounting projects.',done:true,val:250,target:250},
  {icon:'⭐',title:'5 Years of Excellence',desc:'5+ years serving businesses with technology solutions.',done:true,val:5,target:5},
  {icon:'🌍',title:'3 Branch Locations',desc:'Offices in Trincomalee, Colombo, and Kurunegala.',done:true,val:3,target:3},
  {icon:'🚀',title:'1000 Clients Goal',desc:'Working towards 1000 active clients milestone.',done:false,val:500,target:1000},
  {icon:'💰',title:'LKR 10M Annual Revenue',desc:'Growing towards LKR 10 million annual revenue target.',done:false,val:4850000,target:10000000},
];

const CASE_STUDIES = [
  {emoji:'🍽️',title:'Mehala Restaurant Chain',desc:'Deployed SMART POS across 3 branches, reducing order errors by 94% and improving table turnover by 40%.', tags:['ERP/POS','Restaurant','Multi-Branch'],color:'#F5B942'},
  {emoji:'🛒',title:'KA Retail Supermarket',desc:'Barcode POS with multi-location inventory — checkout time reduced from 3 min to 45 sec per customer.',tags:['POS','Retail','Barcode'],color:'#18C77A'},
  {emoji:'💼',title:'PN Accounting Services',desc:'Digital migration from manual books — 5 years of records digitized, IRD compliance achieved in 2 weeks.',tags:['Accounting','Tax','Compliance'],color:'#8B5CF6'},
  {emoji:'🌐',title:'Perera Holdings Website',desc:'Corporate website with 15 pages, dark/light theme, SEO — generating 300% more inquiry leads.',tags:['Website','SEO','Lead Generation'],color:'#0066FF'},
];

export default function ERPAchievements() {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>

      {/* Hero banner */}
      <div style={{
        borderRadius:18,padding:'24px 28px',
        background:'linear-gradient(135deg,rgba(0,102,255,0.2),rgba(0,217,255,0.08))',
        border:'1px solid rgba(0,102,255,0.3)',position:'relative',overflow:'hidden',
      }}>
        <div style={{position:'absolute',right:-40,top:-40,width:200,height:200,borderRadius:'50%',background:'rgba(0,102,255,0.06)',filter:'blur(50px)'}}/>
        <div style={{position:'relative'}}>
          <div style={{fontSize:11,color:C.cyan,fontWeight:700,textTransform:'uppercase',letterSpacing:'1.5px',marginBottom:8}}>SMART Pvt Ltd · Since 2019</div>
          <div style={{fontSize:26,fontWeight:900,color:C.text}}>Our Achievements & Milestones</div>
          <div style={{fontSize:13,color:C.muted,marginTop:6}}>Building a smarter future, one project at a time.</div>
        </div>
        <div style={{display:'flex',gap:28,marginTop:20}}>
          {[{v:'500+',l:'Happy Clients'},{v:'250+',l:'Projects'},{v:'5+',l:'Years'},{v:'3',l:'Branches'}].map(s=>(
            <div key={s.l}>
              <div style={{fontSize:24,fontWeight:900,color:C.text}}>{s.v}</div>
              <div style={{fontSize:11,color:C.muted}}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Milestones grid */}
      <ERPPanel>
        <ERPPanelHeader title="Company Milestones" icon="🎯"/>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:1,background:C.border+'20'}}>
          {MILESTONES.map((m,i)=>(
            <div key={i} style={{padding:'20px',background:C.surface,backdropFilter:'blur(12px)'}}>
              <div style={{fontSize:28,marginBottom:8}}>{m.icon}</div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                <span style={{fontSize:13,fontWeight:800,color:m.done?C.text:C.muted}}>{m.title}</span>
                {m.done&&<span style={{fontSize:10,background:'rgba(24,199,122,0.15)',color:C.green,border:'1px solid rgba(24,199,122,0.3)',padding:'1px 8px',borderRadius:20,fontWeight:700}}>✓ Achieved</span>}
              </div>
              <div style={{fontSize:11,color:C.muted,lineHeight:1.5,marginBottom:10}}>{m.desc}</div>
              {!m.done&&(
                <div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:C.muted,marginBottom:4}}>
                    <span>{m.val.toLocaleString()} / {m.target.toLocaleString()}</span>
                    <span style={{color:C.cyan,fontWeight:700}}>{Math.round(m.val/m.target*100)}%</span>
                  </div>
                  <ERPProgress value={Math.round(m.val/m.target*100)} color={C.cyan}/>
                </div>
              )}
            </div>
          ))}
        </div>
      </ERPPanel>

      {/* Case studies */}
      <div>
        <div style={{fontSize:14,fontWeight:800,color:C.text,marginBottom:12}}>⭐ Client Success Stories</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:14}}>
          {CASE_STUDIES.map((cs,i)=>(
            <ERPPanel key={i} style={{padding:20,position:'relative',overflow:'hidden'}}>
              <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${cs.color},${cs.color}44,transparent)`}}/>
              <div style={{fontSize:28,marginBottom:10}}>{cs.emoji}</div>
              <div style={{fontSize:14,fontWeight:800,color:C.text,marginBottom:6}}>{cs.title}</div>
              <div style={{fontSize:12,color:C.muted,lineHeight:1.6,marginBottom:12}}>{cs.desc}</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {cs.tags.map(t=>(
                  <span key={t} style={{fontSize:10,padding:'3px 10px',borderRadius:20,background:`${cs.color}15`,color:cs.color,border:`1px solid ${cs.color}30`,fontWeight:600}}>{t}</span>
                ))}
              </div>
            </ERPPanel>
          ))}
        </div>
      </div>
    </div>
  );
}
