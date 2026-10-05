import React, { useState } from 'react';
import { ERPPanel, ERPPanelHeader, ERPProgress, C } from '../components/ERPui';

const MONTHLY = [
  {m:'May',rev:285000,proj:3},{m:'Jun',rev:320000,proj:4},{m:'Jul',rev:290000,proj:3},
  {m:'Aug',rev:415000,proj:5},{m:'Sep',rev:380000,proj:4},{m:'Oct',rev:485000,proj:6},
];
const SERVICES = [
  {name:'ERP & POS',pct:38,amount:'LKR 1.84M',color:'#0066FF'},
  {name:'Websites',pct:28,amount:'LKR 1.36M',color:'#00D9FF'},
  {name:'Mobile Apps',pct:18,amount:'LKR 0.87M',color:'#8B5CF6'},
  {name:'Accounting & Tax',pct:16,amount:'LKR 0.78M',color:'#18C77A'},
];

const maxRev = Math.max(...MONTHLY.map(m=>m.rev));

export default function ERPAnalytics() {
  const [period, setPeriod] = useState('6M');
  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>

      {/* Period selector */}
      <div style={{display:'flex',gap:8}}>
        {['3M','6M','1Y'].map(p=>(
          <button key={p} onClick={()=>setPeriod(p)} style={{
            padding:'6px 16px',borderRadius:9,fontSize:12,fontWeight:700,cursor:'pointer',
            background:period===p?'linear-gradient(135deg,#0066FF,#1787FF)':'rgba(10,24,56,0.8)',
            color:period===p?'#fff':C.muted,border:period===p?'none':`1px solid ${C.border}`,
            transition:'all 0.15s',
          }}>{p}</button>
        ))}
      </div>

      {/* Top stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
        {[
          {label:'Total Revenue',  val:'LKR 4.85M', change:'+18%',  up:true,  icon:'💰'},
          {label:'Projects Done',  val:'24',         change:'+6 vs last period', up:true, icon:'✅'},
          {label:'New Clients',    val:'12',          change:'+4',   up:true,  icon:'👥'},
          {label:'Avg Project Val',val:'LKR 202K',   change:'+8%',  up:true,  icon:'📈'},
        ].map(s=>(
          <ERPPanel key={s.label} style={{padding:'16px 18px'}}>
            <div style={{fontSize:22,marginBottom:8}}>{s.icon}</div>
            <div style={{fontSize:20,fontWeight:900,color:C.text}}>{s.val}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>{s.label}</div>
            <div style={{fontSize:10,color:s.up?C.green:C.red,marginTop:4,fontWeight:600}}>{s.up?'↑':'↓'} {s.change}</div>
          </ERPPanel>
        ))}
      </div>

      {/* Revenue chart + breakdown */}
      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:16}}>

        {/* Bar chart */}
        <ERPPanel>
          <ERPPanelHeader title="Monthly Revenue" icon="📊" />
          <div style={{padding:'20px 18px'}}>
            <div style={{display:'flex',gap:8,alignItems:'flex-end',height:160}}>
              {MONTHLY.map((m,i)=>{
                const h = Math.round((m.rev/maxRev)*140);
                return (
                  <div key={m.m} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:6,cursor:'pointer'}}
                    title={`LKR ${m.rev.toLocaleString()}`}>
                    <div style={{fontSize:10,color:C.cyan,fontWeight:700}}>
                      {m.rev>=1000000?`${(m.rev/1000000).toFixed(1)}M`:`${(m.rev/1000).toFixed(0)}K`}
                    </div>
                    <div style={{
                      width:'100%',height:h,borderRadius:'6px 6px 0 0',
                      background:`linear-gradient(180deg,${i===MONTHLY.length-1?C.cyan:C.blue},${i===MONTHLY.length-1?C.blue:'rgba(0,102,255,0.3)'})`,
                      transition:'all 0.3s',position:'relative',
                    }}
                      onMouseEnter={e=>e.currentTarget.style.filter='brightness(1.2)'}
                      onMouseLeave={e=>e.currentTarget.style.filter='brightness(1)'}>
                      <div style={{position:'absolute',inset:0,borderRadius:'6px 6px 0 0',background:'linear-gradient(180deg,rgba(255,255,255,0.1),transparent)'}}/>
                    </div>
                    <div style={{fontSize:10,color:C.muted,fontWeight:600}}>{m.m}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </ERPPanel>

        {/* Service breakdown */}
        <ERPPanel>
          <ERPPanelHeader title="Revenue by Service" icon="🥧" />
          <div style={{padding:18,display:'flex',flexDirection:'column',gap:14}}>
            {SERVICES.map(s=>(
              <div key={s.name}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:10,height:10,borderRadius:'50%',background:s.color,boxShadow:`0 0 6px ${s.color}80`}}/>
                    <span style={{fontSize:12,color:C.subtle,fontWeight:600}}>{s.name}</span>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <span style={{fontSize:12,fontWeight:700,color:s.color}}>{s.pct}%</span>
                  </div>
                </div>
                <ERPProgress value={s.pct} color={s.color}/>
                <div style={{fontSize:10,color:C.muted,marginTop:3,textAlign:'right'}}>{s.amount}</div>
              </div>
            ))}
          </div>
        </ERPPanel>
      </div>

      {/* Bottom row */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <ERPPanel>
          <ERPPanelHeader title="Project Completion Rate" icon="✅"/>
          <div style={{padding:18,textAlign:'center'}}>
            <div style={{position:'relative',width:120,height:120,margin:'0 auto 16px'}}>
              <svg viewBox="0 0 36 36" style={{transform:'rotate(-90deg)'}}>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(32,52,93,0.4)" strokeWidth="3"/>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="url(#grad)" strokeWidth="3" strokeDasharray="87 100" strokeLinecap="round"/>
                <defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#0066FF"/><stop offset="100%" stopColor="#00D9FF"/></linearGradient></defs>
              </svg>
              <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                <div style={{fontSize:24,fontWeight:900,color:C.text}}>87%</div>
                <div style={{fontSize:9,color:C.muted}}>on time</div>
              </div>
            </div>
            <div style={{display:'flex',justifyContent:'center',gap:20}}>
              {[{l:'Completed',v:21,c:C.green},{l:'In Progress',v:8,c:C.blue},{l:'Delayed',v:3,c:C.red}].map(x=>(
                <div key={x.l} style={{textAlign:'center'}}>
                  <div style={{fontSize:18,fontWeight:900,color:x.c}}>{x.v}</div>
                  <div style={{fontSize:9,color:C.muted}}>{x.l}</div>
                </div>
              ))}
            </div>
          </div>
        </ERPPanel>

        <ERPPanel>
          <ERPPanelHeader title="Top Clients by Revenue" icon="🏆"/>
          <div style={{padding:'8px 0'}}>
            {[
              {name:'John Perera',    company:'Perera Holdings',     rev:'LKR 1.05M', rank:1},
              {name:'Sarah Fernando', company:'Mehala Restaurant',   rev:'LKR 720K',  rank:2},
              {name:'Priya Nair',     company:'PN Accounting',       rev:'LKR 630K',  rank:3},
              {name:'Kumar Arasan',   company:'KA Retail',           rev:'LKR 450K',  rank:4},
            ].map((c,i)=>(
              <div key={c.name} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 18px',borderTop:i>0?`1px solid ${C.border}20`:'none'}}>
                <div style={{width:24,height:24,borderRadius:6,background:i===0?'linear-gradient(135deg,#F5B942,#F09600)':i===1?'linear-gradient(135deg,#8B9AAF,#91A0BC)':'linear-gradient(135deg,#C59A5C,#8A6235)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:11,fontWeight:900,flexShrink:0}}>#{c.rank}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.text}}>{c.name}</div>
                  <div style={{fontSize:10,color:C.muted}}>{c.company}</div>
                </div>
                <div style={{fontSize:13,fontWeight:800,color:C.cyan}}>{c.rev}</div>
              </div>
            ))}
          </div>
        </ERPPanel>
      </div>
    </div>
  );
}
