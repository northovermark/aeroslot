"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CalendarDays, ChevronRight, CircleHelp, Clock3, Gauge, MapPin, Plane, Plus, Search, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";

type Leg = {
  id: string; from: string; fromCode: string; to: string; toCode: string;
  departureAt: string; arrivalAt: string | null; aircraft: string; seats: number;
  price: number; currency: string; source: string; lastSeenAt: number | null;
  fromLat: number | null; fromLng: number | null; toLat: number | null; toLng: number | null;
};
type Source = {id:string;name:string;configured:boolean;lastSuccessAt?:number|null;importedCount?:number;needsAttention?:boolean;contractRequired?:boolean};
type RequestRow = {id:string;status:string;createdAt:number;amount:number;fromCode:string;toCode:string;departureAt:string;currency:string};
const sample:Leg[] = [
  {id:"demo-1",from:"London",fromCode:"LTN",to:"Nice",toCode:"NCE",departureAt:new Date(Date.now()+86400000).toISOString(),arrivalAt:null,aircraft:"Citation Latitude",seats:7,price:6800,currency:"EUR",source:"sample",lastSeenAt:null,fromLat:51.8747,fromLng:-0.3683,toLat:43.6584,toLng:7.2159},
  {id:"demo-2",from:"Paris",fromCode:"LBG",to:"Ibiza",toCode:"IBZ",departureAt:new Date(Date.now()+2*86400000).toISOString(),arrivalAt:null,aircraft:"Phenom 300E",seats:6,price:5200,currency:"EUR",source:"sample",lastSeenAt:null,fromLat:48.9694,fromLng:2.4414,toLat:38.8729,toLng:1.3731},
  {id:"demo-3",from:"Milan",fromCode:"LIN",to:"Mykonos",toCode:"JMK",departureAt:new Date(Date.now()+3*86400000).toISOString(),arrivalAt:null,aircraft:"Challenger 350",seats:8,price:8900,currency:"EUR",source:"sample",lastSeenAt:null,fromLat:45.4451,fromLng:9.2767,toLat:37.4351,toLng:25.3481},
];
const money=(value:number,currency="EUR")=>new Intl.NumberFormat("en-GB",{style:"currency",currency,maximumFractionDigits:0}).format(value);
const when=(date:string)=>new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"UTC"}).format(new Date(date))+" UTC";

export default function Home() {
  const [legs,setLegs]=useState<Leg[]>([]);
  const [sources,setSources]=useState<Source[]>([]);
  const [user,setUser]=useState<{email:string;canPublish:boolean}|null>(null);
  const [requests,setRequests]=useState<RequestRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [selected,setSelected]=useState<Leg|null>(null);
  const [demo,setDemo]=useState(false);
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [date,setDate]=useState("");
  const [seats,setSeats]=useState("1");
  const [budget,setBudget]=useState([20000]);
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [tab,setTab]=useState("explore");

  const refresh=useCallback(async()=>{
    try {
      const [inventory,status]=await Promise.all([
        fetch("/api/listings",{cache:"no-store"}), fetch("/api/sources",{cache:"no-store"})
      ]);
      if(!inventory.ok || !status.ok) throw new Error("Inventory is temporarily unavailable");
      const inventoryData=await inventory.json() as {listings:Leg[]};
      const statusData=await status.json() as {sources:Source[];user:{email:string;canPublish:boolean}|null};
      setLegs(inventoryData.listings ?? []);
      setSources(statusData.sources ?? []);
      setUser(statusData.user ?? null);
      setError("");
    } catch(e) {
      setError(e instanceof Error ? e.message : "Could not refresh inventory");
    } finally { setLoading(false); }
  },[]);
  useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),30000);return()=>clearInterval(timer)},[refresh]);
  useEffect(()=>{
    const ctx=(document as Document & {modelContext?:{registerTool:(tool:unknown,opts?:unknown)=>void}}).modelContext;
    if(!ctx?.registerTool)return;
    const controller=new AbortController();
    ctx.registerTool({name:"search_empty_legs",title:"Search empty legs",
      description:"Filter the displayed live inventory by route and maximum price; this does not reserve a flight.",
      inputSchema:{type:"object",properties:{from:{type:"string"},to:{type:"string"},maxPrice:{type:"number"}},additionalProperties:false},
      annotations:{readOnlyHint:true,untrustedContentHint:false},
      execute:(input:unknown)=>{
        if(!input||typeof input!=="object")throw new Error("Provide a search object");
        const values=input as {from?:unknown;to?:unknown;maxPrice?:unknown};
        if(values.from!==undefined&&typeof values.from!=="string")throw new Error("from must be text");
        if(values.to!==undefined&&typeof values.to!=="string")throw new Error("to must be text");
        if(values.maxPrice!==undefined&&(!Number.isFinite(values.maxPrice)||Number(values.maxPrice)<0))throw new Error("maxPrice must be positive");
        if(typeof values.from==="string")setFrom(values.from);
        if(typeof values.to==="string")setTo(values.to);
        if(typeof values.maxPrice==="number")setBudget([values.maxPrice]);
        setTab("explore");
        return {status:"filters_applied"};
      }},{signal:controller.signal});
    return()=>controller.abort();
  },[]);

  const visible=demo?sample:legs;
  const results=useMemo(()=>visible.filter(leg=>
    (!from||`${leg.from} ${leg.fromCode}`.toLowerCase().includes(from.toLowerCase())) &&
    (!to||`${leg.to} ${leg.toCode}`.toLowerCase().includes(to.toLowerCase())) &&
    (!date||leg.departureAt.slice(0,10)===date) &&
    leg.seats>=Math.max(1,Number(seats)||1) && leg.price<=budget[0]
  ),[visible,from,to,date,seats,budget]);
  useEffect(()=>{if(!selected||!visible.some(leg=>leg.id===selected.id))setSelected(visible[0]??null)},[visible,selected]);
  const active=selected&&results.some(leg=>leg.id===selected.id)?selected:results[0]??null;

  const createAlert=async()=>{
    const code=(value:string)=>value.trim().toUpperCase();
    if(!/^[A-Z]{3,4}$/.test(code(from))&&!/^[A-Z]{3,4}$/.test(code(to))) {
      toast.error("Enter a 3- or 4-letter airport code in From or To");return;
    }
    try {
      const response=await fetch("/api/alerts",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({fromCode:/^[A-Z]{3,4}$/.test(code(from))?code(from):null,
          toCode:/^[A-Z]{3,4}$/.test(code(to))?code(to):null,maxPrice:budget[0],minSeats:Number(seats)||1})});
      const data=await response.json() as {error?:string};
      if(!response.ok)throw new Error(data.error);
      toast.success("Alert saved. Delivery will begin when a notification channel is connected.");
    }catch(e){toast.error(e instanceof Error?e.message:"Could not save alert")}
  };

  const requestAvailability=async(leg:Leg)=>{
    try {
      const response=await fetch("/api/requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({listingId:leg.id})});
      const data=await response.json() as {error?:string};
      if(!response.ok)throw new Error(data.error);
      toast.success("Request saved. Dispatch integration and operator confirmation are still required.");
    }catch(e){toast.error(e instanceof Error?e.message:"Could not request this leg")}
  };
  const loadRequests=async()=>{try{const response=await fetch("/api/requests");if(response.ok)setRequests(((await response.json()) as {requests:RequestRow[]}).requests??[])}catch{}};
  const publish=async(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault();const form=e.currentTarget;const f=new FormData(form);
    const payload={from:String(f.get("from")),fromCode:String(f.get("fromCode")),to:String(f.get("to")),
      toCode:String(f.get("toCode")),departureAt:new Date(String(f.get("departure"))+"Z").toISOString(),
      aircraft:String(f.get("aircraft")),seats:Number(f.get("seats")),price:Number(f.get("price")),currency:"EUR"};
    try{
      const response=await fetch("/api/listings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error);
      form.reset();setDemo(false);setTab("explore");await refresh();toast.success("Operator listing published");
    }catch(e){toast.error(e instanceof Error?e.message:"Listing could not be published")}
  };
  const feed=sources.find(source=>source.id==="fl3xx");
  const feedRecent=Boolean(feed?.lastSuccessAt && Date.now()-feed.lastSuccessAt<30*60000);

  return <main className="min-h-screen bg-[#071419] text-[#eaf6f3]">
    <header className="border-b border-white/10 bg-[#071419]/95"><div className="mx-auto flex h-16 max-w-[1500px] items-center gap-3 px-4 lg:px-7">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-[#d8ff45] text-[#071419]"><Plane size={19}/></span>
      <strong className="text-xl tracking-tight">AeroSlot</strong>
      <nav className="ml-6 hidden gap-1 lg:flex"><button onClick={()=>setTab("explore")} className={tab==="explore"?"nav-active":""}>Marketplace</button><button onClick={()=>{setTab("bookings");void loadRequests()}}>Requests</button><button onClick={()=>setTab("operator")}>Operator portal</button></nav>
      <span className="ml-auto hidden text-sm text-[#a9bcbd] sm:block">{demo?"Sample mode":feedRecent?"Recently synced inventory":"Awaiting current provider feed"}</span>
      {user?<span className="hidden text-sm text-[#8ca4a7] md:block">{user.email}</span>:<a className="rounded-xl border border-white/20 px-4 py-2 text-sm" href="/signin-with-chatgpt?return_to=%2F" target="_top">Sign in</a>}
    </div></header>
    <section className="border-b border-white/10 bg-[radial-gradient(circle_at_50%_-45%,#24515a_0%,transparent_52%)] px-4 pb-6 pt-8 lg:px-7"><div className="mx-auto max-w-[1500px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-sm font-medium uppercase tracking-[.18em] text-[#d8ff45]">Empty-leg marketplace</p><h1 className="text-3xl font-medium tracking-[-.035em] sm:text-5xl">Find the flight that’s already going.</h1></div>
      <p className="max-w-sm text-sm leading-6 text-[#9cb2b3]">Priced repositioning legs from connected operators. Availability and price are rechecked before a request is recorded; operator confirmation is separate.</p></div>
      <div className="grid rounded-2xl border border-white/12 bg-[#102329] p-2 shadow-2xl shadow-black/25 md:grid-cols-[1fr_1fr_.75fr_.55fr_auto]">
        <SearchField label="From" value={from} onChange={setFrom} placeholder="City or airport code" icon={<Plane size={16}/>}/>
        <SearchField label="To" value={to} onChange={setTo} placeholder="Anywhere" icon={<MapPin size={16}/>}/>
        <label className="flex min-h-16 items-center gap-3 border-b border-white/10 px-4 md:border-b-0 md:border-r"><CalendarDays size={16} className="text-[#8ca4a7]"/><span><span className="block text-xs uppercase tracking-wider text-[#8ca4a7]">Departure (UTC)</span><Input type="date" value={date} onChange={e=>setDate(e.target.value)} className="h-auto border-0 bg-transparent p-0 text-white shadow-none"/></span></label>
        <SearchField label="Travellers" value={seats} onChange={setSeats} placeholder="1" icon={<Users size={16}/>}/>
        <Button onClick={()=>setTab("explore")} className="h-full min-h-16 rounded-xl bg-[#d8ff45] px-7 text-[#071419] hover:bg-[#c8f032]"><Search size={18}/> Search</Button>
      </div>
    </div></section>
    <Tabs value={tab} onValueChange={value=>{setTab(value);if(value==="bookings")void loadRequests()}} className="mx-auto max-w-[1500px]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3 lg:px-7">
        <TabsList className="bg-[#102329]"><TabsTrigger value="explore">Explore flights</TabsTrigger><TabsTrigger value="operator">Operator portal</TabsTrigger><TabsTrigger value="bookings">My requests</TabsTrigger></TabsList>
        <Button variant="ghost" onClick={()=>setFiltersOpen(v=>!v)} className="text-[#b5c7c8] lg:hidden"><Gauge size={16}/> Filters</Button>
      </div>
      <TabsContent value="explore" className="m-0">
        <div className="grid min-h-[650px] lg:grid-cols-[280px_minmax(380px,600px)_1fr]">
          <aside className={`${filtersOpen?"block":"hidden"} border-r border-white/10 p-5 lg:block`}>
            <div className="mb-6 flex items-center justify-between"><h2 className="text-lg">Refine</h2><button onClick={()=>{setFrom("");setTo("");setDate("");setSeats("1");setBudget([20000])}} className="text-sm text-[#d8ff45]">Reset</button></div>
            <div className="filter-block"><label>Maximum total price</label><div className="mb-4 flex justify-between text-sm"><span>€500</span><strong>{money(budget[0])}</strong></div><Slider value={budget} onValueChange={setBudget} min={500} max={50000} step={500}/></div>
            <div className="rounded-xl border border-white/12 bg-[#102329] p-4"><Bell className="mb-2 text-[#d8ff45]" size={20}/><h3 className="font-medium">Watch this route</h3><p className="mt-2 text-sm leading-5 text-[#9cb2b3]">Save your airport-code search for matching legs. Notification delivery is not connected yet.</p><Button variant="link" onClick={createAlert} className="mt-2 h-auto p-0 text-[#d8ff45]">Save route alert <ChevronRight size={15}/></Button></div>
            <div className="mt-5 rounded-xl border border-white/10 p-4"><h3 className="text-sm font-medium">Inventory sources</h3>
              {sources.map(source=><div key={source.id} className="mt-3 flex justify-between gap-2 text-sm"><span>{source.name}</span><span className={source.lastSuccessAt&&Date.now()-source.lastSuccessAt<30*60000?"text-[#d8ff45]":"text-[#8ca4a7]"}>{source.lastSuccessAt&&Date.now()-source.lastSuccessAt<30*60000?"Recently synced":source.lastSuccessAt?"Feed stale":source.configured?"Awaiting sync":"Not connected"}</span></div>)}
              {feed?.lastSuccessAt&&<p className="mt-3 text-xs text-[#8ca4a7]">Last FL3XX sync: {new Date(feed.lastSuccessAt).toLocaleString()}</p>}
              {feed?.needsAttention&&<p className="mt-2 text-xs text-[#efb57a]">Feed needs attention. Stale legs are hidden.</p>}
            </div>
          </aside>
          <section className="border-r border-white/10"><div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4"><div><strong>{results.length} {demo?"sample":"available"} {results.length===1?"leg":"legs"}</strong><span className="ml-2 text-sm text-[#8ca4a7]">subject to confirmation</span></div><button onClick={()=>{setDemo(v=>!v);setSelected(null)}} className="rounded-lg border border-white/15 px-3 py-2 text-sm text-[#d8ff45]">{demo?"Return to live inventory":"Explore sample data"}</button></div>
            <div className="space-y-3 px-4 pb-8">
              {loading&&!demo?<p className="rounded-2xl border border-white/10 p-8 text-[#9cb2b3]">Loading inventory…</p>:null}
              {error&&!demo?<p role="alert" className="rounded-2xl border border-[#efb57a]/40 p-5 text-[#efb57a]">{error}. <button onClick={()=>void refresh()} className="underline">Retry</button></p>:null}
              {results.map(leg=><FlightCard key={leg.id} leg={leg} active={active?.id===leg.id} onSelect={()=>setSelected(leg)} demo={demo}/>)}
              {!loading&&!error&&!results.length?<div className="rounded-2xl border border-dashed border-white/15 p-9 text-center"><Plane className="mx-auto mb-3 text-[#60777a]"/><h3 className="text-lg">{demo?"No sample flights match":"No live flights match"}</h3><p className="mt-2 text-sm leading-6 text-[#9cb2b3]">{!demo&&!feed?.lastSuccessAt?"Connect an approved provider feed or have an operator publish a leg.": "Try a broader route/date search or save an alert."}</p></div>:null}
            </div>
          </section>
          <RoutePanel leg={active} demo={demo} onRequest={requestAvailability}/>
        </div>
      </TabsContent>
      <TabsContent value="operator" className="m-0"><OperatorPortal user={user} sources={sources} onPublish={publish}/></TabsContent>
      <TabsContent value="bookings" className="m-0"><RequestsPanel requests={requests} user={user}/></TabsContent>
    </Tabs><Toaster position="top-right" richColors/>
  </main>;
}

function SearchField({label,value,onChange,placeholder,icon}:{label:string;value:string;onChange:(s:string)=>void;placeholder:string;icon:React.ReactNode}){
  return <label className="flex min-h-16 items-center gap-3 border-b border-white/10 px-4 md:border-b-0 md:border-r"><span className="text-[#8ca4a7]">{icon}</span><span className="min-w-0"><span className="block text-xs uppercase tracking-wider text-[#8ca4a7]">{label}</span><Input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="h-auto border-0 bg-transparent p-0 text-base text-white shadow-none focus-visible:ring-0"/></span></label>;
}
function FlightCard({leg,active,onSelect,demo}:{leg:Leg;active:boolean;onSelect:()=>void;demo:boolean}){
  return <button onClick={onSelect} className={`w-full rounded-2xl border p-4 text-left transition ${active?"border-[#d8ff45]/60 bg-[#142b30]":"border-white/10 bg-[#0d1d22] hover:border-white/25"}`}>
    <div className="mb-4 flex items-center justify-between gap-3 text-sm text-[#a9bcbd]"><span>{leg.aircraft} · {leg.seats} seats</span><span className="rounded-full border border-white/15 px-2 py-1 text-xs">{demo?"SAMPLE":leg.source==="fl3xx"?"FL3XX feed":"Direct operator"}</span></div>
    <div className="grid grid-cols-[1fr_auto_1fr] items-center"><div><div className="text-2xl font-semibold">{leg.fromCode}</div><div className="text-sm text-[#9cb2b3]">{leg.from}</div></div><div className="mx-4 flex min-w-24 items-center"><span className="h-px flex-1 bg-white/20"/><Plane className="mx-2 rotate-45 text-[#d8ff45]" size={16}/><span className="h-px flex-1 bg-white/20"/></div><div className="text-right"><div className="text-2xl font-semibold">{leg.toCode}</div><div className="text-sm text-[#9cb2b3]">{leg.to}</div></div></div>
    <div className="mt-4 flex items-end justify-between border-t border-white/10 pt-4"><div><div className="text-sm text-[#9cb2b3]">{when(leg.departureAt)}</div><strong className="mt-1 block text-xl">{money(leg.price,leg.currency)}</strong></div><span className="text-xs text-[#9cb2b3]">{leg.lastSeenAt?"Seen "+new Date(leg.lastSeenAt).toLocaleTimeString():"Operator supplied"}</span></div>
  </button>;
}
function RoutePanel({leg,demo,onRequest}:{leg:Leg|null;demo:boolean;onRequest:(leg:Leg)=>Promise<void>}){
  return <aside className="border-l border-white/10 bg-[#0b1b20] p-5 lg:min-h-[650px]"><p className="mb-4 text-sm font-medium uppercase tracking-[.12em] text-[#8ca4a7]">Selected route</p>
    {leg?<div className="rounded-2xl border border-white/12 bg-[#102329] p-5">
      <div className="mb-5 flex items-center justify-between"><span className="text-3xl font-semibold">{leg.fromCode}</span><span className="mx-4 h-px flex-1 bg-[#d8ff45]/50"/><Plane size={18} className="text-[#d8ff45]"/><span className="mx-4 h-px flex-1 bg-[#d8ff45]/50"/><span className="text-3xl font-semibold">{leg.toCode}</span></div>
      <p className="text-sm text-[#a9bcbd]">{when(leg.departureAt)} · {leg.aircraft}</p>
      <p className="mt-5 text-2xl font-semibold">{money(leg.price,leg.currency)}</p>
      <p className="mt-3 text-sm leading-6 text-[#9cb2b3]">{demo?"This is demonstration data. It is not a flight for sale.":"Feed availability is rechecked before saving a request. Operator-owned listings still require direct confirmation. A request is not a booking."}</p>
      {demo?<Button disabled className="mt-5 w-full bg-white/10 text-[#8ca4a7]">Sample — not bookable</Button>:<Dialog><DialogTrigger asChild><Button className="mt-5 w-full bg-[#d8ff45] text-[#071419] hover:bg-[#c8f032]">Request availability</Button></DialogTrigger><DialogContent className="border-white/10 bg-[#102329] text-white"><DialogHeader><DialogTitle>Request {leg.fromCode} → {leg.toCode}</DialogTitle></DialogHeader><p className="text-sm leading-6 text-[#a9bcbd]">We will recheck connected feed inventory and save your request. Operator dispatch and confirmation are not connected yet. You will not be charged or reserve the aircraft.</p><Button onClick={()=>void onRequest(leg)} className="bg-[#d8ff45] text-[#071419]">Save availability request</Button></DialogContent></Dialog>}
    </div>:<p className="rounded-xl border border-dashed border-white/15 p-8 text-sm text-[#9cb2b3]">Choose a listing to view its details.</p>}
    <div className="mt-5 flex gap-3 rounded-xl border border-white/10 p-4 text-sm leading-6 text-[#9cb2b3]"><ShieldCheck size={20} className="shrink-0 text-[#d8ff45]"/>Payments are not enabled. Feed listings may change at any time.</div>
  </aside>;
}
function OperatorPortal({user,sources,onPublish}:{user:{email:string;canPublish:boolean}|null;sources:Source[];onPublish:(e:React.FormEvent<HTMLFormElement>)=>void}){
  return <section className="mx-auto max-w-5xl p-5 sm:p-8"><p className="text-sm text-[#d8ff45]">Operator portal</p><h2 className="mt-2 text-3xl">Publish a repositioning leg</h2><p className="mt-2 max-w-2xl text-[#9cb2b3]">Connect your operations system or enter an approved priced leg directly. Only authorized operators can publish.</p>
    <div className="mt-7 grid gap-4 sm:grid-cols-3">{sources.map(source=><div key={source.id} className="rounded-xl border border-white/10 bg-[#102329] p-4"><strong>{source.name}</strong><p className="mt-2 text-sm text-[#9cb2b3]">{source.lastSuccessAt?"Last sync "+new Date(source.lastSuccessAt).toLocaleString():source.configured?"Configured; awaiting first successful sync":source.contractRequired?"Integration requires provider approval":"Add server-side credentials to activate"}</p></div>)}</div>
    {!user?.canPublish?<div role="status" className="mt-6 rounded-xl border border-[#d8ff45]/20 bg-[#d8ff45]/5 p-5 text-sm leading-6 text-[#c0d0cb]">{user?"Your account does not have operator publishing rights. Ask the site owner to assign the operator role.":"Sign in with an authorized operator account to publish."}</div>:<form onSubmit={onPublish} className="mt-6 grid gap-5 rounded-2xl border border-white/10 bg-[#0d1d22] p-5 sm:grid-cols-2 sm:p-7">
      <FormInput name="from" label="Origin city or airport" placeholder="London"/><FormInput name="fromCode" label="Origin IATA / ICAO" placeholder="LTN"/>
      <FormInput name="to" label="Destination city or airport" placeholder="Nice"/><FormInput name="toCode" label="Destination IATA / ICAO" placeholder="NCE"/>
      <FormInput name="departure" label="Departure date and time (UTC)" type="datetime-local"/><FormInput name="aircraft" label="Aircraft" placeholder="Citation Latitude"/>
      <FormInput name="seats" label="Aircraft seat capacity" type="number" placeholder="7"/><FormInput name="price" label="Headline price (€)" type="number" placeholder="6800"/>
      <div className="sm:col-span-2"><Button type="submit" className="bg-[#d8ff45] text-[#071419] hover:bg-[#c8f032]"><Plus size={17}/> Publish approved listing</Button></div>
    </form>}
    <p className="mt-6 max-w-3xl text-sm leading-6 text-[#8ca4a7]"><CircleHelp size={16} className="mr-2 inline"/>API keys are stored as server secrets. The FL3XX sync endpoint must be called by an external scheduler with a separate sync token; Avinode and Leon remain disconnected until their commercial permissions and API mappings are supplied.</p>
  </section>;
}
function FormInput({name,label,type="text",placeholder}:{name:string;label:string;type?:string;placeholder?:string}) {
  return <label><span className="mb-2 block text-sm text-[#a9bcbd]">{label}</span><Input required name={name} type={type} placeholder={placeholder} className="h-12 border-white/12 bg-[#071419] text-white"/></label>;
}
function RequestsPanel({requests,user}:{requests:RequestRow[];user:{email:string}|null}) {
  return <section className="mx-auto min-h-[560px] max-w-4xl p-6 sm:p-10"><p className="text-sm text-[#d8ff45]">Passenger account</p><h2 className="mt-2 text-3xl">Availability requests</h2>
    {!user?<p className="mt-7 text-[#9cb2b3]">Sign in to view your requests.</p>:requests.length?requests.map(item=><div key={item.id} className="mt-5 flex flex-wrap justify-between gap-4 rounded-xl border border-white/10 bg-[#102329] p-5"><div><strong>{item.fromCode} → {item.toCode}</strong><p className="mt-1 text-sm text-[#9cb2b3]">{when(item.departureAt)}</p></div><div className="text-right"><strong>{money(item.amount,item.currency)}</strong><p className="mt-1 text-sm text-[#d8ff45]">{item.status==="pending"?"Awaiting operator confirmation":item.status}</p></div></div>):<div className="mt-8 rounded-2xl border border-dashed border-white/15 p-12 text-center"><Clock3 className="mx-auto mb-4 text-[#6f8689]"/><h3 className="text-lg">No requests yet</h3><p className="mt-2 text-sm text-[#9cb2b3]">Flights you ask an operator to confirm will appear here.</p></div>}
  </section>;
}
