const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Get ALL collecting_requirements postings
  const { data: postings, count } = await supabase
    .from("gig_postings")
    .select("id, hirer_id, title", { count: "exact" })
    .eq("status", "collecting_requirements");

  console.log("Total collecting_requirements postings:", count);
  if (postings === null || postings.length === 0) return;

  const gigIds = postings.map(p => p.id);
  const hirerIds = [...new Set(postings.map(p => p.hirer_id).filter(Boolean))];

  // Find ALL linked conversations
  const { data: convs } = await supabase
    .from("conversations")
    .select("id, user_id, gig_id, message_count")
    .in("gig_id", gigIds)
    .in("user_id", hirerIds);

  const convGigIds = new Set((convs || []).map(c => c.gig_id));

  // Which postings have NO linked conversation?
  const noConv = postings.filter(p => convGigIds.has(p.id) === false);
  console.log("\nPostings WITH conversation:", postings.length - noConv.length);
  console.log("Postings WITHOUT conversation:", noConv.length);
  noConv.forEach(p => console.log("  MISSING conv -> gig:", p.id, "| hirer:", p.hirer_id, "| title:", p.title));

  // For postings with convos, check if messages table actually has rows
  const convIds = (convs || []).map(c => c.id);
  if (convIds.length > 0) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", convIds);

    const msgsPerConv = {};
    (msgs || []).forEach(m => {
      msgsPerConv[m.conversation_id] = (msgsPerConv[m.conversation_id] || 0) + 1;
    });

    const emptyConvs = convIds.filter(cid => (msgsPerConv[cid] || 0) === 0);
    console.log("\nConversations with 0 actual messages:", emptyConvs.length);
    if (emptyConvs.length > 0) {
      // Which posting do they belong to?
      emptyConvs.forEach(cid => {
        const c = (convs || []).find(x => x.id === cid);
        const p = postings.find(x => x.id === (c && c.gig_id));
        console.log("  EMPTY conv:", cid, "| gig:", c && c.gig_id, "| message_count field:", c && c.message_count, "| title:", p && p.title);
      });
    }
  }
})();
