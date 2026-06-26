import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
const { data: open } = await sb.from("open_invoices").select("recipient,amount_cents,status").neq("status","paid");
const DUNNING_RX=/mahnung|zahlungserinnerung|erfolglose? zahlung|fehlgeschlagen|unsuccessful|payment failed|overdue|past due|problem mit (?:ihrer|deiner|der)?\s*.{0,12}zahlung|handeln erforderlich|warten.{0,20}auf.{0,20}zahlung/i;
const c=new ImapFlow({host:"imap.strato.de",port:993,secure:true,auth:{user:env.IMAP_RAKETONE_USER,pass:env.IMAP_RAKETONE_PASSWORD},logger:false});
await c.connect();
const lock=await c.getMailboxLock("INBOX");
const since=new Date(new Date().getFullYear(),new Date().getMonth(),1);
for await (const m of c.fetch({since},{uid:true,envelope:true})){
  const subj=m.envelope?.subject||"";
  const from=(m.envelope?.from||[]).map(a=>`${a.name??""} ${a.address??""}`).join(" ");
  if(!(DUNNING_RX.test(subj)||DUNNING_RX.test(from))) continue;
  const msg=await c.fetchOne(String(m.uid),{source:true},{uid:true});
  const mail=await simpleParser(msg.source);
  const body=mail.text||"";
  const am=body.match(/(?:€|EUR)\s*([0-9]{1,4}(?:[.,][0-9]{3})*[.,][0-9]{2})|([0-9]{1,4}(?:[.,][0-9]{3})*[.,][0-9]{2})\s*(?:€|EUR)/i);
  console.log("•",subj.slice(0,55),"| amt:",am?(am[1]||am[2]):"—");
}
lock.release(); await c.logout();
console.log("\nOffene STRATO/Vodafone:", (open||[]).filter(o=>/strato|vodafone/i.test(o.recipient)).map(o=>`${o.recipient}:${o.amount_cents}`).join(", "));
