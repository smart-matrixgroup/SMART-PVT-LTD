import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { ERPPanel, ERPBadge, ERPBtn, C } from '../components/ERPui';
import { Send, MessageCircle, Search } from 'lucide-react';

const CONVERSATIONS = [
  {
    projectId:'P001', projectTitle:'Corporate Website Redesign',
    clientId:'C001',  clientName:'John Perera', clientCompany:'Perera Holdings',
    lastMsg:'Can we change the hero section color to blue?', lastTime:'2 hr ago', unread:0,
    color:'#0066FF',
  },
  {
    projectId:'P002', projectTitle:'Restaurant POS System',
    clientId:'C002',  clientName:'Sarah Fernando', clientCompany:'Mehala Restaurant',
    lastMsg:'The table management module is looking great!', lastTime:'Yesterday', unread:2,
    color:'#8B5CF6',
  },
  {
    projectId:'P003', projectTitle:'Mobile App Development',
    clientId:'C003',  clientName:'Kumar Arasan', clientCompany:'KA Retail',
    lastMsg:'When will the first prototype be ready?', lastTime:'2 days ago', unread:1,
    color:'#18C77A',
  },
  {
    projectId:'P004', projectTitle:'Annual Tax Filing 2024',
    clientId:'C004',  clientName:'Priya Nair', clientCompany:'PN Accounting',
    lastMsg:'Thank you for completing the IRD submission!', lastTime:'3 days ago', unread:0,
    color:'#F5B942',
  },
];

const DEV_MESSAGES = {
  P001:[
    {id:'m1',senderId:'C001',senderName:'John Perera',senderRole:'client',text:'Hi! I reviewed the homepage design. It looks really clean!',timestamp:{toDate:()=>new Date(Date.now()-7200000)},sessionId:'2026-10-05'},
    {id:'m2',senderId:'admin',senderName:'SMART Team',senderRole:'admin',text:'Thank you! We spent extra time on the hero section. Would you like any changes to the color scheme?',timestamp:{toDate:()=>new Date(Date.now()-6800000)},sessionId:'2026-10-05'},
    {id:'m3',senderId:'C001',senderName:'John Perera',senderRole:'client',text:'Can we change the hero section color to blue? Our brand color is navy blue.',timestamp:{toDate:()=>new Date(Date.now()-3600000)},sessionId:'2026-10-05'},
  ],
  P002:[
    {id:'m4',senderId:'C002',senderName:'Sarah Fernando',senderRole:'client',text:'The POS billing module works perfectly! Our staff loves it.',timestamp:{toDate:()=>new Date(Date.now()-86400000)},sessionId:'2026-10-04'},
    {id:'m5',senderId:'admin',senderName:'SMART Team',senderRole:'admin',text:'Great to hear! We will start the table management module next week.',timestamp:{toDate:()=>new Date(Date.now()-82000000)},sessionId:'2026-10-04'},
    {id:'m6',senderId:'C002',senderName:'Sarah Fernando',senderRole:'client',text:'The table management module is looking great!',timestamp:{toDate:()=>new Date(Date.now()-75000000)},sessionId:'2026-10-04'},
  ],
  P003:[
    {id:'m7',senderId:'C003',senderName:'Kumar Arasan',senderRole:'client',text:'Hi, I submitted the requirement form. Please let me know when work begins.',timestamp:{toDate:()=>new Date(Date.now()-172800000)},sessionId:'2026-10-03'},
    {id:'m8',senderId:'admin',senderName:'SMART Team',senderRole:'admin',text:'Hi Kumar! We received your requirements. Our team is reviewing them and will create a quotation shortly.',timestamp:{toDate:()=>new Date(Date.now()-169000000)},sessionId:'2026-10-03'},
    {id:'m9',senderId:'C003',senderName:'Kumar Arasan',senderRole:'client',text:'When will the first prototype be ready?',timestamp:{toDate:()=>new Date(Date.now()-165000000)},sessionId:'2026-10-03'},
  ],
};

export default function ERPMessages() {
  const { isDevSession } = useAuth();
  const [conversations, setConversations] = useState(CONVERSATIONS);
  const [selected,      setSelected]      = useState(CONVERSATIONS[0]);
  const [messages,      setMessages]      = useState(DEV_MESSAGES[CONVERSATIONS[0].projectId]||[]);
  const [msgText,       setMsgText]       = useState('');
  const [sending,       setSending]       = useState(false);
  const [search,        setSearch]        = useState('');
  const msgEndRef = useRef(null);

  // Load messages for selected conversation
  useEffect(()=>{
    if (!selected) return;
    if (!isFirebaseConfigured||isDevSession) {
      setMessages(DEV_MESSAGES[selected.projectId]||[]);
      return;
    }
    const q = query(collection(db,'messages',selected.projectId,'chats'),orderBy('timestamp','asc'));
    return onSnapshot(q,snap=>setMessages(snap.docs.map(d=>({id:d.id,...d.data()}))));
  },[selected,isDevSession]);

  useEffect(()=>{ msgEndRef.current?.scrollIntoView({behavior:'smooth'}); },[messages]);

  const handleSelect = (conv) => {
    setSelected(conv);
    // Mark as read
    setConversations(p=>p.map(c=>c.projectId===conv.projectId?{...c,unread:0}:c));
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!msgText.trim()||!selected) return;
    setSending(true);
    const now = new Date();
    const newMsg = {
      id:`m${Date.now()}`, senderId:'admin', senderName:'SMART Team', senderRole:'admin',
      text:msgText.trim(), sessionId:now.toISOString().slice(0,10),
      timestamp:{toDate:()=>now},
    };
    if (!isFirebaseConfigured||isDevSession) {
      setMessages(p=>[...p,newMsg]);
      setConversations(p=>p.map(c=>c.projectId===selected.projectId?{...c,lastMsg:msgText.trim(),lastTime:'Just now'}:c));
    } else {
      try {
        await addDoc(collection(db,'messages',selected.projectId,'chats'),{
          senderId:'admin',senderName:'SMART Team',senderRole:'admin',
          text:msgText.trim(),timestamp:serverTimestamp(),
          sessionId:now.toISOString().slice(0,10),
        });
      } catch(e){console.error(e);}
    }
    setMsgText('');
    setSending(false);
  };

  const filteredConvs = conversations.filter(c=>
    c.clientName.toLowerCase().includes(search.toLowerCase())||
    c.projectTitle.toLowerCase().includes(search.toLowerCase())
  );
  const totalUnread = conversations.reduce((s,c)=>s+c.unread,0);

  return (
    <div style={{display:'flex',gap:16,height:'calc(100vh - 140px)',minHeight:500}}>

      {/* ── Conversation list ── */}
      <div style={{
        width:300,flexShrink:0,
        background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,
        backdropFilter:'blur(12px)',display:'flex',flexDirection:'column',overflow:'hidden',
      }}>
        {/* Header */}
        <div style={{padding:'14px 16px',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <span style={{fontSize:13,fontWeight:700,color:C.text}}>Messages</span>
            {totalUnread>0&&<span style={{background:'linear-gradient(135deg,#0066FF,#00D9FF)',color:'#fff',fontSize:10,fontWeight:800,padding:'2px 8px',borderRadius:20}}>{totalUnread} new</span>}
          </div>
          <div style={{position:'relative'}}>
            <Search size={12} style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:C.muted}}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..."
              style={{width:'100%',background:'rgba(10,24,56,0.8)',border:`1px solid ${C.border}`,borderRadius:9,padding:'7px 10px 7px 27px',color:C.text,fontSize:11,outline:'none',boxSizing:'border-box'}}
              onFocus={e=>e.target.style.borderColor='rgba(0,102,255,0.5)'}
              onBlur={e=>e.target.style.borderColor=C.border}/>
          </div>
        </div>

        {/* List */}
        <div style={{flex:1,overflowY:'auto'}}>
          {filteredConvs.map((conv,i)=>{
            const isActive = selected?.projectId===conv.projectId;
            return (
              <div key={conv.projectId} onClick={()=>handleSelect(conv)}
                style={{
                  padding:'12px 14px',cursor:'pointer',transition:'background 0.1s',
                  borderTop:i>0?`1px solid ${C.border}20`:'none',
                  background:isActive?'rgba(0,102,255,0.1)':'transparent',
                  borderLeft:isActive?`3px solid ${conv.color}`:'3px solid transparent',
                  position:'relative',
                }}
                onMouseEnter={e=>{if(!isActive)e.currentTarget.style.background='rgba(0,102,255,0.04)';}}
                onMouseLeave={e=>{if(!isActive)e.currentTarget.style.background='transparent';}}>
                <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
                  {/* Avatar */}
                  <div style={{
                    width:36,height:36,borderRadius:10,flexShrink:0,
                    background:`linear-gradient(135deg,${conv.color},${conv.color}99)`,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    color:'#fff',fontWeight:800,fontSize:14,
                  }}>{conv.clientName[0]}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontSize:12,fontWeight:700,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',flex:1}}>{conv.clientName}</span>
                      <span style={{fontSize:9,color:C.muted,flexShrink:0,marginLeft:6}}>{conv.lastTime}</span>
                    </div>
                    <div style={{fontSize:10,color:C.cyan,marginTop:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{conv.projectTitle}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{conv.lastMsg}</div>
                  </div>
                  {conv.unread>0&&(
                    <div style={{width:18,height:18,borderRadius:'50%',background:'linear-gradient(135deg,#0066FF,#00D9FF)',color:'#fff',fontSize:9,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:2}}>{conv.unread}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Chat window ── */}
      <div style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,backdropFilter:'blur(12px)',display:'flex',flexDirection:'column',overflow:'hidden',position:'relative'}}>
        {!selected ? (
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12}}>
            <MessageCircle size={40} style={{color:C.border,opacity:0.5}}/>
            <span style={{fontSize:13,color:C.muted}}>Select a conversation to start messaging</span>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div style={{padding:'12px 18px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
              <div style={{width:38,height:38,borderRadius:11,background:`linear-gradient(135deg,${selected.color},${selected.color}99)`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:16,flexShrink:0}}>{selected.clientName[0]}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:800,color:C.text}}>{selected.clientName}</div>
                <div style={{fontSize:11,color:C.cyan}}>{selected.projectTitle} · {selected.clientCompany}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <div style={{width:7,height:7,borderRadius:'50%',background:C.green,boxShadow:`0 0 6px ${C.green}`}}/>
                <span style={{fontSize:10,color:C.green,fontWeight:600}}>Active</span>
              </div>
            </div>

            {/* Messages */}
            <div style={{flex:1,overflowY:'auto',padding:'16px 18px',display:'flex',flexDirection:'column',gap:12}}>
              {messages.length===0&&(
                <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:8}}>
                  <MessageCircle size={32} style={{color:C.border,opacity:0.5}}/>
                  <span style={{fontSize:12,color:C.muted}}>No messages yet. Start the conversation!</span>
                </div>
              )}
              {messages.map(msg=>{
                const isAdmin = msg.senderRole==='admin'||msg.senderId==='admin';
                const time = msg.timestamp?.toDate?.()?.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})||'';
                return (
                  <div key={msg.id} style={{display:'flex',justifyContent:isAdmin?'flex-end':'flex-start',alignItems:'flex-end',gap:8}}>
                    {!isAdmin&&(
                      <div style={{width:28,height:28,borderRadius:'50%',background:`linear-gradient(135deg,${selected.color},${selected.color}99)`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:11,fontWeight:800,flexShrink:0}}>{selected.clientName[0]}</div>
                    )}
                    <div style={{maxWidth:'68%',display:'flex',flexDirection:'column',gap:3,[isAdmin?'alignItems':'alignItems']:isAdmin?'flex-end':'flex-start'}}>
                      {!isAdmin&&<span style={{fontSize:10,color:C.muted,fontWeight:600,paddingLeft:2}}>{msg.senderName}</span>}
                      <div style={{
                        padding:'10px 14px',borderRadius:isAdmin?'16px 16px 4px 16px':'16px 16px 16px 4px',
                        fontSize:12,lineHeight:1.5,
                        background:isAdmin?'linear-gradient(135deg,#0066FF,#1787FF)':'rgba(10,24,56,0.8)',
                        color:isAdmin?'#fff':C.text,
                        border:isAdmin?'none':`1px solid ${C.border}30`,
                        boxShadow:isAdmin?'0 4px 12px rgba(0,102,255,0.3)':'none',
                      }}>{msg.text}</div>
                      <span style={{fontSize:9,color:C.muted,paddingRight:2}}>{time}</span>
                    </div>
                    {isAdmin&&(
                      <div style={{width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,#0066FF,#00D9FF)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:10,fontWeight:800,flexShrink:0}}>S</div>
                    )}
                  </div>
                );
              })}
              <div ref={msgEndRef}/>
            </div>

            {/* Input */}
            <form onSubmit={handleSend} style={{padding:'12px 16px',borderTop:`1px solid ${C.border}`,display:'flex',gap:10,alignItems:'center',flexShrink:0}}>
              <input
                value={msgText} onChange={e=>setMsgText(e.target.value)}
                placeholder={`Reply to ${selected.clientName}... (Enter to send)`}
                autoComplete="off"
                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend(e);}}}
                style={{flex:1,background:'rgba(10,24,56,0.8)',border:`1px solid ${C.border}`,borderRadius:12,padding:'10px 16px',color:C.text,fontSize:13,outline:'none',transition:'border-color 0.15s'}}
                onFocus={e=>e.target.style.borderColor='rgba(0,102,255,0.5)'}
                onBlur={e=>e.target.style.borderColor=C.border}
              />
              <button type="submit" disabled={!msgText.trim()||sending}
                style={{width:42,height:42,borderRadius:12,background:'linear-gradient(135deg,#0066FF,#1787FF)',border:'none',cursor:msgText.trim()&&!sending?'pointer':'not-allowed',opacity:msgText.trim()&&!sending?1:0.4,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.15s',boxShadow:'0 4px 12px rgba(0,102,255,0.4)'}}>
                <Send size={16} color="#fff"/>
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
