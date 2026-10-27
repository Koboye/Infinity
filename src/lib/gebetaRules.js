// The Gebeta rulebook, one game type at a time (v73). Pure data + a tiny search, so it works offline and is unit-tested.
// Every sentence here mirrors src/lib/gebeta/engine.js — if a rule changes there, change it here too (tests/gebeta-rulebook.test.mjs checks the shape).
//
// Three types:  gebeta (ገበጣ · families of four)  ·  ashagro (አሻግሮ መብል · capture across)  ·  tuz (ጡዝ · the frozen Tuz)

export const GEBETA_TYPES = ['gebeta', 'ashagro', 'tuz'];

const S = (en, am) => ({ en, am });

export const RULEBOOK = {
  gebeta: {
    icon: '🪨',
    name: S('Ethio Gebeta', 'ገበጣ'),
    pitch: S('Sow, relay and collect every family of four.', 'ዘርተህ፣ ቀጥለህ፣ የአራት ቤተሰብ ሰብስብ።'),
    steps: [
      { h: S('The board', 'ሰሌዳው'), b: S('Twelve holes, six for each player, with four seeds in every hole: 48 seeds in all. Your holes are the row nearest you. The two long trays at the ends are family piles, not holes.', 'አሥራ ሁለት ቀዳዳዎች አሉ፤ ለእያንዳንዱ ተጫዋች ስድስት፣ በእያንዳንዱ ቀዳዳ አራት ዘር — በጠቅላላው 48 ዘር። ቀዳዳዎችህ ወደ አንተ የቀረበው ረድፍ ናቸው። በጫፎቹ ያሉት ሁለቱ ረጃጅም ትሪዎች የቤተሰብ ክምር እንጂ ቀዳዳ አይደሉም።') },
      { h: S('Who starts', 'ማን ይጀምራል'), b: S('A spin wheel picks the first player. After that the opener alternates every round and every rematch.', 'የሚሽከረከር ጎማ የመጀመሪያውን ተጫዋች ይመርጣል። ከዚያ በኋላ ጀማሪው በየዙሩ እና በየድጋሚ ጨዋታው ይቀያየራል።') },
      { h: S('Pick a hole', 'ቀዳዳ ምረጥ'), b: S('On your turn tap one of your holes that has seeds. Every seed in it is lifted into your hand.', 'በተራህ ዘር ያለበትን ከቀዳዳዎችህ አንዱን ንካ። በውስጡ ያሉ ሁሉም ዘሮች ወደ እጅህ ይነሳሉ።') },
      { h: S('Sow one by one', 'አንድ በአንድ ዝራ'), b: S('Drop the seeds one at a time into the next holes, counter-clockwise: through your row, then your opponent\'s row, and round again. No numbers are shown — count the stones yourself.', 'ዘሮቹን አንድ በአንድ ወደ ቀጣዮቹ ቀዳዳዎች ጣል፣ በሰዓት አቅጣጫ ተቃራኒ፦ በራስህ ረድፍ፣ ከዚያ በተጋጣሚህ ረድፍ፣ እንደገና ዙር። ቁጥር አይታይም — ድንጋዮቹን ራስህ ቁጠር።') },
      { h: S('Relay', 'ቀጣይ ዙር (ሪሌይ)'), b: S('If your last seed lands in a hole that already had seeds, lift every seed in that hole and keep sowing. If your last seed lands in an empty hole, your turn ends.', 'የመጨረሻ ዘርህ ቀድሞ ዘር ባለበት ቀዳዳ ከወደቀ፣ በዚያ ቀዳዳ ያሉትን ሁሉ አንስተህ መዝራትህን ቀጥል። የመጨረሻ ዘርህ ባዶ ቀዳዳ ከወደቀ ተራህ ያበቃል።') },
      { h: S('A family of four', 'የአራት ቤተሰብ'), b: S('A hole that reaches exactly four stones is a family. Nothing lights up — you must notice it and tap that hole to collect it. Collecting is a free action: do it any time before your next move, and before another stone drops in. If the four appears while you are sowing, the hole\'s owner may collect it and you keep sowing. If your last stone makes the four, you may collect it and your turn ends.', 'በትክክል አራት ድንጋይ የደረሰ ቀዳዳ ቤተሰብ ነው። ምንም አይበራም — ራስህ አስተውለህ ቀዳዳውን ንካና መሰብሰብ አለብህ። መሰብሰብ ነፃ እርምጃ ነው፦ ከቀጣይ እርምጃህ በፊት፣ ሌላ ድንጋይ ከመውደቁ በፊት በማንኛውም ጊዜ። አራቱ በመዝራት ላይ ሳለ ከታየ የቀዳዳው ባለቤት ሊሰበስበው ይችላል፤ አንተ መዝራትህን ትቀጥላለህ። የመጨረሻ ድንጋይህ አራቱን ካሟላ ልትሰበስበው ትችላለህ፤ ተራህም ያበቃል።') },
      { h: S('Not noticed = frozen', 'ካልተሰበሰበ = ይቀዘቅዛል'), b: S('If you play on without collecting your four, that hole freezes: nobody can lift it any more. Stones still drop into it, and if the last stone of a move lands in a frozen hole, that turn stops and the other player moves. When the round ends, what is inside every frozen hole is split equally; an odd stone is decided by lottery.', 'አራትህን ሳትሰበስብ ከቀጠልክ ያ ቀዳዳ ይቀዘቅዛል፦ ማንም ሊያነሳው አይችልም። ድንጋዮች ወደ እሱ መውደቃቸውን ይቀጥላሉ፤ የእርምጃ የመጨረሻ ድንጋይ በቀዘቀዘ ቀዳዳ ከወደቀ ተራው እዚያ ያበቃና ሌላው ተጫዋች ይጫወታል። ዙሩ ሲያልቅ በቀዘቀዘ ቀዳዳ ያለው በእኩል ይከፈላል፤ ጎዶሎ ድንጋይ በዕጣ ይወሰናል።') },
      { h: S('End of a round', 'የዙር መጨረሻ'), b: S('The round ends when the player to move has no seeds on his side. The other player takes every seed left on the board.', 'መጫወት ያለበት ተጫዋች በጎኑ ዘር ከሌለው ዙሩ ያበቃል። ሌላኛው ተጫዋች በሰሌዳው የቀሩትን ሁሉ ይወስዳል።') },
      { h: S('Next round', 'ቀጣይ ዙር'), b: S('Every hole is dealt exactly four stones again. Each player gets one hole for every four stones he owns. The stones left over make one more hole: with 1 and 3 left, the player with 3 gets it; with 2 and 2, a lottery decides. The opener alternates.', 'እያንዳንዱ ቀዳዳ እንደገና በትክክል አራት ድንጋይ ይሰጠዋል። እያንዳንዱ ተጫዋች ለያዘው ለእያንዳንዱ አራት ድንጋይ አንድ ቀዳዳ ያገኛል። የተረፉት ድንጋዮች አንድ ተጨማሪ ቀዳዳ ይሠራሉ፦ 1 እና 3 ከቀሩ 3 ያለው ያገኛል፤ 2 እና 2 ከሆነ ዕጣ ይወስናል። ጀማሪው ይቀያየራል።') },
      { h: S('Winning', 'ማሸነፍ'), b: S('Rounds go on until one player owns no hole at all. The other player wins.', 'አንድ ተጫዋች ምንም ቀዳዳ እስካላገኘ ድረስ ዙሮች ይቀጥላሉ። ሌላኛው ተጫዋች ያሸንፋል።') },
    ],
    faq: [
      { q: S('Is a family collected automatically?', 'ቤተሰብ በራሱ ይሰበሰባል?'), a: S('No. You have to notice a hole with exactly four stones and tap it yourself. If you play on without collecting, it freezes.', 'አይሰበሰብም። በትክክል አራት ድንጋይ ያለውን ቀዳዳ ራስህ አስተውለህ መንካት አለብህ። ሳትሰበስብ ከቀጠልክ ይቀዘቅዛል።'), k: ['automatic', 'automatically', 'family', 'collect', 'four', 'ቤተሰብ', 'አራት', 'መሰብሰብ'] },
      { q: S('Can I collect on my opponent\'s turn?', 'በተጋጣሚዬ ተራ መሰብሰብ እችላለሁ?'), a: S('Yes. Collecting is a free action. You may do it at any moment, even while stones are still moving, as long as it is before your own next move or before another stone lands in that hole.', 'አዎ። መሰብሰብ ነፃ እርምጃ ነው። ድንጋዮች እየተንቀሳቀሱ ሳለም ቢሆን፣ ከራስህ ቀጣይ እርምጃ ወይም ሌላ ድንጋይ ወደዚያ ቀዳዳ ከመውደቁ በፊት በማንኛውም ጊዜ ማድረግ ትችላለህ።'), k: ['opponent', 'turn', 'free', 'when', 'time', 'ተራ', 'ነፃ', 'መቼ'] },
      { q: S('What does a frozen hole do?', 'የቀዘቀዘ ቀዳዳ ምን ያደርጋል?'), a: S('Nobody can lift it. Stones still land in it, and a move whose last stone lands there stops. At the end of the round its stones are split equally; an odd stone goes by lottery.', 'ማንም ሊያነሳው አይችልም። ድንጋዮች ይወድቁበታል፤ የመጨረሻው ድንጋይ እዚያ የወደቀ እርምጃ ይቆማል። በዙሩ መጨረሻ ድንጋዮቹ በእኩል ይከፈላሉ፤ ጎዶሎው በዕጣ ይሄዳል።'), k: ['frozen', 'freeze', 'locked', 'lock', 'stuck', 'የቀዘቀዘ', 'ይቀዘቅዛል', 'ተቆለፈ'] },
      { q: S('Who starts the next round?', 'ቀጣዩን ዙር ማን ይጀምራል?'), a: S('The opener alternates every round and every rematch. Only the very first game uses the spin wheel.', 'ጀማሪው በየዙሩ እና በየድጋሚ ጨዋታው ይቀያየራል። ጎማው የሚሽከረከረው በመጀመሪያው ጨዋታ ብቻ ነው።'), k: ['start', 'first', 'opener', 'begin', 'who', 'ማን', 'መጀመር', 'ጀማሪ'] },
      { q: S('How do I lose or win the whole game?', 'ጨዋታውን እንዴት አሸንፋለሁ ወይም እሸነፋለሁ?'), a: S('Every round the holes are dealt again from the stones each player owns. The game is over when one player owns no hole at all.', 'በየዙሩ ቀዳዳዎቹ እያንዳንዱ ተጫዋች ከያዘው ድንጋይ እንደገና ይከፋፈላሉ። አንድ ተጫዋች ምንም ቀዳዳ ሲያጣ ጨዋታው ያበቃል።'), k: ['win', 'lose', 'winning', 'end', 'over', 'ማሸነፍ', 'መሸነፍ', 'መጨረሻ'] },
      { q: S('What happens to leftover stones when a round ends?', 'ዙሩ ሲያልቅ የተረፉ ድንጋዮች ምን ይሆናሉ?'), a: S('The round ends when the player to move has no seeds on his side. The other player then takes every seed left on the board.', 'መጫወት ያለበት ተጫዋች በጎኑ ዘር ሲያልቅበት ዙሩ ያበቃል። ከዚያ ሌላኛው ተጫዋች በሰሌዳው የቀሩትን ዘሮች ሁሉ ይወስዳል።'), k: ['leftover', 'left', 'remaining', 'round', 'ዙር', 'የተረፈ', 'ቀሪ'] },
    ],
  },

  ashagro: {
    icon: '🎯',
    name: S('Ashagro Mebl · አሻግሮ መብል', 'አሻግሮ መብል'),
    pitch: S('No families — land in your own empty hole and eat what is across.', 'ቤተሰብ የለም — በራስህ ባዶ ቀዳዳ አርፈህ ከፊት ለፊት ያለውን ብላ።'),
    steps: [
      { h: S('The board and the start', 'ሰሌዳውና አጀማመሩ'), b: S('Same board as Ethio Gebeta: twelve holes, four seeds in each. The spin wheel picks the first player and the opener alternates after that.', 'እንደ ገበጣ ተመሳሳይ ሰሌዳ፦ አሥራ ሁለት ቀዳዳዎች፣ በእያንዳንዱ አራት ዘር። ጎማው የመጀመሪያውን ተጫዋች ይመርጣል፤ ከዚያ ጀማሪው ይቀያየራል።') },
      { h: S('Sowing and relay', 'መዝራትና ቀጣይ ዙር'), b: S('Pick one of your holes, lift every seed and sow counter-clockwise one by one. If your last seed falls in a hole that already had seeds, lift that hole and keep sowing. If it falls in an empty hole, the move stops there.', 'ከቀዳዳዎችህ አንዱን ምረጥ፣ ዘሮቹን ሁሉ አንስተህ በሰዓት አቅጣጫ ተቃራኒ አንድ በአንድ ዝራ። የመጨረሻ ዘርህ ዘር ባለበት ቀዳዳ ከወደቀ ያንን ቀዳዳ አንስተህ ዝራ። ባዶ ቀዳዳ ከወደቀ እርምጃው እዚያ ይቆማል።') },
      { h: S('No families, no freezing', 'ቤተሰብ የለም፣ መቀዝቀዝ የለም'), b: S('A hole with four stones is just a hole. Nothing is collected by tapping and no hole is ever locked.', 'አራት ድንጋይ ያለው ቀዳዳ ተራ ቀዳዳ ነው። በመንካት የሚሰበሰብ ነገር የለም፤ ቀዳዳም አይቆለፍም።') },
      { h: S('The capture (መብል)', 'መብል'), b: S('If your last stone comes to rest in one of YOUR OWN holes (it was empty) and the hole straight across the board belongs to your opponent and holds stones, you take everything in that hole plus your last stone.', 'የመጨረሻ ድንጋይህ በራስህ ቀዳዳ (ባዶ የነበረ) ካረፈ፣ እንዲሁም በቀጥታ ከፊት ለፊቱ ያለው ቀዳዳ የተጋጣሚህ ሆኖ ድንጋይ ከያዘ፣ በዚያ ቀዳዳ ያለውን ሁሉ ከመጨረሻ ድንጋይህ ጋር ትወስዳለህ።') },
      { h: S('Empty across', 'ከፊት ለፊት ባዶ ሲሆን'), b: S('If your last stone rests in your own empty hole and the hole across is empty too, you simply pick up that single stone for your pile.', 'የመጨረሻ ድንጋይህ በራስህ ባዶ ቀዳዳ አርፎ ከፊት ለፊቱ ያለውም ባዶ ከሆነ፣ ያንን ብቸኛ ድንጋይ ወደ ክምርህ ታነሳለህ።') },
      { h: S('End of a round', 'የዙር መጨረሻ'), b: S('The round ends when the player to move has no seeds on his side; the other player takes what is left. Then all holes are dealt four stones again — one hole per four stones owned, the leftovers making one more hole (1+3: the player with 3; 2+2: lottery).', 'መጫወት ያለበት ተጫዋች በጎኑ ዘር ከሌለው ዙሩ ያበቃል፤ ሌላኛው የቀረውን ይወስዳል። ከዚያ ሁሉም ቀዳዳዎች እንደገና አራት አራት ድንጋይ ይሰጣቸዋል — ለእያንዳንዱ አራት ድንጋይ አንድ ቀዳዳ፣ የተረፉት አንድ ተጨማሪ ቀዳዳ ይሠራሉ (1+3፦ 3 ያለው፤ 2+2፦ ዕጣ)።') },
      { h: S('Winning', 'ማሸነፍ'), b: S('Rounds continue until one player owns no hole. Because won stones stay with their owner, a game between equal players can run long — keep protecting your holes.', 'አንድ ተጫዋች ምንም ቀዳዳ እስካላገኘ ድረስ ዙሮች ይቀጥላሉ። የተበሉ ድንጋዮች ከባለቤታቸው ጋር ስለሚቀሩ፣ በእኩል ተጫዋቾች መካከል ጨዋታው ሊረዝም ይችላል — ቀዳዳዎችህን ጠብቅ።') },
    ],
    faq: [
      { q: S('When do I capture?', 'መቼ እበላለሁ?'), a: S('Only when your last stone rests in your own hole that was empty, and the hole directly across is your opponent\'s and has stones. You take that whole hole plus your last stone.', 'የመጨረሻ ድንጋይህ ባዶ በነበረ የራስህ ቀዳዳ ሲያርፍ፣ እና በቀጥታ ከፊት ለፊት ያለው የተጋጣሚህ ሆኖ ድንጋይ ሲኖረው ብቻ ነው። ያንን ቀዳዳ በሙሉ ከመጨረሻ ድንጋይህ ጋር ትወስዳለህ።'), k: ['capture', 'eat', 'take', 'when', 'mebl', 'መብል', 'መብላት', 'መቼ'] },
      { q: S('Which hole is "across"?', '"ከፊት ለፊት" ያለው ቀዳዳ የትኛው ነው?'), a: S('The hole straight opposite on the other row. On the board it is the mirror hole: the first hole of your row faces the last hole of your opponent\'s row, and so on.', 'በሌላኛው ረድፍ በቀጥታ ተቃራኒ ያለው ቀዳዳ። በሰሌዳው ላይ የመስታወት ቀዳዳው ነው፦ የረድፍህ የመጀመሪያ ቀዳዳ ከተጋጣሚህ ረድፍ የመጨረሻ ቀዳዳ ጋር ይፋጠጣል፣ እንዲሁ ቀጥሎ።'), k: ['across', 'opposite', 'facing', 'which', 'hole', 'ተቃራኒ', 'ፊት', 'ቀዳዳ'] },
      { q: S('Are there families of four here?', 'እዚህ የአራት ቤተሰብ አለ?'), a: S('No. In Ashagro Mebl four stones in a hole mean nothing special, and nothing is ever frozen.', 'የለም። በአሻግሮ መብል አራት ድንጋይ በአንድ ቀዳዳ ልዩ ትርጉም የለውም፤ ምንም አይቀዘቅዝም።'), k: ['family', 'four', 'freeze', 'frozen', 'ቤተሰብ', 'አራት', 'መቀዝቀዝ'] },
      { q: S('What if the hole across is empty?', 'ከፊት ለፊት ያለው ባዶ ቢሆንስ?'), a: S('You only pick up your own single stone for your pile.', 'የራስህን ብቸኛ ድንጋይ ብቻ ወደ ክምርህ ታነሳለህ።'), k: ['empty', 'nothing', 'single', 'ባዶ', 'አንድ'] },
    ],
  },

  tuz: {
    icon: '🧊',
    name: S('Tuz · ጡዝ', 'ጡዝ'),
    pitch: S('Freeze a Tuz in your opponent\'s hole, then raid it.', 'በተጋጣሚህ ቀዳዳ ጡዝ አቀዝቅዝ፣ ከዚያ ዝረፈው።'),
    steps: [
      { h: S('Same board, same sowing', 'ተመሳሳይ ሰሌዳ፣ ተመሳሳይ አዘራር'), b: S('Twelve holes, four seeds each. You sow counter-clockwise and relay exactly as in Ethio Gebeta: last seed in a filled hole means lift and continue, last seed in an empty hole ends the turn.', 'አሥራ ሁለት ቀዳዳዎች፣ በእያንዳንዱ አራት ዘር። እንደ ገበጣ በሰዓት አቅጣጫ ተቃራኒ ትዘራለህ፣ ትቀጥላለህ፦ የመጨረሻ ዘር ዘር ባለበት ቀዳዳ ከሆነ አንስተህ ቀጥል፣ ባዶ ከሆነ ተራው ያበቃል።') },
      { h: S('The only freeze is the Tuz', 'ብቸኛው መቀዝቀዝ ጡዝ ነው'), b: S('A hole that reaches four any other way (mid-sowing, or by your own last stone in your own hole) is a perfectly normal hole: nothing to collect, nothing frozen.', 'በሌላ በማንኛውም መንገድ (በመዝራት ላይ ሳለ፣ ወይም በራስህ ቀዳዳ የመጨረሻ ድንጋይህ) አራት የደረሰ ቀዳዳ ፍጹም ተራ ቀዳዳ ነው፦ የሚሰበሰብ የለም፣ የሚቀዘቅዝም የለም።') },
      { h: S('What a Tuz is', 'ጡዝ ምንድን ነው'), b: S('A Tuz is a frozen hole of four stones that sits in an OPPONENT\'s row and belongs to the player who made it. Nobody can make a Tuz on his own holes. Nobody can lift a Tuz, but stones may pass through it or land on it.', 'ጡዝ በ ተጋጣሚ ረድፍ የሚቀመጥ እና ለሠራው ተጫዋች የሚሆን የቀዘቀዘ አራት ድንጋይ ያለው ቀዳዳ ነው። ማንም በራሱ ቀዳዳ ጡዝ መሥራት አይችልም። ማንም ጡዝን ሊያነሳ አይችልም፤ ግን ድንጋዮች ሊያልፉበት ወይም ሊወድቁበት ይችላሉ።') },
      { h: S('The opening', 'አጀማመር'), b: S('The starter opens by tapping one of his OWN holes. He lifts one stone (4→3) and drops it in the next hole (4→5), then lifts one from the hole after that and drops it in the next, and so on round the whole ring, so the holes alternate 3, 5, 3, 5. On the second lap each step lifts one stone from a 5-hole and drops it on the 3-hole just after it (3→4). The first OPPONENT hole turned from 3 to 4 freezes as his first Tuz and his turn ends. No stone goes to a pile. Every new round starts with the same opening.', 'ጀማሪው ከራሱ ቀዳዳዎች አንዱን በመንካት ይከፍታል። አንድ ድንጋይ ያነሳል (4→3)፣ ወደ ቀጣዩ ቀዳዳም ይጥላል (4→5)፤ ከዚያ በኋላ ካለው ቀዳዳ አንድ ድንጋይ አንስቶ ወደ ቀጣዩ ይጥላል፤ ክበቡን በሙሉ እስኪዞር በዚህ ይቀጥላል፤ ቀዳዳዎቹም 3፣ 5፣ 3፣ 5 እያሉ ይፈራረቃሉ። በሁለተኛው ዙር እያንዳንዱ ደረጃ ከ5 ቀዳዳ አንድ ድንጋይ አንስቶ ወዲያው በኋላ ባለው 3 ቀዳዳ ላይ ይጥላል (3→4)። ከ3 ወደ 4 የተለወጠው የመጀመሪያው የተጋጣሚ ቀዳዳ እንደ መጀመሪያ ጡዙ ይቀዘቅዛል፤ ተራውም ያበቃል። ምንም ድንጋይ ወደ ክምር አይገባም። እያንዳንዱ አዲስ ዙር በዚሁ አጀማመር ይጀምራል።') },
      { h: S('Making a Tuz later', 'በኋላ ጡዝ መሥራት'), b: S('If your LAST stone drops into an opponent\'s hole and makes exactly four, that hole freezes as your Tuz and your turn ends.', 'የመጨረሻ ድንጋይህ በተጋጣሚህ ቀዳዳ ወድቆ በትክክል አራት ካደረገ፣ ያ ቀዳዳ እንደ ጡዝህ ይቀዘቅዛል፤ ተራህም ያበቃል።') },
      { h: S('Raiding a Tuz', 'ጡዝ መዝረፍ'), b: S('If your last stone rests on an opponent\'s Tuz, you take exactly two stones from it and play again. The rest stays frozen. Resting on your own Tuz just ends your turn.', 'የመጨረሻ ድንጋይህ በተጋጣሚህ ጡዝ ላይ ካረፈ በትክክል ሁለት ድንጋይ ከእሱ ትወስዳለህ እና እንደገና ትጫወታለህ። የቀረው እንደቀዘቀዘ ይቆያል። በራስህ ጡዝ ላይ ማረፍ ተራህን ብቻ ያጠናቅቃል።') },
      { h: S('An emptied Tuz', 'የተራቆተ ጡዝ'), b: S('A Tuz emptied this way is remembered: the next LAST stone to land there is captured and the turn ends. A stone that only passes through turns it back into an ordinary hole.', 'በዚህ መንገድ የተራቆተ ጡዝ ይታወሳል፦ ቀጣዩ የመጨረሻ ድንጋይ እዚያ ከወደቀ ይያዛል፤ ተራውም ያበቃል። የሚያልፍ ድንጋይ ብቻ ወደ ተራ ቀዳዳ ይመልሰዋል።') },
      { h: S('Skipping and end of round', 'መዝለልና የዙር መጨረሻ'), b: S('A player with nothing to lift is skipped and the other keeps playing. The round ends only when neither player can lift anything. Then every Tuz is paid to its owner, and the holes are dealt again as in Ethio Gebeta.', 'የሚያነሳው ነገር የሌለው ተጫዋች ይዘለላል፤ ሌላኛው መጫወቱን ይቀጥላል። ዙሩ የሚያበቃው ሁለቱም ምንም ማንሳት ሲያቅታቸው ብቻ ነው። ከዚያ እያንዳንዱ ጡዝ ለባለቤቱ ይከፈላል፣ ቀዳዳዎቹም እንደ ገበጣ እንደገና ይከፋፈላሉ።') },
      { h: S('Winning', 'ማሸነፍ'), b: S('Rounds go on until one player owns no hole. The other player wins.', 'አንድ ተጫዋች ምንም ቀዳዳ እስካላገኘ ድረስ ዙሮች ይቀጥላሉ። ሌላኛው ያሸንፋል።') },
    ],
    faq: [
      { q: S('Can I make a Tuz in my own hole?', 'በራሴ ቀዳዳ ጡዝ መሥራት እችላለሁ?'), a: S('No. A Tuz always sits in an opponent\'s hole and belongs to the player who made it.', 'አይቻልም። ጡዝ ሁልጊዜ በተጋጣሚ ቀዳዳ ይቀመጣል እና ለሠራው ተጫዋች ይሆናል።'), k: ['own', 'mine', 'my', 'make', 'tuz', 'ጡዝ', 'የራሴ', 'መሥራት'] },
      { q: S('How do I attack a Tuz?', 'ጡዝን እንዴት አጠቃለሁ?'), a: S('Land your LAST stone on it. You take exactly two stones and play again. The remaining stones stay frozen.', 'የመጨረሻ ድንጋይህን እዚያ አሳርፍ። በትክክል ሁለት ድንጋይ ትወስዳለህ እና እንደገና ትጫወታለህ። የቀሩት ድንጋዮች እንደቀዘቀዙ ይቆያሉ።'), k: ['attack', 'raid', 'take', 'two', 'steal', 'ጡዝ', 'ሁለት', 'መዝረፍ'] },
      { q: S('Who starts and how?', 'ማን እና እንዴት ይጀምራል?'), a: S('The starter taps one of his own holes. One stone at a time is lifted and dropped in the next hole round the ring (3, 5, 3, 5 …), then a second lap turns the 3s into 4s; the first opponent hole that turns 3→4 freezes as his first Tuz. Every round opens this way.', 'ጀማሪው ከራሱ ቀዳዳዎች አንዱን ይነካል። አንድ አንድ ድንጋይ እየተነሳ ወደ ቀጣዩ ቀዳዳ በክበቡ ዙሪያ ይጣላል (3፣ 5፣ 3፣ 5 …)፤ ከዚያ ሁለተኛው ዙር 3ቹን ወደ 4 ይቀይራል፤ ከ3 ወደ 4 የተለወጠው የመጀመሪያው የተጋጣሚ ቀዳዳ እንደ መጀመሪያ ጡዙ ይቀዘቅዛል። እያንዳንዱ ዙር በዚህ ይከፈታል።'), k: ['start', 'opening', 'open', 'first', 'begin', 'አጀማመር', 'መጀመር', 'ጀማሪ'] },
      { q: S('What if I have nothing to lift?', 'ማንሳት የምችለው ነገር ከሌለኝ?'), a: S('You are skipped and your opponent keeps playing. The round ends only when neither of you can lift anything; then every Tuz is paid to its owner.', 'ትዘለላለህ፤ ተጋጣሚህም መጫወቱን ይቀጥላል። ዙሩ የሚያበቃው ሁለታችሁም ምንም ማንሳት ሲያቅታችሁ ብቻ ነው፤ ከዚያ እያንዳንዱ ጡዝ ለባለቤቱ ይከፈላል።'), k: ['nothing', 'skip', 'skipped', 'cannot', 'stuck', 'መዝለል', 'ማንሳት'] },
      { q: S('Is a four I make mid-sowing a Tuz?', 'በመዝራት ላይ ሳለ የማደርገው አራት ጡዝ ነው?'), a: S('No. Only your LAST stone, landing in an opponent\'s hole and making exactly four, creates a Tuz. Any other four is an ordinary hole.', 'አይደለም። ጡዝ የሚፈጥረው በተጋጣሚ ቀዳዳ ወድቆ በትክክል አራት የሚያደርገው የመጨረሻ ድንጋይህ ብቻ ነው። ሌላ ማንኛውም አራት ተራ ቀዳዳ ነው።'), k: ['mid', 'sowing', 'four', 'family', 'normal', 'አራት', 'ቤተሰብ'] },
    ],
  },
};

const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 1);

/**
 * Answer a player's question from the rulebook. Returns the best FAQ answer(s) first, then the closest rule steps.
 * { hits: [{ type, kind:'faq'|'step', q, a, score }] } — empty `hits` means "no idea": the UI then offers to ask a friend.
 */
export function askRules(question, type = 'gebeta', lang = 'en') {
  const words = norm(question);
  if (!words.length) return { hits: [] };
  const hits = [];
  for (const id of GEBETA_TYPES) {
    const bonus = id === type ? 1.5 : 1;
    for (const f of RULEBOOK[id].faq) {
      const hay = norm(`${f.q.en} ${f.q.am} ${f.k.join(' ')}`);
      const score = words.reduce((n, w) => n + (hay.some((h) => h === w || (w.length > 3 && (h.includes(w) || w.includes(h)))) ? 1 : 0), 0) * bonus;
      if (score > 0) hits.push({ type: id, kind: 'faq', q: f.q[lang] || f.q.en, a: f.a[lang] || f.a.en, score });
    }
    for (const s of RULEBOOK[id].steps) {
      const hay = norm(`${s.h.en} ${s.b.en} ${s.h.am} ${s.b.am}`);
      const score = words.reduce((n, w) => n + (hay.some((h) => h === w || (w.length > 3 && h.includes(w))) ? 1 : 0), 0) * 0.6 * bonus;
      if (score > 0.6) hits.push({ type: id, kind: 'step', q: s.h[lang] || s.h.en, a: s.b[lang] || s.b.en, score });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return { hits: hits.slice(0, 3) };
}

/** The whole rulebook of one type as plain text (for "send me the rules" / share). */
export function rulesAsText(type, lang = 'en') {
  const r = RULEBOOK[type] || RULEBOOK.gebeta;
  return [`${r.icon} ${r.name[lang] || r.name.en}`, r.pitch[lang] || r.pitch.en, '', ...r.steps.map((s, i) => `${i + 1}. ${s.h[lang] || s.h.en}\n${s.b[lang] || s.b.en}`)].join('\n');
}
