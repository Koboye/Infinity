// Emoji picker data (v3.10): small hand-picked sets per category, the way a phone keyboard groups them. Text only, no images.
export const EMOJI_TABS = [
  { id: 'recent', icon: '🕘' },
  { id: 'smile', icon: '😀', list: '😀😃😄😁😆😅😂🤣🥲☺️😊😇🙂🙃😉😌😍🥰😘😗😙😚😋😛😜🤪😝🤑🤗🤭🤫🤔🤐🤨😐😑😶😏😒🙄😬😮‍💨🤥😌😔😪🤤😴😷🤒🤕🤢🤮🥵🥶🥴😵🤯🤠🥳😎🤓🧐😕😟🙁☹️😮😯😲😳🥺😦😧😨😰😥😢😭😱😖😣😞😓😩😫🥱😤😡😠🤬😈👿💀💩🤡👻👽🤖' },
  { id: 'hands', icon: '👍', list: '👍👎👊✊🤛🤜👏🙌👐🤲🤝🙏✌️🤞🤟🤘👌🤌🤏👈👉👆👇☝️✋🤚🖐️🖖👋🤙💪🦾🖕✍️🤳💅🙋🙆🙅🤦🤷💃🕺' },
  { id: 'hearts', icon: '❤️', list: '❤️🧡💛💚💙💜🖤🤍🤎💔❣️💕💞💓💗💖💘💝💟💋💯💢💥💫💦💨🔥✨⭐🌟🎉🎊🎁🏆🥇🥈🥉' },
  { id: 'nature', icon: '🐶', list: '🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🙈🙉🙊🐔🐧🐦🦅🦉🦋🐝🐞🐢🐍🐙🐠🐬🐳🦒🦓🐘🦏🐪🌵🌴🌳🌸🌹🌻🌞🌙⛅🌈⚡❄️🌊' },
  { id: 'food', icon: '🍔', list: '🍎🍊🍋🍌🍉🍇🍓🍒🍑🥭🍍🥥🥑🍅🥕🌽🍞🧀🍗🥩🍔🍟🍕🌭🌮🥙🍝🍜🍣🍰🎂🍩🍪🍫🍿☕🍵🥤🍺🥂' },
  { id: 'play', icon: '⚽', list: '⚽🏀🏈⚾🎾🏐🏉🎱🏓🏸🥊🏆🎮🕹️🎲🎯♟️🎰🎤🎧🎵🎶🎸🥁🏁🚗🏎️🚓🚕🚌🚀✈️🚲⛰️🏔️🏖️' },
  { id: 'obj', icon: '💡', list: '📱💻⌚📷🔋💡🔑🔒📌📎✏️📚🎒⏰💰💎🛒🎁📞✉️🔔🔍🧭🕯️' },
  { id: 'flags', icon: '🏳️', list: '🇪🇹🇺🇸🇬🇧🇨🇦🇩🇪🇫🇷🇮🇹🇪🇸🇸🇦🇦🇪🇰🇪🇪🇬🇳🇬🇿🇦🇮🇳🇨🇳🇯🇵🇧🇷🏳️🏴🚩' },
];
/** Split an emoji string into whole emoji (family, flag and skin-tone sequences stay in one piece). */
export const splitEmoji = (s) => (typeof Intl !== 'undefined' && Intl.Segmenter ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s), (x) => x.segment) : Array.from(s)).filter((x) => x.trim());
export const RECENT_KEY = 'afro.emojiRecent';
export const pushRecent = (list, e, max = 24) => [e, ...list.filter((x) => x !== e)].slice(0, max);
