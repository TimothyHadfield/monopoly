# Monopoly rules check (US classic edition)

Last checked: 2026-10-19 against `js/board.js`. Read-only research; nothing in the code was changed.

**Result: board.js has no wrong numbers.** All 40 squares, 22 rent tables, house costs, both taxes and all 32 cards match the **2008-onward US classic edition** (cards = the 2008 to Sept 2021 printing). The only things to note are edition choices (see the Discrepancies table).

## Sources
- [W] Wikipedia, Monopoly (game): https://en.wikipedia.org/wiki/Monopoly_(game)
- [WB] Wikibooks, Monopoly/Official Rules: https://en.wikibooks.org/wiki/Monopoly/Official_Rules
- [GH] Geeky Hobbies, Monopoly rules: https://geekyhobbies.com/monopoly-rules
- [F] Falstad rent table: https://www.falstad.com/monopoly.html
- [ML] Monopolyland card list: https://www.monopolyland.com/list-monopoly-chance-community-chest-cards/
- [WBH] Wikibooks, House Rules: https://en.wikibooks.org/wiki/Monopoly/House_Rules
- [MP] Monopoly in the Park rules page: https://monopolyinthepark.com/mrules.htm
- [CBS] Hasbro's 2021 Community Chest change (news): https://www.cbsnews.com/amp/boston/news/monopoly-community-chest-changes-hasbro
- The Monopoly fandom wiki returned HTTP 402 and couldn't be read. I couldn't find a Hasbro PDF that would load (the UK retailer's copy was over 10 MB).

## 1. Number check (board.js vs sources)

### Streets (price / house cost / rent: base, 1, 2, 3, 4 houses, hotel). Mortgage value = half the price.
All 22 rows match [F] exactly. Spot checks also match [ML]/search results (Mediterranean, Oriental, Park Place, Boardwalk).

| Group (house $) | Street | Price | Rent row | Mortgage |
|---|---|---|---|---|
| Brown (50) | Mediterranean | 60 | 2/10/30/90/160/250 | 30 |
| | Baltic | 60 | 4/20/60/180/320/450 | 30 |
| Light blue (50) | Oriental, Vermont | 100 | 6/30/90/270/400/550 | 50 |
| | Connecticut | 120 | 8/40/100/300/450/600 | 60 |
| Pink (100) | St. Charles, States | 140 | 10/50/150/450/625/750 | 70 |
| | Virginia | 160 | 12/60/180/500/700/900 | 80 |
| Orange (100) | St. James, Tennessee | 180 | 14/70/200/550/750/950 | 90 |
| | New York | 200 | 16/80/220/600/800/1000 | 100 |
| Red (150) | Kentucky, Indiana | 220 | 18/90/250/700/875/1050 | 110 |
| | Illinois | 240 | 20/100/300/750/925/1100 | 120 |
| Yellow (150) | Atlantic, Ventnor | 260 | 22/110/330/800/975/1150 | 130 |
| | Marvin Gardens | 280 | 24/120/360/850/1025/1200 | 140 |
| Green (200) | Pacific, North Carolina | 300 | 26/130/390/900/1100/1275 | 150 |
| | Pennsylvania Ave | 320 | 28/150/450/1000/1200/1400 | 160 |
| Dark blue (200) | Park Place | 350 | 35/175/500/1100/1300/1500 | 175 |
| | Boardwalk | 400 | 50/200/600/1400/1700/2000 | 200 |

board.js has no mortgage field. The game should work it out as `price / 2` (railroads $100, utilities $75).

### Other numbers
| Item | Official (2008+ US) | board.js | Sources |
|---|---|---|---|
| Railroads | $200 each; rent 25/50/100/200 for 1-4 owned | price 200 (rents live in money.js) | [WB], [F] |
| Utilities | $150 each; 4x dice with one, 10x with both | price 150 | [WB], [F] |
| Income Tax | flat $200 (before 2008: $200 **or** 10% of net worth) | 200 | [W], [GH] |
| Luxury Tax | $100 (before 2008: $75) | 100 | [W] |
| Go salary | $200 for landing on or passing Go | card text only | [W], [WB], [GH] |
| Starting cash | $1,500 = 2x500, 4x100, 1x50, 1x20, 2x10, 1x5, 5x1 (since 2008; older US sets used 2x500, 2x100, 2x50, 6x20, 5x10, 5x5, 5x1) | n/a | [WB], [GH], [W] says US switched to the UK split in 2008 |
| Houses / hotels | 32 / 12 | n/a | [W], [WB] |
| Title deeds | 28 (22 streets + 4 railroads + 2 utilities) | 28 buyable squares | [W] |
| Cards | 16 Chance + 16 Community Chest | 16 + 16 | [W], [ML] |
| Board order / names | standard Atlantic City layout, Jail at 10, Go To Jail at 30 | matches | [F], [W] |

### Chance (board.js = current 2008+ US set; all 16 match [ML])
Boardwalk; Go (+$200); Illinois; St. Charles; nearest Railroad **x2** (pay the owner twice the rent, or buy it if nobody owns it); nearest Utility (roll the dice again and pay 10x, or buy it if nobody owns it); bank dividend +$50; Get Out of Jail Free; back 3 spaces; Go to Jail; general repairs $25 per house / $100 per hotel; speeding fine -$15; trip to Reading Railroad; Chairman of the Board, pay each player $50; building loan matures +$150.
- Cards that move you forward pay $200 if you pass Go. Go to Jail never pays it. [WB], [GH]
- **Older US (before 2008):** "Pay poor tax $15" was renamed the speeding fine, and "Take a walk on the Boardwalk" became "Advance to Boardwalk". Some old printings had "won a crossword competition +$100". [W], [ML]
- **Note:** money.js values the utility card at 10 x 7 (the average of a new roll), which matches the "roll again" rule. The live game must roll fresh dice, not reuse the roll that moved the player.

### Community Chest (board.js = 2008 to Sept 2021 US set; all 16 match [ML])
Go (+$200); bank error +$200; doctor's fee -$50; sale of stock +$50; Get Out of Jail Free; Go to Jail; holiday fund +$100; income tax refund +$20; birthday, +$10 from each player; life insurance +$100; hospital fees -$100; school fees -$50; consultancy fee +$25; street repairs $40 per house / $115 per hotel; beauty contest second prize +$10; inheritance +$100.
- **Older US (before 2008):** stock sale paid $45 and school tax was $150 [W]. The holiday fund was the "Xmas fund" [ML].
- **US sets from Oct 2021 on:** Hasbro rewrote all 16 Community Chest texts after a fan vote [CBS], [W]. The new deck [ML] has **the same 16 effects** with new wording (for example, "rescue a puppy" is the Get Out of Jail Free card, a street party collects $10 from each player, and a home-improvement card charges $40/$115). So board.js plays exactly the same either way; only the card wording differs.

## 2. Official rules (in my own words)
**Turns and dice**
- Roll two dice and move. Doubles give another turn. Three doubles in a row send you straight to Jail without finishing the move. [WB], [W]
- Passing or landing on Go pays $200. Being sent to Jail never pays it, even if the path "passes" Go. [W], [WB]
- Free Parking does nothing. [W], [GH]

**Buying and auctions**
- If you land on an unowned property you may buy it at the printed price. If you don't, the bank **auctions** it to all players, including you. Bids can come in any order. The highest bid wins, and if nobody bids, the bank keeps it. [W], [WB], [GH]
- The opening bid: [WB]/[GH] say $10. I remember the Hasbro booklet saying "any price" but couldn't confirm it. See Not verified.

**Rent**
- The owner must ask for rent before the next player rolls, or the rent is lost. [WB]
- A mortgaged property earns **no** rent. [WB], [F]
- Owning a whole colour set doubles the base rent on unbuilt streets. This still applies to the unmortgaged streets in the set even when another street in the set is mortgaged. The railroad and utility counts also include mortgaged ones. [WB]
- Railroads: $25/50/100/200 for 1-4 owned. Utilities: 4x the dice for one, 10x for both. [WB], [F]
- A player in Jail can still collect rent, buy and sell buildings, trade and bid. [WB], [GH]

**Building**
- You may build only on a full colour set with no mortgaged streets in it. Build **evenly**: no street may get more than one house ahead of the others in its set. Selling buildings must also be even. [WB], [GH]
- Building costs come from the property card ($50/100/150/200 by side of the board). [WB]
- A hotel needs 4 houses on every street in the set. Buy it by paying one more house price and returning the 4 houses to the bank. That's one hotel per street. [WB]
- The bank has only 32 houses and 12 hotels. When they run out, nobody can build until some are returned. If two or more players want the last houses or hotels, the bank auctions them. [W], [WB], [GH]
- Buildings sell back to the bank at **half** what they cost. A hotel sells for half its price, and you get back 4 houses (only if the bank has them; otherwise you must sell down further). [W], [WB]

**Mortgages**
- You can mortgage an unbuilt property for half its price. Any buildings in that colour set must be sold first. [WB]
- To lift a mortgage, pay the mortgage value plus **10%** interest. [WB], [GH]
- If you get a mortgaged property in a trade or a bankruptcy, you must right away either lift the mortgage (value + 10%) or pay just the 10% now and keep it mortgaged. If you lift it later, you pay the 10% again. [WB], [GH]

**Jail**
- Ways in: the Go To Jail square, a Go to Jail card, or three doubles. Landing on the Jail square normally is "Just Visiting". [WB]
- Ways out: pay $50 **before** rolling, use (or buy from another player) a Get Out of Jail Free card, or roll doubles on any of your next 3 turns. [WB], [GH]
- Doubles that get you out move you by that roll, but you **don't** roll again. [WB]
- If the 3rd try fails, you must pay $50 and then move by that roll. [WB], [GH]
- A used Get Out of Jail Free card goes back to the bottom of its deck. [GH]

**Trading**
- Trades can happen at any time and can include properties, cash and Get Out of Jail Free cards. [WB]
- You can't trade a street while its colour set has buildings: sell them first. [WB]
- No loans or gifts of money through trades. [WB]

**Debt and bankruptcy**
- If you owe more than you can raise (by selling buildings and mortgaging), you're bankrupt. [WB]
- Bankrupt to a **player**: they get everything you have, including cash, properties and cards. Your buildings are sold to the bank at half price first. For each mortgaged property they get, they must pay the 10% right away (or lift the mortgage). [WB], [GH]
- Bankrupt to the **bank** (taxes, cards): your cash goes to the bank, mortgages are cancelled, Get Out of Jail Free cards go back to their decks, and the bank auctions all your properties. [WB], [GH]
- The last player left wins. [WB]

## 3. Official variants
**Short Game** [WB], [GH], with the 2008+ version reported by search snippets
- Shuffle the title deeds and deal each player **three** (2008+ US booklet, free of charge) or **two** (the 1936 to pre-2008 booklets and [WB]). Editions differ on whether players pay the bank for them.
- A hotel needs **3 houses** per street instead of 4. Hotel rent stays the same, and a hotel sold back returns 3 houses' worth (half price).
- Jail: you must leave on your next turn. Use a card, roll doubles, or pay $50 and move.
- Income Tax is always the flat $200.
- The game ends at the **first bankruptcy** (some older booklets end it at the second). Then everyone adds up cash, properties at printed price (half for mortgaged ones), and buildings at cost (each hotel counts with its 3 houses). The richest player wins.

**Time Limit game** [WB], [GH]
- Agree on a stopping time before you start. Shuffle and deal **two** title deeds to each player, who pays the bank the printed price. At the time limit, count up the same way as the Short Game. The richest player wins.

## 4. Common HOUSE RULES (not official; offer as toggles)
- **Free Parking jackpot**: taxes and card fines go into the middle instead of to the bank, sometimes with a $500 seed. Whoever lands on Free Parking takes the pot. [W], [WBH]
- **$400 for landing exactly on Go** instead of $200. [W], [WBH]
- **No auctions**: a property nobody buys stays with the bank. [W], [WBH]
- **Go around once before buying**: no purchases until your first lap is done. [WBH]
- Others seen: no rent collected while in Jail, snake-eyes bonus, player loans, rent immunity deals. [W]

## 5. Discrepancies with board.js
**No wrong values found.** Every price, rent, house cost, tax and card in board.js matches the 2008+ US edition. Edition-dependent items only:

| board.js line | Value | Note |
|---|---|---|
| L13 `Income Tax ... amount: 200` | 200 | Correct for 2008+. Before 2008 you could choose $200 or 10% of your worth. This could be a "classic rules" toggle. |
| L47 `Luxury Tax ... amount: 100` | 100 | Correct for 2008+. Before 2008 it was $75. |
| L81 `Speeding fine $15` | -15 | Called "Pay poor tax $15" before 2008. Same effect. |
| L69 `Advance to Boardwalk` | move 39 | Called "Take a walk on the Boardwalk" before 2008. Same effect. |
| L90 `Stock sale: $50` | +50 | It was $45 before 2008. |
| L98 `School fees $50` | -50 | It was a $150 school tax before 2008. |
| L86-103 CHEST texts | n/a | The deck from before the 2021 rewrite. The Oct 2021+ deck has new wording with identical effects. |
| L75 `nearest utility (pay 10x dice)` | n/a | Not a data error. The engine must roll **new** dice for this card. |
| (missing) mortgage values | n/a | Not stored. Work out price/2. Correct by rule. |

## 6. Not verified (only one source, or sources conflict)
- The **auction opening bid**: [WB]/[GH] say $10. My memory of the Hasbro booklet says "any price". I couldn't load a Hasbro PDF.
- **Short Game deeds**: three free deeds (2008+) vs two deeds. Search snippets and [MP] say three, [WB] says two, and [GH] says "usually two, sometimes three". It's also unclear whether they're paid for. **Recommendation: three free deeds, ending at the first bankruptcy.**
- The **exact wording of the Oct 2021 Community Chest deck**: only [ML] lists it. The news sources confirm only that a rewrite happened.
- The **2018 "Money Grab" Chance card** replacing the dividend card in some sets: [ML] only.
- **Pre-2008 cards** I remember but couldn't check against a second source: "Grand Opera Night, collect $50 from every player" (now the $10 birthday card), "Receive for services $25", and the crossword competition +$100.
- **Pre-2008 starting cash split** (2/2/2/6/5/5/5): from memory, plus [W]'s statement that the US switched to the UK split in 2008.
- The **"Go around once before buying"** house rule: [WBH] only.
