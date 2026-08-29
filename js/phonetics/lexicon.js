/**
 * lexicon.js — General American pronunciations for high-frequency English.
 *
 * Values are IPA strings in the BASE dialect (General American: rhotic, no
 * length marks, ɝ/ɚ for r-coloured vowels). accents.js derives UK and AU.
 * Stress is marked with ˈ (primary) and ˌ (secondary) before the syllable.
 *
 * Anything not listed here falls through to the rule engine in g2p.js, so this
 * table only has to cover the words whose spelling lies about their sound.
 */

export const LEXICON = {
  // ── function words (usually reduced in connected speech) ────────────────
  a: 'ə', an: 'æn', the: 'ðə', and: 'ænd', or: 'ɔr', but: 'bʌt', if: 'ɪf',
  of: 'ʌv', to: 'tu', in: 'ɪn', on: 'ɑn', at: 'æt', by: 'baɪ', for: 'fɔr',
  with: 'wɪð', from: 'frʌm', as: 'æz', into: 'ˈɪntu', about: 'əˈbaʊt',
  is: 'ɪz', are: 'ɑr', was: 'wʌz', were: 'wɝ', be: 'bi', been: 'bɪn',
  being: 'ˈbiɪŋ', am: 'æm', do: 'du', does: 'dʌz', did: 'dɪd', done: 'dʌn',
  have: 'hæv', has: 'hæz', had: 'hæd', having: 'ˈhævɪŋ',
  will: 'wɪl', would: 'wʊd', can: 'kæn', could: 'kʊd', shall: 'ʃæl',
  should: 'ʃʊd', may: 'meɪ', might: 'maɪt', must: 'mʌst',
  i: 'aɪ', you: 'ju', he: 'hi', she: 'ʃi', it: 'ɪt', we: 'wi', they: 'ðeɪ',
  me: 'mi', him: 'hɪm', her: 'hɝ', us: 'ʌs', them: 'ðɛm',
  my: 'maɪ', your: 'jʊr', his: 'hɪz', its: 'ɪts', our: 'aʊr', their: 'ðɛr',
  mine: 'maɪn', yours: 'jʊrz', hers: 'hɝz', ours: 'ˈaʊrz', theirs: 'ðɛrz',
  this: 'ðɪs', that: 'ðæt', these: 'ðiz', those: 'ðoʊz',
  who: 'hu', whom: 'hum', whose: 'huz', what: 'wʌt', which: 'wɪtʃ',
  when: 'wɛn', where: 'wɛr', why: 'waɪ', how: 'haʊ',
  not: 'nɑt', no: 'noʊ', yes: 'jɛs', all: 'ɔl', any: 'ˈɛni', some: 'sʌm',
  each: 'itʃ', every: 'ˈɛvri', both: 'boʊθ', few: 'fju', many: 'ˈmɛni',
  more: 'mɔr', most: 'moʊst', other: 'ˈʌðɚ', another: 'əˈnʌðɚ',
  such: 'sʌtʃ', only: 'ˈoʊnli', own: 'oʊn', same: 'seɪm', so: 'soʊ',
  than: 'ðæn', then: 'ðɛn', there: 'ðɛr', here: 'hɪr', now: 'naʊ',
  very: 'ˈvɛri', just: 'dʒʌst', also: 'ˈɔlsoʊ', too: 'tu', again: 'əˈgɛn',
  once: 'wʌns', over: 'ˈoʊvɚ', under: 'ˈʌndɚ', up: 'ʌp', down: 'daʊn',
  out: 'aʊt', off: 'ɔf', through: 'θru', between: 'bɪˈtwin', after: 'ˈæftɚ',
  before: 'bɪˈfɔr', because: 'bɪˈkʌz', while: 'waɪl', during: 'ˈdʊrɪŋ',
  against: 'əˈgɛnst', among: 'əˈmʌŋ', around: 'əˈraʊnd', across: 'əˈkrɔs',
  behind: 'bɪˈhaɪnd', below: 'bɪˈloʊ', above: 'əˈbʌv', along: 'əˈlɔŋ',
  without: 'wɪˈðaʊt', within: 'wɪˈðɪn', upon: 'əˈpɑn', toward: 'tɔrd',

  // ── the chart's example words ───────────────────────────────────────────
  sheep: 'ʃip', eagle: 'ˈigəl', field: 'fild', ship: 'ʃɪp', busy: 'ˈbɪzi',
  started: 'ˈstɑrtɪd', good: 'gʊd', put: 'pʊt', moon: 'mun', grew: 'gru',
  ear: 'ɪr', career: 'kəˈrɪr', train: 'treɪn', say: 'seɪ', plane: 'pleɪn',
  bed: 'bɛd', dead: 'dɛd', said: 'sɛd', police: 'pəˈlis', bird: 'bɝd',
  hurt: 'hɝt', work: 'wɝk', door: 'dɔr', walk: 'wɔk', saw: 'sɔ',
  sure: 'ʃʊr', tourist: 'ˈtʊrɪst', boy: 'bɔɪ', point: 'pɔɪnt', oil: 'ɔɪl',
  cat: 'kæt', apple: 'ˈæpəl', mat: 'mæt', money: 'ˈmʌni', cut: 'kʌt',
  car: 'kɑr', bath: 'bæθ', safari: 'səˈfɑri', bother: 'ˈbɑðɚ',
  hair: 'hɛr', careful: 'ˈkɛrfəl', high: 'haɪ', fine: 'faɪn',
  coat: 'koʊt', low: 'loʊ', note: 'noʊt', house: 'haʊs',
  pen: 'pɛn', hopping: 'ˈhɑpɪŋ', jump: 'dʒʌmp', ball: 'bɔl', hobby: 'ˈhɑbi',
  herb: 'ɝb', table: 'ˈteɪbəl', little: 'ˈlɪtəl', watched: 'wɑtʃt',
  dog: 'dɔg', added: 'ˈædɪd', played: 'pleɪd', chips: 'tʃɪps', itch: 'ɪtʃ',
  picture: 'ˈpɪktʃɚ', jam: 'dʒæm', danger: 'ˈdeɪndʒɚ', fudge: 'fʌdʒ',
  key: 'ki', luck: 'lʌk', green: 'grin', hug: 'hʌg', league: 'lig',
  fire: 'ˈfaɪɚ', laugh: 'læf', phone: 'foʊn', video: 'ˈvɪdioʊ', move: 'muv',
  thick: 'θɪk', healthy: 'ˈhɛlθi', teeth: 'tiθ', mother: 'ˈmʌðɚ',
  see: 'si', city: 'ˈsɪti', notice: 'ˈnoʊtɪs', zebra: 'ˈzibrə', has: 'hæz',
  shop: 'ʃɑp', nation: 'ˈneɪʃən', special: 'ˈspɛʃəl', television: 'ˈtɛləˌvɪʒən',
  visual: 'ˈvɪʒuəl', leisure: 'ˈliʒɚ', man: 'mæn', tummy: 'ˈtʌmi', lamb: 'læm',
  funny: 'ˈfʌni', knife: 'naɪf', sing: 'sɪŋ', uncle: 'ˈʌŋkəl', angry: 'ˈæŋgri',
  onion: 'ˈʌnjən', view: 'vju', light: 'laɪt', smelly: 'ˈsmɛli', feel: 'fil',
  right: 'raɪt', berry: 'ˈbɛri', wrong: 'rɔŋ', win: 'wɪn', one: 'wʌn',
  hungry: 'ˈhʌŋgri', cosy: 'ˈkoʊzi',

  // ── irregular / high-frequency content words ────────────────────────────
  people: 'ˈpipəl', person: 'ˈpɝsən', time: 'taɪm', year: 'jɪr', day: 'deɪ',
  week: 'wik', month: 'mʌnθ', hour: 'ˈaʊɚ', minute: 'ˈmɪnɪt', second: 'ˈsɛkənd',
  world: 'wɝld', life: 'laɪf', live: 'lɪv', love: 'lʌv', friend: 'frɛnd',
  family: 'ˈfæməli', child: 'tʃaɪld', children: 'ˈtʃɪldrən', woman: 'ˈwʊmən',
  women: 'ˈwɪmɪn', men: 'mɛn', baby: 'ˈbeɪbi', school: 'skul',
  student: 'ˈstudənt', teacher: 'ˈtitʃɚ', learn: 'lɝn', teach: 'titʃ',
  study: 'ˈstʌdi', book: 'bʊk', word: 'wɝd', words: 'wɝdz', language: 'ˈlæŋgwɪdʒ',
  english: 'ˈɪŋglɪʃ', speak: 'spik', speech: 'spitʃ', sound: 'saʊnd',
  voice: 'vɔɪs', listen: 'ˈlɪsən', hear: 'hɪr', talk: 'tɔk', tell: 'tɛl',
  told: 'toʊld', ask: 'æsk', answer: 'ˈænsɚ', question: 'ˈkwɛstʃən',
  know: 'noʊ', knew: 'nu', known: 'noʊn', think: 'θɪŋk', thought: 'θɔt',
  says: 'sɛz', read: 'rid', write: 'raɪt',
  wrote: 'roʊt', written: 'ˈrɪtən', give: 'gɪv', gave: 'geɪv', given: 'ˈgɪvən',
  take: 'teɪk', took: 'tʊk', taken: 'ˈteɪkən', make: 'meɪk', made: 'meɪd',
  come: 'kʌm', came: 'keɪm', go: 'goʊ', goes: 'goʊz', went: 'wɛnt', gone: 'gɔn',
  get: 'gɛt', got: 'gɑt', gotten: 'ˈgɑtən', seen: 'sin', look: 'lʊk', watch: 'wɑtʃ', find: 'faɪnd',
  found: 'faʊnd', want: 'wɑnt', need: 'nid', use: 'juz', used: 'juzd',
  help: 'hɛlp', play: 'pleɪ', run: 'rʌn', ran: 'ræn',
  turn: 'tɝn', start: 'stɑrt', stop: 'stɑp',
  keep: 'kip', kept: 'kɛpt', leave: 'liv', left: 'lɛft', bring: 'brɪŋ',
  brought: 'brɔt', buy: 'baɪ', bought: 'bɔt', pay: 'peɪ', paid: 'peɪd',
  build: 'bɪld', built: 'bɪlt', break: 'breɪk', broke: 'broʊk',
  eat: 'it', ate: 'eɪt', eaten: 'ˈitən', drink: 'drɪŋk', food: 'fud',
  water: 'ˈwɔtɚ', bread: 'brɛd', meat: 'mit', fruit: 'frut', vegetable: 'ˈvɛdʒtəbəl',
  head: 'hɛd', heart: 'hɑrt', hand: 'hænd', foot: 'fʊt', feet: 'fit',
  eye: 'aɪ', eyes: 'aɪz', mouth: 'maʊθ', tongue: 'tʌŋ', throat: 'θroʊt',
  nose: 'noʊz', face: 'feɪs', lip: 'lɪp', lips: 'lɪps', jaw: 'dʒɔ',
  body: 'ˈbɑdi', blood: 'blʌd', bone: 'boʊn', skin: 'skɪn',
  home: 'hoʊm', room: 'rum', floor: 'flɔr',
  country: 'ˈkʌntri', place: 'pleɪs', street: 'strit',
  road: 'roʊd', way: 'weɪ', side: 'saɪd', part: 'pɑrt', end: 'ɛnd',
  begin: 'bɪˈgɪn', began: 'bɪˈgæn', first: 'fɝst', last: 'læst',
  next: 'nɛkst', new: 'nu', old: 'oʊld', young: 'jʌŋ', great: 'greɪt',
  small: 'smɔl', large: 'lɑrdʒ', big: 'bɪg', long: 'lɔŋ', short: 'ʃɔrt',
  deep: 'dip', wide: 'waɪd', heavy: 'ˈhɛvi',
  beautiful: 'ˈbjutəfəl', pretty: 'ˈprɪti', ugly: 'ˈʌgli', clean: 'klin',
  dirty: 'ˈdɝti', warm: 'wɔrm', cold: 'koʊld', hot: 'hɑt', dry: 'draɪ',
  colour: 'ˈkʌlɚ', color: 'ˈkʌlɚ', red: 'rɛd', blue: 'blu', yellow: 'ˈjɛloʊ',
  black: 'blæk', white: 'waɪt', brown: 'braʊn', orange: 'ˈɔrɪndʒ',
  purple: 'ˈpɝpəl', pink: 'pɪŋk', grey: 'greɪ', gray: 'greɪ',
  zero: 'ˈzɪroʊ', two: 'tu', three: 'θri', four: 'fɔr', five: 'faɪv',
  six: 'sɪks', seven: 'ˈsɛvən', eight: 'eɪt', nine: 'naɪn', ten: 'tɛn',
  eleven: 'ɪˈlɛvən', twelve: 'twɛlv', twenty: 'ˈtwɛnti', hundred: 'ˈhʌndrəd',
  thousand: 'ˈθaʊzənd', million: 'ˈmɪljən', number: 'ˈnʌmbɚ',
  business: 'ˈbɪznɪs', company: 'ˈkʌmpəni', office: 'ˈɔfɪs',
  computer: 'kəmˈpjutɚ', machine: 'məˈʃin', internet: 'ˈɪntɚˌnɛt',
  music: 'ˈmjuzɪk', song: 'sɔŋ', dance: 'dæns', art: 'ɑrt', film: 'fɪlm',
  game: 'geɪm', sport: 'spɔrt', team: 'tim', spider: 'ˈspaɪdɚ', hero: 'ˈhɪroʊ',
  power: 'ˈpaʊɚ', web: 'wɛb', comic: 'ˈkɑmɪk', super: 'ˈsupɚ',
  amazing: 'əˈmeɪzɪŋ', awesome: 'ˈɔsəm', wonderful: 'ˈwʌndɚfəl',
  important: 'ɪmˈpɔrtənt', different: 'ˈdɪfrənt', difficult: 'ˈdɪfɪkəlt',
  easy: 'ˈizi', possible: 'ˈpɑsəbəl', probably: 'ˈprɑbəbli', really: 'ˈrili',
  actually: 'ˈæktʃuəli', certainly: 'ˈsɝtənli', usually: 'ˈjuʒuəli',
  together: 'təˈgɛðɚ', however: 'haʊˈɛvɚ', example: 'ɪgˈzæmpəl',
  something: 'ˈsʌmθɪŋ', nothing: 'ˈnʌθɪŋ', anything: 'ˈɛniθɪŋ',
  everything: 'ˈɛvriθɪŋ', someone: 'ˈsʌmwʌn', everyone: 'ˈɛvriwʌn',
  anyone: 'ˈɛniwʌn', nobody: 'ˈnoʊbədi', everybody: 'ˈɛvriˌbɑdi',
  enough: 'ɪˈnʌf', tough: 'tʌf',
  rough: 'rʌf', cough: 'kɔf', though: 'ðoʊ', although: 'ɔlˈðoʊ',
  thorough: 'ˈθɝoʊ', bough: 'baʊ', daughter: 'ˈdɔtɚ', laughter: 'ˈlæftɚ',
  island: 'ˈaɪlənd', honest: 'ˈɑnɪst', honour: 'ˈɑnɚ',
  honor: 'ˈɑnɚ', ghost: 'goʊst', rhythm: 'ˈrɪðəm', science: 'ˈsaɪəns',
  scissors: 'ˈsɪzɚz', sword: 'sɔrd', castle: 'ˈkæsəl',
  often: 'ˈɔfən', receipt: 'rɪˈsit', debt: 'dɛt',
  doubt: 'daʊt', subtle: 'ˈsʌtəl', muscle: 'ˈmʌsəl', column: 'ˈkɑləm',
  autumn: 'ˈɔtəm', foreign: 'ˈfɔrɪn', sign: 'saɪn', design: 'dɪˈzaɪn',
  campaign: 'kæmˈpeɪn', bury: 'ˈbɛri', chaos: 'ˈkeɪɑs', choir: 'ˈkwaɪɚ', queue: 'kju',
  colonel: 'ˈkɝnəl', yacht: 'jɑt', suite: 'swit', genre: 'ˈʒɑnrə',
  beige: 'beɪʒ', garage: 'gəˈrɑʒ', massage: 'məˈsɑʒ', measure: 'ˈmɛʒɚ',
  pleasure: 'ˈplɛʒɚ', treasure: 'ˈtrɛʒɚ', usual: 'ˈjuʒuəl', casual: 'ˈkæʒuəl',
  vision: 'ˈvɪʒən', decision: 'dɪˈsɪʒən', occasion: 'əˈkeɪʒən',
  station: 'ˈsteɪʃən', future: 'ˈfjutʃɚ',
  nature: 'ˈneɪtʃɚ', culture: 'ˈkʌltʃɚ', adventure: 'ædˈvɛntʃɚ',
  phonetic: 'fəˈnɛtɪk', phonetics: 'fəˈnɛtɪks', phoneme: 'ˈfoʊnim',
  alphabet: 'ˈælfəˌbɛt', vowel: 'ˈvaʊəl', consonant: 'ˈkɑnsənənt',
  syllable: 'ˈsɪləbəl', stress: 'strɛs', accent: 'ˈæksɛnt',
  pronounce: 'prəˈnaʊns', pronunciation: 'prəˌnʌnsiˈeɪʃən',
  articulation: 'ɑrˌtɪkjəˈleɪʃən', tongues: 'tʌŋz', palate: 'ˈpælɪt',
  velum: 'ˈviləm', larynx: 'ˈlærɪŋks', glottal: 'ˈglɑtəl',
  america: 'əˈmɛrɪkə', american: 'əˈmɛrɪkən', britain: 'ˈbrɪtən',
  british: 'ˈbrɪtɪʃ', england: 'ˈɪŋglənd', australia: 'ɔˈstreɪljə',
  australian: 'ɔˈstreɪljən', london: 'ˈlʌndən', sydney: 'ˈsɪdni',
  news: 'nuz', tube: 'tub', duke: 'duk', tuesday: 'ˈtuzdeɪ', chance: 'tʃæns', class: 'klæs',
  glass: 'glæs', grass: 'græs', pass: 'pæs', past: 'pæst', fast: 'fæst',
  task: 'tæsk', half: 'hæf', calm: 'kɑm', palm: 'pɑm',
  // irregulars the rule engine cannot reach from the spelling alone
  common: 'ˈkɑmən', comment: 'ˈkɑmɛnt', allow: 'əˈlaʊ', villain: 'ˈvɪlən',
  certain: 'ˈsɝtən', mountain: 'ˈmaʊntən', captain: 'ˈkæptən',
  curtain: 'ˈkɝtən', bargain: 'ˈbɑrgən', fountain: 'ˈfaʊntən',
  photograph: 'ˈfoʊtəˌgræf', photography: 'fəˈtɑgrəfi',
  anger: 'ˈæŋgɚ', finger: 'ˈfɪŋgɚ', longer: 'ˈlɔŋgɚ', singer: 'ˈsɪŋɚ',
  success: 'səkˈsɛs', succeed: 'səkˈsid', spidey: 'ˈspaɪdi',
  father: 'ˈfɑðɚ', cannot: 'ˈkænɑt', hello: 'həˈloʊ', goodbye: 'gʊdˈbaɪ', please: 'pliz', thanks: 'θæŋks',
  thank: 'θæŋk', sorry: 'ˈsɑri', welcome: 'ˈwɛlkəm', okay: 'oʊˈkeɪ',
};

/**
 * Look a word up. Heteronyms (read, live, use, minute, lead, ...) are stored
 * with their most frequent reading only; disambiguating them needs
 * part-of-speech tagging, which is out of scope for this engine.
 *
 * @param {string} word
 * @returns {string|undefined} IPA in the General American base dialect
 */
export function lookup(word) {
  const w = String(word || '').toLowerCase();
  if (Object.prototype.hasOwnProperty.call(LEXICON, w)) return LEXICON[w];
  return undefined;
}

export function lexiconSize() {
  return Object.keys(LEXICON).length;
}
